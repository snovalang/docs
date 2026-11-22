---
title: "5. Strings e coleções"
description: Strings como bytes com igualdade por conteúdo, arrays dinâmicos, arquivos, argumentos e ambiente, com as diferenças e os limites verificados na VM e no backend nativo.
page_id: livro-05
section_label: "Livro · Capítulo 5"
permalink: /pt-br/livro/05-strings-e-colecoes/
---

O capítulo 4 perguntou como um compilador lê arquivos e manipula texto sem biblioteca padrão. A resposta da Snova atual tem duas partes: **string** é um valor de bytes que você concatena e compara, mas não percorre; **array** é a única coleção, e o código-fonte, os tokens e a imagem SnBC do compilador são todos arrays de `int`.

## Strings

```snova
package livro.strings

import builtin.io.console

func main(): int {
    let a = "super" + "nova"
    let b = "su" + "pernova"
    Console.printline(a)
    Console.printline(a == b)
    Console.printline(a != "nova")
    Console.printline("tab\tfim")
    Console.printline("aspas \" e barra \\")
    Console.printline("linha1\nlinha2")
    return 0
}
```
{% include exemplo.html arquivo="c05_strings.snl" modos="VM + nativo" cmd="snova-vm c05_strings.snl" %}

```text
supernova
true
true
tab	fim
aspas " e barra \
linha1
linha2
```

### Igualdade por conteúdo: uma correção deliberada

`a == b` é `true` porque as duas strings têm os mesmos bytes, mesmo sendo valores construídos separadamente. Esse comportamento é uma **divergência intencional** do `snl v0.3.0`. As sondas registradas pelo projeto mostraram que, no `snl run-snbc`, `"ab" + "c" == "abc"` dá `false`, porque ele compara a identidade do objeto. A especificação do `snovac` (`value_equal.c`), porém, define igualdade estrutural. O compilador novo seguiu a especificação, e não o executável (ADR-0004, item 4). Na VM em Snova e no runtime nativo, a igualdade compara os bytes.

### O que uma string ainda não faz

| Operação | Resultado verificado (VM e nativo) |
| --- | --- |
| `"abc".len()` | `runtime error: operand type mismatch for opcode 49`, status 70 |
| `"a" < "b"` | `runtime error: operand type mismatch for opcode 26`, status 70 |
| `"n=" + 5` | `runtime error: operand type mismatch for opcode 12`, status 70 |
| indexar `s[0]` | não há operação de índice para strings |

Os três erros só aparecem **na execução**. O compilador não sabe, na compilação, que `.len()` não se aplica a strings. O opcode 49 é `ARRAY_LEN`, o 26 é a comparação `<`, e o 12 é `ADD`. Para imprimir rótulo e número, use duas chamadas:

```snova
Console.print("n=")
Console.printline(xs.len())
```

### Convertendo entre texto e bytes

Não existe conversão direta entre `string` e `int[]`. Existe, porém, um caminho que funciona nos dois backends: **passar pelo sistema de arquivos**.

```snova
package livro.bytestexto

import builtin.io.console
import builtin.runtime

func paraTexto(bytes: int[], rascunho: string): string {
    write_bytes(rascunho, bytes)
    return Runtime.readText(rascunho)
}

func paraBytes(texto: string, rascunho: string): int[] {
    Runtime.writeText(rascunho, texto)
    return read_bytes(rascunho)
}

func main(): int {
    let texto = paraTexto([83, 110, 111, 118, 97], "livro-rascunho.bin")
    Console.printline(texto)
    Console.printline(texto == "Snova")
    let bytes = paraBytes("ok!", "livro-rascunho.bin")
    Console.printline(bytes.len())
    Console.printline(bytes[2])
    return 0
}
```
{% include exemplo.html arquivo="c05_bytes_texto.snl" modos="VM + nativo" cmd="snova-vm c05_bytes_texto.snl" %}

```text
Snova
true
3
33
```

