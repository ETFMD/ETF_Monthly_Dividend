import urllib.request, re, json, ssl, urllib.parse
UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
NV=ssl.create_default_context(); NV.check_hostname=False; NV.verify_mode=ssl.CERT_NONE
def get(u, data=None, h=None, form=True):
    try:
        if isinstance(data,dict):
            data=urllib.parse.urlencode(data).encode(); h=dict(h or {}, **{'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8','X-Requested-With':'XMLHttpRequest'})
        r=urllib.request.urlopen(urllib.request.Request(u,data=data,headers={'User-Agent':UA,'Accept':'application/json, text/html, */*',**(h or {})}),timeout=25,context=NV); return r.status, r.read().decode('utf-8','replace')
    except urllib.error.HTTPError as e: return e.code, e.read()[:200].decode('utf-8','replace')
    except Exception as e: return 0, repr(e)[:150]
def sh(t,n=900): return re.sub(r'\s+',' ',t)[:n]
B='https://www.kiwoometf.com'
s,h=get(B+'/service/etf/KO02010100M'); print(s,len(h))
for m in sorted(set(re.findall(r"url\s*:\s*['\"`]([^'\"`]+)['\"`]",h))): print('ajax',m)
i=h.find('KO02010100MAjax'); print(sh(h[max(0,i-1500):i+800],2300))
for d in [{},{'pageIndex':'1'},{'page':'1','rowCnt':'500'}]:
    s,t=get(B+'/service/etf/KO02010100MAjax',data=d); print('list',d,s,sh(t,600))
s,t=get(B+'/service/main/productListAjax',data={}); print('plist',s,sh(t,600)); g=re.findall(r'"gcode"\s*:\s*"?([A-Za-z0-9]+)',t)[:3]; print(g)
if g:
    s,h=get(B+'/service/etf/KO02010200M?gcode='+g[0]); print('detail',s,len(h))
    i=h.find('과세'); print(sh(h[max(0,i-1500):i+600],2100))
    for m in sorted(set(re.findall(r"url\s*:\s*['\"`]([^'\"`]+)['\"`]",h))): print('d-ajax',m)
