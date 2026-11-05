<# :
@echo off
REM Instalador do SiteHunter AI (Windows). Arquivo unico: depois deste bloco vem o script PowerShell.
cd /d "%~dp0"
echo.
echo  SiteHunter AI - instalador
echo.
if not exist "%~dp0docker-compose.local.yml" (
  echo  ERRO: os arquivos do app nao estao nesta pasta.
  echo  Isso acontece quando o instalador e aberto de dentro do ZIP.
  echo.
  echo  Como resolver:
  echo   1. Feche esta janela.
  echo   2. Clique com o botao direito no arquivo ZIP e escolha "Extrair tudo..." e depois "Extrair".
  echo   3. Abra a pasta extraida, entre em "sitehunter-ai" e rode "instalar-windows" de novo.
  echo.
  pause
  exit /b 1
)
set "SH_DIR=%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$s = Get-Content -LiteralPath '%~f0' -Raw -Encoding UTF8; Invoke-Expression $s"
echo.
echo  Se apareceu algum erro acima, tire uma foto desta janela ou envie o arquivo
echo  instalacao-log.txt desta pasta.
pause
exit /b
#>
$ErrorActionPreference = "Continue"
# Qualquer erro inesperado aparece na tela (a janela nao fecha sozinha).
trap { Write-Host ""; Write-Host "  ERRO: $_" -ForegroundColor Red; try { Stop-Transcript | Out-Null } catch {}; Read-Host "  Pressione Enter para fechar"; exit 1 }
$root = $env:SH_DIR
Set-Location -Path $root
$log = Join-Path $root "instalacao-log.txt"
Start-Transcript -Path $log -Force | Out-Null
function Fim($code) { try { Stop-Transcript | Out-Null } catch {}; Write-Host ""; if ($code -eq 0) { Start-Sleep -Seconds 1 }; exit $code }

Write-Host ""
Write-Host "  SiteHunter AI - instalacao no seu computador" -ForegroundColor Cyan
Write-Host ""

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  Write-Host "  O Docker Desktop nao foi encontrado." -ForegroundColor Yellow
  Write-Host "  Instale em https://www.docker.com/products/docker-desktop, abra o programa e rode este instalador de novo."
  Start-Process "https://www.docker.com/products/docker-desktop"
  Fim 1
}
docker info *> $null
if ($LASTEXITCODE -ne 0) {
  Write-Host "  O Docker Desktop esta instalado, mas nao esta aberto (ou ainda esta iniciando)." -ForegroundColor Yellow
  Write-Host "  Abra o Docker Desktop, espere aparecer 'Engine running' e rode este instalador de novo."
  Fim 1
}

$envFile = Join-Path $root ".env.local-docker"
if (-not (Test-Path $envFile)) {
  $email = Read-Host "  Seu e-mail (sera o login do app)"
  while ($true) {
    $sec = Read-Host "  Crie uma senha (minimo 12 caracteres)" -AsSecureString
    $pass = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec))
    if ($pass.Length -ge 12) { break }
    Write-Host "  A senha precisa ter pelo menos 12 caracteres." -ForegroundColor Yellow
  }
  $lines = @("OWNER_EMAIL=$email", "OWNER_PASSWORD=$pass", "OSM_CONTACT_EMAIL=$email", "# Opcionais: GOOGLE_PLACES_API_KEY=  ANTHROPIC_API_KEY=  UNSPLASH_ACCESS_KEY=")
  [IO.File]::WriteAllLines($envFile, $lines)
} else {
  Write-Host "  Ja existe uma instalacao. Atualizando e iniciando..."
}

Write-Host ""
Write-Host "  Baixando o app pronto (cerca de 1 GB na primeira vez)..."
docker compose -f docker-compose.local.yml pull
if ($LASTEXITCODE -ne 0) {
  Write-Host "  Nao deu para baixar o app pronto; vou montar no seu computador (de 5 a 15 minutos)..." -ForegroundColor Yellow
  docker compose -f docker-compose.local.yml build
  if ($LASTEXITCODE -ne 0) { Write-Host "  A montagem falhou. Envie o arquivo instalacao-log.txt desta pasta para o suporte." -ForegroundColor Red; Fim 1 }
}
docker compose -f docker-compose.local.yml up -d
if ($LASTEXITCODE -ne 0) { Write-Host "  O app nao iniciou. Envie o arquivo instalacao-log.txt desta pasta para o suporte." -ForegroundColor Red; Fim 1 }

Write-Host "  Esperando o app ficar pronto..."
$ok = $false
for ($i = 0; $i -lt 120; $i++) {
  try { if ((Invoke-WebRequest -UseBasicParsing -TimeoutSec 3 http://localhost:3000/api/health).StatusCode -eq 200) { $ok = $true; break } } catch {}
  Start-Sleep -Seconds 2
}
if (-not $ok) {
  Write-Host "  O app demorou para responder. Ultimas mensagens dele:" -ForegroundColor Yellow
  docker compose -f docker-compose.local.yml logs --tail 40 app
  Write-Host "  Tente abrir http://localhost:3000 em alguns minutos. Se nao abrir, envie o arquivo instalacao-log.txt."
  Fim 1
}
# A conta ja foi criada: tira a senha do arquivo de configuracao.
(Get-Content $envFile) | Where-Object { $_ -notmatch '^OWNER_PASSWORD=' } | Set-Content $envFile
Write-Host ""
Write-Host "  Pronto! Abrindo http://localhost:3000" -ForegroundColor Green
Write-Host "  Entre com o e-mail e a senha que voce escolheu. O app volta sozinho sempre que o Docker Desktop estiver aberto."
Start-Process "http://localhost:3000"
Fim 0
