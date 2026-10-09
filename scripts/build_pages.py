#!/usr/bin/env python3
"""도구(탭)별 고유 주소 페이지·sitemap.xml·robots.txt·404.html 생성

· 원본은 src/index.html 하나(모든 도구가 든 한 파일) — 이 스크립트가 홈(루트 index.html)과 scripts/routes.json 의 도구마다
  <경로>/index.html 을 만들고, 각 페이지의 <head> 에 고유 제목·설명·공유 미리보기(OG)·canonical 을 넣습니다.
· 도구별 페이지 분리: 각 페이지의 HTML 에는 그 도구 화면(app-page) 하나만 남기고, 큰 CSS·JS 는
  assets/app.<해시>.css · assets/app.<해시>.js 로 빼서 모든 페이지가 같은 파일을 캐시로 함께 씀
  (다른 도구로 가면 메뉴가 그 주소로 이동 — src/index.html 의 [ROUTER] 참고)
· 푸터의 전체 도구 링크(<!--FOOTMAP-->)를 routes.json 으로 채움 (검색엔진이 모든 도구 주소를 따라갈 수 있게)
· 하위 페이지는 <base href="../"> 로 data/*.json 등 상대 경로를 루트 기준으로 맞추고,
  처음부터 해당 도구 화면이 보이도록 active 탭을 바꿔 둡니다 (검색엔진·JS 없는 환경도 같은 화면).
· 자체 도메인을 쓰려면 저장소 루트에 CNAME 파일(예: decoding.kr)만 두면 주소가 자동으로 바뀝니다.
사용: python3 scripts/build_pages.py   (GitHub Actions 'build-pages' 가 src/index.html 변경 시 자동 실행)
"""
import datetime, hashlib, html, json, os, re, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
SRC = os.path.join(ROOT, 'src', 'index.html')
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
DESC_MAX = 80   # 네이버 서치어드바이저 권장: 설명문 80자 이내
for _r in [CFG['home']] + CFG['routes']:
    if len(_r['desc']) > DESC_MAX:
        sys.exit(f"설명이 {DESC_MAX}자를 넘습니다 ({len(_r['desc'])}자): {_r.get('path') or 'home'} — scripts/routes.json 의 desc 를 줄여 주세요")
    if 'en' in _r and len(_r['en']['desc']) > 160:
        sys.exit(f"영어 설명이 160자를 넘습니다: {_r.get('path')}")
BRAND = CFG['brand']
BRAND_EN = CFG.get('brand_en', 'Decoding Capitalism')
EN_FILE = os.path.join(ROOT, 'scripts', 'i18n', 'en.json')
EN = json.load(open(EN_FILE, encoding='utf-8')) if os.path.exists(EN_FILE) else {'text': {}, 'guides': {}}
HOME = dict(CFG['home'], path='')
ROUTES = CFG['routes']
ALL = [HOME] + ROUTES


def esc(s):
    return html.escape(s, quote=True)


def og_image(r):
    rel = f"assets/og/{r['path'] or 'home'}.png"
    if not os.path.exists(os.path.join(ROOT, rel)):
        rel = 'assets/og/home.png'
    # 이미지가 바뀌면 주소도 바뀌게(?v=내용 해시) — 카카오톡·페이스북 등이 예전 미리보기 이미지를 계속 쓰지 않도록
    v = hashlib.sha256(open(os.path.join(ROOT, rel), 'rb').read()).hexdigest()[:8]
    return f'{SITE}{rel}?v={v}'


NAV_LABEL = {}   # 탭 id → 메뉴에 보이는 탭 이름 (index.html 의 드롭다운 버튼 글자에서 읽음)
NAV_ICON = {}    # 탭 id → 메뉴 버튼의 아이콘 SVG (허브 페이지 카드에 그대로 씀)


def plain(h):
    return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', '', h))).strip()


def load_nav_labels(src):
    for m in re.finditer(r'<button class="drop-item[^"]*"\s+id="drop-([a-z0-9]+)"[^>]*>(.*?)</button>', src, re.S):
        body = re.sub(r'<span class="drop-all">.*?</span>', '', m.group(2))   # 허브 버튼의 '전체' 표시는 이름이 아님
        NAV_LABEL[m.group(1)] = plain(body)
        ic = re.search(r'<svg\b.*?</svg>', body, re.S)
        if ic:
            NAV_ICON[m.group(1)] = ic.group(0)
    missing = [x['tab'] for x in ALL if not NAV_LABEL.get(x['tab'])]
    if missing:
        sys.exit(f'메뉴에서 탭 이름을 찾지 못했습니다: {missing}')


