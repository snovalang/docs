---
title: Implementação do Compilador (snovac)
description: Arquitetura técnica detalhada do compilador ativo snovac em ISO C11, fases de compilação, formato SnBC, runner nativo C, compilador bootstrap, targets e ABI C de host.
page_id: compiler-architecture
section_label: Compilador e Runtime
permalink: /pt-br/compiler-architecture/
---

**`snovac`** é o compilador oficial de referência da Snovalang, escrito em **ISO C11** puro, sem dependências externas, compilado com avisos estritos (`-std=c11 -O2 -g -pthread -Wall -Wextra -Wpedantic -Wshadow -Wstrict-prototypes -Wmissing-prototypes -Wconversion`).

<div class="callout callout-warn">
  <span class="callout-title">Árvore de Código-Fonte Ativa</span>
  O compilador ativo compilado pelo <code>Makefile</code> vive exclusivamente em <code>src/</code>. Diretórios históricos na raiz (<code>frontend/</code>, <code>semantic/</code>, <code>runtime/</code>, <code>backend/</code>) <strong>não</strong> fazem parte de <code>SRCS</code> no <code>Makefile</code>.
</div>

## Mapa de Módulos com Namespaces (`src/`)

Cada subsistema reside em `src/<namespace>` com prefixos próprios de identificadores C:

| Diretório | Prefixos | Responsabilidade |
| --- | --- | --- |
| `src/base/` | `sn_arena_`, `sn_diag_`, `sn_intern_` | Arenas alinhadas (`SnArena`), coletor estruturado de diagnósticos `SNOVA` (`SnDiagSink`) e interning de strings (`SnInternTable`). |
| `src/lex/` | `sn_lex_`, `sn_tok_` | Analisador léxico, tabela de palavras-chave contextuais (`KEYWORDS[]`), literais numéricos/string/char e flag de interpolação `${...}`. |
| `src/parse/` | `sn_parse_` | Parser recursivo descendente com recuperação em modo pânico retornando `SnUnit` parcial e parsing de ponteiros/referências (`parse_ptr.c`). |
| `src/ast/` | `sn_list_`, `sn_dump_` | Nós da AST alocados em arena e dumper formatado (`--emit=ast`). |
| `src/sema/` | `sn_scope_`, `sn_pkggraph_`, `sn_type_`, `sn_resolve_`, `sn_builtin_`, `sn_check_`, `sn_borrow_` | Grafo de pacotes e detecção de ciclos, coleta de declarações e prelúdio, tabela `SnTypeRep` com hash-consing, checagem de tipos/efeitos, ajustes de ponteiros e análise de borrow/capturas Pulsar. |
| `src/eval/` | `sn_eval_`, `sn_rt_`, `sn_async_`, `sn_pulsar_`, `sn_socket_` | Interpretador *tree-walking* (`sn_eval_run`), memória de regiões/frames (`rt_mem.c`), referências (`rt_ptr.c`), `defer` (`rt_defer.c`), sockets (`socket_abi.c`), dispatch nativo, loop assíncrono, pool Pulsar e ABI C (`runtime_api.h`). |
| `src/bc/` | `sn_chunk_`, `sn_bcunit_`, `sn_emit_` | Lowering para bytecode `SnBC`, serializador/carregador canônico little-endian, listagem determinística `.snbt` e validador estrutural (`snbc_validate.inc`). |
| `src/native/` | `sn_native_`, `sn_target_` | Descritor de targets e matriz de capacidades (`target.c`), gerador de runner C autônomo (`native_backend.c`), empacotamento com runtime embarcado (`--runtime`) e escopo de valores de tarefa (`native_scope.c`). |
| `src/driver/` | `sn_driver_`, `sn_project_`, `sn_cmd_` | Ponto de entrada da CLI `snl`, descoberta de projetos/manifestos/builtins e comandos (`check`, `run`, `build`, `emit-snbc`, `run-snbc`, `get`, `tidy`). |
| `builtin/` | — | Declarações e implementações em `.snl` da biblioteca padrão builtin. |

## Pipeline de Compilação

A partir do estágio **P1**, todo comando que executa ou emite código (`check`, `run`, `emit-snbc`, `build`, `build --project --runtime`) percorre o mesmo pipeline compartilhado de resolução, checagem de tipos/efeitos e validação de ownership/borrow antes do lowering ou execução:

