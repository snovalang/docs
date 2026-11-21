---
title: Memória, Ownership e Erros
description: Regras ativas do borrow checker, gerenciamento de regiões/arenas no runtime, semântica real de defer, Error verificado vs Exception não verificada e paridade entre backends.
page_id: memory-and-errors
section_label: Referência da Linguagem
permalink: /pt-br/memory-and-errors/
---

Snovalang **não possui garbage collector**. A documentação separa explicitamente **o que o compilador ativo em `src/` impõe hoje (`[CURRENT]`)** do **contrato faseado de segurança de memória (`P1`–`P11`)** descrito em [Coming Soon]({{ '/pt-br/coming-soon/' | relative_url }}).

## Ownership e Borrow Checking Ativos (`src/sema/borrow*.c`)

O passe `sn_borrow_func` executa a partir do verificador em todas as rotas de entrada (`check`, `run`, `emit-snbc`, `build`, `build --project --runtime`).

### Regras Impostas Hoje (`[CURRENT]`)

| Regra | Diagnóstico | Comportamento |
| --- | --- | --- |
| Move de valor não copiável | `SNOVA0240` | Usar um array, struct ou classe após move é rejeitado. Reatribuir uma `var` reinicializa o binding; atribuição composta exige valor vivo. |
| Referência que sobrevive ao dono | `SNOVA0241` | Atribuir `&local` a uma variável `&T?` externa cujo escopo sobrevive ao bloco de `local` é rejeitado. |
| Conflito de empréstimo exclusivo | `SNOVA0242` | Empréstimo exclusivo conflitante enquanto outro empréstimo está ativo. |
| Mutação sob empréstimo compartilhado | `SNOVA0243` | Modificar uma variável enquanto um empréstimo `&x` está ativo é rejeitado. |
| Envio entre tarefas com empréstimo/mutação | `SNOVA0244` | Compartilhar ou enviar valor emprestado/mutável através de fronteiras de tarefas. |
| Desreferência nula | `SNOVA0245` | Desreferenciar um `&T?` sabidamente nulo. |
| Limite estático de array | `SNOVA0246` | Acesso estático fora dos limites. Em tempo de execução, índices também são verificados contra o comprimento atual (inclusive após `pop()` e `clear()`). |
| Captura insegura por `defer` | `SNOVA0247` | Empréstimo inválido capturado por `defer`. |
| Limite de capacidade do checker | `SNOVA0248` | O rastreador ativo tem teto fixo de `SN_BORROW_MAX = 96` entradas; ao atingir o limite, rejeita explicitamente em vez de ignorar silenciosamente. |
| Conflito em desvio / laço | `SNOVA0249` / `SNOVA0250` | Mesclagem conservadora de desvios e visita conservadora de laços. |
| Move parcial | `SNOVA0251` | Mover um elemento ou campo para fora de um agregado. |

Exemplo rejeitado com `SNOVA0243`:

```snova
func main(): int {
    var x = 1
    let r = &x
    x = 2       // error[SNOVA0243]: mutação enquanto `x` está emprestado
    return *r
}
```

### Limites Conhecidos do Checker Atual

- Ainda **não** existem `&mut T` nem tipos distintos de ponteiro bruto (`*const T` / `*mut T`) no parser ativo.
- O checker atual faz snapshot de estado em ramos e visita laços uma única vez, sem CFG completo; arestas exatas de exceção, múltiplos *backedges*, empréstimos disjuntos por campo e provas gerais de tempo de vida pertencem a **P2–P3**.
- O compilador ativo ainda **não** fornece destrutores automáticos nem prova geral de ausência de vazamentos.

## Gerenciamento de Memória no Runtime (`src/eval/rt_mem.c`)

- **`SnArena`**: Dados de compilação (tokens, AST, strings internadas, tipos) são alocados em blocos alinhados liberados em grupo. Defina `SNOVA_MEMORY_STATS=1` para inspecionar uso, reserva e *slack*.
- **Regiões do interpretador**: `snl run` aloca regiões privadas para chamadas, blocos, laços e ramos de `match`. Regiões sem escape são liberadas ao fim do escopo. Retornos e gravações em ambientes externos percorrem arrays, objetos, variantes, referências e closures alcançáveis para reter as regiões proprietárias (análise de escape, não GC por rastreamento).
- **Teto de heap de fallback**: O interpretador impõe limite de **64 MiB** por execução e encerra com código de saída **`70`** se excedido.
- **Arrays e strings**: Arrays mantêm cabeçalho estável e buffer de crescimento geométrico registrado na região proprietária; `pop()` e `clear()` liberam slots removidos.

## Semântica Real de `defer` (`[CURRENT]`)

