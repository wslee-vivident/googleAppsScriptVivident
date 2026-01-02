Write-Host "⚠️ caution: did you push your code in Git repository? code will be rewrote." -ForegroundColor Yellow

# search for subdirectories
Get-ChildItem -Directory | ForEach-Object {
    $folderPath = $_.FullName
    
    # .clasp.json File Check
    if (Test-Path "$folderPath\.clasp.json") {
        Write-Host "⬇️ (Pull): $($_.Name)" -ForegroundColor Cyan
        
        # move to the target foler
        Push-Location $folderPath
        
        # clasp pull
        clasp pull
        
        # move back to the original folder
        Pop-Location
        
        Write-Host "✅ Complete: $($_.Name)" -ForegroundColor Green
        Write-Host "--------------------------------"
    }
}