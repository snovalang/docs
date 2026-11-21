---
title: Coming Soon y Hoja de Ruta Técnica
description: Especificación transparente y basada en código fuente de cada característica planificada o en desarrollo del contrato de seguridad de memoria (P1-P11), tipos, backends, biblioteca estándar y herramientas.
page_id: coming-soon
section_label: Herramientas y Hoja de Ruta
permalink: /es/coming-soon/
---

Todos los elementos de esta página proceden directamente de `docs/spec/memory-safety.md`, `docs/plans/memory-safety-execution.md`, `docs/plans/memory-safety-progress.md`, `docs/language-status.md`, `src/sema/check.h`, `builtin/readme.md` y `snova-lsp/README.md`. La sintaxis marcada como **`[PROPOSED — Pn]`** está ratificada en el contrato normativo para la etapa `Pn` y **todavía no es aceptada** por el parser o runtime activos en `src/`.

## 1. Hoja de Ruta de Seguridad de Memoria y Sistemas (Etapas P1–P11)

| Etapa | Estado | Alcance y Entregables Clave |
| --- | --- | --- |
| **P0** | {% include status-badge.html status="implemented" label="Completado" %} | Auditoría basada en código del compilador activo en `src/`, backends y brechas. |
| **P1** | {% include status-badge.html status="in_progress" %} | Contrato normativo (`docs/spec/memory-safety.md`), pipeline de seguridad compartido en todas las rutas, `SnTargetDescriptor` y comprobaciones `SNOVA0401`–`0403` implementados localmente; Darwin/AArch64 calificado. Puertas abiertas: ejecución en CI Linux x86-64, gate ejecutable Windows x86-64 y aprobación del CODEOWNER (`@yurimoinhos`). |
| **P2** | {% include status-badge.html status="coming_soon" %} | IR explícito de CFG y `Place` (`src/ir/`): IDs de función/bloque, locales tipados, `Place = local + proyecciones de campo/índice/deref`, cortocircuito explícito, aristas de limpieza para `finally`/`defer`, verificador estructural y eliminación del límite `SN_BORROW_MAX = 96`. |
| **P3** | {% include status-badge.html status="coming_soon" %} | Análisis de flujo de datos con *worklist* monótona sobre el CFG: hechos *maybe-uninitialized* y *maybe-moved*, vivacidad hacia atrás, validez de préstamos, sintaxis explícita `&mut T` / `&mut expr`, préstamos disjuntos por campo (`s.a` vs `s.b`), resúmenes interprocedimentales, rechazo de escapes sin promoción silenciosa al heap e invalidación de pruebas de longitud tras mutación/reducción. |
| **P4** | {% include status-badge.html status="coming_soon" %} | RAII determinista y elaboración de drops: destrucción en orden inverso de declaración, `defer` LIFO en todas las aristas de salida, propietario único `Unique<T>` (move-only) con identidad de asignador/layout (`Unique.tryNew`), *pinning* opcional y `close()` como transición de estado. |
| **P5** | {% include status-badge.html status="coming_soon" %} | Sistema de efectos `unsafe` preservado (`unsafe func`, `unsafe method`, `unsafe { ... }`), punteros crudos distintos `*const T` y `*mut T`, seguimiento de procedencia/generación en compilaciones verificadas, aritmética verificada de punteros (`offset`, `distanceTo`), prohibiendo desreferencia *one-past* y resta entre asignaciones distintas. |
| **P6** | {% include status-badge.html status="coming_soon" %} | Propiedad compartida/débil con bloque de control dividido: `Shared<T>` / `Weak<T>` atómicos transferibles (`Send` cuando `T: Send + Sync`) y `LocalShared<T>` / `LocalWeak<T>` no atómicos para un solo hilo (no-`Send`). Política v1 ratificada: los ciclos de referencias fuertes son seguros en memoria y pueden fugarse; `Weak<T>` rompe ciclos de forma determinista. |
| **P7** | {% include status-badge.html status="coming_soon" %} | Layout de structs/enums derivado del target (`sizeof`, `alignof`, `offsetof`, relleno, etiquetas) y ABI C FFI estable (`ByteView.fromForeignChecked`, evitando el unwinding de excepciones del lenguaje a través de frames C externos). |
| **P8** | {% include status-badge.html status="coming_soon" %} | Mapeos de memoria virtual hospedados: `MappedRegion.anonymous` seguro (separando `READ`/`WRITE`/`EXEC`, sin exponer nunca `WRITE + EXEC` seguro), `MappedRegion.mapFile` marcado como `unsafe` (contrato de truncamiento externo) y vistas prestadas `ByteView`/`ByteSpan` impidiendo `close`/`remap` mientras estén vivas. |
| **P9** | {% include status-badge.html status="blocked" %} | Capacidades MMIO de dispositivo (`DeviceRegion`, lecturas/escrituras volátiles `unsafe` separadas de atómicas). Bloqueado a la espera de seleccionar placa/proveedor de SO concreto. |
| **P10** | {% include status-badge.html status="coming_soon" %} | Corpus compartido multi-backend, verificador tipado de pila/CFG para SnBC, fuzzing sostenido de parser/checker/bytecode, ASan/UBSan/TSan e inyección de fallos. |
| **P11** | {% include status-badge.html status="coming_soon" %} | Puertas de pruebas de mutación por módulo (Mull) con mínimos medidos para CFG/préstamos, aritmética de punteros, cargador SnBC, límites, bloques de control y mapeos. |

