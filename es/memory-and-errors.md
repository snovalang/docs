---
title: Memoria, Ownership y Errores
description: Reglas activas del borrow checker, gestión de regiones/arenas en runtime, semántica real de defer, Error verificado frente a Exception no verificada y paridad entre backends.
page_id: memory-and-errors
section_label: Referencia del Lenguaje
permalink: /es/memory-and-errors/
---

Snovalang **no tiene recolector de basura**. Esta referencia distingue explícitamente **lo que el compilador activo en `src/` exige hoy (`[CURRENT]`)** del **contrato por etapas de seguridad de memoria (`P1`–`P11`)** detallado en [Coming Soon]({{ '/es/coming-soon/' | relative_url }}).

## Ownership y Borrow Checking Activos (`src/sema/borrow*.c`)

El pase `sn_borrow_func` se ejecuta desde el verificador en todas las rutas de entrada (`check`, `run`, `emit-snbc`, `build`, `build --project --runtime`).

### Reglas Exigidas Hoy (`[CURRENT]`)

| Regla | Diagnóstico | Comportamiento |
| --- | --- | --- |
| Move de valor no copiable | `SNOVA0240` | Usar un array, struct o clase tras un move se rechaza. Reasignar una `var` la reinicializa; la asignación compuesta exige valor vivo. |
| Referencia que sobrevive al dueño | `SNOVA0241` | Asignar `&local` a un `&T?` externo que sobrevive al bloque de `local` se rechaza. |
| Conflicto de préstamo exclusivo | `SNOVA0242` | Préstamo exclusivo en conflicto mientras otro préstamo sigue activo. |
| Mutación bajo préstamo compartido | `SNOVA0243` | Modificar una variable mientras existe un préstamo `&x` vivo se rechaza. |
| Envío entre tareas con préstamo/mutación | `SNOVA0244` | Compartir o enviar valores prestados o mutables entre fronteras de tareas. |
| Desreferencia nula | `SNOVA0245` | Desreferenciar un `&T?` conocidamente nulo. |
| Límites estáticos de array | `SNOVA0246` | Índice conocido fuera de rango. En tiempo de ejecución los accesos también verifican la longitud actual (incluyendo tras `pop()` o `clear()`). |
| Captura insegura por `defer` | `SNOVA0247` | Préstamo inválido capturado por `defer`. |
| Límite de capacidad del checker | `SNOVA0248` | El rastreador activo tiene tope fijo `SN_BORROW_MAX = 96`; al superarse rechaza explícitamente en lugar de omitir comprobaciones. |
| Conflicto en rama / bucle | `SNOVA0249` / `SNOVA0250` | Fusión conservadora de ramas y visita conservadora de bucles. |
| Move parcial | `SNOVA0251` | Mover un elemento o campo fuera de un agregado. |

Ejemplo rechazado con `SNOVA0243`:

```snova
func main(): int {
    var x = 1
    let r = &x
    x = 2       // error[SNOVA0243]: mutación mientras `x` está prestado
    return *r
}
```

### Límites Conocidos del Checker Actual

- Aún **no** existen `&mut T` ni punteros crudos diferenciados (`*const T` / `*mut T`) en el parser activo.
- El análisis actual toma instantáneas por rama y visita los bucles una vez, sin CFG completo; aristas exactas de excepción, múltiples *backedges*, préstamos disjuntos por campo y pruebas generales de tiempo de vida corresponden a **P2–P3**.
- El compilador activo todavía **no** provee destructores automáticos ni prueba general de ausencia de fugas.

## Gestión de Memoria en Runtime (`src/eval/rt_mem.c`)

- **`SnArena`**: Los datos de compilación (tokens, AST, cadenas internadas, tipos) se alojan en bloques alineados liberados en conjunto. Define `SNOVA_MEMORY_STATS=1` para inspeccionar uso, reserva y *slack*.
- **Regiones del intérprete**: `snl run` crea regiones privadas por llamada, bloque, bucle y rama de `match`. Las regiones sin escape se liberan al salir del ámbito. Los retornos y escrituras hacia entornos externos recorren arrays, objetos, variantes, referencias y clausuras alcanzables para retener sus regiones propietarias (análisis de escape, no GC por trazado).
- **Límite de heap de respaldo**: El intérprete impone un tope de **64 MiB** por ejecución y termina con código de salida **`70`** si se supera.
- **Arrays y cadenas**: Los arrays mantienen cabecera estable y buffer de crecimiento geométrico registrado en su región; `pop()` y `clear()` liberan las ranuras eliminadas.

## Semántica Real de `defer` (`[CURRENT]`)

