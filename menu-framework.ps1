#Requires -Version 5.1
<#
.SYNOPSIS
    Reusable interactive menu framework for PowerShell project launchers.

.DESCRIPTION
    Provides functions for building interactive terminal menus with hotkey
    navigation, stack-based submenus, optional logging, and non-interactive
    CLI support. Copy this file into your project and dot-source it from
    your launcher script.

    This file is the framework only. It does not define any menu items.
    See generate-menu.ps1 to scaffold a project-specific launcher.

.NOTES
    Designed for per-project use. Each project gets its own copy.
    The version marker below enables tooling to detect drift across copies.
#>

$script:MenuFrameworkVersion = '1.0.0'

# ---------------------------------------------------------------------------
#  Logging (optional, off by default)
# ---------------------------------------------------------------------------

$script:MenuLogPath = $null

function Enable-MenuLog {
    <#
    .SYNOPSIS
        Enable file + console logging for menu actions.
    .PARAMETER Path
        Log file path. Directory is created if it does not exist.
    #>
    param([Parameter(Mandatory)][string]$Path)

    $dir = Split-Path -Parent $Path
    if ($dir -and -not (Test-Path -LiteralPath $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
    $script:MenuLogPath = $Path
}

function Write-MenuLog {
    <#
    .SYNOPSIS
        Write a timestamped log entry to console and (optionally) log file.
    #>
    param(
        [Parameter(Mandatory)][string]$Message,
        [ValidateSet('INFO','WARN','ERROR')][string]$Level = 'INFO'
    )

    $timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss.fff'
    $line = "[$timestamp] [$Level] $Message"

    $color = switch ($Level) {
        'WARN'  { 'Yellow' }
        'ERROR' { 'Red'    }
        default { 'DarkGray' }
    }
    Write-Host $line -ForegroundColor $color

    if ($script:MenuLogPath) {
        Add-Content -LiteralPath $script:MenuLogPath -Value $line -Encoding UTF8
    }
}

# ---------------------------------------------------------------------------
#  Terminal capability detection
# ---------------------------------------------------------------------------

function Test-AnsiSupport {
    <#
    .SYNOPSIS
        Returns $true if the terminal supports ANSI/VT escape sequences.
    #>
    if ($null -ne $Host.UI -and
        $null -ne $Host.UI.psobject.Properties['SupportsVirtualTerminal'] -and
        $Host.UI.SupportsVirtualTerminal) {
        return $true
    }
    # PowerShell 7+ on Windows 10+ generally supports ANSI
    if ($PSVersionTable.PSVersion.Major -ge 7 -and $env:WT_SESSION) {
        return $true
    }
    return $false
}

$script:AnsiSupported = Test-AnsiSupport

# ---------------------------------------------------------------------------
#  Menu item constructors
# ---------------------------------------------------------------------------

function New-MenuItem {
    <#
    .SYNOPSIS
        Create a menu item.
    .PARAMETER Label
        Display text shown in the menu.
    .PARAMETER HotKey
        Single character shortcut. Case-insensitive.
    .PARAMETER Action
        Scriptblock to execute when the item is selected.
    .PARAMETER Children
        Array of child menu items for a submenu.
    .PARAMETER Description
        One-line description shown below the label when selected.
    .PARAMETER Disabled
        If $true, the item is visible but not selectable.
    .PARAMETER Visible
        Scriptblock returning $true/$false for conditional visibility.
        Evaluated each time the menu renders.
    #>
    param(
        [Parameter(Mandatory)][string]$Label,
        [char]$HotKey = [char]0,
        [scriptblock]$Action,
        [object[]]$Children = @(),
        [string]$Description = '',
        [switch]$Disabled,
        [scriptblock]$Visible
    )

    [PSCustomObject]@{
        Label       = $Label
        HotKey      = $HotKey
        Action      = $Action
        Children    = $Children
        Description = $Description
        Disabled    = [bool]$Disabled
        Visible     = $Visible
        IsSeparator = $false
    }
}

function New-MenuSeparator {
    <#
    .SYNOPSIS
        Create a visual separator in the menu.
    .PARAMETER Label
        Optional label displayed in the separator line.
    #>
    param([string]$Label = '')

    [PSCustomObject]@{
        Label       = $Label
        HotKey      = [char]0
        Action      = $null
        Children    = @()
        Description = ''
        Disabled    = $true
        Visible     = $null
        IsSeparator = $true
    }
}

# ---------------------------------------------------------------------------
#  Rendering
# ---------------------------------------------------------------------------

function Get-VisibleItems {
    <#
    .SYNOPSIS
        Filter items by their Visible scriptblock. Items without a Visible
        scriptblock are always shown.
    #>
    param([Parameter(Mandatory)][object[]]$Items)

    $result = [System.Collections.Generic.List[object]]::new()
    foreach ($item in $Items) {
        if ($null -eq $item.Visible) {
            $result.Add($item)
        } else {
            try {
                if (& $item.Visible) { $result.Add($item) }
            } catch {
                # If the visibility check fails, hide the item
            }
        }
    }
    return $result.ToArray()
}

function Get-SelectableIndices {
    <#
    .SYNOPSIS
        Return indices of items that can be selected (not separators, not disabled).
    #>
    param([Parameter(Mandatory)][object[]]$Items)

    $indices = [System.Collections.Generic.List[int]]::new()
    for ($i = 0; $i -lt $Items.Count; $i++) {
        if (-not $Items[$i].IsSeparator -and -not $Items[$i].Disabled) {
            $indices.Add($i)
        }
    }
    return $indices.ToArray()
}

function Find-ByHotKey {
    <#
    .SYNOPSIS
        Find the index of a selectable item matching the given hotkey.
        Returns -1 if not found.
    #>
    param(
        [Parameter(Mandatory)][object[]]$Items,
        [Parameter(Mandatory)][char]$HotKey
    )

    for ($i = 0; $i -lt $Items.Count; $i++) {
        if ($Items[$i].IsSeparator -or $Items[$i].Disabled) { continue }
        if ($Items[$i].HotKey -ne [char]0 -and
            [char]::ToUpperInvariant($Items[$i].HotKey) -eq [char]::ToUpperInvariant($HotKey)) {
            return $i
        }
    }
    return -1
}

function Render-Menu {
    <#
    .SYNOPSIS
        Draw the menu to the console. Called by Run-Menu each iteration.
    #>
    param(
        [Parameter(Mandatory)][string]$Title,
        [Parameter(Mandatory)][object[]]$Items,
        [Parameter(Mandatory)][int]$SelectedIndex,
        [string]$Subtitle = '',
        [string]$AppName = ''
    )

    Clear-Host

    if ($AppName) {
        Write-Host $AppName -ForegroundColor Cyan
    }
    Write-Host $Title -ForegroundColor White
    if ($Subtitle) {
        Write-Host $Subtitle -ForegroundColor DarkGray
    }
    Write-Host ''

    for ($i = 0; $i -lt $Items.Count; $i++) {
        $item = $Items[$i]

        # Separator
        if ($item.IsSeparator) {
            if ($item.Label) {
                Write-Host "  --- $($item.Label) ---" -ForegroundColor Cyan
            } else {
                Write-Host ''
            }
            continue
        }

        $prefix = if ($i -eq $SelectedIndex) { '>' } else { ' ' }
        $hk = if ($item.HotKey -ne [char]0) { "[$($item.HotKey)] " } else { '    ' }

        if ($item.Disabled) {
            Write-Host "$prefix $hk$($item.Label)" -ForegroundColor DarkGray
        } elseif ($i -eq $SelectedIndex) {
            Write-Host "$prefix $hk$($item.Label)" -ForegroundColor Black -BackgroundColor Gray
        } else {
            Write-Host "$prefix $hk$($item.Label)" -ForegroundColor Gray
        }
    }

    # Description pinned at the bottom — stable layout regardless of selection
    Write-Host ''
    $selectedItem = $Items[$SelectedIndex]
    if ($selectedItem -and -not $selectedItem.IsSeparator -and $selectedItem.Description) {
        Write-Host "  $($selectedItem.Description)" -ForegroundColor DarkCyan
    } else {
        Write-Host ''
    }

    Write-Host ''
    Write-Host '[up]/[down] navigate  [Enter] select  [Esc] back  [Q] quit  hotkey to jump' -ForegroundColor DarkGray
}

# ---------------------------------------------------------------------------
#  Execution helpers
# ---------------------------------------------------------------------------

function Invoke-InDirectory {
    <#
    .SYNOPSIS
        Execute a scriptblock in a specific directory, preserving the caller's
        location and capturing the exit code.
    .PARAMETER Path
        Working directory for the action.
    .PARAMETER Action
        Scriptblock to execute.
    #>
    param(
        [Parameter(Mandatory)][string]$Path,
        [Parameter(Mandatory)][scriptblock]$Action
    )

    if (-not (Test-Path -LiteralPath $Path)) {
        Write-MenuLog "Directory not found: $Path" -Level ERROR
        return 1
    }

    Push-Location $Path
    try {
        & $Action
        $code = if ($null -eq $LASTEXITCODE) { 0 } else { $LASTEXITCODE }
        if ($code -ne 0) {
            Write-MenuLog "Action exited with code $code" -Level WARN
        }
        return $code
    } catch {
        Write-MenuLog "Action failed: $_" -Level ERROR
        return 1
    } finally {
        Pop-Location
    }
}

function Pause-Continue {
    <#
    .SYNOPSIS
        Wait for a keypress before returning to the menu. Safe in
        non-interactive terminals.
    #>
    Write-Host ''
    Write-Host 'Press any key to continue...' -ForegroundColor DarkGray
    try {
        [void][System.Console]::ReadKey($true)
    } catch {
        # Non-interactive terminal; just return
    }
}

# ---------------------------------------------------------------------------
#  Non-interactive support
# ---------------------------------------------------------------------------

function Get-AllMenuItems {
    <#
    .SYNOPSIS
        Flatten a menu tree into a list for -List display and -Run lookup.
    #>
    param(
        [Parameter(Mandatory)][object[]]$Items,
        [string]$Prefix = ''
    )

    $result = [System.Collections.Generic.List[object]]::new()
    foreach ($item in $Items) {
        if ($item.IsSeparator) { continue }

        $path = if ($Prefix) { "$Prefix > $($item.Label)" } else { $item.Label }

        if ($item.Children -and @($item.Children).Count -gt 0) {
            $result.AddRange((Get-AllMenuItems -Items $item.Children -Prefix $path))
        } else {
            $result.Add([PSCustomObject]@{
                HotKey      = if ($item.HotKey -ne [char]0) { [string]$item.HotKey } else { '-' }
                Label       = $item.Label
                Path        = $path
                Description = $item.Description
                Action      = $item.Action
                Disabled    = $item.Disabled
            })
        }
    }
    return $result.ToArray()
}

function Invoke-MenuList {
    <#
    .SYNOPSIS
        Print all leaf menu items as a table (for -List mode).
    #>
    param([Parameter(Mandatory)][object[]]$Items)

    $flat = Get-AllMenuItems -Items $Items
    $flat | Format-Table -Property HotKey, Label, Description -AutoSize
}

function Invoke-MenuRun {
    <#
    .SYNOPSIS
        Execute a menu item by hotkey without the interactive UI (for -Run mode).
        Returns the action's exit code.
    #>
    param(
        [Parameter(Mandatory)][object[]]$Items,
        [Parameter(Mandatory)][string]$HotKey
    )

    $flat = Get-AllMenuItems -Items $Items
    $match = $flat | Where-Object {
        $_.HotKey -ne '-' -and
        [char]::ToUpperInvariant([char]$_.HotKey) -eq [char]::ToUpperInvariant([char]$HotKey)
    } | Select-Object -First 1

    if (-not $match) {
        Write-Error "No menu item with hotkey '$HotKey'. Use -List to see available items."
        return 1
    }

    if ($match.Disabled) {
        Write-Error "Menu item '$($match.Label)' is disabled."
        return 1
    }

    if ($null -eq $match.Action) {
        Write-Error "Menu item '$($match.Label)' has no action."
        return 1
    }

    Write-MenuLog "Running: $($match.Label)" -Level INFO
    & $match.Action
    $code = if ($null -eq $LASTEXITCODE) { 0 } else { $LASTEXITCODE }
    return $code
}

# ---------------------------------------------------------------------------
#  Main menu loop
# ---------------------------------------------------------------------------

function Run-Menu {
    <#
    .SYNOPSIS
        Start the interactive menu. Supports stack-based submenu navigation.
    .PARAMETER Title
        Root menu title.
    .PARAMETER Items
        Array of menu items (from New-MenuItem / New-MenuSeparator).
    .PARAMETER AppName
        Application name displayed above the title.
    .PARAMETER Subtitle
        Optional subtitle displayed below the title.
    .PARAMETER QuitFlag
        Script-scope variable name that, when set to $true, exits the menu.
        Allows actions to signal "quit the whole menu" by setting:
          Set-Variable -Name <QuitFlag> -Value $true -Scope Script
    #>
    param(
        [Parameter(Mandatory)][string]$Title,
        [Parameter(Mandatory)][object[]]$Items,
        [string]$AppName = '',
        [string]$Subtitle = '',
        [string]$QuitFlag = ''
    )

    $stack = [System.Collections.Generic.List[object]]::new()
    $stack.Add([PSCustomObject]@{
        Title         = $Title
        Items         = $Items
        SelectedIndex = 0
        Subtitle      = $Subtitle
    })

    while ($stack.Count -gt 0) {
        # Check quit flag
        if ($QuitFlag) {
            $quitVal = Get-Variable -Name $QuitFlag -Scope Script -ValueOnly -ErrorAction SilentlyContinue
            if ($quitVal) { return }
        }

        $current = $stack[$stack.Count - 1]

        # Filter by visibility
        $visibleItems = Get-VisibleItems -Items $current.Items
        if ($visibleItems.Count -eq 0) {
            [void]$stack.RemoveAt($stack.Count - 1)
            continue
        }

        # Get selectable indices (skip separators + disabled)
        $selectable = Get-SelectableIndices -Items $visibleItems
        if ($selectable.Count -eq 0) {
            [void]$stack.RemoveAt($stack.Count - 1)
            continue
        }

        # Clamp selected index to selectable range
        $selPos = 0
        for ($s = 0; $s -lt $selectable.Count; $s++) {
            if ($selectable[$s] -ge $current.SelectedIndex) {
                $selPos = $s
                break
            }
        }
        $current.SelectedIndex = $selectable[$selPos]

        # Render
        Render-Menu -Title $current.Title `
                    -Items $visibleItems `
                    -SelectedIndex $current.SelectedIndex `
                    -Subtitle $current.Subtitle `
                    -AppName $AppName

        # Read input
        try {
            $keyInfo = [System.Console]::ReadKey($true)
        } catch {
            # Non-interactive terminal
            Write-Warning 'Interactive menu requires a terminal. Use -List or -Run instead.'
            return
        }

        switch ($keyInfo.Key) {
            'UpArrow' {
                $selPos = [Array]::IndexOf($selectable, $current.SelectedIndex)
                $selPos = if ($selPos -le 0) { $selectable.Count - 1 } else { $selPos - 1 }
                $current.SelectedIndex = $selectable[$selPos]
            }
            'DownArrow' {
                $selPos = [Array]::IndexOf($selectable, $current.SelectedIndex)
                $selPos = if ($selPos -ge ($selectable.Count - 1)) { 0 } else { $selPos + 1 }
                $current.SelectedIndex = $selectable[$selPos]
            }
            'Escape' {
                [void]$stack.RemoveAt($stack.Count - 1)
            }
            'Enter' {
                $selected = $visibleItems[$current.SelectedIndex]
                if ($selected.Children -and @($selected.Children).Count -gt 0) {
                    $stack.Add([PSCustomObject]@{
                        Title         = $selected.Label
                        Items         = $selected.Children
                        SelectedIndex = 0
                        Subtitle      = ''
                    })
                } elseif ($null -ne $selected.Action) {
                    Clear-Host
                    Write-MenuLog "Executing: $($selected.Label)" -Level INFO
                    & $selected.Action
                    # Check quit flag after action
                    if ($QuitFlag) {
                        $quitVal = Get-Variable -Name $QuitFlag -Scope Script -ValueOnly -ErrorAction SilentlyContinue
                        if ($quitVal) { return }
                    }
                    Pause-Continue
                }
            }
            default {
                $ch = $keyInfo.KeyChar
                if ($ch -eq 'q' -or $ch -eq 'Q') {
                    return
                }
                if ($ch -ne [char]0) {
                    $idx = Find-ByHotKey -Items $visibleItems -HotKey $ch
                    if ($idx -ge 0) {
                        $current.SelectedIndex = $idx
                        $hit = $visibleItems[$idx]

                        # Hotkey on leaf item = immediate execute
                        if (-not ($hit.Children -and @($hit.Children).Count -gt 0) -and $null -ne $hit.Action) {
                            Clear-Host
                            Write-MenuLog "Executing: $($hit.Label)" -Level INFO
                            & $hit.Action
                            if ($QuitFlag) {
                                $quitVal = Get-Variable -Name $QuitFlag -Scope Script -ValueOnly -ErrorAction SilentlyContinue
                                if ($quitVal) { return }
                            }
                            Pause-Continue
                        }
                    }
                }
            }
        }
    }
}
