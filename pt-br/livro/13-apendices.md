---
title: "13. Apêndices"
description: Referência rápida da sintaxe implementada, matriz de compatibilidade por recurso e backend, tabela de opcodes SnBC, comandos, glossário e índice de todos os exemplos verificados.
page_id: livro-13
section_label: "Livro · Capítulo 13"
permalink: /pt-br/livro/13-apendices/
---

## A. Referência rápida da sintaxe implementada

Tudo nesta seção é {% include status-badge.html status="works_today" %} na VM e no nativo, salvo indicação.

```snova
package nome.pontilhado                // nenhum segmento pode ser palavra reservada
import qualquer.coisa                  // aceito e ignorado

// ---- funções -------------------------------------------------------------
func nome(a: int, b: string): int { … }
func curta(n: int): int = n * n       // corpo de expressão
func semRetorno(x: int) { … }          // devolve unit

// ---- variáveis -----------------------------------------------------------
let x = 1                              // reatribuível hoje
var y: int = 2                         // anotação opcional
var z: int                             // vale unit até ser atribuída

// ---- controle --------------------------------------------------------------
if cond { … } else if outra { … } else { … }
while cond { … break … continue … }
let r = match n { 0 -> "a", 1 -> "b", outro -> "c" }   // padrões: inteiro, _, nome

// ---- tipos compostos --------------------------------------------------------
struct P { public var x: int  public var nome: string }  // sem métodos nem inicializadores
let p = P { x: 1 }                     // campos omitidos = 0 / false / ""

class C implements Contrato {
    campo: int                         // var/let opcionais em classe
    outro: int = 5                     // inicializador permitido
    method m(): int { return campo }   // ou func; acesso implícito a campos
    public static method s(): int { return 1 }
}
let c = C(10)                          // construtor posicional, na ordem dos campos

interface Contrato { method m(): int }
trait T { method t(): int }
impl T for C { method t(): int { return 2 } }

// ---- arrays e strings ------------------------------------------------------
var xs: int[] = [1, 2]
xs.push(3)  xs.pop()  xs.len()  xs.length()  xs.get(0)  xs[0]
"a" + "b"   "a" == "b"   "\n \t \" \\"

// ---- E/S -----------------------------------------------------------------
Console.print(v)  Console.printline(v)  Console.println(v)
Runtime.argumentCount()  Runtime.argument(i)  Runtime.environment(nome)
Runtime.fileExists(p)  Runtime.readText(p)  Runtime.writeText(p, t)
read_bytes(p)  write_bytes(p, bytes)
```

Operadores por precedência crescente: `=` · `||` · `&&` · `|` · `^` · `&` · `==` `!=` · `<` `<=` `>` `>=` · `<<` `>>` · `+` `-` · `*` `/` `%` · prefixos `-` `!`.

## B. Matriz de compatibilidade

Legenda: **✓** funciona · **✗** não funciona · **C** compila e não executa · **D** diverge entre backends.

| Recurso | Compila | VM (Darwin) | Nativo `aarch64-apple-darwin` | Nativo `aarch64-unknown-linux-gnu`¹ | Nativo `x86_64-unknown-linux-gnu` |
| --- | --- | --- | --- | --- | --- |
| Inteiros, bool, string, null | ✓ | ✓ | ✓ | ✓ | ✗ (rejeitado) |
| Funções, recursão (≤ 256 quadros) | ✓ | ✓ | ✓ | ✓ | ✗ |
| `if`, `while`, `break`, `continue` | ✓ | ✓ | ✓ | ✓ | ✗ |
| `match` sobre inteiros | ✓ | ✓ | ✓ | não registrado | ✗ |
| Arrays (`push`, `pop`, `len`, `==`) | ✓ | ✓ | ✓ | ✓ | ✗ |
| Arquivos, argumentos, ambiente | ✓ | ✓ | ✓ | não registrado | ✗ |
| `struct`, `class`, `static` | ✓ | ✓ | ✓ | ✓ | ✗ |
| `interface`/`trait` (despacho dinâmico) | ✓ | **D** (bug de busca) | ✓ | ✓ | ✗ |
| Ciclos fortes de referência | ✓ | aceita | rejeita (status 70) | não registrado | ✗ |
| Memória: zero blocos vivos ao sair | — | não medido | ✓ | não registrado (o laço de memória bateu com a VM) | ✗ |
| Ponto fixo de autocompilação | — | ✓ (SnBC) | ✓ (assembly) | **✗** (assembly diferiu) | ✗ |
| `for … in` | C | ✗ (56) | ✗ (56) | ✗ | ✗ |
| `enum` | C | ✗ (42) | ✗ (42/43) | ✗ | ✗ |
| `defer`, `pulsar`, `async`/`await` | C | ✗ (53–55) | ✗ | ✗ | ✗ |
| `a[i] = v`, generics, herança, `try`, `double`, `char`, `+=`, ternário, globais | ✗ | — | — | — | — |

