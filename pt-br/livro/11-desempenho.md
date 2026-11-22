---
title: "11. Desempenho e benchmarks"
description: Método, máquina e comandos de medição; tempos do backend nativo, da VM em Snova e do snl run-snbc; tempo de autocompilação; memória e tamanho de artefatos, todos como medições locais.
page_id: livro-11
section_label: "Livro · Capítulo 11"
permalink: /pt-br/livro/11-desempenho/
---

O capítulo 10 deixou duas perguntas: por que o compilador nativo é 2,7× mais rápido em uma tarefa e igual em outra, e quanto custam as escolhas de projeto do livro. Este capítulo responde com números. Antes deles, o aviso que vale para todos: **são medições locais, em uma máquina, em um dia**. Servem para comparar caminhos entre si, não como especificação de desempenho.

## Método

| Item | Valor |
| --- | --- |
| Máquina | Apple M1, macOS 26.5.1 |
| Compilador | `snova-bootstrap` da árvore de 22/11/2026, construído por `make bootstrap-build` |
| Raiz e oráculo | `snl v0.3.0` |
| Montador e ligador | `as`/`ld` da Apple, SDK 26.5 |
| Cronômetro | `/usr/bin/time -p` (tempo real); `/usr/bin/time -l` para RSS |
| Repetições | 5 execuções, reportando **mediana (mínimo–máximo)**; a VM em Snova, 3 execuções |
| Verificação | o status de saída do nativo e do `snl run-snbc` é comparado em todo benchmark |

Os três programas estão em `/exemplos/livro/` e exercitam coisas diferentes:

- **`c11_fib.snl`**: `fibonacci(27)` recursivo, que mede chamadas de função (635.621 chamadas, ou seja 2·F(28) − 1);
- **`c11_laco.snl`**: um `while` de 20 milhões de iterações com `%` e `+`, que mede o despacho de instruções simples;
- **`c11_alocacao.snl`**: 300 mil iterações, cada uma criando um array, fazendo um `push`, concatenando uma string e criando um objeto, o que mede o alocador e o ownership.

## Execução de programas

{% include exemplo.html arquivo="c11_fib.snl" modos="nativo, snl run-snbc e VM em Snova" cmd="/usr/bin/time -p ./c11_fib ; /usr/bin/time -p snl run-snbc c11_fib.snbc ; /usr/bin/time -p snova-bootstrap c11_fib.snbc run" %}

| Programa | Nativo (Snova) | `snl run-snbc` (VM em C) | VM em Snova | Status (nativo/oráculo) |
| --- | --- | --- | --- | --- |
| `c11_fib` | **0,02 s** (0,02–0,02) | 0,62 s (0,60–0,85) | 9,17 s (8,97–9,50) | 66 / 66 |
| `c11_laco` | **0,20 s** (0,19–0,30) | 1,68 s (1,46–1,82) | — | 253 / 253 |
| `c11_alocacao` | **0,31 s** (0,31–0,38) | 0,63 s (0,59–1,09) | — | 224 / 224 |

Como ler:

- **Chamadas:** o nativo é ~30× mais rápido que a VM em C e ~450× mais rápido que a VM em Snova. Uma chamada nativa é um `bl` com slots em memória. Na VM em C, é um quadro interpretado. Na VM em Snova, cada instrução do programa convidado custa dezenas de instruções SnBC, que por sua vez são interpretadas pela VM em C (capítulo 8).
- **Laço simples:** ~8× mais rápido. A diferença cai porque, sem alocação de registradores, cada operação do nativo ainda lê e grava slots de 16 bytes na pilha.
- **Alocação:** só 2× mais rápido. Aqui o nativo paga o que a VM em C não paga: contagem de donos, verificação de ciclos em `push` e cópia de bytes **byte a byte** na concatenação (o gargalo medido no capítulo 10).
- **A variação existe:** `c11_laco` no `snl run-snbc` deu 1,26 s em uma rodada anterior e mediana de 1,68 s nesta. Por isso a tabela traz mínimo e máximo.

## Compilação e autocompilação

Medido sobre o próprio compilador: 39 módulos juntados em `Compiler-joined.snl`, com 6.950 linhas.

| Tarefa | Quem compila | Tempo (mediana de 5) |
| --- | --- | --- |
| Construir o compilador (`make bootstrap-build`) | `snl v0.3.0` | 1,19 s |
| Compilar o próprio código-fonte para SnBC (modo sem argumentos) | bundle (`snova-bootstrap`) | 2,56 s |
| `Compiler-joined.snl` → SnBC | bundle | 2,32 s |
| `Compiler-joined.snl` → SnBC | **compilador nativo** | **0,86 s** |
| `Compiler-joined.snl` → assembly nativo | bundle | 5,00 s |
| `Compiler-joined.snl` → assembly nativo | compilador nativo | 5,02 s |
| Autocompilação completa pela **VM em Snova** (`make bootstrap-vm-self`) | VM em Snova sobre VM em C | **5 min 19 s** (1 execução) |

