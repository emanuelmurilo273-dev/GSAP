# NEONDESK - instalador para Windows (usa Docker Desktop). Somente ASCII de proposito.
# 'Continue': o PowerShell 5 trata texto no stderr de programas nativos (docker) como erro fatal com 'Stop'
$ErrorActionPreference = 'Continue'
Set-Location (Split-Path -Parent $PSScriptRoot)
$utf8 = New-Object System.Text.UTF8Encoding($false)

function Fail($msg) { Write-Host ""; Write-Host "ERRO: $msg" -ForegroundColor Red; exit 1 }

Write-Host "=== NEONDESK - instalador ===" -ForegroundColor Green

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  Start-Process "https://www.docker.com/products/docker-desktop/"
  Fail "Docker Desktop nao encontrado. Instale-o (pagina aberta no navegador), reinicie o PC e rode este instalador de novo."
}
function Test-Docker {
  docker info 2>&1 | Out-Null
  return ($LASTEXITCODE -eq 0)
}

if (-not (Test-Docker)) {
  Write-Host "Docker Desktop nao esta rodando. Tentando abrir..." -ForegroundColor Yellow
  $exe = Join-Path $env:ProgramFiles 'Docker\Docker\Docker Desktop.exe'
  if (Test-Path $exe) { Start-Process $exe }
  else { Fail "Nao achei o Docker Desktop. Abra-o manualmente pelo menu Iniciar, espere ficar verde e rode este instalador de novo." }
  $ok = $false
  for ($i = 1; $i -le 90; $i++) {
    Start-Sleep -Seconds 2
    if (Test-Docker) { $ok = $true; break }
    if ($i % 5 -eq 0) { Write-Host "  aguardando o Docker Desktop iniciar... ($($i*2)s)" }
  }
  if (-not $ok) { Fail "O Docker Desktop nao iniciou a tempo. Abra-o, espere o icone ficar verde (Engine running) e rode de novo. Se pedir, aceite a instalacao do WSL 2 e reinicie o PC." }
}
Write-Host "Docker OK." -ForegroundColor Green

if (-not (Test-Path .env)) {
  $txt = [IO.File]::ReadAllText((Join-Path (Get-Location) '.env.example'), [Text.Encoding]::UTF8)
  $b = New-Object byte[] 32
  [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b)
  $key = [BitConverter]::ToString($b).Replace('-', '').ToLower()
  $txt = [regex]::Replace($txt, '(?m)^ENCRYPTION_KEY=[^\r\n#]*', "ENCRYPTION_KEY=$key")
  [IO.File]::WriteAllText((Join-Path (Get-Location) '.env'), $txt, $utf8)
  Write-Host "Arquivo .env criado. ENCRYPTION_KEY gerada automaticamente (FACA BACKUP do .env!)." -ForegroundColor Yellow
}

function Get-Env($name) {
  $m = Select-String -Path .env -Pattern "^$name=([^#\r\n]*)" | Select-Object -First 1
  if ($m) { return $m.Matches[0].Groups[1].Value.Trim() } else { return '' }
}

# exige o minimo para o app subir: Supabase
while ($true) {
  $missing = @()
  foreach ($n in 'NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_ANON_KEY','SUPABASE_URL','SUPABASE_KEY') {
    $v = Get-Env $n
    if (-not $v -or $v -like '*xxxx*') { $missing += $n }
  }
  if ($missing.Count -eq 0) { break }
  Write-Host ""
  Write-Host "Preencha no .env (o Bloco de Notas vai abrir): $($missing -join ', ')" -ForegroundColor Yellow
  Write-Host "Antes: crie o projeto em supabase.com e rode supabase\migrations\001_init.sql no SQL Editor."
  Write-Host "Salve e FECHE o Bloco de Notas para continuar."
  Start-Process notepad.exe -ArgumentList '.env' -Wait
}

Write-Host ""
Write-Host "Construindo e iniciando (a primeira vez demora alguns minutos)..." -ForegroundColor Green
docker compose up -d --build
if ($LASTEXITCODE -ne 0) { Fail "docker compose falhou. Veja as mensagens acima." }

Write-Host ""
Write-Host "Pronto! Abrindo http://localhost:3000" -ForegroundColor Green
Write-Host "Logs do robo:  docker compose logs -f worker"
Write-Host "Para parar:    duplo clique em Parar-Windows.bat"
Start-Sleep -Seconds 5
Start-Process "http://localhost:3000"
