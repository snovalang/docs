---
title: Biblioteca Builtin
description: Convención de nombres de paquetes, precedencia de descubrimiento, catálogo completo de las 18 áreas builtin y fronteras de soporte en runtime entre backends.
page_id: builtin-library
section_label: Compilador y Runtime
permalink: /es/builtin-library/
---

Todas las declaraciones estándar a nivel de lenguaje y las implementaciones en Snovalang pura residen en `builtin/` como archivos `.snl`. El verificador semántico resuelve y comprueba estos archivos mediante el sistema normal de paquetes en lugar de mantener un catálogo paralelo codificado en C.

## Convención de Paquetes y Descubrimiento

Los paquetes siguen `builtin.<general>.<abstraccion>.<concreto>.<Tipo>`, nombrando cada archivo según su tipo principal (por ejemplo, `builtin/network/http/data/types/Response.snl` declara `package builtin.network.http.data.types`).

### Precedencia de Descubrimiento del Toolchain (`src/driver/project.c`)

1. Variable de entorno `SNOVA_BUILTIN_DIR` (si está definida y el directorio existe).
2. Copia del toolchain junto al ejecutable `snl`: `<exe_dir>/../builtin` (cubre `<prefix>/bin/snl` + `<prefix>/builtin` y `build/snl` + `builtin/` en desarrollo) o `<exe_dir>/builtin`.
3. Respaldo de desarrollo/legado: `SNOVA_STD_PATH`, `~/.snovalang/std/src`, `.snovalang/deps/github.com/supernovalang/snova-std/src` del proyecto y búsqueda ascendente (hasta 8 niveles) desde la raíz de fuentes o el ejecutable.

## Catálogo de Paquetes Builtin

Verificado directamente en `builtin/readme.md` y en `builtin/`:

| Área | Paquete(s) | Tipos y Operaciones Clave |
| --- | --- | --- |
| **Tipos centrales** | `builtin.core.types.values` | `Object` (`toString`, `equals` por identidad, `hashCode`), `Option<T>`, `Result<T, E>`, `PrimitiveExtensions`. `Option`/`Result` y `Some`/`None`/`Ok`/`Err` están en el preludio implícito. |
| **Colecciones** | `builtin.collections.collections.types` | `Array<T>` (`map`, `flatten`, `fold`, `slice`, inserción, eliminación, predicados), `Map<K, V>` y `Set<T>` (búsqueda lineal por igualdad conservando orden de inserción, álgebra de conjuntos), `Partial<T>`. |
| **Jerarquía de errores** | `builtin.errors.hierarchy.types` | `Error` verificado (`ParseError`, `MathError`, `IoError`, `ValidationError`, `TimeoutError`, `CancelledError`) y `Exception` no verificada (`RuntimeException`, `IllegalArgumentException`, `IllegalStateException`, `IndexOutOfBoundsException`, `ArithmeticException`, `MissingValueException`, `CancellationException`, `IoException`, `NullPointerException`, `WrappedException`, `Errors`). |
| **Consola y sistema de archivos** | `builtin.io.console.output`, `builtin.io.filesystem.operations` | `Console` (`print`, `printline`, `println`, `err`, `warn`, `log<T>`, `readLine`), `FileSystem` (lectura/escritura/existencia de texto y envoltorios `try*` devolviendo `Result` sobre `IoException`). |
| **Flujos de archivo** | `builtin.io.filesystem.streams.contracts`, `builtin.io.filesystem.files.streams.types`, `builtin.io.filesystem.streams.extensions` | `InputStream`, `OutputStream`, `FileInputStream`, `FileOutputStream`, extensión `readAll()`. Actualmente orientados a texto con buffer de archivo completo (escritura al `close()`). |
| **Proceso y runtime** | `builtin.process.arguments.values`, `builtin.process.environment.values`, `builtin.runtime.host.api` | `Runtime` (`readLine`, `fileExists`, `readText`, `writeText`, `environment`, `argumentCount`, `argument`), además de las fachadas `Args` y `Env`. |
| **Texto y matemáticas** | `builtin.text.text.values`, `builtin.math.arithmetic.operations` | `Text`; `Math` (aritmética verificada de `int`/`long`, multiplicación, división, potencias, `gcd`, `lcm`, `sqrt` iterativa y utilidades de rango en coma flotante). |
| **Parseo de cadenas** | `builtin.text.parsing.results` | `Strings`: parsers con validación de base/desbordamiento para enteros, anchos acotados, coma flotante, decimales y booleanos devolviendo `Result` (y `tryParse*` devolviendo `Option`). |
| **Funcional** | `builtin.functional.collections.operations` | `Functional`: `map`, `flatten`, `filter`, `fold`, recorrido y predicados *eager* sobre arrays. |
| **Tiempo** | `builtin.time.clock.values` | `Duration`, `Instant`, `Time` (aritmética verificada con `Result` + métodos de conveniencia que lanzan error; reloj monotónico en intérprete). |
| **Red** | `builtin.network.transport.sockets` | `Net`, `Socket`, `SocketAddress` (host + puerto), `TcpListener`, `TcpStream`, `TcpStreamExtensions`, `UdpSocket`. Validación de puertos/handles, operaciones con `Result`, `close()` idempotente y DNS numérico. |
| **Datos HTTP** | `builtin.network.http.data.types` | `Method`, `Header`, `Request`, `Response` (valida estado/cabeceras, conserva cabeceras repetidas y búsqueda *case-insensitive*). |
| **Servidor HTTP** | `builtin.network.http.server` | `HttpRequest`, `HttpResponse`, `HttpRoute`, `HttpWire`, `HttpServer` (`get`, `post`, `route`, `dispatch`, `serveNext`, `serve`, `listen`). |
| **Async y sincronización** | `builtin.concurrent.async.tasks`, `builtin.concurrent.synchronization.primitives` | `Task<T>`, `TaskScope`, `Async`, `CancellationToken`, `Mutex<T>`, `Semaphore`, `WaitGroup`. |
| **Canales** | `builtin.concurrent.channels.queues` | `Channel<T>`, `ChannelSendStatus`, `ChannelReceiveStatus<T>`. |
| **Contexto** | `builtin.context.scoped.values` | `Context` (cancelación, plazos heredados, valores escalares y `withTypedValue<T>` / `valueAs<T>(key, typeWitness)`). |
| **Tipos de memoria** | `builtin.memory.addressing.types` | `ByteSpan`, `SignedByteSpan` (vistas verificadas *zero-copy* sobre arrays Snovalang compartidos), `Address` (envoltorio opaco de `NativeWord` sin desreferencia), `NativeWord`. |
| **Utilidades** | `builtin.util.general.types` | `Pair`, `Util`. |

