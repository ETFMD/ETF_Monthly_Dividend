#!/usr/bin/env python3
"""
'그때 샀더라면' 계산기 자료 — data/whatif.json (GitHub Actions 하루 1번, 표준 라이브러리만 사용)

  · 종목별 월말 종가(c)와 배당·분할 반영 수정종가(a) — Yahoo Finance 월봉 전체 기간
  · 국내 종목·지수는 네이버 금융 월봉(수정주가, 1990년~)으로 긴 기간을 채우고, 배당은 야후 수정종가 비율로 반영(야후 자료가 시작되는 2000년 이전 배당은 미반영)
  · 원달러 환율 월말값 — Yahoo KRW=X 월봉 > data/history.json 주봉(2003~) > FRED EXKOUS 월평균(1981~) 순으로 채움
  · 서울·강남 아파트 매매 중위가격(연도별) — data/realty.json (국토교통부 실거래가)
  · 종목 하나가 실패하면 직전 whatif.json 의 값을 그대로 유지 → 페이지에 빈 자산이 생기지 않음
"""
import json, os, sys, time, datetime, urllib.request, urllib.parse

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data')
OUT = os.path.join(ROOT, 'whatif.json')
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

# [야후 기호, 이름, 분류, 통화, 배당 재투자 가능(수정종가 사용)]
ASSETS = [
    ('005930.KS', '삼성전자', 'kr', 'KRW', True), ('000660.KS', 'SK하이닉스', 'kr', 'KRW', True),
    ('005380.KS', '현대차', 'kr', 'KRW', True), ('035420.KS', 'NAVER', 'kr', 'KRW', True),
    ('035720.KS', '카카오', 'kr', 'KRW', True), ('068270.KS', '셀트리온', 'kr', 'KRW', True),
    ('207940.KS', '삼성바이오로직스', 'kr', 'KRW', True), ('373220.KS', 'LG에너지솔루션', 'kr', 'KRW', True),
    ('051910.KS', 'LG화학', 'kr', 'KRW', True), ('005490.KS', 'POSCO홀딩스', 'kr', 'KRW', True),
    ('012450.KS', '한화에어로스페이스', 'kr', 'KRW', True), ('086520.KQ', '에코프로', 'kr', 'KRW', True),
    ('^KS11', '코스피 지수', 'idx', 'KRW', False), ('^KQ11', '코스닥 지수', 'idx', 'KRW', False),
    ('SPY', 'S&P 500 (SPY)', 'idx', 'USD', True), ('QQQ', '나스닥 100 (QQQ)', 'idx', 'USD', True),
    ('AAPL', '애플', 'us', 'USD', True), ('MSFT', '마이크로소프트', 'us', 'USD', True),
    ('NVDA', '엔비디아', 'us', 'USD', True), ('TSLA', '테슬라', 'us', 'USD', True),
    ('AMZN', '아마존', 'us', 'USD', True), ('GOOGL', '알파벳 (구글)', 'us', 'USD', True),
    ('META', '메타 (페이스북)', 'us', 'USD', True), ('NFLX', '넷플릭스', 'us', 'USD', True),
    ('AVGO', '브로드컴', 'us', 'USD', True), ('PLTR', '팔란티어', 'us', 'USD', True),
    ('BRK-B', '버크셔 해서웨이', 'us', 'USD', True), ('KO', '코카콜라', 'us', 'USD', True),
    ('BTC-USD', '비트코인', 'coin', 'USD', False), ('ETH-USD', '이더리움', 'coin', 'USD', False),
    ('GC=F', '금', 'etc', 'USD', False), ('SI=F', '은', 'etc', 'USD', False),
    ('KRW=X', '달러 (현금 보유)', 'etc', 'USD', False),
]


def get_json(url, tries=3):
    err = None
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': 'application/json'})
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.loads(r.read().decode('utf-8'))
        except Exception as e:
            err = e
            time.sleep(2 * (i + 1))
    raise err


def yahoo_monthly(sym):
    err = None
    for host in ('query1', 'query2'):
        try:
            d = get_json(f'https://{host}.finance.yahoo.com/v8/finance/chart/{urllib.parse.quote(sym)}?interval=1mo&range=max&events=div,splits')
            res = ((d.get('chart') or {}).get('result') or [None])[0]
            if res:
                return res
            err = RuntimeError(str((d.get('chart') or {}).get('error')))
        except Exception as e:
            err = e
    raise err


def ym(ts, off):
    t = datetime.datetime.fromtimestamp(ts + off, datetime.timezone.utc)
    return t.year * 12 + t.month - 1          # 월 번호 (연×12 + 월−1)


def ym_txt(n):
    return f'{n // 12:04d}-{n % 12 + 1:02d}'


