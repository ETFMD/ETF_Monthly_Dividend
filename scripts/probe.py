import urllib.request, re, http.cookiejar
UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
cj=http.cookiejar.CookieJar(); op=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
def get(u, data=None, h=None):
    try:
        r=op.open(urllib.request.Request(u,data=data,headers={'User-Agent':UA,'Accept':'*/*',**(h or {})}),timeout=25); b=r.read()
        return r.status, r.geturl(), b.decode('utf-8','replace')
    except urllib.error.HTTPError as e: return e.code, u, e.read()[:300].decode('utf-8','replace')
    except Exception as e: return 0, u, repr(e)[:200]
for u in ['https://seibro.or.kr/','https://seibro.or.kr/websquare/control.jsp?w2xPath=/IPORTAL/user/etf/BIP_CNTS06030V.xml&menuNo=179',
          'https://seibro.or.kr/IPORTAL/user/etf/BIP_CNTS06030V.xml','https://seibro.or.kr/websquare/control.jsp?w2xPath=/IPORTAL/user/index.xml']:
    s,url,t=get(u); print('=====',s,url,len(t)); print(t[:1500])
# menu discovery: look for a menu js/xml
s,url,t=get('https://seibro.or.kr/websquare/control.jsp?w2xPath=/IPORTAL/user/index.xml')
for m in sorted(set(re.findall(r'(/IPORTAL/[\w/]+\.xml)', t)))[:50]: print('XML', m)
for m in sorted(set(re.findall(r'src="([^"]+\.js[^"]*)"', t)))[:30]: print('JS', m)
