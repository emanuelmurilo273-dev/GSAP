# HEXADESK - instalador para Windows (usa Docker Desktop). Somente ASCII de proposito.
# 'Continue': o PowerShell 5 trata texto no stderr de programas nativos (docker) como erro fatal com 'Stop'
$ErrorActionPreference = 'Continue'
Set-Location (Split-Path -Parent $PSScriptRoot)
$utf8 = New-Object System.Text.UTF8Encoding($false)
$envPath = Join-Path (Get-Location) '.env'

function Fail($msg) { Write-Host ""; Write-Host "ERRO: $msg" -ForegroundColor Red; exit 1 }
function Test-Docker { docker info 2>&1 | Out-Null; return ($LASTEXITCODE -eq 0) }
function Test-PortFree($p) {
  try { $l = New-Object Net.Sockets.TcpListener([Net.IPAddress]::Any, $p); $l.Start(); $l.Stop(); return $true } catch { return $false }
}
function Get-DockerPorts {
  $used = @()
  $lines = docker ps --format '{{.Ports}}' 2>$null
  foreach ($l in $lines) { foreach ($m in [regex]::Matches([string]$l, ':(\d+)->')) { $used += [int]$m.Groups[1].Value } }
  return $used
}
function Read-Env { return [IO.File]::ReadAllText($envPath, [Text.Encoding]::UTF8) }
function Write-Env($t) { [IO.File]::WriteAllText($envPath, $t, $utf8) }
function Get-Env($name) {
  $m = [regex]::Match((Read-Env), "(?m)^$name=[ \t]*([^ \t#\r\n]*)")
  if ($m.Success) { return $m.Groups[1].Value } else { return '' }
}
function Set-Env($name, $value) {
  Write-Env ([regex]::Replace((Read-Env), "(?m)^$name=[ \t]*[^ \t#\r\n]*", "$name=$value  "))
}

Write-Host "=== HEXADESK - instalador ===" -ForegroundColor Green

# ---------- Docker ----------
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  Start-Process "https://www.docker.com/products/docker-desktop/"
  Fail "Docker Desktop nao encontrado. Instale-o (pagina aberta no navegador), reinicie o PC e rode este instalador de novo."
}
if (-not (Test-Docker)) {
  Write-Host "Docker Desktop nao esta rodando. Tentando abrir..." -ForegroundColor Yellow
  $exe = Join-Path $env:ProgramFiles 'Docker\Docker\Docker Desktop.exe'
  if (Test-Path $exe) { Start-Process $exe }
  else { Fail "Nao achei o Docker Desktop. Abra-o pelo menu Iniciar, espere ficar verde e rode este instalador de novo." }
  $ok = $false
  for ($i = 1; $i -le 90; $i++) {
    Start-Sleep -Seconds 2
    if (Test-Docker) { $ok = $true; break }
    if ($i % 5 -eq 0) { Write-Host "  aguardando o Docker Desktop iniciar... ($($i*2)s)" }
  }
  if (-not $ok) { Fail "O Docker Desktop nao iniciou a tempo. Abra-o, espere 'Engine running' e rode de novo. Se pedir, aceite o WSL 2 e reinicie o PC." }
}
Write-Host "Docker OK." -ForegroundColor Green
# remove containers antigos deste projeto (se existirem) para liberar a porta
docker compose down 2>&1 | Out-Null

# ---------- .env automatico ----------
if (-not (Test-Path $envPath)) {
  Copy-Item (Join-Path (Get-Location) '.env.example') $envPath
  $b = New-Object byte[] 32
  [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b)
  Set-Env 'ENCRYPTION_KEY' ([BitConverter]::ToString($b).Replace('-', '').ToLower())
  Write-Host ".env criado com ENCRYPTION_KEY nova (faca backup do .env!)." -ForegroundColor Yellow
}
# repara .env da versao anterior: "KEY=<64hex># comentario" -> "KEY=<64hex>  # comentario"
$cur = Read-Env
$fixed = [regex]::Replace($cur, '(?m)^(ENCRYPTION_KEY=[0-9a-fA-F]{64})#', '$1  #')
if ($fixed -ne $cur) { Write-Env $fixed; Write-Host ".env reparado." -ForegroundColor Yellow }

