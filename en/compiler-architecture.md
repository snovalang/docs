---
title: Compiler Implementation (snovac)
description: Deep technical architecture of the active ISO C11 snovac compiler, compilation phases, SnBC bytecode format, native C runner, bootstrap compiler, targets, and host C ABI.
page_id: compiler-architecture
section_label: Compiler & Runtime
permalink: /en/compiler-architecture/
---

**`snovac`** is the official reference compiler for Snovalang, written in pure, zero-dependency **ISO C11** and built with strict compiler warnings (`-std=c11 -O2 -g -pthread -Wall -Wextra -Wpedantic -Wshadow -Wstrict-prototypes -Wmissing-prototypes -Wconversion`).

<div class="callout callout-warn">
  <span class="callout-title">Active Source Tree</span>
  The active compiler compiled by <code>Makefile</code> lives exclusively under <code>src/</code>. Legacy/historical top-level directories (<code>frontend/</code>, <code>semantic/</code>, <code>runtime/</code>, <code>backend/</code>) are <strong>not</strong> part of <code>Makefile</code>'s <code>SRCS</code> build graph.
</div>

## Namespaced Module Map (`src/`)

Every subsystem lives under `src/<namespace>` with dedicated C identifier prefixes:

| Directory | Prefixes | Responsibility |
| --- | --- | --- |
| `src/base/` | `sn_arena_`, `sn_diag_`, `sn_intern_` | Aligned bump arenas (`SnArena`), structured `SNOVA` diagnostic sink (`SnDiagSink`), string interning (`SnInternTable`). |
| `src/lex/` | `sn_lex_`, `sn_tok_` | Lexical scanner, contextual keyword table (`KEYWORDS[]`), numeric/string/char literals, `${...}` interpolation flag. |
| `src/parse/` | `sn_parse_` | Recursive-descent parser with panic-mode recovery returning a partial `SnUnit`, plus pointer/reference parsing (`parse_ptr.c`). |
| `src/ast/` | `sn_list_`, `sn_dump_` | Arena-allocated AST nodes and formatted AST dumper (`--emit=ast`). |
| `src/sema/` | `sn_scope_`, `sn_pkggraph_`, `sn_type_`, `sn_resolve_`, `sn_builtin_`, `sn_check_`, `sn_borrow_` | Package graph & import cycle detection, declaration collection & prelude, hash-consed `SnTypeRep` table, type/effect checking, pointer adjustment, borrow & Pulsar capture analysis. |
| `src/eval/` | `sn_eval_`, `sn_rt_`, `sn_async_`, `sn_pulsar_`, `sn_socket_` | Tree-walking interpreter (`sn_eval_run`), region/frame memory (`rt_mem.c`), references (`rt_ptr.c`), `defer` (`rt_defer.c`), host sockets (`socket_abi.c`), native dispatch, async loop, Pulsar pool, embedder C ABI (`runtime_api.h`). |
| `src/bc/` | `sn_chunk_`, `sn_bcunit_`, `sn_emit_` | `SnBC` bytecode lowering, canonical little-endian binary writer/loader, deterministic `.snbt` listing, structural validator (`snbc_validate.inc`). |
| `src/native/` | `sn_native_`, `sn_target_` | Target descriptor & capability matrix (`target.c`), standalone C runner generator (`native_backend.c`), embedded runtime bundler (`--runtime`), task value scoping (`native_scope.c`). |
| `src/driver/` | `sn_driver_`, `sn_project_`, `sn_cmd_` | `snl` CLI entry point, project/manifest/builtin discovery, commands (`check`, `run`, `build`, `emit-snbc`, `run-snbc`, `get`, `tidy`). |
| `builtin/` | — | Snovalang `.snl` declarations and implementations for the standard builtin library. |

## Compilation Pipeline

As of stage **P1**, every source-executing or code-emitting command (`check`, `run`, `emit-snbc`, `build`, `build --project --runtime`) passes through the shared resolution, type/effect checking, and borrow validation pipeline before lowering or execution:

```text
  .snl / .sns source
         │
         ▼
  [1] src/lex      ──▶ Token stream (--emit=tokens, --check-lex)
         │
         ▼
  [2] src/parse    ──▶ Arena-allocated SnUnit AST (--emit=ast, --check-parse)
         │
         ▼
  [3] src/sema     ──▶ Package graph (sn_pkggraph_*)
                   ──▶ Declaration collection + Prelude (sn_resolve_*)
                   ──▶ Hash-consed types + Type/effect check (sn_check_*)
                   ──▶ Ownership, borrow & Pulsar capture check (sn_borrow_*)
         │
         ├──▶ snl check             (stops after sema)
         │
         ├──▶ snl run               ──▶ [4a] src/eval: Tree-walking interpreter (sn_eval_run)
         │
         ├──▶ snl emit-snbc         ──▶ [4b] src/bc: SnBC canonical .snbc + .snbt listing
         │         │
         │         ▼
         ├──▶ snl run-snbc / build  ──▶ [4c] src/native: Validate SnBC → generate C runner → host CC
         │
         └──▶ snl build --project --runtime
                                    ──▶ [4d] src/native: Embed checked sources + link libsnovart.a
```

## Execution Backends

### 1. Tree-Walking Interpreter (`snl run`)

- Entry point: `sn_eval_run` in `src/eval/eval.c`.
- There is **no** in-process bytecode VM in `src/` (unlike historical sketches, `vm.c` is absent from the active build).
- Fullest feature coverage today: supports `try`/`catch`/`finally`, `throw`, unbounded `defer` arity, runtime-error `defer` unwinding, TCP/UDP sockets, HTTP/1.1 server, monotonic clock, and OS mutexes.
- Uses scope-private memory regions with escape retention and a 64 MiB fallback heap cap (exit code `70`).

### 2. Snovalang Bytecode (`SnBC` — `src/bc/`)

`snl emit-snbc <file.snl> -o <out.snbc>` emits a portable canonical little-endian binary image plus a deterministic `.snbt` text listing (one fact per line, no paths or timestamps).

**Container header & structure (`src/bc/snbc.h`):**

- Magic: `0x43424E53` (`"SNBC"`, 4 bytes)
- Format version: `SNBC_VERSION = 1`
- `main_func_idx`: `uint32_t`
- `SnStringPool`: length-prefixed UTF-8 strings (`uint32_t` counts)
- `SnFunctionChunk[]`: function name, `arity`, `local_count`, `code` bytes, and `lines` table

**Instruction set (`SnOpcode` in `src/bc/snbc.h`):**

| Group | Opcodes |
| --- | --- |
| Constants & stack | `OP_NOP`, `OP_CONST_INT` (`int64_t`), `OP_CONST_DOUBLE` (`double`), `OP_CONST_STRING`, `OP_CONST_BOOL`, `OP_CONST_UNIT`, `OP_CONST_NULL`, `OP_POP`, `OP_DUP` |
| Variables | `OP_GET_LOCAL`, `OP_SET_LOCAL`, `OP_GET_GLOBAL`, `OP_SET_GLOBAL` |
| Arithmetic & bitwise | `OP_ADD`, `OP_SUB`, `OP_MUL`, `OP_DIV`, `OP_MOD`, `OP_NEG`, `OP_NOT`, `OP_BIT_AND`, `OP_BIT_OR`, `OP_BIT_XOR`, `OP_SHL`, `OP_SHR` |
| Comparison | `OP_EQ`, `OP_NE`, `OP_LT`, `OP_LE`, `OP_GT`, `OP_GE` |
| Control flow | `OP_JUMP`, `OP_JUMP_IF_FALSE`, `OP_JUMP_IF_TRUE`, `OP_CALL`, `OP_INVOKE`, `OP_RETURN`, `OP_TRAP`, `OP_HALT` |
| Objects, arrays & enums | `OP_NEW_OBJ`, `OP_GET_FIELD`, `OP_SET_FIELD`, `OP_NEW_ARRAY`, `OP_GET_INDEX`, `OP_SET_INDEX`, `OP_ARRAY_LEN`, `OP_ARRAY_PUSH`, `OP_IS_ARRAY`, `OP_VARIANT`, `OP_IS_VARIANT`, `OP_UNWRAP_VARIANT` |
| Cleanup, concurrency & host | `OP_DEFER` (max 8 args), `OP_SPAWN` (Pulsar launch), `OP_CALL_ASYNC`, `OP_PRINT`, `OP_READ_BYTES`, `OP_WRITE_BYTES`, `OP_RUNTIME_API` |

