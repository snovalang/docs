---
title: Diagnósticos e Verificação
description: Catálogo exato de códigos SNOVA verificado diretamente nos cabeçalhos de snovac, além das suítes de teste, conformidade, fuzzing e benchmark.
page_id: diagnostics
section_label: Compilador e Runtime
permalink: /pt-br/diagnostics/
---

O `snovac` emite códigos numéricos estáveis formatados entre `SNOVA0001` e `SNOVA0499`, divididos em faixas por fase de compilação para evitar deslocamentos entre versões.

## Catálogo de Códigos de Diagnóstico

### Lexer (`0001`–`0099`, `src/base/diag.h`)

| Código | Constante | Significado |
| --- | --- | --- |
| `SNOVA0001` | `SNOVA_UNTERMINATED_STRING` | Literal de string atingiu EOF sem fechar `"`. |
| `SNOVA0002` | `SNOVA_UNTERMINATED_CHAR` | Literal de caractere não fechado com `'`. |
| `SNOVA0003` | `SNOVA_UNKNOWN_CHARACTER` | Caractere não reconhecido no código-fonte. |
| `SNOVA0004` | `SNOVA_INVALID_NUMBER` | Literal numérico malformado. |
| `SNOVA0005` | `SNOVA_INVALID_ESCAPE` | Sequência de escape inválida em string ou char. |
| `SNOVA0006` | `SNOVA_UNTERMINATED_INTERP` | Interpolação `${...}` não fechada dentro de string. |

### Resolução, Pacotes e Forma de Declaração (`src/sema/package.h`, `resolve.h`, `check.h`, `project.c`)

| Código | Constante | Significado |
| --- | --- | --- |
| `SNOVA0008` | `SNOVA_UNCLOSED_BRACE` | Delimitador `{` sem `}` correspondente até EOF. |
| `SNOVA0011` | `SNOVA_LEGACY_TYPE_SPELLING` | **Aviso**: grafia capitalizada legada de primitivo (ex.: `Int` em vez de `int`). |
| `SNOVA0013` | `SNOVA_AWAIT_OUTSIDE_ASYNC` | `await` usado fora de `async func` ou `async method`. |
| `SNOVA0023` | `SNOVA_UNDECLARED_NAME` | Identificador não encontrado nos escopos local, de membro, pacote, imports ou prelúdio. |
| `SNOVA0027` | `SNOVA_UNKNOWN_TYPE` | Tipo inexistente em todo o grafo de pacotes. |
| `SNOVA0028` | `SNOVA_UNKNOWN_MEMBER` | Membro não existe no tipo alvo. |
| `SNOVA0030` | `SNOVA_FUNC_IN_TYPE_BODY` | `func` declarada dentro de classe/struct (use `method`; `func` é permitida em `extension`). |
| `SNOVA0031` | `SNOVA_METHOD_AT_TOP_LEVEL` | `method` declarado no nível superior (use `func`). |
| `SNOVA0047` | `SNOVA_IMMUTABLE_REASSIGN` | Reatribuição a binding imutável `let` (fora de `constructor`). |
| `SNOVA0050` | `SNOVA_IMPORT_NOT_FOUND` | Pacote importado não descoberto no grafo. |
| `SNOVA0051` | `SNOVA_IMPORT_FILE_EXTENSION` | Caminho de `import` contém extensão de arquivo. |
| `SNOVA0052` | *(project.c)* | Diretório de submódulo listado em `references = [...]` no `mod.sns` não existe. |
| `SNOVA0100` | `SNOVA_UNTYPED_VARIABLE` | Variável ou literal de array vazio sem anotação ou contexto inferível. |
| `SNOVA0108` | `SNOVA_IMPORT_CYCLE` | Ciclo circular de imports entre dois ou mais pacotes distintos. |
| `SNOVA0109` | `SNOVA_MISSING_PACKAGE_DECL` | Arquivo `.snl` sem declaração `package`. |
| `SNOVA0120` | `SNOVA_DUPLICATE_DECL` | Nome duplicado no escopo ou assinatura de método idêntica repetida. |
| `SNOVA0121` | `SNOVA_TYPE_NOT_IMPORTED` | Tipo existe no grafo de pacotes, mas não foi importado no arquivo atual. |

