---
title: Memory, Ownership & Errors
description: Active borrow checker rules, arena/region runtime behavior, defer semantics, checked Error vs unchecked Exception handling, and backend parity.
page_id: memory-and-errors
section_label: Language Reference
permalink: /en/memory-and-errors/
---

Snovalang has **no garbage collector**. Memory safety is split clearly between **what the active `src/` compiler enforces today (`[CURRENT]`)** and **the staged memory-safety contract (`P1`–`P11`)** documented in [Coming Soon]({{ '/en/coming-soon/' | relative_url }}).

## Active Ownership & Borrow Checking (`src/sema/borrow*.c`)

The borrow pass (`sn_borrow_func`) runs from the checker across every compiler entry route (`check`, `run`, `emit-snbc`, `build`, `build --project --runtime`).

### Enforced Rules (`[CURRENT]`)

| Rule | Diagnostic | Behavior |
| --- | --- | --- |
| Move of non-copyable value | `SNOVA0240` | Using a moved array, struct, or class binding is rejected. Reassigning a mutable `var` reinitializes it; compound assignment requires a live value. |
| Reference outliving owner | `SNOVA0241` | Assigning `&local` into an outer `&T?` that outlives `local`'s block is rejected. |
| Exclusive borrow conflict | `SNOVA0242` | Conflicting exclusive borrow while another borrow is live. |
| Mutation while shared | `SNOVA0243` | Mutating a variable while a shared `&x` borrow is live is rejected. |
| Cross-task mutable/borrowed send | `SNOVA0244` | Sending or sharing a borrowed/mutable value across async/task boundaries. |
| Null dereference | `SNOVA0245` | Dereferencing a known-null `&T?`. |
| Static array bounds | `SNOVA0246` | Known out-of-bounds index access. Runtime accesses also check against current length (for example after `pop()` or `clear()`). |
| Unsound `defer` borrow | `SNOVA0247` | Invalid borrow captured by `defer`. |
| Checker capacity limit | `SNOVA0248` | Active tracker is bounded at `SN_BORROW_MAX = 96` entries; overflow is rejected explicitly rather than silently skipped. |
| Branch / loop borrow conflict | `SNOVA0249` / `SNOVA0250` | Conservative branch merge and single-pass loop checks. |
| Partial move | `SNOVA0251` | Moving an element or field out of an aggregate. |

Example rejected with `SNOVA0243` (mutation while borrowed):

```snova
func main(): int {
    var x = 1
    let r = &x
    x = 2       // error[SNOVA0243]: cannot mutate `x` while borrowed
    return *r
}
```

### Known Limits of the Active Checker

- There is **no** `&mut T` syntax or distinct raw pointer type (`*const T` / `*mut T`) in the active parser yet.
- Branch/loop analysis snapshots state rather than running a full CFG worklist; exact exception edges, multiple loop backedges, field-disjoint borrows, and general lifetime proofs are scheduled for **P2–P3**.
- The active compiler does **not** yet provide automatic destructors or general proof of leak freedom.

## Active Runtime Memory Management (`src/eval/rt_mem.c`)

- **`SnArena`**: Compiler compilation units (tokens, AST, interned strings, types) allocate in aligned arena blocks released as a group. Set `SNOVA_MEMORY_STATS=1` to inspect arena usage, reservation, and slack.
- **Evaluator regions**: `snl run` allocates per-call, per-block, per-loop, and per-match-arm private regions. Non-escaping regions are released at scope exit. Returns and stores into outer environments traverse reachable arrays, objects, variants, references, and closures to retain owning regions (escape retention, not tracing GC).
- **Fallback heap cap**: The evaluator enforces a **64 MiB** fallback heap limit per execution and terminates with exit code **`70`** if exceeded.
- **Arrays & strings**: Evaluator arrays use a stable header with geometric buffer growth registered to the owning region; `pop()` and `clear()` release removed slots.

## `defer` Semantics (`[CURRENT]`)

<div class="callout callout-warn">
  <span class="callout-title"><code>defer</code> is NOT automatic RAII</span>
  <code>defer</code> is an explicit, statement-level call scheduler. The compiler does not insert destructors or <code>drop</code> calls for owned values, and user types have no destructor hook yet (automatic disposal via <code>Unique&lt;T&gt;</code> is proposed in P4).
