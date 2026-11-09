@echo off
rem Autopsia dos seus trades: expectativa por operacao, custos, piores operacoes, bugs de execucao. Gera DIAGNOSTICO-SEUS-DADOS.md
cd /d "%~dp0"
"%LOCALAPPDATA%\HexadeskConnector\venv\Scripts\python.exe" -m hexadesk_connector autopsia
pause
