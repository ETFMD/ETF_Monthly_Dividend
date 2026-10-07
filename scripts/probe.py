import urllib.request, re, json
UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
def get(u, h=None):
    try: return urllib.request.urlopen(urllib.request.Request(u,headers={'User-Agent':UA,**(h or {})}),timeout=25).read().decode('utf-8','replace')
    except Exception as e: return 'ERR '+repr(e)
base='https://www.samsungfund.com'
h=get(base+'/etf/product/distribution.do')
print(re.findall(r'<script[^>]*>([^<]{0,600})</script>',h)[:10]); print(re.findall(r'id="([^"]*root[^"]*)"|data-[a-z-]+="[^"]*"',h)[:20])
js=get(base+'/assets/js/index.js')
allapi=sorted(set(re.findall(r'["\'`](/api/v1/[A-Za-z0-9_./-]+)', js))); print(allapi)
for kw in ['distribution','Distribution','분배금 현황','dvdn','DVDN','alloc','Alloc','bunbae','BUNBAE']:
    ms=list(re.finditer(kw, js)); print(kw,len(ms))
    for m in ms[:4]:
        seg=js[max(0,m.start()-400):m.start()+400]
        if '/api' in seg or 'axios' in seg or 'fetch' in seg: print('  ::', seg.replace('\n',' ')[:800])
