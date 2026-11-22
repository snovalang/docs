---
title: "2. Instalação e primeiros passos"
description: Como obter o compilador da Snova escrito em Snova, a raiz transitória snl, os modos da linha de comando e o primeiro programa na VM e em código nativo.
page_id: livro-02
section_label: "Livro · Capítulo 2"
permalink: /pt-br/livro/02-primeiros-passos/
---

O capítulo anterior terminou com uma pergunta: se o compilador está escrito em Snova, quem compila o primeiro? Hoje a resposta é o `snl v0.3.0`, o executável do `snovac`. Ele é a **raiz transitória**: compila uma vez o código-fonte do compilador novo e, dali em diante, o compilador novo passa a compilar a si mesmo (capítulo 10). Para você, isso significa dois passos: instalar o `snl` e construir o compilador.

## Requisitos verificados

| Item | Versão usada neste livro | Para quê |
| --- | --- | --- |
| `snl` | `v0.3.0` | Construir a primeira geração do compilador (`make bootstrap-build`) |
| GNU `make` | o do sistema | Rodar as metas do `Makefile` |
| `as` e `ld` da Apple (Command Line Tools) | SDK 26.5 | Montar e ligar a saída do backend nativo |
| Máquina | Apple M1, macOS 26.5.1 | Único alvo nativo qualificado localmente: `aarch64-apple-darwin` |

Em Linux, a VM funciona, e o backend nativo para `aarch64-unknown-linux-gnu` foi validado pelo projeto em contêiner Docker (capítulo 8). Este livro não reproduziu esse ambiente.

## 1. Instalar a raiz transitória `snl`

{% include exemplo.html status="legacy" nota="O instalador pertence ao <code>snovac</code>, que será privado. Este passo vale enquanto o <code>snl</code> for a raiz transitória do bootstrap." %}

```sh
curl -fsSL https://raw.githubusercontent.com/snovalang/snovac/master/install.sh | sh
snl --version     # esperado: snl v0.3.0
```

<div class="callout callout-warn">
  <span class="callout-title">Ponto de atenção: a raiz vem de um repositório que será privado</span>
  <p>Este passo baixa o <code>snl</code> de <code>github.com/snovalang/snovac</code>. Quando esse repositório ficar privado, o instalador deixa de funcionar e <code>make bootstrap-build</code> não tem com o que começar.</p>
  <p>O compilador novo já consegue viver sem o <code>snl</code> <em>depois</em> da primeira geração: o executável nativo produzido por <code>make bootstrap-native-self</code> (<code>build/bootstrap/compiler-native</code>) compila programas e a si mesmo para SnBC e para assembly usando só <code>as</code>/<code>ld</code>. Isso foi verificado para este livro: duas gerações deram assembly idêntico (capítulo 10). O que ainda não existe é um canal público para distribuir esse ponto de partida, seja um binário pronto, a imagem <code>.snbc</code> do compilador ou um instalador do <code>snl</code> que continue público. Até isso ser decidido, este capítulo vale apenas enquanto o instalador acima estiver acessível.</p>
</div>

## 2. Construir o compilador

O compilador mora no repositório `snovalang/snl`:

```sh
git clone https://github.com/snovalang/snl.git
cd snl
make bootstrap-build
```

`make bootstrap-build` executa `snl check --project bootstrap/src` e depois `snl build --project bootstrap/src -o build/bootstrap/snova-bootstrap`. Saída real, com o caminho de saída encurtado:

```text
snl check --project bootstrap/src
snl build --project bootstrap/src -o build/bootstrap/snova-bootstrap
Compiled project bootstrap/src (bundled binary dependencies) -> build/bootstrap/snova-bootstrap (target: aarch64-apple-darwin)
```

O passo levou **1,19 s** na máquina de referência, e o executável tem **270.592 bytes**. Repare em `bundled binary dependencies`: esse executável **não** é código de máquina do compilador. É o compilador em SnBC empacotado com a VM em C do `snl` (ADR-0005). O executável nativo de verdade vem depois (capítulo 10). Para aprender a linguagem, `snova-bootstrap` basta.

## 3. Os modos da linha de comando

O `main` do compilador, em `bootstrap/src/Compiler.snl`, decide o que fazer pela quantidade de argumentos:

| Comando | O que faz |
| --- | --- |
| `snova-bootstrap prog.snl prog.snbc` | Compila para uma imagem SnBC |
| `snova-bootstrap prog.snbc` | Valida a estrutura da imagem e imprime `valid SnBC image` ou `invalid SnBC image` |
| `snova-bootstrap prog.snbc run [args…]` | Executa a imagem na VM escrita em Snova. O modo é reconhecido pelos bytes `SNBC` no início do arquivo |
| `snova-bootstrap prog.snl prog.s native [alvo]` | Gera assembly para o alvo. Sem `[alvo]`, usa `aarch64-apple-darwin` |
| `snova-bootstrap` (sem argumentos) | Compila o próprio código-fonte e grava em `$SNL_OUTPUT` (usado no bootstrap) |

