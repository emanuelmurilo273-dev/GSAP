@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo  SiteHunter AI - instalador
echo.
if not exist "%~dp0instalar-windows.ps1" (
  echo  ERRO: nao encontrei o arquivo instalar-windows.ps1 nesta pasta.
  echo  Provavelmente o ZIP nao foi extraido. Clique com o botao direito no ZIP,
  echo  escolha "Extrair tudo...", abra a pasta extraida e rode este arquivo de novo.
  echo.
  pause
  exit /b 1
)
where powershell >nul 2>nul
if errorlevel 1 (
  echo  ERRO: o PowerShell nao foi encontrado neste Windows.
  pause
  exit /b 1
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0instalar-windows.ps1"
echo.
echo  Se apareceu algum erro acima, tire uma foto desta janela ou envie o arquivo
echo  instalacao-log.txt desta pasta.
pause
