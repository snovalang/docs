---
title: Concorrência e Pulsar
description: Funções assíncronas (async/await), concorrência por atores/streaming com Pulsar, Channel<T>, primitivas de sincronização e Context.
page_id: concurrency
section_label: Referência da Linguagem
permalink: /pt-br/concurrency/
---

Snovalang oferece dois mecanismos de concorrência no nível da linguagem — **`async`/`await`** e **Pulsar** — acompanhados de primitivas em código-fonte em `builtin.concurrent.*` e `builtin.context.*`.

## `async` e `await`

### Regras da Linguagem (`src/parse/parse_decl.c`, `src/sema/check.h`)

- `async` modifica `func` ou `method`: `async func buscar(): int { ... }`.
- `await` só é válido dentro de `async func` ou `async method` (caso contrário reporta `SNOVA0013`).
- Uma rotina **não** pode ser simultaneamente `async` e `pulsar` (`SNOVA0125`).

```snova
package demo.async_example

async func four(): int {
    return 4
}

async func main(): int {
    return await four()
}
```

### Fronteira Atual do Runtime

- **Checagem de tipos**: `await` desembrulha um tipo literalmente chamado `Task<T>` para `T` e mantém inalterados os demais tipos de operando (`src/sema/check.h`).
- **Execução**: `src/eval/async.c` (`SnAsyncLoop`, `sn_async_spawn`, `sn_async_spawn_owned`, `sn_async_loop_run`) está compilado e linkado em `snl` e `libsnovart.a`, porém o interpretador ativo executa hoje `Async.spawn`, `Async.scope` e `TaskScope.spawn` **inline**, e `Async.sleep` bloqueia a execução atual. O agendamento concorrente real de `Async`/`TaskScope` está listado em [Coming Soon]({{ '/pt-br/coming-soon/' | relative_url }}).

## Concorrência Pulsar

Pulsar é o modelo de atores e streaming da Snovalang (`src/sema/check.h`, `src/sema/borrow_task.c`, `src/eval/pulsar.h`, `src/native/native_backend.c`).

### Sintaxe e Regras Estáticas

1. **Declaração**: Prefixe uma função ou método com `pulsar`:
   ```snova
   pulsar func worker(): unit {
       Console.printline("executando")
   }
   ```
2. **Tipos de retorno permitidos (`SNOVA0122`)**: Uma rotina `pulsar` deve retornar `unit`, `Channel<T>` ou `Select<T>`. Assinaturas de streaming podem usar `~>`: `(T) ~> Channel<R>`.
3. **Invocação exclusiva via disparo (`SNOVA0124`)**: Funções `pulsar` **não** podem ser chamadas diretamente; precisam ser disparadas com a instrução `pulsar`:
   ```snova
   func main(): int {
       pulsar worker()
       return 0
   }
   ```
   A forma em bloco `pulsar { ... }` também é suportada pelo parser (`SN_STMT_PULSAR`).
4. **Segurança de captura (`src/sema/borrow_task.c`)**:
   - Capturar variável mutável em fronteira Pulsar gera `SNOVA0125`.
   - Capturar valor não-`Send` em fronteira Pulsar gera `SNOVA0126`.
5. **Sintaxe receive-bind**: `x <~ ch`, `ok, val <~ ch.tryReceive()` e `for v <~ ch { ... }` são analisados em `SN_STMT_VAR` / `SN_STMT_FOR`.

### Implementação no Runtime

- **Pool C do host (`src/eval/pulsar.h` / `pulsar.c`)**: Pool de threads de plataforma (`sn_pulsar_pool_create`, `sn_pulsar_pool_submit`, `sn_pulsar_pool_submit_owned`, `sn_pulsar_pool_wait`, `sn_pulsar_pool_destroy`) com limite de **1.024 itens** na fila e limpeza exatamente uma vez para contextos proprietários. Linkado em `snl` e `libsnovart.a`.
- **Runner nativo (`src/native/native_backend.c`)**: Executáveis nativos gerados emitem sua própria fila de workers Pulsar (`OP_SPAWN`) e propagam falhas de workers para o código de saída do processo após o *join*.

## Canais (`builtin.concurrent.channels.queues`)

`Channel<T>` é uma fila FIFO limitada protegida por mutex do sistema operacional, com enums explícitos para operações não bloqueantes:

```snova
enum ChannelSendStatus {
    Sent,
    Full,
    Closed
}

enum ChannelReceiveStatus<T> {
    Value(value: T),
    Empty,
    Closed
}
```

Operações principais de `Channel<T>`:

- `Channel<T>.new(capacity: int): Channel<T>` — capacidade negativa lança `IllegalArgumentException`; capacidade `0` não aceita valores via `trySend`.
- `trySend(value: T): ChannelSendStatus` — envio atômico não bloqueante.
- `tryReceive(): ChannelReceiveStatus<T>` — leitura atômica não bloqueante; drena valores em buffer após fechamento antes de retornar `Closed`.
- `capacity()`, `length()`, `isEmpty()`, `isClosed()`, `close()`, `dispose()` — chame `dispose()` após fechar e drenar o canal para liberar o mutex do host.

<div class="callout callout-warn">
  <span class="callout-title">Fronteira de <code>Channel</code> e Backend Nativo</span>
  Envio/recebimento bloqueante, <code>select</code> e integração com escalonador ainda não estão implementados. Como <code>Channel&lt;T&gt;</code> depende de mutexes do SO (<code>NativeMutex</code>), atualmente executa no interpretador (<code>snl run</code>); executáveis nativos ainda não expõem chamadas de host para mutex.
</div>

## Sincronização, Tarefas e `Context`

| Tipo | Pacote | Comportamento Atual |
| --- | --- | --- |
| `Task<T>` | `builtin.concurrent.async.tasks` | Armazena sucesso, falha ou cancelamento tipados, com `map`, encadeamento e recuperação separada de falha e cancelamento. |
| `CancellationToken` | `builtin.concurrent.async.tasks` | Valor de classe compartilhado; o cancelamento é visível a todos os portadores do mesmo token. |
| `Mutex<T>` | `builtin.concurrent.synchronization.primitives` | Apoiado por mutex do SO (`sn_runtime_mutex_*`) no interpretador; chame `close()` após o último `unlock`. |
| `Semaphore`, `WaitGroup` | `builtin.concurrent.synchronization.primitives` | Impõem invariantes de contador em execução single-thread; ainda não bloqueiam nem sincronizam entre threads do SO. |
| `Context` | `builtin.context.scoped.values` | Suporta cancelamento hierárquico, deadlines herdados (verificados em `isDone()`/`err()`), getters/setters escalares e `withTypedValue<T>` / `valueAs<T>(key, typeWitness)` com sombreamento em filhos. |
