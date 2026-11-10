#!/bin/bash
# HEXADESK - instalador para macOS (Docker Desktop). Compativel com o bash 3.2 que vem no Mac.
# O conector do MetaTrader 5 (B3) NAO roda no Mac: o MT5 so tem a biblioteca Python no Windows. Use uma VPS Windows (docs/B3-GUIA.md).
# Aqui sobem o site, o robo de cripto e o Laboratorio.
set -u
cd "$(dirname "$0")/.."
ROOT="$(pwd)"
ENVF="$ROOT/.env"
MARKER="$ROOT/.hexadesk-local"
SB_EXCLUDE='storage-api,imgproxy,edge-runtime,logflare,vector,supavisor'

verde() { printf '\033[32m%s\033[0m\n' "$*"; }
amar()  { printf '\033[33m%s\033[0m\n' "$*"; }
ciano() { printf '\033[36m%s\033[0m\n' "$*"; }
falha() { echo; printf '\033[31mERRO: %s\033[0m\n' "$*"; exit 1; }

docker_ok() { docker info >/dev/null 2>&1; }
porta_livre() { ! lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1; }
env_get() { grep -E "^$1=" "$ENVF" 2>/dev/null | head -1 | sed -E "s/^$1=[ \t]*//; s/[ \t]*#.*$//; s/[ \t]+$//"; }
env_set() {   # env_set NOME VALOR  (troca a linha ou acrescenta no fim; usa perl, que ja vem no macOS)
  local n="$1" v="$2"
  if grep -qE "^$n=" "$ENVF" 2>/dev/null; then
    N="$n" V="$v" perl -0pi -e 's/^\Q$ENV{N}\E=[ \t]*[^ \t#\r\n]*/$ENV{N}=$ENV{V}  /m' "$ENVF"
  else
    printf '\n%s=%s\n' "$n" "$v" >> "$ENVF"
  fi
}

verde "=== HEXADESK - instalador para Mac ==="
[ "$(uname -s)" = "Darwin" ] || amar "Aviso: este script foi feito para macOS."

# ---------- Docker ----------
if ! command -v docker >/dev/null 2>&1; then
  open "https://www.docker.com/products/docker-desktop/" 2>/dev/null
  falha "Docker Desktop nao encontrado. Instale-o (pagina aberta no navegador; escolha Apple Silicon ou Intel), abra-o uma vez e rode este instalador de novo."
fi
if ! docker_ok; then
  amar "Docker Desktop nao esta rodando. Tentando abrir..."
  open -a Docker 2>/dev/null || falha "Nao consegui abrir o Docker Desktop. Abra-o pelo Launchpad, espere ficar verde e rode de novo."
  i=0; while [ $i -lt 90 ]; do
    sleep 2; docker_ok && break
    i=$((i+1)); [ $((i % 5)) -eq 0 ] && echo "  aguardando o Docker Desktop iniciar... ($((i*2))s)"
  done
  docker_ok || falha "O Docker Desktop nao iniciou a tempo. Abra-o, espere 'Engine running' e rode de novo."
fi
verde "Docker OK."
docker compose down >/dev/null 2>&1

# ---------- .env automatico ----------
if [ ! -f "$ENVF" ]; then
  cp "$ROOT/.env.example" "$ENVF"
  env_set ENCRYPTION_KEY "$(openssl rand -hex 32)"
  amar ".env criado com ENCRYPTION_KEY nova (faca backup do .env!)."
fi
perl -pi -e 's/^(ENCRYPTION_KEY=[0-9a-fA-F]{64})#/$1  #/' "$ENVF"

# ---------- porta livre para o site ----------
PORT=3000
while { ! porta_livre $PORT || docker ps --format '{{.Ports}}' 2>/dev/null | grep -q ":$PORT->"; } && [ $PORT -lt 3020 ]; do PORT=$((PORT+1)); done
[ $PORT -ge 3020 ] && falha "Nenhuma porta livre entre 3000 e 3019. Feche programas que usam essas portas e tente de novo."
[ $PORT -ne 3000 ] && amar "A porta 3000 esta ocupada. Usando a porta $PORT."
env_set WEB_PORT "$PORT"; env_set NEXT_PUBLIC_APP_URL "http://localhost:$PORT"
SITE="http://localhost:$PORT"

