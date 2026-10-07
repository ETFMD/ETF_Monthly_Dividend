"""
ETF 1좌당 과세표준액 — 운용사별 공개 자료 (scripts/update_etfdiv.py 에서 사용 · 표준 라이브러리만)

  운용사(브랜드)       자료                                                          종목 매칭
  삼성(KODEX) ....... samsungfund.com /api/v1/kodex/divid-info.do (taxDividA)        종목코드 → 펀드 id (분배금 현황 목록)
  미래에셋(TIGER) ... investments.miraeasset.com 분배금 현황 list.ajax (월별 전 종목)   종목코드가 표에 있음 · 해외 서버 차단 → 카운터 Worker 중계(/relay)
  한국투자(ACE) ..... papi.aceetf.co.kr /api/funds/{펀드코드}/dividend (tax_PRI)       ISIN → 펀드코드 (/api/funds 목록)
  신한(SOL) ......... soletf.com /api/etf/pds/dividend/{펀드코드} (WEEK_PRI)           종목코드 → 펀드코드 (/api/etf/pds 목록)
  한화(PLUS) ........ plusetf.co.kr /api/v1/product/dividend/list?n= (taxBase)       상품 번호 n → 상품명 (상세 페이지 제목)
  키움(KIWOOM) ...... kiwoometf.com 상품 상세 KO02010200M?gcode=종목코드 (분배금 표)    종목코드 그대로
반환: {종목코드: [[기준일 'YYYY-MM-DD', 분배금, 주당 과세표준액], ...]}  · 실패한 종목은 빠짐 (호출한 쪽이 직전 값 유지)
"""
import json, re, ssl, sys, time, urllib.parse, urllib.request, concurrent.futures as cf

UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
# 키움 사이트는 중간 인증서를 보내지 않아 검증에 실패함 — 공개 분배금 숫자만 읽는 이 한 곳에서만 검증을 끔
_KIWOOM_CTX = ssl.create_default_context(); _KIWOOM_CTX.check_hostname = False; _KIWOOM_CTX.verify_mode = ssl.CERT_NONE


def _get(url, data=None, headers=None, ctx=None, tries=2, timeout=25, as_json=False):
    err = None
    for i in range(tries):
        try:
            h = {'User-Agent': UA, 'Accept': 'application/json, text/html, */*', 'Accept-Language': 'ko-KR,ko;q=0.9', **(headers or {})}
            body = data
            if isinstance(data, dict):
                body = urllib.parse.urlencode(data).encode(); h['Content-Type'] = 'application/x-www-form-urlencoded; charset=UTF-8'
            with urllib.request.urlopen(urllib.request.Request(url, data=body, headers=h), timeout=timeout, context=ctx) as r:
                b = r.read()
            t = b.decode('utf-8', 'replace')
            return json.loads(t) if as_json else t
        except Exception as e:
            err = e; time.sleep(1.2 * (i + 1))
    raise err


def _ymd(s):
    s = re.sub(r'[^0-9]', '', str(s or ''))
    return '%s-%s-%s' % (s[:4], s[4:6], s[6:8]) if len(s) == 8 else None


def _num(v):
    try: return float(str(v).replace(',', '').replace('원', '').strip())
    except Exception: return None


def _norm(n): return re.sub(r'[\s()·&;\-_.]|amp', '', (n or '')).upper()


def _pool(fn, items, n=6):
    out = {}
    with cf.ThreadPoolExecutor(n) as ex:
        for k, v in ex.map(fn, items):
            if v is not None: out[k] = v
    return out


# ───── 삼성 KODEX ─────
def kodex(tickers, cache):
    H = {'Referer': 'https://www.samsungfund.com/etf/product/distribution.do', 'Accept': 'application/json'}
    fid = cache.setdefault('kodexFid', {})
    if any(t not in fid for t in tickers):
        for pg in range(1, 30):
            try: lst = (_get('https://www.samsungfund.com/api/v1/kodex/distribution.do?pageNo=%d' % pg, headers=H, as_json=True) or {}).get('dividList') or []
            except Exception: break
            for x in lst:
                if x.get('stkTicker') and x.get('fid'): fid[x['stkTicker']] = x['fid']
            if not lst or all(t in fid for t in tickers): break
    def one(t):
        if t not in fid: return t, None
        try:
            d = _get('https://www.samsungfund.com/api/v1/kodex/divid-info.do?id=' + fid[t], headers=H, as_json=True)
            return t, [[_ymd(x.get('basicD')), _num(x.get('dividA')), _num(x.get('taxDividA'))] for x in d.get('dividList') or []
                       if _ymd(x.get('basicD')) and x.get('taxDividA') not in (None, '')]
        except Exception: return t, None
    return _pool(one, tickers)


