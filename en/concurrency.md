---
title: Concurrency & Pulsar
description: Structured asynchronous functions (async/await), Pulsar actor/streaming concurrency, Channel<T>, synchronization primitives, and Context.
page_id: concurrency
section_label: Language Reference
permalink: /en/concurrency/
---

Snovalang exposes two distinct concurrency mechanisms at the language level—**`async`/`await`** and **Pulsar**—plus source-level concurrency primitives in `builtin.concurrent.*` and `builtin.context.*`.

## `async` and `await`

### Language Rules (`src/parse/parse_decl.c`, `src/sema/check.h`)

- `async` modifies `func` or `method`: `async func fetch(): int { ... }`.
- `await` is legal **only** inside an `async` function or method (`SNOVA0013` otherwise).
- A routine **cannot** be both `async` and `pulsar` (`SNOVA0125`).

```snova
package demo.async_example

async func four(): int {
    return 4
}

async func main(): int {
    return await four()
}
```

### Current Runtime Boundary

- **Type checking**: `await` unwraps a type literally named `Task<T>` to `T`, and passes other operand types through unchanged (`src/sema/check.h`).
- **Execution**: `src/eval/async.c` (`SnAsyncLoop`, `sn_async_spawn`, `sn_async_spawn_owned`, `sn_async_loop_run`) is compiled and linked into `snl` and `libsnovart.a`, while the active tree-walking interpreter currently executes `Async.spawn`, `Async.scope`, and `TaskScope.spawn` **inline** and `Async.sleep` blocks the current execution. True concurrent task scheduling for `Async`/`TaskScope` is listed under [Coming Soon]({{ '/en/coming-soon/' | relative_url }}).

## Pulsar Concurrency

Pulsar is Snovalang's actor and streaming concurrency model (`src/sema/check.h`, `src/sema/borrow_task.c`, `src/eval/pulsar.h`, `src/native/native_backend.c`).

### Syntax and Static Rules

1. **Declaration**: Prefix a function or method with `pulsar`:
   ```snova
   pulsar func worker(): unit {
       Console.printline("running")
   }
   ```
2. **Allowed return types (`SNOVA0122`)**: A `pulsar` routine must return `unit`, `Channel<T>`, or `Select<T>`. Streaming signatures may use the `~>` arrow: `(T) ~> Channel<R>`.
3. **Launch-only invocation (`SNOVA0124`)**: A `pulsar` function **cannot** be called directly; it must be launched with a `pulsar` statement:
   ```snova
   func main(): int {
       pulsar worker()
       return 0
   }
   ```
   A block launch form `pulsar { ... }` is also parsed (`SN_STMT_PULSAR`).
4. **Capture safety (`src/sema/borrow_task.c`)**:
   - Capturing a mutable binding across a Pulsar boundary is rejected (`SNOVA0125`).
   - Capturing a non-`Send` value across a Pulsar boundary is rejected (`SNOVA0126`).
5. **Receive-bind syntax**: `x <~ ch`, `ok, val <~ ch.tryReceive()`, and `for v <~ ch { ... }` are parsed into `SN_STMT_VAR` / `SN_STMT_FOR`.

### Runtime Implementation

- **Host C pool (`src/eval/pulsar.h` / `pulsar.c`)**: Platform thread pool (`sn_pulsar_pool_create`, `sn_pulsar_pool_submit`, `sn_pulsar_pool_submit_owned`, `sn_pulsar_pool_wait`, `sn_pulsar_pool_destroy`) with a **1,024-item** queue limit and exactly-once cleanup for owned task contexts. Linked into `snl` and `libsnovart.a`.
- **Native runner (`src/native/native_backend.c`)**: Generated native executables emit their own Pulsar worker queue (`OP_SPAWN`) and propagate worker failures to the process exit status after joining workers.

## Channels (`builtin.concurrent.channels.queues`)

`Channel<T>` is a bounded, host-mutex-protected FIFO queue exposing explicit non-blocking status enums:

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

Key operations on `Channel<T>`:

- `Channel<T>.new(capacity: int): Channel<T>` — negative capacity throws `IllegalArgumentException`; capacity `0` cannot accept values through `trySend`.
- `trySend(value: T): ChannelSendStatus` — atomic non-blocking send.
- `tryReceive(): ChannelReceiveStatus<T>` — atomic non-blocking receive; drains buffered items after close before reporting `Closed`.
- `capacity()`, `length()`, `isEmpty()`, `isClosed()`, `close()`, `dispose()` — call `dispose()` once closed, drained, and no longer referenced to release the underlying host mutex.

<div class="callout callout-warn">
  <span class="callout-title">Channel &amp; Native Backend Boundary</span>
  Blocking send/receive, <code>select</code>, and scheduler integration are not yet implemented. Because <code>Channel&lt;T&gt;</code> uses host OS mutexes (<code>NativeMutex</code>), it currently executes in the interpreter (<code>snl run</code>); generated native executables do not yet expose OS mutex host calls.
</div>

## Synchronization, Tasks & Scoped Context

| Type | Package | Current Behavior |
| --- | --- | --- |
| `Task<T>` | `builtin.concurrent.async.tasks` | Stores typed success, failure, or cancellation outcomes with mapping, chaining, and separate failure/cancellation recovery. |
| `CancellationToken` | `builtin.concurrent.async.tasks` | Shared class value; cancellation is visible to all holders of the same token. |
| `Mutex<T>` | `builtin.concurrent.synchronization.primitives` | Backed by host OS mutexes (`sn_runtime_mutex_*`) in the interpreter; call `close()` after the final unlock. |
| `Semaphore`, `WaitGroup` | `builtin.concurrent.synchronization.primitives` | Enforce counter invariants as single-threaded coordination values; do not block or synchronize across OS threads yet. |
| `Context` | `builtin.context.scoped.values` | Supports parent cancellation, inherited deadlines (checked on `isDone()`/`err()`), scalar getters/setters, and `withTypedValue<T>` / `valueAs<T>(key, typeWitness)` with child shadowing. |
