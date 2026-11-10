#!/bin/bash
cd "$(dirname "$0")"
docker compose run --rm --no-deps -v "$(pwd):/out" -e OUT=/out/DIAGNOSTICO-CRIPTO-SEUS-DADOS.md web npx tsx scripts/autopsia-cripto.ts
echo; echo "Abra o arquivo DIAGNOSTICO-CRIPTO-SEUS-DADOS.md desta pasta."; read -r -p "Enter para fechar..." _
