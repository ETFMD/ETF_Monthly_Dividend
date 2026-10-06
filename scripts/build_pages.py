#!/usr/bin/env python3
"""도구(탭)별 고유 주소 페이지·sitemap.xml·robots.txt·404.html 생성

· 원본은 루트 index.html 하나 — 이 스크립트가 scripts/routes.json 의 도구마다
  <경로>/index.html 을 만들고, 각 페이지의 <head> 에 고유 제목·설명·공유 미리보기(OG)·canonical 을 넣습니다.
· 하위 페이지는 <base href="../"> 로 data/*.json 등 상대 경로를 루트 기준으로 맞추고,
  처음부터 해당 도구 화면이 보이도록 active 탭을 바꿔 둡니다 (검색엔진·JS 없는 환경도 같은 화면).
· 루트 index.html 은 <!--SEO:BEGIN--> ~ <!--SEO:END--> 구간만 다시 씁니다 (몇 번 실행해도 결과 동일).
· 자체 도메인을 쓰려면 저장소 루트에 CNAME 파일(예: decoding.kr)만 두면 주소가 자동으로 바뀝니다.
사용: python3 scripts/build_pages.py   (GitHub Actions 'build-pages' 가 index.html 변경 시 자동 실행)
"""
import datetime, html, json, os, re, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
SRC = os.path.join(ROOT, 'index.html')
CFG = json.load(open(os.path.join(ROOT, 'scripts', 'routes.json'), encoding='utf-8'))
BEGIN, END = '<!--SEO:BEGIN-->', '<!--SEO:END-->'


def site_url():
    cname = os.path.join(ROOT, 'CNAME')
    if os.path.exists(cname):
        host = open(cname, encoding='utf-8').read().strip().splitlines()[0].strip()
        if host:
            return f'https://{host}/'
    url = CFG['site']
    return url if url.endswith('/') else url + '/'


SITE = site_url()
BRAND = CFG['brand']
HOME = dict(CFG['home'], path='')
ROUTES = CFG['routes']
ALL = [HOME] + ROUTES


def esc(s):
    return html.escape(s, quote=True)


def og_image(r):
    rel = f"assets/og/{r['path'] or 'home'}.png"
    return SITE + (rel if os.path.exists(os.path.join(ROOT, rel)) else 'assets/og/home.png')


NAV_LABEL = {}   # 탭 id → 메뉴에 보이는 탭 이름 (index.html 의 드롭다운 버튼 글자에서 읽음)


def load_nav_labels(src):
    for m in re.finditer(r'<button class="drop-item[^"]*"\s+id="drop-([a-z0-9]+)"[^>]*>(.*?)</button>', src, re.S):
        NAV_LABEL[m.group(1)] = re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', '', m.group(2)))).strip()
    missing = [x['tab'] for x in ALL if not NAV_LABEL.get(x['tab'])]
    if missing:
        sys.exit(f'메뉴에서 탭 이름을 찾지 못했습니다: {missing}')


def tab_title(r):
    """브라우저 탭 제목: '디코딩 자본주의 | 탭 이름' (탭 이름은 메뉴 글자 그대로 — 메뉴를 바꾸면 제목도 따라 바뀜)"""
    return f"{BRAND} | {NAV_LABEL[r['tab']]}"


def head_block(r):
    url = SITE + (r['path'] + '/' if r['path'] else '')
    title = tab_title(r)                                                      # <title> · 검색 결과 제목
    share = r['title'] if not r['path'] else f"{r['title']} | {BRAND}"     # 공유 미리보기 제목 (설명형)
    ld = {
        '@context': 'https://schema.org',
        '@type': 'WebSite' if not r['path'] else 'WebApplication',
        'name': BRAND if not r['path'] else r['short'],
        'url': url, 'description': r['desc'], 'inLanguage': 'ko-KR',
    }
    if r['path']:
        ld.update({'applicationCategory': 'FinanceApplication', 'operatingSystem': 'Web',
                   'offers': {'@type': 'Offer', 'price': '0', 'priceCurrency': 'KRW'},
                   'isPartOf': {'@type': 'WebSite', 'name': BRAND, 'url': SITE}})
    registry = [{'path': x['path'], 'tab': x['tab'], 'group': x['group'],
                 'title': tab_title(x), 'share': x['title'] if not x['path'] else f"{x['title']} | {BRAND}", 'desc': x['desc']} for x in ALL]
    lines = [
        BEGIN,
        f'<base href="{"../" if r["path"] else "./"}">',
        # 주소가 pushState 로 바뀌어도 data/ 등 상대 경로가 사이트 루트를 가리키도록 base 를 절대 주소로 고정
        '<script>(function(){var b=document.querySelector("base");if(b)b.setAttribute("href",b.href);})();</script>',
        f'<title>{esc(title)}</title>',
        f'<meta name="description" content="{esc(r["desc"])}">',
        f'<link rel="canonical" href="{esc(url)}">',
        f'<meta name="etfmd-route" content="{esc(r["path"])}">',
        '<meta property="og:type" content="website">',
        f'<meta property="og:site_name" content="{esc(BRAND)}">',
        '<meta property="og:locale" content="ko_KR">',
        f'<meta property="og:title" content="{esc(share)}">',
        f'<meta property="og:description" content="{esc(r["desc"])}">',
        f'<meta property="og:url" content="{esc(url)}">',
        f'<meta property="og:image" content="{esc(og_image(r))}">',
        '<meta property="og:image:width" content="1200">',
        '<meta property="og:image:height" content="630">',
        '<meta name="twitter:card" content="summary_large_image">',
        f'<meta name="twitter:title" content="{esc(share)}">',
        f'<meta name="twitter:description" content="{esc(r["desc"])}">',
        f'<meta name="twitter:image" content="{esc(og_image(r))}">',
        '<script type="application/ld+json">' + json.dumps(ld, ensure_ascii=False) + '</script>',
        '<script id="etfmd-routes" type="application/json">' + json.dumps(registry, ensure_ascii=False).replace('</', '<\\/') + '</script>',
        END,
    ]
    return '\n'.join(lines)