```text
  Código-fonte .snl / .sns
         │
         ▼
  [1] src/lex      ──▶ Fluxo de tokens (--emit=tokens, --check-lex)
         │
         ▼
  [2] src/parse    ──▶ AST SnUnit em arena (--emit=ast, --check-parse)
         │
         ▼
  [3] src/sema     ──▶ Grafo de pacotes (sn_pkggraph_*)
                   ──▶ Coleta de declarações + Prelúdio (sn_resolve_*)
                   ──▶ Tipos hash-consed + Checagem de tipos/efeitos (sn_check_*)
                   ──▶ Ownership, borrow e capturas Pulsar (sn_borrow_*)
         │
         ├──▶ snl check             (encerra após sema)
         │
         ├──▶ snl run               ──▶ [4a] src/eval: Interpretador tree-walking (sn_eval_run)
         │
         ├──▶ snl emit-snbc         ──▶ [4b] src/bc: Imagem .snbc canônica + listagem .snbt
         │         │
         │         ▼
         ├──▶ snl run-snbc / build  ──▶ [4c] src/native: Valida SnBC → gera runner C → CC do host
         │
         └──▶ snl build --project --runtime
                                    ──▶ [4d] src/native: Embarca fontes verificados + linka libsnovart.a
```

## Backends de Execução

### 1. Interpretador Tree-Walking (`snl run`)

- Ponto de entrada: `sn_eval_run` em `src/eval/eval.c`.
- **Não existe** VM de bytecode em processo dentro de `src/` (`vm.c` não faz parte do compilador ativo).
- É a rota com maior cobertura funcional hoje: suporta `try`/`catch`/`finally`, `throw`, aridade ilimitada em `defer`, unwind de `defer` em erros de runtime, sockets TCP/UDP, servidor HTTP/1.1, relógio monotônico e mutexes do SO.
- Opera com regiões privadas por escopo com retenção por escape e teto de 64 MiB no heap de fallback (código de saída `70`).

### 2. Bytecode Snovalang (`SnBC` — `src/bc/`)

`snl emit-snbc <arquivo.snl> -o <saida.snbc>` gera uma imagem binária portátil canônica em little-endian e uma listagem textual determinística `.snbt` (um fato por linha, sem caminhos nem timestamps).

**Cabeçalho e estrutura (`src/bc/snbc.h`):**

- Magic: `0x43424E53` (`"SNBC"`, 4 bytes)
- Versão: `SNBC_VERSION = 1`
- `main_func_idx`: `uint32_t`
- `SnStringPool`: strings UTF-8 com comprimento prefixado (`uint32_t`)
- `SnFunctionChunk[]`: nome da função, `arity`, `local_count`, bytes de `code` e tabela `lines`

**Conjunto de instruções (`SnOpcode` em `src/bc/snbc.h`):**

| Grupo | Opcodes |
| --- | --- |
| Constantes e pilha | `OP_NOP`, `OP_CONST_INT` (`int64_t`), `OP_CONST_DOUBLE` (`double`), `OP_CONST_STRING`, `OP_CONST_BOOL`, `OP_CONST_UNIT`, `OP_CONST_NULL`, `OP_POP`, `OP_DUP` |
| Variáveis | `OP_GET_LOCAL`, `OP_SET_LOCAL`, `OP_GET_GLOBAL`, `OP_SET_GLOBAL` |
| Aritmética e bitwise | `OP_ADD`, `OP_SUB`, `OP_MUL`, `OP_DIV`, `OP_MOD`, `OP_NEG`, `OP_NOT`, `OP_BIT_AND`, `OP_BIT_OR`, `OP_BIT_XOR`, `OP_SHL`, `OP_SHR` |
| Comparação | `OP_EQ`, `OP_NE`, `OP_LT`, `OP_LE`, `OP_GT`, `OP_GE` |
| Fluxo de controle | `OP_JUMP`, `OP_JUMP_IF_FALSE`, `OP_JUMP_IF_TRUE`, `OP_CALL`, `OP_INVOKE`, `OP_RETURN`, `OP_TRAP`, `OP_HALT` |
| Objetos, arrays e enums | `OP_NEW_OBJ`, `OP_GET_FIELD`, `OP_SET_FIELD`, `OP_NEW_ARRAY`, `OP_GET_INDEX`, `OP_SET_INDEX`, `OP_ARRAY_LEN`, `OP_ARRAY_PUSH`, `OP_IS_ARRAY`, `OP_VARIANT`, `OP_IS_VARIANT`, `OP_UNWRAP_VARIANT` |
| Limpeza, concorrência e host | `OP_DEFER` (máx. 8 args), `OP_SPAWN` (disparo Pulsar), `OP_CALL_ASYNC`, `OP_PRINT`, `OP_READ_BYTES`, `OP_WRITE_BYTES`, `OP_RUNTIME_API` |

