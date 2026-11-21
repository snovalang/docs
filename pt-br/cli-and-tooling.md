---
title: CLI, LSP e Extensões de Editor
description: Referência completa da CLI snl, gerenciador de dependências mod.sns, variáveis de ambiente, servidor snova-lsp (LSP 3.17) e extensões oficiais para VS Code, JetBrains e Zed.
page_id: cli-and-tooling
section_label: Ferramentas e Roadmap
permalink: /pt-br/cli-and-tooling/
---

## Referência de Linha de Comando (`snl`)

Verificada diretamente em `src/driver/main.c` e `src/driver/driver_utils_part1.inc`.

### Comandos Informativos

| Comando | Descrição |
| --- | --- |
| `snl --version` (`-V`) | Exibe a versão do compilador (`SNOVAC_VERSION`, tag git ou `dev`). |
| `snl --help` (`-h`) | Exibe o resumo de uso da CLI. |
| `snl --target-info` | Exibe target triple ativo, qualificação, largura/endianness de ponteiros, convenção de chamada, larguras atômicas, página/granularidade, estado MMIO e overrides de ambiente. |

### Arquivo Único (Frontend e Execução)

| Comando | Descrição |
| --- | --- |
| `snl --emit=tokens <arquivo>` | Executa análise léxica e exibe o fluxo de tokens com spans `linha:coluna`. |
| `snl --check-lex <arquivo>` | Apenas análise léxica; sai com código diferente de zero em caso de erro. |
| `snl --emit=ast <arquivo>` | Faz parsing e imprime a AST formatada. |
| `snl --check-parse <arquivo>` | Análise léxica e sintática com emissão de diagnósticos. |
| `snl check <arquivo>` | Resolve nomes, verifica tipos e executa borrow check em um arquivo `.snl` ou `.sns`. |
| `snl run <arquivo> [-- <args...>]` | Verifica e executa com o interpretador *tree-walking* (`sn_eval_run`), repassando `<args...>` para `Runtime.argument*`. |
| `snl emit-snbc <arquivo.snl> -o <saida.snbc>` | Verifica, gera e grava imagem canônica `.snbc` little-endian e listagem determinística `.snbt` (aceita apenas `.snl`). |
| `snl run-snbc <arquivo.snbc>` | Carrega, valida estruturalmente, compila via runner nativo e executa uma imagem `.snbc` canônica. |
| `snl build <arquivo> [-o <saida>] [--target=<triple>]` | Verifica, emite SnBC e compila um arquivo único em executável nativo independente. |

### Operações em Todo o Projeto

| Comando | Descrição |
| --- | --- |
| `snl --check-parse-project <caminho>` | Descobre e analisa sintaticamente todos os `.snl` e `.sns` do projeto e dependências. |
| `snl check --project [--no-typecheck] <caminho>` | Constrói o grafo de pacotes, vincula imports, resolve símbolos e verifica corpos (`--no-typecheck` checa apenas assinaturas e imports). |
| `snl run --project <caminho> [--offline-cache[=<dir>]] [-- <args...>]` | Verifica e executa um projeto multi-arquivo. |
| `snl build --project <caminho> [-o <saida>] [--target=<triple>] [--runtime] [--offline-cache[=<dir>]]` | Compila um projeto em executável autônomo. `--runtime` embarca os fontes e linka `libsnovart.a` (válido somente com `--project`). |

### Gerenciamento de Dependências (`get` e `tidy`)

Dependências são armazenadas em `.snovalang/deps/` e gerenciadas no manifesto `mod.sns`:

```sh
# Adicionar ou atualizar uma dependência direta
snl get https://github.com/supernovalang/snova-http
snl get https://github.com/supernovalang/snova-http --version 1.0.0
snl get github.com/supernovalang/snova-http@1.0.0

# Sincronizar todas as dependências declaradas em mod.sns
snl get
snl get --project ./meu-projeto

# Remover dependências não utilizadas e sincronizar mod.sns
snl tidy
snl tidy --project ./meu-projeto
```

Propriedades principais de `snl get`:

- **Resolução transitiva** com deduplicação em grafos diamante (dependência compartilhada clonada uma única vez) e detecção de ciclos.
- **Seções de `mod.sns`**: classifica `direct = [...]`, `indirect = ["from -> to"]` e submódulos locais `references = [...]` (submódulo inexistente reporta `SNOVA0052`).
- **Execução segura e idempotente**: invoca processos diretamente sem interpolação de shell e preserva o estado em execuções repetidas.

Exemplo de `mod.sns`:

```text
module meu_app
snova "1.0.0"
```

## Variáveis de Ambiente