def with_head(src, r):
    block = head_block(r)
    if BEGIN in src:
        return re.sub(re.escape(BEGIN) + r'.*?' + re.escape(END), lambda m: block, src, count=1, flags=re.S)
    # 처음 한 번: 기존 <title> 을 SEO 구간으로 바꿈
    out, n = re.subn(r'<title>.*?</title>', lambda m: block, src, count=1, flags=re.S)
    if n != 1:
        sys.exit('index.html 에서 <title> 을 찾지 못했습니다')
    return out


def activate(src, r):
    """하위 페이지: 처음 보이는 화면(app-page·드롭다운·그룹 버튼)을 해당 도구로"""
    tab, grp = r['tab'], r['group']
    out = re.sub(r'class="app-page active" id="page-', 'class="app-page" id="page-', src)
    out, n = re.subn(rf'class="app-page" id="page-{tab}"', f'class="app-page active" id="page-{tab}"', out, count=1)
    if n != 1:
        sys.exit(f'page-{tab} 을 찾지 못했습니다')
    out = re.sub(r'(<button class="tab-group-btn) has-active(")', r'\1\2', out)
    out = out.replace(f'<button class="tab-group-btn" id="grp-{grp}-btn"', f'<button class="tab-group-btn has-active" id="grp-{grp}-btn"', 1)
    out = re.sub(r'class="drop-item active"', 'class="drop-item"', out)
    out, n = re.subn(rf'class="drop-item"(\s+)id="drop-{tab}"', rf'class="drop-item active"\1id="drop-{tab}"', out, count=1)
    if n != 1:
        sys.exit(f'drop-{tab} 버튼을 찾지 못했습니다')
    return out


def write_if_changed(path, text):
    full = os.path.join(ROOT, path)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    old = open(full, encoding='utf-8').read() if os.path.exists(full) else None
    if old != text:
        with open(full, 'w', encoding='utf-8', newline='\n') as f:
            f.write(text)
        print('  저장', path)
        return True
    return False


def main():
    src = open(SRC, encoding='utf-8').read()
    load_nav_labels(src)
    # 원본에 이미 들어 있는 하위 페이지 표시(앞선 빌드 결과)가 있으면 루트 기준으로 되돌린 뒤 시작
    home = with_head(src, HOME)
    write_if_changed('index.html', home)
    paths = set()
    for r in ROUTES:
        if r['path'] in paths or not re.fullmatch(r'[a-z0-9-]+', r['path']):
            sys.exit(f"경로 오류: {r['path']}")
        paths.add(r['path'])
        write_if_changed(f"{r['path']}/index.html", activate(with_head(home, r), r))
    # 예전 빌드에 있었으나 routes.json 에서 빠진 경로 정리
    marker = '<meta name="etfmd-route" content="'
    for d in sorted(os.listdir(ROOT)):
        f = os.path.join(ROOT, d, 'index.html')
        if d not in paths and os.path.isfile(f) and marker in open(f, encoding='utf-8').read(8192 * 4):
            os.remove(f)
            print('  삭제', f'{d}/index.html')
    today = datetime.date.today().isoformat()
    urls = ''.join(f'  <url><loc>{esc(SITE + (r["path"] + "/" if r["path"] else ""))}</loc><lastmod>{today}</lastmod>'
                   f'<changefreq>{"daily" if not r["path"] else "weekly"}</changefreq><priority>{"1.0" if not r["path"] else "0.8"}</priority></url>\n'
                   for r in ALL)
    sitemap = f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n{urls}</urlset>\n'
    old = open(os.path.join(ROOT, 'sitemap.xml'), encoding='utf-8').read() if os.path.exists(os.path.join(ROOT, 'sitemap.xml')) else ''
    if re.sub(r'<lastmod>[^<]*</lastmod>', '', old) != re.sub(r'<lastmod>[^<]*</lastmod>', '', sitemap):
        write_if_changed('sitemap.xml', sitemap)          # 주소 목록이 바뀔 때만 (날짜만 바뀌는 커밋 방지)
    write_if_changed('robots.txt', f'User-agent: *\nAllow: /\n\nSitemap: {SITE}sitemap.xml\n')
    write_if_changed('404.html', f'''<!DOCTYPE html>
<html lang="ko"><head><meta charset="UTF-8"><meta name="robots" content="noindex">
<meta name="viewport" content="width=device-width, initial-scale=1.0"><title>페이지를 찾을 수 없습니다 | {esc(BRAND)}</title>
<script>location.replace({json.dumps(SITE)});</script></head>
<body style="font-family:sans-serif;background:#111;color:#ddd;text-align:center;padding:60px 16px;">
<p>페이지를 찾을 수 없습니다. <a href="{esc(SITE)}" style="color:#3182f6;">{esc(BRAND)} 홈으로 이동</a></p></body></html>
''')
    print(f'완료 — 주소 {len(ALL)}개 · {SITE}')


if __name__ == '__main__':
    main()
