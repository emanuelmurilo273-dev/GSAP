@echo off
rem Retreino do modelo com o historico gravado pelo conector. Registra um DESAFIANTE (nunca troca o campeao). Agende toda semana (veja o guia).
cd /d "%~dp0"
"%LOCALAPPDATA%\HexadeskConnector\venv\Scripts\python.exe" -m hexadesk_connector retreinar
