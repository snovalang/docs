---
title: Coming Soon & Technical Roadmap
description: Transparent, source-grounded specification of every unimplemented or in-progress feature across the memory-safety contract (P1-P11), type system, backends, standard library, and tooling.
page_id: coming-soon
section_label: Toolchain & Roadmap
permalink: /en/coming-soon/
---

Every item on this page is derived directly from `docs/spec/memory-safety.md`, `docs/plans/memory-safety-execution.md`, `docs/plans/memory-safety-progress.md`, `docs/language-status.md`, `src/sema/check.h`, `builtin/readme.md`, and `snova-lsp/README.md`. Syntax marked **`[PROPOSED — Pn]`** is contractually specified for stage `Pn` and is **not yet accepted** by the active `src/` parser or runtime.

## 1. Memory-Safety & Systems Roadmap (Stages P1–P11)

| Stage | Status | Scope & Key Deliverables |
| --- | --- | --- |
| **P0** | {% include status-badge.html status="implemented" label="Complete" %} | Source-grounded audit of active `src/` compiler, backends, and gaps. |
| **P1** | {% include status-badge.html status="in_progress" %} | Normative contract (`docs/spec/memory-safety.md`), shared safety pipeline across all routes, `SnTargetDescriptor`, and `SNOVA0401`–`0403` capability checks implemented locally; Darwin/AArch64 qualified. Open gates: Linux x86-64 CI run, Windows x86-64 executable gate, and CODEOWNER (`@yurimoinhos`) sign-off. |
| **P2** | {% include status-badge.html status="coming_soon" %} | Explicit CFG and `Place` IR (`src/ir/`): function/block IDs, typed locals, `Place = local + field/index/deref`, explicit short-circuiting, cleanup edges for `finally`/`defer`, structural IR verifier, removing the `SN_BORROW_MAX = 96` limit. |
| **P3** | {% include status-badge.html status="coming_soon" %} | Monotone worklist dataflow over CFG: maybe-uninitialized & maybe-moved facts, backward use liveness, forward loan validity, explicit `&mut T` / `&mut expr`, field-disjoint borrows (`s.a` vs `s.b`), interprocedural call summaries, escape rejection without silent heap promotion, and bounds-proof invalidation across mutation/shrink. |
| **P4** | {% include status-badge.html status="coming_soon" %} | Deterministic RAII & drop elaboration: reverse declaration-order destruction, LIFO `defer` across all exit edges, move-only `Unique<T>` with allocator/layout identity (`Unique.tryNew`), optional pinning, and state-transition `close()`. |
| **P5** | {% include status-badge.html status="coming_soon" %} | Preserved `unsafe` effect system (`unsafe func`, `unsafe method`, `unsafe { ... }`), distinct raw pointers `*const T` and `*mut T`, provenance/generation tracking in checked builds, checked byte/element pointer arithmetic (`offset`, `distanceTo`), forbidding one-past dereference and cross-allocation subtraction. |
| **P6** | {% include status-badge.html status="coming_soon" %} | Split control-block shared/weak ownership: transferable atomic `Shared<T>` / `Weak<T>` (`Send` when `T: Send + Sync`) and non-atomic single-thread `LocalShared<T>` / `LocalWeak<T>` (non-`Send`). Ratified v1 policy: strong reference cycles are memory-safe and may leak; `Weak<T>` breaks cycles deterministically. |
| **P7** | {% include status-badge.html status="coming_soon" %} | Target-derived struct/enum layout (`sizeof`, `alignof`, `offsetof`, padding, tags) and stable C FFI ABI (`ByteView.fromForeignChecked`, preventing language exceptions from unwinding through foreign C frames). |
| **P8** | {% include status-badge.html status="coming_soon" %} | Owned hosted virtual memory mappings: safe `MappedRegion.anonymous` (strictly separating `READ`/`WRITE`/`EXEC`, never safe `WRITE + EXEC`), unsafe `MappedRegion.mapFile` (external truncation contract), and borrowed `ByteView`/`ByteSpan` preventing `close`/`remap` while live. |
| **P9** | {% include status-badge.html status="blocked" %} | Device MMIO capabilities (`DeviceRegion`, `unsafe` volatile register reads/writes distinct from atomics). Blocked pending concrete board/OS hardware provider selection. |
| **P10** | {% include status-badge.html status="coming_soon" %} | Shared multi-backend conformance corpus, typed stack/control-flow SnBC verifier, sustained parser/checker/bytecode fuzzing, ASan/UBSan/TSan, and fault injection. |
| **P11** | {% include status-badge.html status="coming_soon" %} | Per-module mutation testing gates (Mull) with measured kill-rate floors for CFG/loans, pointer arithmetic, SnBC loader, bounds, control blocks, and mappings. |

