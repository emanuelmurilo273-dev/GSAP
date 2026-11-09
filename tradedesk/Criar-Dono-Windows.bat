@echo off
cd /d "%~dp0"
title HEXADESK - Criar conta de dono
if not exist .env (
  echo Rode primeiro o Instalar-Windows.bat e preencha o .env ^(Supabase e OWNER_EMAIL^).
  pause
  exit /b 1
)
docker compose run --rm --no-deps web npx tsx scripts/criar-dono.ts
pause
