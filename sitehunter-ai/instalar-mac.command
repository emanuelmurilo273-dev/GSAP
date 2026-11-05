#!/bin/sh
# Instalador do SiteHunter AI (Mac e Linux). Dois cliques no Mac, ou: sh instalar-mac.command
cd "$(dirname "$0")" || exit 1
echo ""
echo "  SiteHunter AI - instalação no seu computador"
echo ""
if ! command -v docker >/dev/null 2>&1; then
  echo "  O Docker Desktop não foi encontrado."
  echo "  Instale em https://www.docker.com/products/docker-desktop, abra o programa e rode este instalador de novo."
  (open https://www.docker.com/products/docker-desktop 2>/dev/null || true)
  read -r _; exit 1
fi
if ! docker info >/dev/null 2>&1; then
  echo "  O Docker Desktop está instalado, mas não está aberto. Abra-o, espere ficar pronto e rode de novo."
  read -r _; exit 1
fi
if [ ! -f .env.local-docker ]; then
  printf "  Seu e-mail (será o login do app): "; read -r EMAIL
  while :; do
    printf "  Crie uma senha (mínimo 12 caracteres): "; stty -echo; read -r PASS; stty echo; echo ""
    [ ${#PASS} -ge 12 ] && break
    echo "  A senha precisa ter pelo menos 12 caracteres."
  done
  umask 077
  printf 'OWNER_EMAIL=%s\nOWNER_PASSWORD=%s\nOSM_CONTACT_EMAIL=%s\n# Opcionais: GOOGLE_PLACES_API_KEY=  ANTHROPIC_API_KEY=  UNSPLASH_ACCESS_KEY=\n' "$EMAIL" "$PASS" "$EMAIL" > .env.local-docker
else
  echo "  Já existe uma instalação. Atualizando e iniciando..."
fi
echo ""
echo "  Montando o app (a primeira vez demora de 5 a 10 minutos)..."
docker compose -f docker-compose.local.yml up -d --build || { echo "  Algo deu errado. Copie a mensagem acima."; read -r _; exit 1; }
echo "  Esperando o app ficar pronto..."
i=0
until curl -fsS http://localhost:3000/api/health >/dev/null 2>&1; do
  i=$((i+1)); [ $i -gt 90 ] && { echo "  Demorou mais que o esperado. Abra http://localhost:3000 em alguns minutos."; read -r _; exit 0; }
  sleep 2
done
# A conta já foi criada: tira a senha do arquivo de configuração.
grep -v '^OWNER_PASSWORD=' .env.local-docker > .env.local-docker.tmp && mv .env.local-docker.tmp .env.local-docker
echo ""
echo "  Pronto! Abrindo http://localhost:3000 — entre com o e-mail e a senha que você escolheu."
(open http://localhost:3000 2>/dev/null || xdg-open http://localhost:3000 2>/dev/null || true)
echo "  O app volta sozinho sempre que o Docker Desktop estiver aberto."
