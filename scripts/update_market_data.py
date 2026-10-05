#!/usr/bin/env python3
"""
시세 데이터 수집기 — GitHub Actions에서 실행 (외부 패키지 없음, 표준 라이브러리만 사용)

만드는 파일
  data/market.json  : 현재가·최근 30거래일 종가·공포탐욕 지수 (15분마다)
  data/history.json : 최근 31년 주간 종가 (하루 1회, 성장률·15년 CAGR 계산용)

원칙
  · 종목 하나가 실패해도 직전에 저장된 값을 유지 → 페이지에 빈 값이 생기지 않음
  · 내용이 바뀌었을 때만 파일을 다시 씀 → 장 마감 후에는 커밋이 생기지 않음
"""
import json, os, re, sys, time, datetime, urllib.request, urllib.parse
from zoneinfo import ZoneInfo
NY = ZoneInfo('America/New_York')

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data')
MARKET, HISTORY = os.path.join(ROOT, 'market.json'), os.path.join(ROOT, 'history.json')
MUHAN = os.path.join(ROOT, 'muhan.json')   # 무한매수법 탭 전용 (세션별 고저·10년 종가·VIX·CNN 공포탐욕)
MUHAN_TICKERS = ['TQQQ', 'SOXL']
UA = ('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/124.0 Safari/537.36')

ETF     = ['498400.KS', '0167B0.KS', '0104N0.KS', '472150.KS']           # KODEX·SOL·TIGER·TIGER배당
INDEX   = ['^KS11', '^KS200', '^KQ11', '^IXIC', '^NDX', '^DJI', '^GSPC', '^SOX']   # ^SOX = 필라델피아 반도체
METAL   = ['GC=F', 'SI=F']
FX      = ['USDKRW=X', 'EURKRW=X', 'JPYKRW=X', 'CNYKRW=X', 'GBPKRW=X', 'HKDKRW=X',
           'SGDKRW=X', 'AUDKRW=X', 'CADKRW=X', 'CHFKRW=X', 'THBKRW=X', 'USDVND=X']
US_ETF  = ['TQQQ', 'SOXL']                                              # 무한매수법
QUOTES  = ETF + INDEX + METAL + FX + US_ETF
HIST    = INDEX + METAL + ['USDKRW=X']
HIST_YEARS, HIST_MAX_AGE_H = 31, 20
HIST_VERSION = 4   # 형식·출처가 바뀌면 올려서 즉시 다시 수집
# Yahoo는 국내 지수(특히 코스피200)의 과거 데이터가 짧거나 비어 있음 → 네이버 금융 주봉으로 앞부분을 채움
NAVER_INDEX = {'^KS11': 'KOSPI', '^KS200': 'KPI200', '^KQ11': 'KOSDAQ'}


def utc_now():
    return datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)


def utc_date(sec):
    return datetime.datetime.fromtimestamp(sec, datetime.timezone.utc).replace(tzinfo=None)


def get_json(url, tries=3, headers=None):
    err = None
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers=dict({'User-Agent': UA, 'Accept': 'application/json'}, **(headers or {})))
            with urllib.request.urlopen(req, timeout=25) as r:
                return json.loads(r.read().decode('utf-8'))
        except Exception as e:
            err = e
            time.sleep(2 * (i + 1))
    raise err


def yahoo_chart(sym, query):
    err = None
    for host in ('query1', 'query2'):
        try:
            d = get_json(f'https://{host}.finance.yahoo.com/v8/finance/chart/{urllib.parse.quote(sym)}?{query}')
            res = (d.get('chart') or {}).get('result') or []
            if res:
                return res[0]
            err = RuntimeError(str((d.get('chart') or {}).get('error')))
        except Exception as e:
            err = e
    raise err


def points(res, digits=4):
    """Yahoo 결과 → [[unix초, 종가], ...] (빈 값 제거)"""
    ts = res.get('timestamp') or []
    cl = ((res.get('indicators') or {}).get('quote') or [{}])[0].get('close') or []
    return [[int(t), round(float(c), digits)] for t, c in zip(ts, cl) if c is not None and c > 0]


