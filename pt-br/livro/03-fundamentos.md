---
title: "3. Fundamentos da linguagem"
description: Literais, tipos primitivos, let e var, inteiros de 64 bits, operadores e precedência, if, while, break, continue e match, todos verificados no compilador atual.
page_id: livro-03
section_label: "Livro · Capítulo 3"
permalink: /pt-br/livro/03-fundamentos/
---

O capítulo 2 terminou com um programa que só imprime uma constante. Para calcular e decidir, a Snova atual oferece pouca coisa: três tipos primitivos, um tipo vazio, um `null` e um conjunto de operadores emprestado da família C. Pouca coisa, mas suficiente para escrever o próprio compilador, que usa exatamente esses recursos.

## Léxico: o que o lexer aceita

O lexer está em `bootstrap/src/Lex.snl` e é deliberadamente pequeno.

- **Identificadores**: começam com letra ASCII ou `_` e continuam com letras, dígitos ou `_` (`isIdentStart`, `isIdentCont`). Não há Unicode em identificadores.
- **Inteiros**: apenas dígitos decimais, **no máximo 18**. Um literal de 19 dígitos dá `SNV1001`, porque `lexNumber` para no 18º dígito para não estourar 64 bits durante a conversão. Não há hexadecimal: `0x10` é lido como `0` seguido do nome `x10` e falha com `SNV3001`.
- **Strings**: entre aspas duplas, na mesma linha, com escapes `\n`, `\t`, `\"` e `\\`.
- **Comentários**: `// até o fim da linha` e `/* bloco */`.
- **Anotações** como `@Native` são consumidas pelo lexer e não geram token. Um `@` sozinho é erro léxico.
- **Ponto e vírgula** é opcional.

```snova
package livro.comentarios

/* comentario de bloco
   em varias linhas */
func main(): int {
    // comentario de linha
    var a = 1; var b = 2;
    return a + /* no meio da expressao */ b
}
```
{% include exemplo.html arquivo="c03_comentarios.snl" modos="VM + nativo" cmd="snova-vm c03_comentarios.snl" nota="Status de saída: 3 nos dois modos." %}

### Palavras reservadas

Extraídas de `classify` (`Lex.snl`) e `classifyScope` (`ScopeParse.snl`):

`package` `import` `struct` `class` `interface` `trait` `enum` `func` `method` `public` `private` `static` `let` `var` `return` `if` `else` `while` `for` `in` `break` `continue` `match` `defer` `pulsar` `async` `await` `true` `false` `null`

`impl`, `implements` e `extends` são reconhecidos **pelo texto** em posições específicas. Fora delas, continuam sendo identificadores comuns. Palavras que o `snovac` reservava, como `const`, `try`, `catch`, `throw`, `this`, `new`, `as`, `is`, `protected` e `override`, **não** são palavras reservadas aqui. `this`, por exemplo, é um nome desconhecido e dá `SNV3001`.

## Tipos primitivos

| Tipo | Valores | Notas verificadas |
| --- | --- | --- |
| `int` | inteiro com sinal de 64 bits | aritmética com wrap-around (complemento de dois) |
| `bool` | `true`, `false` | `Console.printline` imprime `true`/`false` |
| `string` | sequência de bytes | igualdade por conteúdo (capítulo 5) |
| `unit` | ausência de valor | retorno de funções sem valor; impresso como linha vazia |
| `null` | — | impresso como `null`; `null == null` é `true` |

O parser reconhece só `int`, `bool` e `string` como nomes de tipo primitivo (`typeCode`, em `Parse.snl`), além dos nomes de `struct` e `class` declarados. `double`, `char`, `byte` e os outros tipos do `snovac` não existem aqui: `let d = 1.5` dá `SNV2001` e `'a'` dá `SNV1001` (capítulo 9).

### Por que só `int`?

Porque o compilador não precisou de mais nada para compilar a si mesmo. Ele representa o código-fonte como `int[]` (um byte por elemento), tokens como índices em arrays paralelos de `int`, e a imagem SnBC como `int[]`. Pelo ADR-0001, cada recurso entra quando uma geração do compilador precisa dele e a geração anterior consegue compilá-lo. Ponto flutuante nunca foi necessário, então ainda não entrou.

## `let` e `var`

```snova
package livro.variaveis

import builtin.io.console

func main(): int {
    let nome = "Snova"
    var contador: int = 1
    contador = contador + 1
    Console.printline(nome)
    Console.printline(contador)
    let x = 1
    if true {
        let x = 2
        Console.printline(x)
    }
    Console.printline(x)
    return contador
}
```
{% include exemplo.html arquivo="c03_variaveis.snl" modos="VM + nativo" cmd="snova-vm c03_variaveis.snl" %}

```text
Snova
2
2
1
```

