import urllib.request, urllib.parse, re, json, http.cookiejar
UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
cj=http.cookiejar.CookieJar(); op=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
def get(u, data=None, h=None):
    if isinstance(data, dict): data=urllib.parse.urlencode(data).encode()
    try:
        b=op.open(urllib.request.Request(u,data=data,headers={'User-Agent':UA,'Accept':'*/*',**(h or {})}),timeout=30).read()
        m=re.search(rb'charset=["\']?([\w-]+)', b[:3000]); return b.decode(m.group(1).decode() if m else 'utf-8','replace')
    except Exception as e: return 'ERR '+repr(e)
t=get('https://investments.miraeasset.com/tigeretf/ko/distribution/overall/list.do')
print(len(t)); txt=re.sub(r'\s+',' ',re.sub(r'<script.*?</script>|<style.*?</style>','',t,flags=re.S)); txt=re.sub(r'<[^>]+>',' | ',txt); txt=re.sub(r'(\s*\|\s*)+',' | ',txt)
i=txt.find('과세'); print(txt[max(0,i-3000):i+3000] if i>=0 else txt[:5000])
for m in re.finditer(r'(?:url|action)\s*[:=]\s*["\']([^"\']+\.(?:do|json|ajax)[^"\']*)', t): print('URL', m.group(1))
for m in re.finditer(r'<form[^>]*>', t): print('FORM', m.group(0)[:200])