**Validation (`snbc_validate.inc`)**: `sn_bcunit_load_canonical` builds temporary state and validates instruction boundaries, selected operands, function/string indices, and jump targets before committing. Typed stack dataflow and ownership verification are scheduled for **P10**. Unsupported constructs (such as `try`/`catch`/`finally` and `throw`) are rejected with `SNOVA0400` instead of silently emitting unit values.

### 3. Native Compilation (`snl build` & `snl run-snbc`)

- **Standard native build (`snl build <file.snl> -o <out>`)**: Typechecks, emits `SnBC`, then `sn_native_compile` generates a standalone C runner containing its own value model, bounds/cycle guards, and Pulsar worker queue, and invokes the host C compiler. `snl run-snbc` loads a canonical `.snbc` image and executes it through the same `sn_native_compile` generator.
- **Embedded runtime bundle (`snl build --project <path> --runtime`)**: Embeds checked project sources and links against `libsnovart.a` (all `src/` objects except `main.c`) and compiler headers. `--runtime` requires `--project` (single-file `build --runtime` exits with status `2`).

### 4. Self-Hosting Bootstrap Compiler (`bootstrap/src/`)

`snovac` includes an in-tree Snovalang-written compiler (`bootstrap/src/compiler.snl` assembled from `part_lex.snl`, `part_parse.snl`, `part_parse_decl.snl`, `part_scope_parse.snl`, `part_scope_match.snl`, `part_scope_emit.snl`, `part_emit.snl`, `part_emit_stmt.snl`, `part_emit_expr.snl`, `part_unit.snl` via `join.sh`). It reads `in.snl` with `read_bytes`, lexes, parses, lowers, and writes a canonical `SNBC` version 1 image to `out.snbc` with `write_bytes`.

## Target Descriptors & Qualification (`src/native/target.h`)

`SnTargetDescriptor` captures target-specific pointer width/alignment, endianness, scalar alignments (`i16`/`i32`/`i64`/`f32`/`f64`/`max_align`), calling convention, atomic widths (`8`/`16`/`32`/`64`), minimum page size, allocation granularity, hosted/VM/MMIO flags, and qualification tier.

| Target Triple | Pointer / Endian | Calling Conv | Atomics | Qualification Tier |
| --- | --- | --- | --- | --- |
| `aarch64-apple-darwin` | 64-bit / LE | `aapcs64` | 8/16/32/64 | **QUALIFIED** |
| `x86_64-unknown-linux-gnu` | 64-bit / LE | `sysv-amd64` | 8/16/32/64 | **PENDING_VALIDATION** |
| `x86_64-pc-windows-gnu` | 64-bit / LE | `win64` | 8/16/32/64 | **PENDING_VALIDATION** |
| Other hosted triples (`x86_64-apple-darwin`, `aarch64-unknown-linux-gnu`, `riscv64-*`, `*bsd`, `arm`, `x86`) | Target-defined | Target-defined | Target-defined | **UNQUALIFIED** |
| Bare-metal (`*-none-*`, e.g., `aarch64-none-elf`, `arm-none-eabi`) | Target-defined | Target-defined | Target-defined | **UNQUALIFIED / BLOCKED** |

Capability queries return `SN_CAP_STATUS_IMPLEMENTED`, `SN_CAP_STATUS_PENDING_VALIDATION`, or `SN_CAP_STATUS_UNSUPPORTED`, emitting `SNOVA0401`–`SNOVA0403` before execution when an invalid target or unsupported capability is requested.

## Host Embedder C ABI (`src/eval/runtime_api.h`)

Embedders linking against `libsnovart.a` use `runtime_api.h`. All host-service functions return a platform-independent `SnRuntimeStatus` (`SN_RUNTIME_OK`, `SN_RUNTIME_INVALID_ARGUMENT`, `SN_RUNTIME_NOT_FOUND`, `SN_RUNTIME_PERMISSION_DENIED`, `SN_RUNTIME_IO_ERROR`, `SN_RUNTIME_OUT_OF_MEMORY`, `SN_RUNTIME_END_OF_INPUT`). Buffers returned by file or stdin reads are NUL-terminated and must be freed with `sn_runtime_free()`.

```c
char *text = NULL;
size_t len = 0;
SnRuntimeStatus st = sn_runtime_file_read("config.txt", &text, &len);
if (st == SN_RUNTIME_OK) {
    /* use text */
    sn_runtime_free(text);
}
```
