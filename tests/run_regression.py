#!/usr/bin/env python3
"""디코딩 자본주의 회귀 테스트 (Playwright · Chromium)

검사 항목
  1. 모든 주소(홈 + routes.json 68개 + 영어 페이지)를 16개 화면 폭에서 열어
     가로 넘침(문서 폭 > 화면 폭)과 화면 밖으로 잘리는 요소(가로 스크롤 상자 안은 제외)를 찾음
  2. 콘솔 오류·페이지 스크립트 오류 0 (로컬에서 막히는 외부 Worker 호출의 CORS·네트워크 오류는 제외)
  3. 메뉴 항목 수(홈 + 도구 수) · 검색 결과 · 허브 카드 수(같은 그룹 도구 수)
  4. 무한매수법 — 라오어 카페 원문 예시 숫자로 계산 엔진 검사, 기록 화면 그리기, 가이드북(23장 · 용어 31개 · 자동 숫자 · 장 열기 · 3-6 실제 일봉 백테스트 표)

사용법
  pip install playwright && python -m playwright install chromium
  python tests/run_regression.py              # 저장소 루트를 임시 서버로 띄워 검사
  python tests/run_regression.py --base https://d-capitalism.com/   # 배포된 사이트 검사
  python tests/run_regression.py --quick      # 화면 폭 4개만
실패가 하나라도 있으면 종료 코드 1
"""
import argparse, functools, http.server, json, os, socketserver, sys, threading, time

from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WIDTHS = [320, 360, 375, 390, 412, 414, 430, 480, 600, 768, 820, 1024, 1280, 1366, 1440, 1920]
QUICK = [320, 390, 768, 1440]

OVERFLOW_JS = """() => {
  const vw = document.documentElement.clientWidth, out = [];
  const clipped = el => { for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
    const o = getComputedStyle(p).overflowX; if (o === 'auto' || o === 'scroll' || o === 'hidden' || o === 'clip') return true; } return false; };
  for (const el of document.body.querySelectorAll('*')) {
    const r = el.getBoundingClientRect(); if (r.width === 0 || r.height === 0) continue;
    if (r.right <= vw + 1 && r.left >= -1) continue;
    const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) continue;
    if (el.closest('[hidden],[aria-hidden="true"]')) continue;
    if (clipped(el)) continue;
    out.push((el.id ? '#' + el.id : el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\\s+/).slice(0, 2).join('.') : ''))
             + ' [' + Math.round(r.left) + '~' + Math.round(r.right) + ']');
    if (out.length >= 5) break;
  }
  return { sw: document.documentElement.scrollWidth, vw, out };
}"""

