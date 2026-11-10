@echo off
cd /d "%~dp0"
title HEXADESK - EMERGENCIA
echo Isto DESLIGA TODOS os robos e FECHA as posicoes de cripto a mercado.
set /p ok=Digite SIM para continuar: 
if /i not "%ok%"=="SIM" exit /b 0
docker compose run --rm --no-deps web npx tsx scripts/emergencia.ts "acionada pelo dono"
echo.
echo Confira tambem no app/site da Foxbit e da Clear e REVOGUE as chaves de API se quiser garantir.
pause
