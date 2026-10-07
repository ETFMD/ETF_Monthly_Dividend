import urllib.request, re
UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
def get(u):
    try: return urllib.request.urlopen(urllib.request.Request(u,headers={'User-Agent':UA}),timeout=25).read().decode('utf-8','replace')
    except Exception as e: return 'ERR '+repr(e)
base='https://www.samsungfund.com'
h=get(base+'/etf/main.do')
srcs=re.findall(r'<script[^>]+src="([^"]+)"',h); print(srcs)
links=sorted(set(re.findall(r'href="(/etf/[^"]+)"',h))); print(links[:80])
for s in srcs:
    u=s if s.startswith('http') else base+s
    js=get(u)
    hits=set(re.findall(r'["\'](/api/[^"\']{3,120})["\']',js)) | set(re.findall(r'["\']([^"\']*(?:distr|dvd|Dvd|Distr|divid)[^"\']{0,80})["\']',js))
    if hits: print('JS',u,len(js),sorted(hits)[:60])
