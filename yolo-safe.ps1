# copilot-yolo.ps1
# A colorful, dramatic launch sequence for Copilot YOLO mode.

Clear-Host

# Determine the directory where the script is launched
$Root = (Get-Location).ProviderPath

# Colors
$accent = "Cyan"
$warning = "Yellow"
$danger = "Red"
$ok = "Green"

Write-Host "============================================================" -ForegroundColor $accent
Write-Host "        🚀 COPILOT YOLO MODE: RESTRICTED EXECUTION ZONE 🚀" -ForegroundColor $accent
Write-Host "============================================================" -ForegroundColor $accent
Write-Host ""
Write-Host "  Safe Root Directory:" -ForegroundColor $ok
Write-Host "    $Root" -ForegroundColor $ok
Write-Host ""
Write-Host "  What’s about to happen:" -ForegroundColor $accent
Write-Host "    • Copilot will run with --yolo (no confirmation prompts)" -ForegroundColor $accent
Write-Host "    • All commands must stay inside this directory (as best we can)" -ForegroundColor $accent
Write-Host "    • Anything outside this folder gets BLOCKED when possible" -ForegroundColor $warning
Write-Host ""

Write-Host "  ⚠️  WARNING — PLEASE READ BEFORE WE DO ANYTHING REGRETTABLE:" -ForegroundColor $danger
Write-Host "     I’m going to try my absolute best to stay inside the" -ForegroundColor $danger
Write-Host "     little sandbox you’ve built for me…" -ForegroundColor $danger
Write-Host ""
Write-Host "     …but let’s be real with each other for a second." -ForegroundColor $danger
Write-Host ""
Write-Host "     This is YOLO mode." -ForegroundColor $danger
Write-Host "     You asked me to run commands *without* asking first." -ForegroundColor $danger
Write-Host ""
Write-Host "     And yes — if I generate something spicy enough," -ForegroundColor $danger
Write-Host "     PowerShell will happily execute it." -ForegroundColor $danger
Write-Host ""
Write-Host "     Could I format your drive?" -ForegroundColor $danger
Write-Host "     Technically… yes." -ForegroundColor $danger
Write-Host ""
Write-Host "     Will I *try* not to?" -ForegroundColor $danger
Write-Host "     Absolutely. Pinky promise." -ForegroundColor $danger
Write-Host ""
Write-Host "     Just remember: this script is a seatbelt, not a force field." -ForegroundColor $danger
Write-Host "     You’ve been warned, Commander." -ForegroundColor $danger
Write-Host ""
Write-Host "============================================================" -ForegroundColor $accent
Write-Host ""

# Ask for confirmation
$confirmation = Read-Host "Type YES to accept responsibility for unleashing this chaos"

if ($confirmation -ne "YES") {
    Write-Host ""
    Write-Host "Mission aborted. Probably a wise choice." -ForegroundColor $warning
    exit
}

Clear-Host

Write-Host "============================================================" -ForegroundColor $ok
Write-Host "   🟢 Copilot YOLO Mode Activated — May the odds be ever in your favor 🟢" -ForegroundColor $ok
Write-Host "   Restricted to: $Root" -ForegroundColor $ok
Write-Host "============================================================" -ForegroundColor $ok
Write-Host ""

# Intercept outgoing commands
$env:COPILOT_SHELL_INTERCEPT = "1"

# Hook into PowerShell's command execution pipeline
Register-EngineEvent PowerShell.OnCommandExecuted -Action {
    param($sender, $eventArgs)

    $cmd = $eventArgs.CommandLine

    # Block absolute paths outside the root
    if ($cmd -match "^[A-Za-z]:\\" -and $cmd -notmatch [regex]::Escape($Root)) {
        Write-Host "⛔ BLOCKED: $cmd" -ForegroundColor "Red"
        $eventArgs.Cancel = $true
    }
}

# Force working directory to the safe root
Set-Location $Root

# Launch Copilot in YOLO mode
copilot --yolo --banner