def tab_title(r):
    """브라우저 탭 제목: '디코딩 자본주의 | 탭 이름' (탭 이름은 메뉴 글자 그대로 — 메뉴를 바꾸면 제목도 따라 바뀜)"""
    return f"{BRAND} | {NAV_LABEL[r['tab']]}"


def url_of(r, lang='ko'):
    return SITE + ('en/' if lang == 'en' else '') + (r['path'] + '/' if r['path'] else '')


def head_block(r, lang='ko'):
    en = lang == 'en'
    url = url_of(r, lang)
    if en:
        title = f"{BRAND_EN} | {r['en']['short']}"
        share, desc = r['en']['title'], r['en']['desc']
    else:
        title = tab_title(r)                                                      # <title> · 검색 결과 제목
        share = r['title'] if not r['path'] else f"{r['title']} | {BRAND}"     # 공유 미리보기 제목 (설명형)
        desc = r['desc']
    ld = {
        '@context': 'https://schema.org',
        '@type': 'WebSite' if not r['path'] else 'WebApplication',
        'name': (BRAND_EN if en else BRAND) if not r['path'] else (r['en']['short'] if en else r['short']),
        'url': url, 'description': desc, 'inLanguage': 'en' if en else 'ko-KR',
    }
    ld['publisher'] = {'@type': 'Organization', 'name': BRAND_EN if en else BRAND, 'url': SITE,
                       'logo': {'@type': 'ImageObject', 'url': SITE + 'assets/logo-512.png', 'width': 512, 'height': 512}}
    if r.get('hub'):
        ld['@type'] = 'CollectionPage'
        ld['mainEntity'] = {'@type': 'ItemList', 'itemListElement': [
            {'@type': 'ListItem', 'position': i + 1, 'url': url_of(x, lang) if (not en or 'en' in x) else url_of(x), 'name': NAV_LABEL[x['tab']]}
            for i, x in enumerate(hub_tools(r['group']))]}
    elif r['path']:
        ld.update({'applicationCategory': 'FinanceApplication', 'operatingSystem': 'Web',
                   'offers': {'@type': 'Offer', 'price': '0', 'priceCurrency': 'KRW'},
                   'isPartOf': {'@type': 'WebSite', 'name': BRAND_EN if en else BRAND, 'url': SITE}})
    registry = []
    for x in ALL:
        e = {'path': x['path'], 'tab': x['tab'], 'group': x['group'],
             'title': tab_title(x), 'share': x['title'] if not x['path'] else f"{x['title']} | {BRAND}", 'desc': x['desc']}
        if 'en' in x:
            e.update({'en': True, 'enTitle': f"{BRAND_EN} | {x['en']['short']}", 'enDesc': x['en']['desc']})
        registry.append(e)
    lines = [
        BEGIN,
        f'<base href="{("../../" if en else "../") if r["path"] else "./"}">',
        # 주소가 pushState 로 바뀌어도 data/ 등 상대 경로가 사이트 루트를 가리키도록 base 를 절대 주소로 고정
        '<script>(function(){var b=document.querySelector("base");if(b)b.setAttribute("href",b.href);})();</script>',
        f'<title>{esc(title)}</title>',
        f'<meta name="description" content="{esc(desc)}">',
        f'<link rel="canonical" href="{esc(url)}">',
    ]
    if 'en' in r:   # 한국어·영어 두 판이 있는 도구: 검색엔진에 서로의 언어판을 알려 줌
        lines += [f'<link rel="alternate" hreflang="ko" href="{esc(url_of(r))}">',
                  f'<link rel="alternate" hreflang="en" href="{esc(url_of(r, "en"))}">',
                  f'<link rel="alternate" hreflang="x-default" href="{esc(url_of(r))}">']
    lines += [
        f'<meta name="etfmd-route" content="{esc(r["path"])}">',
        '<meta property="og:type" content="website">',
        f'<meta property="og:site_name" content="{esc(BRAND_EN if en else BRAND)}">',
        f'<meta property="og:locale" content="{"en_US" if en else "ko_KR"}">',
        f'<meta property="og:title" content="{esc(share)}">',
        f'<meta property="og:description" content="{esc(desc)}">',
        f'<meta property="og:url" content="{esc(url)}">',
        f'<meta property="og:image" content="{esc(og_image(r))}">',
        '<meta property="og:image:width" content="1200">',
        '<meta property="og:image:height" content="630">',
        '<meta name="twitter:card" content="summary_large_image">',
        f'<meta name="twitter:title" content="{esc(share)}">',
        f'<meta name="twitter:description" content="{esc(desc)}">',
        f'<meta name="twitter:image" content="{esc(og_image(r))}">',
        '<script type="application/ld+json">' + json.dumps(ld, ensure_ascii=False) + '</script>',
    ]
    if r['path'] and not en:   # 경로 표시(홈 › 영역 › 도구) — 검색 결과에 사이트 구조가 보이게
        crumbs = [('홈' , SITE)]
        hub = HUB.get(r['group'])
        if hub and hub is not r:
            crumbs.append((AREA[r['group']], url_of(hub)))
        crumbs.append((AREA[r['group']] if r.get('hub') else NAV_LABEL[r['tab']], url))
        lines.append('<script type="application/ld+json">' + json.dumps({'@context': 'https://schema.org', '@type': 'BreadcrumbList', 'itemListElement': [
            {'@type': 'ListItem', 'position': i + 1, 'name': n, 'item': u} for i, (n, u) in enumerate(crumbs)]}, ensure_ascii=False) + '</script>')
    lines += [
        '<script id="etfmd-routes" type="application/json">' + json.dumps(registry, ensure_ascii=False).replace('</', '<\\/') + '</script>',
        END,
    ]
    return '\n'.join(lines)


