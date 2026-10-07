#!/usr/bin/env python3
"""
한국 수집기 — Oracle Cloud 서울 서버에서 5분마다 실행 (표준 라이브러리만)

RISE 처럼 해외 접속을 막는 운용사 사이트를 한국 IP 로 받아 카운터 Worker(/kr)에 올려 둡니다.
서버에는 이 파일을 두지 않고 실행할 때마다 저장소에서 새로 받아 쓰므로, 수정은 저장소에만 하면 됩니다.
  1) GET  {Worker}/kr/jobs?k=열쇠  → 받아야 할 주소 목록 (허용된 운용사 주소만 · Worker 가 관리)
  2) 각 주소를 받아서
  3) POST {Worker}/kr/put?k=열쇠  → [{u, st, v}]
환경 변수: KR_TOKEN (서버의 /etc/kr-agent.env)
"""
import json, os, sys, time, urllib.error, urllib.request

ENDPOINT = 'https://etfmd-counter.gusrudgma.workers.dev'
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
KEY = os.environ.get('KR_TOKEN', '').strip()
DEADLINE = time.time() + 240          # 5분 주기 안에 끝냄


def call(path, body=None):
    req = urllib.request.Request(ENDPOINT + path + ('&' if '?' in path else '?') + 'k=' + KEY,
                                 data=None if body is None else json.dumps(body).encode(),
                                 headers={'User-Agent': 'kr-agent/1', 'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode())


def fetch(u):
    origin = '/'.join(u.split('/')[:3]) + '/'
    req = urllib.request.Request(u, headers={'User-Agent': UA, 'Accept': 'text/html,application/json,*/*;q=0.8',
                                             'Accept-Language': 'ko-KR,ko;q=0.9', 'Referer': origin})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, r.read().decode('utf-8', 'replace')
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode('utf-8', 'replace')[:20000]
    except Exception as e:
        return 0, 'ERROR ' + str(e)


def main():
    if not KEY: sys.exit('KR_TOKEN 없음')
    urls = call('/kr/jobs').get('urls') or []
    out, size = [], 0
    for u in urls:
        if time.time() > DEADLINE: break
        st, v = fetch(u)
        out.append({'u': u, 'st': st, 'v': v[:1500000]}); size += len(v)
        if size > 4000000: call('/kr/put', out); out, size = [], 0
        time.sleep(0.7)
    if out: call('/kr/put', out)
    print(time.strftime('%F %T'), '받음', len(urls))


if __name__ == '__main__':
    main()
