#!/usr/bin/env python3
"""
전세계 시가총액 TOP 100 — GitHub Actions 에서 하루 한 번(미국장 마감 뒤) 실행 · 표준 라이브러리만 사용

만드는 파일
  data/mcap.json      : 시가총액 상위 100개 기업 (순위·전 거래일 순위·시가총액(USD)·주가·등락률·국가)
  data/mcap_hist.json : 날짜별 상위 100 순위 기록 (최근 400거래일) — 순위 변동 계산용

자료
  · 순위·시가총액(USD 환산)·주가(USD): companiesmarketcap.com 전체 기업 CSV (Yahoo Finance 시세 기반)
  · 당일 등락률·현지 통화 주가·기준 시각: Yahoo Finance quote (같은 티커)
원칙
  · 받아 온 자료가 이상하면(행 수 부족·1위 시총이 너무 작음 등) 저장하지 않고 직전 값을 유지
  · 같은 거래일에 다시 실행하면 값만 새로 고치고 '전 거래일 순위'는 그대로 둠
"""
import csv, io, json, os, sys, time, html, datetime, http.cookiejar, urllib.request
from zoneinfo import ZoneInfo
NY = ZoneInfo('America/New_York')
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data')
OUT, HIST = os.path.join(ROOT, 'mcap.json'), os.path.join(ROOT, 'mcap_hist.json')
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
TOP, HIST_DAYS = 100, 400
CSV_URL = 'https://companiesmarketcap.com/?download=csv'

def fetch(url, opener=None, tries=3):
    err = None
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': '*/*'})
            with (opener.open(req, timeout=40) if opener else urllib.request.urlopen(req, timeout=40)) as r:
                return r.read()
        except Exception as e:
            err = e; time.sleep(3 * (i + 1))
    raise err

def load(path):
    try:
        with open(path, encoding='utf-8') as f: return json.load(f)
    except Exception: return None

def companies():
    text = fetch(CSV_URL).decode('utf-8', 'replace')
    rows = []
    for r in csv.DictReader(io.StringIO(text)):
        try:
            m, p = float(r['marketcap']), float(r['price (USD)'])
        except (KeyError, ValueError):
            continue
        sym = (r.get('Symbol') or '').strip()
        if m <= 0 or not sym: continue
        rows.append({'n': html.unescape(r['Name']).strip(), 's': sym, 'c': (r.get('country') or '').strip(), 'm': m, 'p': p})
    rows.sort(key=lambda x: -x['m'])
    return rows

def yahoo(symbols):
    """심볼 → {ch: 등락률(%), cur, lp: 현지 주가, t: 시세 시각(초)} · 실패한 심볼은 빠짐"""
    out = {}
    try:
        cj = http.cookiejar.CookieJar(); op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
        try: fetch('https://fc.yahoo.com', op, 1)
        except Exception: pass
        crumb = fetch('https://query1.finance.yahoo.com/v1/test/getcrumb', op).decode().strip()
        for i in range(0, len(symbols), 50):
            part = ','.join(symbols[i:i + 50])
            d = json.loads(fetch('https://query1.finance.yahoo.com/v7/finance/quote?symbols=' + urllib.request.quote(part, safe=',') + '&crumb=' + urllib.request.quote(crumb), op))
            for q in (d.get('quoteResponse') or {}).get('result') or []:
                ch = q.get('regularMarketChangePercent')
                out[q.get('symbol')] = {'ch': round(ch, 2) if isinstance(ch, (int, float)) else None, 'cur': q.get('currency'),
                                        'lp': q.get('regularMarketPrice'), 't': q.get('regularMarketTime')}
    except Exception as e:
        print('Yahoo 시세 실패:', e, file=sys.stderr)
    return out

def main():
    rows = companies()
    if len(rows) < TOP + 20 or rows[0]['m'] < 1e12:
        sys.exit('기업 목록 이상 (행 %d, 1위 %s) — 저장하지 않음' % (len(rows), rows[0]['m'] if rows else None))
    top = rows[:TOP]
    q = yahoo([r['s'] for r in top])
    print('Yahoo 시세 %d/%d' % (len(q), len(top)))
    # 기준 거래일: 미국 대형주(상위 미국 기업들)의 마지막 시세 시각 → 뉴욕 날짜
    ts = [q[r['s']]['t'] for r in top if r['c'] == 'United States' and r['s'] in q and q[r['s']].get('t')]
    as_of = datetime.datetime.fromtimestamp(max(ts), NY).date().isoformat() if ts else datetime.datetime.now(NY).date().isoformat()

    old = load(OUT) or {}
    if old.get('asOf') == as_of:                        # 같은 거래일 다시 실행 → 전 거래일 순위 유지
        prev = old.get('prevRanks') or {}
        prev_date = old.get('prevDate')
    else:
        prev = {r['s']: r['r'] for r in old.get('rows', [])}
        prev_date = old.get('asOf')
    out_rows = []
    for i, r in enumerate(top):
        y = q.get(r['s']) or {}
        out_rows.append({'r': i + 1, 'pr': prev.get(r['s']), 'n': r['n'], 's': r['s'], 'c': r['c'],
                         'm': round(r['m']), 'p': r['p'], 'ch': y.get('ch'), 'cur': y.get('cur'), 'lp': y.get('lp')})
    data = {'asOf': as_of, 'prevDate': prev_date, 'prevRanks': prev,
            'updated': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
            'source': 'companiesmarketcap.com · Yahoo Finance', 'total': round(sum(r['m'] for r in top)), 'rows': out_rows}
    # 내용이 같으면(주말·휴장) 다시 쓰지 않음 — updated 만 다른 경우 제외
    if old and {k: v for k, v in old.items() if k != 'updated'} == {k: v for k, v in data.items() if k != 'updated'}:
        print('변경 없음'); return
    with open(OUT, 'w', encoding='utf-8') as f: json.dump(data, f, ensure_ascii=False, separators=(',', ':'))
    hist = load(HIST) or {}
    hist[as_of] = [[r['s'], r['m']] for r in out_rows]
    for k in sorted(hist)[:-HIST_DAYS]: del hist[k]
    with open(HIST, 'w', encoding='utf-8') as f: json.dump(hist, f, ensure_ascii=False, separators=(',', ':'))
    print('저장: 기준일 %s · 1위 %s %.2f조 달러' % (as_of, out_rows[0]['n'], out_rows[0]['m'] / 1e12))

if __name__ == '__main__':
    main()
