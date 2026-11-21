---
title: Especificação da Linguagem
description: Regras léxicas exatas, palavras-chave contextuais, literais, operadores, declarações, instruções e comentários de documentação aceitos pelo parser ativo de snovac.
page_id: language-spec
section_label: Referência da Linguagem
permalink: /pt-br/language-specification/
---

Esta especificação reflete exatamente a implementação ativa de `src/lex/` e `src/parse/` no `snovac`.

## Regras Léxicas

### Palavras-Chave Contextuais

As palavras-chave da Snovalang são **contextuais**: o lexer emite tokens de palavra-chave conforme a tabela `KEYWORDS[]` em `src/lex/lex_token.c`, e o parser os rebaixa para identificadores sempre que um nome é esperado (após `.`, ou em posição de nome de parâmetro/campo).

Tabela exata (`KEYWORDS[]`):

| Categoria | Palavras-chave |
| --- | --- |
| Módulos e tipos | `package`, `import`, `class`, `struct`, `enum`, `interface`, `trait` (alias de `interface`) |
| Rotinas e modificadores | `func`, `method`, `static`, `public`, `private`, `protected`, `override`, `async`, `pulsar` |
| Vinculações | `let`, `var`, `const` |
| Controle de fluxo | `return`, `if`, `else`, `while`, `for`, `in`, `match`, `break`, `continue` |
| Erros e limpeza | `try`, `catch`, `throw`, `defer` |
| Expressões e literais | `await`, `this`, `new`, `as`, `is`, `true`, `false`, `null` |

### Tokens Deliberadamente Fora da Tabela de Palavras-Chave

Verificado diretamente em `src/lex/token.h`, `src/lex/lex_token.c` e `src/parse/parse_decl.c`:

- **Nomes de tipos primitivos** (`int`, `long`, `double`, `decimal`, `bool`, `string`, `char`, `float`, `byte`, `unit`, `any`, `int8`..`int128`) **não** são palavras-chave do lexer; são resolvidos por nome como tipos intrínsecos.
- **`and`, `or`, `not`** são identificadores comuns, **não** operadores. A lógica booleana usa `&&`, `||` e `!`.
- **Modificadores suaves (*soft modifiers*)** reconhecidos apenas imediatamente antes de uma palavra-chave de declaração (`class`, `struct`, `enum`, `interface`, `method`, `func`, `let`, `var`):
  - `abstract`: registrado na declaração; instanciar uma classe `abstract` gera erro de compilação (`SNOVA0141`).
  - `data`, `unsafe`, `sealed`, `final`, `open`, `internal`: reconhecidos como modificadores suaves e atualmente descartados por `parse_decl.c` (a preservação do efeito `unsafe` está prevista em [P5]({{ '/pt-br/coming-soon/' | relative_url }})).
- **Formas reconhecidas por texto** (não são palavras-chave do lexer; utilizáveis como identificadores em outros contextos): `extends`, `implements`, `throws`, `constructor`, `extension`, `type`, `finally`.
- **`>>` e `<<`**: nunca são emitidos como token único pelo lexer (evitando colisão em genéricos aninhados como `Task<Result<unit, DataError>>`). Dois tokens `<` ou `>` adjacentes são dobrados pelo parser em uma expressão binária de deslocamento (`SN_TOK_SHL` / `SN_TOK_SHR`).
- **`::`**: não faz parte da sintaxe Snovalang. O lexer emite `SN_TOK_COLONCOLON` apenas para gerar diagnóstico claro em vez de dois pontos soltos.

## Literais e Interpolação de Strings

| Literal | Exemplos | Token do Lexer |
| --- | --- | --- |
| Inteiro | `42`, `0xFF` | `SN_TOK_INT` |
| Long | `42L` | `SN_TOK_LONG` |
| Double | `1.5`, `1e9` | `SN_TOK_DOUBLE` |
| Decimal | `1.5d` | `SN_TOK_DECIMAL` |
| Caractere | `'a'` | `SN_TOK_CHAR` |
| String | `"ola"`, `"valor=${x}"` | `SN_TOK_STRING` |
| Booleano / Nulo | `true`, `false`, `null` | Tokens de palavra-chave |

Literais de string aceitam interpolação `${expr}`. Use `$$` para um `$` literal.

<div class="callout callout-warn">
  <span class="callout-title">Limite da checagem de interpolação</span>
  No compilador ativo, subexpressões dentro de <code>"${expr}"</code> são reanalisadas em tempo de avaliação (<code>src/eval/eval_string.c</code>) em vez de expostas como filhos da AST ao verificador estático. A checagem estática de interpolações está em <a href="{{ '/pt-br/coming-soon/' | relative_url }}">Coming Soon</a>.
</div>

## Operadores e Pontuação

