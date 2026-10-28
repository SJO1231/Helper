# 현재 사용자에게 Native host를 등록한다. 빌드는 이 스크립트를 부르지 않는다.
$ErrorActionPreference = 'Stop'
$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$identity = Get-Content -Raw -LiteralPath (Join-Path $PSScriptRoot 'extension-key.json') | ConvertFrom-Json
$hostName = 'com.helper.core'
$hostDirectory = Join-Path $repoRoot 'dist\host'
New-Item -ItemType Directory -Path $hostDirectory -Force | Out-Null

# Chrome은 .bat도 실행 파일로 받는다. 작업 폴더를 저장소 루트로 맞춰 `python -m`이 core를 찾게 한다.
$launcher = Join-Path $hostDirectory 'run-host.bat'
$batch = "@echo off`r`ncd /d `"$repoRoot`"`r`npython -m core.native_main`r`n"
[System.IO.File]::WriteAllText($launcher, $batch, [System.Text.ASCIIEncoding]::new())

$manifestPath = Join-Path $hostDirectory "$hostName.json"
$manifest = @{
    name = $hostName
    description = 'Helper local core'
    path = $launcher
    type = 'stdio'
    allowed_origins = @("chrome-extension://$($identity.id)/")
}
[System.IO.File]::WriteAllText($manifestPath, ($manifest | ConvertTo-Json -Depth 4), [System.Text.UTF8Encoding]::new($false))

# 설치 대상 Chrome과 시험용 Playwright Chromium 둘 다.
foreach ($browser in @('Google\Chrome', 'Chromium')) {
    $registryPath = "HKCU:\Software\$browser\NativeMessagingHosts\$hostName"
    New-Item -Path $registryPath -Force | Out-Null
    Set-Item -LiteralPath $registryPath -Value $manifestPath
}
Write-Output "Registered $hostName for Chrome and Chromium: $manifestPath"
