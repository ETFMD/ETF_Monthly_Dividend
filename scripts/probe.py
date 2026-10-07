import urllib.request, re, json
UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
def get(u, h=None):
    try: return urllib.request.urlopen(urllib.request.Request(u,headers={'User-Agent':UA,'Referer':'https://www.samsungfund.com/etf/product/distribution.do','Accept':'application/json',**(h or {})}),timeout=25).read().decode('utf-8','replace')
    except Exception as e: return 'ERR '+repr(e)
base='https://www.samsungfund.com'
t=get(base+'/api/v1/kodex/distribution.do?pageNo=1'); print(t[:3000])
js=get(base+'/assets/js/product.js')
for kw in ['/api/v1/kodex/distribution.do','divid-info.do']:
    for m in list(re.finditer(re.escape(kw), js))[:2]: print('::', js[max(0,m.start()-600):m.start()+1500].replace('\n',' ')); print()
try:
    d=json.loads(t); print(json.dumps(d,ensure_ascii=False)[:2500])
except Exception as e: print(e)
t=get(base+'/api/v1/kodex/divid-info.do?id=2ETFV7'); print('divid-info', t[:2500])
