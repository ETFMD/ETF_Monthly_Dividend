import urllib.request, re, json
UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
def get(u, h=None, data=None):
    try: return urllib.request.urlopen(urllib.request.Request(u,data=data,headers={'User-Agent':UA,**(h or {})}),timeout=25).read().decode('utf-8','replace')
    except Exception as e: return 'ERR '+repr(e)
base='https://www.samsungfund.com'
h=get(base+'/etf/product/distribution.do')
srcs=re.findall(r'<script[^>]+src="([^"]+)"',h); print(srcs)
for s in srcs:
    if 'google' in s or 'kakao' in s or 'daum' in s: continue
    u=s if s.startswith('http') else base+s
    js=get(u); print(u, len(js))
    for p in sorted(set(re.findall(r'["\'`](/api/[A-Za-z0-9_./?=&-]+)', js))): print('   ', p)
    for m in list(re.finditer(r'distribution', js))[:6]: print('  ::', js[max(0,m.start()-250):m.start()+250].replace('\n',' '))
