import urllib.request, re, concurrent.futures as cf
UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
def get(u):
    try:
        b=urllib.request.urlopen(urllib.request.Request(u,headers={'User-Agent':UA}),timeout=20).read(); return b.decode('utf-8','replace')
    except Exception as e: return None
cands=['https://seibro.or.kr/IPORTAL/user/etf/BIP_CNTS%02d%03dV.xml'%(a,b) for a in (6,) for b in range(0,100)]
cands+=['https://seibro.or.kr/IPORTAL/user/fund/BIP_CNTS%02d%03dV.xml'%(a,b) for a in (4,5) for b in range(0,60)]
with cf.ThreadPoolExecutor(16) as ex:
    for u,t in zip(cands, ex.map(get,cands)):
        if t and len(t)>500:
            title=re.search(r'<w2:\w+[^>]*>|<title>(.*?)</title>',t)
            hit=('분배' in t, '과세' in t, '과표' in t)
            acts=sorted(set(re.findall(r'action\s*=\s*["\']?([A-Za-z]+)',t)))[:8]; tasks=sorted(set(re.findall(r'(ksd\.[\w.]+Task)',t)))[:4]
            print(u.split('/')[-2:], len(t), hit, acts, tasks, re.findall(r'<title>(.*?)</title>',t)[:1])
