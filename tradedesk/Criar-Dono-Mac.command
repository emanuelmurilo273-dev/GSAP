#!/bin/bash
cd "$(dirname "$0")"
if [ ! -f .env ]; then echo "Rode primeiro o Instalar-Mac.command e preencha o .env (Supabase e OWNER_EMAIL)."; read -r -p "Enter para fechar..." _; exit 1; fi
docker compose run --rm --no-deps web npx tsx scripts/criar-dono.ts
read -r -p "Pressione Enter para fechar..." _
