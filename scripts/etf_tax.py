"""
ETF 1좌당 과세표준액 — 운용사별 공개 자료 (scripts/update_etfdiv.py 에서 사용 · 표준 라이브러리만)

  운용사(브랜드)       자료                                                          종목 매칭
  삼성(KODEX) ....... samsungfund.com /api/v1/kodex/divid-info.do (taxDividA)        종목코드 → 펀드 id (분배금 현황 목록)
  미래에셋(TIGER) ... investments.miraeasset.com 분배금 현황 list.ajax (월별 전 종목)   종목코드가 표에 있음 · 해외 서버 차단 → 카운터 Worker 중계(/relay)
  한국투자(ACE) ..... papi.aceetf.co.kr /api/funds/{펀드코드}/dividend (tax_PRI)       ISIN → 펀드코드 (/api/funds 목록)
  신한(SOL) ......... soletf.com /api/etf/pds/dividend/{펀드코드} (WEEK_PRI)           종목코드 → 펀드코드 (/api/etf/pds 목록)
  한화(PLUS) ........ plusetf.co.kr /api/v1/product/dividend/list?n= (taxBase)       상품 번호 n ↔ 공시 (기준일, 분배금) 일치 · Worker 중계
  키움(KIWOOM) ...... kiwoometf.com 상품 상세 KO02010200M?gcode=종목코드 (분배금 표)    종목코드 그대로
  우리(WON) ......... wooriam.kr ETF 상세 '최근 3년 분배금 지급현황' 표                 상세 페이지 제목의 (종목코드)
  타임폴리오(TIME) .. timeetf.co.kr m11_view.php?idx= '최근 3년 분배금 지급현황' 표      상세 페이지 제목의 (종목코드)
  삼성액티브(KoAct)·그 밖 · 위에서 못 받은 종목 ... FunETF etfdividend (taxDividAmt)      ISIN (종목코드로 계산)
  KB(RISE) .......... kbam.co.kr /api/products/etfs/{상품코드}/dividend (tax_standard_amount)  종목명 → 상품코드 (/api/products/etfs/overview)
                      해외 접속 차단 → 한국 PC 수집기(scripts/kr_agent.ps1)가 받아 둔 것을 카운터 Worker(/kr)에서 읽음
  대신(DAISHIN) ..... asset.daishin.com 분배금 팝업 MD_divide.php (주당과세표준액)      상세 페이지의 [종목코드:A……] · 한국 PC 수집기 경유
    ※ HANARO·1Q·FOCUS 는 운용사 사이트(한국 IP 로도 확인)·FunETF 어디에도 과세표준이 없어, FunETF 에 올라오는 대로 자동 반영
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
def _via(url, relay):
    """해외 서버(GitHub Actions)에서 막히거나 느린 사이트는 카운터 Worker(/relay)로 받음"""
    return relay.rstrip('/') + '/relay?u=' + urllib.parse.quote(url, safe='') if relay else url


def plus(tickers, sig, cache, relay=None):
    """상품 번호(n) 찾기: 상세 페이지 대신 가벼운 분배금 목록 API를 번호별로 받아, 거래소 공시의 (기준일, 분배금) 기록과 2건 이상
    일치하는 번호를 그 종목으로 기억 · sig: 종목코드 → {(기준일, 분배금)} · 한 번 실행에 90초까지만 훑고 나머지는 다음 실행"""
    pmap = cache.setdefault('plusMap', {})                # 종목코드 → n
    seen = set(cache.setdefault('plusSeen', []))
    def fetch(n):
        try:
            d = _get(_via('https://www.plusetf.co.kr/api/v1/product/dividend/list?n=%06d&page=0' % n, relay), as_json=True, tries=2, timeout=30)
            return n, [[_ymd(x.get('wkdate')), _num(x.get('dividend')), _num(x.get('taxBase'))] for x in d.get('content') or [] if _ymd(x.get('wkdate'))]
        except Exception: return n, None
    lost = [t for t in tickers if t not in pmap and len(sig.get(t) or ()) >= 2]
    got = {}
    if lost:
        top = max([int(v) for v in pmap.values()] + [6420]) + 60
        todo = [n for n in range(6170, top) if n not in seen and '%06d' % n not in pmap.values()]
        if not todo and cache.get('plusScan') != time.strftime('%Y-%m-%d'):     # 다 봤는데 못 찾은 종목이 있으면 하루 한 번 다시
            cache['plusScan'] = time.strftime('%Y-%m-%d'); seen = set(); todo = [n for n in range(6170, top) if '%06d' % n not in pmap.values()]
        deadline = time.time() + 90
        ex = cf.ThreadPoolExecutor(6)
        futs = [ex.submit(fetch, n) for n in todo[:200]]
        for f in futs:
            try: n, rows = f.result(timeout=max(0.1, deadline - time.time()))
            except Exception: continue
            if rows is None: continue
            seen.add(n)
            have = {(r[0], r[1]) for r in rows}
            for t in lost:
                if t not in pmap and len(have & sig[t]) >= 2: pmap[t] = '%06d' % n; got[t] = rows[:12]
        ex.shutdown(wait=False, cancel_futures=True)
        cache['plusSeen'] = sorted(seen)
    rest = [t for t in tickers if t in pmap and t not in got]
    for n_, rows in _pool(lambda t: (t, fetch(int(pmap[t]))[1]), rest, 4).items(): got[n_] = rows[:12]
    return {t: [r for r in rows if r[2] is not None] for t, rows in got.items() if rows}


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


# ───── 우리 WON ─────
def _table(h, start):
    """start 뒤 첫 표에서 [기준일, 분배금, 과세표준] (열: 기준일 · 지급일 · 분배금 · 과세표준 …)"""
    i = h.find(start)
    if i < 0: return None
    body = h[i:h.find('</table>', i)]
    res = []
    for r in re.findall(r'<tr[^>]*>(.*?)</tr>', body, re.S):
        tds = [re.sub(r'<[^>]+>', '', x).strip() for x in re.findall(r'<td[^>]*>(.*?)</td>', r, re.S)]
        if len(tds) >= 4 and _ymd(tds[0]) and _num(tds[3]) is not None: res.append([_ymd(tds[0]), _num(tds[2]), _num(tds[3])])
    return res[:12]


def won(tickers, cache):
    B = 'https://www.wooriam.kr/investment/'
    ids = cache.setdefault('wonId', {})                  # 종목코드 → 상세 페이지 id
    pages = {}
    if any(t not in ids for t in tickers):
        try: lst = sorted(set(re.findall(r'etf-view/(\w+)', _get(B + 'etf-list'))))
        except Exception as e: print('WON 목록 실패:', e, file=sys.stderr); lst = []
        def view(i):
            try: return i, _get(B + 'etf-view/' + i)
            except Exception: return i, None
        for i, h in _pool(view, [i for i in lst if i not in ids.values()], 4).items():
            m = re.search(r'\((\w{6})\)', re.sub(r'<[^>]+>', ' ', h[h.find('<body'):]))
            if m: ids[m.group(1)] = i; pages[m.group(1)] = h
    def one(t):
        if t not in ids: return t, None
        try: return t, _table(pages.get(t) or _get(B + 'etf-view/' + ids[t]), 'id="popPayStatus"')
        except Exception: return t, None
    return _pool(one, tickers, 4)


# ───── 타임폴리오 TIME ─────
def time_(tickers, cache):
    B = 'https://timeetf.co.kr/'
    idx = cache.setdefault('timeIdx', {})                 # 종목코드 → 'idx&cate'
    pages = {}
    if any(t not in idx for t in tickers):
        cand = set()
        for c in ('001', '002', '003'):
            try: cand |= set(re.findall(r'm11_view\.php\?idx=(\d+)&(?:amp;)?cate=(\d+)', _get(B + 'm11_list.php?cate=' + c)))
            except Exception: pass
        cand |= {(str(i), c) for i in range(1, 41) for c in ('001', '002')}   # 목록에 안 보이는 상품까지
        def view(k):
            try: return k, _get(B + 'm11_view.php?idx=%s&cate=%s' % k, tries=1, timeout=15)
            except Exception: return k, None
        for k, h in _pool(view, sorted(c for c in cand if 'idx=%s&cate=%s' % c not in idx.values()), 6).items():
            m = re.search(r'TIME[^<>()]{0,60}\((\w{6})\)', h)
            if m and m.group(1) not in idx and 'moreList3' in h: idx[m.group(1)] = 'idx=%s&cate=%s' % k; pages[m.group(1)] = h
    def one(t):
        if t not in idx: return t, None
        try: return t, _table(pages.get(t) or _get(B + 'm11_view.php?' + idx[t]), 'moreList3')
        except Exception: return t, None
    return _pool(one, tickers, 4)


# ───── FunETF (삼성액티브 KoAct · 다른 곳에서 못 받은 종목) ─────
def _isin(t):
    s = 'KR7' + t + '00'
    d = ''.join(str(int(c, 36)) for c in s)
    tot = 0
    for i, ch in enumerate(reversed(d)):
        n = int(ch) * (2 if i % 2 == 0 else 1)
        tot += n // 10 + n % 10
    return s + str((10 - tot % 10) % 10)


def funetf(tickers):
    def one(t):
        try:
            d = _get('https://www.funetf.co.kr/api/public/product/view/etfdividend?itemId=' + _isin(t), as_json=True, timeout=20,
                     headers={'X-Requested-With': 'XMLHttpRequest', 'Referer': 'https://www.funetf.co.kr/product/etf/view/' + _isin(t)})
            return t, [[_ymd(x.get('basicDt')), _num(x.get('divAmt')), _num(x.get('taxDividAmt'))] for x in d or []
                       if _ymd(x.get('basicDt')) and x.get('taxDividAmt') is not None][:12]
        except Exception: return t, None
    return _pool(one, tickers, 4)


# ───── KB RISE (한국 PC 수집기가 받아 둔 응답 · Worker /kr) ─────
def _kr(url, relay, as_json=True):
    """Worker 에 저장된 응답 (없으면 None — 요청 표시만 남기고 다음 실행 때 읽음)"""
    q = urllib.request.Request(relay.rstrip('/') + '/kr?u=' + urllib.parse.quote(url, safe=''), headers={'User-Agent': UA})
    with urllib.request.urlopen(q, timeout=30) as r:
        if r.status != 200 or r.headers.get('X-KR-Status') != '200': return None
        t = r.read().decode('utf-8')
        return json.loads(t) if as_json else t


def rise(tickers, names, relay, cache):
    if not relay: return {}
    B = 'https://kbam.co.kr/api/products/etfs/'
    fc = cache.setdefault('riseFund', {})                 # 종목코드 → KB 상품코드
    if any(t not in fc for t in tickers):
        try:
            o, m = _kr(B + 'overview', relay), {}
            def walk(x):
                if isinstance(x, dict):
                    if x.get('fund_cd') and x.get('name'): m[_norm(x['name'])] = x['fund_cd']
                    for v in x.values(): walk(v)
                elif isinstance(x, list):
                    for v in x: walk(v)
            walk(o)
            for t in tickers:
                if _norm(names.get(t)) in m: fc[t] = m[_norm(names.get(t))]
        except Exception as e: print('RISE 목록 실패:', e, file=sys.stderr)
    def one(t):
        if t not in fc: return t, None
        try:
            d = _kr(B + fc[t] + '/dividend', relay)
            return t, d and [[_ymd(x.get('base_date')), _num(x.get('amount')), _num(x.get('tax_standard_amount'))] for x in (d.get('history') or [])[:12]
                              if _ymd(x.get('base_date')) and x.get('tax_standard_amount') is not None]
        except Exception: return t, None
    return _pool(one, tickers, 4)


# ───── 대신 DAISHIN (한국 PC 수집기 · Worker /kr) ─────
def daishin(tickers, relay, cache):
    if not relay: return {}
    B = 'https://asset.daishin.com/ko/'
    fc = cache.setdefault('daishinFund', {})              # 종목코드 → [FUND_CODE, DI_DATE]
    if any(t not in fc for t in tickers):
        try:
            lst = _kr(B + '?pages=etf&sub=etf5010', relay, False) or ''
            for code in sorted(set(re.findall(r"goview\('(\d+)'\)", lst))):
                if code in [v[0] for v in fc.values()]: continue
                h = _kr(B + '?pages=etf&sub=etf5010&m=view&FUND_CODE=' + code, relay, False) or ''
                m, d = re.search(r'종목코드\s*:\s*A(\w{6})', h), re.search(r"openDivide\('(\d+)',\s*'(\d{8})'\)", h)
                if m and d: fc[m.group(1)] = [d.group(1), d.group(2)]
        except Exception as e: print('DAISHIN 목록 실패:', e, file=sys.stderr)
    def one(t):
        if t not in fc: return t, None
        try:
            h = _kr(B + 'pages/etf/MD_divide.php?FUND_CODE=%s&DI_DATE=%s' % tuple(fc[t]), relay, False)
            if not h: return t, None
            res = {}
            for r in re.findall(r'<tr[^>]*>(.*?)</tr>', h, re.S):
                tds = [re.sub(r'<[^>]+>', '', x).strip() for x in re.findall(r'<td[^>]*>(.*?)</td>', r, re.S)]
                if len(tds) >= 4 and _ymd(tds[0]) and _num(tds[3]) is not None: res[_ymd(tds[0])] = [_ymd(tds[0]), _num(tds[2]), _num(tds[3])]
            return t, sorted(res.values(), reverse=True)[:12]
        except Exception: return t, None
    return _pool(one, tickers, 2)


# 과세표준을 찾아보는 브랜드 (HANARO·1Q·FOCUS 는 FunETF 에 올라오면 반영)
BRANDS = ('KODEX', 'TIGER', 'ACE', 'SOL', 'PLUS', 'KIWOOM', 'WON', 'TIME', 'KoAct', 'HANARO', '1Q', 'DAISHIN', 'FOCUS', 'RISE')


def collect(by_brand, names, months, relay, cache, sig=None):
    """by_brand: {'KODEX': [종목코드...], ...} → {종목코드: [[기준일, 분배금, 과세표준], ...]}"""
    out = {}
    jobs = {'KODEX': lambda L: kodex(L, cache), 'TIGER': lambda L: tiger(L, months, relay), 'ACE': lambda L: ace(L, cache),
            'SOL': lambda L: sol(L, cache), 'PLUS': lambda L: plus(L, sig or {}, cache, relay), 'KIWOOM': kiwoom,
            'WON': lambda L: won(L, cache), 'TIME': lambda L: time_(L, cache), 'RISE': lambda L: rise(L, names, relay, cache),
            'DAISHIN': lambda L: daishin(L, relay, cache)}
    for b, L in by_brand.items():
        if not L or b not in jobs: continue
        try:
            r = {t: v for t, v in jobs[b](sorted(set(L))).items() if v}
            out.update(r)
            print('과세표준 %s: %d/%d종목' % (b, len(r), len(set(L))))
        except Exception as e:
            print('과세표준 %s 실패: %s' % (b, e), file=sys.stderr)
    # 운용사 자료가 없거나 실패한 종목은 FunETF 로 한 번 더
    rest = sorted({t for L in by_brand.values() for t in L if t not in out})
    if rest:
        try:
            r = {t: v for t, v in funetf(rest).items() if v}
            out.update(r)
            print('과세표준 FunETF 보충: %d/%d종목' % (len(r), len(rest)))
        except Exception as e:
            print('과세표준 FunETF 실패: %s' % e, file=sys.stderr)
    return out
