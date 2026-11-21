---
title: Sistema de Tipos y Genéricos
description: Representación de tipos con hash-consing, enteros distintos, reglas estrictas de conversión, nulabilidad, arrays, funciones, sobrecarga y estado de los genéricos.
page_id: type-system
section_label: Referencia del Lenguaje
permalink: /es/type-system/
---

El modelo de tipos de Snovalang está implementado en `src/sema/types.h` y `src/sema/check.h`. Cada tipo usa **hash-consing** en `SnTypeTable`: dos tipos estructuralmente iguales devuelven siempre el mismo puntero `SnTypeRep*`, haciendo que `==` sea una prueba O(1) de igualdad estructural en todo el compilador.

Una instancia canónica única `SN_T_ERROR` se propaga silenciosamente para evitar cascadas de diagnósticos tras un error previo.

## Tipos Primitivos

Los tipos primitivos son singletons intrínsecos del compilador (`SnTypeTag`) sin declaración en archivos `.snl`:

| Tipo | Categoría | Ancho / Semántica |
| --- | --- | --- |
| `int` | Entero con signo | 64 bits con signo. **Distinto** de `int64` y `long`. |
| `long` | Entero con signo | 64 bits con signo. **Distinto** de `int` e `int64`. |
| `int8` | Entero con signo | 8 bits con signo. |
| `int16` | Entero con signo | 16 bits con signo. |
| `int32` | Entero con signo | 32 bits con signo. |
| `int64` | Entero con signo | 64 bits con signo. **Distinto** de `int` y `long`. |
| `int128` | Entero con signo | 128 bits con signo. |
| `byte` | Entero sin signo | 8 bits sin signo. |
| `float` | Punto flotante | 32 bits. |
| `double` | Punto flotante | 64 bits. |
| `decimal` | Decimal | Tipo numérico decimal (`1.5d`). |
| `bool` | Booleano | `true` / `false`. |
| `char` | Carácter | **No** es un entero. |
| `string` | Texto | Secuencia/concatenación de valores `char`. |
| `unit` | Unidad | Ausencia de valor significativo. |
| `any` | Válvula de escape | Compatible con cualquier tipo sin mismatch; señalado en bibliotecas públicas (`SNOVA0210`) e inferencia implícita (`SNOVA0211`). |

Las grafías heredadas en mayúscula (`Int`, `Bool`, `Float`, `Unit`, etc.) emiten la advertencia `SNOVA0011` (`SNOVA_LEGACY_TYPE_SPELLING`). Usa siempre los nombres canónicos en minúscula.

## Reglas Estrictas Numéricas y de Conversión (`as`)

1. **Sin conversiones implícitas**: `int + long`, `int + int64` e `int8 + int16` son errores de compilación (`SNOVA0133`).
2. **Adopción de literales sin sufijo**: Un literal entero sin sufijo (`42`) puede adoptar el tipo entero esperado cuando el valor cabe. Un literal con sufijo (`42L`, `1.5d`) conserva su tipo fijo.
3. **El estrechamiento (*narrowing*) es siempre error de compilación**: Convertir un entero más ancho, un `float`/`double`/`decimal` o una `string` hacia un entero menor se rechaza con `SNOVA0145` (`SNOVA_NARROWING_CONVERSION`) **incluso con `as`**.
4. **Casts `as` explícitos permitidos**: Conversiones del mismo ancho o de ensanchamiento (*widening*):
   - `int as long`, `int as int64`, `int8 as int16`, `char as string`.

```snova
let a: int = 10
let b: long = a as long               // OK: mismo ancho con cast explícito
let c: int64 = 0L as int64            // OK: mismo ancho con cast explícito
let d: int16 = (5 as int8) as int16   // OK: ensanchamiento explícito
```

## Semántica de `string` y `char`

`string` se define como concatenación de valores `char`:

