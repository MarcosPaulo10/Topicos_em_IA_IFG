# Monta historico Git com 4 commits e tags v1.0 - v4.0
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

$Backup = Join-Path $env:TEMP "ia-local-v4-backup"
$Phases = Join-Path $Root "scripts\git-phases"

Write-Host "==> Backup do estado final (v4)..." -ForegroundColor Cyan
if (Test-Path $Backup) { Remove-Item -Recurse -Force $Backup }
New-Item -ItemType Directory -Path $Backup | Out-Null

$exclude = @("venv", "node_modules", "data", "temp", "dist", "__pycache__", ".git")
Get-ChildItem -Path $Root -Recurse -File | Where-Object {
    $rel = $_.FullName.Substring($Root.Length + 1)
    -not ($exclude | Where-Object { $rel -like "$_*" -or $rel -like "*\$_\*" })
} | ForEach-Object {
    $dest = Join-Path $Backup $rel
    $dir = Split-Path $dest -Parent
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    Copy-Item $_.FullName $dest -Force
}

function Remove-PhaseFiles {
    param([string[]]$Paths)
    foreach ($p in $Paths) {
        $full = Join-Path $Root $p
        if (Test-Path $full) { Remove-Item -Recurse -Force $full }
    }
}

function Apply-Overrides {
    param([string]$PhaseDir)
    if (-not (Test-Path $PhaseDir)) { return }
    Get-ChildItem -Path $PhaseDir -Recurse -File | ForEach-Object {
        $rel = $_.FullName.Substring($PhaseDir.Length + 1)
        $dest = Join-Path $Root $rel
        $dir = Split-Path $dest -Parent
        if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
        Copy-Item $_.FullName $dest -Force
    }
}

function Git-Commit-Phase {
    param([string]$Message, [string]$Tag, [string]$TagMsg, [switch]$IncludeScripts)
    git add -A
    if (-not $IncludeScripts -and (Test-Path (Join-Path $Root "scripts"))) {
        git reset HEAD -- scripts 2>$null
        if ($LASTEXITCODE -ne 0) { git rm -r --cached scripts 2>$null }
    }
    git commit -m $Message
    git tag -a $Tag -m $TagMsg
    Write-Host "    OK $Tag" -ForegroundColor Green
}

Write-Host "==> Preparando repositorio..." -ForegroundColor Cyan
if (-not (Test-Path (Join-Path $Root ".git"))) {
    git init
}
git branch -M main 2>$null

# --- Fase 1 ---
Write-Host "==> Fase 1 (v1.0)..." -ForegroundColor Cyan
Remove-PhaseFiles @(
    "backend\transcription.py",
    "backend\video.py",
    "frontend\scripts",
    "frontend\renderer\hooks",
    "frontend\renderer\utils",
    "frontend\renderer\public"
)
Apply-Overrides (Join-Path $Phases "v1")
Git-Commit-Phase "Fase 1: chat local com memoria persistente" "v1.0" "Entrega Fase 1 - Chat local Phi-3/LLaMA"

# --- Fase 2 ---
Write-Host "==> Fase 2 (v2.0)..." -ForegroundColor Cyan
Apply-Overrides (Join-Path $Phases "v2")
Git-Commit-Phase "Fase 2: chat com PDF" "v2.0" "Entrega Fase 2 - Upload e leitura de PDF"

# --- Fase 3 ---
Write-Host "==> Fase 3 (v3.0)..." -ForegroundColor Cyan
Apply-Overrides (Join-Path $Phases "v3")
Git-Commit-Phase "Fase 3: chat com audio (Whisper)" "v3.0" "Entrega Fase 3 - Transcricao de audio"

# --- Fase 4 ---
Write-Host "==> Fase 4 (v4.0)..." -ForegroundColor Cyan
robocopy $Backup $Root /E /XD venv node_modules data temp __pycache__ .git /XF .env /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
if (Test-Path (Join-Path $Root "p")) { Remove-Item -Recurse -Force (Join-Path $Root "p") }
Git-Commit-Phase "Fase 4: chat com video (FFmpeg + Whisper)" "v4.0" "Entrega Fase 4 - Produto completo" -IncludeScripts

Write-Host ""
Write-Host "Historico criado com sucesso!" -ForegroundColor Green
Write-Host "  git log --oneline --decorate"
Write-Host "  git tag -l"
Write-Host ""
Write-Host "Para enviar ao GitHub:"
Write-Host "  git remote add origin https://github.com/SEU_USUARIO/IA_Local.git"
Write-Host "  git push -u origin main"
Write-Host "  git push origin v1.0 v2.0 v3.0 v4.0"
