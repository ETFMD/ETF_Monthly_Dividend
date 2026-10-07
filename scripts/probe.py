import urllib.request, re, json
UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
def get(u, h=None):
    try: return urllib.request.urlopen(urllib.request.Request(u,headers={'User-Agent':UA,**(h or {})}),timeout=25).read().decode('utf-8','replace')
    except Exception as e: return 'ERR '+repr(e)
base='https://www.samsungfund.com'
js=get(base+'/assets/js/index.js')
paths=sorted(set(re.findall(r'/api/v1/kodex/[A-Za-z0-9_./-]+', js))); print(paths)
for kw in ['distribution.do','tax','Txtn','txtn','gwase','GWASE','과세']:
    for m in list(re.finditer(re.escape(kw), js))[:3]: print(kw,'::',js[max(0,m.start()-300):m.start()+300].replace('\n',' ')[:600]); print()
h=get(base+'/etf/product/distribution.do'); print(len(h)); print(re.sub(r'\s+',' ',re.sub(r'<[^>]+>',' ',re.sub(r'<script.*?</script>','',h,flags=re.S)))[:1500])
