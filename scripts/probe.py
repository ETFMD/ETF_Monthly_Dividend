import urllib.request, urllib.parse, json, re, http.cookiejar, collections
UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
cj=http.cookiejar.CookieJar(); op=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
def req(url, data=None, h=None):
    if isinstance(data, dict): data=urllib.parse.urlencode(data).encode()
    r=urllib.request.Request(url, data=data, headers={'User-Agent':UA,'Accept':'*/*', **(h or {})})
    return op.open(r, timeout=40).read()
def dec(b):
    m=re.search(rb'charset=["\']?([\w-]+)', b[:3000]); return b.decode(m.group(1).decode() if m else 'utf-8','replace')
def search(kw, f, t, page=1, size=100):
    s=req('https://kind.krx.co.kr/disclosure/details.do', {'method':'searchDetailsSub','currentPageSize':str(size),'pageIndex':str(page),'orderMode':'1','orderStat':'D','forward':'details_sub','reportNm':kw,'fromDate':f,'toDate':t,'marketType':'','searchMode':'','searchCodeType':'','chose':'S','todayFlag':'N','repIsuSrtCd':''}, {'Referer':'https://kind.krx.co.kr/disclosure/details.do?method=searchDetailsMain'}).decode('utf-8','replace')
    out=[]
    for r in re.findall(r'<tr.*?</tr>', s, re.S):
        a=re.findall(r"openDisclsViewer\('(\d+)'",r)
        if a: out.append((a[0],[re.sub(r'\s+',' ',re.sub('<[^>]+>','',x)).strip() for x in re.findall(r'<td[^>]*>(.*?)</td>',r,re.S)]))
    return out
def content(acpt):
    v=req('https://kind.krx.co.kr/common/disclsviewer.do?method=search&acptno='+acpt).decode('utf-8','replace')
    doc=re.search(r"<option value='(\d+)\|[YN]'", v).group(1)
    c=dec(req('https://kind.krx.co.kr/common/disclsviewer.do?method=searchContents&docNo='+doc))
    p=re.findall(r"""['"]((?:https?://[^'"]+)?/external/[^'"]+\.htm)['"]""", c)[0]
    return dec(req(p if p.startswith('http') else 'https://kind.krx.co.kr'+p))
def rows(h):
    out=[]
    for tb in re.findall(r'<table.*?</table>',h,re.S|re.I):
        for r in re.findall(r'<tr.*?</tr>',tb,re.S|re.I): out.append([re.sub(r'\s+',' ',re.sub('<[^>]+>','',x)).strip() for x in re.findall(r'<t[dh][^>]*>(.*?)</t[dh]>',r,re.S|re.I)])
    return out
res=search('분배락 기준가격','2026-09-25','2026-10-07')
print(len(res)); print(res[:3])
if res:
    rr=rows(content(res[0][0])); print(len(rr)); [print(x) for x in rr[:12]]
res=search('설정/환매접수 일시중지','2026-10-01','2026-10-07')
print(len(res));
if res:
    rr=rows(content(res[0][0])); print(len(rr)); [print(x) for x in rr[:8]]
print('=== naver etf basic keys')
d=json.loads(req('https://m.stock.naver.com/api/etf/498400/basic')); print(list(d.keys()))
for k,v in d.items():
    if isinstance(v,(dict,list)): print(k, json.dumps(v,ensure_ascii=False)[:400])
d=json.loads(req('https://m.stock.naver.com/api/stock/498400/integration')); print(list(d.keys()))
for k,v in d.items():
    if isinstance(v,(dict,list)): print(k, json.dumps(v,ensure_ascii=False)[:600])
for u in ['https://m.stock.naver.com/api/etf/498400/dividend','https://m.stock.naver.com/api/etf/498400/dividend/history','https://m.stock.naver.com/api/stock/498400/dividend/history?pageSize=10','https://m.stock.naver.com/front-api/etf/dividend?itemCode=498400']:
    try: print(u, req(u)[:600].decode('utf-8','replace'))
    except Exception as e: print(u,'ERR',e)
