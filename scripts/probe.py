import urllib.request, json, http.cookiejar, csv, io, time
UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
def get(url, op=None, h=None):
    r=urllib.request.Request(url, headers={'User-Agent':UA, 'Accept':'*/*', **(h or {})})
    return (op.open(r,timeout=30) if op else urllib.request.urlopen(r,timeout=30)).read()
print('== companiesmarketcap csv')
try:
    t=get('https://companiesmarketcap.com/?download=csv').decode('utf-8','replace')
    rows=list(csv.reader(io.StringIO(t))); print(len(rows)); print('\n'.join(','.join(r) for r in rows[:12]))
    print('...'); print('\n'.join(','.join(r) for r in rows[95:105]))
except Exception as e: print('ERR',e)
print('== companiesmarketcap html page 1 (for change %)')
try:
    t=get('https://companiesmarketcap.com/').decode('utf-8','replace'); print(len(t)); i=t.find('<tbody'); print(t[i:i+3000])
except Exception as e: print('ERR',e)
print('== yahoo crumb')
try:
    cj=http.cookiejar.CookieJar(); op=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
    try: get('https://fc.yahoo.com', op)
    except Exception as e: print('fc',e)
    cr=get('https://query1.finance.yahoo.com/v1/test/getcrumb', op).decode(); print('crumb',cr)
    q=get('https://query1.finance.yahoo.com/v7/finance/quote?symbols=AAPL,2222.SR,005930.KS,TSM,2330.TW,0700.HK,BRK-B,ASML.AS&crumb='+cr, op)
    for x in json.loads(q)['quoteResponse']['result']: print(x.get('symbol'),x.get('shortName'),x.get('currency'),x.get('marketCap'),x.get('regularMarketPrice'),x.get('regularMarketChangePercent'),x.get('regularMarketTime'))
except Exception as e: print('ERR',e)
