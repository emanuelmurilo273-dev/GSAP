@echo off
cd /d "%~dp0"
title HEXADESK B3 - Testar conexao
"%LOCALAPPDATA%\HexadeskConnector\venv\Scripts\python.exe" -m hexadesk_connector testar
pause
