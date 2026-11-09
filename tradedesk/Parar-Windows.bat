@echo off
cd /d "%~dp0"
title NEONDESK - Parar
docker compose down
echo Robo e servicos parados.
pause
