# copilot-yolo.ps1
# Launch Copilot in YOLO mode with project MCP servers.

Clear-Host

$accent = "Cyan"
$warning = "Yellow"
$danger = "Red"
$ok = "Green"

Write-Host "============================================================" -ForegroundColor $accent
Write-Host "        `u{1F680} COPILOT YOLO MODE `u{1F680}" -ForegroundColor $accent
Write-Host "============================================================" -ForegroundColor $accent
Write-Host ""
Write-Host "  Working Directory:" -ForegroundColor $ok
Write-Host "    $(Get-Location)" -ForegroundColor $ok
Write-Host ""
Write-Host "  What's about to happen:" -ForegroundColor $accent
Write-Host "    * Copilot will run with --yolo (no confirmation prompts)" -ForegroundColor $accent
Write-Host "    * Experimental features enabled" -ForegroundColor $accent
Write-Host "    * Project MCP servers loaded from .github\copilot\mcp.json" -ForegroundColor $accent
Write-Host ""

Write-Host ""
$dragonRows = @(
    '000011000000000000000000000000000000000000000000000000000000000000000022222222222222'
    '0000000000031000000000000000000000000000000000000000000000000000002222224544445445'
    '00000000033130000001300000000000000000000006700000044000000000222222555444445444'
    '00000000011330000003300000000000000000000006000000055000000000222277445444454444'
    '003100000110000000000000000000000000000006600000044720000000022222444444445544'
    '000000000000000000000000000000000000066600000444422000000004122244444444454444'
    '000000131000000001100000000000000555544444444442200000000004442222222222445444'
    '00001110000001100000000000011315555111111222266000000000000074724444445522224545'
    '1100110000011000000000000111100114400002244224444442200000000422225445444444222244'
    '000000000111100000011000011111144444444444444660000000000000512244225444444444000022'
    '0000000001100000000000000001100000000004444224444000000000005152445422444444'
    '001100031110000110000000000000000311155112200002222000000000715244445522444'
    '001133000113300003300333300003333330055110077760000000000000015245444422774'
    '001111000111100001100111100001111330055110066666600000000000015255444422225'
    '000011111111111111111111111113333000011006666662200000000000012222444445222'
    '000033111111133111111113333331100001100666644222200000000002247222454400002'
    '00000033331111133333333333311000011000022111122660000000000412222244'
    '00000003333331133333333111100000000002211114422660000000041256722200000000000066'
    '11000000033333333333311110000000000441111112222222200004422662222200000000000066'
    '11110000011333333111111000000000000333311552222442222222266602220000000000000022'
    '0011111113333331111110000001100001133334422224444444422666667000000000000000000022'
    '0000111333333111111110000110000003311112222444411442222222267000000000000000000022'
    '110076111111111411111310060000000311111222244111144222222222700000000000000000002277'
    '110000111111111001111110000000000111111222244111144222222222226600000000000000002266'
    '000011000111100000011111100000000441111226611114444662222622222222660000000000002266'
    '000000000000000000011110000000000224444226611444422660066622744422226600000000006666'
    '0000000310000000011110000000000000022445566554444222200006244411442222660000002266'
    '0000000001100001111000011000000000000222222004444442222000245111114422660000666666'
    '00000000000000000000000000000000000000022226600444422540000111111144222200006666'
    '000000000000000000000000000000000006600006666000022222200064411144440666006666'
    '0000000000000000000000000000000002266660000000055442267000000444442206'
    '000000000000000000000000000000000226666000000001144220000000005222220666'
    '000000000000000000000000000000055776600000000331122220000000000000006666'
    '000000000000000000000000000000025666700000000111122660000000000000007666'
    '000000000000000000000000000002266660000000000114522000000000000000005266'
    '000000000000000000000002200226666000000001154444566000000000000000444422'
    '00000000000000000000022006666666600000011220011222200000000000001100110066'
)

$dragonPalette = @{
    '1' = @(221, 72, 0)
    '2' = @(92, 14, 12)
    '3' = @(241, 102, 4)
    '4' = @(168, 38, 4)
    '5' = @(125, 26, 9)
    '6' = @(48, 6, 16)
    '7' = @(66, 13, 16)
}