def with_head(src, r, lang='ko'):
    block = head_block(r, lang)
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
    hub = HUB.get(grp)
    if hub:   # 화면 위쪽 경로 표시: 홈 › 영역(허브) [› 도구] — 허브 페이지로 들어가는 내부 링크
        area = f'<span aria-current="page">{esc(AREA[grp])}</span>' if r.get('hub') else f'<a href="{esc(hub["path"])}/">{esc(AREA[grp])}</a>'
        nav = f'<nav class="crumbs" aria-label="현재 위치"><a href="./">홈</a><i>›</i>{area}</nav>'
        out = out.replace(f'class="app-page active" id="page-{tab}">', f'class="app-page active" id="page-{tab}">\n    {nav}', 1)
    return out


# ───────────── 도구별 페이지 분리 ─────────────
AREA = {'me': '내 위치', 'pay': '월급·세금', 'invest': '투자', 'realty': '부동산', 'passive': '불로소득'}   # 노동자→자본가 여정 순서 (상단 메뉴와 같음)
HUB = {r['group']: r for r in ROUTES if r.get('hub')}   # 영역 → 허브 페이지 route (routes.json 의 "hub": true)
HUB_TOP = {'me': '진단 도구', 'pay': '월급·세금 계산기', 'invest': '투자 계산기·도구', 'realty': '부동산 계산기', 'passive': '불로소득 도구'}
DROP = {}   # 영역 → [(소제목, [탭…]), …] — 상단 메뉴 드롭다운 구조 그대로 (메뉴를 바꾸면 허브도 따라 바뀜)


def load_drop_tree(src):
    by_tab = {x['tab'] for x in ROUTES}
    for g in AREA:
        m = re.search(r'<div class="tab-dropdown" id="grp-%s-drop">' % g, src)
        if not m:
            sys.exit(f'grp-{g}-drop 을 찾지 못했습니다')
        i, depth = m.end(), 1
        for t in re.finditer(r'<div\b|</div>', src[i:]):
            depth += 1 if t.group(0) == '<div' else -1
            if depth == 0:
                body = src[i:i + t.start()]
                break
        secs, top = [], []
        parents = list(re.finditer(r'<div class="drop-parent"[^>]*>(.*?)</div></div>\s*</div>', body, re.S))
        rest = body
        for pm in parents:
            rest = rest.replace(pm.group(0), '')
        for t in re.findall(r'<button class="drop-item[^"]*"\s+id="drop-([a-z0-9]+)"', rest):
            if t in by_tab and not HUB.get(g, {}).get('tab') == t:
                top.append(t)
        if top:
            secs.append((HUB_TOP[g], top))
        for pm in parents:
            name = plain(re.search(r'<button[^>]*drop-parent-btn[^>]*>(.*?)</button>', pm.group(1), re.S).group(1)).replace('▼', '').strip()
            items = [t for t in re.findall(r'id="drop-([a-z0-9]+)"', pm.group(1)) if t in by_tab]
            if items:
                secs.append((name, items))
        DROP[g] = secs
    listed = {t for g in DROP for _, ts in DROP[g] for t in ts}
    lost = [x['tab'] for x in ROUTES if not x.get('hub') and x['tab'] not in listed]
    if lost:
        sys.exit(f'허브에 빠진 도구(메뉴에 없음): {lost}')


