---
title: Language Specification
description: Exact lexical rules, contextual keywords, literals, operators, declarations, statements, and documentation comments accepted by the active snovac parser.
page_id: language-spec
section_label: Language Reference
permalink: /en/language-specification/
---

This specification matches the active `src/lex/` and `src/parse/` implementation in `snovac`.

## Lexical Rules

### Contextual Keywords

Keywords in Snovalang are **contextual**: the lexer emits keyword tokens for the table in `src/lex/lex_token.c`, and the parser demotes them to identifiers wherever a name is expected (after `.`, or in parameter/field name positions).

Exact keyword table (`KEYWORDS[]`):

| Category | Keywords |
| --- | --- |
| Modules & types | `package`, `import`, `class`, `struct`, `enum`, `interface`, `trait` (aliases `interface`) |
| Routines & modifiers | `func`, `method`, `static`, `public`, `private`, `protected`, `override`, `async`, `pulsar` |
| Bindings | `let`, `var`, `const` |
| Control flow | `return`, `if`, `else`, `while`, `for`, `in`, `match`, `break`, `continue` |
| Errors & cleanup | `try`, `catch`, `throw`, `defer` |
| Expressions & literals | `await`, `this`, `new`, `as`, `is`, `true`, `false`, `null` |

### Deliberately Non-Keyword Tokens

Verified directly from `src/lex/token.h`, `src/lex/lex_token.c`, and `src/parse/parse_decl.c`:

- **Primitive type names** (`int`, `long`, `double`, `decimal`, `bool`, `string`, `char`, `float`, `byte`, `unit`, `any`, `int8`..`int128`) are **not** lexer keywords; they are resolved by name as intrinsic types.
- **`and`, `or`, `not`** are ordinary identifiers, **not** operators. Boolean logic uses `&&`, `||`, and `!`.
- **Soft modifiers** recognized only immediately before a declaration keyword (`class`, `struct`, `enum`, `interface`, `method`, `func`, `let`, `var`):
  - `abstract`: recorded on the declaration; instantiating an `abstract` class is a compile error (`SNOVA0141`).
  - `data`, `unsafe`, `sealed`, `final`, `open`, `internal`: recognized as soft modifiers and currently discarded by `parse_decl.c` (`unsafe` effect preservation is scheduled in [P5]({{ '/en/coming-soon/' | relative_url }})).
- **By-text syntax forms** (not lexer keywords, usable as identifiers elsewhere): `extends`, `implements`, `throws`, `constructor`, `extension`, `type`, `finally`.
- **`>>` and `<<`**: never emitted as single tokens by the lexer (so nested generics like `Task<Result<unit, DataError>>` never collide with shift tokens). Two adjacent `<` or `>` tokens are folded by the parser into a single shift binary expression (`SN_TOK_SHL` / `SN_TOK_SHR`).
- **`::`**: not valid Snovalang syntax. The lexer emits `SN_TOK_COLONCOLON` solely to produce a clear diagnostic instead of two stray colons.

## Literals and String Interpolation

| Literal | Examples | Lexer Token |
| --- | --- | --- |
| Integer | `42`, `0xFF` | `SN_TOK_INT` |
| Long | `42L` | `SN_TOK_LONG` |
| Double | `1.5`, `1e9` | `SN_TOK_DOUBLE` |
| Decimal | `1.5d` | `SN_TOK_DECIMAL` |
| Character | `'a'` | `SN_TOK_CHAR` |
| String | `"hello"`, `"value=${x}"` | `SN_TOK_STRING` |
| Boolean / Null | `true`, `false`, `null` | Keyword tokens |

String literals support `${expr}` interpolation. Write `$$` for a literal `$`.

<div class="callout callout-warn">
  <span class="callout-title">Interpolation type-checking boundary</span>
  In the active compiler, interpolated sub-expressions inside <code>"${expr}"</code> are re-parsed at evaluation time (<code>src/eval/eval_string.c</code>) rather than exposed as AST children to the static checker. Static checking of interpolation contents is listed under <a href="{{ '/en/coming-soon/' | relative_url }}">Coming Soon</a>.
</div>

## Operators and Punctuation

| Group | Tokens |
| --- | --- |
| Arithmetic | `+`, `-`, `*`, `/`, `%` |
| Assignment | `=`, `+=`, `-=`, `*=`, `/=` |
| Comparison | `==`, `!=`, `<`, `>`, `<=`, `>=` |
| Logical | `&&`, `||`, `!` |
| Bitwise & shift | `&`, `|`, `^`, `~`, folded `<<` and `>>` |
| References | `&expr` (borrow), `*expr` (dereference) |
| Nullability & safe navigation | `?`, `?.` (optional chaining), `??` (null-coalescing) |
| Arrows & channels | `->` (return type / lambda / match arm), `~>` (pulsar stream return), `<~` (receive-bind), `=>` (lexed; match arms use `->`) |
| Type & member | `as` (explicit cast), `is` (type test), `.`, `@decorator`, `_` (wildcard) |

## Packages and Imports

