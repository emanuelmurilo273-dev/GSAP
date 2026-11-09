# HEXADESK B3 - instalador do conector (Windows). Somente ASCII de proposito.
$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
$state = Join-Path $env:LOCALAPPDATA 'HexadeskConnector'
$venv = Join-Path $state 'venv'
function Fail($m) { Write-Host ""; Write-Host "ERRO: $m" -ForegroundColor Red; exit 1 }
Write-Host "=== HEXADESK B3 - instalador do conector ===" -ForegroundColor Green

# ---------- 1) Python 3.12 (a biblioteca do MT5 funciona bem com ele) ----------
function Find-Python {
  $cands = @(
    @{ e = 'py';     a = @('-3.12') },
    @{ e = 'py';     a = @('-3.11') },
    @{ e = 'py';     a = @('-3.10') },
    @{ e = 'python'; a = @() }
  )
  foreach ($c in $cands) {
    try {
      $v = & $c.e @($c.a) --version 2>&1
      if ($v -match 'Python 3\.(1[0-3])') { return $c }
    } catch { }
  }
  return $null
}
$py = Find-Python
if (-not $py) {
  Write-Host "Python nao encontrado. Instalando o Python 3.12 (winget)..." -ForegroundColor Yellow
  if (Get-Command winget -ErrorAction SilentlyContinue) {
    winget install -e --id Python.Python.3.12 --accept-package-agreements --accept-source-agreements
    $py = Find-Python
  }
  if (-not $py) { Start-Process "https://www.python.org/downloads/release/python-3120/"; Fail "Instale o Python 3.12 (marque 'Add python.exe to PATH'), feche esta janela e rode de novo." }
}
Write-Host "Python OK: $($py.e) $($py.a -join ' ')" -ForegroundColor Green

# ---------- 2) ambiente virtual + bibliotecas ----------
if (-not (Test-Path (Join-Path $venv 'Scripts\python.exe'))) {
  New-Item -ItemType Directory -Force -Path $state | Out-Null
  & $py.e @($py.a) -m venv $venv
}
$vpy = Join-Path $venv 'Scripts\python.exe'
Write-Host "Instalando bibliotecas (MetaTrader5, requests)..."
& $vpy -m pip install --upgrade pip --quiet
& $vpy -m pip install -r (Join-Path $root 'requirements.txt')
if ($LASTEXITCODE -ne 0) { Fail "Nao consegui instalar a biblioteca MetaTrader5. Confirme que o Windows e 64 bits e o Python e o 3.12." }

# ---------- 3) MetaTrader 5 instalado? ----------
$mt = Get-ChildItem "C:\Program Files*\*\terminal64.exe" -ErrorAction SilentlyContinue | Where-Object { $_.FullName -match 'MetaTrader|Clear|XP' } | Select-Object -First 1
if ($mt) { Write-Host "MetaTrader 5 encontrado: $($mt.FullName)" -ForegroundColor Green }
else {
  Write-Host "ATENCAO: nao achei o MetaTrader 5. Instale o da Clear antes (veja docs\B3-GUIA.md, passo 2)." -ForegroundColor Yellow
}

# ---------- 4) configurar (login demo, painel) ----------
Write-Host ""
& $vpy -m hexadesk_connector configurar
if ($LASTEXITCODE -ne 0) { Fail "A configuracao falhou." }

# ---------- 5) testar ----------
Write-Host ""
& $vpy -m hexadesk_connector testar

# ---------- 6) iniciar sozinho quando voce ligar o PC ----------
Write-Host ""
$a = Read-Host "Iniciar o conector automaticamente quando voce LIGAR e entrar no Windows? [S/n]"
if ($a -notmatch '^[nN]') {
  $bat = Join-Path $root 'Iniciar-Conector.bat'
  schtasks /Create /TN "HexadeskConnector" /TR "`"$bat`"" /SC ONLOGON /RL LIMITED /F | Out-Null
  Write-Host "Pronto: o conector abrira sozinho no login do Windows." -ForegroundColor Green
}
Write-Host ""
Write-Host "Para iniciar agora: duplo clique em Iniciar-Conector.bat" -ForegroundColor Cyan
