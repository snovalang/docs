---
title: "10. Arquitetura do compilador"
description: O compilador da Snova do primeiro byte ao último, com lexer, parser Pratt, estado em arrays paralelos, emissão de SnBC, formato da imagem, validador, VM, backend nativo, o bootstrap em estágios e uma revisão com melhorias priorizadas.
page_id: livro-10
section_label: "Livro · Capítulo 10"
permalink: /pt-br/livro/10-arquitetura/
---

O capítulo 9 terminou com uma pergunta: como 8 mil linhas de Snova leem o próprio código-fonte, geram bytecode, executam esse bytecode e chegam a um ponto fixo? A resposta passa por seis peças e por uma sequência de estágios de bootstrap.

## Mapa do código

Linhas contadas com `wc -l` em 22/11/2026:

| Peça | Arquivos | Linhas |
| --- | --- | --- |
| Frontend (lexer, parser, contratos) | `Unit`, `Lex`, `Parse`, `ParseDecl`, `ScopeParse` | 1.665 |
| Emissão de SnBC | `Emit`, `EmitExpr`, `EmitStmt`, `ScopeEmit`, `ScopeMatch` | 1.506 |
| Leitor e validador de imagem | `ImageReader`, `ImageCode` | 158 |
| VM em Snova | `Vm*` (9 arquivos) | 1.303 |
| Backend nativo e contratos de alvo | `Native*`, `ProcessorArchitecture`, `OperatingSystemRuntime`, `CallingConvention`, `ExecutableFormat` | 1.957 |
| Driver | `Compiler`, `SourceJoin`, `Runtime` | 442 |
| **Total de `bootstrap/src/`** | 39 arquivos | **7.031** |
| Runtime nativo | `bootstrap/runtime/` (9 tipos) | 825 |
| Biblioteca de dados | `bootstrap/library/` | 558 |

```text
 fonte (int[])
     │  lexAll            Lex.snl            → tokens em arrays paralelos
     ▼
 parseFile                Parse*/ScopeParse  → nós de AST, tabelas de símbolos
     │  scopeValidateImplementations          → SNV5001
     ▼
 emitUnit                 Emit*/ScopeEmit/ScopeMatch → bytecode por função
     ▼
 writeImage               Compiler.snl       → imagem SnBC (int[])
     ▼
 validateImage            ImageReader/ImageCode
     ├──► writeImageFile                       (modo SnBC)
     ├──► runImage → vmRun                     (modo run)
     └──► NativeBackend.emit → .s              (modo native)
```

## 1. O estado: arrays paralelos

Não existe tipo `Token` nem tipo `Node`. Todo o frontend vive em um `struct CompilerState` com **57 arrays de `int`** (`Unit.snl`):

- tokens: `tk` (tipo), `ts` (início), `tn` (tamanho), `tv` (valor numérico), `tl` (linha);
- nós de AST: `nk` (tipo), `na`, `nb`, `nc`, `nd` (até quatro filhos ou atributos);
- símbolos: `st_*` (tipos declarados), `fd_*` (campos), `fn_*` (funções), `par_*` (parâmetros), `loc_*` (locais), `va_*` (variantes), `impl_*` (implementações);
- pool de strings, código emitido, pilhas de `break`/`continue` e avisos.

Um token "é" o índice `i`, e seu texto é `src[ts[i] .. ts[i] + tn[i]]`. Um nó também é um índice. `node(bg, k, a, b, c, d)` acrescenta uma posição a cada um dos cinco arrays de nó e devolve o índice.

**Por que assim?** Porque era o que a raiz `snl v0.3.0` compilava com segurança. As sondas registradas no ADR-0007 mostraram que a raiz recusava chamadas de método em receptores guardados em campos, métodos estáticos no código do compilador e arrays compartilhados entre dois campos. Com essas restrições, arrays paralelos de `int` dentro de um único struct eram a estrutura mais robusta. O plano de maturidade chama isso de dívida e descreve a saída: contratos tipados por fase (fonte → sintaxe → semântica → IR → artefato), introduzidos em fatias pequenas que preservem o ponto fixo.

## 2. Lexer

`lexAll` percorre o buffer com um `LexerCursor { i, line }` e chama `lexOne` para cada posição. Palavras reservadas são reconhecidas por `isWord`, uma função de **16 parâmetros**: o tamanho esperado e até 12 códigos de byte. Um exemplo:

```snova
if isWord(src, s, n, 6, 114, 101, 116, 117, 114, 110, 0, 0, 0, 0, 0, 0) { return 13 }   // "return"
```