Packages are identified by their `package` declaration, **not** by directory hierarchy. One package may span multiple files and directories.

```snova
package com.example.service

import builtin.io.console.output           // package import
import builtin.io.console.output.Console   // qualified symbol import
import com.example.models;                 // optional trailing semicolon
```

- Cross-package import cycles are compile errors (`SNOVA0108`).
- Imports within the same package are legal and create no graph edges.
- Missing `package` declaration in a `.snl` file reports `SNOVA0109` (`.sns` scripts default to `main`).
- Missing imported package reports `SNOVA0050`; naming a file extension in an `import` reports `SNOVA0051`.
- **Implicit prelude**: `Option<T>`, `Result<T, E>`, and their variants (`Some`, `None`, `Ok`, `Err`) from `builtin.core.types.values` are available in every file without an explicit `import`.

## Declarations

### Functions and Methods

Top-level routines use `func`; type members use `method` (placing `func` inside a class/struct body reports `SNOVA0030`; placing `method` at top level reports `SNOVA0031`). Inside an `extension` body, `func` is permitted.

Return types may be written with `: T`, `-> T`, or `~> T`. Checked errors use `throws ErrorType` or `throws(ErrorA, ErrorB)`. Single-expression bodies use `= expr`.

```snova
func add(a: int, b: int): int = a + b

func parsePort(raw: string): int throws ParseError {
    // ...
}
```

### Classes, Data Classes, and Inheritance

Classes support `public`, `private`, and `protected` members, `static` methods, `override`, `abstract`, `constructor(...)`, and single inheritance via `:`, `extends`, or `implements`:

```snova
class Animal {
    method speak(): string = "sound"
}

class Dog : Animal {
    override method speak(): string = "woof"
}

class ParseError extends Error {
    public let detail: string

    override method message(): string {
        return detail
    }
}
```

Classes are instantiated with positional parentheses (`Counter(0)`, `HealthCheck()`) or named brace fields (`WrappedException { detail: msg, cause: err }`).

`data class` bodies may also declare fields as bare `name: Type` without `let`/`var`:

```snova
data class Point {
    public let x: float
    public let y: float
}
```

A field and a method in the same type may share a name (for example, `private let path: Path` with `method path(): Path`). Two fields with the same name are a compile error (`SNOVA0120`). Methods may overload on distinct parameter types.

### Structs

Structs are constructed with **braces** (positional or named). Calling a struct with parentheses is a compile error (`SNOVA0151`):

```snova
struct Point {
    public let x: decimal
    public let y: decimal

    method distanceSquared(): decimal {
        return x * x + y * y
    }
}

func main(): int {
    let p = Point{3.0, 4.0}
    let q = Point { x: 1.0, y: 2.0 }
    return 0
}
```

### Enums and Pattern Matching

Enums support unit variants, tuple-like payload variants, generics, and methods:

```snova
enum Direction {
    North
    South
    East
    West
}

func opposite(d: Direction): Direction {
    return match d {
        Direction.North -> Direction.South
        Direction.South -> Direction.North
        Direction.East -> Direction.West
        Direction.West -> Direction.East
    }
}
```

Generic payload enum example from `builtin/core/types/values/Option.snl`:

```snova
enum Option<T> {
    Some(value: T),
    None,

    public method isSome(): bool {
        return match this {
            Some(_) -> true
            None -> false
        }
    }
}
```

### Interfaces / Traits, Extensions, and Type Aliases

`interface` and `trait` produce the same token (`SN_TOK_INTERFACE`).

Extensions add members to an existing type in block form or single-declaration form:

```snova
extension Counter {
    func isZero(): bool = value == 0
}

public extension Counter.isPositive(): bool = value > 0
```

Type aliases use the by-text `type` declaration:

```snova
public type Handler = (HttpRequest) -> HttpResponse
```

## Statements and Control Flow

- **Bindings**: `let name[: Type] = expr` (immutable; reassigning reports `SNOVA0047`, except initializing `let` fields inside `constructor`), `var name[: Type] = expr` (mutable), `const`.
- **Conditionals**: `if cond { ... } else { ... }` (parentheses around `cond` are optional; condition must be `bool`, else `SNOVA0135`).
- **Loops**:
  - `while cond { ... }`
  - `for x in xs { ... }`, `for (let x in xs) { ... }`, `for x: int in xs { ... }`
  - `for v <~ ch { ... }` (channel receive loop)
  - `break` and `continue` (outside a loop: `SNOVA0139` / `SNOVA0140`).
- **Receive-bind**: `x <~ expr` or `ok, value <~ ch.tryReceive()`.
- **Cleanup & exceptions**: `defer fn(args...)`, `try { ... } catch (e: Type) { ... } finally { ... }`, `throw expr`.
- **Pulsar launch**: `pulsar worker()` or `pulsar { ... }`.

## Structured Documentation Comments

Snovalang and `snova-lsp` parse structured doc comments for hover tooltips:

```snova
/* -- Doc:{funcName}
 *
 * -- Description: Function description text.
 *
 * -- Param{paramName}: Parameter details.
 * -- Returns: Return value information.
 */
```
