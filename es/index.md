---
title: Visión General e Inicio Rápido
description: Introducción técnica directa a Snovalang, su compilador de referencia en ISO C11 (snovac), instalación, estructura de proyectos y estado actual de implementación.
page_id: overview
section_label: Primeros Pasos
permalink: /es/
---

**Snovalang** es un lenguaje de programación de tipado estático diseñado para rendimiento predecible, conversiones de tipo explícitas, control determinista de recursos y concurrencia estructurada. Su compilador oficial de referencia, **`snovac`** (invocado mediante la CLI `snl`), está escrito en **ISO C11** puro, sin dependencias externas, bajo la **Licencia Apache 2.0**.

## Resumen Técnico

- **Compilador puro en ISO C11 (`snovac`)**: Cero dependencias externas de compilación; se compila con `clang` o `gcc` y GNU `make`.
- **Tipado estático estricto**: Representación de tipos con *hash-consing* (`SnTypeRep`), enteros distintos (`int`, `int64` y `long` son de 64 bits con signo y mutuamente distintos), sin conversiones implícitas y rechazo en tiempo de compilación de estrechamientos (*narrowing*) incluso usando `as`.
- **Sin recolector de basura**: La evaluación utiliza regiones respaldadas por arena por llamada/bloque con retención por análisis de escape y limpieza explícita mediante `defer`; un plan por etapas de seguridad de memoria (P1–P11) está añadiendo IR de CFG/places, RAII determinista, `Unique<T>`, `Shared<T>`/`Weak<T>` y punteros crudos bajo `unsafe`.
- **Múltiples rutas de ejecución**: Intérprete *tree-walking* (`snl run`), bytecode canónico little-endian (`SnBC` mediante `emit-snbc` / `run-snbc`), binarios nativos independientes generados mediante un runner en C (`snl build` y `snl build --project --runtime`) y un compilador *self-hosting* en el mismo árbol (`bootstrap/src/compiler.snl`).
- **Biblioteca builtin en código fuente**: Los tipos y APIs estándar residen como archivos `.snl` en `builtin/`, resueltos y verificados mediante el sistema normal de paquetes y tipos.

## Extensiones de Archivo y Modelo de Proyecto

Tanto `snl` como `snova-lsp` reconocen únicamente dos extensiones de código fuente:

| Archivo / Patrón | Rol | ¿Se compila? |
| --- | --- | --- |
| `*.snl` | Archivo fuente Snovalang; debe declarar `package <nombre>`. | Sí |
| `*.sns` | Script Snovalang; la declaración `package` es opcional (por defecto `main`). | Sí |
| `mod.sns`, `snova.sns` | Manifiestos de proyecto (también descubiertos: `snova.mod`, `snova.toml`). | No |
| `*.sno` u otras extensiones | Rechazados antes de leer el archivo; omitidos durante el descubrimiento del proyecto. | No |

La raíz de un proyecto se descubre subiendo directorios (hasta 32 niveles) buscando `mod.sns`, `snova.sns`, `snova.mod` o `snova.toml`. Las raíces de código son `<manifest_dir>/src` (si existe; en caso contrario `<manifest_dir>`) y las dependencias vendoreadas en `.snovalang/deps/`.

## Instalación

### macOS y Linux

Instala `snl` en `$HOME/.snova/bin` (define `SNOVA_INSTALL_DIR` para elegir directamente otro directorio destino para el binario):

```sh
curl -fsSL https://raw.githubusercontent.com/snovalang/snovac/master/install.sh | sh
```

Actualizar explícitamente:

```sh
curl -fsSL https://raw.githubusercontent.com/snovalang/snovac/master/install.sh | sh -s -- --update
```

### Windows (PowerShell)

Instala `snl.exe` en `%USERPROFILE%\.snova\bin` (define `SNOVA_INSTALL_DIR` para cambiar el prefijo; el binario se copia en `<prefix>\bin`):

```powershell
irm https://raw.githubusercontent.com/snovalang/snovac/master/install.ps1 | iex
```

