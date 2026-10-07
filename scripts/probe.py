import urllib.request, re, json, time, concurrent.futures as cf, collections
UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
def get(u, h=None):
    return urllib.request.urlopen(urllib.request.Request(u,headers={'User-Agent':UA,**(h or {})}),timeout=25).read()
print(get('https://www.samsungfund.com/api/v1/kodex/divid-info.do?id=2ETFV8',{'Referer':'https://www.samsungfund.com/etf/product/distribution.do'})[:3000].decode('utf-8','replace'))
L=json.loads(get('https://finance.naver.com/api/sise/etfItemList.nhn?etfType=0').decode('euc-kr','replace'))['result']['etfItemList']
print(len(L))
t=time.time(); out={}
def basic(c):
    for i in range(3):
        try:
            d=json.loads(get('https://m.stock.naver.com/api/etf/%s/basic'%c)); return c,(d.get('dividendMonthsThisYear'),d.get('dividendYieldTtm'),d.get('issuerName'))
        except Exception as e: err=e; time.sleep(1)
    return c,('ERR',str(err))
with cf.ThreadPoolExecutor(8) as ex:
    for c,v in ex.map(basic,[x['itemcode'] for x in L]): out[c]=v
print('time',time.time()-t, 'errs', sum(1 for v in out.values() if v[0]=='ERR'))
cnt=collections.Counter()
mon=[]
for c,v in out.items():
    m=v[0]
    if m and m!='ERR':
        ms=[int(x) for x in m.split(',') if x.strip().isdigit()]
        cnt[len(ms)]+=1
        if len(ms)>=3 and ms[-1]>=8 and all(ms[i+1]-ms[i]==1 for i in range(len(ms)-1)): mon.append(c)
print(sorted(cnt.items())); print('monthly-ish',len(mon))
names={x['itemcode']:x['itemname'] for x in L}
print([names[c] for c in mon[:40]])
iss=collections.Counter(out[c][2] for c in mon); print(iss.most_common(30))
# weird patterns: months with gaps but many
odd=[(names[c],out[c][0]) for c,v in out.items() if v[0] and v[0]!='ERR' and len(v[0].split(','))>=4 and c not in mon]; print(len(odd), odd[:30])
h=json.loads(get('https://m.stock.naver.com/api/etf/0177R0/dividend/history?page=1&pageSize=3&firstPageSize=3')); print(h)
