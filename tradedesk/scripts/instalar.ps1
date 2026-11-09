# HEXADESK - instalador para Windows (Docker Desktop). Somente ASCII de proposito.
# 'Continue': o PowerShell 5 trata texto no stderr de programas nativos (docker, npx) como erro fatal com 'Stop'
$ErrorActionPreference = 'Continue'
Set-Location (Split-Path -Parent $PSScriptRoot)
$utf8 = New-Object System.Text.UTF8Encoding($false)
$envPath = Join-Path (Get-Location) '.env'
$marker = Join-Path (Get-Location) '.hexadesk-local'

function Fail($msg) { Write-Host ""; Write-Host "ERRO: $msg" -ForegroundColor Red; exit 1 }
function Test-Docker { docker info 2>&1 | Out-Null; return ($LASTEXITCODE -eq 0) }
function Test-PortFree($p) { try { $l = New-Object Net.Sockets.TcpListener([Net.IPAddress]::Any, $p); $l.Start(); $l.Stop(); return $true } catch { return $false } }
function Get-DockerPorts {
  $used = @()
  foreach ($l in (docker ps --format '{{.Ports}}' 2>$null)) { foreach ($m in [regex]::Matches([string]$l, ':(\d+)->')) { $used += [int]$m.Groups[1].Value } }
  return $used
}
function Read-Env { return [IO.File]::ReadAllText($envPath, [Text.Encoding]::UTF8) }
function Write-Env($t) { [IO.File]::WriteAllText($envPath, $t, $utf8) }
function Get-Env($name) {
  $m = [regex]::Match((Read-Env), "(?m)^$name=[ \t]*([^ \t#\r\n]*)")
  if ($m.Success) { return $m.Groups[1].Value } else { return '' }
}
function Set-Env($name, $value) {
  if (-not [regex]::IsMatch((Read-Env), "(?m)^$name=")) { Write-Env ((Read-Env).TrimEnd() + "`n$name=$value`n"); return }
  Write-Env ([regex]::Replace((Read-Env), "(?m)^$name=[ \t]*[^ \t#\r\n]*", "$name=$value  "))
}
function Plain($secure) { return [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)) }

Write-Host "=== HEXADESK - instalador ===" -ForegroundColor Green

# ---------- Docker ----------
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  Start-Process "https://www.docker.com/products/docker-desktop/"
  Fail "Docker Desktop nao encontrado. Instale-o (pagina aberta no navegador), reinicie o PC e rode este instalador de novo."
}
if (-not (Test-Docker)) {
  Write-Host "Docker Desktop nao esta rodando. Tentando abrir..." -ForegroundColor Yellow
  $exe = Join-Path $env:ProgramFiles 'Docker\Docker\Docker Desktop.exe'
  if (Test-Path $exe) { Start-Process $exe } else { Fail "Nao achei o Docker Desktop. Abra-o pelo menu Iniciar, espere ficar verde e rode de novo." }
  $ok = $false
  for ($i = 1; $i -le 90; $i++) {
    Start-Sleep -Seconds 2
    if (Test-Docker) { $ok = $true; break }
    if ($i % 5 -eq 0) { Write-Host "  aguardando o Docker Desktop iniciar... ($($i*2)s)" }
  }
  if (-not $ok) { Fail "O Docker Desktop nao iniciou a tempo. Abra-o, espere 'Engine running' e rode de novo. Se pedir, aceite o WSL 2 e reinicie o PC." }
}
Write-Host "Docker OK." -ForegroundColor Green
docker compose down 2>&1 | Out-Null

# ---------- .env automatico ----------
if (-not (Test-Path $envPath)) {
  Copy-Item (Join-Path (Get-Location) '.env.example') $envPath
  $b = New-Object byte[] 32
  [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b)
  Set-Env 'ENCRYPTION_KEY' ([BitConverter]::ToString($b).Replace('-', '').ToLower())
  Write-Host ".env criado com ENCRYPTION_KEY nova (faca backup do .env!)." -ForegroundColor Yellow
}
$cur = Read-Env
$fixed = [regex]::Replace($cur, '(?m)^(ENCRYPTION_KEY=[0-9a-fA-F]{64})#', '$1  #')
if ($fixed -ne $cur) { Write-Env $fixed; Write-Host ".env reparado." -ForegroundColor Yellow }