**Validação (`snbc_validate.inc`)**: `sn_bcunit_load_canonical` constrói estado temporário e valida fronteiras de instruções, operandos selecionados, índices de função/string e destinos de salto antes de substituir o destino. A verificação tipada de pilha/fluxo de controle está programada para **P10**. Construções ainda não suportadas (como `try`/`catch`/`finally` e `throw`) são rejeitadas explicitamente com `SNOVA0400`.

### 3. Compilação Nativa (`snl build` e `snl run-snbc`)

- **Build nativo padrão (`snl build <arquivo.snl> -o <saida>`)**: Verifica tipos, emite `SnBC`, gera um runner C autônomo via `sn_native_compile` (com seu próprio modelo de valores, guardas de limites/ciclos e fila de workers Pulsar) e invoca o compilador C do host. `snl run-snbc` carrega uma imagem `.snbc` canônica e a executa por esse mesmo gerador.
- **Bundle com runtime embarcado (`snl build --project <caminho> --runtime`)**: Embarca os fontes verificados do projeto e faz link com `libsnovart.a` (todos os objetos de `src/` exceto `main.c`) e os cabeçalhos do compilador. `--runtime` exige `--project` (passar `--runtime` para arquivo único retorna status `2`).

### 4. Compilador Bootstrap Self-Hosting (`bootstrap/src/`)

O repositório inclui um compilador escrito em Snovalang (`bootstrap/src/compiler.snl`, montado via `join.sh` a partir de `part_lex.snl`, `part_parse.snl`, `part_parse_decl.snl`, `part_scope_*.snl`, `part_emit*.snl` e `part_unit.snl`). Ele lê `in.snl` com `read_bytes`, executa lexing, parsing e emissão, e grava uma imagem `SNBC` versão 1 em `out.snbc` com `write_bytes`.

## Descritores de Target e Qualificação (`src/native/target.h`)

`SnTargetDescriptor` armazena largura/alinhamento de ponteiro, endianness, alinhamentos escalares (`i16`/`i32`/`i64`/`f32`/`f64`/`max_align`), convenção de chamada, larguras atômicas (`8`/`16`/`32`/`64`), tamanho mínimo de página, granularidade de alocação, flags de sistema hospedado/VM/MMIO e nível de qualificação.

| Target Triple | Ponteiro / Endian | Convenção | Atômicas | Nível de Qualificação |
| --- | --- | --- | --- | --- |
| `aarch64-apple-darwin` | 64-bit / LE | `aapcs64` | 8/16/32/64 | **QUALIFIED** |
| `x86_64-unknown-linux-gnu` | 64-bit / LE | `sysv-amd64` | 8/16/32/64 | **PENDING_VALIDATION** |
| `x86_64-pc-windows-gnu` | 64-bit / LE | `win64` | 8/16/32/64 | **PENDING_VALIDATION** |
| Demais triples hospedados (`x86_64-apple-darwin`, `aarch64-unknown-linux-gnu`, `riscv64-*`, `*bsd`, `arm`, `x86`) | Definido por target | Definido por target | Definido por target | **UNQUALIFIED** |
| Bare-metal (`*-none-*`, ex.: `aarch64-none-elf`, `arm-none-eabi`) | Definido por target | Definido por target | Definido por target | **UNQUALIFIED / BLOCKED** |

Consultas de capacidade retornam `SN_CAP_STATUS_IMPLEMENTED`, `SN_CAP_STATUS_PENDING_VALIDATION` ou `SN_CAP_STATUS_UNSUPPORTED`, emitindo `SNOVA0401`–`SNOVA0403` antes da execução quando um target inválido ou capacidade não suportada é solicitado.

## ABI C para Incorporação (`src/eval/runtime_api.h`)

Aplicações que linkam `libsnovart.a` utilizam `runtime_api.h`. Todas as funções retornam `SnRuntimeStatus` independente de `errno` do sistema (`SN_RUNTIME_OK`, `SN_RUNTIME_INVALID_ARGUMENT`, `SN_RUNTIME_NOT_FOUND`, `SN_RUNTIME_PERMISSION_DENIED`, `SN_RUNTIME_IO_ERROR`, `SN_RUNTIME_OUT_OF_MEMORY`, `SN_RUNTIME_END_OF_INPUT`). Buffers retornados por leituras de arquivo ou stdin terminam em NUL e devem ser liberados com `sn_runtime_free()`.

```c
char *text = NULL;
size_t len = 0;
SnRuntimeStatus st = sn_runtime_file_read("config.txt", &text, &len);
if (st == SN_RUNTIME_OK) {
    /* usar text */
    sn_runtime_free(text);
}
```