| Variável | Efeito |
| --- | --- |
| `SNOVA_BUILTIN_DIR` | Override de maior prioridade para o diretório da biblioteca `builtin/`. |
| `SNOVA_STD_DIR` / `SNOVA_STD_PATH` | Caminho explícito da biblioteca padrão (fallback após `builtin/` do toolchain). |
| `SNOVA_TARGET_OS` | Sobrescreve o SO alvo (`darwin`, `linux`, `windows`, `freebsd`, etc.). |
| `SNOVA_TARGET_ARCH` | Sobrescreve a arquitetura alvo (`arm64`, `aarch64`, `x86_64`, `arm`, etc.). |
| `SNOVA_TARGET` | Sobrescreve o target triple completo (ex.: `x86_64-unknown-linux-gnu`). |
| `SNOVA_MEMORY_STATS` | Quando igual a `1`, imprime estatísticas de uso, reserva e *slack* de `SnArena`. |
| `SNOVA_INSTALL_DIR` | Altera o destino de instalação em `install.sh` (diretório do binário) e `install.ps1` (prefixo acima de `bin`). |

## Servidor de Linguagem (`snova-lsp`)

`snova-lsp` implementa **Microsoft LSP 3.17** sobre o pipeline do `snovac`, indexando exclusivamente arquivos `.snl` e `.sns` (ignorando `.snova`, `.java`, etc.).

### Recursos

- **Diagnósticos em tempo real** (`textDocument/publishDiagnostics`) com códigos `SNOVA`.
- **Documentação no hover** (`textDocument/hover`) exibindo assinaturas e blocos `/* -- Doc:{Name} */`.
- **Autocompletar** (`textDocument/completion`): palavras-chave, primitivos, prelúdio, variáveis locais, acesso a membros, templates `pulsar func`/`pulsar method` e completação de imports segmento a segmento (`import builtin.io.` -> `console`, `filesystem` e símbolos públicos em `import pkg.Symbol`).
- **Auto-import ranqueado pelo projeto e quick fixes**: completar um símbolo não importado ou usar `Tipo.membro` insere o `import` ordenado no estilo de ponto e vírgula do arquivo, priorizando deterministicamente: pacotes do próprio projeto -> pacotes já importados por outros arquivos do projeto -> dependências -> builtins.
- **Navegação e símbolos**: ir para definição, referências, implementações, `documentSymbol` hierárquico, *signature help* e destaque semântico (inclusive em expressões dentro de strings interpoladas).
- **Migração para Snovalang (`.snl`)**: Módulos puros do LSP (modelos de protocolo, escritor JSON, framing `Content-Length`, codec URI, índice de linhas, ranking de completação, codificação delta semântica, moldagem RPC) estão migrando para `src/*.snl` no pacote `Snova.Lsp`; o servidor stdio e a ponte com `snovac` permanecem em C por enquanto (`SL-2`).

Instalação no macOS/Linux:

```sh
curl -fsSL https://raw.githubusercontent.com/snovalang/snova-lsp/master/install.sh | sh
```

## Extensões Oficiais de Editor (`editor-extensions`)

| Editor | Instalação / Requisitos | Recursos Inclusos |
| --- | --- | --- |
| **VS Code** | `curl -fsSL https://raw.githubusercontent.com/snovalang/editor-extensions/master/install-vscode.sh \| sh` (ou `install-vscode.ps1` / `snovalang.vsix`) | Gramáticas TextMate (`.snl`, `.sns`, `mod.sns`, `snova.sns`), ícones, snippets, `snova-lsp` embarcado (Linux ELF, Windows `.exe`, Mach-O universal) + `server/builtin`, fallback automático (`snova.lsp.autoInstall`), comandos `snl run`/`check`/`tidy`/`get`. |
| **IDEs JetBrains** (2025.2+) | `curl -fsSL https://raw.githubusercontent.com/snovalang/editor-extensions/master/install-jetbrains.sh \| sh` (ou `install-jetbrains.ps1` / `snovalang-jetbrains.zip`) | Compatível com IntelliJ IDEA, PyCharm, WebStorm, GoLand, CLion, Rider, RustRover, PhpStorm, RubyMine, DataGrip e DataSpell (usa o cliente LSP embutido; compilações open-source do IDEA e Android Studio não o incluem). Embarca os binários de `snova-lsp` e ações em **Tools \| Snovalang**. |
| **Zed** | `curl -fsSL https://raw.githubusercontent.com/snovalang/editor-extensions/master/install-zed.sh \| sh` (ou `install-zed.ps1` / `snovalang-zed.tar.gz`) | Componente `wasm32-wasip2`, gramáticas e queries Tree-sitter, outline, colchetes e indentação. Resolve `snova-lsp` instalado separadamente via `PATH`. |
