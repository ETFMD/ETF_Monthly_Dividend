import urllib.request, urllib.parse, json, re, http.cookiejar
UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
cj=http.cookiejar.CookieJar(); op=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
def req(url, data=None, h=None):
    if isinstance(data, dict): data=urllib.parse.urlencode(data).encode()
    r=urllib.request.Request(url, data=data, headers={'User-Agent':UA,'Accept':'*/*', **(h or {})})
    return op.open(r, timeout=30).read()
v=req('https://kind.krx.co.kr/common/disclsviewer.do?method=search&acptno=20260928000287').decode('utf-8','replace')
for m in re.finditer(r'<select.*?</select>', v, re.S): print('SELECT', m.group(0)[:1500])
for kw in ['searchContents','docNo','mainDoc','setPath','external']:
    for m in re.finditer(kw, v): print(kw, '::', v[max(0,m.start()-150):m.start()+250].replace('\n',' ')); 
print(v[-4000:])