## Fronteras de Soporte en Runtime (`@Native`)

`@Native` marca una frontera de host que requiere implementación en runtime. La cobertura difiere entre `snl run` (intérprete) y `snl build` (runner nativo):

| Capacidad | `snl run` (Intérprete) | `snl build` (Runner Nativo) | Límites Actuales |
| --- | --- | --- | --- |
| E/S de consola (`Console.print*`, `readLine`) | {% include status-badge.html status="implemented" %} | {% include status-badge.html status="implemented" %} | — |
| E/S de archivos de texto (`Runtime` / `FileSystem`) | {% include status-badge.html status="implemented" %} | {% include status-badge.html status="implemented" %} | Lectura/escritura de archivo completo; aún sin flujos incrementales de bytes. |
| Argumentos y entorno (`Runtime` / `Args` / `Env`) | {% include status-badge.html status="implemented" %} | {% include status-badge.html status="implemented" %} | Pasados con `snl run app.snl -- arg1 arg2`. |
| Módulos puros en Snovalang (`Option`, `Result`, `Array`, `Map`, `Set`, `Math`, `Strings`, `Text`, `Functional`, `ByteSpan`) | {% include status-badge.html status="implemented" %} | {% include status-badge.html status="partial" %} | `Map`/`Set` usan búsqueda lineal (aún sin protocolo de hash). El subconjunto nativo rechaza `try`/`throw`. |
| Sockets TCP/UDP y `HttpServer` | {% include status-badge.html status="interpreter_only" %} | {% include status-badge.html status="coming_soon" %} | HTTP/1.1 síncrono, 1 petición por conexión TCP, `Content-Length`, límites de 16 KiB en cabeceras y 1 MiB en cuerpo de texto, respuestas 400/404/405. Sin TLS, chunked, keep-alive, cuerpos binarios ni concurrencia aún. |
| Reloj monotónico (`Time` / `Instant`) | {% include status-badge.html status="interpreter_only" %} | {% include status-badge.html status="coming_soon" %} | El runner nativo aún no expone llamadas de reloj del host. |
| `Mutex<T>` del SO y `Channel<T>` | {% include status-badge.html status="interpreter_only" %} | {% include status-badge.html status="coming_soon" %} | Solo `trySend`/`tryReceive` no bloqueantes; el runner nativo aún no expone llamadas de mutex del host. |
| `Async` / `TaskScope` / `Semaphore` / `WaitGroup` | {% include status-badge.html status="partial" %} | {% include status-badge.html status="coming_soon" %} | Ejecución inline / invariantes de un solo hilo; planificación concurrente en Coming Soon. |