### Pulsar e Verificador de Tipos (`0122`–`0220`, `src/sema/check.h`, `borrow.h`)

| Código | Constante | Significado |
| --- | --- | --- |
| `SNOVA0122` | `SNOVA_PULSAR_INVALID_RETURN` | Retorno de rotina `pulsar` diferente de `unit`, `Channel<T>` ou `Select<T>`. |
| `SNOVA0124` | `SNOVA_PULSAR_DIRECT_CALL` | Chamada direta a rotina `pulsar` (deve ser disparada com `pulsar`). |
| `SNOVA0125` | `SNOVA_PULSAR_IN_ASYNC` / `SNOVA_PULSAR_MUTABLE_CAPTURE` | Rotina marcada como `async` e `pulsar`, ou captura de binding mutável em tarefa Pulsar. |
| `SNOVA0126` | `SNOVA_PULSAR_NON_SEND_CAPTURE` | Captura de valor não-`Send` através de fronteira Pulsar. |
| `SNOVA0131` | `SNOVA_ARITY_MISMATCH` | Quantidade de argumentos incompatível com parâmetros. |
| `SNOVA0132` | `SNOVA_ARG_TYPE_MISMATCH` | Tipo de argumento incompatível com parâmetro. |
| `SNOVA0133` | `SNOVA_BINARY_TYPE_MISMATCH` | Operandos incompatíveis em operador binário (sem promoção implícita). |
| `SNOVA0134` | `SNOVA_UNARY_TYPE_MISMATCH` | Tipo de operando inválido para operador unário. |
| `SNOVA0135` | `SNOVA_CONDITION_NOT_BOOL` | Condição de `if` ou `while` não é `bool`. |
| `SNOVA0136` | `SNOVA_RETURN_TYPE_MISMATCH` | Expressão retornada não bate com o tipo da assinatura. |
| `SNOVA0137` | `SNOVA_NOT_CALLABLE` | Tentativa de invocar valor não chamável. |
| `SNOVA0138` | `SNOVA_LET_TYPE_MISMATCH` | Inicializador incompatível com o tipo declarado. |
| `SNOVA0139` | `SNOVA_BREAK_OUTSIDE_LOOP` | `break` fora de `while` ou `for`. |
| `SNOVA0140` | `SNOVA_CONTINUE_OUTSIDE_LOOP` | `continue` fora de `while` ou `for`. |
| `SNOVA0141` | `SNOVA_UNHANDLED_ERROR` / `SNOVA_ABSTRACT_INSTANTIATION` | `Error` verificado não capturado nem declarado com `throws`, ou instanciação de classe `abstract`. |
| `SNOVA0142` | `SNOVA_MISSING_RETURN` | Função com retorno não-`unit` pode sair sem retornar. |
| `SNOVA0143` | `SNOVA_PRIVATE_ACCESS` | Acesso a membro `private` fora do tipo declarante. |
| `SNOVA0144` | `SNOVA_GENERIC_ARITY_MISMATCH` | Número incorreto de argumentos genéricos. |
| `SNOVA0145` | `SNOVA_NARROWING_CONVERSION` | Conversão com estreitamento (proibida mesmo com `as`). |
| `SNOVA0146` | `SNOVA_AMBIGUOUS_OVERLOAD` | Múltiplas sobrecargas igualmente compatíveis. |
| `SNOVA0147` | `SNOVA_NO_MATCHING_OVERLOAD` | Nenhuma sobrecarga compatível com os argumentos. |
| `SNOVA0149` | `SNOVA_ARRAY_ELEMENT_TYPE_MISMATCH` | Elemento de literal de array incompatível com o tipo inferido. |
| `SNOVA0150` | `SNOVA_FOR_BINDING_TYPE_MISMATCH` / `SNOVA_PKG_PATH_MISMATCH` | Tipo explícito da variável de `for` incompatível com a fonte, ou divergência de caminho de pacote. |
| `SNOVA0151` | `SNOVA_STRUCT_BRACE_INIT` | Struct inicializada com parênteses em vez de chaves (`Point{...}`). |
| `SNOVA0200`–`0204` | `SNOVA_OPTIONAL_*` / `SNOVA_NESTED_OPTIONAL` | Uso incorreto de opcionais (`?.`, `??`, fallback incompatível, `T??`). |
| `SNOVA0205` | `SNOVA_NON_EXHAUSTIVE_MATCH` | `match` não exaustivo. |
| `SNOVA0210`–`0211` | `SNOVA_ANY_*` | `any` em API pública de biblioteca ou inferido implicitamente. |
| `SNOVA0215`–`0216` | `SNOVA_INFINITE_LOOP` / `SNOVA_EMPTY_LOOP` | Diagnósticos de higiene de laços. |
| `SNOVA0220` | `SNOVA_PROHIBITED_NATIVE` | Declaração `@Native` fora das fronteiras permitidas. |

