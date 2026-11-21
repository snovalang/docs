---
title: Visão Geral e Início Rápido
description: Introdução técnica direta à linguagem Snovalang, ao compilador de referência em ISO C11 (snovac), instalação, estrutura de projetos e estado atual de implementação.
page_id: overview
section_label: Primeiros Passos
permalink: /pt-br/
---

**Snovalang** é uma linguagem de programação estaticamente tipada projetada para desempenho previsível, conversões de tipo explícitas, controle determinístico de recursos e concorrência estruturada. Seu compilador oficial de referência, **`snovac`** (acionado pela CLI `snl`), é escrito em **ISO C11** puro, sem dependências externas, sob a **Licença Apache 2.0**.

## Resumo Técnico

- **Compilador puro em ISO C11 (`snovac`)**: Zero dependências externas de compilação; compila com `clang` ou `gcc` e GNU `make`.
- **Tipagem estática estrita**: Representação de tipos com *hash-consing* (`SnTypeRep`), inteiros distintos (`int`, `int64` e `long` têm 64 bits com sinal e são tipos mutuamente distintos), sem conversões implícitas e rejeição em tempo de compilação de estreitamentos (*narrowing*) mesmo usando `as`.
- **Sem garbage collector**: A avaliação usa regiões baseadas em arena por chamada/bloco com retenção por análise de escape e limpeza explícita via `defer`; um plano faseado de segurança de memória (P1–P11) está adicionando IR de CFG/places, RAII determinístico, `Unique<T>`, `Shared<T>`/`Weak<T>` e ponteiros brutos sob `unsafe`.
- **Múltiplas rotas de execução**: Interpretador *tree-walking* (`snl run`), bytecode canônico little-endian (`SnBC` via `emit-snbc` / `run-snbc`), binários nativos independentes gerados via runner C (`snl build` e `snl build --project --runtime`) e um compilador *self-hosting* na própria árvore (`bootstrap/src/compiler.snl`).
- **Biblioteca builtin em código-fonte**: Tipos e APIs padrão residem como arquivos `.snl` em `builtin/`, resolvidos e verificados pelo sistema normal de pacotes e tipos.

## Extensões de Arquivo e Modelo de Projeto

Tanto `snl` quanto `snova-lsp` reconhecem apenas duas extensões de código-fonte:

| Arquivo / Padrão | Função | Compilado? |
| --- | --- | --- |
| `*.snl` | Código-fonte Snovalang; deve declarar `package <nome>`. | Sim |
| `*.sns` | Script Snovalang; a declaração `package` é opcional (padrão `main`). | Sim |
| `mod.sns`, `snova.sns` | Manifestos de projeto (também descobertos: `snova.mod`, `snova.toml`). | Não |
| `*.sno` ou outras extensões | Rejeitados antes da leitura do arquivo; ignorados na descoberta de projetos. | Não |

A raiz de um projeto é descoberta subindo diretórios (até 32 níveis) em busca de `mod.sns`, `snova.sns`, `snova.mod` ou `snova.toml`. As raízes de código são `<manifest_dir>/src` (quando existente; caso contrário `<manifest_dir>`) e as dependências em `.snovalang/deps/`.

## Instalação

### macOS e Linux

Instala `snl` em `$HOME/.snova/bin` (defina `SNOVA_INSTALL_DIR` para escolher diretamente outro diretório de destino para o binário):

```sh
curl -fsSL https://raw.githubusercontent.com/snovalang/snovac/master/install.sh | sh
```

Para atualizar explicitamente:

```sh
curl -fsSL https://raw.githubusercontent.com/snovalang/snovac/master/install.sh | sh -s -- --update
```

### Windows (PowerShell)

Instala `snl.exe` em `%USERPROFILE%\.snova\bin` (defina `SNOVA_INSTALL_DIR` para alterar o prefixo; o binário é copiado em `<prefix>\bin`):

```powershell
irm https://raw.githubusercontent.com/snovalang/snovac/master/install.ps1 | iex
```