MUHAN_JS = """async () => {
  const E = window.MHE, R = [];
  const eq = (name, got, exp) => { const ok = JSON.stringify(got) === JSON.stringify(exp); R.push({ name, ok, got: ok ? undefined : got, exp: ok ? undefined : exp }); };
  const r2 = x => Math.round(x * 100) / 100;
  const S = o => Object.assign({ ticker: 'TQQQ', splits: 40, totalCapital: 20000, lowerLocLines: 8, lowerLocShares: 1 }, o);
  const pq = l => l.map(o => [o.label.replace(/\\s/g, ''), o.method, o.price, o.quantity]);
  const L = ps => ps.map(p => ['', 'LOC', p, 1]);
  if (!E) return [{ name: 'MHE 없음', ok: false }];
  // 카페 79263 (일반모드)
  eq('별% 4종', [E.starPercent('TQQQ', 20, 4), E.starPercent('TQQQ', 40, 4), r2(E.starPercent('SOXL', 20, 8.6)), r2(E.starPercent('SOXL', 40, 8.6))], [9, 12, 2.8, 11.4]);
  eq('별지점 38.30→39.37', E.priceAt(38.30, E.starPercent('SOXL', 20, 8.6)), 39.37);
  eq('1회매수금 19522/39', E.compute(S({}), [{ date: '2026-03-16', type: 'full_buy', price: 47.8, quantity: 10 }]).buyAmount, 500.56);
  eq('처음매수 617.89', pq(E.orders({ phase: '처음매수', buyAmount: 617.89 }, S({}), undefined, 45.93)), [['★처음매수', 'LOC', 51.44, 12]].concat(L([47.53, 44.13, 41.19, 38.61, 36.34, 34.32, 32.52])));
  eq('전반전 539.23', pq(E.orders({ phase: '전반전', buyAmount: 539.23, buyPoint: 78.11, avgPrice: 69.75, isFirstHalf: true, totalQuantity: 0 }, S({}), undefined, 75)), [['★별지점', 'LOC', 78.11, 3], ['평단가', 'LOC', 69.75, 4]].concat(L([67.40, 59.91, 53.92, 49.02, 44.93, 41.47, 38.51])));
  eq('후반전 568.50', pq(E.orders({ phase: '후반전', buyAmount: 568.50, buyPoint: 59.54, avgPrice: 66, isFirstHalf: false, totalQuantity: 0 }, S({}), undefined, 58)), [['★별지점', 'LOC', 59.54, 9]].concat(L([56.85, 51.68, 47.37, 43.73, 40.60, 37.90, 35.53, 33.44])));
  eq('매도 141주', pq(E.orders({ phase: '후반전', buyAmount: 0, buyPoint: 0, totalQuantity: 141, sellPoint: 59.55, limitSellPrice: 75.76 }, S({}), undefined, 58)), [['★쿼터매도', 'LOC', 59.55, 35], ['15%지정가', '지정가', 75.76, 106]]);
  // 카페 79264 (리버스모드)
  eq('리버스 쿼터매수 544.47', pq(E.orders({ phase: '소진모드', remainingCapital: 544.47 * 4, totalQuantity: 220 }, S({}), { starPrice: 48.62, isFirstDay: false }, 47)), [['★리버스매도', 'LOC', 48.62, 11], ['★쿼터매수', 'LOC', 48.61, 11]].concat(L([45.37, 41.88, 38.89, 36.29, 34.02, 32.02, 30.24, 28.65])));
  const sq = (n, q) => E.orders({ phase: '소진모드', remainingCapital: 0, totalQuantity: q }, S({ splits: n }), { starPrice: 50, isFirstDay: true }, 47)[0].quantity;
  eq('리버스 첫날 MOC 수량', [sq(40, 200), sq(40, 190), sq(40, 181), sq(40, 172), sq(20, 200), sq(20, 198)], [10, 9, 9, 8, 20, 19]);
  eq('쿼터매수 1주 불가 → MOC', pq(E.orders({ phase: '소진모드', remainingCapital: 100, totalQuantity: 200 }, S({}), { starPrice: 50, isFirstDay: false }, 47)), [['MOC매도', 'MOC', 0, 10]]);
  const t1 = E.nextT(39.5, 'reverse_sell', 40), t2 = E.nextT(t1, 'reverse_quarter_buy', 40);
  eq('T값 규칙', [E.nextT(7, 'full_buy', 40), E.nextT(7, 'half_buy', 40), r2(E.nextT(7, 'quarter_sell', 40)), E.nextT(8, 'limit_sell_buy_full', 40), E.nextT(8, 'limit_sell_buy_half', 40), Math.round(t1 * 1e6) / 1e6, Math.round(t2 * 1e6) / 1e6], [8, 7.5, 5.25, 3, 2.5, 37.525, 38.14375]);
  eq('단계 경계 40분할', [19.99, 20, 39, 39.01].map(t => E.compute(S({}), [], { tValue: t, avgPrice: 50, totalQuantity: 10 }).phase), ['전반전', '후반전', '후반전', '소진모드']);
  // 카페 53077 (큰수 매수)
  const st53 = { phase: '전반전', buyAmount: 1000, buyPoint: 41.34, avgPrice: 39.71, isFirstHalf: true, totalQuantity: 0 };
  eq('큰수 33.33 → 30주', pq(E.orders(st53, S({ bigNumPercent: 11.1 }), undefined, 30)), [['★큰수', 'LOC', 33.33, 30]].concat(L([32.25, 31.25, 30.3, 29.41, 28.57, 27.77, 27.02])));
  eq('큰수 34.48 → 29주', pq(E.orders(st53, S({ bigNumPercent: 14.9333 }), undefined, 30)).slice(0, 3), [['★큰수', 'LOC', 34.48, 29]].concat(L([33.33, 32.25])));
  // 모의 계산 (가이드북 3-1) — 리버스 진입·복귀가 일어나는지
  const G = window.mhGuideFill;
  if (G) {
    const P = G.simPaths(), sim = (k, n) => E.simulate(S({ splits: n }), P[k]);
    const d20 = sim('down', 20), v20 = sim('v', 20), v40 = sim('v', 40);
    eq('모의: 꾸준한 하락 20분할 소진일·리버스', [d20.exhaustDay, d20.reverse, d20.revDays > 0], [20, true, true]);
    eq('모의: V자 20분할 소진→복귀→회차 종료', [v20.exhaustDay > 0, v20.backs > 0, v20.endDay > 0], [true, true, true]);
    eq('모의: V자 40분할 소진 없이 종료', [v40.exhaustDay, v40.endDay > 0, v40.pnlPct > 0], [0, true, true]);
  } else R.push({ name: 'mhGuideFill 없음', ok: false });
  // 고가 체결 (3-6 백테스트) — 지정가만 장중 체결되면 ¾ 매도·¼ 남김(T×0.25), 같은 날 LOC 매수도 되면 '지정가+매수'
  const base = [50, 50, 49, 48];                                  // 처음매수 → 매수 2번 (평단 약 49)
  // ① 큰수(전날 종가 +5%)보다 높고 별지점보다 낮게 마감 → 매수·쿼터매도 없이 지정가만: ¾ 매도·¼ 남김
  const SB = S({ splits: 20, targetProfit: 15, bigNumPercent: 5 });
  const f1 = E.compute(SB, E.simulate(SB, base).txs);
  const c1 = Math.round((f1.starPrice - 0.5) * 100) / 100, b1 = E.simulate(SB, base.concat([c1]), base.concat([60])), l1 = b1.txs[b1.txs.length - 1];
  eq('고가 체결: 지정가만 → ¾ 매도·¼ 남김', [c1 > base[3] * 1.05, l1.type, l1.quantity, l1.price, E.compute(SB, b1.txs).totalQuantity],
     [true, 'limit_sell', f1.totalQuantity - Math.max(1, Math.floor(f1.totalQuantity / 4)), f1.limitSellPrice, Math.max(1, Math.floor(f1.totalQuantity / 4))]);
  // ② 별지점 이상 마감 + 고가가 지정가에 닿음 → 쿼터매도 + 지정가 → 보유 0 · 회차 종료
  const b4 = E.simulate(SB, base.concat([Math.round((f1.starPrice + 0.5) * 100) / 100]), base.concat([60]));
  eq('고가 체결: 쿼터매도 + 지정가 → 회차 종료', [b4.endDay, E.compute(SB, b4.txs).totalQuantity], [4, 0]);
  // ③ 고가가 지정가에 닿은 뒤 급락해 LOC 매수도 체결 → '지정가+매수' (T×0.25+1/0.5)
  const b2 = E.simulate(S({ splits: 20, targetProfit: 15 }), base.concat([47]), base.concat([60])), l2 = b2.txs[b2.txs.length - 1];
  eq('고가 체결: 지정가 + 종가 매수', [l2.type.indexOf('limit_sell_buy') === 0, l2.sellPrice, l2.sellQuantity > 0, l2.quantity > 0], [true, f1.limitSellPrice, true, true]);
  const b3 = E.simulate(S({ splits: 20, targetProfit: 15 }), base.concat([52]));
  eq('고가 없으면 종가로 판단 (지정가 미체결)', b3.txs.some(t => t.type === 'limit_sell'), false);
  // 여러 회차 백테스트: 매일 평가금 = 엔진 compute 결과와 일치
  const px = [], hx = []; for (let i = 0; i < 400; i++) { const p = 50 * Math.exp(0.35 * Math.sin(i / 23) + i / 900) ; px.push(Math.round(p * 100) / 100); hx.push(Math.round(p * 1.02 * 100) / 100); }
  const bt = E.backtest(S({ splits: 20 }), px, 20000, hx), c0 = bt.cycles[0];
  const s0 = E.simulate(S({ splits: 20, totalCapital: 20000 }), px.map(x => x * 50 / px[0]), hx.map(x => x * 50 / px[0]));
  const v0 = E.compute(S({ splits: 20, totalCapital: 20000 }), s0.txs);
  eq('백테스트: 회차 여러 번 · 첫 회차 평가금 일치', [bt.cycles.length > 2, Math.abs(bt.eq[c0.days] - v0.remainingCapital) < 0.01, bt.eq.filter(v => v == null).length], [true, true, 0]);
  return R;
}"""

