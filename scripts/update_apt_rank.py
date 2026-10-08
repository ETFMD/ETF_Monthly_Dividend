#!/usr/bin/env python3
"""
국내 나의 아파트 시세 순위 — 국토교통부 아파트 매매 실거래가(공공데이터포털 API) → data/apt_rank.json (표준 라이브러리만)

자료
  · 실거래: https://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade  (시군구 × 계약월, 인증키 APT_KEY)
           단지 구분 = 시군구|법정동|지번|단지명 (기본 API 에는 단지 일련번호가 없음)
  · 세대수: 공공데이터포털 「한국부동산원_공동주택 단지 식별정보_기본정보」 CSV (매달 갱신 · 인증키 필요 없음)
           필지고유번호(PNU) = 시군구(5)+법정동(5)+산 여부(1)+본번(4)+부번(4) 로 실거래와 연결
순위: 최근 12개월 안에 거래된 단지마다 '가장 최근 실거래'(해제 거래 제외) 금액으로 내림차순
캐시: .cache/apt/<시군구>_<YYYYMM>.json (Actions cache 로 실행 사이에 보관) — 2시간마다 이번 달·지난달, 새벽 한 번 그 전달까지 다시 받고
      나머지 달은 캐시가 없을 때만 받음 (신고 기한 30일 · 해제 신고 반영) · 받은 달은 카운터 Worker(/apt/put)에도 올려 단지 그래프에 씀
출력: data/apt_rank.json  { updated, months:[from,to], source, total, rows:[[단지키(시군구|법정동|지번|이름), 이름, 금액(만원), 전용㎡, 계약일, 층, 세대수,
       시도, 시군구, 법정동 지번, 도로명, 건축년도, 1년 거래 수], ...] }  — 한 줄에 한 단지(키 순)로 써서 git 변경분을 작게
"""
import csv, datetime, hashlib, io, json, os, re, sys, time, urllib.parse, urllib.request, concurrent.futures as cf
import xml.etree.ElementTree as ET

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OUT = os.path.join(ROOT, 'data', 'apt_rank.json')
CACHE = os.path.join(ROOT, '.cache', 'apt')
KEY = os.environ.get('APT_KEY', '').strip()
API = 'https://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade'
API_DEV = 'https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev'   # 상세 자료 — 같은 키로 활용신청하면 하루 한도가 따로 있어 과거 자료 채우기에 씀
HIST = os.path.join(ROOT, 'data', 'apt_hist')
FIRST_YM = '200601'                                                              # 국토교통부 아파트 매매 실거래 공개 시작
API_DOWN = {'ok': 0, 'fail': 0}                                                   # 공공 API 장애(시간 초과 등)면 처음 24건 실패 뒤 나머지는 건너뜀
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
    cp = os.path.join(CACHE, 'complex.csv')                                     # 매달 바뀌는 자료 — 7일마다 새로 받고, 실패하면 보관본
    raw = open(cp, 'rb').read() if os.path.exists(cp) and time.time() - os.path.getmtime(cp) < 7 * 86400 else None
    if raw is None:
        try:
            h = get(CPLX_PAGE).decode('utf-8', 'replace')
            m = re.search(r'atchFileId=(FILE_\d+)&fileDetailSn=(\d+)', h)
            if not m: raise RuntimeError('단지 정보 다운로드 링크 없음')
            raw = get(DOWN % m.groups(), timeout=300)
            if len(raw) < 1000000: raise RuntimeError('단지 정보 파일이 너무 작음')
            with open(cp, 'wb') as f: f.write(raw)
        except Exception as e:
            if not os.path.exists(cp): raise
            print('단지 정보 새로 받기 실패 — 보관본 사용:', e, file=sys.stderr)
            raw = open(cp, 'rb').read()
    for enc in ('utf-8-sig', 'cp949'):
        try: body = raw.decode(enc); break
        except UnicodeDecodeError: continue
    by_pnu, sgg_name, umd, by_addr = {}, {}, {}, {}
    for r in csv.DictReader(io.StringIO(body)):
        pnu = (r.get('필지고유번호') or '').strip()
        if len(pnu) != 19: continue
        a = (r.get('주소') or '').split()
        i = next((k for k, t in enumerate(a) if re.match(r'^(산)?\d', t)), len(a))
        apt = (r.get('단지종류') or '').strip() == '1'                        # 1 = 아파트
        for j in range(1, i):                                                   # (시군구, '양평읍 양근리') → 법정동 코드 · 주소(법정동+지번) → 단지
            umd.setdefault((pnu[:5], ' '.join(a[j:i])), pnu[5:10])
            if apt and i < len(a): by_addr.setdefault((pnu[:5], ' '.join(a[j:i]) + ' ' + a[i]), []).append(pnu)
        if not apt: continue
        try: hh = int(r.get('세대수') or 0)
        except ValueError: hh = 0
        names = {norm(r.get(k)) for k in ('단지명_공시가격', '단지명_건축물대장', '단지명_도로명주소')} - {''}
        by_pnu.setdefault(pnu, []).append((names, hh, (r.get('도로명주소') or '').strip()))
        if len(a) >= 2 and pnu[:5] not in sgg_name:
            sido, gu = a[0], a[1]
            if not sido.endswith(('특별시', '광역시', '특별자치시')):
                mm = re.fullmatch(r'(\S{2})(\S+구)', gu)                       # '수원장안구' → '수원시 장안구'
                if mm and not gu.endswith('시'): gu = mm.group(1) + '시 ' + mm.group(2)
            if sido == '세종특별자치시': gu = '세종시'
            sgg_name[pnu[:5]] = (SIDO.get(sido, sido), gu)
    return by_pnu, sgg_name, umd, by_addr