### Preview of Ratified P1 Contract Syntax (`[PROPOSED — P5/P8/P9]`)

Not yet accepted by the active parser; shown directly from `docs/spec/memory-safety.md`:

```snova
// [PROPOSED — P5] Separating caller obligations (`unsafe func`) from body permission (`unsafe { ... }`)
func readChecked(x: &int): int {
    let p: *const int = x as *const int
    unsafe {
        return *p
    }
}

// [PROPOSED — P8] Safe anonymous virtual memory mapping with lifetime-bound views
func mapAndRead(): int {
    var region = MappedRegion.anonymous(4096, MapAccess.READ_WRITE).unwrap()
    if true {
        let view = region.view()
        let _ = view.get(0)
    }
    region.close() // rejected at compile time if `view` is still live
    return 0
}
```

## 2. Parser, Type System & Language Semantics {% include status-badge.html status="coming_soon" %}

Documented directly in `docs/language-status.md` and `src/sema/check.h`:

- **Function literals in concurrency calls (`SNOVA0148`)**: Accepting non-immediately-invoked function literals passed to `spawn`, `scope`, and `Parallel` (removes the 3 entries in `tests/conformance.allow`).
- **Complete generics**: Checking generic parameter bounds, substituting concrete type parameters at call sites (so methods on `Container<int>` return `int` instead of `T`), and inferring generic arguments from usage.
- **Bidirectional expected-type inference**: Propagating expected types into unannotated lambdas, `if`/`match` expressions used as values, struct literals, and match pattern payloads.
- **Tuples**: Adding tuple types to `SnTypeTag` with construction and compatibility checking.
- **`Iterable` protocol**: Generalizing `for` loops beyond integer ranges, arrays, and `Channel<T>`.
- **Common array element type inference**: Computing a common assignable supertype instead of anchoring on the first literal item (`SNOVA0149`).
- **Finalized `?` operator**: Formalizing error-propagation semantics beyond the current provisional `Option`/`Result` unwrapping.
- **Static interpolation checking**: Exposing `${expr}` sub-expressions to the AST and semantic checker instead of re-parsing at runtime.
- **Hashing protocol**: Enabling hash-based `Map` and `Set` implementations (currently linear equality lookup).

## 3. Backend & Native Execution Parity {% include status-badge.html status="coming_soon" %}

- **Exception & cleanup lowering in SnBC / Native**: Lowering `try`, `catch`, `finally`, and `throw` (closing `SNOVA0400`) and ensuring runtime errors run registered `defer` calls in `run-snbc` and `snl build` just as `snl run` does.
- **Removing SnBC `defer` arity cap**: Lifting the current 8-argument limit in `OP_DEFER` validation.
- **Native host calls**: Exposing TCP/UDP sockets, monotonic clock, and OS mutex host calls inside generated native executables (`snl build`) so `Net`, `HttpServer`, `Time`, `Mutex<T>`, and `Channel<T>` reach parity with `snl run`.
- **Target qualification**: Promoting `x86_64-unknown-linux-gnu` and `x86_64-pc-windows-gnu` from `PENDING_VALIDATION` to `QUALIFIED` via executable CI gates.

## 4. Concurrency, HTTP & Streaming I/O {% include status-badge.html status="coming_soon" %}

- **True concurrent async scheduling**: Scheduling `Async.spawn`, `Async.scope`, and `TaskScope.spawn` concurrently instead of executing inline in the interpreter, and modeling `Task<T>` / awaitability strictly in the checker.
- **Blocking `Channel<T>` & `select`**: Adding blocking send/receive, `select`, and scheduler integration, plus cross-thread blocking/atomic `Semaphore` and `WaitGroup`.
- **HTTP/1.1 production features**: TLS, chunked transfer encoding, persistent keep-alive connections, binary request/response bodies, and concurrent request scheduling in `HttpServer`.
- **Incremental byte I/O**: Adding streaming byte I/O to `FileInputStream`/`FileOutputStream` beyond the current whole-file text buffering.

## 5. Tooling & Self-Hosting {% include status-badge.html status="coming_soon" %}

- **Full `snova-lsp` migration to Snovalang (`SL-2`)**: Moving the remaining C stdio server and `snovac` analysis bridge into `Snova.Lsp` (`.snl`).
- **Reproducible self-hosted bootstrap**: Full reproducible rebuild and diverse double-compilation verification for `bootstrap/src/compiler.snl`.
- **Editor gallery listings**: Acceptance into the official Zed Extensions gallery alongside automated Visual Studio Marketplace, Open VSX, and JetBrains Marketplace publishing.
