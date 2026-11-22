---
title: "4. Funções e organização de código"
description: Declaração de funções, parâmetros, retorno, recursão, o limite de 256 quadros, armadilhas de return e o estado atual dos imports entre arquivos.
page_id: livro-04
section_label: "Livro · Capítulo 4"
permalink: /pt-br/livro/04-funcoes/
---

O capítulo 3 deixou todo o código preso dentro de `main`. Funções resolvem a primeira metade do problema (dividir e reutilizar). A segunda metade, espalhar o código por vários arquivos, ainda depende de um truque, e este capítulo explica qual é e por quê.

## Declaração

```snova
package livro.funcoes

import builtin.io.console

func main(): int {
    saudar("cataclisma")
    Console.printline(fibonacci(15))
    return quadrado(9)
}

func quadrado(n: int): int = n * n

func saudar(nome: string) {
    Console.printline("ola, " + nome)
}

func fibonacci(n: int): int {
    if n < 2 { return n }
    return fibonacci(n - 1) + fibonacci(n - 2)
}
```
{% include exemplo.html arquivo="c04_funcoes.snl" modos="VM + nativo" cmd="snova-vm c04_funcoes.snl" nota="Status de saída: 81 (= 9 × 9)." %}

```text
ola, cataclisma
610
```

O que vale observar, todos comportamentos verificados:

- **A ordem não importa.** `main` chama funções declaradas depois dela. O parser registra todas as declarações antes da emissão de código (`parseFile` e depois `emitUnit`), então não existe declaração antecipada.
- **Corpo de expressão:** `func quadrado(n: int): int = n * n` é açúcar para `{ return n * n }`. O parser constrói o mesmo nó `return` (`parseFunc` em `ParseDecl.snl`).
- **Tipo de retorno opcional:** `saudar` não declara retorno e devolve `unit`. Escrever `: unit` explicitamente também funciona.
- **Parâmetros sempre levam tipo:** `nome: string`. Sem tipo, é erro de parse.
- **Não há variáveis globais.** `let LIMITE = 10` fora de função dá `error[SNV2001]: parse error at line 3, span 22..25` (exemplo `c04_global.snl`). Para uma constante, use uma função: `func limite(): int = 10`.

## O limite de profundidade: 256 quadros

```snova
package livro.profundidade

func descer(n: int): int {
    if n == 0 { return 0 }
    return descer(n - 1) + 1
}

func main(): int {
    return descer(300) % 256
}
```
{% include exemplo.html arquivo="c04_profundidade.snl" modos="VM + nativo" cmd="snova-vm c04_profundidade.snl" %}

```text
runtime error: Stack overflow
```

O status de saída é `70`. Com `descer(250)` o programa termina normalmente e retorna `250`, o que foi verificado nos dois backends. O limite é de **256 quadros de chamada**.

**Por que um limite tão baixo?** É uma escolha de projeto, não falta de memória. A VM em Snova é **iterativa**: uma chamada não usa a pilha do processo hospedeiro, apenas guarda o quadro em `vm.frames` (`VmFrame.snl`). O limite de 256 copia o `SN_VM_FRAMES_MAX` do `snovac` (ADR-0004), para os dois executores terem a mesma semântica. O backend nativo aplica o mesmo limite aos quadros do programa. Métodos do runtime não entram na conta (ADR-0006). O custo é real: algoritmos recursivos profundos precisam ser reescritos como laços. O próprio compilador é escrito dessa forma, com laços `while go == 1` em vez de recursão no lexer e no parser.

## Duas armadilhas de `return`

### A expressão precisa estar na mesma linha

```snova
package livro.returnquebrado

func valor(): int {
    return
        42
}

func main(): int {
    return valor()
}
```
{% include exemplo.html arquivo="c04_return_quebrado.snl" modos="VM + nativo" cmd="snova-vm c04_return_quebrado.snl" nota="Status de saída: 0, e não 42." %}

`parseReturn` (`ParseDecl.snl`) só lê uma expressão se o próximo token estiver **na mesma linha** do `return`. Como `;` é opcional, essa é a regra que separa `return` sozinho de `return expr`. Neste exemplo, a função retorna `unit`, e o `42` nunca é executado.

### Função sem `return` não dá erro

