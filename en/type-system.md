---
title: Type System & Generics
description: Hash-consed type representation, distinct integer widths, strict conversion rules, nullability, arrays, functions, overloading, and generic type status.
page_id: type-system
section_label: Language Reference
permalink: /en/type-system/
---

Snovalang's type model is implemented in `src/sema/types.h` and `src/sema/check.h`. Every type is **hash-consed** into an intern table (`SnTypeTable`): structurally equal types always resolve to the exact same `SnTypeRep*` pointer, making `==` an O(1) structural type-equality test throughout the compiler.

A single canonical `SN_T_ERROR` instance propagates silently so that a single upstream type error does not trigger cascading diagnostics.

## Primitive Types

Primitive types are compiler-intrinsic singletons (`SnTypeTag`) with no source declaration:

| Type | Kind | Width / Semantics |
| --- | --- | --- |
| `int` | Signed integer | 64-bit signed. **Distinct** from `int64` and `long`. |
| `long` | Signed integer | 64-bit signed. **Distinct** from `int` and `int64`. |
| `int8` | Signed integer | 8-bit signed. |
| `int16` | Signed integer | 16-bit signed. |
| `int32` | Signed integer | 32-bit signed. |
| `int64` | Signed integer | 64-bit signed. **Distinct** from `int` and `long`. |
| `int128` | Signed integer | 128-bit signed. |
| `byte` | Unsigned integer | 8-bit unsigned. |
| `float` | Floating-point | 32-bit floating-point. |
| `double` | Floating-point | 64-bit floating-point. |
| `decimal` | Decimal | Fixed/decimal numeric type (`1.5d`). |
| `bool` | Boolean | `true` / `false`. |
| `char` | Character | **Not** an integer type. |
| `string` | Text | Sequence/concatenation of `char` values. |
| `unit` | Unit | Absence of a meaningful value. |
| `any` | Escape hatch | Accepts/matches any type without mismatch; flagged in public libraries (`SNOVA0210`) and implicit inference (`SNOVA0211`). |

Legacy capitalized spellings (`Int`, `Bool`, `Float`, `Unit`, etc.) emit warning `SNOVA0011` (`SNOVA_LEGACY_TYPE_SPELLING`). Prefer lowercase canonical names.

## Strict Numeric and Cast Rules

1. **No implicit conversions**: `int + long`, `int + int64`, and `int8 + int16` are compile errors (`SNOVA0133`).
2. **Unsuffixed literal adoption**: An unsuffixed integer literal (`42`) may adopt an expected integer type when the value fits. A suffixed literal (`42L`, `1.5d`) stays committed to its suffixed type.
3. **Narrowing is always a compile error**: Converting a wider integer, a `float`/`double`/`decimal`, or a `string` into a smaller integer is rejected with `SNOVA0145` (`SNOVA_NARROWING_CONVERSION`) **even when written with `as`**.
4. **Allowed explicit `as` casts**: Same-width and widening conversions are explicit:
   - `int as long`, `int as int64`, `int8 as int16`, `char as string`.

```snova
let a: int = 10
let b: long = a as long       // OK: same-width explicit cast
let c: int64 = 0L as int64    // OK: same-width explicit cast
let d: int16 = (5 as int8) as int16 // OK: widening cast
```

## String and Character Semantics

`string` is defined as a concatenation of `char` values:

- `string + string` -> `string`
- `string + char` -> `string`
- `char + string` -> `string`
- `char + char` -> `string`
- Indexing a string (`s[i]`) and `charAt` return `char`.
- `+` does **not** implicitly coerce numbers or objects to `string`. Convert explicitly (for example via `.toString()` from `PrimitiveExtensions.snl`).

## Composite and Function Types

### Arrays (`T[]` and `Array<T>`)

- Represented internally by `SN_T_ARRAY` (`args[0]` stores the element type) alongside the generic declaration `builtin.collections.collections.types.Array<T>`.
- **Directional array literal inference**: The first element determines the literal's element type; subsequent incompatible elements report `SNOVA0149`.
- **Empty array literals (`[]`)**: Require an explicit type annotation or expected context; untyped `let xs = []` reports `SNOVA0100`.
- For factory construction with checked signatures, use `Array<T>.new()`.

### Optional and Reference Types

- **Safe references (`SN_T_REF`)**: `&T` (non-null borrow) and `&T?` (nullable borrow; `nargs == 1` in `SnTypeRep`).
- **Optional types**: `T?` with safe navigation `?.` and null-coalescing `??`.
- Static diagnostics guard misuse:
  - `SNOVA0200`: optional type required
  - `SNOVA0201`: redundant `??` on non-optional value
  - `SNOVA0202`: mismatched fallback type in `??`
  - `SNOVA0203`: `?.` used on a non-optional value
  - `SNOVA0204`: nested optional (`T??`)

### Partial Types (`Partial<T>`)

`Partial<T>` is an intrinsic generic type representing partial object construction where field names are validated against `T`.

### Function Types and Checked Effects

`SN_T_FUNC` stores parameter types (`args`/`nargs`), return type (`ret`), and checked `throws` effect types (`throws_types`/`nthrows`):

```snova
type RouteHandler = (HttpRequest) -> HttpResponse
```

### Method Overloading

Methods in the same type may share a name when their parameter types differ. The checker selects a unique matching candidate:

- Multiple candidates match -> `SNOVA0146` (`SNOVA_AMBIGUOUS_OVERLOAD`).
- No candidate matches -> `SNOVA0147` (`SNOVA_NO_MATCHING_OVERLOAD`).
- Identical signature declared twice -> `SNOVA0120` (`SNOVA_DUPLICATE_DECL`).

## Generics and Current Type-Checking Boundaries

Generic instantiations such as `List<int>` vs `List<string>` are distinct, hash-consed `SN_T_NAMED` types checked for generic arity (`SNOVA0144`).

<div class="callout callout-coming">
  <span class="callout-title">Coming Soon in the Type Checker (documented in <code>src/sema/check.h</code>)</span>
  <ul>
    <li><strong>Generic bounds &amp; substitution</strong>: Generic parameter bounds are not yet checked, generic arguments are not yet inferred from call sites, and calling a method declared to return <code>T</code> on <code>Container&lt;int&gt;</code> currently checks as returning the type variable <code>T</code> rather than substituting <code>int</code>.</li>
    <li><strong>Bidirectional expected-type inference</strong>: Unannotated lambda parameters, <code>if</code>/<code>match</code>-as-expression result types, struct-literal expected types, and match pattern payload typing (currently bound as <code>SN_T_ERROR</code>) are not yet implemented.</li>
    <li><strong><code>Iterable</code> protocol &amp; tuples</strong>: <code>for</code> infers <code>int</code> for integer ranges, <code>T</code> for arrays and <code>Channel&lt;T&gt;</code>; general iterables and tuple types are planned.</li>
    <li><strong><code>?</code> propagation</strong>: Currently provisional (unwraps <code>Option&lt;T&gt;</code> / <code>Result&lt;T, E&gt;</code> by name).</li>
    <li><strong>Common array element type</strong>: Array literals currently infer from the first item rather than computing a common assignable supertype.</li>
  </ul>
</div>
