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
import json, os, re, sys, time, gzip, datetime, urllib.request, urllib.parse
from zoneinfo import ZoneInfo
NY = ZoneInfo('America/New_York')

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data')
MARKET, HISTORY = os.path.join(ROOT, 'market.json'), os.path.join(ROOT, 'history.json')
MUHAN = os.path.join(ROOT, 'muhan.json')   # 무한매수법 탭 전용 (세션별 고저·10년 종가·VIX·CNN 공포탐욕)
MUHAN_TICKERS = ['TQQQ', 'SOXL']
UA = ('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/124.0 Safari/537.36')

ETF     = ['498400.KS', '0167B0.KS', '0104N0.KS', '472150.KS', '0177R0.KS']   # KODEX·SOL·TIGER·TIGER배당·TIGER반도체
INDEX   = ['^KS11', '^KS200', '^KQ11', '^IXIC', '^NDX', '^DJI', '^GSPC', '^SOX', '^DJUSSC']   # ^SOX = 필라델피아 반도체 · ^DJUSSC = 다우존스 미국 반도체
# 아시아 지수: 일본(닛케이225·TOPIX) · 중국(상해종합·CSI300·선전성분·창업판·과창판50) · 홍콩(항셍·H지수·항셍테크) · 대만(가권)
#  · '^TOPX' 는 야후에 없는 TOPIX 의 저장용 이름 (시세·과거 모두 CNBC .TOPX)
ASIA_INDEX = ['^N225', '^TOPX', '000001.SS', '000300.SS', '399001.SZ', '399006.SZ', '000688.SS',
              '^HSI', '^HSCE', 'HSTECH.HK', '^TWII']
INDEX  += ASIA_INDEX
INDEX_CUR = {'^N225': 'JPY', '^TOPX': 'JPY', '000001.SS': 'CNY', '000300.SS': 'CNY', '399001.SZ': 'CNY', '399006.SZ': 'CNY',
             '000688.SS': 'CNY', '^HSI': 'HKD', '^HSCE': 'HKD', 'HSTECH.HK': 'HKD', '^TWII': 'TWD'}
NO_YAHOO = {'^TOPX'}   # 야후에 종목 자체가 없음 → 요청하지 않음
METAL   = ['GC=F', 'SI=F']
FX      = ['USDKRW=X', 'EURKRW=X', 'JPYKRW=X', 'CNYKRW=X', 'GBPKRW=X', 'HKDKRW=X',
           'SGDKRW=X', 'AUDKRW=X', 'CADKRW=X', 'CHFKRW=X', 'THBKRW=X', 'USDVND=X']
US_ETF  = ['TQQQ', 'SOXL']                                              # 무한매수법
DXY_SYM = 'DX-Y.NYB'                                                    # 달러인덱스 (ICE)
QUOTES  = ETF + INDEX + METAL + FX + US_ETF + [DXY_SYM]
HIST    = INDEX + METAL + ['USDKRW=X']
HIST_YEARS, HIST_MAX_AGE_H = 31, 20
HIST_VERSION = 5   # 형식·출처가 바뀌면 올려서 즉시 다시 수집 (5: 원달러 환율 이상값 제거)
# 야후 과거 자료의 단위 오류 걸러내기 — 원달러 주봉에 2015~2017년 0.11 같은 값이 섞여 있음 (원화 환산이 틀어짐)
HIST_RANGE = {'USDKRW=X': (500, 3000)}
# Yahoo는 국내 지수(특히 코스피200)의 과거 데이터가 짧거나 비어 있음 → 네이버 금융 주봉으로 앞부분을 채움
NAVER_INDEX = {'^KS11': 'KOSPI', '^KS200': 'KPI200', '^KQ11': 'KOSDAQ'}
# 야후가 비거나 오래된 값을 줄 때 쓰는 보조 시세 — 현재가: CNBC → 트레이딩뷰 → 구글 / 과거: CNBC 주봉
# (^DJUSSC: 야후는 현재가 1개만 주고 과거가 없음 · 트레이딩뷰 과거는 유료 권한 · WSJ·stooq 는 봇 차단 — Actions 에서 확인)
# 아시아 지수: 야후 주봉이 짧거나(상해종합·대만 1997~) 없으면(CSI300·창업판·과창판50·항셍테크) 동방재부(EastMoney) → CNBC 주봉으로 앞부분을 채움
#  (Actions 에서 확인: EastMoney 는 TOPIX 미제공 · CNBC 는 CSI300·창업판 현재가 미제공)
ALT_QUOTE = {'^DJUSSC': {'cnbc': '.DJUSSC', 'tv': 'DJ:DJUSSC', 'google': 'DJUSSC:INDEXDJX'},
             '^N225': {'em': '100.N225', 'cnbc': '.N225'},          '^TOPX': {'cnbc': '.TOPX'},
             '000001.SS': {'em': '1.000001', 'cnbc': '.SSEC'},     '000300.SS': {'em': '1.000300', 'cnbc': '.CSI300'},
             '399001.SZ': {'em': '0.399001', 'cnbc': '.SZI'},      '399006.SZ': {'em': '0.399006'},
             '000688.SS': {'em': '1.000688', 'cnbc': '.STAR50'},   '^HSI': {'em': '100.HSI', 'cnbc': '.HSI'},
             '^HSCE': {'em': '100.HSCEI', 'cnbc': '.HSCE'},        'HSTECH.HK': {'em': '124.HSTECH', 'cnbc': '.HSTECH'},
             '^TWII': {'em': '100.TWII', 'cnbc': '.TWII'}}

