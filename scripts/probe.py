import urllib.request, re, json
UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
def get(u, h=None, data=None):
    try:
        r=urllib.request.urlopen(urllib.request.Request(u,data=data,headers={'User-Agent':UA,'Accept':'application/json, text/html, */*',**(h or {})}),timeout=25); return r.status, r.read().decode('utf-8','replace')
    except urllib.error.HTTPError as e: return e.code, e.read()[:300].decode('utf-8','replace')
    except Exception as e: return 0, repr(e)[:200]
def show(lbl,u,n=1500,h=None):
    s,t=get(u,h); print('=====',lbl,s,u,len(t)); print(re.sub(r'\s+',' ',t)[:n])
    return t
# ACE
s,h=get('https://www.aceetf.co.kr/'); js=[x for x in re.findall(r'src="([^"]+_app[^"]+\.js)"',h)]
s,app=get('https://www.aceetf.co.kr'+js[0]) if js else (0,'')
print('ACE api paths', sorted(set(re.findall(r'["`](/api/[A-Za-z0-9_/{}$.-]+)', app)))[:80])
for m in list(re.finditer(r'/dividend', app))[:3]: print('ctx', app[max(0,m.start()-400):m.start()+200].replace('\n',' '))
show('ACE try ticker','https://www.aceetf.co.kr/api/funds/0139P0/dividend')
show('ACE try code','https://www.aceetf.co.kr/api/funds/K55101D69599/dividend')
# SOL
show('SOL page','https://www.soletf.com/fund/etf/210942/dividend',3000)
show('SOL api','https://www.soletf.com/api/etf/pds/dividend/210942')
s,js=get('https://www.soletf.com/static/pc/js/ko/etf_pds.js'); i=js.find('/api/etf/pds/dividend/'); print('SOL js ctx', js[max(0,i-1500):i+1500])
# PLUS
t=show('PLUS k-divid','https://www.plusetf.co.kr/product/k-divid',4000)
for m in sorted(set(re.findall(r'["\'](/[A-Za-z0-9_/.-]*(?:divid|Divid|ajax|api)[A-Za-z0-9_/.?=&-]*)["\']', t)))[:40]: print('PLUS url', m)
