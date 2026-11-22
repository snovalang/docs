---
title: "8. A VM e o backend nativo"
description: Como compilar e executar em cada modo, como funcionam a VM em Snova e o backend AArch64, memória por ownership sem coletor de lixo, a divergência sobre ciclos e a matriz de plataformas.
page_id: livro-08
section_label: "Livro · Capítulo 8"
permalink: /pt-br/livro/08-vm-e-nativo/
---

O capítulo 7 mostrou dois backends que quase sempre concordam e uma mensagem que só o nativo emite. Para entender essa diferença, é preciso ver como cada um trata o mesmo programa, e por que o nativo não precisa de coletor de lixo.

## Um programa, dois destinos

Os dois modos partem da mesma imagem SnBC. A diferença está no que acontece depois:

```text
                 ┌── VM em Snova (Vm*.snl) ──► executa a imagem
prog.snl ─► SnBC ┤
                 └── NativeBackend ──► prog.s ──► as/ld ──► Mach-O ligado à libSystem
                       (o runtime em bootstrap/runtime/*.snl é anexado ao programa)
```

| | VM em Snova | Backend nativo |
| --- | --- | --- |
| Comando | `snova-bootstrap prog.snbc run [args]` | `snova-bootstrap prog.snl prog.s native`, depois `as` e `ld` |
| Recursos não suportados | falham **ao executar** (`unsupported opcode N`) | falham **ao compilar** (`unsupported opcode for native backend: N`) |
| Memória | células da VM, sem relatório | heap com ownership e relatório opcional |
| Ciclos de referência | permitidos | rejeitados |
| Desempenho (capítulo 11) | ~10 s para `fibonacci(27)` | 0,02 s para o mesmo programa |
| Papel no projeto | **oráculo diferencial** | caminho de distribuição |

A VM é a referência de comportamento: cada fixture nativa é comparada com ela, em stdout e status de saída, pelas metas `make bootstrap-native` e `make bootstrap-library`.

## Por dentro da VM

A VM está em `bootstrap/src/Vm*.snl`, em torno de 1.300 linhas, e foi desenhada para rodar o próprio compilador (ADR-0004):

- **Valores com etiqueta.** Cada valor é um par `(etiqueta, valor)` guardado em uma célula: 0 unit, 1 int, 2 bool, 3 string, 4 array, 5 objeto, 6 null. SnBC é dinamicamente tipado (`ADD` serve para int e string, `PRINT` serve para tudo), então a etiqueta viaja com o valor.
- **Pré-decodificação.** Ao carregar a imagem, `VmDecode.snl` transforma cada instrução em entradas de três arrays (opcode, operando 1, operando 2) e converte os saltos em índices de instrução. O laço principal não decodifica bytes.
- **Laço iterativo.** `vmRun` (`VmFrame.snl`) despacha os opcodes mais frequentes primeiro (`LOAD_LOCAL`, `PUSH_INT`, `POP`, `CALL`). `CALL` guarda o quadro em `vm.frames` em vez de usar a pilha do hospedeiro. Vem daí o limite de 256 quadros independente do sistema.
- **Igualdade estrutural com proteção contra ciclos.** Strings comparam bytes; arrays e objetos comparam campo a campo, guardando os pares já visitados para terminar em estruturas cíclicas.

O custo dessa VM é que ela mesma roda sobre outra VM: o `snova-bootstrap` gerado por `snl build` é SnBC empacotado com a VM em C do `snl`. São duas camadas de interpretação, o que explica os números do capítulo 11.

## Por dentro do backend nativo

O backend está em `bootstrap/src/Native*.snl`. Ele lê a imagem SnBC já validada e traduz cada opcode para assembly AArch64 (ADR-0005):

- **Slots de 16 bytes.** Pilha de operandos, variáveis locais, argumentos, elementos de array e campos de objeto usam todos o formato `(payload, etiqueta)`, com as mesmas etiquetas da VM. Resultados voltam em `x0` (payload) e `x1` (etiqueta). Não há alocação de registradores, uma simplicidade deliberada da primeira versão.
- **Inline ou chamada ao runtime.** Aritmética e comparação de int/bool, saltos, locais, `GET_FIELD`, `GET_INDEX`, `ARRAY_LEN` e `ARRAY_POP` viram instruções inline. Igualdade, concatenação, alocação, `ARRAY_PUSH`, `PRINT` e E/S chamam o runtime escrito em Snova.
- **O runtime é Snova.** No modo `native`, o compilador **anexa** `bootstrap/runtime/*.snl` ao seu programa (`appendNativeRuntime`, em `SourceJoin.snl`) e compila tudo junto. São nove tipos, um por responsabilidade: `Primitive`, `System`, `Heap`, `Runtime`, `Text`, `Container`, `Ownership`, `Value` e `Host`. Por isso até um "olá" vira 20 mil linhas de assembly.

