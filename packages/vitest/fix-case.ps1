$testDir = "d:\private\LiveDoc\packages\vitest\_src\test"
$files = Get-ChildItem -Path $testDir -Recurse -Filter "*.ts"

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw
    
    # First, fix any doubled aliases like "Then as Then as then" back to "Then as then"
    $newContent = $content -creplace 'Then as Then as then', 'Then as then'
    
    # Then, update any remaining bare 'then' in imports to 'Then as then'
    $newContent = $newContent -creplace '(import\s*\{[^}]*)\bthen\b([^}]*\}\s*from)', '$1Then as then$2'
    
    if ($content -cne $newContent) {
        $newContent | Set-Content $file.FullName -NoNewline
        Write-Host "Updated: $($file.Name)"
    }
}

Write-Host "Done!"