Actualizar explícitamente:

```powershell
$env:SNOVA_UPDATE = '1'; irm https://raw.githubusercontent.com/snovalang/snovac/master/install.ps1 | iex
```

### Compilación desde el Código Fuente

Requisitos previos: compilador C11 (`clang` o `gcc`) y GNU `make`.

```sh
git clone https://github.com/snovalang/snovac.git
cd snovac
make
make install
```

`make` genera `build/snl` (copiado a `build/snovac`), `build/libsnovart.a` y `compile_commands.json`. `make install` instala `snl`, `libsnovart.a`, encabezados C y la biblioteca `builtin/` en `~/.snova` (anulable con `PREFIX=/ruta/personalizada`) y actualiza `PATH` en `bash`, `zsh` y `fish` (o PowerShell en Windows).

Verifica la instalación:

```sh
snl --version
snl --target-info
```

## Primer Programa

Crea `hello.snl`:

```snova
package demo.hello

import builtin.io.console.output.Console

func main(): int {
    Console.printline("Hola desde Snovalang")
    return 0
}
```

Verifica, ejecuta o compila a ejecutable nativo:

```sh
snl check hello.snl
snl run hello.snl
snl build hello.snl -o hello
./hello
```

Pasa argumentos de línea de comandos al programa tras `--`:

```sh
snl run app.snl -- uno dos
```

En Snovalang, `uno` y `dos` se leen con `Runtime.argumentCount()` y `Runtime.argument(index)` (o mediante la fachada `Args`).

## Matriz de Estado Actual de Implementación

Una declaración builtin aceptada por `snl check` no implica soporte de ejecución en todos los backends. Estado actual de los componentes activos de `snovac`:

| Área | Estado | Notas |
| --- | --- | --- |
| Lexer, parser, AST y grafo de paquetes | {% include status-badge.html status="implemented" %} | Palabras clave contextuales; conformidad de 243/243 archivos léxicos y 203/206 sintácticos (`tests/conformance.allow` registra 3 brechas `SNOVA0148`). |
| Verificador de tipos y *hash-consing* | {% include status-badge.html status="partial" %} | Reglas estrictas de enteros, casts y sobrecarga activas; bounds/sustitución de genéricos e inferencia bidireccional están en [Coming Soon]({{ '/es/coming-soon/' | relative_url }}). |
| Ownership y borrow checker | {% include status-badge.html status="partial" %} | Moves locales, `&T`/`&T?` acotados, exclusividad y capturas Pulsar (`SNOVA0240`–`SNOVA0251`, límite de 96 entradas); IR de CFG/places en P2–P3. |
| `defer` y `try`/`catch`/`finally` | {% include status-badge.html status="interpreter_only" %} | Unwind completo en `snl run`; `try`/`throw` rechazados con `SNOVA0400` en SnBC/nativo; errores de runtime omiten `defer` en SnBC/nativo. |
| Bytecode SnBC y runner nativo en C | {% include status-badge.html status="partial" %} | `.snbc` canónico little-endian + listado `.snbt` + `snl build`; subconjunto de funciones del intérprete. |
| Biblioteca builtin (sockets, HTTP/1.1, mutex, reloj) | {% include status-badge.html status="interpreter_only" %} | Consola, archivos de texto y args/env funcionan en intérprete y nativo; TCP/UDP, servidor HTTP/1.1, reloj monotónico y mutex del SO solo en intérprete. |
| RAII (`Unique<T>`), `Shared<T>`/`Weak<T>`, punteros crudos, ABI C, `MappedRegion`, MMIO | {% include status-badge.html status="coming_soon" %} | Contrato normativo finalizado en P1 (`docs/spec/memory-safety.md`); planificado para P2–P11. |
| `snova-lsp` y Extensiones de Editor | {% include status-badge.html status="implemented" %} | Servidor LSP 3.17 con extensiones para VS Code, JetBrains (2025.2+) y Zed. |
