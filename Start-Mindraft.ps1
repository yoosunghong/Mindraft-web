param([switch]$LocalOnly)
$ErrorActionPreference = 'Stop'
$projectDir = $PSScriptRoot
$runtimeDir = Join-Path $projectDir '.runtime'
New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null
$stateFile = Join-Path $runtimeDir 'processes.json'
$state = @{}
if (Test-Path -LiteralPath $stateFile) {
    $previous = Get-Content -LiteralPath $stateFile -Raw | ConvertFrom-Json
    foreach ($key in @('server','tunnel')) {
        $record = $previous.$key
        if ($record) {
            $proc = Get-Process -Id $record.pid -ErrorAction SilentlyContinue
            if ($proc -and $proc.StartTime.ToUniversalTime().Ticks.ToString() -eq $record.startTicks) { $state[$key] = $record }
        }
    }
}
function Save-State { $state | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $stateFile -Encoding utf8 }
function Start-TrackedProcess($key, $exe, $arguments) {
    $proc = Start-Process -FilePath $exe -ArgumentList $arguments -WorkingDirectory $projectDir -WindowStyle Hidden -RedirectStandardOutput (Join-Path $runtimeDir "$key.log") -RedirectStandardError (Join-Path $runtimeDir "$key-error.log") -PassThru
    $state[$key] = @{pid=$proc.Id; startTicks=$proc.StartTime.ToUniversalTime().Ticks.ToString(); executable=$exe}
    Save-State
}
if (-not $state.ContainsKey('server')) {
    $existing = $null
    try { $existing = Invoke-RestMethod 'http://127.0.0.1:3210/api/health' -TimeoutSec 2 } catch {}
    if ($existing) { throw 'Port 3210 is already serving an untracked process. Stop that process before running this script.' }
    $nodePath = (Get-Command node.exe -ErrorAction Stop).Source
    if (-not (Test-Path (Join-Path $projectDir 'node_modules'))) { throw 'Run npm install first.' }
    Start-TrackedProcess 'server' $nodePath 'server.js'
    $healthy = $false
    for ($attempt=0; $attempt -lt 20; $attempt++) {
        try { $health = Invoke-RestMethod 'http://127.0.0.1:3210/api/health' -TimeoutSec 1; if ($health.ok) { $healthy=$true; break } } catch {}
        Start-Sleep -Milliseconds 250
    }
    if (-not $healthy) { throw 'Server failed to start. See .runtime/server-error.log.' }
}
if (-not $LocalOnly -and -not $state.ContainsKey('tunnel')) {
    $configFile = Join-Path $runtimeDir 'tunnel.yml'
    if (-not (Test-Path -LiteralPath $configFile)) { throw 'Tunnel config is missing. See README.md.' }
    $cloudflaredPath = (Get-Command cloudflared.exe -ErrorAction Stop).Source
    Start-TrackedProcess 'tunnel' $cloudflaredPath "tunnel --config `"$configFile`" run mindraft-web"
}
Write-Host 'Local:  http://localhost:3210'
if (-not $LocalOnly) { Write-Host 'Public: https://mindraft.yoosung.dev' }
Write-Host 'Mindraft is running in the background. Stop with .\Stop-Mindraft.ps1'