Parece estranho, e o motivo é concreto: o subconjunto da semente não comparava strings por conteúdo (o `snl v0.3.0` compara identidade, como no capítulo 5). Comparar bytes do buffer com constantes numéricas era o único jeito confiável. O mesmo truque aparece em `typeCode` (`int`, `bool`, `string`), `scopeBuiltinName` e `runtimeCallId`.

## 3. Parser

O parser de expressões é um **Pratt parser** clássico. `parseExpr(min_bp)` lê um primário, aplica os pós-fixos (chamada, membro, índice, literal de struct) e consome operadores enquanto `infixBp(k) >= min_bp`. A tabela de *binding powers* é a tabela de precedência do capítulo 3. Declarações (`parseFile`, `parseFunc`, `parseStruct`, `scopeParseClass`, `scopeParseImpl`, `scopeParseEnum`) registram símbolos nas tabelas durante a própria análise, e por isso a ordem das declarações não importa para a emissão.

`cx.no_struct` resolve uma ambiguidade conhecida: em `if x { … }`, o `{` não pode ser lido como início de um literal `x { campo: … }`. `scopeParseMatch` liga esse sinalizador enquanto lê o sujeito do `match`.

Terminado o parse, `scopeValidateImplementations` confere cada `implements`/`impl` (o `SNV5001` do capítulo 7).

## 4. Emissão de SnBC

`emitUnit` percorre as funções na ordem de declaração. `emitFunc` emite o corpo, e `emitExpr`/`emitStmt` traduzem os nós diretamente para bytes. **Não há IR intermediária.** Detalhes de projeto que garantem saída determinística, todos descritos no cabeçalho de `Unit.snl`:

- funções na ordem do código-fonte;
- número de locais da função = maior quantidade simultânea (*high-water*);
- pool de strings na ordem do **primeiro uso** (`internSpan` e `internBytes` deduplicam);
- `&&` e `||` com saltos de curto-circuito;
- toda função termina com o epílogo `PUSH_UNIT; RETURN`, mesmo que já tenha retornado.

Saltos para frente são emitidos com deslocamento provisório e corrigidos depois (`emitJump`, `patchAt`), e os arrays `fat`/`fb` guardam as correções pendentes.

### O formato da imagem, byte a byte

```snova
package livro.mini

func main(): int {
    let a = 40
    return a + 2
}
```

```text
00000000: 534e 4243 0100 0000 0000 0000 0000 0000  SNBC............
00000010: 0100 0000 0400 0000 6d61 696e 0000 0000  ........main....
00000020: 0100 0000 2100 0000 0128 0000 0000 0000  ....!....(......
00000030: 0009 0000 0000 0608 0000 0000 0102 0000  ................
00000040: 0000 0000 000c 2305 23                   ......#.#
```
{% include exemplo.html modos="SnBC (73 bytes); a VM retorna 42" cmd="snova-bootstrap mini.snl mini.snbc && xxd mini.snbc" %}

| Bytes | Campo (`writeImage`, `Compiler.snl`) | Valor |
| --- | --- | --- |
| `53 4e 42 43` | magia | `SNBC` |
| `01 00 00 00` | versão (u32 little-endian) | 1 |
| `00 00 00 00` | índice de `main` | 0 |
| `00 00 00 00` | quantidade de strings no pool | 0 |
| `01 00 00 00` | quantidade de funções | 1 |
| `04 00 00 00` + `main` | nome da função | `main` |
| `00 00 00 00` | aridade | 0 |
| `01 00 00 00` | locais | 1 |
| `21 00 00 00` | tamanho do código | 33 |
| `01` + i64 `40` | `PUSH_INT 40` | |
| `09` + u32 `0` | `STORE_LOCAL 0` (deixa o valor na pilha) | |
| `06` | `POP` | |
| `08` + u32 `0` | `LOAD_LOCAL 0` | |
| `01` + i64 `2` | `PUSH_INT 2` | |
| `0c` | `ADD` (12) | |
| `23` | `RETURN` (35) | |
| `05 23` | epílogo: `PUSH_UNIT`, `RETURN` | |

O apêndice traz a tabela de opcodes usados pelo compilador.

## 5. Validação

Antes de gravar, executar ou traduzir, `validateImage` confere a imagem gerada. `validateCode` (`ImageCode.snl`) verifica, para cada função: largura de cada opcode, último opcode (precisa ser `RETURN`, `HALT`, armadilha ou salto), índices de string, local e função dentro dos limites, **aridade exata de cada `CALL`**, IDs de chamadas de runtime e suas aridades, destinos de salto que caem no início de uma instrução, e opcodes ainda não implementados (10, 11, 34, 41 e 44 são recusados). É essa rede que transforma o erro de aridade do capítulo 7 em `invalid generated SnBC image`, em vez de um travamento.

