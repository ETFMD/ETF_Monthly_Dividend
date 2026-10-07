import urllib.request, re, json, ssl, urllib.parse
UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
NV=ssl.create_default_context(); NV.check_hostname=False; NV.verify_mode=ssl.CERT_NONE
def get(u, ctx=None, data=None, h=None):
    try:
        if isinstance(data,dict): data=json.dumps(data).encode(); h=dict(h or {}, **{'Content-Type':'application/json'})
        r=urllib.request.urlopen(urllib.request.Request(u,data=data,headers={'User-Agent':UA,'Accept':'application/json, text/html, */*',**(h or {})}),timeout=25,context=ctx); return r.status, r.read().decode('utf-8','replace')
    except urllib.error.HTTPError as e: return e.code, e.read()[:200].decode('utf-8','replace')
    except Exception as e: return 0, repr(e)[:150]
def sh(t,n=900): return re.sub(r'\s+',' ',t)[:n]
print('##### ACE')
s,h=get('https://www.aceetf.co.kr/fund/K55101DO9015')
chunk=[m for m in re.findall(r'src="([^"]+fundCode[^"]+\.js)"',h)]
print(chunk)
if chunk:
    s,js=get('https://www.aceetf.co.kr'+chunk[0])
    for m in list(re.finditer(r'getFundDividendListUsingGet|dividendList|/api/funds/',js))[:6]: print(' ::', sh(js[max(0,m.start()-300):m.start()+300],600))
s,app=get('https://www.aceetf.co.kr'+re.findall(r'src="([^"]+_app[^"]+\.js)"',h)[0])
for m in list(re.finditer(r'BASE|baseURL|BASE_URL',app))[:5]: print(' base::', sh(app[max(0,m.start()-200):m.start()+200],400))
for u in ['https://www.aceetf.co.kr/api/funds/K55101DO9015/dividend?page=1&size=10','https://www.aceetf.co.kr/api/funds/K55101DO9015','https://www.aceetf.co.kr/api/funds?keyword=&page=1&size=5']:
    s,t=get(u); print(u,s,sh(t,600))
print('##### SOL')
for u,d in [('https://www.soletf.com/api/etf/pds/search',None),('https://www.soletf.com/api/common/searchByEtfNameOrFilter?keyword=SOL',None),('https://www.soletf.com/api/common/getKeywordList',None)]:
    s,t=get(u); print(u,s,sh(t,600))
s,h=get('https://www.soletf.com/ko/fund/etf/210942'); print('SOL detail ticker?', re.findall(r'(\b\d{6}\b|\b0\d{3}[A-Z]\d\b)',sh(h,200000))[:20])
print('##### PLUS')
s,h=get('https://www.plusetf.co.kr/product/k-divid'); print(sorted(set(re.findall(r'href="(/product/[^"]+)"',h)))[:20])
i=h.find('/api/v1/product/find/list'); print(sh(h[max(0,i-1500):i+800],2300))
print('##### KIWOOM')
s,h=get('https://www.kiwoometf.com/service/etf/KO02010100M',NV); g=re.findall(r'gcode=([A-Za-z0-9]+)',h)[:5]; print('gcodes',g); print(sorted(set(re.findall(r'["\'](/service/[^"\']+)["\']',h)))[:30])
