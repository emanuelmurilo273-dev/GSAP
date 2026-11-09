@echo off
cd /d "%~dp0"
title HEXADESK - Parar
docker compose down
echo Robo e servicos parados.
pause