def households(by_pnu, pnu, name):
    """(세대수, 도로명) — 같은 필지의 아파트 중 이름이 맞는 단지 (없으면 그 필지 단지가 3개 이하일 때 합계)"""
    c = by_pnu.get(pnu)
    if not c: return 0, ''
    n = norm(name)
    hit = [x for x in c if any(n and (n in y or y in n) for y in x[0])]
    if not hit and len(c) <= 3: hit = c
    return sum(x[1] for x in hit), next((x[2] for x in hit if x[2]), '')


def pnu_of(sgg, umd_code, jibun):
    m = re.fullmatch(r'(산)?\s*(\d+)(?:-(\d+))?', (jibun or '').strip())
    if not umd_code or not m: return ''
    return sgg + umd_code + ('2' if m.group(1) else '1') + m.group(2).zfill(4) + (m.group(3) or '0').zfill(4)


# ───── 실거래 ─────
def apt_key(sgg, umd, jibun, name): return '%s|%s|%s|%s' % (sgg, umd.strip(), jibun.strip(), name.strip())


def fetch_month(sgg, ym, api=None):
    """[단지키, 계약일, 금액(만원), 전용㎡, 층, 해제여부, 단지명, 법정동, 지번, 건축년도]"""
    rows, page = [], 1
    while True:
        q = urllib.parse.urlencode({'serviceKey': KEY, 'LAWD_CD': sgg, 'DEAL_YMD': ym, 'pageNo': page, 'numOfRows': 1000})
        root = ET.fromstring(get((api or API) + '?' + q, timeout=60))
        code = (root.findtext('.//resultCode') or '').strip()
        if code not in ('00', '000'):
            raise RuntimeError('API %s %s: %s %s' % (sgg, ym, code, (root.findtext('.//resultMsg') or root.findtext('.//returnAuthMsg') or '')[:80]))
        items = root.findall('.//item')
        for it in items:
            g = lambda k: (it.findtext(k) or '').strip()
            try: amt = int(g('dealAmount').replace(',', ''))
            except ValueError: continue
            rows.append([apt_key(sgg, g('umdNm'), g('jibun'), g('aptNm')), '%s-%02d-%02d' % (g('dealYear'), int(g('dealMonth') or 0), int(g('dealDay') or 0)),
                         amt, round(float(g('excluUseAr') or 0), 2), g('floor'), 1 if g('cdealType') else 0, g('aptNm'), g('umdNm'), g('jibun'), g('buildYear')])
        total = int(root.findtext('.//totalCount') or 0)
        if page * 1000 >= total or not items: return rows
        page += 1


