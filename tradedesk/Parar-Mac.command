#!/bin/bash
cd "$(dirname "$0")"
docker compose down
if [ -f supabase/config.toml ] && command -v npx >/dev/null 2>&1; then npx --yes supabase@latest stop; fi
echo "Robo e servicos parados. Seus dados ficam guardados."
read -r -p "Pressione Enter para fechar..." _
