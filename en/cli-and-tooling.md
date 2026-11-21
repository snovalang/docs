---
title: CLI, LSP & Editor Extensions
description: Complete snl CLI reference, mod.sns package manager, environment variables, snova-lsp (LSP 3.17), and official VS Code, JetBrains, and Zed extensions.
page_id: cli-and-tooling
section_label: Toolchain & Roadmap
permalink: /en/cli-and-tooling/
---

## `snl` Command-Line Reference

Verified directly from `src/driver/main.c` and `src/driver/driver_utils_part1.inc`.

### Informational Commands

| Command | Description |
| --- | --- |
| `snl --version` (`-V`) | Print compiler version (`SNOVAC_VERSION`, git tag or `dev`). |
| `snl --help` (`-h`) | Print CLI usage summary. |
| `snl --target-info` | Print detected target triple, qualification status, pointer width/endianness, calling convention, atomic widths, page/granularity sizes, MMIO status, and active env overrides. |

### Single-File Frontend & Execution

| Command | Description |
| --- | --- |
| `snl --emit=tokens <file>` | Lex source and dump token stream with `line:col` spans. |
| `snl --check-lex <file>` | Lex only; exit non-zero on lexer diagnostics. |
| `snl --emit=ast <file>` | Parse source and dump formatted AST. |
| `snl --check-parse <file>` | Lex and parse; report syntax diagnostics. |
| `snl check <file>` | Resolve, type-check, and borrow-check a single `.snl` or `.sns` file. |
| `snl run <file> [-- <args...>]` | Check and execute a single file with the tree-walking interpreter (`sn_eval_run`), forwarding `<args...>` to `Runtime.argument*`. |
| `snl emit-snbc <file.snl> -o <out.snbc>` | Check, lower, and write a canonical little-endian `.snbc` bytecode image plus a deterministic `.snbt` listing (accepts `.snl` programs only). |
| `snl run-snbc <file.snbc>` | Load, structurally validate, compile via native runner, and execute a canonical `.snbc` image. |
| `snl build <file> [-o <out>] [--target=<triple>]` | Check, emit SnBC, and compile a single file to a standalone native binary. |

### Project-Wide Commands

| Command | Description |
| --- | --- |
| `snl --check-parse-project <path>` | Discover and parse all `.snl` and `.sns` files across the project and dependencies. |
| `snl check --project [--no-typecheck] <path>` | Build package graph, link imports, resolve symbols, and type-check bodies (`--no-typecheck` verifies signatures and imports only). |
| `snl run --project <path> [--offline-cache[=<dir>]] [-- <args...>]` | Check and execute a multi-file project. |
| `snl build --project <path> [-o <out>] [--target=<triple>] [--runtime] [--offline-cache[=<dir>]]` | Compile a project into a standalone executable. `--runtime` embeds sources and links `libsnovart.a` (valid only with `--project`). |

### Dependency Management (`get` & `tidy`)

Dependencies are vendored into `.snovalang/deps/` and declared in `mod.sns`:

```sh
# Add or update a direct dependency
snl get https://github.com/supernovalang/snova-http
snl get https://github.com/supernovalang/snova-http --version 1.0.0
snl get github.com/supernovalang/snova-http@1.0.0

# Synchronize all dependencies listed in mod.sns
snl get
snl get --project ./my-project

# Prune unused dependencies and synchronize mod.sns
snl tidy
snl tidy --project ./my-project
```

Key properties of `snl get`:

- **Transitive resolution** with diamond deduplication (shared dependencies cloned once) and cycle detection.
- **Manifest sections (`mod.sns`)**: classifies `direct = [...]`, `indirect = ["from -> to"]`, and local submodule `references = [...]` (missing referenced submodule reports `SNOVA0052`).
- **Safe execution**: uses direct process spawning without shell interpolation; idempotent across repeated invocations.

Example `mod.sns`:

```text
module my_app
snova "1.0.0"
```

## Environment Variables