### Vista Previa de la Sintaxis Ratificada del Contrato P1 (`[PROPOSED — P5/P8]`)

Todavía no aceptada por el parser activo; tomada directamente de `docs/spec/memory-safety.md`:

```snova
// [PROPOSED — P5] Separación entre obligación del llamador (`unsafe func`) y permiso en el cuerpo (`unsafe { ... }`)
func readChecked(x: &int): int {
    let p: *const int = x as *const int
    unsafe {
        return *p
    }
}

// [PROPOSED — P8] Mapeo anónimo seguro con vistas acotadas al tiempo de vida
func mapAndRead(): int {
    var region = MappedRegion.anonymous(4096, MapAccess.READ_WRITE).unwrap()
    if true {
        let view = region.view()
        let _ = view.get(0)
    }
    region.close() // rechazado en compilación si `view` sigue viva
    return 0
}
```

## 2. Parser, Sistema de Tipos y Semántica {% include status-badge.html status="coming_soon" %}

Registrado directamente en `docs/language-status.md` y `src/sema/check.h`:

- **Literales de función en llamadas concurrentes (`SNOVA0148`)**: Aceptar literales de función pasados a `spawn`, `scope` y `Parallel` sin invocación inmediata (elimina las 3 excepciones de `tests/conformance.allow`).
- **Genéricos completos**: Comprobación de *bounds* de parámetros genéricos, sustitución de parámetros de tipo en puntos de llamada (haciendo que métodos en `Container<int>` devuelvan `int` en lugar de `T`) e inferencia de argumentos genéricos por uso.
- **Inferencia bidireccional de tipo esperado**: Propagación de tipos esperados hacia lambdas sin anotar, expresiones `if`/`match` como valor, literales de struct y payloads de patrones de `match`.
- **Tuplas**: Incorporación de tuplas a `SnTypeTag` con construcción y verificación de compatibilidad.
- **Protocolo `Iterable`**: Generalizar bucles `for` más allá de rangos enteros, arrays y `Channel<T>`.
- **Tipo común en literales de array**: Inferir un supertipo común asignable en lugar de fijarse solo en el primer elemento (`SNOVA0149`).
- **Operador `?` finalizado**: Formalizar la semántica de propagación de errores más allá del desenvuelto provisional de `Option`/`Result`.
- **Verificación estática de interpolación**: Exponer subexpresiones `${expr}` en la AST y al verificador semántico en lugar de reanalizarlas solo en runtime.
- **Protocolo de hashing**: Habilitar implementaciones hash para `Map` y `Set` (actualmente búsqueda lineal por igualdad).

## 3. Paridad de Backends y Ejecución Nativa {% include status-badge.html status="coming_soon" %}

- **Lowering de excepciones y limpieza en SnBC / Nativo**: Soportar `try`, `catch`, `finally` y `throw` (eliminando `SNOVA0400`) y ejecutar `defer` ante errores de runtime en `run-snbc` y `snl build` con la misma semántica que `snl run`.
- **Eliminar el tope de 8 argumentos en `OP_DEFER`**: Ampliar la aridad admitida por SnBC.
- **Llamadas de host en el runner nativo**: Exponer sockets TCP/UDP, reloj monotónico y mutex del SO en binarios generados por `snl build` para igualar `Net`, `HttpServer`, `Time`, `Mutex<T>` y `Channel<T>` con el intérprete.
- **Calificación de targets**: Promover `x86_64-unknown-linux-gnu` y `x86_64-pc-windows-gnu` de `PENDING_VALIDATION` a `QUALIFIED` con puertas ejecutables en CI.

## 4. Concurrencia, HTTP y E/S en Streaming {% include status-badge.html status="coming_soon" %}

- **Planificación asíncrona concurrente**: Planificar `Async.spawn`, `Async.scope` y `TaskScope.spawn` concurrentemente en vez de ejecutarlos en línea en el intérprete, y modelar estrictamente `Task<T>` en el checker.
- **`Channel<T>` bloqueante y `select`**: Añadir envío/recepción bloqueante, `select` e integración con planificador; sincronización atómica/bloqueante entre hilos para `Semaphore` y `WaitGroup`.
- **HTTP/1.1 avanzado**: TLS, *chunked transfer encoding*, conexiones persistentes *keep-alive*, cuerpos binarios y planificación concurrente de peticiones en `HttpServer`.
- **E/S incremental de bytes**: Flujos binarios incrementales en `FileInputStream`/`FileOutputStream` más allá del buffer actual de archivo de texto completo.

## 5. Herramientas y Self-Hosting {% include status-badge.html status="coming_soon" %}

- **Migración completa de `snova-lsp` a Snovalang (`SL-2`)**: Trasladar el servidor stdio en C y el puente de análisis con `snovac` a `Snova.Lsp` (`.snl`).
- **Bootstrap self-hosted reproducible**: Recompilación reproducible y verificación por *diverse double-compilation* de `bootstrap/src/compiler.snl`.
- **Publicación en galerías oficiales**: Aceptación en la galería oficial de extensiones de Zed junto con publicación automatizada en Visual Studio Marketplace, Open VSX y JetBrains Marketplace.