### Ownership e Borrow Checker (`0240`–`0251`, `src/sema/borrow.h`)

| Código | Constante | Significado |
| --- | --- | --- |
| `SNOVA0240` | `SNOVA_USE_AFTER_MOVE` | Leitura, mutação ou novo move após transferência de propriedade. |
| `SNOVA0241` | `SNOVA_USE_AFTER_DROP` | Referência sobrevive ao bloco/binding proprietário. |
| `SNOVA0242` | `SNOVA_EXCLUSIVE_BORROW` | Conflito de empréstimo exclusivo. |
| `SNOVA0243` | `SNOVA_MUT_WHILE_SHARED` | Mutação enquanto existe empréstimo compartilhado ativo. |
| `SNOVA0244` | `SNOVA_SEND_WHILE_BORROWED` | Compartilhamento/envio entre tarefas de valor emprestado ou mutável. |
| `SNOVA0245` | `SNOVA_NULL_DEREF` | Desreferência de `&T?` sabidamente nulo. |
| `SNOVA0246` | `SNOVA_INDEX_OOB` | Índice de array estaticamente fora dos limites. |
| `SNOVA0247` | `SNOVA_DEFER_UNSOUND` | Empréstimo inseguro capturado por `defer`. |
| `SNOVA0248` | `SNOVA_BORROW_LIMIT` | Teto de rastreamento (`SN_BORROW_MAX = 96`) excedido. |
| `SNOVA0249` / `0250` | `SNOVA_BORROW_BRANCH` / `SNOVA_BORROW_LOOP` | Estado de borrow inseguro em desvio ou laço. |
| `SNOVA0251` | `SNOVA_PARTIAL_MOVE` | Move parcial ilegal de elemento de array ou campo de agregado. |

### Runtime, Lowering e Targets (`0300`–`0499`)

| Código | Significado |
| --- | --- |
| `SNOVA0304` | Erro de runtime (ex.: índice de array fora dos limites). Não capturável; dispara unwind em `snl run` e encerra com status `1`. |
| `SNOVA0305` | Erro de `defer` em runtime ("defer call must name a function", ex.: chamada de método). |
| Saída `70` | Limite de 64 MiB do heap de fallback do interpretador excedido. |
| `SNOVA0400` | `SNOVA_EMIT_UNSUPPORTED`: instrução/construção sem lowering para `SnBC` (ex.: `try`/`catch`/`finally`, `throw`). |
| `SNOVA0401` | `SNOVA_CAPABILITY_UNSUPPORTED`: capacidade não suportada no target/backend. |
| `SNOVA0402` | `SNOVA_CAPABILITY_PENDING`: capacidade aguarda qualificação executável do target. |
| `SNOVA0403` | `SNOVA_TARGET_INVALID`: target triple inválido em `--target`. |

## Portões de Verificação e Qualidade

Definidos diretamente no `Makefile` de `snovac`:

```sh
make -j2 test          # Alias de `make unit`: fixtures de CLI, battery.sh e 10 binários de teste unitário em C
make conformance       # Conformidade léxica e sintática no corpus (com conformance.allow)
make fuzz-snbc-smoke   # 10.001 casos determinísticos do loader SnBC sob ASan + UBSan
python3 scripts/bench_compile.py tests/run-pass/hello.snl --runs 10
```

- `tests/battery.allow` mantém a lista executável exata de lacunas semânticas conhecidas (21 entradas na linha base: 8 fixtures positivos e 13 negativos). Regressões novas ou entradas obsoletas falham o gate.
- `tests/conformance.allow` registra 3 exceções de parser (`SNOVA0148` para literais de função passados sem invocação imediata para `spawn`, `scope` e `Parallel`).
