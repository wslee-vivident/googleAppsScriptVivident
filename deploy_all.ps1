# deploy_all.ps1
# 현재 폴더 하위의 모든 GAS 프로젝트를 찾아서 clasp push를 실행합니다.

$rootDir = Get-Location
$successCount = 0
$failCount = 0
$failedProjects = @()

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "   Google Apps Script 일괄 배포 시작" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# 1. 하위 폴더 검색
$subDirs = Get-ChildItem -Directory

foreach ($dir in $subDirs) {
    $claspConfig = Join-Path $dir.FullName ".clasp.json"

    # .clasp.json 파일이 있는 경우에만 실행 (GAS 프로젝트로 인식)
    if (Test-Path $claspConfig) {
        Write-Host "📂 프로젝트 발견: $($dir.Name)" -ForegroundColor Yellow
        
        # 해당 폴더로 이동
        Push-Location $dir.FullName

        try {
            # clasp push 실행 (강제 옵션 포함)
            # cmd /c를 사용하여 exit code를 확실하게 잡음
            cmd /c "clasp push --force"
            
            # $LASTEXITCODE: 0이면 성공, 아니면 에러
            if ($LASTEXITCODE -eq 0) {
                Write-Host "✅ [$($dir.Name)] 배포 성공!" -ForegroundColor Green
                $successCount++
            }
            else {
                throw "Clasp returned error code"
            }
        }
        catch {
            Write-Host "❌ [$($dir.Name)] 배포 실패!" -ForegroundColor Red
            $failCount++
            $failedProjects += $dir.Name
        }

        # 다시 원래 폴더로 복귀
        Pop-Location
        Write-Host "------------------------------------------"
    }
}

# 2. 결과 요약 출력
Write-Host ""
Write-Host "============== [ 결과 요약 ] ==============" -ForegroundColor Cyan
Write-Host "성공: $successCount 개" -ForegroundColor Green
Write-Host "실패: $failCount 개" -ForegroundColor Red

if ($failCount -gt 0) {
    Write-Host "⚠️  실패한 프로젝트 목록:" -ForegroundColor Red
    foreach ($p in $failedProjects) {
        Write-Host " - $p" -ForegroundColor Red
    }
} else {
    Write-Host "🎉 모든 프로젝트가 성공적으로 배포되었습니다!" -ForegroundColor Green
}
Write-Host "==========================================" -ForegroundColor Cyan