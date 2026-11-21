---
title: CLI, LSP y Extensiones de Editor
description: Referencia completa de la CLI snl, gestor de dependencias mod.sns, variables de entorno, servidor snova-lsp (LSP 3.17) y extensiones oficiales para VS Code, JetBrains y Zed.
page_id: cli-and-tooling
section_label: Herramientas y Hoja de Ruta
permalink: /es/cli-and-tooling/
---

## Referencia de Línea de Comandos (`snl`)

Verificada directamente en `src/driver/main.c` y `src/driver/driver_utils_part1.inc`.

### Comandos Informativos

| Comando | Descripción |
| --- | --- |
| `snl --version` (`-V`) | Muestra la versión del compilador (`SNOVAC_VERSION`, etiqueta git o `dev`). |
| `snl --help` (`-h`) | Muestra el resumen de uso de la CLI. |
| `snl --target-info` | Muestra target triple activo, calificación, ancho/endianness de punteros, convención de llamada, anchos atómicos, página/granularidad, estado MMIO y anulaciones de entorno. |

### Archivo Único (Frontend y Ejecución)

| Comando | Descripción |
| --- | --- |
| `snl --emit=tokens <archivo>` | Ejecuta análisis léxico y vuelca el flujo de tokens con spans `línea:columna`. |
| `snl --check-lex <archivo>` | Solo análisis léxico; sale con código distinto de cero ante errores. |
| `snl --emit=ast <archivo>` | Analiza y vuelca la AST formateada. |
| `snl --check-parse <archivo>` | Análisis léxico y sintáctico con diagnósticos. |
| `snl check <archivo>` | Resuelve nombres, verifica tipos y ejecuta borrow check en un archivo `.snl` o `.sns`. |
| `snl run <archivo> [-- <args...>]` | Verifica y ejecuta con el intérprete *tree-walking* (`sn_eval_run`), reenviando `<args...>` a `Runtime.argument*`. |
| `snl emit-snbc <archivo.snl> -o <salida.snbc>` | Verifica, genera y guarda una imagen canónica `.snbc` little-endian y un listado determinista `.snbt` (solo acepta `.snl`). |
| `snl run-snbc <archivo.snbc>` | Carga, valida estructuralmente, compila mediante el runner nativo y ejecuta una imagen `.snbc` canónica. |
| `snl build <archivo> [-o <salida>] [--target=<triple>]` | Verifica, emite SnBC y compila un único archivo en un ejecutable nativo independiente. |

### Operaciones a Nivel de Proyecto

| Comando | Descripción |
| --- | --- |
| `snl --check-parse-project <ruta>` | Descubre y analiza sintácticamente todos los `.snl` y `.sns` del proyecto y sus dependencias. |
| `snl check --project [--no-typecheck] <ruta>` | Construye el grafo de paquetes, enlaza imports, resuelve símbolos y verifica cuerpos (`--no-typecheck` valida solo firmas e imports). |
| `snl run --project <ruta> [--offline-cache[=<dir>]] [-- <args...>]` | Verifica y ejecuta un proyecto multiarchivo. |
| `snl build --project <ruta> [-o <salida>] [--target=<triple>] [--runtime] [--offline-cache[=<dir>]]` | Compila un proyecto en un ejecutable independiente. `--runtime` incrusta fuentes y enlaza `libsnovart.a` (válido solo con `--project`). |

### Gestión de Dependencias (`get` y `tidy`)

Las dependencias se alojan en `.snovalang/deps/` y se declaran en el manifiesto `mod.sns`:

```sh
# Añadir o actualizar una dependencia directa
snl get https://github.com/supernovalang/snova-http
snl get https://github.com/supernovalang/snova-http --version 1.0.0
snl get github.com/supernovalang/snova-http@1.0.0

# Sincronizar todas las dependencias declaradas en mod.sns
snl get
snl get --project ./mi-proyecto

# Eliminar dependencias no usadas y sincronizar mod.sns
snl tidy
snl tidy --project ./mi-proyecto
```

Propiedades clave de `snl get`:

- **Resolución transitiva** con deduplicación en grafos diamante (una dependencia compartida se clona una sola vez) y detección de ciclos.
- **Secciones de `mod.sns`**: clasifica `direct = [...]`, `indirect = ["from -> to"]` y submódulos locales `references = [...]` (un submódulo inexistente reporta `SNOVA0052`).
- **Ejecución segura e idempotente**: lanza procesos directamente sin interpolación de shell y mantiene salidas deterministas.

Ejemplo de `mod.sns`:

```text
module mi_app
snova "1.0.0"
```

## Variables de Entorno

