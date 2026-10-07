import urllib.request, re
UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
for u in ['https://www.samsungfund.com/etf/main.do','https://www.samsungfund.com/','https://www.riseetf.co.kr/','https://www.aceetf.co.kr/','https://www.soletf.com/','https://www.plusetf.co.kr/','https://www.kiwoometf.com/','https://www.tigeretf.com/','https://seibro.or.kr/','https://data.krx.co.kr/','https://www.hanaroetf.com/','https://www.koact.co.kr/']:
    try:
        r=urllib.request.urlopen(urllib.request.Request(u,headers={'User-Agent':UA,'Accept':'text/html'}),timeout=20); b=r.read(); print(u, r.status, len(b))
    except Exception as e: print(u, 'ERR', repr(e)[:120])
