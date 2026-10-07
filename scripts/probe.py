import urllib.request, re, concurrent.futures as cf
UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
def get(u):
    try: return urllib.request.urlopen(urllib.request.Request(u,headers={'User-Agent':UA}),timeout=25).read().decode('utf-8','replace')
    except Exception as e: return ''
paths=set()
for u in ['https://seibro.or.kr/IPORTAL/user/common/wframe/common/side.xml','https://seibro.or.kr/IPORTAL/user/common/wframe/common/top.xml']:
    t=get(u); print(u,len(t)); paths|=set(re.findall(r'(/IPORTAL/user/[\w/]+\.xml)',t))
    for m in re.findall(r'menuNo[^0-9]{0,5}(\d+)',t)[:5]: pass
# also menu js
t=get('https://seibro.or.kr/IPORTAL/common/js/menu.js'); print('menu.js',len(t)); paths|=set(re.findall(r'(/IPORTAL/user/[\w/]+\.xml)',t))
print(len(paths))
cands=sorted(p for p in paths if '/etf/' in p or '/fund/' in p)
print(cands)
# brute force etf folder
cands=set(cands)|{'/IPORTAL/user/etf/BIP_CNTS060%02dV.xml'%i for i in range(0,60)}|{'/IPORTAL/user/etf/BIP_CNTS060%02dP.xml'%i for i in range(0,60)}
def chk(p):
    t=get('https://seibro.or.kr'+p)
    if len(t)<300: return None
    title=re.search(r'<title>(.*?)</title>',t)
    return p, (title.group(1) if title else ''), ('과세' in t, 'TAX' in t), sorted(set(re.findall(r"callTask\('(\w+)'\s*,\s*'([\w.]+)'",t)))[:6], sorted(set(re.findall(r'id="(\w*TAX\w*)"',t)))
with cf.ThreadPoolExecutor(12) as ex:
    for r in ex.map(chk, sorted(cands)):
        if r: print(r)
