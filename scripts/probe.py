import urllib.request, urllib.parse, json, re, http.cookiejar, datetime
UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
cj=http.cookiejar.CookieJar(); op=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
def req(url, data=None, h=None):
    if isinstance(data, dict): data=urllib.parse.urlencode(data).encode()
    r=urllib.request.Request(url, data=data, headers={'User-Agent':UA,'Accept':'*/*', **(h or {})})
    return op.open(r, timeout=30).read()
def tryit(name, f):
    print('=====', name)
    try: f()
    except Exception as e: print('ERR', repr(e)[:300])
def krx():
    req('https://data.krx.co.kr/contents/MDC/MDI/mdiLoader/index.cmd?menuId=MDC0201030104')
    for bld in ['dbms/MDC/STAT/standard/MDCSTAT04601','dbms/MDC/STAT/standard/MDCSTAT04301']:
        t=req('https://data.krx.co.kr/comm/bldAttendant/getJsonData.cmd', {'bld':bld,'locale':'ko_KR','share':'1','csvxls_isNo':'false','trdDd':'20261007','mktId':'ALL'}, {'Referer':'https://data.krx.co.kr/contents/MDC/MDI/mdiLoader/index.cmd?menuId=MDC0201030104','X-Requested-With':'XMLHttpRequest'})
        print(bld, len(t), t[:600].decode('utf-8','replace'))
        try:
            d=json.loads(t); k=[x for x in d if isinstance(d[x],list)]; print(k, len(d[k[0]]) if k else None); print(d[k[0]][:2] if k else '')
        except Exception as e: print('json',e)
def kind():
    t=req('https://kind.krx.co.kr/disclosure/details.do', {'method':'searchDetailsSub','currentPageSize':'50','pageIndex':'1','orderMode':'1','orderStat':'D','forward':'details_sub','reportNm':'분배금','fromDate':'2026-09-20','toDate':'2026-10-07','marketType':'','searchMode':'','searchCodeType':'','chose':'S','todayFlag':'N','repIsuSrtCd':''}, {'Referer':'https://kind.krx.co.kr/disclosure/details.do?method=searchDetailsMain'})
    s=t.decode('utf-8','replace'); print(len(s)); 
    rows=re.findall(r'<tr.*?</tr>', s, re.S); print('rows',len(rows))
    for r in rows[:8]: print(re.sub(r'\s+',' ',re.sub('<[^>]+>',' | ',r))[:300]); print(re.findall(r"openDisclsViewer\('(\d+)'",r))
def kind_today():
    t=req('https://kind.krx.co.kr/disclosure/todaydisclosure.do', {'method':'searchTodayDisclosureSub','currentPageSize':'100','pageIndex':'1','orderMode':'0','orderStat':'D','marketType':'','forward':'todaydisclosure_sub','searchMode':'','searchCodeType':'','chose':'S','todayFlag':'Y','repIsuSrtCd':'','kosdaqSegment':'','selDate':'2026-10-07','searchCorpName':'','copyUrl':''}, {'Referer':'https://kind.krx.co.kr/disclosure/todaydisclosure.do?method=searchTodayDisclosureMain'})
    s=t.decode('utf-8','replace'); rows=re.findall(r'<tr.*?</tr>', s, re.S); print('rows',len(rows))
    for r in rows[:5]: print(re.sub(r'\s+',' ',re.sub('<[^>]+>',' | ',r))[:250])
    print([re.sub(r'\s+',' ',re.sub('<[^>]+>',' ',r))[:200] for r in rows if '분배' in r][:10])
def naver():
    for u in ['https://m.stock.naver.com/api/stock/498400/integration','https://m.stock.naver.com/api/etf/498400/basic','https://api.stock.naver.com/etf/498400/basic','https://m.stock.naver.com/api/stock/498400/dividend','https://stock.naver.com/api/domestic/etf/498400/dividend']:
        try: t=req(u); print(u, len(t), t[:500].decode('utf-8','replace'))
        except Exception as e: print(u,'ERR',e)
def seibro():
    t=req('https://seibro.or.kr/websquare/control.jsp?w2xPath=/IPORTAL/user/etf/BIP_CNTS06030V.xml&menuNo=179'); print(len(t))
tryit('krx',krx); tryit('kind',kind); tryit('kind_today',kind_today); tryit('naver',naver); tryit('seibro',seibro)
