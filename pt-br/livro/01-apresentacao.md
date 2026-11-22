---
title: "1. Apresentação e escopo"
description: O que é o compilador da Snova escrito em Snova, como ele se diferencia do snovac aposentado e o que funciona hoje na VM e no backend nativo.
page_id: livro-01
section_label: "Livro · Capítulo 1"
permalink: /pt-br/livro/01-apresentacao/
---

## Para quem é este livro

Para quem quer escrever programas em Snova e entender por que a linguagem é como é. Não é preciso saber nada de compiladores para os capítulos 1 a 7. Do 8 em diante o livro desce para a máquina: bytecode, assembly AArch64, ownership e bootstrap. Experiência com alguma linguagem de chaves (C, Java, Go, Rust, Kotlin, TypeScript) ajuda, mas não é obrigatória.

## O colapso: dois compiladores

A Snova teve dois compiladores, e a diferença entre eles explica quase todas as escolhas deste livro.

| | `snovac` (legado) | Compilador em Snova (atual) |
| --- | --- | --- |
| Linguagem de implementação | ISO C11 | Snova |
| Situação | Toolchain que será privado; serve de raiz transitória e de oráculo | Único produto público do projeto |
| Onde fica | repositório `snovac` | repositório `snovalang`, em `bootstrap/src/`, `bootstrap/runtime/` e `bootstrap/library/` |
| Tamanho | — | 8.382 linhas de Snova (contadas com `wc -l` em 22/11/2026) |
| Autocompilação | — | Compila a si mesmo até um ponto fixo de bytes, em SnBC e em assembly nativo |

O compilador atual nasceu de um princípio que o repositório repete em toda parte: **cada compilador compila o próximo**. A primeira geração foi construída pelo `snl v0.3.0` instalado, que é o `snovac`. Daí em diante, cada nova versão precisa ser aceita pela versão anterior. Isso tem uma consequência prática que você vai sentir ao longo do livro: a linguagem só ganha um recurso quando o compilador anterior já consegue compilar o código que o implementa. Por isso a Snova de hoje é menor do que a Snova documentada para o `snovac`. Ela é o **subconjunto que o compilador já sabe compilar em si mesmo**, e cresce em degraus (ADR-0001, "cumulative subsets").

<div class="callout callout-warn">
  <span class="callout-title">As páginas de referência antigas</span>
  As páginas fora deste livro, como "Especificação da Linguagem" e "Sistema de Tipos e Genéricos", descrevem o <code>snovac</code>. Neste livro elas contam como {% include status-badge.html status="legacy" %}. Generics, <code>try</code>/<code>catch</code>, <code>decimal</code> e o sistema de pacotes descritos lá <strong>não</strong> funcionam no compilador atual. O capítulo 12 compara as duas linguagens ponto a ponto.
</div>

## Três maneiras de executar o mesmo programa

O compilador atual entrega o programa por três caminhos. O capítulo 8 trata de cada um em detalhe:

1. **SnBC + VM em Snova.** O compilador gera uma imagem de bytecode `.snbc` e a executa com o executor escrito em Snova (`bootstrap/src/Vm*.snl`).
2. **Backend nativo.** O compilador traduz a mesma imagem SnBC para assembly AArch64, e o `as`/`ld` do sistema produzem um executável Mach-O ligado só à `libSystem`. O runtime desse executável (heap, strings, arrays, ownership) também é Snova, em `bootstrap/runtime/`.
3. **`snl run-snbc`.** É a VM em C do `snovac`. Serve de oráculo para comparar resultados, não como caminho de distribuição.

## O que funciona hoje

A tabela abaixo é o resumo das sondas executadas para este livro. Cada linha corresponde a pelo menos um programa compilado e rodado nos dois backends. Os capítulos mostram o código e a saída.

| Recurso | Compila | VM em Snova | Nativo AArch64 Darwin | Capítulo |
| --- | --- | --- | --- | --- |
| `int` de 64 bits, `bool`, `string`, `null` | sim | sim | sim | 3 |
| `let`, `var`, anotação de tipo, sombreamento | sim | sim | sim | 3 |
| Operadores aritméticos, de bits, comparação, `&&`/`\|\|` | sim | sim | sim | 3 |
| `if`/`else if`/`else`, `while`, `break`, `continue` | sim | sim | sim | 3 |
| `match` sobre inteiros, `_` e ligação de nome | sim | sim | sim | 3 |
| Funções, recursão, corpo de expressão `= expr` | sim | sim | sim | 4 |
| Strings: `+`, `==` por conteúdo, escapes | sim | sim | sim | 5 |
| Arrays: literal, índice, `push`, `pop`, `len`, `==` | sim | sim | sim | 5 |
| Arquivos, argumentos, ambiente (`Runtime.*`, `read_bytes`) | sim | sim | sim | 5 |
| `struct` com literal e valores padrão | sim | sim | sim | 6 |
| `class` com construtor posicional e métodos | sim | sim | sim | 6 |
| Métodos `static` | sim | sim | sim | 6 |
| `interface`/`implements`, `trait`/`impl` com despacho dinâmico | sim | **parcial** (bug de busca, cap. 6) | sim | 6 |
| Rejeição de ciclos fortes de referência | sim | não (a VM aceita o ciclo) | sim | 8 |
| `for … in` | sim | não (opcode 56) | não | 9 |
| `enum` | sim | não (opcode 42) | não | 9 |
| `defer`, `pulsar`, `async`/`await` | sim | não (opcodes 53–55) | não | 9 |
| Atribuição por índice `a[i] = v` | não (`SNV3001`) | — | — | 9 |
| Generics, herança, `+=`, ternário, `double`, `char` | não | — | — | 9 |

"Compila" quer dizer que o compilador produz uma imagem SnBC válida. Isso não garante que algum backend saiba executá-la. `for`, `enum`, `defer`, `pulsar` e `async` passam pelo parser e pela emissão, mas os dois executores param com `unsupported opcode`. Essa diferença entre aceitar e executar é a primeira lição do livro: **um recurso só está pronto quando a VM e o backend nativo concordam sobre ele**.

## O que parecia insolúvel

Uma linguagem cujo compilador está escrito nela mesma levanta uma pergunta óbvia: como se compila o primeiro compilador? E como você, leitor, obtém um compilador para começar? O capítulo 2 responde de forma prática, com a raiz transitória `snl`, o comando `make bootstrap-build` e o primeiro programa rodando nos dois backends.
