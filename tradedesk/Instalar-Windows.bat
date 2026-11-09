@echo off
cd /d "%~dp0"
title NEONDESK - Instalar Windows
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\instalar.ps1"
pause
