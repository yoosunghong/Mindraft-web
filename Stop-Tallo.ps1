$ErrorActionPreference = 'Stop'
$stateFile = Join-Path $PSScriptRoot '.runtime/processes.json'
if (-not (Test-Path -LiteralPath $stateFile)) { Write-Host 'No managed Tallo processes found.'; exit 0 }
$state = Get-Content -LiteralPath $stateFile -Raw | ConvertFrom-Json
foreach ($key in @('tunnel','server')) {
    $record = $state.$key
    if (-not $record) { continue }
    $proc = Get-Process -Id $record.pid -ErrorAction SilentlyContinue
    if ($proc -and $proc.StartTime.ToUniversalTime().Ticks.ToString() -eq $record.startTicks -and $proc.Path -eq $record.executable) {
        Stop-Process -Id $proc.Id
        Write-Host "Stopped Tallo $key (PID $($proc.Id))."
    }
}
'{}' | Set-Content -LiteralPath $stateFile -Encoding utf8
