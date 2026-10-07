import urllib.request, re, json, ssl, urllib.parse
UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
NV=ssl.create_default_context(); NV.check_hostname=False; NV.verify_mode=ssl.CERT_NONE
def get(u, data=None, h=None):
    try:
        if isinstance(data,dict):
            data=urllib.parse.urlencode(data).encode(); h=dict(h or {}, **{'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8','X-Requested-With':'XMLHttpRequest'})
        r=urllib.request.urlopen(urllib.request.Request(u,data=data,headers={'User-Agent':UA,'Accept':'application/json, text/html, */*',**(h or {})}),timeout=25,context=NV); return r.status, r.read().decode('utf-8','replace')
    except urllib.error.HTTPError as e: return e.code, e.read()[:200].decode('utf-8','replace')
    except Exception as e: return 0, repr(e)[:150]
def sh(t,n=900): return re.sub(r'\s+',' ',t)[:n]
B='https://www.kiwoometf.com'
s,h=get(B+'/service/etf/KO02010200M?gcode=0198A0')
for a in ['KO02010200MAjax','KO02010200MAjax2','KO02010200MAjax3','KO02010200MAjax4']:
    for m in list(re.finditer(a+'"',h))[:1]: print(a,'::',sh(h[max(0,m.start()-600):m.start()+1600],2200)); print()
i=h.find('data-tab="3"'); j=h.find('data-tab="3"',i+10); print('TAB3', sh(h[j:j+3000],3000))
for a,d in [('KO02010200MAjax2',{'gcode':'0198A0'}),('KO02010200MAjax3',{'gcode':'0198A0'}),('KO02010200MAjax4',{'gcode':'0198A0'})]:
    s,t=get(B+'/service/etf/'+a,data=d); print(a,s,sh(t,700))