# ---------- e-mail do dono ----------
if (-not (Get-Env 'OWNER_EMAIL')) {
  Write-Host ""
  $mail = Read-Host "Qual e o SEU e-mail de dono? (acesso sem pagar; deixe vazio para pular)"
  if ($mail -match '^\S+@\S+\.\S+$') { Set-Env 'OWNER_EMAIL' $mail.Trim().ToLower() }
}

# ---------- Supabase configurado? senao, modo PREVIA ----------
$configured = $true
foreach ($n in 'NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_ANON_KEY','SUPABASE_URL','SUPABASE_KEY') {
  $v = Get-Env $n
  if (-not $v -or $v -like '*xxxx*' -or $v -like '*preview.invalid*' -or $v -eq 'preview') { $configured = $false }
}
if (-not $configured) {
  # valores de enchimento so para o site abrir (nao conectam em nada)
  Set-Env 'NEXT_PUBLIC_SUPABASE_URL' 'https://preview.invalid'
  Set-Env 'SUPABASE_URL' 'https://preview.invalid'
  Set-Env 'NEXT_PUBLIC_SUPABASE_ANON_KEY' 'preview'
  Set-Env 'SUPABASE_KEY' 'preview'
}

# ---------- porta livre para o site ----------
$port = 3000
$dockerPorts = Get-DockerPorts
while ((($dockerPorts -contains $port) -or -not (Test-PortFree $port)) -and $port -lt 3020) { $port++ }
if ($port -ge 3020) { Fail "Nenhuma porta livre entre 3000 e 3019. Feche programas que usam essas portas e tente de novo." }
if ($port -ne 3000) { Write-Host "A porta 3000 esta ocupada. Usando a porta $port." -ForegroundColor Yellow }
if (-not (Get-Env 'WEB_PORT')) { Write-Env ((Read-Env).TrimEnd() + "`nWEB_PORT=$port`n") }
Set-Env 'WEB_PORT' "$port"
if ((Get-Env 'NEXT_PUBLIC_APP_URL') -like 'http://localhost*') { Set-Env 'NEXT_PUBLIC_APP_URL' "http://localhost:$port" }
$siteUrl = "http://localhost:$port"

# ---------- subir ----------
Write-Host ""
Write-Host "Construindo e iniciando (a primeira vez demora alguns minutos)..." -ForegroundColor Green
$started = $false
for ($try = 1; $try -le 15; $try++) {
  Set-Env 'WEB_PORT' "$port"
  if ((Get-Env 'NEXT_PUBLIC_APP_URL') -like 'http://localhost*') { Set-Env 'NEXT_PUBLIC_APP_URL' "http://localhost:$port" }
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

Write-Host ""
if ($configured) {
  Write-Host "Pronto! Site + robo rodando em $siteUrl" -ForegroundColor Green
  Write-Host "Logs do robo:  docker compose logs -f worker"
} else {
  Write-Host "SITE NO AR em $siteUrl (MODO PREVIA)" -ForegroundColor Green
  Write-Host "Ja funcionam: landing, termos, privacidade e telas de checkout/login (visual)."
  Write-Host "Para ativar login, pagamento e robo: preencha as chaves no .env (Supabase, Asaas, Resend)" -ForegroundColor Yellow
  Write-Host "e rode este instalador de novo. O robo (worker) so inicia com o Supabase configurado."
}
if ($configured -and (Get-Env 'OWNER_EMAIL')) { Write-Host "Conta de dono: duplo clique em Criar-Dono-Windows.bat (cria o acesso sem pagar)." -ForegroundColor Yellow }
Write-Host "Para parar: duplo clique em Parar-Windows.bat"
Start-Process $siteUrl