O que o exemplo mostra:

- A anotação `: int` é opcional. Quando ela existe e o tipo do inicializador é conhecido, os dois precisam bater, senão sai `SNV4001` (capítulo 7).
- Um `let x` dentro de um bloco **sombreia** o `x` de fora sem alterá-lo. O escopo termina na `}`.

<div class="callout callout-warn">
  <span class="callout-title">Hoje, <code>let</code> não é imutável</span>
  Nas linguagens da família, <code>let</code> costuma significar "não reatribuível". No compilador atual, <code>let</code> e <code>var</code> geram o mesmo código, e o exemplo <code>c03_let_reatribuido.snl</code> (<code>let fixo = 1; fixo = 2; return fixo</code>) compila e retorna <code>2</code> nos dois backends. Use <code>let</code> para comunicar intenção, mas não conte com o compilador para garanti-la.
</div>

### Variável sem inicializador vale `unit`, não zero

```snova
package livro.seminicializador

import builtin.io.console

func main(): int {
    var total: int
    Console.printline(total)
    total = 10
    Console.printline(total)
    return total
}
```
{% include exemplo.html arquivo="c03_sem_inicializador.snl" modos="VM + nativo" cmd="snova-vm c03_sem_inicializador.snl" %}

```text

10
```

A primeira linha sai vazia: `total` vale `unit`, apesar da anotação `int`. Campos de `struct` e de `class` funcionam diferente: recebem valor padrão (`0`, `false`, `""`) quando o literal ou o construtor não os informa (capítulo 6). Em variáveis locais, **sempre inicialize**.

## Operadores

### Precedência

Tabela extraída de `infixBp` em `Parse.snl`, da menor para a maior precedência. Operadores na mesma linha associam à esquerda.

| Nível | Operadores |
| --- | --- |
| 1 | `=` (atribuição também é expressão) |
| 2 | `\|\|` |
| 3 | `&&` |
| 4 | `\|` |
| 5 | `^` |
| 6 | `&` |
| 7 | `==` `!=` |
| 8 | `<` `<=` `>` `>=` |
| 9 | `<<` `>>` |
| 10 | `+` `-` |
| 11 | `*` `/` `%` |
| prefixo | `-` `!` |

Não existem `+=`, `-=`, `++`, `--` nem o ternário `?:`. Os quatro dão `SNV2001`.

```snova
package livro.operadores

import builtin.io.console

func main(): int {
    Console.printline(2 + 3 * 4)
    Console.printline((2 + 3) * 4)
    Console.printline(17 / 5)
    Console.printline(17 % 5)
    Console.printline(-17 / 5)
    Console.printline(-17 % 5)
    Console.printline(6 & 3)
    Console.printline(6 | 3)
    Console.printline(6 ^ 3)
    Console.printline(1 << 10)
    Console.printline(-8 >> 1)
    Console.printline(!true)
    Console.printline(1 < 2 && 3 > 4)
    Console.printline(1 < 2 || 3 > 4)
    Console.printline(7 / 0)
    Console.printline(7 % 0)
    return 0
}
```
{% include exemplo.html arquivo="c03_operadores.snl" modos="VM + nativo" cmd="snova-vm c03_operadores.snl" %}

```text
14
20
3
2
-3
-2
2
7
5
1024
-4
false
false
true
0
0
```

Leitura dos resultados:

- **A divisão trunca em direção a zero**: `-17 / 5` dá `-3`, e o resto tem o sinal do dividendo (`-17 % 5` dá `-2`). É o mesmo comportamento de C e de AArch64 (`sdiv`).
- **`>>` é deslocamento aritmético**: `-8 >> 1` dá `-4`, preservando o sinal.
- **Divisão e resto por zero dão `0`**, sem erro, nos dois backends. A fixture `NativeCalls.snl` do projeto testa exatamente `7 / 0` e `7 % 0` e exige o mesmo status de saída no nativo, na VM em Snova e no `snl run-snbc`. Ou seja, é a semântica de referência do SnBC, e não um acidente de um dos backends. O preço é perder o erro: se o zero for um bug, ele passa em silêncio.
- **`&&` e `||` fazem curto-circuito.** `emitAnd` e `emitOr` (`Emit.snl`) emitem saltos condicionais, então o lado direito só é avaliado quando necessário.

### A armadilha de `&` contra `==`

Como em C, `==` tem precedência **maior** que `&`:

```snova
package livro.precedencia

import builtin.io.console

func main(): int {
    let x = 6
    Console.printline((x & 1) == 0)
    Console.printline(x & 1 == 0)
    return 0
}
```
{% include exemplo.html arquivo="c03_precedencia.snl" modos="VM + nativo" cmd="snova-vm c03_precedencia.snl" %}

```text
true
0
```

