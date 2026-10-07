#!/usr/bin/env python3
"""
ETF 월분배·배당 달력 — data/etfdiv.json (GitHub Actions '시세 데이터 갱신'에서 15분마다 함께 실행 · 표준 라이브러리만 사용)

자료
  · 국내 상장 ETF 전체·현재가 ............ 네이버 금융 ETF 목록
  · 월분배 종목 판별·분배 이력·분배율 ...... 네이버 금융 ETF 분배 이력 (하루 1번, 장 마감 뒤)
  · 확정 공시(기준일·지급일·분배금·공시 시각) KRX KIND 'ETF이익금분배신고(분배금안내)(일괄공시)' — 매 실행마다 새 공시만 읽음
  · 분배락일 ............................ KRX KIND 'ETF 분배락 기준가격 안내'(적용일) → 없으면 기준일 전 영업일로 계산
  · 주당 과세표준액 ...................... 운용사가 공개하는 경우만 (현재 삼성자산운용 KODEX)
원칙
  · 한 곳이 실패해도 직전에 저장된 값을 유지하고, 내용이 바뀌었을 때만 파일을 다시 씀
"""
import json, os, re, sys, time, datetime, http.cookiejar, urllib.request, urllib.parse, concurrent.futures as cf
from zoneinfo import ZoneInfo
KST = ZoneInfo('Asia/Seoul')
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data')
OUT = os.path.join(ROOT, 'etfdiv.json')
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
KIND = 'https://kind.krx.co.kr'
EVENT_KEEP_DAYS = 120          # 확정 공시 보관 기간 (지급일 기준)

# KRX 휴장일 (주말 제외) — 분배락 안내 공시가 나오면 그 날짜가 우선, 이 표는 미리 계산할 때만 사용
HOLIDAYS = set('''
2025-01-01 2025-01-27 2025-01-28 2025-01-29 2025-01-30 2025-03-03 2025-05-01 2025-05-05 2025-05-06 2025-06-03 2025-06-06
2025-08-15 2025-10-03 2025-10-06 2025-10-07 2025-10-08 2025-10-09 2025-12-25 2025-12-31
2026-01-01 2026-02-16 2026-02-17 2026-02-18 2026-03-02 2026-05-01 2026-05-05 2026-05-25 2026-06-03 2026-08-17
2026-09-24 2026-09-25 2026-10-05 2026-10-09 2026-12-25 2026-12-31
2027-01-01 2027-02-08 2027-02-09 2027-03-01 2027-05-05 2027-05-13 2027-08-16 2027-09-14 2027-09-15 2027-09-16
2027-10-04 2027-10-11 2027-12-27 2027-12-31
'''.split())

cj = http.cookiejar.CookieJar()
OP = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))

def http_get(url, data=None, headers=None, tries=3, timeout=30):
    if isinstance(data, dict): data = urllib.parse.urlencode(data).encode()
    err = None
    for i in range(tries):
        try:
            req = urllib.request.Request(url, data=data, headers={'User-Agent': UA, 'Accept': '*/*', **(headers or {})})
            with OP.open(req, timeout=timeout) as r: return r.read()
        except Exception as e:
            err = e; time.sleep(1.5 * (i + 1))
    raise err

def decode(b):
    m = re.search(rb'charset=["\']?([\w-]+)', b[:3000])
    return b.decode(m.group(1).decode() if m else 'utf-8', 'replace')

def load(path):
    try:
        with open(path, encoding='utf-8') as f: return json.load(f)
    except Exception: return None

def now_kst(): return datetime.datetime.now(KST)
def dstr(d): return d.isoformat()
def ddate(s): return datetime.date.fromisoformat(s)
def is_bday(d): return d.weekday() < 5 and dstr(d) not in HOLIDAYS
def prev_bday(d, n=1):
    while n:
        d -= datetime.timedelta(days=1)
        if is_bday(d): n -= 1
    return d
def next_bday(d):
    d += datetime.timedelta(days=1)
    while not is_bday(d): d += datetime.timedelta(days=1)
    return d
