import urllib.request, re, ssl, json, concurrent.futures as cf
UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
def get(u, ctx=None):
    try:
        r=urllib.request.urlopen(urllib.request.Request(u,headers={'User-Agent':UA,'Accept':'text/html,*/*','Accept-Language':'ko-KR,ko;q=0.9'}),timeout=25, context=ctx)
        b=r.read(); return r.geturl(), b.decode('utf-8','replace')
    except Exception as e: return u, 'ERR '+repr(e)[:150]
SITES={'ACE':'https://www.aceetf.co.kr/','SOL':'https://www.soletf.com/','PLUS':'https://www.plusetf.co.kr/','HANARO':'https://www.hanaroetf.com/',
 'KIWOOM':'https://www.kiwoometf.com/','RISE':'https://www.riseetf.co.kr/','TIGER':'https://www.tigeretf.com/','KoAct':'https://www.koactetf.com/',
 '1Q':'https://www.1qetf.com/','WON':'https://www.wooriam.kr/','DAISHIN':'https://www.daishinam.co.kr/','FOCUS':'https://www.vi-am.co.kr/','TIME':'https://timeetf.co.kr/'}
noverify=ssl.create_default_context(); noverify.check_hostname=False; noverify.verify_mode=ssl.CERT_NONE
for k,u in SITES.items():
    url,h=get(u)
    if h.startswith('ERR') and 'CERTIFICATE' in h: url,h=get(u,noverify); k+='(noverify)'
    print('=====',k,url,len(h), h[:120] if h.startswith('ERR') else '')
    if h.startswith('ERR'): continue
    links=sorted(set(re.findall(r'href=["\']([^"\']*(?:distr|divid|dvd|alloc|bunbae|Distr|Divid)[^"\']*)["\']',h)))[:15]; print(' links',links)
    srcs=[s for s in re.findall(r'<script[^>]+src=["\']([^"\']+)["\']',h) if 'google' not in s and 'kakao' not in s][:12]
    base=re.match(r'https?://[^/]+',url).group(0)
    for s in srcs:
        su=s if s.startswith('http') else (('https:'+s) if s.startswith('//') else base+('' if s.startswith('/') else '/')+s)
        _,js=get(su, noverify if 'noverify' in k else None)
        if js.startswith('ERR'): continue
        hits=sorted(set(re.findall(r'["\'`]([^"\'`\s]{0,80}(?:distr|divid|Divid|dvd|Dvd|DVD|alloc|bunbae|Distr)[^"\'`\s]{0,80})["\'`]',js)))
        hits=[x for x in hits if '/' in x or '.do' in x or 'api' in x.lower()][:25]
        if hits: print('  JS',su[-60:],len(js),hits)
