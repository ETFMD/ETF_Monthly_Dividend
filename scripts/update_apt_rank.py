#!/usr/bin/env python3
"""
국내 나의 아파트 시세 순위 — 국토교통부 아파트 매매 실거래가(공공데이터포털 API) → data/apt_rank.json (표준 라이브러리만)

자료
  · 실거래: https://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade  (시군구 × 계약월, 인증키 APT_KEY)
  · 세대수: 공공데이터포털 「한국부동산원_공동주택 단지 식별정보_기본정보」 CSV (매달 갱신 · 인증키 필요 없음)
           필지고유번호(PNU) = 시군구(5)+법정동(5)+산 여부(1)+본번(4)+부번(4) 로 실거래와 연결
순위: 최근 12개월 안에 거래된 단지마다 '가장 최근 실거래'(해제 거래 제외) 금액으로 내림차순
캐시: .cache/apt/<시군구>_<YYYYMM>.json (Actions cache 로 실행 사이에 보관) — 지난달·이번달·그 전달만 매일 새로 받고
      나머지 달은 캐시가 없을 때만 받음 (신고 기한 30일 · 해제 신고 반영)
출력: data/apt_rank.json  { updated, months:[from,to], source, total, rows:[[단지키, 이름, 금액(만원), 전용㎡, 계약일, 층, 세대수,
       시도, 시군구, 법정동 지번, 도로명, 건축년도, 1년 거래 수], ...] }  — 한 줄에 한 단지(키 순)로 써서 git 변경분을 작게
"""
import csv, datetime, io, json, os, re, sys, time, urllib.parse, urllib.request, concurrent.futures as cf
import xml.etree.ElementTree as ET

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OUT = os.path.join(ROOT, 'data', 'apt_rank.json')
CACHE = os.path.join(ROOT, '.cache', 'apt')
KEY = os.environ.get('APT_KEY', '').strip()
API = 'https://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade'
CPLX_PAGE = 'https://www.data.go.kr/data/15106861/fileData.do'
DOWN = 'https://www.data.go.kr/cmm/cmm/fileDownload.do?atchFileId=%s&fileDetailSn=%s&insertDataPrcus=N'
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
SIDO = {'서울특별시': '서울', '부산광역시': '부산', '대구광역시': '대구', '인천광역시': '인천', '광주광역시': '광주', '대전광역시': '대전',
        '울산광역시': '울산', '세종특별자치시': '세종', '경기도': '경기', '강원특별자치도': '강원', '강원도': '강원', '충청북도': '충북',
        '충청남도': '충남', '전북특별자치도': '전북', '전라북도': '전북', '전라남도': '전남', '경상북도': '경북', '경상남도': '경남',
        '제주특별자치도': '제주'}


def get(url, timeout=60, tries=3):
    err = None
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=timeout) as r: return r.read()
        except Exception as e: err = e; time.sleep(2 * (i + 1))
    raise err


def norm(s): return re.sub(r'[\s()\[\]·.,\-_]|아파트|apt|APT', '', s or '')


# ───── 단지 정보 (세대수) ─────
def complexes():
    h = get(CPLX_PAGE).decode('utf-8', 'replace')
    m = re.search(r'atchFileId=(FILE_\d+)&fileDetailSn=(\d+)', h)
    if not m: raise RuntimeError('단지 정보 다운로드 링크 없음')
    raw = get(DOWN % m.groups(), timeout=180)
    for enc in ('utf-8-sig', 'cp949'):
        try: body = raw.decode(enc); break
        except UnicodeDecodeError: continue
    by_pnu, sgg_name = {}, {}
    for r in csv.DictReader(io.StringIO(body)):
        if (r.get('단지종류') or '').strip() != '1': continue                 # 1 = 아파트
        pnu = (r.get('필지고유번호') or '').strip()
        if len(pnu) != 19: continue
        try: hh = int(r.get('세대수') or 0)
        except ValueError: hh = 0
        names = {norm(r.get(k)) for k in ('단지명_공시가격', '단지명_건축물대장', '단지명_도로명주소')} - {''}
        by_pnu.setdefault(pnu, []).append((names, hh))
        a = (r.get('주소') or '').split()
        if len(a) >= 2 and pnu[:5] not in sgg_name:
            sido, gu = a[0], a[1]
            if not sido.endswith(('특별시', '광역시', '특별자치시')):
                mm = re.fullmatch(r'(\S{2})(\S+구)', gu)                       # '수원장안구' → '수원시 장안구'
                if mm and not gu.endswith('시'): gu = mm.group(1) + '시 ' + mm.group(2)
            if sido == '세종특별자치시': gu = '세종시'
            sgg_name[pnu[:5]] = (SIDO.get(sido, sido), gu)
    return by_pnu, sgg_name


def households(by_pnu, pnu, name):
    c = by_pnu.get(pnu)
    if not c: return 0
    n = norm(name)
    hit = [hh for names, hh in c if any(n and (n in x or x in n) for x in names)]
    return sum(hit) if hit else (sum(hh for _, hh in c) if len(c) <= 3 else 0)


