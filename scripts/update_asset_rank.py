#!/usr/bin/env python3
"""
국내 나의 자산 순위 — 통계청 가계금융복지조사(KOSIS) → data/asset_rank.json (표준 라이브러리만)

KOSIS 통계표 (orgId 101) — 공개 화면이 쓰는 html.do 를 같은 요청값(scripts/kosis_asset_req.json)으로 조회
  DT_1HDAAA21  순자산, 가구소득의 분위별 평균, 점유율 및 경계값  → 순자산 10분위 경계값 P10~P90, 평균
  DT_1HDAAD03  순자산 10분위별 가구의 순자산 점유율            → 10분위별 평균 순자산·점유율
  DT_1HDAAA06  가구주연령계층별(10세) 자산, 부채, 소득 현황     → 연령대별 순자산 평균·중앙값
  · 1년에 한 번(12월) 새 조사연도가 나옴 → 올해·작년 순으로 시도해 값이 있는 가장 최근 연도를 씀
  · 짧은 시간에 여러 번 부르면 KOSIS 가 잠시 막으므로 요청 사이에 쉬고, 실패하면 직전 자료 유지
"""
import datetime, json, os, re, sys, time, urllib.parse, urllib.request

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
REQ = json.load(open(os.path.join(ROOT, 'scripts', 'kosis_asset_req.json'), encoding='utf-8'))
OUT = os.path.join(ROOT, 'data', 'asset_rank.json')
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'


def cells(tbl, year):
    """통계표 html.do → 칸 글자 목록 (표가 비었거나 막히면 [])"""
    form = [(k, v.replace('"prdValue":"Y,2025,@"', '"prdValue":"Y,%d,@"' % year)) for k, v in REQ[tbl]]
    q = urllib.request.Request('https://kosis.kr/statHtml/html.do', data=urllib.parse.urlencode(form).encode(), headers={
        'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'X-Requested-With': 'XMLHttpRequest',
        'Referer': 'https://kosis.kr/statHtml/statHtml.do?orgId=101&tblId=' + tbl})
    for i in range(3):
        try:
            with urllib.request.urlopen(q, timeout=60) as r: t = r.read().decode('utf-8', 'replace')
        except Exception as e:                                                    # 접속 문제만 다시 시도
            print('%s %d 실패(%d): %s' % (tbl, year, i + 1, e), file=sys.stderr); time.sleep(15 * (i + 1)); continue
        try: h = json.loads(t)['result'][0]
        except Exception: return []                                               # 그 연도 자료 없음 · 차단 안내 화면
        if str(year) not in h: return []
        return [re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', c).replace('&nbsp;', ' ')).strip()
                for c in re.findall(r'<t[hd][^>]*>(.*?)</t[hd]>', h, re.S)]
    return []


def num(s):
    s = (s or '').replace(',', '').strip()
    return float(s) if re.fullmatch(r'-?\d+(\.\d+)?', s) else None


def after(cs, label, n=1, start=0):
    """label 칸 다음에 나오는 숫자 n개"""
    i = cs.index(label, start)
    out = []
    for c in cs[i + 1:]:
        v = num(c)
        if v is not None: out.append(v)
        if len(out) == n: return out
    raise ValueError(label)


def main():
    this = datetime.date.today().year
    year = cs = None
    for y in (this, this - 1, this - 2):
        cs = cells('DT_1HDAAA21', y)
        if cs and 'P90 (만원)' in cs: year = y; break
        time.sleep(5)
    if not year: sys.exit('경계값 표를 받지 못함')
    bounds = [after(cs, 'P%d (만원)' % k)[0] for k in range(10, 100, 10)]          # 하위 10%~90% 경계 (만원)
    mean = after(cs, '소계')[0]
    time.sleep(6)
    d3 = cells('DT_1HDAAD03', year)
    dec = [after(d3, '순자산 %d분위' % k, 2) for k in range(1, 11)]               # [평균, 점유율]
    time.sleep(6)
    a6 = cells('DT_1HDAAA06', year)
    stop = a6.index('부채 보유') if '부채 보유' in a6 else len(a6)                  # 앞쪽 '전체'(부채 보유 여부 전체) 묶음만
    a6 = a6[:stop]
    ages = []
    for lab, key in (('전체', '전체'), ('29세 이하', '29세 이하'), ('30~39세', '30~39세'), ('40~49세', '40~49세'),
                     ('50~59세', '50~59세'), ('60세 이상', '60세 이상'), ('65세 이상', '65세 이상')):
        i = a6.index(key)
        share = after(a6, '가구분포 (%)', 1, i)[0]
        m, med = after(a6, '순자산액 (만원)', 2, i)
        ages.append([lab, m, med, share])
    if not (all(a < b for a, b in zip(bounds, bounds[1:])) and dec[-1][0] > bounds[-1] and abs(ages[0][1] - mean) < 1):
        sys.exit('값 점검 실패: %r %r %r' % (bounds, dec, ages[0]))
    data = {'year': year, 'source': 'https://kosis.kr/statHtml/statHtml.do?orgId=101&tblId=DT_1HDAAA21',
            'title': '통계청 가계금융복지조사', 'base': '%d년 3월 31일' % year, 'unit': '만원',
            'mean': mean, 'median': bounds[4], 'bounds': bounds, 'deciles': dec, 'ages': ages}
    old = json.load(open(OUT, encoding='utf-8')) if os.path.exists(OUT) else None
    if old and {k: v for k, v in old.items() if k != 'updated'} == data:
        print('변경 없음 (%d년 조사)' % year); return
    data['updated'] = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
    with open(OUT, 'w', encoding='utf-8') as f: json.dump(data, f, ensure_ascii=False, separators=(',', ':'))
    print('저장: %d년 조사 · 평균 %s만원 · 중앙값 %s만원' % (year, format(int(mean), ','), format(int(bounds[4]), ',')))


if __name__ == '__main__':
    main()
