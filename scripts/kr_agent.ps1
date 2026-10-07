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

$jobs = $c.GetStringAsync("$E/kr/jobs?k=$K&a=$Id").GetAwaiter().GetResult() | ConvertFrom-Json
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
