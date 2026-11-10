#!/bin/bash
cd "$(dirname "$0")"
echo "Isto DESLIGA TODOS os robos e FECHA as posicoes de cripto a mercado."
read -r -p "Digite SIM para continuar: " ok
[ "$ok" = "SIM" ] || exit 0
docker compose run --rm --no-deps web npx tsx scripts/emergencia.ts "acionada pelo dono"
echo; echo "Confira tambem no app/site da Foxbit e da Clear e REVOGUE as chaves de API se quiser garantir."
read -r -p "Enter para fechar..." _
