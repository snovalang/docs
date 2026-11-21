---
title: Builtin Library
description: Package naming convention, discovery precedence, complete catalog of all 18 builtin package areas, and runtime support boundaries across backends.
page_id: builtin-library
section_label: Compiler & Runtime
permalink: /en/builtin-library/
---

All language-level standard declarations and pure-Snovalang implementations live in `builtin/` as `.snl` files. The semantic checker resolves and type-checks these files through the normal package system instead of maintaining a separate hardcoded method catalog.

## Package Naming & Discovery

Packages follow the pattern `builtin.<general>.<abstraction>.<concrete>.<Stem>`, with each file named after its primary type (for example, `builtin/network/http/data/types/Response.snl` declares `package builtin.network.http.data.types`).

### Toolchain Discovery Precedence (`src/driver/project.c`)

1. `SNOVA_BUILTIN_DIR` environment variable (if set and existing directory).
2. Toolchain copy beside the running `snl` executable: `<exe_dir>/../builtin` (covers both `<prefix>/bin/snl` + `<prefix>/builtin` and development `build/snl` + `builtin/`) or `<exe_dir>/builtin`.
3. Development/legacy fallback: `SNOVA_STD_PATH`, `~/.snovalang/std/src`, project `.snovalang/deps/github.com/supernovalang/snova-std/src`, and an upward directory walk (up to 8 levels) from the source root / executable directory.

## Builtin Package Catalog

Verified directly from `builtin/readme.md` and `builtin/`:

| Area | Package(s) | Key Types & Operations |
| --- | --- | --- |
| **Core types** | `builtin.core.types.values` | `Object` (`toString`, identity `equals`, `hashCode`), `Option<T>`, `Result<T, E>`, `PrimitiveExtensions` (methods on strings and scalars). `Option`/`Result` and `Some`/`None`/`Ok`/`Err` are in the implicit prelude. |
| **Collections** | `builtin.collections.collections.types` | `Array<T>` (map, flatten, fold, slice, insert, remove, predicates), `Map<K, V>` and `Set<T>` (equality-based linear lookup, insertion-order preserving, set algebra), `Partial<T>`. |
| **Error hierarchy** | `builtin.errors.hierarchy.types` | Checked `Error` (`ParseError`, `MathError`, `IoError`, `ValidationError`, `TimeoutError`, `CancelledError`) and unchecked `Exception` (`RuntimeException`, `IllegalArgumentException`, `IllegalStateException`, `IndexOutOfBoundsException`, `ArithmeticException`, `MissingValueException`, `CancellationException`, `IoException`, `NullPointerException`, `WrappedException`, `Errors`). |
| **Console & Filesystem** | `builtin.io.console.output`, `builtin.io.filesystem.operations` | `Console` (`print`, `printline`, `println`, `err`, `warn`, `log<T>`, `readLine`), `FileSystem` (text read/write/exists and `try*` `Result` wrappers catching `IoException`). |
| **File Streams** | `builtin.io.filesystem.streams.contracts`, `builtin.io.filesystem.files.streams.types`, `builtin.io.filesystem.streams.extensions` | `InputStream`, `OutputStream`, `FileInputStream`, `FileOutputStream`, `readAll()` extension. Currently text-oriented and whole-file buffered (flush/replace on `close()`). |
| **Process & Runtime** | `builtin.process.arguments.values`, `builtin.process.environment.values`, `builtin.runtime.host.api` | `Runtime` (`readLine`, `fileExists`, `readText`, `writeText`, `environment`, `argumentCount`, `argument`), plus `Args` and `Env` facades. |
| **Text & Math** | `builtin.text.text.values`, `builtin.math.arithmetic.operations` | `Text` utilities; `Math` (checked `int`/`long` arithmetic, multiplication, division, powers, `gcd`, `lcm`, iterative `sqrt`, floating-point range helpers). |
| **String Parsing** | `builtin.text.parsing.results` | `Strings`: radix/overflow-validated integer, bounded-width, floating-point, decimal, and boolean parsers returning `Result` (plus `tryParse*` returning `Option`). |
| **Functional** | `builtin.functional.collections.operations` | `Functional`: eager array mapping, flattening, filtering, folding, traversal, and predicate queries. |
| **Time** | `builtin.time.clock.values` | `Duration`, `Instant`, `Time` (checked `Result`-returning arithmetic plus throwing convenience methods; monotonic clock backed by interpreter). |
| **Networking** | `builtin.network.transport.sockets` | `Net`, `Socket`, `SocketAddress` (host + port), `TcpListener`, `TcpStream`, `TcpStreamExtensions`, `UdpSocket`. Validated ports/handles, `Result`-returning operations, idempotent `close()`, numeric DNS resolution. |
| **HTTP Data** | `builtin.network.http.data.types` | `Method`, `Header`, `Request`, `Response` (validates status/headers, preserves repeated headers, case-insensitive lookup). |
| **HTTP Server** | `builtin.network.http.server` | `HttpRequest`, `HttpResponse`, `HttpRoute`, `HttpWire`, `HttpServer` (`get`, `post`, `route`, `dispatch`, `serveNext`, `serve`, `listen`). |
| **Async & Sync** | `builtin.concurrent.async.tasks`, `builtin.concurrent.synchronization.primitives` | `Task<T>`, `TaskScope`, `Async`, `CancellationToken`, `Mutex<T>`, `Semaphore`, `WaitGroup`. |
| **Channels** | `builtin.concurrent.channels.queues` | `Channel<T>`, `ChannelSendStatus`, `ChannelReceiveStatus<T>`. |
| **Context** | `builtin.context.scoped.values` | `Context` (cancellation, inherited deadlines, typed scalar & `withTypedValue<T>` / `valueAs<T>(key, typeWitness)` values). |
| **Memory Types** | `builtin.memory.addressing.types` | `ByteSpan`, `SignedByteSpan` (zero-copy checked views over shared Snovalang arrays), `Address` (opaque `NativeWord` wrapper; cannot be dereferenced), `NativeWord`. |
| **Utilities** | `builtin.util.general.types` | `Pair`, `Util`. |

