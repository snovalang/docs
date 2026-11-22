---
title: "7. Diagnósticos e contratos de tipos"
description: Catálogo completo dos erros e avisos do compilador atual (SNV1001 a SNV5001, SNW0001), erros de execução, códigos de saída e os erros que o compilador ainda não detecta.
page_id: livro-07
section_label: "Livro · Capítulo 7"
permalink: /pt-br/livro/07-diagnosticos/
---

O capítulo 6 terminou com um compilador que às vezes rejeita sem explicar e às vezes aceita o que não devia. Este capítulo faz o inventário: o que cada mensagem quer dizer, de qual fase ela vem e, igualmente importante, o que passa sem mensagem nenhuma.

## Onde as mensagens aparecem

Tudo verificado redirecionando um fluxo de cada vez:

| Saída | Fluxo | Código de saída |
| --- | --- | --- |
| Erros de compilação (`error[SNV…]`) | **stdout** | 1 |
| Avisos (`warning[SNW…]`) | stdout | 0 (a compilação continua) |
| Erros de execução (`runtime error: …`) | stdout, na VM e no nativo | 70 |
| `error: cannot read '…'` (arquivo de entrada ausente) | stderr | 1 |
| Relatório de memória do nativo (`SNOVA_MEMORY_REPORT=1`) | stderr | — |

Erros em stdout são uma consequência do bootstrap: o subconjunto da linguagem usado pela semente não escrevia em stderr, e o ADR-0004 registra isso como divergência intencional. Para separar diagnóstico de saída do programa em scripts, use o código de saída, não o fluxo.

## O compilador para no primeiro erro

`compileSource` (`Compiler.snl`) executa as fases em sequência (lexer, parser e validação de contratos, emissão) e retorna na primeira falha. `fail` registra apenas o **primeiro** erro (`if cx.failed == 0`). Você sempre verá uma mensagem por compilação. Avisos só são impressos se a compilação chegar ao fim.

## Catálogo de erros

### `SNV1001`: erro léxico

```snova
package livro.erros

func main(): int {
    let c = 'a'
    return 0
}
```
{% include exemplo.html arquivo="c07_snv1001.snl" modos="compilação" cmd="snova-bootstrap c07_snv1001.snl x.snbc" %}

```text
error[SNV1001]: lexical error at line 4, span 40..55
```

O *span* cobre **a linha inteira** (bytes 40 a 55), não o caractere culpado. `reportFailure` calcula o início e o fim da linha do erro. Causas: caractere fora do alfabeto (`'`, `@` sozinho, `$`…), string sem fechar ou com quebra de linha, comentário de bloco sem fechar, inteiro com mais de 18 dígitos.

### `SNV2001`: erro de sintaxe

```snova
func main(): int {
    var x = 1
    x += 2
    return x
}
```
{% include exemplo.html arquivo="c07_snv2001.snl" modos="compilação" cmd="snova-bootstrap c07_snv2001.snl x.snbc" %}

```text
error[SNV2001]: parse error at line 5, span 61..62
```

Aqui o span é o do **token** onde o parser parou, neste caso o `=` de `+=`, já que `+` foi aceito como operador binário e o `=` não pode começar uma expressão. No fim do arquivo, o span tem largura zero (`59..59` na fixture `InvalidParse.snl`, que esquece de fechar uma chave).

### `SNV3001`: construção não suportada ou geração inválida

```snova
func main(): int {
    return naoExiste
}
```
{% include exemplo.html arquivo="c07_snv3001.snl" modos="compilação" cmd="snova-bootstrap c07_snv3001.snl x.snbc" %}

```text
error[SNV3001]: unsupported construct or invalid lowering at line 5, function #0
```

É a mensagem mais genérica e a mais comum. Ela vem da fase de emissão (`cx.phase = 3`) e reúne tudo o que o emissor não sabe traduzir:

| Causa verificada | Capítulo |
| --- | --- |
| Nome de variável ou função inexistente | 4 |
| Acesso a campo em expressão de tipo desconhecido (retorno de função, elemento de array) | 6 |
| Método chamado em receptor que é campo | 6 |
| Método com nome de builtin (`get`, `push`…) | 6 |
| `Tipo.metodoDeInstancia()` ou `objeto.metodoEstatico()` | 6 |
| `this`, literal `Classe { … }`, herança (`extends`) | 6, 9 |
| Atribuição por índice `a[i] = v` | 9 |
| Literal hexadecimal (`0x10`) | 3 |