- `string + string`, `string + char`, `char + string` y `char + char` producen `string`.
- Indexar una cadena (`s[i]`) y `charAt` devuelven `char`.
- `+` **no** convierte implícitamente números ni objetos a `string`. Convierte explícitamente (por ejemplo con `.toString()` de `PrimitiveExtensions.snl`).

## Tipos Compuestos y de Función

### Arrays (`T[]` y `Array<T>`)

- Representados por `SN_T_ARRAY` (`args[0]` almacena el tipo del elemento) junto con la declaración genérica `builtin.collections.collections.types.Array<T>`.
- **Inferencia direccional de literales**: El primer elemento fija el tipo del array; los elementos posteriores incompatibles reportan `SNOVA0149`.
- **Literales vacíos (`[]`)**: Requieren anotación explícita o contexto esperado; `let xs = []` sin tipo reporta `SNOVA0100`.
- Para construcción con verificación de firma, utiliza `Array<T>.new()`.

### Tipos Opcionales y Referencias

- **Referencias seguras (`SN_T_REF`)**: `&T` (préstamo no nulo) y `&T?` (préstamo anulable; `nargs == 1` en `SnTypeRep`).
- **Tipos opcionales**: `T?` con navegación segura `?.` y coalescencia nula `??`.
- Diagnósticos dedicados: `SNOVA0200` (tipo opcional requerido), `SNOVA0201` (`??` redundante), `SNOVA0202` (fallback incompatible), `SNOVA0203` (`?.` en no opcional) y `SNOVA0204` (opcional anidado `T??`).

### `Partial<T>` y Tipos de Función

- `Partial<T>` es un tipo genérico intrínseco para construcción parcial validando nombres de campos frente a `T`.
- `SN_T_FUNC` almacena parámetros (`args`/`nargs`), tipo de retorno (`ret`) y efectos `throws` verificados (`throws_types`/`nthrows`).

### Sobrecarga de Métodos

Los métodos de un mismo tipo pueden compartir nombre cuando difieren sus tipos de parámetros:

- Más de un candidato coincide -> `SNOVA0146` (`SNOVA_AMBIGUOUS_OVERLOAD`).
- Ningún candidato coincide -> `SNOVA0147` (`SNOVA_NO_MATCHING_OVERLOAD`).
- Firma idéntica duplicada -> `SNOVA0120` (`SNOVA_DUPLICATE_DECL`).

## Genéricos y Límites Actuales del Verificador

Las instanciaciones genéricas como `List<int>` y `List<string>` son tipos `SN_T_NAMED` distintos con verificación de aridad (`SNOVA0144`).

<div class="callout callout-coming">
  <span class="callout-title">Coming Soon en el Verificador de Tipos (documentado en <code>src/sema/check.h</code>)</span>
  <ul>
    <li><strong>Bounds y sustitución de genéricos</strong>: Las restricciones de parámetros genéricos aún no se verifican, los argumentos genéricos aún no se infieren en llamadas y llamar a un método que devuelve <code>T</code> sobre <code>Container&lt;int&gt;</code> hoy se verifica devolviendo la variable de tipo <code>T</code> sin sustituir por <code>int</code>.</li>
    <li><strong>Inferencia bidireccional de tipo esperado</strong>: Parámetros de lambdas sin anotar, tipo resultado de <code>if</code>/<code>match</code> como expresión, literales de struct y payloads de patrones de <code>match</code> (hoy enlazados como <code>SN_T_ERROR</code>) aún no están implementados.</li>
    <li><strong>Protocolo <code>Iterable</code> y tuplas</strong>: <code>for</code> infiere <code>int</code> para rangos enteros y <code>T</code> para arrays y <code>Channel&lt;T&gt;</code>; iterables generales y tuplas están planificados.</li>
    <li><strong>Operador <code>?</code></strong>: Implementación provisional (desenvuelve <code>Option&lt;T&gt;</code>/<code>Result&lt;T, E&gt;</code> por nombre).</li>
    <li><strong>Tipo común en literales de array</strong>: Actualmente se ancla en el primer elemento en lugar de calcular un supertipo común asignable.</li>
  </ul>
</div>
