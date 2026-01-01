Write-Host "⚠️ 주의: 로컬 파일이 웹 버전으로 덮어씌워집니다. Git 커밋을 먼저 하셨나요?" -ForegroundColor Yellow

# 현재 폴더 안의 모든 하위 폴더를 가져옵니다.
Get-ChildItem -Directory | ForEach-Object {
    $folderPath = $_.FullName
    
    # .clasp.json 파일이 있는지 확인 (GAS 프로젝트 폴더인지 확인)
    if (Test-Path "$folderPath\.clasp.json") {
        Write-Host "⬇️ 다운로드 시작 (Pull): $($_.Name)" -ForegroundColor Cyan
        
        # 해당 폴더로 이동
        Push-Location $folderPath
        
        # clasp pull 실행
        clasp pull
        
        # 원래 폴더로 복귀
        Pop-Location
        
        Write-Host "✅ 완료: $($_.Name)" -ForegroundColor Green
        Write-Host "--------------------------------"
    }
}