class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


def serve(root):
    handler = functools.partial(Quiet, directory=root)
    httpd = socketserver.ThreadingTCPServer(('127.0.0.1', 0), handler)
    httpd.daemon_threads = True
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd, 'http://127.0.0.1:%d/' % httpd.server_address[1]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--base', help='검사할 사이트 주소 (기본: 저장소 루트를 임시 서버로)')
    ap.add_argument('--quick', action='store_true', help='화면 폭 4개만')
    ap.add_argument('--only', help='이 문자열이 들어간 경로만')
    ap.add_argument('--selftest', action='store_true', help='일부러 넘침·콘솔 오류를 넣어 검사가 잡아내는지 확인')
    a = ap.parse_args()
    httpd = None
    base = a.base
    if not base:
        httpd, base = serve(ROOT)
    if not base.endswith('/'):
        base += '/'
    local = base.startswith('http://127.0.0.1') or base.startswith('http://localhost')

    cfg = json.load(open(os.path.join(ROOT, 'scripts', 'routes.json'), encoding='utf-8'))
    routes = cfg['routes']
    en = sorted(d for d in os.listdir(os.path.join(ROOT, 'en')) if os.path.isfile(os.path.join(ROOT, 'en', d, 'index.html')))
    paths = [''] + [r['path'] + '/' for r in routes] + ['en/' + d + '/' for d in en]
    if a.only:
        paths = [p for p in paths if a.only in p]
    widths = QUICK if a.quick else WIDTHS
    fails, t0 = [], time.time()

    def fail(where, what):
        fails.append('%s — %s' % (where or '/', what))
        print('  ✗ %s — %s' % (where or '/', what), flush=True)

    def ignorable(msg_text, url):
        if not local:
            return False
        t = msg_text or ''
        return ('workers.dev' in t or 'CORS' in t or 'ERR_FAILED' in t or 'ERR_NAME_NOT_RESOLVED' in t
                or (url and not url.startswith(base)) or t.startswith('Failed to load resource'))

    with sync_playwright() as p:
        br = p.chromium.launch()
        ctx = br.new_context(viewport={'width': 1440, 'height': 900}, locale='ko-KR')
        page = ctx.new_page()
        errs = []
        page.on('console', lambda m: errs.append((m.text, (m.location or {}).get('url', ''))) if m.type == 'error' else None)
        page.on('pageerror', lambda e: errs.append(('pageerror: ' + str(e), base)))

        if a.selftest:
            page.goto(base + 'muhan/', wait_until='load'); page.wait_for_timeout(800); errs.clear()
            page.evaluate("""() => { const d = document.createElement('div'); d.style.cssText = 'width:2000px;height:10px';
                document.querySelector('.app-page:not([style*="none"]) .card, .wrap').appendChild(d); setTimeout(() => { throw new Error('selftest'); }); }""")
            page.wait_for_timeout(300)
            r = page.evaluate(OVERFLOW_JS)
            caught = r['sw'] > r['vw'] + 1 and any('selftest' in t for t, u in errs)
            print('자체 확인: 넘침 감지 %s (문서 %dpx > 화면 %dpx) · 스크립트 오류 감지 %s' % (
                r['sw'] > r['vw'] + 1, r['sw'], r['vw'], any('selftest' in t for t, u in errs)))
            br.close()
            sys.exit(0 if caught else 1)

        # 1·2. 전 경로 × 화면 폭
        print('[1] 전 경로 %d개 × 화면 폭 %d개' % (len(paths), len(widths)), flush=True)
        for path in paths:
            errs.clear()
            page.set_viewport_size({'width': 1440, 'height': 900})
            page.goto(base + path, wait_until='load', timeout=60000)
            page.wait_for_timeout(1200)
            for w in widths:
                page.set_viewport_size({'width': w, 'height': 900})
                page.wait_for_timeout(120)
                r = page.evaluate(OVERFLOW_JS)
                if r['sw'] > r['vw'] + 1:
                    fail(path, '%dpx 가로 넘침 (문서 %dpx)%s' % (w, r['sw'], (' · ' + ', '.join(r['out'])) if r['out'] else ''))
                elif r['out']:
                    fail(path, '%dpx 화면 밖 요소: %s' % (w, ', '.join(r['out'])))
            bad = [t for t, u in errs if not ignorable(t, u)]
            for t in bad[:3]:
                fail(path, '콘솔 오류: ' + t[:200])

        # 3. 메뉴 · 검색 · 허브 카드
        print('[2] 메뉴 · 검색 · 허브 카드', flush=True)
        page.set_viewport_size({'width': 1440, 'height': 900})
        page.goto(base, wait_until='load'); page.wait_for_timeout(800)
        n = page.evaluate("document.querySelectorAll('[id^=\"drop-\"]').length")
        if n != len(routes) + 1:
            fail('', '메뉴 항목 %d개 (기대 %d = 홈 + 도구 %d)' % (n, len(routes) + 1, len(routes)))
        missing = page.evaluate("tabs => tabs.filter(t => !document.getElementById('drop-' + t))", [r['tab'] for r in routes])
        if missing:
            fail('', '메뉴에 없는 도구: ' + ', '.join(missing))
        for q, want in [('연봉', '연봉'), ('무한', '무한매수법'), ('취득세', '취득세'), ('배당', '배당')]:
            res = page.evaluate("""async q => { const i = document.getElementById('ss-input'); i.focus(); i.value = q;
                i.dispatchEvent(new Event('input', { bubbles: true })); await new Promise(r => setTimeout(r, 300));
                const l = document.getElementById('ss-list'); return { hidden: l.hidden, items: [...l.children].map(c => c.textContent) }; }""", q)
            if res['hidden'] or not any(want in t for t in res['items']):
                fail('', '검색 "%s" 결과에 "%s" 없음 (%s)' % (q, want, res['items'][:5]))
        for hub in [r for r in routes if r.get('hub')]:
            want = len([r for r in routes if r['group'] == hub['group'] and not r.get('hub')])
            page.goto(base + hub['path'] + '/', wait_until='load'); page.wait_for_timeout(500)
            got = page.evaluate("[...document.querySelectorAll('.app-page')].filter(p => getComputedStyle(p).display !== 'none').reduce((a, p) => a + p.querySelectorAll('.hub-card').length, 0)")
            if got != want:
                fail(hub['path'], '허브 카드 %d개 (같은 그룹 도구 %d개)' % (got, want))

        # 4. 무한매수법 엔진 · 화면 · 가이드북
        print('[3] 무한매수법 엔진 · 기록 화면 · 가이드북', flush=True)
        errs.clear()
        page.goto(base + 'muhan/', wait_until='load'); page.wait_for_timeout(2500)
        for t in page.evaluate(MUHAN_JS):
            if not t['ok']:
                fail('muhan', '엔진 %s: got=%s exp=%s' % (t['name'], json.dumps(t.get('got'), ensure_ascii=False), json.dumps(t.get('exp'), ensure_ascii=False)))
        g = page.evaluate("""async () => {
          const g = document.getElementById('mhg'); if (!g) return { none: true };
          const root = document.getElementById('mh-root');
          const asof = [...g.querySelectorAll('[data-mk="asof"]')].map(e => e.textContent);
          const sim = [...g.querySelectorAll('[data-sim]')].filter(e => !e.textContent.trim()).length;
          window.mhGuide('mhg-3-1'); await new Promise(r => setTimeout(r, 400));
          const prog = document.getElementById('mhg-prog-txt').textContent;
          const bt = () => { const b = document.getElementById('mhbt-body'); return b ? { rows: b.querySelectorAll('.mhbt-tbl tbody tr').length, cards: b.querySelectorAll('.mhbt-card').length, txt: b.textContent } : null; };
          for (let i = 0; i < 40 && !(bt() && /계산 \\d{4}-/.test(bt().txt) && document.getElementById('mhbt')._bt); i++) await new Promise(r => setTimeout(r, 250));
          const bt0 = bt(); document.querySelector('#mhbt [data-bt-tk="SOXL"]').click(); await new Promise(r => setTimeout(r, 300));
          const bt1 = bt(); document.querySelector('#mhbt [data-bt-bg="5"]').click(); await new Promise(r => setTimeout(r, 300));
          const bt2 = bt(), btOn = [...document.querySelectorAll('#mhbt .mhbt-seg button.on')].map(b => b.textContent);
          return { chapters: g.querySelectorAll('details.mhg-ch').length, terms: g.querySelectorAll('dl.mhg-dl dt').length,
                   bt0, bt1, bt2, btOn, asof, sim, opened: document.getElementById('mhg-3-1').open, hash: location.hash, prog,
                   ui: root ? root.children.length : 0, store: !!(window.MHdebug && window.MHdebug.store) };
        }""")
        if g.get('none'):
            fail('muhan', '가이드북(#mhg) 없음')
        else:
            if g['chapters'] != 23: fail('muhan', '가이드북 장 %d개 (기대 23)' % g['chapters'])
            if g['terms'] != 31: fail('muhan', '용어 %d개 (기대 31)' % g['terms'])
            if not g['asof'] or not all(s.strip() for s in g['asof']): fail('muhan', 'PART 1·3 자동 숫자 미적용 (기준일 표시 없음): %s' % g['asof'])
            if g['sim']: fail('muhan', '3-1 모의 계산 빈 칸 %d개' % g['sim'])
            b0, b1, b2 = g.get('bt0') or {}, g.get('bt1') or {}, g.get('bt2') or {}
            if b0.get('rows') != 10 or b0.get('cards') != 4: fail('muhan', '3-6 백테스트 표 이상 (행 %s · 카드 %s, 기대 10 · 4)' % (b0.get('rows'), b0.get('cards')))
            if 'SOXL' not in (b1.get('txt') or '') or b1.get('txt') == b0.get('txt'): fail('muhan', '3-6 종목 전환(SOXL) 안 됨')
            if b2.get('txt') == b1.get('txt') or b2.get('rows') != 10: fail('muhan', '3-6 큰수 전환(5%) 안 됨')
            if g.get('btOn') != ['SOXL', '5%']: fail('muhan', '3-6 선택 버튼 표시 이상: %s' % g.get('btOn'))
            if not g['opened'] or g['hash'] != '#mhg-3-1': fail('muhan', 'mhGuide 장 열기 실패 (%s, %s)' % (g['opened'], g['hash']))
            if not g['prog'].endswith('1개 읽음'): fail('muhan', '읽음 진행률 표시 이상 (새 브라우저에서 1개 장을 열었는데): ' + g['prog'])
            if not g['ui']: fail('muhan', '기록 화면(#mh-root)이 그려지지 않음')
            if not g['store']: fail('muhan', '기록 저장소(MHdebug.store) 없음')
        bad = [t for t, u in errs if not ignorable(t, u)]
        for t in bad[:3]:
            fail('muhan', '콘솔 오류: ' + t[:200])
        # 영어판 무한매수법 — 가이드북·3-6·자동 숫자가 영어로, 일부러 남긴 원어(translate=no) 밖에는 한글 없음
        if os.path.isdir(os.path.join(ROOT, 'en', 'muhan')):
            errs.clear()
            page.goto(base + 'en/muhan/', wait_until='load'); page.wait_for_timeout(2500)
            e = page.evaluate("""async () => {
              const g = document.getElementById('mhg'); if (!g) return { none: true };
              for (let i = 0; i < 40 && !/computed \\d{4}-/.test((document.getElementById('mhbt-body') || {}).textContent || ''); i++) await new Promise(r => setTimeout(r, 250));
              const c = g.cloneNode(true); c.querySelectorAll('[translate="no"]').forEach(x => x.remove());
              const ko = (c.textContent.match(/[가-힣]+/g) || []).slice(0, 5);
              const asof = [...g.querySelectorAll('[data-mk="asof"]')].map(x => x.textContent);
              return { lang: document.documentElement.lang, chapters: g.querySelectorAll('details.mhg-ch').length, terms: g.querySelectorAll('dl.mhg-dl dt').length,
                       ko, asof, rows: document.querySelectorAll('#mhbt-body .mhbt-tbl tbody tr').length, bt: (document.getElementById('mhbt-body') || {}).textContent || '',
                       prog: document.getElementById('mhg-prog-txt').textContent, sim: (g.querySelector('[data-sim="down:20"]') || {}).textContent || '' };
            }""")
            if e.get('none'): fail('en/muhan', '영어 가이드북(#mhg) 없음')
            else:
                if e['lang'] != 'en': fail('en/muhan', 'html lang=%s' % e['lang'])
                if e['chapters'] != 23 or e['terms'] != 31: fail('en/muhan', '영어 가이드북 장 %d · 용어 %d (기대 23 · 31)' % (e['chapters'], e['terms']))
                if e['ko']: fail('en/muhan', '영어 가이드북에 한글 남음: %s' % e['ko'])
                if not all('as of' in x for x in e['asof']): fail('en/muhan', '자동 숫자 기준일이 영어가 아님: %s' % e['asof'])
                if e['rows'] != 10 or 'Buy and hold' not in e['bt'] or 'Buy &' not in e['bt'] or 'computed' not in e['bt']: fail('en/muhan', '3-6 영어 표 이상 (행 %s)' % e['rows'])
                if 'chapters read' not in e['prog'] or 'Ran out' not in e['sim']: fail('en/muhan', '진행률·3-1 문구가 영어가 아님: %s / %s' % (e['prog'], e['sim']))
            for t in [t for t, u in errs if not ignorable(t, u)][:3]:
                fail('en/muhan', '콘솔 오류: ' + t[:200])
        br.close()
    if httpd:
        httpd.shutdown()
    print('\n검사 %d개 경로 × %d개 폭 · %.0f초 · 실패 %d건' % (len(paths), len(widths), time.time() - t0, len(fails)))
    sys.exit(1 if fails else 0)


if __name__ == '__main__':
    main()