| Variable | Efecto |
| --- | --- |
| `SNOVA_BUILTIN_DIR` | Anulación de máxima prioridad para el directorio de la biblioteca `builtin/`. |
| `SNOVA_STD_DIR` / `SNOVA_STD_PATH` | Ruta explícita a la biblioteca estándar (respaldo tras `builtin/` del toolchain). |
| `SNOVA_TARGET_OS` | Anula el SO destino (`darwin`, `linux`, `windows`, `freebsd`, etc.). |
| `SNOVA_TARGET_ARCH` | Anula la arquitectura destino (`arm64`, `aarch64`, `x86_64`, `arm`, etc.). |
| `SNOVA_TARGET` | Anula el target triple completo (p. ej., `x86_64-unknown-linux-gnu`). |
| `SNOVA_MEMORY_STATS` | Si vale `1`, imprime uso, reserva y *slack* de `SnArena`. |
| `SNOVA_INSTALL_DIR` | Cambia el destino en `install.sh` (directorio del binario) e `install.ps1` (prefijo sobre `bin`). |

## Servidor de Lenguaje (`snova-lsp`)

`snova-lsp` implementa **Microsoft LSP 3.17** sobre el pipeline de `snovac`, indexando únicamente archivos `.snl` y `.sns` (ignorando `.snova`, `.java`, etc.).

### Capacidades

- **Diagnósticos en tiempo real** (`textDocument/publishDiagnostics`) con códigos `SNOVA`.
- **Documentación en hover** (`textDocument/hover`) con firmas y comentarios `/* -- Doc:{Name} */`.
- **Autocompletado** (`textDocument/completion`): palabras clave, primitivos, preludio, locales, acceso a miembros, plantillas `pulsar func`/`pulsar method` y completado de imports segmento por segmento (`import builtin.io.` -> `console`, `filesystem` y símbolos públicos en `import pkg.Symbol`).
- **Auto-import priorizado por proyecto y quick fixes**: al completar un símbolo no importado o usar `Tipo.miembro`, inserta el `import` ordenado respetando el estilo de punto y coma del bloque, clasificando de forma determinista: paquetes del propio proyecto -> paquetes ya importados en el proyecto -> dependencias -> builtins.
- **Navegación y símbolos**: ir a definición, referencias, implementaciones, `documentSymbol` jerárquico, ayuda de firma y resaltado semántico (incluyendo expresiones en cadenas interpoladas).
- **Migración a Snovalang (`.snl`)**: Los módulos puros de LSP (modelos de protocolo, escritor JSON, framing `Content-Length`, codec URI, índice de líneas, ranking de completado, codificación delta semántica y armado RPC) están migrando a `src/*.snl` en el paquete `Snova.Lsp`; el servidor stdio y el puente con `snovac` permanecen en C por ahora (`SL-2`).

Instalación en macOS/Linux:

```sh
curl -fsSL https://raw.githubusercontent.com/snovalang/snova-lsp/master/install.sh | sh
```

## Extensiones Oficiales de Editor (`editor-extensions`)

| Editor | Instalación / Requisitos | Funciones Incluidas |
| --- | --- | --- |
| **VS Code** | `curl -fsSL https://raw.githubusercontent.com/snovalang/editor-extensions/master/install-vscode.sh \| sh` (o `install-vscode.ps1` / `snovalang.vsix`) | Gramáticas TextMate (`.snl`, `.sns`, `mod.sns`, `snova.sns`), iconos, snippets, `snova-lsp` incluido (Linux ELF, Windows `.exe`, Mach-O universal) + `server/builtin`, respaldo automático (`snova.lsp.autoInstall`), comandos `snl run`/`check`/`tidy`/`get`. |
| **IDEs JetBrains** (2025.2+) | `curl -fsSL https://raw.githubusercontent.com/snovalang/editor-extensions/master/install-jetbrains.sh \| sh` (o `install-jetbrains.ps1` / `snovalang-jetbrains.zip`) | Compatible con IntelliJ IDEA, PyCharm, WebStorm, GoLand, CLion, Rider, RustRover, PhpStorm, RubyMine, DataGrip y DataSpell (usa el cliente LSP integrado; las compilaciones open-source de IDEA y Android Studio no lo incluyen). Incluye los mismos binarios `snova-lsp` y acciones en **Tools \| Snovalang**. |
| **Zed** | `curl -fsSL https://raw.githubusercontent.com/snovalang/editor-extensions/master/install-zed.sh \| sh` (o `install-zed.ps1` / `snovalang-zed.tar.gz`) | Componente `wasm32-wasip2`, gramáticas y consultas Tree-sitter, esquema, delimitadores e indentación. Resuelve `snova-lsp` instalado por separado en `PATH`. |