### A fronteira com o sistema: sete funções

O ADR-0003 só permite assembly nas fronteiras com o sistema operacional. Na prática, os métodos `@Native` sem corpo de `Primitive` e `System` são substituídos por stubs em assembly (`NativeBoundary.snl`), e são as únicas instruções que chamam a `libSystem`. Verificado no executável do exemplo `c08_memoria`:

```text
$ nm -u c08_memoria.native
_close
_exit
_mmap
_munmap
_open
_read
_write

$ otool -L c08_memoria.native
	/usr/lib/libSystem.B.dylib (compatibility version 1.0.0, current version 1356.0.0)
```

O executável não usa `malloc`, `printf` nem nenhuma outra função da libc. A assinatura é a ad-hoc que o `ld` aplica (`flags=0x20002(adhoc,linker-signed)`), exigida pelo kernel para executáveis arm64.

## Memória sem coletor de lixo

Neste ponto o projeto é mais radical. A regra do ADR-0006 é: **um programa nunca acumula memória até o fim**. Todo valor é liberado assim que nada mais é dono dele, sem coletor de lixo.

### O heap

`Heap.snl` divide os blocos em duas faixas:

- **Pequenos** (até 64 KiB, cabeçalho incluído): 12 classes de tamanho em potências de dois, de 32 B a 64 KiB. Um bloco liberado vai para a lista livre da sua classe e é reaproveitado pela próxima alocação do mesmo tamanho.
- **Grandes:** recebem um `mmap` próprio e voltam ao kernel com `munmap` ao serem liberados.

Cada bloco tem um cabeçalho de 16 bytes: `[contagem de donos][classe de tamanho]`. Constantes em `__TEXT,__const` têm contagem negativa e nunca são liberadas.

### Ownership no backend

`NativeOwnership.snl` decide, na compilação, onde inserir *retain* e *release*:

- **Donos:** locais, temporários da pilha de operandos, campos de objeto e elementos de array. Cada um vale uma unidade na contagem do bloco.
- **Movimentos:** argumentos de chamada passam para quem foi chamado, que libera parâmetros e locais no `RETURN`. Elementos de `NEW_ARRAY`, `NEW_OBJECT` e `ARRAY_PUSH` passam para o contêiner.
- **Empréstimos estáticos:** `LOAD_LOCAL` produz um empréstimo **sem contagem**, porque a variável local mantém o valor vivo. O empréstimo só vira dono (um *retain*) quando escapa: ao ser guardado em local, campo ou array, passado como argumento, retornado ou carregado através de um salto. Leituras de campo, `PRINT`, comparações e `ARRAY_LEN` usam o empréstimo sem tocar na contagem. Essa elisão estática é o que torna o esquema barato.

Quando a contagem chega a zero, `Ownership.destroy` roda **exatamente uma vez**, libera os filhos e devolve o bloco.

### A prova: memória constante

```snova
package livro.memoria

import builtin.io.console
import builtin.runtime

struct Registro {
    public var rotulo: string
    public var itens: int[]
}

func construir(i: int): Registro {
    var itens = [i, i + 1]
    itens.push(i + 2)
    return Registro { rotulo: "item-" + "x", itens: itens }
}

func main(): int {
    let voltas = 20000 * Runtime.argumentCount()
    var atual: Registro = construir(0)
    var total = 0
    var i = 0
    while i < voltas {
        atual = construir(i)
        total = total + atual.itens[2] % 7
        i = i + 1
    }
    Console.printline(total)
    return 0
}
```
{% include exemplo.html arquivo="c08_memoria.snl" modos="nativo (aarch64-apple-darwin); também roda na VM" cmd="SNOVA_MEMORY_REPORT=1 /usr/bin/time -l ./c08_memoria 1 2 3 4 5 6 7 8" %}

Cada volta aloca uma string, um array (que cresce de 2 para 3 elementos) e um objeto, e descarta os da volta anterior. Medido com 1, 8 e 32 argumentos:

| Voltas | Saída | Relatório de memória | Pico vivo | RSS máximo | Tempo |
| --- | --- | --- | --- | --- | --- |
| 20.000 | `59999` | `live blocks 0, live bytes 0` | 576 B | 1.458.176 B | 0,02 s |
| 160.000 | `479999` | `live blocks 0, live bytes 0` | 576 B | 1.458.176 B | 0,17 s |
| 640.000 | `1920002` | `live blocks 0, live bytes 0` | 576 B | 1.458.176 B | 0,72 s |