</div>

Verified behavior in `snl run` (`src/eval/rt_defer.c`):

1. **Operand**: Must be a direct call to a named top-level function (`defer cleanup(a, b)`). Method calls like `defer obj.close()` fail at runtime with `SNOVA0305`.
2. **Function-frame scoped**: A `defer` inside an `if` block or loop registers on the enclosing **function's** frame and runs when that function exits—not at block exit. Executing `defer` three times in a loop schedules three calls.
3. **Registration-time argument evaluation**: `var n = 1; defer show(n); n = 2` calls `show(1)`. Non-copyable values passed by value are moved into the deferred call (`SNOVA0240` on later use).
4. **LIFO before frame release**: Registered calls run newest-first before `sn_rt_frame_pop` releases frame memory. Return values are fixed before defers execute.
5. **All exit edges & non-suppression**: Runs on normal exit, `return`, uncaught `throw`, and runtime errors (such as out-of-bounds indexing `SNOVA0304`). A failing defer does **not** suppress older defers.
6. **Exit-reason priority**:
   - Original `throw` wins over exceptions thrown by deferred calls.
   - If leaving normally / by `return`, a deferred exception replaces the exit; when multiple defers throw, the last to run (oldest registration) wins.
   - A runtime error is sticky and cannot be turned into a catchable exception.

```snova
import builtin.io.console.output

func say(s: string): int {
    Console.printline(s)
    return 0
}

func main(): int {
    defer say("second")
    defer say("first")
    return 0
}
// Output:
// first
// second
```

## Error Handling: `Error`, `Exception`, and `try`/`catch`/`finally`

Snovalang separates **checked errors** from **unchecked runtime exceptions** (`builtin/errors/hierarchy/types/Errors.snl`):

- **`Error`** (checked): Subclasses include `ParseError`, `MathError`, `IoError`, `ValidationError`, `TimeoutError`, `CancelledError`. Functions calling a routine with `throws ErrorType`, throwing an `Error` directly, or calling `Result<T, E>.unwrap()` where `E` extends `Error` must either catch it or declare `throws ErrorType` (`SNOVA0141`).
- **`Exception`** (unchecked): Separate root class (`RuntimeException`, `IllegalArgumentException`, `IllegalStateException`, `IndexOutOfBoundsException`, `ArithmeticException`, `MissingValueException`, `CancellationException`, `IoException`, `NullPointerException`, `WrappedException`). Catching `Exception` never satisfies a checked `Error` obligation.

### `try` / `catch` / `finally` Semantics (`snl run`)

```snova
try {
    fail()
} catch (n: int) {
    Console.printline("int")
} catch (msg: string) {
    Console.printline(msg)
} finally {
    Console.printline("cleanup")
}
```

- `catch` clauses are matched in source order by runtime type (untyped `catch` matches any thrown value).
- `finally` runs on normal exit, `return`, caught `throw`, uncaught/rethrown `throw`, and runtime errors.
- If `finally` completes normally, the pending `return`, `throw`, or runtime error is preserved unchanged.
- `return` or `throw` inside `finally` overrides a pending `return` or `throw`, but **cannot** suppress a pending runtime error (process still exits with status `1`).
- Runtime errors (`SNOVA0304`, etc.) are **not** catchable by `try`/`catch`.

## Measured Backend Parity

| Feature | `snl run` (Interpreter) | `emit-snbc` + `run-snbc` | `snl build` (Native) |
| --- | --- | --- | --- |
| `defer` on normal exit / `return` | Pass | Parity | Parity |
| `defer` argument count | Unbounded | Max 8 args (`OP_DEFER`) | Max 8 args |
| `defer` + `throw` | Pass | Rejected (`SNOVA0400`) | Rejected (`SNOVA0400`) |
| `defer` + runtime error | All defers run, exit 1 | **Diverges**: immediate abort, defers skipped | **Diverges** same as SnBC |
| `try` / `catch` / `finally` | Pass | Rejected (`SNOVA0400`) | Rejected (`SNOVA0400`) |
| Static ownership checks (`SNOVA0240`–`0251`) | Enforced | Enforced (shared checker) | Enforced (no binary written) |
