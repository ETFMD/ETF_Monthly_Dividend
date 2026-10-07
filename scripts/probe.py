import urllib.request, urllib.parse, json, re, http.cookiejar, collections
UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
cj=http.cookiejar.CookieJar(); op=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
def req(url, data=None, h=None):
    if isinstance(data, dict): data=urllib.parse.urlencode(data).encode()
    r=urllib.request.Request(url, data=data, headers={'User-Agent':UA,'Accept':'*/*', **(h or {})})
    return op.open(r, timeout=40).read()
def search(kw, f, t, page=1, size=100):
    s=req('https://kind.krx.co.kr/disclosure/details.do', {'method':'searchDetailsSub','currentPageSize':str(size),'pageIndex':str(page),'orderMode':'1','orderStat':'D','forward':'details_sub','reportNm':kw,'fromDate':f,'toDate':t,'marketType':'','searchMode':'','searchCodeType':'','chose':'S','todayFlag':'N','repIsuSrtCd':''}, {'Referer':'https://kind.krx.co.kr/disclosure/details.do?method=searchDetailsMain'}).decode('utf-8','replace')
    out=[]
    for r in re.findall(r'<tr.*?</tr>', s, re.S):
        a=re.findall(r"openDisclsViewer\('(\d+)'",r)
        if not a: continue
        cells=[re.sub(r'\s+',' ',re.sub('<[^>]+>','',x)).strip() for x in re.findall(r'<td[^>]*>(.*?)</td>',r,re.S)]
        out.append((a[0],cells))
    tot=re.search(r'총\s*<em>?\s*([\d,]+)', s) ; 
    return out, s
for kw in ['분배금','이익금분배','과세표준','분배']:
    res, s = search(kw,'2026-07-01','2026-10-07')
    print('=====',kw,len(res)); m=re.search(r'class="info[^"]*".*?</', s, re.S); 
    i=s.find('건'); print(re.sub(r'\s+',' ',re.sub('<[^>]+>',' ',s[max(0,i-300):i+50])))
    c=collections.Counter(x[1][3] if len(x[1])>3 else str(x[1]) for x in res); print(c.most_common(30))
    for x in res[:6]: print(x)
