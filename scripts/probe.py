import urllib.request, urllib.parse, json, re, http.cookiejar
UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
cj=http.cookiejar.CookieJar(); op=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
def req(url, data=None, h=None):
    if isinstance(data, dict): data=urllib.parse.urlencode(data).encode()
    r=urllib.request.Request(url, data=data, headers={'User-Agent':UA,'Accept':'*/*', **(h or {})})
    return op.open(r, timeout=30).read()
def dec(b):
    m=re.search(rb'charset=["\']?([\w-]+)', b[:3000]); enc=(m.group(1).decode() if m else 'utf-8')
    return b.decode(enc,'replace')
for acpt in ['20260928000287','20260928000137','20260928000183']:
    v=req('https://kind.krx.co.kr/common/disclsviewer.do?method=search&acptno='+acpt).decode('utf-8','replace')
    doc=re.search(r"<option value='(\d+)\|[YN]'", v).group(1); print('=====',acpt,doc)
    c=dec(req('https://kind.krx.co.kr/common/disclsviewer.do?method=searchContents&docNo='+doc)); print(c[:1500])
    paths=re.findall(r"""['"]((?:https?://[^'"]+)?/external/[^'"]+\.htm)['"]""", c); print(paths)
    if not paths: continue
    p=paths[0] if paths[0].startswith('http') else 'https://kind.krx.co.kr'+paths[0]
    h=dec(req(p)); print('len',len(h))
    tables=re.findall(r'<table.*?</table>',h,re.S|re.I); print('tables',len(tables))
    for tb in tables[:4]:
        rows=re.findall(r'<tr.*?</tr>',tb,re.S|re.I); print('rows',len(rows))
        for r in rows[:8]: print([re.sub(r'\s+',' ',re.sub('<[^>]+>','',x)).strip() for x in re.findall(r'<t[dh][^>]*>(.*?)</t[dh]>',r,re.S|re.I)])
    print(re.sub(r'\s+',' ',re.sub(r'<[^>]+>',' ',h))[:2500])
