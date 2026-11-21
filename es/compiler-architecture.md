---
title: Implementación del Compilador (snovac)
description: Arquitectura técnica detallada del compilador activo snovac en ISO C11, fases de compilación, formato SnBC, runner nativo en C, compilador bootstrap, targets y ABI C de host.
page_id: compiler-architecture
section_label: Compilador y Runtime
permalink: /es/compiler-architecture/
---

**`snovac`** es el compilador oficial de referencia de Snovalang, escrito en **ISO C11** puro, sin dependencias externas, y compilado con advertencias estrictas (`-std=c11 -O2 -g -pthread -Wall -Wextra -Wpedantic -Wshadow -Wstrict-prototypes -Wmissing-prototypes -Wconversion`).

<div class="callout callout-warn">
  <span class="callout-title">Árbol de Código Fuente Activo</span>
  El compilador activo compilado por <code>Makefile</code> vive exclusivamente en <code>src/</code>. Los directorios históricos en la raíz (<code>frontend/</code>, <code>semantic/</code>, <code>runtime/</code>, <code>backend/</code>) <strong>no</strong> forman parte de <code>SRCS</code> en <code>Makefile</code>.
</div>

## Mapa de Módulos con Espacios de Nombres (`src/`)

Cada subsistema reside bajo `src/<namespace>` con prefijos propios de identificadores en C:

| Directorio | Prefijos | Responsabilidad |
| --- | --- | --- |
| `src/base/` | `sn_arena_`, `sn_diag_`, `sn_intern_` | Arenas alineadas (`SnArena`), colector estructurado de diagnósticos `SNOVA` (`SnDiagSink`) e internado de cadenas (`SnInternTable`). |
| `src/lex/` | `sn_lex_`, `sn_tok_` | Escáner léxico, tabla de palabras clave contextuales (`KEYWORDS[]`), literales numéricos/cadena/carácter e indicador de interpolación `${...}`. |
| `src/parse/` | `sn_parse_` | Parser descendente recursivo con recuperación en modo pánico que devuelve un `SnUnit` parcial y análisis de punteros/referencias (`parse_ptr.c`). |
| `src/ast/` | `sn_list_`, `sn_dump_` | Nodos AST alojados en arena y volcador formateado (`--emit=ast`). |
| `src/sema/` | `sn_scope_`, `sn_pkggraph_`, `sn_type_`, `sn_resolve_`, `sn_builtin_`, `sn_check_`, `sn_borrow_` | Grafo de paquetes y detección de ciclos, recolección de declaraciones y preludio, tabla `SnTypeRep` con hash-consing, verificación de tipos/efectos, ajustes de punteros y análisis de borrow/capturas Pulsar. |
| `src/eval/` | `sn_eval_`, `sn_rt_`, `sn_async_`, `sn_pulsar_`, `sn_socket_` | Intérprete *tree-walking* (`sn_eval_run`), memoria por regiones/frames (`rt_mem.c`), referencias (`rt_ptr.c`), `defer` (`rt_defer.c`), sockets (`socket_abi.c`), despacho nativo, bucle asíncrono, pool Pulsar y ABI C (`runtime_api.h`). |
| `src/bc/` | `sn_chunk_`, `sn_bcunit_`, `sn_emit_` | Lowering a bytecode `SnBC`, escritor/cargador canónico little-endian, listado determinista `.snbt` y validador estructural (`snbc_validate.inc`). |
| `src/native/` | `sn_native_`, `sn_target_` | Descriptor de targets y matriz de capacidades (`target.c`), generador de runner C independiente (`native_backend.c`), empaquetador con runtime incrustado (`--runtime`) y alcance de valores de tarea (`native_scope.c`). |
| `src/driver/` | `sn_driver_`, `sn_project_`, `sn_cmd_` | Punto de entrada de la CLI `snl`, descubrimiento de proyectos/manifiestos/builtins y comandos (`check`, `run`, `build`, `emit-snbc`, `run-snbc`, `get`, `tidy`). |
| `builtin/` | — | Declaraciones e implementaciones en `.snl` de la biblioteca estándar builtin. |

## Pipeline de Compilación

A partir de la etapa **P1**, todo comando que ejecuta o emite código (`check`, `run`, `emit-snbc`, `build`, `build --project --runtime`) atraviesa el mismo pipeline compartido de resolución, verificación de tipos/efectos y validación de ownership/borrow antes del lowering o ejecución:

