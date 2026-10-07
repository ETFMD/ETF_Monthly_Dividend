import urllib.request, urllib.parse, time, xml.etree.ElementTree as ET
def get(url):
    err = None
    for i in range(4):
        for u in (url, url.replace('https://', 'http://')):
            try:
                with urllib.request.urlopen(urllib.request.Request(u, headers={'User-Agent': 'Mozilla/5.0'}), timeout=30) as r: return r.read().decode('utf-8', 'ignore')
            except Exception as e: err = e
        time.sleep(8)
    raise err
B = 'https://www.law.go.kr/DRF/'
def articles(name, wanted):
    x = ET.fromstring(get(B + 'lawSearch.do?OC=test&target=law&type=XML&query=' + urllib.parse.quote(name)))
    m = [(l.findtext('법령일련번호'), l.findtext('시행일자')) for l in x.iter('law') if (l.findtext('법령명한글') or '').strip() == name][0]
    print('#####', name, 'MST', m, flush=True)
    x = ET.fromstring(get(B + 'lawService.do?OC=test&target=law&type=XML&MST=' + m[0]))
    for a in x.iter('조문단위'):
        no = (a.findtext('조문번호') or '').strip(); br = (a.findtext('조문가지번호') or '').strip(); key = no + ('의' + br if br else '')
        if key in wanted and (a.findtext('조문여부') or '') == '조문':
            print('===== 제' + key + '조'); print('\n'.join(t.strip() for t in a.itertext() if t.strip())[:9000]); print(flush=True)
for n, w in (('조세특례제한법 시행령', {'104의5'}), ('소득세법 시행규칙', {'67'})):
    try: articles(n, w)
    except Exception as e: print('#####', n, 'ERR', e, flush=True)
