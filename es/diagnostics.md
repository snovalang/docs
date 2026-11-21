---
title: Diagnósticos y Verificación
description: Catálogo exacto de códigos SNOVA verificado directamente en los encabezados de snovac, junto con las pruebas, conformidad, fuzzing y benchmarks del compilador.
page_id: diagnostics
section_label: Compilador y Runtime
permalink: /es/diagnostics/
---

`snovac` emite códigos numéricos estables con formato `SNOVA0001` a `SNOVA0499`, repartidos en bandas por fase de compilación para que los códigos no cambien entre versiones.

## Catálogo de Códigos de Diagnóstico

### Lexer (`0001`–`0099`, `src/base/diag.h`)

| Código | Constante | Significado |
| --- | --- | --- |
| `SNOVA0001` | `SNOVA_UNTERMINATED_STRING` | Literal de cadena llegó a EOF sin cerrar `"`. |
| `SNOVA0002` | `SNOVA_UNTERMINATED_CHAR` | Literal de carácter sin cerrar `'`. |
| `SNOVA0003` | `SNOVA_UNKNOWN_CHARACTER` | Carácter no reconocido en la fuente. |
| `SNOVA0004` | `SNOVA_INVALID_NUMBER` | Literal numérico mal formado. |
| `SNOVA0005` | `SNOVA_INVALID_ESCAPE` | Secuencia de escape inválida en cadena o carácter. |
| `SNOVA0006` | `SNOVA_UNTERMINATED_INTERP` | Interpolación `${...}` sin cerrar dentro de cadena. |

### Resolución, Paquetes y Forma de Declaración (`src/sema/package.h`, `resolve.h`, `check.h`, `project.c`)

| Código | Constante | Significado |
| --- | --- | --- |
| `SNOVA0008` | `SNOVA_UNCLOSED_BRACE` | Delimitador `{` sin `}` correspondiente al llegar a EOF. |
| `SNOVA0011` | `SNOVA_LEGACY_TYPE_SPELLING` | **Advertencia**: grafía heredada en mayúscula de tipo primitivo (p. ej., `Int` en vez de `int`). |
| `SNOVA0013` | `SNOVA_AWAIT_OUTSIDE_ASYNC` | `await` usado fuera de `async func` o `async method`. |
| `SNOVA0023` | `SNOVA_UNDECLARED_NAME` | Identificador no encontrado en ámbitos local, miembro, paquete, imports o preludio. |
| `SNOVA0027` | `SNOVA_UNKNOWN_TYPE` | Tipo inexistente en todo el grafo de paquetes. |
| `SNOVA0028` | `SNOVA_UNKNOWN_MEMBER` | Miembro inexistente en el tipo destino. |
| `SNOVA0030` | `SNOVA_FUNC_IN_TYPE_BODY` | `func` declarada dentro de clase/struct (usa `method`; `func` es legal en `extension`). |
| `SNOVA0031` | `SNOVA_METHOD_AT_TOP_LEVEL` | `method` declarado a nivel superior (usa `func`). |
| `SNOVA0047` | `SNOVA_IMMUTABLE_REASSIGN` | Reasignación a enlace inmutable `let` (fuera de `constructor`). |
| `SNOVA0050` | `SNOVA_IMPORT_NOT_FOUND` | Paquete importado no descubierto en el grafo. |
| `SNOVA0051` | `SNOVA_IMPORT_FILE_EXTENSION` | Ruta de `import` incluye una extensión de archivo. |
| `SNOVA0052` | *(project.c)* | Directorio de submódulo referenciado en `references = [...]` de `mod.sns` no existe. |
| `SNOVA0100` | `SNOVA_UNTYPED_VARIABLE` | Variable o literal de array vacío sin anotación ni contexto inferible. |
| `SNOVA0108` | `SNOVA_IMPORT_CYCLE` | Ciclo circular de importaciones entre dos o más paquetes distintos. |
| `SNOVA0109` | `SNOVA_MISSING_PACKAGE_DECL` | Archivo `.snl` sin declaración `package`. |
| `SNOVA0120` | `SNOVA_DUPLICATE_DECL` | Nombre duplicado en el ámbito o firma de método repetida. |
| `SNOVA0121` | `SNOVA_TYPE_NOT_IMPORTED` | El tipo existe en el grafo pero no fue importado en el archivo actual. |

