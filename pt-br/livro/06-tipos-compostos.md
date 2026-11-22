---
title: "6. Tipos compostos e orientação a objetos"
description: struct, class, construtores posicionais, métodos estáticos, interface, trait e impl, despacho dinâmico na VM e no nativo, e as regras de tipo estático que governam o acesso a campos.
page_id: livro-06
section_label: "Livro · Capítulo 6"
permalink: /pt-br/livro/06-tipos-compostos/
---

O capítulo 5 terminou com dados que não cabem em um array homogêneo e com uma pergunta de engenharia: como o backend nativo escolhe entre arquiteturas em tempo de execução? Este capítulo responde nessa ordem: primeiro `struct` (dados), depois `class` (dados com comportamento) e, por último, `interface` e `trait`, que deixam código genérico chamar comportamento específico.

## `struct`: dados nomeados

```snova
package livro.estruturas

import builtin.io.console

struct Ponto {
    public var x: int
    public var y: int
    public var nome: string
}

func deslocar(p: Ponto, dx: int): unit {
    p.x = p.x + dx
}

func main(): int {
    var p = Ponto { x: 1, y: 2, nome: "p" }
    deslocar(p, 10)
    Console.printline(p.x)
    let q = Ponto { x: 11, y: 2, nome: "p" }
    Console.printline(p == q)
    let apelido = p
    apelido.y = 99
    Console.printline(p.y)
    let parcial = Ponto { x: 5 }
    Console.printline(parcial.nome == "")
    return p.x
}
```
{% include exemplo.html arquivo="c06_struct.snl" modos="VM + nativo" cmd="snova-vm c06_struct.snl" nota="Status de saída: 11." %}

```text
11
true
99
true
```

Quatro fatos verificados:

1. **Semântica de referência.** `deslocar(p, 10)` altera o `p` de quem chamou, e `let apelido = p` não copia nada: mudar `apelido.y` muda `p.y`. Um `struct` é um objeto no heap (layout `[quantidade de campos][campos de 16 bytes]`, ADR-0006), e as variáveis guardam referências para ele.
2. **Igualdade estrutural.** `p == q` compara campo a campo, inclusive strings por conteúdo.
3. **Campos omitidos recebem valor padrão:** `0` para `int`, `false` para `bool`, `""` para `string` (`emitDefault`, em `Emit.snl`).
4. **Sintaxe restrita:** cada campo precisa de `var` ou `let` (o `public` é opcional). `struct` **não aceita** inicializador de campo (`public var x: int = 3` dá `SNV2001`) nem métodos (`SNV2001`). Para isso existe `class`.

## `class`: dados com comportamento

```snova
package livro.classe

import builtin.io.console

class Conta {
    public var dono: string
    public var saldo: int = 100

    public method depositar(valor: int): int {
        saldo = saldo + valor
        return saldo
    }

    public method relatorio(): unit {
        Console.printline(dono)
        Console.printline(saldo)
    }

    public static method taxa(): int {
        return 3
    }

    public method cobrar(): unit {
        saldo = saldo - taxa()
    }
}

func main(): int {
    let a = Conta("ana")
    a.depositar(50)
    a.cobrar()
    a.relatorio()
    let b = Conta("bia", 7)
    b.relatorio()
    Console.printline(Conta.taxa())
    return 0
}
```
{% include exemplo.html arquivo="c06_classe.snl" modos="VM + nativo" cmd="snova-vm c06_classe.snl" %}

```text
ana
147
bia
7
3
```

### O construtor posicional

`Conta("ana")` preenche os campos **na ordem em que foram declarados**. Se faltarem argumentos, os campos restantes recebem o inicializador declarado (`saldo = 100`) ou, sem inicializador, o valor padrão do tipo (`scopeEmitCtor`, em `ScopeEmit.snl`). Por isso `Conta("ana")` começa com saldo 100, e `Conta("bia", 7)` com 7. Não existe construtor escrito à mão. A sintaxe de literal `Conta { dono: "a" }` **não** funciona para classes (`SNV3001`); ela é exclusiva de `struct`.