## 6. Os dois executores

Descritos no capítulo 8. Para a arquitetura, o que importa é que o backend nativo **não lê a AST**: ele decodifica a imagem SnBC validada (`NativeImage`), descobre os papéis dos métodos do runtime pelo nome `Tipo.metodo` (`NativeRoles`), modela a pilha de operandos para decidir ownership (`NativeOwnership`) e emite instruções (`NativeValueEmitter`, `NativeInstructionEmitter`, `NativeBoundary`), juntando o texto em `NativeAssembly`. O SnBC funciona como uma IR **de fato**, mas sem tipos, e é por isso que o backend precisa de etiquetas de 16 bytes em todos os slots.

### Contratos de alvo, ainda sem despacho dinâmico

`ProcessorArchitecture`, `OperatingSystemRuntime`, `CallingConvention`, `ExecutableFormat` e `NativeToolchain` são interfaces já declaradas (ADR-0008). Mesmo assim, o backend escolhe o alvo por um inteiro `targetKind` consultado em `NativeTargetResolver` (`symbolPrefix`, `textSection`…), e não por despacho de interface. O motivo é o problema do ovo e da galinha do bootstrap: quando esse código foi escrito, a semente ainda não conseguia gerar despacho de interface para SnBC (o `snl` recusa com `SNOVA0400`) nem comparar strings por conteúdo. Por isso o nome do alvo é comparado gravando-o em um arquivo de rascunho e relendo os bytes (`equalsAsciiFile`), a mesma técnica do capítulo 5.

## 7. Bootstrap: de onde vem cada geração

```text
snl v0.3.0 (raiz transitória, snovac)
   │ snl build --project bootstrap/src
   ▼
snova-bootstrap  (SnBC do compilador + VM em C do snl)
   │ sem argumentos: SourceJoin junta os 39 módulos → compila
   ▼
stage1.snbc ──► snl run-snbc stage1.snbc ──► stage2.snbc        cmp: iguais  (bootstrap-fixed-point)
   │
   └──► snova-bootstrap stage1.snbc run ──► vm-stage.snbc        cmp: iguais  (bootstrap-vm-self)

snova-bootstrap Compiler-joined.snl native ──► compiler-native (Mach-O)
   compiler-native  ──► stage2.s     cmp: iguais
   compiler-native-stage2 ──► stage3.s   cmp: iguais              (bootstrap-native-self)
```

Reexecutado para este livro em 22/11/2026:

| Portão | Resultado | Hash SHA-256 |
| --- | --- | --- |
| SnBC: `stage1` = imagem gerada pela VM em Snova rodando o compilador | iguais, 164.151 bytes | `26c36364fd47a74bdfe26066f0e79d2dd1d0f3b3a8336b9b03fd4279b532f185` |
| Nativo: assembly da 1ª geração = assembly da 2ª geração | iguais, 482.203 linhas | `dda5816a9a6054ed514aa78011bac621ae3b8ea69462daaec3448f9d3f29f5cf` |
| SnBC gerado pelo compilador nativo = SnBC gerado pelo bundle | iguais (`cmp`) | — |

### O que foi provado e o que não foi

O ADR-0002 obriga o projeto a separar afirmações que costumam ser misturadas:

| Afirmação | Situação |
| --- | --- |
| Bootstrap funcional (a geração N compila a N+1) | **demonstrado** em SnBC e em nativo Darwin |
| Determinismo de artefato (mesma entrada, mesmos bytes) | **demonstrado** em SnBC e em assembly |
| Ponto fixo sob comparação explícita | **demonstrado** em assembly. Executáveis Mach-O não são comparados, porque carregam UUID e assinatura |
| Reprodutibilidade em build limpo | `make bootstrap-reproducible` existe; o projeto marca a meta como ainda sem execução completa registrada como evidência |
| DDC (*Diverse Double-Compiling*) | **não demonstrado**: não existe uma segunda raiz independente |
| Ponto fixo nativo em Linux AArch64 | **não qualificado**: o assembly da primeira e da segunda geração diferiu no contêiner (`evidence.md`) |

## Revisão do compilador: melhorias priorizadas

Esta revisão junta o que as sondas e a leitura do código mostraram. A ordem segue o impacto em quem usa a linguagem hoje.

### Defeitos verificados

