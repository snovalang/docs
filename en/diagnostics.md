---
title: Diagnostics & Verification
description: Exact SNOVA diagnostic code reference verified directly from snovac headers, plus compiler test, conformance, fuzzing, and benchmark gates.
page_id: diagnostics
section_label: Compiler & Runtime
permalink: /en/diagnostics/
---

`snovac` emits stable, numbered diagnostic codes formatted as `SNOVA0001` through `SNOVA0499`, organized by compiler phase so codes do not shift as passes evolve.

## Diagnostic Code Catalog

### Lexer (`0001`–`0099`, `src/base/diag.h`)

| Code | Constant | Meaning |
| --- | --- | --- |
| `SNOVA0001` | `SNOVA_UNTERMINATED_STRING` | String literal reached EOF without closing `"`. |
| `SNOVA0002` | `SNOVA_UNTERMINATED_CHAR` | Character literal not terminated with `'`. |
| `SNOVA0003` | `SNOVA_UNKNOWN_CHARACTER` | Unrecognized source character. |
| `SNOVA0004` | `SNOVA_INVALID_NUMBER` | Malformed numeric literal. |
| `SNOVA0005` | `SNOVA_INVALID_ESCAPE` | Unknown escape sequence in string or char literal. |
| `SNOVA0006` | `SNOVA_UNTERMINATED_INTERP` | Unclosed `${...}` interpolation inside a string literal. |

### Resolution, Packages & Declaration Shape (`src/sema/package.h`, `resolve.h`, `check.h`, `project.c`)

| Code | Constant | Meaning |
| --- | --- | --- |
| `SNOVA0008` | `SNOVA_UNCLOSED_BRACE` | Unclosed `{` delimiter reached EOF. |
| `SNOVA0011` | `SNOVA_LEGACY_TYPE_SPELLING` | **Warning**: legacy capitalized primitive spelling (e.g., `Int` instead of `int`). |
| `SNOVA0013` | `SNOVA_AWAIT_OUTSIDE_ASYNC` | `await` used outside an `async func` or `async method`. |
| `SNOVA0023` | `SNOVA_UNDECLARED_NAME` | Identifier not found in local, member, package, import, or prelude scopes. |
| `SNOVA0027` | `SNOVA_UNKNOWN_TYPE` | Type name does not exist anywhere in the package graph. |
| `SNOVA0028` | `SNOVA_UNKNOWN_MEMBER` | Referenced member does not exist on target type. |
| `SNOVA0030` | `SNOVA_FUNC_IN_TYPE_BODY` | `func` declared inside a class/struct body (use `method`; `func` is legal inside `extension`). |
| `SNOVA0031` | `SNOVA_METHOD_AT_TOP_LEVEL` | `method` declared at top level (use `func`). |
| `SNOVA0047` | `SNOVA_IMMUTABLE_REASSIGN` | Reassignment to an immutable `let` binding (outside a `constructor`). |
| `SNOVA0050` | `SNOVA_IMPORT_NOT_FOUND` | Imported package was not discovered in the package graph. |
| `SNOVA0051` | `SNOVA_IMPORT_FILE_EXTENSION` | `import` path erroneously specifies a file extension. |
| `SNOVA0052` | *(project.c)* | Referenced submodule directory in `mod.sns` `references = [...]` does not exist. |
| `SNOVA0100` | `SNOVA_UNTYPED_VARIABLE` | Variable or empty array literal lacks a type annotation or inferable context. |
| `SNOVA0108` | `SNOVA_IMPORT_CYCLE` | Circular import cycle across two or more distinct packages. |
| `SNOVA0109` | `SNOVA_MISSING_PACKAGE_DECL` | `.snl` source file is missing a `package` declaration. |
| `SNOVA0120` | `SNOVA_DUPLICATE_DECL` | Duplicate declaration name or identical method signature. |
| `SNOVA0121` | `SNOVA_TYPE_NOT_IMPORTED` | Type exists in the package graph but is not imported by the current file. |