def series(res, use_adj, lo=None, hi=None):
    """월 번호 → (종가, 수정종가). 같은 달이 두 번 오면(이번 달 진행 중 값) 뒤의 값 사용, 빈 달은 앞 달 값으로 채움"""
    m = res.get('meta') or {}
    off = int(m.get('gmtoffset') or 0)
    ts = res.get('timestamp') or []
    q = ((res.get('indicators') or {}).get('quote') or [{}])[0].get('close') or []
    adj = (((res.get('indicators') or {}).get('adjclose') or [{}])[0].get('adjclose') or []) if use_adj else []
    by = {}
    for i, t in enumerate(ts):
        c = q[i] if i < len(q) else None
        if c is None or c <= 0 or (lo and c < lo) or (hi and c > hi):
            continue
        a = adj[i] if i < len(adj) and adj[i] and adj[i] > 0 else c
        by[ym(t, off)] = (float(c), float(a))
    price = m.get('regularMarketPrice')
    rmt = m.get('regularMarketTime')
    if price and rmt and by:                   # 마지막 달 = 지금 시세 (월봉 마지막 값이 늦게 갱신되는 경우 대비)
        k = ym(rmt, off)
        if k >= max(by) and (not lo or price >= lo) and (not hi or price <= hi):
            last = by.get(k) or by[max(by)]
            ratio = last[1] / last[0] if last[0] else 1
            by[k] = (float(price), float(price) * ratio)
    if not by:
        raise ValueError('자료 없음')
    s, e = min(by), max(by)
    c, a, prev = [], [], None
    for k in range(s, e + 1):
        v = by.get(k) or prev
        c.append(round(v[0], 6)); a.append(round(v[1], 6)); prev = v
    return s, c, a, rmt


def get_text(url, tries=3, timeout=30):
    err = None
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': UA})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read().decode('utf-8', errors='ignore')
        except Exception as e:
            err = e
            time.sleep(2 * (i + 1))
    raise err


def naver_monthly(code):
    """네이버 금융 월봉 종가(수정주가) → {월 번호: 종가}. 액면분할 등 수정 전 값이 섞인 앞부분(한 달에 5배 넘게 뛰거나 1/5 아래로 떨어지는 곳)은 잘라 냄"""
    end = datetime.date.today().strftime('%Y%m%d')
    t = get_text(f'https://api.finance.naver.com/siseJson.naver?symbol={code}&requestType=1&startTime=19900101&endTime={end}&timeframe=month')
    rows = []
    for line in t.splitlines():
        line = line.strip().rstrip(',')
        if line.startswith('["') and line[2:3].isdigit():
            r = json.loads(line.replace("'", '"'))
            d, c = str(r[0]), r[4]
            if c and c > 0:
                rows.append((int(d[:4]) * 12 + int(d[4:6]) - 1, float(c)))
    rows.sort()
    cut = 0
    for i in range(1, len(rows)):
        q = rows[i][1] / rows[i - 1][1]
        if q > 5 or q < 0.2:
            cut = i
    return dict(rows[cut:])


def fx_from_fred():
    """FRED EXKOUS — 원달러 월평균 (1981~)"""
    out = {}
    try:
        for line in get_text('https://fred.stlouisfed.org/graph/fredgraph.csv?id=EXKOUS', timeout=90).splitlines()[1:]:
            d, v = line.split(',')
            if v and v != '.':
                out[int(d[:4]) * 12 + int(d[5:7]) - 1] = float(v)
    except Exception as e:
        print('FRED 환율 실패:', e, file=sys.stderr)
    return out


def fx_from_history():
    """data/history.json 의 원달러 주봉(1995~) → 월말값"""
    try:
        h = json.load(open(os.path.join(ROOT, 'history.json'), encoding='utf-8'))
        pts = h['series']['USDKRW=X']
    except Exception:
        return {}
    out = {}
    for d, v in pts:                            # d = 1970-01-01 부터 일수
        if 500 <= v <= 3000:
            t = datetime.date(1970, 1, 1) + datetime.timedelta(days=d)
            out[t.year * 12 + t.month - 1] = v
    return out


NAVER = {'^KS11': 'KOSPI', '^KQ11': 'KOSDAQ'}


