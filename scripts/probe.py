import urllib.request, urllib.parse, json, re, http.cookiejar
UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
cj=http.cookiejar.CookieJar(); op=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
def req(url, data=None, h=None, enc='utf-8'):
    if isinstance(data, dict): data=urllib.parse.urlencode(data).encode()
    r=urllib.request.Request(url, data=data, headers={'User-Agent':UA,'Accept':'*/*', **(h or {})})
    b=op.open(r, timeout=30).read()
    return b
for acpt in ['20260928000287','20260928000137']:
    print('=====',acpt)
    try:
        v=req('https://kind.krx.co.kr/common/disclsviewer.do?method=search&acptno='+acpt).decode('utf-8','replace')
        print(len(v)); docs=re.findall(r'<option value="([^"]+)"[^>]*>([^<]*)</option>', v); print(docs[:5])
        i=v.find('docNo'); print(v[i-200:i+300])
        doc=docs[0][0].split('|')[0] if docs else None
        c=req('https://kind.krx.co.kr/common/disclsviewer.do?method=searchContents&docNo='+doc).decode('utf-8','replace'); print(c[:800])
        path=re.findall(r"(https?://[^'\"]+\.htm)", c) or re.findall(r"setPath\([^)]*'([^']+\.htm)'", c)
        print(path)
        p=path[0] if path[0].startswith('http') else 'https://kind.krx.co.kr'+path[0]
        b=req(p); 
        for enc in ['utf-8','euc-kr']:
            try: h=b.decode(enc); break
            except: pass
        t=re.sub(r'\s+',' ',re.sub(r'<[^>]+>',' | ',h)); print(len(h)); print(t[:6000])
        tables=re.findall(r'<table.*?</table>',h,re.S); print('tables',len(tables))
        for tb in tables[:3]:
            rows=re.findall(r'<tr.*?</tr>',tb,re.S); print('rows',len(rows))
            for r in rows[:6]: print([re.sub(r'\s+',' ',re.sub('<[^>]+>','',c)).strip() for c in re.findall(r'<t[dh][^>]*>(.*?)</t[dh]>',r,re.S)])
    except Exception as e: print('ERR',repr(e))
print('===== naver etf list')
try:
    b=req('https://finance.naver.com/api/sise/etfItemList.nhn?etfType=0&targetColumn=market_sum&sortOrder=desc'); 
    t=b.decode('euc-kr','replace'); d=json.loads(t); L=d['result']['etfItemList']; print(len(L)); print(L[0]); 
except Exception as e: print('ERR',repr(e))