### Pulsar & Type Checker (`0122`–`0220`, `src/sema/check.h`, `borrow.h`)

| Code | Constant | Meaning |
| --- | --- | --- |
| `SNOVA0122` | `SNOVA_PULSAR_INVALID_RETURN` | `pulsar` routine return type is not `unit`, `Channel<T>`, or `Select<T>`. |
| `SNOVA0124` | `SNOVA_PULSAR_DIRECT_CALL` | Direct call to a `pulsar` routine (must be launched via `pulsar`). |
| `SNOVA0125` | `SNOVA_PULSAR_IN_ASYNC` / `SNOVA_PULSAR_MUTABLE_CAPTURE` | Routine declared both `async` and `pulsar`, or mutable binding captured by a Pulsar task. |
| `SNOVA0126` | `SNOVA_PULSAR_NON_SEND_CAPTURE` | Non-`Send` value captured across a Pulsar boundary. |
| `SNOVA0131` | `SNOVA_ARITY_MISMATCH` | Argument count does not match parameter count. |
| `SNOVA0132` | `SNOVA_ARG_TYPE_MISMATCH` | Argument type incompatible with parameter type. |
| `SNOVA0133` | `SNOVA_BINARY_TYPE_MISMATCH` | Incompatible operand types for a binary operator (no implicit promotion). |
| `SNOVA0134` | `SNOVA_UNARY_TYPE_MISMATCH` | Invalid operand type for a unary operator. |
| `SNOVA0135` | `SNOVA_CONDITION_NOT_BOOL` | Condition in `if` or `while` is not `bool`. |
| `SNOVA0136` | `SNOVA_RETURN_TYPE_MISMATCH` | Returned expression does not match function signature. |
| `SNOVA0137` | `SNOVA_NOT_CALLABLE` | Attempted to call a value that is not callable. |
| `SNOVA0138` | `SNOVA_LET_TYPE_MISMATCH` | Initializer does not match declared binding type. |
| `SNOVA0139` | `SNOVA_BREAK_OUTSIDE_LOOP` | `break` used outside `while` or `for`. |
| `SNOVA0140` | `SNOVA_CONTINUE_OUTSIDE_LOOP` | `continue` used outside `while` or `for`. |
| `SNOVA0141` | `SNOVA_UNHANDLED_ERROR` / `SNOVA_ABSTRACT_INSTANTIATION` | Checked `Error` neither caught nor declared with `throws`, or instantiation of an `abstract` class. |
| `SNOVA0142` | `SNOVA_MISSING_RETURN` | Function with non-`unit` return type can exit without returning. |
| `SNOVA0143` | `SNOVA_PRIVATE_ACCESS` | Access to a `private` member from outside its declaring type. |
| `SNOVA0144` | `SNOVA_GENERIC_ARITY_MISMATCH` | Wrong number of generic type arguments. |
| `SNOVA0145` | `SNOVA_NARROWING_CONVERSION` | Narrowing conversion (forbidden even with `as`). |
| `SNOVA0146` | `SNOVA_AMBIGUOUS_OVERLOAD` | Multiple overloaded methods match a call equally. |
| `SNOVA0147` | `SNOVA_NO_MATCHING_OVERLOAD` | No overloaded method matches argument types. |
| `SNOVA0149` | `SNOVA_ARRAY_ELEMENT_TYPE_MISMATCH` | Array literal item incompatible with inferred element type. |
| `SNOVA0150` | `SNOVA_FOR_BINDING_TYPE_MISMATCH` / `SNOVA_PKG_PATH_MISMATCH` | Explicit `for` binding type mismatches source element type, or package path mismatch. |
| `SNOVA0151` | `SNOVA_STRUCT_BRACE_INIT` | Struct constructed with parentheses instead of braces (`Point{...}`). |
| `SNOVA0200`–`0204` | `SNOVA_OPTIONAL_*` / `SNOVA_NESTED_OPTIONAL` | Optional type misuse (`?.`, `??`, fallback mismatch, `T??`). |
| `SNOVA0205` | `SNOVA_NON_EXHAUSTIVE_MATCH` | `match` does not cover all cases. |
| `SNOVA0210`–`0211` | `SNOVA_ANY_*` | `any` used in public library API or implicitly inferred. |
| `SNOVA0215`–`0216` | `SNOVA_INFINITE_LOOP` / `SNOVA_EMPTY_LOOP` | Loop hygiene diagnostics. |
| `SNOVA0220` | `SNOVA_PROHIBITED_NATIVE` | Disallowed `@Native` declaration outside permitted boundaries. |

