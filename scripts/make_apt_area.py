#!/usr/bin/env python3
"""
지역별 아파트 시세 요약 — data/apt_rank.json(단지별 가장 최근 실거래) → data/apt_area.json
'내 연봉으로 집 사기까지 몇 년' 계산기가 씀 (5MB 순위 파일 대신 수십 KB만 받도록)

  지역: 전국 · 시도 · 시군구
  값  : 단지 수, 실거래가 중위값(만원), 전용 3.3㎡(1평)당 가격 중위값(만원),
        전용 59㎡형(55~65㎡)·84㎡형(80~90㎡) 거래 중위값(만원, 표본 5개 이상일 때)
"""
import json, os, statistics, datetime

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data')
SRC, OUT = os.path.join(ROOT, 'apt_rank.json'), os.path.join(ROOT, 'apt_area.json')
SIDO_ORDER = ['서울', '경기', '인천', '부산', '대구', '광주', '대전', '울산', '세종', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주']


def med(v):
    return round(statistics.median(v)) if v else None


def summary(rows):
    p = [r[2] for r in rows]
    py = [r[2] / (r[3] / 3.3058) for r in rows if r[3] and r[3] > 0]
    s59 = [r[2] for r in rows if r[3] and 55 <= r[3] <= 65]
    s84 = [r[2] for r in rows if r[3] and 80 <= r[3] <= 90]
    return {'n': len(rows), 'med': med(p), 'py': med(py),
            'p59': med(s59) if len(s59) >= 5 else None, 'n59': len(s59),
            'p84': med(s84) if len(s84) >= 5 else None, 'n84': len(s84)}


def main():
    d = json.load(open(SRC, encoding='utf-8'))
    rows = d['rows']   # [단지키, 이름, 금액(만원), 전용㎡, 계약일, 층, 세대수, 시도, 시군구, …]
    out = {'unit': '만원', 'months': d.get('months'), 'updated': d.get('updated') or datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ'),
           'all': summary(rows), 'sido': {}, 'sgg': {}}
    by_sido, by_sgg = {}, {}
    for r in rows:
        by_sido.setdefault(r[7], []).append(r)
        by_sgg.setdefault((r[7], r[8]), []).append(r)
    for k in sorted(by_sido, key=lambda x: (SIDO_ORDER.index(x) if x in SIDO_ORDER else 99, x)):
        out['sido'][k] = summary(by_sido[k])
    for (sd, gu) in sorted(by_sgg, key=lambda x: (SIDO_ORDER.index(x[0]) if x[0] in SIDO_ORDER else 99, x[1])):
        if gu:
            out['sgg'][sd + ' ' + gu] = summary(by_sgg[(sd, gu)])
    txt = json.dumps(out, ensure_ascii=False, separators=(',', ':'))
    if os.path.exists(OUT) and open(OUT, encoding='utf-8').read() == txt:
        print('변경 없음'); return
    open(OUT, 'w', encoding='utf-8').write(txt)
    print(f"저장: 시도 {len(out['sido'])} · 시군구 {len(out['sgg'])} · 전국 {out['all']}")


if __name__ == '__main__':
    main()
