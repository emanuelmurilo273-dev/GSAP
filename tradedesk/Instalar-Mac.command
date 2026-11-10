#!/bin/bash
# Duplo clique no Finder (ou: bash Instalar-Mac.command). Abre o Terminal e roda o instalador.
cd "$(dirname "$0")"
chmod +x scripts/instalar-mac.sh 2>/dev/null
bash scripts/instalar-mac.sh
echo; read -r -p "Pressione Enter para fechar..." _