### Ownership & Borrow Checker (`0240`–`0251`, `src/sema/borrow.h`)

| Code | Constant | Meaning |
| --- | --- | --- |
| `SNOVA0240` | `SNOVA_USE_AFTER_MOVE` | Value read, mutated, or moved after ownership was moved. |
| `SNOVA0241` | `SNOVA_USE_AFTER_DROP` | Reference outlives its owning binding/block. |
| `SNOVA0242` | `SNOVA_EXCLUSIVE_BORROW` | Conflicting exclusive borrow. |
| `SNOVA0243` | `SNOVA_MUT_WHILE_SHARED` | Mutation while a shared borrow is active. |
| `SNOVA0244` | `SNOVA_SEND_WHILE_BORROWED` | Sharing/sending a borrowed or mutable value across tasks. |
| `SNOVA0245` | `SNOVA_NULL_DEREF` | Dereference of a known-null `&T?`. |
| `SNOVA0246` | `SNOVA_INDEX_OOB` | Statically known out-of-bounds array index. |
| `SNOVA0247` | `SNOVA_DEFER_UNSOUND` | Unsound borrow captured by `defer`. |
| `SNOVA0248` | `SNOVA_BORROW_LIMIT` | Active borrow/variable tracking cap (`SN_BORROW_MAX = 96`) exceeded. |
| `SNOVA0249` / `0250` | `SNOVA_BORROW_BRANCH` / `SNOVA_BORROW_LOOP` | Unsound borrow state across branch or loop boundary. |
| `SNOVA0251` | `SNOVA_PARTIAL_MOVE` | Illegal partial move out of an array element or aggregate field. |

### Runtime, Lowering & Targets (`0300`–`0499`)

| Code | Meaning |
| --- | --- |
| `SNOVA0304` | Runtime error (e.g., out-of-bounds array index). Uncatchable; triggers unwind in `snl run` and exits with status `1`. |
| `SNOVA0305` | Runtime `defer` error ("defer call must name a function", e.g., when given a method call). |
| Exit code `70` | Evaluator 64 MiB fallback heap cap exceeded. |
| `SNOVA0400` | `SNOVA_EMIT_UNSUPPORTED`: statement/construct cannot be lowered to `SnBC` (e.g., `try`/`catch`/`finally`, `throw`). |
| `SNOVA0401` | `SNOVA_CAPABILITY_UNSUPPORTED`: requested capability is unsupported on target/backend. |
| `SNOVA0402` | `SNOVA_CAPABILITY_PENDING`: capability awaits executable target qualification. |
| `SNOVA0403` | `SNOVA_TARGET_INVALID`: unrecognized `--target` triple. |

## Verification & Quality Gates

All gates live in `snovac`'s `Makefile`:

```sh
make -j2 test          # Alias for `make unit`: CLI fixtures, battery.sh, and 10 C unit test binaries
make conformance       # Lexical & syntactic acceptance across source corpus (with conformance.allow)
make fuzz-snbc-smoke   # 10,001 deterministic SnBC loader cases under ASan + UBSan
python3 scripts/bench_compile.py tests/run-pass/hello.snl --runs 10
```

- `tests/battery.allow` records exact, executable semantic fixture gaps (21 entries in baseline: 8 passing fixtures, 13 failing fixtures). Both new regressions and stale allowlist entries fail the gate.
- `tests/conformance.allow` tracks 3 parser exceptions (`SNOVA0148` for non-immediately-called function literals passed to `spawn`, `scope`, and `Parallel`).
