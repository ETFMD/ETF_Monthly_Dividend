import urllib.request, re, http.cookiejar
UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
cj=http.cookiejar.CookieJar(); op=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
op.open(urllib.request.Request('https://seibro.or.kr/websquare/control.jsp?w2xPath=/IPORTAL/user/etf/BIP_CNTS06030V.xml&menuNo=179',headers={'User-Agent':UA}),timeout=30).read()
def call(action, params):
    body='<reqParam action="%s" task="ksd.safe.bip.cnts.etf.process.EtfExerInfoPTask">%s</reqParam>'%(action,''.join('<%s value="%s"/>'%(k,v) for k,v in params.items()))
    r=op.open(urllib.request.Request('https://seibro.or.kr/websquare/engine/proworks/callServletService.jsp',data=body.encode(),headers={'User-Agent':UA,'Content-Type':'application/xml; charset="UTF-8"','Referer':'https://seibro.or.kr/websquare/control.jsp?w2xPath=/IPORTAL/user/etf/BIP_CNTS06030V.xml&menuNo=179'}),timeout=40)
    return r.read().decode('utf-8','replace')
P={'START_PAGE':'1','END_PAGE':'30','etf_sort_cd':'','etf_big_sort_cd':'','isin':'','mngco_custno':'','RGT_RSN_DTAIL_SORT_CD':'','fromRGT_STD_DT':'20260930','toRGT_STD_DT':'20260930'}
t=call('exerInfoDtramtPayStatPlistCnt',P); print('CNT', t[:400])
t=call('exerInfoDtramtPayStatPlist',P); print(len(t)); print(t[:2500])
rows=re.findall(r'<data>(.*?)</data>',t,re.S)
for r in rows[:30]:
    d=dict(re.findall(r'<(\w+) value="([^"]*)"',r)); print({k:d.get(k) for k in ['KOR_SECN_NM','ISIN','REP_SECN_NM','RGT_STD_DT','TH1_PAY_TERM_BEGIN_DT','ESTM_STDPRC','TAXSTD','BUNBE']})
# KODEX check isins
for isin in ['KR70005A0006','KR70048J0007','KR70089C0004','KR7498400001']:
    q=dict(P, isin=isin, fromRGT_STD_DT='20260701', toRGT_STD_DT='20261007')
    t=call('exerInfoDtramtPayStatPlist',q)
    for r in re.findall(r'<data>(.*?)</data>',t,re.S): 
        d=dict(re.findall(r'<(\w+) value="([^"]*)"',r)); print(isin, d.get('KOR_SECN_NM'), d.get('RGT_STD_DT'), d.get('ESTM_STDPRC'), d.get('TAXSTD'), d.get('BUNBE'))
