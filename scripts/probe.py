import urllib.request, re, json, ssl
UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
NV=ssl.create_default_context(); NV.check_hostname=False; NV.verify_mode=ssl.CERT_NONE
def get(u, h=None, data=None, ctx=None):
    try:
        r=urllib.request.urlopen(urllib.request.Request(u,data=data,headers={'User-Agent':UA,'Accept':'application/json, text/html, */*',**(h or {})}),timeout=25,context=ctx); return r.status, r.read().decode('utf-8','replace')
    except urllib.error.HTTPError as e: return e.code, e.read()[:300].decode('utf-8','replace')
    except Exception as e: return 0, repr(e)[:200]
def sh(t,n=1200): return re.sub(r'\s+',' ',t)[:n]
# SOL render mapping
s,js=get('https://www.soletf.com/static/pc/js/ko/etf_pds.js'); i=js.find('success: function(data)'); j=js.find('DIVIDEND_PRI'); print('SOL map', sh(js[j-800:j+900],1700))
s,t=get('https://www.soletf.com/api/etf/pds/list'); print('SOL list?',s,sh(t,300))
# ACE fund list
s,t=get('https://www.aceetf.co.kr/api/funds?page=1&size=5'); print('ACE funds',s,sh(t,1500))
s,t=get('https://www.aceetf.co.kr/api/funds/main'); print('ACE main',s,sh(t,600))
# PLUS
s,t=get('https://www.plusetf.co.kr/api/v1/product/find/list'); print('PLUS list',s,sh(t,800))
s,h=get('https://www.plusetf.co.kr/product/k-divid'); 
for m in sorted(set(re.findall(r'src="([^"]+\.js[^"]*)"',h)))[:15]:
    u=m if m.startswith('http') else 'https://www.plusetf.co.kr/'+m.lstrip('./')
    s2,js=get(u); hits=sorted(set(re.findall(r'["\'`](/api/[A-Za-z0-9_/{}$.?=&-]+)',js)))
    if hits: print('PLUS js',u[-50:],hits[:40])
# HANARO, KIWOOM, 1Q, WON, TIME : list api paths in their pages/js
for name,base,ctx in [('HANARO','https://www.hanaroetf.com',None),('KIWOOM','https://www.kiwoometf.com',NV),('1Q','https://www.hanaam.com',None),('WON','https://www.wooriam.kr',None),('TIME','https://timeetf.co.kr',None)]:
    s,h=get(base+'/',ctx=ctx); srcs=[x for x in re.findall(r'src="([^"]+\.js[^"]*)"',h) if 'google' not in x and 'kakao' not in x][:15]
    found=set()
    for m in srcs:
        u=m if m.startswith('http') else (('https:'+m) if m.startswith('//') else base+('/' if not m.startswith('/') else '')+m)
        s2,js=get(u,ctx=ctx)
        found|=set(re.findall(r'["\'`]((?:/[A-Za-z0-9_-]+){1,6}(?:\.do|\.json|\.ajax)?(?:\?[^"\'`]{0,40})?)["\'`]',js))
    hrefs=set(re.findall(r'href="(/[^"]{3,80})"',h))
    print('=====',name,s,len(h)); print(' api-ish', sorted(x for x in found if re.search(r'(?i)divid|distr|alloc|dvd|bunbae|tax|api',x))[:40]); print(' hrefs', sorted(x for x in hrefs if re.search(r'(?i)divid|distr|alloc|dvd|bunbae|product|etf',x))[:30])
