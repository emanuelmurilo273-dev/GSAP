@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
cd /d "%~dp0"
title Instalador do SiteHunter AI
echo.
echo  ===============================================
echo   SiteHunter AI - instalacao no seu computador
echo  ===============================================
echo.
where docker >nul 2>nul
if errorlevel 1 (
  echo  O Docker Desktop nao foi encontrado.
  echo  Baixe e instale em: https://www.docker.com/products/docker-desktop
  echo  Depois abra o Docker Desktop e rode este instalador de novo.
  start https://www.docker.com/products/docker-desktop
  pause & exit /b 1
)
docker info >nul 2>nul
if errorlevel 1 (
  echo  O Docker Desktop esta instalado, mas nao esta aberto.
  echo  Abra o Docker Desktop, espere ele ficar verde e rode este instalador de novo.
  pause & exit /b 1
)
if exist ".env.local-docker" (
  echo  Ja existe uma instalacao. Atualizando e iniciando...
  goto :start
)
set /p EMAIL= Seu e-mail (sera o login do app): 
:senha
for /f "usebackq delims=" %%p in (`powershell -NoProfile -Command "$s=Read-Host ' Crie uma senha (minimo 12 caracteres)' -AsSecureString; [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($s))"`) do set "PASS=%%p"
set "LEN=0"
for /l %%i in (0,1,200) do if "!PASS:~%%i,1!" neq "" set /a LEN=%%i+1
if !LEN! LSS 12 (
  echo  A senha precisa ter pelo menos 12 caracteres. Tente de novo.
  goto :senha
)
(
  echo OWNER_EMAIL=!EMAIL!
  echo OWNER_PASSWORD=!PASS!
  echo OSM_CONTACT_EMAIL=!EMAIL!
  echo # Opcionais: GOOGLE_PLACES_API_KEY=  ANTHROPIC_API_KEY=  UNSPLASH_ACCESS_KEY=
) > .env.local-docker
:start
echo.
echo  Montando o app (a primeira vez demora de 5 a 10 minutos)...
docker compose -f docker-compose.local.yml up -d --build
if errorlevel 1 (
  echo  Algo deu errado. Copie a mensagem acima e envie para o suporte.
  pause & exit /b 1
)
echo  Esperando o app ficar pronto...
for /l %%i in (1,1,90) do (
  powershell -NoProfile -Command "try{(Invoke-WebRequest -UseBasicParsing http://localhost:3000/api/health).StatusCode}catch{0}" | findstr 200 >nul && goto :ready
  timeout /t 2 >nul
)
echo  O app demorou para responder. Abra http://localhost:3000 em alguns minutos.
goto :end
:ready
rem A conta ja foi criada: tira a senha do arquivo de configuracao.
powershell -NoProfile -Command "(Get-Content .env.local-docker) -notmatch '^OWNER_PASSWORD=' | Set-Content .env.local-docker"
echo.
echo  Pronto! Abrindo http://localhost:3000
echo  Entre com o e-mail e a senha que voce escolheu.
start http://localhost:3000
:end
echo.
echo  O app volta sozinho sempre que o Docker Desktop estiver aberto.
pause
