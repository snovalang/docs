---
title: "12. Histórico e compatibilidade"
description: O que o snovac legado documentava, recurso a recurso, e como isso se compara ao compilador atual em Snova, com orientações de migração.
page_id: livro-12
section_label: "Livro · Capítulo 12"
permalink: /pt-br/livro/12-historico/
---

O capítulo 11 mediu a Snova nova. Quem vem do `snovac` precisa ainda de um mapa: o que existia, o que mudou e o que reescrever. Este capítulo é esse mapa. Tudo o que está marcado como legado vem das páginas de referência deste site, que descrevem o `snovac` ([Especificação]({{ '/pt-br/language-specification/' | relative_url }}), [Tipos]({{ '/pt-br/type-system/' | relative_url }}), [Memória e Erros]({{ '/pt-br/memory-and-errors/' | relative_url }}), [Concorrência]({{ '/pt-br/concurrency/' | relative_url }}), [Biblioteca]({{ '/pt-br/builtin-library/' | relative_url }}), [CLI]({{ '/pt-br/cli-and-tooling/' | relative_url }})). A coluna do compilador atual vem das sondas deste livro.

## A história em três atos

1. **O `snovac`**: compilador em ISO C11, com interpretador por árvore (`snl run`), bytecode SnBC (`emit-snbc`/`run-snbc`), executáveis que embutem a VM em C (`snl build`), biblioteca `builtin/` extensa, servidor de linguagem `snova-lsp` e extensões para VS Code, JetBrains e Zed.
2. **O colapso**: o projeto decide que o único produto público será um compilador escrito em Snova, e que C/C++ não serão uma implementação paralela (`docs/roadmap/subset.md`, "Implementation rule"). O `snovac` passa a ser raiz transitória e oráculo, e será privado.
3. **A nova estrela**: em 21/11/2026, uma semente em Snova compila a si mesma até um ponto fixo em SnBC. No mesmo dia chegam a VM em Snova, o backend nativo N1 (numérico), o N2 (runtime com ownership) e o N3 (compilador nativo com ponto fixo de assembly). Em 22/11/2026, Linux AArch64 em contêiner. Cada passo está datado em `docs/roadmap/evidence.md`.

## Comparação recurso a recurso

{% include exemplo.html status="legacy" nota="A coluna <code>snovac</code> resume a documentação legada. Ela não foi reexecutada para este livro." %}

| Recurso | `snovac` (legado) | Compilador atual |
| --- | --- | --- |
| Tipos numéricos | `int`, `int8`…`int128`, `long`, `float`, `double`, `decimal`, `byte`, `char` | só `int` (64 bits) |
| Conversões | sem implícitas; `as` para alargar; estreitar é sempre erro (`SNOVA0145`) | não há `as`; só existe `int` |
| Literais | `0xFF`, `42L`, `1.5`, `1e9`, `1.5d`, `'a'`, `"${x}"` | decimais de até 18 dígitos; strings com escapes simples; sem interpolação |
| `string` | concatenação de `char`; `s[i]` devolve `char`; `.toString()` | bytes; `+` e `==`; sem índice nem tamanho |
| Igualdade de strings no `snl v0.3.0` | por identidade no executor (`"ab" + "c" == "abc"` dá `false`) | **por conteúdo** (`true`) |
| `[]` sem tipo | erro `SNOVA0100` | aceito |
| Opcionais | `T?`, `?.`, `??` (`SNOVA0200`–`0204`) | `T?` aceito e ignorado; sem `?.` nem `??` |
| Referências | `&T`, `&T?` com borrow checker (`SNOVA0240`–`0251`) | `&T` aceito e ignorado; ownership dinâmico no nativo |
| Generics | declarados; restrições e substituição parciais | não existem |
| Classes | `protected`, `override`, `abstract`, `constructor(...)`, herança via `:`/`extends` | construtor posicional, `static`; herança ignorada; `private` não aplicado |
| Enums e `match` | com payload e padrões | `match` sobre inteiros funciona; enums compilam e não executam |
| Interfaces e traits | interfaces, traits como apelido, extensões, `type` | `interface`, `trait` + `impl` com despacho dinâmico (opcode 59) |
| `defer` | completo no interpretador | compila; não executa |
| `try`/`catch`/`finally` | só no interpretador; recusado em SnBC/nativo (`SNOVA0400`) | não existe |
| `async`/`await`, `pulsar`, canais | parciais; vários apenas no interpretador | compilam; não executam |
| Pacotes e imports | grafo de pacotes, manifestos `mod.sns`/`snova.toml`, dependências em `.snovalang/deps/` | `import` ignorado; um arquivo por compilação |
| Biblioteca | `builtin/` (coleções, `Option`/`Result`, erros, arquivos, rede, HTTP, tempo, concorrência…) | `Console`, `Runtime.*`, `read_bytes`/`write_bytes`; `bootstrap/library/` com 6 estruturas |
| Execução | interpretador, SnBC, executável com VM embutida | VM em Snova, **nativo AArch64 sem VM** |
| Diagnósticos | `SNOVA0xxx`, centenas de códigos | `SNV1001`, `SNV2001`, `SNV3001`, `SNV4001`–`4003`, `SNV5001`, `SNW0001` |
| CLI | `snl check/run/build/emit-snbc/run-snbc/get/tidy`, `--emit=tokens/ast` | `snova-bootstrap` com 4 modos posicionais |
| Ferramentas | `snova-lsp`, extensões de editor | não há para o compilador novo |

