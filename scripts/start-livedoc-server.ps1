[CmdletBinding()]
param(
    [int]$Port = 3100,
    [string]$HostName = 'localhost',

    # Kill stale node processes holding the port (recommended for dev workflows).
    [switch]$KillStale,

    # If set, will also kill non-node processes holding the port.
    # Use with caution.
    [switch]$KillAll,

    # If set, starts the dev server in a new PowerShell window.
    [switch]$NewWindow,

    [int]$HealthTimeoutSec = 2
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Get-Listeners([int]$p) {
    Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess -Unique |
        ForEach-Object {
            $procId = $_
            $proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
            [PSCustomObject]@{
                Port        = $p
                ProcessId   = $procId
                ProcessName = if ($proc) { $proc.ProcessName } else { '<not found>' }
            }
        }
}

function Test-LiveDocHealth([string]$hostName, [int]$p, [int]$timeoutSec) {
    $url = "http://$hostName`:$p/api/health"
    try {
        return Invoke-RestMethod $url -TimeoutSec $timeoutSec
    } catch {
        return $null
    }
}

function Stop-Listeners([int]$p, [switch]$killAll, [switch]$killStale) {
    $listeners = @(Get-Listeners $p)
    if ($listeners.Count -eq 0) {
        return
    }

    Write-Host "Port $p is in use:" -ForegroundColor Yellow
    $listeners | Format-Table -AutoSize | Out-String | Write-Host

    foreach ($l in $listeners) {
        $isNode = $l.ProcessName -ieq 'node'
        if ($killAll -or ($killStale -and $isNode)) {
            Write-Host "Stopping PID $($l.ProcessId) ($($l.ProcessName))..." -ForegroundColor Yellow
            Stop-Process -Id $l.ProcessId -Force -ErrorAction SilentlyContinue
        } elseif (-not $killAll -and -not $killStale) {
            throw "Port $p is already in use (PID $($l.ProcessId), $($l.ProcessName)). Re-run with -KillStale or -KillAll."
        } else {
            throw "Port $p is in use by a non-node process (PID $($l.ProcessId), $($l.ProcessName)). Re-run with -KillAll (careful) or stop it manually."
        }
    }

    Start-Sleep -Milliseconds 300
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$serverDir = Join-Path $repoRoot 'packages/server'

if (-not (Test-Path $serverDir)) {
    throw "Server folder not found at: $serverDir"
}

# If already healthy, don’t restart unless explicitly asked.
$health = Test-LiveDocHealth -hostName $HostName -p $Port -timeoutSec $HealthTimeoutSec
if ($health) {
    Write-Host "LiveDoc server already running at http://$HostName`:$Port (status=$($health.status))." -ForegroundColor Green
    Write-Host "Use -KillStale to restart if you need a fresh session." -ForegroundColor DarkGray
    return
}

# Otherwise, clear the port if requested.
if ($KillStale -or $KillAll) {
    Stop-Listeners -p $Port -killAll:$KillAll -killStale:$KillStale
}

# One more health check before starting.
$health = Test-LiveDocHealth -hostName $HostName -p $Port -timeoutSec $HealthTimeoutSec
if ($health) {
    Write-Host "LiveDoc server is now responding at http://$HostName`:$Port (status=$($health.status))." -ForegroundColor Green
    return
}

$cmd = "Set-Location `"$serverDir`"; pnpm run dev -- --port $Port --host $HostName"

Write-Host "Starting LiveDoc server dev process on port $Port..." -ForegroundColor Cyan

if ($NewWindow) {
    Start-Process -FilePath 'powershell' -ArgumentList @('-NoExit', '-Command', $cmd) -WorkingDirectory $repoRoot
    return
}

Push-Location $serverDir
try {
    & pnpm run dev -- --port $Port --host $HostName
} finally {
    Pop-Location
}