# ---------- porta livre para o site ----------
$port = 3000
$dockerPorts = Get-DockerPorts
while ((($dockerPorts -contains $port) -or -not (Test-PortFree $port)) -and $port -lt 3020) { $port++ }
if ($port -ge 3020) { Fail "Nenhuma porta livre entre 3000 e 3019. Feche programas que usam essas portas e tente de novo." }
if ($port -ne 3000) { Write-Host "A porta 3000 esta ocupada. Usando a porta $port." -ForegroundColor Yellow }
Set-Env 'WEB_PORT' "$port"
Set-Env 'NEXT_PUBLIC_APP_URL' "http://localhost:$port"
$siteUrl = "http://localhost:$port"

# ---------- Supabase: ja configurado? ----------
function Supabase-Configured {
  foreach ($n in 'NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_ANON_KEY','SUPABASE_URL','SUPABASE_KEY') {
    $v = Get-Env $n
    if (-not $v -or $v -like '*xxxx*' -or $v -like '*preview.invalid*' -or $v -eq 'preview') { return $false }
  }
  return $true
}
$configured = Supabase-Configured
$local = (Test-Path $marker)
$ownerPassword = $null

# ---------- Modo LOCAL: banco + login no seu PC, sem criar conta em site nenhum ----------
if (-not $configured) {
  Write-Host ""
  Write-Host "Para o login e o robo funcionarem, o app precisa de um banco de dados (Supabase)." -ForegroundColor Cyan
  $ans = Read-Host "Instalar o banco e o login AUTOMATICAMENTE neste PC (recomendado para testar)? [S/n]"
  if ($ans -notmatch '^[nN]') {
    if (-not (Get-Command npx -ErrorAction SilentlyContinue)) {
      Start-Process "https://nodejs.org/en/download"
      Write-Host "Preciso do Node.js para instalar o banco local. Instale a versao LTS (pagina aberta), reinicie o PC e rode este instalador de novo." -ForegroundColor Yellow
    } else {
      Write-Host ""
      Write-Host "Criando sua conta de DONO (acesso total, sem pagar)." -ForegroundColor Cyan
      $mail = (Get-Env 'OWNER_EMAIL')
      while ($mail -notmatch '^\S+@\S+\.\S+$') { $mail = (Read-Host "Seu e-mail").Trim().ToLower() }
      while ($true) {
        $p1 = Plain (Read-Host "Crie uma senha (minimo 10 caracteres)" -AsSecureString)
        if ($p1.Length -lt 10) { Write-Host "  Senha curta demais." -ForegroundColor Yellow; continue }
        $p2 = Plain (Read-Host "Repita a senha" -AsSecureString)
        if ($p1 -ne $p2) { Write-Host "  As senhas nao conferem." -ForegroundColor Yellow; continue }
        break
      }
      $ownerPassword = $p1
      Set-Env 'OWNER_EMAIL' $mail

      Write-Host ""
      Write-Host "Baixando e iniciando o banco local (Supabase). Na PRIMEIRA vez pode levar 5 a 15 minutos..." -ForegroundColor Green
      npx --yes supabase@latest start -x 'storage-api,imgproxy,edge-runtime,logflare,vector,supavisor'
      $st = npx --yes supabase@latest status -o env 2>$null
      $kv = @{}
      foreach ($line in $st) { $m = [regex]::Match([string]$line, '^([A-Z_0-9]+)="?([^"]*)"?\s*$'); if ($m.Success) { $kv[$m.Groups[1].Value] = $m.Groups[2].Value } }
      $api = $kv['API_URL']
      $anon = if ($kv['ANON_KEY']) { $kv['ANON_KEY'] } else { $kv['PUBLISHABLE_KEY'] }
      $svc = if ($kv['SERVICE_ROLE_KEY']) { $kv['SERVICE_ROLE_KEY'] } else { $kv['SECRET_KEY'] }
      if (-not $api -or -not $anon -or -not $svc) { Fail "Nao consegui ler as chaves do Supabase local. Rode 'npx supabase status' para ver o erro (o Docker Desktop precisa estar rodando)." }
      $apiPort = ([Uri]$api).Port
      Set-Env 'NEXT_PUBLIC_SUPABASE_URL' "http://localhost:$apiPort"
      Set-Env 'SUPABASE_URL' "http://host.docker.internal:$apiPort"
      Set-Env 'NEXT_PUBLIC_SUPABASE_ANON_KEY' $anon
      Set-Env 'SUPABASE_KEY' $svc
      Set-Env 'OWNER_REQUIRE_2FA' 'false'
      Set-Content -Path $marker -Value 'ok'
      $configured = $true
      $local = $true
      Write-Host "Banco local pronto." -ForegroundColor Green
    }
  }
}

