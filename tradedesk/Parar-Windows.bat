@echo off
cd /d "%~dp0"
title HEXADESK - Parar
docker compose down
if exist supabase\config.toml (
  where npx >nul 2>&1 && npx --yes supabase@latest stop
)
echo Robo e servicos parados. Seus dados ficam guardados.
pause