A segunda linha é `x & (1 == 0)`, ou seja `6 & false`. Nenhum dos backends reclama: o operador de bits trata `false` como `0`. **Coloque parênteses em toda mistura de operadores de bits com comparações.**

## Inteiros de 64 bits e overflow

```snova
package livro.inteiros

import builtin.io.console

func main(): int {
    let grande = 999999999999999999
    Console.printline(grande * 10)
    Console.printline(1 << 63)
    Console.printline((1 << 63) - 1)
    return 0
}
```
{% include exemplo.html arquivo="c03_inteiros.snl" modos="VM + nativo" cmd="snova-vm c03_inteiros.snl" %}

```text
-8446744073709551626
-9223372036854775808
9223372036854775807
```

O overflow dá a volta em complemento de dois, sem armadilha e sem aviso, de forma idêntica na VM e no nativo. `1 << 63` é o menor `int`, e subtrair 1 dele dá o maior. Isso funciona como receita para escrever os limites, já que o literal de 19 dígitos `9223372036854775807` é rejeitado pelo lexer.

## Controle de fluxo

```snova
package livro.controle

import builtin.io.console

func classificar(n: int): string {
    if n < 0 {
        return "negativo"
    } else if n == 0 {
        return "zero"
    } else {
        return "positivo"
    }
}

func main(): int {
    Console.printline(classificar(-3))
    Console.printline(classificar(0))
    Console.printline(classificar(8))
    var i = 0
    var soma = 0
    while true {
        i = i + 1
        if i > 10 { break }
        if i % 2 == 0 { continue }
        soma = soma + i
    }
    Console.printline(soma)
    return soma
}
```
{% include exemplo.html arquivo="c03_controle.snl" modos="VM + nativo" cmd="snova-vm c03_controle.snl" nota="Status de saída: 25." %}

```text
negativo
zero
positivo
25
```

- A condição do `if` e do `while` **não leva parênteses**. As chaves são obrigatórias.
- `break` e `continue` agem sobre o laço mais interno. Uma sonda com dois `while` aninhados, saindo do interno quando `j == 3`, contou `15` iterações nos dois backends, como esperado.
- `if` é instrução, não expressão. Para escolher um valor, use `match`.

## `match`

`match` é o único construtor de decisão que produz valor. Os braços são `padrão -> expressão`, separados por vírgula.

```snova
package livro.casamento

import builtin.io.console

func nome(n: int): string {
    return match n {
        0 -> "zero",
        1 -> "um",
        outro -> "muitos"
    }
}

func main(): int {
    Console.printline(nome(0))
    Console.printline(nome(1))
    Console.printline(nome(9))
    match 5 {
        5 -> Console.printline("cinco"),
        _ -> Console.printline("outro")
    }
    return 0
}
```
{% include exemplo.html arquivo="c03_match.snl" modos="VM + nativo" cmd="snova-vm c03_match.snl" %}

```text
zero
um
muitos
cinco
```

Padrões aceitos, conforme `scopeParsePattern` em `ScopeParse.snl`:

| Padrão | Exemplo | Funciona hoje |
| --- | --- | --- |
| literal inteiro | `0 -> …` | sim, VM e nativo |
| curinga | `_ -> …` | sim |
| ligação de nome | `outro -> …` (casa com tudo e liga o valor a `outro`) | sim |
| variante de `enum` | `Cor.Verde -> …` ou `Verde -> …` | compila, mas criar a variante já falha nos dois backends (capítulo 9) |

Cada braço é **uma expressão**, não um bloco. Os braços são testados na ordem do código.

### Quando nenhum braço casa

```snova
package livro.matchsembraco

func main(): int {
    let r = match 9 {
        1 -> 10,
        2 -> 20
    }
    return r
}
```
{% include exemplo.html arquivo="c03_match_sem_braco.snl" modos="VM + nativo" cmd="snova-vm c03_match_sem_braco.snl" %}

```text
runtime error: bodyless routine trapped
```

O status de saída é `70`. Um `match` usado como valor termina com a instrução SnBC 52, e os dois executores tratam essa instrução como armadilha. A mensagem é enganosa: diz "rotina sem corpo" quando o problema real é "nenhum braço casou". Melhorar esse texto é uma das sugestões do capítulo 7. Na prática, **termine todo `match` usado como valor com `_` ou com uma ligação de nome**.

## O que parecia insolúvel

Com inteiros, decisões e laços, você consegue escrever qualquer algoritmo, mas só dentro de `main`. Assim que o programa cresce, surgem as perguntas: como dividir o trabalho em partes, chamar uma parte de outra, chamar recursivamente e separar o código em vários arquivos? As três primeiras têm resposta direta. A última esbarra em um limite real do compilador, e o capítulo 4 explica por que esse limite existe.