# ───── 미래에셋 TIGER (월별 전 종목 표 · Worker 중계) ─────
def tiger(tickers, months, relay):
    if not relay: return {}
    out, want = {}, set(tickers)
    for y, m in months:
        for pg in range(1, 8):
            u = ('https://investments.miraeasset.com/tigeretf/ko/distribution/overall/list.ajax?pageIndex=%d&firstIndex=%d&listCnt=20'
                 '&orderC=&orderType=&q=&selectYear=%d&selectMonth=%d&orderB=' % (pg, (pg - 1) * 20, y, m))
            try: h = _get(relay.rstrip('/') + '/relay?u=' + urllib.parse.quote(u, safe=''), headers={'Accept': 'text/html'}, timeout=40)
            except Exception as e:
                print('TIGER 과세표준 실패:', e, file=sys.stderr); break
            rows = re.findall(r'<tr[^>]*data-tot-cnt="(\d+)"[^>]*>(.*?)</tr>', h, re.S)
            for tot, r in rows:
                code = re.search(r'<p class="code">\((\w{6})\)</p>', r)
                tds = [re.sub(r'<[^>]+>', ' ', x).strip() for x in re.findall(r'<td[^>]*>(.*?)</td>', r, re.S)]
                if not code or len(tds) < 7: continue
                t = code.group(1)
                if t in want and _ymd(tds[2]):
                    out.setdefault(t, []).append([_ymd(tds[2]), _num(tds[4]), _num(tds[5])])
            if not rows or pg * 20 >= int(rows[0][0]): break
    return out


# ───── 한국투자 ACE ─────
def ace(tickers, cache):
    B, H = 'https://papi.aceetf.co.kr', {'Origin': 'https://www.aceetf.co.kr', 'Referer': 'https://www.aceetf.co.kr/'}
    fc = cache.setdefault('aceFund', {})
    if any(t not in fc for t in tickers):
        try:
            for x in _get(B + '/api/funds?page=1&size=1000', headers=H, as_json=True).get('data') or []:
                if x.get('stockCd') and x.get('fundCd'): fc[x['stockCd'][3:9]] = x['fundCd']
        except Exception as e: print('ACE 목록 실패:', e, file=sys.stderr)
    def one(t):
        if t not in fc: return t, None
        try:
            d = _get(B + '/api/funds/%s/dividend?page=1&size=12' % fc[t], headers=H, as_json=True)
            return t, [[_ymd(x.get('std_DT')), _num(x.get('dividend_PRI')), _num(x.get('tax_PRI'))] for x in d.get('dividendList') or []
                       if _ymd(x.get('std_DT')) and x.get('tax_PRI') is not None]
        except Exception: return t, None
    return _pool(one, tickers)


# ───── 신한 SOL ─────
def sol(tickers, cache):
    fc = cache.setdefault('solFund', {})
    if any(t not in fc for t in tickers):
        for pg in range(1, 15):
            try: d = _get('https://www.soletf.com/api/etf/pds?page=%d' % pg, as_json=True)
            except Exception: break
            for x in d.get('items') or []:
                if x.get('ETF_CD6') and x.get('FUND_CD'): fc[x['ETF_CD6']] = x['FUND_CD']
            if pg >= (d.get('toalPage') or d.get('totalPage') or 1): break
    def one(t):
        if t not in fc: return t, None
        try:
            d = _get('https://www.soletf.com/api/etf/pds/dividend/' + fc[t], as_json=True)
            return t, [[_ymd(x.get('WORK_DT')), _num(x.get('DIVIDEND_PRI')), _num(x.get('WEEK_PRI'))] for x in (d.get('items') or [])[:12]
                       if _ymd(x.get('WORK_DT')) and x.get('WEEK_PRI') is not None]
        except Exception: return t, None
    return _pool(one, tickers)


