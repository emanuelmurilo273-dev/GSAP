@echo off
rem Roda o conector e REINICIA sozinho se ele cair. Pode deixar esta janela aberta (ou minimizada).
cd /d "%~dp0"
title HEXADESK B3 - Conector
set PY=%LOCALAPPDATA%\HexadeskConnector\venv\Scripts\python.exe
if not exist "%PY%" (
  echo Rode primeiro o Instalar-Conector-Windows.bat
  pause
  exit /b 1
)
:loop
"%PY%" -m hexadesk_connector rodar
echo.
echo Conector parou. Reiniciando em 10 segundos... (feche esta janela para parar de vez)
timeout /t 10 /nobreak >nul
goto loop