Duas limitações da mensagem, ambas documentadas no projeto ("lowering span is not yet exact"):

- **A linha é aproximada.** Em geral ela aponta para o fim da função que falhou, e não para a expressão. Nas sondas, `return naoExiste` na linha 4 foi reportado na linha 5, o `}`.
- **`function #N` é a posição da função na ordem de declaração**, começando em 0. Não é uma identidade estável. No modo `native`, a linha sai deslocada em centenas (`line 821` para o mesmo programa), porque o runtime Snova é anexado ao programa antes da compilação.

### `SNV4001`, `SNV4002` e `SNV4003`: incompatibilidade de tipos

```snova
let resposta: string = 42          // SNV4001
```
```text
error[SNV4001]: annotation type does not match initializer at line 4, span 48..49
```

```snova
var resposta = 42
resposta = "errado"                // SNV4002
```
```text
error[SNV4002]: assignment type does not match local binding at line 5, span 66..67
```

```snova
let c = Caixa { valor: 1 }
c.valor = "errado"                 // SNV4003
```
```text
error[SNV4003]: assignment type does not match field at line 9, span 121..122
```
{% include exemplo.html arquivo="c07_snv4001.snl" modos="compilação" nota="Também <code>c07_snv4002.snl</code> e <code>c07_snv4003.snl</code>. As três mensagens acima foram copiadas das execuções." %}

Os três só disparam quando **os dois lados têm tipo conhecido** e os tipos são diferentes. O span tem **um byte** (`início..início+1`) e aponta para o identificador da variável ou do campo. A comparação é por igualdade de código de tipo, sem subtipagem, e é por isso que `let f: Forma = Quadrado(3)` também dá `SNV4001` (capítulo 6).

### `SNV5001`: contrato não satisfeito

```snova
interface Arquitetura {
    method bits(): int
}

class Desconhecida implements Arquitetura {
}
```
{% include exemplo.html arquivo="c07_snv5001.snl" modos="compilação" cmd="snova-bootstrap c07_snv5001.snl x.snbc" %}

```text
error[SNV5001]: type does not satisfy declared contract at line 4, span 56..60
```

O span `56..60` é a palavra `bits` **na declaração da interface**, não na classe: o compilador aponta qual requisito ficou sem atender. `scopeValidateImplementations` (`ScopeParse.snl`) exige, para cada método do contrato, um método na classe com o mesmo nome, mesma aridade, mesmos tipos de parâmetro e mesmo tipo de retorno, e não aceita métodos `static` como implementação. As fixtures do projeto cobrem método ausente, tipo de parâmetro errado e aridade errada, tanto para `implements` quanto para `impl … for`.

### Aviso `SNW0001`: comparação entre tipos diferentes

```snova
let nome = "sete"
if nome == 7 { return 1 }
```
{% include exemplo.html arquivo="c07_snw0001.snl" modos="VM + nativo" cmd="snova-bootstrap c07_snw0001.snl x.snbc" %}

```text
warning[SNW0001]: comparison between different types at line 5
```

O programa continua compilando e retorna 0. O aviso dispara em `==` ou `!=` quando os dois tipos estáticos são conhecidos e diferentes (string com int, struct com int, bool com int).

### Erro sem código: `invalid generated SnBC image`

```snova
func somar(a: int, b: int): int { return a + b }

func main(): int {
    return somar(1)
}
```
{% include exemplo.html arquivo="c07_aridade.snl" modos="compilação" nota="Saída: <code>invalid generated SnBC image</code>, status 1." %}

O frontend aceita a chamada, e o **validador de imagem** (`validateCode`, `ImageCode.snl`) a rejeita porque a aridade do `CALL` não bate. É uma rede de segurança e não um diagnóstico: a mensagem não diz linha nem função.

## Catálogo de erros de execução

Todos terminam com status 70 e aparecem iguais na VM e no nativo, exceto onde indicado:

| Mensagem | Causa | Onde |
| --- | --- | --- |
| `runtime error: Stack overflow` | mais de 256 quadros de chamada | ambos |
| `runtime error: pop from empty array` | `pop()` em array vazio | ambos |
| `runtime error: operand type mismatch for opcode N` | operação com tipos incompatíveis: `"a" + 1` (12), `"a" < "b"` (26), `"abc".len()` (49) | ambos |
| `runtime error: bodyless routine trapped` | nenhum braço de `match` casou (opcode 52) | ambos |
| `runtime error: unsupported opcode N` | recurso que compila mas não executa (42, 53–56) | VM |
| `unsupported opcode for native backend: N` | o mesmo, detectado **na compilação** nativa (status 1) | nativo |
| `runtime error: method not found for concrete type N` | despacho de interface sem alvo (inclui o bug do capítulo 6) | VM |
| `runtime error: strong reference cycle rejected for opcode 50` | um `push` ou atribuição de campo fecharia um ciclo de referências | só nativo (capítulo 8) |
| `runtime error: out of memory` | falha de `mmap` | só nativo (ADR-0006) |