# ───── 한화 PLUS ─────
def plus(tickers, names, cache):
    """names: 종목코드 → 네이버 종목명 · 상품 번호(n)는 상세 페이지 제목으로 찾아 기억 (새 번호만 하루 한 번 훑음)"""
    nmap = cache.setdefault('plusN', {})                 # 정규화 이름 → n
    seen = set(cache.setdefault('plusSeen', []))          # 이미 확인한 상품 번호
    want = {t: _norm(names.get(t)) for t in tickers}
    if any(v not in nmap for v in want.values()):
        known = [int(n) for n in nmap.values()]
        top = max(known + [6420]) + 60
        todo = [n for n in range(6170, top) if n not in seen]
        if not todo and cache.get('plusScan') != time.strftime('%Y-%m-%d'):     # 다 봤는데도 없으면 하루 한 번 최근 번호를 다시 봄
            cache['plusScan'] = time.strftime('%Y-%m-%d')
            seen = {n for n in seen if n < max(known + [6420]) - 40}; todo = [n for n in range(6170, top) if n not in seen]
        def title(n):
            try:
                h = _get('https://www.plusetf.co.kr/product/detail?n=%06d' % n, tries=2, timeout=20)
                m = re.search(r'<title>(.*?) \| PLUS ETF</title>', h)
                return n, (m.group(1).replace('&amp;', '&') if m else '')
            except Exception: return n, None                # 실패 → 다음 실행에서 다시
        deadline = time.time() + 90                         # 한 번 실행에 90초까지만 (나머지는 다음 실행)
        ex = cf.ThreadPoolExecutor(4)
        futs = [ex.submit(title, n) for n in todo[:120]]
        for f in futs:
            try: n, nm = f.result(timeout=max(0.1, deadline - time.time()))
            except Exception: continue
            if nm is None: continue
            seen.add(n)
            if nm: nmap[_norm(nm)] = '%06d' % n
        ex.shutdown(wait=False, cancel_futures=True)
        cache['plusSeen'] = sorted(seen)
    def one(t):
        n = nmap.get(want[t])
        if not n: return t, None
        try:
            d = _get('https://www.plusetf.co.kr/api/v1/product/dividend/list?n=%s&page=0' % n, as_json=True, tries=3)
            return t, [[_ymd(x.get('wkdate')), _num(x.get('dividend')), _num(x.get('taxBase'))] for x in d.get('content') or []
                       if _ymd(x.get('wkdate')) and x.get('taxBase') not in (None, '')]
        except Exception: return t, None
    return _pool(one, tickers, 3)


# ───── 키움 KIWOOM ─────
def kiwoom(tickers):
    def one(t):
        try:
            h = _get('https://www.kiwoometf.com/service/etf/KO02010200M?gcode=' + t, ctx=_KIWOOM_CTX, timeout=30)
            i = h.find('주당과세표준액')
            if i < 0: return t, None
            body = h[i:h.find('</tbody>', i)]
            res = []
            for r in re.findall(r'<tr>(.*?)</tr>', body, re.S):
                tds = [re.sub(r'<[^>]+>', '', x).strip() for x in re.findall(r'<td[^>]*>(.*?)</td>', r, re.S)]
                if len(tds) >= 5 and _ymd(tds[0]): res.append([_ymd(tds[0]), _num(tds[2]), _num(tds[4])])
            return t, res[:12]
        except Exception: return t, None
    return _pool(one, tickers, 4)


BRANDS = ('KODEX', 'TIGER', 'ACE', 'SOL', 'PLUS', 'KIWOOM')


def collect(by_brand, names, months, relay, cache):
    """by_brand: {'KODEX': [종목코드...], ...} → {종목코드: [[기준일, 분배금, 과세표준], ...]}"""
    out = {}
    jobs = {'KODEX': lambda L: kodex(L, cache), 'TIGER': lambda L: tiger(L, months, relay), 'ACE': lambda L: ace(L, cache),
            'SOL': lambda L: sol(L, cache), 'PLUS': lambda L: plus(L, names, cache), 'KIWOOM': kiwoom}
    for b, L in by_brand.items():
        if not L or b not in jobs: continue
        try:
            r = jobs[b](sorted(set(L)))
            out.update(r)
            print('과세표준 %s: %d/%d종목' % (b, len(r), len(set(L))))
        except Exception as e:
            print('과세표준 %s 실패: %s' % (b, e), file=sys.stderr)
    return out
