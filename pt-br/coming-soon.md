---
title: Coming Soon e Roadmap Técnico
description: Especificação transparente e baseada no código-fonte de cada recurso planejado ou em andamento no plano de segurança de memória (P1-P11), tipos, backends, biblioteca padrão e ferramentas.
page_id: coming-soon
section_label: Ferramentas e Roadmap
permalink: /pt-br/coming-soon/
---

Todos os itens abaixo foram extraídos diretamente de `docs/spec/memory-safety.md`, `docs/plans/memory-safety-execution.md`, `docs/plans/memory-safety-progress.md`, `docs/language-status.md`, `src/sema/check.h`, `builtin/readme.md` e `snova-lsp/README.md`. Sintaxes marcadas como **`[PROPOSED — Pn]`** fazem parte do contrato normativo para o estágio `Pn` e **ainda não são aceitas** pelo parser ou runtime ativos em `src/`.

## 1. Roadmap de Segurança de Memória e Sistemas (Estágios P1–P11)

| Estágio | Estado | Escopo e Entregáveis Principais |
| --- | --- | --- |
| **P0** | {% include status-badge.html status="implemented" label="Concluído" %} | Auditoria baseada no código-fonte do compilador ativo em `src/`, backends e lacunas. |
| **P1** | {% include status-badge.html status="in_progress" %} | Contrato normativo (`docs/spec/memory-safety.md`), pipeline de segurança compartilhado em todas as rotas, `SnTargetDescriptor` e verificações `SNOVA0401`–`0403` implementados localmente; Darwin/AArch64 qualificado. Portões abertos: execução em CI Linux x86-64, gate executável Windows x86-64 e aprovação formal do CODEOWNER (`@yurimoinhos`). |
| **P2** | {% include status-badge.html status="coming_soon" %} | IR explícito de CFG e `Place` (`src/ir/`): IDs de função/bloco, locais tipados, `Place = local + projeções de campo/índice/deref`, curto-circuito explícito, arestas de limpeza para `finally`/`defer`, verificador estrutural e remoção do teto `SN_BORROW_MAX = 96`. |
| **P3** | {% include status-badge.html status="coming_soon" %} | Análise de fluxo de dados por *worklist* monótona sobre o CFG: fatos *maybe-uninitialized* e *maybe-moved*, vivacidade retroativa, validade de empréstimos, sintaxe explícita `&mut T` / `&mut expr`, empréstimos disjuntos por campo (`s.a` vs `s.b`), resumos interprocedurais, rejeição de escape sem promoção silenciosa ao heap e invalidação de provas de tamanho após mutação/redução. |
| **P4** | {% include status-badge.html status="coming_soon" %} | RAII determinístico e elaboração de drops: destruição em ordem reversa de declaração, `defer` LIFO em todas as arestas de saída, proprietário único `Unique<T>` (move-only) com identidade de alocador/layout (`Unique.tryNew`), *pinning* opcional e `close()` como transição de estado. |
| **P5** | {% include status-badge.html status="coming_soon" %} | Sistema de efeitos `unsafe` preservado (`unsafe func`, `unsafe method`, `unsafe { ... }`), ponteiros brutos distintos `*const T` e `*mut T`, rastreamento de proveniência/geração em builds verificados, aritmética de ponteiros verificada (`offset`, `distanceTo`), proibindo desreferência *one-past* e subtração entre alocações distintas. |
| **P6** | {% include status-badge.html status="coming_soon" %} | Ownership compartilhado/fraco com bloco de controle dividido: `Shared<T>` / `Weak<T>` atômicos transferíveis (`Send` quando `T: Send + Sync`) e `LocalShared<T>` / `LocalWeak<T>` não atômicos para thread única (não-`Send`). Política v1 ratificada: ciclos de referências fortes são seguros em memória e podem vazar; `Weak<T>` quebra ciclos deterministicamente. |
| **P7** | {% include status-badge.html status="coming_soon" %} | Layout de structs/enums derivado do target (`sizeof`, `alignof`, `offsetof`, padding, tags) e ABI C FFI estável (`ByteView.fromForeignChecked`, impedindo unwinding de exceções da linguagem através de frames C externos). |
| **P8** | {% include status-badge.html status="coming_soon" %} | Mapeamentos de memória virtual hospedados: `MappedRegion.anonymous` seguro (separando `READ`/`WRITE`/`EXEC`, nunca expondo `WRITE + EXEC` seguro), `MappedRegion.mapFile` marcado como `unsafe` (contrato de truncamento externo) e visões emprestadas `ByteView`/`ByteSpan` impedindo `close`/`remap` enquanto vivas. |
| **P9** | {% include status-badge.html status="blocked" %} | Capacidades MMIO de dispositivo (`DeviceRegion`, leituras/escritas voláteis `unsafe` distintas de atômicas). Bloqueado aguardando seleção concreta de placa/provedor de SO. |
| **P10** | {% include status-badge.html status="coming_soon" %} | Corpus compartilhado multi-backend, verificador tipado de pilha/CFG no SnBC, fuzzing sustentado de parser/checker/bytecode, ASan/UBSan/TSan e injeção de falhas. |
| **P11** | {% include status-badge.html status="coming_soon" %} | Gates de teste de mutação por módulo (Mull) com pisos medidos para CFG/empréstimos, aritmética de ponteiros, loader SnBC, bounds, blocos de controle e mapeamentos. |

