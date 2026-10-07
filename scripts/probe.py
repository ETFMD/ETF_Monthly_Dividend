import urllib.request, re
UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
t=urllib.request.urlopen(urllib.request.Request('https://seibro.or.kr/IPORTAL/user/etf/BIP_CNTS06030V.xml',headers={'User-Agent':UA}),timeout=30).read().decode('utf-8','replace')
i=t.find('reqParam'); 
for m in re.finditer(r'(action|task|reqParam|setAttribute|appendChild|createElement|<w2:column[^>]*>|<column[^>]*>|headerName|id="column)', t): pass
print(t[2500:22000])