¹ Conforme `docs/roadmap/evidence.md`, 22/11/2026: 13 fixtures diferenciais em contêiner Docker Ubuntu 24.04 ARM64 (Hello, aritmética e fluxo, chamadas, compostos, igualdade, métodos estáticos, arrays, despacho de interface e trait, laço de memória). Não reexecutado neste livro; aqui foi verificado apenas que o compilador emite o assembly ELF com `_start`.

## C. Opcodes SnBC usados pelo compilador

Conferidos em `binOp` (`Emit.snl`), nos emissores, em `opcodeWidth` (`ImageCode.snl`) e nos executores. "Largura" é o tamanho dos operandos em bytes.

| # | Nome | Largura | Uso |
| --- | --- | --- | --- |
| 1 | `PUSH_INT` | 8 | literal inteiro (i64) |
| 3 | `PUSH_STRING` | 4 | índice no pool |
| 4 | `PUSH_BOOL` | 1 | 0 ou 1 |
| 5 | `PUSH_UNIT` | 0 | epílogo, `unit` |
| 6 | `POP` | 0 | descarta o topo |
| 7 | duplicar topo | 0 | existe nos executores; o emissor não gera |
| 8 / 9 | `LOAD_LOCAL` / `STORE_LOCAL` | 4 | `STORE` deixa o valor na pilha |
| 12–16 | `ADD` `SUB` `MUL` `DIV` `MOD` | 0 | `ADD` também concatena strings |
| 17 / 18 | `NEG` / `NOT` | 0 | prefixos `-` e `!` |
| 19–21 | `&` `\|` `^` | 0 | bits |
| 22 / 23 | `<<` / `>>` | 0 | `>>` aritmético |
| 24–29 | `==` `!=` `<` `<=` `>` `>=` | 0 | igualdade estrutural |
| 30 | salto incondicional | 4 | deslocamento relativo com sinal |
| 31 / 32 | salta se falso / se verdadeiro | 4 | `&&` usa 31, `\|\|` usa 32 |
| 33 | `CALL` | 8 | função, aridade |
| 35 | `RETURN` | 0 | |
| 36 | `NEW_OBJECT` | 8 | nome do tipo (pool), número de campos |
| 37 / 38 | `GET_FIELD` / `SET_FIELD` | 4 | índice do campo |
| 39 | `NEW_ARRAY` | 4 | número de elementos |
| 40 | `GET_INDEX` | 0 | sem verificação de limites |
| 41 | `SET_INDEX` | — | recusado pelo validador |
| 42 / 43 | criar / testar variante de `enum` | 8 / 4 | não executados |
| 45 | `PRINT` | 1 | com ou sem quebra de linha |
| 46 | `HALT` | 0 | |
| 47 / 48 | `read_bytes` / `write_bytes` | 0 | |
| 49 / 50 | `ARRAY_LEN` / `ARRAY_PUSH` | 0 | |
| 51 | `PUSH_NULL` | 0 | |
| 52 | armadilha | 0 | fim de `match` sem braço |
| 53 / 54 / 55 | `defer` / `pulsar` / chamada `async` | 8 | não executados |
| 56 | teste "array ou inteiro" do `for` | 0 | não executado |
| 57 | chamada de runtime | 8 | ID (2–7), aridade |
| 58 | `ARRAY_POP` | 0 | |
| 59 | `CALL_INTERFACE` | 8 | nome do método (pool), aridade com receptor |

Opcodes 10, 11, 34, 41 e 44 são recusados pelo validador. Os demais números até 59 que não aparecem aqui não são gerados pelo compilador atual.

## D. Comandos

| Objetivo | Comando |
| --- | --- |
| Construir o compilador | `make bootstrap-build` |
| Compilar para SnBC | `snova-bootstrap prog.snl prog.snbc` |
| Validar imagem | `snova-bootstrap prog.snbc` |
| Executar na VM | `snova-bootstrap prog.snbc run [args]` |
| Gerar assembly (a partir da raiz do repositório) | `snova-bootstrap prog.snl prog.s native [alvo]` |
| Montar e ligar (Darwin) | `as -arch arm64 prog.s -o prog.o && ld -arch arm64 -platform_version macos $V $V -syslibroot $SDK -lSystem -e _main prog.o -o prog` |
| Relatório de memória | `SNOVA_MEMORY_REPORT=1 ./prog` |
| Fumaça | `make bootstrap-smoke` |
| Diagnósticos | `make bootstrap-diagnostics` |
| Diferencial VM × oráculo | `make bootstrap-vm` |
| Diferencial nativo | `make bootstrap-native` |
| Interfaces e traits | `make bootstrap-oop` e `make bootstrap-oop-native` |
| Biblioteca | `make bootstrap-library` |
| Ponto fixo SnBC | `make bootstrap-fixed-point` |
| Autocompilação pela VM | `make bootstrap-vm-self` |
| Ponto fixo nativo | `make bootstrap-native-self` |
| Reprodutibilidade (dois builds limpos) | `make bootstrap-reproducible` |
| Pacote de pré-lançamento local | `make bootstrap-prerelease` |
| Todos os exemplos do livro | `SNOVA_REPO=… sh exemplos/livro/verificar.sh` |

