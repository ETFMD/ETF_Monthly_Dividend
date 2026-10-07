import urllib.request, re, json, ssl
UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
NV=ssl.create_default_context(); NV.check_hostname=False; NV.verify_mode=ssl.CERT_NONE
def get(u, ctx=None):
    try:
        r=urllib.request.urlopen(urllib.request.Request(u,headers={'User-Agent':UA,'Accept':'*/*'}),timeout=25,context=ctx); return r.status, r.read().decode('utf-8','replace')
    except urllib.error.HTTPError as e: return e.code, ''
    except Exception as e: return 0, ''
def absu(base, m): return m if m.startswith('http') else (('https:'+m) if m.startswith('//') else base+('' if m.startswith('/') else '/')+m)
def scan(name, base, pages, ctx=None):
    print('#####', name)
    seen=set()
    for p in pages:
        s,h=get(absu(base,p),ctx); print(' page',p,s,len(h))
        docs=[('page '+p,h)]
        for m in re.findall(r'src="([^"]+\.js[^"]*)"',h):
            if any(x in m for x in ('google','kakao','daum','jquery','gtm','facebook','naver')) or m in seen: continue
            seen.add(m); s2,js=get(absu(base,m),ctx); docs.append((m[-60:],js))
        for lbl,t in docs:
            for kw in ['과세표준','과표']:
                for mm in list(re.finditer(kw,t))[:2]:
                    print('  [%s] %s :: %s'%(lbl,kw,re.sub(r'\s+',' ',t[max(0,mm.start()-500):mm.start()+400])))
            apis=sorted(set(re.findall(r'["\'`]((?:https?://[^"\'`\s]+)?/(?:api|ajax|data|json)[A-Za-z0-9_/{}$.?=&-]*)["\'`]',t)))
            if apis: print('  [%s] apis %s'%(lbl,apis[:30]))
scan('ACE','https://www.aceetf.co.kr',['/','/fund/K55101DO9015'])
scan('SOL','https://www.soletf.com',['/ko/main','/ko/fund/etf/210942'])
scan('PLUS','https://www.plusetf.co.kr',['/product/k-divid','/product/detail?n=006313'])
scan('HANARO','https://www.hanaroetf.com',['/','/fund/etf-sumnmary'])
scan('KIWOOM','https://www.kiwoometf.com',['/service/etf/KO02010100M'],NV)
scan('WON','https://www.wooriam.kr',['/investment/etf-list','/investment/etf-view/E14ljTVNUg2Qik6g'])
scan('1Q','https://www.hanaam.com',['/qetf/main'])
scan('TIME','https://timeetf.co.kr',['/'])