As duas imagens SnBC de `Compiler-joined.snl` (bundle e nativo) foram comparadas com `cmp` e são idênticas. O compilador nativo é o mesmo programa, só que mais rápido.

### Por que 2,7× em um caso e 1× no outro

A geração de SnBC é dominada pelo frontend: laços sobre arrays de `int`, comparações e chamadas, exatamente o que o nativo faz bem. A geração de assembly é dominada por **montar texto**. O perfil do capítulo 10 mostrou 64% do tempo em `Heap.copyBytes`, que copia um byte por iteração com duas chamadas de função. No bundle, o compilador roda como SnBC sobre a VM em C, e a concatenação é uma instrução (`ADD` de strings) executada pela própria VM, em C. Com isso, o ganho do frontend é anulado pelo custo da cópia. Copiar em palavras de 8 bytes é a otimização de maior retorno disponível hoje.

### A autocompilação pela VM em Snova ao longo do tempo

O registro de evidências mostra o custo de rodar o compilador sobre duas camadas de interpretação crescendo junto com o compilador:

| Data e estado | Tempo de `bootstrap-vm-self` | Fonte |
| --- | --- | --- |
| 21/11/2026, executor iniciante | 3 min 08 s | `evidence.md` |
| 21/11/2026, com o backend N2 nos fontes | 4 min 54 s | `evidence.md` |
| 22/11/2026, árvore atual | 5 min 19 s | medido neste livro |

Contra ~1 s do bundle. A VM em Snova nunca foi feita para velocidade: ela é o **oráculo diferencial** que prova que o compilador se executa corretamente em uma VM escrita na própria linguagem.

## Memória

### Programas

| Programa (nativo) | Trabalho | Pico vivo | RSS máximo | Blocos vivos ao sair |
| --- | --- | --- | --- | --- |
| `c08_memoria` | 20 mil → 640 mil iterações | 576 B, constante | 1.458.176 B, constante | 0 |
| Fixture `NativeMemory` | 20 mil → 640 mil iterações | 1.088 B, constante | 1.458.176 B, constante | 0 |
| `c05_runtime` (E/S de arquivos) | — | 81.952 B (buffers de leitura) | — | 0 |

O pico do `NativeMemory` (1.088 bytes) é o mesmo que o ADR-0006 registrou quando o runtime N2 foi introduzido. Em 22/11/2026, o critério de memória constante continua valendo.

### O compilador

| Medida | Valor |
| --- | --- |
| RSS máximo do compilador nativo gerando o próprio assembly | 68.943.872 B (~66 MiB) |

## Tamanho dos artefatos

| Artefato | Tamanho |
| --- | --- |
| `c02_ola` em SnBC | 83 B |
| `c02_ola` em assembly | 20.307 linhas |
| `c02_ola` em executável Mach-O | 102.112 B |
| Compilador em SnBC (`stage1.snbc`) | 164.151 B |
| Compilador em assembly | 482.203 linhas |
| Compilador em executável nativo | 1.750.456 B |
| `snova-bootstrap` (SnBC + VM em C do `snl`) | 270.592 B |

O executável nativo do "olá" pesa 100 KB porque **todo** o runtime vai junto, mesmo o que não é usado. Eliminar código morto é uma das propostas do ADR-0006.

## O que as escolhas custaram

| Escolha | Ganho | Custo medido |
| --- | --- | --- |
| VM iterativa com limite de 256 quadros | mesma semântica em todo executor; independe da pilha do hospedeiro | recursão profunda precisa virar laço (capítulo 4) |
| Slots de 16 bytes com etiqueta | backend simples, que espelha a VM | 8× (laço) em vez dos 30× vistos nas chamadas |
| Ownership sem coletor | memória constante e zero vazamento comprovado | 2× no teste de alocação; ciclos proibidos |
| Runtime em Snova, fronteira de 7 funções | portabilidade e auditoria (ADR-0003) | cópia byte a byte: 64% do tempo da geração de assembly |
| VM em Snova como oráculo | prova de que o compilador roda na própria linguagem | 450× mais lenta que o nativo |

## Como reproduzir

```sh
# no repositório do compilador
cd "$SNOVA_REPO" && make bootstrap-build

# na pasta dos exemplos do livro (repositório da documentação)
SNOVA_REPO="$SNOVA_REPO" sh exemplos/livro/verificar.sh 'c11_*'    # gera .snbc e executáveis em exemplos/livro/.saida
/usr/bin/time -p exemplos/livro/.saida/c11_fib.native
/usr/bin/time -p snl run-snbc exemplos/livro/.saida/c11_fib.snbc

# de volta ao repositório do compilador
cd "$SNOVA_REPO"
make bootstrap-vm-self       # autocompilação pela VM em Snova (minutos)
make bootstrap-native-self   # ponto fixo nativo
```

## O que parecia insolúvel

Os números mostram onde a Snova nova está. Fica a pergunta de quem vem do `snovac`: o que acontece com o código e a documentação antigos? O capítulo 12 compara as duas linguagens recurso a recurso e traça o caminho de migração.