## E. Glossário

**AAPCS64**: convenção de chamada do AArch64, usada em Darwin e em Linux.

**Bootstrap**: obter um compilador escrito na própria linguagem a partir de uma raiz que já existe.

**Bundle**: o `snova-bootstrap` gerado por `snl build`, com SnBC do compilador e a VM em C do `snl`.

**DDC (*Diverse Double-Compiling*)**: técnica que compila o compilador a partir de duas raízes independentes e compara os resultados. Ainda não demonstrada aqui.

**Diferencial**: comparar a saída e o status de dois executores para o mesmo programa.

**Empréstimo (*borrow*)**: uso de um valor sem tomar posse. No backend nativo, é decidido estaticamente para evitar contagens.

**Fronteira**: os stubs em assembly (`Primitive`, `System`, `_main`), únicos pontos que chamam a `libSystem`.

**Imagem SnBC**: arquivo de bytecode que começa com `SNBC`; veja o capítulo 10.

**Oráculo**: executor de referência contra o qual outro é comparado. A VM em Snova é o oráculo do nativo, e o `snl run-snbc` é o oráculo da VM.

**Ownership**: modelo em que cada valor no heap tem donos contados e é liberado quando o último dono some.

**Ponto fixo**: a geração N e a N+1 do compilador produzem artefatos idênticos para a mesma entrada.

**Pulsar**: palavra da Snova para iniciar uma tarefa concorrente (*spawn*).

**Raiz transitória**: o `snl v0.3.0`, que constrói a primeira geração.

**Semente**: o primeiro compilador em Snova, limitado ao subconjunto que a raiz compila.

**Slot**: célula de 16 bytes `(payload, etiqueta)` do backend nativo.

**Subconjunto cumulativo**: a regra de que o compilador N+1 só usa o que o N compila (ADR-0001).

## F. Índice de exemplos verificados

Todos em [`/exemplos/livro/`]({{ '/exemplos/livro/verificar.sh' | relative_url }}). A saída completa da última verificação está em [`resultados-de-referencia.txt`]({{ '/exemplos/livro/resultados-de-referencia.txt' | relative_url }}). Status de saída: VM / nativo. "—" indica rejeição na compilação.