# ---------- Supabase ja configurado? ----------
supabase_configurado() {
  for n in NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY SUPABASE_URL SUPABASE_KEY; do
    v="$(env_get $n)"
    case "$v" in ""|*xxxx*|*preview.invalid*|preview) return 1;; esac
  done
  return 0
}
CONFIGURED=0; supabase_configurado && CONFIGURED=1
LOCAL=0; [ -f "$MARKER" ] && LOCAL=1
OWNER_PASSWORD=""

# ---------- Modo LOCAL: banco + login neste Mac, sem criar conta em site nenhum ----------
if [ $CONFIGURED -eq 0 ]; then
  echo; ciano "Para o login e o robo funcionarem, o app precisa de um banco de dados (Supabase)."
  read -r -p "Instalar o banco e o login AUTOMATICAMENTE neste Mac (recomendado para testar)? [S/n] " ans
  case "$ans" in [nN]*) ;; *)
    if ! command -v npx >/dev/null 2>&1; then
      open "https://nodejs.org/en/download" 2>/dev/null
      amar "Preciso do Node.js para instalar o banco local. Instale a versao LTS (pagina aberta) e rode este instalador de novo."
    else
      echo; ciano "Criando sua conta de DONO (acesso total, sem pagar)."
      MAIL="$(env_get OWNER_EMAIL | tr 'A-Z' 'a-z')"
      until echo "$MAIL" | grep -qE '^[^ ]+@[^ ]+\.[^ ]+$'; do read -r -p "Seu e-mail: " MAIL; MAIL="$(echo "$MAIL" | tr 'A-Z' 'a-z' | tr -d ' ')"; done
      while true; do
        read -r -s -p "Crie uma senha (minimo 10 caracteres): " P1; echo
        [ ${#P1} -lt 10 ] && { amar "  Senha curta demais."; continue; }
        read -r -s -p "Repita a senha: " P2; echo
        [ "$P1" != "$P2" ] && { amar "  As senhas nao conferem."; continue; }
        break
      done
      OWNER_PASSWORD="$P1"; env_set OWNER_EMAIL "$MAIL"
      echo; verde "Baixando e iniciando o banco local (Supabase). Na PRIMEIRA vez pode levar 5 a 15 minutos..."
      npx --yes supabase@latest start -x "$SB_EXCLUDE" || falha "O Supabase local nao iniciou. Veja as mensagens acima."
      echo "Aplicando as tabelas do app no banco local..."
      npx --yes supabase@latest migration up --local >/dev/null 2>&1
      ST="$(npx --yes supabase@latest status -o env 2>/dev/null)"
      pega() { echo "$ST" | grep -E "^$1=" | head -1 | sed -E 's/^[A-Z_0-9]+="?//; s/"?[ \t]*$//'; }
      API="$(pega API_URL)"; ANON="$(pega ANON_KEY)"; [ -z "$ANON" ] && ANON="$(pega PUBLISHABLE_KEY)"
      SVC="$(pega SERVICE_ROLE_KEY)"; [ -z "$SVC" ] && SVC="$(pega SECRET_KEY)"
      { [ -z "$API" ] || [ -z "$ANON" ] || [ -z "$SVC" ]; } && falha "Nao consegui ler as chaves do Supabase local. Rode 'npx supabase status' para ver o erro."
      APIPORT="$(echo "$API" | sed -E 's#.*:([0-9]+).*#\1#')"
      env_set NEXT_PUBLIC_SUPABASE_URL "http://localhost:$APIPORT"
      env_set SUPABASE_URL "http://host.docker.internal:$APIPORT"
      env_set NEXT_PUBLIC_SUPABASE_ANON_KEY "$ANON"
      env_set SUPABASE_KEY "$SVC"
      env_set OWNER_REQUIRE_2FA false
      echo ok > "$MARKER"; CONFIGURED=1; LOCAL=1
      verde "Banco local pronto."
    fi;;
  esac
fi

# reexecucao em modo local: garante que o banco esta no ar e aplica tabelas novas (001 a 009)
if [ $CONFIGURED -eq 1 ] && [ $LOCAL -eq 1 ] && [ -z "$OWNER_PASSWORD" ]; then
  verde "Iniciando o banco local..."
  npx --yes supabase@latest start -x "$SB_EXCLUDE" >/dev/null 2>&1
  npx --yes supabase@latest migration up --local >/dev/null 2>&1
fi

if [ $CONFIGURED -eq 0 ]; then   # modo previa: valores de enchimento so para o site abrir
  env_set NEXT_PUBLIC_SUPABASE_URL https://preview.invalid; env_set SUPABASE_URL https://preview.invalid
  env_set NEXT_PUBLIC_SUPABASE_ANON_KEY preview; env_set SUPABASE_KEY preview
fi

# ---------- subir ----------
echo; verde "Construindo e iniciando o site (a primeira vez demora alguns minutos)..."
STARTED=0; try=1
while [ $try -le 15 ]; do
  env_set WEB_PORT "$PORT"; env_set NEXT_PUBLIC_APP_URL "http://localhost:$PORT"; SITE="http://localhost:$PORT"
  if [ $CONFIGURED -eq 1 ]; then LOG="$(docker compose up -d --build 2>&1)"; RC=$?; else LOG="$(docker compose up -d --build web redis 2>&1)"; RC=$?; fi
  echo "$LOG" | tail -15
  if [ $RC -eq 0 ]; then STARTED=1; break; fi
  if echo "$LOG" | grep -qiE 'port is already allocated|address already in use|ports are not available'; then
    amar "Porta $PORT ocupada. Tentando a porta $((PORT+1))..."; docker compose down >/dev/null 2>&1; PORT=$((PORT+1))
  else break; fi
  try=$((try+1))
done
[ $STARTED -eq 1 ] || falha "docker compose falhou. Veja as mensagens acima. Dica: rode 'docker ps' para ver o que usa as portas."

echo "Aguardando o site responder..."
UP=0; i=0; while [ $i -lt 60 ]; do
  curl -fsS -m 3 -o /dev/null "$SITE" 2>/dev/null && { UP=1; break; }; sleep 2; i=$((i+1))
done
[ $UP -eq 1 ] || amar "O site demorou a responder. Veja: docker compose logs web"

# ---------- conta de dono + entrada automatica ----------
OPEN_URL="$SITE"
if [ $CONFIGURED -eq 1 ] && [ $LOCAL -eq 1 ]; then
  verde "Preparando sua conta de dono e o login automatico..."
  OUT="$(OWNER_PASSWORD="$OWNER_PASSWORD" docker compose run --rm --no-deps -e OWNER_PASSWORD web npx tsx scripts/criar-dono.ts 2>&1)"
  OWNER_PASSWORD=""
  echo "$OUT" | grep -v AUTOLOGIN_URL
  AL="$(echo "$OUT" | grep -o 'AUTOLOGIN_URL=[^ ]*' | head -1 | sed 's/^AUTOLOGIN_URL=//')"
  if [ -n "$AL" ]; then OPEN_URL="$AL"; else amar "Nao consegui gerar o login automatico. Entre em $SITE/owner/login com seu e-mail e senha."; fi
fi

echo
if [ $CONFIGURED -eq 1 ] && [ $LOCAL -eq 1 ]; then
  verde "PRONTO! Abrindo o site ja logado como DONO: $SITE"
  echo "Proximas vezes: rode este instalador de novo (ou entre em $SITE/owner/login com e-mail e senha)."
  ciano "Laboratorio da B3: $SITE/b3  (simulador interno; so o dono ve)."
  echo "Robo de cripto (Foxbit): conecte a corretora em $SITE/app/onboarding."
  echo "B3 com MT5/Clear: precisa de um PC ou VPS WINDOWS (connector\\Instalar-Conector-Windows.bat). O MT5 nao roda no Mac."
elif [ $CONFIGURED -eq 1 ]; then
  verde "Pronto! Site + robo rodando em $SITE"
  echo "Conta de dono: duplo clique em Criar-Dono-Mac.command."
else
  verde "SITE NO AR em $SITE (MODO PREVIA - sem login/pagamento/robo)"
  amar "Rode o instalador de novo e responda S para instalar o banco e o login automaticamente."
fi
echo "Para parar: duplo clique em Parar-Mac.command"
open "$OPEN_URL" 2>/dev/null