<div class="callout callout-warn">
  <span class="callout-title"><code>defer</code> NO es RAII automático</span>
  <code>defer</code> es un planificador explícito de llamadas a nivel de sentencia. El compilador no inserta destructores ni llamadas <code>drop</code> automáticas, y los tipos de usuario aún no tienen hook destructor (la liberación automática con <code>Unique&lt;T&gt;</code> está propuesta en P4).
</div>

Comportamiento verificado en `snl run` (`src/eval/rt_defer.c`):

1. **Operando**: Debe ser una llamada directa a una función nombrada de nivel superior (`defer limpiar(a, b)`). Las llamadas de método (`defer obj.cerrar()`) fallan en runtime con `SNOVA0305`.
2. **Ámbito de frame de función, no de bloque**: Un `defer` dentro de `if` o bucle se registra en el frame de la **función** contenedora y se ejecuta al salir de ella. Ejecutar `defer` tres veces en un bucle agenda tres llamadas.
3. **Argumentos evaluados al registrar**: `var n = 1; defer show(n); n = 2` invoca `show(1)`. Los valores no copiables pasados por valor se mueven a la llamada diferida (`SNOVA0240` si se usan después).
4. **Orden LIFO antes de liberar el frame**: Se ejecutan del más reciente al más antiguo antes de `sn_rt_frame_pop`. El valor de retorno queda fijado antes de correr los `defer`.
5. **Todas las aristas de salida y no supresión**: Corre en salida normal, `return`, `throw` no capturado y errores de runtime (`SNOVA0304`). Un fallo en un `defer` **no** suprime los anteriores.
6. **Prioridad de motivos de salida**:
   - Un `throw` original prevalece sobre excepciones lanzadas por llamadas `defer`.
   - En salida normal o `return`, una excepción en `defer` reemplaza la salida; si varios `defer` lanzan excepciones, gana el último en correr (registro más antiguo).
   - Un error de runtime es persistente (*sticky*) y no puede convertirse en excepción capturable.

## Manejo de Errores: `Error`, `Exception` y `try`/`catch`/`finally`

La jerarquía en `builtin/errors/hierarchy/types/Errors.snl` separa dos raíces independientes:

- **`Error` (verificado)**: Subclases `ParseError`, `MathError`, `IoError`, `ValidationError`, `TimeoutError`, `CancelledError`. Llamar una rutina con `throws TipoError`, lanzar `Error` directamente o invocar `Result<T, E>.unwrap()` cuando `E` extiende `Error` exige capturarlo o declararlo con `throws` (`SNOVA0141`).
- **`Exception` (no verificada)**: Raíz separada para fallos en tiempo de ejecución (`RuntimeException`, `IllegalArgumentException`, `IllegalStateException`, `IndexOutOfBoundsException`, `ArithmeticException`, `MissingValueException`, `CancellationException`, `IoException`, `NullPointerException`, `WrappedException`). Capturar `Exception` nunca satisface un `Error` verificado.

### Semántica de `try` / `catch` / `finally` (`snl run`)

- Las cláusulas `catch` se evalúan en orden de código según el tipo en runtime (`catch` sin tipo captura cualquier valor lanzado).
- `finally` corre en salida normal, `return`, excepción capturada, excepción propagada/relanzada y error de runtime.
- Si `finally` termina normalmente, el `return`, `throw` o error de runtime pendiente se preserva sin cambios.
- `return` o `throw` dentro de `finally` sobrescribe un `return`/`throw` pendiente, pero **no** anula un error de runtime pendiente (el proceso igualmente sale con estado `1`).
- Los errores de runtime (`SNOVA0304`, etc.) **no** son capturables por `try`/`catch`.

## Paridad Medida Entre Rutas de Ejecución

| Característica | `snl run` (Intérprete) | `emit-snbc` + `run-snbc` | `snl build` (Nativo) |
| --- | --- | --- | --- |
| `defer` en salida normal / `return` | Pasa | Paridad | Paridad |
| Aridad de `defer` | Sin límite | Máx. 8 argumentos (`OP_DEFER`) | Máx. 8 argumentos |
| `defer` + `throw` | Pasa | Rechazado (`SNOVA0400`) | Rechazado (`SNOVA0400`) |
| `defer` + error de runtime | Corren todos los `defer`, estado 1 | **Diverge**: aborta sin ejecutar `defer` | **Diverge** igual |
| `try` / `catch` / `finally` | Pasa | Rechazado (`SNOVA0400`) | Rechazado (`SNOVA0400`) |
| Diagnósticos de ownership (`SNOVA0240`–`0251`) | Activo | Activo (checker compartido) | Activo (sin generar binario) |