def upload(sggs, yms):
    """카운터 Worker(/apt/put)에 시군구·월별 거래 [단지키, 계약일, 금액, 전용㎡, 층, 해제] 를 올림 — 단지 그래프용
    · 올린 내용의 해시를 .cache/apt/uploaded.json 에 적어 두고, 바뀌었거나 아직 못 올린 달만 다시 올림 (인증: 같은 인증키)"""
    ep = (json.load(open(os.path.join(ROOT, 'data', 'counter.json'))) or {}).get('endpoint')
    if not ep: return 0, 0
    mark_p = os.path.join(CACHE, 'uploaded.json')
    mark = json.load(open(mark_p)) if os.path.exists(mark_p) else {}
    todo = []
    for s in sggs:
        for ym in yms:
            p = os.path.join(CACHE, '%s_%s.json' % (s, ym))
            if not os.path.exists(p): continue
            raw = open(p, encoding='utf-8').read()
            h = hashlib.sha1(raw.encode()).hexdigest()[:16]
            if mark.get(s + ym) != h: todo.append((s, ym, h, raw))
    ok = 0
    for i in range(0, len(todo), 30):
        part = todo[i:i + 30]
        body = ('[' + ','.join('{"sgg":"%s","ym":"%s","v":%s}' % (s, ym, json.dumps([d[:6] for d in json.loads(raw)], ensure_ascii=False, separators=(',', ':')))
                               for s, ym, h, raw in part) + ']').encode()
        req = urllib.request.Request(ep.rstrip('/') + '/apt/put?k=' + urllib.parse.quote(KEY), data=body,
                                     headers={'Content-Type': 'application/json', 'User-Agent': 'apt-rank/1'})
        try:
            with urllib.request.urlopen(req, timeout=90) as r:
                if json.loads(r.read().decode()).get('ok') == len(part):
                    for s, ym, h, _ in part: mark[s + ym] = h
                    ok += len(part)
        except Exception as e: print('Worker 업로드 실패:', e, file=sys.stderr)
    for k in [k for k in mark if k[5:] not in yms]: del mark[k]                  # 1년 넘은 달 표시 정리
    json.dump(mark, open(mark_p, 'w'))
    return ok, len(todo)


def kst_today(): return (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=9)).date()


def months(n=13):
    d = kst_today().replace(day=1); out = []
    for _ in range(n):
        out.append(d.strftime('%Y%m')); d = (d - datetime.timedelta(days=1)).replace(day=1)
    return out                                                                   # 최근 달부터


# ───── 과거 전체 기간 (단지 그래프용) ─────
#  data/apt_hist/<시군구>/<연도>.json = {"m":[들어 있는 달], "k":[단지키...], "d":[[단지번호, "MMDD", 금액(만원), 전용㎡, 층], ...]}
#  · 최근 13개월(순위 창)보다 이전 달만 · 계약 해제 거래 제외 · 한 번 채운 달은 바뀌지 않음
#  · 실행마다 정해진 호출 수(APT_BACKFILL, 기본 200)만큼 최근 연도부터 거꾸로 채움 — 상세 자료 API 가 열려 있으면 그쪽 한도로 더 많이
def hist_path(sgg, year): return os.path.join(HIST, sgg, '%s.json' % year)


def hist_load(sgg, year):
    p = hist_path(sgg, year)
    if os.path.exists(p):
        try: return json.load(open(p, encoding='utf-8'))
        except Exception: pass
    return {'m': [], 'k': [], 'd': []}


def hist_add(sgg, ym, rows):
    year, mon = ym[:4], int(ym[4:])
    h = hist_load(sgg, year)
    if mon in h['m']: return
    idx = {k: i for i, k in enumerate(h['k'])}
    for d in rows:
        if d[5]: continue
        if d[0] not in idx: idx[d[0]] = len(h['k']); h['k'].append(d[0])
        h['d'].append([idx[d[0]], d[1][5:7] + d[1][8:10], d[2], d[3], d[4]])
    h['m'] = sorted(h['m'] + [mon]); h['d'].sort(key=lambda x: (x[1], x[0]))
    os.makedirs(os.path.dirname(hist_path(sgg, year)), exist_ok=True)
    with open(hist_path(sgg, year), 'w', encoding='utf-8') as f: json.dump(h, f, ensure_ascii=False, separators=(',', ':'))