def hub_tools(g):
    by = {x['tab']: x for x in ROUTES}
    return [by[t] for _, ts in DROP.get(g, []) for t in ts]


def hub_grid(g, en=False):
    T = tr_text if en else (lambda t: t)
    by = {x['tab']: x for x in ROUTES}
    out = ''
    for name, ts in DROP[g]:
        cards = ''.join(f'<a class="hub-card" href="{esc(by[t]["path"])}/"><b>{NAV_ICON.get(t, "")}{esc(T(NAV_LABEL[t]))}</b><span>{esc(by[t]["desc"])}</span></a>' for t in ts)
        out += f'<section class="hub-sec"><h2 class="hub-h">{esc(T(name))} <small>{len(ts)}개</small></h2><div class="hub-grid">{cards}</div></section>'
    return out
ASSET = {}   # 'css' / 'js' → assets/app.<해시>.<확장자> (main 에서 원본으로 만듦)


def main_script_span(src):
    """원본의 큰 앱 스크립트(<script> /* [I18N] 영어 페이지 …) 위치"""
    a = src.index('<script>\n/* [I18N] 영어 페이지')
    return a, src.index('</script>', a) + len('</script>')


def style_span(src):
    m = re.search(r'<style>\n.*?</style>', src, re.S)
    if not m or len(m.group(0)) < 50000:
        sys.exit('원본의 큰 <style> 블록을 찾지 못했습니다')
    return m.start(), m.end()


def make_assets(src):
    """원본의 큰 CSS·JS 를 assets/app.<해시>.css/js 로 저장 (내용이 같으면 같은 이름 → 브라우저 캐시 재사용)"""
    a, b = style_span(src)
    css = src[a:b][len('<style>\n'):-len('</style>')]
    a, b = main_script_span(src)
    js = src[a:b][len('<script>\n'):-len('</script>')]
    keep = set()
    for kind, body in (('css', css), ('js', js)):
        name = f"assets/app.{hashlib.sha256(body.encode('utf-8')).hexdigest()[:10]}.{kind}"
        write_if_changed(name, body)
        ASSET[kind] = name
        keep.add(os.path.basename(name))
    for f in os.listdir(os.path.join(ROOT, 'assets')):   # 예전 해시 파일 정리
        if re.fullmatch(r'app\.[0-9a-f]{10}\.(css|js)', f) and f not in keep:
            os.remove(os.path.join(ROOT, 'assets', f))
            print('  삭제', f'assets/{f}')


def footmap(en=False):
    T = tr_text if en else (lambda t: t)
    cols = []
    for g, name in AREA.items():
        links = ''.join(f'<a href="{esc(r["path"])}/">{esc(T(NAV_LABEL[r["tab"]]))}</a>' for r in ROUTES if r['group'] == g and not r.get('hub'))
        head = f'<a href="{esc(HUB[g]["path"])}/">{esc(T(name))}</a>' if g in HUB else esc(T(name))
        cols.append(f'<div class="sf-col"><p class="sf-h">{head}</p>{links}</div>')
    return f'<nav class="sf-map" aria-label="{esc(T("전체 도구"))}">' + ''.join(cols) + '</nav>'