```text
  Código fuente .snl / .sns
         │
         ▼
  [1] src/lex      ──▶ Flujo de tokens (--emit=tokens, --check-lex)
         │
         ▼
  [2] src/parse    ──▶ AST SnUnit en arena (--emit=ast, --check-parse)
         │
         ▼
  [3] src/sema     ──▶ Grafo de paquetes (sn_pkggraph_*)
                   ──▶ Recolección de declaraciones + Preludio (sn_resolve_*)
                   ──▶ Tipos hash-consed + Verificación de tipos/efectos (sn_check_*)
                   ──▶ Ownership, borrow y capturas Pulsar (sn_borrow_*)
         │
         ├──▶ snl check             (termina tras sema)
         │
         ├──▶ snl run               ──▶ [4a] src/eval: Intérprete tree-walking (sn_eval_run)
         │
         ├──▶ snl emit-snbc         ──▶ [4b] src/bc: Imagen .snbc canónica + listado .snbt
         │         │
         │         ▼
         ├──▶ snl run-snbc / build  ──▶ [4c] src/native: Valida SnBC → genera runner C → CC del host
         │
         └──▶ snl build --project --runtime
                                    ──▶ [4d] src/native: Incrusta fuentes verificadas + enlaza libsnovart.a
```

## Backends de Ejecución

### 1. Intérprete Tree-Walking (`snl run`)

- Punto de entrada: `sn_eval_run` en `src/eval/eval.c`.
- **No existe** VM de bytecode en proceso dentro de `src/` (`vm.c` no forma parte del compilador activo).
- Es la ruta con mayor cobertura funcional hoy: soporta `try`/`catch`/`finally`, `throw`, aridad ilimitada en `defer`, unwind de `defer` ante errores de runtime, sockets TCP/UDP, servidor HTTP/1.1, reloj monotónico y mutex del SO.
- Usa regiones privadas por ámbito con retención por escape y un límite de 64 MiB en el heap de respaldo (código de salida `70`).

### 2. Bytecode Snovalang (`SnBC` — `src/bc/`)

`snl emit-snbc <archivo.snl> -o <salida.snbc>` genera una imagen binaria portable canónica en little-endian y un listado textual determinista `.snbt` (un hecho por línea, sin rutas ni marcas de tiempo).

**Cabecera y estructura (`src/bc/snbc.h`):**

- Magic: `0x43424E53` (`"SNBC"`, 4 bytes)
- Versión: `SNBC_VERSION = 1`
- `main_func_idx`: `uint32_t`
- `SnStringPool`: cadenas UTF-8 con longitud prefijada (`uint32_t`)
- `SnFunctionChunk[]`: nombre de función, `arity`, `local_count`, bytes de `code` y tabla `lines`

**Conjunto de instrucciones (`SnOpcode` en `src/bc/snbc.h`):**

| Grupo | Opcodes |
| --- | --- |
| Constantes y pila | `OP_NOP`, `OP_CONST_INT` (`int64_t`), `OP_CONST_DOUBLE` (`double`), `OP_CONST_STRING`, `OP_CONST_BOOL`, `OP_CONST_UNIT`, `OP_CONST_NULL`, `OP_POP`, `OP_DUP` |
| Variables | `OP_GET_LOCAL`, `OP_SET_LOCAL`, `OP_GET_GLOBAL`, `OP_SET_GLOBAL` |
| Aritmética y bit a bit | `OP_ADD`, `OP_SUB`, `OP_MUL`, `OP_DIV`, `OP_MOD`, `OP_NEG`, `OP_NOT`, `OP_BIT_AND`, `OP_BIT_OR`, `OP_BIT_XOR`, `OP_SHL`, `OP_SHR` |
| Comparación | `OP_EQ`, `OP_NE`, `OP_LT`, `OP_LE`, `OP_GT`, `OP_GE` |
| Flujo de control | `OP_JUMP`, `OP_JUMP_IF_FALSE`, `OP_JUMP_IF_TRUE`, `OP_CALL`, `OP_INVOKE`, `OP_RETURN`, `OP_TRAP`, `OP_HALT` |
| Objetos, arrays y enums | `OP_NEW_OBJ`, `OP_GET_FIELD`, `OP_SET_FIELD`, `OP_NEW_ARRAY`, `OP_GET_INDEX`, `OP_SET_INDEX`, `OP_ARRAY_LEN`, `OP_ARRAY_PUSH`, `OP_IS_ARRAY`, `OP_VARIANT`, `OP_IS_VARIANT`, `OP_UNWRAP_VARIANT` |
| Limpieza, concurrencia y host | `OP_DEFER` (máx. 8 args), `OP_SPAWN` (lanzamiento Pulsar), `OP_CALL_ASYNC`, `OP_PRINT`, `OP_READ_BYTES`, `OP_WRITE_BYTES`, `OP_RUNTIME_API` |

