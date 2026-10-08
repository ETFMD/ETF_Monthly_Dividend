#!/usr/bin/env python3
"""
국내 나의 연봉 순위 — 국세청 근로소득 백분위(천분위) 자료 → data/salary_rank.json (표준 라이브러리만)

자료: 공공데이터포털 「국세청_근로소득 백분위(천분위) 자료」 https://www.data.go.kr/data/15082063/fileData.do
  · 1년에 한 번(보통 연말~이듬해 초) 새 귀속연도 파일로 바뀜 → 매달 확인해서 바뀌었을 때만 저장
  · 행: 상위 0.1%~1.0%(0.1%p 단위 10행) + 상위 2%~100%(1%p 단위 99행), 각 구간의 인원·총급여 합계(억원)
출력: {year: 귀속연도, filed: 신고연도, title, source, updated, total, rows: [[상위%, 인원, 총급여 합계(원)], ...]}
"""
import csv, io, json, os, re, sys, urllib.request, datetime

PAGE = 'https://www.data.go.kr/data/15082063/fileData.do'
DOWN = 'https://www.data.go.kr/cmm/cmm/fileDownload.do?atchFileId=%s&fileDetailSn=%s&insertDataPrcus=N'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data', 'salary_rank.json')
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'


def get(url, timeout=60):
    with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA, 'Accept-Language': 'ko-KR,ko;q=0.9'}), timeout=timeout) as r:
        return r.read()


def main():
    h = get(PAGE).decode('utf-8', 'replace')
    m = re.search(r'atchFileId=(FILE_\d+)&fileDetailSn=(\d+)', h)
    if not m: sys.exit('다운로드 링크를 찾지 못함')
    text = re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', h))
    title = (re.search(r'파일데이터명\s*(국세청_근로소득 백분위\(천분위\) 자료_\d{8})', text) or [None, None])[1]
    yr = re.search(r'(20\d\d)년 근로소득에 대한 (20\d\d)년 신고 자료', text)
    raw = get(DOWN % m.groups())
    for enc in ('utf-8-sig', 'cp949'):
        try: body = raw.decode(enc); break
        except UnicodeDecodeError: continue
    rows, prev = [], 0.0
    for r in csv.reader(io.StringIO(body)):
        if not r or '상위' not in r[0]: continue
        top = float(re.sub(r'[^0-9.]', '', r[0]))
        n, s = int(r[1].replace(',', '')), float(r[2].replace(',', ''))
        if top <= prev or n <= 0: sys.exit('구간 순서가 이상함: %r' % r)
        rows.append([top, n, round(s * 1e8)]); prev = top
    if len(rows) < 100 or rows[-1][0] != 100: sys.exit('행 수가 이상함: %d' % len(rows))
    means = [s / n for _, n, s in rows]
    if any(a < b for a, b in zip(means, means[1:])): sys.exit('구간 평균이 내림차순이 아님')
    data = {
        'year': int(yr.group(1)) if yr else None, 'filed': int(yr.group(2)) if yr else None,
        'title': title, 'source': PAGE, 'total': sum(r[1] for r in rows), 'rows': rows,
    }
    old = None
    if os.path.exists(OUT):
        with open(OUT, encoding='utf-8') as f: old = json.load(f)
    if old and {k: v for k, v in old.items() if k != 'updated'} == data:
        print('변경 없음 (%s년 귀속)' % data['year']); return
    data['updated'] = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
    with open(OUT, 'w', encoding='utf-8') as f: json.dump(data, f, ensure_ascii=False, separators=(',', ':'))
    print('저장: %s년 귀속 · 근로자 %s명 · %d구간' % (data['year'], format(data['total'], ','), len(rows)))


if __name__ == '__main__':
    main()