def backfill(sggs, window):
    """window 보다 이전 달 중 아직 없는 달을 최근 달부터 채움 · 받은 순위 캐시(.cache/apt)에 있으면 API 를 부르지 않음"""
    start = window[-1]                                                            # 순위 창의 가장 오래된 달 (이 달부터는 Worker 가 가짐)
    todo, d = [], datetime.date(int(start[:4]), int(start[4:]), 1)
    have = {}
    while True:
        d = (d - datetime.timedelta(days=1)).replace(day=1); ym = d.strftime('%Y%m')
        if ym < FIRST_YM: break
        for s in sggs:
            key = (s, ym[:4])
            if key not in have: have[key] = set(hist_load(s, ym[:4])['m'])
            if int(ym[4:]) not in have[key]: todo.append((s, ym))
    if not todo: return 0, 0
    budget = int(os.environ.get('APT_BACKFILL', '200'))
    api = API
    try:                                                                          # 상세 자료 API 가 열려 있으면 하루 한도가 따로 → 더 많이
        fetch_month(sggs[0], todo[0][1], API_DEV); api = API_DEV; budget = int(os.environ.get('APT_BACKFILL_DEV', '750'))
    except Exception: pass
    done = 0
    cached = [(s, ym) for s, ym in todo if os.path.exists(os.path.join(CACHE, '%s_%s.json' % (s, ym)))]
    for s, ym in cached:                                                          # 순위 창에서 막 빠진 달: 캐시 그대로
        hist_add(s, ym, json.load(open(os.path.join(CACHE, '%s_%s.json' % (s, ym)), encoding='utf-8'))); done += 1
    rest = [t for t in todo if t not in set(cached)][:budget]
    def run(t):
        if API_DOWN['fail'] >= 24 and API_DOWN['ok'] == 0: return t, None
        try: r = fetch_month(t[0], t[1], api); API_DOWN['ok'] += 1; return t, r
        except Exception as e: API_DOWN['fail'] += 1; return t, None
    with cf.ThreadPoolExecutor(8) as ex:
        for (s, ym), rows in ex.map(run, rest):
            if rows is not None: hist_add(s, ym, rows); done += 1
    # 목록: {시군구: [연도...]} · 진행률
    idx = {}
    for s in sorted(os.listdir(HIST)) if os.path.isdir(HIST) else []:
        if os.path.isdir(os.path.join(HIST, s)):
            idx[s] = sorted(f[:4] for f in os.listdir(os.path.join(HIST, s)) if f.endswith('.json'))
    total = len(sggs) * ((int(start[:4]) - int(FIRST_YM[:4])) * 12 + int(start[4:]) - 1)
    left = len(todo) - done
    with open(os.path.join(HIST, 'index.json'), 'w', encoding='utf-8') as f:
        json.dump({'from': FIRST_YM, 'to': (datetime.date(int(start[:4]), int(start[4:]), 1) - datetime.timedelta(days=1)).strftime('%Y%m'),
                   'done': total - left, 'total': total, 'sgg': idx}, f, ensure_ascii=False, separators=(',', ':'))
    print('과거 자료: 이번에 %d달 (%s) · 남은 %d / 전체 %d' % (done, 'API_DEV' if api == API_DEV else '기본 API', left, total))
    return done, left