# ───── 실거래 ─────
def fetch_month(sgg, ym):
    rows, page = [], 1
    while True:
        q = urllib.parse.urlencode({'serviceKey': KEY, 'LAWD_CD': sgg, 'DEAL_YMD': ym, 'pageNo': page, 'numOfRows': 1000})
        x = get(API + '?' + q, timeout=60)
        root = ET.fromstring(x)
        code = (root.findtext('.//resultCode') or '').strip()
        if code not in ('00', '000'):
            raise RuntimeError('API %s %s: %s %s' % (sgg, ym, code, (root.findtext('.//resultMsg') or root.findtext('.//returnAuthMsg') or '')[:80]))
        items = root.findall('.//item')
        for it in items:
            g = lambda k: (it.findtext(k) or '').strip()
            try: amt = int(g('dealAmount').replace(',', ''))
            except ValueError: continue
            rows.append([g('aptSeq') or (sgg + '-' + norm(g('aptNm'))), '%s-%02d-%02d' % (g('dealYear'), int(g('dealMonth') or 0), int(g('dealDay') or 0)),
                         amt, float(g('excluUseAr') or 0), g('floor'), 1 if g('cdealType') else 0, g('aptNm'), g('umdNm'), g('jibun'),
                         g('umdCd'), g('landCd'), g('bonbun'), g('bubun'), (g('roadNm') + ' ' + g('roadNmBonbun').lstrip('0') + ('-' + g('roadNmBubun').lstrip('0') if g('roadNmBubun').lstrip('0') else '')).strip(),
                         g('buildYear')])
        total = int(root.findtext('.//totalCount') or 0)
        if page * 1000 >= total or not items: return rows
        page += 1


def months(n=13):
    d = datetime.date.today().replace(day=1); out = []
    for _ in range(n):
        out.append(d.strftime('%Y%m')); d = (d - datetime.timedelta(days=1)).replace(day=1)
    return out                                                                   # 최근 달부터


def main():
    if not KEY: sys.exit('APT_KEY(공공데이터포털 인증키)가 없습니다')
    os.makedirs(CACHE, exist_ok=True)
    by_pnu, sgg_name = complexes()
    sggs = sorted(sgg_name)
    yms = months(13)
    fresh = set(yms[:3])
    jobs = [(s, ym) for s in sggs for ym in yms if ym in fresh or not os.path.exists(os.path.join(CACHE, '%s_%s.json' % (s, ym)))]
    print('시군구 %d · 받을 달 %d건' % (len(sggs), len(jobs)))
    fails = []
    def run(job):
        s, ym = job
        try:
            rows = fetch_month(s, ym)
            with open(os.path.join(CACHE, '%s_%s.json' % (s, ym)), 'w', encoding='utf-8') as f: json.dump(rows, f, ensure_ascii=False, separators=(',', ':'))
            return None
        except Exception as e: return '%s %s: %s' % (s, ym, e)
    with cf.ThreadPoolExecutor(6) as ex:
        for r in ex.map(run, jobs):
            if r: fails.append(r)
    if fails:
        print('실패 %d건 (예: %s)' % (len(fails), fails[0]), file=sys.stderr)
        if len(fails) > len(jobs) * 0.2: sys.exit('실패가 너무 많아 저장하지 않음')
    # 단지별 모으기
    cut = (datetime.date.today() - datetime.timedelta(days=366)).isoformat()
    apts = {}
    for s in sggs:
        for ym in yms:
            p = os.path.join(CACHE, '%s_%s.json' % (s, ym))
            if not os.path.exists(p): continue
            for d in json.load(open(p, encoding='utf-8')):
                if d[5] or d[1] < cut: continue                                  # 해제 거래 · 1년 지난 거래 제외
                a = apts.setdefault(d[0], {'sgg': s, 'n': 0, 'last': None})
                a['n'] += 1
                if a['last'] is None or (d[1], d[2]) > (a['last'][1], a['last'][2]): a['last'] = d
    rows = []
    for seq, a in apts.items():
        d, s = a['last'], a['sgg']
        sido, gu = sgg_name.get(s, ('', ''))
        pnu = s + (d[9] or '').zfill(5) + ('2' if d[10] == '2' else '1') + (d[11] or '').zfill(4) + (d[12] or '').zfill(4)
        rows.append([seq, d[6], d[2], round(d[3], 2), d[1], d[4], households(by_pnu, pnu, d[6]), sido, gu,
                     (d[7] + ' ' + d[8]).strip(), d[13], d[14], a['n']])
    rows.sort(key=lambda r: r[0])
    if len(rows) < 5000: sys.exit('단지 수가 너무 적음: %d' % len(rows))
    data = {'source': '국토교통부 아파트 매매 실거래가 · 한국부동산원 공동주택 단지 식별정보', 'months': [yms[-1], yms[0]],
            'total': len(rows), 'hhMatched': sum(1 for r in rows if r[6])}
    old = None
    if os.path.exists(OUT):
        try: old = json.load(open(OUT, encoding='utf-8'))
        except Exception: old = None
    if old and old.get('rows') == rows and old.get('months') == data['months']:
        print('변경 없음 (%d개 단지)' % len(rows)); return
    data['updated'] = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
    head = json.dumps(data, ensure_ascii=False, separators=(',', ':'))[:-1]
    with open(OUT, 'w', encoding='utf-8') as f:                                 # 한 줄에 한 단지 → 매일 바뀐 줄만 git 에 남음
        f.write(head + ',"rows":[\n' + ',\n'.join(json.dumps(r, ensure_ascii=False, separators=(',', ':')) for r in rows) + '\n]}\n')
    print('저장: 단지 %d개 · 세대수 연결 %d개 · %s~%s' % (len(rows), data['hhMatched'], yms[-1], yms[0]))


if __name__ == '__main__':
    main()