def clean(s): return re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', '', s).replace('&amp;', '&').replace('&nbsp;', ' ')).strip()
def norm(name): return re.sub(r'[\s()·\-_.]', '', name or '').upper()

# ───────────── 네이버 ─────────────
def naver_list():
    d = json.loads(http_get('https://finance.naver.com/api/sise/etfItemList.nhn?etfType=0&targetColumn=market_sum&sortOrder=desc').decode('euc-kr', 'replace'))
    return {x['itemcode']: {'n': x['itemname'], 'p': x.get('nowVal'), 'cap': x.get('marketSum')} for x in d['result']['etfItemList']}

def naver_basic(code):
    try:
        d = json.loads(http_get('https://m.stock.naver.com/api/etf/%s/basic' % code, tries=2, timeout=20))
        months = [int(x) for x in (d.get('dividendMonthsThisYear') or '').split(',') if x.strip().isdigit()]
        return code, {'months': months, 'ttm': d.get('dividendYieldTtm'), 'dps': d.get('dividendPerShareTtm'), 'iss': d.get('issuerName')}
    except Exception:
        return code, None

def naver_hist(code, n=13):
    try:
        d = json.loads(http_get('https://m.stock.naver.com/api/etf/%s/dividend/history?page=1&pageSize=%d&firstPageSize=%d' % (code, n, n), tries=2, timeout=20))
        out = []
        for x in d.get('result') or []:
            ex = (x.get('exDividendAt') or '').replace('.', '-')
            if re.match(r'^\d{4}-\d\d-\d\d$', ex) and x.get('dividendAmount') is not None:
                out.append([ex, x['dividendAmount'], x.get('dividendYield')])
        return code, {'h': out, 'total': d.get('totalCount')}
    except Exception:
        return code, None

def is_monthly(h, total, today):
    """최근 이력이 매달 이어지면 월분배 — 6개월 안에 서로 다른 4개월 이상, 또는 상장 초기(이력 전부가 100일 안)면 연속 2개월 이상"""
    if not h: return False
    exs = [ddate(x[0]) for x in h]
    recent = [d for d in exs if (today - d).days <= 190]
    months = sorted({(d.year, d.month) for d in recent})
    if (today - max(exs)).days > 70: return False
    if len(months) >= 4: return True
    young = (total or len(h)) == len(h) and all((today - d).days <= 100 for d in exs)
    if young and len(months) >= 2:
        idx = [y * 12 + m for y, m in months]
        return all(b - a == 1 for a, b in zip(idx, idx[1:]))
    return False

# ───────────── KIND ─────────────
def kind_search(keyword, frm, to, size=100, page=1):
    s = http_get(KIND + '/disclosure/details.do', {
        'method': 'searchDetailsSub', 'currentPageSize': str(size), 'pageIndex': str(page), 'orderMode': '1', 'orderStat': 'D',
        'forward': 'details_sub', 'reportNm': keyword, 'fromDate': frm, 'toDate': to, 'marketType': '', 'searchMode': '',
        'searchCodeType': '', 'chose': 'S', 'todayFlag': 'N', 'repIsuSrtCd': ''},
        {'Referer': KIND + '/disclosure/details.do?method=searchDetailsMain'}).decode('utf-8', 'replace')
    out = []
    for r in re.findall(r'<tr.*?</tr>', s, re.S):
        a = re.findall(r"openDisclsViewer\('(\d+)'", r)
        cells = [clean(x) for x in re.findall(r'<td[^>]*>(.*?)</td>', r, re.S)]
        if a and len(cells) >= 4: out.append({'acpt': a[0], 'time': cells[1], 'who': cells[2], 'title': cells[3]})
    return out

