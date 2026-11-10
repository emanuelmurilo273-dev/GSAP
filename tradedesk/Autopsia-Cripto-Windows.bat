@echo off
cd /d "%~dp0"
title HEXADESK - Autopsia da cripto
docker compose run --rm --no-deps -v "%cd%:/out" -e OUT=/out/DIAGNOSTICO-CRIPTO-SEUS-DADOS.md web npx tsx scripts/autopsia-cripto.ts
echo.
echo Abra o arquivo DIAGNOSTICO-CRIPTO-SEUS-DADOS.md desta pasta.
pause