def build_quote(res):
    m, pts = res.get('meta') or {}, points(res)
    price = m.get('regularMarketPrice') or (pts[-1][1] if pts else None)
    if not price:
        raise ValueError('가격 없음')
    # 전일 종가: 마지막 일봉이 오늘 세션이면 그 앞, 아니면 마지막 일봉
    prev = None
    if pts:
        last_day = utc_date(pts[-1][0]).date()
        mkt_day = utc_date(m.get('regularMarketTime') or pts[-1][0]).date()
        prev = pts[-2][1] if (last_day == mkt_day and len(pts) > 1) else pts[-1][1]
    return {'price': round(float(price), 4), 'prev': prev or m.get('chartPreviousClose'),
            'time': m.get('regularMarketTime'), 'currency': m.get('currency'), 'daily': pts[-30:]}


def get_text(url, tries=3, enc='utf-8'):
    err = None
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': UA})
            with urllib.request.urlopen(req, timeout=25) as r:
                return r.read().decode(enc, errors='ignore')
        except Exception as e:
            err = e
            time.sleep(2 * (i + 1))
    raise err


def _naver_points(text, pattern):
    out = []
    for m in re.finditer(pattern, text):
        d = datetime.datetime.strptime(m.group(1), '%Y%m%d').replace(tzinfo=datetime.timezone.utc)
        c = float(m.group(2))
        if c > 0:
            out.append([int(d.timestamp()) // 86400, round(c, 2)])
    return sorted(out)


FCHART_RE = r'data="(\d{8})\|[^|]*\|[^|]*\|[^|]*\|([\d.]+)'
SISE_RE = r'\[\s*"(\d{8})"\s*,\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*,\s*([\d.]+)'


def naver_history(symbol, years):
    """네이버 금융 지수 과거 종가 → [[일수, 종가], ...]
    주봉(fchart)은 약 10년치만 와서, ① 기간 지정 주봉(siseJson) ② 월봉 으로 더 오래된 구간을 채움"""
    end = utc_now()
    start = (end - datetime.timedelta(days=int(years * 365.25))).strftime('%Y%m%d')
    sources = []
    try:
        sources.append(_naver_points(get_text(f'https://api.finance.naver.com/siseJson.naver?symbol={symbol}&requestType=1'
                                              f'&startTime={start}&endTime={end.strftime("%Y%m%d")}&timeframe=week', enc='euc-kr'), SISE_RE))
    except Exception as e:
        print(f'  {symbol} 네이버 기간주봉 실패: {e}')
    for tf, cnt in (('week', int(years * 53) + 10), ('month', int(years * 12) + 6)):
        try:
            sources.append(_naver_points(get_text(f'https://fchart.stock.naver.com/sise.nhn?symbol={symbol}&timeframe={tf}'
                                                  f'&count={cnt}&requestType=0', enc='euc-kr'), FCHART_RE))
        except Exception as e:
            print(f'  {symbol} 네이버 {tf} 실패: {e}')
    sources = [x for x in sources if x]
    if not sources:
        return []
    # 가장 촘촘한(주봉) 자료를 기준으로, 그보다 앞선 기간은 다른 자료로 차례로 채움
    merged = []
    for pts in sorted(sources, key=lambda x: -len(x)):
        merged = merge_older(merged, pts) if merged else pts
    return merged


def fresh_enough(q, days=10):
    """마지막 체결이 days일 이내인지 (데이터가 끊긴 종목을 걸러냄)"""
    t = q.get('time')
    return bool(t) and (time.time() - t) < days * 86400


def naver_quote(symbol):
    """네이버 일봉으로 build_quote 와 같은 형식 생성"""
    xml = get_text(f'https://fchart.stock.naver.com/sise.nhn?symbol={symbol}&timeframe=day&count=30&requestType=0', enc='euc-kr')
    pts = []
    for m in re.finditer(r'data="(\d{8})\|[^|]*\|[^|]*\|[^|]*\|([\d.]+)', xml):
        d = datetime.datetime.strptime(m.group(1), '%Y%m%d').replace(hour=6, tzinfo=datetime.timezone.utc)
        pts.append([int(d.timestamp()), round(float(m.group(2)), 2)])
    if not pts:
        raise ValueError('네이버 데이터 없음')
    return {'price': pts[-1][1], 'prev': pts[-2][1] if len(pts) > 1 else None, 'time': pts[-1][0], 'currency': 'KRW', 'daily': pts[-30:]}


def merge_older(primary, older):
    """primary(야후) 앞쪽에 없는 기간만 older(네이버)로 채움"""
    if not older: return primary
    if not primary: return older
    first = primary[0][0]
    return [p for p in older if p[0] < first - 3] + primary


def fear_greed():
    """대체 자료: feargreedchart.com (CNN 자료를 한 번도 받지 못했을 때만 화면에 사용)"""
    d = get_json('https://feargreedchart.com/api/?action=all')
    if d.get('score', {}).get('score') is None:
        raise ValueError('점수 없음')
    return {'score': d['score'], 'recent': (d.get('recent') or [])[-400:], 'source': 'feargreedchart.com'}


def load(path):
    try:
        with open(path, encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return {}


def save_if_changed(path, new, old):
    body = {k: v for k, v in new.items() if k != 'updated'}
    if body == {k: v for k, v in old.items() if k != 'updated'}:
        print(f'  {os.path.basename(path)}: 변경 없음')
        return
    new['updated'] = utc_now().replace(microsecond=0).isoformat() + 'Z'
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(new, f, ensure_ascii=False, separators=(',', ':'))
    print(f'  {os.path.basename(path)}: 저장 ({os.path.getsize(path):,} bytes)')


# ─────────────────────────────────────────────────────────────
# 무한매수법 탭 데이터 (data/muhan.json)
#   tickers.{T}.days   : 최근 거래일별 시가·종가·프리/정규/애프터 고가·저가
#   tickers.{T}.closes : 10년 일봉 종가 [일수, 종가]  (하루 1회 갱신)
#   tickers.{T}.quote  : 최신 체결가(프리·애프터 포함)
#   vix, fx, fear(CNN 공포탐욕 1년)
# ─────────────────────────────────────────────────────────────
def session_of(minute):
    if 240 <= minute < 570: return 'pre'
    if 570 <= minute < 960: return 'regular'
    if 960 <= minute < 1200: return 'post'
    return None


def muhan_ticker(sym, old):
    daily = yahoo_chart(sym, 'range=2mo&interval=1d')
    q = (daily.get('indicators') or {}).get('quote', [{}])[0]
    days = {}
    for i, t in enumerate(daily.get('timestamp') or []):
        c = (q.get('close') or [None])[i]
        if c is None: continue
        d = datetime.datetime.fromtimestamp(t, NY).strftime('%Y-%m-%d')
        o, h = (q.get('open') or [None])[i], (q.get('high') or [None])[i]
        days[d] = {'date': d, 'close': round(c, 2), 'open': round(o, 2) if o else None, 'dayHigh': round(h, 2) if h else None}
    try:   # 15분봉(프리·애프터 포함)으로 세션별 고가·저가
        intra = yahoo_chart(sym, 'range=1mo&interval=15m&includePrePost=true')
        iq = (intra.get('indicators') or {}).get('quote', [{}])[0]
        last_px = None
        for i, t in enumerate(intra.get('timestamp') or []):
            hi, lo, cl = (iq.get('high') or [None])[i], (iq.get('low') or [None])[i], (iq.get('close') or [None])[i]
            if hi is None or lo is None: continue
            dt = datetime.datetime.fromtimestamp(t, NY)
            ses = session_of(dt.hour * 60 + dt.minute)
            if not ses: continue
            day = days.get(dt.strftime('%Y-%m-%d'))
            if not day: continue
            day[ses + 'High'] = round(max(hi, day.get(ses + 'High', hi)), 2)
            day[ses + 'Low'] = round(min(lo, day.get(ses + 'Low', lo)), 2)
            if cl is not None: last_px = (round(cl, 2), t)
        for day in days.values():
            highs = [day.get(k) for k in ('preHigh', 'regularHigh', 'postHigh') if day.get(k) is not None]
            if highs: day['dayHigh'] = max(highs)
        quote = {'price': last_px[0], 'time': last_px[1]} if last_px else None
    except Exception as e:
        print(f'  {sym} 15분봉 실패(일봉만 사용): {e}')
        quote = None
    m = daily.get('meta') or {}
    if not quote and m.get('regularMarketPrice'):
        quote = {'price': round(m['regularMarketPrice'], 2), 'time': m.get('regularMarketTime')}
    closes = (old or {}).get('closes') or []
    fresh = closes and (time.time() / 86400 - closes[-1][0]) < 3 and (old or {}).get('closesAt', 0) > time.time() - HIST_MAX_AGE_H * 3600
    closesAt = (old or {}).get('closesAt', 0)
    if not fresh:
        long = yahoo_chart(sym, 'range=10y&interval=1d')
        closes = [[t // 86400, c] for t, c in points(long, 2)]
        closesAt = int(time.time())
    by = {c[0]: c for c in closes}
    for d in days.values():   # 최근 일봉으로 꼬리 갱신
        n = int(datetime.datetime.strptime(d['date'], '%Y-%m-%d').replace(tzinfo=datetime.timezone.utc).timestamp()) // 86400
        by[n] = [n, d['close']]
    closes = [by[k] for k in sorted(by)]
    return {'days': sorted(days.values(), key=lambda x: x['date'])[-25:], 'closes': closes, 'closesAt': closesAt, 'quote': quote}


CNN_UA = ('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) '
          'Chrome/126.0.0.0 Safari/537.36')
CNN_PARTS = [('market_momentum_sp500', '주가 모멘텀'), ('stock_price_strength', '주가 강도'),
             ('stock_price_breadth', '주가 폭'), ('put_call_options', '풋/콜 비율'),
             ('market_volatility_vix', '시장 변동성 (VIX)'), ('safe_haven_demand', '안전자산 수요'),
             ('junk_bond_demand', '정크본드 수요')]


def cnn_raw():
    """CNN 공포·탐욕 지수 원본 (1년치) — 봇 차단(418)을 피하려고 브라우저와 같은 헤더 사용"""
    since = (utc_now() - datetime.timedelta(days=370)).strftime('%Y-%m-%d')
    hdr = {'User-Agent': CNN_UA, 'Referer': 'https://edition.cnn.com/markets/fear-and-greed',
           'Origin': 'https://edition.cnn.com', 'Accept': 'application/json, text/plain, */*',
           'Accept-Language': 'en-US,en;q=0.9,ko;q=0.8', 'Sec-Fetch-Site': 'cross-site', 'Sec-Fetch-Mode': 'cors',
           'Sec-Fetch-Dest': 'empty', 'Cache-Control': 'no-cache'}
    err = None
    for url in (f'https://production.dataviz.cnn.io/index/fearandgreed/graphdata/{since}',
                'https://production.dataviz.cnn.io/index/fearandgreed/graphdata'):
        try:
            return get_json(url, tries=2, headers=hdr)
        except Exception as e:
            err = e
    raise err


def cnn_fear_full(d):
    """기타 금융 자료 › 공포 & 탐욕 탭용: 점수·과거값·7개 구성 지표·1년 추이"""
    fg = d['fear_and_greed']
    parts = [{'key': k, 'name': n, 'score': round(d[k]['score'], 1), 'rating': d[k].get('rating')}
             for k, n in CNN_PARTS if isinstance(d.get(k), dict) and d[k].get('score') is not None]
    hist = [{'date': utc_date(p['x'] / 1000).strftime('%Y-%m-%d'), 'score': round(p['y'], 1)}
            for p in d['fear_and_greed_historical']['data']]
    return {'source': 'CNN', 'score': round(fg['score'], 1), 'rating': fg.get('rating'),
            'time': fg.get('timestamp'),
            'prev': {'close': fg.get('previous_close'), 'w1': fg.get('previous_1_week'),
                     'm1': fg.get('previous_1_month'), 'y1': fg.get('previous_1_year')},
            'components': parts, 'historical': hist}


def rating_of(v):
    return 'extreme fear' if v < 25 else 'fear' if v < 45 else 'neutral' if v < 55 else 'greed' if v < 75 else 'extreme greed'


def build_muhan(market):
    old = load(MUHAN)
    out = {'tickers': dict(old.get('tickers') or {}), 'vix': old.get('vix'), 'fx': old.get('fx'), 'fear': old.get('fear')}
    for sym in MUHAN_TICKERS:
        try:
            out['tickers'][sym] = muhan_ticker(sym, out['tickers'].get(sym))
        except Exception as e:
            print(f'  무한매수 {sym} 실패(직전값 유지): {e}')
    try:
        out['vix'] = [[t // 86400, c] for t, c in points(yahoo_chart('^VIX', 'range=6mo&interval=1d'), 2)][-70:]
    except Exception as e:
        print('  VIX 실패(직전값 유지):', e)
    usd = (market.get('quotes') or {}).get('USDKRW=X')
    if usd:
        out['fx'] = {'rate': round(usd['price'], 2), 'date': utc_date(usd.get('time') or time.time()).strftime('%Y-%m-%d')}
    cf = market.get('fearCnn')
    if cf and cf.get('historical'):   # CNN 값을 그대로 사용 (무한매수법 카드 형식으로)
        out['fear'] = {'current': {'score': cf['score'], 'rating': cf.get('rating') or rating_of(cf['score'])},
                       'historical': [{'date': h['date'], 'score': h['score'], 'rating': rating_of(h['score'])} for h in cf['historical']],
                       'source': 'CNN'}
    else:
        f = market.get('fear')   # 대체: feargreedchart.com
        if f and f.get('score'):
            sc = f['score']['score']
            out['fear'] = {'current': {'score': sc, 'rating': rating_of(sc)},
                           'historical': [{'date': r['date'], 'score': r['score'], 'rating': rating_of(r['score'])} for r in (f.get('recent') or [])[-260:]],
                           'source': 'feargreedchart.com'}
    save_if_changed(MUHAN, out, old)


def main():
    os.makedirs(ROOT, exist_ok=True)
    old = load(MARKET)
    quotes, fails = dict(old.get('quotes') or {}), []
    for sym in QUOTES:
        sources = ([('네이버', lambda: naver_quote(NAVER_INDEX[sym]))] if sym in NAVER_INDEX else []) + \
                  [('야후', lambda: build_quote(yahoo_chart(sym, 'range=1mo&interval=1d')))]
        err = None
        for name, fn in sources:
            try:
                q = fn()
                if not fresh_enough(q):
                    raise ValueError(f'{name} 시세가 오래됨 ({utc_date(q["time"]).date()})')
                quotes[sym] = q
                if name == '네이버': print(f'  {sym} ← 네이버 {q["price"]}')
                err = None
                break
            except Exception as e:
                err = e
        if err is not None:
            fails.append(sym); print(f'  {sym} 실패(직전값 유지): {err}')
    market = {'quotes': quotes, 'fear': old.get('fear'), 'fearCnn': old.get('fearCnn')}
    try:
        market['fearCnn'] = cnn_fear_full(cnn_raw())
        print(f"  CNN 공포탐욕 {market['fearCnn']['score']} ({market['fearCnn']['rating']}) · 구성 지표 {len(market['fearCnn']['components'])}개")
    except Exception as e:
        print('  CNN 공포탐욕 실패(직전값 유지):', e)
    try:
        market['fear'] = fear_greed()   # 대체 자료 (CNN을 한 번도 못 받았을 때만 화면에 사용)
    except Exception as e:
        print('  feargreedchart 실패(직전값 유지):', e)
    save_if_changed(MARKET, market, old)
    build_muhan(market)

    oldh = load(HISTORY)
    age_h = 1e9
    if oldh.get('updated'):
        age_h = (utc_now() - datetime.datetime.fromisoformat(oldh['updated'][:-1])).total_seconds() / 3600
    if age_h >= HIST_MAX_AGE_H or oldh.get('v') != HIST_VERSION or set(HIST) - set((oldh.get('series') or {})) or '--history' in sys.argv:
        series, p1 = dict(oldh.get('series') or {}), int(time.time() - HIST_YEARS * 365.25 * 86400)
        for sym in HIST:
            ypts = []
            try:
                ypts = [[t // 86400, c] for t, c in points(yahoo_chart(sym, f'period1={p1}&period2={int(time.time())}&interval=1wk'), 2)]
            except Exception as e:
                print(f'  {sym} 야후 히스토리 실패: {e}')
            npts = []
            if sym in NAVER_INDEX:
                try:
                    npts = naver_history(NAVER_INDEX[sym], HIST_YEARS)
                except Exception as e:
                    print(f'  {sym} 네이버 히스토리 실패: {e}')
            merged = merge_older(npts, ypts) if npts else ypts   # 국내 지수는 네이버 우선 · [일수, 종가]
            if len(merged) > 50:
                series[sym] = merged
                start_d = datetime.date.fromordinal(719163 + merged[0][0])
                warn = '' if (datetime.date.today() - start_d).days > 15.2 * 365 else '  ⚠ 15년치 부족'
                print(f'  {sym} 히스토리 {len(merged)}개 (시작 {start_d}){warn}')
            else:
                print(f'  {sym} 히스토리 부족(직전값 유지)')
        save_if_changed(HISTORY, {'unit': 'day', 'v': HIST_VERSION, 'series': series}, oldh)
    print(f'완료 — 시세 {len(QUOTES) - len(fails)}/{len(QUOTES)} 성공')
    if len(fails) == len(QUOTES):
        sys.exit(1)   # 전부 실패하면 Actions에 빨간불로 표시


if __name__ == '__main__':
    main()