### Pulsar y Verificador de Tipos (`0122`–`0220`, `src/sema/check.h`, `borrow.h`)

| Código | Constante | Significado |
| --- | --- | --- |
| `SNOVA0122` | `SNOVA_PULSAR_INVALID_RETURN` | Tipo de retorno de `pulsar` distinto de `unit`, `Channel<T>` o `Select<T>`. |
| `SNOVA0124` | `SNOVA_PULSAR_DIRECT_CALL` | Llamada directa a rutina `pulsar` (debe lanzarse con `pulsar`). |
| `SNOVA0125` | `SNOVA_PULSAR_IN_ASYNC` / `SNOVA_PULSAR_MUTABLE_CAPTURE` | Rutina marcada `async` y `pulsar`, o captura de enlace mutable en tarea Pulsar. |
| `SNOVA0126` | `SNOVA_PULSAR_NON_SEND_CAPTURE` | Captura de valor no-`Send` en frontera Pulsar. |
| `SNOVA0131` | `SNOVA_ARITY_MISMATCH` | Número de argumentos no coincide con los parámetros. |
| `SNOVA0132` | `SNOVA_ARG_TYPE_MISMATCH` | Tipo de argumento incompatible con el parámetro. |
| `SNOVA0133` | `SNOVA_BINARY_TYPE_MISMATCH` | Operandos incompatibles en operador binario (sin promoción implícita). |
| `SNOVA0134` | `SNOVA_UNARY_TYPE_MISMATCH` | Tipo de operando inválido en operador unario. |
| `SNOVA0135` | `SNOVA_CONDITION_NOT_BOOL` | Condición de `if` o `while` no es `bool`. |
| `SNOVA0136` | `SNOVA_RETURN_TYPE_MISMATCH` | Expresión devuelta no coincide con la firma de retorno. |
| `SNOVA0137` | `SNOVA_NOT_CALLABLE` | Intento de invocar un valor no invocable. |
| `SNOVA0138` | `SNOVA_LET_TYPE_MISMATCH` | Inicializador incompatible con el tipo declarado. |
| `SNOVA0139` | `SNOVA_BREAK_OUTSIDE_LOOP` | `break` fuera de `while` o `for`. |
| `SNOVA0140` | `SNOVA_CONTINUE_OUTSIDE_LOOP` | `continue` fuera de `while` o `for`. |
| `SNOVA0141` | `SNOVA_UNHANDLED_ERROR` / `SNOVA_ABSTRACT_INSTANTIATION` | `Error` verificado no capturado ni declarado con `throws`, o instanciación de clase `abstract`. |
| `SNOVA0142` | `SNOVA_MISSING_RETURN` | Función con retorno distinto de `unit` puede terminar sin retornar. |
| `SNOVA0143` | `SNOVA_PRIVATE_ACCESS` | Acceso a miembro `private` fuera de su tipo declarante. |
| `SNOVA0144` | `SNOVA_GENERIC_ARITY_MISMATCH` | Cantidad incorrecta de argumentos genéricos. |
| `SNOVA0145` | `SNOVA_NARROWING_CONVERSION` | Conversión de estrechamiento (prohibida incluso con `as`). |
| `SNOVA0146` | `SNOVA_AMBIGUOUS_OVERLOAD` | Múltiples sobrecargas coinciden por igual. |
| `SNOVA0147` | `SNOVA_NO_MATCHING_OVERLOAD` | Ninguna sobrecarga coincide con los argumentos. |
| `SNOVA0149` | `SNOVA_ARRAY_ELEMENT_TYPE_MISMATCH` | Elemento de literal de array incompatible con el tipo inferido. |
| `SNOVA0150` | `SNOVA_FOR_BINDING_TYPE_MISMATCH` / `SNOVA_PKG_PATH_MISMATCH` | Anotación explícita en `for` incompatible con la fuente, o discrepancia de ruta de paquete. |
| `SNOVA0151` | `SNOVA_STRUCT_BRACE_INIT` | Struct inicializada con paréntesis en lugar de llaves (`Point{...}`). |
| `SNOVA0200`–`0204` | `SNOVA_OPTIONAL_*` / `SNOVA_NESTED_OPTIONAL` | Uso indebido de opcionales (`?.`, `??`, fallback incompatible, `T??`). |
| `SNOVA0205` | `SNOVA_NON_EXHAUSTIVE_MATCH` | `match` no exhaustivo. |
| `SNOVA0210`–`0211` | `SNOVA_ANY_*` | `any` en API pública de biblioteca o inferido implícitamente. |
| `SNOVA0215`–`0216` | `SNOVA_INFINITE_LOOP` / `SNOVA_EMPTY_LOOP` | Diagnósticos de higiene de bucles. |
| `SNOVA0220` | `SNOVA_PROHIBITED_NATIVE` | Declaración `@Native` fuera de las fronteras permitidas. |

