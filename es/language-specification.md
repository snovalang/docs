---
title: Especificación del Lenguaje
description: Reglas léxicas exactas, palabras clave contextuales, literales, operadores, declaraciones, sentencias y comentarios de documentación aceptados por el parser activo de snovac.
page_id: language-spec
section_label: Referencia del Lenguaje
permalink: /es/language-specification/
---

Esta especificación corresponde exactamente a la implementación activa en `src/lex/` y `src/parse/` dentro de `snovac`.

## Reglas Léxicas

### Palabras Clave Contextuales

Las palabras clave en Snovalang son **contextuales**: el lexer emite tokens de palabra clave según la tabla `KEYWORDS[]` en `src/lex/lex_token.c`, y el parser los degrada a identificadores siempre que se espera un nombre (después de `.`, o en posición de nombre de parámetro/campo).

Tabla exacta (`KEYWORDS[]`):

| Categoría | Palabras clave |
| --- | --- |
| Módulos y tipos | `package`, `import`, `class`, `struct`, `enum`, `interface`, `trait` (alias de `interface`) |
| Rutinas y modificadores | `func`, `method`, `static`, `public`, `private`, `protected`, `override`, `async`, `pulsar` |
| Enlaces | `let`, `var`, `const` |
| Control de flujo | `return`, `if`, `else`, `while`, `for`, `in`, `match`, `break`, `continue` |
| Errores y limpieza | `try`, `catch`, `throw`, `defer` |
| Expresiones y literales | `await`, `this`, `new`, `as`, `is`, `true`, `false`, `null` |

### Tokens Deliberadamente Fuera de la Tabla de Palabras Clave

Verificado directamente en `src/lex/token.h`, `src/lex/lex_token.c` y `src/parse/parse_decl.c`:

- **Nombres de tipos primitivos** (`int`, `long`, `double`, `decimal`, `bool`, `string`, `char`, `float`, `byte`, `unit`, `any`, `int8`..`int128`) **no** son palabras clave del lexer; se resuelven por nombre como tipos intrínsecos.
- **`and`, `or`, `not`** son identificadores ordinarios, **no** operadores. La lógica booleana utiliza `&&`, `||` y `!`.
- **Modificadores suaves (*soft modifiers*)** reconocidos únicamente justo antes de una palabra clave de declaración (`class`, `struct`, `enum`, `interface`, `method`, `func`, `let`, `var`):
  - `abstract`: registrado en la declaración; instanciar una clase `abstract` produce error de compilación (`SNOVA0141`).
  - `data`, `unsafe`, `sealed`, `final`, `open`, `internal`: reconocidos como modificadores suaves y actualmente descartados por `parse_decl.c` (la preservación del efecto `unsafe` está planificada para [P5]({{ '/es/coming-soon/' | relative_url }})).
- **Formas reconocidas por texto** (no son palabras clave del lexer; utilizables como identificadores en otros lugares): `extends`, `implements`, `throws`, `constructor`, `extension`, `type`, `finally`.
- **`>>` y `<<`**: nunca se emiten como un único token en el lexer (evitando colisiones en genéricos anidados como `Task<Result<unit, DataError>>`). Dos tokens `<` o `>` adyacentes se pliegan en el parser en una expresión binaria de desplazamiento (`SN_TOK_SHL` / `SN_TOK_SHR`).
- **`::`**: no es sintaxis válida de Snovalang. El lexer emite `SN_TOK_COLONCOLON` únicamente para producir un diagnóstico claro en lugar de dos signos de dos puntos sueltos.

## Literales e Interpolación de Cadenas

| Literal | Ejemplos | Token del Lexer |
| --- | --- | --- |
| Entero | `42`, `0xFF` | `SN_TOK_INT` |
| Long | `42L` | `SN_TOK_LONG` |
| Double | `1.5`, `1e9` | `SN_TOK_DOUBLE` |
| Decimal | `1.5d` | `SN_TOK_DECIMAL` |
| Carácter | `'a'` | `SN_TOK_CHAR` |
| Cadena | `"hola"`, `"valor=${x}"` | `SN_TOK_STRING` |
| Booleano / Nulo | `true`, `false`, `null` | Tokens de palabra clave |

Los literales de cadena admiten interpolación `${expr}`. Escribe `$$` para un `$` literal.

<div class="callout callout-warn">
  <span class="callout-title">Límite de verificación de interpolación</span>
  En el compilador activo, las subexpresiones dentro de <code>"${expr}"</code> se vuelven a analizar en tiempo de evaluación (<code>src/eval/eval_string.c</code>) en lugar de exponerse como nodos hijos de la AST al verificador estático. La comprobación estática de interpolaciones está en <a href="{{ '/es/coming-soon/' | relative_url }}">Coming Soon</a>.
</div>

## Operadores y Puntuación

