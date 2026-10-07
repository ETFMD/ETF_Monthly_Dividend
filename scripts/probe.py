import urllib.request, re, json, ssl, urllib.parse
UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
NV=ssl.create_default_context(); NV.check_hostname=False; NV.verify_mode=ssl.CERT_NONE
def get(u, ctx=None, data=None, h=None, form=False):
    try:
        if isinstance(data,dict):
            if form: data=urllib.parse.urlencode(data).encode(); h=dict(h or {}, **{'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8','X-Requested-With':'XMLHttpRequest'})
            else: data=json.dumps(data).encode(); h=dict(h or {}, **{'Content-Type':'application/json'})
        r=urllib.request.urlopen(urllib.request.Request(u,data=data,headers={'User-Agent':UA,'Accept':'application/json, text/html, */*',**(h or {})}),timeout=25,context=ctx); return r.status, r.read().decode('utf-8','replace')
    except urllib.error.HTTPError as e: return e.code, e.read()[:200].decode('utf-8','replace')
    except Exception as e: return 0, repr(e)[:150]
def sh(t,n=900): return re.sub(r'\s+',' ',t)[:n]
print('##### ACE base')
s,h=get('https://www.aceetf.co.kr/fund/K55101DO9015')
srcs=re.findall(r'src="(/_next/static/[^"]+\.js)"',h)
for sp in srcs:
    s,js=get('https://www.aceetf.co.kr'+sp)
    for m in re.finditer(r'QH:function\(\)\{return (\w+)\}',js): 
        v=m.group(1); mm=re.search(r'\b'+v+r'="([^"]+)"',js) or re.search(r'\b'+v+r'=([^,;]+)',js); print(sp[-40:],'QH ->',v, mm.group(1)[:200] if mm else None)
    for m in re.findall(r'"(https://[a-z0-9.-]*aceetf[a-z0-9./-]*)"',js)[:10]: print(sp[-40:],'url',m)
print('##### SOL list')
for u in ['https://www.soletf.com/ko/fund/etf','https://www.soletf.com/ko/fund/etf/list','https://www.soletf.com/ko/fund']:
    s,h=get(u); codes=sorted(set(re.findall(r'/fund/etf/(\d{6})',h))); print(u,s,len(h),len(codes),codes[:10])
print('##### PLUS')
s,t=get('https://www.plusetf.co.kr/api/v1/product/find/list',data={'searchSortTy':'fn1m','searchSort':'DESC','page':0,'fundType':'','productOption':''}); print(s,sh(t,1500))
try:
    d=json.loads(t); it=d['content'][0]; print(list(it.keys())); pid=it.get('id')
    s,h=get('https://www.plusetf.co.kr/product/detail?n=%s'%pid); print('detail',s,len(h))
    i=h.find('과세'); print(sh(h[max(0,i-1500):i+1500],3000))
    for m in sorted(set(re.findall(r"url\s*:\s*['\"]([^'\"]+)['\"]",h))): print('PLUS ajax',m)
except Exception as e: print('ERR',e)
print('##### KIWOOM')
for u,d in [('https://www.kiwoometf.com/service/etf/KO02010100MAjax',{}),('https://www.kiwoometf.com/service/main/productListAjax',{})]:
    s,t=get(u,NV,data=d,form=True); print(u,s,sh(t,800))
    g=re.findall(r'"gcode"\s*:\s*"([^"]+)"',t)[:3]; print('gcodes',g)
    if g:
        s,h=get('https://www.kiwoometf.com/service/etf/KO02010200M?gcode='+g[0],NV); i=h.find('과세'); print('detail',s,len(h)); print(sh(h[max(0,i-1500):i+800],2300))
        for m in sorted(set(re.findall(r"url\s*:\s*['\"]([^'\"]+)['\"]",h))): print('KIWOOM ajax',m)
        break
