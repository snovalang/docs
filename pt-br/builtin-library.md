---
title: Biblioteca Builtin
description: Convenção de nomes de pacotes, precedência de descoberta, catálogo completo das 18 áreas builtin e fronteiras de suporte em runtime entre backends.
page_id: builtin-library
section_label: Compilador e Runtime
permalink: /pt-br/builtin-library/
---

Todas as declarações padrão de nível de linguagem e implementações em Snovalang pura vivem em `builtin/` como arquivos `.snl`. O verificador semântico lê e checa essas declarações pelo sistema normal de pacotes em vez de manter um catálogo paralelo codificado em C.

## Convenção de Pacotes e Descoberta

Os pacotes seguem `builtin.<geral>.<abstracao>.<concreto>.<Tipo>`, nomeando cada arquivo pelo tipo principal (por exemplo, `builtin/network/http/data/types/Response.snl` declara `package builtin.network.http.data.types`).

### Precedência de Descoberta do Toolchain (`src/driver/project.c`)

1. Variável de ambiente `SNOVA_BUILTIN_DIR` (se definida e existente).
2. Cópia do toolchain ao lado do executável `snl`: `<exe_dir>/../builtin` (cobre `<prefix>/bin/snl` + `<prefix>/builtin` e `build/snl` + `builtin/` em desenvolvimento) ou `<exe_dir>/builtin`.
3. Fallback de desenvolvimento/legado: `SNOVA_STD_PATH`, `~/.snovalang/std/src`, `.snovalang/deps/github.com/supernovalang/snova-std/src` do projeto e busca ascendente (até 8 níveis) a partir da raiz do código ou do executável.

## Catálogo de Pacotes Builtin

Verificado diretamente em `builtin/readme.md` e em `builtin/`:

| Área | Pacote(s) | Tipos e Operações Principais |
| --- | --- | --- |
| **Tipos centrais** | `builtin.core.types.values` | `Object` (`toString`, `equals` por identidade, `hashCode`), `Option<T>`, `Result<T, E>`, `PrimitiveExtensions`. `Option`/`Result` e `Some`/`None`/`Ok`/`Err` estão no prelúdio implícito. |
| **Coleções** | `builtin.collections.collections.types` | `Array<T>` (`map`, `flatten`, `fold`, `slice`, inserção, remoção, predicados), `Map<K, V>` e `Set<T>` (busca linear por igualdade preservando ordem de inserção, álgebra de conjuntos), `Partial<T>`. |
| **Hierarquia de erros** | `builtin.errors.hierarchy.types` | `Error` verificado (`ParseError`, `MathError`, `IoError`, `ValidationError`, `TimeoutError`, `CancelledError`) e `Exception` não verificada (`RuntimeException`, `IllegalArgumentException`, `IllegalStateException`, `IndexOutOfBoundsException`, `ArithmeticException`, `MissingValueException`, `CancellationException`, `IoException`, `NullPointerException`, `WrappedException`, `Errors`). |
| **Console e sistema de arquivos** | `builtin.io.console.output`, `builtin.io.filesystem.operations` | `Console` (`print`, `printline`, `println`, `err`, `warn`, `log<T>`, `readLine`), `FileSystem` (leitura/escrita/existência de texto e wrappers `try*` retornando `Result` sobre `IoException`). |
| **Streams de arquivo** | `builtin.io.filesystem.streams.contracts`, `builtin.io.filesystem.files.streams.types`, `builtin.io.filesystem.streams.extensions` | `InputStream`, `OutputStream`, `FileInputStream`, `FileOutputStream`, extensão `readAll()`. Atualmente orientados a texto com buffer de arquivo inteiro (gravação no `close()`). |
| **Processo e runtime** | `builtin.process.arguments.values`, `builtin.process.environment.values`, `builtin.runtime.host.api` | `Runtime` (`readLine`, `fileExists`, `readText`, `writeText`, `environment`, `argumentCount`, `argument`), além das fachadas `Args` e `Env`. |
| **Texto e matemática** | `builtin.text.text.values`, `builtin.math.arithmetic.operations` | `Text`; `Math` (aritmética verificada de `int`/`long`, multiplicação, divisão, potências, `gcd`, `lcm`, `sqrt` iterativa e auxiliares de faixa em ponto flutuante). |
| **Parsing de strings** | `builtin.text.parsing.results` | `Strings`: parsers com validação de base/overflow para inteiros, larguras limitadas, ponto flutuante, decimais e booleanos retornando `Result` (e `tryParse*` retornando `Option`). |
| **Funcional** | `builtin.functional.collections.operations` | `Functional`: `map`, `flatten`, `filter`, `fold`, travessia e predicados *eager* sobre arrays. |
| **Tempo** | `builtin.time.clock.values` | `Duration`, `Instant`, `Time` (aritmética verificada via `Result` + métodos de conveniência que lançam erro; relógio monotônico no interpretador). |
| **Rede** | `builtin.network.transport.sockets` | `Net`, `Socket`, `SocketAddress` (host + porta), `TcpListener`, `TcpStream`, `TcpStreamExtensions`, `UdpSocket`. Validação de portas/handles, operações com `Result`, `close()` idempotente e DNS numérico. |
| **Dados HTTP** | `builtin.network.http.data.types` | `Method`, `Header`, `Request`, `Response` (valida status/cabeçalhos, preserva cabeçalhos repetidos e consulta *case-insensitive*). |
| **Servidor HTTP** | `builtin.network.http.server` | `HttpRequest`, `HttpResponse`, `HttpRoute`, `HttpWire`, `HttpServer` (`get`, `post`, `route`, `dispatch`, `serveNext`, `serve`, `listen`). |
| **Async e sincronização** | `builtin.concurrent.async.tasks`, `builtin.concurrent.synchronization.primitives` | `Task<T>`, `TaskScope`, `Async`, `CancellationToken`, `Mutex<T>`, `Semaphore`, `WaitGroup`. |
| **Canais** | `builtin.concurrent.channels.queues` | `Channel<T>`, `ChannelSendStatus`, `ChannelReceiveStatus<T>`. |
| **Contexto** | `builtin.context.scoped.values` | `Context` (cancelamento, deadlines herdados, valores escalares e `withTypedValue<T>` / `valueAs<T>(key, typeWitness)`). |
| **Tipos de memória** | `builtin.memory.addressing.types` | `ByteSpan`, `SignedByteSpan` (visões verificadas *zero-copy* sobre arrays Snovalang compartilhados), `Address` (wrapper opaco de `NativeWord` sem desreferência), `NativeWord`. |
| **Utilitários** | `builtin.util.general.types` | `Pair`, `Util`. |