def main():
    if not KEY: sys.exit('APT_KEY(공공데이터포털 인증키)가 없습니다')
    os.makedirs(CACHE, exist_ok=True)
    by_pnu, sgg_name, umd, by_addr = complexes()
    sggs = sorted(sgg_name)
    yms = months(13)
    full = os.environ.get('APT_FULL') == '1' or datetime.datetime.now(datetime.timezone.utc).hour in (20, 21)   # 새벽 5~6시(한국) 실행: 3개월
    fresh = set(yms[:3] if full else yms[:2])
    jobs = [(s, ym) for s in sggs for ym in yms if ym in fresh or not os.path.exists(os.path.join(CACHE, '%s_%s.json' % (s, ym)))]
    print('시군구 %d · 받을 달 %d건 (%s)' % (len(sggs), len(jobs), '3개월' if full else '2개월'))
    fails, done = [], []
    def run(job):
        s, ym = job
        if API_DOWN['fail'] >= 24 and API_DOWN['ok'] == 0: return ('err', '%s %s: 건너뜀 (API 장애)' % (s, ym))
        try:
            rows = fetch_month(s, ym)
            p = os.path.join(CACHE, '%s_%s.json' % (s, ym))
            old = open(p, encoding='utf-8').read() if os.path.exists(p) else None
            new = json.dumps(rows, ensure_ascii=False, separators=(',', ':'))
            API_DOWN['ok'] += 1
            if new != old:
                with open(p, 'w', encoding='utf-8') as f: f.write(new)
                return ('chg', s, ym, rows)
            return None
        except Exception as e:
            API_DOWN['fail'] += 1
            return ('err', '%s %s: %s' % (s, ym, e))
    t0 = time.time()
    with cf.ThreadPoolExecutor(8) as ex:
        for r in ex.map(run, jobs):
            if not r: continue
            if r[0] == 'err': fails.append(r[1])
            else: done.append(r[1:])
    print('받기 %.0f초 · 바뀐 달 %d · 실패 %d' % (time.time() - t0, len(done), len(fails)))
    if fails:
        print('실패 예: %s' % fails[0], file=sys.stderr)
        if len(fails) > max(10, len(jobs) * 0.2): sys.exit('실패가 너무 많아 저장하지 않음')
    ok, n = upload(sggs, yms)                                                  # 단지 그래프용 (바뀐 달·못 올린 달만)
    if n: print('Worker 업로드 %d/%d' % (ok, n))
    if API_DOWN['ok'] == 0 and API_DOWN['fail']: print('공공 API 응답 없음 — 과거 자료 채우기는 다음 실행에', file=sys.stderr)
    else:
      try: backfill(sggs, yms)                                                     # 과거 전체 기간 (조금씩)
      except Exception as e: print('과거 자료 채우기 실패:', e, file=sys.stderr)
    # 단지별 모으기
    cut = (kst_today() - datetime.timedelta(days=366)).isoformat()
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
    rows, hit = [], 0
    for key, a in apts.items():
        d, s = a['last'], a['sgg']
        sido, gu = sgg_name.get(s, ('', ''))
        hh, road = 0, ''
        for pnu in [pnu_of(s, umd.get((s, d[7].strip())), d[8])] + by_addr.get((s, d[7].strip() + ' ' + d[8].strip()), []):   # 필지번호 → 주소 지번 순
            hh, road = households(by_pnu, pnu, d[6])
            if hh: break
        hit += 1 if hh else 0
        rows.append([key, d[6], d[2], d[3], d[1], d[4], hh, sido, gu, (d[7] + ' ' + d[8]).strip(), road, d[9], a['n']])
    rows.sort(key=lambda r: r[0])
    if len(rows) < 5000: sys.exit('단지 수가 너무 적음: %d' % len(rows))
    data = {'source': '국토교통부 아파트 매매 실거래가 · 한국부동산원 공동주택 단지 식별정보', 'months': [yms[-1], yms[0]],
            'total': len(rows), 'hhMatched': hit}
    old = None
    if os.path.exists(OUT):
        try: old = json.load(open(OUT, encoding='utf-8'))
        except Exception: old = None
    if old and old.get('rows') == rows and old.get('months') == data['months']:
        print('변경 없음 (%d개 단지)' % len(rows)); return
    data['updated'] = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
    head = json.dumps(data, ensure_ascii=False, separators=(',', ':'))[:-1]
    with open(OUT, 'w', encoding='utf-8') as f:                                 # 한 줄에 한 단지 → 바뀐 줄만 git 에 남음
        f.write(head + ',"rows":[\n' + ',\n'.join(json.dumps(r, ensure_ascii=False, separators=(',', ':')) for r in rows) + '\n]}\n')
    print('저장: 단지 %d개 · 세대수 연결 %d개 (%.0f%%) · %s~%s' % (len(rows), hit, hit * 100 / len(rows), yms[-1], yms[0]))


if __name__ == '__main__':
    main()
