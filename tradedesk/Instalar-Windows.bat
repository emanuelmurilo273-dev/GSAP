@echo off
cd /d "%~dp0"
title HEXADESK - Instalar Windows
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\instalar.ps1"
pause