### Ownership y Borrow Checker (`0240`–`0251`, `src/sema/borrow.h`)

| Código | Constante | Significado |
| --- | --- | --- |
| `SNOVA0240` | `SNOVA_USE_AFTER_MOVE` | Lectura, mutación o nuevo move tras transferir la propiedad. |
| `SNOVA0241` | `SNOVA_USE_AFTER_DROP` | Referencia que sobrevive al bloque o enlace dueño. |
| `SNOVA0242` | `SNOVA_EXCLUSIVE_BORROW` | Conflicto de préstamo exclusivo. |
| `SNOVA0243` | `SNOVA_MUT_WHILE_SHARED` | Mutación mientras existe un préstamo compartido activo. |
| `SNOVA0244` | `SNOVA_SEND_WHILE_BORROWED` | Envío/compartición entre tareas de un valor prestado o mutable. |
| `SNOVA0245` | `SNOVA_NULL_DEREF` | Desreferencia de `&T?` conocidamente nulo. |
| `SNOVA0246` | `SNOVA_INDEX_OOB` | Índice de array estáticamente fuera de rango. |
| `SNOVA0247` | `SNOVA_DEFER_UNSOUND` | Préstamo inseguro capturado por `defer`. |
| `SNOVA0248` | `SNOVA_BORROW_LIMIT` | Tope de rastreo (`SN_BORROW_MAX = 96`) superado. |
| `SNOVA0249` / `0250` | `SNOVA_BORROW_BRANCH` / `SNOVA_BORROW_LOOP` | Estado de borrow inseguro en rama o bucle. |
| `SNOVA0251` | `SNOVA_PARTIAL_MOVE` | Move parcial ilegal de un elemento de array o campo de agregado. |

### Runtime, Lowering y Targets (`0300`–`0499`)

| Código | Significado |
| --- | --- |
| `SNOVA0304` | Error de runtime (p. ej., índice de array fuera de rango). No capturable; ejecuta unwind en `snl run` y sale con estado `1`. |
| `SNOVA0305` | Error de `defer` en runtime ("defer call must name a function", p. ej., llamada de método). |
| Salida `70` | Límite de 64 MiB del heap de respaldo del intérprete superado. |
| `SNOVA0400` | `SNOVA_EMIT_UNSUPPORTED`: sentencia/construcción sin lowering a `SnBC` (p. ej., `try`/`catch`/`finally`, `throw`). |
| `SNOVA0401` | `SNOVA_CAPABILITY_UNSUPPORTED`: capacidad no soportada en el target/backend. |
| `SNOVA0402` | `SNOVA_CAPABILITY_PENDING`: capacidad pendiente de calificación ejecutable del target. |
| `SNOVA0403` | `SNOVA_TARGET_INVALID`: target triple no reconocido en `--target`. |

## Puertas de Verificación y Calidad

Definidas directamente en el `Makefile` de `snovac`:

```sh
make -j2 test          # Alias de `make unit`: fixtures de CLI, battery.sh y 10 binarios de pruebas unitarias en C
make conformance       # Aceptación léxica y sintática en el corpus (con conformance.allow)
make fuzz-snbc-smoke   # 10.001 casos deterministas del cargador SnBC bajo ASan + UBSan
python3 scripts/bench_compile.py tests/run-pass/hello.snl --runs 10
```

- `tests/battery.allow` registra la lista ejecutable exacta de brechas semánticas conocidas (21 entradas en línea base: 8 fixtures positivos y 13 negativos). Tanto regresiones nuevas como excepciones obsoletas hacen fallar el gate.
- `tests/conformance.allow` registra 3 excepciones de parser (`SNOVA0148` para literales de función pasados sin invocación inmediata a `spawn`, `scope` y `Parallel`).