<div class="callout callout-warn">
  <span class="callout-title"><code>defer</code> NÃO é RAII automático</span>
  <code>defer</code> é um agendador explícito de chamadas no nível de instrução. O compilador não insere destrutores nem chamadas <code>drop</code> automáticas, e tipos do usuário ainda não possuem hook de destrutor (disposição automática via <code>Unique&lt;T&gt;</code> é proposta de P4).
</div>

Comportamento verificado em `snl run` (`src/eval/rt_defer.c`):

1. **Operando**: Deve ser chamada direta a uma função nomeada de nível superior (`defer limpar(a, b)`). Chamadas de método (`defer obj.fechar()`) falham em runtime com `SNOVA0305`.
2. **Escopo de frame de função, não de bloco**: Um `defer` dentro de `if` ou laço registra-se no frame da **função** envolvente e roda na saída da função. Executar `defer` três vezes em um laço agenda três chamadas.
3. **Argumentos avaliados no registro**: `var n = 1; defer show(n); n = 2` chama `show(1)`. Valores não copiáveis passados por valor são movidos para a chamada adiada (`SNOVA0240` em uso posterior).
4. **Ordem LIFO antes de liberar o frame**: Roda do mais recente ao mais antigo antes de `sn_rt_frame_pop`. O valor de retorno já está fixado antes da execução dos `defer`.
5. **Todas as arestas de saída e não-supressão**: Executa em saída normal, `return`, `throw` não capturado e erros de runtime (`SNOVA0304`). Um erro em um `defer` **não** suprime os `defer` anteriores.
6. **Prioridade de motivos de saída**:
   - Um `throw` original prevalece sobre exceções lançadas por chamadas `defer`.
   - Em saída normal ou `return`, uma exceção em `defer` substitui a saída; se vários `defer` lançarem exceções, vence o último a rodar (registro mais antigo).
   - Erros de runtime são persistentes (*sticky*) e não podem virar exceção capturável.

## Tratamento de Erros: `Error`, `Exception` e `try`/`catch`/`finally`

A hierarquia em `builtin/errors/hierarchy/types/Errors.snl` separa estritamente dois mundos:

- **`Error` (verificado)**: Raiz de erros verificados (`ParseError`, `MathError`, `IoError`, `ValidationError`, `TimeoutError`, `CancelledError`). Chamar rotina com `throws TipoErro`, lançar `Error` diretamente ou chamar `Result<T, E>.unwrap()` quando `E` estende `Error` exige capturar ou declarar `throws` (`SNOVA0141`).
- **`Exception` (não verificada)**: Raiz separada para falhas em tempo de execução (`RuntimeException`, `IllegalArgumentException`, `IllegalStateException`, `IndexOutOfBoundsException`, `ArithmeticException`, `MissingValueException`, `CancellationException`, `IoException`, `NullPointerException`, `WrappedException`). Capturar `Exception` nunca satisfaz um `Error` verificado.

### Semântica de `try` / `catch` / `finally` (`snl run`)

- Cláusulas `catch` são testadas na ordem do código pelo tipo em runtime (`catch` sem tipo captura qualquer valor lançado).
- `finally` executa em saída normal, `return`, exceção capturada, exceção propagada/relançada e erro de runtime.
- Se `finally` terminar normalmente, o `return`, `throw` ou erro de runtime pendente é preservado intacto.
- `return` ou `throw` dentro de `finally` sobrescreve `return`/`throw` pendente, mas **não** cancela erro de runtime pendente (o processo ainda termina com status `1`).
- Erros de runtime (`SNOVA0304`, etc.) **não** são capturáveis por `try`/`catch`.

## Paridade Medida Entre Rotas de Execução

| Recurso | `snl run` (Interpretador) | `emit-snbc` + `run-snbc` | `snl build` (Nativo) |
| --- | --- | --- | --- |
| `defer` em saída normal / `return` | Passa | Paridade | Paridade |
| Aridade de `defer` | Sem limite | Máx. 8 argumentos (`OP_DEFER`) | Máx. 8 argumentos |
| `defer` + `throw` | Passa | Rejeitado (`SNOVA0400`) | Rejeitado (`SNOVA0400`) |
| `defer` + erro de runtime | Todos os `defer` rodam, status 1 | **Diverge**: aborta sem rodar `defer` | **Diverge** igualmente |
| `try` / `catch` / `finally` | Passa | Rejeitado (`SNOVA0400`) | Rejeitado (`SNOVA0400`) |
| Diagnósticos de ownership (`SNOVA0240`–`0251`) | Ativo | Ativo (checker compartilhado) | Ativo (nenhum binário gravado) |