def main():
    old, old_fx = {}, {}
    try:
        prev_json = json.load(open(OUT, encoding='utf-8'))
        for x in prev_json.get('assets', []):
            old[x['id']] = x
        f0 = prev_json.get('fx') or {}
        k0 = int(f0['start'][:4]) * 12 + int(f0['start'][5:7]) - 1
        old_fx = {k0 + i: v for i, v in enumerate(f0.get('v') or [])}
    except Exception:
        pass
    assets, fails = [], []
    fx = dict(old_fx)                        # 직전 파일 값 (FRED 가 잠시 막혀도 1981~ 환율 유지)
    fx.update(fx_from_fred())
    fx.update(fx_from_history())
    for sym, name, grp, cur, use_adj in ASSETS:
        try:
            lo, hi = (500, 3000) if sym == 'KRW=X' else (None, None)
            s, c, a, rmt = series(yahoo_monthly(sym), use_adj, lo, hi)
            nv = NAVER.get(sym) or (sym[:6] if sym.endswith(('.KS', '.KQ')) else None)
            if nv:
                try:
                    N = naver_monthly(nv)
                except Exception as e:
                    N = {}; fails.append(f'{sym} 네이버: {e}')
                if N:
                    # 가격은 네이버 수정주가(유상증자·분할·인적분할까지 소급 수정)를 기준으로, 배당은 야후 '수정종가 ÷ 종가' 비율로만 반영
                    #  (야후는 국내 종목의 유상증자·인적분할을 소급 수정하지 않아 몇몇 종목에서 과거 가격이 최대 1.7배 다름 — Actions 에서 확인)
                    rY = {s + i: (a[i] / c[i] if c[i] else 1) for i in range(len(c))}
                    first, last_ = min(rY), max(rY)
                    s2, e2 = min(min(N), s), max(max(N), s + len(c) - 1)
                    yc = {s + i: c[i] for i in range(len(c))}
                    c2, a2, prev = [], [], None
                    for k in range(s2, e2 + 1):
                        px = N.get(k) or yc.get(k) or (prev[0] if prev else None)
                        r = rY.get(k) or (rY[first] if k < first else rY[last_])   # 야후 자료 이전 달은 첫 달 비율 = 그 이전 배당 미반영
                        v = (px, px * r)
                        c2.append(round(v[0], 6)); a2.append(round(v[1], 6)); prev = v
                    s, c, a = s2, c2, a2
            if sym == 'KRW=X':                  # 환율: 야후 월봉 + history 주봉 (야후 우선)
                for i, v in enumerate(c):
                    fx[s + i] = v
                continue
            item = {'id': sym, 'name': name, 'g': grp, 'cur': cur, 'start': ym_txt(s), 'c': c}
            if use_adj and a != c:
                item['a'] = a
            if rmt:
                item['t'] = datetime.datetime.fromtimestamp(rmt, datetime.timezone.utc).strftime('%Y-%m-%d')
            assets.append(item)
        except Exception as e:
            fails.append(f'{sym}: {e}')
            if sym in old:
                assets.append(old[sym])
        time.sleep(0.4)
    if not fx:
        print('환율 자료 없음', file=sys.stderr); sys.exit(1)
    fs, fe = min(fx), max(fx)
    fxv, prev = [], None
    for k in range(fs, fe + 1):
        prev = fx.get(k) or prev
        fxv.append(round(prev, 2))
    # 달러(현금 보유): 1달러를 들고 있는 것 = 환율 그 자체 (원화 기준)
    assets.append({'id': 'USD', 'name': '달러 (현금 보유)', 'g': 'etc', 'cur': 'KRW', 'start': ym_txt(fs), 'c': fxv})
    try:
        r = json.load(open(os.path.join(ROOT, 'realty.json'), encoding='utf-8'))
        ys = sorted(r['years'])
        for key, nm in (('seoul', '서울 아파트 (중위가격)'), ('gangnam', '강남 3구 아파트 (중위가격)')):
            v = [r['years'][y][key]['median'] * 1e4 for y in ys]
            assets.append({'id': 'APT-' + key, 'name': nm, 'g': 'apt', 'cur': 'KRW', 'yearly': True, 'start': ys[0], 'c': v,
                           'n': [r['years'][y][key]['n'] for y in ys]})
    except Exception as e:
        fails.append(f'realty: {e}')
    if len([x for x in assets if x['g'] != 'apt']) < len(ASSETS) * 0.6:
        print('수집 실패가 너무 많음 — 기존 파일 유지\n' + '\n'.join(fails), file=sys.stderr); sys.exit(1)
    out = {'unit': 'month', 'fx': {'start': ym_txt(fs), 'v': fxv}, 'assets': assets,
           'updated': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')}
    txt = json.dumps(out, ensure_ascii=False, separators=(',', ':'))
    cur = open(OUT, encoding='utf-8').read() if os.path.exists(OUT) else ''
    if cur:
        try:
            a, b = json.loads(cur), json.loads(txt); a.pop('updated', None); b.pop('updated', None)
            if a == b:
                print('변경 없음'); return
        except Exception:
            pass
    open(OUT, 'w', encoding='utf-8').write(txt)
    print(f'저장 {len(assets)}개 자산 · 환율 {ym_txt(fs)}~{ym_txt(fe)}' + (f' · 실패 {len(fails)}' if fails else ''))
    for f in fails:
        print('  ', f)


if __name__ == '__main__':
    main()
