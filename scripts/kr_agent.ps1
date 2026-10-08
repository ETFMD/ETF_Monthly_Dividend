# 디코딩 자본주의 한국 수집기 (Windows PowerShell 5.1 이상 · 추가 설치 없음)
# RISE 처럼 해외 접속을 막는 운용사 사이트의 공개 분배금 페이지를 한국 IP 로 받아 카운터 Worker(/kr)에 올립니다.
# PC 의 예약 작업(5분마다)이 실행할 때마다 저장소에서 이 파일을 새로 받아 쓰므로, 수정은 저장소에만 하면 됩니다.
#   1) GET  {Worker}/kr/jobs?k=열쇠&a=PC이름 → 받아야 할 주소 (허용된 운용사 주소만 · 여러 PC 가 나눠 받음)
#   2) 각 주소를 받아  3) POST {Worker}/kr/put?k=열쇠 → [{u, st, v}]
$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
Add-Type -AssemblyName System.Net.Http

$E   = 'https://etfmd-counter.gusrudgma.workers.dev'
$Dir = Join-Path $env:LOCALAPPDATA 'kr-agent'
$K   = (Get-Content (Join-Path $Dir 'token.txt') -Raw).Trim()
$sha = [Security.Cryptography.SHA256]::Create()
$Id  = -join ($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($env:COMPUTERNAME + '|' + $env:USERNAME))[0..4] | ForEach-Object { $_.ToString('x2') })
$UA  = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
$End = (Get-Date).AddSeconds(240)

$h = New-Object System.Net.Http.HttpClientHandler
$h.AllowAutoRedirect = $true
$h.AutomaticDecompression = [System.Net.DecompressionMethods]::GZip -bor [System.Net.DecompressionMethods]::Deflate
$c = New-Object System.Net.Http.HttpClient($h)
$c.Timeout = [TimeSpan]::FromSeconds(40)

function Fetch([string]$u) {
  try {
    $q = New-Object System.Net.Http.HttpRequestMessage([System.Net.Http.HttpMethod]::Get, $u)
    $o = ([Uri]$u).GetLeftPart([UriPartial]::Authority) + '/'
    [void]$q.Headers.TryAddWithoutValidation('User-Agent', $UA)
    [void]$q.Headers.TryAddWithoutValidation('Accept', 'text/html,application/json,*/*;q=0.8')
    [void]$q.Headers.TryAddWithoutValidation('Accept-Language', 'ko-KR,ko;q=0.9')
    [void]$q.Headers.TryAddWithoutValidation('Referer', $o)
    $r = $c.SendAsync($q).GetAwaiter().GetResult()
    $b = $r.Content.ReadAsByteArrayAsync().GetAwaiter().GetResult()
    return @([int]$r.StatusCode, [Text.Encoding]::UTF8.GetString($b))
  } catch { return @(0, ('ERROR ' + $_.Exception.GetBaseException().Message)) }
}

function Put($item) {
  $json = ConvertTo-Json -InputObject @($item) -Compress -Depth 3
  $body = New-Object System.Net.Http.StringContent($json, [Text.Encoding]::UTF8, 'application/json')
  [void]$c.PostAsync("$E/kr/put?k=$K", $body).GetAwaiter().GetResult()
}

# 절전 중에도 1시간마다 PC 를 깨워 수집하는 예약 작업 (사용자가 요청 · 없거나 옛 버전이면 이 PC 에 등록)
#   전원 연결 시에만 깨움(배터리 사용 중인 노트북은 깨우지 않음) · 깨어난 뒤 30초 기다려 네트워크 연결 후 실행
$Info = 'wake-none'
try {
  $WT = 'DCapitalism-KR-Agent-Wake'; $WV = 'wake-v1'
  $old = Get-ScheduledTask -TaskName $WT -ErrorAction SilentlyContinue
  if (-not $old -or $old.Description -notlike "*$WV*") {
    $ps  = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
    $run = Join-Path $Dir 'run.ps1'
    $arg = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -Command `"Start-Sleep -Seconds 30; & '$run'`""
    $con = Join-Path $env:SystemRoot 'System32\conhost.exe'
    if ((Test-Path $con) -and [Environment]::OSVersion.Version.Build -ge 18362) { $act = New-ScheduledTaskAction -Execute $con -Argument "--headless `"$ps`" $arg" }
    else { $act = New-ScheduledTaskAction -Execute $ps -Argument $arg }
    $trg = New-ScheduledTaskTrigger -Once -At ((Get-Date).Date.AddHours((Get-Date).Hour + 1).AddMinutes(7)) -RepetitionInterval (New-TimeSpan -Hours 1)
    $set = New-ScheduledTaskSettingsSet -WakeToRun -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 6)
    Register-ScheduledTask -TaskName $WT -Action $act -Trigger $trg -Settings $set -Description "디코딩 자본주의: 절전 중이면 1시간마다 PC 를 깨워 RISE 등 공개 분배금 자료 수집 ($WV)" -Force | Out-Null
    'wake task registered'
  }
  $t = Get-ScheduledTask -TaskName $WT -ErrorAction SilentlyContinue
  if ($t) { $Info = $WV + $(if ($t.Settings.WakeToRun) { '-on' } else { '-off' }) }
} catch { $Info = 'wake-err'; 'wake task error: ' + $_.Exception.Message }

# 수집하는 동안 절전으로 다시 들어가지 않게 (끝나면 자동 해제)
try {
  Add-Type -Namespace KrAgent -Name Power -MemberDefinition '[DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint f);'
  [void][KrAgent.Power]::SetThreadExecutionState([uint32]2147483649)   # ES_CONTINUOUS | ES_SYSTEM_REQUIRED
} catch { }

$jobs = $c.GetStringAsync("$E/kr/jobs?k=$K&a=$Id&i=$Info").GetAwaiter().GetResult() | ConvertFrom-Json
$n = 0
foreach ($u in @($jobs.urls)) {
  if (-not $u -or (Get-Date) -gt $End) { continue }
  $st, $v = Fetch $u
  if ($v.Length -gt 1500000) { $v = $v.Substring(0, 1500000) }
  Put ([pscustomobject]@{ u = $u; st = $st; v = $v })
  $n++
  Start-Sleep -Milliseconds 700
}
"got {1} at {0:yyyy-MM-dd HH:mm:ss}" -f (Get-Date), $n
