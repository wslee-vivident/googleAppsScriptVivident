# deploy_all.ps1

$rootDir = Get-Location
$successCount = 0
$failCount = 0
$failedProjects = @()

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "   Google Apps Script Deploy" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# 1. search for subdirectories
$subDirs = Get-ChildItem -Directory

foreach ($dir in $subDirs) {
    $claspConfig = Join-Path $dir.FullName ".clasp.json"

    # .clasp.json check
    if (Test-Path $claspConfig) {
        Write-Host "📂 Discoverd: $($dir.Name)" -ForegroundColor Yellow
        
        # move to the target folder
        Push-Location $dir.FullName

        try {
            # clasp push
            # using cmd /c to ensure proper exit code capture
            cmd /c "clasp push --force"
            
            # $LASTEXITCODE: 0 -> success, else -> fail
            if ($LASTEXITCODE -eq 0) {
                Write-Host "✅ [$($dir.Name)] Deploy Success!" -ForegroundColor Green
                $successCount++
            }
            else {
                throw "Clasp returned error code"
            }
        }
        catch {
            Write-Host "❌ [$($dir.Name)] Deploy Failed!" -ForegroundColor Red
            $failCount++
            $failedProjects += $dir.Name
        }

        # go back to the original folder
        Pop-Location
        Write-Host "------------------------------------------"
    }
}

# 2. result summary
Write-Host ""
Write-Host "============== [ Result Summary ] ==============" -ForegroundColor Cyan
Write-Host "Success: $successCount" -ForegroundColor Green
Write-Host "Fail: $failCount" -ForegroundColor Red

if ($failCount -gt 0) {
    Write-Host "⚠️  Failed Project:" -ForegroundColor Red
    foreach ($p in $failedProjects) {
        Write-Host " - $p" -ForegroundColor Red
    }
} else {
    Write-Host "🎉 All project has been deployed!" -ForegroundColor Green
}
Write-Host "==========================================" -ForegroundColor Cyan