## O que o compilador novo fez melhor

A tabela favorece o `snovac` em amplitude, mas em quatro pontos o compilador novo vai além do antigo:

1. **Código de máquina de verdade.** O `snl build` empacotava SnBC com a VM em C; o profile era dominado por `run_function` (ADR-0005). O backend novo emite AArch64 do programa e do runtime, ligado só à `libSystem`.
2. **Memória determinística comprovada.** O relatório `SNOVA_MEMORY_REPORT` e a meta de "zero blocos vivos, pico constante" são portões automáticos (capítulo 8).
3. **Despacho de interface em bytecode e em nativo.** O emissor SnBC do `snovac` recusa chamadas por interface (`SNOVA0400: cannot lower call to SnBC`). O compilador novo as executa nos dois backends, com o bug da VM descrito no capítulo 6.
4. **Autocompilação com evidência.** Pontos fixos em SnBC e em assembly, com hashes registrados e com a distinção entre bootstrap, determinismo, reprodutibilidade e DDC (ADR-0002).

## Migrando código do `snovac`

Uma lista de verificação, em ordem. Cada item cita o capítulo onde o comportamento atual foi verificado:

1. **Junte os arquivos** em uma unidade e remova `package`/`import` dos arquivos adicionais (capítulo 4). Evite palavras reservadas nos segmentos de `package`.
2. **Troque os tipos numéricos por `int`.** Código com `double`/`decimal` não tem tradução direta.
3. **Remova interpolação**: `"n=${n}"` vira `Console.print("n="); Console.printline(n)`.
4. **Substitua `for … in`** por `while` com índice (capítulos 5 e 9).
5. **Substitua `a[i] = v`** por um array de células com campo mutável, como faz `IntCell` (capítulo 9).
6. **Remova `try`/`catch`**: retorne um código ou um `bool` e trate na chamada.
7. **Troque `this.x` por `x`** e `Classe { … }` por `Classe(...)` (capítulo 6).
8. **Anote o tipo** de toda variável que recebe retorno de função ou elemento de array e depois acessa um campo (capítulo 6).
9. **Renomeie métodos** chamados `get`, `push`, `pop`, `len`, `length` ou `print*` (capítulo 6).
10. **Acesse colaboradores guardados em campos por uma local** (`let m: Motor = motor`) (capítulo 6).
11. **Não dependa de herança.** Use interfaces ou composição.
12. **Teste nos dois backends** e compare a saída: VM e nativo divergem em ciclos e, hoje, no despacho por interface.

## Códigos de diagnóstico: o que mudou de nome

O compilador novo não reaproveita a numeração `SNOVA0xxx`. Os códigos novos seguem a fase: `1` léxico, `2` sintaxe, `3` emissão, `4` tipos, `5` contratos, e `W` para avisos. Por isso não existe tabela de equivalência um para um. A semântica mais próxima:

| Antigo (legado) | Novo |
| --- | --- |
| erros de lexer | `SNV1001` |
| erros de parser | `SNV2001` |
| incompatibilidade de tipo em `let`/atribuição | `SNV4001`, `SNV4002`, `SNV4003` |
| `SNOVA0400` (não é possível gerar SnBC) | `SNV3001` (construção não suportada) |
| conformidade de interface | `SNV5001` |

## O que parecia insolúvel

Doze capítulos depois, a Snova atual cabe em poucas páginas de referência, mas espalhadas pelo livro inteiro. O capítulo 13 junta tudo em consulta rápida: sintaxe implementada, matriz de compatibilidade, opcodes, glossário e o índice de todos os exemplos verificados.