### Acesso implícito a campos e métodos irmãos

Dentro de um método, `saldo` se refere ao campo, e `taxa()` chama o método estático da própria classe sem qualificação. **Não existe `this`**: `this.v` dá `SNV3001` (exemplo `c06_this.snl`). O receptor é o parâmetro implícito 0. É por isso que um método de instância com `n` parâmetros tem aridade `n + 1` na imagem SnBC (`parseFunc`, `ParseDecl.snl`).

Dentro de uma classe, os campos não precisam de `var`, e os métodos podem ser declarados com `func`:

```snova
class Contador {
    total: int
    passo: int = 2
    func avancar(): int {
        total = total + passo
        return total
    }
}
```
{% include exemplo.html arquivo="c06_campos_livres.snl" modos="VM + nativo" cmd="snova-vm c06_campos_livres.snl" nota="Com <code>Contador(0)</code> e duas chamadas a <code>avancar()</code>, imprime <code>4</code> e retorna 4." %}

### `static`

Um método `static` não tem receptor. As regras, verificadas e reforçadas pelo compilador (ADR-0007):

| Chamada | Resultado |
| --- | --- |
| `Tipo.metodoEstatico()` | ok |
| `metodoEstatico()` dentro de um método da mesma classe | ok |
| `Tipo.metodoDeInstancia()` | `SNV3001` (exemplo `c06_estatico_erro.snl`) |
| `objeto.metodoEstatico()` | `SNV3001` |

### Visibilidade: `private` ainda não é aplicado

{% include exemplo.html arquivo="c06_privado.snl" modos="VM + nativo" nota="<code>c.segredo + c.abrir()</code>, com <code>segredo</code> e <code>revelar</code> declarados <code>private</code>, compila e retorna 14." %}

`public` e `private` são lidos e descartados (`scopeTakeMods`, em `ScopeParse.snl`). Use-os como documentação; o compilador ainda não impede o acesso.

## A regra que governa campos: o tipo estático precisa ser conhecido

Esta é a regra mais importante do capítulo e a que mais causa `SNV3001`. Para gerar `GET_FIELD n`, o emissor precisa saber **qual tipo** está à esquerda do ponto, para descobrir em que posição fica o campo (`emitMember`, em `EmitExpr.snl`). O tipo estático só é conhecido para:

- literais de `struct` e construtores de classe;
- variáveis locais anotadas (`let p: Ponto = …`) ou inicializadas com um dos itens acima;
- parâmetros (`p: Ponto`);
- acessos a campos cujo tipo foi declarado (`p.x`, com `x: int`).

Fica desconhecido para **resultados de chamada de função** e **elementos de array**:

```snova
func criar(): Ponto { return Ponto { x: 8 } }

func main(): int {
    let p = criar()
    return p.x          // SNV3001: o tipo de criar() não chega até p
}
```
{% include exemplo.html arquivo="c06_retorno_sem_tipo.snl" modos="compilação rejeitada" nota="<code>error[SNV3001]: unsupported construct or invalid lowering at line 12, function #1</code>. Com <code>let p: Ponto = criar()</code> (exemplo <code>c06_retorno_anotado.snl</code>), compila e retorna 8 nos dois modos." %}

O mesmo acontece com arrays: `pontos[0].x` falha (exemplo `c06_campo_de_array_erro.snl`). Há dois jeitos de resolver, ambos verificados:

```snova
package livro.campodearray

struct Ponto {
    public var x: int
}

func xDe(p: Ponto): int { return p.x }

func main(): int {
    let pontos = [Ponto { x: 3 }, Ponto { x: 4 }]
    let segundo: Ponto = pontos[1]
    return segundo.x + xDe(pontos[0])
}
```
{% include exemplo.html arquivo="c06_campo_de_array.snl" modos="VM + nativo" cmd="snova-vm c06_campo_de_array.snl" nota="Status de saída: 7." %}