| Grupo | Tokens |
| --- | --- |
| Aritméticos | `+`, `-`, `*`, `/`, `%` |
| Atribuição | `=`, `+=`, `-=`, `*=`, `/=` |
| Comparação | `==`, `!=`, `<`, `>`, `<=`, `>=` |
| Lógicos | `&&`, `||`, `!` |
| Bitwise e deslocamento | `&`, `|`, `^`, `~`, `<<` e `>>` dobrados no parser |
| Referências | `&expr` (empréstimo), `*expr` (desreferência) |
| Nulidade e navegação segura | `?`, `?.` (encadeamento opcional), `??` (coalescência nula) |
| Setas e canais | `->` (tipo de retorno / lambda / ramo de `match`), `~>` (retorno streaming pulsar), `<~` (receive-bind), `=>` (tokenizado; ramos de `match` usam `->`) |
| Tipo e membro | `as` (cast explícito), `is` (teste de tipo), `.`, `@decorator`, `_` (coringa) |

## Pacotes e Imports

Um pacote é identificado pela declaração `package`, **nunca** pela estrutura de diretórios. Um mesmo pacote pode abranger múltiplos arquivos e pastas.

```snova
package com.exemplo.servico

import builtin.io.console.output           // import de pacote
import builtin.io.console.output.Console   // import qualificado de símbolo
import com.exemplo.modelos;                // ponto e vírgula opcional
```

- Ciclos de importação entre pacotes distintos são erro de compilação (`SNOVA0108`).
- Imports dentro do mesmo pacote são válidos e não geram arestas no grafo.
- Ausência de `package` em arquivo `.snl` reporta `SNOVA0109` (scripts `.sns` usam `main`).
- Pacote importado inexistente reporta `SNOVA0050`; informar extensão de arquivo no `import` reporta `SNOVA0051`.
- **Prelúdio implícito**: `Option<T>`, `Result<T, E>` e suas variantes (`Some`, `None`, `Ok`, `Err`), de `builtin.core.types.values`, estão disponíveis em qualquer arquivo sem `import` explícito.

## Declarações

### Funções e Métodos

Rotinas de nível superior usam `func`; membros de tipos usam `method` (declarar `func` dentro de classe/struct reporta `SNOVA0030`; declarar `method` no nível superior reporta `SNOVA0031`). Dentro de `extension`, `func` é permitido.

Tipos de retorno podem ser escritos com `: T`, `-> T` ou `~> T`. Erros verificados usam `throws TipoErro` ou `throws(ErroA, ErroB)`. Corpos de expressão única usam `= expr`.

```snova
func somar(a: int, b: int): int = a + b

func lerPorta(raw: string): int throws ParseError {
    // ...
}
```

### Classes, Data Classes e Herança

Classes aceitam `public`, `private`, `protected`, `static`, `override`, `abstract`, `constructor(...)` e herança única via `:`, `extends` ou `implements`:

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

Instanciação de classes usa parênteses posicionais (`Counter(0)`, `HealthCheck()`) ou chaves com campos nomeados (`WrappedException { detail: msg, cause: err }`).

Em `data class`, campos também podem ser escritos sem `let`/`var` (`nome: Tipo`). Um campo e um método no mesmo tipo podem compartilhar nome (ex.: `private let path: Path` e `method path(): Path`). Dois campos com o mesmo nome são erro (`SNOVA0120`). Métodos aceitam sobrecarga quando os tipos de parâmetros diferem.

### Structs

Structs são construídas com **chaves** (posicionais ou nomeadas). Usar parênteses para construir uma struct gera `SNOVA0151`:

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

### Enums e Pattern Matching

Enums suportam variantes simples, variantes com payload, genéricos e métodos:

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

### Interfaces / Traits, Extensions e Type Aliases

`interface` e `trait` produzem o mesmo token (`SN_TOK_INTERFACE`).

`extension` adiciona membros a um tipo existente em bloco ou em declaração única:

```snova
extension Counter {
    func isZero(): bool = value == 0
}

public extension Counter.isPositive(): bool = value > 0
```

Aliases de tipo usam a declaração `type`:

```snova
public type Handler = (HttpRequest) -> HttpResponse
```

## Instruções e Controle de Fluxo

- **Vinculações**: `let nome[: Tipo] = expr` (imutável; reatribuição gera `SNOVA0047`, exceto inicialização de campos `let` dentro de `constructor`), `var nome[: Tipo] = expr` (mutável), `const`.
- **Condicionais**: `if cond { ... } else { ... }` (parênteses opcionais; condição deve ser `bool`, senão `SNOVA0135`).
- **Laços**: `while cond { ... }`, `for x in xs { ... }`, `for (let x in xs) { ... }`, `for x: int in xs { ... }`, `for v <~ ch { ... }`, `break` (`SNOVA0139` fora de laço), `continue` (`SNOVA0140` fora de laço).
- **Receive-bind**: `x <~ expr` ou `ok, valor <~ ch.tryReceive()`.
- **Limpeza e exceções**: `defer fn(args...)`, `try { ... } catch (e: Tipo) { ... } finally { ... }`, `throw expr`.
- **Disparo Pulsar**: `pulsar worker()` ou `pulsar { ... }`.

## Padrão de Comentários de Documentação

Tanto a linguagem quanto o `snova-lsp` interpretam comentários estruturados para *hover*:

```snova
/* -- Doc:{funcName}
 *
 * -- Description: Descrição da função.
 *
 * -- Param{paramName}: Detalhes do parâmetro.
 * -- Returns: Informações do valor de retorno.
 */
```