| # | Defeito | Onde | Efeito | Correção sugerida |
| --- | --- | --- | --- | --- |
| 1 | Busca de método por interface ordena pelo comprimento antes dos bytes | `vmCompareMethodName`, `VmValue.snl` | `method not found` na VM para programas válidos (capítulo 6) | comparar os bytes até o fim do menor nome, e só então os comprimentos |
| 2 | `extends` aceito e ignorado | `scopeSkipToBrace`, `ScopeParse.snl` | herança aparenta funcionar até o primeiro método herdado | rejeitar `extends` com diagnóstico próprio até haver suporte |
| 3 | Leitura fora dos limites devolve `unit` | VM e runtime nativo | erros silenciosos | verificar limites, com erro de execução |
| 4 | `match` sem braço reporta `bodyless routine trapped` | opcode 52 | mensagem enganosa | mensagem específica para o epílogo de `match` |
| 5 | Modo `native` depende do diretório atual | `runtimeFiles`, `SourceJoin.snl` | `cannot read 'bootstrap/runtime/…'` fora da raiz | resolver os caminhos a partir de uma variável ou da localização do compilador |
| 6 | Mensagem de uso inalcançável | `main`, `Compiler.snl` | `argc == 1` retorna antes do teste `argc < 2` | mostrar o uso em argumentos inválidos |
| 7 | `SNV3001` com linha aproximada e deslocada no modo `native` | `fail`/`reportFailure` | erros difíceis de localizar | guardar o span do nó; descontar o runtime anexado |

### Sistema de tipos (capítulo 7)

1. Propagar `fn_return_ty` para `cx.expr_ty` depois das chamadas.
2. Guardar o tipo do elemento em `parseType` para `T[]`.
3. Verificar tipos de argumentos contra `par_ty`.
4. Aceitar classe → interface implementada em anotações e atribuições.
5. Tornar `let` imutável e exigir inicializador (ou valor padrão) para locais.

### Desempenho: o gargalo medido do compilador nativo

O compilador nativo gera SnBC **2,7× mais rápido** que o bundle (0,86 s contra 2,32 s para as 6.950 linhas do código-fonte juntado), mas leva **o mesmo tempo** para gerar assembly nativo (5,02 s contra 5,00 s). Um perfil de 3 s com `sample` durante a geração nativa resolveu a dúvida. Os símbolos `snova_fn_N` foram mapeados para nomes lendo a tabela de funções da imagem SnBC correspondente (500 funções, o mesmo número de rótulos no `.s`):

| Função | Amostras no topo da pilha | Fatia |
| --- | --- | --- |
| `Heap.copyBytes` | 1.591 de 2.468 | 64% |
| `Primitive.loadByte` | 137 | 6% |
| `Ownership.releaseSlots` | 95 | 4% |
| `Primitive.storeByte` | 82 | 3% |
| `Ownership.release` | 75 | 3% |

`Heap.copyBytes` copia **um byte por iteração, com duas chamadas de função por byte**:

```snova
public static method copyBytes(target: int, source: int, count: int): unit {
    var index = 0
    while index < count {
        Primitive.storeByte(target + index, Primitive.loadByte(source + index))
        index = index + 1
    }
}
```

Toda concatenação de strings passa por ela (`Text.concat`), e o backend monta 482 mil linhas de assembly concatenando strings, ainda que com junção por metades em O(n log n) cópias (`NativeAssembly.joinRange`). O ADR-0006 já registrava "byte copies go through primitive calls… slow paths" como proposta para o N3. O perfil confirma que essa é **a** prioridade:

1. copiar em palavras de 8 bytes (`copyWords` já existe) com resto byte a byte, ou criar um primitivo `memcpy` inline na fronteira;
2. liberação de slots inline por slot, em vez do laço `releaseSlots`;
3. depois disso, alocação de registradores e eliminação de código morto (o runtime inteiro vai em cada executável).

### Arquitetura

Seguir os portões já ordenados em `docs/roadmap/maturity.md`: herança e restrições genéricas na semente → contratos tipados no lugar dos arrays paralelos → IR tipada e validada antes do backend → igualdade de strings por conteúdo e despacho de interface no próprio compilador → x86-64 Linux. As buscas lineares em tabelas (`findStruct`, `findLocal`, `findFunc`) só passam a valer a troca por hash quando houver tabelas de símbolos tipadas.

## O que parecia insolúvel

Dois números deste capítulo pedem explicação: o compilador nativo é 2,7× mais rápido em uma tarefa e igual em outra. E quanto custam, afinal, as escolhas do livro inteiro, como VM iterativa, slots de 16 bytes, ownership em vez de coletor e cópia byte a byte? O capítulo 11 mede tudo com método declarado.
