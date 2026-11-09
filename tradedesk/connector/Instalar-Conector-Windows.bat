@echo off
cd /d "%~dp0"
title HEXADESK B3 - Instalar conector
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\instalar-conector.ps1"
pause