$dragonTopPixel = [char]0x2580
$dragonBottomPixel = [char]0x2584
$dragonWidthScale = 0.75
for ($row = 0; $row -lt $dragonRows.Count; $row += 2) {
    $dragonRow = $dragonRows[$row]
    $dragonRowBottom = if ($row + 1 -lt $dragonRows.Count) { $dragonRows[$row + 1] } else { "" }
    $rowWidth = [Math]::Max($dragonRow.Length, $dragonRowBottom.Length)
    $renderWidth = [Math]::Max(1, [int][Math]::Ceiling($rowWidth * $dragonWidthScale))
    $builder = [System.Text.StringBuilder]::new()

    for ($col = 0; $col -lt $renderWidth; $col++) {
        $sourceCol = [Math]::Min($rowWidth - 1, [int][Math]::Floor(($col / [double]$renderWidth) * $rowWidth))
        $topCode = if ($sourceCol -lt $dragonRow.Length) { [string]$dragonRow[$sourceCol] } else { '0' }
        $bottomCode = if ($sourceCol -lt $dragonRowBottom.Length) { [string]$dragonRowBottom[$sourceCol] } else { '0' }

        if ($topCode -eq '0' -and $bottomCode -eq '0') {
            [void]$builder.Append(' ')
            continue
        }

        $topRgb = if ($topCode -ne '0') { $dragonPalette[$topCode] } else { $null }
        $bottomRgb = if ($bottomCode -ne '0') { $dragonPalette[$bottomCode] } else { $null }

        if ($topRgb -and $bottomRgb) {
            [void]$builder.Append($PSStyle.Foreground.FromRgb($topRgb[0], $topRgb[1], $topRgb[2]))
            [void]$builder.Append($PSStyle.Background.FromRgb($bottomRgb[0], $bottomRgb[1], $bottomRgb[2]))
            [void]$builder.Append($dragonTopPixel)
            [void]$builder.Append($PSStyle.Reset)
            continue
        }

        if ($topRgb) {
            [void]$builder.Append($PSStyle.Foreground.FromRgb($topRgb[0], $topRgb[1], $topRgb[2]))
            [void]$builder.Append($dragonTopPixel)
            [void]$builder.Append($PSStyle.Reset)
            continue
        }

        if ($bottomRgb) {
            [void]$builder.Append($PSStyle.Foreground.FromRgb($bottomRgb[0], $bottomRgb[1], $bottomRgb[2]))
            [void]$builder.Append($dragonBottomPixel)
            [void]$builder.Append($PSStyle.Reset)
            continue
        }

        if (-not $topRgb -and -not $bottomRgb) {
            [void]$builder.Append(' ')
            continue
        }
    }

    Write-Host $builder.ToString()
}

$fireLine =
    "$($PSStyle.Foreground.FromRgb(255, 214, 120))`u{1F525}" +
    "$($PSStyle.Foreground.FromRgb(255, 170, 40))`u{1F525}" +
    "$($PSStyle.Foreground.FromRgb(255, 92, 20))`u{1F525}" +
    "$($PSStyle.Foreground.FromRgb(255, 56, 0)) >>> BEWARE THERE BE DRAGONS >>> " +
    "$($PSStyle.Foreground.FromRgb(255, 92, 20))`u{1F525}" +
    "$($PSStyle.Foreground.FromRgb(255, 170, 40))`u{1F525}" +
    "$($PSStyle.Foreground.FromRgb(255, 214, 120))`u{1F525}" +
    $PSStyle.Reset
Write-Host "     $fireLine"
Write-Host ""
Write-Host ""
Write-Host "     This is YOLO mode. There are no guardrails." -ForegroundColor $danger
Write-Host "     No confirmations. No take-backs. No safety net." -ForegroundColor $danger
Write-Host ""
Write-Host "     Copilot will run commands *without* asking first." -ForegroundColor $danger
Write-Host "     If it decides to delete, overwrite, or reformat" -ForegroundColor $danger
Write-Host "     something important... it just will." -ForegroundColor $danger
Write-Host ""
Write-Host "     You are handing the keys to an AI and saying" -ForegroundColor $danger
Write-Host "     'do whatever you want'. Act accordingly." -ForegroundColor $danger
Write-Host ""
Write-Host "============================================================" -ForegroundColor $accent
Write-Host ""

$confirmation = Read-Host "Type YES to accept responsibility"

if ($confirmation -ne "YES") {
    Write-Host ""
    Write-Host "Mission aborted. Probably a wise choice." -ForegroundColor $warning
    exit
}

Clear-Host

Write-Host "============================================================" -ForegroundColor $ok
Write-Host "   `u{1F7E2} Copilot YOLO Mode Activated `u{1F7E2}" -ForegroundColor $ok
Write-Host "   `u{1F409} Here be dragons... hope you don't meet one! Good luck! `u{1F409}" -ForegroundColor $ok
Write-Host "============================================================" -ForegroundColor $ok
Write-Host ""

$mcpConfig = ".github\copilot\mcp.json"
if (Test-Path $mcpConfig) {
    copilot --yolo --experimental --banner --additional-mcp-config "@$mcpConfig"
} else {
    Write-Host "MCP config not found at $mcpConfig, launching without it..." -ForegroundColor $warning
    copilot --yolo --experimental --banner
}
