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
# Daqui em diante tudo o que aparece na tela também vai para instalacao-log.txt (para diagnóstico).
{
echo ""
echo "  Baixando o app pronto (cerca de 1 GB na primeira vez)..."
if ! docker compose -f docker-compose.local.yml pull; then
  echo "  Não deu para baixar o app pronto; vou montar no seu computador (de 5 a 15 minutos)..."
  docker compose -f docker-compose.local.yml build || { echo "  A montagem falhou. Envie o arquivo instalacao-log.txt desta pasta para o suporte."; read -r _; exit 1; }
fi
docker compose -f docker-compose.local.yml up -d || { echo "  O app não iniciou. Envie o arquivo instalacao-log.txt desta pasta."; read -r _; exit 1; }
echo "  Esperando o app ficar pronto..."
i=0
until curl -fsS http://localhost:3000/api/health >/dev/null 2>&1; do
  i=$((i+1)); [ $i -gt 120 ] && { echo "  Demorou mais que o esperado. Últimas mensagens do app:"; docker compose -f docker-compose.local.yml logs --tail 40 app; echo "  Envie o arquivo instalacao-log.txt desta pasta."; read -r _; exit 1; }
  sleep 2
done
# A conta já foi criada: tira a senha do arquivo de configuração.
grep -v '^OWNER_PASSWORD=' .env.local-docker > .env.local-docker.tmp && mv .env.local-docker.tmp .env.local-docker
echo ""
echo "  Pronto! Abrindo http://localhost:3000 — entre com o e-mail e a senha que você escolheu."
(open http://localhost:3000 2>/dev/null || xdg-open http://localhost:3000 2>/dev/null || true)
echo "  O app volta sozinho sempre que o Docker Desktop estiver aberto."
} 2>&1 | tee instalacao-log.txt
printf "  Pressione Enter para fechar. "; read -r _
