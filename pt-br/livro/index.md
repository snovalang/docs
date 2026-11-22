---
title: "Snova: a linguagem cataclisma"
description: Um livro do zero ao avançado sobre a Snova (Supernova language), escrito em cima do compilador atual em Snova, com cada exemplo verificado na VM e no backend nativo.
page_id: livro-capa
section_label: Livro
permalink: /pt-br/livro/
---

Uma supernova é o colapso de uma estrela que já não sustenta o próprio peso, seguido de uma explosão que espalha os elementos pesados de que planetas e pessoas são feitos. O nome da linguagem vem daí, e também o subtítulo deste livro: **a linguagem cataclisma**. O compilador da Snova passou por um colapso desse tipo. O `snovac`, escrito em C11, foi aposentado, e um compilador novo, escrito na própria Snova, nasceu dos restos dele.

Este livro ensina a programar em Snova **usando esse compilador novo**. Ele não descreve a linguagem que a Snova pretende ser um dia. Descreve a linguagem que o compilador aceita e executa hoje, e mostra o que ainda falta.

## Como ler

Cada capítulo termina com uma seção chamada **"O que parecia insolúvel"**. Ela registra o problema que o capítulo deixou sem resposta, e o capítulo seguinte começa por ele. Lidos em ordem, os capítulos formam uma única linha de raciocínio: do primeiro `main` até o compilador que compila a si mesmo.

Cada exemplo traz um destes rótulos:

| Rótulo | Significado |
| --- | --- |
| {% include status-badge.html status="works_today" %} | Compilado e executado pelo compilador atual, com a saída copiada da execução real. |
| {% include status-badge.html status="planned" %} | Sintaxe ou recurso que o compilador ainda não executa. O código serve de ilustração e o erro real aparece junto. |
| {% include status-badge.html status="legacy" %} | Comportamento do `snovac` aposentado. Vale só como referência histórica. |

Os exemplos executáveis estão em [`/exemplos/livro/`]({{ '/exemplos/livro/verificar.sh' | relative_url }}), junto do script `verificar.sh`, que repete todas as verificações na sua máquina.

## Sumário

1. [Apresentação e escopo]({{ '/pt-br/livro/01-apresentacao/' | relative_url }}): o que é o compilador novo, o que mudou em relação ao `snovac` e o que funciona em cada backend.
2. [Instalação e primeiros passos]({{ '/pt-br/livro/02-primeiros-passos/' | relative_url }}): construir o compilador e rodar o primeiro programa na VM e em código nativo.
3. [Fundamentos da linguagem]({{ '/pt-br/livro/03-fundamentos/' | relative_url }}): variáveis, inteiros, operadores, `if`, `while` e `match`.
4. [Funções e organização de código]({{ '/pt-br/livro/04-funcoes/' | relative_url }}): declarações, recursão, o limite de 256 quadros e por que ainda não existem imports entre arquivos.
5. [Strings e coleções]({{ '/pt-br/livro/05-strings-e-colecoes/' | relative_url }}): strings como bytes, arrays, arquivos, argumentos e ambiente.
6. [Tipos compostos e orientação a objetos]({{ '/pt-br/livro/06-tipos-compostos/' | relative_url }}): `struct`, `class`, métodos estáticos, interfaces, `trait` e `impl`.
7. [Diagnósticos e contratos de tipos]({{ '/pt-br/livro/07-diagnosticos/' | relative_url }}): todos os erros e avisos que o compilador emite, e os erros que ele ainda deixa passar.
8. [A VM e o backend nativo]({{ '/pt-br/livro/08-vm-e-nativo/' | relative_url }}): SnBC, AArch64, memória por ownership e a matriz de plataformas.
9. [Recursos planejados]({{ '/pt-br/livro/09-recursos-planejados/' | relative_url }}): generics, herança, imports, `for`, enums, `defer`, `async`, decimais.
10. [Arquitetura do compilador]({{ '/pt-br/livro/10-arquitetura/' | relative_url }}): lexer, parser, emissão de SnBC, VM, backend nativo e bootstrap.
11. [Desempenho e benchmarks]({{ '/pt-br/livro/11-desempenho/' | relative_url }}): método, máquina, números medidos e autocompilação.
12. [Histórico e compatibilidade]({{ '/pt-br/livro/12-historico/' | relative_url }}): o que o `snovac` documentava e como migrar.
13. [Apêndices]({{ '/pt-br/livro/13-apendices/' | relative_url }}): referência rápida, matriz de compatibilidade, glossário e índice de exemplos.

## Base factual

Tudo o que o livro afirma sobre o comportamento da linguagem foi checado de uma destas formas:

- **execução**: o exemplo foi compilado e rodado na VM em Snova e, quando possível, no backend nativo `aarch64-apple-darwin`;
- **leitura do código-fonte** do compilador (`bootstrap/src/*.snl`), sempre citando arquivo e função;
- **registro de evidências do projeto** (`docs/roadmap/evidence.md`), quando o fato depende de um ambiente que não foi reproduzido aqui, como o contêiner Linux. Nesses casos o texto diz isso.

Versão de referência: compilador `snova-bootstrap` da árvore de trabalho de **22/11/2026** (commit base `2fba2df` com alterações locais), construído por `make bootstrap-build` com a raiz transitória `snl v0.3.0`, em um Apple M1 com macOS 26.5.1.
