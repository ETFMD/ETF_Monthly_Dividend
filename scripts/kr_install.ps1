# 디코딩 자본주의 한국 수집기 설치 (Windows · 관리자 권한 필요 없음 · PC 여러 대에 각각 설치 가능)
#   설치:  PowerShell 에서  $env:KR_TOKEN='열쇠'; irm https://raw.githubusercontent.com/ETFMD/d-capitalism/main/scripts/kr_install.ps1 | iex
#   삭제:  $env:KR_REMOVE='1'; irm https://raw.githubusercontent.com/ETFMD/d-capitalism/main/scripts/kr_install.ps1 | iex
# 하는 일: %LOCALAPPDATA%\kr-agent 에 열쇠와 실행 파일(run.ps1)을 두고, 5분마다 창 없이 실행하는 예약 작업 'DCapitalism-KR-Agent' 등록
$ErrorActionPreference = 'Stop'
$Task = 'DCapitalism-KR-Agent'
$Dir  = Join-Path $env:LOCALAPPDATA 'kr-agent'

if ($env:KR_REMOVE -eq '1') {
  Unregister-ScheduledTask -TaskName $Task -Confirm:$false -ErrorAction SilentlyContinue
  Remove-Item $Dir -Recurse -Force -ErrorAction SilentlyContinue
  Remove-Item Env:\KR_REMOVE -ErrorAction SilentlyContinue
  Write-Host '한국 수집기를 삭제했습니다.' -ForegroundColor Green
  return
}
if (-not $env:KR_TOKEN) { Write-Host '열쇠(KR_TOKEN)가 없습니다. 안내받은 명령어 전체를 붙여 넣어 주세요.' -ForegroundColor Red; return }

New-Item -ItemType Directory -Force -Path $Dir | Out-Null
Set-Content -Path (Join-Path $Dir 'token.txt') -Value $env:KR_TOKEN.Trim() -Encoding ASCII -NoNewline
Remove-Item Env:\KR_TOKEN -ErrorAction SilentlyContinue

# run.ps1: 실행할 때마다 저장소의 최신 수집기를 받아 실행하고 기록은 log.txt 에 (최근 200줄만)
$run = @'
$ErrorActionPreference = 'Continue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$d = Join-Path $env:LOCALAPPDATA 'kr-agent'; $log = Join-Path $d 'log.txt'; $f = Join-Path $d 'kr_agent.ps1'
try {
  (New-Object Net.WebClient).DownloadFile('https://raw.githubusercontent.com/ETFMD/d-capitalism/main/scripts/kr_agent.ps1?' + [DateTime]::UtcNow.Ticks, $f)
  $out = & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $f 2>&1 | Out-String
} catch { $out = 'ERROR ' + $_.Exception.Message }
$lines = @(); if (Test-Path $log) { $lines = @(Get-Content $log -Tail 199 -Encoding UTF8) }
$lines += ('{0:yyyy-MM-dd HH:mm:ss} {1}' -f (Get-Date), $out.Trim())
Set-Content -Path $log -Value $lines -Encoding UTF8
'@
Set-Content -Path (Join-Path $Dir 'run.ps1') -Value $run -Encoding UTF8

$ps  = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$arg = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$(Join-Path $Dir 'run.ps1')`""
$con = Join-Path $env:SystemRoot 'System32\conhost.exe'
# conhost --headless: 창이 잠깐도 뜨지 않게 (지원하지 않는 옛 Windows 면 powershell 을 바로 실행)
$build = [Environment]::OSVersion.Version.Build
if ((Test-Path $con) -and $build -ge 18362) { $act = New-ScheduledTaskAction -Execute $con -Argument "--headless `"$ps`" $arg" }
else { $act = New-ScheduledTaskAction -Execute $ps -Argument $arg }
$trg = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 5)
$set = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -MultipleInstances IgnoreNew `
       -ExecutionTimeLimit (New-TimeSpan -Minutes 4)
Register-ScheduledTask -TaskName $Task -Action $act -Trigger $trg -Settings $set -Description '디코딩 자본주의: RISE 공개 분배금 자료를 5분마다 받아 사이트에 올림' -Force | Out-Null

# 바로 한 번 실행해 연결 확인
& $ps -NoProfile -ExecutionPolicy Bypass -File (Join-Path $Dir 'run.ps1')
Write-Host ''
Write-Host '한국 수집기 설치 완료 — 5분마다 자동 실행됩니다.' -ForegroundColor Green
Write-Host ('마지막 기록: ' + (Get-Content (Join-Path $Dir 'log.txt') -Tail 1 -Encoding UTF8))