| Variable | Effect |
| --- | --- |
| `SNOVA_BUILTIN_DIR` | Highest-precedence override for the `builtin/` standard library directory. |
| `SNOVA_STD_DIR` / `SNOVA_STD_PATH` | Explicit standard library source path (fallback after toolchain `builtin/`). |
| `SNOVA_TARGET_OS` | Override target OS (`darwin`, `linux`, `windows`, `freebsd`, etc.). |
| `SNOVA_TARGET_ARCH` | Override target architecture (`arm64`, `aarch64`, `x86_64`, `arm`, etc.). |
| `SNOVA_TARGET` | Override full target triple (e.g., `x86_64-unknown-linux-gnu`). |
| `SNOVA_MEMORY_STATS` | When set to `1`, prints `SnArena` usage, reservation, and slack statistics. |
| `SNOVA_INSTALL_DIR` | Overrides install path in `install.sh` (binary dir) and `install.ps1` (prefix above `bin`). |

## Language Server (`snova-lsp`)

`snova-lsp` implements **Microsoft LSP 3.17** atop the `snovac` compiler pipeline, indexing `.snl` and `.sns` files only (ignoring `.snova`, `.java`, etc.).

### Capabilities

- **Real-time diagnostics** (`textDocument/publishDiagnostics`) with `SNOVA` codes.
- **Hover documentation** (`textDocument/hover`) rendering signatures and parsed `/* -- Doc:{Name} */` blocks.
- **Completion** (`textDocument/completion`): keywords, primitives, prelude types, locals, member access, Pulsar `pulsar func`/`pulsar method` templates, and segment-by-segment import completion (`import builtin.io.` -> `console`, `filesystem`, and public symbols for `import pkg.Symbol`).
- **Project-ranked auto-import & quick fixes**: Completing an unimported symbol or accessing `Type.member` inserts the import in sorted order matching the file's semicolon style, ranked deterministically (own project packages -> packages already imported in the project -> dependencies -> builtins).
- **Navigation & symbols**: Go to definition, references, implementations, hierarchical `documentSymbol` (keeping `selectionRange` inside `range`), signature help, and semantic highlighting (including interpolated string expressions).
- **Ongoing Snovalang migration**: Pure LSP modules (protocol models, JSON writer, Content-Length framing, URI codec, line index, completion ranking, semantic delta encoding, RPC shaping) are migrating into `src/*.snl` under package `Snova.Lsp`; the stdio server and `snovac` bridge currently remain in C (`SL-2`).

Install `snova-lsp` on macOS/Linux:

```sh
curl -fsSL https://raw.githubusercontent.com/snovalang/snova-lsp/master/install.sh | sh
```

## Official Editor Extensions (`editor-extensions`)

| Editor | Install / Requirements | Included Features |
| --- | --- | --- |
| **VS Code** | `curl -fsSL https://raw.githubusercontent.com/snovalang/editor-extensions/master/install-vscode.sh \| sh` (or `install-vscode.ps1` / `snovalang.vsix`) | TextMate grammars (`.snl`, `.sns`, `mod.sns`, `snova.sns`), icons, snippets, bundled `snova-lsp` (Linux ELF, Windows `.exe`, universal Mach-O) + `server/builtin`, auto-install fallback (`snova.lsp.autoInstall`), commands for `snl run`/`check`/`tidy`/`get`. |
| **JetBrains IDEs** (2025.2+) | `curl -fsSL https://raw.githubusercontent.com/snovalang/editor-extensions/master/install-jetbrains.sh \| sh` (or `install-jetbrains.ps1` / `snovalang-jetbrains.zip`) | Supports IntelliJ IDEA, PyCharm, WebStorm, GoLand, CLion, Rider, RustRover, PhpStorm, RubyMine, DataGrip, DataSpell (uses built-in LSP client; open-source IDEA Community/Android Studio excluded). Bundles `snova-lsp` binaries + **Tools \| Snovalang** actions. |
| **Zed** | `curl -fsSL https://raw.githubusercontent.com/snovalang/editor-extensions/master/install-zed.sh \| sh` (or `install-zed.ps1` / `snovalang-zed.tar.gz`) | `wasm32-wasip2` extension component, Tree-sitter grammars/queries, outline, brackets, indents. Resolves a separately installed `snova-lsp` from `PATH`. |