Dois detalhes verificados que costumam pegar quem começa:

- **O modo `native` precisa rodar a partir da raiz do repositório.** O compilador anexa ao seu programa os arquivos `bootstrap/runtime/*.snl` usando caminhos relativos. Em outro diretório, a saída é `error: cannot read 'bootstrap/runtime/Primitive.snl'`.
- **O programa sempre recebe o status de saída que `main` retorna.** O shell enxerga só o byte menos significativo (`status & 255`). `return 300` vira `44`.

## 4. Duas funções de shell para o resto do livro

Para não repetir sete comandos em cada exemplo, o livro usa estas duas funções. Elas foram testadas em `zsh` e `bash`:

```sh
export SNOVA_REPO="$HOME/snl"                     # onde você clonou o repositório
export PATH="$SNOVA_REPO/build/bootstrap:$PATH"

snova-vm() {
  arquivo=$1; shift
  base=${arquivo%.snl}
  snova-bootstrap "$arquivo" "$base.snbc" && snova-bootstrap "$base.snbc" run "$@"
}

snova-nativo() {
  arquivo=$1; shift
  base=$(cd "$(dirname "$arquivo")" && pwd)/$(basename "${arquivo%.snl}")
  sdk=$(xcrun --show-sdk-path); versao=$(xcrun --show-sdk-version)
  (cd "$SNOVA_REPO" && snova-bootstrap "$base.snl" "$base.s" native) &&
  as -arch arm64 "$base.s" -o "$base.o" &&
  ld -arch arm64 -platform_version macos "$versao" "$versao" -syslibroot "$sdk" \
     -lSystem -e _main "$base.o" -o "$base" &&
  "$base" "$@"
}
```

Quando um exemplo diz `Comando: snova-vm arquivo.snl`, é essa função que está sendo usada.

## 5. O primeiro programa

```snova
package livro.ola

import builtin.io.console

func main(): int {
    Console.printline("Ola, Supernova!")
    return 0
}
```
{% include exemplo.html arquivo="c02_ola.snl" modos="VM + nativo (aarch64-apple-darwin)" cmd="snova-vm c02_ola.snl ; snova-nativo c02_ola.snl" %}

Saída, idêntica nos dois modos:

```text
Ola, Supernova!
```

Linha por linha:

- `package livro.ola` dá nome à unidade. O parser aceita um nome pontilhado, mas **nenhum segmento pode ser palavra reservada**: `package livro.match` falha com `error[SNV2001]: parse error at line 1, span 14..19` (exemplo `c03_pacote_palavra_chave.snl`).
- `import builtin.io.console` é aceito e ignorado. O compilador atual não resolve imports (capítulo 4). `Console.printline` funciona mesmo sem a linha de import, o que foi verificado com um programa sem ela.
- `func main(): int` é o ponto de entrada. O valor que ele retorna é o status de saída do processo.
- `Console.printline` imprime um valor e quebra a linha. Também existem `Console.print` (sem quebra) e `Console.println` (sinônimo de `printline`).

O mesmo programa ocupa **83 bytes** em SnBC. Em código nativo, vira **20.307 linhas** de assembly e um executável de **102.112 bytes**, porque cada executável carrega o runtime Snova inteiro (heap, strings, arrays, ownership). Eliminar código morto está nos planos do ADR-0006, mas ainda não foi feito.

## 6. Conferindo a saúde do compilador

Com o repositório clonado, estas metas do `Makefile` mostram rapidamente se tudo está no lugar:

```sh
make bootstrap-smoke         # compila Hello.snl e espera "snova bootstrap ok"
make bootstrap-diagnostics   # confere as mensagens exatas de SNV1001..SNV4003
make bootstrap-fixed-point   # o compilador compila a si mesmo e compara os bytes
```

## Erros comuns no começo

| Sintoma | Causa verificada | Correção |
| --- | --- | --- |
| `error: cannot read 'bootstrap/runtime/Primitive.snl'` | `native` executado fora da raiz do repositório | `cd "$SNOVA_REPO"` antes, ou use `snova-nativo` |
| `error[SNV2001]: parse error at line 1, …` | Segmento do `package` é palavra reservada | Troque o nome (`livro.casamento` no lugar de `livro.match`) |
| `error: cannot read 'x'` | Primeiro argumento não existe ou não é `.snl`/`.snbc` | Confira o caminho |
| `unsupported opcode for native backend: N` | Recurso fora do subconjunto nativo | Veja a tabela do capítulo 1 |
| `native target is unknown or unsupported` | Alvo desconhecido no quarto argumento | Use `aarch64-apple-darwin` ou omita o alvo |

## O que parecia insolúvel

Você já tem um programa que roda, mas ele só imprime uma constante. Como guardar valores, fazer contas e tomar decisões sem uma biblioteca padrão, sem `double` e sem conversões implícitas? O capítulo 3 mostra que a Snova atual cabe em três tipos primitivos e explica por que até a divisão por zero tem um resultado definido.