## O que o compilador ainda deixa passar

Este é o inventário mais útil do capítulo. Cada linha foi testada e **compila sem erro nem aviso**:

| Erro não detectado | Comportamento observado |
| --- | --- |
| Argumento de tipo errado: `dobro("x")` com `n: int` | compila; falha (ou não) na execução |
| Retorno de tipo errado: `return "texto"` em `: int` | compila e retorna a string |
| `"n=" + dobro(2)` | compila; falha na execução, opcode 12 |
| Função `: int` sem `return` | devolve `unit` |
| `return` com a expressão na linha seguinte | devolve `unit` |
| Variável local sem inicializador | vale `unit` |
| Reatribuição de `let` | permitida |
| Acesso a membro `private` de fora da classe | permitido |
| Índice fora dos limites | devolve `unit` |
| Elemento de tipo errado em array anotado: `var xs: int[] = ["a"]` | compila (o tipo do elemento não é registrado) |
| Tipos de parâmetro de `Runtime.*`, `write_bytes` | não verificados |
| `x & 1 == 0` | lido como `x & (1 == 0)`, sem aviso |

Exemplo combinado, com dois desses erros:

```snova
package livro.erros

import builtin.io.console

func dobro(n: int): int { return n * 2 }

func texto(): int {
    return "nao sou int"
}

func main(): int {
    Console.printline(texto())
    Console.printline("n=" + dobro(2))
    return 0
}
```
{% include exemplo.html arquivo="c07_nao_detectado.snl" modos="VM + nativo" cmd="snova-vm c07_nao_detectado.snl" %}

```text
nao sou int
runtime error: operand type mismatch for opcode 12
```

A causa comum está na forma como o frontend guarda tipos. Cada expressão deixa um único inteiro em `cx.expr_ty`: negativo para primitivo (`-1` int, `-2` bool, `-3` string), positivo para `struct`/`class`, e **0 para desconhecido**. Uma chamada de função sempre zera esse valor, e um array sempre tem tipo 0. Toda verificação começa com "se os dois lados forem conhecidos…", e por isso grande parte do programa escapa. O plano de maturidade descreve a solução: resolução de nomes e verificação de tipos explícitas, com compatibilidade completa e diagnósticos estáveis.

## Melhorias propostas para os diagnósticos

Em ordem de impacto para quem escreve Snova hoje:

1. **Propagar o tipo de retorno das funções** (`fn_return_ty` já é registrado em `parseFunc`). Só isso eliminaria a necessidade de anotar `let p: Ponto = criar()` e passaria a detectar retornos de tipo errado.
2. **Registrar o tipo do elemento de arrays.** `parseType` descarta o tipo ao encontrar `[]` e retorna 0. Guardá-lo resolveria `xs[i].campo` e `var xs: int[] = ["a"]`.
3. **Comparar tipos de argumentos com os de parâmetros** nas chamadas diretas, usando os mesmos `par_ty` que o `SNV5001` já compara para contratos.
4. **Separar o `SNV3001` em códigos específicos**: nome desconhecido, membro desconhecido, receptor não suportado, nome reservado de builtin. A fase e o ponto de falha já são conhecidos em cada `fail(cx)`.
5. **Trocar `bodyless routine trapped` por `no match arm matched`** quando a armadilha vem do epílogo de um `match`.
6. **Corrigir a ordem em `vmCompareMethodName`** (capítulo 6).
7. **Apontar a linha certa no `SNV3001`**, guardando a linha do nó que falhou, e no modo `native` descontar as linhas do runtime anexado.

## O que parecia insolúvel

Até aqui, a VM e o nativo foram tratados como dois nomes para a mesma coisa, e quase sempre deram a mesma saída. Mas no capítulo 6 eles divergiram no despacho de interface, e a tabela acima traz um erro que só o nativo emite: ciclo de referência rejeitado. Por que dois backends de um mesmo compilador discordam? E como um executável sem coletor de lixo libera memória? O capítulo 8 abre os dois backends.
