---
title: Overview & Quick Start
description: Direct technical introduction to Snovalang, its ISO C11 reference compiler (snovac), installation, project layout, and current implementation status.
page_id: overview
section_label: Getting Started
permalink: /en/
---

**Snovalang** is a statically typed programming language designed for predictable performance, explicit type conversions, deterministic resource control, and structured concurrency. Its reference compiler, **`snovac`** (invoked via the `snl` CLI), is implemented in pure, zero-dependency **ISO C11** under the **Apache License 2.0**.

## Design Summary

- **Pure ISO C11 compiler (`snovac`)**: Zero external build dependencies; compiles with `clang` or `gcc` and GNU `make`.
- **Strict static typing**: Hash-consed type representation (`SnTypeRep`), distinct integer widths (`int`, `int64`, and `long` are all 64-bit signed and mutually distinct), no implicit conversions, and compile-time rejection of narrowing casts even with `as`.
- **No garbage collector**: Evaluation uses arena-backed call/block regions with escape retention and explicit cleanup via `defer`; a staged memory-safety roadmap (P1–P11) is adding CFG/place ownership, deterministic RAII, `Unique<T>`, `Shared<T>`/`Weak<T>`, and checked `unsafe` raw pointers.
- **Multiple execution routes**: Tree-walking interpreter (`snl run`), canonical little-endian bytecode (`SnBC` via `emit-snbc` / `run-snbc`), standalone native C-runner binaries (`snl build` and `snl build --project --runtime`), and an in-tree self-hosting compiler (`bootstrap/src/compiler.snl`).
- **Source-level builtin library**: Standard types and APIs live as `.snl` files under `builtin/`, resolved and type-checked through the standard package system.

## File Extensions and Project Model

`snl` and `snova-lsp` recognize only two source extensions:

| File / Pattern | Role | Compiled? |
| --- | --- | --- |
| `*.snl` | Snovalang source file; must declare `package <name>`. | Yes |
| `*.sns` | Snovalang script file; `package` declaration is optional (defaults to `main`). | Yes |
| `mod.sns`, `snova.sns` | Project manifest files (also discovered: `snova.mod`, `snova.toml`). | No |
| `*.sno` or other extensions | Rejected before reading the file; skipped during project discovery. | No |

A project root is discovered by walking upward (up to 32 directories) for `mod.sns`, `snova.sns`, `snova.mod`, or `snova.toml`. Source roots are `<manifest_dir>/src` (if present, otherwise `<manifest_dir>`) plus vendored dependencies in `.snovalang/deps/`.

## Installation

### macOS and Linux

Installs `snl` into `$HOME/.snova/bin` (override the binary directory directly via `SNOVA_INSTALL_DIR`):

```sh
curl -fsSL https://raw.githubusercontent.com/snovalang/snovac/master/install.sh | sh
```

Update explicitly:

```sh
curl -fsSL https://raw.githubusercontent.com/snovalang/snovac/master/install.sh | sh -s -- --update
```

### Windows (PowerShell)

Installs `snl.exe` into `%USERPROFILE%\.snova\bin` (override the prefix via `SNOVA_INSTALL_DIR`; the binary is placed in `<prefix>\bin`):

```powershell
irm https://raw.githubusercontent.com/snovalang/snovac/master/install.ps1 | iex
```

Update explicitly:

```powershell
$env:SNOVA_UPDATE = '1'; irm https://raw.githubusercontent.com/snovalang/snovac/master/install.ps1 | iex
```

### Building from Source

Prerequisites: a C11 compiler (`clang` or `gcc`) and GNU `make`.

```sh
git clone https://github.com/snovalang/snovac.git
cd snovac
make
make install
```

`make` produces `build/snl` (copied to `build/snovac`), `build/libsnovart.a`, and `compile_commands.json`. `make install` installs `snl`, `libsnovart.a`, C headers, and the `builtin/` standard library into `~/.snova` (override with `PREFIX=/custom/path`), and updates shell `PATH` entries for `bash`, `zsh`, and `fish` (or PowerShell on Windows).

Verify installation:

```sh
snl --version
snl --target-info
```

## First Program

Create `hello.snl`:

```snova
package demo.hello

import builtin.io.console.output.Console

func main(): int {
    Console.printline("Hello from Snovalang")
    return 0
}
```

Check, run, or compile to a native executable:

```sh
snl check hello.snl
snl run hello.snl
snl build hello.snl -o hello
./hello
```

Forward runtime CLI arguments after `--`:

```sh
snl run app.snl -- one two
```

Inside Snovalang, `one` and `two` are read via `Runtime.argumentCount()` and `Runtime.argument(index)` (or the `Args` facade).

## Current Implementation Matrix

A builtin declaration accepted by `snl check` does not guarantee execution support across every backend. Current status across active `snovac` components:

| Area | Status | Notes |
| --- | --- | --- |
| Lexer, parser, AST, package graph | {% include status-badge.html status="implemented" %} | Contextual keywords; 243/243 lexical and 203/206 syntactic corpus conformance (`tests/conformance.allow` tracks 3 `SNOVA0148` gaps). |
| Type checker & hash-consed types | {% include status-badge.html status="partial" %} | Strict integer/cast/overload checks work; generic bounds/substitution and bidirectional inference are [Coming Soon]({{ '/en/coming-soon/' | relative_url }}). |
| Ownership & borrow checking | {% include status-badge.html status="partial" %} | Local moves, scoped `&T`/`&T?`, exclusivity, and Pulsar capture checks (`SNOVA0240`–`SNOVA0251`, capped at 96 entries); CFG/place IR is P2–P3. |
| `defer` & `try`/`catch`/`finally` | {% include status-badge.html status="interpreter_only" %} | Full unwind in `snl run`; `try`/`throw` rejected with `SNOVA0400` in SnBC/native; runtime errors skip `defer` in SnBC/native. |
| SnBC bytecode & native C runner | {% include status-badge.html status="partial" %} | Canonical little-endian `.snbc` + `.snbt` listing + native `snl build`; subset of interpreter features. |
| Builtin library (sockets, HTTP/1.1, mutex, clock) | {% include status-badge.html status="interpreter_only" %} | Console, text files, args/env work in interpreter & native; TCP/UDP, HTTP/1.1 server, monotonic clock, and OS mutexes are interpreter-only. |
| RAII (`Unique<T>`), `Shared<T>`/`Weak<T>`, raw pointers, C ABI, `MappedRegion`, MMIO | {% include status-badge.html status="coming_soon" %} | Normative contract finalized in P1 (`docs/spec/memory-safety.md`); scheduled across P2–P11. |
| `snova-lsp` & Editor Extensions | {% include status-badge.html status="implemented" %} | LSP 3.17 server with VS Code, JetBrains (2025.2+), and Zed extensions. |