**Validación (`snbc_validate.inc`)**: `sn_bcunit_load_canonical` construye estado temporal y valida fronteras de instrucción, operandos seleccionados, índices de función/cadena y saltos antes de reemplazar el destino. La verificación tipada de pila y flujo de control está prevista para **P10**. Las construcciones no soportadas (como `try`/`catch`/`finally` y `throw`) se rechazan explícitamente con `SNOVA0400`.

### 3. Compilación Nativa (`snl build` y `snl run-snbc`)

- **Compilación nativa estándar (`snl build <archivo.snl> -o <salida>`)**: Verifica tipos, emite `SnBC`, genera un runner en C independiente mediante `sn_native_compile` (con su propio modelo de valores, guardas de límites/ciclos y cola de workers Pulsar) e invoca al compilador C del host. `snl run-snbc` carga una imagen `.snbc` canónica y la ejecuta mediante ese mismo generador.
- **Paquete con runtime incrustado (`snl build --project <ruta> --runtime`)**: Incrusta las fuentes verificadas del proyecto y enlaza con `libsnovart.a` (todos los objetos de `src/` salvo `main.c`) y los encabezados del compilador. `--runtime` requiere `--project` (pasarlo a un archivo único devuelve estado `2`).

### 4. Compilador Bootstrap Self-Hosting (`bootstrap/src/`)

El repositorio incluye un compilador escrito en Snovalang (`bootstrap/src/compiler.snl`, ensamblado con `join.sh` a partir de `part_lex.snl`, `part_parse.snl`, `part_parse_decl.snl`, `part_scope_*.snl`, `part_emit*.snl` y `part_unit.snl`). Lee `in.snl` con `read_bytes`, ejecuta análisis léxico, sintáctico y emisión, y escribe una imagen `SNBC` versión 1 en `out.snbc` con `write_bytes`.

## Descriptores de Target y Calificación (`src/native/target.h`)

`SnTargetDescriptor` registra ancho/alineación de puntero, endianness, alineaciones escalares (`i16`/`i32`/`i64`/`f32`/`f64`/`max_align`), convención de llamada, anchos atómicos (`8`/`16`/`32`/`64`), tamaño mínimo de página, granularidad de asignación, indicadores de sistema hospedado/VM/MMIO y nivel de calificación.

| Target Triple | Puntero / Endian | Convención | Atómicas | Nivel de Calificación |
| --- | --- | --- | --- | --- |
| `aarch64-apple-darwin` | 64-bit / LE | `aapcs64` | 8/16/32/64 | **QUALIFIED** |
| `x86_64-unknown-linux-gnu` | 64-bit / LE | `sysv-amd64` | 8/16/32/64 | **PENDING_VALIDATION** |
| `x86_64-pc-windows-gnu` | 64-bit / LE | `win64` | 8/16/32/64 | **PENDING_VALIDATION** |
| Otros triples hospedados (`x86_64-apple-darwin`, `aarch64-unknown-linux-gnu`, `riscv64-*`, `*bsd`, `arm`, `x86`) | Definido por target | Definido por target | Definido por target | **UNQUALIFIED** |
| Bare-metal (`*-none-*`, p. ej., `aarch64-none-elf`, `arm-none-eabi`) | Definido por target | Definido por target | Definido por target | **UNQUALIFIED / BLOCKED** |

Las consultas de capacidad devuelven `SN_CAP_STATUS_IMPLEMENTED`, `SN_CAP_STATUS_PENDING_VALIDATION` o `SN_CAP_STATUS_UNSUPPORTED`, emitiendo `SNOVA0401`–`SNOVA0403` antes de la ejecución ante targets inválidos o capacidades no soportadas.

## ABI C para Integración (`src/eval/runtime_api.h`)

Los programas que enlazan `libsnovart.a` usan `runtime_api.h`. Todas las funciones devuelven `SnRuntimeStatus` independiente de `errno` (`SN_RUNTIME_OK`, `SN_RUNTIME_INVALID_ARGUMENT`, `SN_RUNTIME_NOT_FOUND`, `SN_RUNTIME_PERMISSION_DENIED`, `SN_RUNTIME_IO_ERROR`, `SN_RUNTIME_OUT_OF_MEMORY`, `SN_RUNTIME_END_OF_INPUT`). Los buffers devueltos por lecturas de archivo o stdin terminan en NUL y deben liberarse con `sn_runtime_free()`.

```c
char *text = NULL;
size_t len = 0;
SnRuntimeStatus st = sn_runtime_file_read("config.txt", &text, &len);
if (st == SN_RUNTIME_OK) {
    /* usar text */
    sn_runtime_free(text);
}
```