def kind_rows(acpt):
    v = http_get(KIND + '/common/disclsviewer.do?method=search&acptno=' + acpt).decode('utf-8', 'replace')
    m = re.search(r"<option value='(\d+)\|[YN]'", v)
    if not m: return []
    c = decode(http_get(KIND + '/common/disclsviewer.do?method=searchContents&docNo=' + m.group(1)))
    p = re.findall(r"""['"]((?:https?://[^'"]+)?/external/[^'"]+\.htm)['"]""", c)
    if not p: return []
    h = decode(http_get(p[0] if p[0].startswith('http') else KIND + p[0]))
    rows = []
    for tb in re.findall(r'<table.*?</table>', h, re.S | re.I):
        for r in re.findall(r'<tr.*?</tr>', tb, re.S | re.I):
            rows.append([clean(x) for x in re.findall(r'<t[dh][^>]*>(.*?)</t[dh]>', r, re.S | re.I)])
    return rows

def isin_ticker(isin): return isin[3:9] if re.match(r'^KR7[0-9A-Z]{9}$', isin or '') else None

# ───────────── KODEX 과세표준 ─────────────
def kodex_tax(tickers, old_map):
    """삼성자산운용 공개 API — 종목코드 → [(기준일, 분배금, 주당 과세표준액)]"""
    H = {'Referer': 'https://www.samsungfund.com/etf/product/distribution.do', 'Accept': 'application/json'}
    fid = dict(old_map or {})
    try:
        if any(t not in fid for t in tickers):
            for pg in range(1, 30):
                d = json.loads(http_get('https://www.samsungfund.com/api/v1/kodex/distribution.do?pageNo=%d' % pg, headers=H, tries=2))
                lst = d.get('dividList') or []
                for x in lst:
                    if x.get('stkTicker') and x.get('fid'): fid[x['stkTicker']] = x['fid']
                if not lst or all(t in fid for t in tickers): break
    except Exception as e:
        print('KODEX 목록 실패:', e, file=sys.stderr)
    out = {}
    def one(t):
        if t not in fid: return t, None
        try:
            d = json.loads(http_get('https://www.samsungfund.com/api/v1/kodex/divid-info.do?id=' + fid[t], headers=H, tries=2, timeout=20))
            res = []
            for x in d.get('dividList') or []:
                b = x.get('basicD') or ''
                if len(b) == 8 and x.get('taxDividA') not in (None, ''):
                    res.append(['%s-%s-%s' % (b[:4], b[4:6], b[6:]), x.get('dividA'), x.get('taxDividA')])
            return t, res
        except Exception:
            return t, None
    with cf.ThreadPoolExecutor(6) as ex:
        for t, r in ex.map(one, tickers):
            if r is not None: out[t] = r
    return out, fid

def to_num(s):
    try: return float(str(s).replace(',', ''))
    except Exception: return None