def finalize(html_text, tab, en=False):
    """한 페이지 출력: 그 도구 화면만 남기고, 큰 CSS·JS 는 공용 파일로"""
    tabs = re.findall(r'<div class="app-page[^"]*" id="page-([a-z0-9]+)">', html_text)
    if tab not in tabs:
        sys.exit(f'page-{tab} 을 찾지 못했습니다')
    for t in tabs:
        if t != tab:
            a, b = section_span(html_text, t)
            html_text = html_text[:a] + html_text[b:]
    a, b = main_script_span(html_text)
    html_text = html_text[:a] + f'<script src="{ASSET["js"]}"></script>' + html_text[b:]
    a, b = style_span(html_text)
    html_text = html_text[:a] + f'<link rel="stylesheet" href="{ASSET["css"]}">' + html_text[b:]
    html_text = re.sub(r'<!--HUBGRID:([a-z]+)-->.*?<!--/HUBGRID-->', lambda m: f'<!--HUBGRID:{m.group(1)}-->' + hub_grid(m.group(1), en) + '<!--/HUBGRID-->', html_text, flags=re.S)
    html_text, n = re.subn(r'<!--FOOTMAP-->.*?<!--/FOOTMAP-->', lambda m: '<!--FOOTMAP-->' + footmap(en) + '<!--/FOOTMAP-->', html_text, count=1, flags=re.S)
    if n != 1:
        sys.exit('<!--FOOTMAP--> 표시를 찾지 못했습니다')
    return html_text


# ───────────── 영어 페이지 (/en/<도구>/) ─────────────
TOP_A, TOP_B = '<div class="wrap">', '<!-- ── 홈 (메인 화면) ── [HOME] ── -->'
BOT_A = '<!-- ── 하단 후원/문의 배너 ── -->'
KO = re.compile(r'[가-힣]')
_missing = set()


def tr_text(t):
    core = t.strip()
    if not core or not KO.search(core):
        return t
    if core in EN['text']:
        i = t.index(core)
        return t[:i] + EN['text'][core] + t[i + len(core):]
    _missing.add(core)
    return t


def translate_html(frag):
    """스크립트·스타일·주석을 뺀 나머지의 글자 덩어리와 일부 속성(title·aria-label·placeholder)만 바꿈"""
    parts = re.split(r'(<script\b.*?</script>|<style\b.*?</style>|<!--.*?-->)', frag, flags=re.S)
    for i in range(0, len(parts), 2):
        seg = re.sub(r'>([^<>]+)<', lambda m: '>' + tr_text(m.group(1)) + '<', parts[i])
        seg = re.sub(r'((?:title|aria-label|placeholder)=")([^"]*)(")', lambda m: m.group(1) + tr_text(m.group(2)) + m.group(3), seg)
        parts[i] = seg
    return ''.join(parts)


def section_span(src, tab):
    """page-<tab> 의 여는 태그부터 짝이 맞는 닫는 </div> 까지 (시작, 끝) 위치"""
    m = re.search(r'<div class="app-page[^"]*" id="page-%s">' % tab, src)
    if not m:
        sys.exit(f'page-{tab} 을 찾지 못했습니다')
    i, depth = m.end(), 1
    for t in re.finditer(r'<div\b|</div>', src[i:]):
        depth += 1 if t.group(0) == '<div' else -1
        if depth == 0:
            return m.start(), i + t.end()
    sys.exit(f'page-{tab} 닫는 태그를 찾지 못했습니다')