| Arquivo | Cap. | Rótulo | VM / nativo | O que demonstra |
| --- | --- | --- | --- | --- |
| `c02_ola.snl` | 2 | funciona | 0 / 0 | primeiro programa |
| `c03_comentarios.snl` | 3 | funciona | 3 / 3 | comentários, `;` opcional |
| `c03_variaveis.snl` | 3 | funciona | 2 / 2 | `let`, `var`, sombreamento |
| `c03_sem_inicializador.snl` | 3 | funciona | 10 / 10 | local sem inicializador vale `unit` |
| `c03_let_reatribuido.snl` | 3 | funciona | 2 / 2 | `let` reatribuível |
| `c03_operadores.snl` | 3 | funciona | 0 / 0 | aritmética, bits, divisão por zero |
| `c03_precedencia.snl` | 3 | funciona | 0 / 0 | armadilha `&` × `==` |
| `c03_inteiros.snl` | 3 | funciona | 0 / 0 | overflow com wrap-around |
| `c03_controle.snl` | 3 | funciona | 25 / 25 | `if`, `while`, `break`, `continue` |
| `c03_match.snl` | 3 | funciona | 0 / 0 | `match` com inteiro, `_`, nome |
| `c03_match_sem_braco.snl` | 3 | funciona (erro esperado) | 70 / 70 | nenhum braço casa |
| `c03_pacote_palavra_chave.snl` | 2 | erro esperado | — / — | `SNV2001` em `package livro.match` |
| `c04_funcoes.snl` | 4 | funciona | 81 / 81 | ordem livre, `= expr`, recursão |
| `c04_profundidade.snl` | 4 | funciona (erro esperado) | 70 / 70 | limite de 256 quadros |
| `c04_return_quebrado.snl` | 4 | funciona | 0 / 0 | `return` + quebra de linha |
| `c04_global.snl` | 4 | erro esperado | — / — | globais não existem |
| `c04_param_sem_tipo.snl` | 4 | erro esperado | — / — | parâmetro exige tipo |
| `c04_modulos/` | 4 | funciona após juntar | 0 / 0 | vários arquivos |
| `c05_strings.snl` | 5 | funciona | 0 / 0 | concatenação, igualdade, escapes |
| `c05_bytes_texto.snl` | 5 | funciona | 0 / 0 | texto ↔ bytes via arquivo |
| `c05_string_len.snl` | 5 | erro esperado | 70 / 70 | strings sem `.len()` |
| `c05_string_ordem.snl` | 5 | erro esperado | 70 / 70 | strings sem `<` |
| `c05_arrays.snl` | 5 | funciona | 0 / 0 | operações de array |
| `c05_bordas.snl` | 5 | funciona | 0 / 0 | índice fora, ambiente ausente |
| `c05_pop_vazio.snl` | 5 | erro esperado | 70 / 70 | `pop` em array vazio |
| `c05_somar_array.snl` | 5 | funciona | 18 / 18 | percorrer com `while` |
| `c05_for.snl` | 5, 9 | planejado | 70 / — | opcode 56 |
| `c05_runtime.snl` | 5 | funciona | 0 / 0 | arquivos, argumentos, ambiente |
| `c06_struct.snl` | 6 | funciona | 11 / 11 | referência, igualdade, padrões |
| `c06_classe.snl` | 6 | funciona | 0 / 0 | construtor, métodos, `static` |
| `c06_campos_livres.snl` | 6 | funciona | 4 / 4 | campos sem `var`, `func` em classe |
| `c06_privado.snl` | 6 | funciona | 14 / 14 | `private` não aplicado |
| `c06_estatico_erro.snl` | 6 | erro esperado | — / — | `Tipo.metodoDeInstancia()` |
| `c06_this.snl` | 6 | erro esperado | — / — | `this` não existe |
| `c06_retorno_sem_tipo.snl` | 6 | erro esperado | — / — | tipo de retorno não chega à variável |
| `c06_retorno_anotado.snl` | 6 | funciona | 8 / 8 | solução com anotação |
| `c06_campo_de_array_erro.snl` | 6 | erro esperado | — / — | `xs[0].campo` |
| `c06_campo_de_array.snl` | 6 | funciona | 7 / 7 | solução com anotação ou parâmetro |
| `c06_campo_receptor.snl` | 6 | erro esperado | — / — | método em receptor que é campo |
| `c06_colaborador.snl` | 6 | funciona | 10 / 10 | solução com local |
| `c06_metodo_get.snl` | 6 | erro esperado | — / — | nome de builtin como método |
| `c06_interface.snl` | 6 | funciona | 19 / 19 | despacho por interface |
| `c06_interface_anotada.snl` | 6 | erro esperado | — / — | `SNV4001` sem subtipagem |
| `c06_interface_bug_vm.snl` | 6 | diverge | 70 / 19 | bug de busca na VM |
| `c06_trait.snl` | 6 | funciona | 0 / 0 | `trait` + `impl` |
| `c07_snv1001.snl` … `c07_snv5001.snl` | 7 | erro esperado | — / — | um por código de erro |
| `c07_snw0001.snl` | 7 | funciona com aviso | 0 / 0 | aviso de comparação |
| `c07_aridade.snl` | 7 | erro esperado | — / — | `invalid generated SnBC image` |
| `c07_nao_detectado.snl` | 7 | funciona (erro de execução) | 70 / 70 | erros que passam na compilação |
| `c08_memoria.snl` | 8 | funciona | 0 / 0 | memória constante |
| `c08_ciclo.snl` | 8 | diverge | 0 / 70 | ciclo aceito × rejeitado |
| `c09_enum.snl` | 9 | planejado | 70 / — | opcode 42 |
| `c09_defer.snl`, `c09_pulsar.snl`, `c09_async.snl` | 9 | planejado | 70 / — | opcodes 53, 54, 55 |
| `c09_generico.snl` | 9 | planejado | — / — | `SNV2001` |
| `c09_heranca.snl` | 9 | planejado | — / — | método herdado: `SNV3001` |
| `c09_extends_ignorado.snl` | 9 | funciona | 2 / 2 | `extends` ignorado |
| `c09_atribuicao_indice.snl` | 9 | planejado | — / — | `SNV3001` |
| `c09_try.snl` | 9 | planejado | — / — | `SNV3001` |
| `c09_decimal.snl` | 9 | planejado | — / — | `SNV2001` |
| `c11_fib.snl`, `c11_laco.snl`, `c11_alocacao.snl` | 11 | funciona | 66, 253, 224 | benchmarks |
