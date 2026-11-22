---
title: "9. Recursos planejados"
description: Generics, herança, imports, for, enums, defer, pulsar, async, try/catch, decimais e atribuição por índice, com o erro real de hoje, a motivação e a dependência que trava cada um.
page_id: livro-09
section_label: "Livro · Capítulo 9"
permalink: /pt-br/livro/09-recursos-planejados/
---

O capítulo 8 perguntou por que um compilador que compila a si mesmo não ganha logo todos os recursos que faltam. A resposta é a regra que atravessa o livro inteiro (ADR-0001): **o compilador N+1 só pode usar o que o compilador N já compila**, e um recurso só conta como entregue depois de passar por *sonda → especificação → fixture → implementação mínima → diferencial → build da próxima geração* (`docs/roadmap/stages.md`). Cada recurso abaixo está parado em algum ponto dessa sequência.

<div class="callout callout-coming">
  <span class="callout-title">Como ler este capítulo</span>
  Todo código aqui é {% include status-badge.html status="planned" %}. Os trechos mostram a forma pretendida, e logo abaixo de cada um vem o resultado real do compilador atual. Nenhum destes exemplos produz o resultado que o código sugere.
</div>

## Recursos que compilam mas não executam

Estes passam pelo parser e pela emissão, mas os executores param. É a categoria mais próxima de ficar pronta: a sintaxe e o bytecode já existem.

### `for … in`

```snova
for x in [5, 6, 7] { total = total + x }
for i in 10 { … }          // 0..9
```
{% include exemplo.html status="planned" arquivo="c05_for.snl" nota="Hoje: <code>runtime error: unsupported opcode 56</code> (VM, status 70); <code>unsupported opcode for native backend: 56</code> (nativo)." %}

- **Motivação:** percorrer coleções sem índice manual.
- **O que já existe:** `scopeEmitFor` gera um laço completo que decide em tempo de execução, com o opcode 56, se o valor é array (percorre elementos) ou inteiro (conta de 0 a n−1). `break` e `continue` já são resolvidos dentro dele.
- **O que falta:** implementar o opcode 56 na VM e no backend nativo, com fixtures diferenciais. Até lá, use `while` com índice (capítulo 5).

### `enum` e `match` sobre variantes

```snova
enum Cor {
    Vermelho
    Verde
}

func main(): int {
    let c = Cor.Verde
    return 0
}
```
{% include exemplo.html status="planned" arquivo="c09_enum.snl" nota="Hoje: <code>runtime error: unsupported opcode 42</code> (VM); <code>unsupported opcode for native backend: 42</code> (nativo). Em um <code>match</code> sobre variantes, o nativo para no opcode 43 (comparação de variante)." %}

- **Motivação:** valores de um conjunto fechado, com `match` verificando cada caso.
- **O que já existe:** parser de `enum` (inclusive com métodos), padrões `Cor.Verde` e `Verde` no `match`, e os opcodes 42 (criar variante) e 43 (testar variante).
- **O que falta:** representação da variante nos dois executores. A fixture `NativeUnsupported.snl` do projeto existe justamente para garantir que o backend **recuse** a variante com diagnóstico, em vez de emitir assembly parcial.

### `defer`, `pulsar` e `async`/`await`

```snova
defer tchau()              // opcode 53
pulsar trabalho(1)         // opcode 54
let v = await calcular(21) // async: opcode 55
```
{% include exemplo.html status="planned" arquivo="c09_defer.snl" nota="Também <code>c09_pulsar.snl</code> e <code>c09_async.snl</code>. Hoje: <code>unsupported opcode 53</code>, <code>54</code> e <code>55</code> na VM; os mesmos números no nativo." %}

- **Motivação:** liberação no fim do escopo (`defer`), tarefas concorrentes (`pulsar`, o nome Snova para *spawn*) e funções assíncronas.
- **O que já existe:** o emissor reconhece `defer f(args)` e `pulsar f(args)` quando `f` é uma função de nível superior, e chamadas a funções `async` viram o opcode 55. O validador limita `defer` e chamadas `async` a 8 argumentos.
- **O que falta:** semântica de execução. O roadmap tira concorrência e desempilhamento de exceções do primeiro marco ("Outside the first milestone"). Com o ownership determinístico do capítulo 8, `defer` perde boa parte da urgência: a memória já é liberada no fim do escopo sem ele.

## Recursos que não compilam

### Generics

```snova
func identidade<T>(valor: T): T { return valor }
```
{% include exemplo.html status="planned" arquivo="c09_generico.snl" nota="Hoje: <code>error[SNV2001]: parse error at line 3, span 39..40</code> (o <code>&lt;</code>)." %}

- **Motivação:** coleções e algoritmos tipados sem duplicar código e sem apagar tipos em `any`.
- **Dependência:** é o maior bloco de trabalho pendente. `docs/roadmap/maturity.md` lista o que precisa ser especificado antes: inferência, restrições (`T: Contrato`), coerência, a escolha entre monomorfização e dicionários, diagnósticos e ABI. O ADR-0008 já prevê o uso: `T: ProcessorArchitecture` para escolher o backend estaticamente, desde que isso nunca amarre um compilador cruzado à CPU hospedeira.

### Herança

```snova
class Cachorro extends Animal { … }
```
{% include exemplo.html status="planned" arquivo="c09_heranca.snl" nota="Hoje: <code>extends Animal</code> é aceito e <strong>ignorado</strong>. <code>c09_extends_ignorado.snl</code> chama um método próprio de <code>Cachorro</code> e funciona (status 2); <code>c09_heranca.snl</code> chama o método herdado <code>som()</code> e falha com <code>SNV3001</code>." %}