Uma função declarada `: int` que termina sem `return` compila e devolve `unit`. A sonda `func f(): int { let x = 3 }` imprimiu uma linha vazia nos dois backends. O compilador ainda não verifica se todos os caminhos retornam valor.

## O que o compilador confere em uma chamada

| Situação | Resultado verificado |
| --- | --- |
| Nome de função inexistente | `SNV3001` na compilação |
| Quantidade errada de argumentos | `invalid generated SnBC image`, status 1 (exemplo `c07_aridade.snl`) |
| Argumento de tipo errado (`f("x")` com `n: int`) | **Compila**; o erro só aparece, se aparecer, na execução |
| Retorno de tipo errado (`return "texto"` em `: int`) | **Compila** |

A aridade é verificada, mas não pelo frontend: quem pega o erro é o **validador de imagem** (`validateCode`, em `ImageCode.snl`). Ele confere se cada `CALL` passa exatamente a aridade da função chamada, e por isso a mensagem não aponta linha. Os tipos de parâmetro e de retorno ainda não são comparados. O capítulo 7 volta a esse ponto.

## Organização em vários arquivos

Aqui está o limite. O compilador atual **lê um único arquivo** e não resolve `import`. A declaração `import` é aceita pelo parser e descartada (`parseDotted` em `ParseDecl.snl`).

{% include exemplo.html status="works_today" arquivo="c04_modulos/Principal.snl" modos="VM + nativo, depois de juntar os arquivos" nota="Compilado sozinho, <code>Principal.snl</code> falha com <code>error[SNV3001]: unsupported construct or invalid lowering at line 10, function #0</code>, porque <code>area</code> não existe nesse arquivo." %}

```snova
// c04_modulos/Geometria.snl
package livro.geometria

func area(largura: int, altura: int): int {
    return largura * altura
}

func perimetro(largura: int, altura: int): int {
    return 2 * (largura + altura)
}
```

```snova
// c04_modulos/Principal.snl
package livro.principal

import builtin.io.console
import livro.geometria

func main(): int {
    Console.printline(area(3, 4))
    Console.printline(perimetro(3, 4))
    return 0
}
```

O contorno é o mesmo que o projeto usa: **juntar os arquivos em uma unidade antes de compilar**, mantendo `package` e `import` só no primeiro e removendo-os dos demais.

```sh
{ cat Principal.snl; grep -v -e '^package ' -e '^import ' Geometria.snl; } > junto.snl
snova-vm junto.snl
```

```text
12
14
```

O próprio compilador é construído assim. A meta `bootstrap-native-self` do `Makefile` concatena os módulos em `Compiler-joined.snl` com `sed '/^package /d; /^import /d'`, e a meta `bootstrap-library` junta cada fixture com `bootstrap/library/*.snl`. Quando o compilador compila a si mesmo sem argumentos, o arquivo `SourceJoin.snl` faz essa junção internamente, a partir de uma **lista fixa e ordenada** dos próprios módulos.

### Por que ainda não há imports?

Pela documentação do projeto (`docs/roadmap/subset.md`), resolver imports entre arquivos arbitrários é o **próximo portão de arquitetura**. Por trás disso há uma dependência técnica: hoje todo o estado do frontend é um conjunto de arrays paralelos de `int` dentro de `CompilerState` (veja `Unit.snl`), indexados por posições de byte em **um único** buffer de código-fonte. Um token guarda `(início, tamanho)` dentro desse buffer. Para haver vários arquivos, cada posição precisa carregar também a identidade do arquivo, e os diagnósticos precisam mapear posições de volta para arquivo e linha. O plano de maturidade (`docs/roadmap/maturity.md`) descreve essa troca: sair de "arrays paralelos sobre um buffer" para contratos tipados de fonte, sintaxe e semântica. Isso é trabalho de arquitetura, não de sintaxe, e é por isso que ainda não foi feito.

## O que parecia insolúvel

Até aqui, todo valor foi um `int`, um `bool` ou uma constante de texto. Mas um compilador lê arquivos, guarda listas de tokens, concatena nomes e escreve bytes no disco. Sem `double` e sem biblioteca padrão, como se manipulam textos e coleções de tamanho variável? O capítulo 5 mostra que, na Snova, string é um array de bytes com outro nome, e que o array é a única coleção da linguagem, e é suficiente.