| Grupo | Tokens |
| --- | --- |
| Aritméticos | `+`, `-`, `*`, `/`, `%` |
| Asignación | `=`, `+=`, `-=`, `*=`, `/=` |
| Comparación | `==`, `!=`, `<`, `>`, `<=`, `>=` |
| Lógicos | `&&`, `||`, `!` |
| Bit a bit y desplazamiento | `&`, `|`, `^`, `~`, `<<` y `>>` plegados en el parser |
| Referencias | `&expr` (préstamo), `*expr` (desreferencia) |
| Nulabilidad y navegación segura | `?`, `?.` (encadenamiento opcional), `??` (coalescencia nula) |
| Flechas y canales | `->` (tipo de retorno / lambda / rama de `match`), `~>` (retorno streaming pulsar), `<~` (receive-bind), `=>` (tokenizado; las ramas de `match` usan `->`) |
| Tipo y miembro | `as` (conversión explícita), `is` (prueba de tipo), `.`, `@decorator`, `_` (comodín) |

## Paquetes e Importaciones

Un paquete se identifica por su declaración `package`, **nunca** por la estructura de directorios. Un mismo paquete puede abarcar múltiples archivos y carpetas.

```snova
package com.ejemplo.servicio

import builtin.io.console.output           // importación de paquete
import builtin.io.console.output.Console   // importación calificada de símbolo
import com.ejemplo.modelos;                // punto y coma opcional
```

- Los ciclos de importación entre paquetes distintos son error de compilación (`SNOVA0108`).
- Las importaciones dentro del mismo paquete son legales y no crean aristas en el grafo.
- Un archivo `.snl` sin `package` reporta `SNOVA0109` (los scripts `.sns` usan `main`).
- Un paquete importado inexistente reporta `SNOVA0050`; indicar una extensión de archivo en `import` reporta `SNOVA0051`.
- **Preludio implícito**: `Option<T>`, `Result<T, E>` y sus variantes (`Some`, `None`, `Ok`, `Err`) de `builtin.core.types.values` están disponibles en todo archivo sin `import` explícito.

## Declaraciones

### Funciones y Métodos

Las rutinas de nivel superior usan `func`; los miembros de tipos usan `method` (declarar `func` dentro de clase/struct reporta `SNOVA0030`; declarar `method` en nivel superior reporta `SNOVA0031`). Dentro de `extension`, `func` está permitido.

Los tipos de retorno aceptan `: T`, `-> T` o `~> T`. Los errores verificados usan `throws TipoError` o `throws(ErrorA, ErrorB)`. Los cuerpos de expresión única usan `= expr`.

```snova
func sumar(a: int, b: int): int = a + b

func leerPuerto(raw: string): int throws ParseError {
    // ...
}
```

### Clases, Data Classes y Herencia

Las clases admiten `public`, `private`, `protected`, `static`, `override`, `abstract`, `constructor(...)` y herencia simple mediante `:`, `extends` o `implements`:

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

Las clases se instancian con paréntesis posicionales (`Counter(0)`, `HealthCheck()`) o llaves con campos nombrados (`WrappedException { detail: msg, cause: err }`).

En `data class`, los campos también pueden declararse sin `let`/`var` (`nombre: Tipo`). Un campo y un método en el mismo tipo pueden compartir nombre (p. ej., `private let path: Path` y `method path(): Path`). Dos campos con el mismo nombre son error (`SNOVA0120`). Los métodos admiten sobrecarga cuando difieren los tipos de parámetros.

### Structs

Las structs se construyen con **llaves** (posicionales o nombradas). Usar paréntesis para construir una struct produce `SNOVA0151`:

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

### Enums y Pattern Matching

Los enums soportan variantes simples, variantes con payload, genéricos y métodos:

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

### Interfaces / Traits, Extensions y Alias de Tipo

`interface` y `trait` producen el mismo token (`SN_TOK_INTERFACE`).

`extension` añade miembros a un tipo existente en forma de bloque o declaración única:

```snova
extension Counter {
    func isZero(): bool = value == 0
}

public extension Counter.isPositive(): bool = value > 0
```

Los alias de tipo usan la declaración por texto `type`:

```snova
public type Handler = (HttpRequest) -> HttpResponse
```

## Sentencias y Control de Flujo

- **Enlaces**: `let nombre[: Tipo] = expr` (inmutable; reasignar reporta `SNOVA0047`, salvo inicializar campos `let` en `constructor`), `var nombre[: Tipo] = expr` (mutable), `const`.
- **Condicionales**: `if cond { ... } else { ... }` (paréntesis opcionales; la condición debe ser `bool`, si no `SNOVA0135`).
- **Bucles**: `while cond { ... }`, `for x in xs { ... }`, `for (let x in xs) { ... }`, `for x: int in xs { ... }`, `for v <~ ch { ... }`, `break` (`SNOVA0139` fuera de bucle), `continue` (`SNOVA0140` fuera de bucle).
- **Receive-bind**: `x <~ expr` o `ok, valor <~ ch.tryReceive()`.
- **Limpieza y excepciones**: `defer fn(args...)`, `try { ... } catch (e: Tipo) { ... } finally { ... }`, `throw expr`.
- **Lanzamiento Pulsar**: `pulsar worker()` o `pulsar { ... }`.

## Estándar de Comentarios de Documentación

El lenguaje y `snova-lsp` analizan comentarios estructurados para *hover*:

```snova
/* -- Doc:{funcName}
 *
 * -- Description: Descripción de la función.
 *
 * -- Param{paramName}: Detalles del parámetro.
 * -- Returns: Información del valor de retorno.
 */
```