Parece gambiarra, e é, mas é a mesma gambiarra que o compilador usa. Quando a VM em Snova precisa comparar uma string vinda do hospedeiro (um argumento, uma variável de ambiente), `VmString.snl` grava o texto em `/tmp/snova-vm-string.bin` e lê os bytes de volta. O ADR-0004 registra isso como "fronteira provisória", com os riscos: execuções concorrentes compartilham o arquivo, e a VM depende de um `/tmp` gravável. O runtime nativo não tem esse problema, porque toda string já nasce como bytes copiados de `argv`/`envp` (ADR-0006). O seletor de alvo do compilador também usa o truque: `NativeTargetResolver.status` grava o nome do alvo em um arquivo de rascunho para compará-lo byte a byte. O capítulo 10 explica por que ele precisa disso.

## Arrays

```snova
package livro.arrays

import builtin.io.console

func main(): int {
    var xs = [10, 20, 30]
    xs.push(40)
    Console.printline(xs.len())
    Console.printline(xs[3])
    Console.printline(xs.get(1))
    let ultimo = xs.pop()
    Console.printline(ultimo)
    Console.printline(xs.length())
    var grade = [[1, 2], [3, 4]]
    Console.printline(grade[1][0])
    var nomes: string[] = []
    nomes.push("ana")
    Console.printline(nomes[0])
    Console.printline([1, 2] == [1, 2])
    Console.printline(["x"] == ["x", "y"])
    return 0
}
```
{% include exemplo.html arquivo="c05_arrays.snl" modos="VM + nativo" cmd="snova-vm c05_arrays.snl" %}

```text
4
40
20
40
3
3
ana
true
false
```

| Operação | Forma | Observação |
| --- | --- | --- |
| Literal | `[1, 2, 3]`, `[]` | `var xs = []` também funciona |
| Tipo | `int[]`, `string[]`, `Ponto[]` | O tipo do elemento é aceito, mas **não registrado** (veja abaixo) |
| Ler | `xs[i]` ou `xs.get(i)` | **Sem verificação de limites** (veja abaixo) |
| Tamanho | `xs.len()` ou `xs.length()` | |
| Acrescentar | `xs.push(v)` | |
| Remover o último | `xs.pop()` | Em array vazio: `runtime error: pop from empty array`, status 70 |
| Igualdade | `==`, `!=` | Estrutural, elemento por elemento |
| Escrever | `xs[i] = v` | **Não existe**: `SNV3001` (capítulo 9) |

### Leitura fora dos limites devolve `unit`, em silêncio

```snova
package livro.bordas

import builtin.io.console
import builtin.runtime

func main(): int {
    let ausente = Runtime.environment("LIVRO_NAO_DEFINIDA")
    Console.printline(ausente == "")
    Console.printline(Runtime.fileExists("livro-nao-existe.txt"))
    let fora = Runtime.argument(99)
    Console.printline(fora == "")
    var xs = [1, 2, 3]
    Console.printline(xs[5])
    Console.print("n=")
    Console.printline(xs.len())
    return 0
}
```
{% include exemplo.html arquivo="c05_bordas.snl" modos="VM + nativo" cmd="snova-vm c05_bordas.snl" %}

```text
true
false
true

n=3
```

`xs[5]` em um array de 3 elementos imprime uma linha vazia (`unit`) nos dois backends, sem erro. Variável de ambiente ausente e argumento inexistente viram string vazia. É prático, mas esconde erros. Até existir verificação de limites, **confira `i < xs.len()` você mesmo**.

### Por que `pop` era O(n)

`docs/roadmap/maturity.md` registra um caso que mostra bem o crescimento por degraus. Na VM em Snova, remover o último elemento de um array **do programa convidado** custava O(n), porque o `snl v0.3.0`, que compila o código da VM, não sabia gerar `array.pop()`. A implementação copiava o prefixo inteiro. A instrução `ARRAY_POP` (opcode 58) foi adicionada depois, nos dois backends, e a fixture `VmArrayPop` a cobre. A regra é a do capítulo 1: um recurso só entra quando a geração anterior do compilador consegue compilá-lo.

## Percorrendo um array

O jeito que funciona hoje é `while` com índice:

```snova
package livro.somararray

import builtin.io.console

func somar(valores: int[]): int {
    var total = 0
    var i = 0
    while i < valores.len() {
        total = total + valores[i]
        i = i + 1
    }
    return total
}

func main(): int {
    let total = somar([5, 6, 7])
    Console.printline(total)
    return total
}
```
{% include exemplo.html arquivo="c05_somar_array.snl" modos="VM + nativo" cmd="snova-vm c05_somar_array.snl" nota="Saída: <code>18</code>, status 18." %}

`for x in valores { … }` **compila**, mas nenhum backend o executa:

{% include exemplo.html status="planned" arquivo="c05_for.snl" modos="compila; falha na VM e no nativo" nota="VM: <code>runtime error: unsupported opcode 56</code> (status 70). Nativo: <code>unsupported opcode for native backend: 56</code>." %}

```snova
func main(): int {
    var total = 0
    for x in [5, 6, 7] {
        total = total + x
    }
    return total
}
```

O emissor de `for` (`scopeEmitFor`, em `ScopeMatch.snl`) gera um teste "é array ou inteiro?" com o opcode 56, para que `for i in 10` conte de 0 a 9 e `for x in xs` percorra os elementos. Nenhum dos executores implementa esse opcode. O capítulo 9 trata do `for`.

## Arquivos, argumentos e ambiente

```snova
package livro.runtime

import builtin.io.console
import builtin.runtime

func main(): int {
    let quantos = Runtime.argumentCount()
    Console.printline(quantos)
    var i = 0
    while i < quantos {
        Console.printline(Runtime.argument(i))
        i = i + 1
    }
    let caminho = "livro-runtime.txt"
    Console.printline(Runtime.writeText(caminho, "conteudo"))
    Console.printline(Runtime.fileExists(caminho))
    Console.printline(Runtime.readText(caminho))
    write_bytes(caminho, [83, 78, 66, 67])
    let bytes = read_bytes(caminho)
    Console.printline(bytes.len())
    Console.printline(bytes[0])
    Console.printline(Runtime.environment("LIVRO_SNOVA"))
    return 0
}
```
{% include exemplo.html arquivo="c05_runtime.snl" modos="VM + nativo" cmd="LIVRO_SNOVA=ok snova-vm c05_runtime.snl um dois" %}

```text
2
um
dois
true
true
conteudo
4
83
ok
```

A API completa de E/S do compilador atual, extraída de `runtimeCallId` (`EmitExpr.snl`) e `scopeBuiltinName` (`ScopeEmit.snl`):

| Chamada | Retorno | Opcode/ID SnBC |
| --- | --- | --- |
| `Runtime.argumentCount()` | `int` (sem contar o nome do programa) | runtime 6 |
| `Runtime.argument(i)` | `string` | runtime 7 |
| `Runtime.environment(nome)` | `string` (vazia se ausente) | runtime 5 |
| `Runtime.fileExists(caminho)` | `bool` | runtime 2 |
| `Runtime.readText(caminho)` | `string` | runtime 3 |
| `Runtime.writeText(caminho, texto)` | `bool` | runtime 4 |
| `read_bytes(caminho)` | `int[]` | opcode 47 |
| `write_bytes(caminho, bytes)` | — | opcode 48 |
| `Console.print`, `printline`, `println` | — | opcode 45 |

Uma diferença registrada no ADR-0006: `read_bytes` de um arquivo inexistente devolve um array vazio no runtime nativo, enquanto o hospedeiro `snl` aborta com `error: cannot read`.

## O que parecia insolúvel

Arrays guardam muitos valores do mesmo tipo, mas um token tem tipo, início, tamanho e linha, e um ponto tem `x` e `y`. Agrupar dados diferentes sob um nome exige tipos compostos, e organizar comportamento junto desses dados exige métodos. Há ainda uma pergunta mais difícil: como o backend nativo escolhe, em tempo de execução, entre AArch64 e x86-64 sem um `if` gigante? O capítulo 6 responde com `struct`, `class` e despacho dinâmico por `interface` e `trait`.