### Prévia da Sintaxe Ratificada do Contrato P1 (`[PROPOSED — P5/P8]`)

Ainda não aceita pelo parser ativo; reproduzida diretamente de `docs/spec/memory-safety.md`:

```snova
// [PROPOSED — P5] Separação entre obrigação do chamador (`unsafe func`) e permissão no corpo (`unsafe { ... }`)
func readChecked(x: &int): int {
    let p: *const int = x as *const int
    unsafe {
        return *p
    }
}

// [PROPOSED — P8] Mapeamento anônimo seguro com visões limitadas ao tempo de vida
func mapAndRead(): int {
    var region = MappedRegion.anonymous(4096, MapAccess.READ_WRITE).unwrap()
    if true {
        let view = region.view()
        let _ = view.get(0)
    }
    region.close() // rejeitado em compilação se `view` ainda estiver viva
    return 0
}
```

## 2. Parser, Sistema de Tipos e Semântica {% include status-badge.html status="coming_soon" %}

Registrado diretamente em `docs/language-status.md` e `src/sema/check.h`:

- **Literais de função em chamadas concorrentes (`SNOVA0148`)**: Aceitar literais de função passados para `spawn`, `scope` e `Parallel` sem invocação imediata (remove as 3 exceções em `tests/conformance.allow`).
- **Genéricos completos**: Checagem de *bounds* de parâmetros genéricos, substituição de parâmetros de tipo nos pontos de chamada (fazendo métodos em `Container<int>` retornarem `int` em vez de `T`) e inferência de argumentos genéricos pelo uso.
- **Inferência bidirecional de tipo esperado**: Propagação do tipo esperado para lambdas sem anotação, expressões `if`/`match` como valor, literais de struct e payloads de padrões de `match`.
- **Tuplas**: Adição de tuplas em `SnTypeTag` com construção e verificação de compatibilidade.
- **Protocolo `Iterable`**: Generalização de laços `for` além de intervalos inteiros, arrays e `Channel<T>`.
- **Tipo comum em literais de array**: Inferir um supertipo comum atribuível em vez de ancorar apenas no primeiro elemento (`SNOVA0149`).
- **Operador `?` finalizado**: Formalização da semântica de propagação de erro além do desembrulhamento provisório atual de `Option`/`Result`.
- **Checagem estática de interpolação**: Expor subexpressões `${expr}` na AST e no verificador semântico em vez de reanalisá-las apenas em runtime.
- **Protocolo de hashing**: Viabilizar `Map` e `Set` baseados em tabela hash (atualmente busca linear por igualdade).

## 3. Paridade de Backends e Execução Nativa {% include status-badge.html status="coming_soon" %}

- **Lowering de exceções e limpeza em SnBC / Nativo**: Suporte a `try`, `catch`, `finally` e `throw` (encerrando `SNOVA0400`) e execução de `defer` durante erros de runtime em `run-snbc` e `snl build` com a mesma semântica de `snl run`.
- **Remoção do limite de 8 argumentos em `OP_DEFER`**: Expandir a aridade aceita pelo bytecode SnBC.
- **Chamadas de host no runner nativo**: Expor sockets TCP/UDP, relógio monotônico e mutexes do SO em executáveis gerados por `snl build`, igualando `Net`, `HttpServer`, `Time`, `Mutex<T>` e `Channel<T>` ao interpretador.
- **Qualificação de targets**: Promover `x86_64-unknown-linux-gnu` e `x86_64-pc-windows-gnu` de `PENDING_VALIDATION` para `QUALIFIED` com portões executáveis de CI.

## 4. Concorrência, HTTP e E/S em Streaming {% include status-badge.html status="coming_soon" %}

- **Escalonamento assíncrono concorrente**: Agendar `Async.spawn`, `Async.scope` e `TaskScope.spawn` concorrentemente em vez da execução inline atual, com modelagem estrita de `Task<T>` no checker.
- **`Channel<T>` bloqueante e `select`**: Operações bloqueantes de envio/recebimento, `select` e integração com escalonador; sincronização atômica/bloqueante entre threads para `Semaphore` e `WaitGroup`.
- **HTTP/1.1 avançado**: TLS, *chunked transfer encoding*, conexões persistentes *keep-alive*, corpos binários e escalonamento concorrente de requisições no `HttpServer`.
- **E/S incremental de bytes**: Streams binários incrementais em `FileInputStream`/`FileOutputStream` além do buffer atual de arquivo texto inteiro.

## 5. Ferramentas e Self-Hosting {% include status-badge.html status="coming_soon" %}

- **Migração completa de `snova-lsp` para Snovalang (`SL-2`)**: Mover o servidor stdio em C e a ponte de análise com `snovac` para `Snova.Lsp` (`.snl`).
- **Bootstrap self-hosted reproduzível**: Recompilação reproduzível e verificação por *diverse double-compilation* de `bootstrap/src/compiler.snl`.
- **Publicação em galerias oficiais**: Entrada na galeria oficial de extensões do Zed, junto com publicação automatizada no Visual Studio Marketplace, Open VSX e JetBrains Marketplace.
