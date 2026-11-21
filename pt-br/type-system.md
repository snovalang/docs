---
title: Sistema de Tipos e Genéricos
description: Representação de tipos com hash-consing, inteiros distintos, regras estritas de conversão, nulidade, arrays, funções, sobrecarga e estado dos genéricos.
page_id: type-system
section_label: Referência da Linguagem
permalink: /pt-br/type-system/
---

O modelo de tipos da Snovalang está implementado em `src/sema/types.h` e `src/sema/check.h`. Todo tipo passa por **hash-consing** em `SnTypeTable`: tipos estruturalmente iguais retornam sempre o mesmo ponteiro `SnTypeRep*`, tornando `==` uma verificação O(1) de igualdade estrutural em todo o compilador.

Uma instância canônica única `SN_T_ERROR` propaga-se silenciosamente para impedir cascatas de diagnósticos a partir de um único erro anterior.

## Tipos Primitivos

Tipos primitivos são singletons intrínsecos do compilador (`SnTypeTag`), sem declaração em arquivo `.snl`:

| Tipo | Categoria | Largura / Semântica |
| --- | --- | --- |
| `int` | Inteiro com sinal | 64 bits com sinal. **Distinto** de `int64` e `long`. |
| `long` | Inteiro com sinal | 64 bits com sinal. **Distinto** de `int` e `int64`. |
| `int8` | Inteiro com sinal | 8 bits com sinal. |
| `int16` | Inteiro com sinal | 16 bits com sinal. |
| `int32` | Inteiro com sinal | 32 bits com sinal. |
| `int64` | Inteiro com sinal | 64 bits com sinal. **Distinto** de `int` e `long`. |
| `int128` | Inteiro com sinal | 128 bits com sinal. |
| `byte` | Inteiro sem sinal | 8 bits sem sinal. |
| `float` | Ponto flutuante | 32 bits. |
| `double` | Ponto flutuante | 64 bits. |
| `decimal` | Decimal | Tipo numérico decimal (`1.5d`). |
| `bool` | Booleano | `true` / `false`. |
| `char` | Caractere | **Não** é um inteiro. |
| `string` | Texto | Sequência/concatenação de valores `char`. |
| `unit` | Unidade | Ausência de valor útil. |
| `any` | Válvula de escape | Compatível com qualquer tipo sem erro de mismatch; sinalizado em bibliotecas públicas (`SNOVA0210`) e inferência implícita (`SNOVA0211`). |

Grafias legadas capitalizadas (`Int`, `Bool`, `Float`, `Unit`, etc.) emitem o aviso `SNOVA0011` (`SNOVA_LEGACY_TYPE_SPELLING`). Prefira sempre os nomes canônicos em minúsculas.

## Regras Estritas de Números e Conversões (`as`)

1. **Sem conversões implícitas**: `int + long`, `int + int64` e `int8 + int16` são erros de compilação (`SNOVA0133`).
2. **Adoção de literal sem sufixo**: Um literal inteiro sem sufixo (`42`) pode adotar o tipo inteiro esperado quando o valor cabe. Um literal com sufixo (`42L`, `1.5d`) permanece fixo no seu tipo.
3. **Estreitamento (*narrowing*) é sempre erro de compilação**: Converter um inteiro mais largo, um `float`/`double`/`decimal` ou uma `string` para um inteiro menor é rejeitado com `SNOVA0145` (`SNOVA_NARROWING_CONVERSION`) **mesmo com `as`**.
4. **Casts `as` explícitos permitidos**: Conversões de mesma largura ou alargamento (*widening*):
   - `int as long`, `int as int64`, `int8 as int16`, `char as string`.

```snova
let a: int = 10
let b: long = a as long               // OK: mesma largura com cast explícito
let c: int64 = 0L as int64            // OK: mesma largura com cast explícito
let d: int16 = (5 as int8) as int16   // OK: alargamento explícito
```

## Semântica de `string` e `char`

`string` é definida como concatenação de valores `char`:

- `string + string`, `string + char`, `char + string` e `char + char` produzem `string`.
- Indexar uma string (`s[i]`) e `charAt` retornam `char`.
- `+` **não** converte implicitamente números ou objetos para `string`. Converta explicitamente (por exemplo, com `.toString()` de `PrimitiveExtensions.snl`).

## Tipos Compostos e de Função

### Arrays (`T[]` e `Array<T>`)

- Representados por `SN_T_ARRAY` (`args[0]` guarda o tipo do elemento) em conjunto com a declaração genérica `builtin.collections.collections.types.Array<T>`.
- **Inferência direcional de literais**: O primeiro elemento define o tipo do array; itens subsequentes incompatíveis reportam `SNOVA0149`.
- **Literais vazios (`[]`)**: Exigem anotação de tipo explícita ou contexto esperado; `let xs = []` sem tipo reporta `SNOVA0100`.
- Para construção com verificação de assinatura, utilize `Array<T>.new()`.

### Tipos Opcionais e Referências

- **Referências seguras (`SN_T_REF`)**: `&T` (empréstimo não nulo) e `&T?` (empréstimo anulável; `nargs == 1` em `SnTypeRep`).
- **Tipos opcionais**: `T?` com navegação segura `?.` e coalescência nula `??`.
- Diagnósticos estáticos dedicados: `SNOVA0200` (tipo opcional exigido), `SNOVA0201` (`??` redundante), `SNOVA0202` (tipo incompatível no fallback), `SNOVA0203` (`?.` em não-opcional) e `SNOVA0204` (opcional aninhado `T??`).

### `Partial<T>` e Tipos de Função

- `Partial<T>` é um tipo genérico intrínseco para construção parcial validando nomes de campos contra `T`.
- `SN_T_FUNC` armazena parâmetros (`args`/`nargs`), tipo de retorno (`ret`) e efeitos `throws` verificados (`throws_types`/`nthrows`).

### Sobrecarga de Métodos

Métodos do mesmo tipo podem compartilhar nome quando os tipos dos parâmetros diferem:

- Mais de um candidato compatível -> `SNOVA0146` (`SNOVA_AMBIGUOUS_OVERLOAD`).
- Nenhum candidato compatível -> `SNOVA0147` (`SNOVA_NO_MATCHING_OVERLOAD`).
- Assinatura idêntica duplicada -> `SNOVA0120` (`SNOVA_DUPLICATE_DECL`).

## Genéricos e Limites Atuais do Verificador

Instanciações genéricas como `List<int>` e `List<string>` são tipos `SN_T_NAMED` distintos com checagem de aridade (`SNOVA0144`).

<div class="callout callout-coming">
  <span class="callout-title">Coming Soon no Verificador de Tipos (documentado em <code>src/sema/check.h</code>)</span>
  <ul>
    <li><strong>Bounds e substituição de genéricos</strong>: Restrições de parâmetros genéricos ainda não são verificadas, argumentos genéricos ainda não são inferidos na chamada e chamar um método que retorna <code>T</code> em <code>Container&lt;int&gt;</code> hoje verifica como retornando a variável de tipo <code>T</code> sem substituir por <code>int</code>.</li>
    <li><strong>Inferência bidirecional de tipo esperado</strong>: Parâmetros de lambdas sem anotação, tipo resultante de <code>if</code>/<code>match</code> como expressão, literais de struct e payloads de padrões de <code>match</code> (hoje vinculados como <code>SN_T_ERROR</code>) ainda não estão implementados.</li>
    <li><strong>Protocolo <code>Iterable</code> e tuplas</strong>: <code>for</code> infere <code>int</code> para intervalos inteiros e <code>T</code> para arrays e <code>Channel&lt;T&gt;</code>; iteráveis genéricos e tuplas estão planejados.</li>
    <li><strong>Operador <code>?</code></strong>: Implementação provisória (desembrulha <code>Option&lt;T&gt;</code>/<code>Result&lt;T, E&gt;</code> por nome).</li>
    <li><strong>Tipo comum em literais de array</strong>: Hoje ancora no primeiro elemento em vez de calcular um supertipo comum atribuível.</li>
  </ul>
</div>
