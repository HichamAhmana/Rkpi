$file = 'c:\Users\Hicham\Rkpi\frontend\src\pages\GlpiDashboard.tsx'
$content = Get-Content $file -Raw -Encoding UTF8
# Chart axis/label font sizes
$content = $content -replace "fontSize: '11px'", "fontSize: '13px'"
$content = $content -replace "fontSize: '12px'", "fontSize: '14px'"
$content = $content -replace "fontSize: '13px'", "fontSize: '15px'"
$content = $content -replace "fontSize: '16px'", "fontSize: '18px'"
[System.IO.File]::WriteAllText($file, $content, [System.Text.UTF8Encoding]::new($false))
Write-Host "Done."