def english_page(html):
    out = html.replace('<html lang="ko">', '<html lang="en">', 1)
    # 영어판이 있는 도구 화면: 설명글은 영어판으로 통째로, 나머지 글자는 사전으로
    for x in ROUTES:
        if 'en' not in x:
            continue
        a, b = section_span(out, x['tab'])
        sec = out[a:b]
        g = EN['guides'].get(x['path'])
        if g:
            sec, n = re.subn(r'<!-- \[GUIDE:%s\].*?<!-- \[/GUIDE:%s\] -->\n' % (x['tab'], x['tab']), lambda m: g, sec, count=1, flags=re.S)
        out = out[:a] + translate_html(sec) + out[b:]
    # 상단(방문자 수·메뉴)과 하단(후원·푸터·드롭다운 메뉴)
    a, b = out.index(TOP_A), out.index(TOP_B)
    out = out[:a] + translate_html(out[a:b]) + out[b:]
    a, b = out.index(BOT_A), out.index('</body>')
    out = out[:a] + translate_html(out[a:b]) + out[b:]
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
    load_drop_tree(src)
    # 원본에 이미 들어 있는 하위 페이지 표시(앞선 빌드 결과)가 있으면 루트 기준으로 되돌린 뒤 시작
    make_assets(src)
    home = with_head(src, HOME)
    write_if_changed('index.html', finalize(home, HOME['tab']))
    paths = set()
    for r in ROUTES:
        if r['path'] in paths or not re.fullmatch(r'[a-z0-9-]+', r['path']):
            sys.exit(f"경로 오류: {r['path']}")
        paths.add(r['path'])
        write_if_changed(f"{r['path']}/index.html", finalize(activate(with_head(home, r), r), r['tab']))
        if 'en' in r:
            write_if_changed(f"en/{r['path']}/index.html", finalize(english_page(activate(with_head(home, r, 'en'), r)), r['tab'], en=True))
    # 예전 빌드에 있었으나 routes.json 에서 빠진 경로 정리
    marker = '<meta name="etfmd-route" content="'
    for d in sorted(os.listdir(ROOT)):
        f = os.path.join(ROOT, d, 'index.html')
        if d not in paths and d != 'src' and os.path.isfile(f) and marker in open(f, encoding='utf-8').read(8192 * 4):
            os.remove(f)
            print('  삭제', f'{d}/index.html')
    en_paths = {r['path'] for r in ROUTES if 'en' in r}
    if os.path.isdir(os.path.join(ROOT, 'en')):
        for d in sorted(os.listdir(os.path.join(ROOT, 'en'))):
            f = os.path.join(ROOT, 'en', d, 'index.html')
            if d not in en_paths and os.path.isfile(f):
                os.remove(f)
                print('  삭제', f'en/{d}/index.html')
    if _missing:
        print(f'  ※ 영어 번역이 없는 문구 {len(_missing)}개 (자동 번역으로 보임 — scripts/i18n/make_en.py 에 추가):')
        for t in sorted(_missing)[:40]:
            print('     ·', t[:70])
    today = datetime.date.today().isoformat()
    urls = ''.join(f'  <url><loc>{esc(SITE + (r["path"] + "/" if r["path"] else ""))}</loc><lastmod>{today}</lastmod>'
                   f'<changefreq>{"daily" if not r["path"] else "weekly"}</changefreq><priority>{"1.0" if not r["path"] else "0.9" if r.get("hub") else "0.8"}</priority></url>\n'
                   for r in ALL)
    for r in ROUTES:   # 영어판 페이지
        if 'en' in r:
            urls += f'  <url><loc>{esc(url_of(r, "en"))}</loc><lastmod>{today}</lastmod><changefreq>weekly</changefreq><priority>0.7</priority></url>\n'
    # 탭이 아닌 독립 페이지(개인정보처리방침 등): 폴더에 index.html 이 있을 때만 sitemap 에 포함
    for extra in ('about', 'terms', 'disclaimer', 'privacy'):
        if os.path.isfile(os.path.join(ROOT, extra, 'index.html')):
            urls += f'  <url><loc>{esc(SITE + extra + "/")}</loc><lastmod>{today}</lastmod><changefreq>yearly</changefreq><priority>0.3</priority></url>\n'
    sitemap = f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n{urls}</urlset>\n'
    old = open(os.path.join(ROOT, 'sitemap.xml'), encoding='utf-8').read() if os.path.exists(os.path.join(ROOT, 'sitemap.xml')) else ''
    if re.sub(r'<lastmod>[^<]*</lastmod>', '', old) != re.sub(r'<lastmod>[^<]*</lastmod>', '', sitemap):
        write_if_changed('sitemap.xml', sitemap)          # 주소 목록이 바뀔 때만 (날짜만 바뀌는 커밋 방지)
    write_if_changed('robots.txt', f'User-agent: *\nAllow: /\nDisallow: /src/\nDisallow: /auth/\nDisallow: /saved/\n\nSitemap: {SITE}sitemap.xml\n')
    write_if_changed('404.html', f'''<!DOCTYPE html>
<html lang="ko"><head><meta charset="UTF-8"><meta name="robots" content="noindex">
<meta name="viewport" content="width=device-width, initial-scale=1.0"><title>페이지를 찾을 수 없습니다 | {esc(BRAND)}</title>
<script>location.replace({json.dumps(SITE)});</script></head>
<body style="font-family:sans-serif;background:#111;color:#ddd;text-align:center;padding:60px 16px;">
<p>페이지를 찾을 수 없습니다. <a href="{esc(SITE)}" style="color:#3182f6;">{esc(BRAND)} 홈으로 이동</a></p></body></html>
''')
    print(f'완료 — 주소 {len(ALL)}개 + 영어 {sum(1 for r in ROUTES if "en" in r)}개 · {SITE}')


if __name__ == '__main__':
    main()
