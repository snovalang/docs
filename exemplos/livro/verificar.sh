#!/bin/sh
# Reexecuta todos os exemplos do livro "Snova: a linguagem cataclisma".
#
# Uso:
#   SNOVA_REPO=/caminho/para/snovalang sh verificar.sh [padrao]
#
# SNOVA_REPO aponta para o repositório do compilador escrito em Snova.
# O script usa $SNOVA_REPO/build/bootstrap/snova-bootstrap (gerado por
# `make bootstrap-build`). O modo nativo procura bootstrap/runtime/*.snl
# relativo ao diretório atual, por isso cada compilação roda dentro de
# $SNOVA_REPO. O backend nativo só é qualificado em aarch64-apple-darwin.
set -u
: "${SNOVA_REPO:?defina SNOVA_REPO com o caminho do repositorio snovalang}"
AQUI=$(cd "$(dirname "$0")" && pwd)
C=${SNOVA_BOOTSTRAP:-$SNOVA_REPO/build/bootstrap/snova-bootstrap}
SAIDA=${SNOVA_SAIDA:-$AQUI/.saida}
mkdir -p "$SAIDA"
SDK_PATH=$(xcrun --show-sdk-path 2>/dev/null)
SDK_VERSION=$(xcrun --show-sdk-version 2>/dev/null)
cd "$SNOVA_REPO" || exit 1

for f in "$AQUI"/${1:-*}.snl; do
  n=$(basename "$f" .snl)
  echo "=== $n"
  o=$("$C" "$f" "$SAIDA/$n.snbc" 2>&1); e=$?
  echo "compilar: status $e${o:+ | $o}"
  if [ $e -eq 0 ]; then
    o=$(cd "$SAIDA" && LIVRO_SNOVA=ok "$C" "$SAIDA/$n.snbc" run um dois 2>&1); e=$?
    echo "vm: status $e"; [ -n "$o" ] && echo "$o"
  fi
  o=$("$C" "$f" "$SAIDA/$n.s" native 2>&1); e=$?
  echo "nativo-compilar: status $e${o:+ | $o}"
  if [ $e -eq 0 ] && [ -n "$SDK_PATH" ]; then
    as -arch arm64 "$SAIDA/$n.s" -o "$SAIDA/$n.o" &&
    ld -arch arm64 -platform_version macos "$SDK_VERSION" "$SDK_VERSION" \
       -syslibroot "$SDK_PATH" -lSystem -e _main "$SAIDA/$n.o" -o "$SAIDA/$n.native" &&
    { o=$(cd "$SAIDA" && LIVRO_SNOVA=ok SNOVA_MEMORY_REPORT=1 "$SAIDA/$n.native" um dois 2>&1); e=$?
      echo "nativo: status $e"; [ -n "$o" ] && echo "$o"; }
  fi
done