# 분배 시뮬레이터 '지수 비교' 차트 (data/compare.json): ETF 상장 이후 일봉 + 분배금, 비교 지수 일봉
COMPARE = os.path.join(ROOT, 'compare.json')
COMPARE_PAIRS = {                                     # 분배 시뮬레이터 ETF ↔ 코스피
    '498400.KS': {'naver': '498400', 'bench': '^KS11'},   # KODEX 200타겟위클리커버드콜
    '0167B0.KS': {'naver': '0167B0', 'bench': '^KS11'},   # SOL 200타겟위클리커버드콜
    '0104N0.KS': {'naver': '0104N0', 'bench': '^KS11'},   # TIGER 200타겟위클리커버드콜
    '472150.KS': {'naver': '472150', 'bench': '^KS11'},   # TIGER 배당커버드콜액티브
    '0177R0.KS': {'naver': '0177R0', 'bench': '^KS11'},   # TIGER 반도체TOP10커버드콜액티브
}
KST = 9 * 3600

# 기타 금융 자료 'ETF CAGR 비교' (data/etfcagr.json): 상장 이후 일봉 종가 + 분배금 (야후, 6시간마다)
# 가치 속도 '부동산' (data/realty.json): 국토교통부 실거래가 공개시스템 아파트 매매 원자료(2006~)로 연도별 평균·중앙 실거래가
REALTY = os.path.join(ROOT, 'realty.json')
REALTY_FIRST_YEAR = 2006            # 실거래가 공개 시작
REALTY_REFRESH_DAYS = 7             # 최근 2개 연도만 주 1회 다시 받음 (지난 연도는 확정값 재사용)
REALTY_MAX_DOWNLOADS = 8
REALTY_BUDGET_SEC = 420            # 한 번 실행에서 받을 최대 연도 수 (사이트 일일 한도 100회 · 실행 시간 고려)

# 환율 계산기 '달러인덱스' 차트 (data/dxy.json): 야후 DX-Y.NYB 일봉 전체 (1971~)
DXY = os.path.join(ROOT, 'dxy.json')
DXY_MAX_AGE_H = 6
DXY_PERIOD = 'period1=31536000&period2={now}&interval=1d'                 # 1971-01-01 ~ 현재 (range=max 는 월봉이 됨)

# 홈 화면 '자본주의를 숫자로' (data/home.json): 연평균 기준 자산별 비교
#  · 한국은행 ECOS: 소비자물가지수(901Y009, 2020=100, 연), 예금은행 저축성수신 금리(121Y002 BEABAA2, 신규취급액, 연 %)
#  · history.json 주봉(코스피·S&P500·나스닥100·금·원달러), etfcagr.json SPY 일봉+분배금(배당 재투자), realty.json 실거래가
HOME = os.path.join(ROOT, 'home.json')
ECOS_KEY = 'RVTLLDCO3IW1YUKQSSPJ'          # 사이트(기준금리 조회)에서 쓰는 것과 같은 공개 인증키
HOME_ECOS_REFRESH_DAYS = 7

ETF_CAGR = ['QQQ', 'SPY', 'SOXX', 'SSO', 'ROM', 'USD', 'QLD', 'TQQQ', 'TECL', 'SOXL', 'SPXL', 'UPRO']
ETFCAGR = os.path.join(ROOT, 'etfcagr.json')
ETFCAGR_MAX_AGE_H = 6
ETFCAGR_VERSION = 2   # 2: 월봉 오류 수정 → 형식이 바뀌면 올려서 즉시 다시 수집
# 야후는 range=max 로 요청하면 긴 종목을 '월봉'으로 바꿔 줌 → 항상 기간(period1~period2)을 지정해 일봉을 받음
DAILY_ALL = 'period1=504921600&period2={now}&interval=1d&events=div'   # 1986-01-01 ~ 현재


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


def tv_quote(symbol):
    """트레이딩뷰 공개 스캐너에서 현재가 (예: DJ:DJUSSC)"""
    q = urllib.parse.quote(symbol, safe='')
    d = get_json(f'https://scanner.tradingview.com/symbol?symbol={q}&fields=close,change_abs&no_404=true',
                 headers={'Origin': 'https://www.tradingview.com', 'Referer': 'https://www.tradingview.com/'})
    price = float(d.get('close') or 0)
    if price <= 0:
        raise ValueError('트레이딩뷰 값 없음')
    chg = d.get('change_abs')
    prev = round(price - float(chg), 4) if isinstance(chg, (int, float)) else None
    now = int(time.time())
    return {'price': round(price, 4), 'prev': prev, 'time': now, 'currency': 'USD', 'daily': [[now, round(price, 4)]]}


def google_quote(symbol):
    """구글 파이낸스 시세 페이지에서 현재가 (예: DJUSSC:INDEXDJX)"""
    html = get_text(f'https://www.google.com/finance/quote/{symbol}?hl=en')
    m = re.search(r'data-last-price="([\d.]+)"', html)
    if not m:
        raise ValueError('구글 값 없음')
    price = float(m.group(1))
    t = re.search(r'data-last-normal-market-timestamp="(\d+)"', html)
    ts = int(t.group(1)) if t else int(time.time())
    return {'price': round(price, 4), 'prev': None, 'time': ts, 'currency': 'USD', 'daily': [[ts, round(price, 4)]]}