# reexecucao em modo local: garante que o banco esta no ar
if ($configured -and $local -and -not $ownerPassword) {
  Write-Host "Iniciando o banco local..." -ForegroundColor Green
  npx --yes supabase@latest start -x 'storage-api,imgproxy,edge-runtime,logflare,vector,supavisor' 2>&1 | Out-Null
}

if (-not $configured) {
  # modo previa: valores de enchimento so para o site abrir (nao conectam em nada)
  Set-Env 'NEXT_PUBLIC_SUPABASE_URL' 'https://preview.invalid'
  Set-Env 'SUPABASE_URL' 'https://preview.invalid'
  Set-Env 'NEXT_PUBLIC_SUPABASE_ANON_KEY' 'preview'
  Set-Env 'SUPABASE_KEY' 'preview'
}

# ---------- subir ----------
Write-Host ""
Write-Host "Construindo e iniciando o site (a primeira vez demora alguns minutos)..." -ForegroundColor Green
$started = $false
for ($try = 1; $try -le 15; $try++) {
  Set-Env 'WEB_PORT' "$port"
  Set-Env 'NEXT_PUBLIC_APP_URL' "http://localhost:$port"
  $siteUrl = "http://localhost:$port"
  if ($configured) { docker compose up -d --build 2>&1 | Tee-Object -Variable log | Out-Host }
  else { docker compose up -d --build web redis 2>&1 | Tee-Object -Variable log | Out-Host }
  if ($LASTEXITCODE -eq 0) { $started = $true; break }
  if (($log -join "`n") -match 'port is already allocated|address already in use|ports are not available') {
    Write-Host "Porta $port ocupada. Tentando a porta $($port + 1)..." -ForegroundColor Yellow
    docker compose down 2>&1 | Out-Null
    $port++
  } else { break }
}
if (-not $started) { Fail "docker compose falhou. Veja as mensagens acima. Dica: rode 'docker ps' para ver o que usa as portas." }

Write-Host "Aguardando o site responder..."
$up = $false
for ($i = 1; $i -le 60; $i++) {
  try { $r = Invoke-WebRequest -UseBasicParsing -Uri $siteUrl -TimeoutSec 3; if ($r.StatusCode -eq 200) { $up = $true; break } } catch { }
  Start-Sleep -Seconds 2
}
if (-not $up) { Write-Host "O site demorou a responder. Veja: docker compose logs web" -ForegroundColor Yellow }

# ---------- conta de dono + entrada automatica ----------
$openUrl = $siteUrl
if ($configured -and $local) {
  Write-Host "Preparando sua conta de dono e o login automatico..." -ForegroundColor Green
  if ($ownerPassword) { $env:OWNER_PASSWORD = $ownerPassword }
  $out = docker compose run --rm --no-deps -e OWNER_PASSWORD web npx tsx scripts/criar-dono.ts 2>&1
  $env:OWNER_PASSWORD = $null
  $ownerPassword = $null
  $out | ForEach-Object { if ($_ -notmatch 'AUTOLOGIN_URL') { Write-Host $_ } }
  $m = [regex]::Match(($out -join "`n"), 'AUTOLOGIN_URL=(\S+)')
  if ($m.Success) { $openUrl = $m.Groups[1].Value } else { Write-Host "Nao consegui gerar o login automatico. Entre em $siteUrl/owner/login com seu e-mail e senha." -ForegroundColor Yellow }
}

Write-Host ""
if ($configured -and $local) {
  Write-Host "PRONTO! Abrindo o site ja logado como DONO: $siteUrl" -ForegroundColor Green
  Write-Host "Proximas vezes: rode este instalador de novo (ou entre em $siteUrl/owner/login com e-mail e senha)."
  Write-Host "Painel do day trade B3: $siteUrl/b3  (instale o conector em connector\Instalar-Conector-Windows.bat)"
} elseif ($configured) {
  Write-Host "Pronto! Site + robo rodando em $siteUrl" -ForegroundColor Green
  Write-Host "Conta de dono: duplo clique em Criar-Dono-Windows.bat."
} else {
  Write-Host "SITE NO AR em $siteUrl (MODO PREVIA - sem login/pagamento/robo)" -ForegroundColor Green
  Write-Host "Rode o instalador de novo e responda S para instalar o banco e o login automaticamente." -ForegroundColor Yellow
}
Write-Host "Para parar: duplo clique em Parar-Windows.bat"
Start-Process $openUrl
