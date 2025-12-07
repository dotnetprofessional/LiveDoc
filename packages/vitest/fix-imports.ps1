# Fix ES module imports by adding .js extensions
$files = Get-ChildItem -Path "_src" -Filter "*.ts" -Recurse | Where-Object { $_.Name -notlike "*.d.ts" }

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw
    $originalContent = $content
    
    # Fix relative imports that don't end in .js
    # Pattern 1: from "./something" -> from "./something.js"
    $content = $content -replace 'from\s+([''"])(\./[^''"]+?)(?<!\.js)(\1)', 'from $1$2.js$3'
    
    # Pattern 2: from "../something" -> from "../something.js"
    $content = $content -replace 'from\s+([''"])(\.\.?/[^''"]+?)(?<!\.js)(\1)', 'from $1$2.js$3'
    
    # Fix directory imports to include /index.js
    $content = $content -replace 'from\s+([''"])(\.\.?/\w+(?:/\w+)*)/index\.js\.js(\1)', 'from $1$2/index.js$3'
    $content = $content -replace '(from\s+[''"]\.\.?/[^''"]+?)\.js\.js([''"])', '$1.js$2'
    
    if ($content -ne $originalContent) {
        Set-Content $file.FullName -Value $content -NoNewline
        Write-Host "Fixed: $($file.FullName)"
    }
}

Write-Host "Done!"