## Fronteiras de Suporte em Runtime (`@Native`)

`@Native` marca uma fronteira de host que exige implementação no runtime. A cobertura difere entre `snl run` (interpretador) e `snl build` (runner nativo):

| Capacidade | `snl run` (Interpretador) | `snl build` (Runner Nativo) | Limites Atuais |
| --- | --- | --- | --- |
| E/S de console (`Console.print*`, `readLine`) | {% include status-badge.html status="implemented" %} | {% include status-badge.html status="implemented" %} | — |
| E/S de arquivos texto (`Runtime` / `FileSystem`) | {% include status-badge.html status="implemented" %} | {% include status-badge.html status="implemented" %} | Leitura/escrita de arquivo inteiro; ainda sem streams incrementais de bytes. |
| Argumentos e ambiente (`Runtime` / `Args` / `Env`) | {% include status-badge.html status="implemented" %} | {% include status-badge.html status="implemented" %} | Repassados via `snl run app.snl -- arg1 arg2`. |
| Módulos puros em Snovalang (`Option`, `Result`, `Array`, `Map`, `Set`, `Math`, `Strings`, `Text`, `Functional`, `ByteSpan`) | {% include status-badge.html status="implemented" %} | {% include status-badge.html status="partial" %} | `Map`/`Set` usam busca linear (sem protocolo de hash ainda). Subconjunto nativo rejeita `try`/`throw`. |
| Sockets TCP/UDP e `HttpServer` | {% include status-badge.html status="interpreter_only" %} | {% include status-badge.html status="coming_soon" %} | HTTP/1.1 síncrono, 1 requisição por conexão TCP, `Content-Length`, limites de 16 KiB para cabeçalhos e 1 MiB para corpo texto, respostas 400/404/405. Sem TLS, chunked, keep-alive, corpos binários ou agendamento concorrente ainda. |
| Relógio monotônico (`Time` / `Instant`) | {% include status-badge.html status="interpreter_only" %} | {% include status-badge.html status="coming_soon" %} | Runner nativo ainda não expõe chamadas de relógio do host. |
| `Mutex<T>` do SO e `Channel<T>` | {% include status-badge.html status="interpreter_only" %} | {% include status-badge.html status="coming_soon" %} | Apenas `trySend`/`tryReceive` não bloqueantes; runner nativo ainda não expõe chamadas de mutex do host. |
| `Async` / `TaskScope` / `Semaphore` / `WaitGroup` | {% include status-badge.html status="partial" %} | {% include status-badge.html status="coming_soon" %} | Execução inline / invariantes single-thread; escalonamento concorrente está em Coming Soon. |