Para atualizar explicitamente:

```powershell
$env:SNOVA_UPDATE = '1'; irm https://raw.githubusercontent.com/snovalang/snovac/master/install.ps1 | iex
```

### Compilação a partir do Código-Fonte

Pré-requisitos: compilador C11 (`clang` ou `gcc`) e GNU `make`.

```sh
git clone https://github.com/snovalang/snovac.git
cd snovac
make
make install
```

`make` gera `build/snl` (copiado para `build/snovac`), `build/libsnovart.a` e `compile_commands.json`. `make install` instala `snl`, `libsnovart.a`, cabeçalhos C e a biblioteca `builtin/` em `~/.snova` (altere via `PREFIX=/caminho/customizado`) e configura `PATH` para `bash`, `zsh` e `fish` (ou PowerShell no Windows).

Valide a instalação:

```sh
snl --version
snl --target-info
```

## Primeiro Programa

Crie `hello.snl`:

```snova
package demo.hello

import builtin.io.console.output.Console

func main(): int {
    Console.printline("Ola da Snovalang")
    return 0
}
```

Verifique, execute ou compile para executável nativo:

```sh
snl check hello.snl
snl run hello.snl
snl build hello.snl -o hello
./hello
```

Repasse argumentos de linha de comando ao programa após `--`:

```sh
snl run app.snl -- um dois
```

No programa Snovalang, `um` e `dois` ficam disponíveis via `Runtime.argumentCount()` e `Runtime.argument(index)` (ou pela fachada `Args`).

## Matriz de Estado Atual da Implementação

Uma declaração builtin aceita por `snl check` não implica suporte de execução em todos os backends. Estado atual dos componentes ativos de `snovac`:

| Área | Estado | Observações |
| --- | --- | --- |
| Lexer, parser, AST e grafo de pacotes | {% include status-badge.html status="implemented" %} | Palavras-chave contextuais; conformidade de 243/243 arquivos léxicos e 203/206 sintáticos (`tests/conformance.allow` registra 3 lacunas `SNOVA0148`). |
| Verificador de tipos e *hash-consing* | {% include status-badge.html status="partial" %} | Checagens estritas de inteiros, casts e sobrecarga ativas; bounds/substituição de genéricos e inferência bidirecional estão em [Coming Soon]({{ '/pt-br/coming-soon/' | relative_url }}). |
| Ownership e borrow checker | {% include status-badge.html status="partial" %} | Moves locais, `&T`/`&T?` com escopo, exclusividade e capturas Pulsar (`SNOVA0240`–`SNOVA0251`, limite de 96 entradas); IR de CFG/places em P2–P3. |
| `defer` e `try`/`catch`/`finally` | {% include status-badge.html status="interpreter_only" %} | Unwind completo em `snl run`; `try`/`throw` rejeitados com `SNOVA0400` em SnBC/nativo; erros de runtime pulam `defer` em SnBC/nativo. |
| Bytecode SnBC e runner nativo C | {% include status-badge.html status="partial" %} | `.snbc` canônico little-endian + listagem `.snbt` + `snl build`; subconjunto dos recursos do interpretador. |
| Biblioteca builtin (sockets, HTTP/1.1, mutex, clock) | {% include status-badge.html status="interpreter_only" %} | Console, arquivos texto e args/env funcionam em interpretador e nativo; TCP/UDP, servidor HTTP/1.1, relógio monotônico e mutexes do SO são apenas no interpretador. |
| RAII (`Unique<T>`), `Shared<T>`/`Weak<T>`, ponteiros brutos, ABI C, `MappedRegion`, MMIO | {% include status-badge.html status="coming_soon" %} | Contrato normativo finalizado em P1 (`docs/spec/memory-safety.md`); programado para P2–P11. |
| `snova-lsp` e Extensões de Editor | {% include status-badge.html status="implemented" %} | Servidor LSP 3.17 com extensões para VS Code, JetBrains (2025.2+) e Zed. |
