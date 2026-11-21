---
title: Concurrencia y Pulsar
description: Funciones asíncronas (async/await), concurrencia de actores/streaming con Pulsar, Channel<T>, primitivas de sincronización y Context.
page_id: concurrency
section_label: Referencia del Lenguaje
permalink: /es/concurrency/
---

Snovalang ofrece dos mecanismos de concurrencia a nivel de lenguaje —**`async`/`await`** y **Pulsar**— junto con primitivas en código fuente en `builtin.concurrent.*` y `builtin.context.*`.

## `async` y `await`

### Reglas del Lenguaje (`src/parse/parse_decl.c`, `src/sema/check.h`)

- `async` modifica `func` o `method`: `async func obtener(): int { ... }`.
- `await` solo es válido dentro de `async func` o `async method` (de lo contrario emite `SNOVA0013`).
- Una rutina **no** puede ser `async` y `pulsar` a la vez (`SNOVA0125`).

```snova
package demo.async_example

async func four(): int {
    return 4
}

async func main(): int {
    return await four()
}
```

### Frontera Actual del Runtime

- **Verificación de tipos**: `await` desenvuelve un tipo literalmente llamado `Task<T>` a `T` y deja intactos otros tipos de operando (`src/sema/check.h`).
- **Ejecución**: `src/eval/async.c` (`SnAsyncLoop`, `sn_async_spawn`, `sn_async_spawn_owned`, `sn_async_loop_run`) está compilado y enlazado en `snl` y `libsnovart.a`, pero el intérprete activo ejecuta actualmente `Async.spawn`, `Async.scope` y `TaskScope.spawn` **en línea** (*inline*), y `Async.sleep` bloquea la ejecución actual. La planificación concurrente real de `Async`/`TaskScope` se detalla en [Coming Soon]({{ '/es/coming-soon/' | relative_url }}).

## Concurrencia Pulsar

Pulsar es el modelo de actores y streaming de Snovalang (`src/sema/check.h`, `src/sema/borrow_task.c`, `src/eval/pulsar.h`, `src/native/native_backend.c`).

### Sintaxis y Reglas Estáticas

1. **Declaración**: Prefija una función o método con `pulsar`:
   ```snova
   pulsar func worker(): unit {
       Console.printline("ejecutando")
   }
   ```
2. **Tipos de retorno permitidos (`SNOVA0122`)**: Una rutina `pulsar` debe devolver `unit`, `Channel<T>` o `Select<T>`. Las firmas de streaming pueden usar `~>`: `(T) ~> Channel<R>`.
3. **Invocación solo mediante lanzamiento (`SNOVA0124`)**: Una función `pulsar` **no** puede llamarse directamente; debe lanzarse con la sentencia `pulsar`:
   ```snova
   func main(): int {
       pulsar worker()
       return 0
   }
   ```
   También se analiza la forma de bloque `pulsar { ... }` (`SN_STMT_PULSAR`).
4. **Seguridad de captura (`src/sema/borrow_task.c`)**:
   - Capturar un enlace mutable a través de una frontera Pulsar produce `SNOVA0125`.
   - Capturar un valor no-`Send` a través de una frontera Pulsar produce `SNOVA0126`.
5. **Sintaxis receive-bind**: `x <~ ch`, `ok, val <~ ch.tryReceive()` y `for v <~ ch { ... }` se analizan en `SN_STMT_VAR` / `SN_STMT_FOR`.

### Implementación en Runtime

- **Pool C del host (`src/eval/pulsar.h` / `pulsar.c`)**: Pool de hilos de plataforma (`sn_pulsar_pool_create`, `sn_pulsar_pool_submit`, `sn_pulsar_pool_submit_owned`, `sn_pulsar_pool_wait`, `sn_pulsar_pool_destroy`) con límite de **1.024 elementos** en cola y limpieza exactamente una vez para contextos propietarios. Enlazado en `snl` y `libsnovart.a`.
- **Runner nativo (`src/native/native_backend.c`)**: Los ejecutables nativos generados emiten su propia cola de workers Pulsar (`OP_SPAWN`) y propagan los fallos de workers al código de salida del proceso tras el *join*.

## Canales (`builtin.concurrent.channels.queues`)

`Channel<T>` es una cola FIFO acotada protegida por mutex del sistema operativo, con enums explícitos para operaciones no bloqueantes:

```snova
enum ChannelSendStatus {
    Sent,
    Full,
    Closed
}

enum ChannelReceiveStatus<T> {
    Value(value: T),
    Empty,
    Closed
}
```

Operaciones principales de `Channel<T>`:

- `Channel<T>.new(capacity: int): Channel<T>` — una capacidad negativa lanza `IllegalArgumentException`; capacidad `0` no acepta valores mediante `trySend`.
- `trySend(value: T): ChannelSendStatus` — envío atómico no bloqueante.
- `tryReceive(): ChannelReceiveStatus<T>` — lectura atómica no bloqueante; drena los elementos en buffer tras el cierre antes de reportar `Closed`.
- `capacity()`, `length()`, `isEmpty()`, `isClosed()`, `close()`, `dispose()` — llama a `dispose()` una vez cerrado y drenado el canal para liberar el mutex del host.

<div class="callout callout-warn">
  <span class="callout-title">Frontera de <code>Channel</code> y Backend Nativo</span>
  El envío/recepción bloqueante, <code>select</code> y la integración con el planificador aún no están implementados. Dado que <code>Channel&lt;T&gt;</code> usa mutex del SO (<code>NativeMutex</code>), actualmente solo funciona en el intérprete (<code>snl run</code>); los ejecutables nativos aún no exponen llamadas de host para mutex.
</div>

## Sincronización, Tareas y `Context`

| Tipo | Paquete | Comportamiento Actual |
| --- | --- | --- |
| `Task<T>` | `builtin.concurrent.async.tasks` | Almacena resultado tipado de éxito, fallo o cancelación, con mapeo, encadenamiento y recuperación separada de fallo y cancelación. |
| `CancellationToken` | `builtin.concurrent.async.tasks` | Valor de clase compartido; la cancelación es visible para todos los poseedores del mismo token. |
| `Mutex<T>` | `builtin.concurrent.synchronization.primitives` | Respaldado por mutex del SO (`sn_runtime_mutex_*`) en el intérprete; llama a `close()` tras el último `unlock`. |
| `Semaphore`, `WaitGroup` | `builtin.concurrent.synchronization.primitives` | Imponen invariantes de contador en un solo hilo; todavía no bloquean ni sincronizan entre hilos del SO. |
| `Context` | `builtin.context.scoped.values` | Soporta cancelación jerárquica, plazos heredados (comprobados en `isDone()`/`err()`), getters/setters escalares y `withTypedValue<T>` / `valueAs<T>(key, typeWitness)` con sombreado en hijos. |