## Runtime Support Boundaries (`@Native`)

`@Native` marks a host boundary requiring runtime support. Execution coverage differs between `snl run` (interpreter) and `snl build` (generated native runner):

| Capability | `snl run` (Interpreter) | `snl build` (Native Runner) | Current Limits |
| --- | --- | --- | --- |
| Console I/O (`Console.print*`, `readLine`) | {% include status-badge.html status="implemented" %} | {% include status-badge.html status="implemented" %} | — |
| Text file I/O (`Runtime` / `FileSystem`) | {% include status-badge.html status="implemented" %} | {% include status-badge.html status="implemented" %} | Whole-file text reads/writes; no incremental byte streams yet. |
| Process args & environment (`Runtime` / `Args` / `Env`) | {% include status-badge.html status="implemented" %} | {% include status-badge.html status="implemented" %} | Forwarded via `snl run app.snl -- arg1 arg2`. |
| Pure Snovalang modules (`Option`, `Result`, `Array`, `Map`, `Set`, `Math`, `Strings`, `Text`, `Functional`, `ByteSpan`) | {% include status-badge.html status="implemented" %} | {% include status-badge.html status="partial" %} | `Map`/`Set` use linear equality lookup (no hashing protocol yet). Native subset rejects `try`/`throw`. |
| TCP/UDP sockets & `HttpServer` | {% include status-badge.html status="interpreter_only" %} | {% include status-badge.html status="coming_soon" %} | HTTP/1.1 synchronous, 1 request/TCP connection, `Content-Length` framing, 16 KiB header / 1 MiB text body limits, 400/404/405 responses. No TLS, chunked coding, keep-alive, binary bodies, or concurrent scheduling yet. |
| Monotonic clock (`Time` / `Instant`) | {% include status-badge.html status="interpreter_only" %} | {% include status-badge.html status="coming_soon" %} | Native runner does not expose clock host calls yet. |
| OS `Mutex<T>` & `Channel<T>` | {% include status-badge.html status="interpreter_only" %} | {% include status-badge.html status="coming_soon" %} | Non-blocking `trySend`/`tryReceive` only; native runner does not expose mutex host calls yet. |
| `Async` / `TaskScope` / `Semaphore` / `WaitGroup` | {% include status-badge.html status="partial" %} | {% include status-badge.html status="coming_soon" %} | Inline execution / single-threaded invariant enforcement; concurrent scheduling is Coming Soon. |