A anotação `let segundo: Ponto = pontos[1]` é aceita porque o lado direito tem tipo desconhecido e, nesse caso, não há conflito para o `SNV4001` reportar. A biblioteca do projeto usa o segundo padrão o tempo todo, por exemplo `TreeNode.keyOf(nodes[index])` em `bootstrap/library/BinaryTree.snl`.

### Mais duas restrições de chamada de método

**Receptor que é campo.** `motor.potencia()` dentro de `Carro` falha com `SNV3001` (exemplo `c06_campo_receptor.snl`). Passe o campo por uma variável local primeiro:

```snova
class Carro {
    public var motor: Motor
    public method potencia(): int {
        let m: Motor = motor
        return m.potencia() * 2
    }
}
```
{% include exemplo.html arquivo="c06_colaborador.snl" modos="VM + nativo" cmd="snova-vm c06_colaborador.snl" nota="Status de saída: 10." %}

**Nomes de builtin.** Um método chamado `get`, `push`, `pop`, `len`, `length`, `print`, `printline`, `println`, `read_bytes` ou `write_bytes` é interceptado como operação de array ou de console (`scopeBuiltinName`). `c.get()` falha com `SNV3001` (exemplo `c06_metodo_get.snl`). Escolha outro nome.

Essas duas restrições também aparecem no ADR-0007, como regras que o próprio código do compilador segue: "colaboradores viajam como parâmetros tipados, nunca como receptores guardados em campos" e "nenhum método com nome de builtin de array". Elas vieram do `snl v0.3.0`, que é a raiz, e continuam valendo no compilador atual.

## Interfaces e despacho dinâmico

Agora a pergunta do início do capítulo. O compilador precisa, em algum momento, tratar "AArch64" e "x86-64" pela mesma interface. A fixture `InterfaceDispatch.snl` do projeto faz isso em miniatura com `interface Architecture`. Aqui está a mesma ideia com formas geométricas:

```snova
package livro.interfaces

import builtin.io.console

interface Forma {
    method area(): int
}

class Quadrado implements Forma {
    public var lado: int
    method area(): int { return lado * lado }
}

class Retangulo implements Forma {
    public var largura: int
    public var altura: int
    method area(): int { return largura * altura }
}

func criar(tipo: int): Forma {
    if tipo == 0 { return Quadrado(3) }
    return Retangulo(2, 5)
}

func main(): int {
    let a: Forma = criar(0)
    let b: Forma = criar(1)
    Console.printline(a.area())
    Console.printline(b.area())
    return a.area() + b.area()
}
```
{% include exemplo.html arquivo="c06_interface.snl" modos="VM + nativo" cmd="snova-vm c06_interface.snl" nota="Status de saída: 19. Veja o aviso sobre a VM logo abaixo." %}

```text
9
10
```

- `class Quadrado implements Forma` declara a conformidade, e o compilador a **verifica**: cada método da interface precisa existir na classe, com o mesmo nome, a mesma aridade, os mesmos tipos de parâmetro e o mesmo tipo de retorno. Caso contrário, sai `SNV5001` (capítulo 7).
- `a.area()` em uma variável do tipo `Forma` vira o opcode `CALL_INTERFACE` (59), que carrega o nome do método. O alvo concreto é resolvido em tempo de execução.
- Um valor concreto guardado em variável pode ser passado para um parâmetro do tipo interface: `let direto = Quadrado(4)` seguido de `describe(direto)`, com `func describe(s: Forma): int`, retornou 16 nas sondas, nos dois backends. Porém, **`let f: Forma = Quadrado(3)` é rejeitado** com `SNV4001` (exemplo `c06_interface_anotada.snl`): a verificação de anotação compara tipos por igualdade, ainda sem subtipagem. Por isso o exemplo cria os objetos por meio de uma função que retorna `Forma`.

### Como cada backend despacha