def main():
    t0 = time.time(); now = now_kst(); today = now.date()
    old = load(OUT) or {}
    data = {k: old.get(k) for k in ('etfs', 'events', 'seen', 'seenEx', 'exMap', 'universeDate', 'kodexFid', 'taxMap')}
    data['etfs'] = data['etfs'] or {}; data['events'] = data['events'] or []; data['seen'] = data['seen'] or []
    data['seenEx'] = data['seenEx'] or []; data['exMap'] = data['exMap'] or {}; data['taxMap'] = data['taxMap'] or {}

    # ① 전체 ETF 목록·현재가 (매번)
    try:
        lst = naver_list()
    except Exception as e:
        print('네이버 ETF 목록 실패:', e, file=sys.stderr); lst = None

    # ② 하루 한 번(16시 이후 또는 처음): 월분배 종목 판별 + 분배 이력
    daily = lst and (data.get('universeDate') != dstr(today) and (now.hour >= 16 or not data['etfs'])) or os.environ.get('ETFDIV_FULL') == '1'
    if daily:
        prev = set(data['etfs'])
        basics = {}
        with cf.ThreadPoolExecutor(8) as ex:
            for c, b in ex.map(naver_basic, list(lst)): basics[c] = b
        cand = [c for c, b in basics.items() if (b and len(b['months']) >= 2) or c in prev]
        hist = {}
        with cf.ThreadPoolExecutor(8) as ex:
            for c, h in ex.map(naver_hist, cand): hist[c] = h
        etfs = {}
        for c in cand:
            h, b = hist.get(c), basics.get(c)
            if h is None and c in prev: etfs[c] = data['etfs'][c]; continue          # 이력 받기 실패 → 직전 값 유지
            if not h or not is_monthly(h['h'], h['total'], today): continue
            o = data['etfs'].get(c, {})
            etfs[c] = {'n': lst.get(c, {}).get('n') or o.get('n'), 'iss': (b or {}).get('iss') or o.get('iss'),
                       'ttm': (b or {}).get('ttm', o.get('ttm')), 'dps': (b or {}).get('dps', o.get('dps')), 'h': h['h'][:12]}
        bad = sum(1 for b in basics.values() if b is None)
        if len(etfs) >= 50 and bad < len(basics) * 0.3:
            data['etfs'] = etfs; data['universeDate'] = dstr(today)
            print('월분배 ETF %d개 (후보 %d · 실패 %d)' % (len(etfs), len(cand), bad))
        else:
            print('월분배 판별 결과 이상 (%d개, 실패 %d) — 직전 목록 유지' % (len(etfs), bad), file=sys.stderr)
    if lst:
        for c, e in data['etfs'].items():
            if c in lst: e['p'] = lst[c]['p']; e['n'] = lst[c]['n']; e['cap'] = lst[c]['cap']
    for e in data['etfs'].values():                    # 이력의 최근 분배락일 → 기준일 (공시를 못 찾은 종목 표시용)
        e['lastRec'] = dstr(next_bday(ddate(e['h'][0][0]))) if e.get('h') else None

    # ③ KIND 확정 공시 (매번) — 새 공시만 내용 읽음, 정정 공시는 나중 것이 우선
    frm, to = dstr(today - datetime.timedelta(days=45)), dstr(today + datetime.timedelta(days=1))   # 월중(15일)·월말 두 주기를 모두 덮음
    seen = set(data['seen'])
    try:
        lst_ann = [x for x in kind_search('분배금', frm, to) if '분배금안내' in x['title'].replace(' ', '')]
        new = sorted([x for x in lst_ann if x['acpt'] not in seen], key=lambda x: x['time'])
        evs = {(e['t'], e['rec']): e for e in data['events']}
        for x in new:
            try:
                rows = kind_rows(x['acpt'])
            except Exception as e:
                print('KIND 공시 읽기 실패', x['acpt'], e, file=sys.stderr); continue
            hdr = next((r for r in rows if r and r[0] == '종목코드'), None)
            n_ok = 0
            for r in rows:
                t = isin_ticker(r[0] if r else '')
                if not t or len(r) < 5: continue
                rec, pay, amt = r[2], r[3], to_num(r[4])
                if not re.match(r'^\d{4}-\d\d-\d\d$', rec) or amt is None: continue
                key = (t, rec)
                e = evs.get(key, {})
                e.update({'t': t, 'n': r[1], 'rec': rec, 'pay': pay if re.match(r'^\d{4}-\d\d-\d\d$', pay) else None, 'amt': amt,
                          'ann': x['time'], 'acpt': x['acpt'], 'who': x['who'], 'fix': ('정정' in x['title']) or e.get('fix', False)})
                evs[key] = e; n_ok += 1
            seen.add(x['acpt'])
            print('KIND 분배금 공시 %s %s %s — %d종목' % (x['time'], x['who'], x['acpt'], n_ok))
        data['events'] = list(evs.values())
    except Exception as e:
        print('KIND 분배금 공시 검색 실패:', e, file=sys.stderr)

    # ④ 분배락 기준가격 안내 → 정확한 분배락일 (종목명으로 매칭)
    seen_ex = set(data['seenEx'])
    try:
        ex_ann = [x for x in kind_search('분배락 기준가격', dstr(today - datetime.timedelta(days=10)), to, size=200) if x['acpt'] not in seen_ex]
        def ex_one(x):
            try:
                rows = kind_rows(x['acpt'])
                kv = {r[0]: r[1] for r in rows if len(r) >= 2}
                name = next((v for k, v in kv.items() if '종목명' in k), None)
                day = next((v for k, v in kv.items() if '적용일' in k), None)
                return x['acpt'], name, day
            except Exception:
                return x['acpt'], None, None
        with cf.ThreadPoolExecutor(6) as ex:
            for acpt, name, day in ex.map(ex_one, ex_ann[:150]):
                if name and day and re.match(r'^\d{4}-\d\d-\d\d$', day):
                    data['exMap'].setdefault(norm(name), [])
                    if day not in data['exMap'][norm(name)]: data['exMap'][norm(name)].append(day)
                    seen_ex.add(acpt)
    except Exception as e:
        print('KIND 분배락 안내 검색 실패:', e, file=sys.stderr)

    # ⑤ 이벤트 정리: 분배락일·마지막 매수일 계산, 오래된 것 정리
    name_by_t = {c: e['n'] for c, e in data['etfs'].items()}
    keep = []
    for e in data['events']:
        if not e.get('rec'): continue
        rec = ddate(e['rec'])
        if (today - ddate(e.get('pay') or e['rec'])).days > EVENT_KEEP_DAYS: continue
        calc = prev_bday(rec)
        exact = None
        for nm in (e.get('n'), name_by_t.get(e['t'])):
            for d in data['exMap'].get(norm(nm), []):
                dd = ddate(d)
                if 0 < (rec - dd).days <= 7: exact = d
        e['ex'] = exact or dstr(calc); e['exSrc'] = 'krx' if exact else 'calc'
        e['buy'] = dstr(prev_bday(ddate(e['ex'])))
        keep.append(e)
    if data['etfs']: keep = [e for e in keep if e['t'] in data['etfs']]   # 월분배 종목만
    data['events'] = sorted(keep, key=lambda e: (e['rec'], e['t']))
    # 분배락 안내 표는 30일 지난 날짜 정리
    for k in list(data['exMap']):
        data['exMap'][k] = [d for d in data['exMap'][k] if (today - ddate(d)).days <= 30]
        if not data['exMap'][k]: del data['exMap'][k]

    # ⑥ KODEX 주당 과세표준액 — 하루 한 번 + 최근 10일 안 새 공시가 있는데 값이 없을 때
    kodex = [c for c, e in data['etfs'].items() if (e.get('n') or '').startswith('KODEX')]
    need = [e['t'] for e in data['events'] if e['t'] in kodex and (today - ddate(e['rec'])).days <= 10 and e.get('tax') is None]
    if kodex and (daily or need):
        tm, data['kodexFid'] = kodex_tax(kodex if daily else sorted(set(need)), data.get('kodexFid'))
        for t, lst_t in tm.items(): data['taxMap'][t] = lst_t
    for e in data['events']:
        for rec, amt, tax in data['taxMap'].get(e['t'], []):
            if rec == e['rec']: e['tax'] = to_num(tax)

    data['seen'] = sorted(seen)[-400:]; data['seenEx'] = sorted(seen_ex)[-1500:]
    data['kindChecked'] = now.strftime('%Y-%m-%dT%H:%M:%S+09:00')
    # 내용이 같으면 다시 쓰지 않음 (확인 시각만 다른 경우 제외)
    strip = lambda d: {k: v for k, v in d.items() if k not in ('updated', 'kindChecked')}
    if old and strip(old) == strip(data):
        print('변경 없음 (%.1f초)' % (time.time() - t0)); return
    data['updated'] = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
    with open(OUT, 'w', encoding='utf-8') as f: json.dump(data, f, ensure_ascii=False, separators=(',', ':'))
    print('저장: 월분배 %d개 · 확정 공시 %d건 (%.1f초)' % (len(data['etfs']), len(data['events']), time.time() - t0))

if __name__ == '__main__':
    main()