O motivo de ser ignorado: `scopeSkipToBrace` (`ScopeParse.snl`) pula todos os tokens entre o nome da classe e a `{`, prestando atenção apenas à lista depois de `implements`. Portanto, `extends X` não é um erro de sintaxe. Ele simplesmente não tem efeito. O próximo passo do plano de maturidade é acrescentar herança e restrições genéricas "à linguagem, à semente, ao executor SnBC e aos diagnósticos **antes** de usá-las no código do compilador".

### Imports entre arquivos

Tratado no capítulo 4: `import` é descartado, e a saída hoje é juntar os arquivos. É o **próximo portão de arquitetura** do projeto, porque exige trocar os arrays paralelos sobre um único buffer por identidades de arquivo e spans mapeáveis.

### Atribuição por índice `a[i] = v`

```snova
var xs = [1, 2, 3]
xs[0] = 9
```
{% include exemplo.html status="planned" arquivo="c09_atribuicao_indice.snl" nota="Hoje: <code>error[SNV3001]: unsupported construct or invalid lowering at line 7, function #0</code>." %}

Este caso mostra bem como funciona o bootstrap. As sondas do projeto mostraram que o `snl run-snbc` v0.3.0 **recusa** imagens com `SET_INDEX` (opcode 41), e o validador do compilador novo ainda rejeita esse opcode (`validateCode` em `ImageCode.snl`). Como a raiz não aceitava, o compilador foi escrito sem atribuição por índice: a única mutação disponível era `SET_FIELD` em structs (ADR-0004). A biblioteca `IntArray` contorna isso guardando cada elemento em um `IntCell` (uma classe de um campo) e alterando o campo. O comentário em `bootstrap/library/IntCell.snl` explica: "The seed subset has no index assignment, so mutable indexed storage is an array of cells whose field changes." Agora que o compilador nativo se compila sozinho, essa restrição da raiz pode cair, e o ADR-0007 diz explicitamente que as regras serão relaxadas por um novo ADR.

### `try`/`catch`/`throw`

```snova
try { return 1 } catch e { return 2 }
```
{% include exemplo.html status="planned" arquivo="c09_try.snl" nota="Hoje: <code>try</code> nem é palavra reservada, e o programa falha com <code>SNV3001</code>." %}

O `snovac` tinha exceções com desempilhamento completo só no interpretador. O compilador novo adotou um contrato diferente na arquitetura: "cada fase recebe dados explícitos e retorna resultados/diagnósticos; erros não interrompem o processo por exceções antes de existir suporte validado" (`docs/architecture/overview.md`). Se exceções voltarem, será por decisão própria, com ADR.

### Números de ponto flutuante, `decimal` e `char`

```snova
let d = 1.5      // SNV2001 no "."
let c = 'a'      // SNV1001
```
{% include exemplo.html status="planned" arquivo="c09_decimal.snl" nota="Hoje: <code>error[SNV2001]: parse error at line 4, span 56..57</code>." %}

O lexer só reconhece dígitos decimais. `1.5` vira `1`, `.`, `5`, e o `.` seguido de número é erro de sintaxe. Os opcodes de `double` já existem na numeração do SnBC herdada do `snovac`, mas o ADR-0004 registra que "opcodes que o compilador não usa (double, globals, variants, defer/spawn) falham com `unsupported opcode`".

### Pequenas conveniências de sintaxe

| Forma | Hoje | Substituto que funciona |
| --- | --- | --- |
| `x += 1`, `x++` | `SNV2001` | `x = x + 1` |
| `c ? a : b` | `SNV2001` | `if c { … } else { … }` com `return` ou atribuição (`match` não aceita `true`/`false` como padrão) |
| `let LIMITE = 10` global | `SNV2001` | `func limite(): int = 10` |
| `this.campo` | `SNV3001` | `campo` |
| `Classe { campo: v }` | `SNV3001` | `Classe(v)` |
| `"abc".len()` | erro de execução | — |

## Recursos de arquitetura no plano

| Recurso | Por que importa | Fonte |
| --- | --- | --- |
| Parâmetros variádicos tipados `valores: int...` | Viram um array tipado; não confundir com varargs da ABI C | ADR-0008 |
| Referências fracas | Permitem estruturas cíclicas sem quebrar o ownership | ADR-0006 |
| Borrow checker no frontend (regras `SNOVA0240`–`0251` do `snovac`) | Rejeitar uso após movimento na compilação; o backend poderia descartar contagens dinâmicas | ADR-0006 |
| IR tipada e validada entre frontend e backend | Hoje o emissor escreve SnBC direto e o nativo traduz opcodes | `maturity.md` |
| Backend x86-64 Linux (SysV, ELF) | Próximo alvo nativo completo (T2) | ADR-0008 |
| Eliminação de código morto no executável | Um "olá" carrega o runtime inteiro (20 mil linhas) | ADR-0006 |
| Escritor de Mach-O em Snova (N4) | Remover `as` e `ld` | ADR-0005 |

## O que parecia insolúvel

Este capítulo apontou funções e arquivos do compilador dezenas de vezes: `scopeEmitFor`, `validateCode`, `scopeSkipToBrace`, `CompilerState`. Falta juntar as peças: como um programa de 8 mil linhas em Snova lê o próprio código-fonte, produz bytecode, executa esse bytecode em si mesmo e chega a um ponto fixo? O capítulo 10 percorre o compilador do primeiro byte ao último.