| | VM em Snova | Backend nativo |
| --- | --- | --- |
| O que o objeto guarda | índice do nome do tipo concreto no pool de strings | id do tipo concreto |
| Como acha o método | busca binária em um índice ordenado de nomes `Tipo.metodo` (`vmResolveMethod`, `VmValue.snl`) | tabela por tipo gerada em cada ponto de chamada |
| Custo por chamada | O(log F × L), com F = número de funções e L = tamanho do nome | O(1) |
| Custo de preparação | ordenação O(F log F × L) ao carregar a imagem | O(P × F × L) por ponto de chamada, na compilação |

(Complexidades conforme `docs/roadmap/maturity.md`.)

<div class="callout callout-warn">
  <span class="callout-title">Bug conhecido na VM: a busca do método pode errar</span>
  <p>O comparador usado pela busca binária, <code>vmCompareMethodName</code> em <code>bootstrap/src/VmValue.snl</code>, começa com <code>if functionLength &lt;= typeLength { return -1 }</code>. Uma função cujo nome é mais curto que o nome do tipo, como <code>main</code>, <code>criar</code> ou <code>medir</code> comparadas com <code>Retangulo</code>, é sempre tratada como "menor". Pela ordem de bytes ela é maior, porque letras minúsculas vêm depois das maiúsculas. Se a busca cair nesse elemento, ela segue para o lado errado e termina com <code>runtime error: method not found for concrete type N</code>.</p>
  <p>O resultado depende de onde caem os pontos médios. O exemplo <code>c06_interface_bug_vm.snl</code>, uma interface com dois métodos e uma função auxiliar <code>descrever</code>, falha na VM e funciona no nativo (status 19, saída <code>quadrado</code>, <code>retangulo</code>, <code>19</code>, <code>quadrado</code>, <code>16</code>). Acrescentar uma função <code>medir</code> ao exemplo acima já basta para quebrá-lo na VM. Até a correção, considere o despacho por interface <strong>confiável apenas no backend nativo</strong>. A correção é comparar os bytes até o fim do menor nome antes de decidir pelo comprimento.</p>
</div>

## `trait` e `impl`

Uma `trait` declara um contrato como a interface. A diferença é que a conformidade fica em um bloco `impl` separado da classe:

```snova
package livro.traits

import builtin.io.console

trait Saudacao {
    method saudar(nome: string): string
}

class Robo {
}

impl Saudacao for Robo {
    method saudar(nome: string): string { return "bip, " + nome }
}

func escolher(): Saudacao { return Robo() }

func main(): int {
    let s: Saudacao = escolher()
    Console.printline(s.saudar("mundo"))
    let r = Robo()
    Console.printline(r.saudar("direto"))
    return 0
}
```
{% include exemplo.html arquivo="c06_trait.snl" modos="VM + nativo" cmd="snova-vm c06_trait.snl" %}

```text
bip, mundo
bip, direto
```

Os métodos do `impl` pertencem ao tipo `Robo` (`scopeParseImpl` atribui o dono `owner`), então `r.saudar(...)` funciona como chamada direta, e `s.saudar(...)` passa pelo despacho dinâmico.

### Por que ter as duas?

O ADR-0008 dá a razão: **interfaces** modelam serviços que variam em tempo de execução, como o conjunto de instruções do alvo pedido. **Traits** modelam comportamento reutilizável cuja conformidade é verificada na compilação. Hoje as duas compilam para o mesmo mecanismo, o opcode 59 e as tabelas nativas. A separação foi feita para quando existirem generics com restrição (`T: ProcessorArchitecture`) e monomorfização, que selecionam a implementação **estaticamente**, sem custo de despacho. O ADR insiste em um detalhe: essa seleção estática nunca pode amarrar um compilador cruzado à CPU em que ele está rodando.

## O que parecia insolúvel

Neste capítulo o compilador rejeitou muita coisa, mas nem sempre explicou o motivo. `SNV3001` apareceu para coisas diferentes: método com nome de builtin, receptor que é campo, retorno sem tipo, `this`. Pior: argumentos e retornos de tipo errado passaram sem erro algum. Como ler o que o compilador diz e saber o que ele não diz? O capítulo 7 cataloga todos os diagnósticos e todos os buracos conhecidos.