Com 32 vezes mais trabalho, o pico continua em 576 bytes e o RSS não muda. Ao sair, **zero blocos vivos**. O tempo cresce linearmente com o trabalho, e não com a memória.

## A divergência: ciclos

```snova
package livro.ciclo

import builtin.io.console

struct No {
    public var filhos: No[]
}

func main(): int {
    var a = No { filhos: [] }
    var b = No { filhos: [] }
    a.filhos.push(b)
    Console.printline("arvore ok")
    b.filhos.push(a)
    Console.printline("ciclo criado")
    return 0
}
```
{% include exemplo.html arquivo="c08_ciclo.snl" modos="VM e nativo divergem" cmd="snova-vm c08_ciclo.snl ; snova-nativo c08_ciclo.snl" %}

VM (status 0):

```text
arvore ok
ciclo criado
```

Nativo (status 70):

```text
arvore ok
runtime error: strong reference cycle rejected for opcode 50
```

**Por que o nativo recusa?** Com contagem de donos, um ciclo forte nunca chega a zero: `a` é dono de `b`, `b` é dono de `a`, e nenhum dos dois é liberado. Um coletor de lixo resolveria isso varrendo o heap, mas o projeto proíbe coletor. A saída escolhida foi manter o heap **sempre acíclico**: antes de um `ARRAY_PUSH` (opcode 50) ou de um `SET_FIELD` com contêiner, o runtime verifica se o destino é alcançável a partir do valor guardado e, nesse caso, recusa a operação. Essa política vem do contrato de segurança de memória do `snovac`. A VM, que não gerencia memória por contagem, aceita o ciclo. A divergência é **intencional** e está documentada no ADR-0006. Estruturas cíclicas legítimas, como listas duplamente ligadas e grafos, ficam à espera de **referências fracas**, que ainda não fazem parte da linguagem.

## Plataformas

Status de cada alvo, separando o que foi verificado neste livro do que está no registro de evidências do projeto:

| Alvo | Seletor no CLI | Status | Fonte |
| --- | --- | --- | --- |
| `aarch64-apple-darwin` | padrão (ou explícito) | **Qualificado**: diferencial nativo × VM, ownership, ponto fixo N3 | verificado neste livro |
| `aarch64-unknown-linux-gnu` | `native aarch64-unknown-linux-gnu` | Emite assembly ELF com `_start` e syscalls Linux; diferencial com a VM em 13 fixtures em Docker; **ponto fixo de autocompilação não qualificado** | emissão verificada aqui; execução conforme `evidence.md`, 22/11/2026 |
| `x86_64-unknown-linux-gnu` | reconhecido | **Rejeitado**: `native target recognized but Linux x86-64 backend is not implemented` | verificado neste livro |
| qualquer outro (ex.: `riscv64-unknown-linux-gnu`) | — | `native target is unknown or unsupported` | verificado neste livro |
| Windows, macOS Intel, FreeBSD, RISC-V, ARM32, bare-metal | — | Não implementados; plano em estágios T3–T6 no ADR-0008 | ADR-0008 |

A VM roda onde o `snl` roda. O pipeline de CI do projeto define builds do CLI e da VM em Linux x86-64 e ARM64, macOS x86-64 e ARM64 e Windows x86-64 e ARM64, mas o registro de evidências avisa que esses jobs **não rodaram** no ambiente local.

### Requisitos de toolchain por modo

| Modo | Precisa de |
| --- | --- |
| Construir o compilador | `snl v0.3.0`, `make` |
| VM | só o `snova-bootstrap` |
| Nativo Darwin | `as` e `ld` da Apple (Command Line Tools), `xcrun` para achar o SDK |
| Nativo Linux AArch64 | binutils GNU (ligação estática); o projeto usa a imagem `ci/linux-aarch64.Dockerfile` |

O plano N4 do ADR-0005, um escritor de Mach-O e a assinatura ad-hoc em Snova, removeria `as` e `ld`. Ele é opcional e não foi iniciado.

## O que parecia insolúvel

Agora você conhece os limites: `for`, `enum`, `defer`, `async`, generics, herança e imports. Alguns compilam e não executam, outros nem compilam. A pergunta natural é: se o compilador consegue compilar a si mesmo, por que não acrescentar esses recursos de uma vez? O capítulo 9 mostra cada recurso planejado, o erro real de hoje e a dependência que o trava.