def cnbc_history(symbol, resolution='1W'):
    """CNBC 차트 API → [[일수, 종가], ...]  예: cnbc_history('.DJUSSC') (주봉, 2000년 2월~)"""
    end = utc_now() + datetime.timedelta(days=1)
    d = get_json(f'https://ts-api.cnbc.com/harmony/app/bars/{urllib.parse.quote(symbol)}/{resolution}/19900101000000/{end:%Y%m%d}000000/adjusted/EST5EDT.json')
    out = {}
    for b in ((d.get('barData') or {}).get('priceBars') or []):
        try:
            day = datetime.datetime.strptime(str(b['tradeTime'])[:8], '%Y%m%d').replace(tzinfo=datetime.timezone.utc)
            c = float(b['close'])
            if c > 0:
                out[int(day.timestamp()) // 86400] = round(c, 2)
        except (KeyError, ValueError, TypeError):
            pass
    return [[k, out[k]] for k in sorted(out)]


def em_history(secid):
    """동방재부(EastMoney) 주봉 → [[일수, 종가], ...]  예: em_history('1.000300') (CSI300, 2005년~)"""
    d = get_json(f'https://push2his.eastmoney.com/api/qt/stock/kline/get?secid={secid}&fields1=f1,f2,f3'
                 f'&fields2=f51,f53&klt=102&fqt=0&beg=19900101&end=20500101&lmt=100000')
    out = []
    for k in ((d.get('data') or {}).get('klines') or []):
        try:
            day, close = k.split(',')[:2]
            c = float(close)
            if c > 0:
                out.append([(datetime.date.fromisoformat(day) - datetime.date(1970, 1, 1)).days, round(c, 2)])
        except ValueError:
            pass
    return out


def em_quote(secid, currency='CNY'):
    """동방재부(EastMoney) 현재가 → build_quote 와 같은 형식 (f43 현재가·f60 전일 종가는 10^f59 배 정수)"""
    d = (get_json(f'https://push2.eastmoney.com/api/qt/stock/get?secid={secid}&fields=f43,f59,f60,f86') or {}).get('data') or {}
    k, price, prev = 10 ** int(d.get('f59') or 2), d.get('f43'), d.get('f60')
    if not isinstance(price, (int, float)) or price <= 0:
        raise ValueError('EastMoney 값 없음')
    p = round(price / k, 4)
    ts = int(d.get('f86') or time.time())
    return {'price': p, 'prev': round(prev / k, 4) if isinstance(prev, (int, float)) and prev > 0 else None,
            'time': ts, 'currency': currency, 'daily': [[ts, p]]}


def _cnbc_time(t):
    """CNBC last_time: '2026-10-07T15:00:00.000+0900' 또는 장 마감 후 날짜만 '2026-09-30' (중국 지수)"""
    if not t:
        return int(time.time())
    try:
        return int(datetime.datetime.strptime(t, '%Y-%m-%dT%H:%M:%S.%f%z').timestamp())
    except ValueError:
        return int(datetime.datetime.strptime(t[:10], '%Y-%m-%d').replace(hour=7, tzinfo=datetime.timezone.utc).timestamp())


def cnbc_quote(symbol, currency='USD'):
    """CNBC 시세 API → build_quote 와 같은 형식"""
    d = get_json('https://quote.cnbc.com/quote-html-webservice/restQuote/symbolType/symbol?symbols=' + urllib.parse.quote(symbol)
                 + '&requestMethod=itv&noform=1&partnerId=2&fund=1&exthrs=1&output=json&events=1')
    q = ((d.get('FormattedQuoteResult') or {}).get('FormattedQuote') or [{}])[0]
    price = float(str(q.get('last', '')).replace(',', '') or 0)
    if price <= 0:
        raise ValueError('CNBC 값 없음')
    prev = q.get('previous_day_closing') or q.get('previous_close')
    prev = float(str(prev).replace(',', '')) if prev else None
    ts = _cnbc_time(q.get('last_time'))
    return {'price': round(price, 4), 'prev': prev, 'time': ts, 'currency': currency, 'daily': [[ts, round(price, 4)]]}


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


def naver_daily(symbol, count):
    """네이버 일봉 종가 → [[일수(KST 날짜), 종가], ...] (종목·지수 공통)"""
    xml = get_text(f'https://fchart.stock.naver.com/sise.nhn?symbol={symbol}&timeframe=day&count={count}&requestType=0', enc='euc-kr')
    return _naver_points(xml, FCHART_RE)


def yahoo_daily(sym):
    """야후 상장 이후 일봉 종가와 분배금 → ([[일수, 종가]], [[일수, 분배금]])"""
    res = yahoo_chart(sym, DAILY_ALL.format(now=int(time.time())))
    pts = [[(t + KST) // 86400, c] for t, c in points(res, 2)]
    divs = []
    for d in ((res.get('events') or {}).get('dividends') or {}).values():
        try:
            divs.append([(int(d['date']) + KST) // 86400, round(float(d['amount']), 4)])
        except Exception:
            pass
    return pts, sorted(divs)


def dedup(pts):
    out = {}
    for d, c in pts:
        out[int(d)] = c
    return [[d, out[d]] for d in sorted(out)]


def build_compare():
    """ETF 가격(네이버 우선·야후 보조)·분배금(야후)·비교 지수(네이버 우선) 일봉을 compare.json 으로 저장
    비교 지수는 여러 ETF가 함께 쓰므로, 모든 ETF 중 가장 이른 상장일부터 한 번만 받음"""
    old = load(COMPARE)
    series, divs = dict(old.get('series') or {}), dict(old.get('divs') or {})
    starts = {}                                   # 비교 지수 → 필요한 시작일(가장 이른 상장일)
    for sym, cfg in COMPARE_PAIRS.items():
        ypts, ydiv = [], []
        try:
            ypts, ydiv = yahoo_daily(sym)
        except Exception as e:
            print(f'  {sym} 야후 일봉 실패: {e}')
        npts = []
        try:
            npts = naver_daily(cfg['naver'], 1500)
        except Exception as e:
            print(f'  {sym} 네이버 일봉 실패: {e}')
        etf = dedup(merge_older(npts, ypts) if npts else ypts)
        if len(etf) < 5:
            print(f'  {sym} 일봉 부족(직전값 유지)')
            etf = series.get(sym) or []
        else:
            series[sym] = etf
            price = dict(map(tuple, etf))
            # 분배금은 그 시점 가격의 10% 미만인 값만 인정 (잘못된 값 방지)
            okdiv = [[d, a] for d, a in ydiv if a > 0 and d >= etf[0][0] and a < 0.1 * (price.get(d) or etf[-1][1])]
            if okdiv or sym not in divs:
                divs[sym] = okdiv
            print(f'  비교 {sym} {len(etf)}일 (상장 {datetime.date.fromordinal(719163 + etf[0][0])}) · 분배 {len(divs.get(sym) or [])}회')
        if etf:
            b = cfg['bench']
            starts[b] = min(starts.get(b, etf[0][0]), etf[0][0])
    for bench, start in starts.items():
        bpts = []
        if bench in NAVER_INDEX:
            try:
                bpts = naver_daily(NAVER_INDEX[bench], int((utc_now().date().toordinal() - 719163 - start) * 0.75) + 60)
            except Exception as e:
                print(f'  {bench} 네이버 일봉 실패: {e}')
        try:
            ypts = [[(t + KST) // 86400, c] for t, c in points(yahoo_chart(bench, f'period1={(start - 10) * 86400}&period2={int(time.time())}&interval=1d'), 2)]
            bpts = merge_older(bpts, ypts) if bpts else ypts
        except Exception as e:
            print(f'  {bench} 야후 일봉 실패: {e}')
        if bpts:
            bpts = merge_older(dedup(bpts), series.get(bench) or [])   # 새 자료에 없는 앞부분은 직전 저장값으로
            bpts = [p for p in bpts if p[0] >= start - 7]
            if len(bpts) >= 5:
                series[bench] = bpts
        print(f'  비교 지수 {bench} {len(series.get(bench) or [])}일 (시작 {datetime.date.fromordinal(719163 + start)} 필요)')
    save_if_changed(COMPARE, {'unit': 'day', 'pairs': {s: c['bench'] for s, c in COMPARE_PAIRS.items()},
                              'series': series, 'divs': divs}, old)


def build_dxy():
    """달러인덱스 일봉 종가 전체 → data/dxy.json  형식: {d0: 첫 거래일(일수), dd: 거래일 간격 배열, c: 종가 배열}
    최근 30일은 market.json 의 시세(15분마다)가 화면에서 이어 붙임"""
    old = load(DXY)
    age_h = 1e9
    if old.get('updated'):
        age_h = (utc_now() - datetime.datetime.fromisoformat(old['updated'][:-1])).total_seconds() / 3600
    if age_h < DXY_MAX_AGE_H and old.get('c') and '--dxy' not in sys.argv:
        print(f'  dxy.json: 최근 갱신({age_h:.1f}시간 전) — 건너뜀')
        return
    res = yahoo_chart(DXY_SYM, DXY_PERIOD.format(now=int(time.time())))
    pts = {}
    for t, cl in zip(res.get('timestamp') or [], ((res.get('indicators') or {}).get('quote') or [{}])[0].get('close') or []):
        if cl is not None and 20 < cl < 300:                      # 달러인덱스 범위 밖 값(오류) 제외
            pts[datetime.datetime.fromtimestamp(t, NY).date().toordinal() - 719163] = round(float(cl), 3)
    days = sorted(pts)
    if len(days) < 2500:
        raise ValueError(f'일봉 부족 ({len(days)}개)')
    recent = [b - a for a, b in zip(days[-500:], days[-499:])]
    if sorted(recent)[len(recent) // 2] > 4:                       # 최근 구간이 일봉이 아니면(주봉·월봉) 저장 안 함
        raise ValueError('일봉이 아님')
    if old.get('c') and len(days) < len(old['c']) * 0.9:          # 갑자기 짧아지면(야후 일시 오류) 직전값 유지
        raise ValueError(f'자료가 짧아짐 ({len(old["c"])} → {len(days)})')
    gaps = [b - a for a, b in zip(days, days[1:])]
    print(f'  달러인덱스 {len(days)}일 (시작 {datetime.date.fromordinal(719163 + days[0])} · 마지막 {datetime.date.fromordinal(719163 + days[-1])} {pts[days[-1]]}) · 최대 간격 {max(gaps)}일')
    save_if_changed(DXY, {'unit': 'day', 'sym': DXY_SYM, 'd0': days[0], 'dd': gaps, 'c': [pts[d] for d in days]}, old)


def build_etfcagr():
    """ETF CAGR 비교용 상장 이후 일봉 (분할 반영 종가) + 분배금 → data/etfcagr.json
    형식: series[T] = {d0: 첫 거래일(일수), dd: 거래일 간격 배열, c: 종가 배열, div: [[일수, 분배금]]}"""
    old = load(ETFCAGR)
    age_h = 1e9
    if old.get('updated'):
        age_h = (utc_now() - datetime.datetime.fromisoformat(old['updated'][:-1])).total_seconds() / 3600
    series = dict(old.get('series') or {})
    if old.get('v') != ETFCAGR_VERSION:
        series = {}                               # 이전 형식(월봉 섞임)은 버리고 새로 수집
    if age_h < ETFCAGR_MAX_AGE_H and old.get('v') == ETFCAGR_VERSION and set(ETF_CAGR) <= set(series) and '--etfcagr' not in sys.argv:
        print(f'  etfcagr.json: 최근 갱신({age_h:.1f}시간 전) — 건너뜀')
        return
    for sym in ETF_CAGR:
        try:
            res = yahoo_chart(sym, DAILY_ALL.format(now=int(time.time())))
            ny = lambda t: datetime.datetime.fromtimestamp(t, NY).date().toordinal() - 719163   # 미국 거래일 날짜
            pts = {}
            for t, cl in zip(res.get('timestamp') or [], ((res.get('indicators') or {}).get('quote') or [{}])[0].get('close') or []):
                if cl is not None and cl > 0:
                    pts[ny(t)] = round(float(cl), 4)
            days = sorted(pts)
            if len(days) < 250:
                raise ValueError(f'일봉 부족 ({len(days)}개)')
            gaps = sorted(b - a for a, b in zip(days, days[1:]))
            if gaps[len(gaps) // 2] > 4:                     # 거래일 간격 중앙값이 4일 초과면 일봉이 아님(주봉·월봉)
                raise ValueError(f'일봉이 아님 (간격 중앙값 {gaps[len(gaps) // 2]}일)')
            divs = sorted([ny(int(d['date'])), round(float(d['amount']), 4)]
                          for d in ((res.get('events') or {}).get('dividends') or {}).values() if d.get('amount'))
            series[sym] = {'d0': days[0], 'dd': [b - a for a, b in zip(days, days[1:])], 'c': [pts[d] for d in days], 'div': divs}
            print(f'  CAGR {sym} {len(days)}일 (상장 {datetime.date.fromordinal(719163 + days[0])}) · 분배 {len(divs)}회')
        except Exception as e:
            print(f'  CAGR {sym} 실패(직전값 유지): {e}')
    save_if_changed(ETFCAGR, {'unit': 'day', 'v': ETFCAGR_VERSION, 'series': series}, old)


def molit_apt_year(year, sido='11000', sido_nm='서울특별시', deadline=None):
    """국토교통부 실거래가 공개시스템 '조건별 자료제공' CSV (아파트 매매, 계약일 기준, 1년 단위) → 거래 목록"""
    import http.cookiejar, csv as _csv, io
    base = 'https://rt.molit.go.kr'
    op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
    hdr = {'User-Agent': UA, 'Accept': '*/*', 'Accept-Encoding': 'gzip', 'Referer': base + '/pt/xls/xls.do?mobileAt='}
    def call(path, data=None, extra=None, timeout=90):
        err = None
        for i in range(2):
            if deadline and time.time() > deadline:
                raise TimeoutError('실거래 수집 시간 예산 초과')
            try:
                req = urllib.request.Request(base + path, data=data, headers=dict(hdr, **(extra or {})))
                with op.open(req, timeout=timeout) as r:
                    b = r.read()
                    return gzip.decompress(b) if r.headers.get('Content-Encoding') == 'gzip' else b
            except Exception as e:
                err = e
                time.sleep(3)
        raise err
    call('/pt/xls/xls.do?mobileAt=', timeout=30)                    # 세션 쿠키
    form = urllib.parse.urlencode({
        'srhThingNo': 'A', 'srhDelngSecd': '1', 'srhAddrGbn': '1', 'srhLfstsSecd': '1',
        'sidoNm': sido_nm, 'sggNm': '전체', 'emdNm': '전체', 'loadNm': '전체', 'areaNm': '전체', 'hsmpNm': '전체', 'mobileAt': '',
        'srhFromDt': f'{year}-01-01', 'srhToDt': f'{year}-12-31', 'srhNewRonSecd': '', 'srhSidoCd': sido, 'srhSggCd': '',
        'srhEmdCd': '', 'srhRoadNm': '', 'srhLoadCd': '', 'srhHsmpCd': '', 'srhArea': '', 'srhLrArea': '',
        'srhFromAmount': '', 'srhToAmount': ''}).encode()
    form_hdr = {'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'}
    cnt = json.loads(call('/pt/xls/ptXlsDownDataCheck.do', form, dict(form_hdr, **{'X-Requested-With': 'XMLHttpRequest'}), 30).decode('utf-8')).get('cnt', 0)
    raw = call('/pt/xls/ptXlsCSVDown.do', form, form_hdr, 120)
    for enc in ('cp949', 'utf-8-sig', 'utf-8'):
        try:
            text = raw.decode(enc); break
        except UnicodeDecodeError:
            text = None
    if text is None:
        raise ValueError('CSV 인코딩 해석 실패')
    lines = text.splitlines()
    head = next(i for i, l in enumerate(lines) if l.startswith('"NO"'))
    rows = list(_csv.DictReader(io.StringIO('\n'.join(lines[head:]))))
    if cnt and abs(len(rows) - cnt) > max(50, cnt * 0.01):
        raise ValueError(f'건수 불일치 (확인 {cnt} · 받음 {len(rows)})')
    return rows


def realty_stats(rows, prefix):
    """해제된 거래를 뺀 거래금액(만원)의 건수·평균·중앙값"""
    vals = []
    for r in rows:
        if not r.get('시군구', '').startswith(prefix):
            continue
        if (r.get('해제사유발생일') or '-').strip() not in ('-', ''):
            continue                                                  # 계약 해제된 거래 제외
        try:
            vals.append(int(r['거래금액(만원)'].replace(',', '').strip()))
        except (KeyError, ValueError):
            pass
    if not vals:
        return None
    vals.sort()
    n = len(vals)
    med = vals[n // 2] if n % 2 else (vals[n // 2 - 1] + vals[n // 2]) / 2
    return {'n': n, 'mean': round(sum(vals) / n), 'median': round(med)}


def ecos_series(stat, cycle, t0, t1, items):
    """한국은행 ECOS 통계 → {시점(문자열): 값}  예) ecos_series('901Y009', 'A', 1990, 2026, '0')"""
    url = f'https://ecos.bok.or.kr/api/StatisticSearch/{ECOS_KEY}/json/kr/1/2000/{stat}/{cycle}/{t0}/{t1}/{items}'
    rows = ((get_json(url).get('StatisticSearch') or {}).get('row')) or []
    out = {}
    for r in rows:
        try:
            out[str(r['TIME'])] = float(r['DATA_VALUE'])
        except (KeyError, ValueError):
            pass
    if not out:
        raise ValueError(f'ECOS {stat}/{items} 자료 없음')
    return out


def month_avg(pts):
    """[[일수, 값], ...] → {'YYYYMM': 월평균}"""
    acc = {}
    for d, v in pts:
        t = datetime.date.fromordinal(719163 + int(d))
        acc.setdefault(f'{t.year}{t.month:02d}', []).append(v)
    return {m: sum(v) / len(v) for m, v in acc.items()}


def year_from_months(mon, need=12):
    """{'YYYYMM': 값} → {연도: 월평균들의 평균} (12개월이 다 있는 해만 — 상장·수집 첫해와 진행 중인 해 제외)"""
    acc = {}
    for m, v in mon.items():
        acc.setdefault(int(m[:4]), []).append(v)
    return {y: sum(v) / len(v) for y, v in acc.items() if len(v) >= need}


def build_home():
    """홈 화면용 연평균 비교 자료 → data/home.json
    · 모든 값은 '그해 평균' — 실거래가(연평균 거래금액)·소비자물가(연평균 지수)와 같은 잣대로 맞춤
    · 원화 환산 = 월평균 지수 × 한국은행 월평균 원/달러 환율(매매기준율) → 12개월 평균"""
    old = load(HOME)
    now = utc_now()
    this_year = now.year
    out = {'unit': {'cpi': '2020=100', 'dep': '정기예금 신규 금리(연 %)', 'won': '원 환산'}, 'years': {}}
    # 1) ECOS (월·연 통계라 주 1회만 다시 받음)
    ecos = old.get('ecos') or {}
    fetched = old.get('ecosFetched')
    stale = not fetched or (now - datetime.datetime.fromisoformat(fetched)).days >= HOME_ECOS_REFRESH_DAYS
    if stale or not all(ecos.get(k) for k in ('cpi', 'dep', 'fxm', 'fxa')):
        try:
            cpi = ecos_series('901Y009', 'A', 1990, this_year, '0')                       # 소비자물가지수 총지수
            dep = ecos_series('121Y002', 'A', 1996, this_year, 'BEABAA211')               # 예금은행 정기예금 금리(신규취급액)
            fxa = ecos_series('731Y004', 'A', 1995, this_year, '0000001/0000100')         # 원/달러 연평균
            fxm = ecos_series('731Y004', 'M', '199501', f'{this_year}12', '0000001/0000100')  # 원/달러 월평균
            if not (50 < cpi.get('1995', 0) < 54 and 100 < cpi.get('2025', 0) < 130):    # 1995 ≈ 52.0, 2025 ≈ 116.6
                raise ValueError(f"물가지수 값 이상 (1995={cpi.get('1995')}, 2025={cpi.get('2025')})")
            if not (900 < fxa.get('2006', 0) < 1000):                                    # 2006 평균 ≈ 955.5
                raise ValueError(f"환율 값 이상 (2006={fxa.get('2006')})")
            ecos = {'cpi': cpi, 'dep': dep, 'fxa': fxa, 'fxm': fxm}
            fetched = now.replace(microsecond=0).isoformat()
            print(f'  ECOS 물가 {min(cpi)}~{max(cpi)} · 예금금리 {min(dep)}~{max(dep)} · 환율 월 {min(fxm)}~{max(fxm)}')
        except Exception as e:
            print('  ECOS 실패(직전값 유지):', e)
    out['ecosFetched'] = fetched
    out['ecos'] = ecos
    fxm = ecos.get('fxm') or {}
    # 2) 시장 자료 (주봉·일봉 → 월평균 → 연평균)
    hist = (load(HISTORY).get('series') or {})
    def won(mon):                       # 달러 월평균 × 원/달러 월평균
        return {m: v * fxm[m] for m, v in mon.items() if m in fxm}
    ser = {
        'kospi':   year_from_months(month_avg(hist.get('^KS11') or [])),
        'sp500':   year_from_months(month_avg(hist.get('^GSPC') or [])),
        'sp500k':  year_from_months(won(month_avg(hist.get('^GSPC') or []))),
        'ndx100k': year_from_months(won(month_avg(hist.get('^NDX') or []))),
        'goldk':   year_from_months(won(month_avg(hist.get('GC=F') or []))),
    }
    # S&P 500 배당 재투자 (SPY 일봉 + 분배금: 분배락일 종가로 재투자)
    spy = ((load(ETFCAGR).get('series') or {}).get('SPY')) or {}
    if spy.get('c'):
        d, days = spy['d0'], [spy['d0']]
        for g in spy['dd']:
            d += g
            days.append(d)
        dv = {}
        for dd_, a in spy.get('div') or []:
            dv[dd_] = dv.get(dd_, 0) + a
        tr, prev, pts = 1.0, None, []
        for day, px in zip(days, spy['c']):
            if prev is not None:
                tr *= (px + dv.get(day, 0)) / prev
            prev = px
            pts.append([day, tr])
        ser['spytrk'] = year_from_months(won(month_avg(pts)))
    re_years = (load(REALTY).get('years') or {})
    ser['seoul'] = {int(y): v['seoul']['mean'] for y, v in re_years.items() if v.get('seoul')}
    ser['gangnam'] = {int(y): v['gangnam']['mean'] for y, v in re_years.items() if v.get('gangnam')}
    ser['cpi'] = {int(k): v for k, v in (ecos.get('cpi') or {}).items()}
    ser['dep'] = {int(k): v for k, v in (ecos.get('dep') or {}).items()}
    ser['usdkrw'] = {int(k): v for k, v in (ecos.get('fxa') or {}).items()}
    years = sorted({y for s_ in ser.values() for y in s_ if 1995 <= y < this_year})   # 진행 중인 올해는 제외(연평균 미확정)
    for y in years:
        row = {k: round(v[y], 4) for k, v in ser.items() if y in v}
        if row:
            out['years'][str(y)] = row
    if not out['years'] or not ser['cpi']:
        print('  home.json: 자료 부족 — 직전값 유지')
        return
    out['ecos'] = {k: v for k, v in ecos.items() if k != 'fxm'} | {'fxm': fxm}
    save_if_changed(HOME, out, old)


def build_realty():
    old = load(REALTY)
    years = dict(old.get('years') or {})
    meta = dict(old.get('fetched') or {})
    now = utc_now()
    this_year = now.year
    todo = []
    for y in range(REALTY_FIRST_YEAR, this_year + 1):
        ys = str(y)
        last = meta.get(ys)
        recent = y >= this_year - 1
        stale = last is None or (recent and (now - datetime.datetime.fromisoformat(last)).days >= REALTY_REFRESH_DAYS)
        if ys not in years or stale:
            todo.append(y)
    if not todo:
        print('  realty.json: 최신 — 건너뜀')
        return
    t0 = time.time()
    deadline = t0 + REALTY_BUDGET_SEC
    log = []
    for y in todo[:REALTY_MAX_DOWNLOADS]:
        if time.time() > deadline:
            log.append(f'{y}: 시간 예산 소진 — 다음 실행'); break
        ty = time.time()
        try:
            rows = molit_apt_year(y, deadline=deadline)
            s, g = realty_stats(rows, '서울특별시 '), realty_stats(rows, '서울특별시 강남구 ')
            if not s:
                raise ValueError('거래 없음')
            years[str(y)] = {'seoul': s, 'gangnam': g}
            meta[str(y)] = now.replace(microsecond=0).isoformat()
            log.append(f"{y}: ok {len(rows)}행 {time.time() - ty:.0f}s")
            save_if_changed(REALTY, {'source': '국토교통부 실거래가 공개시스템 (아파트 매매, 계약일 기준, 해제 거래 제외)',
                                     'unit': '만원', 'years': dict(sorted(years.items())), 'fetched': dict(sorted(meta.items())),
                                     'log': log}, old)
            old = load(REALTY)
            print(f"  실거래 {y}: 서울 {s['n']:,}건 평균 {s['mean']:,}만원 · 강남구 {g['n'] if g else 0:,}건 평균 {g['mean'] if g else 0:,}만원")
        except Exception as e:
            log.append(f'{y}: 실패 {time.time() - ty:.0f}s {type(e).__name__}: {str(e)[:120]}')
            print(f'  실거래 {y} 실패(직전값 유지): {e}')
    if len(todo) > REALTY_MAX_DOWNLOADS:
        print(f'  실거래: 남은 연도 {len(todo) - REALTY_MAX_DOWNLOADS}개는 다음 실행에서 수집')
    save_if_changed(REALTY, {'source': '국토교통부 실거래가 공개시스템 (아파트 매매, 계약일 기준, 해제 거래 제외)',
                             'unit': '만원', 'years': dict(sorted(years.items())), 'fetched': dict(sorted(meta.items())),
                             'log': log}, old)


def main():
    os.makedirs(ROOT, exist_ok=True)
    old = load(MARKET)
    quotes, fails = dict(old.get('quotes') or {}), []
    for sym in QUOTES:
        alt, cur = ALT_QUOTE.get(sym) or {}, INDEX_CUR.get(sym, 'USD')
        sources = ([('네이버', lambda: naver_quote(NAVER_INDEX[sym]))] if sym in NAVER_INDEX else []) + \
                  ([('야후', lambda: build_quote(yahoo_chart(sym, 'range=1mo&interval=1d')))] if sym not in NO_YAHOO else []) + \
                  ([('EastMoney', lambda: em_quote(alt['em'], cur))] if 'em' in alt else []) + \
                  ([('CNBC', lambda: cnbc_quote(alt['cnbc'], cur))] if 'cnbc' in alt else []) + \
                  ([('트레이딩뷰', lambda: tv_quote(alt['tv']))] if 'tv' in alt else []) + \
                  ([('구글', lambda: google_quote(alt['google']))] if 'google' in alt else [])
        errs, ok = [], False
        for name, fn in sources:
            try:
                q = fn()
                if not fresh_enough(q):
                    raise ValueError(f'시세가 오래됨 ({utc_date(q["time"]).date()})')
                quotes[sym] = q
                if name != '야후' or errs: print(f'  {sym} ← {name} {q["price"]}' + (f'  (앞선 실패: {"; ".join(errs)})' if errs else ''))
                ok = True
                break
            except Exception as e:
                errs.append(f'{name}: {e}')
        if not ok:
            fails.append(sym); print(f'  {sym} 실패(직전값 유지): {"; ".join(errs)}')
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
    try:
        build_dxy()
    except Exception as e:
        print('  달러인덱스 데이터 실패(직전값 유지):', e)
    try:
        build_etfcagr()
    except Exception as e:
        print('  ETF CAGR 데이터 실패(직전값 유지):', e)
    try:
        build_compare()
    except Exception as e:
        print('  지수 비교 데이터 실패(직전값 유지):', e)

    oldh = load(HISTORY)
    age_h = 1e9
    if oldh.get('updated'):
        age_h = (utc_now() - datetime.datetime.fromisoformat(oldh['updated'][:-1])).total_seconds() / 3600
    if age_h >= HIST_MAX_AGE_H or oldh.get('v') != HIST_VERSION or set(HIST) - set((oldh.get('series') or {})) or '--history' in sys.argv:
        series, p1 = dict(oldh.get('series') or {}), int(time.time() - HIST_YEARS * 365.25 * 86400)
        for sym in HIST:
            ypts = []
            try:
                if sym not in NO_YAHOO:
                    ypts = [[t // 86400, c] for t, c in points(yahoo_chart(sym, f'period1={p1}&period2={int(time.time())}&interval=1wk'), 2)]
            except Exception as e:
                print(f'  {sym} 야후 히스토리 실패: {e}')
            npts = []
            if sym in NAVER_INDEX:
                try:
                    npts = naver_history(NAVER_INDEX[sym], HIST_YEARS)
                except Exception as e:
                    print(f'  {sym} 네이버 히스토리 실패: {e}')
            # 야후 과거 데이터가 없거나(^DJUSSC·CSI300 등) 31년 앞부분이 비면(상해종합·대만 1997~) 보조 주봉으로 채움
            alt, d1 = ALT_QUOTE.get(sym) or {}, p1 // 86400
            hist_alts = ([('EastMoney', lambda: em_history(alt['em']))] if 'em' in alt else []) + \
                        ([('CNBC', lambda: cnbc_history(alt['cnbc'], '1W'))] if 'cnbc' in alt else [])
            for name, fn in hist_alts:
                if len(ypts) > 50 and ypts[0][0] <= d1 + 60:
                    break
                try:
                    got = [p for p in fn() if p[0] >= d1]
                except Exception as e:
                    print(f'  {sym} {name} 히스토리 실패: {e}')
                    continue
                print(f'  {sym} 야후 히스토리 {len(ypts)}개 → {name} {len(got)}개로 보충')
                if len(got) > 50:
                    ypts = merge_older(ypts, got) if len(ypts) > 50 else got
            merged = merge_older(npts, ypts) if npts else ypts   # 국내 지수는 네이버 우선 · [일수, 종가]
            if sym in HIST_RANGE:
                lo, hi = HIST_RANGE[sym]
                n0 = len(merged)
                merged = [p for p in merged if lo <= p[1] <= hi]
                if n0 != len(merged):
                    print(f'  {sym} 범위({lo}~{hi}) 밖 값 {n0 - len(merged)}개 제외')
            if len(merged) > 50:
                series[sym] = merged
                start_d = datetime.date.fromordinal(719163 + merged[0][0])
                warn = '' if (datetime.date.today() - start_d).days > 15.2 * 365 else '  ⚠ 15년치 부족'
                print(f'  {sym} 히스토리 {len(merged)}개 (시작 {start_d}){warn}')
            else:
                print(f'  {sym} 히스토리 부족(직전값 유지)')
        save_if_changed(HISTORY, {'unit': 'day', 'v': HIST_VERSION, 'series': series}, oldh)
    try:
        build_realty()
    except Exception as e:
        print('  실거래가 데이터 실패(직전값 유지):', e)
    try:
        build_home()
    except Exception as e:
        print('  홈 화면 데이터 실패(직전값 유지):', e)
    print(f'완료 — 시세 {len(QUOTES) - len(fails)}/{len(QUOTES)} 성공')
    if len(fails) == len(QUOTES):
        sys.exit(1)   # 전부 실패하면 Actions에 빨간불로 표시


if __name__ == '__main__':
    main()
