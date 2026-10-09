/* [I18N] 영어 페이지(/en/<도구>/)인지 — 아래 L('한국어','English') · fmt · fmtWon 등이 사용 (먼저 정해야 초기 화면에도 반영) */
var SITE_EN = (document.documentElement.getAttribute('lang') || '').indexOf('en') === 0;
/* ════════════════════════════════════════════════════════════
   목차 — 수정할 때는 아래 [태그]로 검색해서 해당 블록만 보면 됩니다
   [SIM-UNIT]  분배 시뮬레이터 공용 단위·입력·슬라이더 (4개 시뮬레이터 공통)
   [KODEX]     KODEX 200 타겟위클리 = 전역 update()/renderMonthlyTable()
   [SOL] [TIGER] [TIGERDIV] [TIGERSEMI]  각 시뮬레이터 IIFE (getVWon/setDispFromWon은 [SIM-UNIT] 위임)
   [HOME]      메인 화면 (자본주의를 숫자로 · data/home.json)
   [VISITS]    맨 위 방문자 수 (worker/ Cloudflare Worker · data/counter.json)
   [NAV]       탭 그룹 드롭다운·switchSubTab (탭 진입 시 자동 조회 훅 포함)
   [COMPOUND] [LOAN] [CAGR] [FX] [HEALTH] [RATE]  금융 계산기
   [FC-ENGINE] [FC-UI]  2026 연봉 실수령액·퇴직금(DB/DC)·주담대 LTV·DSR·중개수수료 계산기
   [KOSPI] [KOSPI200] [KOSDAQ] [US-INDEX](미국 6종 + 일본·중국·홍콩·대만 11종) [PERIOD] [KOSPI-FETCH]  지수 성장률
   [FEAR] 공포&탐욕   [MONEYSPEED] 가치 속도   [MUHAN] 무한매수법 화면   [MUHAN-ENGINE] 무한매수법 계산
   [YEAR-ACC]  연/월 상세 테이블 아코디언 헬퍼
   [THEME]     사이트 테마 (다크/라이트/오토) · fgA()
   [MARKET-DATA] 시세 데이터 계층 (모든 Yahoo·공포탐욕 요청 → data/*.json)
════════════════════════════════════════════════════════════ */
/* ════════════════════════════════════════════════════════════
   [MARKET-DATA] 시세 데이터 계층 — 모든 시세 요청이 이곳을 거칩니다
   · GitHub Actions(.github/workflows/update-market-data.yml)가 서버에서
     Yahoo Finance·공포탐욕 지수를 15분마다 수집해 data/*.json 으로 저장
   · 페이지의 Yahoo / feargreedchart 요청은 아래 fetch 래퍼가 가로채
     같은 도메인의 JSON으로 즉시 응답 → CORS·프록시 없음, 대기 없음
   · JSON에 없는 종목(무한매수법 직접입력 등)만 프록시 3곳을 '동시에' 시도 (최대 6초)
════════════════════════════════════════════════════════════ */
(function () {
  var nativeFetch = window.fetch.bind(window);
  var TTL = 5 * 60 * 1000;                       /* JSON 재조회 간격 */
  var files = {};                                 /* 파일명 → {t, p} */
  var live = {};                                  /* 실시간 프록시 결과 캐시 (60초) */
  var CHART = '/v8/finance/chart/';

  function timeout(p, ms) {
    return Promise.race([p, new Promise(function (_, rej) { setTimeout(function () { rej(new Error('timeout')); }, ms); })]);
  }
  /* 파일별 갱신 주기(신선도)와 다운로드 제한 시간 — 큰 파일을 불필요하게 두 번 받지 않도록 */
  var FRESH_MS = { 'apt_rank.json': 4 * 3600e3, 'salary_rank.json': 7 * 86400e3, 'asset_rank.json': 7 * 86400e3, 'mcap.json': 26 * 3600e3, 'etfcagr.json': 7 * 3600e3, 'history.json': 22 * 3600e3, 'dxy.json': 7 * 3600e3, 'home.json': 7 * 3600e3, 'whatif.json': 20 * 3600e3, 'apt_area.json': 26 * 3600e3, 'realty.json': 7 * 86400e3 };   /* 기본 40분 */
  var BIG = { 'apt_rank.json': 1, 'dxy.json': 1, 'etfcagr.json': 1, 'history.json': 1, 'compare.json': 1, 'muhan.json': 1, 'whatif.json': 1 };
  function getJSON(url, ms) {
    return timeout(nativeFetch(url, { cache: 'no-cache' }), ms || 6000)
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); });
  }
  /* 같은 도메인 data/ → 오래됐거나 없으면 raw.githubusercontent(커밋 즉시 반영) 중 최신 사용 */
  function rawURL(file) {   /* 자체 도메인(d-capitalism.com 등)에서도 같은 저장소의 최신 커밋을 볼 수 있도록 저장소를 고정 */
    if (!/^https?:$/.test(location.protocol)) return null;
    return 'https://raw.githubusercontent.com/ETFMD/d-capitalism/main/data/' + file;
  }
  function loadFile(file) {
    var c = files[file];
    if (c && Date.now() - c.t < TTL) return c.p;
    var v = '?v=' + Math.floor(Date.now() / TTL);
    var ms = BIG[file] ? 25000 : 6000;
    var p = getJSON('data/' + file + v, ms).catch(function () { return null; }).then(function (a) {
      var fresh = a && a.updated && (Date.now() - Date.parse(a.updated)) < (FRESH_MS[file] || 40 * 60 * 1000);
      var raw = rawURL(file);
      if (fresh || !raw) return a;
      return getJSON(raw + v, ms).catch(function () { return null; }).then(function (b) {
        if (!b) return a;
        if (!a) return b;
        return Date.parse(b.updated) > Date.parse(a.updated) ? b : a;
      });
    }).then(function (d) { if (!d) delete files[file]; return d; });
    files[file] = { t: Date.now(), p: p };
    return p;
  }
  window.mdLoad = loadFile;                       /* 다른 코드에서 직접 쓰고 싶을 때 */

  /* 프록시로 감싼 URL까지 풀어서 Yahoo 차트 요청인지 판별 */
  function parseYahoo(url) {
    var u = String(url);
    for (var i = 0; i < 3 && u.indexOf(CHART) < 0; i++) { try { u = decodeURIComponent(u); } catch (e) { break; } }
    var k = u.indexOf(CHART);
    if (k < 0 || u.indexOf('finance.yahoo.com') < 0) return null;
    var rest = u.slice(k + CHART.length), q = rest.indexOf('?');
    var sym = q < 0 ? rest : rest.slice(0, q), qs = q < 0 ? '' : rest.slice(q + 1), prm = {};
    try { sym = decodeURIComponent(sym); } catch (e) {}
    qs.split('&').forEach(function (kv) { var p = kv.split('='); if (p[0]) prm[p[0]] = p[1]; });
    return { sym: sym.toUpperCase(), prm: prm, url: 'https://query1.finance.yahoo.com' + CHART + encodeURIComponent(sym) + (qs ? '?' + qs : '') };
  }
  function jsonResponse(obj) {
    return new Response(JSON.stringify(obj), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  function chartResponse(sym, q, pts) {
    return jsonResponse({ chart: { error: null, result: [{
      meta: { symbol: sym, currency: q.currency, regularMarketPrice: q.price, previousClose: q.prev,
              chartPreviousClose: q.prev, regularMarketTime: q.time, dataSource: q.src },
      timestamp: pts.map(function (p) { return p[0]; }),
      indicators: { quote: [{ close: pts.map(function (p) { return p[1]; }) }] } }] } });
  }

  /* data/*.json 으로 응답 가능한 Yahoo 요청이면 Response, 아니면 null */
  function fromLocal(y) {
    return loadFile('market.json').then(function (m) {
      var q = m && m.quotes && m.quotes[y.sym];
      if (y.prm.period1 && y.prm.period2) {                    /* 과거 특정 시점 */
        var p1 = +y.prm.period1, p2 = +y.prm.period2, mid = (p1 + p2) / 2;
        return loadFile('history.json').then(function (h) {
          var s = h && h.series && h.series[y.sym];
          var pts = (s || []).map(function (p) { return [p[0] * 86400, p[1]]; }).concat(q ? q.daily : []);
          if (!pts.length || mid < pts[0][0] - 14 * 86400) return null;
          var hit = pts.filter(function (p) { return p[0] >= p1 && p[0] <= p2; });
          if (!hit.length) {                                     /* 창 밖이면 가장 가까운 한 점 */
            var best = pts.reduce(function (a, b) { return Math.abs(b[0] - mid) < Math.abs(a[0] - mid) ? b : a; });
            hit = [best];
          }
          /* 과거 값 응답의 출처는 history.json 의 src (예: 'Yahoo·Sina') — 시세 출처(q.src)와 구분 */
          var hq = Object.assign({}, q || { price: hit[hit.length - 1][1] }, { src: (h && h.src && h.src[y.sym]) || undefined });
          return chartResponse(y.sym, hq, hit);
        });
      }
      if (!q) return null;
      /* 최근 30일 캐시로는 3d·5d·1mo 같은 짧은 기간만 응답 — 1y·max·ytd 등은 프록시로 실제 자료 조회 */
      var rg = /^(\d+)(d|mo)$/.exec(y.prm.range || '5d');
      if (!rg) return null;
      var n = rg[2] === 'mo' ? +rg[1] * 22 : +rg[1];
      /* 1개월 이하 요청은 서버가 받아 둔 최근 30일이 전부이므로 일봉이 짧아도(야후가 1개만 준 통화쌍 등) 그대로 응답 */
      if (n > 22 && n > q.daily.length + 2) return null;
      return chartResponse(y.sym, q, q.daily.slice(-n));
    }).catch(function () { return null; });
  }

  /* JSON에 없을 때만: 프록시 3곳 동시 요청, 먼저 성공한 응답 사용 */
  function fromProxies(y) {
    var c = live[y.url];
    if (c && Date.now() - c.t < 60000) return c.p.then(function (txt) { return new Response(txt, { status: 200 }); });
    var urls = ['https://corsproxy.io/?url=' + encodeURIComponent(y.url),
                'https://api.allorigins.win/raw?url=' + encodeURIComponent(y.url),
                'https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(y.url)];
    var p = new Promise(function (resolve, reject) {
      var left = urls.length;
      urls.forEach(function (u) {
        timeout(nativeFetch(u, { cache: 'no-cache' }), 6000)
          .then(function (r) { if (!r.ok) throw 0; return r.text(); })
          .then(function (txt) { if (txt.indexOf('"chart"') < 0) throw 0; resolve(txt); })
          .catch(function () { if (--left === 0) reject(new Error('모든 프록시 실패')); });
      });
    });
    live[y.url] = { t: Date.now(), p: p };
    p.catch(function () { delete live[y.url]; });
    return p.then(function (txt) { return new Response(txt, { status: 200 }); });
  }

  window.fetch = function (input, init) {
    var url = typeof input === 'string' ? input : (input && input.url) || '';
    if (url.indexOf('api.anthropic.com') >= 0) return Promise.reject(new Error('미사용 경로'));
    if (url.indexOf('feargreedchart.com/api') >= 0) {
      return loadFile('market.json').then(function (m) {
        return m && m.fear ? jsonResponse(m.fear) : timeout(nativeFetch(input, init), 6000);
      });
    }
    var y = parseYahoo(url);
    if (!y) return nativeFetch(input, init);
    return fromLocal(y).then(function (r) { return r || fromProxies(y); });
  };
})();

/* ════════════════════════════════════════════════════════════
   [THEME] 사이트 테마 — 다크 / 라이트 / 오토(기기 설정)
   · 저장: localStorage 'site-theme' · 적용: <html data-theme="dark|light">
   · 색은 CSS 변수(--bg, --text, --fg-rgb …)만 바뀌고, 캔버스 차트는 fgA()로 다시 칠함
════════════════════════════════════════════════════════════ */
function fgA(a) {
  var v = getComputedStyle(document.documentElement).getPropertyValue('--fg-rgb').trim() || '255,255,255';
  return 'rgba(' + v + ',' + a + ')';
}
function siteThemeMode() { var m = localStorage.getItem('site-theme'); return m === 'light' || m === 'auto' ? m : 'dark'; }
function applySiteTheme() {
  var m = siteThemeMode(), light = m === 'light' || (m === 'auto' && window.matchMedia && matchMedia('(prefers-color-scheme: light)').matches);
  document.documentElement.setAttribute('data-theme', light ? 'light' : 'dark');
  var lbl = document.getElementById('theme-btn-label');
  if (lbl) lbl.textContent = m === 'light' ? L('라이트', 'Light') : m === 'auto' ? L('오토', 'Auto') : L('다크', 'Dark');
  document.querySelectorAll('.theme-opt').forEach(function (b) { var on = b.getAttribute('data-theme-opt') === m; b.classList.toggle('active', on); b.setAttribute('aria-selected', on ? 'true' : 'false'); });
  /* 이미 그려진 차트의 격자선·게이지를 새 테마 색으로 */
  if (window.Chart && Chart.instances) Object.keys(Chart.instances).forEach(function (k) {
    var ch = Chart.instances[k], sc = (ch.options && ch.options.scales) || {};
    Object.keys(sc).forEach(function (a) { var g = sc[a].grid; if (g && typeof g.color === 'string') { var mm = g.color.match(/^rgba\([^)]*,\s*([\d.]+)\)$/); if (mm) g.color = fgA(mm[1]); } });
    try { ch.update('none'); } catch (e) {}
  });
  if (typeof _fearData !== 'undefined' && _fearData && typeof drawFearGauge === 'function') { try { drawFearGauge(Math.round(_fearData.score)); } catch (e) {} }
  var mp = document.getElementById('page-muhan');
  if (mp && mp.classList.contains('active') && window.MHdebug) window.MHdebug.render();
  if (window.kcmpRender) window.kcmpRender();   /* 비교 차트 색(빨강·파랑·글자)을 새 테마로 */
  if (window.ecRender) window.ecRender();       /* ETF CAGR 비교 차트 글자·격자 색 */
  if (window.dxyRender) window.dxyRender();     /* 환율 계산기 달러인덱스 차트 */
  if (window.homeRender) window.homeRender();   /* 홈 화면 차트 */
  if (window.fcRender) window.fcRender();       /* DC형 비교 차트 */
}
function setSiteTheme(m) {
  localStorage.setItem('site-theme', m);
  applySiteTheme();
}
/* 테마 선택 펼침 목록 (언어 선택과 같은 동작): 버튼으로 열고 닫기 · 바깥 클릭/Esc 로 닫기 · ↑↓ 이동 · Enter 선택 */
(function () {
  var btn = document.getElementById('theme-btn'), menu = document.getElementById('theme-menu');
  if (!btn || !menu) return;
  var opts = function () { return Array.prototype.slice.call(menu.querySelectorAll('.theme-opt')); };
  var open = function (focus) {
    menu.classList.add('open'); btn.setAttribute('aria-expanded', 'true');
    if (focus) { var a = menu.querySelector('.theme-opt.active') || opts()[0]; if (a) a.focus(); }
  };
  var close = function (back) { menu.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); if (back) btn.focus(); };
  btn.addEventListener('click', function (e) { e.stopPropagation(); menu.classList.contains('open') ? close() : open(e.detail === 0); });
  btn.addEventListener('keydown', function (e) { if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); open(true); } });
  menu.addEventListener('click', function (e) {
    var o = e.target.closest && e.target.closest('.theme-opt'); if (!o) return;
    e.stopPropagation(); close(); setSiteTheme(o.getAttribute('data-theme-opt'));
  });
  menu.addEventListener('keydown', function (e) {
    var list = opts(), i = list.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); list[(i + 1) % list.length].focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); list[(i - 1 + list.length) % list.length].focus(); }
    else if (e.key === 'Escape') { e.preventDefault(); close(true); }
    else if (e.key === 'Tab') close();
  });
  document.addEventListener('click', function (e) { if (!e.target.closest || !e.target.closest('#theme-sw')) close(); }, true);   /* capture: 다른 버튼이 클릭 전파를 막아도 닫힘 */
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && menu.classList.contains('open')) close(true); });
})();
if (window.matchMedia) { var _mqTheme = matchMedia('(prefers-color-scheme: light)'); var _onMq = function () { if (siteThemeMode() === 'auto') applySiteTheme(); };
  if (_mqTheme.addEventListener) _mqTheme.addEventListener('change', _onMq); else if (_mqTheme.addListener) _mqTheme.addListener(_onMq); }
document.addEventListener('DOMContentLoaded', applySiteTheme);

/* ════════════════════════════════════════════════════════════
   [COMMA-DEL] 천 단위 쉼표 옆에서 지우기 (모든 탭 공통)
   · 문제: 쉼표 바로 뒤에서 Backspace(앞에서 Delete)를 누르면 쉼표만 지워지고
           입력 핸들러가 곧바로 쉼표를 다시 넣어 아무것도 지워지지 않는 것처럼 보임
   · 해결: 지울 글자가 쉼표면 그 너머의 숫자까지 함께 지우고 input 이벤트를 다시 발생
           (beforeinput 사용 → PC 키보드·모바일 가상 키보드 모두 동작)
════════════════════════════════════════════════════════════ */
(function () {
  function isTextInput(el) {
    return el && el.tagName === 'INPUT' && (el.type === 'text' || el.type === 'tel' || el.type === 'search' || !el.type);
  }
  document.addEventListener('beforeinput', function (e) {
    var el = e.target, t = e.inputType;
    if (!isTextInput(el) || (t !== 'deleteContentBackward' && t !== 'deleteContentForward')) return;
    var v = el.value, s = el.selectionStart, en = el.selectionEnd;
    if (s == null || s !== en || v.indexOf(',') < 0) return;          /* 선택 영역이 있으면 기본 동작 */
    var from, to;
    if (t === 'deleteContentBackward') {
      if (s < 2 || v.charAt(s - 1) !== ',' || !/\d/.test(v.charAt(s - 2))) return;
      from = s - 2; to = s;                                           /* "1,|234" → "|234" */
    } else {
      if (v.charAt(s) !== ',' || !/\d/.test(v.charAt(s + 1))) return;
      from = s; to = s + 2;                                           /* "1|,234" → "1|34" */
    }
    e.preventDefault();
    el.value = v.slice(0, from) + v.slice(to);
    try { el.setSelectionRange(from, from); } catch (err) {}
    el.dispatchEvent(new Event('input', { bubbles: true }));         /* 각 칸의 서식·계산 핸들러 실행 */
  }, true);
})();

/* [KODEX] KODEX 200 타겟위클리커버드콜 — 전역 상태/계산 시작 */

/* ── 상태 ── */
let investMode = 'reinvest';  // 분배수령 / 재투자
let chartTab   = 'annual';    // 연간 / 월간
let dcaOn      = false;       // 적립식 ON/OFF
let taxOn           = true;     // 분배세 ON/OFF
let _manualTaxValue = '15.4';   // 직접입력 세율 저장값
let kodexOn         = true;     // KODEX 과세구조 ON/OFF
let detailTab       = 'monthly'; // 'annual' | 'monthly'
let taxMode         = 'manual'; // 'manual' | 'bracket'
let bracketType     = 'separate'; // 'separate' | 'comprehensive'
let chart      = null;

/* ── 계산된 데이터 캐시 ── */
let _cache = null;

/* ─────────────────────────────────────────
   슬라이더 ↔ 숫자 입력 동기화
───────────────────────────────────────── */
function syncToNum(key, scale, dec) {
  const ni = document.getElementById('ni-' + key);
  ni.value = (parseFloat(document.getElementById('sl-' + key).value) / scale).toFixed(dec);
  ni.classList.remove('error');
  update();
}

function syncToSlider(key) {
  const ni = document.getElementById('ni-' + key);
  const sl = document.getElementById('sl-' + key);
  const v  = parseFloat(ni.value);
  if (isNaN(v)) { ni.classList.add('error'); return; }
  ni.classList.remove('error');
  const scale = { amount:10000, years:1, rate:1, growth:1, target:10000, monthly:10000, tax:1 }[key];
  sl.value = Math.min(Math.max(v * scale, parseFloat(sl.min)), parseFloat(sl.max));
  update();
}

const LIMITS = {
  amount: { min:100,  max:50000   },
  years:  { min:1,    max:30      },
  rate:   { min:0.1,  max:50      },
  growth: { min:-20,  max:30      },
  target: { min:10,   max:100000  },
  monthly:{ min:0,    max:5000    },
  tax:    { min:0,    max:49.5    },
};
function validateNum(key) {
  const ni = document.getElementById('ni-' + key);
  const v  = parseFloat(ni.value);
  const lm = LIMITS[key];
  ni.classList.toggle('error', isNaN(v) || v < lm.min || v > lm.max);
}

/* ── 모드 전환 ── */
function setMode(m, btn) {
  investMode = m;
  const _pg = document.getElementById('page-simulator');
  if (_pg) _pg.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const pb = document.getElementById('partial-ratio-block');
  if (pb) pb.style.display = (m === 'partial') ? 'block' : 'none';
  update();
}

function syncPartial() {
  document.getElementById('sl-partial').value = document.getElementById('ni-partial').value;
  const v = document.getElementById('ni-partial').value;
  const el = document.getElementById('partial-desc');
  if (el) el.textContent = '분배금의 ' + v + '%는 재투자, ' + (100-v) + '%는 수령';
  update();
}

function toggleDCA() {
  dcaOn = !dcaOn;
  const sw    = document.getElementById('dca-switch');
  const block = document.getElementById('dca-block');
  sw.classList.toggle('on', dcaOn);
  block.style.opacity        = dcaOn ? '1' : '0.3';
  block.style.pointerEvents  = dcaOn ? 'auto' : 'none';
  document.getElementById('dca-off-label').style.color = dcaOn ? 'var(--text3)' : 'var(--text2)';
  document.getElementById('dca-on-label').style.color  = dcaOn ? 'var(--accent)' : 'var(--text3)';
  update();
}

function toggleTax() {
  taxOn = !taxOn;
  const sw    = document.getElementById('tax-switch');
  const block = document.getElementById('tax-block');
  sw.classList.toggle('on', taxOn);
  block.style.opacity       = taxOn ? '1' : '0.3';
  block.style.pointerEvents = taxOn ? 'auto' : 'none';
  document.getElementById('tax-off-label').style.color = taxOn ? 'var(--text3)' : 'var(--text2)';
  document.getElementById('tax-on-label').style.color  = taxOn ? 'var(--accent)' : 'var(--text3)';
  if (taxOn) updateBracketUI();
  update();
}

function toggleKodex() {
  kodexOn = !kodexOn;
  const sw    = document.getElementById('kodex-switch');
  const block = document.getElementById('kodex-block');
  sw.classList.toggle('on', kodexOn);
  block.style.opacity       = kodexOn ? '1' : '0.3';
  block.style.pointerEvents = kodexOn ? 'auto' : 'none';
  document.getElementById('kodex-off-label').style.color = kodexOn ? 'var(--text3)' : 'var(--text2)';
  document.getElementById('kodex-on-label').style.color  = kodexOn ? 'var(--accent)'  : 'var(--text3)';
  updateKodexUI();
  updateDivLabel();
  update();
}

function onKodexRatioChange() {
  updateKodexUI();
  update();
}

function updateKodexUI() {
  const callPct = parseFloat(document.getElementById('ni-calloption').value) || 0;
  const divPct  = parseFloat(document.getElementById('ni-divportion').value) || 0;
  const totalPct = callPct + divPct;

  document.getElementById('kodex-total-rate').textContent   = totalPct.toFixed(1) + '%';
  document.getElementById('kodex-call-display').textContent = callPct.toFixed(1) + '% → 세금 없음';
  document.getElementById('kodex-div-display').textContent  = divPct.toFixed(1)  + '% → 15.4% 적용';

  /* 실효세율: 분배 부분에만 15.4% 적용 */
  const effRate = totalPct > 0 ? (divPct / totalPct) * 0.154 : 0;
  document.getElementById('kodex-eff-rate').textContent = fmtRate(effRate * 100) + '%';

  /* 1년차 기준 과세표준 분배금액 미리보기 */
  const amountWan = getFancyWan('amount') || 0;
  const taxBase   = amountWan * 10000 * (divPct / 100);
  document.getElementById('kodex-taxbase-label').textContent = taxBase.toLocaleString('ko-KR') + '원/년';
}

function setTaxPreset(v, btn) {
  /* 어느 페이지 버튼인지 파악 */
  var page = btn ? btn.closest('.app-page') : null;
  var pageId = page ? page.id : 'page-simulator';
  var prefixMap = {'page-simulator':'', 'page-sol':'sol-', 'page-tiger':'tiger-', 'page-tigerdiv':'tigerdiv-', 'page-tigersemi':'tigersemi-'};
  var prefix = prefixMap[pageId] !== undefined ? prefixMap[pageId] : '';

  var ni = document.getElementById(prefix + 'ni-tax');
  var sl = document.getElementById(prefix + 'sl-tax');
  if (!ni || !sl) return;
  ni.value = fmtRate(v);
  sl.value = v;
  ni.classList.remove('error');

  /* 페이지별 manual 값 저장 및 update 호출 */
  if (pageId === 'page-simulator') {
    _manualTaxValue = ni.value;
    update();
  } else if (pageId === 'page-sol'      && window.solUpdate)      { window.solUpdate(); }
  else if (pageId === 'page-tiger'    && window.tigerUpdate)    { window.tigerUpdate(); }
  else if (pageId === 'page-tigerdiv' && window.tigerdivUpdate) { window.tigerdivUpdate(); }
  else if (pageId === 'page-tigersemi' && window.tigersemiUpdate) { window.tigersemiUpdate(); }
}

function setTaxMode(mode, btn) {
  const ni = document.getElementById('ni-tax');
  const sl = document.getElementById('sl-tax');

  /* bracket으로 전환 전 현재 직접입력 값 저장 */
  if (mode === 'bracket' && taxMode === 'manual') {
    _manualTaxValue = ni.value;
  }
  /* manual로 복귀 시 저장값 복원 */
  if (mode === 'manual') {
    ni.value = _manualTaxValue;
    sl.value = Math.min(parseFloat(_manualTaxValue) || 15.4, 49.5);
  }

  taxMode = mode;
  document.querySelectorAll('.tax-mode-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('tax-panel-manual').style.display   = mode === 'manual'  ? '' : 'none';
  document.getElementById('tax-panel-bracket').style.display  = mode === 'bracket' ? '' : 'none';
  /* 직접입력 모드에서는 슬라이더 노출, bracket에서는 dimmed */
  const sliderHeader = ni.closest('.slider-header');
  const sliderRange  = sl;
  const dim = mode === 'bracket';
  sliderHeader.style.opacity   = dim ? '0.4' : '1';
  sliderHeader.style.pointerEvents = dim ? 'none' : 'auto';
  sliderRange.style.opacity    = dim ? '0.4' : '1';
  sliderRange.style.pointerEvents = dim ? 'none' : 'auto';
  updateBracketUI();
  update();
}

function setTaxType(type, btn) {
  bracketType = type;
  document.querySelectorAll('.tax-type-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('tax-separate-info').style.display       = type === 'separate'      ? '' : 'none';
  document.getElementById('tax-comprehensive-info').style.display  = type === 'comprehensive' ? '' : 'none';
  updateBracketUI();
  update();
}

/* ── 한국 종합소득세 누진세율 (지방소득세 10% 포함) ── */
const TAX_BRACKETS = [
  { max: 14000000,   rate: 0.066,  deduct: 0          },
  { max: 50000000,   rate: 0.165,  deduct: 1260000*1.1},
  { max: 88000000,   rate: 0.264,  deduct: 5760000*1.1},
  { max: 150000000,  rate: 0.385,  deduct: 15440000*1.1},
  { max: 300000000,  rate: 0.418,  deduct: 19940000*1.1},
  { max: 500000000,  rate: 0.440,  deduct: 25940000*1.1},
  { max: 1000000000, rate: 0.462,  deduct: 35940000*1.1},
  { max: Infinity,   rate: 0.495,  deduct: 65940000*1.1},
];

/* 누진세액 계산 (과세표준 → 세액, 지방소득세 포함) */
function calcProgressiveTax(base) {
  if (base <= 0) return 0;
  for (const b of TAX_BRACKETS) {
    if (base <= b.max) return Math.max(0, base * b.rate - b.deduct);
  }
}

/* 연간 분배(세전)과 다른소득 과세표준을 받아 유효세율 반환 */
function calcYearEffectiveTaxRate(annualDivGross, otherIncome) {
  if (!taxOn) return 0;
  if (!annualDivGross || annualDivGross <= 0) return 0;

  /* ── KODEX 과세구조: 분배 비율만 과세, 콜옵션 비과세 ── */
  if (kodexOn) {
    const callPct = parseFloat(document.getElementById('ni-calloption').value) || 0;
    const divPct  = parseFloat(document.getElementById('ni-divportion').value) || 0;
    const totalPct = callPct + divPct;
    if (totalPct <= 0) return 0;
    /* 과세 대상 = 전체 분배금 중 분배금 비율 부분만 */
    const divRatio   = divPct / totalPct;           // 예: 2/17
    const taxableDiv = annualDivGross * divRatio;   // 과세 대상 금액

    if (taxMode === 'manual') {
      /* 직접 입력 세율을 과세 부분에만 적용 */
      const manualRate = (parseFloat(document.getElementById('ni-tax').value) || 0) / 100;
      return (taxableDiv * manualRate) / annualDivGross;
    }
    /* bracket/분리과세: 과세표준 = taxableDiv 기준 */
    if (bracketType === 'separate') {
      return (taxableDiv * 0.154) / annualDivGross;
    }
    /* 종합과세: 과세표준에 taxableDiv만 합산 */
    const THRESHOLD = 20000000;
    if (taxableDiv <= THRESHOLD) {
      return (taxableDiv * 0.154) / annualDivGross;
    }
    const baseTax2  = THRESHOLD * 0.154;
    const excess2   = taxableDiv - THRESHOLD;
    const taxOther2 = calcProgressiveTax(otherIncome);
    const taxTotal2 = baseTax2 + (calcProgressiveTax(otherIncome + excess2) - taxOther2);
    return Math.min(taxTotal2 / annualDivGross, 0.495);
  }

  if (taxMode === 'manual') {
    return (parseFloat(document.getElementById('ni-tax').value) || 0) / 100;
  }

  if (bracketType === 'separate') {
    return 0.154; // 분리과세 15.4%
  }

  /* 종합과세 */
  const THRESHOLD = 20000000; // 2,000만원

  if (annualDivGross <= THRESHOLD) {
    return 0.154;
  }

  const baseTax = THRESHOLD * 0.154;
  const excess  = annualDivGross - THRESHOLD;
  const taxOnOther       = calcProgressiveTax(otherIncome);
  const taxOnOtherPlusEx = calcProgressiveTax(otherIncome + excess);
  const excessTax        = taxOnOtherPlusEx - taxOnOther;

  const totalTax      = baseTax + excessTax;
  const effectiveRate = totalTax / annualDivGross;
  return Math.min(effectiveRate, 0.495);
}

/* 세율 구간 테이블 하이라이트 + 유효세율 업데이트 */
function updateBracketUI() {
  if (!taxOn || taxMode !== 'bracket') return;

  const otherIncome = getFancyWan('otherincome') * 10000;

  /* ── 1년차 세전 분배 정밀 추정 (DCA 포함) ── */
  const amountWan  = getFancyWan('amount') || 0;
  const ratePct    = parseFloat(document.getElementById('ni-rate').value)    || 12;
  const monthlyWan = dcaOn ? (getFancyWan('monthly') || 0) : 0;
  const _amount  = amountWan  * 10000;
  const _monthly = monthlyWan * 10000;
  const _mRate   = (ratePct / 100) / 12;
  let _port = _amount, _est1stTotal = 0;
  for (let m = 0; m < 12; m++) { _port += _monthly; _est1stTotal += _port * _mRate; }
  /* KODEX 구조 ON이면 과세 부분만 과세표준으로 사용 */
  let est1stDiv = _est1stTotal;
  if (kodexOn) {
    const _callPct = parseFloat(document.getElementById('ni-calloption').value) || 0;
    const _divPct  = parseFloat(document.getElementById('ni-divportion').value) || 0;
    const _tot = _callPct + _divPct;
    if (_tot > 0) est1stDiv = _est1stTotal * (_divPct / _tot);
  }

  /* ── 테이블 구간 하이라이트 ── */
  const excessBase = (bracketType === 'comprehensive' && est1stDiv > 20000000)
    ? otherIncome + (est1stDiv - 20000000) : 0;
  document.querySelectorAll('#bracket-table tbody tr').forEach(tr => {
    const maxVal = tr.dataset.max === 'Infinity' ? Infinity : parseFloat(tr.dataset.max);
    const prev   = tr.previousElementSibling;
    const minVal = prev ? parseFloat(prev.dataset.max === 'Infinity' ? Infinity : prev.dataset.max) : 0;
    tr.classList.toggle('bracket-active',
      bracketType === 'comprehensive' && excessBase > minVal && excessBase <= maxVal);
    /* 각 구간 실효세율 표시 */
    const midBase = maxVal === Infinity ? (minVal + 2e8) : (minVal + maxVal) / 2;
    const effCell = tr.querySelector('.eff-rate');
    if (effCell) effCell.textContent = fmtRate(calcYearEffectiveTaxRate(20000000 + midBase, otherIncome) * 100) + '%';
  });

  /* ── 1년차 유효세율 → 슬라이더·입력란 반영 ── */
  const eff1st      = calcYearEffectiveTaxRate(est1stDiv, otherIncome);
  const displayRate = fmtRate(eff1st * 100);
  const el = document.getElementById('bracket-eff-rate');
  if (el) el.textContent = displayRate + '%';
  const ni = document.getElementById('ni-tax');
  const sl = document.getElementById('sl-tax');
  ni.value = displayRate;
  sl.value = Math.min(eff1st * 100, 49.5);
}

function setDetailTab(tab, btn) {
  detailTab = tab;
  const pgK = document.getElementById('page-simulator');
  if (pgK) pgK.querySelectorAll('#dtab-annual, #dtab-monthly').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  const _da = document.getElementById('detail-annual');
  const _dm = document.getElementById('detail-monthly');
  const _dt = document.getElementById('detail-title');
  if (_da) _da.style.display  = tab === 'annual'  ? '' : 'none';
  if (_dm) _dm.style.display  = tab === 'monthly' ? '' : 'none';
  if (_dt) _dt.textContent    = tab === 'annual' ? '연간 상세 내역' : '월간 상세 내역';
  if (_cache) renderMonthlyTable(_cache);
}

function renderMonthlyTable(cache) {
  if (!cache || !cache.rows) return;
  const { rows } = cache;
  const tbody = document.getElementById('monthlyTableBody');
  const _priceNow = _lastKodexPrice || parseFloat((document.getElementById('kodex-price-val')||{textContent:'0'}).textContent.replace(/[^0-9.]/g,'')) || 0;
  const _growth = (parseFloat((document.getElementById('ni-growth')||{value:'0'}).value) || 0) / 100;
  if (!tbody) return;
  try { saveOpenYears(tbody); } catch(e) {}
  tbody.innerHTML = '';

  /* 헤더 표시/숨김 */
  const mthTaxbase = document.getElementById('mth-taxbase');
  const mthTax     = document.getElementById('mth-tax');
  const mthDiv     = document.getElementById('mth-div');
  const mthDeposit = document.getElementById('mth-deposit');
  if (mthTaxbase) mthTaxbase.style.display = taxOn ? '' : 'none';
  if (mthTax)     mthTax.style.display     = taxOn ? '' : 'none';
  if (mthDeposit) mthDeposit.classList.toggle('col-hidden', !dcaOn);
  if (mthDiv)     mthDiv.textContent = taxOn ? '연/월 분배 (세후)' : '연/월 분배금';
  const mthPriceChange = document.getElementById('mth-price-change');

  /* KODEX 비율 */
  const callPct  = kodexOn ? (parseFloat((document.getElementById('ni-calloption')||{value:'0'}).value) || 0) : 0;
  const divPct   = kodexOn ? (parseFloat((document.getElementById('ni-divportion')||{value:'0'}).value)  || 0) : 0;
  const totalPct = callPct + divPct;
  const divRatio = (kodexOn && totalPct > 0) ? divPct / totalPct : 1;

  const colSpan = 6 + (dcaOn?1:0) + (taxOn?2:0);

  rows.forEach(function(r, yi) {
    var yearNum = yi + 1;
    var mTaxRatio = r.div > 0 ? r.tax / r.div : 0;
    var keepRate  = (r.div > 0 && r.divGross > 0) ? r.div / r.divGross : 1;

    /* ── 연차 헤더 행 (요약 표시) ── */
    var hdrTr = document.createElement('tr');
    hdrTr.className = 'yr-acc-hdr';
    hdrTr.dataset.yr = yearNum;

    var hdrCells = '<td style="border-top:1px solid rgba(var(--fg-rgb),0.06);">' +
      '<span style="display:flex;align-items:center;gap:8px;">' +
      '<span class="yr-acc-arrow" style="font-size:11px;color:var(--text3);transition:transform 0.15s;">▶</span>' +
      '<span>' + yearNum + '년차</span></span></td>';
    hdrCells += '<td style="border-top:1px solid rgba(var(--fg-rgb),0.06);">' + fmt(r.portStart) + '</td>';
    hdrCells += '<td class="' + (dcaOn ? '' : 'col-hidden') + '" style="border-top:1px solid rgba(var(--fg-rgb),0.06);color:var(--accent);">' + fmt(r.deposit) + '</td>';
    hdrCells += '<td style="border-top:1px solid rgba(var(--fg-rgb),0.06);">' + fmt(r.div) + '</td>';
    if (taxOn) hdrCells += '<td style="border-top:1px solid rgba(var(--fg-rgb),0.06);color:#fe9800;">' + fmt(r.taxBase) + '</td>';
    if (taxOn) hdrCells += '<td style="border-top:1px solid rgba(var(--fg-rgb),0.06);color:#f04452;">' + fmt(r.tax) + '</td>';
    /* 연간 주가 변동 합산 */
    var _yPCK = 0;
    if (r.monthlyPortAfterDeposit && r.monthlyPortEnd && r.monthlyDivs) {
      var _prKY = typeof partialRatio !== 'undefined' ? partialRatio : 0.5;
      r.monthlyDivs.forEach(function(md, mmi) {
        var pa = r.monthlyPortAfterDeposit[mmi]||0, pe = r.monthlyPortEnd[mmi]||0;
        var rv = investMode==='reinvest' ? md : (investMode==='partial' ? Math.round(md*_prKY) : 0);
        _yPCK += (pe - pa - rv);
      });
    }
    _yPCK = Math.round(_yPCK);
    if (Math.abs(_yPCK) <= 5) _yPCK = 0;
    /* 연/월 주가 변동 헤더 색상: 합계가 - 이면 빨간색 */
    if (mthPriceChange) mthPriceChange.style.color = _yPCK < 0 ? '#f04452' : '#3182f6';
    hdrCells += '<td style="border-top:1px solid rgba(var(--fg-rgb),0.06);color:' + (_yPCK>=0?'#3182f6':'#f04452') + ';">' + (_yPCK>=0?'+':'') + fmt(_yPCK) + '</td>';
    hdrCells += '<td style="border-top:1px solid rgba(var(--fg-rgb),0.06);">' + fmt(r.port) + '</td>';
    var _yShares = calcShares(r.port, _priceNow, _growth, yearNum * 12);
    hdrCells += '<td style="border-top:1px solid rgba(var(--fg-rgb),0.06);">' + fmtShares(_yShares) + '</td>';

    hdrTr.innerHTML = hdrCells;
    hdrTr.onclick = function() { toggleYearGroup(this); };
    tbody.appendChild(hdrTr);

    /* ── 월별 행 ── */
    if (!r.monthlyDivs) return;
    r.monthlyDivs.forEach(function(mDiv, mi) {
      var monthNum  = yi * 12 + mi + 1;
      var portStart = r.monthlyPortStart ? r.monthlyPortStart[mi] : 0;
      var mDepAmt   = r.monthlyDeposits  ? r.monthlyDeposits[mi]  : 0;
      var portEnd   = r.monthlyPortEnd   ? r.monthlyPortEnd[mi]   : (r.monthlyPortAfterDeposit ? r.monthlyPortAfterDeposit[mi] : 0);
      var mDivGross = keepRate > 0 ? mDiv / keepRate : mDiv;
      var mTaxBase  = Math.round(mDivGross * divRatio);
      var mTax      = taxOn ? Math.round(mDiv * mTaxRatio) : 0;
      var _pad = r.monthlyPortAfterDeposit ? r.monthlyPortAfterDeposit[mi] : 0;
      var _pr  = typeof partialRatio !== 'undefined' ? partialRatio : 0.5;
      var _rv  = investMode==='reinvest' ? mDiv : (investMode==='partial' ? Math.round(mDiv*_pr) : 0);
      var mPriceChg = portEnd - _pad - _rv;
      if (Math.abs(mPriceChg) <= 2) mPriceChg = 0;

      var tr = document.createElement('tr');
      tr.dataset.yrRow = yearNum;
      tr.style.display = 'none';
      if (yi === rows.length - 1 && mi === 11) tr.classList.add('highlight');

      var depCell = '<td class="' + (dcaOn ? '' : 'col-hidden') + '">' + (mDepAmt > 0 ? '<span style="color:var(--accent);">+' + fmt(mDepAmt) + '</span>' : '<span style="color:var(--text3);">—</span>') + '</td>';
      var taxCells = taxOn
        ? ('<td style="color:#fe9800;">' + fmt(mTaxBase) + '</td><td style="color:#f04452;">' + fmt(mTax) + '</td>')
        : '';

      tr.innerHTML =
        '<td style="color:var(--text3);">' + monthNum + '개월</td>' +
        '<td>' + fmt(portStart) + '</td>' +
        depCell +
        '<td>' + fmt(mDiv) + '</td>' +
        taxCells +
        '<td style="color:' + (mPriceChg>=0?'#3182f6':'#f04452') + ';">' + (mPriceChg>=0?'+':'') + fmt(mPriceChg) + '</td>' +
        '<td>' + fmt(portEnd) + '</td>' +
        '<td>' + fmtShares(calcShares(portEnd, _priceNow, _growth, monthNum)) + '</td>';
      tbody.appendChild(tr);
    });
  });
  try { restoreOpenYears(tbody); } catch(e) {}
  /* 최종 높이 재계산 강제 */
  try {
    var _sc = tbody.parentElement && tbody.parentElement.parentElement;
    if (_sc) { _sc.style.height = ''; void _sc.offsetHeight; }
  } catch(e) {}
}

function setChartTab(tab, btn) {
  chartTab = tab;
  document.querySelectorAll('#tab-annual, #tab-monthly').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  if (_cache) renderChart(_cache);
}

/* ════════════════════════════════════════════════════════════
   [SIM-UNIT] 분배 시뮬레이터 공용 단위 시스템
   · KODEX/SOL/TIGER/TIGERDIV 4개 시뮬레이터가 모두 이 블록 하나만 사용
   · 단위는 fancyUnit[pageId+'_'+field] 에만 저장 → 페이지 간 오염 없음
   · 입력란  : oninput="simOnInput(this)"  onblur="simOnBlur(this)"
   · 슬라이더: oninput="simOnSlider(this)"   (슬라이더 값은 항상 원 단위)
   · 단위버튼: onclick="setFancyUnit(field, unit, this)"  (unit: eok|man|won|joo)
════════════════════════════════════════════════════════════ */
var SIM_PREFIX = { 'page-simulator': '', 'page-sol': 'sol-', 'page-tiger': 'tiger-', 'page-tigerdiv': 'tigerdiv-', 'page-tigersemi': 'tigersemi-', 'page-divcalc': 'divcalc-' };
var SIM_UPDATE = { 'page-simulator': 'update', 'page-sol': 'solUpdate', 'page-tiger': 'tigerUpdate', 'page-tigerdiv': 'tigerdivUpdate', 'page-tigersemi': 'tigersemiUpdate', 'page-divcalc': 'divcalcUpdate' };
var fancyUnit = {};
let cpdMode = 'simple'; let cpdTaxOn = false;   /* 세금 설정 기본값: OFF */ let cpdChart = null; let cpdChartTab = 'val';
const cpdUnit = { principal: 'won', monthly: 'won' };

function simEl(pageId, kind, field) { return document.getElementById((SIM_PREFIX[pageId] || '') + kind + '-' + field); }
function simUnit(pageId, field)     { return fancyUnit[pageId + '_' + field] || 'won'; }
function simPrice(pageId) {
  var el = document.getElementById((SIM_PREFIX[pageId] || '') + 'kodex-price-val');
  return el ? (parseFloat(el.textContent.replace(/[^0-9.]/g, '')) || 0) : 0;
}
/* 단위 → 원 배율 (joo = 해당 페이지 현재가) */
function unitToWon(unit, pageId) {
  if (unit === 'eok') return 1e8;
  if (unit === 'man') return 1e4;
  if (unit === 'joo') { var p = simPrice(pageId || 'page-simulator'); return p > 0 ? p : 1; }
  return 1;
}
function simReadWon(pageId, field) {
  var el = simEl(pageId, 'ni', field);
  var num = el ? (parseFloat(el.value.replace(/,/g, '')) || 0) : 0;
  return num * unitToWon(simUnit(pageId, field), pageId);
}
/* 원 → 입력란 표시 (원·주: 정수 / 만원·억원: 소수 4자리) */
function simWriteWon(pageId, field, won) {
  var el = simEl(pageId, 'ni', field); if (!el) return;
  var u = simUnit(pageId, field), v = won / unitToWon(u, pageId);
  el.value = commaFmt((u === 'won' || u === 'joo') ? Math.round(v) : parseFloat(v.toFixed(4)));
}
function simInfo(el) {
  var pg = el.closest('.app-page'), pageId = pg ? pg.id : 'page-simulator';
  return { pageId: pageId, field: el.id.slice((SIM_PREFIX[pageId] || '').length).replace(/^(ni|sl)-/, '') };
}
function simRun(pageId) { var fn = window[SIM_UPDATE[pageId]]; if (typeof fn === 'function') fn(); }
function simSyncSlider(pageId, field) {
  var sl = simEl(pageId, 'sl', field); if (!sl) return;
  sl.value = Math.min(Math.max(simReadWon(pageId, field), parseFloat(sl.min)), parseFloat(sl.max));
}
/* 콤마 포맷 (소수점 1개 허용, 커서 위치 유지) */
function simFormatInput(el) {
  var pos = el.selectionStart, oldLen = el.value.length;
  var s = el.value.replace(/[^0-9.]/g, ''), i = s.indexOf('.');
  if (i >= 0) s = s.slice(0, i + 1) + s.slice(i + 1).replace(/\./g, '');
  var p = s.split('.');
  el.value = s === '' ? '' : parseInt(p[0] || '0', 10).toLocaleString('ko-KR') + (p.length > 1 ? '.' + p[1] : '');
  try { var np = Math.max(0, (pos || 0) + el.value.length - oldLen); el.setSelectionRange(np, np); } catch (e) {}
}
function simOnInput(el)  { var o = simInfo(el); simFormatInput(el); simSyncSlider(o.pageId, o.field); simRun(o.pageId); }
function simOnBlur(el)   { var o = simInfo(el); simWriteWon(o.pageId, o.field, simReadWon(o.pageId, o.field)); el.classList.remove('error'); simRun(o.pageId); }
function simOnSlider(sl) { var o = simInfo(sl); simWriteWon(o.pageId, o.field, parseFloat(sl.value) || 0); simRun(o.pageId); }

/* 단위 전환: 원화 값은 그대로 두고 표시만 변경 */
function setFancyUnit(field, unit, btn) {
  var pg = btn && btn.closest('.app-page'), pageId = pg ? pg.id : 'page-simulator';
  if (unit === 'joo' && simPrice(pageId) <= 0) { alert('현재가가 아직 조회되지 않았습니다. 상단 [갱신]으로 현재가를 불러온 뒤 다시 선택해주세요.'); return; }
  var won = simReadWon(pageId, field);
  fancyUnit[pageId + '_' + field] = unit;
  var el = simEl(pageId, 'ni', field);
  if (el) { simWriteWon(pageId, field, won); el.placeholder = unit === 'joo' ? '주 수량 입력' : ''; }
  (pg || document).querySelectorAll('.unit-btn[data-field="' + field + '"]').forEach(function (b) { b.classList.toggle('active', b === btn); });
  simSyncSlider(pageId, field);
  simRun(pageId);
}

/* KODEX(page-simulator) 계산부 호환: 만원 단위 반환 */
function getFancyWan(id) { return simReadWon('page-simulator', id) / 10000; }

/* 입력 중인 문자열 → 콤마 포맷 (억·만 단위에서 1.5 처럼 소수점 입력 허용, 소수 4자리까지) */
function typingNumFmt(ov) {
  let t = String(ov || '').replace(/[^0-9.]/g, '');
  const dot = t.indexOf('.');
  if (dot >= 0) t = t.slice(0, dot + 1) + t.slice(dot + 1).replace(/\./g, '').slice(0, 4);
  if (!t) return '';
  const parts = t.split('.');
  const ip = parts[0] ? parseInt(parts[0], 10).toLocaleString('ko-KR') : '0';
  return parts.length > 1 ? ip + '.' + parts[1] : ip;
}
/* 숫자 → 콤마 문자열 (소수점 허용) */
function commaFmt(n) {
  if (n === '' || n === null || n === undefined) return '';
  const parts = String(n).split('.');
  parts[0] = parseInt(parts[0] || '0', 10).toLocaleString('ko-KR');
  return parts.length > 1 ? parts.join('.') : parts[0];
}

/* ── 아코디언 토글 ── */
/* 접이식 열기/닫기 — 높이·여백·투명도를 함께 애니메이션해 부드럽게 펼침/접힘.
   빠르게 연속 클릭해도 현재 보이는 높이에서 이어서 반대로 움직임. 동작 줄이기 설정이면 즉시 전환. */
function accAnimate(el, open, done) {
  var prev = el._accAnim, cur = null;
  if (prev) { var c = getComputedStyle(el); cur = { h: el.getBoundingClientRect().height + 'px', pt: c.paddingTop, pb: c.paddingBottom, o: c.opacity }; prev.onfinish = null; prev.cancel(); el._accAnim = null; }
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || !el.animate) { done && done(); return; }
  var cs = getComputedStyle(el);
  var full = { h: el.getBoundingClientRect().height + 'px', pt: cs.paddingTop, pb: cs.paddingBottom, o: '1' };
  var zero = { h: '0px', pt: '0px', pb: '0px', o: '0' };
  var a = open ? (cur || zero) : (cur || full), b = open ? full : zero;
  var k = function (v) { return { height: v.h, paddingTop: v.pt, paddingBottom: v.pb, opacity: v.o, overflow: 'hidden' }; };
  var anim = el.animate([k(a), k(b)], { duration: open ? 280 : 220, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'forwards' });
  el._accAnim = anim;
  anim.onfinish = function () { el._accAnim = null; done && done(); anim.cancel(); };
}
function toggleAcc(id, header) {
  var body = document.getElementById(id);
  if (!body) return;
  var isOpen = body._accTarget != null ? body._accTarget : (body.classList.contains('open') || body.classList.contains('default-open'));
  var open = !isOpen; body._accTarget = open;
  if (header) { header.classList.toggle('acc-open', open); header.classList.add('acc-joined'); }   /* 헤더(▼/▲)는 즉시, 내용은 애니메이션 */
  if (open) body.classList.add('open');
  accAnimate(body, open, function () {
    if (!open) body.classList.remove('open', 'default-open');
    if (header) header.classList.remove('acc-joined');
    body._accTarget = null;
  });
}
/* 종합소득세 <details class="inc-sec"> 도 같은 모션으로 */
document.addEventListener('click', function (e) {
  var sm = e.target.closest && e.target.closest('.inc-sec > summary'); if (!sm) return;
  var d = sm.parentNode, inner = d.querySelector(':scope > .inc-sec-in'); if (!inner) return;
  e.preventDefault();
  var isOpen = d._accTarget != null ? d._accTarget : d.open;
  var open = !isOpen; d._accTarget = open;
  d.classList.toggle('acc-closing', !open);
  if (open) d.open = true;
  accAnimate(inner, open, function () { if (!open) d.open = false; d.classList.remove('acc-closing'); d._accTarget = null; });
});

/* 요약표 섹션 접이식 */
function msSec(sec, hdrRow) {
  var rows = document.querySelectorAll('.ms-row-' + sec);
  var arr  = hdrRow.querySelector('.ms-arr');
  var isOpen = rows.length > 0 && rows[0].style.display !== 'none';
  rows.forEach(function(r) { r.style.display = isOpen ? 'none' : ''; });
  if (arr) arr.style.transform = isOpen ? 'rotate(-90deg)' : '';
}

/* ── 분배 ↔ 분배 텍스트 전환 ── */
function updateDivLabel() {
  const word  = kodexOn ? '분배' : '분배';
  const wordG = kodexOn ? '분배금' : '분배금';
  document.querySelectorAll('.txt-div').forEach(el => {
    const base = el.dataset.base || el.textContent.replace(/분배금|분배금|분배|분배/, '').trim();
    if (!el.dataset.base) el.dataset.base = el.textContent.trim();
    const orig = el.dataset.base;
    if (orig === '분배금' || orig === '분배금') el.textContent = wordG;
    else el.textContent = word;
  });
  /* 동적으로 생성되는 헤더 텍스트 */
  const accTitle = document.getElementById('acc-target-title');
  if (accTitle) accTitle.textContent = `월 ${wordG} 목표 역산`;
  /* 차트 추이 카드 제목 */
  const legLabel = document.getElementById('leg-div-label');
  if (legLabel) {
    const span = legLabel.querySelector('.txt-div');
    if (span) span.textContent = wordG;
    else legLabel.textContent = (chartTab === 'annual' ? '연간 ' : '월간 ') + wordG;
  }
  /* 요약 바 동적 라벨 */
  document.querySelectorAll('.sum-cell-label').forEach(el => {
    el.innerHTML = el.innerHTML
      .replace(/분배금|분배금/g, wordG)
      .replace(/(?<![분배])분배(?!금|률|소득|수령)|(?<![배])분배(?!금)/g, word);
  });
}

/* ── 세율 포맷: 소수점 최대 4자리, 후행 0 제거 ── */
/* [I18N] 영어 페이지(/en/)에서 JS 가 만드는 글자: L('한국어', 'English') — 한국어 페이지에서는 항상 첫 번째 값 */
function L(ko, en) { return SITE_EN ? en : ko; }   /* SITE_EN 은 이 스크립트 맨 위에서 정함 */
function wonEn(n, short) {   /* 영어 페이지 원화 표기: ₩358.1M · ₩1.28B */
  var a = Math.abs(n), s = n < 0 ? '-' : '';
  if (a >= 1e12) return s + '₩' + (a / 1e12).toFixed(2) + 'T';
  if (a >= 1e9)  return s + '₩' + (a / 1e9).toFixed(2) + 'B';
  if (a >= 1e6)  return s + '₩' + (a / 1e6).toFixed(short ? 1 : 2) + 'M';
  if (short && a >= 1e3) return s + '₩' + Math.round(a / 1e3) + 'K';
  return s + '₩' + Math.round(a).toLocaleString('en-US');
}

function fmtRate(n) {
  /* 최대 4자리 → 후행 0 제거 */
  return parseFloat(n.toFixed(4)).toString();
}

/* 분배 시뮬레이터 공통: 연평균 자산 상승률
   · 월초 적립이 있으면 적립금을 '상승'으로 세지 않도록 납입 시점을 반영한 연환산 내부수익률(IRR)
     초기금 × (1+i)^n + Σ 적립금 × (1+i)^(n−k) = 최종 자산 (k = 0..n−1, 월초 납입) 을 만족하는 월 수익률 i → (1+i)^12 − 1
   · 적립이 없으면 (최종 ÷ 초기)^(1/년) − 1 과 같음 · 계산할 수 없으면 null */
function simAssetCagr(amount, monthly, years, finalPort) {
  amount = Math.max(0, amount || 0); monthly = Math.max(0, monthly || 0);
  const n = Math.round(years * 12);
  if (!(n > 0) || !(finalPort >= 0) || (amount <= 0 && monthly <= 0)) return null;
  if (monthly <= 0) return Math.pow(finalPort / amount, 1 / years) - 1;
  const fv = i => { const g = 1 + i; let v = amount * Math.pow(g, n); for (let k = 0; k < n; k++) v += monthly * Math.pow(g, n - k); return v; };
  let lo = -0.99, hi = 1;
  if (fv(lo) > finalPort || fv(hi) < finalPort) return null;
  for (let it = 0; it < 200; it++) { const mid = (lo + hi) / 2; if (fv(mid) < finalPort) lo = mid; else hi = mid; }
  return Math.pow(1 + (lo + hi) / 2, 12) - 1;
}

/* ── 포맷 ── */
function fmt(n, short) {
  if (!isFinite(n) || isNaN(n)) return '—';
  /* short=true : 차트 축 레이블용 축약 */
  if (short) {
    if (SITE_EN) return wonEn(n, true);
    if (n >= 1e12) return (n/1e12).toFixed(1)+'조';
    if (n >= 1e8)  return (n/1e8).toFixed(1)+'억';
    if (n >= 1e4)  return Math.round(n/1e4).toLocaleString()+'만';
    return Math.round(n).toLocaleString();
  }
  /* 일반 표시: 원 단위 콤마 (영어 페이지는 ₩1,234,567) */
  if (SITE_EN) return (n < 0 ? '-' : '') + '₩' + Math.round(Math.abs(n)).toLocaleString('en-US');
  return Math.round(n).toLocaleString('ko-KR') + '원';
}

/* ─────────────────────────────────────────
   메인 계산
───────────────────────────────────────── */
function update() {
  const amountWan = getFancyWan('amount');
  const years     = Math.round(parseFloat(document.getElementById('ni-years').value));
  const ratePct   = parseFloat(document.getElementById('ni-rate').value);
  const growthPct = parseFloat(document.getElementById('ni-growth').value);

  if ([amountWan, years, ratePct, growthPct].some(isNaN)) return;

  const amount = amountWan * 10000;
  const rate   = ratePct  / 100;
  const growth = growthPct / 100;
  const yrs    = Math.max(1, Math.min(years, 50));

  /* 투자 금액 0원이고 월 적립도 0이면 모든 결과를 0으로 초기화 후 종료 */
  const monthlyWanCheck = dcaOn ? (getFancyWan('monthly') || 0) : 0;
  if (amount === 0 && monthlyWanCheck === 0) {
    ['s-annual','s-weekly','s-final','s-final-sub','s-total','s-total-sub',
     's-port','s-port-sub','s-cagr'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.textContent = id.endsWith('-sub') ? '' : '0원';
    });
    document.querySelectorAll('.sum-cell-val').forEach(function(el) { el.textContent = '0원'; });
    /* 상세 내역 tbody 초기화 */
    var _tbody = document.getElementById('monthlyTableBody');
    if (_tbody) _tbody.innerHTML = '';
    _cache = null;
    return;
  }

  /* ── 분배소득세율 (bracket 모드에서는 연도별 동적 계산) ── */
  const otherIncome = taxOn && taxMode === 'bracket' && bracketType === 'comprehensive'
    ? getFancyWan('otherincome') * 10000
    : 0;

  /* bracket 모드이면 입력 변경마다 UI 갱신 (세율 슬라이더 동기화) */
  if (taxOn && taxMode === 'bracket') updateBracketUI();
  /* KODEX 구조 ON이면 실효세율 미리보기 갱신 */
  if (kodexOn) updateKodexUI();

  /* ── 월 적립 금액 ── */
  const monthlyWan = dcaOn ? (getFancyWan('monthly') || 0) : 0;
  const monthly    = monthlyWan * 10000;

  /* 연간 적립 레이블 업데이트 (OFF여도 입력값 기준으로 표시) */
  const _dcaMonthly = getFancyWan('monthly') * 10000;
  document.getElementById('dca-annual-label').textContent = fmt(_dcaMonthly * 12) + ' / 년';

  /* ── 월별 시뮬레이션 (정확한 적립식 복리 계산) ──
     - 매월 초 적립금 투입
     - 월별 분배 = portfolio * (rate/12)
     - 분배수령: 분배금 지급 후 주가 상승분만 반영
     - 분배재투자: 분배금 + 주가 상승 전체 재투자
  */
  const rows      = [];
  const monthRate = rate / 12;
  const monthGrow = Math.pow(1 + growth, 1/12) - 1;

  let portfolio   = amount;
  let totalDiv    = 0;
  let totalTax    = 0;
  let totalInvest = amount;   // 총 투입 원금 추적

  for (let y = 1; y <= yrs; y++) {
    let yearDiv      = 0;
    let yearDivGross = 0;
    let yearTax      = 0;
    let yearDeposit  = 0;
    const portStart  = portfolio;

    /* 이 연도의 세전 분배 정밀 추정 (DCA 포함) → 유효세율 산출 */
    let _ep = portStart, _eg = 0;
    for (let _m = 0; _m < 12; _m++) { _ep += monthly; _eg += _ep * monthRate; }
    const estYearDivGross = _eg;
    const yearTaxRate  = calcYearEffectiveTaxRate(estYearDivGross, otherIncome);
    const yearKeepRate = 1 - yearTaxRate;

    const monthlyDivs            = [];  // 월 분배금(세후)
    const monthlyPortStart       = [];  // 월초 잔고(적립 전) — 1년차 1월 = 초기 투자금
    const monthlyDeposits        = [];  // 월 적립금
    const monthlyPortAfterDeposit = []; // 적립 후 잔고(분배 기준 잔고)
    const monthlyPortEnd         = [];  // 월말 잔고(분배+재투자+주가변동 후)

    for (let m = 0; m < 12; m++) {
      /* 월초 잔고 저장 (DCA 투입 전) */
      monthlyPortStart.push(Math.round(portfolio));

      /* 월초 적립 */
      const mDeposit = (monthly > 0) ? monthly : 0;
      if (mDeposit > 0) {
        portfolio   += mDeposit;
        yearDeposit += mDeposit;
        totalInvest += mDeposit;
      }
      monthlyDeposits.push(mDeposit);
      monthlyPortAfterDeposit.push(Math.round(portfolio));
      /* 월 분배 (세전) */
      const mDivGross = portfolio * monthRate;
      const mTax      = mDivGross * yearTaxRate;
      const mDivNet   = mDivGross * yearKeepRate;  // 세후 수령액
      monthlyDivs.push(Math.round(mDivNet));
      yearDiv      += mDivNet;
      yearDivGross += mDivGross;
      yearTax      += mTax;
      totalDiv   += mDivNet;
      totalTax   += mTax;
      /* 분배 처리 + 주가 변동
         재투자: 세후 분배금을 즉시 재투자 후 주가 변동 적용 */
      if (investMode === 'reinvest') {
        portfolio = (portfolio + mDivNet) * (1 + monthGrow);
      } else if (investMode === 'partial') {
        const partialRatio = (parseFloat(document.getElementById('ni-partial')?.value) || 50) / 100;
        const reinvestAmt  = mDivNet * partialRatio;
        portfolio = (portfolio + reinvestAmt) * (1 + monthGrow);
      } else {
        portfolio = portfolio * (1 + monthGrow);
      }
      monthlyPortEnd.push(Math.round(portfolio));  // 월말 잔고
    }

    /* 연초 기준 월·주 분배 (직관적 참고값: 재투자 복리 전 원점 기준) */
    const monthDiv1st = Math.round(portStart * monthRate * yearKeepRate);
    const weekDiv1st  = Math.round(portStart * (rate / 52) * yearKeepRate);

    /* 과세표준: kodexOn이면 분배금 비율 부분만, 아니면 세전 전액 */
    let yearTaxBase = yearDivGross;
    if (kodexOn) {
      const _cp = parseFloat(document.getElementById('ni-calloption').value) || 0;
      const _dp = parseFloat(document.getElementById('ni-divportion').value)  || 0;
      const _tp = _cp + _dp;
      yearTaxBase = _tp > 0 ? yearDivGross * (_dp / _tp) : 0;
    }

    rows.push({
      label:       y + '년차',
      port:        Math.round(portfolio),
      portStart:   Math.round(portStart),
      div:         Math.round(yearDiv),
      divGross:    Math.round(yearDivGross),
      taxBase:     Math.round(yearTaxBase),
      monthDiv1st,
      weekDiv1st,
      monthlyDivs,
      monthlyPortStart,          // 월초 잔고(적립 전) 12개
      monthlyDeposits,           // 월 적립금 12개
      monthlyPortAfterDeposit,   // 적립 후 잔고 12개
      monthlyPortEnd,            // 월말 잔고 12개
      tax:         Math.round(yearTax),
      deposit:     Math.round(yearDeposit),
      total:       Math.round(totalDiv),
    });
  }

  /* 요약용 값 */
  const firstDiv  = rows[0].div;
  const lastRow   = rows[rows.length - 1];
  const finalPort = lastRow.port;
  const lastDiv   = lastRow.div;

  /* 요약 바 */
  document.getElementById('s-annual').textContent     = fmt(firstDiv);
  document.getElementById('s-weekly').textContent     = '월간 ' + fmt(rows[0].monthlyDivs ? rows[0].monthlyDivs[11] : rows[0].monthDiv1st);
  const _wG = kodexOn ? '분배금' : '분배금';
  document.getElementById('s-label2').textContent     = yrs + '년차 연간 ' + _wG + (taxOn ? ' (세후)' : '');
  document.getElementById('s-final').textContent      = fmt(lastDiv);
  document.getElementById('s-final-sub').textContent  = '월간 ' + fmt(lastRow.monthlyDivs ? lastRow.monthlyDivs[11] : lastRow.monthDiv1st);
  document.getElementById('s-total').textContent      = fmt(totalDiv);
  document.getElementById('s-total-sub').textContent  = '수익률 ' + (totalInvest > 0 ? ((totalDiv / totalInvest) * 100).toFixed(1) : '0.0') + '%';
  document.getElementById('s-port-label').textContent = yrs + '년차 종료 자산';
  document.getElementById('target-sub').textContent   = '현재 ' + (kodexOn?'분배':'분배') + '율 기준';
  document.getElementById('s-port').textContent       = fmt(finalPort);
  document.getElementById('s-port-sub').textContent   = '총 투입 ' + fmt(totalInvest) + ' 대비';

  /* 연평균 자산 상승률 CAGR */
  const _cagr = simAssetCagr(amount, monthly, yrs, finalPort) || 0;   /* 적립 시 납입 시점 반영(IRR) */
  const _cagrMon = Math.pow(1 + _cagr, 1/12) - 1;
  const _cagrEl  = document.getElementById('s-cagr');
  _cagrEl.textContent = (_cagr >= 0 ? '+' : '') + (_cagr * 100).toFixed(2) + '%';
  _cagrEl.className   = 'sum-cell-val';
  document.getElementById('s-cagr-sub').textContent =
    '월 평균 ' + (_cagrMon >= 0 ? '+' : '') + (_cagrMon * 100).toFixed(3) + '%';

  /* 세금 요약 박스 */
  if (taxOn) {
    document.getElementById('tax-first-label').textContent = fmt(rows[0].tax);
    document.getElementById('tax-total-label').textContent = fmt(Math.round(totalTax));
  }

  /* 역산 */
  const targetWan = getFancyWan('target');
  if (!isNaN(targetWan)) {
    const needed = rate > 0 ? (targetWan * 10000 * 12) / rate : 0;
    document.getElementById('target-result').textContent = fmt(needed);
    document.getElementById('target-sub').textContent    = '분배율 ' + (rate * 100).toFixed(1) + '% 기준';
  }

  /* 표 렌더 */
  const tbody = document.getElementById('tableBody');
  if (tbody) tbody.innerHTML = '';
  rows.forEach((r, i) => {
    const tr = document.createElement('tr');
    if (i === rows.length - 1) tr.classList.add('highlight');
    tr.innerHTML = `
      <td>${r.label}</td>
      <td>${fmt(r.port)}</td>
      ${dcaOn ? `<td>${r.deposit > 0 ? fmt(r.deposit) : '<span style="color:var(--text3)">—</span>'}</td>` : ''}
      <td>${fmt(r.div)}</td>
      <td style="display:${taxOn?'table-cell':'none'};color:#fe9800;">${taxOn ? fmt(r.taxBase) : '—'}</td>
      <td style="display:${taxOn?'table-cell':'none'};color:#f04452;">${taxOn ? fmt(r.tax) : '—'}</td>
      <td>${fmt(r.total)}</td>`;
    if (tbody) tbody.appendChild(tr);
  });

  /* 차트 데이터 캐시 */
  /* 세금 컬럼 헤더 표시/숨김 */
  const _thTaxbase = document.getElementById('th-taxbase');
  const _thTax     = document.getElementById('th-tax');
  const _thDeposit = document.getElementById('th-deposit');
  const _thDiv     = document.getElementById('th-div');
  if (_thTaxbase) _thTaxbase.style.display = taxOn ? '' : 'none';
  if (_thTax)     _thTax.style.display     = taxOn ? '' : 'none';
  if (_thDeposit) _thDeposit.style.display = dcaOn  ? '' : 'none';
  const _divW = kodexOn ? '분배' : '분배'; const _divWG = kodexOn ? '분배금' : '분배금';
  if (_thDiv)     _thDiv.textContent       = taxOn ? ('연간 ' + _divW + ' (세후)') : ('연간 ' + _divWG);

  /* 요약 바 세후 표시 */
  const taxSuffix = taxOn ? ' (세후)' : '';
  document.getElementById('s-annual').title = taxSuffix;
  const _scl = document.querySelectorAll('.sum-cell-label');
  if (_scl[0]) _scl[0].textContent = '1년차 연간 분배금' + taxSuffix;
  if (_scl[2]) _scl[2].textContent = '누적 수령 분배금' + taxSuffix;

  _cache = { rows, amount, yrs, rate, totalInvest };
  try { renderChart(_cache); } catch(e) { console.error('renderChart 에러:', e); }
  try { renderMonthlyTable(_cache); } catch(e) { console.error('renderMonthlyTable 에러:', e); }
}

/* ─────────────────────────────────────────
   차트 렌더 (연간 / 월간 탭 분리)
───────────────────────────────────────── */
function renderChart(cache) {
  const { rows, amount, yrs } = cache;

  /* 범례 레이블 */
  document.getElementById('leg-div-label').textContent = chartTab === 'annual' ? '연간 분배금' : '월간 분배금';
  document.getElementById('leg-port').style.display = 'none';

  let labels, datasets, chartType, opts;

  if (chartTab === 'annual') {
    /* ── 연간 차트 ── */
    labels = rows.map(r => r.label);
    const divData  = rows.map(r => r.div);
    datasets = [{
      label: '연간 분배금',
      data: divData,
      backgroundColor: 'rgba(49,130,246,0.7)',
      borderRadius: 5,
      borderSkipped: false,
      order: 1,
    }];

    chartType = 'bar';
    opts = buildOpts(true, false, false);

  } else {
    /* ── 월간 차트 ── */
    const monthLabels = [];
    const monthData   = [];

    for (let y = 0; y < yrs; y++) {
      const yearLabel = (y + 1) + '년차';
      for (let m = 0; m < 12; m++) {
        monthLabels.push(m === 0 ? yearLabel : '');
        /* 모든 모드에서 실제 월별 분배금 사용 (주가 변동률이 월마다 반영된 값) */
        monthData.push(rows[y].monthlyDivs[m]);
      }
    }

    datasets = [{
      label: '월간 분배금',
      data: monthData,
      borderColor: '#3182f6',
      backgroundColor: 'rgba(49,130,246,0.12)',
      fill: true,
      pointRadius: 0,
      pointHoverRadius: 4,
      borderWidth: 2,
      tension: 0.2,   // 완만한 곡선 — 월별 성장 반영
    }];

    labels    = monthLabels;
    chartType = 'line';
    opts      = buildOpts(false, false, true);
  }

  if (chart) chart.destroy();
  chart = new Chart(document.getElementById('mainChart'), {
    type: chartType,
    data: { labels, datasets },
    options: opts,
  });
}

/* ── 차트 옵션 빌더 ── */
function buildOpts(isBar, hasDualAxis, isMonthly) {
  const o = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#202027',
        borderColor: fgA(0.1),
        borderWidth: 1,
        titleColor: '#9e9ea4',
        bodyColor: '#e4e4e5',
        padding: 12,
        callbacks: {
          title: items => {
            if (isMonthly) {
              const idx   = items[0].dataIndex;
              const yearN = Math.floor(idx / 12) + 1;
              const monN  = (idx % 12) + 1;
              return yearN + '년차 ' + monN + '월';
            }
            return items[0].label;
          },
          label: ctx => ' ' + ctx.dataset.label + ': ' + fmt(ctx.parsed.y),
        },
      },
    },
    scales: {
      x: {
        ticks: {
          color: '#6d6d76',
          font: { size: 11 },
          maxRotation: 0,
          autoSkip: false,
          callback(val, idx) {
            const lbl = this.getLabelForValue(idx);
            return lbl !== '' ? lbl : null;
          },
        },
        grid: { display: false },
        border: { display: false },
      },
      y: {
        position: 'left',
        ticks: { color: '#6d6d76', font: { size: 11 }, callback: v => fmt(v, true) },
        grid: { color: fgA(0.04) },
        border: { display: false },
      },
    },
  };

  if (hasDualAxis) {
    o.scales.y2 = {
      position: 'right',
      ticks: { color: '#3182f6', font: { size: 11 }, callback: v => fmt(v, true) },
      grid: { display: false },
      border: { display: false },
    };
  }

  return o;
}

/* ── KODEX 200타겟위클리커버드콜 현재가 조회 ── */
let _lastKodexPrice  = null;
let _isFetchingKodex = false;

function applyKodexPrice(price, src) {
  price = parseFloat(String(price).replace(/,/g,''));
  if (!price || price < 3000 || price > 100000) return false;
  _lastKodexPrice = price;
  const now = new Date();
  const ns  = now.getFullYear() + '-'
    + String(now.getMonth()+1).padStart(2,'0') + '-'
    + String(now.getDate()).padStart(2,'0')
    + ' ' + now.toTimeString().slice(0,8);
  const valEl  = document.getElementById('kodex-price-val');
  const dateEl = document.getElementById('kodex-price-date');
  const srcEl  = document.getElementById('kodex-price-src');
  if (valEl)  valEl.textContent  = price.toLocaleString('ko-KR');
  if (dateEl) dateEl.textContent = ns + ' 기준';
  if (srcEl)  srcEl.textContent  = '출처: ' + src;
  /* 현재가 반영하여 보유 수량 재계산 */
  update();
  return true;
}

async function fetchKodexPrice() {
  if (_isFetchingKodex) return;
  _isFetchingKodex = true;
  const btn  = document.getElementById('kodex-refresh-btn');
  const icon = document.getElementById('kodex-refresh-icon');
  const load = document.getElementById('kodex-loading');
  const dateEl = document.getElementById('kodex-price-date');
  const srcEl  = document.getElementById('kodex-price-src');
  if (btn)  btn.disabled     = true;
  if (icon) icon.textContent = '⏳';
  if (load) load.style.display = 'block';
  if (dateEl) dateEl.textContent = '조회 중...';
  if (srcEl)  srcEl.textContent  = '';

  try {

    /* 2순위: Yahoo Finance 498400.KS CORS 프록시 순차 */
    const yfUrl = 'https://query1.finance.yahoo.com/v8/finance/chart/498400.KS?interval=1d&range=3d';
    const proxies = [
      'https://corsproxy.io/?' + encodeURIComponent(yfUrl),
      'https://api.allorigins.win/raw?url=' + encodeURIComponent(yfUrl),
      'https://thingproxy.freeboard.io/fetch/' + yfUrl,
      yfUrl,
    ];
    for (const url of proxies) {
      try {
        const ctrl = new AbortController();
        const tid  = setTimeout(() => ctrl.abort(), 8000);
        let resp;
        try { resp = await fetch(url, { signal: ctrl.signal, cache: 'no-cache' }); }
        finally { clearTimeout(tid); }
        if (!resp || !resp.ok) continue;
        const txt = await resp.text();
        let json;
        try { json = JSON.parse(txt); } catch { continue; }
        if (json.contents) { try { json = JSON.parse(json.contents); } catch { continue; } }
        const r = json?.chart?.result?.[0];
        if (!r) continue;
        const m  = r.meta;
        const cl = r.indicators?.quote?.[0]?.close;
        const price = m.regularMarketPrice || m.previousClose
                   || (cl ? cl.filter(Boolean).slice(-1)[0] : null);
        if (applyKodexPrice(price, 'Yahoo Finance (498400.KS)')) return;
      } catch {}
    }

    /* 모두 실패 */
    if (_lastKodexPrice) {
      const now = new Date();
      const ns  = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0') + '-'
        + String(now.getDate()).padStart(2,'0') + ' ' + now.toTimeString().slice(0,8);
      if (dateEl) dateEl.textContent = ns + ' 기준 (이전값 유지)';
      if (srcEl)  srcEl.textContent  = '⚠ 조회 실패 — 직전가 ' + _lastKodexPrice.toLocaleString('ko-KR') + '원 유지';
    } else {
      if (dateEl) dateEl.textContent = '조회 실패';
      if (srcEl)  srcEl.textContent  = '↺ 갱신 버튼으로 재시도';
    }
  } finally {
    if (btn)  btn.disabled     = false;
    if (icon) icon.textContent = '↺';
    if (load) load.style.display = 'none';
    _isFetchingKodex = false;
  }
}

/* ── 초기 실행 ── */
/* 콤마 입력 초기 포맷 */
(function initFancyInputs() {
  /* 원 단위 기본값: amount=1억, target=500만, monthly=100만 */
  const _defWon = { amount: 100000000, otherincome: 50000000, target: 5000000, monthly: 1000000 };
  [['amount', 10000], ['otherincome', 5000], ['target', 500], ['monthly', 100]].forEach(([id, defaultWan]) => {
    const el = document.getElementById('ni-' + id);
    if (el) {
      const raw = parseFloat(el.value.replace(/,/g,'')) || defaultWan;
      el.value  = commaFmt(raw);
    }
  });
})();
if (document.getElementById('page-simulator')) update();   /* 도구별 페이지 분리: KODEX 시뮬레이터 화면이 있는 페이지에서만 */

/* ════════════════════════════════════════
   [CHART-ZOOM] 그래프 확대·축소·이동 (ETF CAGR 비교 · 코스피 대비 수익률 비교 공용)
   · 마우스 휠: 그래프 위에서만 확대/축소 (커서 위치 기준, 페이지 스크롤 막음)
   · 왼쪽 버튼 드래그: 확대된 상태에서 좌우 이동 · 더블클릭 / [전체 보기]: 처음 범위로
   · 터치(모바일): 두 손가락 벌리기·오므리기로 확대/축소(두 손가락 가운데 기준), 한 손가락 좌우 드래그로 이동, 두 번 탭하면 전체 보기
     한 손가락을 위아래로 움직이면 평소처럼 페이지가 스크롤됨 (touch-action: pan-y)
   · 확대 구간에 보이는 값으로 세로축 범위를 다시 맞춤 (선이 납작해지지 않도록)
   · 가로축이 숫자(linear)인 차트와 날짜 라벨(category)인 차트 모두 지원
════════════════════════════════════════ */
/* 그래프 아래 사용법 안내: 마우스 기기와 터치 기기에 맞는 문장을 각각 보여 줌 (CSS 가 하나만 표시) */
function zpHint() {
  return '<span class="zp-hint zp-mouse">' + L('그래프 위에서 마우스 휠로 확대·축소, 드래그로 이동, 더블클릭으로 전체 보기', 'Scroll to zoom, drag to pan, double-click to reset') + '</span>'
    + '<span class="zp-hint zp-touch">' + L('두 손가락으로 확대·축소, 한 손가락 좌우 드래그로 이동, 두 번 탭하면 전체 보기', 'Pinch to zoom, drag sideways to pan, double-tap to reset') + '</span>';
}
window.chartZoom = (function () {
  function isFull(st) { return st.min <= st.fullMin + 1e-9 && st.max >= st.fullMax - 1e-9; }
  function yRange(st) {
    var ch = st.chart, lo = Infinity, hi = -Infinity;
    ch.data.datasets.forEach(function (ds, i) {
      if (!ch.isDatasetVisible(i)) return;
      var d = ds.data, k, v;
      if (st.cat) {
        for (k = Math.max(0, Math.floor(st.min)); k <= Math.min(d.length - 1, Math.ceil(st.max)); k++) { v = d[k]; if (v != null && isFinite(v)) { if (v < lo) lo = v; if (v > hi) hi = v; } }
      } else {
        for (k = 0; k < d.length; k++) { var p = d[k]; if (p.x >= st.min && p.x <= st.max) { v = p.y; if (v < lo) lo = v; if (v > hi) hi = v; } }
      }
    });
    return lo === Infinity ? null : [lo, hi];
  }
  function apply(st) {
    var ch = st.chart; if (!ch) return;
    var sx = ch.options.scales.x, sy = ch.options.scales.y, full = isFull(st);
    if (full) { st.min = st.fullMin; st.max = st.fullMax; }
    sx.min = st.cat ? Math.round(st.min) : st.min;
    sx.max = st.cat ? Math.round(st.max) : st.max;
    var r = full ? null : yRange(st);
    if (r) {   /* 보이는 값 범위를 1·2·5×10ⁿ 눈금 간격에 맞춰 깔끔한 경계로 */
      var span = (r[1] - r[0]) || Math.abs(r[0]) * 0.1 || 1, raw = span / 5, mag = Math.pow(10, Math.floor(Math.log10(raw)));
      var step = [1, 2, 2.5, 5, 10].map(function (m) { return m * mag; }).find(function (s) { return s >= raw; });
      sy.min = Math.floor((r[0] - span * 0.04) / step) * step; sy.max = Math.ceil((r[1] + span * 0.04) / step) * step;
    }
    else { delete sy.min; delete sy.max; }
    ch.update('none');
    if (st.btn) st.btn.style.display = full ? 'none' : '';
    st.canvas.style.cursor = full ? '' : 'grab';
  }
  function clampShift(st, nmin, span) {
    if (nmin < st.fullMin) nmin = st.fullMin;
    if (nmin + span > st.fullMax) nmin = st.fullMax - span;
    st.min = nmin; st.max = nmin + span;
  }
  function reset(st) { st.min = st.fullMin; st.max = st.fullMax; apply(st); }
  function bind(canvas) {
    if (canvas._zp) return canvas._zp;
    var st = canvas._zp = { canvas: canvas, raf: 0 };
    var btn = st.btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'zp-reset'; btn.textContent = L('전체 보기', 'Reset zoom'); btn.style.display = 'none';
    btn.addEventListener('click', function () { reset(st); });
    canvas.parentNode.appendChild(btn);
    canvas.addEventListener('wheel', function (e) {
      if (!st.chart) return;
      e.preventDefault();                                  /* 그래프 위에서는 페이지 대신 그래프를 확대/축소 */
      var ch = st.chart, a = ch.chartArea, px = Math.min(Math.max(e.offsetX, a.left), a.right);
      var cx = ch.scales.x.getValueForPixel(px), full = st.fullMax - st.fullMin;
      var span = (st.max - st.min) * (e.deltaY < 0 ? 0.8 : 1.25);
      span = Math.max(Math.min(st.minSpan, full), Math.min(full, span));
      var ratio = (cx - st.min) / ((st.max - st.min) || 1);
      clampShift(st, cx - ratio * span, span);
      apply(st);
    }, { passive: false });
    canvas.addEventListener('mousedown', function (e) {
      if (e.button !== 0 || !st.chart || isFull(st)) return;
      st.drag = { x: e.clientX, min: st.min, max: st.max };
      canvas.style.cursor = 'grabbing'; e.preventDefault();
    });
    window.addEventListener('mousemove', function (e) {
      if (!st.drag || !st.chart) return;
      var a = st.chart.chartArea, span = st.drag.max - st.drag.min;
      var dv = (e.clientX - st.drag.x) * span / ((a.right - a.left) || 1);
      clampShift(st, st.drag.min - dv, span);
      if (!st.raf) st.raf = requestAnimationFrame(function () { st.raf = 0; apply(st); });
    });
    window.addEventListener('mouseup', function () { if (st.drag) { st.drag = null; canvas.style.cursor = isFull(st) ? '' : 'grab'; } });
    canvas.addEventListener('dblclick', function () { reset(st); });

    /* ── 터치: 두 손가락 확대·축소 · 한 손가락 좌우 이동 · 두 번 탭 전체 보기 ── */
    canvas.style.touchAction = 'pan-y';                  /* 세로 스크롤은 브라우저, 가로 이동·핀치는 그래프가 처리 */
    var tch = null, lastTap = 0;
    function schedule() { if (!st.raf) st.raf = requestAnimationFrame(function () { st.raf = 0; apply(st); }); }
    function fracAt(clientX) {                           /* 화면 x → 그래프 영역 안 비율 (0~1) */
      var a = st.chart.chartArea, r = canvas.getBoundingClientRect(), w = (a.right - a.left) || 1;
      return (Math.min(Math.max(clientX - r.left, a.left), a.right) - a.left) / w;
    }
    function pinchStart(t) {
      var cx = (t[0].clientX + t[1].clientX) / 2, f = fracAt(cx);
      tch = { mode: 'pinch', d0: Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY) || 1,
              span0: st.max - st.min, anchor: st.min + f * (st.max - st.min) };
    }
    canvas.addEventListener('touchstart', function (e) {
      if (!st.chart) return;
      var t = e.touches;
      if (t.length === 2) { pinchStart(t); e.preventDefault(); }
      else if (t.length === 1) tch = { mode: 'wait', x: t[0].clientX, y: t[0].clientY, min: st.min, max: st.max };
      else tch = null;
    }, { passive: false });
    canvas.addEventListener('touchmove', function (e) {
      if (!tch || !st.chart) return;
      var t = e.touches, a = st.chart.chartArea, w = (a.right - a.left) || 1;
      if (tch.mode === 'pinch') {
        if (t.length !== 2) return;
        e.preventDefault();
        var d = Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY) || 1, full = st.fullMax - st.fullMin;
        var span = Math.max(Math.min(st.minSpan, full), Math.min(full, tch.span0 * tch.d0 / d));
        clampShift(st, tch.anchor - fracAt((t[0].clientX + t[1].clientX) / 2) * span, span);   /* 처음 잡은 지점이 두 손가락 가운데에 머물도록 */
        return schedule();
      }
      if (t.length !== 1) return;
      var dx = t[0].clientX - tch.x, dy = t[0].clientY - tch.y;
      if (tch.mode === 'wait') {
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
        if (Math.abs(dx) > Math.abs(dy) && !isFull(st)) tch.mode = 'pan'; else { tch = null; return; }   /* 세로로 움직이면 페이지 스크롤 */
      }
      e.preventDefault();
      var sp = tch.max - tch.min;
      clampShift(st, tch.min - dx * sp / w, sp);
      schedule();
    }, { passive: false });
    canvas.addEventListener('touchend', function (e) {
      if (!st.chart) return;
      if (tch && tch.mode === 'pinch') {                 /* 한 손가락을 떼면 남은 손가락으로 이어서 이동 */
        tch = e.touches.length === 1 ? { mode: 'pan', x: e.touches[0].clientX, y: e.touches[0].clientY, min: st.min, max: st.max } : null;
        if (st.btn) st.btn.style.display = isFull(st) ? 'none' : '';
        return;
      }
      if (e.touches.length) return;
      var tap = tch && tch.mode === 'wait'; tch = null;
      if (!tap) return;
      var now = Date.now();
      if (now - lastTap < 320) { lastTap = 0; if (!isFull(st)) { e.preventDefault(); reset(st); } }   /* 두 번 탭: 전체 보기 */
      else lastTap = now;
    }, { passive: false });
    canvas.addEventListener('touchcancel', function () { tch = null; });
    return st;
  }
  /* 차트를 새로 만들 때마다 호출: cfg = { min, max, minSpan, category } */
  return { attach: function (canvas, chart, cfg) {
    var st = bind(canvas);
    st.chart = chart; st.cat = !!cfg.category; st.fullMin = cfg.min; st.fullMax = cfg.max; st.minSpan = cfg.minSpan || 1;
    st.min = cfg.min; st.max = cfg.max; st.drag = null;
    if (st.btn) st.btn.style.display = 'none';
    canvas.style.cursor = '';
  } };
})();

/* ════════════════════════════════════════
   [ETF-CAGR] ETF CAGR 비교 (기타 금융 자료)
   데이터: data/etfcagr.json (Actions: 야후 상장 이후 일봉 + 분배금) → 없으면 Yahoo 직접(프록시)
   계산: 기준일 b(MAX=종목 상장일, 그 외=시작일 직전 거래일) 종가 대비 매 거래일 t 의
         CAGR_t = (P_t / P_b)^(365.25 / (t − b)) − 1   · 분배금 포함 시 P 는 재투자 총수익 지수
   표시: 시작 직후 연환산 왜곡을 피해 (기간 길이 × 1/4, 20일~1년) 경과 후부터 그림
════════════════════════════════════════ */
(function () {
  /* 종목 정보 — 각 운용사 공식 페이지 기준 (2026-10 확인, 보수는 순보수) */
  var ETFS = [
    { tk:'QQQ',  lev:1, grp:'ndx',  color:'#3182f6', name:'Invesco QQQ Trust',              issuer:'Invesco',      index:'나스닥 100',                  inc:'1999-03-10', er:'0.18%',  desc:'나스닥에 상장된 금융주를 제외한 시가총액 상위 100개 기업. 2025년 12월 일반 ETF 구조로 전환하며 보수가 0.20%→0.18%로 인하.' },
    { tk:'QLD',  lev:2, grp:'ndx',  color:'#22b8f0', name:'ProShares Ultra QQQ',            issuer:'ProShares',    index:'나스닥 100',                  inc:'2006-06-19', er:'0.95%',  desc:'나스닥 100 지수의 하루 수익률 2배를 목표로 매일 재조정.' },
    { tk:'TQQQ', lev:3, grp:'ndx',  color:'#6366f1', name:'ProShares UltraPro QQQ',         issuer:'ProShares',    index:'나스닥 100',                  inc:'2010-02-09', er:'0.82%',  desc:'나스닥 100 지수의 하루 수익률 3배를 목표로 매일 재조정.' },
    { tk:'SPY',  lev:1, grp:'spx',  color:'#f04452', name:'SPDR S&P 500 ETF Trust',         issuer:'State Street', index:'S&P 500',                     inc:'1993-01-22', er:'0.0945%', desc:'미국 대형주 500개로 구성된 S&P 500을 추종하는 최초의 미국 상장 ETF.' },
    { tk:'SSO',  lev:2, grp:'spx',  color:'#ff8a95', name:'ProShares Ultra S&P500',         issuer:'ProShares',    index:'S&P 500',                     inc:'2006-06-19', er:'0.87%',  desc:'S&P 500의 하루 수익률 2배를 목표로 매일 재조정.' },
    { tk:'UPRO', lev:3, grp:'spx',  color:'#d61f69', name:'ProShares UltraPro S&P500',      issuer:'ProShares',    index:'S&P 500',                     inc:'2009-06-23', er:'0.89%',  desc:'S&P 500의 하루 수익률 3배를 목표로 매일 재조정.' },
    { tk:'SPXL', lev:3, grp:'spx',  color:'#ff6b2c', name:'Direxion Daily S&P 500 Bull 3X', issuer:'Direxion',     index:'S&P 500',                     inc:'2008-11-05', er:'0.84%',  desc:'S&P 500의 하루 수익률 3배를 목표로 매일 재조정 (UPRO와 같은 지수·배율, 운용사만 다름).' },
    { tk:'SOXX', lev:1, grp:'semi', color:'#16b980', name:'iShares Semiconductor ETF',      issuer:'iShares',      index:'NYSE 반도체 지수',             inc:'2001-07-10', er:'0.33%',  desc:'미국 상장 반도체 기업 상위 30개(수정 시가총액 가중). 2021년 필라델피아 반도체지수(SOX)에서 ICE(현 NYSE) 반도체 지수로 변경.' },
    { tk:'USD',  lev:2, grp:'semi', color:'#84cc16', name:'ProShares Ultra Semiconductors', issuer:'ProShares',    index:'다우존스 미국 반도체 지수',      inc:'2007-01-30', er:'0.95%',  desc:'다우존스 미국 반도체 지수(DJUSSC)의 하루 수익률 2배. SOXX·SOXL과 기초지수가 다름.' },
    { tk:'SOXL', lev:3, grp:'semi', color:'#0ea5a4', name:'Direxion Daily Semiconductor Bull 3X', issuer:'Direxion', index:'NYSE 반도체 지수',          inc:'2010-03-11', er:'0.75%',  desc:'SOXX와 같은 NYSE 반도체 지수의 하루 수익률 3배. 2021년 8월 SOX에서 ICE(현 NYSE) 반도체 지수로 변경.' },
    { tk:'ROM',  lev:2, grp:'tech', color:'#a855f7', name:'ProShares Ultra Technology',     issuer:'ProShares',    index:'S&P 기술 섹터 지수',            inc:'2007-01-30', er:'0.95%',  desc:'S&P 500 정보기술 업종(소프트웨어·하드웨어·반도체·IT서비스)으로 구성된 Technology Select Sector Index의 하루 수익률 2배.' },
    { tk:'TECL', lev:3, grp:'tech', color:'#e879f9', name:'Direxion Daily Technology Bull 3X', issuer:'Direxion',  index:'S&P 기술 섹터 지수',            inc:'2008-12-17', er:'0.87%',  desc:'ROM과 같은 Technology Select Sector Index의 하루 수익률 3배.' }
  ];
  var GROUPS = [
    { id:'ndx',  title:'나스닥 100',        sub:'QQQ 1배 · QLD 2배 · TQQQ 3배' },
    { id:'spx',  title:'S&P 500',           sub:'SPY 1배 · SSO 2배 · UPRO·SPXL 3배' },
    { id:'semi', title:'반도체',             sub:'SOXX 1배 · USD 2배 · SOXL 3배 (USD만 기초지수가 다름)' },
    { id:'tech', title:'기술 섹터',          sub:'ROM 2배 · TECL 3배' }
  ];
  /* 영어 페이지(/en/etfcagr/)용 종목 정보 번역 */
  var EC_EN = {"나스닥 100": "Nasdaq-100", "NYSE 반도체 지수": "NYSE Semiconductor Index", "다우존스 미국 반도체 지수": "Dow Jones U.S. Semiconductors Index", "S&P 기술 섹터 지수": "Technology Select Sector Index", "반도체": "Semiconductors", "기술 섹터": "Technology sector", "QQQ 1배 · QLD 2배 · TQQQ 3배": "QQQ 1× · QLD 2× · TQQQ 3×", "SPY 1배 · SSO 2배 · UPRO·SPXL 3배": "SPY 1× · SSO 2× · UPRO·SPXL 3×", "SOXX 1배 · USD 2배 · SOXL 3배 (USD만 기초지수가 다름)": "SOXX 1× · USD 2× · SOXL 3× (only USD tracks a different index)", "ROM 2배 · TECL 3배": "ROM 2× · TECL 3×", "나스닥에 상장된 금융주를 제외한 시가총액 상위 100개 기업. 2025년 12월 일반 ETF 구조로 전환하며 보수가 0.20%→0.18%로 인하.": "The 100 largest non-financial companies on Nasdaq. Converted to a standard ETF structure in December 2025, cutting the fee from 0.20% to 0.18%.", "나스닥 100 지수의 하루 수익률 2배를 목표로 매일 재조정.": "Targets 2× the daily return of the Nasdaq-100, rebalanced daily.", "나스닥 100 지수의 하루 수익률 3배를 목표로 매일 재조정.": "Targets 3× the daily return of the Nasdaq-100, rebalanced daily.", "미국 대형주 500개로 구성된 S&P 500을 추종하는 최초의 미국 상장 ETF.": "The first U.S.-listed ETF, tracking the S&P 500 index of 500 large U.S. companies.", "S&P 500의 하루 수익률 2배를 목표로 매일 재조정.": "Targets 2× the daily return of the S&P 500, rebalanced daily.", "S&P 500의 하루 수익률 3배를 목표로 매일 재조정.": "Targets 3× the daily return of the S&P 500, rebalanced daily.", "S&P 500의 하루 수익률 3배를 목표로 매일 재조정 (UPRO와 같은 지수·배율, 운용사만 다름).": "Targets 3× the daily return of the S&P 500, rebalanced daily (same index and leverage as UPRO, different issuer).", "미국 상장 반도체 기업 상위 30개(수정 시가총액 가중). 2021년 필라델피아 반도체지수(SOX)에서 ICE(현 NYSE) 반도체 지수로 변경.": "The 30 largest U.S.-listed semiconductor companies (modified market-cap weighted). Switched from the PHLX Semiconductor Index (SOX) to the ICE (now NYSE) Semiconductor Index in 2021.", "다우존스 미국 반도체 지수(DJUSSC)의 하루 수익률 2배. SOXX·SOXL과 기초지수가 다름.": "2× the daily return of the Dow Jones U.S. Semiconductors Index (DJUSSC) — a different index from SOXX and SOXL.", "SOXX와 같은 NYSE 반도체 지수의 하루 수익률 3배. 2021년 8월 SOX에서 ICE(현 NYSE) 반도체 지수로 변경.": "3× the daily return of the same NYSE Semiconductor Index as SOXX. Switched from SOX to the ICE (now NYSE) Semiconductor Index in August 2021.", "S&P 500 정보기술 업종(소프트웨어·하드웨어·반도체·IT서비스)으로 구성된 Technology Select Sector Index의 하루 수익률 2배.": "2× the daily return of the Technology Select Sector Index (S&P 500 software, hardware, semiconductors and IT services).", "ROM과 같은 Technology Select Sector Index의 하루 수익률 3배.": "3× the daily return of the same Technology Select Sector Index as ROM."};
  function T(k) { return SITE_EN ? (EC_EN[k] || k) : k; }
  var LINE_W = 1;   /* 모든 종목 같은 굵기의 실선 — 색으로만 구분 */
  var YEARS = { '5Y': 5, '10Y': 10, '15Y': 15 };   /* 5년 미만 CAGR 은 의미가 작아 제공하지 않음 */
  var S = { data: null, src: '', on: {}, period: 'MAX', total: false, from: null, to: null, chart: null, loading: null, cache: {} };
  ETFS.forEach(function (e) { S.on[e.tk] = true; });
  function $(id) { return document.getElementById(id); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function dayStr(d, sep) { var t = new Date(d * 86400000); sep = sep || '-'; return t.getUTCFullYear() + sep + pad(t.getUTCMonth() + 1) + sep + pad(t.getUTCDate()); }
  function strDay(s) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); return m ? Math.floor(Date.UTC(+m[1], +m[2] - 1, +m[3]) / 86400000) : null; }
  function pct(v) { return v == null || !isFinite(v) ? '—' : (v >= 0 ? '+' : '') + v.toFixed(2) + '%'; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function status(m) { var s = $('ec-status'); if (s) { s.textContent = m || ''; s.style.display = m ? 'flex' : 'none'; } }

  /* compact {d0, dd[], c[], div[]} → {days[], px[], tr[]} */
  function expand(o) {
    var days = [o.d0], i;
    for (i = 0; i < o.dd.length; i++) days.push(days[i] + o.dd[i]);
    var px = o.c.slice(), tr = new Array(px.length), dm = {}, dd = [], di = 0;
    (o.div || []).forEach(function (d) { dm[d[0]] = (dm[d[0]] || 0) + d[1]; });
    dd = Object.keys(dm).map(Number).sort(function (a, b) { return a - b; });
    for (i = 0; i < px.length; i++) {
      var dv = 0;
      while (di < dd.length && dd[di] <= days[i]) { if (i > 0) dv += dm[dd[di]]; di++; }
      tr[i] = i === 0 ? px[0] : tr[i - 1] * (px[i] + dv) / px[i - 1];
    }
    return { days: days, px: px, tr: tr };
  }
  async function yahooSeries(tk) {
    /* range=max 는 긴 종목을 월봉으로 돌려주므로 기간을 지정해 일봉을 받음 */
    var r = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/' + tk + '?period1=504921600&period2=' + Math.floor(Date.now() / 1000) + '&interval=1d&events=div');
    var j = await r.json(), res = j.chart.result[0], ts = res.timestamp || [], cl = res.indicators.quote[0].close || [];
    var m = {}, days, ev = res.events && res.events.dividends, div = [];
    ts.forEach(function (t, i) { if (cl[i] > 0) m[Math.floor((t - 4 * 3600) / 86400)] = cl[i]; });
    days = Object.keys(m).map(Number).sort(function (a, b) { return a - b; });
    if (ev) Object.keys(ev).forEach(function (k) { var e = ev[k]; if (e && e.amount > 0) div.push([Math.floor((e.date - 4 * 3600) / 86400), e.amount]); });
    return { d0: days[0], dd: days.slice(1).map(function (d, i) { return d - days[i]; }), c: days.map(function (d) { return m[d]; }), div: div };
  }
  function isDaily(o) {                    /* 거래일 간격 중앙값 ≤ 4일 이면 일봉 */
    if (!o || !o.c || o.c.length < 250 || !o.dd || !o.dd.length) return false;
    var g = o.dd.slice().sort(function (a, b) { return a - b; });
    return g[g.length >> 1] <= 4;
  }
  function withTimeout(p, ms) { return Promise.race([p, new Promise(function (_, rej) { setTimeout(function () { rej(new Error('timeout')); }, ms); })]); }
  /* ① 저장 파일(etfcagr.json)로 바로 그림 → ② 빠진 종목만 야후에서 '동시에' 받아 오는 대로 다시 그림 */
  function load() {
    if (S.loading) return S.loading;
    S.loading = (async function () {
      var raw = null;
      try { var j = window.mdLoad ? await window.mdLoad('etfcagr.json') : null; raw = j && j.series; if (j && j.updated) { S.src = 'Yahoo Finance 일봉 (' + j.updated.slice(0, 10) + ' 갱신)'; S.srcEn = 'Yahoo Finance daily (updated ' + j.updated.slice(0, 10) + ')'; } } catch (e) {}
      var out = {}, missing = [];
      ETFS.forEach(function (e) { var o = raw && raw[e.tk]; if (isDaily(o)) out[e.tk] = expand(o); else missing.push(e.tk); });
      S.data = out; S.missing = missing;
      if (missing.length) {
        S.fetching = Promise.all(missing.map(function (tk) {
          return withTimeout(yahooSeries(tk), 12000).then(function (o) {
            if (isDaily(o)) { S.data[tk] = expand(o); if (!S.src) S.src = 'Yahoo Finance'; S.missing = S.missing.filter(function (x) { return x !== tk; }); render(); }
          }).catch(function () {});
        })).then(function () { S.fetching = null; render(); });
      }
      if (!Object.keys(out).length && !missing.length) { S.loading = null; return false; }
      return true;
    })();
    return S.loading;
  }
  function lastIdxLE(days, d) {           /* d 이하 마지막 인덱스 (없으면 -1) */
    var lo = 0, hi = days.length - 1, r = -1;
    while (lo <= hi) { var m = (lo + hi) >> 1; if (days[m] <= d) { r = m; lo = m + 1; } else hi = m - 1; }
    return r;
  }
  /* 기간 → [시작, 끝] (일수) */
  function windowOf() {
    var last = 0, first = 1e9;
    ETFS.forEach(function (e) { var s = S.data[e.tk]; if (s && S.on[e.tk]) { last = Math.max(last, s.days[s.days.length - 1]); first = Math.min(first, s.days[0]); } });
    if (first === 1e9) ETFS.forEach(function (e) { var s = S.data[e.tk]; if (s) { last = Math.max(last, s.days[s.days.length - 1]); first = Math.min(first, s.days[0]); } });
    if (S.period === 'MAX') return [first, last];
    if (S.period === 'CUSTOM') return [S.from != null ? S.from : first, S.to != null ? Math.min(S.to, last) : last];
    var t = new Date(last * 86400000);
    return [Math.floor(Date.UTC(t.getUTCFullYear() - YEARS[S.period], t.getUTCMonth(), t.getUTCDate()) / 86400000), last];
  }
  function seriesFor(tk, w, minDays) {
    var s = S.data[tk]; if (!s) return null;
    var arr = S.total ? s.tr : s.px, b = lastIdxLE(s.days, w[0]);
    if (b < 0) b = 0;                                     /* 시작일 이후 상장 → 상장일 기준 */
    var e = lastIdxLE(s.days, w[1]); if (e <= b) return null;
    var base = arr[b], bd = s.days[b], pts = [], i, last = null;
    for (i = b + 1; i <= e; i++) {
      var el = s.days[i] - bd; if (el < minDays) continue;
      var v = (Math.pow(arr[i] / base, 365.25 / el) - 1) * 100;
      pts.push({ x: s.days[i], y: +v.toFixed(3) }); last = v;
    }
    return { pts: pts, last: last, baseDay: bd, endDay: s.days[e] };
  }
  function renderChips(vals) {
    var box = $('ec-chips'); if (!box) return;
    box.innerHTML = ETFS.map(function (e) {
      var on = S.on[e.tk], v = vals && vals[e.tk];
      return '<button class="ec-chip' + (on ? '' : ' off') + '" onclick="ecToggle(\'' + e.tk + '\')" title="' + esc(e.name) + '">'
        + '<span class="ec-dot" style="background:' + e.color + '"></span><b>' + e.tk + '</b><span class="ec-lev">' + e.lev + 'x</span>'
        + '<span class="ec-val" style="color:' + e.color + '">' + (on && v ? pct(v.last) : (on && S.data && !S.data[e.tk] ? (S.fetching ? '⏳' : L('자료 없음', 'No data')) : '')) + '</span></button>';
    }).join('');
  }
  function render() {
    if (!S.data || !window.Chart) return;
    var canvas = $('ec-chart'); if (!canvas) return;
    if (!Object.keys(S.data).length) { renderChips(null); status(S.fetching ? L('데이터를 불러오는 중…', 'Loading data…') : L('데이터를 불러오지 못했습니다. 잠시 후 다시 열어 주세요.', 'Could not load data. Please try again later.')); return; }
    var w = windowOf(), span = w[1] - w[0];
    var minDays = Math.round(Math.min(365, Math.max(20, span * 0.25)));
    var vals = {}, ds = [], anyOn = false;
    ETFS.forEach(function (e) {
      if (!S.data[e.tk]) return;
      var r = seriesFor(e.tk, w, minDays); vals[e.tk] = r;
      if (!S.on[e.tk]) return; anyOn = true;
      if (!r || !r.pts.length) return;
      ds.push({ label: e.tk, data: r.pts, borderColor: e.color, backgroundColor: e.color, borderWidth: LINE_W,
                pointRadius: 0, pointHoverRadius: 3, tension: 0, fill: false, parsing: false });
    });
    renderChips(vals);
    var f = $('ec-from'), t = $('ec-to');
    if (f && !f.min) { var w0 = (function () { var p = S.period; S.period = 'MAX'; var x = windowOf(); S.period = p; return x; })(); f.min = t.min = dayStr(w0[0]); f.max = t.max = dayStr(w0[1]); }
    if (S.chart) { S.chart.destroy(); S.chart = null; }
    if (!anyOn) { status(L('표시할 종목을 하나 이상 선택하세요.', 'Select at least one ETF.')); return; }
    if (!ds.length) { status(L('선택한 기간이 너무 짧아 CAGR을 그릴 수 없습니다.', 'The selected period is too short to draw a CAGR.')); return; }
    status('');
    var narrow = (canvas.parentNode.clientWidth || 800) < 520, tick = getComputedStyle(document.documentElement).getPropertyValue('--text3').trim() || '#888';
    var xmin = Infinity, xmax = -Infinity; ds.forEach(function (d) { xmin = Math.min(xmin, d.data[0].x); xmax = Math.max(xmax, d.data[d.data.length - 1].x); });
    S.chart = new Chart(canvas, {
      type: 'line', data: { datasets: ds },
      options: {
        responsive: true, maintainAspectRatio: false, animation: false, parsing: false, normalized: true,
        interaction: { mode: 'nearest', axis: 'x', intersect: false },
        plugins: {
          legend: { display: false },
          decimation: { enabled: true, algorithm: 'lttb', samples: narrow ? 300 : 700 },
          tooltip: { itemSort: function (a, b) { return b.parsed.y - a.parsed.y; },
            callbacks: { title: function (it) { return it.length ? dayStr(it[0].parsed.x, '/') : ''; },
                         label: function (c) { return ' ' + c.dataset.label + '  ' + pct(c.parsed.y); } } }
        },
        scales: {
          x: { type: 'linear', min: xmin, max: xmax, grid: { display: false }, border: { color: fgA(0.25) },
               /* 눈금: 1년 넘는 기간은 매년(또는 2·5·10년 간격) 1월 1일, 짧은 기간은 매월(1·2·3·6개월 간격) 1일 */
               afterBuildTicks: function (ax) {
                 var lo = ax.min, hi = ax.max;   /* 확대·이동 중이면 지금 보이는 범위 */
                 var lim = narrow ? 4 : 7, a = new Date(lo * 86400000), z = new Date(hi * 86400000), out = [], y, m, step;
                 var months = (z.getUTCFullYear() - a.getUTCFullYear()) * 12 + z.getUTCMonth() - a.getUTCMonth();
                 if (months > 24) {
                   step = [1, 2, 5, 10].find(function (s) { return months / 12 / s <= lim; }) || 10;
                   for (y = a.getUTCFullYear() + 1; y <= z.getUTCFullYear(); y++) if (y % step === 0) out.push({ value: Date.UTC(y, 0, 1) / 86400000 });
                 } else {
                   step = [1, 2, 3, 6].find(function (s) { return months / s <= lim; }) || 6;
                   for (m = 1; m <= months; m++) { var d = new Date(Date.UTC(a.getUTCFullYear(), a.getUTCMonth() + m, 1)); if (d.getUTCMonth() % step === 0) out.push({ value: d.getTime() / 86400000 }); }
                 }
                 if (months <= 1) { for (var dd = Math.ceil(lo); dd <= hi; dd++) if (new Date(dd * 86400000).getUTCDay() === 1) out.push({ value: dd }); }   /* 한 달 이하: 매주 월요일 */
                 ax.ticks = out.filter(function (t) { return t.value >= lo && t.value <= hi; });
               },
               ticks: { color: tick, maxRotation: 0, autoSkip: false, font: { size: narrow ? 10 : 11 },
                        callback: function (v) { var s = dayStr(v, '/'); return s.slice(5) === '01/01' ? s.slice(0, 4) : (s.slice(8) === '01' ? s.slice(0, 7) : s.slice(5)); } } },
          y: { position: 'right', border: { display: false },
               grid: { color: function (c) { return c.tick && c.tick.value === 0 ? fgA(0.28) : fgA(0.07); } },
               ticks: { color: tick, maxTicksLimit: 8, font: { size: narrow ? 10 : 11 }, callback: function (v) { return v + '%'; } } }
        }
      }
    });
    window.chartZoom.attach(canvas, S.chart, { min: xmin, max: xmax, minSpan: 30 });
    var note = $('ec-note');
    if (note) note.innerHTML = SITE_EN
      ? zpHint() + '<br>' + (S.period === 'MAX' ? 'From each ETF’s first trading data (just after listing) ' : 'From the last trading day before ' + dayStr(w[0], '/') + ' ') + 'to ' + dayStr(w[1], '/') + ' · drawn after ' + minDays + ' days<br>'
        + (S.total ? 'Total return with distributions reinvested' : 'Price only (excluding distributions)') + ' · the number next to each ETF is the CAGR at the end of the period · Source: ' + (S.srcEn || S.src || 'Yahoo Finance')
      : zpHint() + '<br>' + (S.period === 'MAX' ? '각 종목 첫 거래 데이터(상장 직후)부터 ' : '기간 ' + dayStr(w[0], '/') + ' 직전 거래일부터 ') + dayStr(w[1], '/') + '까지 · 시작 후 ' + minDays + '일 경과 시점부터 표시<br>'
      + (S.total ? '분배금 포함(재투자 가정) 총수익 기준' : '주가 기준(분배금 제외)') + ' · 종목 옆 숫자는 기간 끝 시점의 CAGR · 출처: ' + (S.src || 'Yahoo Finance');
  }
  function setActive(per) { var tabs = $('ec-tabs'); if (tabs) tabs.querySelectorAll('.chart-tab').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-per') === per); }); }
  function renderInfo() {
    var box = $('ec-info-groups'); if (!box || box.childElementCount) return;
    box.innerHTML = GROUPS.map(function (g) {
      return '<div class="ec-group"><p class="ec-group-title">' + esc(T(g.title)) + '<span>' + esc(T(g.sub)) + '</span></p><div class="ec-grid">'
        + ETFS.filter(function (e) { return e.grp === g.id; }).map(function (e) {
          return '<div class="ec-item" style="border-left-color:' + e.color + '"><div class="ec-item-head"><span class="ec-item-tk" style="color:' + e.color + '">' + e.tk + '</span>'
            + '<span class="ec-item-lev">' + (e.lev === 1 ? L('1배 (일반)', '1× (unleveraged)') : L('일일 ' + e.lev + '배 레버리지', e.lev + '× daily leverage')) + '</span></div>'
            + '<p class="ec-item-name">' + esc(e.name) + '</p>'
            + '<div class="ec-item-row">' + L('운용사', 'Issuer') + '<b>' + esc(e.issuer) + '</b></div>'
            + '<div class="ec-item-row">' + L('기초지수', 'Index') + '<b>' + esc(T(e.index)) + '</b></div>'
            + '<div class="ec-item-row">' + L('상장일', 'Inception') + '<b>' + e.inc.replace(/-/g, '.') + '</b></div>'
            + '<div class="ec-item-row">' + L('총보수(순)', 'Net expense ratio') + '<b>' + e.er + '</b></div>'
            + '<p class="ec-item-desc">' + esc(T(e.desc)) + '</p></div>';
        }).join('') + '</div></div>';
    }).join('');
  }

  window.ecRender = function () {
    var pg = $('page-etfcagr'); if (!pg || !pg.classList.contains('active')) return;
    renderInfo();
    if (S.data) { render(); return; }
    renderChips(null); status(L('데이터를 불러오는 중…', 'Loading data…'));
    load().then(function (ok) { if (ok) render(); else { S.data = null; status(L('데이터를 불러오지 못했습니다. 잠시 후 다시 열어 주세요.', 'Could not load data. Please try again later.')); } });
  };
  window.ecToggle = function (tk) { S.on[tk] = !S.on[tk]; render(); };
  window.ecSelectAll = function (on) { ETFS.forEach(function (e) { S.on[e.tk] = on; }); render(); };
  window.ecSetMode = function (total) { S.total = !!total; $('ec-mode-price').classList.toggle('active', !S.total); $('ec-mode-total').classList.toggle('active', S.total); render(); };
  window.ecSetPeriod = function (p) {
    setActive(p); var box = $('ec-custom');
    if (p === 'CUSTOM') {
      if (box) box.style.display = 'flex';
      var f = $('ec-from'), t = $('ec-to');
      if (S.data && f && !f.value) { var w = windowOf(); f.value = dayStr(w[0]); t.value = dayStr(w[1]); }
      S.period = 'CUSTOM'; window.ecApplyCustom(); return;
    }
    if (box) box.style.display = 'none';
    S.period = p; render();
  };
  window.ecApplyCustom = function () {
    var f = strDay(($('ec-from') || {}).value), t = strDay(($('ec-to') || {}).value), err = $('ec-err');
    if (err) err.textContent = '';
    if (f != null && t != null && f >= t) { if (err) err.textContent = L('종료일은 시작일보다 뒤여야 합니다.', 'The end date must be after the start date.'); return; }
    S.from = f; S.to = t; S.period = 'CUSTOM'; render();
  };
})();

/* ════════════════════════════════════════
   [KODEX-CMP] 분배 시뮬레이터 공통 — ETF ↔ 코스피 수익률 비교 (상장 이후)
   대상: KODEX·SOL·TIGER·TIGER배당·TIGER반도체 (KCMP_LIST) — 화면 id 는 '{접두어}kcmp-…'
   데이터: data/compare.json (Actions: 일봉 종가·분배금) → 없으면 Yahoo 직접(프록시)
   기간: 1M·3M·6M·YTD·1Y·MAX·기간설정 — 시작일(포함) 이전 마지막 거래일 종가를 0%로 맞춰 비교
   분배금 포함: 분배락일 종가로 재투자한다고 보고 TR_t = TR_t-1 × (P_t + D_t) / P_t-1
════════════════════════════════════════ */
(function () {
  var BENCH = '^KS11', BENCH_NAME = '코스피';
  var KCMP_LIST = {
    simulator: { page: 'page-simulator', pfx: '',          sym: '498400.KS', name: 'KODEX 200타겟위클리커버드콜' },
    sol:       { page: 'page-sol',       pfx: 'sol-',      sym: '0167B0.KS', name: 'SOL 200타겟위클리커버드콜' },
    tiger:     { page: 'page-tiger',     pfx: 'tiger-',    sym: '0104N0.KS', name: 'TIGER 200타겟위클리커버드콜' },
    tigerdiv:  { page: 'page-tigerdiv',  pfx: 'tigerdiv-', sym: '472150.KS', name: 'TIGER 배당커버드콜액티브' },
    tigersemi: { page: 'page-tigersemi', pfx: 'tigersemi-', sym: '0177R0.KS', name: 'TIGER 반도체TOP10커버드콜액티브' }
  };
  var MONTHS = { '1M': 1, '3M': 3, '6M': 6, '1Y': 12 };
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function dayStr(d, sep) { var t = new Date(d * 86400000); sep = sep || '-'; return t.getUTCFullYear() + sep + pad(t.getUTCMonth() + 1) + sep + pad(t.getUTCDate()); }
  function strDay(s) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); return m ? Math.floor(Date.UTC(+m[1], +m[2] - 1, +m[3]) / 86400000) : null; }
  function kstDay(sec) { return Math.floor((sec + 9 * 3600) / 86400); }
  function pct(v) { return (v >= 0 ? '+' : '') + v.toFixed(2) + '%'; }
  function cssVar(n, f) { var v = getComputedStyle(document.documentElement).getPropertyValue(n).trim(); return v || f; }
  function dedup(p) {
    var m = {}; p.forEach(function (x) { m[x[0]] = x[1]; });
    return Object.keys(m).map(Number).sort(function (a, b) { return a - b; }).map(function (d) { return [d, m[d]]; });
  }
  async function yahooDaily(sym, query) {
    var r = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(sym) + '?' + query);
    var j = await r.json(), res = j.chart.result[0], ts = res.timestamp || [], cl = (res.indicators.quote[0] || {}).close || [];
    var pts = [], dv = [];
    ts.forEach(function (t, i) { if (cl[i] > 0) pts.push([kstDay(t), cl[i]]); });
    var ev = res.events && res.events.dividends;
    if (ev) Object.keys(ev).forEach(function (k) { var e = ev[k]; if (e && e.amount > 0) dv.push([kstDay(e.date), e.amount]); });
    return { pts: dedup(pts), divs: dv.sort(function (a, b) { return a[0] - b[0]; }) };
  }
  function addMonths(day, n) {
    var t = new Date(day * 86400000), y = t.getUTCFullYear(), m = t.getUTCMonth() + n;
    var last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    return Math.floor(Date.UTC(y, m, Math.min(t.getUTCDate(), last)) / 86400000);
  }

  /* ── ETF 하나당 비교 카드 하나 ── */
  function Cmp(key, cfg) {
    var C = { etf: null, bench: null, divs: [], src: '', period: 'MAX', total: false, from: null, to: null, chart: null, loading: null, rows: null };
    function $(id) { return document.getElementById(cfg.pfx + 'kcmp-' + id); }
    function status(msg) { var s = $('status'); if (s) { s.textContent = msg || ''; s.style.display = msg ? 'flex' : 'none'; } }

    function load() {
      if (C.loading) return C.loading;
      C.loading = (async function () {
        try {
          var j = window.mdLoad ? await window.mdLoad('compare.json') : null, s = j && j.series;
          if (s && s[cfg.sym] && s[cfg.sym].length > 5 && s[BENCH] && s[BENCH].length > 5) {
            C.etf = s[cfg.sym]; C.bench = s[BENCH]; C.divs = (j.divs && j.divs[cfg.sym]) || [];
            C.src = '네이버 금융·Yahoo Finance 일봉' + (j.updated ? ' (' + j.updated.slice(0, 10) + ' 갱신)' : '');
            return true;
          }
        } catch (e) {}
        try {                                          /* 대체: Yahoo 직접 */
          var e1 = await yahooDaily(cfg.sym, 'period1=1577836800&period2=' + Math.floor(Date.now() / 1000) + '&interval=1d&events=div');
          if (e1.pts.length < 5) throw new Error('ETF 일봉 없음');
          var b1 = await yahooDaily(BENCH, 'period1=' + ((e1.pts[0][0] - 10) * 86400) + '&period2=' + Math.floor(Date.now() / 1000) + '&interval=1d');
          if (b1.pts.length < 5) throw new Error('코스피 일봉 없음');
          C.etf = e1.pts; C.bench = b1.pts; C.divs = e1.divs; C.src = 'Yahoo Finance';
          return true;
        } catch (e) { C.loading = null; return false; }
      })();
      return C.loading;
    }
    /* 기준축 = ETF 거래일, 코스피는 같은 날(휴장 차이면 직전) 종가 */
    function build() {
      var etf = C.etf, b = C.bench, bi = 0, bv = null, out = [], tr = 0, prev = 0, di = 0;
      var dm = {}; (C.divs || []).forEach(function (d) { dm[d[0]] = (dm[d[0]] || 0) + d[1]; });
      var dd = Object.keys(dm).map(Number).sort(function (x, y) { return x - y; });
      for (var i = 0; i < etf.length; i++) {
        var d = etf[i][0], p = etf[i][1], dv = 0;
        while (bi < b.length && b[bi][0] <= d) { bv = b[bi][1]; bi++; }
        while (di < dd.length && dd[di] <= d) { if (i > 0) dv += dm[dd[di]]; di++; }   /* 휴장일 분배락 → 다음 거래일 */
        tr = i === 0 ? p : tr * (p + dv) / prev;
        prev = p;
        if (bv != null) out.push({ d: d, p: p, tr: tr, b: bv });
      }
      return out;
    }
    /* 선택 기간 → [기준 인덱스, 끝 인덱스] */
    function span(rows) {
      var first = rows[0].d, last = rows[rows.length - 1].d, start = first, end = last, i;
      if (C.period === 'YTD') start = Math.floor(Date.UTC(new Date(last * 86400000).getUTCFullYear(), 0, 1) / 86400000) - 1;
      else if (C.period === 'CUSTOM') { start = C.from != null ? C.from : first; end = C.to != null ? C.to : last; }
      else if (MONTHS[C.period]) start = addMonths(last, -MONTHS[C.period]);
      var s = 0, e = rows.length - 1;
      for (i = 0; i < rows.length && rows[i].d <= start; i++) s = i;
      while (e > s && rows[e].d > end) e--;
      return [s, e];
    }
    function setVals(v) {
      var a = $('ret-etf'), b = $('ret-bench'), c = $('ret-diff');
      if (!a) return;
      if (!v) { a.textContent = b.textContent = c.textContent = '—'; return; }
      a.textContent = pct(v[0]); b.textContent = pct(v[1]);
      var df = v[0] - v[1]; c.textContent = (df >= 0 ? '+' : '') + df.toFixed(2) + '%p';
    }
    function setActive(kind, val) {
      if (kind === 'mode') { var p = $('mode-price'), t = $('mode-total'); if (p) p.classList.toggle('active', val === 'price'); if (t) t.classList.toggle('active', val === 'total'); }
      else { var tabs = $('tabs'); if (tabs) tabs.querySelectorAll('.chart-tab').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-per') === val); }); }
    }
    function render() {
      if (!C.etf) return;
      var canvas = $('chart'); if (!canvas || !window.Chart) return;
      if (!C.rows) C.rows = build();
      var rows = C.rows;
      if (rows.length < 2) { status('비교할 데이터가 부족합니다.'); return; }
      var hasDiv = C.divs && C.divs.length > 0, tb = $('mode-total');
      if (tb) { tb.disabled = !hasDiv; tb.style.opacity = hasDiv ? '' : '0.4'; tb.title = hasDiv ? '' : '분배금 자료가 아직 없습니다'; }
      if (!hasDiv && C.total) { C.total = false; setActive('mode', 'price'); }
      var f = $('from'), t = $('to');
      if (f && !f.min) { f.min = t.min = dayStr(rows[0].d); f.max = t.max = dayStr(rows[rows.length - 1].d); }
      var se = span(rows), seg = rows.slice(se[0], se[1] + 1);
      if (seg.length < 2) { status('선택한 기간에 비교할 거래일이 부족합니다.'); if (C.chart) { C.chart.destroy(); C.chart = null; } setVals(null); return; }
      status('');
      var k = C.total ? 'tr' : 'p', e0 = seg[0][k], b0 = seg[0].b;
      var labels = seg.map(function (x) { return dayStr(x.d, '/'); });
      var de = seg.map(function (x) { return +((x[k] / e0 - 1) * 100).toFixed(2); });
      var db = seg.map(function (x) { return +((x.b / b0 - 1) * 100).toFixed(2); });
      setVals([de[de.length - 1], db[db.length - 1]]);
      var narrow = (canvas.parentNode.clientWidth || 600) < 500;
      var red = cssVar('--accent2', '#f04452'), blue = cssVar('--accent', '#3182f6'), tick = cssVar('--text3', '#888');
      var ds = [
        { label: cfg.name, data: de, borderColor: red, backgroundColor: red },
        { label: BENCH_NAME, data: db, borderColor: blue, backgroundColor: blue }
      ].map(function (d) { return Object.assign(d, { borderWidth: 1, pointRadius: 0, pointHoverRadius: 3, tension: 0, fill: false }); });
      var opts = {
        responsive: true, maintainAspectRatio: false, animation: false,
        interaction: { mode: 'index', intersect: false },
        plugins: { legend: { display: false },
          tooltip: { callbacks: { label: function (c) { return ' ' + c.dataset.label + '  ' + pct(c.parsed.y); } } } },
        scales: {
          x: { grid: { display: false }, border: { color: fgA(0.25) },
               ticks: { color: tick, maxRotation: 0, autoSkip: true, autoSkipPadding: 16, maxTicksLimit: narrow ? 3 : 4, font: { size: narrow ? 10 : 11 } } },
          y: { position: 'right', border: { display: false },
               grid: { color: function (c) { return c.tick && c.tick.value === 0 ? fgA(0.28) : fgA(0.07); } },
               ticks: { color: tick, maxTicksLimit: 7, font: { size: narrow ? 10 : 11 }, callback: function (v) { return v + '%'; } } }
        }
      };
      if (C.chart) C.chart.destroy();
      C.chart = new Chart(canvas, { type: 'line', data: { labels: labels, datasets: ds }, options: opts });
      window.chartZoom.attach(canvas, C.chart, { min: 0, max: labels.length - 1, minSpan: Math.min(10, labels.length - 1), category: true });
      var note = $('note');
      if (note) note.innerHTML = zpHint() + '<br>기간 ' + labels[0] + ' ~ ' + labels[labels.length - 1] + ' (' + labels[0] + ' 종가 = 0%)<br>'
        + (C.total ? '분배금 포함: 분배락일 종가로 분배금을 재투자했다고 가정한 총수익률' : '주가 수익률 (분배금 제외)')
        + ' · 코스피는 지수 수익률 · 출처: ' + C.src;
    }
    return {
      show: function () {
        var pg = document.getElementById(cfg.page);
        if (!pg || !pg.classList.contains('active') || !$('chart')) return;
        if (C.etf) { render(); return; }
        status('비교 데이터를 불러오는 중…');
        load().then(function (ok) {
          if (ok) render();
          else status('비교 데이터를 불러오지 못했습니다. 잠시 후 다시 열어 주세요.');
        });
      },
      setPeriod: function (p) {
        setActive('period', p);
        var box = $('custom');
        if (p === 'CUSTOM') {
          if (box) box.style.display = 'flex';
          if (C.rows && C.rows.length) {                       /* 처음 열 때 현재 표시 기간으로 채움 */
            var f = $('from'), t = $('to');
            if (f && !f.value) { var se = span(C.rows); f.value = dayStr(C.rows[se[0]].d); t.value = dayStr(C.rows[se[1]].d); }
          }
          C.period = 'CUSTOM'; this.applyCustom(); return;
        }
        if (box) box.style.display = 'none';
        C.period = p; render();
      },
      applyCustom: function () {
        var f = strDay(($('from') || {}).value), t = strDay(($('to') || {}).value), err = $('err');
        if (err) err.textContent = '';
        if (f != null && t != null && f >= t) { if (err) err.textContent = L('종료일은 시작일보다 뒤여야 합니다.', 'The end date must be after the start date.'); return; }
        C.from = f; C.to = t; C.period = 'CUSTOM'; render();
      },
      setMode: function (total) {
        if (total && !(C.divs && C.divs.length)) return;
        C.total = !!total; setActive('mode', total ? 'total' : 'price'); render();
      }
    };
  }

  var CMP = {};
  Object.keys(KCMP_LIST).forEach(function (k) { CMP[k] = Cmp(k, KCMP_LIST[k]); });
  /* key 생략 시: 지금 열린 시뮬레이터 페이지의 차트를 (다시) 그림 — 탭 전환·테마 변경 때 호출 */
  window.kcmpRender = function (key) {
    if (key) { if (CMP[key]) CMP[key].show(); return; }
    Object.keys(CMP).forEach(function (k) { CMP[k].show(); });
  };
  window.kcmpSetPeriod = function (key, p) { if (CMP[key]) CMP[key].setPeriod(p); };
  window.kcmpApplyCustom = function (key) { if (CMP[key]) CMP[key].applyCustom(); };
  window.kcmpSetMode = function (key, total) { if (CMP[key]) CMP[key].setMode(total); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(window.kcmpRender, 0); });
  else setTimeout(window.kcmpRender, 0);
})();

/* ════════════════════════════════════════
   [SOL] SOL 200타겟위클리커버드콜 (0167B0.KS)
   운용수수료 0.3%, 콜옵션 13%, 배당금 2%
════════════════════════════════════════ */
(function() {
  // SOL 상태
  const S = window._solState = {
    investMode: 'reinvest',
    dcaOn:    false,
    taxOn:    true,
    kodexOn:  true,
    taxMode:     'manual',
    bracketType: 'separate',
  };

  // DOM 헬퍼
  function $id(id)       { return document.getElementById('sol-' + id); }
  function getV(id)      { const el=$id(id); return el ? parseFloat(el.value.replace(/,/g,''))||0 : 0; }

  /* 단위 인식 값 읽기/쓰기 헬퍼 */
  function getVWon(fieldId) { return simReadWon('page-sol', fieldId.replace('ni-', '')); }  /* → [SIM-UNIT] */
  function setDispFromWon(fieldId, won) { simWriteWon('page-sol', fieldId.replace('ni-', ''), won); }
  function fmt(n)        { return Math.round(n).toLocaleString('ko-KR'); }

  // ── 현재가 조회 ──────────────────────────
  let _fetching = false;
  window.solFetchPrice = async function() {
    if (_fetching) return;
    _fetching = true;
    const btn  = $id('kodex-refresh-btn');
    const icon = $id('kodex-refresh-icon');
    const de   = $id('kodex-price-date');
    if (btn)  btn.disabled = true;
    if (icon) icon.textContent = '⏳';
    if (de)   de.textContent = '조회 중...';
    try {
      
      // Yahoo Finance
      const yf = 'https://query1.finance.yahoo.com/v8/finance/chart/0167B0.KS?interval=1d&range=5d';
      for (const pu of ['https://corsproxy.io/?'+encodeURIComponent(yf),'https://api.allorigins.win/get?url='+encodeURIComponent(yf)]) {
        try {
          const r = await fetch(pu, {cache:'no-cache'});
          if (!r.ok) continue;
          let txt = await r.text();
          try { const w=JSON.parse(txt); if(w.contents) txt=w.contents; } catch {}
          const j = JSON.parse(txt);
          const m = j?.chart?.result?.[0]?.meta;
          const p = m?.regularMarketPrice || m?.previousClose;
          if (p) { applyPrice(p, 'Yahoo Finance'); return; }
        } catch {}
      }
      if (de) de.textContent = '조회 실패 — ↺ 재시도';
    } finally {
      _fetching = false;
      if (btn)  btn.disabled = false;
      if (icon) icon.textContent = '↺';
    }
  };

  function applyPrice(price, src) {
    price = parseFloat(price);
    if (!price || price < 1000 || price > 200000) return;
    const el = $id('kodex-price-val');
    if (el) el.textContent = price.toLocaleString('ko-KR');
    const now = new Date();
    const ns  = now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0')+'-'
               +String(now.getDate()).padStart(2,'0')+' '+now.toTimeString().slice(0,8);
    const de  = $id('kodex-price-date');
    const se  = $id('kodex-price-src');
    if (de) de.textContent = ns + ' 기준';
    if (se) se.textContent = '출처: ' + src + ' (0167B0.KS)';
    solUpdate();
  }

  // ── 계산 ──────────────────────────────────

  function solUpdateBracketUI() {
    if (!S.taxOn || S.taxMode !== 'bracket') return;

    var otherIncome = getVWon('ni-otherincome');
    var amount  = getVWon('ni-amount');
    var ratePct = (!isNaN(getV('ni-rate')) && getV('ni-rate') !== null) ? getV('ni-rate') : 15;
    var monthly = S.dcaOn ? getVWon('ni-monthly') : 0;

    /* ── 1년차 총 분배금 추정 ── */
    var mRate = (ratePct / 100) / 12;
    var port = amount, est1stTotal = 0;
    for (var mi = 0; mi < 12; mi++) { port += monthly; est1stTotal += port * mRate; }

    /* ── 과세 비율: SOL 비과세 구조 ON이면 배당 부분만 과세 ── */
    var taxRatio = 1; /* 기본: 전액 과세 */
    if (S.kodexOn) {
      var cpPct = getV('ni-calloption') || 13;
      var dpPct = getV('ni-divportion') || 2;
      var tot = cpPct + dpPct;
      if (tot > 0) taxRatio = dpPct / tot; /* 예: 2/15 */
    }
    var est1stDiv = est1stTotal * taxRatio; /* 과세 대상 금액 */

    /* ── 세금 계산: 과세표준에 따른 실제 세금 ── */
    function solCalcTax(taxableDiv) {
      if (S.bracketType === 'separate') return taxableDiv * 0.154;
      var THRESHOLD = 20000000;
      if (taxableDiv <= THRESHOLD) return taxableDiv * 0.154;
      var baseTax = THRESHOLD * 0.154;
      var excess  = taxableDiv - THRESHOLD;
      var taxOther = calcProgressiveTax(otherIncome);
      var rawTax = baseTax + (calcProgressiveTax(otherIncome + excess) - taxOther);
      return Math.min(rawTax, taxableDiv * 0.495);
    }

    /* ── bracket-table 구간 하이라이트 + eff-rate 셀 ──
       각 구간의 실효세율 = 세금(과세금액) / 전체분배금
       과세금액이 midBase인 경우 전체 분배금 = midBase / taxRatio                */
    var THRESHOLD = 20000000;
    var excessBase = (S.bracketType === 'comprehensive' && est1stDiv > THRESHOLD)
      ? otherIncome + (est1stDiv - THRESHOLD) : 0;

    var tbl = $id('bracket-table');
    if (tbl) {
      tbl.querySelectorAll('tbody tr').forEach(function(tr) {
        var maxVal = tr.dataset.max === 'Infinity' ? Infinity : parseFloat(tr.dataset.max);
        var prev   = tr.previousElementSibling;
        var minVal = prev ? parseFloat(prev.dataset.max) : 0;
        tr.classList.toggle('bracket-active',
          S.bracketType === 'comprehensive' && excessBase > minVal && excessBase <= maxVal);
        var midBase  = maxVal === Infinity ? (minVal + 2e8) : (minVal + maxVal) / 2;
        /* midBase = 이 구간 중간의 과세금액. 전체분배금 = midBase/taxRatio */
        var taxAtMid   = solCalcTax(THRESHOLD + midBase);
        var totalAtMid = taxRatio > 0 ? (THRESHOLD + midBase) / taxRatio : (THRESHOLD + midBase);
        var effAtMid   = totalAtMid > 0 ? taxAtMid / totalAtMid : 0;
        var effCell = tr.querySelector('.eff-rate');
        if (effCell) effCell.textContent = fmtRate(effAtMid * 100) + '%';
      });
    }

    /* ── 1년차 실효세율 = 세금 / 전체 분배금 ── */
    var tax1st      = solCalcTax(est1stDiv);
    var eff1st      = est1stTotal > 0 ? tax1st / est1stTotal : 0;
    var displayRate = fmtRate(eff1st * 100);

    var effEl = $id('bracket-eff-rate');
    if (effEl) effEl.textContent = displayRate + '%';
    var ni = $id('ni-tax');
    var sl = $id('sl-tax');
    if (ni) ni.value = displayRate;
    if (sl) sl.value = Math.min(eff1st * 100, 49.5);

    /* ── 전체 대비 실효세율도 kodex-eff-rate에 표시 ── */
    var tp0 = (getV('ni-calloption') || 13) + (getV('ni-divportion') || 2);
    var effPct0 = tp0 > 0 ? fmtRate(eff1st * 100) : '0.00';
    setT('kodex-eff-rate', effPct0 + '%');
    return eff1st;  /* solUpdate에서 DOM 경유 없이 직접 사용 */
  }

  window.solOnKodexRatioChange = function() {
    solUpdate();
  };
  window.solUpdate = function() {
    const rate0  = ((!isNaN(getV('ni-rate')) && getV('ni-rate') !== null) ? getV('ni-rate') : 15) / 100;
    /* 운용보수는 ETF 순자산에서 매일 빠져 주가(연간 주가 변동률)에 반영되므로 분배율에서 따로 빼지 않음 — 5개 시뮬레이터 공통 */
    const rate   = Math.max(0, rate0);
        const amount = getVWon('ni-amount');
    const _monthlyCheck = S.dcaOn ? getVWon('ni-monthly') : 0;
    if (amount === 0 && _monthlyCheck === 0) {
      [$id('s-annual'),$id('s-weekly'),$id('s-final'),$id('s-total'),$id('s-port')]
        .forEach(e => { if(e) e.textContent='0원'; });
      [$id('s-final-sub'),$id('s-total-sub'),$id('s-port-sub'),$id('target-sub')]
        .forEach(e => { if(e) e.textContent=''; });
      /* 상세 내역 tbody 초기화 */
      var _tb = $id('monthlyTableBody') || document.getElementById('monthlyTableBody');
      if (_tb) _tb.innerHTML = '';
      _solCache = null;
      return;
    }
    const years  = Math.round(getV('ni-years')) || 10;
    const growth = (getV('ni-growth') || 0) / 100;
    const monthly= S.dcaOn ? getVWon('ni-monthly') : 0;
    /* ── 과세 비율 및 실효세율 계산 ── */
    let cpPct = 0, dpPct = 0, taxRatio = 1;
    if (S.kodexOn) {
      cpPct = getV('ni-calloption') || 13;
      dpPct = getV('ni-divportion') || 2;
      taxRatio = (cpPct + dpPct) > 0 ? dpPct / (cpPct + dpPct) : 1;
    }

    let effTax;
    if (S.taxOn && S.taxMode === 'bracket') {
      /* bracket 모드: 직접 계산 (solUpdateBracketUI와 독립적) */
      const _rate_pct = (!isNaN(getV('ni-rate')) && getV('ni-rate') !== null) ? getV('ni-rate') : 15;
      const _amt = getVWon('ni-amount');
      const _mR = (_rate_pct / 100) / 12;
      let _est = 0;
      for (let _i = 0; _i < 12; _i++) _est += _amt * _mR;
      const _taxable = _est * taxRatio;
      const _T = 20000000;
      let _tax;
      if (S.bracketType !== 'comprehensive') {
        _tax = _taxable * 0.154;
      } else {
        const _oi = getVWon('ni-otherincome');
        _tax = (_taxable <= _T)
          ? _taxable * 0.154
          : _T * 0.154 + (calcProgressiveTax(_oi + _taxable - _T) - calcProgressiveTax(_oi));
      }
      effTax = _est > 0 ? _tax / _est : 0;
      /* bracket UI 갱신 (계산과 분리) */
      try { solUpdateBracketUI(); } catch(e) {}
    } else if (S.taxOn) {
      /* manual 모드 */
      const _manualRate = (getV('ni-tax') || 15.4) / 100;
      effTax = S.kodexOn ? _manualRate * taxRatio : _manualRate;
    } else {
      effTax = 0;
    }
    const taxRate = effTax;
    const keepRate = 1 - effTax;
    const mRate    = rate / 12;
    const mGrow    = Math.pow(1 + growth, 1/12) - 1;

    let port = amount, totDiv = 0, totTax = 0, totInvest = amount, rows = [];
    for (let y = 1; y <= years; y++) {
      let yDiv=0, yDivG=0, yTax=0, yDeposit=0, portStart=port;
      let mDivs=[], mPorts=[], mDeposits=[], mPortsAfter=[], mPortsEnd=[];
      for (let m = 0; m < 12; m++) {
        mPorts.push(Math.round(port));
        const dep = monthly > 0 ? monthly : 0;
        if (dep > 0) { port += dep; yDeposit += dep; totInvest += dep; }
        mDeposits.push(dep);
        mPortsAfter.push(Math.round(port));
        const dG = port * mRate;
        const dT = dG * effTax;
        const dN = dG - dT;
        mDivs.push(Math.round(dN));
        yDiv += dN; yDivG += dG; yTax += dT; totDiv += dN; totTax += dT;
        if (S.investMode === 'reinvest')       port = (port + dN) * (1 + mGrow);
        else if (S.investMode === 'partial') {
          const pr = (parseFloat(($id('ni-partial')||{}).value)||50)/100;
          port = (port + dN*pr) * (1 + mGrow);
        } else                                port = port * (1 + mGrow);
        mPortsEnd.push(Math.round(port));
      }
      const m1st    = Math.round(portStart * mRate * keepRate);
      const weekDiv = Math.round(portStart * (rate/52) * keepRate);
      // 과세표준 계산
      let taxBase = yDivG;
      if (S.kodexOn) {
        const tp = cpPct + dpPct;
        taxBase = tp > 0 ? yDivG * (dpPct/tp) : 0;
      }
      rows.push({ y, port:Math.round(port), portStart:Math.round(portStart),
        div:Math.round(yDiv), divG:Math.round(yDivG), tax:Math.round(yTax),
        taxBase:Math.round(taxBase), deposit:Math.round(yDeposit),
        m1st, weekDiv, mDivs, mPorts, mDeposits, mPortsAfter, mPortsEnd,
        total: Math.round(totDiv) });
    }

    const r1=rows[0]||{}, rN=rows[rows.length-1]||{};
    const cagr = (simAssetCagr(amount, monthly, years, rN.port) || 0) * 100;   /* 적립 시 납입 시점 반영(IRR) — 5개 시뮬레이터 공통 */
    const cagrMon = Math.pow(1+cagr/100, 1/12) - 1;
    function setT(id,v){ const el=$id(id); if(el) el.textContent=v; }
    /* 요약 바 라벨: KODEX 페이지와 같이 세금 적용 시 (세후) 표시 */
    { const _sl = id => { const v=$id(id); return v && v.parentElement ? v.parentElement.querySelector('.sum-cell-label') : null; };
      const _sumLbl1=_sl('s-annual'), _sumLbl3=_sl('s-total');
      if (_sumLbl1) _sumLbl1.textContent='1년차 연간 분배금'+(S.taxOn?' (세후)':'');
      if (_sumLbl3) _sumLbl3.textContent='누적 수령 분배금'+(S.taxOn?' (세후)':''); }

    // ── 요약바 ─────────────────────────────
    setT('s-annual',     fmt(r1.div)+'원');
    setT('s-weekly',     '월간 ' + fmt(r1.mDivs ? r1.mDivs[11] : r1.m1st)+'원');
    setT('s-label2',     years + '년차 연간 분배금' + (S.taxOn?' (세후)':''));
    setT('s-final',      fmt(rN.div)+'원');
    setT('s-final-sub',  '월간 ' + fmt(rN.mDivs ? rN.mDivs[11] : rN.m1st)+'원');
    setT('s-total',      fmt(totDiv)+'원');
    setT('s-total-sub',  '수익률 ' + ((totDiv/totInvest)*100).toFixed(1) + '%');
    setT('s-port-label', years + '년차 종료 자산');
    setT('s-port',       fmt(rN.port)+'원');
    setT('s-port-sub',   '총 투입 ' + fmt(totInvest)+'원' + ' 대비');
    const cagrEl = $id('s-cagr');
    if (cagrEl) { cagrEl.textContent = (cagr>=0?'+':'') + cagr.toFixed(2) + '%'; cagrEl.className = 'sum-cell-val'; }
    setT('s-cagr-sub',   '월 평균 ' + (cagrMon>=0?'+':'') + (cagrMon*100).toFixed(3) + '%');

    // ── 역산 ───────────────────────────────
    const targetV = getVWon('ni-target');
    if (targetV > 0) {
      setT('target-result', fmt((targetV * 12) / rate)+'원');
      setT('target-sub',    '분배율 ' + (rate0*100).toFixed(1) + '% 기준');
    }

    // ── DCA 연간 레이블 ──────────────────────
    setT('dca-annual-label', fmt(getVWon('ni-monthly')*12)+'원' + ' / 년');

    // ── 세금 요약 ───────────────────────────
    if (S.taxOn) {
      setT('tax-first-label', fmt(rows[0].tax)+'원');
      setT('tax-total-label', fmt(Math.round(totTax))+'원');
    }

    // ── KODEX 과세구조 실효세율 표시 ──────────
    if (S.kodexOn) {
      const tp = cpPct + dpPct;
      const effPct = tp > 0 ? (effTax * 100).toFixed(2) : '0.00';
      setT('kodex-eff-rate',     effPct + '%');
      setT('kodex-total-rate',   tp.toFixed(1) + '%');
      setT('kodex-taxbase-label', fmt(Math.round(rows[0].taxBase))+'원');
    }

    // ── 연간 테이블 헤더 ─────────────────────
    const thTaxbase = $id('th-taxbase'), thTax = $id('th-tax'), thDeposit = $id('th-deposit');
    if (thTaxbase) thTaxbase.style.display = S.taxOn ? '' : 'none';
    if (thTax)     thTax.style.display     = S.taxOn ? '' : 'none';
    if (thDeposit) thDeposit.style.display = S.dcaOn ? '' : 'none';
    const thDiv = $id('th-div');
    if (thDiv) thDiv.textContent   = S.taxOn ? '연간 분배금 (세후)' : '연간 분배금';

    // ── 연간 테이블 행 ───────────────────────
    const tbody = $id('tableBody');
    if (tbody) {
      tbody.innerHTML = '';
      rows.forEach((r, i) => {
        const tr = document.createElement('tr');
        if (i === rows.length-1) tr.classList.add('highlight');
        tr.innerHTML =
          '<td>'+r.y+'년차</td>' +
          '<td>'+fmt(r.port)+'</td>' +
          (S.dcaOn ? '<td>'+(r.deposit>0?fmt(r.deposit):'<span style="color:var(--text3)">—</span>')+'</td>' : '') +
          '<td>'+fmt(r.div)+'</td>' +
          (S.taxOn ? '<td style="color:#fe9800;">'+fmt(r.taxBase)+'</td>' : '') +
          (S.taxOn ? '<td style="color:#f04452;">'+fmt(r.tax)+'</td>' : '') +
          '<td>'+fmt(r.total)+'</td>';
        tbody.appendChild(tr);
      });
    }

    // ── 차트 ─────────────────────────────────
    renderSolChart(rows, years, rate, keepRate);
    // 월간 상세 내역 탭이 열려있으면 갱신
    const dmEl = $id('detail-monthly');
    if (dmEl && dmEl.style.display !== 'none') renderSolMonthlyTable({ rows, years, rate: rate });
  };

  // ── 차트 ──────────────────────────────────
  let _chart = null;
  let _solChartTab = 'annual';
  let _solCache = null;

  function renderSolChart(rows, years, rate, keepRate) {
    _solCache = { rows, years, rate, keepRate };
    const canvas = $id('mainChart');
    if (!canvas) return;

    // 범례
    const legLabel = $id('leg-div-label');
    if (legLabel) legLabel.textContent = _solChartTab === 'annual' ? '연간 분배금' : '월간 분배금';
    const legPort = $id('leg-port');
    if (legPort) legPort.style.display = 'none';

    let labels, datasets, type, opts;

    if (_solChartTab === 'annual') {
      labels   = rows.map(r => r.y + '년');
      datasets = [{ label:'연간 분배금', data: rows.map(r=>r.div),
        backgroundColor:'rgba(49,130,246,0.7)', borderRadius:5, borderSkipped:false }];
      type = 'bar';
      opts = buildOpts(true, false, false);
    } else {
      const monthLabels = [], monthData = [];
      for (let y = 0; y < years; y++) {
        for (let m = 0; m < 12; m++) {
          monthLabels.push(m === 0 ? (y+1)+'년차' : '');
          monthData.push(rows[y].mDivs[m]);
        }
      }
      datasets = [{ label:'월간 분배금', data: monthData,
        borderColor:'#3182f6', backgroundColor:'rgba(49,130,246,0.12)',
        fill:true, pointRadius:0, pointHoverRadius:4, borderWidth:2, tension:0.2 }];
      labels = monthLabels;
      type = 'line';
      opts = buildOpts(false, false, true);
    }

    if (_chart) _chart.destroy();
    _chart = new Chart(canvas, { type, data:{ labels, datasets }, options: opts });
  }

  // ── 토글 / 모드 ────────────────────────────
  window.solSetMode = function(m, btn) {
    S.investMode = m;
    const pg = document.getElementById('page-sol');
    if (pg) pg.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const pb = $id('partial-ratio-block');
    if (pb) pb.style.display = m==='partial' ? 'block' : 'none';
    solUpdate();
  };
  window.solSyncPartial = function() {
    const ni=$id('ni-partial'), sl=$id('sl-partial');
    if (sl && ni) sl.value = ni.value;
    const d=$id('partial-desc'); if(d) d.textContent='분배금의 '+ni.value+'%는 재투자, '+(100-ni.value)+'%는 수령';
    solUpdate();
  };
  window.solToggleDCA = function() {
    S.dcaOn = !S.dcaOn;
    const sw=$id('dca-switch'), bl=$id('dca-block');
    if (sw) sw.classList.toggle('on', S.dcaOn);
    if (bl) { bl.style.opacity=S.dcaOn?'1':'0.3'; bl.style.pointerEvents=S.dcaOn?'auto':'none'; }
    const off=$id('dca-off-label'), on=$id('dca-on-label');
    if (off) off.style.color = S.dcaOn?'var(--text3)':'var(--text2)';
    if (on)  on.style.color  = S.dcaOn?'var(--accent)':'var(--text3)';
    solUpdate();
  };
  window.solToggleTax = function() {
    S.taxOn = !S.taxOn;
    const sw=$id('tax-switch'), bl=$id('tax-block');
    if (sw) sw.classList.toggle('on', S.taxOn);
    if (bl) { bl.style.opacity=S.taxOn?'1':'0.3'; bl.style.pointerEvents=S.taxOn?'auto':'none'; }
    const off=$id('tax-off-label'), on=$id('tax-on-label');
    if (off) off.style.color = S.taxOn?'var(--text3)':'var(--text2)';
    if (on)  on.style.color  = S.taxOn?'var(--accent)':'var(--text3)';
    solUpdate();
  };
  window.solToggleKodex = function() {
    S.kodexOn = !S.kodexOn;
    const sw=$id('kodex-switch'), bl=$id('kodex-block');
    if (sw) sw.classList.toggle('on', S.kodexOn);
    if (bl) { bl.style.opacity=S.kodexOn?'1':'0.3'; bl.style.pointerEvents=S.kodexOn?'auto':'none'; }
    const off=$id('kodex-off-label'), on=$id('kodex-on-label');
    if (off) off.style.color = S.kodexOn?'var(--text3)':'var(--text2)';
    if (on)  on.style.color  = S.kodexOn?'var(--accent)':'var(--text3)';
    solUpdate();
  };

  // ── 세금 모드 ─────────────────────────────
  window.solSetTaxMode = function(mode, btn) {
    S.taxMode = mode;
    const ni=$id('ni-tax'), sl=$id('sl-tax');
    if (!ni||!sl) return;
    if (mode==='manual') {
      ni.value = ni.dataset.manual || '15.4';
      sl.value = Math.min(parseFloat(ni.value)||15.4, 49.5);
    } else {
      ni.dataset.manual = ni.value;
    }
    const pg = document.getElementById('page-sol');
    if (pg) pg.querySelectorAll('.tax-mode-tab').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    const mp=$id('tax-panel-manual'), bp=$id('tax-panel-bracket');
    if (mp) mp.style.display = mode==='manual'?'':'none';
    if (bp) bp.style.display = mode==='bracket'?'':'none';
    /* bracket 모드에서 슬라이더·입력란 dimming */
    var niTax = $id('ni-tax');
    var slTax = $id('sl-tax');
    if (niTax && slTax) {
      var sliderHdr = niTax.closest('.slider-header');
      var dim = (mode === 'bracket');
      if (sliderHdr) {
        sliderHdr.style.opacity      = dim ? '0.4' : '1';
        sliderHdr.style.pointerEvents = dim ? 'none' : 'auto';
      }
      slTax.style.opacity      = dim ? '0.4' : '1';
      slTax.style.pointerEvents = dim ? 'none' : 'auto';
      if (mode === 'bracket') niTax.dataset.manual = niTax.value;
      if (mode === 'manual' && niTax.dataset.manual) niTax.value = niTax.dataset.manual;
    }
    solUpdate();
  };
  window.solSetTaxType = function(type, btn) {
    S.bracketType = type;
    const pg = document.getElementById('page-sol');
    if (pg) pg.querySelectorAll('.tax-type-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    const si=$id('tax-separate-info'), ci=$id('tax-comprehensive-info');
    if (si) si.style.display = type==='separate'?'':'none';
    if (ci) ci.style.display = type==='comprehensive'?'':'none';
    solUpdate();
  };

  // ── 월간 테이블 렌더 ────────────────────────
  function renderSolMonthlyTable(cache) {
    const { rows, years } = cache;
    const _priceNow = parseFloat(($id('kodex-price-val')||{textContent:'0'}).textContent.replace(/[^0-9.]/g,'')) || 0;
    const _growth = (parseFloat(($id('ni-growth')||{value:'0'}).value) || 0) / 100;
    const tbody = $id('monthlyTableBody');
    if (!tbody) return;
    saveOpenYears(tbody);
    tbody.innerHTML = '';
    const showTax = S.taxOn, showDCA = S.dcaOn;
    // 헤더 제어
    const mthTax     = $id('mth-tax');
    const mthTaxbase = $id('mth-taxbase');
    const mthDeposit = $id('mth-deposit');
    const mthDiv     = $id('mth-div');
    if (mthTax)     mthTax.style.display     = showTax ? '' : 'none';
    if (mthTaxbase) mthTaxbase.style.display = showTax ? '' : 'none';
    if (mthDeposit) mthDeposit.classList.toggle('col-hidden', !showDCA);
    if (mthDiv)     mthDiv.textContent = showTax ? '연/월 분배 (세후)' : '연/월 분배금';
    const mthPriceChange = $id('mth-price-change');

      const solCS = 6 + (showDCA?1:0) + (showTax?2:0);
    rows.forEach((r, ri) => {
      const yearNum = r.y || (ri + 1);
      /* 연간 주가 변동 합산 */
      var _yPCS = 0;
      if (r.mPortsAfter && r.mPortsEnd && r.mDivs) {
        var _prSY=(($id('ni-partial')||{value:'50'}).value||50)/100;
        r.mDivs.forEach(function(md,mmi){
          var pa=r.mPortsAfter[mmi]||0, pe=r.mPortsEnd[mmi]||0;
          var rv=S.investMode==='reinvest'?md:(S.investMode==='partial'?Math.round(md*_prSY):0);
          _yPCS+=(pe-pa-rv);
        });
      }
      if (mthPriceChange) mthPriceChange.style.color = _yPCS < 0 ? '#f04452' : '#3182f6';
      insertYearAccordionRow(tbody, yearNum, solCS, {
        portStart:   r.portStart,
        deposit:     r.deposit,
        div:         r.div,
        taxBase:     r.taxBase,
        tax:         r.tax,
        priceChange: Math.abs(_yPCS) <= 5 ? 0 : Math.round(_yPCS),
        port:        r.port,
        shares:      calcShares(r.port, _priceNow, _growth, yearNum * 12),
        taxOn:       S.taxOn,
        dcaOn:       S.dcaOn,
      });
      for (let m = 0; m < 12; m++) {
        const dN = r.mDivs[m] || 0;
        const dep = r.mDeposits ? r.mDeposits[m] : 0;
        let taxBase = 0, tax = 0;
        if (showTax) {
          const portM = r.mPortsAfter ? r.mPortsAfter[m] : 0;
          const mRate = cache.rate / 12;
          const dG = portM * mRate;
          const cpPct = S.kodexOn ? (parseFloat(($id('ni-calloption')||{value:'13'}).value)||13) : 0;
          const dpPct = S.kodexOn ? (parseFloat(($id('ni-divportion')||{value:'2'}).value)||2) : 0;
          const tp = cpPct + dpPct;
          taxBase = S.kodexOn && tp>0 ? dG*(dpPct/tp) : dG;
          tax = dG - dN;
        }
        var _mpaS = r.mPortsAfter ? r.mPortsAfter[m] : 0;
        var _peS  = r.mPortsEnd  ? r.mPortsEnd[m]  : 0;
        var _prSM = (($id('ni-partial')||{value:'50'}).value||50)/100;
        var _rvSM = S.investMode==='reinvest' ? dN : (S.investMode==='partial' ? Math.round(dN*_prSM) : 0);
        var _pcSM = _peS - _mpaS - _rvSM;
        if (Math.abs(_pcSM) <= 2) _pcSM = 0;
        const tr = document.createElement('tr');
        tr.dataset.yrRow = yearNum;
        tr.style.display = 'none';
        if (m === 11 && r.y === rows.length) tr.classList.add('highlight');
        tr.innerHTML =
          '<td style="color:var(--text3);">'+(ri*12+m+1)+'개월</td>' +
          '<td>'+(r.mPorts?fmt(r.mPorts[m]):'—')+'원</td>' +
          '<td class="'+(showDCA?'':'col-hidden')+'">'+(dep>0?'<span style="color:var(--accent);">+'+fmt(dep)+'</span>':'<span style="color:var(--text3);">—</span>')+'</td>' +
          '<td>'+fmt(dN)+'원</td>' +
          (showTax ? '<td style="color:#fe9800;">'+fmt(Math.round(taxBase))+'원</td>' : '') +
          (showTax ? '<td style="color:#f04452;">'+fmt(Math.round(tax))+'원</td>' : '') +
          '<td style="color:'+(_pcSM>=0?'#3182f6':'#f04452')+';">' + (_pcSM>=0?'+':'') + fmt(_pcSM) + '원</td>' +
          '<td>'+(r.mPortsEnd?fmt(r.mPortsEnd[m]):'—')+'원</td>'+'<td>'+fmtShares(calcShares(r.mPortsEnd?r.mPortsEnd[m]:0,_priceNow,_growth,ri*12+m+1))+'</td>';
        tbody.appendChild(tr);
      }
    });
    restoreOpenYears(tbody);
    try {
      var _sc = tbody.parentElement && tbody.parentElement.parentElement;
      if (_sc) { _sc.style.height = ''; void _sc.offsetHeight; }
    } catch(e) {}
  }

  // ── 슬라이더 sync ─────────────────────────
  function syncNI(key) {
    const ni=$id('ni-'+key), sl=$id('sl-'+key);
    if (!ni||!sl) return;
    const v=parseFloat(ni.value); if(isNaN(v)) return;
    const scale={amount:10000,years:1,rate:1,growth:1,target:10000,monthly:10000,tax:1}[key]||1;
    sl.value=Math.min(Math.max(v*scale,parseFloat(sl.min)),parseFloat(sl.max));
    solUpdate();
  }
  function syncSL(key, scale, dec) {
    const ni=$id('ni-'+key), sl=$id('sl-'+key);
    if (!ni||!sl) return;
    ni.value=(parseFloat(sl.value)/scale).toFixed(dec);
    solUpdate();
  }
  window.solSyncToSlider  = key => syncNI(key);
  window.solSyncToNum     = (k,s,d) => syncSL(k,s,d);

  // ── setDetailTab / setChartTab ────────────

    window.solSetChartTab = function(tab,btn) {
    _solChartTab=tab;
    ['annual','monthly'].forEach(function(t){
      var b=document.getElementById('sol-tab-'+t);
      if(b) b.classList.toggle('active',t===tab);
    });
    if(_solCache) renderSolChart(_solCache.rows, _solCache.years, _solCache.rate, _solCache.keepRate);
  };

})();

/* ════════════════════════════════════════
   [TIGER] TIGER 200 타겟위클리커버드콜
════════════════════════════════════════ */
(function() {
  const S = window._tigerState = {
    investMode: 'reinvest',
    dcaOn:    false,
    taxOn:    true,
    kodexOn:  true,
    taxMode:     'manual',
    bracketType: 'separate',
  };

  function $id(id)  { return document.getElementById('tiger-' + id); }
  function getV(id) { const el=$id(id); return el ? parseFloat(el.value.replace(/,/g,''))||0 : 0; }

  /* 단위 인식 값 읽기/쓰기 헬퍼 */
  function getVWon(fieldId) { return simReadWon('page-tiger', fieldId.replace('ni-', '')); }  /* → [SIM-UNIT] */
  function setDispFromWon(fieldId, won) { simWriteWon('page-tiger', fieldId.replace('ni-', ''), won); }
  function fmt(n)   { return Math.round(n).toLocaleString('ko-KR'); }

  // ── 현재가 조회 ──────────────────────────
  let _fetching = false;
  window.tigerFetchPrice = async function() {
    if (_fetching) return;
    _fetching = true;
    const btn  = $id('kodex-refresh-btn');
    const icon = $id('kodex-refresh-icon');
    const de   = $id('kodex-price-date');
    if (btn)  btn.disabled = true;
    if (icon) icon.textContent = '⏳';
    if (de)   de.textContent = '조회 중...';
    try {
      
      const yf = 'https://query1.finance.yahoo.com/v8/finance/chart/0104N0.KS?interval=1d&range=5d';
      for (const pu of ['https://corsproxy.io/?'+encodeURIComponent(yf),'https://api.allorigins.win/get?url='+encodeURIComponent(yf)]) {
        try {
          const r = await fetch(pu, {cache:'no-cache'});
          if (!r.ok) continue;
          let txt = await r.text();
          try { const w=JSON.parse(txt); if(w.contents) txt=w.contents; } catch {}
          const j = JSON.parse(txt);
          const m = j?.chart?.result?.[0]?.meta;
          const p = m?.regularMarketPrice || m?.previousClose;
          if (p) { applyPrice(p, 'Yahoo Finance'); return; }
        } catch {}
      }
      if (de) de.textContent = '조회 실패 — ↺ 재시도';
    } finally {
      _fetching = false;
      if (btn)  btn.disabled = false;
      if (icon) icon.textContent = '↺';
    }
  };

  function applyPrice(price, src) {
    price = parseFloat(price);
    if (!price || price < 1000 || price > 200000) return;
    const el = $id('kodex-price-val');
    if (el) el.textContent = price.toLocaleString('ko-KR');
    const now = new Date();
    const ns  = now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0')+'-'
               +String(now.getDate()).padStart(2,'0')+' '+now.toTimeString().slice(0,8);
    const de  = $id('kodex-price-date');
    const se  = $id('kodex-price-src');
    if (de) de.textContent = ns + ' 기준';
    if (se) se.textContent = '출처: ' + src + ' (0104N0.KS)';
    tigerUpdate();
  }

  // ── 계산 ──────────────────────────────────
  let _tigerChartTab = 'annual';
  let _tigerCache = null;

  window.tigerOnKodexRatioChange = function() {
    tigerUpdate();
  };
  window.tigerUpdate = function() {
    const rate0  = ((!isNaN(getV('ni-rate')) && getV('ni-rate') !== null) ? getV('ni-rate') : 7) / 100;
    /* 운용보수는 ETF 순자산에서 매일 빠져 주가(연간 주가 변동률)에 반영되므로 분배율에서 따로 빼지 않음 — 5개 시뮬레이터 공통 */
    const rate   = Math.max(0, rate0);
        const amount = getVWon('ni-amount');
    const _monthlyCheck = S.dcaOn ? getVWon('ni-monthly') : 0;
    if (amount === 0 && _monthlyCheck === 0) {
      [$id('s-annual'),$id('s-weekly'),$id('s-final'),$id('s-total'),$id('s-port')]
        .forEach(e => { if(e) e.textContent='0원'; });
      [$id('s-final-sub'),$id('s-total-sub'),$id('s-port-sub'),$id('target-sub')]
        .forEach(e => { if(e) e.textContent=''; });
      /* 상세 내역 tbody 초기화 */
      var _tb = $id('monthlyTableBody') || document.getElementById('tiger-monthlyTableBody');
      if (_tb) _tb.innerHTML = '';
      _tigerCache = null;
      return;
    }
    const years  = Math.round(getV('ni-years')) || 10;
    const growth = (getV('ni-growth') || 0) / 100;
    const monthly= S.dcaOn ? getVWon('ni-monthly') : 0;
    const taxRate= S.taxOn ? (getV('ni-tax') || 15.4) / 100 : 0;

    let cpPct = 0, dpPct = 0;
    let effTax = taxRate;
    if (S.kodexOn) {
      cpPct  = getV('ni-calloption') || 5;
      dpPct  = getV('ni-divportion') || 2;
      effTax = (cpPct+dpPct) > 0 ? taxRate * dpPct/(cpPct+dpPct) : 0;
    }
    const keepRate = 1 - effTax;
    const mRate    = rate / 12;
    const mGrow    = Math.pow(1 + growth, 1/12) - 1;

    let port = amount, totDiv = 0, totTax = 0, totInvest = amount, rows = [];
    for (let y = 1; y <= years; y++) {
      let yDiv=0, yDivG=0, yTax=0, yDeposit=0, portStart=port;
      let mDivs=[], mPorts=[], mDeposits=[], mPortsAfter=[], mPortsEnd=[];
      for (let m = 0; m < 12; m++) {
        mPorts.push(Math.round(port));
        const dep = monthly > 0 ? monthly : 0;
        if (dep > 0) { port += dep; yDeposit += dep; totInvest += dep; }
        mDeposits.push(dep);
        mPortsAfter.push(Math.round(port));
        const dG = port * mRate;
        const dT = dG * effTax;
        const dN = dG - dT;
        mDivs.push(Math.round(dN));
        yDiv += dN; yDivG += dG; yTax += dT; totDiv += dN; totTax += dT;
        if (S.investMode === 'reinvest')       port = (port + dN) * (1 + mGrow);
        else if (S.investMode === 'partial') {
          const pr = (parseFloat(($id('ni-partial')||{}).value)||50)/100;
          port = (port + dN*pr) * (1 + mGrow);
        } else                                port = port * (1 + mGrow);
        mPortsEnd.push(Math.round(port));
      }
      const m1st    = Math.round(portStart * mRate * keepRate);
      let taxBase = yDivG;
      if (S.kodexOn) { const tp=cpPct+dpPct; taxBase = tp>0 ? yDivG*(dpPct/tp) : 0; }
      rows.push({ y, port:Math.round(port), portStart:Math.round(portStart),
        div:Math.round(yDiv), divG:Math.round(yDivG), tax:Math.round(yTax),
        taxBase:Math.round(taxBase), deposit:Math.round(yDeposit),
        m1st, mDivs, mPorts, mDeposits, mPortsAfter, mPortsEnd, total:Math.round(totDiv) });
    }

    const r1=rows[0]||{}, rN=rows[rows.length-1]||{};
    const cagr = (simAssetCagr(amount, monthly, years, rN.port) || 0) * 100;   /* 적립 시 납입 시점 반영(IRR) — 5개 시뮬레이터 공통 */
    const cagrMon = Math.pow(1+cagr/100, 1/12) - 1;
    function setT(id,v){ const el=$id(id); if(el) el.textContent=v; }
    /* 요약 바 라벨: KODEX 페이지와 같이 세금 적용 시 (세후) 표시 */
    { const _sl = id => { const v=$id(id); return v && v.parentElement ? v.parentElement.querySelector('.sum-cell-label') : null; };
      const _sumLbl1=_sl('s-annual'), _sumLbl3=_sl('s-total');
      if (_sumLbl1) _sumLbl1.textContent='1년차 연간 분배금'+(S.taxOn?' (세후)':'');
      if (_sumLbl3) _sumLbl3.textContent='누적 수령 분배금'+(S.taxOn?' (세후)':''); }

    setT('s-annual',     fmt(r1.div)+'원');
    setT('s-weekly',     '월간 ' + fmt(r1.mDivs ? r1.mDivs[11] : r1.m1st)+'원');
    setT('s-label2',     years + '년차 연간 분배금' + (S.taxOn?' (세후)':''));
    setT('s-final',      fmt(rN.div)+'원');
    setT('s-final-sub',  '월간 ' + fmt(rN.mDivs ? rN.mDivs[11] : rN.m1st)+'원');
    setT('s-total',      fmt(totDiv)+'원');
    setT('s-total-sub',  '수익률 ' + ((totDiv/totInvest)*100).toFixed(1) + '%');
    setT('s-port-label', years + '년차 종료 자산');
    setT('s-port',       fmt(rN.port)+'원');
    setT('s-port-sub',   '총 투입 ' + fmt(totInvest)+'원' + ' 대비');
    const cagrEl = $id('s-cagr');
    if (cagrEl) { cagrEl.textContent=(cagr>=0?'+':'')+cagr.toFixed(2)+'%'; cagrEl.className = 'sum-cell-val'; }
    setT('s-cagr-sub',   '월 평균 '+(cagrMon>=0?'+':'')+(cagrMon*100).toFixed(3)+'%');
    const targetV = getVWon('ni-target');
    if (targetV > 0) { setT('target-result', fmt((targetV*12)/rate)+'원'); setT('target-sub','분배율 '+(rate0*100).toFixed(1)+'% 기준'); }
    setT('dca-annual-label', fmt(getVWon('ni-monthly')*12)+'원' + ' / 년');
    if (S.taxOn) { setT('tax-first-label', fmt(rows[0].tax)+'원'); setT('tax-total-label', fmt(Math.round(totTax))+'원'); }
    if (S.kodexOn) { const tp=cpPct+dpPct; setT('kodex-eff-rate',(tp>0?(effTax*100).toFixed(2):'0.00')+'%'); setT('kodex-total-rate',tp.toFixed(1)+'%'); setT('kodex-taxbase-label',fmt(Math.round(rows[0].taxBase))); }

    const thTaxbase=$id('th-taxbase'), thTax=$id('th-tax'), thDeposit=$id('th-deposit');
    if (thTaxbase) thTaxbase.style.display = S.taxOn?'':'none';
    if (thTax)     thTax.style.display     = S.taxOn?'':'none';
    if (thDeposit) thDeposit.style.display = S.dcaOn?'':'none';
    const thDiv=$id('th-div');
    if (thDiv) thDiv.textContent = S.taxOn?'연간 분배금 (세후)':'연간 분배금';

    const tbody = $id('tableBody');
    if (tbody) {
      tbody.innerHTML = '';
      rows.forEach((r,i) => {
        const tr = document.createElement('tr');
        if (i===rows.length-1) tr.classList.add('highlight');
        tr.innerHTML =
          '<td>'+r.y+'년차</td><td>'+fmt(r.port)+'</td>'+
          (S.dcaOn?'<td>'+(r.deposit>0?fmt(r.deposit):'<span style="color:var(--text3)">—</span>')+'</td>':'')+
          '<td>'+fmt(r.div)+'</td>'+
          (S.taxOn?'<td style="color:#fe9800;">'+fmt(r.taxBase)+'</td>':'')+
          (S.taxOn?'<td style="color:#f04452;">'+fmt(r.tax)+'</td>':'')+
          '<td>'+fmt(r.total)+'</td>';
        tbody.appendChild(tr);
      });
    }
    _tigerCache = { rows, years, rate, keepRate };
    renderTigerChart(rows, years, rate, keepRate);
    const dmEl = $id('detail-monthly');
    if (dmEl && dmEl.style.display !== 'none') renderTigerMonthlyTable(_tigerCache);
  };

  let _tChart = null;
  function renderTigerChart(rows, years, rate, keepRate) {
    const canvas = $id('mainChart'); if (!canvas) return;
    const legLabel=$id('leg-div-label'); if(legLabel) legLabel.textContent=_tigerChartTab==='annual'?'연간 분배금':'월간 분배금';
    const legPort=$id('leg-port'); if(legPort) legPort.style.display='none';
    let labels, datasets, type, opts;
    if (_tigerChartTab === 'annual') {
      labels=[...rows.map(r=>r.y+'년')]; datasets=[{label:'연간 분배금',data:rows.map(r=>r.div),backgroundColor:'rgba(49,130,246,0.7)',borderRadius:5,borderSkipped:false}]; type='bar'; opts=buildOpts(true,false,false);
    } else {
      const ml=[],md=[];
      for(let y=0;y<years;y++) for(let m=0;m<12;m++){ml.push(m===0?(y+1)+'년차':'');md.push(rows[y].mDivs[m]);}
      datasets=[{label:'월간 분배금',data:md,borderColor:'#3182f6',backgroundColor:'rgba(49,130,246,0.12)',fill:true,pointRadius:0,pointHoverRadius:4,borderWidth:2,tension:0.2}];
      labels=ml; type='line'; opts=buildOpts(false,false,true);
    }
    if (_tChart) _tChart.destroy();
    _tChart = new Chart(canvas, {type, data:{labels,datasets}, options:opts});
  }

  function renderTigerMonthlyTable(cache) {
    const {rows,years} = cache;
    const _priceNow = parseFloat(((document.getElementById('tiger-kodex-price-val')||{textContent:'0'}).textContent).replace(/[^0-9.]/g,'')) || 0;
    const _growth = (parseFloat(($id('ni-growth')||{value:'0'}).value) || 0) / 100;
    const tbody=$id('monthlyTableBody'); if(!tbody) return;
    saveOpenYears(tbody);
    tbody.innerHTML='';
    const mthTax=$id('mth-tax'), mthTaxbase=$id('mth-taxbase'), mthDeposit=$id('mth-deposit'), mthDiv=$id('mth-div');
    if(mthTax) mthTax.style.display=S.taxOn?'':'none';
    if(mthTaxbase) mthTaxbase.style.display=S.taxOn?'':'none';
    if(mthDeposit) mthDeposit.classList.toggle('col-hidden', !S.dcaOn);
    if(mthDiv) mthDiv.textContent=S.taxOn?'연/월 분배 (세후)':'연/월 분배금';
    const mthPriceChange = document.getElementById('tiger-mth-price-change');
    const tigerCS=6+(S.dcaOn?1:0)+(S.taxOn?2:0);
    rows.forEach((r,ri)=>{
      const yearNum=r.y||(ri+1);
      /* 연간 주가 변동 합산 */
      var _yPCS = 0;
      if (r.mPortsAfter && r.mPortsEnd && r.mDivs) {
        var _prSY=(($id('ni-partial')||{value:'50'}).value||50)/100;
        r.mDivs.forEach(function(md,mmi){
          var pa=r.mPortsAfter[mmi]||0, pe=r.mPortsEnd[mmi]||0;
          var rv=S.investMode==='reinvest'?md:(S.investMode==='partial'?Math.round(md*_prSY):0);
          _yPCS+=(pe-pa-rv);
        });
      }
      if (mthPriceChange) mthPriceChange.style.color = _yPCS < 0 ? '#f04452' : '#3182f6';
      insertYearAccordionRow(tbody, yearNum, tigerCS, {
        portStart:   r.portStart,
        deposit:     r.deposit,
        div:         r.div,
        taxBase:     r.taxBase,
        tax:         r.tax,
        priceChange: Math.abs(_yPCS) <= 5 ? 0 : Math.round(_yPCS),
        port:        r.port,
        shares:      calcShares(r.port, _priceNow, _growth, yearNum * 12),
        taxOn:       S.taxOn,
        dcaOn:       S.dcaOn,
      });
      for(let m=0;m<12;m++){
        const dN=r.mDivs[m]||0;        const dep=r.mDeposits?r.mDeposits[m]:0;
        let taxBase=0, tax=0;
        if(S.taxOn){const portM=r.mPortsAfter?r.mPortsAfter[m]:0;const mRate=cache.rate/12;const dG=portM*mRate;const cp=S.kodexOn?(parseFloat(($id('ni-calloption')||{value:'5'}).value)||5):0;const dp=S.kodexOn?(parseFloat(($id('ni-divportion')||{value:'2'}).value)||2):0;const tp=cp+dp;taxBase=S.kodexOn&&tp>0?dG*(dp/tp):dG;tax=dG-dN;}
        var portEnd = r.mPortsEnd ? r.mPortsEnd[m] : 0;
        var _mpa = r.mPortsAfter ? r.mPortsAfter[m] : 0;
        var _prS = (($id('ni-partial')||{value:'50'}).value||50)/100;
        var _rvS = S.investMode==='reinvest' ? dN : (S.investMode==='partial' ? Math.round(dN*_prS) : 0);
        var _pcS = portEnd - _mpa - _rvS;
        if (Math.abs(_pcS) <= 2) _pcS = 0;
        const tr=document.createElement('tr');
        tr.dataset.yrRow=yearNum;
        tr.style.display='none';
        if(m===11&&r.y===rows.length) tr.classList.add('highlight');
        tr.innerHTML='<td style="color:var(--text3);">'+(ri*12+m+1)+'개월</td>'+'<td>'+(r.mPorts?fmt(r.mPorts[m]):'—')+'원</td>'+'<td class="'+(S.dcaOn?'':'col-hidden')+'">'+(dep>0?'<span style="color:var(--accent);">+'+fmt(dep)+'</span>':'<span style="color:var(--text3);">—</span>')+'</td>'+'<td>'+fmt(dN)+'원</td>'+(S.taxOn?'<td style="color:#fe9800;">'+fmt(Math.round(taxBase))+'원</td>':'')+(S.taxOn?'<td style="color:#f04452;">'+fmt(Math.round(tax))+'원</td>':'')+'<td style="color:'+(_pcS>=0?'#3182f6':'#f04452')+';">'+ (_pcS>=0?'+':'') + fmt(_pcS) + '원</td>'+'<td>'+(r.mPortsEnd?fmt(r.mPortsEnd[m]):'—')+'원</td>'+'<td>'+fmtShares(calcShares(r.mPortsEnd?r.mPortsEnd[m]:0,_priceNow,_growth,ri*12+m+1))+'</td>';
        tbody.appendChild(tr);
      }
    });
    restoreOpenYears(tbody);
    try {
      var _sc = tbody.parentElement && tbody.parentElement.parentElement;
      if (_sc) { _sc.style.height = ''; void _sc.offsetHeight; }
    } catch(e) {}
  }

  window.tigerSetMode = function(m, btn) {
    S.investMode=m;
    const pg=document.getElementById('page-tiger');
    if(pg) pg.querySelectorAll('.mode-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    const pb=$id('partial-ratio-block'); if(pb) pb.style.display=m==='partial'?'block':'none';
    tigerUpdate();
  };
  window.tigerSyncPartial = function() {
    const ni=$id('ni-partial'),sl=$id('sl-partial');
    if(sl&&ni) sl.value=ni.value;
    const d=$id('partial-desc'); if(d) d.textContent='분배금의 '+ni.value+'%는 재투자, '+(100-ni.value)+'%는 수령';
    tigerUpdate();
  };
  window.tigerToggleDCA = function() {
    S.dcaOn=!S.dcaOn;
    const sw=$id('dca-switch'),bl=$id('dca-block');
    if(sw) sw.classList.toggle('on',S.dcaOn);
    if(bl){bl.style.opacity=S.dcaOn?'1':'0.3';bl.style.pointerEvents=S.dcaOn?'auto':'none';}
    const off=$id('dca-off-label'),on=$id('dca-on-label');
    if(off) off.style.color=S.dcaOn?'var(--text3)':'var(--text2)';
    if(on)  on.style.color =S.dcaOn?'var(--accent)':'var(--text3)';
    tigerUpdate();
  };
  window.tigerToggleTax = function() {
    S.taxOn=!S.taxOn;
    const sw=$id('tax-switch'),bl=$id('tax-block');
    if(sw) sw.classList.toggle('on',S.taxOn);
    if(bl){bl.style.opacity=S.taxOn?'1':'0.3';bl.style.pointerEvents=S.taxOn?'auto':'none';}
    const off=$id('tax-off-label'),on=$id('tax-on-label');
    if(off) off.style.color=S.taxOn?'var(--text3)':'var(--text2)';
    if(on)  on.style.color =S.taxOn?'var(--accent)':'var(--text3)';
    tigerUpdate();
  };
  window.tigerToggleKodex = function() {
    S.kodexOn=!S.kodexOn;
    const sw=$id('kodex-switch'),bl=$id('kodex-block');
    if(sw) sw.classList.toggle('on',S.kodexOn);
    if(bl){bl.style.opacity=S.kodexOn?'1':'0.3';bl.style.pointerEvents=S.kodexOn?'auto':'none';}
    const off=$id('kodex-off-label'),on=$id('kodex-on-label');
    if(off) off.style.color=S.kodexOn?'var(--text3)':'var(--text2)';
    if(on)  on.style.color =S.kodexOn?'var(--accent)':'var(--text3)';
    tigerUpdate();
  };
  window.tigerSetTaxMode = function(mode,btn) {
    S.taxMode = mode;
    const ni=$id('ni-tax'),sl=$id('sl-tax'); if(!ni||!sl) return;
    if(mode==='manual'){ni.value=ni.dataset.manual||'15.4';sl.value=Math.min(parseFloat(ni.value)||15.4,49.5);}
    else{ni.dataset.manual=ni.value;}
    const pg=document.getElementById('page-tiger');
    if(pg) pg.querySelectorAll('.tax-mode-tab').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    const mp=$id('tax-panel-manual'),bp=$id('tax-panel-bracket');
    if(mp) mp.style.display=mode==='manual'?'':'none';
    if(bp) bp.style.display=mode==='bracket'?'':'none';
    tigerUpdate();
  };
  window.tigerSetTaxType = function(type,btn) {
    S.bracketType = type;
    const pg=document.getElementById('page-tiger');
    if(pg) pg.querySelectorAll('.tax-type-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    const si=$id('tax-separate-info'),ci=$id('tax-comprehensive-info');
    if(si) si.style.display=type==='separate'?'':'none';
    if(ci) ci.style.display=type==='comprehensive'?'':'none';
    tigerUpdate();
  };
  function syncNI(key){const ni=$id('ni-'+key),sl=$id('sl-'+key);if(!ni||!sl)return;const v=parseFloat(ni.value);if(isNaN(v))return;const scale={amount:10000,years:1,rate:1,growth:1,target:10000,monthly:10000,tax:1}[key]||1;sl.value=Math.min(Math.max(v*scale,parseFloat(sl.min)),parseFloat(sl.max));tigerUpdate();}
  function syncSL(key,scale,dec){const ni=$id('ni-'+key),sl=$id('sl-'+key);if(!ni||!sl)return;ni.value=(parseFloat(sl.value)/scale).toFixed(dec);tigerUpdate();}
  window.tigerSyncToSlider=key=>syncNI(key);
  window.tigerSyncToNum=(k,s,d)=>syncSL(k,s,d);

    window.tigerSetChartTab = function(tab,btn) {
    _tigerChartTab=tab;
    ['annual','monthly'].forEach(function(t){
      var b=document.getElementById('tiger-tab-'+t);
      if(b) b.classList.toggle('active',t===tab);
    });
    if(_tigerCache) renderTigerChart(_tigerCache.rows, _tigerCache.years, _tigerCache.rate, _tigerCache.keepRate);
  };

})();

/* ════════════════════════════════════════
   [TIGERDIV] TIGER 배당커버드콜액티브
════════════════════════════════════════ */
(function() {
  const S = window._tigerdivState = {
    investMode: 'reinvest',
    dcaOn:    false,
    taxOn:    true,
    kodexOn:  true,
    taxMode:     'manual',
    bracketType: 'separate',
  };

  function $id(id)  { return document.getElementById('tigerdiv-' + id); }
  function getV(id) { const el=$id(id); return el ? parseFloat(el.value.replace(/,/g,''))||0 : 0; }

  /* ── 단위 인식 값 읽기/쓰기 헬퍼 ── */
  
  function getVWon(fieldId) { return simReadWon('page-tigerdiv', fieldId.replace('ni-', '')); }  /* → [SIM-UNIT] */
  function setDispFromWon(fieldId, won) { simWriteWon('page-tigerdiv', fieldId.replace('ni-', ''), won); }
  function fmt(n)   { return Math.round(n).toLocaleString('ko-KR'); }

  // ── 현재가 조회 ──────────────────────────
  let _fetching = false;
  window.tigerdivFetchPrice = async function() {
    if (_fetching) return;
    _fetching = true;
    const btn  = $id('kodex-refresh-btn');
    const icon = $id('kodex-refresh-icon');
    const de   = $id('kodex-price-date');
    if (btn)  btn.disabled = true;
    if (icon) icon.textContent = '⏳';
    if (de)   de.textContent = '조회 중...';
    try {
      
      const yf = 'https://query1.finance.yahoo.com/v8/finance/chart/472150.KS?interval=1d&range=5d';
      for (const pu of ['https://corsproxy.io/?'+encodeURIComponent(yf),'https://api.allorigins.win/get?url='+encodeURIComponent(yf)]) {
        try {
          const r = await fetch(pu, {cache:'no-cache'});
          if (!r.ok) continue;
          let txt = await r.text();
          try { const w=JSON.parse(txt); if(w.contents) txt=w.contents; } catch {}
          const j = JSON.parse(txt);
          const m = j?.chart?.result?.[0]?.meta;
          const p = m?.regularMarketPrice || m?.previousClose;
          if (p) { applyPrice(p, 'Yahoo Finance'); return; }
        } catch {}
      }
      if (de) de.textContent = '조회 실패 — ↺ 재시도';
    } finally {
      _fetching = false;
      if (btn)  btn.disabled = false;
      if (icon) icon.textContent = '↺';
    }
  };

  function applyPrice(price, src) {
    price = parseFloat(price);
    if (!price || price < 1000 || price > 200000) return;
    const el = $id('kodex-price-val');
    if (el) el.textContent = price.toLocaleString('ko-KR');
    const now = new Date();
    const ns  = now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0')+'-'
               +String(now.getDate()).padStart(2,'0')+' '+now.toTimeString().slice(0,8);
    const de  = $id('kodex-price-date');
    const se  = $id('kodex-price-src');
    if (de) de.textContent = ns + ' 기준';
    if (se) se.textContent = '출처: ' + src + ' (472150.KS)';
    tigerdivUpdate();
  }

  // ── 계산 ──────────────────────────────────
  let _tigerdivChartTab = 'annual';
  let _tigerdivCache = null;

  window.tigerdivOnKodexRatioChange = function() {
    tigerdivUpdate();
  };
  window.tigerdivUpdate = function() {
    const rate0  = ((!isNaN(getV('ni-rate')) && getV('ni-rate') !== null) ? getV('ni-rate') : 7) / 100;
    /* 운용보수는 ETF 순자산에서 매일 빠져 주가(연간 주가 변동률)에 반영되므로 분배율에서 따로 빼지 않음 — 5개 시뮬레이터 공통 */
    const rate   = Math.max(0, rate0);
        const amount = getVWon('ni-amount');
    const _monthlyCheck = S.dcaOn ? getVWon('ni-monthly') : 0;
    if (amount === 0 && _monthlyCheck === 0) {
      [$id('s-annual'),$id('s-weekly'),$id('s-final'),$id('s-total'),$id('s-port')]
        .forEach(e => { if(e) e.textContent='0원'; });
      [$id('s-final-sub'),$id('s-total-sub'),$id('s-port-sub'),$id('target-sub')]
        .forEach(e => { if(e) e.textContent=''; });
      /* 상세 내역 tbody 초기화 */
      var _tb = $id('monthlyTableBody') || document.getElementById('tigerdiv-monthlyTableBody');
      if (_tb) _tb.innerHTML = '';
      _tigerdivCache = null;
      return;
    }
    const years  = Math.round(getV('ni-years')) || 10;
    const growth = (getV('ni-growth') || 0) / 100;
    const monthly= S.dcaOn ? getVWon('ni-monthly') : 0;
    const taxRate= S.taxOn ? (getV('ni-tax') || 15.4) / 100 : 0;

    let cpPct = 0, dpPct = 0;
    let effTax = taxRate;
    if (S.kodexOn) {
      cpPct  = getV('ni-calloption') || 5;
      dpPct  = getV('ni-divportion') || 2;
      effTax = (cpPct+dpPct) > 0 ? taxRate * dpPct/(cpPct+dpPct) : 0;
    }
    const keepRate = 1 - effTax;
    const mRate    = rate / 12;
    const mGrow    = Math.pow(1 + growth, 1/12) - 1;

    let port = amount, totDiv = 0, totTax = 0, totInvest = amount, rows = [];
    for (let y = 1; y <= years; y++) {
      let yDiv=0, yDivG=0, yTax=0, yDeposit=0, portStart=port;
      let mDivs=[], mPorts=[], mDeposits=[], mPortsAfter=[], mPortsEnd=[];
      for (let m = 0; m < 12; m++) {
        mPorts.push(Math.round(port));
        const dep = monthly > 0 ? monthly : 0;
        if (dep > 0) { port += dep; yDeposit += dep; totInvest += dep; }
        mDeposits.push(dep);
        mPortsAfter.push(Math.round(port));
        const dG = port * mRate;
        const dT = dG * effTax;
        const dN = dG - dT;
        mDivs.push(Math.round(dN));
        yDiv += dN; yDivG += dG; yTax += dT; totDiv += dN; totTax += dT;
        if (S.investMode === 'reinvest')       port = (port + dN) * (1 + mGrow);
        else if (S.investMode === 'partial') {
          const pr = (parseFloat(($id('ni-partial')||{}).value)||50)/100;
          port = (port + dN*pr) * (1 + mGrow);
        } else                                port = port * (1 + mGrow);
        mPortsEnd.push(Math.round(port));
      }
      const m1st    = Math.round(portStart * mRate * keepRate);
      let taxBase = yDivG;
      if (S.kodexOn) { const tp=cpPct+dpPct; taxBase = tp>0 ? yDivG*(dpPct/tp) : 0; }
      rows.push({ y, port:Math.round(port), portStart:Math.round(portStart),
        div:Math.round(yDiv), divG:Math.round(yDivG), tax:Math.round(yTax),
        taxBase:Math.round(taxBase), deposit:Math.round(yDeposit),
        m1st, mDivs, mPorts, mDeposits, mPortsAfter, mPortsEnd, total:Math.round(totDiv) });
    }

    const r1=rows[0]||{}, rN=rows[rows.length-1]||{};
    const cagr = (simAssetCagr(amount, monthly, years, rN.port) || 0) * 100;   /* 적립 시 납입 시점 반영(IRR) — 5개 시뮬레이터 공통 */
    const cagrMon = Math.pow(1+cagr/100, 1/12) - 1;
    function setT(id,v){ const el=$id(id); if(el) el.textContent=v; }
    /* 요약 바 라벨: KODEX 페이지와 같이 세금 적용 시 (세후) 표시 */
    { const _sl = id => { const v=$id(id); return v && v.parentElement ? v.parentElement.querySelector('.sum-cell-label') : null; };
      const _sumLbl1=_sl('s-annual'), _sumLbl3=_sl('s-total');
      if (_sumLbl1) _sumLbl1.textContent='1년차 연간 분배금'+(S.taxOn?' (세후)':'');
      if (_sumLbl3) _sumLbl3.textContent='누적 수령 분배금'+(S.taxOn?' (세후)':''); }

    setT('s-annual',     fmt(r1.div)+'원');
    setT('s-weekly',     '월간 ' + fmt(r1.mDivs ? r1.mDivs[11] : r1.m1st)+'원');
    setT('s-label2',     years + '년차 연간 분배금' + (S.taxOn?' (세후)':''));
    setT('s-final',      fmt(rN.div)+'원');
    setT('s-final-sub',  '월간 ' + fmt(rN.mDivs ? rN.mDivs[11] : rN.m1st)+'원');
    setT('s-total',      fmt(totDiv)+'원');
    setT('s-total-sub',  '수익률 ' + ((totDiv/totInvest)*100).toFixed(1) + '%');
    setT('s-port-label', years + '년차 종료 자산');
    setT('s-port',       fmt(rN.port)+'원');
    setT('s-port-sub',   '총 투입 ' + fmt(totInvest)+'원' + ' 대비');
    const cagrEl = $id('s-cagr');
    if (cagrEl) { cagrEl.textContent=(cagr>=0?'+':'')+cagr.toFixed(2)+'%'; cagrEl.className = 'sum-cell-val'; }
    setT('s-cagr-sub',   '월 평균 '+(cagrMon>=0?'+':'')+(cagrMon*100).toFixed(3)+'%');
    const targetV=getVWon('ni-target');
    if (targetV > 0) { setT('target-result', fmt((targetV*12)/rate)+'원'); setT('target-sub','분배율 '+(rate0*100).toFixed(1)+'% 기준'); }
    setT('dca-annual-label', fmt(getVWon('ni-monthly')*12)+'원' + ' / 년');
    if (S.taxOn) { setT('tax-first-label', fmt(rows[0].tax)+'원'); setT('tax-total-label', fmt(Math.round(totTax))+'원'); }
    if (S.kodexOn) { const tp=cpPct+dpPct; setT('kodex-eff-rate',(tp>0?(effTax*100).toFixed(2):'0.00')+'%'); setT('kodex-total-rate',tp.toFixed(1)+'%'); setT('kodex-taxbase-label',fmt(Math.round(rows[0].taxBase))); }

    const thTaxbase=$id('th-taxbase'), thTax=$id('th-tax'), thDeposit=$id('th-deposit');
    if (thTaxbase) thTaxbase.style.display = S.taxOn?'':'none';
    if (thTax)     thTax.style.display     = S.taxOn?'':'none';
    if (thDeposit) thDeposit.style.display = S.dcaOn?'':'none';
    const thDiv=$id('th-div');
    if (thDiv) thDiv.textContent = S.taxOn?'연간 분배금 (세후)':'연간 분배금';

    const tbody = $id('tableBody');
    if (tbody) {
      tbody.innerHTML = '';
      rows.forEach((r,i) => {
        const tr = document.createElement('tr');
        if (i===rows.length-1) tr.classList.add('highlight');
        tr.innerHTML =
          '<td>'+r.y+'년차</td><td>'+fmt(r.port)+'</td>'+
          (S.dcaOn?'<td>'+(r.deposit>0?fmt(r.deposit):'<span style="color:var(--text3)">—</span>')+'</td>':'')+
          '<td>'+fmt(r.div)+'</td>'+
          (S.taxOn?'<td style="color:#fe9800;">'+fmt(r.taxBase)+'</td>':'')+
          (S.taxOn?'<td style="color:#f04452;">'+fmt(r.tax)+'</td>':'')+
          '<td>'+fmt(r.total)+'</td>';
        tbody.appendChild(tr);
      });
    }
    _tigerdivCache = { rows, years, rate, keepRate };
    renderTigerdivChart(rows, years, rate, keepRate);
    const dmEl = $id('detail-monthly');
    if (dmEl && dmEl.style.display !== 'none') renderTigerdivMonthlyTable(_tigerdivCache);
  };

  let _tChart = null;
  function renderTigerdivChart(rows, years, rate, keepRate) {
    const canvas = $id('mainChart'); if (!canvas) return;
    const legLabel=$id('leg-div-label'); if(legLabel) legLabel.textContent=_tigerdivChartTab==='annual'?'연간 분배금':'월간 분배금';
    const legPort=$id('leg-port'); if(legPort) legPort.style.display='none';
    let labels, datasets, type, opts;
    if (_tigerdivChartTab === 'annual') {
      labels=[...rows.map(r=>r.y+'년')]; datasets=[{label:'연간 분배금',data:rows.map(r=>r.div),backgroundColor:'rgba(49,130,246,0.7)',borderRadius:5,borderSkipped:false}]; type='bar'; opts=buildOpts(true,false,false);
    } else {
      const ml=[],md=[];
      for(let y=0;y<years;y++) for(let m=0;m<12;m++){ml.push(m===0?(y+1)+'년차':'');md.push(rows[y].mDivs[m]);}
      datasets=[{label:'월간 분배금',data:md,borderColor:'#3182f6',backgroundColor:'rgba(49,130,246,0.12)',fill:true,pointRadius:0,pointHoverRadius:4,borderWidth:2,tension:0.2}];
      labels=ml; type='line'; opts=buildOpts(false,false,true);
    }
    if (_tChart) _tChart.destroy();
    _tChart = new Chart(canvas, {type, data:{labels,datasets}, options:opts});
  }

  function renderTigerdivMonthlyTable(cache) {
    const {rows,years} = cache;
    const _priceNow = parseFloat(((document.getElementById('tigerdiv-kodex-price-val')||{textContent:'0'}).textContent).replace(/[^0-9.]/g,'')) || 0;
    const _growth = (parseFloat(($id('ni-growth')||{value:'0'}).value) || 0) / 100;
    const tbody=$id('monthlyTableBody'); if(!tbody) return;
    saveOpenYears(tbody);
    tbody.innerHTML='';
    const mthTax=$id('mth-tax'), mthTaxbase=$id('mth-taxbase'), mthDeposit=$id('mth-deposit'), mthDiv=$id('mth-div');
    if(mthTax) mthTax.style.display=S.taxOn?'':'none';
    if(mthTaxbase) mthTaxbase.style.display=S.taxOn?'':'none';
    if(mthDeposit) mthDeposit.classList.toggle('col-hidden', !S.dcaOn);
    if(mthDiv) mthDiv.textContent=S.taxOn?'연/월 분배 (세후)':'연/월 분배금';
    const mthPriceChange = document.getElementById('tigerdiv-mth-price-change');
    const tigerCS=6+(S.dcaOn?1:0)+(S.taxOn?2:0);
    rows.forEach((r,ri)=>{
      const yearNum=r.y||(ri+1);
      /* 연간 주가 변동 합산 */
      var _yPCS = 0;
      if (r.mPortsAfter && r.mPortsEnd && r.mDivs) {
        var _prSY=(($id('ni-partial')||{value:'50'}).value||50)/100;
        r.mDivs.forEach(function(md,mmi){
          var pa=r.mPortsAfter[mmi]||0, pe=r.mPortsEnd[mmi]||0;
          var rv=S.investMode==='reinvest'?md:(S.investMode==='partial'?Math.round(md*_prSY):0);
          _yPCS+=(pe-pa-rv);
        });
      }
      if (mthPriceChange) mthPriceChange.style.color = _yPCS < 0 ? '#f04452' : '#3182f6';
      insertYearAccordionRow(tbody, yearNum, tigerCS, {
        portStart:   r.portStart,
        deposit:     r.deposit,
        div:         r.div,
        taxBase:     r.taxBase,
        tax:         r.tax,
        priceChange: Math.abs(_yPCS) <= 5 ? 0 : Math.round(_yPCS),
        port:        r.port,
        shares:      calcShares(r.port, _priceNow, _growth, yearNum * 12),
        taxOn:       S.taxOn,
        dcaOn:       S.dcaOn,
      });
      for(let m=0;m<12;m++){
        const dN=r.mDivs[m]||0;        const dep=r.mDeposits?r.mDeposits[m]:0;
        let taxBase=0, tax=0;
        if(S.taxOn){const portM=r.mPortsAfter?r.mPortsAfter[m]:0;const mRate=cache.rate/12;const dG=portM*mRate;const cp=S.kodexOn?(parseFloat(($id('ni-calloption')||{value:'5'}).value)||5):0;const dp=S.kodexOn?(parseFloat(($id('ni-divportion')||{value:'2'}).value)||2):0;const tp=cp+dp;taxBase=S.kodexOn&&tp>0?dG*(dp/tp):dG;tax=dG-dN;}
        var portEnd = r.mPortsEnd ? r.mPortsEnd[m] : 0;
        var _mpa = r.mPortsAfter ? r.mPortsAfter[m] : 0;
        var _prS = (($id('ni-partial')||{value:'50'}).value||50)/100;
        var _rvS = S.investMode==='reinvest' ? dN : (S.investMode==='partial' ? Math.round(dN*_prS) : 0);
        var _pcS = portEnd - _mpa - _rvS;
        if (Math.abs(_pcS) <= 2) _pcS = 0;
        const tr=document.createElement('tr');
        tr.dataset.yrRow=yearNum;
        tr.style.display='none';
        if(m===11&&r.y===rows.length) tr.classList.add('highlight');
        tr.innerHTML='<td style="color:var(--text3);">'+(ri*12+m+1)+'개월</td>'+'<td>'+(r.mPorts?fmt(r.mPorts[m]):'—')+'원</td>'+'<td class="'+(S.dcaOn?'':'col-hidden')+'">'+(dep>0?'<span style="color:var(--accent);">+'+fmt(dep)+'</span>':'<span style="color:var(--text3);">—</span>')+'</td>'+'<td>'+fmt(dN)+'원</td>'+(S.taxOn?'<td style="color:#fe9800;">'+fmt(Math.round(taxBase))+'원</td>':'')+(S.taxOn?'<td style="color:#f04452;">'+fmt(Math.round(tax))+'원</td>':'')+'<td style="color:'+(_pcS>=0?'#3182f6':'#f04452')+';">'+ (_pcS>=0?'+':'') + fmt(_pcS) + '원</td>'+'<td>'+(r.mPortsEnd?fmt(r.mPortsEnd[m]):'—')+'원</td>'+'<td>'+fmtShares(calcShares(r.mPortsEnd?r.mPortsEnd[m]:0,_priceNow,_growth,ri*12+m+1))+'</td>';
        tbody.appendChild(tr);
      }
    });
    restoreOpenYears(tbody);
    try {
      var _sc = tbody.parentElement && tbody.parentElement.parentElement;
      if (_sc) { _sc.style.height = ''; void _sc.offsetHeight; }
    } catch(e) {}
  }

  window.tigerdivSetMode = function(m, btn) {
    S.investMode = m;
    /* 분배금 모드 버튼 active 직접 제어 */
    ['receive','reinvest','partial'].forEach(function(mode) {
      var b = document.getElementById('tigerdiv-mode-' + mode);
      if (b) b.classList.toggle('active', mode === m);
    });
    const pb = $id('partial-ratio-block');
    if (pb) pb.style.display = m === 'partial' ? 'block' : 'none';
    tigerdivUpdate();
  };
  window.tigerdivSyncPartial = function() {
    const ni=$id('ni-partial'),sl=$id('sl-partial');
    if(sl&&ni) sl.value=ni.value;
    const d=$id('partial-desc'); if(d) d.textContent='분배금의 '+ni.value+'%는 재투자, '+(100-ni.value)+'%는 수령';
    tigerdivUpdate();
  };
  window.tigerdivToggleDCA = function() {
    S.dcaOn=!S.dcaOn;
    const sw=$id('dca-switch'),bl=$id('dca-block');
    if(sw) sw.classList.toggle('on',S.dcaOn);
    if(bl){bl.style.opacity=S.dcaOn?'1':'0.3';bl.style.pointerEvents=S.dcaOn?'auto':'none';}
    const off=$id('dca-off-label'),on=$id('dca-on-label');
    if(off) off.style.color=S.dcaOn?'var(--text3)':'var(--text2)';
    if(on)  on.style.color =S.dcaOn?'var(--accent)':'var(--text3)';
    tigerdivUpdate();
  };
  window.tigerdivToggleTax = function() {
    S.taxOn=!S.taxOn;
    const sw=$id('tax-switch'),bl=$id('tax-block');
    if(sw) sw.classList.toggle('on',S.taxOn);
    if(bl){bl.style.opacity=S.taxOn?'1':'0.3';bl.style.pointerEvents=S.taxOn?'auto':'none';}
    const off=$id('tax-off-label'),on=$id('tax-on-label');
    if(off) off.style.color=S.taxOn?'var(--text3)':'var(--text2)';
    if(on)  on.style.color =S.taxOn?'var(--accent)':'var(--text3)';
    tigerdivUpdate();
  };
  window.tigerdivToggleKodex = function() {
    S.kodexOn=!S.kodexOn;
    const sw=$id('kodex-switch'),bl=$id('kodex-block');
    if(sw) sw.classList.toggle('on',S.kodexOn);
    if(bl){bl.style.opacity=S.kodexOn?'1':'0.3';bl.style.pointerEvents=S.kodexOn?'auto':'none';}
    const off=$id('kodex-off-label'),on=$id('kodex-on-label');
    if(off) off.style.color=S.kodexOn?'var(--text3)':'var(--text2)';
    if(on)  on.style.color =S.kodexOn?'var(--accent)':'var(--text3)';
    tigerdivUpdate();
  };
  window.tigerdivSetTaxMode = function(mode,btn) {
    S.taxMode = mode;
    const ni=$id('ni-tax'),sl=$id('sl-tax'); if(!ni||!sl) return;
    if(mode==='manual'){ni.value=ni.dataset.manual||'15.4';sl.value=Math.min(parseFloat(ni.value)||15.4,49.5);}
    else{ni.dataset.manual=ni.value;}
    const pg=document.getElementById('page-tigerdiv');
    if(pg) pg.querySelectorAll('.tax-mode-tab').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    const mp=$id('tax-panel-manual'),bp=$id('tax-panel-bracket');
    if(mp) mp.style.display=mode==='manual'?'':'none';
    if(bp) bp.style.display=mode==='bracket'?'':'none';
    tigerdivUpdate();
  };
  window.tigerdivSetTaxType = function(type,btn) {
    S.bracketType = type;
    const pg=document.getElementById('page-tigerdiv');
    if(pg) pg.querySelectorAll('.tax-type-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    const si=$id('tax-separate-info'),ci=$id('tax-comprehensive-info');
    if(si) si.style.display=type==='separate'?'':'none';
    if(ci) ci.style.display=type==='comprehensive'?'':'none';
    tigerdivUpdate();
  };
  function syncNI(key){const ni=$id('ni-'+key),sl=$id('sl-'+key);if(!ni||!sl)return;const v=parseFloat(ni.value);if(isNaN(v))return;const scale={amount:10000,years:1,rate:1,growth:1,target:10000,monthly:10000,tax:1}[key]||1;sl.value=Math.min(Math.max(v*scale,parseFloat(sl.min)),parseFloat(sl.max));tigerdivUpdate();}
  function syncSL(key,scale,dec){const ni=$id('ni-'+key),sl=$id('sl-'+key);if(!ni||!sl)return;ni.value=(parseFloat(sl.value)/scale).toFixed(dec);tigerdivUpdate();}
  window.tigerdivSyncToSlider=key=>syncNI(key);
  window.tigerdivSyncToNum=(k,s,d)=>syncSL(k,s,d);

  window.tigerdivSetChartTab=function(tab,btn){
    _tigerdivChartTab=tab;
    /* 차트 탭 버튼 active 직접 제어 */
    ['annual','monthly'].forEach(function(t) {
      var b = document.getElementById('tigerdiv-tab-' + t);
      if (b) b.classList.toggle('active', t === tab);
    });if(_tigerdivCache)renderTigerdivChart(_tigerdivCache.rows,_tigerdivCache.years,_tigerdivCache.rate,_tigerdivCache.keepRate);};

  /* 배당 프리셋 (일반/특별배당) */

  /* ── tigerdiv 전용 단위 함수 (전역 fancyUnit 오염 방지) ── */

  window.tigerdivValidateNum = function(key) {
    const el = $id('ni-' + key);
    if (!el) return;
    const v = parseFloat(el.value);
    if (isNaN(v)) return;
    const sl = $id('sl-' + key);
    if (sl) {
      const clamped = Math.min(Math.max(v, parseFloat(sl.min)), parseFloat(sl.max));
      sl.value = clamped;
    }
    tigerdivUpdate();
  };

})();
/* ── TIGER END ── */

/* ════════════════════════════════════════
   [TIGERSEMI] TIGER 반도체TOP10커버드콜액티브 (0177R0.KS)
════════════════════════════════════════ */
(function() {
  const S = window._tigersemiState = {
    investMode: 'reinvest',
    dcaOn:    false,
    taxOn:    true,
    kodexOn:  true,
    taxMode:     'manual',
    bracketType: 'separate',
  };

  function $id(id)  { return document.getElementById('tigersemi-' + id); }
  function getV(id) { const el=$id(id); return el ? parseFloat(el.value.replace(/,/g,''))||0 : 0; }

  /* ── 단위 인식 값 읽기/쓰기 헬퍼 ── */
  
  function getVWon(fieldId) { return simReadWon('page-tigersemi', fieldId.replace('ni-', '')); }  /* → [SIM-UNIT] */
  function setDispFromWon(fieldId, won) { simWriteWon('page-tigersemi', fieldId.replace('ni-', ''), won); }
  function fmt(n)   { return Math.round(n).toLocaleString('ko-KR'); }

  // ── 현재가 조회 ──────────────────────────
  let _fetching = false;
  window.tigersemiFetchPrice = async function() {
    if (_fetching) return;
    _fetching = true;
    const btn  = $id('kodex-refresh-btn');
    const icon = $id('kodex-refresh-icon');
    const de   = $id('kodex-price-date');
    if (btn)  btn.disabled = true;
    if (icon) icon.textContent = '⏳';
    if (de)   de.textContent = '조회 중...';
    try {
      
      const yf = 'https://query1.finance.yahoo.com/v8/finance/chart/0177R0.KS?interval=1d&range=5d';
      for (const pu of ['https://corsproxy.io/?'+encodeURIComponent(yf),'https://api.allorigins.win/get?url='+encodeURIComponent(yf)]) {
        try {
          const r = await fetch(pu, {cache:'no-cache'});
          if (!r.ok) continue;
          let txt = await r.text();
          try { const w=JSON.parse(txt); if(w.contents) txt=w.contents; } catch {}
          const j = JSON.parse(txt);
          const m = j?.chart?.result?.[0]?.meta;
          const p = m?.regularMarketPrice || m?.previousClose;
          if (p) { applyPrice(p, 'Yahoo Finance'); return; }
        } catch {}
      }
      if (de) de.textContent = '조회 실패 — ↺ 재시도';
    } finally {
      _fetching = false;
      if (btn)  btn.disabled = false;
      if (icon) icon.textContent = '↺';
    }
  };

  function applyPrice(price, src) {
    price = parseFloat(price);
    if (!price || price < 1000 || price > 200000) return;
    const el = $id('kodex-price-val');
    if (el) el.textContent = price.toLocaleString('ko-KR');
    const now = new Date();
    const ns  = now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0')+'-'
               +String(now.getDate()).padStart(2,'0')+' '+now.toTimeString().slice(0,8);
    const de  = $id('kodex-price-date');
    const se  = $id('kodex-price-src');
    if (de) de.textContent = ns + ' 기준';
    if (se) se.textContent = '출처: ' + src + ' (0177R0.KS)';
    tigersemiUpdate();
  }

  // ── 계산 ──────────────────────────────────
  let _tigersemiChartTab = 'annual';
  let _tigersemiCache = null;

  window.tigersemiOnKodexRatioChange = function() {
    tigersemiUpdate();
  };
  window.tigersemiUpdate = function() {
    const rate0  = ((!isNaN(getV('ni-rate')) && getV('ni-rate') !== null) ? getV('ni-rate') : 18) / 100;
    /* 운용보수는 ETF 순자산에서 매일 빠져 주가(연간 주가 변동률)에 반영되므로 분배율에서 따로 빼지 않음 — 5개 시뮬레이터 공통 */
    const rate   = Math.max(0, rate0);
        const amount = getVWon('ni-amount');
    const _monthlyCheck = S.dcaOn ? getVWon('ni-monthly') : 0;
    if (amount === 0 && _monthlyCheck === 0) {
      [$id('s-annual'),$id('s-weekly'),$id('s-final'),$id('s-total'),$id('s-port')]
        .forEach(e => { if(e) e.textContent='0원'; });
      [$id('s-final-sub'),$id('s-total-sub'),$id('s-port-sub'),$id('target-sub')]
        .forEach(e => { if(e) e.textContent=''; });
      /* 상세 내역 tbody 초기화 */
      var _tb = $id('monthlyTableBody') || document.getElementById('tigersemi-monthlyTableBody');
      if (_tb) _tb.innerHTML = '';
      _tigersemiCache = null;
      return;
    }
    const years  = Math.round(getV('ni-years')) || 10;
    const growth = (getV('ni-growth') || 0) / 100;
    const monthly= S.dcaOn ? getVWon('ni-monthly') : 0;
    const taxRate= S.taxOn ? (getV('ni-tax') || 15.4) / 100 : 0;

    let cpPct = 0, dpPct = 0;
    let effTax = taxRate;
    if (S.kodexOn) {
      cpPct  = getV('ni-calloption') || 5;
      dpPct  = getV('ni-divportion') || 2;
      effTax = (cpPct+dpPct) > 0 ? taxRate * dpPct/(cpPct+dpPct) : 0;
    }
    const keepRate = 1 - effTax;
    const mRate    = rate / 12;
    const mGrow    = Math.pow(1 + growth, 1/12) - 1;

    let port = amount, totDiv = 0, totTax = 0, totInvest = amount, rows = [];
    for (let y = 1; y <= years; y++) {
      let yDiv=0, yDivG=0, yTax=0, yDeposit=0, portStart=port;
      let mDivs=[], mPorts=[], mDeposits=[], mPortsAfter=[], mPortsEnd=[];
      for (let m = 0; m < 12; m++) {
        mPorts.push(Math.round(port));
        const dep = monthly > 0 ? monthly : 0;
        if (dep > 0) { port += dep; yDeposit += dep; totInvest += dep; }
        mDeposits.push(dep);
        mPortsAfter.push(Math.round(port));
        const dG = port * mRate;
        const dT = dG * effTax;
        const dN = dG - dT;
        mDivs.push(Math.round(dN));
        yDiv += dN; yDivG += dG; yTax += dT; totDiv += dN; totTax += dT;
        if (S.investMode === 'reinvest')       port = (port + dN) * (1 + mGrow);
        else if (S.investMode === 'partial') {
          const pr = (parseFloat(($id('ni-partial')||{}).value)||50)/100;
          port = (port + dN*pr) * (1 + mGrow);
        } else                                port = port * (1 + mGrow);
        mPortsEnd.push(Math.round(port));
      }
      const m1st    = Math.round(portStart * mRate * keepRate);
      let taxBase = yDivG;
      if (S.kodexOn) { const tp=cpPct+dpPct; taxBase = tp>0 ? yDivG*(dpPct/tp) : 0; }
      rows.push({ y, port:Math.round(port), portStart:Math.round(portStart),
        div:Math.round(yDiv), divG:Math.round(yDivG), tax:Math.round(yTax),
        taxBase:Math.round(taxBase), deposit:Math.round(yDeposit),
        m1st, mDivs, mPorts, mDeposits, mPortsAfter, mPortsEnd, total:Math.round(totDiv) });
    }

    const r1=rows[0]||{}, rN=rows[rows.length-1]||{};
    const cagr = (simAssetCagr(amount, monthly, years, rN.port) || 0) * 100;   /* 적립 시 납입 시점 반영(IRR) — 5개 시뮬레이터 공통 */
    const cagrMon = Math.pow(1+cagr/100, 1/12) - 1;
    function setT(id,v){ const el=$id(id); if(el) el.textContent=v; }
    /* 요약 바 라벨: KODEX 페이지와 같이 세금 적용 시 (세후) 표시 */
    { const _sl = id => { const v=$id(id); return v && v.parentElement ? v.parentElement.querySelector('.sum-cell-label') : null; };
      const _sumLbl1=_sl('s-annual'), _sumLbl3=_sl('s-total');
      if (_sumLbl1) _sumLbl1.textContent='1년차 연간 분배금'+(S.taxOn?' (세후)':'');
      if (_sumLbl3) _sumLbl3.textContent='누적 수령 분배금'+(S.taxOn?' (세후)':''); }

    setT('s-annual',     fmt(r1.div)+'원');
    setT('s-weekly',     '월간 ' + fmt(r1.mDivs ? r1.mDivs[11] : r1.m1st)+'원');
    setT('s-label2',     years + '년차 연간 분배금' + (S.taxOn?' (세후)':''));
    setT('s-final',      fmt(rN.div)+'원');
    setT('s-final-sub',  '월간 ' + fmt(rN.mDivs ? rN.mDivs[11] : rN.m1st)+'원');
    setT('s-total',      fmt(totDiv)+'원');
    setT('s-total-sub',  '수익률 ' + ((totDiv/totInvest)*100).toFixed(1) + '%');
    setT('s-port-label', years + '년차 종료 자산');
    setT('s-port',       fmt(rN.port)+'원');
    setT('s-port-sub',   '총 투입 ' + fmt(totInvest)+'원' + ' 대비');
    const cagrEl = $id('s-cagr');
    if (cagrEl) { cagrEl.textContent=(cagr>=0?'+':'')+cagr.toFixed(2)+'%'; cagrEl.className = 'sum-cell-val'; }
    setT('s-cagr-sub',   '월 평균 '+(cagrMon>=0?'+':'')+(cagrMon*100).toFixed(3)+'%');
    const targetV=getVWon('ni-target');
    if (targetV > 0) { setT('target-result', fmt((targetV*12)/rate)+'원'); setT('target-sub','분배율 '+(rate0*100).toFixed(1)+'% 기준'); }
    setT('dca-annual-label', fmt(getVWon('ni-monthly')*12)+'원' + ' / 년');
    if (S.taxOn) { setT('tax-first-label', fmt(rows[0].tax)+'원'); setT('tax-total-label', fmt(Math.round(totTax))+'원'); }
    if (S.kodexOn) { const tp=cpPct+dpPct; setT('kodex-eff-rate',(tp>0?(effTax*100).toFixed(2):'0.00')+'%'); setT('kodex-total-rate',tp.toFixed(1)+'%'); setT('kodex-taxbase-label',fmt(Math.round(rows[0].taxBase))); }

    const thTaxbase=$id('th-taxbase'), thTax=$id('th-tax'), thDeposit=$id('th-deposit');
    if (thTaxbase) thTaxbase.style.display = S.taxOn?'':'none';
    if (thTax)     thTax.style.display     = S.taxOn?'':'none';
    if (thDeposit) thDeposit.style.display = S.dcaOn?'':'none';
    const thDiv=$id('th-div');
    if (thDiv) thDiv.textContent = S.taxOn?'연간 분배금 (세후)':'연간 분배금';

    const tbody = $id('tableBody');
    if (tbody) {
      tbody.innerHTML = '';
      rows.forEach((r,i) => {
        const tr = document.createElement('tr');
        if (i===rows.length-1) tr.classList.add('highlight');
        tr.innerHTML =
          '<td>'+r.y+'년차</td><td>'+fmt(r.port)+'</td>'+
          (S.dcaOn?'<td>'+(r.deposit>0?fmt(r.deposit):'<span style="color:var(--text3)">—</span>')+'</td>':'')+
          '<td>'+fmt(r.div)+'</td>'+
          (S.taxOn?'<td style="color:#fe9800;">'+fmt(r.taxBase)+'</td>':'')+
          (S.taxOn?'<td style="color:#f04452;">'+fmt(r.tax)+'</td>':'')+
          '<td>'+fmt(r.total)+'</td>';
        tbody.appendChild(tr);
      });
    }
    _tigersemiCache = { rows, years, rate, keepRate };
    renderTigersemiChart(rows, years, rate, keepRate);
    const dmEl = $id('detail-monthly');
    if (dmEl && dmEl.style.display !== 'none') renderTigersemiMonthlyTable(_tigersemiCache);
  };

  let _tChart = null;
  function renderTigersemiChart(rows, years, rate, keepRate) {
    const canvas = $id('mainChart'); if (!canvas) return;
    const legLabel=$id('leg-div-label'); if(legLabel) legLabel.textContent=_tigersemiChartTab==='annual'?'연간 분배금':'월간 분배금';
    const legPort=$id('leg-port'); if(legPort) legPort.style.display='none';
    let labels, datasets, type, opts;
    if (_tigersemiChartTab === 'annual') {
      labels=[...rows.map(r=>r.y+'년')]; datasets=[{label:'연간 분배금',data:rows.map(r=>r.div),backgroundColor:'rgba(49,130,246,0.7)',borderRadius:5,borderSkipped:false}]; type='bar'; opts=buildOpts(true,false,false);
    } else {
      const ml=[],md=[];
      for(let y=0;y<years;y++) for(let m=0;m<12;m++){ml.push(m===0?(y+1)+'년차':'');md.push(rows[y].mDivs[m]);}
      datasets=[{label:'월간 분배금',data:md,borderColor:'#3182f6',backgroundColor:'rgba(49,130,246,0.12)',fill:true,pointRadius:0,pointHoverRadius:4,borderWidth:2,tension:0.2}];
      labels=ml; type='line'; opts=buildOpts(false,false,true);
    }
    if (_tChart) _tChart.destroy();
    _tChart = new Chart(canvas, {type, data:{labels,datasets}, options:opts});
  }

  function renderTigersemiMonthlyTable(cache) {
    const {rows,years} = cache;
    const _priceNow = parseFloat(((document.getElementById('tigersemi-kodex-price-val')||{textContent:'0'}).textContent).replace(/[^0-9.]/g,'')) || 0;
    const _growth = (parseFloat(($id('ni-growth')||{value:'0'}).value) || 0) / 100;
    const tbody=$id('monthlyTableBody'); if(!tbody) return;
    saveOpenYears(tbody);
    tbody.innerHTML='';
    const mthTax=$id('mth-tax'), mthTaxbase=$id('mth-taxbase'), mthDeposit=$id('mth-deposit'), mthDiv=$id('mth-div');
    if(mthTax) mthTax.style.display=S.taxOn?'':'none';
    if(mthTaxbase) mthTaxbase.style.display=S.taxOn?'':'none';
    if(mthDeposit) mthDeposit.classList.toggle('col-hidden', !S.dcaOn);
    if(mthDiv) mthDiv.textContent=S.taxOn?'연/월 분배 (세후)':'연/월 분배금';
    const mthPriceChange = document.getElementById('tigersemi-mth-price-change');
    const tigerCS=6+(S.dcaOn?1:0)+(S.taxOn?2:0);
    rows.forEach((r,ri)=>{
      const yearNum=r.y||(ri+1);
      /* 연간 주가 변동 합산 */
      var _yPCS = 0;
      if (r.mPortsAfter && r.mPortsEnd && r.mDivs) {
        var _prSY=(($id('ni-partial')||{value:'50'}).value||50)/100;
        r.mDivs.forEach(function(md,mmi){
          var pa=r.mPortsAfter[mmi]||0, pe=r.mPortsEnd[mmi]||0;
          var rv=S.investMode==='reinvest'?md:(S.investMode==='partial'?Math.round(md*_prSY):0);
          _yPCS+=(pe-pa-rv);
        });
      }
      if (mthPriceChange) mthPriceChange.style.color = _yPCS < 0 ? '#f04452' : '#3182f6';
      insertYearAccordionRow(tbody, yearNum, tigerCS, {
        portStart:   r.portStart,
        deposit:     r.deposit,
        div:         r.div,
        taxBase:     r.taxBase,
        tax:         r.tax,
        priceChange: Math.abs(_yPCS) <= 5 ? 0 : Math.round(_yPCS),
        port:        r.port,
        shares:      calcShares(r.port, _priceNow, _growth, yearNum * 12),
        taxOn:       S.taxOn,
        dcaOn:       S.dcaOn,
      });
      for(let m=0;m<12;m++){
        const dN=r.mDivs[m]||0;        const dep=r.mDeposits?r.mDeposits[m]:0;
        let taxBase=0, tax=0;
        if(S.taxOn){const portM=r.mPortsAfter?r.mPortsAfter[m]:0;const mRate=cache.rate/12;const dG=portM*mRate;const cp=S.kodexOn?(parseFloat(($id('ni-calloption')||{value:'5'}).value)||5):0;const dp=S.kodexOn?(parseFloat(($id('ni-divportion')||{value:'2'}).value)||2):0;const tp=cp+dp;taxBase=S.kodexOn&&tp>0?dG*(dp/tp):dG;tax=dG-dN;}
        var portEnd = r.mPortsEnd ? r.mPortsEnd[m] : 0;
        var _mpa = r.mPortsAfter ? r.mPortsAfter[m] : 0;
        var _prS = (($id('ni-partial')||{value:'50'}).value||50)/100;
        var _rvS = S.investMode==='reinvest' ? dN : (S.investMode==='partial' ? Math.round(dN*_prS) : 0);
        var _pcS = portEnd - _mpa - _rvS;
        if (Math.abs(_pcS) <= 2) _pcS = 0;
        const tr=document.createElement('tr');
        tr.dataset.yrRow=yearNum;
        tr.style.display='none';
        if(m===11&&r.y===rows.length) tr.classList.add('highlight');
        tr.innerHTML='<td style="color:var(--text3);">'+(ri*12+m+1)+'개월</td>'+'<td>'+(r.mPorts?fmt(r.mPorts[m]):'—')+'원</td>'+'<td class="'+(S.dcaOn?'':'col-hidden')+'">'+(dep>0?'<span style="color:var(--accent);">+'+fmt(dep)+'</span>':'<span style="color:var(--text3);">—</span>')+'</td>'+'<td>'+fmt(dN)+'원</td>'+(S.taxOn?'<td style="color:#fe9800;">'+fmt(Math.round(taxBase))+'원</td>':'')+(S.taxOn?'<td style="color:#f04452;">'+fmt(Math.round(tax))+'원</td>':'')+'<td style="color:'+(_pcS>=0?'#3182f6':'#f04452')+';">'+ (_pcS>=0?'+':'') + fmt(_pcS) + '원</td>'+'<td>'+(r.mPortsEnd?fmt(r.mPortsEnd[m]):'—')+'원</td>'+'<td>'+fmtShares(calcShares(r.mPortsEnd?r.mPortsEnd[m]:0,_priceNow,_growth,ri*12+m+1))+'</td>';
        tbody.appendChild(tr);
      }
    });
    restoreOpenYears(tbody);
    try {
      var _sc = tbody.parentElement && tbody.parentElement.parentElement;
      if (_sc) { _sc.style.height = ''; void _sc.offsetHeight; }
    } catch(e) {}
  }

  window.tigersemiSetMode = function(m, btn) {
    S.investMode = m;
    /* 분배금 모드 버튼 active 직접 제어 */
    ['receive','reinvest','partial'].forEach(function(mode) {
      var b = document.getElementById('tigersemi-mode-' + mode);
      if (b) b.classList.toggle('active', mode === m);
    });
    const pb = $id('partial-ratio-block');
    if (pb) pb.style.display = m === 'partial' ? 'block' : 'none';
    tigersemiUpdate();
  };
  window.tigersemiSyncPartial = function() {
    const ni=$id('ni-partial'),sl=$id('sl-partial');
    if(sl&&ni) sl.value=ni.value;
    const d=$id('partial-desc'); if(d) d.textContent='분배금의 '+ni.value+'%는 재투자, '+(100-ni.value)+'%는 수령';
    tigersemiUpdate();
  };
  window.tigersemiToggleDCA = function() {
    S.dcaOn=!S.dcaOn;
    const sw=$id('dca-switch'),bl=$id('dca-block');
    if(sw) sw.classList.toggle('on',S.dcaOn);
    if(bl){bl.style.opacity=S.dcaOn?'1':'0.3';bl.style.pointerEvents=S.dcaOn?'auto':'none';}
    const off=$id('dca-off-label'),on=$id('dca-on-label');
    if(off) off.style.color=S.dcaOn?'var(--text3)':'var(--text2)';
    if(on)  on.style.color =S.dcaOn?'var(--accent)':'var(--text3)';
    tigersemiUpdate();
  };
  window.tigersemiToggleTax = function() {
    S.taxOn=!S.taxOn;
    const sw=$id('tax-switch'),bl=$id('tax-block');
    if(sw) sw.classList.toggle('on',S.taxOn);
    if(bl){bl.style.opacity=S.taxOn?'1':'0.3';bl.style.pointerEvents=S.taxOn?'auto':'none';}
    const off=$id('tax-off-label'),on=$id('tax-on-label');
    if(off) off.style.color=S.taxOn?'var(--text3)':'var(--text2)';
    if(on)  on.style.color =S.taxOn?'var(--accent)':'var(--text3)';
    tigersemiUpdate();
  };
  window.tigersemiToggleKodex = function() {
    S.kodexOn=!S.kodexOn;
    const sw=$id('kodex-switch'),bl=$id('kodex-block');
    if(sw) sw.classList.toggle('on',S.kodexOn);
    if(bl){bl.style.opacity=S.kodexOn?'1':'0.3';bl.style.pointerEvents=S.kodexOn?'auto':'none';}
    const off=$id('kodex-off-label'),on=$id('kodex-on-label');
    if(off) off.style.color=S.kodexOn?'var(--text3)':'var(--text2)';
    if(on)  on.style.color =S.kodexOn?'var(--accent)':'var(--text3)';
    tigersemiUpdate();
  };
  window.tigersemiSetTaxMode = function(mode,btn) {
    S.taxMode = mode;
    const ni=$id('ni-tax'),sl=$id('sl-tax'); if(!ni||!sl) return;
    if(mode==='manual'){ni.value=ni.dataset.manual||'15.4';sl.value=Math.min(parseFloat(ni.value)||15.4,49.5);}
    else{ni.dataset.manual=ni.value;}
    const pg=document.getElementById('page-tigersemi');
    if(pg) pg.querySelectorAll('.tax-mode-tab').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    const mp=$id('tax-panel-manual'),bp=$id('tax-panel-bracket');
    if(mp) mp.style.display=mode==='manual'?'':'none';
    if(bp) bp.style.display=mode==='bracket'?'':'none';
    tigersemiUpdate();
  };
  window.tigersemiSetTaxType = function(type,btn) {
    S.bracketType = type;
    const pg=document.getElementById('page-tigersemi');
    if(pg) pg.querySelectorAll('.tax-type-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    const si=$id('tax-separate-info'),ci=$id('tax-comprehensive-info');
    if(si) si.style.display=type==='separate'?'':'none';
    if(ci) ci.style.display=type==='comprehensive'?'':'none';
    tigersemiUpdate();
  };
  function syncNI(key){const ni=$id('ni-'+key),sl=$id('sl-'+key);if(!ni||!sl)return;const v=parseFloat(ni.value);if(isNaN(v))return;const scale={amount:10000,years:1,rate:1,growth:1,target:10000,monthly:10000,tax:1}[key]||1;sl.value=Math.min(Math.max(v*scale,parseFloat(sl.min)),parseFloat(sl.max));tigersemiUpdate();}
  function syncSL(key,scale,dec){const ni=$id('ni-'+key),sl=$id('sl-'+key);if(!ni||!sl)return;ni.value=(parseFloat(sl.value)/scale).toFixed(dec);tigersemiUpdate();}
  window.tigersemiSyncToSlider=key=>syncNI(key);
  window.tigersemiSyncToNum=(k,s,d)=>syncSL(k,s,d);

  window.tigersemiSetChartTab=function(tab,btn){
    _tigersemiChartTab=tab;
    /* 차트 탭 버튼 active 직접 제어 */
    ['annual','monthly'].forEach(function(t) {
      var b = document.getElementById('tigersemi-tab-' + t);
      if (b) b.classList.toggle('active', t === tab);
    });if(_tigersemiCache)renderTigersemiChart(_tigersemiCache.rows,_tigersemiCache.years,_tigersemiCache.rate,_tigersemiCache.keepRate);};

  /* 배당 프리셋 (일반/특별배당) */

  /* ── tigersemi 전용 단위 함수 (전역 fancyUnit 오염 방지) ── */

  window.tigersemiValidateNum = function(key) {
    const el = $id('ni-' + key);
    if (!el) return;
    const v = parseFloat(el.value);
    if (isNaN(v)) return;
    const sl = $id('sl-' + key);
    if (sl) {
      const clamped = Math.min(Math.max(v, parseFloat(sl.min)), parseFloat(sl.max));
      sl.value = clamped;
    }
    tigersemiUpdate();
  };

})();
/* ── TIGERSEMI END ── */

/* ════════════════════════════════════════
   [HOME] 메인 화면 — 자본주의를 숫자로
   데이터: data/home.json (Actions build_home: 한국은행 ECOS 물가·예금금리·원달러, 국토부 실거래가, 야후 지수·SPY 배당)
   · 모든 비교는 '그해 평균' 기준 (실거래가·물가지수와 같은 잣대) · 진행 중인 올해는 제외
   · 통화량(M2)은 [MONEYSPEED] 의 공식 통계 값(1995→2025)을 그대로 씀
════════════════════════════════════════ */
(function () {
  var D = null, loading = null, charts = {};
  var C = { cpi: '#f04452', dep: '#8b8b94', cash: '#f04452', seoul: '#fe9800', gangnam: '#ffb84d', gold: '#d9b64a',
            kospi: '#7fb2ff', sp500k: '#5b9bff', spytrk: '#3182f6', ndx100k: '#1f5fd6' };
  var TAX = 0.154;                                     /* 이자소득세 (지방소득세 포함) */
  function $(id) { return document.getElementById(id); }
  function setT(id, v) { var e = $(id); if (e) e.textContent = v; }
  function setH(id, v) { var e = $(id); if (e) e.innerHTML = v; }
  function cagr(a, b, n) { return Math.pow(b / a, 1 / n) - 1; }
  function pct(v, d) { return (v >= 0 ? '+' : '') + (v * 100).toFixed(d == null ? 1 : d) + '%'; }
  function won(v) {                                   /* 원 → '4.46억' / '4,460만원' */
    if (Math.abs(v) >= 1e8) return (v / 1e8).toFixed(2) + '억';
    return Math.round(v / 1e4).toLocaleString('ko-KR') + '만원';
  }
  function cssVar(n, f) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim() || f; }

  function load() {
    if (loading) return loading;
    loading = (async function () {
      try {
        var j = window.mdLoad ? await window.mdLoad('home.json') : null;
        if (j && j.years && Object.keys(j.years).length) { D = j; return true; }
      } catch (e) {}
      loading = null; return false;
    })();
    return loading;
  }
  function col(key) {                                  /* {연도: 값} */
    var o = {};
    Object.keys(D.years).forEach(function (y) { var v = D.years[y][key]; if (v != null) o[+y] = v; });
    return o;
  }
  function span(keys) {                                /* 모든 키가 있는 연도 범위 */
    var ys = Object.keys(D.years).map(Number).filter(function (y) {
      return keys.every(function (k) { return D.years[y][k] != null; });
    }).sort(function (a, b) { return a - b; });
    return ys.length >= 2 ? [ys[0], ys[ys.length - 1]] : null;
  }
  /* 예금: 시작 연도부터 매년 그해 정기예금 금리로 재예치 (세후) → {연도: 원금 1 기준 가치} */
  function depositPath(y0, y1, afterTax) {
    var dep = col('dep'), v = 1, out = {};
    out[y0] = 1;
    for (var y = y0; y < y1; y++) { v *= 1 + (dep[y] || 0) / 100 * (afterTax ? 1 - TAX : 1); out[y + 1] = v; }
    return out;
  }
  function baseOpts(fmtY, fmtTip) {
    var tick = cssVar('--text3', '#888'), narrow = window.innerWidth < 600;
    return {
      responsive: true, maintainAspectRatio: false, animation: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: true, position: 'bottom', labels: { color: cssVar('--text2', '#aaa'), boxWidth: 10, boxHeight: 10, usePointStyle: true, pointStyle: 'rectRounded', font: { size: narrow ? 10 : 11 }, padding: 12 } },
        tooltip: { itemSort: function (a, b) { return b.parsed.y - a.parsed.y; }, callbacks: { label: function (c) { return ' ' + c.dataset.label + '  ' + fmtTip(c.parsed.y); } } }
      },
      scales: {
        x: { grid: { display: false }, border: { color: fgA(0.25) }, ticks: { color: tick, maxRotation: 0, autoSkip: true, maxTicksLimit: narrow ? 5 : 9, font: { size: narrow ? 10 : 11 } } },
        y: { position: 'right', border: { display: false }, grid: { color: fgA(0.07) }, ticks: { color: tick, maxTicksLimit: 6, font: { size: narrow ? 10 : 11 }, callback: fmtY } }
      }
    };
  }
  function line(label, data, color, extra) {
    return Object.assign({ label: label, data: data, borderColor: color, backgroundColor: color, borderWidth: 1.6, pointRadius: 0, pointHoverRadius: 3, tension: 0.15, fill: false }, extra || {});
  }
  function draw(id, cfg) {
    var cv = $(id); if (!cv || !window.Chart) return;
    if (charts[id]) charts[id].destroy();
    charts[id] = new Chart(cv, cfg);
  }

  /* ── 상단 지표 ── */
  function renderKpis() {
    var cpi = col('cpi'), cy = Object.keys(cpi).map(Number).sort(function (a, b) { return a - b; });
    var c0 = cpi[1995] ? 1995 : cy[0], c1 = cy[cy.length - 1];
    setT('hm-k-cpi', '연 ' + pct(cagr(cpi[c0], cpi[c1], c1 - c0)));
    setT('hm-k-cpi-sub', c0 + '→' + c1 + ' · ' + cpi[c0].toFixed(1) + ' → ' + cpi[c1].toFixed(1) + ' (' + (cpi[c1] / cpi[c0]).toFixed(2) + '배)');
    var r = span(['seoul', 'spytrk', 'cpi']);
    if (r) {
      var s = col('seoul'), p = col('spytrk'), n = r[1] - r[0];
      setT('hm-k-seoul', '연 ' + pct(cagr(s[r[0]], s[r[1]], n)));
      setT('hm-k-seoul-sub', r[0] + '→' + r[1] + ' · ' + won(s[r[0]] * 1e4) + ' → ' + won(s[r[1]] * 1e4));
      setT('hm-k-spy', '연 ' + pct(cagr(p[r[0]], p[r[1]], n)));
      setT('hm-k-spy-sub', r[0] + '→' + r[1] + ' · 1억 → ' + won(1e8 * p[r[1]] / p[r[0]]));
    }
  }

  /* ── 01 현금의 구매력 ── */
  function renderCash() {
    var r = span(['cpi', 'dep']); if (!r) return;
    var y0 = r[0], y1 = r[1], cpi = col('cpi'), dp = depositPath(y0, y1, true), dpg = depositPath(y0, y1, false);
    var labels = [], cash = [], dep = [];
    for (var y = y0; y <= y1; y++) {
      labels.push(String(y));
      cash.push(+(1e8 * cpi[y0] / cpi[y] / 1e8).toFixed(4));
      dep.push(+(1e8 * dp[y] * cpi[y0] / cpi[y] / 1e8).toFixed(4));
    }
    var cashReal = 1e8 * cpi[y0] / cpi[y1], depReal = 1e8 * dp[y1] * cpi[y0] / cpi[y1], depNom = 1e8 * dp[y1];
    var infl = cagr(cpi[y0], cpi[y1], y1 - y0), depR = cagr(1, dp[y1], y1 - y0), depRg = cagr(1, dpg[y1], y1 - y0);
    setH('hm-cash-p', y0 + '년 이후 소비자물가는 연평균 <b>' + pct(infl) + '</b> 올랐습니다. ' + y0 + '년의 1억 원을 금고에 넣어 두었다면 ' + y1 +
      '년 물가 기준으로 <b>' + won(cashReal) + '</b>어치의 구매력만 남습니다. 은행 정기예금에 매년 다시 맡겼다면 세전 연 ' + pct(depRg) + ', 이자소득세 15.4%를 떼면 연 ' + pct(depR) +
      '로, 물가를 ' + (depR >= infl ? '<b>겨우 앞서는 수준</b>입니다.' : '<b>따라가지 못했습니다</b>.'));
    setT('hm-cash-l1', '금고 속 현금 1억 (' + y0 + '→' + y1 + ')');
    setT('hm-cash-v1', won(cashReal));
    setT('hm-cash-l2', '정기예금 세후 재예치 (명목 ' + won(depNom) + ')');
    setT('hm-cash-v2', won(depReal));
    $('hm-cash-v2').style.color = depReal >= 1e8 ? 'var(--text)' : 'var(--accent2)';
    setT('hm-cash-note', '모두 ' + y1 + '년 물가로 환산한 실질 구매력 · 예금은 매년 그해 평균 정기예금 금리(한국은행, 신규취급액 기준)로 재예치했다고 가정');
    var rule = $('hm-rule2');
    if (rule) rule.textContent = y0 + '년 이후 정기예금도 세금을 떼면 실질 연 ' + pct((1 + depR) / (1 + infl) - 1) + ' — 물가를 겨우 따라가는 수준입니다.';
    draw('hm-cash-chart', { type: 'line', data: { labels: labels, datasets: [
      line('정기예금 (세후)', dep, cssVar('--accent', '#3182f6')),
      line('금고 속 현금', cash, cssVar('--accent2', '#f04452'))
    ] }, options: Object.assign(baseOpts(function (v) { return v.toFixed(1) + '억'; }, function (v) { return won(v * 1e8) + ' (실질)'; })) });
  }

  /* ── 02 자산별 1억의 변화 ── */
  var ASSETS = [
    { k: 'cash',    name: '현금 보관',            sub: '명목 그대로',               cat: 'cash' },
    { k: 'dep',     name: '정기예금',             sub: '세후 · 매년 재예치',         cat: 'cash' },
    { k: 'goldk',   name: '금',                   sub: '국제 금 선물 · 원화',         cat: 'real' },
    { k: 'seoul',   name: '서울 아파트',          sub: '평균 실거래가',              cat: 'real' },
    { k: 'gangnam', name: '강남구 아파트',        sub: '평균 실거래가',              cat: 'real' },
    { k: 'kospi',   name: '코스피',               sub: '가격지수 · 배당 제외',        cat: 'stock' },
    { k: 'sp500k',  name: 'S&P 500',              sub: '가격지수 · 원화',            cat: 'stock' },
    { k: 'spytrk',  name: 'S&P 500 배당 재투자',  sub: 'SPY · 원화',                 cat: 'stock' },
    { k: 'ndx100k', name: '나스닥 100',           sub: '가격지수 · 원화',            cat: 'stock' }
  ];
  function renderRace() {
    var r = span(['cpi', 'dep', 'seoul', 'kospi', 'spytrk']); if (!r) { setH('hm-bars', '<p class="hm-loading">비교 자료가 아직 없습니다.</p>'); return; }
    var y0 = r[0], y1 = r[1], n = y1 - y0, cpi = col('cpi'), dp = depositPath(y0, y1, true);
    var infl = cagr(cpi[y0], cpi[y1], n), cpiVal = 1e8 * cpi[y1] / cpi[y0];
    var rows = [];
    ASSETS.forEach(function (a) {
      var v, g;
      if (a.k === 'cash') v = 1e8;
      else if (a.k === 'dep') v = 1e8 * dp[y1];
      else { var c = col(a.k); if (c[y0] == null || c[y1] == null) return; v = 1e8 * c[y1] / c[y0]; }
      g = cagr(1e8, v, n);
      rows.push({ a: a, v: v, g: g, real: (1 + g) / (1 + infl) - 1 });
    });
    rows.sort(function (x, y) { return x.v - y.v; });
    var max = Math.max.apply(null, rows.map(function (x) { return x.v; }).concat([cpiVal]));
    var colr = { cash: cssVar('--text3', '#777'), real: cssVar('--accent3', '#fe9800'), stock: cssVar('--accent', '#3182f6') };
    var html = '<div class="hm-bar hm-bar-head"><div>' + y0 + '년 1억 원 →</div><div class="hm-bar-track" style="background:none;"></div><div class="hm-bar-val">' + y1 + '년 가치</div><div class="hm-bar-cagr">연평균 (실질)</div></div>';
    rows.forEach(function (x) {
      var w = Math.max(1, x.v / max * 100), cp = cpiVal / max * 100;
      html += '<div class="hm-bar"><div class="hm-bar-name">' + x.a.name + '<small>' + x.a.sub + '</small></div>'
        + '<div class="hm-bar-track" style="position:relative;"><div class="hm-bar-fill" style="width:' + w.toFixed(2) + '%;background:' + colr[x.a.cat] + ';"></div>'
        + '<div class="hm-bar-ref" title="물가만큼 오른 금액" style="left:' + cp.toFixed(2) + '%;"></div></div>'
        + '<div class="hm-bar-val">' + won(x.v) + '</div>'
        + '<div class="hm-bar-cagr">' + pct(x.g) + '<small>실질 ' + pct(x.real) + '</small></div></div>';
    });
    setH('hm-bars', html);
    var best = rows[rows.length - 1];
    setH('hm-race-p', y0 + '년에 1억 원을 넣었다면 ' + y1 + '년에는 얼마가 되었을까요? 같은 ' + n + '년 동안 <b>현금은 1억 그대로</b>였지만, 물가가 오른 만큼 같은 생활을 하려면 <b>'
      + won(cpiVal) + '</b>이 필요해졌습니다(점선). 이 선을 넘어선 자산만 실제로 부를 늘려 준 셈이고, 가장 크게 불어난 것은 <b>' + best.a.name + '</b>(' + won(best.v) + ', 연 ' + pct(best.g) + ')입니다.');
    /* 연도별 추이 차트 */
    var keys = [['spytrk', 'S&P 500 배당 재투자 (원화)'], ['seoul', '서울 아파트'], ['kospi', '코스피'], ['dep', '정기예금 (세후)'], ['cpi', '물가']];
    var labels = [], ds = [];
    for (var y = y0; y <= y1; y++) labels.push(String(y));
    keys.forEach(function (kk) {
      var c = kk[0] === 'dep' ? dp : col(kk[0]), b = kk[0] === 'dep' ? 1 : c[y0];
      ds.push(line(kk[1], labels.map(function (y) { return c[+y] != null ? +(c[+y] / b).toFixed(4) : null; }), C[kk[0]], kk[0] === 'cpi' ? { borderWidth: 1.2 } : {}));
    });
    draw('hm-race-chart', { type: 'line', data: { labels: labels, datasets: ds },
      options: baseOpts(function (v) { return v.toFixed(1) + '억'; }, function (v) { return won(v * 1e8); }) });
    setT('hm-race-note', '모든 값은 그해 평균 기준(아파트는 그해 거래된 아파트의 평균 거래금액, 지수는 월평균, 물가는 연평균 지수) · 원화 환산은 한국은행 월평균 원/달러 환율 · '
      + '실질 = 물가 상승분을 뺀 연평균 상승률 · 세금·거래비용·대출 레버리지·임대수익 미반영 · 아파트 평균 거래금액은 해마다 거래된 단지·면적 구성에 따라 달라질 수 있습니다.');
    /* 03 부동산 vs 지수 */
    var se = col('seoul'), sp = col('spytrk'), ks = col('kospi');
    var gS = cagr(se[y0], se[y1], n), gP = cagr(sp[y0], sp[y1], n), gK = cagr(ks[y0], ks[y1], n);
    setT('hm-vs-re', '연 ' + pct(gS) + ' (서울)');
    setT('hm-vs-st', '연 ' + pct(gP) + ' (S&P 500)');
    setH('hm-vs-p', '같은 기간(' + y0 + '→' + y1 + ') 서울 아파트 평균 실거래가는 연 <b>' + pct(gS) + '</b>, 미국 S&P 500 지수에 배당을 재투자한 경우(원화 환산)는 연 <b>' + pct(gP)
      + '</b>, 코스피 가격지수는 연 <b>' + pct(gK) + '</b> 올랐습니다. 1억 원 기준으로 각각 ' + won(1e8 * se[y1] / se[y0]) + ', ' + won(1e8 * sp[y1] / sp[y0]) + ', ' + won(1e8 * ks[y1] / ks[y0])
      + '입니다. 수익률뿐 아니라 시작 금액·비용·현금화·분산에서도 차이가 큽니다.');
    return { y0: y0, y1: y1, infl: infl, dep: cagr(1, dp[y1], n), seoul: gS, spy: gP };
  }

  /* ── 04 복리 계산 ── */
  var RATES = null;
  function fv(monthly, years, r) {                     /* 매달 말 적립, 월복리 환산 */
    var i = Math.pow(1 + r, 1 / 12) - 1, m = years * 12;
    return i === 0 ? monthly * m : monthly * (Math.pow(1 + i, m) - 1) / i;
  }
  function renderCalc() {
    if (!RATES) return;
    var mEl = $('hm-c-monthly'), yEl = $('hm-c-years');
    var monthly = (parseFloat(String(mEl.value).replace(/,/g, '')) || 0) * 1e4, years = +yEl.value || 1;
    setT('hm-c-years-v', years + '년');
    var list = [
      { name: '현금으로 모으기', r: 0, color: cssVar('--text3', '#777') },
      { name: '정기예금 (세후)', r: RATES.dep, color: C.dep },
      { name: '서울 아파트 상승률', r: RATES.seoul, color: C.seoul },
      { name: 'S&P 500 배당 재투자', r: RATES.spy, color: C.spytrk }
    ];
    var principal = monthly * 12 * years;
    var html = '<div class="hm-c-row" style="background:none;padding:2px 12px;"><span>총 투자 원금</span><b>' + won(principal) + '</b></div>';
    list.forEach(function (x) {
      var v = fv(monthly, years, x.r);
      html += '<div class="hm-c-row"><span><i style="background:' + x.color + ';"></i>' + x.name + '<small>연 ' + pct(x.r) + '</small></span><b>' + won(v)
        + (principal > 0 && x.r > 0 ? '<small>×' + (v / principal).toFixed(2) + '</small>' : '') + '</b></div>';
    });
    setH('hm-c-results', html);
    var late = years > 10 ? fv(monthly, years - 10, RATES.spy) : null, full = fv(monthly, years, RATES.spy);
    setH('hm-c-note', '연 수익률은 ' + RATES.y0 + '→' + RATES.y1 + '년 실제 연평균 값입니다. '
      + (late != null && monthly > 0 ? '같은 금액을 <b>10년 늦게</b> 시작하면(' + (years - 10) + '년) S&P 500 기준 결과는 ' + won(late) + ' — 일찍 시작한 쪽의 <b>' + (late > 0 ? (full / late).toFixed(1) : '—') + '배</b>입니다. ' : '')
      + '과거 수익률이 미래를 보장하지 않습니다.');
    var labels = [], dsets = list.map(function (x) { return line(x.name, [], x.color); }), pr = line('투자 원금', [], fgA(0.35), { borderWidth: 1 });
    for (var y = 0; y <= years; y++) {
      labels.push(y + '년');
      list.forEach(function (x, i) { dsets[i].data.push(Math.round(fv(monthly, y, x.r))); });
      pr.data.push(monthly * 12 * y);
    }
    draw('hm-c-chart', { type: 'line', data: { labels: labels, datasets: dsets.slice(1).concat([pr]) },
      options: baseOpts(function (v) { return v >= 1e8 ? (v / 1e8).toFixed(v >= 1e9 ? 0 : 1) + '억' : Math.round(v / 1e4).toLocaleString('ko-KR') + '만'; }, function (v) { return won(v); }) });
    /* 72의 법칙 */
    function dbl(r) { return r > 0 ? Math.log(2) / Math.log(1 + r) : Infinity; }
    setH('hm-72', [
      ['현금 가치가 절반으로', dbl(RATES.infl), '물가 연 ' + pct(RATES.infl)],
      ['정기예금 2배까지', dbl(RATES.dep), '세후 연 ' + pct(RATES.dep)],
      ['서울 아파트 2배까지', dbl(RATES.seoul), '연 ' + pct(RATES.seoul)],
      ['S&P 500 2배까지', dbl(RATES.spy), '배당 재투자 연 ' + pct(RATES.spy)]
    ].map(function (x) { return '<div>' + x[0] + '<b>' + (isFinite(x[1]) ? x[1].toFixed(1) + '년' : '—') + '</b>' + x[2] + '</div>'; }).join(''));
  }

  function render() {
    var page = $('page-home');
    if (!D || !page || !page.classList.contains('active')) return;
    renderKpis();
    renderCash();
    RATES = renderRace() || RATES;
    renderCalc();
    setT('hm-src', '출처: 한국은행 ECOS(소비자물가지수, 예금은행 정기예금 금리, 원/달러 환율, M2 통화량) · 국토교통부 실거래가 공개시스템(아파트 매매) · Yahoo Finance(코스피·S&P 500·나스닥 100·금 선물·SPY 분배금)'
      + (D.updated ? ' · 자료 갱신 ' + D.updated.slice(0, 10) : '') + '. 이 페이지는 투자 권유가 아닌 정보 제공을 위한 것이며, 과거 수익률이 미래 수익을 보장하지 않습니다.');
  }

  window.homeRender = function () {
    var page = $('page-home'); if (!page || !page.classList.contains('active')) return;
    if (D) { render(); return; }
    load().then(function (ok) { if (ok) render(); else setH('hm-bars', '<p class="hm-loading">데이터를 불러오지 못했습니다. 잠시 후 다시 열어 주세요.</p>'); });
  };
  /* 입력 */
  document.addEventListener('input', function (e) {
    if (e.target && e.target.id === 'hm-c-years') renderCalc();
    if (e.target && e.target.id === 'hm-c-monthly') {
      var el = e.target, t = el.value.replace(/[^0-9]/g, '');
      el.value = t ? parseInt(t, 10).toLocaleString('ko-KR') : '';
      renderCalc();
    }
  });
  /* 도구 바로가기: 실제 주소 링크(검색엔진용) + 클릭 시 페이지 이동 없이 탭 전환 */
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a.hm-tool');
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    var tab = a.getAttribute('data-tab'), btn = document.getElementById('drop-' + tab);
    if (!btn || typeof switchSubTab !== 'function') return;
    e.preventDefault();
    switchSubTab(tab, a.getAttribute('data-group'), btn);
    window.scrollTo(0, 0);
  });
  var resizeT = null;
  window.addEventListener('resize', function () { clearTimeout(resizeT); resizeT = setTimeout(function () { if (D) render(); }, 250); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(window.homeRender, 0); });
  else setTimeout(window.homeRender, 0);
})();

/* ════════════════════════════════════════
   [FC-ENGINE] 2026 금융 계산기 공용 계산 (순수 함수 · DOM 없음)
   연봉 실수령액 · 퇴직금(DB/DC)·퇴직소득세 · 주담대 LTV/DSR · 중개보수
   기준일: 2026-10 (근거는 각 상수 옆 주석)
════════════════════════════════════════ */
var FC = (function () {
  /* ── 공통 ── */
  function floor10(n) { return Math.floor(Math.max(0, n) / 10) * 10; }
  /* 종합소득세 기본세율 (2023년 이후, 2026 동일) */
  var BRACKETS = [[14e6, 0.06], [50e6, 0.15], [88e6, 0.24], [150e6, 0.35], [300e6, 0.38], [500e6, 0.40], [1e9, 0.42], [Infinity, 0.45]];
  function progressiveTax(base) {
    var prev = 0, t = 0;
    for (var i = 0; i < BRACKETS.length; i++) {
      var lim = BRACKETS[i][0], r = BRACKETS[i][1];
      if (base > prev) t += (Math.min(base, lim) - prev) * r;
      prev = lim;
    }
    return t;
  }

  /* ════ 4대보험 (근로자 부담분, 2026) ════
     국민연금 9.5% (근로자 4.75%) — 2026-01-01 시행 (2025 국민연금법 개정)
       기준소득월액 상·하한: 2025.7~2026.6 637만/40만, 2026.7~2027.6 659만/41만 (천원 미만 절사)
     건강보험 7.19% (근로자 3.595%) · 장기요양 = 건강보험료 × 0.9448/7.19 — 국민건강보험공단 2026
     고용보험 실업급여 근로자 0.9% — 2026 (인상안 미시행)
     보험료는 10원 미만 절사 (사이트 건강보험료 계산기와 같은 처리) */
  var INS = {
    pension: 0.0475, health: 0.03595, ltcRatio: 0.9448 / 7.19, employ: 0.009,
    pensionCap: function (ymd) { return (ymd || '') >= '2026-07' ? [410000, 6590000] : [400000, 6370000]; }
  };
  function insurance(monthlyTaxable, ymd) {
    var cap = INS.pensionCap(ymd);
    var base = Math.min(Math.max(Math.floor(monthlyTaxable / 1000) * 1000, cap[0]), cap[1]);
    var pension = floor10(base * INS.pension);
    var health = floor10(monthlyTaxable * INS.health);
    var ltc = floor10(health * INS.ltcRatio);
    var employ = floor10(monthlyTaxable * INS.employ);
    return { pensionBase: base, pension: pension, health: health, ltc: ltc, employ: employ, total: pension + health + ltc + employ };
  }

  /* ════ 근로소득 간이세액표 (소득세법 시행령 별표2, 2026-03-01 이후 원천징수분) ════
     표의 각 칸 = 해당 구간 '중간값' 월급여 × 12 를 총급여로 보고
       근로소득공제 → 인적공제(150만×가족수) → 연금보험료공제(구간값×4.5%, 기준소득월액 40만~449만으로 고정된 표 작성 가정)
       → 특별소득공제 등(가족수별 산식) → 기본세율 → 근로소득세액공제(한도) → ÷12, 10원 미만 절사
     (국세청 표의 칸 값과 대조해 일치 확인) · 월급여 1,000만원 초과는 별표2 산식 그대로 */
  function wageDeduction(G) {
    if (G <= 5e6) return G * 0.7;
    if (G <= 15e6) return 3.5e6 + (G - 5e6) * 0.4;
    if (G <= 45e6) return 7.5e6 + (G - 15e6) * 0.15;
    if (G <= 100e6) return 12e6 + (G - 45e6) * 0.05;
    return Math.min(14.75e6 + (G - 100e6) * 0.02, 20e6);
  }
  function specialDeduction(G, n) {
    var k = n >= 3 ? 3 : n;
    if (G > 120e6) return 0;
    if (k === 1) return G <= 30e6 ? 3.1e6 + G * 0.04 : G <= 45e6 ? 3.1e6 + G * 0.04 - (G - 30e6) * 0.05 : G <= 70e6 ? 3.1e6 + G * 0.015 : 3.1e6 + G * 0.005;
    if (k === 2) return G <= 30e6 ? 3.6e6 + G * 0.04 : G <= 45e6 ? 3.6e6 + G * 0.04 - (G - 30e6) * 0.05 : G <= 70e6 ? 3.6e6 + G * 0.02 : 3.6e6 + G * 0.01;
    var x = Math.max(0, G - 40e6) * 0.04;
    return G <= 30e6 ? 5e6 + G * 0.07 : G <= 45e6 ? 5e6 + G * 0.07 - (G - 30e6) * 0.05 + x : G <= 70e6 ? 5e6 + G * 0.05 + x : 5e6 + G * 0.03 + x;
  }
  function wageCredit(calc, G) {
    var c = calc <= 1.3e6 ? calc * 0.55 : 715000 + (calc - 1.3e6) * 0.3, lim;
    if (G <= 33e6) lim = 740000;
    else if (G <= 70e6) lim = Math.max(740000 - (G - 33e6) * 0.008, 660000);
    else if (G <= 120e6) lim = Math.max(660000 - (G - 70e6) * 0.5, 500000);
    else lim = Math.max(500000 - (G - 120e6) * 0.5, 200000);
    return Math.min(c, lim);
  }
  function tableCell(m, n) {               /* m: 구간 중간값(원), n: 공제대상가족 수(1~11) */
    var G = m * 12;
    var pen = Math.floor(Math.min(Math.max(m, 400000), 4490000) * 0.045) * 12;
    var ti = Math.max(0, G - wageDeduction(G) - 1.5e6 * n - pen - specialDeduction(G, n));
    var ct = progressiveTax(ti);
    var t = Math.max(0, ct - wageCredit(ct, G));
    return Math.floor(t / 12 / 10) * 10;
  }
  function simpleTaxBase(monthly, n) {     /* 자녀 공제 전 간이세액 */
    var k = Math.floor(monthly / 1000);   /* 천원 단위 */
    if (k < 770) return 0;
    if (k < 10000) {
      var w = k < 1500 ? 5 : k < 3000 ? 10 : 20;
      var lo = Math.floor(k / w) * w;
      return tableCell((lo + w / 2) * 1000, n);
    }
    var b = tableCell(10e6, n), x = monthly;
    if (x <= 10e6) return b;                                     /* 정확히 1,000만원 칸 */
    if (x <= 14e6) return Math.floor((b + (x - 10e6) * 0.98 * 0.35 + 25000) / 10) * 10;
    if (x <= 28e6) return Math.floor((b + 1397000 + (x - 14e6) * 0.98 * 0.38) / 10) * 10;
    if (x <= 30e6) return Math.floor((b + 6610600 + (x - 28e6) * 0.98 * 0.40) / 10) * 10;
    if (x <= 45e6) return Math.floor((b + 7394600 + (x - 30e6) * 0.40) / 10) * 10;
    if (x <= 87e6) return Math.floor((b + 13394600 + (x - 45e6) * 0.42) / 10) * 10;
    return Math.floor((b + 31034600 + (x - 87e6) * 0.45) / 10) * 10;
  }
  /* 8~20세 자녀 차감액 (2026-03-01~): 1명 20,830 · 2명 45,830 · 3명 이상 45,830 + 2명 초과 1명당 33,330 */
  function childCut(c) { return c <= 0 ? 0 : c === 1 ? 20830 : 45830 + Math.max(0, c - 2) * 33330; }
  function incomeTax(monthlyTaxable, family, kids, ratio) {
    var n = Math.min(Math.max(family | 0, 1), 11);
    var base = simpleTaxBase(monthlyTaxable, n);
    var t = Math.max(0, base - childCut(kids | 0));
    t = Math.floor(t * (ratio || 100) / 100 / 10) * 10;
    return { tax: t, local: Math.floor(t * 0.1 / 10) * 10, tableTax: base };
  }
  function salary(o) {   /* o: {annual, severanceIncluded, nontax(월), family, kids, ratio, ymd} */
    var annual = Math.max(0, o.annual || 0);
    var monthly = Math.floor(annual / (o.severanceIncluded ? 13 : 12));
    var nontax = Math.min(Math.max(0, o.nontax || 0), monthly);
    var taxable = monthly - nontax;
    var ins = insurance(taxable, o.ymd);
    var it = incomeTax(taxable, o.family, o.kids, o.ratio);
    var ded = ins.total + it.tax + it.local;
    return { monthly: monthly, taxable: taxable, nontax: nontax, ins: ins, tax: it, deduction: ded, net: monthly - ded };
  }

  /* ════ 퇴직소득세 (소득세법 제48조·제55조, 2023년 이후 공제표 — 2026 변경 없음) ════ */
  function serviceDeduction(y) {
    if (y <= 5) return 1e6 * y;
    if (y <= 10) return 5e6 + 2e6 * (y - 5);
    if (y <= 20) return 15e6 + 2.5e6 * (y - 10);
    return 40e6 + 3e6 * (y - 20);
  }
  function convDeduction(c) {
    if (c <= 8e6) return c;
    if (c <= 70e6) return 8e6 + (c - 8e6) * 0.6;
    if (c <= 100e6) return 45.2e6 + (c - 70e6) * 0.55;
    if (c <= 300e6) return 61.7e6 + (c - 100e6) * 0.45;
    return 151.7e6 + (c - 300e6) * 0.35;
  }
  function retirementTax(pay, years) {
    years = Math.max(1, years | 0);
    var sd = Math.min(serviceDeduction(years), pay);
    var conv = (pay - sd) * 12 / years;
    var cd = convDeduction(conv);
    var base = Math.max(0, conv - cd);
    var convTax = progressiveTax(base);
    var tax = Math.floor(convTax * years / 12);
    var local = Math.floor(tax * 0.1);
    return { serviceDed: sd, conv: conv, convDed: cd, base: base, convTax: convTax, tax: tax, local: local, total: tax + local };
  }

  /* ════ 중개보수 (공인중개사법 시행규칙 [별표1], 2021-10-19 시행 — 2026 요율 변경 없음) ════ */
  var BROKER = {
    sale: [[5e7, 0.006, 250000], [2e8, 0.005, 800000], [9e8, 0.004, null], [12e8, 0.005, null], [15e8, 0.006, null], [Infinity, 0.007, null]],
    lease: [[5e7, 0.005, 200000], [1e8, 0.004, 300000], [6e8, 0.003, null], [12e8, 0.004, null], [15e8, 0.005, null], [Infinity, 0.006, null]]
  };
  function brokerage(o) {   /* o: {kind:'sale'|'jeonse'|'monthly', prop:'house'|'officetel'|'other', price, deposit, rent} */
    var amount;
    if (o.kind === 'sale') amount = o.price || 0;
    else if (o.kind === 'jeonse') amount = o.deposit || 0;
    else {
      amount = (o.deposit || 0) + (o.rent || 0) * 100;
      if (amount < 5e7) amount = (o.deposit || 0) + (o.rent || 0) * 70;
    }
    var rate, cap = null, row = -1;
    if (o.prop === 'officetel') rate = o.kind === 'sale' ? 0.005 : 0.004;
    else if (o.prop === 'other') rate = 0.009;
    else {
      var tbl = o.kind === 'sale' ? BROKER.sale : BROKER.lease;
      for (var i = 0; i < tbl.length; i++) if (amount < tbl[i][0]) { rate = tbl[i][1]; cap = tbl[i][2]; row = i; break; }
    }
    var fee = Math.floor(amount * rate);
    if (cap != null) fee = Math.min(fee, cap);
    return { amount: amount, rate: rate, cap: cap, row: row, fee: fee, vat: Math.floor(fee * 0.1) };
  }

  /* ════ 주담대 LTV·DSR (2026-10 기준) ════
     규제지역: 서울 25개 구 + 경기 15곳(과천·광명·성남 분당·수정·중원·수원 영통·장안·팔달·안양 동안·의왕·하남·용인 수지, 2026-07-01 화성 동탄구·용인 기흥구·구리시 추가)
     LTV(주택 구입): 규제지역 무주택 40%·서민실수요자 60%·생애최초 70% / 비규제 수도권 70%(생애최초 70%) / 지방 70%(생애최초 80%)
                     다주택자 추가 구입: 수도권·규제지역 불가, 지방 60%(2차 자료)
     주담대 금액 상한(수도권·규제지역, 주택 구입 목적): 시가 15억 이하 6억 · 15억 초과~25억 4억 · 25억 초과 2억 (6.27·10.15 대책)
     DSR: 은행 40% · 2금융권 50%. 스트레스 금리: 수도권·규제지역 주담대 3.0%(2025-10-16~), 지방 0.75%(2026-12-31까지 유예)
          금리 유형별 반영 비율: 변동 100% · 혼합형(5년 이상 고정) 80% · 주기형 40% · 순수고정 0% (3단계, 2차 자료)
     수도권·규제지역 주담대 만기 최대 30년 (6.27) */
  var LTV = {
    reg:   { none: 0.40, seomin: 0.60, first: 0.70, one: 0.40, multi: 0 },
    metro: { none: 0.70, seomin: 0.70, first: 0.70, one: 0.70, multi: 0 },
    local: { none: 0.70, seomin: 0.70, first: 0.80, one: 0.70, multi: 0.60 }
  };
  var STRESS = { reg: 0.03, metro: 0.03, local: 0.0075 };
  var STRESS_SHARE = { variable: 1, mixed: 0.8, periodic: 0.4, fixed: 0 };
  function annuityFactor(rateY, years) {      /* 원금 1원당 연간 원리금 (월 원리금균등) */
    var i = rateY / 12, n = years * 12;
    return i === 0 ? 12 / n : 12 * i / (1 - Math.pow(1 + i, -n));
  }
  function mortgage(o) {   /* {price, region:'reg'|'metro'|'local', buyer, income, existingAnnual, dsrLimit, rate, years, type} */
    var ltvRate = LTV[o.region][o.buyer];
    var ltvLimit = Math.floor((o.price || 0) * ltvRate);
    var capLimit = Infinity, capNote = '';
    if (o.region !== 'local') {
      capLimit = o.price > 25e8 ? 2e8 : o.price > 15e8 ? 4e8 : 6e8;
      capNote = o.price > 25e8 ? '시가 25억 초과 → 2억' : o.price > 15e8 ? '시가 15억 초과~25억 → 4억' : '수도권·규제지역 → 6억';
    }
    var stress = STRESS[o.region] * STRESS_SHARE[o.type];
    var rateS = (o.rate || 0) + stress;
    var years = o.years;
    var room = Math.max(0, (o.income || 0) * o.dsrLimit - (o.existingAnnual || 0));
    var dsrLimit = Math.floor(room / annuityFactor(rateS, years));
    var limit = Math.max(0, Math.min(ltvLimit, capLimit, dsrLimit));
    limit = Math.floor(limit / 1e5) * 1e5;                         /* 10만원 단위 */
    var binding = limit === 0 && ltvRate === 0 ? 'ltv' : (Math.min(ltvLimit, capLimit, dsrLimit) === dsrLimit ? 'dsr' : Math.min(ltvLimit, capLimit) === capLimit ? 'cap' : 'ltv');
    var payY = limit * annuityFactor(o.rate || 0, years);
    return { ltvRate: ltvRate, ltvLimit: ltvLimit, capLimit: capLimit, capNote: capNote, stress: stress, rateS: rateS, room: room, dsrLimit: dsrLimit,
             limit: limit, binding: binding, monthlyPay: payY / 12, dsrUsed: o.income > 0 ? ((o.existingAnnual || 0) + limit * annuityFactor(rateS, years)) / o.income : 0 };
  }

  return { floor10: floor10, insurance: insurance, wageDeduction: wageDeduction, wageCredit: wageCredit, simpleTaxBase: simpleTaxBase, tableCell: tableCell, childCut: childCut, incomeTax: incomeTax, salary: salary,
           retirementTax: retirementTax, serviceDeduction: serviceDeduction, convDeduction: convDeduction, progressiveTax: progressiveTax,
           brokerage: brokerage, BROKER: BROKER, mortgage: mortgage, LTV: LTV, STRESS: STRESS, STRESS_SHARE: STRESS_SHARE, annuityFactor: annuityFactor };
})();

/* ════════════════════════════════════════
   [FC-UI] 2026 금융 계산기 화면 — 연봉 실수령액 · 퇴직금(DB/DC) · 주담대 LTV·DSR · 중개수수료
   계산은 [FC-ENGINE] 의 FC.* 순수 함수가 담당
════════════════════════════════════════ */
(function () {
  function $(id) { return document.getElementById(id); }
  function setT(id, v) { var e = $(id); if (e) e.textContent = v; }
  function setH(id, v) { var e = $(id); if (e) e.innerHTML = v; }
  function num(id) { var e = $(id); return e ? (parseFloat(String(e.value).replace(/,/g, '')) || 0) : 0; }
  var UNIT = { eok: 1e8, man: 1e4, won: 1 };
  function man(id) { var e = $(id); return Math.round(num(id) * (UNIT[e && e.getAttribute('data-unit')] || 1e4)); }   /* 입력값 → 원 (억원·만원·원 단위 반영) */
  function fmtIn(v, unit) {                            /* 원 금액을 단위에 맞춰 입력칸 글자로 */
    var d = v / UNIT[unit];
    return d ? commaFmt(unit === 'won' ? Math.round(d) : parseFloat(d.toFixed(4))) : (v === 0 ? '0' : '');
  }
  function won(n) { return Math.round(n).toLocaleString('ko-KR') + '원'; }
  function eok(n) {                                     /* 4억 8,000만원 */
    n = Math.round(n / 1e4) * 1e4;
    var e = Math.floor(n / 1e8), m = Math.round((n - e * 1e8) / 1e4);
    if (!e) return m.toLocaleString('ko-KR') + '만원';
    return e + '억' + (m ? ' ' + m.toLocaleString('ko-KR') + '만원' : '원');
  }
  function pct(v, d) { var t = (v * 100).toFixed(d == null ? 2 : d); if (t.indexOf('.') >= 0) t = t.replace(/\.?0+$/, ''); return t + '%'; }
  function seg(name) { var b = document.querySelector('.fc-seg[data-name="' + name + '"] .mode-btn.active'); return b ? b.getAttribute('data-v') : null; }
  function ym() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }
  function fillSelect(id, items, def) {
    var s = $(id); if (!s || s.options.length) return;
    s.innerHTML = items.map(function (x) { return '<option value="' + x[0] + '"' + (x[0] === def ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('');
  }

  /* ── 연봉 실수령액 ── */
  function salary() {
    fillSelect('sal-family', Array.from({ length: 11 }, function (_, i) { return [String(i + 1), (i + 1) + '명' + (i === 0 ? ' (본인만)' : '')]; }), '1');
    fillSelect('sal-kids', Array.from({ length: 8 }, function (_, i) { return [String(i), i + '명']; }), '0');
    var fam = +$('sal-family').value, kids = +$('sal-kids').value;
    if (kids > fam - 1) { fam = Math.min(11, kids + 1); $('sal-family').value = String(fam); }
    var opt = { annual: man('sal-annual'), severanceIncluded: seg('sal-sev') === '1', nontax: man('sal-nontax'), family: fam, kids: kids, ratio: +seg('sal-ratio') || 100, ymd: ym() };
    var r = FC.salary(opt);
    if (!(opt.annual > 0)) { setT('sal-net', '—'); setT('sal-net-sub', '연봉을 입력하세요'); return; }
    var i = r.ins, t = r.tax;
    setT('sal-net', won(r.net));
    setT('sal-net-sub', '연봉 ' + eok(opt.annual) + (opt.severanceIncluded ? ' (퇴직금 포함 ÷13)' : '') + ' · 공제율 ' + pct(r.deduction / r.monthly, 1) + ' · 부양가족 ' + fam + '명' + (kids ? ' · 8~20세 자녀 ' + kids + '명' : ''));
    setT('sal-k-gross', won(r.monthly));
    setT('sal-k-ded', '−' + won(r.deduction));
    setT('sal-k-year', eok(r.net * 12));
    var rows = [
      ['국민연금', '기준소득월액 ' + won(i.pensionBase), '4.75%', i.pension, '#3182f6'],
      ['건강보험', '보수월액 ' + won(r.taxable), '3.595%', i.health, '#5b9bff'],
      ['장기요양보험', '건강보험료 × 13.14%', '0.9448%', i.ltc, '#7fb2ff'],
      ['고용보험', '보수월액 ' + won(r.taxable), '0.9%', i.employ, '#a8c8ff'],
      ['근로소득세', '간이세액표 ' + fam + '명' + (kids ? '·자녀 ' + kids : '') + ' · ' + (seg('sal-ratio') || 100) + '%', '—', t.tax, '#f04452'],
      ['지방소득세', '소득세 × 10%', '10%', t.local, '#ff8a95']
    ];
    setH('sal-table', rows.map(function (x) { return '<tr><td>' + x[0] + '</td><td style="color:var(--text3);">' + x[1] + '</td><td>' + x[2] + '</td><td>' + won(x[3]) + '</td></tr>'; }).join('')
      + '<tr class="fc-total"><td>공제 합계</td><td></td><td>' + pct(r.deduction / r.monthly, 1) + '</td><td>' + won(r.deduction) + '</td></tr>'
      + '<tr class="fc-hl"><td>실수령액</td><td>월 급여 ' + won(r.monthly) + (r.nontax ? ' (비과세 ' + won(r.nontax) + ' 포함)' : '') + '</td><td></td><td>' + won(r.net) + '</td></tr>');
    setH('sal-bar', rows.map(function (x) { return '<span title="' + x[0] + ' ' + won(x[3]) + '" style="width:' + (x[3] / r.monthly * 100).toFixed(2) + '%;background:' + x[4] + ';"></span>'; }).join(''));
    setT('sal-ref-cond', '비과세 ' + eok(opt.nontax).replace('만원', '만') + ' · 부양가족 ' + fam + '명' + (kids ? ' · 자녀 ' + kids + '명' : '') + (opt.severanceIncluded ? ' · 퇴직금 포함' : ''));
    var list = [2400, 3000, 3500, 4000, 4500, 5000, 5500, 6000, 7000, 8000, 9000, 10000, 12000, 15000, 20000];
    var near = list.reduce(function (a, b) { return Math.abs(b * 1e4 - opt.annual) < Math.abs(a * 1e4 - opt.annual) ? b : a; });
    setH('sal-ref', list.map(function (a) {
      var x = FC.salary(Object.assign({}, opt, { annual: a * 1e4 }));
      return '<tr' + (a === near ? ' class="fc-hl"' : '') + '><td>' + eok(a * 1e4) + '</td><td>' + won(x.monthly) + '</td><td>' + won(x.ins.total) + '</td><td>' + won(x.tax.tax + x.tax.local) + '</td><td>' + won(x.net) + '</td></tr>';
    }).join(''));
  }

  /* ── 퇴직금 (법정·DB) ── */
  function parseDate(v) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || ''); return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null; }
  function addMonthsUTC(d, n) {
    var y = d.getUTCFullYear(), mo = d.getUTCMonth() + n, day = d.getUTCDate();
    var last = new Date(Date.UTC(y, mo + 1, 0)).getUTCDate();
    return new Date(Date.UTC(y, mo, Math.min(day, last)));
  }
  var DAY = 86400000;
  function severance() {
    var s = parseDate($('sev-start').value), e = parseDate($('sev-end').value);
    if (!s || !e || e <= s) { setT('sev-pay', '—'); setT('sev-pay-sub', '입사일과 퇴직일을 확인하세요 (퇴직일이 입사일보다 뒤)'); setH('sev-tax', ''); return; }
    var days = Math.round((e - s) / DAY);
    var p0 = addMonthsUTC(e, -3), d3 = Math.round((e - p0) / DAY);
    var wage3 = man('sev-wage3'), bonus = man('sev-bonus'), leave = man('sev-leave'), ord = man('sev-ordinary');
    var avg = (wage3 + bonus * 3 / 12 + leave * 3 / 12) / d3;
    var ordDaily = ord > 0 ? ord / 209 * 8 : 0, useOrd = ordDaily > avg;
    var daily = useOrd ? ordDaily : avg;
    var pay = Math.floor(daily * 30 * days / 365);
    var last = new Date(e - DAY);
    var months = (last.getUTCFullYear() - s.getUTCFullYear()) * 12 + (last.getUTCMonth() - s.getUTCMonth()) + (last.getUTCDate() >= s.getUTCDate() ? 1 : 0);
    var years = Math.max(1, Math.ceil(months / 12));
    var yy = Math.floor(days / 365.25), mm = Math.floor((days - yy * 365.25) / 30.44);
    setT('sev-k-days', days.toLocaleString('ko-KR') + '일');
    setT('sev-k-avg', won(Math.floor(daily)) + (useOrd ? ' (통상임금)' : ''));
    if (days < 365) {
      setT('sev-pay', '0원'); setT('sev-pay-sub', '계속근로기간이 1년 미만이라 법정 퇴직금 지급 대상이 아닙니다 (재직 ' + days + '일).');
      setT('sev-k-net', '—'); setH('sev-tax', ''); setT('sev-irp', ''); return;
    }
    var tx = FC.retirementTax(pay, years), net = pay - tx.total;
    setT('sev-pay', won(pay));
    setT('sev-pay-sub', '재직 약 ' + yy + '년 ' + mm + '개월 · 1일 평균임금 ' + won(Math.floor(daily)) + ' × 30일 × ' + days.toLocaleString('ko-KR') + '일 ÷ 365 · 평균임금 산정기간 ' + d3 + '일');
    setT('sev-k-net', won(net));
    var rows = [
      ['퇴직급여', won(pay)],
      ['근속연수', years + '년 (1년 미만 끝수는 1년)'],
      ['근속연수공제', '−' + won(tx.serviceDed)],
      ['환산급여', won(Math.floor(tx.conv)) + ' (×12÷' + years + ')'],
      ['환산급여공제', '−' + won(Math.floor(tx.convDed))],
      ['과세표준', won(Math.floor(tx.base))],
      ['환산산출세액', won(Math.floor(tx.convTax))],
      ['퇴직소득세', won(tx.tax) + ' (×' + years + '÷12)'],
      ['지방소득세', won(tx.local)],
      ['세금 합계', won(tx.total) + ' (실효세율 ' + (pay ? (tx.total / pay * 100).toFixed(2) : '0') + '%)']
    ];
    setH('sev-tax', rows.map(function (x, i) { return '<tr' + (i === rows.length - 1 ? ' class="fc-hl"' : '') + '><td>' + x[0] + '</td><td style="text-align:right;">' + x[1] + '</td></tr>'; }).join(''));
    setH('sev-irp', '퇴직금을 60일 안에 <b>IRP(개인형 퇴직연금)</b>로 옮기면 세금을 바로 내지 않고 미룰 수 있습니다. 나중에 연금으로 받으면 미룬 세금의 70%(10년 이내)·60%(10년 초과)·50%(20년 초과, 2026년 수령분부터)만 냅니다 — 연금 첫 10년 기준 약 '
      + won(Math.floor(tx.total * 0.7)) + '. 일시금으로 찾으면 전액 과세됩니다.');
  }

  /* ── DC형 시뮬레이션 ── */
  var dcChart = null;
  function dc() {
    var S = man('dc-salary'), N = +$('dc-years').value, g = +$('dc-raise').value / 100, r = +$('dc-return').value / 100;
    setT('dc-years-v', N + '년'); setT('dc-raise-v', (g * 100).toFixed(1) + '%'); setT('dc-return-v', (r * 100).toFixed(1) + '%');
    var bal = 0, paid = 0, labels = ['0년'], dcs = [0], dbs = [0];
    for (var y = 1; y <= N; y++) {
      var wage = S * Math.pow(1 + g, y - 1);
      bal = bal * (1 + r) + wage / 12; paid += wage / 12;
      labels.push(y + '년'); dcs.push(Math.round(bal)); dbs.push(Math.round(wage / 12 * y));
    }
    var db = dbs[N];
    setT('dc-total', eok(bal));
    setT('dc-sub', N + '년 근무 · 연봉 ' + eok(S) + '에서 매년 ' + (g * 100).toFixed(1) + '% 상승 · 운용수익률 연 ' + (r * 100).toFixed(1) + '% (세전)');
    setT('dc-k-paid', eok(paid)); setT('dc-k-gain', eok(bal - paid)); setT('dc-k-db', eok(db));
    setH('dc-note', 'DB형은 퇴직 직전 평균임금(최종 연봉의 1/12) × 근속연수로 계산했습니다. 운용수익률이 임금상승률보다 높으면 DC형이, 낮으면 DB형이 유리한 경향이 있습니다. 이 조건에서는 <b>' + (bal >= db ? 'DC형이 ' + eok(bal - db) : 'DB형이 ' + eok(db - bal)) + '</b> 더 많습니다. DC 적립금 중 운용수익은 수령 방법에 따라 과세 방식이 다릅니다.');
    var cv = $('dc-chart'); if (!cv || !window.Chart || !$('page-severance').classList.contains('active')) return;
    var tick = getComputedStyle(document.documentElement).getPropertyValue('--text3').trim() || '#888';
    var fmtY = function (v) { return v >= 1e8 ? (v / 1e8).toFixed(1) + '억' : Math.round(v / 1e4).toLocaleString('ko-KR') + '만'; };
    if (dcChart) dcChart.destroy();
    dcChart = new Chart(cv, { type: 'line', data: { labels: labels, datasets: [
      { label: 'DC형 적립금', data: dcs, borderColor: '#3182f6', backgroundColor: '#3182f6', borderWidth: 1.8, pointRadius: 0, tension: 0.15 },
      { label: 'DB형 퇴직금', data: dbs, borderColor: '#fe9800', backgroundColor: '#fe9800', borderWidth: 1.8, pointRadius: 0, tension: 0.15 }
    ] }, options: { responsive: true, maintainAspectRatio: false, animation: false, interaction: { mode: 'index', intersect: false },
      plugins: { legend: { position: 'bottom', labels: { color: tick, boxWidth: 10, boxHeight: 10, usePointStyle: true, pointStyle: 'rectRounded' } },
        tooltip: { callbacks: { label: function (c) { return ' ' + c.dataset.label + '  ' + eok(c.parsed.y); } } } },
      scales: { x: { grid: { display: false }, ticks: { color: tick, maxTicksLimit: 8, maxRotation: 0 }, border: { color: fgA(0.25) } },
                y: { position: 'right', grid: { color: fgA(0.07) }, border: { display: false }, ticks: { color: tick, callback: fmtY, maxTicksLimit: 6 } } } } });
  }

  /* ── 주담대 LTV·DSR ── */
  var BUYER = { none: '무주택자', seomin: '서민·실수요자', first: '생애최초', one: '1주택자(처분 조건)', multi: '다주택자' };
  var REGION = { reg: '규제지역', metro: '비규제 수도권', local: '지방' };
  function mortgage() {
    var region = seg('mtg-region') || 'reg';
    var ys = $('mtg-years');
    if (!ys.options.length) ys.innerHTML = [10, 15, 20, 25, 30, 35, 40].map(function (y) { return '<option value="' + y + '"' + (y === 30 ? ' selected' : '') + '>' + y + '년</option>'; }).join('');
    Array.prototype.forEach.call(ys.options, function (o) { o.disabled = region !== 'local' && +o.value > 30; });
    if (region !== 'local' && +ys.value > 30) ys.value = '30';
    var price = man('mtg-price'), income = man('mtg-income'), rate = num('mtg-rate') / 100, years = +ys.value;
    var credit = man('mtg-credit'), cRate = num('mtg-credit-rate') / 100;
    var existing = man('mtg-exist') + (credit > 0 ? credit / 5 + credit * cRate : 0);
    var buyer = $('mtg-buyer').value, type = $('mtg-type').value, dsrL = +(seg('mtg-bank') || 0.4);
    if (!(price > 0)) { setT('mtg-limit', '—'); setT('mtg-limit-sub', '주택 가격을 입력하세요'); return; }
    var r = FC.mortgage({ price: price, region: region, buyer: buyer, income: income, existingAnnual: existing, dsrLimit: dsrL, rate: rate, years: years, type: type });
    setT('mtg-limit', r.limit > 0 ? eok(r.limit) : '대출 불가');
    var why = r.ltvRate === 0 ? (BUYER[buyer] + '는 ' + REGION[region] + '에서 주택 구입 목적 주담대를 받을 수 없습니다.')
      : { ltv: 'LTV ' + pct(r.ltvRate, 0) + ' 한도가 가장 작아 최종 한도가 됩니다.', cap: '대출 금액 상한(' + r.capNote + ')이 최종 한도가 됩니다.', dsr: '소득 대비 상환 능력(DSR ' + pct(dsrL, 0) + ')이 최종 한도를 정합니다.' }[r.binding];
    setT('mtg-limit-sub', REGION[region] + ' · ' + BUYER[buyer] + ' · ' + eok(price) + ' 주택 — ' + why);
    setT('mtg-k-pay', r.limit > 0 ? won(Math.round(r.monthlyPay)) : '—');
    setT('mtg-k-own', eok(Math.max(0, price - r.limit)) + ' + 취득세 등');
    setT('mtg-k-dsr', income > 0 ? pct(r.dsrUsed, 1) + ' / ' + pct(dsrL, 0) : '—');
    var stressTxt = (FC.STRESS[region] * 100).toFixed(2).replace(/0$/, '') + '% × ' + (FC.STRESS_SHARE[type] * 100) + '% = ' + (r.stress * 100).toFixed(2) + '%p';
    var items = [
      ['ltv', 'LTV (주택 가격 대비)', r.ltvRate > 0 ? eok(r.ltvLimit) : '불가', eok(price) + ' × ' + pct(r.ltvRate, 0) + (buyer === 'first' ? ' · 6개월 안에 전입 조건' : buyer === 'seomin' && region === 'reg' ? ' · 부부 연소득 9천만원 이하·주택 8억 이하·무주택 세대주 조건' : '')],
      ['cap', '대출 금액 상한', r.capLimit === Infinity ? '없음' : eok(r.capLimit), r.capLimit === Infinity ? '지방은 금액 상한이 없습니다' : r.capNote + ' (주택 구입 목적 주담대, 6.27·10.15 대책)'],
      ['dsr', 'DSR (소득 대비 원리금)', eok(r.dsrLimit), '연소득 ' + eok(income) + ' × ' + pct(dsrL, 0) + ' − 기존 대출 연 원리금 ' + eok(existing) + ' = 연 ' + eok(r.room) + ' 상환 가능 · 심사 금리 ' + (r.rateS * 100).toFixed(2) + '% (대출 금리 ' + (rate * 100).toFixed(2) + '% + 스트레스 ' + stressTxt + ') · ' + years + '년 원리금균등']
    ];
    setH('mtg-limits', items.map(function (x) {
      return '<div class="fc-limit' + (x[0] === r.binding && r.limit >= 0 ? ' on' : '') + '"><b>' + x[1] + '</b><span class="v">' + x[2] + '</span><small>' + x[3] + '</small></div>';
    }).join('') + (r.limit + credit <= 1e8 && r.limit > 0 ? '<p class="fc-note">총 대출이 1억원 이하이면 차주단위 DSR(40%) 대신 금융회사 자체 기준이 적용될 수 있습니다.</p>' : ''));
  }

  /* ── 중개수수료 ── */
  function brokerage() {
    var kind = seg('brk-kind') || 'sale', prop = $('brk-prop').value;
    $('brk-price-f').style.display = kind === 'sale' ? '' : 'none';
    $('brk-deposit-f').style.display = kind === 'sale' ? 'none' : '';
    $('brk-rent-f').style.display = kind === 'monthly' ? '' : 'none';
    setT('brk-deposit-l', kind === 'jeonse' ? '전세 보증금' : '보증금');
    var r = FC.brokerage({ kind: kind, prop: prop, price: man('brk-price'), deposit: man('brk-deposit'), rent: man('brk-rent') });
    var vat = $('brk-vat').checked;
    setT('brk-fee', won(vat ? r.fee + r.vat : r.fee));
    setT('brk-fee-sub', (vat ? '중개보수 ' + won(r.fee) + ' + 부가가치세 ' + won(r.vat) : '부가가치세 별도 (일반과세자면 ' + won(r.vat) + ' 추가)') + ' · 거래 당사자 한쪽 기준 최대 금액');
    var amtTxt = eok(r.amount);
    if (kind === 'monthly') {
      var d = man('brk-deposit'), m = man('brk-rent'), x100 = d + m * 100;
      amtTxt += ' (' + (x100 < 5e7 ? '보증금 + 월세×70' : '보증금 + 월세×100') + ')';
    }
    setT('brk-k-amount', amtTxt);
    setT('brk-k-rate', (r.rate * 100).toFixed(1) + '%' + (prop === 'other' ? ' 이내 협의' : ''));
    setT('brk-k-cap', r.cap != null ? won(r.cap) : '없음');
    var sale = kind === 'sale';
    setT('brk-tbl-title', prop === 'house' ? '주택 ' + (sale ? '매매·교환' : '임대차(전세·월세)') + ' 상한요율표' : prop === 'officetel' ? '주거용 오피스텔 상한요율' : '주택 외 중개대상물 상한요율');
    var rows;
    if (prop === 'house') {
      var tbl = sale ? FC.BROKER.sale : FC.BROKER.lease, prev = 0;
      rows = tbl.map(function (t, i) {
        var label = (prev ? eok(prev) + ' 이상 ' : '') + (t[0] === Infinity ? '' : eok(t[0]) + ' 미만');
        prev = t[0];
        return '<tr' + (i === r.row ? ' class="fc-hl"' : '') + '><td>' + label + '</td><td>' + (t[1] * 100).toFixed(1) + '%</td><td>' + (t[2] ? won(t[2]) : '없음') + '</td></tr>';
      }).join('');
    } else if (prop === 'officetel') {
      rows = '<tr' + (sale ? ' class="fc-hl"' : '') + '><td>매매·교환</td><td>0.5%</td><td>없음</td></tr><tr' + (!sale ? ' class="fc-hl"' : '') + '><td>임대차 등</td><td>0.4%</td><td>없음</td></tr>';
    } else rows = '<tr class="fc-hl"><td>매매·교환·임대차 등</td><td>0.9% 이내 협의</td><td>없음</td></tr>';
    setH('brk-table', rows);
  }

  var RENDER = { sal: salary, sev: severance, dc: dc, mtg: mortgage, brk: brokerage };
  var PAGE = { salary: ['sal'], severance: ['sev', 'dc'], mortgage: ['mtg'], brokerage: ['brk'] };
  /* 다른 모듈의 계산기 등록 (예: [TAX-UI] 세금 계산기) — key: data-fc 값, fn: 그리기 함수, page: 탭 이름 */
  window.fcRegister = function (key, fn, page) { RENDER[key] = fn; (PAGE[page] = PAGE[page] || []).push(key); };
  window.fcRender = function (tab) {
    Object.keys(PAGE).forEach(function (p) {
      if (tab && tab !== p) return;
      var pg = $('page-' + p);
      if (pg && pg.classList.contains('active')) PAGE[p].forEach(function (k) { RENDER[k](); });
    });
  };
  document.addEventListener('input', function (e) {
    var el = e.target, k = el && el.getAttribute && el.getAttribute('data-fc');
    if (!k || !RENDER[k]) return;
    if (el.type === 'text' && !el.hasAttribute('data-raw')) {   /* data-raw: 숫자 서식 없이 그대로 (예: 나이 목록) */
      var cv = el.selectionStart, ov = el.value, f = typingNumFmt(ov);
      el.value = f;
      try { var pos = Math.max(0, cv + f.length - ov.length); el.setSelectionRange(pos, pos); } catch (err) {}
    }
    RENDER[k]();
  });
  document.addEventListener('change', function (e) { var k = e.target && e.target.getAttribute && e.target.getAttribute('data-fc'); if (!k || !RENDER[k]) return; if (e.target.tagName !== 'INPUT' || e.target.type === 'checkbox') RENDER[k](); });
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('.fc-seg .mode-btn');
    if (b) {
      var box = b.parentNode;
      box.querySelectorAll('.mode-btn').forEach(function (x) { x.classList.toggle('active', x === b); });
      var name = box.getAttribute('data-name');
      if (name === 'sev-mode') { $('sev-db').style.display = b.getAttribute('data-v') === 'db' ? '' : 'none'; $('sev-dc').style.display = b.getAttribute('data-v') === 'dc' ? '' : 'none'; }
      window.fcRender();
      return;
    }
    var q = e.target.closest && e.target.closest('.fc-quick[data-target] button');   /* 대상 입력칸이 있는 빠른 금액 버튼만 (다른 용도의 .fc-quick 버튼은 각 모듈이 처리) */
    if (q) {
      var wrap = q.parentNode, tgt = $(wrap.getAttribute('data-target'));
      if (!tgt) return;
      tgt.value = fmtIn(+q.getAttribute('data-v') * 1e4, tgt.getAttribute('data-unit') || 'man');   /* 버튼 값은 만원 기준 */
      if (RENDER[wrap.getAttribute('data-fc')]) RENDER[wrap.getAttribute('data-fc')]();
      return;
    }
    var u = e.target.closest && e.target.closest('.unit-btn[data-fc-unit]');
    if (u) {                                           /* 억원·만원·원 전환: 금액은 그대로, 표시만 바꿈 */
      var inp = $(u.getAttribute('data-fc-unit')), unit = u.getAttribute('data-unit');
      if (!inp) return;
      var wonV = man(inp.id), empty = inp.value === '';
      inp.setAttribute('data-unit', unit);
      if (!empty) inp.value = fmtIn(wonV, unit);
      u.parentNode.querySelectorAll('.unit-btn').forEach(function (b) { b.classList.toggle('active', b === u); });
      if (RENDER[inp.getAttribute('data-fc')]) RENDER[inp.getAttribute('data-fc')]();
    }
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { window.fcRender(); }); else window.fcRender();
})();

/* ════════════════════════════════════════
   [TAX-ENGINE] 2026 세금 계산기 공용 계산 (순수 함수 · DOM 없음) — 2026-10 기준 현행 세법
   해외주식 양도소득세 · 배당소득세·금융소득종합과세 · 연금저축·IRP 세액공제 · 증여세·상속세 · 부동산 취득세
   금액 단위: 원 · 세액은 원 미만 버림
════════════════════════════════════════ */
var TAX = (function () {
  function fl(n) { return Math.floor(Math.max(0, n) + 1e-7); }
  function nz(n) { n = +n; return isFinite(n) && n > 0 ? n : 0; }
  /* 누진세 — brackets: [[상한, 세율], …] */
  function prog(base, brackets) {
    var prev = 0, t = 0;
    base = Math.max(0, base);
    for (var i = 0; i < brackets.length; i++) {
      var lim = brackets[i][0], r = brackets[i][1];
      if (base > prev) t += (Math.min(base, lim) - prev) * r;
      prev = lim;
    }
    return t;
  }
  /* 종합소득세 기본세율 (소득세법 제55조, 2023년 이후 · 2026 동일) */
  var INCOME = [[14e6, 0.06], [50e6, 0.15], [88e6, 0.24], [150e6, 0.35], [300e6, 0.38], [500e6, 0.40], [1e9, 0.42], [Infinity, 0.45]];
  /* 상속세·증여세 세율 (상속세 및 증여세법 제26조·제56조) */
  var GIFT_RATES = [[1e8, 0.10], [5e8, 0.20], [1e9, 0.30], [3e9, 0.40], [Infinity, 0.50]];
  /* 고배당기업 배당소득 분리과세 (조세특례제한법 제104조의27, 2026.1.1~2028.12.31 지급분) */
  var HIGH_DIV = [[2e7, 0.14], [3e8, 0.20], [5e9, 0.25], [Infinity, 0.30]];

  /* ── 1. 해외주식 양도소득세 (소득세법 제94조·제103조·제104조, 조세특례제한법 국내시장 복귀계좌) ──
     trades: [{buy, sell, fee}] 원화 금액 (각 결제일 기준환율로 환산한 값)
     ria: {sale: RIA 계좌 매도금액, gain: 그 매도분 양도차익, rate: 공제율 0/0.5/0.8/1} */
  var OS_DEDUCT = 2.5e6, RIA_CAP = 5e7;
  function overseasStock(o) {
    var gain = 0, loss = 0;
    (o.trades || []).forEach(function (t) {
      var g = (+t.sell || 0) - (+t.buy || 0) - (+t.fee || 0);
      if (g >= 0) gain += g; else loss += -g;
    });
    var income = Math.max(0, gain - loss);                       /* 양도소득금액 (같은 해 손익 통산) */
    var ria = o.ria || {}, riaBase = 0, riaDed = 0;
    if (nz(ria.gain) && nz(ria.rate)) {
      riaBase = nz(ria.gain) * (nz(ria.sale) > RIA_CAP ? RIA_CAP / nz(ria.sale) : 1);   /* 매도금액 5천만원 한도 → 초과분은 비례 */
      riaDed = Math.min(income, riaBase * ria.rate);
    }
    var used = Math.min(nz(o.usedDeduction), OS_DEDUCT);          /* 같은 해 국내 대주주·비상장 주식 양도로 이미 쓴 기본공제 */
    var basic = Math.min(OS_DEDUCT - used, income - riaDed);
    var base = Math.max(0, income - riaDed - basic);
    var tax = fl(base * 0.20), local = fl(tax * 0.10);
    return { gain: gain, loss: loss, income: income, riaDed: fl(riaDed), basic: basic, base: base, tax: tax, local: local, total: tax + local,
             effective: income > 0 ? (tax + local) / income : 0 };
  }

  /* ── 2. 배당소득세·금융소득종합과세 (소득세법 제14조·제17조·제56조·제62조, 조특법 제104조의27) ──
     interest 이자 · gu 국내 상장사 배당(Gross-up 대상) · nongu 국내 ETF·펀드·리츠 분배금 등(Gross-up 비대상)
     foreign 해외주식 배당 · high 고배당기업 배당 · separate 고배당 분리과세 신청 · other 다른 종합소득 과세표준 */
  var FIN_LIMIT = 2e7, WH = 0.14, GU = 0.10;
  function financial(o) {
    var high = nz(o.high), sep = !!o.separate && high > 0;
    var G = nz(o.gu) + (sep ? 0 : high);                          /* Gross-up 대상 배당 */
    var N = nz(o.interest) + nz(o.nongu) + nz(o.foreign);         /* 이자 + Gross-up 비대상 배당 */
    var F = N + G;                                                 /* 종합과세 판정 금융소득 (Gross-up 전) */
    var other = nz(o.other);
    var withheld = fl(F * WH);                                     /* 지급 때 떼인 국세 14% (해외 배당은 14% 낸 것으로 봄) */
    var t0 = fl(prog(other, INCOME));                              /* 금융소득이 없을 때 다른 소득 세금 */
    var r = { F: F, G: G, N: N, t0: t0, comprehensive: F > FIN_LIMIT, withheld: withheld, grossUp: 0, base: other, general: 0, compare: 0,
              credit: 0, decided: t0 + withheld, extra: 0, sepTax: 0, sepWithheld: 0, sepExtra: 0 };
    if (F > FIN_LIMIT) {
      var gx = Math.min(G, F - FIN_LIMIT);                          /* 2천만원 초과분 중 Gross-up 대상 (이자 → 비대상 → 대상 순으로 채움) */
      var gup = fl(gx * GU);
      var base = other + F + gup;
      var A = prog(base - FIN_LIMIT, INCOME) + FIN_LIMIT * WH;      /* 일반산출세액 */
      var B = prog(base - F - gup, INCOME) + F * WH;                /* 비교산출세액 */
      var calc = Math.max(A, B);
      var credit = Math.min(gup, calc - B);                         /* 배당세액공제 (한도: 일반산출세액 − 비교산출세액) */
      r.grossUp = gup; r.base = base; r.general = fl(A); r.compare = fl(B); r.credit = fl(Math.max(0, credit));
      r.decided = fl(calc - Math.max(0, credit));
      r.extra = Math.max(0, r.decided - t0 - withheld);
    }
    if (sep) {
      r.sepTax = fl(prog(high, HIGH_DIV));
      r.sepWithheld = fl(high * WH);
      r.sepExtra = Math.max(0, r.sepTax - r.sepWithheld);
    }
    r.extraLocal = fl(r.extra * 0.1) + fl(r.sepExtra * 0.1);
    r.extraTotal = r.extra + r.sepExtra + r.extraLocal;
    r.withheldTotal = withheld + r.sepWithheld + fl(withheld * 0.1) + fl(r.sepWithheld * 0.1);   /* 지급 때 떼인 15.4% */
    r.finTax = r.withheldTotal + r.extraTotal;                      /* 금융소득에 붙는 세금 합계 (지방세 포함) */
    r.finTotal = F + (sep ? high : 0);
    return r;
  }

  /* ── 3. 연금저축·IRP 세액공제 (소득세법 제59조의3) ──
     wage: 근로소득만 있음(총급여 기준) · income: 총급여 또는 종합소득금액 · ps 연금저축 · irp · isa ISA 만기 전환액 · cap 결정세액(선택) */
  function pension(o) {
    var low = o.wage ? nz(o.income) <= 55e6 : nz(o.income) <= 45e6;
    var rate = low ? 0.15 : 0.12;
    var ps = Math.min(nz(o.ps), 6e6);
    var base = Math.min(ps + nz(o.irp), 9e6);
    var isa = Math.min(nz(o.isa) * 0.1, 3e6);
    var credit = fl((base + isa) * rate);
    var capped = o.cap != null && o.cap !== '' && isFinite(+o.cap) ? Math.min(credit, nz(o.cap)) : credit;
    var local = fl(capped * 0.1);
    return { rate: rate, low: low, ps: ps, base: base, isa: isa, credit: credit, capped: capped, local: local, total: capped + local,
             room: Math.max(0, 9e6 - base), psOver: Math.max(0, nz(o.ps) - 6e6), irpOver: Math.max(0, ps + nz(o.irp) - 9e6) };
  }

  /* ── 4-1. 증여세 (상속세 및 증여세법 제47조·제53조·제53조의2·제55조~제58조·제69조) ── */
  var GIFT_DED = { spouse: 6e8, adult: 5e7, minor: 2e7, parent: 5e7, relative: 1e7, other: 0 };
  function gift(o) {
    var amt = nz(o.amount), prior = nz(o.prior), total = amt + prior;   /* 10년 안에 같은 사람(부모는 부·모 합산)에게 받은 증여 합산 */
    var ded = Math.min(GIFT_DED[o.rel] || 0, total);
    var desc = (o.rel === 'adult' || o.rel === 'minor');                /* 직계존속 → 직계비속 */
    var mar = desc ? Math.min(nz(o.marriage), 1e8, total - ded) : 0;   /* 혼인·출산 증여재산공제 (최대 1억, 직계존속에게 받은 경우) */
    var base = Math.max(0, total - ded - mar);
    if (base < 5e5) base = 0;                                           /* 과세최저한 50만원 */
    var calc = fl(prog(base, GIFT_RATES));
    var skip = 0;
    if (o.skipGen && calc > 0) skip = fl(calc * (o.rel === 'minor' && total > 2e9 ? 0.4 : 0.3));   /* 세대생략 할증 */
    var prev = Math.min(nz(o.priorTax), calc + skip);                  /* 이미 낸 증여세 공제 */
    var report = fl((calc + skip - prev) * 0.03);                        /* 신고세액공제 3% (기한 내 신고) */
    var pay = Math.max(0, calc + skip - prev - report);
    return { total: total, ded: ded, mar: mar, base: base, calc: calc, skip: skip, prev: prev, report: report, pay: pay,
             rate: base > 0 ? marginal(base, GIFT_RATES) : 0 };
  }
  function marginal(base, br) { for (var i = 0; i < br.length; i++) if (base <= br[i][0]) return br[i][1]; return br[br.length - 1][1]; }

  /* ── 4-2. 상속세 (상속세 및 증여세법 제13조·제14조·제18조~제24조·제26조·제28조·제69조) ──
     estate 상속재산(사전증여 제외) · fin 그중 순금융재산 · debt 채무·공과금 · funeral 장례비 · prior 사전증여재산 · priorDed 그때 받은 증여재산공제
     priorTax 그때 낸 증여세 · spouse 배우자 생존 · spouseAmt 배우자 실제 상속액 · kids 자녀 수 · parents 부모 수(자녀 없을 때 상속인)
     minors [나이…] · elders 65세 이상(배우자 제외) · house 동거주택 상속공제 대상액 */
  function inheritance(o) {
    var estate = nz(o.estate), debt = nz(o.debt), prior = nz(o.prior), kids = Math.max(0, Math.floor(nz(o.kids)));
    var funeral = nz(o.funeral), fd = funeral < 5e6 ? 5e6 : Math.min(funeral, 1e7);   /* 장례비: 500만원 미만이면 500만원, 최대 1천만원 (봉안시설 별도) */
    var taxable = Math.max(0, estate - debt - fd + prior);                             /* 상속세 과세가액 */
    var minors = (o.minors || []).filter(function (a) { return a >= 0 && a < 19; });
    var person = kids * 5e7 + minors.reduce(function (s, a) { return s + (19 - Math.floor(a)) * 1e7; }, 0) + nz(o.elders) * 5e7;
    var parents = kids ? 0 : Math.max(0, Math.floor(nz(o.parents)));
    var spouseSole = o.spouse && !kids && !parents;
    var basicPerson = 2e8 + person;
    var lump = spouseSole ? basicPerson : Math.max(5e8, basicPerson);                  /* 일괄공제 5억 (배우자 단독상속은 불가) */
    var sp = 0, spLimit = 0, share = 0;
    if (o.spouse) {
      share = kids ? 1.5 / (1.5 + kids) : parents ? 1.5 / (1.5 + parents) : 1;      /* 배우자 법정상속분 */
      spLimit = Math.min(Math.max(0, (estate + prior - debt) * share), 3e9);
      sp = Math.max(5e8, Math.min(nz(o.spouseAmt), spLimit));                          /* 최소 5억 · 최대 30억 */
    }
    var fin = nz(o.fin), finDed = fin <= 2e7 ? fin : fin <= 1e8 ? 2e7 : Math.min(fin * 0.2, 2e8);
    var house = Math.min(nz(o.house), 6e8);
    var dedSum = lump + sp + finDed + house;
    var limit = Math.max(0, taxable - Math.max(0, prior - nz(o.priorDed)));             /* 공제 종합한도: 과세가액 − 사전증여재산 과세표준 */
    var ded = Math.min(dedSum, limit);
    var base = Math.max(0, taxable - ded);
    if (base < 5e5) base = 0;
    var calc = fl(prog(base, GIFT_RATES));
    var gcred = Math.min(nz(o.priorTax), calc);
    var report = fl((calc - gcred) * 0.03);
    var pay = Math.max(0, calc - gcred - report);
    return { funeralDed: fd, taxable: taxable, person: person, basicPerson: basicPerson, lump: lump, spouseSole: spouseSole, share: share, spLimit: spLimit, sp: sp,
             finDed: finDed, house: house, dedSum: dedSum, limit: limit, ded: ded, base: base, calc: calc, gcred: gcred, report: report, pay: pay,
             rate: base > 0 ? marginal(base, GIFT_RATES) : 0 };
  }

  /* ── 5. 부동산 취득세 (지방세법 제11조·제13조의2·제151조, 농어촌특별세법 제4조·제5조, 지방세특례제한법 제36조의3·제36조의5) ──
     kind: buy(주택 유상) · gift(주택 증여) · inherit(주택 상속) · land(주택 외 유상: 토지·상가 등)
     price 취득가액(증여·상속은 시가인정액 등) · big 전용 85㎡ 초과 · houses 취득 후 1세대 주택 수 · adj 조정대상지역
     temp 일시적 2주택 · cheap 시가표준액 1억원 이하 · giftHeavy 증여 중과 요건 · relief none/first/firstSmall/birth
     감면(산출세액이 한도 이하면 면제, 넘으면 한도만큼 공제):
       first 생애최초 200만원 · firstSmall 생애최초 300만원(전용 60㎡·3억원[수도권 6억원] 이하 연립·다세대·도시형생활주택·다가구, 인구감소지역 주택)
       birth 출산·양육 500만원 — 모두 12억원 이하 (지특법 제36조의3·제36조의5, 2028.12.31까지)
     지방교육세: 감면율(감면액 ÷ 산출세액)만큼 같이 줄어듦 (지방세법 제151조제1항제1호 다목1)
     농어촌특별세: 85㎡ 이하 서민주택은 비과세(농특세법 제4조제9호·제11호, 시행령 제4조제5항),
       85㎡ 초과는 본세분(표준세율 2%로 산출한 취득세 × 10%, 제5조제1항제6호 — '산출세액'은 감면 전 금액)에 감면세액의 20%(제5조제1항제1호)를 더함 */
  var RELIEF = { first: 2e6, firstSmall: 3e6, birth: 5e6 };
  function houseRate(p) {                                            /* 주택 유상거래 표준세율 */
    if (p <= 6e8) return 0.01;
    if (p > 9e8) return 0.03;
    return Math.round((p * 2 / 3e8 - 3) * 100) / 1e4;                /* (취득가액 × 2/3억 − 3) × 1/100 → 세율을 소수점 다섯째 자리에서 반올림해 넷째 자리까지 (7억원 → 0.0167 = 1.67%, 위택스와 같음) */
  }
  function acquisition(o) {
    var p = nz(o.price), kind = o.kind || 'buy', big = !!o.big, h = Math.max(1, Math.floor(nz(o.houses) || 1));
    var rate, edu, farm, heavy = 0, note = '';
    if (kind === 'land') { rate = 0.04; edu = 0.004; farm = 0.002; }
    else if (kind === 'inherit') { rate = 0.028; edu = 0.0016; farm = big ? 0.002 : 0; }
    else if (kind === 'gift') {
      if (o.giftHeavy && !o.cheap) { rate = 0.12; edu = 0.004; farm = big ? 0.01 : 0; heavy = 0.12; }
      else { rate = 0.035; edu = 0.003; farm = big ? 0.002 : 0; }
    } else {
      if (!o.cheap && !(h === 2 && o.temp)) {
        if (h === 2 && o.adj) heavy = 0.08;
        else if (h === 3) heavy = o.adj ? 0.12 : 0.08;
        else if (h >= 4) heavy = 0.12;
      }
      if (heavy) { rate = heavy; edu = 0.004; farm = big ? (heavy === 0.08 ? 0.006 : 0.01) : 0; }
      else { rate = houseRate(p); edu = rate * 0.1; farm = big ? 0.002 : 0; }
    }
    var acq = fl(p * rate), edu0 = fl(p * edu), farm0 = fl(p * farm);
    var relief = 0, reliefOk = false, ratio = 0, eduRelief = 0, farmRelief = 0;
    if (o.relief && o.relief !== 'none') {
      reliefOk = kind === 'buy' && !heavy && p <= 12e8 && h === 1;
      if (!reliefOk) note = '감면 요건(주택 유상취득 · 1주택 · 12억원 이하 · 중과 아님)에 맞지 않아 감면을 빼고 계산했습니다';
      else {
        relief = Math.min(acq, RELIEF[o.relief] || 0);
        ratio = acq > 0 ? relief / acq : 0;                              /* 감면율 */
        eduRelief = edu0 - fl(edu0 * (1 - ratio));
      }
    }
    var acqPay = acq - relief, eduT = edu0 - eduRelief;
    var farmOnRelief = big ? fl(relief * 0.2) : 0;                       /* 감면분 농어촌특별세 (85㎡ 초과만) */
    var farmT = farm0 - farmRelief + farmOnRelief;
    return { rate: rate, edu: edu, farm: farm, heavy: heavy, acq: acq, relief: relief, ratio: ratio, acqPay: acqPay,
             edu0: edu0, eduRelief: eduRelief, eduT: eduT, farm0: farm0, farmRelief: farmRelief, farmOnRelief: farmOnRelief, farmT: farmT,
             total: acqPay + eduT + farmT, totalRate: rate + edu + farm, note: note, reliefOk: reliefOk };
  }

  /* ── 0. 종합소득세 (2026년 귀속 — 법제처 원문 확인: 소득세법 2026.7.1 시행, 시행령 2026.10.1, 시행규칙 2026.7.1, 조특법·시행령 2026.9.18)
     소득세법 제14조(분리과세연금 1,500만원)·제17조(배당가산 10%)·제47조(근로소득공제)·제47조의2(연금소득공제)·제50조·제51조(인적공제)·제51조의3(연금보험료)
     ·제55조(세율)·제56조(배당세액공제)·제56조의2(기장 20%·100만원)·제59조(근로소득세액공제)·제59조의2(자녀 25/55/+40만, 출산 30/50/70만)·제59조의3(연금계좌)
     ·제59조의4⑨(표준 13만·성실사업자 12만·그 외 7만)·제62조(금융소득 비교과세)·제64조의4(사적연금 15% 선택), 시행령 제143조·시행규칙 제67조(기준경비율·배율 3.4/2.8)
     조특법 제86조의3(노란우산 600/500/400/200만)·제104조의8·시행령 제104조의5(전자신고 1만원, 확정신고 예외자 5천원 한도)
     사업: revenue · expMode 'book'(필요경비) / 'rate'(단순경비율) / 'std'(기준경비율) · expense · expRate(단순 %) · major 매입비용·임차료 · labor 인건비 · stdRate(기준 %) · double 복식부기의무자 · wh3
     근로: salary · insurance · special · wageTax / 금융: finInt 이자 · finGu 국내 상장사 배당 · finNon 그 밖의 배당(ETF·해외 등)
     연금: pub 공적연금 총연금액 · pubTax 공적연금 연말정산 세액 · priv 사적연금(연금계좌) 과세분 · privTax 사적연금 원천징수세액
     결손금(제45조): carry 이월결손금 잔액(15년 이내 발생분) · rental 비주거용 부동산임대업(결손금은 임대소득에서만 공제)
       당해 장부 결손금 → 근로·연금·기타·이자·배당 순, 이월결손금 → 사업·근로·연금·기타·이자·배당 순(추계신고면 이월결손금 공제 불가)
       금융소득은 기본세율 적용 부분(2천만원 초과분)만 공제 대상이고 공제 여부·금액은 선택 → 세금이 줄어드는 만큼만 자동으로 공제
     기타: otherIncome · otherTax · interim / 공제·세액공제: people · elders · disabled · woman · single · pension · noyu · otherDed · kids · birth · ps · irp · bookkeeping · honest · efile · otherCredit */
  var NOYU = [[4e7, 6e6], [6e7, 5e6], [1e8, 4e6], [Infinity, 2e6]];   /* 노란우산공제 소득공제 한도 (사업소득금액 기준) */
  function pensionDeduction(t) {                                      /* 연금소득공제 (최대 900만원) */
    var d = t <= 3.5e6 ? t : t <= 7e6 ? 3.5e6 + (t - 3.5e6) * 0.4 : t <= 14e6 ? 4.9e6 + (t - 7e6) * 0.2 : 6.3e6 + (t - 14e6) * 0.1;
    return Math.min(d, 9e6);
  }
  function bizIncome(o) {
    var rev = nz(o.revenue), mode = o.expMode || 'book';
    if (mode === 'rate') { var e = rev * Math.min(100, nz(o.expRate)) / 100; return { biz: rev - e, exp: e }; }
    if (mode === 'std') {                                             /* 기준소득금액 = 수입 − (매입비용·임차료 + 인건비 + 수입 × 기준경비율[복식부기의무자 1/2]) */
      var parts = nz(o.major) + nz(o.labor) + rev * Math.min(100, nz(o.stdRate)) / 100 * (o.double ? 0.5 : 1);
      var std = rev - Math.min(rev, parts);
      var simple = rev - rev * Math.min(100, nz(o.expRate)) / 100, mult = o.double ? 3.4 : 2.8;
      var cap = nz(o.expRate) > 0 ? simple * mult : Infinity;          /* 단순경비율 소득금액 × 배율 한도 (2027년 귀속까지) */
      var biz = Math.min(std, cap);
      return { biz: biz, exp: rev - biz, std: std, cap: cap, mult: mult, capped: cap < std };
    }
    var ex = nz(o.expense); return { biz: rev - ex, exp: ex };
  }
  function comprehensive(o, noAlt) {
    var W = typeof FC !== 'undefined' ? FC : null;
    var rev = nz(o.revenue), bi = bizIncome(o), biz = bi.biz;
    var G = nz(o.salary), wageDed = G && W ? Math.floor(W.wageDeduction(G)) : 0, wage = Math.max(0, G - wageDed);
    var other = nz(o.otherIncome);
    /* 연금소득: 사적연금 1,500만원 이하는 분리과세(원천징수로 끝) */
    var pub = nz(o.pub), priv = nz(o.priv), privSep = priv <= 1.5e7, privIn = privSep ? 0 : priv;
    var penTotal = pub + privIn, penDed = Math.floor(pensionDeduction(penTotal)), penInc = Math.max(0, penTotal - penDed);
    /* 금융소득: 2천만원 초과면 종합과세 (이자 → 그 밖의 배당 → 국내 상장사 배당 순으로 2천만원을 채움) */
    var fInt = nz(o.finInt), fGu = nz(o.finGu), fNon = nz(o.finNon), F = fInt + fGu + fNon, finComp = F > 2e7;
    var gup = finComp ? fl(Math.min(fGu, F - 2e7) * 0.1) : 0;
    /* ── 결손금·이월결손금 (소득세법 제45조) ── */
    var estimate = bi.estimate || (o.expMode === 'rate' || o.expMode === 'std');
    var lossCurr = Math.max(0, -biz), rental = !!o.rental;
    var inc = { biz: Math.max(0, biz), wage: wage, pen: penInc, other: other };
    var useCurr = { wage: 0, pen: 0, other: 0 }, lossLeft = rental ? 0 : lossCurr;   /* 부동산임대업 결손금은 다른 소득에서 공제 안 함 */
    ['wage', 'pen', 'other'].forEach(function (k) { var u = Math.min(lossLeft, inc[k]); useCurr[k] = u; inc[k] -= u; lossLeft -= u; });
    var carry = nz(o.carry), carryOk = carry > 0 && !estimate, carryLeft = carryOk ? carry : 0, useCarry = { biz: 0, wage: 0, pen: 0, other: 0 };
    (rental ? ['biz'] : ['biz', 'wage', 'pen', 'other']).forEach(function (k) { var u = Math.min(carryLeft, inc[k]); useCarry[k] = u; inc[k] -= u; carryLeft -= u; });
    var nonFin = inc.biz + inc.wage + inc.pen + inc.other;
    var finBasic = finComp ? F + gup - 2e7 : 0;                         /* 금융소득 중 기본세율 적용 부분 — 결손금 공제 가능 */
    var finPool = rental ? 0 : lossLeft + carryLeft;                     /* 금융소득에 쓸 수 있는 남은 결손금 (부동산임대업은 불가) */
    var bizPos = Math.max(0, biz);
    /* 소득공제 */
    var people = Math.max(1, Math.floor(nz(o.people) || 1)), basic = people * 1.5e6;
    var preTotal = nonFin + (finComp ? F + gup : 0);                    /* 부녀자공제 판정용 (금융소득 상계 전) */
    var add = Math.floor(nz(o.elders)) * 1e6 + Math.floor(nz(o.disabled)) * 2e6 + (o.single ? 1e6 : (o.woman && preTotal <= 3e7 ? 5e5 : 0));
    var pension = nz(o.pension), ins = G ? nz(o.insurance) : 0, noyuLim = 0;
    for (var i = 0; i < NOYU.length; i++) if (bizPos <= NOYU[i][0]) { noyuLim = NOYU[i][1]; break; }
    var noyu = Math.min(nz(o.noyu), noyuLim, bizPos);
    var dedRaw = basic + add + pension + ins + noyu + nz(o.otherDed);
    /* 금융소득 상계액 x 에 따른 세액 — 비교산출세액은 x 와 무관, 일반산출세액만 줄어듦 → 줄어드는 동안만 공제 */
    function taxAt(x) {
      var b = Math.max(0, nonFin + (finComp ? F + gup - x : 0) - dedRaw);
      if (!finComp) return { base: b, A: 0, B: 0, calc: prog(b, INCOME) };
      var A = prog(b - 2e7, INCOME) + 2e7 * 0.14, B = prog(Math.max(0, b - (F + gup - x)), INCOME) + F * 0.14;
      return { base: b, A: A, B: B, calc: Math.max(A, B) };
    }
    var finOff = 0, cap = Math.min(finPool, finBasic);
    if (finComp && cap > 0) {
      var t0 = taxAt(0);
      if (t0.A > t0.B) {
        if (taxAt(cap).A >= t0.B) finOff = cap;
        else { var lo = 0, hi = cap; for (var it = 0; it < 60; it++) { var mid = (lo + hi) / 2; if (taxAt(mid).A > t0.B) lo = mid; else hi = mid; } finOff = Math.ceil(hi); }
      }
    }
    /* 금융소득 상계는 당해 결손금 먼저, 다음 이월결손금 (제45조⑥) */
    var finFromCurr = Math.min(finOff, lossLeft), finFromCarry = finOff - finFromCurr;
    lossLeft -= finFromCurr; carryLeft -= finFromCarry;
    var total = nonFin + (finComp ? F + gup - finOff : 0);              /* 종합소득금액 (결손금 공제 후) */
    var tx = taxAt(finOff), base = tx.base;
    /* 산출세액 */
    var calc, general = 0, compare = 0, divCr = 0;
    if (finComp) {
      general = tx.A; compare = tx.B;                                    /* 일반산출세액 · 비교산출세액 */
      calc = fl(Math.max(general, compare));
      divCr = Math.max(0, Math.min(gup, fl(calc - compare)));           /* 배당세액공제 */
    } else calc = fl(tx.calc);
    /* 세액공제 */
    var wageCr = G && total > 0 && W ? fl(W.wageCredit(calc * inc.wage / total, G)) : 0;   /* 결손금 공제 후 근로소득금액 비율 */
    var k = Math.floor(nz(o.kids)), child = k <= 0 ? 0 : k === 1 ? 25e4 : 55e4 + (k - 2) * 40e4;
    var birth = [0, 3e5, 5e5, 7e5][Math.min(3, Math.floor(nz(o.birth)))] || 0;
    var onlyWage = G > 0 && !rev && !other && !penTotal && !finComp;
    var penLow = onlyWage ? G <= 55e6 : total <= 45e6, penRate = penLow ? 0.15 : 0.12;
    var penBase = Math.min(Math.min(nz(o.ps), 6e6) + nz(o.irp), 9e6), penCr = fl(penBase * penRate);
    var book = o.bookkeeping && inc.biz > 0 && total > 0 ? Math.min(fl(calc * inc.biz / total * 0.2), 1e6) : 0;
    var itemized = G ? nz(o.special) : 0, useStd = !G || itemized <= 13e4;
    var std = useStd ? (G ? 13e4 : total > 0 ? (o.honest && rev > 0 ? 12e4 : 7e4) : 0) : 0;
    var special = useStd ? 0 : itemized;
    var exempt = !rev && !other && !finComp && !privIn;                /* 확정신고 예외자(근로·공적연금만) — 전자신고 5천원 한도 */
    var before = wageCr + child + birth + penCr + book + std + special + divCr + nz(o.otherCredit);
    var efile = o.efile ? (exempt ? 5e3 : 1e4) : 0;
    var creditsRaw = before + efile, credits = Math.min(creditsRaw, calc);
    var decided = calc - credits;
    /* 이미 낸 세금 */
    var wh = o.wh3 ? fl(rev * 0.03) : 0, finWh = finComp ? fl(F * 0.14) : 0;
    var prepaid = wh + nz(o.wageTax) + nz(o.otherTax) + nz(o.interim) + finWh + nz(o.pubTax) + (privSep ? 0 : nz(o.privTax));
    var r = { rev: rev, exp: bi.exp, biz: biz, bi: bi, G: G, wageDed: wageDed, wage: wage, other: other, pub: pub, priv: priv, privSep: privSep,
      penTotal: penTotal, penDed: penDed, penInc: penInc, F: F, finComp: finComp, gup: gup, total: total,
      lossCurr: lossCurr, rental: rental, useCurr: useCurr, carry: carry, carryOk: carryOk, estimate: estimate, useCarry: useCarry,
      finBasic: finBasic, finOff: finOff, finFromCurr: finFromCurr, finFromCarry: finFromCarry,
      lossNext: lossLeft + (rental ? lossCurr : 0), carryNext: carryLeft + (carry > 0 && !carryOk ? carry : 0),
      basic: basic, add: add, pension: pension, ins: ins, noyu: noyu, noyuLim: noyuLim, dedRaw: dedRaw, base: base, calc: calc, general: fl(general), compare: fl(compare),
      rate: base > 0 ? marginal(base, INCOME) : 0, wageCr: wageCr, child: child, birth: birth, penRate: penRate, penCr: penCr, book: book, std: std, special: special,
      divCr: divCr, efile: Math.min(efile, Math.max(0, calc - before)), creditsRaw: creditsRaw, credits: credits, decided: decided,
      wh: wh, finWh: finWh, prepaid: prepaid, privOption: 'comprehensive', privOptTax: 0 };
    /* 사적연금 1,500만원 초과: 종합과세와 '사적연금 × 15% + 나머지 결정세액' 중 적은 쪽 (제64조의4) */
    if (privIn && !noAlt) {
      var alt = comprehensive(Object.assign({}, o, { priv: 0 }), true), altTax = fl(privIn * 0.15) + alt.decided;
      if (altTax < decided) { r.decided = altTax; r.privOption = 'separate15'; r.privOptTax = fl(privIn * 0.15); r.altDecided = alt.decided; }
      r.compDecided = decided; r.altTax = altTax;
    }
    r.due = r.decided - prepaid;
    r.localDue = fl(r.decided * 0.1) - fl(prepaid * 0.1);
    r.totalDue = r.due + r.localDue;
    return r;
  }

  return { comprehensive: comprehensive, pensionDeduction: pensionDeduction, NOYU: NOYU, prog: prog, INCOME: INCOME, GIFT_RATES: GIFT_RATES, HIGH_DIV: HIGH_DIV, GIFT_DED: GIFT_DED, RELIEF: RELIEF,
           overseasStock: overseasStock, financial: financial, pension: pension, gift: gift, inheritance: inheritance,
           houseRate: houseRate, acquisition: acquisition };
})();

/* ════════════════════════════════════════
   [TAX-UI] 세금 계산기 화면 — 계산은 [TAX-ENGINE] 의 TAX.* 순수 함수
   입력칸(data-fc)·억/만/원 단위·버튼 토글은 [FC-UI] 공통 처리를 그대로 씀 (window.fcRegister 로 등록)
════════════════════════════════════════ */
(function () {
  function $(id) { return document.getElementById(id); }
  function setT(id, v) { var e = $(id); if (e) e.textContent = v; }
  function setH(id, v) { var e = $(id); if (e) e.innerHTML = v; }
  function numOf(e) { return e ? (parseFloat(String(e.value).replace(/,/g, '')) || 0) : 0; }
  var UNIT = { eok: 1e8, man: 1e4, won: 1 };
  function amt(id) { var e = $(id); return Math.round(numOf(e) * (UNIT[e && e.getAttribute('data-unit')] || 1e4)); }   /* 입력 → 원 */
  function won(n) { return (n < 0 ? '−' : '') + Math.round(Math.abs(n)).toLocaleString('ko-KR') + '원'; }
  function eok(n) {
    var neg = n < 0; n = Math.round(Math.abs(n) / 1e4) * 1e4;
    var e = Math.floor(n / 1e8), m = Math.round((n - e * 1e8) / 1e4), s;
    if (!e) s = m.toLocaleString('ko-KR') + '만원'; else s = e.toLocaleString('ko-KR') + '억' + (m ? ' ' + m.toLocaleString('ko-KR') + '만원' : '원');
    return (neg ? '−' : '') + s;
  }
  function pct(v, d) { var t = (v * 100).toFixed(d == null ? 2 : d); if (t.indexOf('.') >= 0) t = t.replace(/\.?0+$/, ''); return t + '%'; }
  function seg(name) { var b = document.querySelector('.fc-seg[data-name="' + name + '"] .mode-btn.active'); return b ? b.getAttribute('data-v') : null; }
  function chk(id) { var e = $(id); return !!(e && e.checked); }
  function show(id, on) { var e = $(id); if (e) e.style.display = on ? '' : 'none'; }
  function rows(list) {
    return list.filter(Boolean).map(function (r) { return '<tr' + (r[2] ? ' class="' + r[2] + '"' : '') + '><td>' + r[0] + '</td><td>' + r[1] + '</td></tr>'; }).join('');
  }

  /* ── 1. 해외주식 양도소득세 ── */
  function ost() {
    var mode = seg('ost-mode') || 'row';
    show('ost-row-box', mode === 'row'); show('ost-sum-box', mode === 'sum');
    var trades = [];
    if (mode === 'row') {
      document.querySelectorAll('#ost-rows .ost-row').forEach(function (tr) {
        function g(k) { return numOf(tr.querySelector('[data-k="' + k + '"]')); }
        var buy = g('buy') * g('buyfx'), sell = g('sell') * g('sellfx'), fee = g('fee') * g('sellfx');
        var out = tr.querySelector('.ost-gl');
        if (!buy && !sell) { if (out) { out.textContent = '—'; out.className = 'ost-gl'; } return; }
        trades.push({ buy: buy, sell: sell, fee: fee });
        var gl = sell - buy - fee;
        if (out) { out.textContent = (gl > 0 ? '+' : '') + won(gl); out.className = 'ost-gl ' + (gl < 0 ? 'fc-blue' : 'fc-red'); }
      });
    } else {
      trades.push({ buy: 0, sell: amt('ost-gain'), fee: 0 });
      trades.push({ buy: amt('ost-loss'), sell: 0, fee: 0 });
    }
    var on = chk('ost-ria');
    show('ost-ria-box', on);
    var r = TAX.overseasStock({ trades: trades, usedDeduction: amt('ost-used'),
      ria: on ? { sale: amt('ost-ria-sale'), gain: amt('ost-ria-gain'), rate: +$('ost-ria-when').value } : null });
    setT('ost-pay', won(r.total));
    setT('ost-pay-sub', r.total > 0
      ? '양도소득세 ' + won(r.tax) + ' + 지방소득세 ' + won(r.local) + ' · 매도한 다음 해 5월에 직접 신고·납부'
      : r.income > 0 ? '양도소득금액이 공제 금액 이하라 낼 세금이 없습니다 (그래도 신고는 해 두면 좋습니다)' : '이익이 없어 낼 세금이 없습니다 — 손실은 다음 해로 넘어가지 않습니다');
    setT('ost-k-income', won(r.income));
    setT('ost-k-ded', won(r.basic + r.riaDed));
    setT('ost-k-eff', r.income > 0 ? pct(r.effective) : '—');
    setH('ost-table', rows([
      ['매도 이익 합계', won(r.gain)],
      ['매도 손실 합계', r.loss ? '−' + won(r.loss) : '0원'],
      ['양도소득금액 <small>(같은 해 이익·손실 통산)</small>', won(r.income)],
      on ? ['국내시장 복귀계좌(RIA) 공제', r.riaDed ? '−' + won(r.riaDed) : '0원'] : null,
      ['기본공제 <small>(연 250만원)</small>', r.basic ? '−' + won(r.basic) : '0원'],
      ['과세표준', won(r.base)],
      ['양도소득세 <small>(20%)</small>', won(r.tax)],
      ['지방소득세 <small>(양도소득세의 10%)</small>', won(r.local)],
      ['납부할 세금 합계', won(r.total), 'fc-total']]));
  }

  /* ── 2. 배당소득세·금융소득종합과세 ── */
  function div() {
    var high = amt('div-high');
    show('div-sep-row', high > 0);
    var o = { interest: amt('div-int'), gu: amt('div-gu'), nongu: amt('div-etf'), foreign: amt('div-for'), high: high,
              separate: high > 0 && chk('div-sep'), other: amt('div-other') };
    var r = TAX.financial(o);
    var fin = r.F + (o.separate ? high : 0);
    setT('div-pay', won(r.extraTotal));
    var sub;
    if (r.extraTotal > 0) sub = '5월 종합소득세 신고 때 더 낼 세금 (지방소득세 포함) · 지급 때 이미 ' + won(r.withheldTotal) + ' 떼임';
    else if (!fin) sub = '이자·배당 금액을 넣어 주세요';
    else if (!r.comprehensive) sub = '금융소득이 연 2천만원 이하라 지급 때 떼인 15.4%로 세금이 끝납니다 (분리과세)';
    else sub = '종합과세 대상이지만 다른 소득이 적어 추가로 낼 세금이 없습니다';
    setT('div-pay-sub', sub);
    setT('div-k-fin', eok(fin));
    setT('div-k-comp', r.comprehensive ? '대상 (2천만원 초과)' : '아님');
    setT('div-k-wh', won(r.withheldTotal));
    setH('div-table', rows([
      ['종합과세 판정 금융소득 <small>(이자 + 배당' + (o.separate ? ', 분리과세 신청한 고배당 제외' : '') + ')</small>', won(r.F)],
      r.comprehensive ? ['2천만원 초과분 <small>(다른 소득과 합산)</small>', won(r.F - 2e7)] : null,
      r.comprehensive ? ['배당가산액 Gross-up <small>(국내 상장사 배당 중 초과분 × 10%)</small>', won(r.grossUp)] : null,
      r.comprehensive ? ['종합소득 과세표준', won(r.base)] : null,
      r.comprehensive ? ['일반산출세액 <small>(초과분 기본세율 + 2천만원 × 14%)</small>', won(r.general) + (r.general >= r.compare ? ' ✓' : '')] : null,
      r.comprehensive ? ['비교산출세액 <small>(금융소득 전부 14% + 다른 소득 기본세율)</small>', won(r.compare) + (r.compare > r.general ? ' ✓' : '')] : null,
      r.comprehensive ? ['배당세액공제', r.credit ? '−' + won(r.credit) : '0원'] : null,
      r.comprehensive ? ['결정세액 <small>(다른 소득 포함)</small>', won(r.decided)] : null,
      r.comprehensive ? ['다른 소득만 있을 때 세액', '−' + won(r.t0)] : null,
      ['지급 때 떼인 소득세 <small>(14%)</small>', (r.comprehensive ? '−' : '') + won(r.withheld)],
      r.comprehensive ? ['종합과세로 더 낼 소득세', won(r.extra), 'fc-hl'] : null,
      o.separate ? ['고배당기업 배당 분리과세 세액 <small>(14~30%)</small>', won(r.sepTax)] : null,
      o.separate ? ['고배당 분리과세로 더 낼 소득세 <small>(이미 떼인 14% 뺀 금액)</small>', won(r.sepExtra), 'fc-hl'] : null,
      ['더 낼 지방소득세 <small>(10%)</small>', won(r.extraLocal)],
      ['5월에 더 낼 세금 합계', won(r.extraTotal), 'fc-total'],
      ['이자·배당에 붙는 세금 총액 <small>(떼인 것 + 더 낼 것)</small>', won(r.finTax)]]));
    /* 고배당 분리과세 신청 vs 미신청 비교 */
    if (high > 0) {
      var a = TAX.financial(Object.assign({}, o, { separate: true })), b = TAX.financial(Object.assign({}, o, { separate: false }));
      var d = b.finTax - a.finTax;
      setH('div-compare', '<b>고배당기업 배당 분리과세</b> — 신청하면 이자·배당 세금 총액 <b>' + won(a.finTax) + '</b>, 신청하지 않으면 <b>' + won(b.finTax) + '</b>. ' +
        (Math.abs(d) < 1 ? '두 방식의 세금이 같습니다.' : d > 0 ? '<b class="fc-red">신청하는 쪽이 ' + won(d) + ' 유리</b>합니다.' : '<b class="fc-blue">신청하지 않는 쪽이 ' + won(-d) + ' 유리</b>합니다 (배당세액공제 혜택이 더 큼).'));
      show('div-compare', true);
    } else show('div-compare', false);
  }

  /* ── 3. 연금저축·IRP 세액공제 ── */
  function pen() {
    var wage = (seg('pen-kind') || 'wage') === 'wage';
    setT('pen-income-l', wage ? '총급여 (연봉에서 비과세 소득 뺀 금액)' : '종합소득금액');
    var capRaw = $('pen-cap') ? String($('pen-cap').value).trim() : '';
    var r = TAX.pension({ wage: wage, income: amt('pen-income'), ps: amt('pen-ps'), irp: amt('pen-irp'), isa: amt('pen-isa'),
                          cap: capRaw === '' ? null : amt('pen-cap') });
    setT('pen-pay', won(r.total));
    setT('pen-pay-sub', '세액공제 ' + won(r.capped) + ' + 지방소득세 ' + won(r.local) + ' · 공제율 ' + (r.low ? '16.5%' : '13.2%') + ' (지방소득세 포함)' +
      (r.capped < r.credit ? ' · 결정세액 한도로 ' + won(r.credit - r.capped) + ' 덜 받음' : ''));
    setT('pen-k-base', won(r.base + r.isa));
    setT('pen-k-rate', r.low ? '16.5%' : '13.2%');
    setT('pen-k-room', r.room ? eok(r.room) : '한도 다 채움');
    setH('pen-table', rows([
      ['연금저축 공제대상 <small>(최대 600만원)</small>', won(r.ps) + (r.psOver ? ' <small>(초과 ' + won(r.psOver) + ' 제외)</small>' : '')],
      ['연금저축 + IRP 공제대상 <small>(합산 최대 900만원)</small>', won(r.base) + (r.irpOver ? ' <small>(초과 ' + won(r.irpOver) + ' 제외)</small>' : '')],
      r.isa ? ['ISA 만기 전환 추가 공제대상 <small>(전환액 10%, 최대 300만원)</small>', won(r.isa)] : null,
      ['공제율 <small>(' + (wage ? '총급여 5,500만원' : '종합소득금액 4,500만원') + (r.low ? ' 이하' : ' 초과') + ')</small>', (r.rate * 100) + '% + 지방 ' + (r.rate * 10) + '%'],
      ['세액공제 (소득세)', won(r.capped)],
      ['지방소득세 공제', won(r.local)],
      ['환급(절세) 예상액', won(r.total), 'fc-total']]));
  }

  /* ── 4. 증여세·상속세 ── */
  function gif() {
    var mode = seg('gif-mode') || 'gift';
    show('gif-gift-in', mode === 'gift'); show('gif-inh-in', mode === 'inherit');
    if (mode === 'gift') {
      var rel = $('gif-rel').value, desc = rel === 'adult' || rel === 'minor';
      show('gif-skip-f', desc); show('gif-mar-f', desc);
      var r = TAX.gift({ rel: rel, amount: amt('gif-amount'), prior: amt('gif-prior'), priorTax: amt('gif-prior-tax'),
                         marriage: desc && chk('gif-mar') ? 1e8 : 0, skipGen: desc && chk('gif-skip') });
      setT('gif-label', '납부할 증여세 (신고세액공제 반영)');
      setT('gif-pay', won(r.pay));
      setT('gif-pay-sub', r.pay > 0 ? '증여받은 달의 말일부터 3개월 안에 받은 사람이 신고·납부 · 적용 세율 ' + pct(r.rate, 0)
        : '증여재산공제 안이라 낼 세금이 없습니다 (신고는 해 두면 나중에 자금 출처 증빙에 도움)');
      setT('gif-k1-l', '증여재산 (10년 합산)'); setT('gif-k1', eok(r.total));
      setT('gif-k2-l', '공제 합계'); setT('gif-k2', eok(r.ded + r.mar));
      setT('gif-k3-l', '과세표준'); setT('gif-k3', eok(r.base));
      setH('gif-table', rows([
        ['이번 증여재산 + 10년 안 같은 사람 증여', won(r.total)],
        ['증여재산공제 <small>(관계별, 10년 합산 한도)</small>', r.ded ? '−' + won(r.ded) : '0원'],
        r.mar ? ['혼인·출산 증여재산공제', '−' + won(r.mar)] : null,
        ['과세표준', won(r.base)],
        ['산출세액 <small>(10~50% 누진)</small>', won(r.calc)],
        r.skip ? ['세대생략 할증 <small>(' + (r.skip >= r.calc * 0.4 - 1 ? '40%' : '30%') + ')</small>', '+' + won(r.skip)] : null,
        r.prev ? ['이미 낸 증여세 공제', '−' + won(r.prev)] : null,
        ['신고세액공제 <small>(3%)</small>', r.report ? '−' + won(r.report) : '0원'],
        ['납부할 증여세', won(r.pay), 'fc-total']]));
    } else {
      var kids = +$('inh-kids').value, sp = (seg('inh-spouse') || 'yes') === 'yes';
      show('inh-parents-f', kids === 0); show('inh-spamt-f', sp);
      var minors = String($('inh-minors').value || '').split(/[^0-9]+/).filter(function (x) { return x !== ''; }).map(Number);
      var q = TAX.inheritance({ estate: amt('inh-estate'), fin: amt('inh-fin'), debt: amt('inh-debt'), funeral: amt('inh-funeral'),
        prior: amt('inh-prior'), priorDed: amt('inh-prior-ded'), priorTax: amt('inh-prior-tax'), spouse: sp, spouseAmt: amt('inh-spamt'),
        kids: kids, parents: +$('inh-parents').value, minors: minors, elders: +$('inh-elders').value, house: amt('inh-house') });
      setT('gif-label', '납부할 상속세 (신고세액공제 반영)');
      setT('gif-pay', won(q.pay));
      setT('gif-pay-sub', q.pay > 0 ? '돌아가신 달의 말일부터 6개월 안에 신고·납부 (상속인 모두 연대 납부) · 적용 세율 ' + pct(q.rate, 0)
        : '상속공제 안이라 낼 상속세가 없습니다');
      setT('gif-k1-l', '상속세 과세가액'); setT('gif-k1', eok(q.taxable));
      setT('gif-k2-l', '상속공제 (적용액)'); setT('gif-k2', eok(q.ded));
      setT('gif-k3-l', '과세표준'); setT('gif-k3', eok(q.base));
      setH('gif-table', rows([
        ['상속재산 − 채무 − 장례비 <small>(장례비 공제 ' + eok(q.funeralDed) + ')</small> + 사전증여', won(q.taxable)],
        [q.spouseSole ? '기초공제 + 인적공제 <small>(배우자 단독상속은 일괄공제 불가)</small>' : '일괄공제 5억원 또는 기초공제 2억원 + 인적공제 ' + eok(q.person) + ' 중 큰 것', '−' + won(q.lump)],
        sp ? ['배우자공제 <small>(실제 상속액 기준, 최소 5억 · 법정상속분 한도 ' + eok(q.spLimit) + ' · 최대 30억)</small>', '−' + won(q.sp)] : null,
        q.finDed ? ['금융재산 상속공제', '−' + won(q.finDed)] : null,
        q.house ? ['동거주택 상속공제', '−' + won(q.house)] : null,
        q.dedSum > q.limit ? ['공제 종합한도 적용 <small>(공제 합계 ' + eok(q.dedSum) + ' → 한도 ' + eok(q.limit) + ')</small>', '−' + won(q.ded)] : null,
        ['과세표준', won(q.base)],
        ['산출세액 <small>(10~50% 누진)</small>', won(q.calc)],
        q.gcred ? ['사전증여 때 낸 증여세 공제', '−' + won(q.gcred)] : null,
        ['신고세액공제 <small>(3%)</small>', q.report ? '−' + won(q.report) : '0원'],
        ['납부할 상속세', won(q.pay), 'fc-total']]));
    }
  }

  /* ── 5. 부동산 취득세 ── */
  function acq() {
    var kind = seg('acq-kind') || 'buy', buy = kind === 'buy';
    show('acq-big-f', kind !== 'land'); show('acq-houses-f', buy); show('acq-adj-f', buy); show('acq-cheap-f', buy);
    show('acq-relief-f', buy); show('acq-gheavy-f', kind === 'gift');
    var houses = +$('acq-houses').value;
    show('acq-temp-f', buy && houses === 2);
    setT('acq-price-l', kind === 'buy' || kind === 'land' ? '취득가액 (실거래가)' : '시가인정액 (매매사례가 등, 없으면 시가표준액)');
    var r = TAX.acquisition({ kind: kind, price: amt('acq-price'), big: kind !== 'land' && chk('acq-big'), houses: houses, adj: chk('acq-adj'),
      temp: chk('acq-temp'), cheap: chk('acq-cheap'), giftHeavy: chk('acq-gheavy'), relief: buy ? $('acq-relief').value : 'none' });
    setT('acq-pay', won(r.total));
    setT('acq-pay-sub', '취득세 ' + won(r.acqPay) + ' + 지방교육세 ' + won(r.eduT) + ' + 농어촌특별세 ' + won(r.farmT) + (r.relief ? ' · 감면 반영' : ' · 합계 세율 ' + pct(r.totalRate, 4)) +
      (r.heavy ? ' · 다주택·증여 중과' : '') + ' · 취득일부터 60일 안에 신고·납부');
    setT('acq-k1', pct(r.rate, 4)); setT('acq-k2', pct(r.edu, 4)); setT('acq-k3', r.farm ? pct(r.farm, 4) : '비과세');
    setT('acq-note', r.note);
    show('acq-note', !!r.note);
    setH('acq-table', rows([
      ['취득세 <small>(' + pct(r.rate, 4) + ')</small>', won(r.acq)],
      r.relief ? ['취득세 감면 <small>(' + ({ first: '생애최초 200만원 한도', firstSmall: '생애최초 300만원 한도', birth: '출산·양육 500만원 한도' })[$('acq-relief').value] + ' · 감면율 ' + pct(r.ratio, 2) + ')</small>', '−' + won(r.relief)] : null,
      ['지방교육세 <small>(' + pct(r.edu, 4) + ')</small>', won(r.edu0)],
      r.eduRelief ? ['지방교육세 감면 <small>(취득세 감면율만큼 · 지방세법 제151조)</small>', '−' + won(r.eduRelief)] : null,
      ['농어촌특별세 <small>(' + (r.farm ? pct(r.farm, 4) : kind === 'land' ? '0.2%' : '전용 85㎡ 이하 서민주택 비과세') + ')</small>', won(r.farm0)],
      r.farmOnRelief ? ['감면분 농어촌특별세 <small>(감면세액 × 20% · 85㎡ 초과)</small>', '+' + won(r.farmOnRelief)] : null,
      ['납부할 세금 합계', won(r.total), 'fc-total']]));
  }

  /* ── 0. 종합소득세 ── */
  function inc() {
    var mode = seg('inc-exp-mode') || 'book';
    show('inc-exp-f', mode === 'book'); show('inc-std-f', mode === 'std'); show('inc-rate-f', mode !== 'book');
    setT('inc-rate-l', mode === 'std' ? '업종별 단순경비율 (기준경비율 소득금액의 한도 계산용)' : '업종별 단순경비율');
    var o = { revenue: amt('inc-rev'), expMode: mode, expense: amt('inc-exp'), expRate: numOf($('inc-rate')), major: amt('inc-major'), labor: amt('inc-labor'),
      stdRate: numOf($('inc-stdrate')), double: chk('inc-double'), wh3: chk('inc-wh3'),
      salary: amt('inc-sal'), insurance: amt('inc-ins'), special: amt('inc-special'), wageTax: amt('inc-wagetax'),
      finInt: amt('inc-fint'), finGu: amt('inc-fgu'), finNon: amt('inc-fnon'),
      pub: amt('inc-pub'), pubTax: amt('inc-pubtax'), priv: amt('inc-priv'), privTax: amt('inc-privtax'),
      otherIncome: amt('inc-oth'), otherTax: amt('inc-othtax'), interim: amt('inc-interim'),
      people: +$('inc-people').value, elders: +$('inc-elders').value, disabled: +$('inc-dis').value, woman: chk('inc-woman'), single: chk('inc-single'),
      pension: amt('inc-pension'), noyu: amt('inc-noyu'), otherDed: amt('inc-otherded'),
      kids: +$('inc-kids').value, birth: +$('inc-birth').value, ps: amt('inc-ps'), irp: amt('inc-irp'), bookkeeping: chk('inc-book'),
      honest: chk('inc-honest'), efile: chk('inc-efile'), otherCredit: amt('inc-othercr'), carry: amt('inc-carry'), rental: chk('inc-rental') };
    var r = TAX.comprehensive(o);
    /* 접은 항목에 보이는 요약 */
    function sum(key, txt) {
      var e = $('inc-sum-' + key); if (!e) return;
      e.textContent = txt || '입력 없음'; e.classList.toggle('on', !!txt);
      var d = e.closest('.inc-sec'); if (d) d.classList.toggle('has-v', !!txt);   /* 값이 있으면 접었을 때 부제 숨김 → 요약이 잘리지 않게 */
    }
    sum('biz', r.rev ? (r.biz < 0 ? '결손금 ' + eok(-r.biz) : '소득금액 ' + eok(r.biz)) : '');
    sum('loss', r.carry ? '이월결손금 ' + eok(r.carry) + (r.carryOk ? '' : ' · 추계라 공제 불가') : '');
    sum('wage', r.G ? '총급여 ' + eok(r.G) : '');
    sum('fin', r.F ? eok(r.F) + (r.finComp ? ' · 종합과세' : ' · 분리과세') : '');
    sum('pen', r.pub || r.priv ? [r.pub ? '공적 ' + eok(r.pub) : '', r.priv ? '사적 ' + eok(r.priv) : ''].filter(Boolean).join(' · ') : '');
    sum('oth', r.other ? eok(r.other) : '');
    sum('ded', '공제 ' + eok(Math.min(r.dedRaw, r.total)));
    sum('cr', r.credits ? '세액공제 ' + won(r.credits) : '');
    sum('paid', o.interim ? eok(o.interim) : '');
    var refund = r.totalDue < 0;
    setT('inc-label', refund ? '5월에 돌려받을 세금 (지방소득세 포함)' : '5월에 낼 종합소득세 (지방소득세 포함)');
    setT('inc-pay', won(Math.abs(r.totalDue)));
    var hv = $('inc-pay'); if (hv) hv.classList.toggle('fc-blue', refund);
    setT('inc-pay-sub', '종합소득세 ' + won(r.due) + ' + 지방소득세 ' + won(r.localDue) + ' · 결정세액 ' + won(r.decided) + '에서 이미 낸 ' + won(r.prepaid) + '을 뺀 금액');
    setT('inc-k1', eok(r.total)); setT('inc-k2', eok(r.base)); setT('inc-k3', r.base > 0 ? pct(r.rate, 0) : '—');
    var bi = r.bi;
    setH('inc-table', rows([
      r.rev ? ['사업소득 수입금액', won(r.rev)] : null,
      r.rev ? ['필요경비 <small>(' + (mode === 'rate' ? '단순경비율 ' + o.expRate + '%' : mode === 'std' ? '기준경비율' + (bi.capped ? ' — 단순경비율 소득 × ' + bi.mult + ' 한도 적용' : '') : '장부·증빙') + ')</small>', '−' + won(r.exp)] : null,
      r.rev ? ['사업소득금액', won(r.biz)] : null,
      r.G ? ['근로소득금액 <small>(총급여 ' + eok(r.G) + ' − 근로소득공제 ' + eok(r.wageDed) + ')</small>', won(r.wage)] : null,
      r.penTotal ? ['연금소득금액 <small>(총연금액 ' + eok(r.penTotal) + ' − 연금소득공제 ' + eok(r.penDed) + ')</small>', won(r.penInc)] : null,
      r.priv && r.privSep ? ['사적연금 ' + eok(r.priv) + ' <small>(1,500만원 이하 — 분리과세로 끝)</small>', '합산 안 함'] : null,
      r.other ? ['기타소득금액', won(r.other)] : null,
      r.F ? ['금융소득 ' + eok(r.F) + (r.finComp ? ' <small>(2천만원 초과 — 종합과세, 배당가산 ' + won(r.gup) + ' 포함)</small>' : ' <small>(2천만원 이하 — 15.4% 분리과세로 끝)</small>'), r.finComp ? won(r.F + r.gup) : '합산 안 함'] : null,
      r.lossCurr ? ['당해 사업 결손금' + (r.rental ? ' <small>(부동산임대업 — 다른 소득에서 공제 안 함)</small>' : ''), '−' + won(r.lossCurr)] : null,
      r.lossCurr && !r.rental ? ['결손금 공제 <small>(' + [['근로', r.useCurr.wage], ['연금', r.useCurr.pen], ['기타', r.useCurr.other], ['금융', r.finFromCurr]].filter(function (x) { return x[1] > 0; }).map(function (x) { return x[0] + ' ' + eok(x[1]); }).join(' · ') + ')</small>', '−' + won(r.useCurr.wage + r.useCurr.pen + r.useCurr.other + r.finFromCurr)] : null,
      r.carry ? (r.carryOk ? ['이월결손금 공제 <small>(' + ([['사업', r.useCarry.biz], ['근로', r.useCarry.wage], ['연금', r.useCarry.pen], ['기타', r.useCarry.other], ['금융', r.finFromCarry]].filter(function (x) { return x[1] > 0; }).map(function (x) { return x[0] + ' ' + eok(x[1]); }).join(' · ') || '공제할 소득 없음') + ')</small>', '−' + won(r.useCarry.biz + r.useCarry.wage + r.useCarry.pen + r.useCarry.other + r.finFromCarry)]
                       : ['이월결손금 ' + eok(r.carry) + ' <small>(단순·기준경비율 추계신고라 올해는 공제 불가 — 장부로 신고해야 공제)</small>', '0원']) : null,
      r.finComp && (r.lossCurr || r.carry) && !r.rental ? ['<small>금융소득은 2천만원 초과분(기본세율 적용 ' + eok(r.finBasic) + ')에서만 공제 — 세금이 줄어드는 만큼만 공제하고 나머지는 이월</small>', ''] : null,
      ['종합소득금액 <small>(결손금 공제 후)</small>', won(r.total), 'fc-hl'],
      ['인적공제 <small>(기본 ' + eok(r.basic) + (r.add ? ' + 추가 ' + eok(r.add) : '') + ')</small>', '−' + won(r.basic + r.add)],
      r.pension ? ['연금보험료 공제 <small>(국민연금)</small>', '−' + won(r.pension)] : null,
      r.ins ? ['건강·고용보험료 공제 <small>(근로자)</small>', '−' + won(r.ins)] : null,
      r.noyu ? ['노란우산공제 <small>(한도 ' + eok(r.noyuLim) + ')</small>', '−' + won(r.noyu)] : null,
      ['과세표준', won(r.base)],
      r.finComp ? ['일반산출세액 / 비교산출세액 <small>(큰 금액이 산출세액)</small>', won(r.general) + ' / ' + won(r.compare)] : null,
      ['산출세액 <small>(6~45% 누진)</small>', won(r.calc)],
      r.divCr ? ['배당세액공제', '−' + won(r.divCr)] : null,
      r.wageCr ? ['근로소득세액공제', '−' + won(r.wageCr)] : null,
      r.child ? ['자녀세액공제 <small>(8세 이상)</small>', '−' + won(r.child)] : null,
      r.birth ? ['출산·입양 세액공제', '−' + won(r.birth)] : null,
      r.penCr ? ['연금계좌 세액공제 <small>(' + (r.penRate * 100) + '%)</small>', '−' + won(r.penCr)] : null,
      r.book ? ['기장세액공제 <small>(20%, 최대 100만원)</small>', '−' + won(r.book)] : null,
      r.special ? ['특별세액공제 <small>(보험·의료·교육·기부)</small>', '−' + won(r.special)] : null,
      r.std ? ['표준세액공제 <small>(' + (r.G ? '근로소득자 13만원' : r.std === 12e4 ? '성실사업자 12만원' : '7만원') + ')</small>', '−' + won(r.std)] : null,
      r.efile ? ['전자신고세액공제', '−' + won(r.efile)] : null,
      r.creditsRaw > r.credits ? ['<small>세액공제는 산출세액까지만 (' + won(r.creditsRaw - r.credits) + ' 미적용)</small>', ''] : null,
      r.privOption === 'separate15' ? ['사적연금 15% 분리과세 선택 <small>(종합과세 ' + won(r.compDecided) + '보다 유리 — 사적연금 × 15% ' + won(r.privOptTax) + ' + 나머지 ' + won(r.altDecided) + ')</small>', ''] : null,
      ['결정세액', won(r.decided)],
      r.wh ? ['3.3% 원천징수된 소득세 <small>(수입금액 × 3%)</small>', '−' + won(r.wh)] : null,
      r.finWh ? ['금융소득 원천징수 <small>(14%)</small>', '−' + won(r.finWh)] : null,
      r.prepaid - r.wh - r.finWh ? ['그 밖에 이미 낸 세금 <small>(연말정산·연금·기타소득 원천징수·중간예납)</small>', '−' + won(r.prepaid - r.wh - r.finWh)] : null,
      [r.due < 0 ? '환급받을 종합소득세' : '납부할 종합소득세', won(Math.abs(r.due))],
      [r.localDue < 0 ? '환급받을 지방소득세 <small>(10%)</small>' : '납부할 지방소득세 <small>(10%)</small>', won(Math.abs(r.localDue))],
      [refund ? '환급 합계' : '납부 합계', won(Math.abs(r.totalDue)), 'fc-total'],
      r.lossNext + r.carryNext > 0 ? ['다음 해로 넘어가는 결손금 <small>(발생 후 15년 안에 공제)</small>', won(r.lossNext + r.carryNext)] : null]));
  }


  var KEYS = { inc: ['incometax', inc], ost: ['stocktax', ost], div: ['dividend', div], pen: ['pension', pen], gif: ['gift', gif], acq: ['acquisition', acq] };
  Object.keys(KEYS).forEach(function (k) { window.fcRegister(k, KEYS[k][1], KEYS[k][0]); });

  /* 해외주식: 종목 줄 추가·삭제 */
  var ROW = function () {
    return '<div class="ost-row"><input type="text" class="ost-name" placeholder="종목" aria-label="종목">' +
      ['buy', 'buyfx', 'sell', 'sellfx', 'fee'].map(function (k) {
        return '<span class="fc-input"><input type="text" inputmode="decimal" data-k="' + k + '" data-fc="ost" aria-label="' +
          ({ buy: '매수금액(달러)', buyfx: '매수 환율', sell: '매도금액(달러)', sellfx: '매도 환율', fee: '수수료(달러)' })[k] + '"></span>';
      }).join('') + '<span class="ost-gl">—</span><button type="button" class="ost-del" aria-label="이 종목 삭제">×</button></div>';
  };
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('#ost-add');
    if (a) { $('ost-rows').insertAdjacentHTML('beforeend', ROW()); ost(); return; }
    var d = e.target.closest && e.target.closest('.ost-del');
    if (d) { var row = d.closest('.ost-row'); if (document.querySelectorAll('#ost-rows .ost-row').length > 1) row.remove(); else row.querySelectorAll('input').forEach(function (i) { i.value = ''; }); ost(); }
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { window.fcRender(); }); else window.fcRender();
})();

/* ════════════════════════════════════════
   [VISITS] 맨 위 방문자 수 — Cloudflare Worker(worker/)가 같은 IP를 하루(한국 시간) 1번만 셈
   · 주소는 data/counter.json (Actions '방문자 수 카운터 배포'가 저장) — 없으면 표시하지 않음
   · 이 브라우저가 오늘 이미 센 경우에는 세지 않고 숫자만 받아 옴 (서버도 IP로 다시 한 번 중복 확인)
   · 실시간: 화면을 보고 있는 동안 45초마다 POST /live {id} (브라우저별 무작위 번호) — 숨기거나 닫으면 바로 빠짐
════════════════════════════════════════ */
(function () {
  var EP = '', LID = '';
  function liveId() {
    if (LID) return LID;
    try { LID = localStorage.getItem('dc_live_id') || ''; } catch (e) {}
    if (!/^[a-f0-9]{32}$/.test(LID)) {
      var a = new Uint8Array(16); crypto.getRandomValues(a);
      LID = Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
      try { localStorage.setItem('dc_live_id', LID); } catch (e) {}
    }
    return LID;
  }
  function ping() {                                                   /* 글 형식(text/plain)이라 사전 확인(preflight) 없이 한 번에 */
    if (!EP || document.hidden) return Promise.resolve();
    return fetch(EP + '/live', { method: 'POST', mode: 'cors', cache: 'no-store', body: JSON.stringify({ id: liveId() }) })
      .then(function (r) { return r.ok ? r.json() : null; }).then(show).catch(function () {});
  }
  function bye() { if (!EP) return; try { navigator.sendBeacon(EP + '/live', new Blob([JSON.stringify({ id: liveId(), bye: 1 })], { type: 'text/plain' })); } catch (e) {} }
  function startLive() {
    ping();
    setInterval(ping, 45000);
    document.addEventListener('visibilitychange', function () { if (document.hidden) bye(); else ping(); });
    window.addEventListener('pagehide', bye);
  }
  function kstDay() { return new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10); }
  function show(d) {
    if (!d || typeof d.today !== 'number') return;
    var f = function (v) { return typeof v === 'number' ? v.toLocaleString('ko-KR') : '—'; }, set = function (id, v) { document.getElementById(id).textContent = v; };
    set('visit-total', f(d.total)); set('visit-total2', f(d.total)); set('visit-today', f(d.today));
    if (typeof d.live === 'number') set('visit-live', f(Math.max(1, d.live)));   /* 지금 보고 있는 나도 포함 */
    set('visit-yday', f(d.yesterday)); set('visit-max', f(d.max));
    set('visit-maxday', /^\d{4}-\d\d-\d\d$/.test(d.maxDay || '') ? (+d.maxDay.slice(5, 7)) + '/' + (+d.maxDay.slice(8)) : '');   /* 최대였던 날 (월/일) */
    document.getElementById('visit-bar').hidden = false;
  }
  async function run() {
    if (!/^https?:$/.test(location.protocol) || !window.mdLoad) return;
    var cfg = null;
    try { cfg = await window.mdLoad('counter.json'); } catch (e) {}
    if (!cfg || !/^https:\/\//.test(cfg.endpoint || '')) return;
    var day = kstDay(), seen = false;
    EP = cfg.endpoint.replace(/\/$/, '');
    try { seen = localStorage.getItem('etfmd-visit-day') === day; } catch (e) {}
    try {
      if (!seen) {                                                    /* 오늘 첫 방문만 세고, 숫자는 실시간 신호의 답으로 받음 */
        var r = await fetch(EP + '/hit', { method: 'POST', mode: 'cors', cache: 'no-store' });
        if (r.ok) { show(await r.json()); try { localStorage.setItem('etfmd-visit-day', day); } catch (e) {} }
      }
    } catch (e) {}
    startLive();
  }
  /* 휴대폰(마우스 없음)·키보드: 누르면 열고 닫기, 바깥 누르거나 Esc 면 닫기 */
  function bindPop() {
    var bar = document.getElementById('visit-bar'), btn = document.getElementById('visit-btn');
    if (!bar || !btn) return;
    var setOpen = function (on) { bar.classList.toggle('open', on); btn.setAttribute('aria-expanded', on ? 'true' : 'false'); };
    btn.addEventListener('click', function () { setOpen(!bar.classList.contains('open')); });
    document.addEventListener('click', function (e) { if (!bar.contains(e.target)) setOpen(false); }, true);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setOpen(false); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { bindPop(); run(); }); else { bindPop(); run(); }
})();

/* ════════════════════════════════════════
   [ETFDIV] ETF 월분배 및 배당 달력 — data/etfdiv.json (scripts/update_etfdiv.py · '시세 데이터 갱신' Actions 와 함께 15분마다)
   · 확정 일정: KRX KIND 'ETF이익금분배신고(분배금안내)' 공시 · 분배락일: 'ETF 분배락 기준가격 안내'(없으면 기준일 전 영업일)
   · 월분배 종목·분배 이력·연 분배율·현재가: 네이버 금융 · 과세표준: 운용사 공개 자료(KODEX)
   · 탭이 열려 있는 동안 5분마다 새 공시를 다시 받아 옴
════════════════════════════════════════ */
(function () {
  var S = { data: null, rows: [], month: null, day: null, q: '', brand: 'all', sort: 'yield', open: {}, timer: null, loading: null, page: 1 };   /* 기본 정렬: 분배율 높은 순 */
  var PER = 50;   /* 표 한 페이지에 보일 종목 수 */
  /* 페이지 번호 입력 이동 — 분배 일정·아파트 순위 표 공통 (입력한 번호로 기존 페이지 버튼 동작을 그대로 실행) */
  window.pgJump = function (pages, cur) {
    return '<form class="dv-pg-go" novalidate><input type="number" inputmode="numeric" min="1" max="' + pages + '" placeholder="' + cur + '" aria-label="이동할 페이지 (1~' + pages + ')" title="1~' + pages + ' 페이지"><button type="submit" class="dv-pg-gobtn">이동</button></form>';
  };
  document.addEventListener('submit', function (e) {
    var f = e.target.closest && e.target.closest('.dv-pg-go'); if (!f) return;
    e.preventDefault();
    var inp = f.querySelector('input'), n = Math.round(+inp.value), max = +inp.max || 1;
    if (!n) { inp.focus(); return; }
    var b = document.createElement('button'); b.type = 'button'; b.className = 'dv-pg'; b.hidden = true;
    b.setAttribute('data-pg', Math.min(max, Math.max(1, n))); f.parentNode.appendChild(b); b.click(); if (b.parentNode) b.remove();
  });
  var BRANDS = ['KODEX', 'TIGER', 'RISE', 'ACE', 'SOL', 'PLUS', 'KIWOOM', 'HANARO', 'KoAct', '1Q', 'WON', 'TIME', 'FOCUS', 'DAISHIN', 'BNK', 'TIMEFOLIO', 'KCGI', 'UNICORN', 'ITF', 'VITA', 'HK'];
  function $(id) { return document.getElementById(id); }
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function todayStr() { var d = new Date(Date.now() + 9 * 3600e3); return d.toISOString().slice(0, 10); }   /* 한국 날짜 */
  function md(s, wd) {   /* '2026-10-02' → '10월 2일 (금)' */
    if (!s) return '—';
    var d = new Date(s + 'T00:00:00Z');
    return (d.getUTCMonth() + 1) + '월 ' + d.getUTCDate() + '일' + (wd ? ' (' + '일월화수목금토'[d.getUTCDay()] + ')' : '');
  }
  function num(n, d) { return n == null || isNaN(n) ? '—' : Number(n).toLocaleString('ko-KR', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }); }
  function brandOf(n) { var b = (n || '').split(' ')[0]; return BRANDS.indexOf(b) >= 0 ? b : '기타'; }
  function nm(s) { return (s || '').toLowerCase().replace(/[\s()·\-_.&]/g, ''); }

  /* 종목별로 '대표 일정' 하나: 앞으로 지급될 확정 공시 → 없으면 가장 최근 공시 → 없으면 네이버 이력 */
  function build() {
    var d = S.data, today = todayStr(), byT = {};
    (d.events || []).forEach(function (e) { (byT[e.t] = byT[e.t] || []).push(e); });
    S.rows = Object.keys(d.etfs || {}).map(function (t) {
      var x = d.etfs[t], evs = (byT[t] || []).sort(function (a, b) { return a.rec < b.rec ? 1 : -1; }), e = evs[0], h = x.h || [];
      var r = { t: t, n: x.n, p: x.p, ttm: x.ttm, dps: x.dps, h: h, evs: evs };
      if (e) {
        r.ann = e.ann; r.ex = e.ex; r.exSrc = e.exSrc; r.rec = e.rec; r.pay = e.pay; r.buy = e.buy; r.amt = e.amt; r.tax = e.tax; r.fix = e.fix;
        var hh = h.filter(function (z) { return z[0] === e.ex; })[0];
        r.y = hh && hh[2] != null ? hh[2] : (x.p ? e.amt / x.p * 100 : null); r.yCalc = !hh;
        r.st = !e.pay ? 'ok' : e.pay > today ? 'ok' : e.pay === today ? 'today' : 'done';
      } else if (h[0]) {
        r.ex = h[0][0]; r.rec = x.lastRec; r.amt = h[0][1]; r.y = h[0][2]; r.st = 'done'; r.noAnn = true;
      }
      r.isNew = r.ann && (Date.now() - Date.parse(r.ann.replace(' ', 'T') + ':00+09:00')) < 24 * 3600e3;
      return r;
    });
  }
  function kpis() {
    var d = S.data, today = todayStr(), evs = d.events || [];
    var cnt = Object.keys(d.etfs || {}).length;
    $('dv-k-cnt').textContent = cnt + '개';
    var conf = S.rows.filter(function (r) { return r.st === 'ok' || r.st === 'today'; }).length;
    $('dv-k-cnt-sub').textContent = '지급 예정 확정 ' + conf + '개';
    function nextOf(key) {
      var ds = evs.map(function (e) { return e[key]; }).filter(function (v) { return v && v >= today; }).sort();
      if (!ds.length) return null;
      return { d: ds[0], n: ds.filter(function (v) { return v === ds[0]; }).length };
    }
    var p = nextOf('pay'), x = nextOf('ex');
    $('dv-k-pay').textContent = p ? md(p.d, true) : '공시 대기';
    $('dv-k-pay-sub').textContent = p ? p.n + '개 종목 지급' + (p.d === today ? ' · 오늘' : '') : '다음 분배금 공시 전';
    $('dv-k-ex').textContent = x ? md(x.d, true) : '공시 대기';
    var buyD = x ? evs.filter(function (e) { return e.ex === x.d; })[0].buy : null;
    $('dv-k-ex-sub').textContent = x ? x.n + '개 종목 · 마지막 매수 ' + md(buyD) : '다음 분배금 공시 전';
    var anns = evs.map(function (e) { return e.ann; }).filter(Boolean).sort();
    var last = anns[anns.length - 1];
    $('dv-k-ann').textContent = last ? md(last.slice(0, 10)) + ' ' + last.slice(11, 16) : '—';
    $('dv-k-ann-sub').textContent = last ? evs.filter(function (e) { return e.ann && e.ann.slice(0, 10) === last.slice(0, 10); }).length + '개 종목 분배금 확정' : '';
  }
  /* 달력: 날짜별 공시·분배락·기준일·지급 종목 수 */
  function cal() {
    var d = S.data, m = S.month, y = m[0], mo = m[1], today = todayStr();
    $('dv-month').textContent = y + '년 ' + mo + '월';
    var cnt = {};
    function add(date, k) { if (!date) return; (cnt[date] = cnt[date] || { ann: 0, ex: 0, rec: 0, pay: 0 })[k]++; }
    (d.events || []).forEach(function (e) { add(e.ann && e.ann.slice(0, 10), 'ann'); add(e.ex, 'ex'); add(e.rec, 'rec'); add(e.pay, 'pay'); });
    var first = new Date(Date.UTC(y, mo - 1, 1)), start = new Date(first.getTime() - first.getUTCDay() * 864e5);
    var html = '일월화수목금토'.split('').map(function (w, i) { return '<div class="dv-wd' + (i === 0 ? ' sun' : i === 6 ? ' sat' : '') + '">' + w + '</div>'; }).join('');
    for (var i = 0; i < 42; i++) {
      var dt = new Date(start.getTime() + i * 864e5), ds = dt.toISOString().slice(0, 10), c = cnt[ds];
      if (i >= 35 && dt.getUTCMonth() !== mo - 1) break;
      var cls = 'dv-day' + (dt.getUTCMonth() !== mo - 1 ? ' out' : '') + (ds === today ? ' today' : '') + (ds === S.day ? ' sel' : '') + (dt.getUTCDay() === 0 ? ' off' : '');
      var ev = '';
      if (c) {
        if (c.ann) ev += '<span class="dv-ev"><i class="dv-dot dv-ann"></i><span class="dv-lbl">공시</span><b>' + c.ann + '</b></span>';
        if (c.ex) ev += '<span class="dv-ev"><i class="dv-dot dv-ex"></i><span class="dv-lbl">분배락</span><b>' + c.ex + '</b></span>';
        if (c.rec) ev += '<span class="dv-ev"><i class="dv-dot dv-rec"></i><span class="dv-lbl">기준일</span><b>' + c.rec + '</b></span>';
        if (c.pay) ev += '<span class="dv-ev"><i class="dv-dot dv-pay"></i><span class="dv-lbl">지급</span><b>' + c.pay + '</b></span>';
      }
      html += '<button type="button" class="' + cls + '" data-day="' + ds + '"' + (c ? '' : ' aria-label="' + ds + ' 일정 없음"') + '><span class="dv-dn">' + dt.getUTCDate() + '</span>' + ev + '</button>';
    }
    $('dv-cal').innerHTML = html;
  }
  function chips() {
    var cnt = {};
    S.rows.forEach(function (r) { var b = brandOf(r.n); cnt[b] = (cnt[b] || 0) + 1; });
    var list = Object.keys(cnt).filter(function (b) { return b !== '기타'; }).sort(function (a, b) { return cnt[b] - cnt[a]; });
    if (cnt['기타']) list.push('기타');
    $('dv-chips').innerHTML = '<button class="dv-chip' + (S.brand === 'all' ? ' active' : '') + '" data-brand="all">전체<small>' + S.rows.length + '</small></button>' +
      list.map(function (b) { return '<button class="dv-chip' + (S.brand === b ? ' active' : '') + '" data-brand="' + esc(b) + '">' + esc(b) + '<small>' + cnt[b] + '</small></button>'; }).join('');
  }
  /* 표에 쓸 행: 날짜를 고르면 그날 일정(공시·락·기준·지급)이 있는 공시 건, 아니면 종목별 대표 일정 */
  function rowsNow() {
    var rows;
    if (S.day) {
      var map = {}; S.rows.forEach(function (r) { map[r.t] = r; });
      rows = (S.data.events || []).filter(function (e) { return e.ex === S.day || e.rec === S.day || e.pay === S.day || (e.ann && e.ann.slice(0, 10) === S.day); })
        .filter(function (e) { return map[e.t]; }).map(function (e) {
          var b = map[e.t], hh = (b.h || []).filter(function (z) { return z[0] === e.ex; })[0], today = todayStr();
          return { t: e.t, n: b.n, p: b.p, ttm: b.ttm, h: b.h, evs: b.evs, ann: e.ann, ex: e.ex, exSrc: e.exSrc, rec: e.rec, pay: e.pay, buy: e.buy, amt: e.amt, tax: e.tax, fix: e.fix,
            y: hh && hh[2] != null ? hh[2] : (b.p ? e.amt / b.p * 100 : null), yCalc: !hh, st: !e.pay || e.pay > today ? 'ok' : e.pay === today ? 'today' : 'done', isNew: b.isNew && b.rec === e.rec };
        });
    } else rows = S.rows.slice();
    var q = nm(S.q);
    if (S.brand !== 'all') rows = rows.filter(function (r) { return brandOf(r.n) === S.brand; });
    if (q) rows = rows.filter(function (r) { return nm(r.n).indexOf(q) >= 0 || r.t.toLowerCase().indexOf(q) >= 0; });
    var today = todayStr();
    rows.sort(function (a, b) {
      if (S.sort === 'yield') return (b.y || 0) - (a.y || 0);
      if (S.sort === 'ttm') return (b.ttm || 0) - (a.ttm || 0);
      if (S.sort === 'name') return (a.n || '').localeCompare(b.n || '', 'ko');
      /* 일정순: 앞으로 지급될 것(가까운 순) → 지난 것(최근 순) */
      var af = a.pay && a.pay >= today, bf = b.pay && b.pay >= today;
      if (af !== bf) return af ? -1 : 1;
      var ak = a.pay || a.rec || '', bk = b.pay || b.rec || '';
      if (ak !== bk) return af ? (ak < bk ? -1 : 1) : (ak < bk ? 1 : -1);
      return (a.n || '').localeCompare(b.n || '', 'ko');
    });
    return rows;
  }
  /* 분배 시기: 기준일이 20일 이전이면 월중(파랑), 그 뒤면 월말(빨강) */
  function cyc(rec) {
    if (!rec) return '';
    var mid = +rec.slice(8, 10) <= 20;
    return '<i class="dv-cyc ' + (mid ? 'mid' : 'end') + '" title="' + (mid ? '월중분배' : '월말분배') + ' (기준일 ' + (+rec.slice(5, 7)) + '/' + (+rec.slice(8, 10)) + ')" aria-label="' + (mid ? '월중분배' : '월말분배') + '"></i>';
  }
  function stLabel(r) {
    if (r.noAnn) return '<span class="dv-st done" title="최근 공시를 찾지 못해 분배 이력으로 표시">지급 완료</span>';
    return r.st === 'today' ? '<span class="dv-st today">오늘 지급</span>' : r.st === 'done' ? '<span class="dv-st done">지급 완료</span>' : '<span class="dv-st ok">확정</span>';
  }
  function histRow(r) {
    var h = (r.h || []).slice(0, 12).reverse();
    if (!h.length) return '<tr class="dv-hist"><td colspan="12">분배 이력이 없습니다.</td></tr>';
    var mx = Math.max.apply(null, h.map(function (z) { return z[1]; })) || 1, sum = 0, yr = new Date(Date.now() - 365 * 864e5).toISOString().slice(0, 10);
    h.forEach(function (z) { if (z[0] > yr) sum += z[1]; });
    return '<tr class="dv-hist"><td colspan="12"><div class="dv-hsum">최근 ' + h.length + '회 분배 (분배락일 기준) · 최근 1년 합계 <b>' + num(sum) + '원</b>' + (r.p ? ' · 현재가 대비 ' + (sum / r.p * 100).toFixed(2) + '%' : '') + '</div><div class="dv-hbars">' +
      h.map(function (z) { return '<div class="dv-hb" data-d="' + esc(z[0]) + '" data-a="' + z[1] + '" data-y="' + (z[2] != null ? z[2] : '') + '"><b>' + num(z[1]) + '</b><i style="height:' + Math.max(4, z[1] / mx * 60).toFixed(1) + 'px"></i><small>' + (+z[0].slice(5, 7)) + '/' + (+z[0].slice(8)) + '</small></div>'; }).join('') + '</div></td></tr>';
  }
  // 분배 이력 막대 툴팁 (마우스 올림 · 터치는 누르면 표시, 다른 곳을 누르면 닫힘)
  var tipEl = null, tipOn = null;
  function tipHide() { if (tipEl) tipEl.classList.remove('show'); if (tipOn) tipOn.classList.remove('on'); tipOn = null; }
  function tipShow(bar) {
    if (!tipEl) { tipEl = document.createElement('div'); tipEl.className = 'dv-tip'; tipEl.setAttribute('role', 'tooltip'); document.body.appendChild(tipEl); }
    if (tipOn && tipOn !== bar) tipOn.classList.remove('on');
    tipOn = bar; bar.classList.add('on');
    var d = bar.getAttribute('data-d') || '', y = bar.getAttribute('data-y');
    tipEl.innerHTML = '<div class="t">' + esc(d.replace(/-/g, '/')) + '</div>' +
      '<div class="l"><i></i>분배금  ' + num(+bar.getAttribute('data-a')) + '원</div>' +
      (y !== '' && y != null ? '<div class="l"><i class="y"></i>분배율  ' + (+y).toFixed(2) + '%</div>' : '');
    var r = (bar.querySelector('i') || bar).getBoundingClientRect(), w = tipEl.offsetWidth, h = tipEl.offsetHeight;
    var x = r.right + 8; if (x + w > window.innerWidth - 8) x = r.left - w - 8; if (x < 8) x = 8;
    var top = Math.max(8, Math.min(r.top + r.height / 2 - h / 2, window.innerHeight - h - 8));
    tipEl.style.left = x + 'px'; tipEl.style.top = top + 'px'; tipEl.classList.add('show');
  }
  document.addEventListener('mouseover', function (e) { var b = e.target.closest && e.target.closest('.dv-hb'); if (b) tipShow(b); else if (tipOn) tipHide(); });
  document.addEventListener('click', function (e) { var b = e.target.closest && e.target.closest('.dv-hb'); if (b) tipShow(b); else if (tipOn) tipHide(); }, true);
  window.addEventListener('scroll', function () { if (tipOn) tipHide(); }, { passive: true, capture: true });
  function table() {
    var all = rowsNow(), pages = Math.max(1, Math.ceil(all.length / PER));
    if (S.page > pages) S.page = pages;
    var rows = all.slice((S.page - 1) * PER, S.page * PER);
    $('dv-body').innerHTML = rows.length ? rows.map(function (r) {
      var y = r.y != null ? '<span class="dv-y">' + r.y.toFixed(2) + '%</span>' + (r.yCalc ? '<span class="dv-calc" title="현재가로 계산한 예상 분배율">*</span>' : '') : '<span class="dv-dim">—</span>';
      var tr = '<tr class="dv-row" data-t="' + esc(r.t) + '" tabindex="0" aria-expanded="' + (S.open[r.t] ? 'true' : 'false') + '">' +
        '<td class="dv-c-pay" data-l="지급일">' + (r.pay ? md(r.pay) : '<span class="dv-dim">—</span>') + '</td>' +
        '<td class="dv-c-n"><span class="dv-nm">' + cyc(r.rec) + esc(r.n) + (r.isNew ? '<span class="dv-new">NEW</span>' : '') + '</span><span class="dv-tk">' + esc(r.t) + '</span></td>' +
        '<td class="dv-c-st" data-l="상태">' + stLabel(r) + '</td>' +
        '<td class="dv-c-ann" data-l="공시일">' + (r.ann ? md(r.ann.slice(0, 10)) + (r.fix ? ' <span class="dv-dim">(정정)</span>' : '') : '<span class="dv-dim">—</span>') + '</td>' +
        '<td class="dv-c-ex" data-l="분배락일">' + md(r.ex) + '</td>' +
        '<td class="dv-c-rec" data-l="기준일">' + md(r.rec) + '</td>' +
        '<td class="dv-c-buy" data-l="마지막 매수일">' + (r.buy ? md(r.buy) : '<span class="dv-dim">—</span>') + '</td>' +
        '<td class="dv-c-amt" data-l="분배금">' + (r.amt != null ? num(r.amt) + '원' : '—') + '</td>' +
        '<td class="dv-c-y" data-l="분배율">' + y + '</td>' +
        '<td class="dv-c-p" data-l="종가">' + (r.p ? num(r.p) + '원' : '—') + '</td>' +
        '<td class="dv-c-tax' + (r.tax == null ? ' dv-notax' : '') + '" data-l="과세표준">' + (r.tax != null ? num(r.tax) + '원' : '<span class="dv-dim">—</span>') + '</td>' +
        '<td class="dv-c-ttm" data-l="연 분배율">' + (r.ttm != null ? r.ttm.toFixed(2) + '%' : '—') + '</td></tr>';
      return tr + (S.open[r.t] ? histRow(r) : '');
    }).join('') : '<tr><td colspan="12" class="dv-empty">조건에 맞는 종목이 없습니다</td></tr>';
    pager(all.length, pages);
    var f = $('dv-filter');
    if (S.day) { f.hidden = false; f.innerHTML = '<span><b>' + md(S.day, true) + '</b> 일정 ' + all.length + '건 (공시·분배락·기준일·지급 중 하나라도 해당)</span><button type="button" id="dv-clear">전체 보기 ✕</button>'; }
    else { f.hidden = true; f.innerHTML = ''; }
  }
  function note() {
    var d = S.data, up = d.updated ? new Date(d.updated) : null;
    var t = up ? up.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }) : '—';
    $('dv-note').innerHTML = '자료: 한국거래소 KIND 분배금 공시(확정 일정·분배금) · 네이버 금융(월분배 종목·분배 이력·현재가) · 각 운용사 홈페이지·FunETF(과세표준: KODEX·TIGER·RISE·ACE·SOL·PLUS·KIWOOM·KoAct·WON·TIME·DAISHIN) — 마지막 갱신 ' + esc(t) +
      '<br>분배락일은 거래소 \'분배락 기준가격 안내\'가 나오면 그 날짜, 그 전에는 기준일 전 영업일로 계산합니다 · 분배율 * 는 아직 분배락 전이라 현재가로 계산한 값 · 행을 누르면 최근 분배 이력이 보입니다 · 투자 판단의 책임은 이용자에게 있습니다.';
  }
  /* 페이지 번호: 1 … 4 5 [6] 7 8 … 12 처럼 현재 앞뒤 2쪽과 처음·끝만 */
  function pager(total, pages) {
    var el = $('dv-pager');
    if (pages <= 1) { el.hidden = true; el.innerHTML = ''; return; }
    var cur = S.page, list = [];
    for (var i = 1; i <= pages; i++) if (i === 1 || i === pages || Math.abs(i - cur) <= 2) list.push(i);
    var h = '<button type="button" class="dv-pg" data-pg="' + (cur - 1) + '"' + (cur === 1 ? ' disabled' : '') + ' aria-label="이전 페이지">‹</button>', prev = 0;
    list.forEach(function (i) {
      if (i - prev > 1) h += '<span class="dv-pg-gap">…</span>';
      h += '<button type="button" class="dv-pg' + (i === cur ? ' active' : '') + '" data-pg="' + i + '"' + (i === cur ? ' aria-current="page"' : '') + '>' + i + '</button>';
      prev = i;
    });
    h += '<button type="button" class="dv-pg" data-pg="' + (cur + 1) + '"' + (cur === pages ? ' disabled' : '') + ' aria-label="다음 페이지">›</button>';
    h += window.pgJump(pages, cur);
    h += '<span class="dv-pg-info">' + ((cur - 1) * PER + 1) + '–' + Math.min(cur * PER, total) + ' / ' + total + '종목</span>';
    el.hidden = false; el.innerHTML = h;
  }
  function render() {
    if (!S.data) return;
    if (!S.month) { var t = todayStr(); S.month = [+t.slice(0, 4), +t.slice(5, 7)]; }
    kpis(); cal(); chips(); table(); note();
    document.querySelectorAll('#page-etfdiv .dv-sort .chart-tab').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-sort') === S.sort); });
  }
  async function load() {
    if (!window.mdLoad) return;
    var d = await window.mdLoad('etfdiv.json').catch(function () { return null; });
    if (d && d.etfs && Object.keys(d.etfs).length) { if (!S.data || d.updated !== S.data.updated) { S.data = d; build(); render(); } }
    else if (!S.data) $('dv-body').innerHTML = '<tr><td colspan="12" class="dv-empty">데이터를 불러오지 못했습니다. 잠시 뒤 다시 열어 주세요.</td></tr>';
  }
  window.dvRender = function () {
    var pg = $('page-etfdiv'); if (!pg || !pg.classList.contains('active')) { clearInterval(S.timer); S.timer = null; return; }
    if (!S.loading) S.loading = load().finally(function () { S.loading = null; });
    if (!S.timer) S.timer = setInterval(function () {   /* 열려 있는 동안 5분마다 새 공시 확인 */
      if (!$('page-etfdiv').classList.contains('active')) { clearInterval(S.timer); S.timer = null; return; }
      if (!document.hidden && !S.loading) S.loading = load().finally(function () { S.loading = null; });
    }, 5 * 60 * 1000);
    render();
  };
  document.addEventListener('click', function (e) {
    var t = e.target; if (!t.closest || !t.closest('#page-etfdiv')) return;
    var b;
    if ((b = t.closest('.dv-day'))) { var ds = b.getAttribute('data-day'); S.day = S.day === ds ? null : ds; S.page = 1; cal(); table(); if (S.day) $('dv-filter').scrollIntoView({ block: 'nearest', behavior: 'smooth' }); return; }
    if (t.closest('#dv-clear')) { S.day = null; S.page = 1; cal(); table(); return; }
    if (t.closest('#dv-prev') || t.closest('#dv-next')) { var m = S.month[1] + (t.closest('#dv-prev') ? -1 : 1), y = S.month[0]; if (m < 1) { m = 12; y--; } if (m > 12) { m = 1; y++; } S.month = [y, m]; cal(); return; }
    if (t.closest('#dv-today')) { var td = todayStr(); S.month = [+td.slice(0, 4), +td.slice(5, 7)]; cal(); return; }
    if ((b = t.closest('.dv-chip'))) { S.brand = b.getAttribute('data-brand'); S.page = 1; chips(); table(); return; }
    if ((b = t.closest('.dv-sort .chart-tab'))) { S.sort = b.getAttribute('data-sort'); S.page = 1; render(); return; }
    if ((b = t.closest('.dv-pg'))) { if (b.disabled) return; S.page = +b.getAttribute('data-pg'); table(); var top = document.querySelector('#page-etfdiv .dv-tools'); if (top) top.scrollIntoView({ block: 'start', behavior: 'smooth' }); return; }
    if ((b = t.closest('tr.dv-row'))) { var k = b.getAttribute('data-t'); S.open[k] = !S.open[k]; table(); }
  });
  document.addEventListener('keydown', function (e) {
    var r = e.target && e.target.closest && e.target.closest('#dv-body tr.dv-row');
    if (r && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); var k = r.getAttribute('data-t'); S.open[k] = !S.open[k]; table(); var n = document.querySelector('tr.dv-row[data-t="' + k + '"]'); if (n) n.focus(); }
  });
  document.addEventListener('input', function (e) { if (e.target && e.target.id === 'dv-search') { S.q = e.target.value; S.page = 1; if (S.data) table(); } });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', window.dvRender); else window.dvRender();
})();

/* ════════════════════════════════════════
   [MCAP] 전세계 시가총액 TOP 100 — data/mcap.json (Actions '시가총액 순위 갱신': 매일 미국장 마감 뒤 종가 기준)
   · 시가총액은 달러 환산값으로 순위 · 원화 보기는 market.json 의 원·달러 환율로 환산
   · 순위 변동 = 전 거래일 순위 − 오늘 순위 (전 거래일에 100위 밖이면 NEW)
════════════════════════════════════════ */
(function () {
  var KO = { NVDA: '엔비디아', AAPL: '애플', GOOG: '알파벳(구글)', GOOGL: '알파벳(구글)', MSFT: '마이크로소프트', AMZN: '아마존', TSM: 'TSMC', '2330.TW': 'TSMC',
    SPCX: '스페이스X', META: '메타(페이스북)', AVGO: '브로드컴', '2222.SR': '사우디 아람코', TSLA: '테슬라', '005930.KS': '삼성전자', MU: '마이크론 테크놀로지',
    'BRK-B': '버크셔 해서웨이', 'BRK-A': '버크셔 해서웨이', AMD: 'AMD', LLY: '일라이 릴리', '000660.KS': 'SK하이닉스', JPM: 'JP모건 체이스', WMT: '월마트', ASML: 'ASML', 'ASML.AS': 'ASML',
    V: '비자', XOM: '엑슨모빌', JNJ: '존슨앤드존슨', INTC: '인텔', '688825.SS': 'CXMT(창신메모리)', MA: '마스터카드', TCEHY: '텐센트', '0700.HK': '텐센트', ABBV: '애브비',
    CSCO: '시스코', PLTR: '팔란티어', ORCL: '오라클', '601939.SS': '중국건설은행', '0939.HK': '중국건설은행', AMAT: '어플라이드 머티어리얼즈', LRCX: '램리서치', COST: '코스트코',
    CVX: '셰브론', CAT: '캐터필러', BAC: '뱅크오브아메리카', KO: '코카콜라', DELL: '델 테크놀로지스', '601288.SS': '중국농업은행', '1288.HK': '중국농업은행', MRK: '머크',
    'RO.SW': '로슈', PG: 'P&G(프록터앤드갬블)', '1398.HK': '중국공상은행', '601398.SS': '중국공상은행', PANW: '팔로알토 네트웍스', UNH: '유나이티드헬스', HSBC: 'HSBC', '0005.HK': 'HSBC',
    '601988.SS': '중국은행', ARM: 'ARM 홀딩스', GE: 'GE 에어로스페이스', MS: '모건스탠리', PM: '필립모리스', HD: '홈디포', NFLX: '넷플릭스', CRWD: '크라우드스트라이크',
    SHEL: '셸', GEV: 'GE 버노바', RY: '캐나다 왕립은행(RBC)', BABA: '알리바바', '9988.HK': '알리바바', ANET: '아리스타 네트웍스', TXN: '텍사스 인스트루먼트', NVS: '노바티스',
    GS: '골드만삭스', MUFG: '미쓰비시UFJ 파이낸셜', '8306.T': '미쓰비시UFJ 파이낸셜', MRVL: '마벨 테크놀로지', KLAC: 'KLA', RTX: 'RTX', WFC: '웰스파고', AZN: '아스트라제네카',
    SNDK: '샌디스크', SAP: 'SAP', TMO: '써모피셔 사이언티픽', '2454.TW': '미디어텍', '600519.SS': '구이저우 마오타이', 'SIE.DE': '지멘스', 'NESN.SW': '네슬레',
    '9984.T': '소프트뱅크그룹', LIN: '린데', '0857.HK': '페트로차이나', '601857.SS': '페트로차이나', 'OR.PA': '로레알', BHP: 'BHP 그룹', TM: '도요타', '7203.T': '도요타', APH: '암페놀',
    '0941.HK': '차이나모바일', '600941.SS': '차이나모바일', AMGN: '암젠', C: '씨티그룹', 'IHC.AE': '인터내셔널 홀딩 컴퍼니(IHC)', SHOP: '쇼피파이', 'MC.PA': 'LVMH', IBM: 'IBM',
    AXP: '아메리칸 익스프레스', ADI: '아날로그 디바이스', SAN: '산탄데르', '300750.SZ': 'CATL', QCOM: '퀄컴', TD: 'TD 은행', VZ: '버라이즌', '6857.T': '어드밴테스트',
    'ITX.MC': '인디텍스(자라)', TTE: '토탈에너지스', CRM: '세일즈포스', DE: '디어앤드컴퍼니(존디어)', STX: '시게이트 테크놀로지', NVO: '노보 노디스크', ACN: '액센츄어',
    PEP: '펩시코', MCD: '맥도날드', ABT: '애보트', ISRG: '인튜이티브 서지컬', NOW: '서비스나우', ADBE: '어도비', INTU: '인튜이트', UBER: '우버', T: 'AT&T', TMUS: 'T-모바일 US',
    DIS: '디즈니', BX: '블랙스톤', SCHW: '찰스 슈왑', BKNG: '부킹 홀딩스', SPGI: 'S&P 글로벌', HON: '허니웰', UNP: '유니언 퍼시픽', LMT: '록히드마틴', PFE: '화이자',
    BSX: '보스턴 사이언티픽', SYK: '스트라이커', DHR: '다나허', NEE: '넥스트에라 에너지', LOW: '로우스', SONY: '소니그룹', '6758.T': '소니그룹', '6501.T': '히타치', '8035.T': '도쿄일렉트론',
    '3690.HK': '메이투안', '1810.HK': '샤오미', '601318.SS': '중국평안보험', '2318.HK': '중국평안보험', '600036.SS': '초상은행', 'RELIANCE.NS': '릴라이언스 인더스트리',
    HDB: 'HDFC 은행', INFY: '인포시스', 'TCS.NS': '타타 컨설턴시 서비스', IBN: 'ICICI 은행', 'RMS.PA': '에르메스', 'ALV.DE': '알리안츠', 'DTE.DE': '도이체텔레콤', UBS: 'UBS',
    UL: '유니레버', BP: 'BP', RIO: '리오틴토', BUD: 'AB 인베브', '8058.T': '미쓰비시상사', ENB: '엔브리지', 'CBA.AX': '커먼웰스 은행', '207940.KS': '삼성바이오로직스',
    '373220.KS': 'LG에너지솔루션', '005380.KS': '현대자동차', '402340.KS': 'SK스퀘어', '012450.KS': '한화에어로스페이스', '329180.KS': 'HD현대중공업', '105560.KS': 'KB금융',
    ETN: '이튼', VRTX: '버텍스 파마슈티컬스', MELI: '메르카도리브레', APP: '앱러빈', COIN: '코인베이스', HOOD: '로빈후드', SPOT: '스포티파이', CMCSA: '컴캐스트', TJX: 'TJX',
    MDT: '메드트로닉', GILD: '길리어드 사이언스', BMY: 'BMS(브리스톨마이어스스퀴브)', NKE: '나이키', BA: '보잉', PGR: '프로그레시브', CB: '처브', BLK: '블랙록', KKR: 'KKR',
    '7974.T': '닌텐도', '6861.T': '키엔스', '9983.T': '패스트리테일링(유니클로)', '8316.T': '미쓰이스미토모 파이낸셜', '9432.T': 'NTT', '0388.HK': '홍콩거래소', '1211.HK': 'BYD',
    '002594.SZ': 'BYD', '600900.SS': '장강전력', '601628.SS': '중국인수보험', '600028.SS': '시노펙', '601088.SS': '중국신화에너지', '0883.HK': 'CNOOC', '600938.SS': 'CNOOC',
    '2317.TW': '폭스콘(홍하이정밀)', PDD: 'PDD 홀딩스(테무)', NTES: '넷이즈', JD: 'JD닷컴', SE: '씨(Sea)', CEG: '컨스텔레이션 에너지', VRT: '버티브', MSTR: '스트래티지',
    WDC: '웨스턴 디지털', SNPS: '시놉시스', CDNS: '케이던스', 'ADYEN.AS': '아디옌', 'SU.PA': '슈나이더 일렉트릭', 'AIR.PA': '에어버스', 'SAF.PA': '사프란', 'RHM.DE': '라인메탈',
    'ENR.DE': '지멘스 에너지', 'DBK.DE': '도이체방크', 'ISP.MI': '인테사 상파올로', 'UCG.MI': '우니크레디트', 'RACE': '페라리', 'ABBN.SW': 'ABB', 'ZURN.SW': '취리히 보험',
    'NOVO-B.CO': '노보 노디스크', 'AZN.L': '아스트라제네카', 'ULVR.L': '유니레버', 'HSBA.L': 'HSBC', 'SHEL.L': '셸', 'RIO.L': '리오틴토', 'BATS.L': 'BAT', 'RR.L': '롤스로이스' };
  var CTY = { 'United States': '미국', China: '중국', Japan: '일본', 'South Korea': '한국', Taiwan: '대만', 'Saudi Arabia': '사우디', Netherlands: '네덜란드', Switzerland: '스위스',
    'United Kingdom': '영국', Canada: '캐나다', Germany: '독일', France: '프랑스', Australia: '호주', 'United Arab Emirates': 'UAE', Spain: '스페인', India: '인도', Ireland: '아일랜드',
    Denmark: '덴마크', Italy: '이탈리아', 'Hong Kong': '홍콩', Sweden: '스웨덴', Brazil: '브라질', Belgium: '벨기에', Singapore: '싱가포르', Mexico: '멕시코', Norway: '노르웨이',
    Qatar: '카타르', Indonesia: '인도네시아', Uruguay: '우루과이', Bermuda: '버뮤다', Luxembourg: '룩셈부르크', Finland: '핀란드', Israel: '이스라엘', Russia: '러시아', Argentina: '아르헨티나' };
  var SYM = { USD: '$', KRW: '₩', JPY: '¥', CNY: '¥', HKD: 'HK$', TWD: 'NT$', EUR: '€', GBP: '£', GBp: 'p', CHF: 'CHF ', SAR: 'SAR ', CAD: 'C$', AUD: 'A$', INR: '₹', AED: 'AED ', DKK: 'DKK ', SEK: 'SEK ' };
  var COLORS = ['#3182f6', '#f04452', '#fe9800', '#22c55e', '#a855f7', '#14b8a6', '#eab308', '#8b95a1'];
  var S = { data: null, fx: null, cur: 'usd', cty: 'all', sort: 'rank', q: '', loading: null };
  function $(id) { return document.getElementById(id); }
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function cty(c) { return CTY[c] || c || '—'; }
  function koName(r) { return KO[r.s] || r.n; }
  function comma(n, d) { return Number(n).toLocaleString('ko-KR', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }); }
  /* 시가총액 표시: 달러 → '5.78조 달러' / '1,881억 달러', 원화 → '7,729조원' */
  function fmtCap(usd) {
    if (S.cur === 'krw' && S.fx) { var w = usd * S.fx / 1e12; return (w >= 100 ? comma(Math.round(w)) : comma(w, 1)) + '조원'; }
    return usd >= 1e12 ? comma(usd / 1e12, 2) + '조 달러' : comma(Math.round(usd / 1e8)) + '억 달러';
  }
  function fmtPrice(r) {
    if (S.cur === 'krw' && S.fx) return comma(Math.round(r.cur === 'KRW' && r.lp ? r.lp : r.p * S.fx)) + '원';   /* 한국 상장은 실제 원화 주가 */
    var cur = r.cur, v = r.lp;
    if (!cur || v == null) { cur = 'USD'; v = r.p; }
    if (cur === 'KRW') return comma(Math.round(v)) + '원';
    return (SYM[cur] || cur + ' ') + comma(v, cur === 'JPY' ? 0 : 2);
  }
  function fmtCh(ch) {
    if (ch == null || isNaN(ch)) return '<span class="mc-flat">—</span>';
    var c = ch > 0 ? 'mc-up' : ch < 0 ? 'mc-dn' : 'mc-flat';
    return '<span class="' + c + '">' + (ch > 0 ? '+' : '') + ch.toFixed(2) + '%</span>';
  }
  function fmtMove(r) {
    if (r.pr == null) return S.data && S.data.prevDate ? '<span class="mc-new">NEW</span>' : '<span class="mc-flat">–</span>';
    var d = r.pr - r.r;
    if (!d) return '<span class="mc-flat">–</span>';
    return d > 0 ? '<span class="mc-up">▲' + d + '</span>' : '<span class="mc-dn">▼' + (-d) + '</span>';
  }
  function kpis(rows) {
    var total = rows.reduce(function (a, r) { return a + r.m; }, 0);
    $('mc-k-total').textContent = fmtCap(total);
    var us = rows.filter(function (r) { return r.c === 'United States'; }), usM = us.reduce(function (a, r) { return a + r.m; }, 0);
    $('mc-k-total-sub').textContent = '미국 기업 ' + us.length + '곳 · 비중 ' + (usM / total * 100).toFixed(1) + '%';
    var t = rows[0];
    $('mc-k-top').textContent = koName(t);
    $('mc-k-top-sub').textContent = fmtCap(t.m) + ' · 2위와 ' + (rows[1] ? (t.m / rows[1].m).toFixed(2) + '배' : '—');
    var kr = rows.filter(function (r) { return r.c === 'South Korea'; });
    $('mc-k-kr').textContent = kr.length + '곳';
    $('mc-k-kr-sub').textContent = kr.length ? kr.map(function (r) { return koName(r) + ' ' + r.r + '위'; }).join(' · ') : 'TOP 100 안에 없음';
  }
  function share(rows) {
    var total = 0, by = {};
    rows.forEach(function (r) { total += r.m; by[r.c] = (by[r.c] || 0) + r.m; });
    var list = Object.keys(by).map(function (k) { return [k, by[k]]; }).sort(function (a, b) { return b[1] - a[1]; });
    var top = list.slice(0, 7), rest = list.slice(7).reduce(function (a, x) { return a + x[1]; }, 0);
    if (rest > 0) top.push(['기타', rest]);
    $('mc-share').innerHTML = top.map(function (x, i) { return '<i style="width:' + (x[1] / total * 100).toFixed(3) + '%;background:' + COLORS[i] + '" title="' + esc(cty(x[0])) + '"></i>'; }).join('');
    $('mc-share-leg').innerHTML = top.map(function (x, i) { return '<span><i style="background:' + COLORS[i] + '"></i>' + esc(x[0] === '기타' ? '기타' : cty(x[0])) + ' <b>' + (x[1] / total * 100).toFixed(1) + '%</b></span>'; }).join('');
  }
  function chips(rows) {
    var cnt = {};
    rows.forEach(function (r) { cnt[r.c] = (cnt[r.c] || 0) + 1; });
    var list = Object.keys(cnt).sort(function (a, b) { return cnt[b] - cnt[a] || cty(a).localeCompare(cty(b), 'ko'); });
    if (S.cty !== 'all' && !cnt[S.cty]) S.cty = 'all';
    $('mc-chips').innerHTML = '<button class="mc-chip' + (S.cty === 'all' ? ' active' : '') + '" data-cty="all">전체<small>' + rows.length + '</small></button>' +
      list.map(function (c) { return '<button class="mc-chip' + (S.cty === c ? ' active' : '') + '" data-cty="' + esc(c) + '">' + esc(cty(c)) + '<small>' + cnt[c] + '</small></button>'; }).join('');
  }
  function table() {
    var rows = S.data.rows.slice(), q = S.q.trim().toLowerCase();
    if (S.cty !== 'all') rows = rows.filter(function (r) { return r.c === S.cty; });
    if (q) rows = rows.filter(function (r) { return (koName(r) + ' ' + r.n + ' ' + r.s).toLowerCase().indexOf(q) >= 0; });
    if (S.sort !== 'rank') rows.sort(function (a, b) {
      var x = a.ch == null ? null : a.ch, y = b.ch == null ? null : b.ch;
      if (x == null || y == null) return (x == null) - (y == null) || a.r - b.r;
      return S.sort === 'up' ? y - x || a.r - b.r : x - y || a.r - b.r;
    });
    $('mc-body').innerHTML = rows.length ? rows.map(function (r) {
      var ko = koName(r), en = ko !== r.n ? '<span class="mc-en">' + esc(r.n) + ' · </span>' : '', mv = fmtMove(r);
      return '<tr' + (r.c === 'South Korea' ? ' class="mc-kr"' : '') + '><td class="mc-c-r">' + r.r + '<span class="mc-rmv">' + mv + '</span></td><td class="mc-c-d">' + mv + '</td>' +
        '<td class="mc-c-n"><span class="mc-nm">' + esc(ko) + '</span><span class="mc-sub">' + en + '<span class="mc-tk">' + esc(r.s) + '</span><span class="mc-cty"> · ' + esc(cty(r.c)) + '</span></span></td>' +
        '<td class="mc-c-c">' + esc(cty(r.c)) + '</td><td class="mc-c-m">' + fmtCap(r.m) + '</td><td class="mc-c-p">' + fmtPrice(r) + '</td><td class="mc-c-ch">' + fmtCh(r.ch) + '</td></tr>';
    }).join('') : '<tr><td colspan="7" class="mc-empty">조건에 맞는 기업이 없습니다</td></tr>';
  }
  function note() {
    var d = S.data, up = d.updated ? new Date(d.updated) : null;
    var t = up ? up.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }) : '—';
    $('mc-note').innerHTML = '<b>' + esc(d.asOf) + '</b> 종가 기준 (미국 동부 날짜) · 순위 변동은 ' + (d.prevDate ? esc(d.prevDate) + ' 대비' : '다음 갱신부터 표시') +
      ' · 시가총액은 미국 달러 환산' + (S.cur === 'krw' && S.fx ? ', 원화는 1달러 = ' + comma(S.fx, 2) + '원으로 환산 (주가도 원화 환산)' : '') +
      ' · 주가는 거래되는 시장의 통화 · 매일 미국장 마감 뒤 자동 갱신 (마지막 갱신 ' + esc(t) + ')<br>자료: ' + esc(d.source || 'companiesmarketcap.com · Yahoo Finance') + ' — 참고용이며 투자 권유가 아닙니다.';
  }
  function render() {
    if (!S.data) return;
    var rows = S.data.rows;
    kpis(rows); share(rows); chips(rows); table(); note();
    $('mc-cur-usd').classList.toggle('active', S.cur === 'usd'); $('mc-cur-krw').classList.toggle('active', S.cur === 'krw');
    document.querySelectorAll('#page-mcap .mc-sort .chart-tab').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-sort') === S.sort); });
  }
  async function load() {
    if (!window.mdLoad) return;
    var r = await Promise.all([window.mdLoad('mcap.json').catch(function () { return null; }), window.mdLoad('market.json').catch(function () { return null; })]);
    var m = r[1] && r[1].quotes && r[1].quotes['USDKRW=X'];
    if (m && m.price > 500 && m.price < 3000) S.fx = m.price;
    if (r[0] && r[0].rows && r[0].rows.length) { S.data = r[0]; render(); }
    else $('mc-body').innerHTML = '<tr><td colspan="7" class="mc-empty">데이터를 불러오지 못했습니다. 잠시 뒤 다시 열어 주세요.</td></tr>';
    if (!S.fx) { $('mc-cur-krw').disabled = true; $('mc-cur-krw').title = '환율을 불러오지 못했습니다'; }
  }
  window.mcRender = function () {
    var pg = $('page-mcap'); if (!pg || !pg.classList.contains('active')) return;
    if (!S.loading) S.loading = load().finally(function () { setTimeout(function () { S.loading = null; }, 5 * 60 * 1000); });   /* 5분 안에는 다시 받지 않음 */
    render();
  };
  window.mcSetCur = function (c) { if (c === 'krw' && !S.fx) return; S.cur = c; render(); };
  window.mcSetSort = function (s) { S.sort = s; render(); };
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('#mc-chips .mc-chip'); if (!b) return;
    S.cty = b.getAttribute('data-cty'); render();
  });
  document.addEventListener('input', function (e) { if (e.target && e.target.id === 'mc-search') { S.q = e.target.value; if (S.data) table(); } });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', window.mcRender); else window.mcRender();
})();

/* ════════════════════════════════════════
   [SRANK] 국내 나의 연봉 순위 — data/salary_rank.json (Actions '연봉 순위 자료 갱신': 매주 확인)
   국세청 근로소득 백분위(천분위): 상위 0.1~1%(0.1%p) + 2~100%(1%p) 구간별 인원·총급여 합계
   · 경계 연봉: 구간 평균을 구간 가운데에 두고 직선으로 이음 · 상위 0.1% 안은 파레토 분포(위 두 누적 평균으로 α 추정)
   · 입력칸(data-fc="srk")·억/만/원 단위는 [FC-UI] 공통 처리 (window.fcRegister)
════════════════════════════════════════ */
(function () {
  function $(id) { return document.getElementById(id); }
  function setT(id, v) { var e = $(id); if (e) e.textContent = v; }
  function setH(id, v) { var e = $(id); if (e) e.innerHTML = v; }
  var UNIT = { eok: 1e8, man: 1e4, won: 1 };
  function amt(id) { var e = $(id); return e ? Math.round((parseFloat(String(e.value).replace(/,/g, '')) || 0) * (UNIT[e.getAttribute('data-unit')] || 1)) : 0; }
  function eok(n) {
    n = Math.round(Math.max(0, n) / 1e4) * 1e4;
    var e = Math.floor(n / 1e8), m = Math.round((n - e * 1e8) / 1e4);
    return !e ? m.toLocaleString('ko-KR') + '만원' : e.toLocaleString('ko-KR') + '억' + (m ? ' ' + m.toLocaleString('ko-KR') + '만원' : '원');
  }
  function money(n) { return n < 1e4 ? Math.max(0, Math.round(n)).toLocaleString('ko-KR') + '원' : eok(n); }
  function pctTxt(p) {
    if (p < 0.01) return '0.01% 이내';
    var t = p < 1 ? p.toFixed(2) : p.toFixed(1);
    if (t.indexOf('.') >= 0) t = t.replace(/0+$/, '').replace(/\.$/, '');
    return t + '%';
  }
  function cssVar(n, f) { var v = getComputedStyle(document.documentElement).getPropertyValue(n).trim(); return v || f; }

  var M = null, chart = null, loading = false;
  /* 자료 → 모형 { knots:[[상위%, 금액]...] (0.1 이후, 금액 내림차순), t01, alpha, total, mean, buckets(1% 단위 100개) } */
  function build(d) {
    var R = d.rows, prev = 0, mids = [], cn = 0, cs = 0, cum = [];
    R.forEach(function (r) { mids.push([(prev + r[0]) / 2, r[2] / r[1]]); prev = r[0]; cn += r[1]; cs += r[2]; cum.push([r[0], cn, cs]); });
    var M1 = cum[0][2] / cum[0][1], M2 = cum[1][2] / cum[1][1];           // 상위 0.1%·0.2% 누적 평균
    var alpha = Math.log(cum[1][0] / cum[0][0]) / Math.log(M1 / M2);      // 파레토 α (평균 ∝ p^(-1/α))
    if (!(alpha > 1.2 && alpha < 5)) alpha = 2;
    var t01 = M1 * (alpha - 1) / alpha;                                    // 상위 0.1% 경계
    var knots = [[cum[0][0], t01]].concat(mids.slice(1)).concat([[100, 0]]);
    for (var i = 1; i < knots.length; i++) if (knots[i][1] > knots[i - 1][1]) knots[i][1] = knots[i - 1][1];
    var buckets = [], top1 = [0, 0];
    R.forEach(function (r) { if (r[0] <= 1) { top1[0] += r[1]; top1[1] += r[2]; } else buckets.push([r[0], r[2] / r[1], r[1]]); });
    buckets.unshift([1, top1[1] / top1[0], top1[0]]);
    return { d: d, knots: knots, t01: t01, alpha: alpha, p01: cum[0][0], total: cn, mean: cs / cn, buckets: buckets, rows: R };
  }
  function Q(p) {                                   // 상위 p% 경계 연봉
    if (p <= M.p01) return M.t01 * Math.pow(M.p01 / Math.max(p, 1e-4), 1 / M.alpha);
    var k = M.knots;
    for (var i = 1; i < k.length; i++) if (p <= k[i][0]) return k[i - 1][1] + (k[i][1] - k[i - 1][1]) * (p - k[i - 1][0]) / (k[i][0] - k[i - 1][0]);
    return 0;
  }
  function P(x) {                                   // 연봉 x → 상위 몇 %
    if (x <= 0) return 100;
    if (x >= M.t01) return M.p01 * Math.pow(M.t01 / x, M.alpha);
    var k = M.knots;
    for (var i = 1; i < k.length; i++) {
      if (x >= k[i][1]) { var a = k[i - 1], b = k[i]; return a[1] === b[1] ? b[0] : a[0] + (b[0] - a[0]) * (a[1] - x) / (a[1] - b[1]); }
    }
    return 100;
  }
  function bucketMean(p) {                          // 상위 p% 경계 바로 안쪽 구간의 공식 평균
    for (var i = 0; i < M.rows.length; i++) if (M.rows[i][0] >= p - 1e-9) return M.rows[i][2] / M.rows[i][1];
    return null;
  }

  /* 연봉 구간별 근로자 수 (구간 경계의 상위 % 차이 × 전체 인원) — 내 연봉이 든 구간은 빨강 */
  var BANDS = [0, 1e7, 2e7, 3e7, 4e7, 5e7, 6e7, 7e7, 8e7, 9e7, 1e8, 1.2e8, 1.5e8, 2e8, 3e8, Infinity];
  function bandLabel(i) {
    var a = BANDS[i], b = BANDS[i + 1], f = function (v) { return v >= 1e8 ? (v / 1e8) + '억' : (v / 1e7) + '천'; };
    return !a ? '~' + f(b) : b === Infinity ? f(a) + '~' : f(a) + '~' + f(b);
  }
  function draw(x) {
    var cv = $('sr-chart'); if (!cv || typeof Chart === 'undefined') return;
    var my = -1; for (var i = 0; i < BANDS.length - 1; i++) if (x > 0 && x >= BANDS[i] && x < BANDS[i + 1]) my = i;
    var blue = 'rgba(49,130,246,0.6)', red = cssVar('--accent2', '#f04452');
    var colors = BANDS.slice(0, -1).map(function (b, i) { return i === my ? red : blue; });
    if (chart) { chart.data.datasets[0].backgroundColor = colors; chart.update('none'); return; }
    var cnt = BANDS.slice(0, -1).map(function (a, i) { var b = BANDS[i + 1]; return (P(a || 1) - (b === Infinity ? 0 : P(b))) / 100 * M.total; });
    var tick = cssVar('--text3', '#888'), grid = 'rgba(' + cssVar('--fg-rgb', '255,255,255') + ',0.06)';
    chart = new Chart(cv, {
      type: 'bar',
      data: { labels: BANDS.slice(0, -1).map(function (b, i) { return bandLabel(i); }), datasets: [{ data: cnt, backgroundColor: colors, borderRadius: 4, categoryPercentage: 0.8 }] },
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        plugins: { legend: { display: false }, tooltip: { displayColors: false, callbacks: {
          title: function (it) { var i = it[0].dataIndex, a = BANDS[i], z = BANDS[i + 1]; return '연봉 ' + (!a ? eok(z) + ' 미만' : z === Infinity ? eok(a) + ' 이상' : eok(a) + ' ~ ' + eok(z)); },
          label: function (c) { return '약 ' + Math.round(c.parsed.y / 1e4).toLocaleString('ko-KR') + '만 명 (전체의 ' + (c.parsed.y / M.total * 100).toFixed(1) + '%)'; } } } },
        scales: {
          x: { grid: { display: false }, title: { display: true, text: '연봉 (세전 총급여)', color: tick, font: { size: 11 } }, ticks: { color: tick, maxRotation: 0, autoSkip: true, font: { size: 10 } } },
          y: { grid: { color: grid }, border: { display: false }, title: { display: true, text: '근로자 수', color: tick, font: { size: 11 } },
               ticks: { color: tick, font: { size: 10 }, callback: function (v) { return v ? Math.round(v / 1e4).toLocaleString('ko-KR') + '만' : '0'; } } }
        }
      }
    });
  }

  function render() {
    if (!M) { load(); return; }
    var x = amt('sr-pay'), d = M.d;
    var med = Q(50);
    setT('sr-k-med', eok(med)); setT('sr-k-avg', eok(M.mean)); setT('sr-k-mon', x > 0 ? money(x / 12) : '—');
    if (x <= 0) {
      setT('sr-rank', '—'); setT('sr-rank-sub', '연봉을 넣으면 전체 근로자 가운데 내 위치를 보여 줍니다.'); setT('sr-next', ''); share = null; (window.dcShareSpec = window.dcShareSpec || {})['salary-rank'] = null;
      $('sr-gauge-mk').style.left = '0%'; draw(0); table(null); return;
    }
    var p = Math.min(100, Math.max(0, P(x))), rank = Math.max(1, Math.round(p / 100 * M.total));
    setT('sr-rank', '상위 ' + pctTxt(p));
    setH('sr-rank-sub', '근로소득자 <b>' + M.total.toLocaleString('ko-KR') + '명</b> 중 약 <b>' + rank.toLocaleString('ko-KR') + '번째</b> · 중위 연봉의 <b>' + (x / med).toFixed(2) + '배</b>');
    $('sr-gauge-mk').style.left = Math.min(100, Math.max(0, 100 - p)).toFixed(2) + '%';
    var goals = [90, 70, 50, 30, 20, 10, 5, 3, 1, 0.5, 0.1], g = null, shown = parseFloat(pctTxt(p)) || p;   // 화면에 보이는 % 보다 위 단계만
    for (var i = 0; i < goals.length; i++) if (goals[i] < Math.min(p, shown) - 1e-9) { g = goals[i]; break; }
    if (g != null) { var need = Q(g) - x; setH('sr-next', '상위 ' + pctTxt(g) + '에 들려면 연 <b>' + money(need) + '</b> 더 (월 약 ' + money(need / 12) + ')'); }
    else setT('sr-next', '국세청 자료의 가장 높은 구간(상위 0.1%) 안에 듭니다.');
    share = { key: 'salary-rank', chip: '연봉 순위', title: '국내 나의 연봉 순위', label: '전체 근로소득자 ' + Math.round(M.total / 1e4).toLocaleString('ko-KR') + '만 명 중 · 세전 총급여 기준',
      big: '상위 ' + pctTxt(p), sub: '근로소득자 ' + M.total.toLocaleString('ko-KR') + '명 중 약 ' + rank.toLocaleString('ko-KR') + '번째', gauge: 100 - p, shareText: '연봉 ' + money(x),
      rows: [['내 연봉', money(x), true], ['중위 연봉 대비', (x / med).toFixed(2) + '배'], ['월 환산 (세전)', money(x / 12), true],
             g != null ? ['상위 ' + pctTxt(g) + '까지', '연 ' + money(Q(g) - x) + ' 더', true] : ['국세청 자료 최고 구간', '상위 0.1% 안']],
      source: '국세청 「근로소득 백분위(천분위) 자료」' + (M.yr ? ' ' + M.yr + '년 귀속' : '') };
    (window.dcShareSpec = window.dcShareSpec || {})['salary-rank'] = share;   /* 오른쪽 아래 공유 창이 이 카드를 씀 */
    draw(x); table(p);
  }
  function table(myP) {
    var cuts = [0.1, 0.5, 1, 2, 3, 5, 10, 15, 20, 25, 30, 40, 50, 60, 70, 80, 90], out = [], mine = false;
    function meRow(q) { var x = amt('sr-pay'); return '<tr class="fc-hl"><td>▶ 나 (상위 ' + pctTxt(q) + ')</td><td>' + money(x) + '</td><td>' + money(x / 12) + '</td><td>—</td></tr>'; }
    cuts.forEach(function (c) {
      if (myP != null && !mine && myP <= c) { mine = true; out.push(meRow(myP)); }
      var q = Q(c), bm = bucketMean(c);
      out.push('<tr><td>상위 ' + pctTxt(c) + '</td><td>' + eok(q) + '</td><td>' + eok(q / 12) + '</td><td>' + (bm != null ? eok(bm) : '—') + '</td></tr>');
    });
    if (myP != null && !mine) out.push(meRow(myP));
    setH('sr-table', out.join(''));
  }
  function load() {
    if (loading) return; loading = true;
    (window.mdLoad ? window.mdLoad('salary_rank.json') : fetch('data/salary_rank.json').then(function (r) { return r.json(); })).then(function (d) {
      M = build(d); M.yr = d.year;
      setT('sr-subtitle', '국세청 근로소득 천분위 자료(' + d.year + '년 귀속·' + d.filed + '년 신고)로 근로자 ' + (Math.round(d.total / 1e4)).toLocaleString('ko-KR') + '만 명 가운데 내 연봉이 상위 몇 %인지 계산합니다');
      setH('sr-src', '자료: 국세청 「근로소득 백분위(천분위) 자료」 <b>' + d.year + '년 귀속</b> (' + d.filed + '년 신고) · 근로소득자 ' + d.total.toLocaleString('ko-KR') + '명 · <a href="' + d.source + '" target="_blank" rel="noopener">공공데이터포털</a>');
      var pg = $('page-srank'); if (pg && pg.classList.contains('active')) render();
    }).catch(function () { loading = false; setT('sr-src', '자료를 불러오지 못했습니다. 잠시 뒤 다시 열어 주세요.'); });
  }
  var share = null;
  window.fcRegister('srk', render, 'srank');
})();

/* ════════════════════════════════════════
   [ARANK] 국내 나의 자산 순위 — data/asset_rank.json (Actions '연봉·자산 순위 자료 갱신': 매주 확인)
   통계청 가계금융복지조사: 순자산 10분위 경계 P10~P90 · 10분위 평균 · 가구주 연령대별 평균·중앙값 (만원)
   · 상위 10~50%: 경계 사이를 로그로 이음 (구간 평균과 가장 잘 맞음) · 50~90%: 직선 · 90% 아래: 하위 10% 평균에 맞춘 직선
   · 상위 10% 안: 파레토 분포 α = 상위10% 평균 ÷ (평균 − P90)
════════════════════════════════════════ */
(function () {
  function $(id) { return document.getElementById(id); }
  function setT(id, v) { var e = $(id); if (e) e.textContent = v; }
  function setH(id, v) { var e = $(id); if (e) e.innerHTML = v; }
  var UNIT = { eok: 1e8, man: 1e4, won: 1 };
  function amt(id) { var e = $(id); return e ? Math.round((parseFloat(String(e.value).replace(/,/g, '')) || 0) * (UNIT[e.getAttribute('data-unit')] || 1)) : 0; }
  function eok(n) {
    var neg = n < 0; n = Math.round(Math.abs(n) / 1e4) * 1e4;
    var e = Math.floor(n / 1e8), m = Math.round((n - e * 1e8) / 1e4);
    var t = !e ? m.toLocaleString('ko-KR') + '만원' : e.toLocaleString('ko-KR') + '억' + (m ? ' ' + m.toLocaleString('ko-KR') + '만원' : '원');
    return (neg && n ? '−' : '') + t;
  }
  function money(n) { return Math.abs(n) < 1e4 ? (n < 0 ? '−' : '') + Math.round(Math.abs(n)).toLocaleString('ko-KR') + '원' : eok(n); }
  function pctTxt(p) {
    if (p < 0.1) return '0.1% 이내';
    var t = p < 1 ? p.toFixed(2) : p.toFixed(1);
    if (t.indexOf('.') >= 0) t = t.replace(/0+$/, '').replace(/\.$/, '');
    return t + '%';
  }
  function cssVar(n, f) { var v = getComputedStyle(document.documentElement).getPropertyValue(n).trim(); return v || f; }
  function rankTxt(p) { return p > 90 ? '하위 ' + (100 - p < 1 ? '1% 이내' : pctTxt(100 - p)) : '상위 ' + pctTxt(p); }

  var M = null, chart = null, loading = false;
  function build(d) {
    var u = 1e4, B = d.bounds.map(function (v) { return v * u; }), D = d.deciles.map(function (x) { return x[0] * u; });
    var knots = [];                                                   // [상위%, 원] — 10%→P90 … 90%→P10, 100%→최저
    for (var i = 8; i >= 0; i--) knots.push([100 - 10 * (i + 1), B[i]]);   // P90 → 상위 10%, P10 → 상위 90%
    knots.push([100, Math.min(B[0] - 1, 2 * D[0] - B[0])]);          // 하위 10% 평균에 맞춘 최저값
    var alpha = D[9] / (D[9] - B[8]);
    if (!(alpha > 1.1 && alpha < 5)) alpha = 2;
    return { d: d, B: B, D: D, knots: knots, alpha: alpha, mean: d.mean * u, median: d.median * u, ages: d.ages };
  }
  function Q(p) {
    var k = M.knots;
    if (p <= 10) return M.B[8] * Math.pow(10 / Math.max(p, 0.01), 1 / M.alpha);
    for (var i = 1; i < k.length; i++) if (p <= k[i][0]) {
      var a = k[i - 1], b = k[i], f = (p - a[0]) / (b[0] - a[0]);
      return (a[0] < 50 && a[1] > 0 && b[1] > 0) ? Math.exp(Math.log(a[1]) + (Math.log(b[1]) - Math.log(a[1])) * f) : a[1] + (b[1] - a[1]) * f;
    }
    return k[k.length - 1][1];
  }
  function P(x) {
    var k = M.knots;
    if (x >= M.B[8]) return 10 * Math.pow(M.B[8] / x, M.alpha);
    for (var i = 1; i < k.length; i++) if (x >= k[i][1]) {
      var a = k[i - 1], b = k[i];
      if (a[0] < 50 && b[1] > 0) return a[0] + (b[0] - a[0]) * Math.log(a[1] / x) / Math.log(a[1] / b[1]);
      return a[0] + (b[0] - a[0]) * (a[1] - x) / (a[1] - b[1]);
    }
    return 100;
  }

  function draw(p) {
    var cv = $('ar-chart'); if (!cv || typeof Chart === 'undefined') return;
    var my = p == null ? -1 : 9 - Math.min(9, Math.floor(p / 10 - 1e-9));   // 0=하위 10% … 9=상위 10%
    if (p != null && p <= 10) my = 9;
    var blue = 'rgba(49,130,246,0.6)', red = cssVar('--accent2', '#f04452');
    var colors = M.D.map(function (v, i) { return i === my ? red : blue; });
    if (chart) { chart.data.datasets[0].backgroundColor = colors; chart.update('none'); return; }
    var tick = cssVar('--text3', '#888'), grid = 'rgba(' + cssVar('--fg-rgb', '255,255,255') + ',0.06)';
    var lab = M.D.map(function (v, i) { return i === 0 ? '하위 10%' : i === 9 ? '상위 10%' : (i + 1) + '분위'; });
    chart = new Chart(cv, {
      type: 'bar',
      data: { labels: lab, datasets: [{ data: M.D, backgroundColor: colors, borderRadius: 4, categoryPercentage: 0.8 }] },
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        plugins: { legend: { display: false }, tooltip: { displayColors: false, callbacks: {
          title: function (it) { var i = it[0].dataIndex; return (i + 1) + '분위 · 상위 ' + (90 - 10 * i) + '~' + (100 - 10 * i) + '%'; },
          label: function (c) { var i = c.dataIndex; return ['평균 순자산 ' + eok(M.D[i]), '전체 순자산의 ' + M.d.deciles[i][1] + '% 보유',
            '범위 ' + (i ? eok(M.B[i - 1]) : '최저') + ' ~ ' + (i < 9 ? eok(M.B[i]) : '최고')]; } } } },
        scales: {
          x: { grid: { display: false }, ticks: { color: tick, maxRotation: 0, autoSkip: true, font: { size: 10 } } },
          y: { min: Math.floor(Math.min(0, M.D[0]) / 1e8) * 1e8, grid: { color: grid }, border: { display: false }, ticks: { color: tick, font: { size: 10 }, callback: function (v) { return v === 0 ? '0' : (v / 1e8) + '억'; } } }
        }
      }
    });
  }

  function render() {
    if (!M) { load(); return; }
    var x = amt('ar-asset') - amt('ar-debt'), ai = +($('ar-age') || {}).value || 0;
    setT('ar-net', money(x));
    setT('ar-k-med', eok(M.median)); setT('ar-k-avg', eok(M.mean));
    var age = ai ? M.ages[ai] : null;
    setT('ar-k-age-l', age ? age[0] + ' 중앙값' : '같은 연령대 중앙값');
    setT('ar-k-age', age ? eok(age[2] * 1e4) : '연령대를 고르세요');
    var empty = !amt('ar-asset') && !amt('ar-debt');
    if (empty) {
      setT('ar-rank', '—'); setT('ar-rank-sub', '자산과 부채를 넣으면 전체 가구 가운데 우리 집 위치를 보여 줍니다.'); setT('ar-next', ''); share = null; (window.dcShareSpec = window.dcShareSpec || {})['asset-rank'] = null;
      $('ar-gauge-mk').style.left = '0%'; draw(null); table(null); ages(null); return;
    }
    var p = Math.min(100, Math.max(0, P(x))), low = p > 90;
    setT('ar-rank', rankTxt(p));
    setH('ar-rank-sub', '100가구 중 <b>' + Math.max(1, Math.min(100, Math.ceil(p - 1e-9))) + '번째</b>쯤' + (x > 0 ? ' · 순자산 중앙값의 <b>' + (x / M.median).toFixed(2) + '배</b>' +
      (age ? ' · ' + age[0] + ' 중앙값의 <b>' + (x / (age[2] * 1e4)).toFixed(2) + '배</b>' : '') : ' · 순자산 0원 이하 (부채 ≥ 자산)'));
    $('ar-gauge-mk').style.left = Math.min(100, Math.max(0, 100 - p)).toFixed(2) + '%';
    var goals = [90, 70, 50, 30, 20, 10, 5, 1], g = null, shown = low ? p : (parseFloat(pctTxt(p)) || p);
    for (var i = 0; i < goals.length; i++) if (goals[i] < Math.min(p, shown) - 1e-9) { g = goals[i]; break; }
    if (g != null) { var need = Q(g) - x; setH('ar-next', '상위 ' + pctTxt(g) + '에 들려면 순자산 <b>' + money(need) + '</b> 더' + (g < 10 ? ' <small>(상위 10% 안은 추정)</small>' : '')); }
    else setT('ar-next', '상위 1% 안에 듭니다 (상위 10% 안은 추정값).');
    share = { key: 'asset-rank', chip: '자산 순위', title: '국내 나의 자산 순위', label: '전체 가구 기준 · 순자산(자산 − 부채)',
      big: rankTxt(p), sub: '100가구 중 ' + Math.max(1, Math.min(100, Math.ceil(p - 1e-9))) + '번째쯤' + (x <= 0 ? ' · 순자산 0원 이하' : ''), gauge: 100 - p, shareText: '순자산 ' + money(x),
      rows: [['우리 집 순자산', money(x), true], ['순자산 중앙값 대비', x > 0 ? (x / M.median).toFixed(2) + '배' : '—'],
             age ? [age[0] + ' 중앙값 대비', x > 0 ? (x / (age[2] * 1e4)).toFixed(2) + '배' : '—'] : null,
             g != null ? ['상위 ' + pctTxt(g) + '까지', money(Q(g) - x) + ' 더', true] : ['통계 최고 구간', '상위 1% 안']],
      source: '통계청 가계금융복지조사' + (M.yr ? ' ' + M.yr + '년' : '') + (p < 10 ? ' · 상위 10% 안은 추정' : '') };
    (window.dcShareSpec = window.dcShareSpec || {})['asset-rank'] = share;   /* 오른쪽 아래 공유 창이 이 카드를 씀 */
    draw(p); table(p); ages(x);
  }
  function table(myP) {
    var cuts = [1, 3, 5, 10, 20, 30, 40, 50, 60, 70, 80, 90], out = [], mine = false, x = amt('ar-asset') - amt('ar-debt');
    function me(q) { return '<tr class="fc-hl"><td>▶ 우리 집 (' + rankTxt(q) + ')</td><td>' + money(x) + '</td><td>—</td></tr>'; }
    cuts.forEach(function (c) {
      if (myP != null && !mine && myP <= c) { mine = true; out.push(me(myP)); }
      var di = 10 - c / 10;                                        // 상위 (c−10)~c% 구간 = 10분위 중 (di+1)분위
      var dm = (c % 10 === 0 && di >= 0 && di <= 9) ? eok(M.D[di]) : '—';
      out.push('<tr><td>상위 ' + c + '%' + (c < 10 ? ' <small class="fc-sub-inline">추정</small>' : '') + '</td><td>' + eok(Q(c)) + '</td><td>' + dm + '</td></tr>');
    });
    if (myP != null && !mine) out.push(me(myP));
    out.push('<tr><td>하위 10%</td><td>' + eok(M.B[0]) + ' 미만</td><td>' + eok(M.D[0]) + '</td></tr>');
    setH('ar-table', out.join(''));
  }
  function ages(x) {
    var sel = +($('ar-age') || {}).value || 0;
    setH('ar-ages', M.ages.filter(function (a) { return a[0] !== '65세 이상'; }).map(function (a, i) {
      var on = (i === sel && i > 0) ? ' class="fc-hl"' : '';
      return '<tr' + on + '><td>' + a[0] + '</td><td>' + eok(a[1] * 1e4) + '</td><td>' + eok(a[2] * 1e4) + '</td><td>' + a[3] + '%</td><td>' + (x == null || x <= 0 ? '—' : (x / (a[2] * 1e4)).toFixed(2) + '배') + '</td></tr>';
    }).join(''));
  }
  function load() {
    if (loading) return; loading = true;
    (window.mdLoad ? window.mdLoad('asset_rank.json') : fetch('data/asset_rank.json').then(function (r) { return r.json(); })).then(function (d) {
      M = build(d); M.yr = d.year;
      setT('ar-subtitle', '통계청 가계금융복지조사(' + d.base + ' 기준)로 전체 가구 가운데 우리 집 순자산이 상위 몇 %인지 계산합니다');
      setH('ar-src', '자료: ' + d.title + ' <b>' + d.year + '년</b> (' + d.base + ' 기준 자산·부채) · <a href="' + d.source + '" target="_blank" rel="noopener">KOSIS 국가통계포털</a>');
      var pg = $('page-arank'); if (pg && pg.classList.contains('active')) render();
    }).catch(function () { loading = false; setT('ar-src', '자료를 불러오지 못했습니다. 잠시 뒤 다시 열어 주세요.'); });
  }
  var share = null;
  window.fcRegister('ark', render, 'arank');
})();

/* ════════════════════════════════════════
   [APTRANK] 국내 나의 아파트 시세 순위 — data/apt_rank.json (Actions '아파트 시세 순위 갱신': 매일 새벽)
   rows: [단지키, 이름, 금액(만원), 전용㎡, 계약일, 층, 세대수, 시도, 시군구, 법정동 지번, 도로명, 건축년도, 1년 거래 수]
   · 표·검색·페이지(50개)는 ETF 분배 달력의 .dv-* 디자인 · 단지를 누르면 카운터 Worker /apt 로 1년 실거래를 받아 그래프
════════════════════════════════════════ */
(function () {
  function $(id) { return document.getElementById(id); }
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function cssVar(n, f) { var v = getComputedStyle(document.documentElement).getPropertyValue(n).trim(); return v || f; }
  function man(n) {                                          // 만원 → '25억 3,000만원'
    var e = Math.floor(n / 1e4), m = Math.round(n - e * 1e4);
    return !e ? m.toLocaleString('ko-KR') + '만원' : e.toLocaleString('ko-KR') + '억' + (m ? ' ' + m.toLocaleString('ko-KR') + '만원' : '원');
  }
  function short(n) { var e = n / 1e4; return e >= 1 ? (Math.round(e * 10) / 10) + '억' : Math.round(n).toLocaleString('ko-KR') + '만'; }
  function md(d) { return d ? (+d.slice(5, 7)) + '/' + (+d.slice(8, 10)) : ''; }
  function ymd(d) { return d ? d.slice(2).replace(/-/g, '.') : ''; }
  function hid(k) { var h = 5381; for (var i = 0; i < k.length; i++) h = ((h << 5) + h + k.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }   // 단지키(한글 포함) → 요소 id
  var PER = 50, SIDO_ORDER = ['서울', '경기', '인천', '부산', '대구', '광주', '대전', '울산', '세종', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주'];
  var S = { data: null, rows: null, sort: 'price', q: '', sido: '', page: 1, open: {}, loading: false };
  var charts = {}, hist = {};

  function prep(d) {
    var rows = d.rows.map(function (r) {
      var py = r[3] > 0 ? r[2] / (r[3] / 3.3058) : 0;
      return { k: r[0], n: r[1], p: r[2], a: r[3], d: r[4], f: r[5], hh: r[6], sido: r[7], gu: r[8], addr: r[9], road: r[10], by: r[11], cnt: r[12], sa: r[13] || 0, py: py,
               sgg: String(r[0]).slice(0, 5), s: (r[1] + ' ' + r[7] + ' ' + r[8] + ' ' + r[9] + ' ' + r[10]).toLowerCase().replace(/\s+/g, '') };
    });
    rows.sort(function (a, b) { return b.p - a.p || (b.d < a.d ? -1 : b.d > a.d ? 1 : 0); });
    var prev = null;
    rows.forEach(function (r, i) { r.rank = (prev && prev.p === r.p) ? prev.rank : i + 1; prev = r; });   // 같은 금액은 같은 순위
    return rows;
  }
  function list() {
    var q = S.q.toLowerCase().replace(/\s+/g, ''), out = S.rows.filter(function (r) { return (!S.sido || r.sido === S.sido) && (!q || r.s.indexOf(q) >= 0); });
    if (S.sort === 'pyeong') out = out.slice().sort(function (a, b) { return b.py - a.py; });
    else if (S.sort === 'recent') out = out.slice().sort(function (a, b) { return a.d < b.d ? 1 : a.d > b.d ? -1 : b.p - a.p; });
    else if (S.sort === 'hh') out = out.slice().sort(function (a, b) { return (b.hh || 0) - (a.hh || 0) || b.p - a.p; });
    return out;
  }
  function kpis() {
    var R = S.rows, top = R[0], med = R[Math.floor(R.length / 2)], last = R.reduce(function (m, r) { return r.d > m ? r.d : m; }, '');
    $('ap-k-cnt').textContent = R.length.toLocaleString('ko-KR') + '개';
    $('ap-k-cnt-sub').textContent = '최근 1년 매매 ' + R.reduce(function (s, r) { return s + (r.cnt || 0); }, 0).toLocaleString('ko-KR') + '건';
    $('ap-k-top').textContent = top.n; $('ap-k-top-sub').textContent = man(top.p) + ' · 전용 ' + top.a + '㎡ · ' + top.sido + ' ' + top.gu;
    $('ap-k-med').textContent = man(med.p); $('ap-k-med-sub').textContent = '전체 ' + R.length.toLocaleString('ko-KR') + '개 단지의 가운데';
    $('ap-k-last').textContent = last ? +last.slice(5, 7) + '월 ' + (+last.slice(8, 10)) + '일' : '—';
    $('ap-k-last-sub').textContent = '신고 기한 30일 — 최근 거래는 더 늘어날 수 있음';
  }
  function chips() {
    var cnt = {}; S.rows.forEach(function (r) { cnt[r.sido] = (cnt[r.sido] || 0) + 1; });
    var keys = SIDO_ORDER.filter(function (k) { return cnt[k]; }).concat(Object.keys(cnt).filter(function (k) { return SIDO_ORDER.indexOf(k) < 0 && k; }));
    $('ap-chips').innerHTML = '<button type="button" class="dv-chip' + (!S.sido ? ' active' : '') + '" data-sido="">전체</button>' + keys.map(function (k) {
      return '<button type="button" class="dv-chip' + (S.sido === k ? ' active' : '') + '" data-sido="' + esc(k) + '">' + esc(k) + '<small>' + cnt[k].toLocaleString('ko-KR') + '</small></button>';
    }).join('');
  }
  function pager(total, pages) {
    var el = $('ap-pager');
    if (pages <= 1) { el.hidden = true; el.innerHTML = ''; return; }
    var cur = S.page, nums = [];
    for (var i = 1; i <= pages; i++) if (i === 1 || i === pages || Math.abs(i - cur) <= 2) nums.push(i);
    var h = '<button type="button" class="dv-pg" data-pg="' + (cur - 1) + '"' + (cur === 1 ? ' disabled' : '') + ' aria-label="이전 페이지">‹</button>', prev = 0;
    nums.forEach(function (i) {
      if (i - prev > 1) h += '<span class="dv-pg-gap">…</span>';
      h += '<button type="button" class="dv-pg' + (i === cur ? ' active' : '') + '" data-pg="' + i + '"' + (i === cur ? ' aria-current="page"' : '') + '>' + i + '</button>';
      prev = i;
    });
    h += '<button type="button" class="dv-pg" data-pg="' + (cur + 1) + '"' + (cur === pages ? ' disabled' : '') + ' aria-label="다음 페이지">›</button>';
    h += window.pgJump(pages, cur);
    h += '<span class="dv-pg-info">' + ((cur - 1) * PER + 1).toLocaleString('ko-KR') + '–' + Math.min(cur * PER, total).toLocaleString('ko-KR') + ' / ' + total.toLocaleString('ko-KR') + '단지</span>';
    el.hidden = false; el.innerHTML = h;
  }
  function table() {
    var all = list(), pages = Math.max(1, Math.ceil(all.length / PER));
    if (S.page > pages) S.page = pages;
    var rows = all.slice((S.page - 1) * PER, S.page * PER);
    Object.keys(charts).forEach(function (k) { try { charts[k].destroy(); } catch (e) {} delete charts[k]; });
    $('ap-body').innerHTML = rows.length ? rows.map(function (r) {
      var open = !!S.open[r.k];
      return '<tr class="dv-row" data-k="' + esc(r.k) + '" tabindex="0" aria-expanded="' + open + '">' +
        '<td class="ap-c-r' + (r.rank <= 10 ? ' top' : '') + '" data-l="순위">' + r.rank.toLocaleString('ko-KR') + '</td>' +
        '<td class="ap-c-n"><span class="dv-nm">' + esc(r.n) + '</span><span class="dv-tk">' + (r.by ? esc(r.by) + '년 · ' : '') + '1년 ' + r.cnt + '건 거래</span></td>' +
        '<td class="ap-c-p" data-l="실거래가"><b>' + man(r.p) + '</b><small>' + r.a + '㎡ · ' + md(r.d) + (r.f ? ' · ' + esc(r.f) + '층' : '') + '</small></td>' +
        '<td class="ap-c-py" data-l="평당가">' + (r.py ? man(Math.round(r.py)) : '<span class="dv-dim">—</span>') + '</td>' +
        '<td class="ap-c-pz" data-l="평수(전용)">' + (r.a ? (r.a / 3.3058).toFixed(1) + '평' + (r.sa ? '<small title="공급면적 ' + r.sa + '㎡ (건축물대장 전용 + 주거공용)">공급 ' + (r.sa / 3.3058).toFixed(1) + '평</small>' : '') : '<span class="dv-dim">—</span>') + '</td>' +
        '<td class="ap-c-hh" data-l="세대수">' + (r.hh ? r.hh.toLocaleString('ko-KR') : '<span class="dv-dim">—</span>') + '</td>' +
        '<td class="ap-c-addr" data-l="주소">' + esc(r.addr) + (r.road ? '<small>' + esc(r.road) + '</small>' : '') + '</td>' +
        '<td class="ap-c-sido" data-l="지역">' + esc(r.sido) + '</td>' +
        '<td class="ap-c-gu" data-l="구">' + esc(r.gu) + '</td></tr>' +
        (open ? '<tr class="dv-hist"><td colspan="9"><div id="ap-h-' + hid(r.k) + '"></div></td></tr>' : '');
    }).join('') : '<tr><td colspan="9" class="dv-empty">' + (S.q ? '‘' + esc(S.q) + '’에 맞는 아파트가 없습니다.' : '자료가 없습니다.') + '</td></tr>';
    pager(all.length, pages);
    rows.forEach(function (r) { if (S.open[r.k]) histDraw(r); });
  }
  /* 단지 실거래 전체 기간: 최근 13개월은 카운터 Worker(/apt?all=1), 그 이전(2006년~)은 data/apt_hist/<시군구>/<연도>.json */
  var histIdx = null, yearFiles = {};
  function loadIdx() { return histIdx || (histIdx = fetch('data/apt_hist/index.json?v=' + Math.floor(Date.now() / 36e5)).then(function (x) { return x.ok ? x.json() : null; }).catch(function () { return null; })); }
  function loadYear(sgg, y) {
    var k = sgg + '/' + y;
    return yearFiles[k] || (yearFiles[k] = fetch('data/apt_hist/' + k + '.json?v=' + Math.floor(Date.now() / 36e5)).then(function (x) { return x.ok ? x.json() : null; }).catch(function () { return null; }));
  }
  function loadAll(r, base) {
    var recent = fetch(base.replace(/\/$/, '') + '/apt?all=1&sgg=' + r.sgg + '&seq=' + encodeURIComponent(r.k)).then(function (x) { return x.json(); });
    return Promise.all([recent, loadIdx()]).then(function (a) {
      var j = a[0], idx = a[1];
      if (!j || !j.deals) throw new Error((j && j.error) || 'no data');
      var from = j.from || '999999', years = ((idx && idx.sgg && idx.sgg[r.sgg]) || []).filter(function (y) { return y <= from.slice(0, 4); });
      return Promise.all(years.map(function (y) { return loadYear(r.sgg, y).then(function (f) { return [y, f]; }); })).then(function (fs) {
        var old = [];
        fs.forEach(function (yf) {
          var y = yf[0], f = yf[1]; if (!f) return;
          var ki = f.k.indexOf(r.k); if (ki < 0) return;
          f.d.forEach(function (d) { if (d[0] === ki && (y + d[1].slice(0, 2)) < from) old.push([y + '-' + d[1].slice(0, 2) + '-' + d[1].slice(2), d[2], d[3], d[4]]); });
        });
        return { deals: old.concat(j.deals).sort(function (p, q) { return p[0] < q[0] ? -1 : p[0] > q[0] ? 1 : 0; }), idx: idx };
      });
    });
  }
  var RANGE = [['1', 1], ['3', 3], ['5', 5], ['10', 10], ['all', 0]];
  function histDraw(r) {
    var box = $('ap-h-' + hid(r.k)); if (!box) return;
    var shareBtn = '<button type="button" class="shc-open ap-share" data-k="' + esc(r.k) + '"><svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M8 2v8M4.8 5.2 8 2l3.2 3.2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M3 9.5V13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V9.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>순위 공유</button>';
    var H = hist[r.k];
    if (!H) {
      box.innerHTML = '<div class="ap-hist-head">' + shareBtn + '</div><div class="ap-hist-msg">전체 기간 실거래를 불러오는 중…</div>';
      var go = function (base) {
        if (!base) { box.innerHTML = '<div class="ap-hist-head">' + shareBtn + '</div><div class="ap-hist-msg">실거래 그래프를 불러오지 못했습니다.</div>'; return; }
        loadAll(r, base).then(function (x) { hist[r.k] = { deals: x.deals, idx: x.idx, range: 'all' }; histDraw(r); })
          .catch(function () { box.innerHTML = '<div class="ap-hist-head">' + shareBtn + '</div><div class="ap-hist-msg">실거래 그래프를 불러오지 못했습니다. 잠시 뒤 다시 눌러 주세요.</div>'; delete S.open[r.k]; });
      };
      if (window.__counterEP) go(window.__counterEP); else (window.mdLoad ? window.mdLoad('counter.json') : Promise.resolve(null)).then(function (c) { window.__counterEP = c && c.endpoint; go(window.__counterEP); });
      return;
    }
    var all = H.deals, yrs = H.range === 'all' ? 0 : +H.range;
    var cutD = yrs ? new Date(Date.now() + 9 * 3600e3 - yrs * 365.25 * 864e5).toISOString().slice(0, 10) : '';
    var h = all.filter(function (d) { return !cutD || d[0] >= cutD; });
    var span = all.length ? Math.ceil((Date.now() - Date.parse(all[0][0])) / (365.25 * 864e5)) : 0;
    var tabs = '<div class="chart-tabs ap-range" role="group" aria-label="기간">' + RANGE.filter(function (x) { return !x[1] || x[1] < span + 1; }).map(function (x) {
      return '<button type="button" class="chart-tab' + (H.range === x[0] ? ' active' : '') + '" data-range="' + x[0] + '" data-k="' + esc(r.k) + '">' + (x[1] ? x[1] + '년' : '전체') + '</button>';
    }).join('') + '</div>';
    var ix = H.idx, prog = ix && ix.total && ix.done < ix.total ? '<span class="ap-prog">과거 자료 채우는 중 ' + Math.floor(ix.done / ix.total * 100) + '% (2006년~' + ix.to.slice(0, 4) + '.' + ix.to.slice(4) + ')</span>' : '';
    if (!h.length) { box.innerHTML = '<div class="ap-hist-head">' + tabs + prog + shareBtn + '</div><div class="ap-hist-msg">이 기간에는 거래 자료가 없습니다.</div>'; return; }
    var areas = {}; h.forEach(function (d) { var k = Math.round(d[2]); (areas[k] = areas[k] || []).push(d); });
    var keys = Object.keys(areas).sort(function (a, b) { return areas[b].length - areas[a].length; });
    var hi = h.reduce(function (m, d) { return d[1] > m[1] ? d : m; }), lo = h.reduce(function (m, d) { return d[1] < m[1] ? d : m; });
    var id = 'ap-c-' + hid(r.k);
    box.innerHTML = '<div class="ap-hist-head">' + tabs + prog + shareBtn + '</div><div class="ap-hist-top"><span>' + (yrs ? '최근 ' + yrs + '년' : h[0][0].slice(0, 4) + '년~') + ' 매매 <b>' + h.length.toLocaleString('ko-KR') + '건</b></span><span>최고 <b>' + man(hi[1]) + '</b> <small>(' + hi[2] + '㎡ · ' + ymd(hi[0]) + ')</small></span><span>최저 <b>' + man(lo[1]) + '</b> <small>(' + lo[2] + '㎡ · ' + ymd(lo[0]) + ')</small></span></div>' +
      '<div class="ap-chart"><canvas id="' + id + '" aria-label="' + esc(r.n) + ' 실거래가 그래프"></canvas></div>';
    if (typeof Chart === 'undefined') return;
    var pal = ['#3182f6', '#f04452', '#fe9800', '#22c55e', '#a855f7', '#14b8a6'], tick = cssVar('--text3', '#888'), grid = 'rgba(' + cssVar('--fg-rgb', '255,255,255') + ',0.06)';
    var ds = keys.slice(0, 6).map(function (k, i) {
      return { label: '전용 ' + k + '㎡', data: areas[k].map(function (d) { return { x: Date.parse(d[0] + 'T00:00:00+09:00'), y: d[1], f: d[3], a: d[2] }; }).sort(function (p, q) { return p.x - q.x; }),
               borderColor: pal[i], backgroundColor: pal[i], showLine: areas[k].length > 1, borderWidth: h.length > 300 ? 1 : 1.5, pointRadius: h.length > 300 ? 2 : 3.5, pointHoverRadius: 6, tension: 0 };
    });
    if (keys.length > 6) ds.push({ label: '기타 면적', data: [].concat.apply([], keys.slice(6).map(function (k) { return areas[k]; })).map(function (d) { return { x: Date.parse(d[0] + 'T00:00:00+09:00'), y: d[1], f: d[3], a: d[2] }; }), borderColor: '#888', backgroundColor: '#888', showLine: false, pointRadius: 3 });
    var narrow = window.innerWidth < 600;
    charts[r.k] = new Chart($(id), {
      type: 'scatter', data: { datasets: ds },
      options: { responsive: true, maintainAspectRatio: false, animation: false,
        plugins: { legend: { display: true, position: 'bottom', labels: { color: cssVar('--text2', '#aaa'), boxWidth: 10, boxHeight: 10, usePointStyle: true, font: { size: narrow ? 10 : 11 } } },
          tooltip: { callbacks: { title: function (it) { var t = new Date(it[0].parsed.x + 9 * 3600e3); return t.toISOString().slice(0, 10).replace(/-/g, '/'); },
            label: function (c) { var p = c.raw; return ' ' + man(p.y) + ' · 전용 ' + p.a + '㎡' + (p.f ? ' · ' + p.f + '층' : ''); } } } },
        scales: {
          x: { type: 'linear', grid: { display: false }, border: { color: grid }, ticks: { color: tick, maxRotation: 0, autoSkip: true, maxTicksLimit: narrow ? 4 : 7, font: { size: 10 },
               callback: function (v) { var t = new Date(v + 9 * 3600e3); return String(t.getUTCFullYear()).slice(2) + '.' + String(t.getUTCMonth() + 1).padStart(2, '0'); } } },
          y: { grid: { color: grid }, border: { display: false }, ticks: { color: tick, font: { size: 10 }, callback: function (v) { return short(v); } } }
        } }
    });
  }
  function note() {
    var d = S.data, u = d.updated ? new Date(d.updated) : null;
    $('ap-note').innerHTML = '자료: 국토교통부 아파트 매매 실거래가(공공데이터포털) · 세대수: 한국부동산원 공동주택 단지 식별정보 — 계약 ' +
      d.months[0].slice(0, 4) + '.' + d.months[0].slice(4) + '~' + d.months[1].slice(0, 4) + '.' + d.months[1].slice(4) + ' 중 최근 1년, 계약 해제 거래 제외' +
      (u ? ' · 마지막 갱신 ' + u.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');
  }
  function render() {
    if (!S.rows) { load(); return; }
    kpis(); chips(); table(); note();
    document.querySelectorAll('#page-aptrank .ap-sort .chart-tab').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-sort') === S.sort); });
  }
  function load() {
    if (S.loading || !window.mdLoad) return; S.loading = true;
    window.mdLoad('apt_rank.json').then(function (d) {
      S.loading = false;
      if (!d || !d.rows || !d.rows.length) { $('ap-body').innerHTML = '<tr><td colspan="9" class="dv-empty">아파트 실거래 자료를 준비하고 있습니다. 잠시 뒤 다시 열어 주세요.</td></tr>'; return; }
      S.data = d; S.rows = prep(d);
      var pg = $('page-aptrank'); if (pg && pg.classList.contains('active')) render();
    }).catch(function () { S.loading = false; $('ap-body').innerHTML = '<tr><td colspan="9" class="dv-empty">자료를 불러오지 못했습니다. 잠시 뒤 다시 열어 주세요.</td></tr>'; });
  }
  /* [SHARE-CARD] 단지 순위 공유 — 전국·시도·시군구 순위 (가장 최근 실거래가 기준, 같은 금액은 같은 순위) */
  function shareApt(r) {
    var R = S.rows, n = R.length;
    function rankIn(f) { var a = R.filter(f); return [a.filter(function (x) { return x.p > r.p; }).length + 1, a.length]; }
    var sd = rankIn(function (x) { return x.sido === r.sido; }), gu = rankIn(function (x) { return x.sgg === r.sgg; });
    var top = r.rank / n * 100, topTxt = (top < 1 ? top.toFixed(2) : top < 10 ? top.toFixed(1) : Math.round(top)) + '%';
    window.shareCard.open({ key: 'apt-rank', chip: '아파트 시세 순위', title: r.n, label: r.sido + ' ' + r.gu + ' ' + r.addr + (r.by ? ' · ' + r.by + '년' : ''),
      big: '전국 ' + r.rank.toLocaleString('ko-KR') + '위', sub: '최근 1년 거래된 ' + n.toLocaleString('ko-KR') + '개 단지 중 상위 ' + topTxt, gauge: 100 - top,
      rows: [['최근 실거래가', man(r.p) + ' · ' + r.a + '㎡'], [r.sido + ' 순위', sd[0].toLocaleString('ko-KR') + '위 / ' + sd[1].toLocaleString('ko-KR') + '개'],
             [r.gu + ' 순위', gu[0].toLocaleString('ko-KR') + '위 / ' + gu[1].toLocaleString('ko-KR') + '개'], r.py ? ['평당가 (전용)', man(Math.round(r.py))] : null],
      source: '국토교통부 아파트 매매 실거래가 · 계약 ' + ymd(r.d) + ' 기준' });
  }
  window.apRender = function () { var pg = $('page-aptrank'); if (pg && pg.classList.contains('active')) render(); };

  document.addEventListener('click', function (e) {
    if (!e.target.closest || !e.target.closest('#page-aptrank')) return;
    var t = e.target.closest('.ap-sort .chart-tab');
    if (t) { S.sort = t.getAttribute('data-sort'); S.page = 1; render(); return; }
    var c = e.target.closest('#ap-chips .dv-chip');
    if (c) { S.sido = c.getAttribute('data-sido'); S.page = 1; render(); return; }
    var pgb = e.target.closest('#ap-pager .dv-pg');
    if (pgb && !pgb.disabled) { S.page = +pgb.getAttribute('data-pg'); table(); var top = $('ap-body').closest('.dv-card'); if (top) top.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    var sh = e.target.closest('.ap-share');
    if (sh) { var sr = S.rows.find(function (x) { return x.k === sh.getAttribute('data-k'); }); if (sr) shareApt(sr); return; }
    var rg = e.target.closest('.ap-range .chart-tab');
    if (rg) { var hk = rg.getAttribute('data-k'), rr = S.rows.find(function (x) { return x.k === hk; }); if (hist[hk] && rr) { hist[hk].range = rg.getAttribute('data-range'); if (charts[hk]) { charts[hk].destroy(); delete charts[hk]; } histDraw(rr); } return; }
    var row = e.target.closest('tr.dv-row');
    if (row && row.closest('#ap-body')) { var k = row.getAttribute('data-k'); if (S.open[k]) delete S.open[k]; else S.open[k] = 1; table(); }
  });
  document.addEventListener('keydown', function (e) {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('#ap-body tr.dv-row')) { e.preventDefault(); e.target.click(); }
  });
  var qT = null;
  document.addEventListener('input', function (e) {
    if (e.target && e.target.id === 'ap-search') { clearTimeout(qT); var v = e.target.value; qT = setTimeout(function () { S.q = v.trim(); S.page = 1; if (S.rows) table(); }, 150); }
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', window.apRender); else window.apRender();
})();

/* ════════════════════════════════════════
   [FX-DXY] 환율 계산기 — 달러인덱스 (DX-Y.NYB)
   데이터: data/dxy.json (Actions: 야후 일봉 전체, 6시간마다) + data/market.json 시세(15분마다)로 최근값 이어 붙임
           → 둘 다 없으면 Yahoo 직접(프록시)
   기간: 1M·3M·6M·1Y·3Y·5Y·10Y·MAX — 기간 변화율은 시작일 이전 마지막 거래일 종가 기준
════════════════════════════════════════ */
(function () {
  var SYM = 'DX-Y.NYB', MONTHS = { '1M': 1, '3M': 3, '6M': 6, '1Y': 12, '3Y': 36, '5Y': 60, '10Y': 120 };
  var S = { pts: null, quote: null, src: '', period: '1Y', from: null, to: null, chart: null, loading: null };
  function $(id) { return document.getElementById(id); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function dayStr(d, sep) { var t = new Date(d * 86400000); sep = sep || '-'; return t.getUTCFullYear() + sep + pad(t.getUTCMonth() + 1) + sep + pad(t.getUTCDate()); }
  var NYF = null;
  function nyDay(sec) {   /* 미국 동부(뉴욕) 날짜 → 일수 (서버 dxy.json 과 같은 기준) */
    try {
      NYF = NYF || new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' });
      var p = NYF.formatToParts(new Date(sec * 1000)), o = {};
      p.forEach(function (x) { o[x.type] = x.value; });
      return Math.floor(Date.UTC(+o.year, +o.month - 1, +o.day) / 86400000);
    } catch (e) { return Math.floor((sec - 5 * 3600) / 86400); }
  }
  function addMonths(day, n) {
    var t = new Date(day * 86400000), y = t.getUTCFullYear(), m = t.getUTCMonth() + n;
    var last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    return Math.floor(Date.UTC(y, m, Math.min(t.getUTCDate(), last)) / 86400000);
  }
  function cssVar(n, f) { var v = getComputedStyle(document.documentElement).getPropertyValue(n).trim(); return v || f; }
  function sgn(v, d) { return (v >= 0 ? '+' : '') + v.toFixed(d); }
  function status(msg) { var s = $('dxy-status'); if (s) { s.textContent = msg || ''; s.style.display = msg ? 'flex' : 'none'; } }
  function merge(base, add) {   /* [일수, 값] 배열 — add 가 같은 날을 덮어씀 */
    var m = {}; base.concat(add).forEach(function (p) { m[p[0]] = p[1]; });
    return Object.keys(m).map(Number).sort(function (a, b) { return a - b; }).map(function (d) { return [d, m[d]]; });
  }

  function load() {
    if (S.loading) return S.loading;
    S.loading = (async function () {
      var pts = [], q = null, srcs = [];
      try {
        var j = window.mdLoad ? await window.mdLoad('dxy.json') : null;
        if (j && j.c && j.c.length > 100) {
          var d = j.d0; pts.push([d, j.c[0]]);
          for (var i = 1; i < j.c.length; i++) { d += j.dd[i - 1]; pts.push([d, j.c[i]]); }
          srcs.push('Yahoo Finance 일봉' + (j.updated ? ' (' + j.updated.slice(0, 10) + ' 갱신)' : ''));
        }
      } catch (e) {}
      try {
        var m = window.mdLoad ? await window.mdLoad('market.json') : null;
        q = m && m.quotes && m.quotes[SYM];
        if (q && q.daily && q.daily.length) pts = merge(pts, q.daily.map(function (p) { return [nyDay(p[0]), p[1]]; }));
      } catch (e) {}
      if (pts.length < 100) {                        /* 대체: Yahoo 직접 */
        try {
          var r = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(SYM) + '?period1=31536000&period2=' + Math.floor(Date.now() / 1000) + '&interval=1d');
          var res = (await r.json()).chart.result[0], ts = res.timestamp || [], cl = (res.indicators.quote[0] || {}).close || [], yp = [];
          ts.forEach(function (t, i) { if (cl[i] > 20 && cl[i] < 300) yp.push([nyDay(t), +cl[i].toFixed(3)]); });
          if (yp.length > pts.length) { pts = merge(pts, yp); srcs = ['Yahoo Finance']; }
          if (!q && res.meta) q = { price: res.meta.regularMarketPrice, prev: res.meta.chartPreviousClose, time: res.meta.regularMarketTime };
        } catch (e) {}
      }
      if (pts.length < 2) { S.loading = null; return false; }
      /* 시세 현재가가 마지막 일봉보다 새것이면 오늘 값으로 반영 */
      if (q && q.price > 0 && q.time) {
        var qd = nyDay(q.time);
        if (qd >= pts[pts.length - 1][0]) pts = merge(pts, [[qd, +(+q.price).toFixed(3)]]);
      }
      S.pts = pts; S.quote = q; S.src = srcs.join(' · ') || 'Yahoo Finance';
      return true;
    })();
    return S.loading;
  }

  function header() {
    var pts = S.pts, last = pts[pts.length - 1], prev = pts.length > 1 ? pts[pts.length - 2][1] : null, q = S.quote;
    var price = last[1], base = prev;
    if (q && q.price > 0 && q.prev > 0 && Math.abs(q.price - price) < 1e-6) base = q.prev;   /* 시세가 마지막 값이면 시세의 전일 종가 */
    var el = $('dxy-price'); if (el) el.textContent = price.toFixed(2);
    var c = $('dxy-chg');
    if (c) {
      if (base) {
        var ch = price - base, up = ch >= 0;
        c.textContent = (up ? '▲ ' : '▼ ') + Math.abs(ch).toFixed(2) + ' (' + sgn(ch / base * 100, 2) + '%)';
        c.style.color = ch === 0 ? 'var(--text3)' : (up ? 'var(--accent2)' : 'var(--accent)');
      } else c.textContent = '';
    }
    var sub = $('dxy-sub');
    if (sub) {
      var t = q && q.time && Math.abs(q.price - price) < 1e-6 ? new Date(q.time * 1000) : null;
      sub.textContent = '유로·엔·파운드 등 주요 6개 통화 대비 미국 달러 가치 (1973년 3월 = 100) · '
        + (t ? t.getFullYear() + '-' + pad(t.getMonth() + 1) + '-' + pad(t.getDate()) + ' ' + pad(t.getHours()) + ':' + pad(t.getMinutes()) + ' 기준 (한국 시간)' : dayStr(last[0]) + ' 종가');
    }
  }

  /* 선택 기간 → [기준 인덱스(시작일 이전 마지막 거래일), 끝 인덱스] */
  function span() {
    var pts = S.pts, first = pts[0][0], last = pts[pts.length - 1][0], start = first, end = last, i;
    if (S.period === 'CUSTOM') { start = S.from != null ? S.from : first; end = S.to != null ? S.to : last; }
    else if (MONTHS[S.period]) start = addMonths(last, -MONTHS[S.period]);
    var s = 0, e = pts.length - 1;
    for (i = 0; i < pts.length && pts[i][0] <= start; i++) s = i;
    while (e > s && pts[e][0] > end) e--;
    return [s, e];
  }
  function strDay(x) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(x || ''); return m ? Math.floor(Date.UTC(+m[1], +m[2] - 1, +m[3]) / 86400000) : null; }

  function render() {
    var page = $('page-fx');
    if (!S.pts || !page || !page.classList.contains('active') || !window.Chart) return;
    var canvas = $('dxy-chart'); if (!canvas) return;
    header();
    var se = span(), pts = S.pts, seg = pts.slice(se[0], se[1] + 1), lastD = seg[seg.length - 1][0];
    var f = $('dxy-from'), t = $('dxy-to');
    if (f && !f.min) { f.min = t.min = dayStr(pts[0][0]); f.max = t.max = dayStr(pts[pts.length - 1][0]); }
    if (seg.length < 2) { status('선택한 기간에 거래일이 부족합니다.'); if (S.chart) { S.chart.destroy(); S.chart = null; } var st0 = $('dxy-stats'); if (st0) st0.innerHTML = ''; return; }
    status('');
    var data = seg.map(function (p) { return { x: p[0], y: p[1] }; });
    var v0 = seg[0][1], v1 = seg[seg.length - 1][1], hi = seg[0], lo = seg[0];
    seg.forEach(function (p) { if (p[1] > hi[1]) hi = p; if (p[1] < lo[1]) lo = p; });
    var chg = (v1 / v0 - 1) * 100, up = chg >= 0;
    var red = cssVar('--accent2', '#f04452'), blue = cssVar('--accent', '#3182f6'), col = up ? red : blue, tick = cssVar('--text3', '#888');
    var st = $('dxy-stats');
    if (st) st.innerHTML = '<div>기간 변화<b style="color:' + col + '">' + sgn(chg, 2) + '%</b></div>'
      + '<div>기간 최고<b>' + hi[1].toFixed(2) + '</b>' + dayStr(hi[0], '.') + '</div>'
      + '<div>기간 최저<b>' + lo[1].toFixed(2) + '</b>' + dayStr(lo[0], '.') + '</div>';
    var narrow = (canvas.parentNode.clientWidth || 700) < 520, xmin = data[0].x, xmax = data[data.length - 1].x;
    if (S.chart) { S.chart.destroy(); S.chart = null; }
    S.chart = new Chart(canvas, {
      type: 'line',
      data: { datasets: [{ label: '달러인덱스', data: data, borderColor: col, backgroundColor: col, borderWidth: 1.2,
                           pointRadius: 0, pointHoverRadius: 3, tension: 0, fill: false, parsing: false }] },
      options: {
        responsive: true, maintainAspectRatio: false, animation: false, parsing: false, normalized: true,
        interaction: { mode: 'nearest', axis: 'x', intersect: false },
        plugins: {
          legend: { display: false },
          decimation: { enabled: true, algorithm: 'lttb', samples: narrow ? 300 : 700 },
          tooltip: { callbacks: { title: function (it) { return it.length ? dayStr(it[0].parsed.x, '/') : ''; },
                                  label: function (c) { return ' 달러인덱스  ' + c.parsed.y.toFixed(2) + '  (' + sgn((c.parsed.y / v0 - 1) * 100, 2) + '%)'; } } }
        },
        scales: {
          x: { type: 'linear', min: xmin, max: xmax, grid: { display: false }, border: { color: fgA(0.25) },
               afterBuildTicks: function (ax) {   /* 1년 넘는 기간은 1월 1일(1·2·5·10년 간격), 짧은 기간은 매월 1일, 한 달 이하는 매주 월요일 */
                 var lo2 = ax.min, hi2 = ax.max, lim = narrow ? 4 : 7, a = new Date(lo2 * 86400000), z = new Date(hi2 * 86400000), out = [], y, m, stp;
                 var months = (z.getUTCFullYear() - a.getUTCFullYear()) * 12 + z.getUTCMonth() - a.getUTCMonth();
                 if (months > 24) {
                   stp = [1, 2, 5, 10].find(function (k) { return months / 12 / k <= lim; }) || 10;
                   for (y = a.getUTCFullYear() + 1; y <= z.getUTCFullYear(); y++) if (y % stp === 0) out.push({ value: Date.UTC(y, 0, 1) / 86400000 });
                 } else {
                   stp = [1, 2, 3, 6].find(function (k) { return months / k <= lim; }) || 6;
                   for (m = 1; m <= months; m++) { var d = new Date(Date.UTC(a.getUTCFullYear(), a.getUTCMonth() + m, 1)); if (d.getUTCMonth() % stp === 0) out.push({ value: d.getTime() / 86400000 }); }
                 }
                 if (months <= 1) { for (var dd = Math.ceil(lo2); dd <= hi2; dd++) if (new Date(dd * 86400000).getUTCDay() === 1) out.push({ value: dd }); }
                 ax.ticks = out.filter(function (t) { return t.value >= lo2 && t.value <= hi2; });
               },
               ticks: { color: tick, maxRotation: 0, autoSkip: false, font: { size: narrow ? 10 : 11 },
                        callback: function (v) { var x = dayStr(v, '/'); return x.slice(5) === '01/01' ? x.slice(0, 4) : (x.slice(8) === '01' ? x.slice(0, 7) : x.slice(5)); } } },
          y: { position: 'right', border: { display: false }, grid: { color: fgA(0.07) },
               ticks: { color: tick, maxTicksLimit: 7, font: { size: narrow ? 10 : 11 } } }
        }
      }
    });
    window.chartZoom.attach(canvas, S.chart, { min: xmin, max: xmax, minSpan: 7 });
    var note = $('dxy-note');
    if (note) note.innerHTML = zpHint() + '<br>'
      + '기간 ' + dayStr(seg[0][0], '/') + ' ~ ' + dayStr(lastD, '/') + ' · 변화율은 ' + dayStr(seg[0][0], '/') + ' 종가 ' + v0.toFixed(2) + ' 기준'
      + ' · 오르면 달러 강세(빨강), 내리면 달러 약세(파랑) · 출처: ' + S.src;
  }

  window.dxyRender = function () {
    var page = $('page-fx'); if (!page || !page.classList.contains('active')) return;
    if (S.pts) { render(); return; }
    status('달러인덱스를 불러오는 중…');
    load().then(function (ok) { if (ok) render(); else status('달러인덱스 자료를 불러오지 못했습니다. 잠시 후 다시 열어 주세요.'); });
  };
  window.dxySetPeriod = function (p) {
    var tabs = $('dxy-tabs'); if (tabs) tabs.querySelectorAll('.chart-tab').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-per') === p); });
    var box = $('dxy-custom');
    if (p === 'CUSTOM') {
      if (box) box.style.display = 'flex';
      var f = $('dxy-from'), t = $('dxy-to');
      if (S.pts && f && !f.value) { var se = span(); f.value = dayStr(S.pts[se[0]][0]); t.value = dayStr(S.pts[se[1]][0]); }   /* 처음 열 때 지금 보이는 기간으로 채움 */
      window.dxyApplyCustom(); return;
    }
    if (box) box.style.display = 'none';
    S.period = p; render();
  };
  window.dxyApplyCustom = function () {
    var f = strDay(($('dxy-from') || {}).value), t = strDay(($('dxy-to') || {}).value), err = $('dxy-err');
    if (err) err.textContent = '';
    if (f != null && t != null && f >= t) { if (err) err.textContent = L('종료일은 시작일보다 뒤여야 합니다.', 'The end date must be after the start date.'); return; }
    S.from = f; S.to = t; S.period = 'CUSTOM'; render();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(window.dxyRender, 0); });
  else setTimeout(window.dxyRender, 0);
})();

/* ════════════════════════════════════════
   [FX] 환율 계산기
   데이터: [MARKET-DATA] 시세 계층 (data/*.json)
   2순위: exchangerate-api 공개 엔드포인트
   기준통화: KRW (원화)
════════════════════════════════════════ */
const FX_CURRENCIES = [
  { code:'USD', name:'미국 달러',    flag:'🇺🇸', symbol:'$'   },
  { code:'EUR', name:'유로',         flag:'🇪🇺', symbol:'€'   },
  { code:'JPY', name:'일본 엔',      flag:'🇯🇵', symbol:'¥'   },
  { code:'CNY', name:'중국 위안',    flag:'🇨🇳', symbol:'¥'   },
  { code:'GBP', name:'영국 파운드',  flag:'🇬🇧', symbol:'£'   },
  { code:'HKD', name:'홍콩 달러',    flag:'🇭🇰', symbol:'HK$' },
  { code:'SGD', name:'싱가포르 달러',flag:'🇸🇬', symbol:'S$'  },
  { code:'AUD', name:'호주 달러',    flag:'🇦🇺', symbol:'A$'  },
  { code:'CAD', name:'캐나다 달러',  flag:'🇨🇦', symbol:'C$'  },
  { code:'CHF', name:'스위스 프랑',  flag:'🇨🇭', symbol:'Fr'  },
  { code:'THB', name:'태국 바트',    flag:'🇹🇭', symbol:'฿'   },
  { code:'VND', name:'베트남 동',    flag:'🇻🇳', symbol:'₫'   },
];

/* [FX-UNIT] 통화별 단위 이름 — 억·만 버튼 라벨 (예: 억달러·만달러·달러 / 억엔·만엔·엔) */
const FX_UNIT_NAME = { KRW:'원', USD:'달러', EUR:'유로', JPY:'엔', CNY:'위안', GBP:'파운드', HKD:'홍콩달러',
  SGD:'싱가포르달러', AUD:'호주달러', CAD:'캐나다달러', CHF:'프랑', THB:'바트', VND:'동' };
const FX_UNITS = [ { m:1e8, p:'억' }, { m:1e4, p:'만' }, { m:1, p:'' } ];
let _fxInUnit = 1, _fxOutUnit = 1;     /* 입력 금액 단위 · 결과 표시 단위 */
function fxUnitLabel(code, m) { const u = FX_UNITS.find(x => x.m === m) || FX_UNITS[2]; return u.p + (FX_UNIT_NAME[code] || code); }
function fxRenderUnits(fromCode, toCode) {
  [['fx-in-units', fromCode, _fxInUnit, 'in'], ['fx-out-units', toCode, _fxOutUnit, 'out']].forEach(([id, code, cur, side]) => {
    const box = document.getElementById(id);
    if (!box) return;
    box.innerHTML = FX_UNITS.map(u => '<button type="button" class="fx-unit' + (u.m === cur ? ' on' : '') + '" aria-pressed="' + (u.m === cur) + '" onclick="fxSetUnit(\'' + side + '\',' + u.m + ')">' + u.p + (FX_UNIT_NAME[code] || code) + '</button>').join('');
  });
}
function fxSetUnit(side, m) { if (side === 'in') _fxInUnit = m; else _fxOutUnit = m; fxConvert(); }
/* 단위로 나눈 값 표시: 1(기본)은 기존 형식, 만·억은 소수 4자리까지 + 단위 이름 */
function fxFmtUnit(v, code, m) {
  if (m === 1) return code === 'KRW' ? fxFmt(v, code) : fxFmt(v, code) + ' ' + (FX_UNIT_NAME[code] || code);
  const x = v / m, ax = Math.abs(x);
  const d = ax >= 1000 ? 2 : 4;
  return x.toLocaleString('ko-KR', { maximumFractionDigits: d }) + fxUnitLabel(code, m);
}

/* 환율 캐시 (KRW 기준, 1 외화 = N원) */
const _fxRates = {};
let _fxFetching = false;

function fxFmt(n, code) {
  if (code === 'KRW') return Math.round(n).toLocaleString('ko-KR') + '원';
  if (code === 'JPY' || code === 'VND') return Math.round(n).toLocaleString();
  return n.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:4});
}

/* ── 환율 조회 ── */
async function fetchFxRates() {
  if (_fxFetching) return;
  _fxFetching = true;
  const btn  = document.getElementById('fx-refresh-btn');
  const icon = document.getElementById('fx-refresh-icon');
  const load = document.getElementById('fx-loading');
  const stat = document.getElementById('fx-status-label');
  if (btn)  btn.disabled = true;
  if (icon) icon.textContent = '⏳';
  if (load) load.style.display = 'block';
  if (stat) stat.textContent = '실시간 환율 조회 중...';

  function setTimestamp(src) {
    const now = new Date();
    const ds  = now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0')+'-'
               +String(now.getDate()).padStart(2,'0')+' '+now.toTimeString().slice(0,8);
    if (stat) stat.textContent = '최종 갱신: ' + ds;
    const el = document.getElementById('fx-date-label');
    if (el) el.textContent = '(출처: ' + src + ')';
  }

  /* Yahoo Finance v8: 1개 통화쌍 조회 */
  /* Yahoo Finance 단일 심볼 조회 — 두 프록시를 동시에 경쟁 */
  async function fetchOneYF(sym) {
    const yfUrl = 'https://query1.finance.yahoo.com/v8/finance/chart/' + sym + '?interval=1d&range=5d';
    function tryProxy(pu) {
      return new Promise((resolve) => {
        const ctrl = new AbortController();
        const tid  = setTimeout(() => { ctrl.abort(); resolve(null); }, 3500);
        fetch(pu, { cache: 'no-cache', signal: ctrl.signal })
          .then(r => r.ok ? r.text() : Promise.reject())
          .then(txt => {
            clearTimeout(tid);
            try { const w = JSON.parse(txt); if (w.contents) txt = w.contents; } catch {}
            const meta = JSON.parse(txt)?.chart?.result?.[0]?.meta;
            const price = meta?.regularMarketPrice || meta?.previousClose;
            resolve(price > 0 ? price : null);
          })
          .catch(() => { clearTimeout(tid); resolve(null); });
      });
    }
    /* 두 프록시 동시 실행 → 먼저 성공한 것 사용 */
    return new Promise(resolve => {
      let done = false;
      const finish = (v) => { if (!done && v) { done = true; resolve(v); } };
      const p1 = tryProxy('https://corsproxy.io/?' + encodeURIComponent(yfUrl));
      const p2 = tryProxy('https://api.allorigins.win/get?url=' + encodeURIComponent(yfUrl));
      p1.then(finish); p2.then(finish);
      Promise.all([p1,p2]).then(([a,b]) => { if (!done) resolve(a || b || null); });
    });
  }

  /* VND는 Yahoo에 VNDKRW=X 쌍이 없어 교차환율로 계산: USDVND=X + USDKRW=X */
  async function fetchVND() {
    const [usdVnd, usdKrw] = await Promise.all([
      fetchOneYF('USDVND=X'),
      _fxRates.USD ? Promise.resolve(_fxRates.USD) : fetchOneYF('USDKRW=X'),
    ]);
    if (usdVnd && usdKrw) return usdKrw / usdVnd;
    return null;
  }

  try {
    /* ── Yahoo Finance: VND 제외 11개 + VND 교차환율 병렬 조회 ── */
    const nonVnd = FX_CURRENCIES.filter(c => c.code !== 'VND');
    const [mainResults, vndRate] = await Promise.all([
      Promise.allSettled(nonVnd.map(cur => fetchOneYF(cur.code + 'KRW=X'))),
      fetchVND(),
    ]);
    let cnt = 0;
    mainResults.forEach((res, i) => {
      if (res.status === 'fulfilled' && res.value) {
        _fxRates[nonVnd[i].code] = res.value; cnt++;
      }
    });
    if (vndRate) { _fxRates.VND = vndRate; cnt++; }

    if (cnt >= 4) {
      setTimestamp('Yahoo Finance');
    } else {

      if (Object.keys(_fxRates).length < 4) {
        if (stat) stat.textContent = '조회 실패 — ↺ 버튼으로 재시도';
      } else {
        setTimestamp('Yahoo Finance (일부)');
      }
    }
  } finally {
    _fxFetching = false;
    if (btn)  btn.disabled = false;
    if (icon) icon.textContent = '↺';
    if (load) load.style.display = 'none';
    renderFxCards();
    buildFxSelects();
    fxConvert();
  }
}

/* ── 환율 카드 렌더 ── */
function renderFxCards() {
  const grid = document.getElementById('fx-rate-grid');
  if (!grid) return;
  grid.innerHTML = '';
  FX_CURRENCIES.forEach(cur => {
    const rate = _fxRates[cur.code];
    const rateStr = rate ? '₩' + rate.toLocaleString('ko-KR', {maximumFractionDigits:2}) : '—';
    const div = document.createElement('div');
    div.style.cssText = 'background:var(--card);border:1px solid var(--card-border);border-radius:12px;padding:14px 16px;cursor:pointer;transition:border-color 0.15s;';
    div.onclick = () => {
      document.getElementById('fx-from').value = cur.code;
      fxConvert();
    };
    div.onmouseover = () => div.style.borderColor = 'rgba(49,130,246,0.3)';
    div.onmouseout  = () => div.style.borderColor = 'var(--card-border)';
    div.innerHTML =
      '<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">' +
        '<span style="font-size:16px;">' + cur.flag + '</span>' +
        '<span style="font-size:11px;color:var(--text3);font-weight:500;">' + cur.code + ' (' + cur.symbol + ', ' + cur.name + ')' + '</span>' +
      '</div>' +
      '<p style="font-family:var(--mono);font-size:15px;font-weight:500;color:var(--accent);margin-bottom:2px;">' + rateStr + '</p>' +
      '<p style="font-size:10px;color:var(--text3);">1' + cur.code + ' 기준</p>';
    grid.appendChild(div);
  });
}

/* ── select 옵션 생성 ── */
function buildFxSelects() {
  ['fx-from','fx-to'].forEach(selId => {
    const sel = document.getElementById(selId);
    if (!sel) return;
    const cur = sel.value;
    sel.innerHTML = '<option value="KRW">🇰🇷 KRW (₩, 원화)</option>';
    FX_CURRENCIES.forEach(cur2 => {
      sel.innerHTML += '<option value="' + cur2.code + '">' + cur2.flag + ' ' + cur2.code + ' (' + cur2.symbol + ', ' + cur2.name + ')' + '</option>';
    });
    /* 기본값: from=USD, to=KRW */
    if (selId === 'fx-from' && !cur) sel.value = 'USD';
    else if (cur) sel.value = cur;
  });
}

/* ── 변환 계산 ── */
function fxConvert() {
  const fromSel = document.getElementById('fx-from');
  const toSel   = document.getElementById('fx-to');
  const amtEl   = document.getElementById('fx-amount');
  if (!fromSel || !toSel || !amtEl) return;

  const fromCode = fromSel.value;
  const toCode   = toSel.value;
  const numAmt   = parseFloat(amtEl.value.replace(/,/g,'')) || 0;
  const rawAmt   = numAmt * _fxInUnit;            /* [FX-UNIT] 억·만 단위 반영한 실제 금액 */
  fxRenderUnits(fromCode, toCode);

  /* KRW 기준으로 변환 */
  function toKRW(amt, code) {
    if (code === 'KRW') return amt;
    const rate = _fxRates[code];
    return rate ? amt * rate : null;
  }
  function fromKRW(krw, code) {
    if (code === 'KRW') return krw;
    const rate = _fxRates[code];
    return rate ? krw / rate : null;
  }

  const krwAmt = toKRW(rawAmt, fromCode);
  const result = krwAmt !== null ? fromKRW(krwAmt, toCode) : null;

  const resultEl    = document.getElementById('fx-result');
  const rateLabelEl = document.getElementById('fx-rate-label');
  if (resultEl) resultEl.textContent = result !== null ? fxFmtUnit(result, toCode, _fxOutUnit) : '환율 정보 없음';

  /* 적용 환율 표시 */
  if (rateLabelEl) {
    if (result !== null && rawAmt > 0) {
      const r = result / rawAmt;
      let t = '적용 환율: 1 ' + fromCode + ' = ' + fxFmt(r, toCode);
      if (_fxInUnit !== 1 || _fxOutUnit !== 1)          /* 단위를 쓰면 실제 금액도 함께 */
        t += ' · ' + rawAmt.toLocaleString('ko-KR', { maximumFractionDigits: 2 }) + ' ' + fromCode + ' → ' + result.toLocaleString('ko-KR', { maximumFractionDigits: 2 }) + ' ' + toCode;
      rateLabelEl.textContent = t;
    } else {
      rateLabelEl.textContent = '환율 정보 없음';
    }
  }

  /* 멀티 통화 환산 */
  renderFxMulti(rawAmt, fromCode);
}

function renderFxMulti(amt, fromCode) {
  const grid  = document.getElementById('fx-multi-grid');
  const title = document.getElementById('fx-multi-title');
  if (!grid) return;
  if (title) title.textContent = (amt / _fxInUnit).toLocaleString('ko-KR', { maximumFractionDigits: 4 }) + fxUnitLabel(fromCode, _fxInUnit) + ' (' + fromCode + ') 기준 주요 통화 환산';

  function toKRW(a, code) { return code==='KRW'?a:(_fxRates[code]?a*_fxRates[code]:null); }
  function fromKRW(krw, code) { return code==='KRW'?krw:(_fxRates[code]?krw/_fxRates[code]:null); }

  const krwAmt = toKRW(amt, fromCode);
  const targets = ['KRW', ...FX_CURRENCIES.map(c=>c.code)].filter(c => c !== fromCode);

  grid.innerHTML = '';
  targets.forEach(code => {
    const cur = FX_CURRENCIES.find(c=>c.code===code) || {flag:'🇰🇷',name:'원화'};
    const val = krwAmt !== null ? fromKRW(krwAmt, code) : null;
    const div = document.createElement('div');
    div.style.cssText = 'background:var(--bg3);border-radius:8px;padding:10px 12px;';
    div.innerHTML =
      '<p style="font-size:10px;color:var(--text3);margin-bottom:3px;">' + (cur.flag||'🇰🇷') + ' ' + code + ' (' + (cur.symbol||'₩') + ', ' + (cur.name||'원화') + ')' + '</p>' +
      '<p style="font-family:var(--mono);font-size:13px;color:var(--text);font-weight:500;">' + (val!==null?fxFmt(val,code):'—') + '</p>';
    grid.appendChild(div);
  });
}

/* ── 금액 입력 blur ── */
function fxAmtBlur() {
  const el = document.getElementById('fx-amount');
  if (!el) return;
  const ns = el.value.replace(/[^0-9.]/g,'');
  const n  = parseFloat(ns) || 0;
  el.value = n.toLocaleString('ko-KR');
  fxConvert();
}

/* ── 화폐 교환 버튼 ── */
function fxSwap() {
  const from = document.getElementById('fx-from');
  const to   = document.getElementById('fx-to');
  if (!from || !to) return;
  const tmp = from.value;
  from.value = to.value;
  to.value   = tmp;
  const u = _fxInUnit; _fxInUnit = _fxOutUnit; _fxOutUnit = u;   /* 단위도 함께 교환 */
  fxConvert();
}

/* 모바일 반응형: fx-rate-grid 2열 */

/* ════════════════════════════════════════
   [HEALTH] 건강보험료 계산기 (2026년 기준)
════════════════════════════════════════ */
let _healthType = 'work';

function healthSetType(type, btn) {
  _healthType = type;
  document.getElementById('page-health').querySelectorAll('.mode-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('health-work-panel').style.display   = type==='work'  ? '' : 'none';
  document.getElementById('health-local-panel').style.display  = type==='local' ? '' : 'none';
  document.getElementById('health-work-result').style.display  = type==='work'  ? '' : 'none';
  document.getElementById('health-local-result').style.display = type==='local' ? '' : 'none';
  calcHealth();
}

function hFmt(n) { return Math.round(n).toLocaleString('ko-KR') + '원'; }

/* ── 단위 시스템 ── */
const _hUnits = {};   // fieldId → 'won'|'man'|'eok'
const _hWon   = {};   // fieldId → 원 단위 내부 값

function hGetUnitMul(id) {
  const u = _hUnits[id] || 'won';
  return u === 'eok' ? 1e8 : u === 'man' ? 1e4 : 1;
}

/* 입력 → 원 단위 내부값 변환 */
function hGetWon(id) {
  const el = document.getElementById(id);
  if (!el) return 0;
  const v = parseFloat(el.value.replace(/,/g,'')) || 0;
  return v * hGetUnitMul(id);
}

/* 단위 변경 시 표시값 변환 */
function hSetUnit(id, unit, btn) {
  const won = hGetWon(id);   // 현재 원 단위 값 저장
  _hUnits[id] = unit;
  // 버튼 active
  const container = document.getElementById(id + '-units');
  if (container) container.querySelectorAll('.unit-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  // 새 단위로 표시
  const mul = hGetUnitMul(id);
  const el  = document.getElementById(id);
  if (el) {
    const disp = won / mul;
    el.value = disp % 1 === 0 ? disp.toLocaleString('ko-KR') : parseFloat(disp.toFixed(4)).toString();
  }
  calcHealth();
}

/* blur: 포맷 정리 */
function hUnitBlur(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const v = parseFloat(el.value.replace(/,/g,'')) || 0;
  el.value = v % 1 === 0 ? v.toLocaleString('ko-KR') : parseFloat(v.toFixed(4)).toString();
  calcHealth();
}

/* ── 2026년 기준 (2026.1.1 시행) ──
   · 건강보험료율 7.19% (국민건강보험법 시행령 제44조) · 장기요양보험료율 0.9448% (소득 대비)
   · 월별 보험료 상한 9,183,480원 / 하한 20,160원 (직장 보수월액보험료, 2026 고시)
   · 소득월액보험료·지역가입자 상한 4,591,740원 · 재산보험료부과점수당 금액 211.5원
   · 재산 점수표: 시행령 [별표 4] (2024.5.7 개정) 60등급 · 기본공제 1억원 · 자동차 부과 폐지(2024.2)
   · 보험료는 10원 미만 절사 */
const H_RATE        = 0.0719;          // 건강보험료율 7.19%
const H_LTC_INCOME  = 0.009448;        // 장기요양보험료율 0.9448% (소득 대비)
const H_LTC_RATIO   = H_LTC_INCOME / H_RATE;   // 건강보험료 대비 ≈ 13.14%
const H_PT_VAL      = 211.5;           // 재산보험료부과점수당 금액
const H_PREM_MAX    = 9183480;         // 직장 보수월액보험료 월 상한 (근로자+사업주)
const H_PREM_MIN    = 20160;           // 월 보험료 하한 (직장 전체 · 지역 최저보험료)
const H_PREM_MAX_SELF = 4591740;       // 소득월액보험료 · 지역가입자 월 상한
const H_EXTRA_DEDUCT = 20000000;       // 보수 외 소득 공제 기준 연 2,000만원
const H_FIN_THRESH  = 10000000;        // 이자+배당 합계 1,000만원 초과 시 전액 반영
const H_PROP_DEDUCT = 100000000;       // 재산 기본공제 1억원
const H_LOAN_OWN_CAP  = 50000000;      // 주택담보대출 공제 한도 (과표 5,000만원)
const H_LOAN_RENT_CAP = 150000000;     // 전월세 대출 공제 한도 (과표 1억 5,000만원)

function hFloor10(n) { return Math.floor(Math.max(0, n) / 10) * 10; }

/* ── 재산 등급별 점수 (시행령 별표 4) : [구간 상한(만원), 점수] ── */
const H_PROP_PTS = [
  [450,22],[900,44],[1350,66],[1800,97],[2250,122],[2700,146],[3150,171],[3600,195],[4050,219],[4500,244],
  [5020,268],[5590,294],[6220,320],[6930,344],[7710,365],[8590,386],[9570,412],[10700,439],[11900,465],[13300,490],
  [14800,516],[16400,535],[18300,559],[20400,586],[22700,611],[25300,637],[28100,659],[31300,681],[34900,706],[38800,731],
  [43200,757],[48100,785],[53600,812],[59700,841],[66500,881],[74000,921],[82400,961],[91800,1001],[103000,1041],[114000,1091],
  [127000,1141],[142000,1191],[158000,1241],[176000,1291],[196000,1341],[218000,1391],[242000,1451],[270000,1511],[300000,1571],[330000,1641],
  [363000,1711],[399300,1781],[439230,1851],[483153,1921],[531468,1991],[584615,2061],[643077,2131],[707385,2201],[778124,2271],[Infinity,2341]
];
/* 공제 후 재산 금액(원) → [등급, 점수] (0 이하이면 [0, 0]) */
function hGetPropPts(netWon) {
  if (!(netWon > 0)) return [0, 0];
  const wan = netWon / 10000;
  for (let i = 0; i < H_PROP_PTS.length; i++) if (wan <= H_PROP_PTS[i][0]) return [i + 1, H_PROP_PTS[i][1]];
  return [60, 2341];
}

function calcHealth() {
  /* 초기 단위 설정 (미설정 시 HTML active 버튼 읽기) */
  ['h-salary','h-x-fin','h-x-biz','h-x-pension','h-i-biz','h-i-work','h-i-interest','h-i-div',
   'h-i-pension','h-i-etc','h-prop','h-deposit','h-rent','h-loan-own','h-loan-rent'].forEach(id => {
    if (!_hUnits[id]) {
      const cont = document.getElementById(id+'-units');
      const ab = cont && cont.querySelector('.unit-btn.active');
      if (ab) _hUnits[id] = ab.textContent.includes('억') ? 'eok' : ab.textContent.includes('만') ? 'man' : 'won';
    }
  });
  const setH = (id, v) => { const el=document.getElementById(id); if(el) el.textContent=v; };
  const pos = id => Math.max(0, hGetWon(id));

  if (_healthType === 'work') {
    /* ── 직장 가입자: 보수월액보험료 (근로자·사업주 반반) ── */
    const annualSalary = pos('h-salary');
    const salary   = annualSalary / 12;                                   // 보수월액
    const rawTotal = salary * H_RATE;
    const total    = Math.min(Math.max(rawTotal, H_PREM_MIN), H_PREM_MAX); // 상·하한
    const empPrem  = hFloor10(total / 2);                                  // 근로자 부담
    const emplrPrem = empPrem;                                             // 사업주 부담 (동일)
    const ltcEmp   = hFloor10(empPrem * H_LTC_RATIO);
    const ltcEmplr = ltcEmp;

    /* ── 소득월액보험료: 보수 외 소득 (전액 본인 부담) ── */
    const fin = pos('h-x-fin'), biz = pos('h-x-biz'), pen = pos('h-x-pension');
    const evalExtra = (fin > H_FIN_THRESH ? fin : 0) + biz + pen * 0.5;
    let extraPrem = 0, extraLtc = 0;
    if (evalExtra > H_EXTRA_DEDUCT) {
      extraPrem = Math.min(hFloor10((evalExtra - H_EXTRA_DEDUCT) / 12 * H_RATE), H_PREM_MAX_SELF);
      extraLtc  = hFloor10(extraPrem * H_LTC_RATIO);
    }
    const monthTotal = empPrem + ltcEmp + extraPrem + extraLtc;
    const capNote = rawTotal > H_PREM_MAX ? ' · 상한 적용' : rawTotal < H_PREM_MIN ? ' · 하한 적용' : '';

    setH('h-w-health',     hFmt(empPrem));
    setH('h-w-health-sub', '보수월액 ' + hFmt(salary) + ' × 7.19% ÷ 2' + capNote);
    setH('h-w-ltc',        hFmt(ltcEmp));
    setH('h-w-ltc-sub',    '건강보험료 ' + hFmt(empPrem) + ' × 13.14% (0.9448% ÷ 7.19%)');
    setH('h-w-total',      hFmt(monthTotal));
    setH('h-w-employer',   hFmt(emplrPrem + ltcEmplr));
    setH('h-w-annual',     hFmt(monthTotal * 12));

    const extraBlock = document.getElementById('h-w-extra-block');
    if (extraPrem > 0) {
      extraBlock.style.display = '';
      setH('h-w-extra-prem', hFmt(extraPrem + extraLtc));
      setH('h-w-extra-sub',  '반영 소득 ' + hFmt(evalExtra) + ' − 2,000만원 → ÷12 × 7.19% = 건강 ' + hFmt(extraPrem) + ' + 장기요양 ' + hFmt(extraLtc)
        + (extraPrem >= H_PREM_MAX_SELF ? ' (상한 적용)' : ''));
    } else {
      extraBlock.style.display = 'none';
    }

  } else {
    /* ── 지역 가입자: 소득 보험료 + 재산 보험료 ── */
    const iBiz = pos('h-i-biz'), iWork = pos('h-i-work'), iInt = pos('h-i-interest'), iDiv = pos('h-i-div');
    const iPen = pos('h-i-pension'), iEtc = pos('h-i-etc');
    const finSum = iInt + iDiv;
    const finIn  = finSum > H_FIN_THRESH ? finSum : 0;                    // 1,000만원 이하는 미반영
    const income = iBiz + iEtc + finIn + iWork * 0.5 + iPen * 0.5;

    const incomeSum = document.getElementById('h-income-sum');
    if (incomeSum) incomeSum.textContent = hFmt(income) + (finSum > 0 && !finIn ? ' (금융소득 1,000만원 이하 미반영)' : '');

    const rawIncomePrem = income / 12 * H_RATE;
    const incomePrem    = Math.max(rawIncomePrem, H_PREM_MIN);            // 연 소득 약 336만원 이하 → 최저보험료

    /* 재산: 과세표준 + 임차(보증금+월세×40)×30% − 기본공제 1억 − 주택금융부채 공제 */
    const prop = pos('h-prop'), rentEval = (pos('h-deposit') + pos('h-rent') * 40) * 0.3;
    const loanOwn  = Math.min(pos('h-loan-own') * 0.6, H_LOAN_OWN_CAP, prop);
    const loanRent = Math.min(pos('h-loan-rent') * 0.3, H_LOAN_RENT_CAP, rentEval);
    const propNet  = prop + rentEval - H_PROP_DEDUCT - loanOwn - loanRent;
    const gp       = hGetPropPts(propNet);
    const propPrem = gp[1] * H_PT_VAL;

    const rawHealth  = incomePrem + propPrem;
    const healthPrem = Math.min(hFloor10(rawHealth), H_PREM_MAX_SELF);
    const ltcPrem    = hFloor10(healthPrem * H_LTC_RATIO);
    const monthTotal = healthPrem + ltcPrem;

    setH('h-l-income-pts',  hFmt(income) + ' / 년');
    setH('h-l-income-prem', hFmt(incomePrem) + ' / 월' + (rawIncomePrem < H_PREM_MIN ? ' (최저)' : ''));
    setH('h-l-prop-pts',    gp[1] ? gp[1].toLocaleString('ko-KR') + '점 (' + gp[0] + '등급 · 공제 후 ' + hFmt(propNet) + ')' : '0점 (공제 후 0원)');
    setH('h-l-prop-prem',   hFmt(propPrem) + ' / 월' + (gp[1] === 0 ? ' (해당 없음)' : ''));
    setH('h-l-health',      hFmt(healthPrem));
    setH('h-l-health-sub',  '소득 ' + hFmt(incomePrem) + ' + 재산 ' + hFmt(propPrem)
      + (rawIncomePrem < H_PREM_MIN ? ' · 소득분 최저보험료 적용' : '') + (hFloor10(rawHealth) > H_PREM_MAX_SELF ? ' · 상한 적용' : '') + ' (10원 미만 절사)');
    setH('h-l-ltc',         hFmt(ltcPrem));
    setH('h-l-total',       hFmt(monthTotal));
    setH('h-l-annual',      hFmt(monthTotal * 12));
  }
}

/* ═══════════════════════════════════════════
   [YEAR-ACC] 월간 테이블 연차 아코디언 헬퍼
   insertYearAccordionRow(tbody, yearNum, colSpan)
   toggleYearGroup(hdrRow)
═══════════════════════════════════════════ */
/* ── 아코디언 열린 상태 기억 (tbodyId → Set<yearNum>) ── */
const _yrOpenState = {};

function saveOpenYears(tbody) {
  const id = tbody.id || tbody.dataset.accId;
  if (!id) return;
  const open = new Set();
  tbody.querySelectorAll('.yr-acc-hdr').forEach(hdr => {
    const rows = tbody.querySelectorAll('tr[data-yr-row="' + hdr.dataset.yr + '"]');
    if (rows.length > 0 && rows[0].style.display !== 'none') open.add(String(hdr.dataset.yr));
  });
  _yrOpenState[id] = open;
}
function restoreOpenYears(tbody) {
  const id = tbody.id || tbody.dataset.accId;
  if (!id) return;
  const open = _yrOpenState[id];
  if (!open || open.size === 0) return;
  tbody.querySelectorAll('.yr-acc-hdr').forEach(hdr => {
    if (open.has(String(hdr.dataset.yr))) {
      const rows = tbody.querySelectorAll('tr[data-yr-row="' + hdr.dataset.yr + '"]');
      const arrow = hdr.querySelector('.yr-acc-arrow');
      rows.forEach(r => r.style.display = '');
      if (arrow) arrow.style.transform = 'rotate(90deg)';
    }
  });
}

function insertYearAccordionRow(tbody, yearNum, colSpan, summary) {
  const tr = document.createElement('tr');
  tr.className = 'yr-acc-hdr';
  tr.dataset.yr = yearNum;
  const s = summary || {};
  const hasTax  = s.taxOn;
  const hasDCA  = s.dcaOn;
  let cells = '';
  // 기간
  cells += '<td style="border-top:1px solid rgba(var(--fg-rgb),0.06);">' +
    '<span style="display:flex;align-items:center;gap:8px;">' +
    '<span class="yr-acc-arrow" style="font-size:11px;color:var(--text3);transition:transform 0.15s;">▶</span>' +
    '<span>' + yearNum + '년차</span></span></td>';
  // 시작 자산
  cells += '<td style="border-top:1px solid rgba(var(--fg-rgb),0.06);">' + (s.portStart != null ? fmt(s.portStart) : '—') + '</td>';
  // 연 적립금
  cells += '<td class="' + (hasDCA ? '' : 'col-hidden') + '" style="border-top:1px solid rgba(var(--fg-rgb),0.06);color:var(--accent);">' + (s.deposit != null ? fmt(s.deposit) : '—') + '</td>';
  // 연 분배 (세후)
  cells += '<td style="border-top:1px solid rgba(var(--fg-rgb),0.06);">' + (s.div != null ? fmt(s.div) : '—') + '</td>';
  // 연 과세표준
  if (hasTax) cells += '<td style="border-top:1px solid rgba(var(--fg-rgb),0.06);color:#fe9800;">' + (s.taxBase != null ? fmt(s.taxBase) : '—') + '</td>';
  // 연 세금
  if (hasTax) cells += '<td style="border-top:1px solid rgba(var(--fg-rgb),0.06);color:#f04452;">' + (s.tax != null ? fmt(s.tax) : '—') + '</td>';
  // 연 주가 변동
  var pc = s.priceChange;
  var pcColor = (pc != null && pc >= 0) ? '#3182f6' : '#f04452';
  var pcText  = (pc != null) ? ((pc >= 0 ? '+' : '') + fmt(pc)) : '—';
  cells += '<td style="border-top:1px solid rgba(var(--fg-rgb),0.06);color:' + pcColor + ';">' + pcText + '</td>';
  // 누적 자산
  cells += '<td style="border-top:1px solid rgba(var(--fg-rgb),0.06);">' + (s.port != null ? fmt(s.port) : '—') + '</td>';
  // 보유 수량
  cells += '<td style="border-top:1px solid rgba(var(--fg-rgb),0.06);">' + fmtShares(s.shares != null ? s.shares : null) + '</td>';

  tr.innerHTML = summary ? cells : ('<td colspan="' + colSpan + '" style="border-top:1px solid rgba(var(--fg-rgb),0.06);">' +
    '<span style="display:flex;align-items:center;gap:8px;">' +
    '<span class="yr-acc-arrow" style="font-size:11px;color:var(--text3);transition:transform 0.15s;">▶</span>' +
    '<span>' + yearNum + '년차</span></span></td>');
  tr.onclick = function() { toggleYearGroup(this); };
  tbody.appendChild(tr);
  return tr;
}

function toggleYearGroup(hdrRow) {
  const yr = hdrRow.dataset.yr;
  const tbody = hdrRow.parentElement;
  const rows = tbody.querySelectorAll('tr[data-yr-row="' + yr + '"]');
  const arrow = hdrRow.querySelector('.yr-acc-arrow');
  const isOpen = rows.length > 0 && rows[0].style.display !== 'none';
  rows.forEach(r => r.style.display = isOpen ? 'none' : '');
  if (arrow) arrow.style.transform = isOpen ? '' : 'rotate(90deg)';
  saveOpenYears(tbody);  /* 상태 저장 */
}

/* 전체 펼치기 / 접기 */
function toggleAllYears(tbodyId, btn) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;
  const hdrs = tbody.querySelectorAll('.yr-acc-hdr');
  const allOpen = Array.from(hdrs).every(hdr => {
    const rows = tbody.querySelectorAll('tr[data-yr-row="' + hdr.dataset.yr + '"]');
    return rows.length > 0 && rows[0].style.display !== 'none';
  });
  hdrs.forEach(hdr => {
    const rows = tbody.querySelectorAll('tr[data-yr-row="' + hdr.dataset.yr + '"]');
    const arrow = hdr.querySelector('.yr-acc-arrow');
    rows.forEach(r => r.style.display = allOpen ? 'none' : '');
    if (arrow) arrow.style.transform = allOpen ? '' : 'rotate(90deg)';
  });
  if (btn) btn.textContent = allOpen ? '▶ 전체 펼치기' : '▼ 전체 접기';
  saveOpenYears(tbody);
}

/* ═══════════════════════════════════════════════════
   [FEAR] 공포 & 탐욕 지수 — CNN Fear & Greed Index (data/market.json 의 fearCnn)
   ═══════════════════════════════════════════════════ */
let _fearData = null;
let _fearHistChart = null;

function fearColor(s) {
  if (s <= 24) return '#f04452';
  if (s <= 44) return '#fe9800';
  if (s <= 55) return '#fe9800';
  if (s <= 75) return '#3182f6';
  return '#3182f6';
}
function fearLabel(s) {
  if (s <= 24) return L('극도의 공포', 'Extreme fear');
  if (s <= 44) return L('공포', 'Fear');
  if (s <= 55) return L('중립', 'Neutral');
  if (s <= 75) return L('탐욕', 'Greed');
  return L('극도의 탐욕', 'Extreme greed');
}
var FEAR_PART_EN = { '주가 모멘텀': 'Market momentum', '주가 강도': 'Stock price strength', '주가 폭': 'Stock price breadth', '풋/콜 비율': 'Put/call options',
  '시장 변동성 (VIX)': 'Market volatility (VIX)', '안전자산 수요': 'Safe-haven demand', '정크본드 수요': 'Junk bond demand' };

function drawFearGauge(score) {
  var canvas = document.getElementById('fearGaugeCanvas');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  /* 반원 중심: 캔버스 맨 아래에 위치 → 반원만 보임 */
  var cx = W/2, cy = H - 10, r = 126;
  var zones = [
    {from:0,  to:25,  col:'#f04452'},
    {from:25, to:45,  col:'#fe9800'},
    {from:45, to:55,  col:'#fe9800'},
    {from:55, to:75,  col:'#3182f6'},
    {from:75, to:100, col:'#3182f6'}
  ];
  /* 배경 아크 (흐리게) */
  zones.forEach(function(z) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, Math.PI+(z.from/100)*Math.PI, Math.PI+(z.to/100)*Math.PI);
    ctx.strokeStyle = z.col;
    ctx.lineWidth = 20;
    ctx.lineCap = 'butt';
    ctx.globalAlpha = 0.25;
    ctx.stroke();
  });
  ctx.globalAlpha = 1;
  /* 현재값 아크 (진하게) */
  ctx.beginPath();
  ctx.arc(cx, cy, r, Math.PI, Math.PI+(score/100)*Math.PI);
  ctx.strokeStyle = fearColor(score);
  ctx.lineWidth = 20;
  ctx.lineCap = 'round';
  ctx.stroke();
  /* 바늘 */
  var na = Math.PI+(score/100)*Math.PI;
  var needleLen = r - 28;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + needleLen*Math.cos(na), cy + needleLen*Math.sin(na));
  ctx.strokeStyle = fgA(0.9);
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.stroke();
  /* 중심 점 */
  ctx.beginPath();
  ctx.arc(cx, cy, 6, 0, Math.PI*2);
  ctx.fillStyle = fgA(0.9);
  ctx.fill();
  /* 눈금 숫자 0/25/50/75/100 (반원 바깥쪽) */
  ctx.font = '10px monospace';
  ctx.fillStyle = fgA(0.4);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  [0,25,50,75,100].forEach(function(v) {
    var a = Math.PI+(v/100)*Math.PI;
    ctx.fillText(v, cx+(r+16)*Math.cos(a), cy+(r+16)*Math.sin(a));
  });
  /* 구간 라벨 (반원 안쪽) */
  var zoneLabels = [
    {v:12,  txt:L('극공포','Ext. fear')},
    {v:32,  txt:L('공포','Fear')},
    {v:50,  txt:L('중립','Neutral')},
    {v:68,  txt:L('탐욕','Greed')},
    {v:88,  txt:L('극탐욕','Ext. greed')}
  ];
  ctx.font = '9px sans-serif';
  ctx.fillStyle = fgA(0.3);
  zoneLabels.forEach(function(z) {
    var a = Math.PI+(z.v/100)*Math.PI;
    ctx.fillText(z.txt, cx+(r-36)*Math.cos(a), cy+(r-36)*Math.sin(a));
  });
  /* DOM 업데이트 (숫자/라벨은 캔버스 아래 DOM에서 표시) */
  var sv = document.getElementById('fear-score-val');
  var sl = document.getElementById('fear-score-label');
  if (sv) sv.textContent = score;
  if (sl) { sl.textContent = fearLabel(score); sl.style.color = fearColor(score); }
}

function renderFearHistory(history) {
  var canvas = document.getElementById('fearHistoryChart');
  if (!canvas) return;
  if (_fearHistChart) { _fearHistChart.destroy(); _fearHistChart = null; }
  var recent = history.slice(-90);
  var labels = recent.map(function(d){return d.date;});
  var scores = recent.map(function(d){return d.score;});
  _fearHistChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        data: scores,
        borderColor: 'rgba(49,130,246,0.8)',
        borderWidth: 1.5,
        pointRadius: 0,
        fill: true,
        backgroundColor: 'rgba(49,130,246,0.08)',
        tension: 0.3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {display:false},
        tooltip: {callbacks:{label:function(ctx){return fearLabel(ctx.parsed.y)+'  '+ctx.parsed.y;}}}
      },
      scales: {
        x: {
          ticks: {color:'#6d6d76',font:{size:10},maxTicksLimit:8,
            callback: function(val,idx){return labels[idx]?labels[idx].slice(5):'';}},
          grid:{display:false}, border:{display:false}
        },
        y: {
          min:0, max:100,
          ticks:{color:'#6d6d76',font:{size:11},stepSize:25},
          grid:{color:fgA(0.04)}, border:{display:false}
        }
      }
    }
  });
}

function renderFearComponents(components) {
  var el = document.getElementById('fear-components');
  if (!el) return;
  el.innerHTML = components.map(function(comp, idx, arr) {
    var pct = comp.val || 0;
    var col = fearColor(pct);
    var lbl = fearLabel(pct);
    var isLast = idx === arr.length - 1;
    return '<div style="display:flex;align-items:center;gap:12px;padding:10px 0;' +
      (isLast ? '' : 'border-bottom:1px solid rgba(var(--fg-rgb),0.05);') + '">' +
      '<div style="width:160px;font-size:11px;color:var(--text3);flex-shrink:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + (SITE_EN ? (FEAR_PART_EN[comp.name] || comp.name || '') : (comp.name||'')) + '</div>' +
      '<div style="flex:1;background:var(--bg3);border-radius:4px;height:8px;overflow:hidden;">' +
        '<div style="width:'+pct+'%;height:100%;background:'+col+';border-radius:4px;"></div>' +
      '</div>' +
      '<div style="width:' + (SITE_EN ? 150 : 120) + 'px;text-align:right;font-family:var(--mono);font-size:12px;font-weight:500;color:'+col+';white-space:nowrap;flex-shrink:0;">' +
        Math.round(pct)+' \u00b7 '+lbl +
      '</div>' +
    '</div>';
  }).join('');
}

/* CNN 원본(graphdata) → 화면용 형식 */
function cnnFearView(d) {
  var fg = d.fear_and_greed, names = [['market_momentum_sp500','주가 모멘텀'],['stock_price_strength','주가 강도'],['stock_price_breadth','주가 폭'],
    ['put_call_options','풋/콜 비율'],['market_volatility_vix','시장 변동성 (VIX)'],['safe_haven_demand','안전자산 수요'],['junk_bond_demand','정크본드 수요']];
  return { source: 'CNN', score: fg.score, prev: { close: fg.previous_close, w1: fg.previous_1_week, m1: fg.previous_1_month, y1: fg.previous_1_year },
    components: names.filter(function (n) { return d[n[0]] && d[n[0]].score != null; }).map(function (n) { return { name: n[1], score: d[n[0]].score }; }),
    historical: ((d.fear_and_greed_historical || {}).data || []).map(function (p) { var t = new Date(p.x); return { date: t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0'), score: p.y }; }) };
}
async function fetchFearGreed() {
  var btn  = document.getElementById('fear-refresh-btn');
  var icon = document.getElementById('fear-refresh-icon');
  if (btn) btn.disabled = true;
  if (icon) icon.textContent = '\u23f3';
  function setT(id, v) { var el=document.getElementById(id); if(el) el.textContent=v; }
  function r0(v) { return v == null || isNaN(v) ? '\u2014' : Math.round(v); }
  try {
    /* ① 실시간: Cloudflare Worker /fear (CNN 을 대신 받아 5분 캐시)  ② GitHub Actions 가 수집한 CNN 자료
       ③ CNN 직접(브라우저에서 허용될 때)  ④ 대체 지표 — ①과 ② 중 CNN 기준 시각이 더 최근인 쪽을 씀 */
    var v = null, live = null;
    try {
      var cc = window.mdLoad ? await window.mdLoad('counter.json') : null;
      if (cc && /^https:\/\//.test(cc.endpoint || '')) {
        var lr = await Promise.race([fetch(cc.endpoint.replace(/\/$/, '') + '/fear', { cache: 'no-store' }), new Promise(function (_, j) { setTimeout(function () { j(new Error('timeout')); }, 7000); })]);
        if (lr.ok) { live = await lr.json(); if (!(live && live.historical && live.historical.length && live.score != null)) live = null; }
      }
    } catch (e) { live = null; }
    var m = window.mdLoad ? await window.mdLoad('market.json') : null, mc = m && m.fearCnn && m.fearCnn.historical ? m.fearCnn : null;
    var pick = live && (!mc || Date.parse(live.time || 0) >= Date.parse(mc.time || 0)) ? live : mc;
    if (pick) v = { source: 'CNN', score: pick.score, prev: pick.prev || {}, components: pick.components || [], historical: pick.historical, time: pick.time, live: pick === live };
    if (!v) {
      try { var cr = await Promise.race([fetch('https://production.dataviz.cnn.io/index/fearandgreed/graphdata'), new Promise(function (_, j) { setTimeout(function () { j(new Error('timeout')); }, 6000); })]);
        if (cr.ok) v = cnnFearView(await cr.json()); } catch (e) {}
    }
    if (!v) {
      var res = await fetch('https://feargreedchart.com/api/?action=all');
      if (!res.ok) throw new Error('API error');
      var fd = await res.json(), rc = fd.recent || [], n = rc.length;
      v = { source: 'fallback', score: fd.score.score, components: (fd.score.components || []).map(function (x) { return { name: x.name, score: x.val }; }), historical: rc,
            prev: { close: n > 1 ? rc[n-2].score : null, w1: n > 7 ? rc[n-8].score : null, m1: n > 30 ? rc[n-31].score : null, y1: n > 251 ? rc[n-252].score : null } };
    }
    _fearData = v;
    var score = Math.round(v.score);
    setT('fear-score-val', score);
    setT('fear-prev-close', r0(v.prev.close));
    setT('fear-prev-1w',    r0(v.prev.w1));
    setT('fear-prev-1m',    r0(v.prev.m1));
    setT('fear-prev-1y',    r0(v.prev.y1));
    drawFearGauge(score);
    renderFearComponents(v.components.map(function (x) { return { name: x.name, val: x.score }; }));
    if (v.historical.length > 0) renderFearHistory(v.historical);
    var ts = v.time ? new Date(v.time) : null, tsTxt = '';
    if (ts && !isNaN(ts)) { var k = new Date(ts.getTime() + 9 * 3600e3).toISOString(); tsTxt = L(' · CNN 기준 ' + k.slice(0, 10) + ' ' + k.slice(11, 16) + ' (한국 시간)', ' · CNN as of ' + k.slice(0, 10) + ' ' + k.slice(11, 16) + ' KST'); }
    setT('fear-source-note', v.source === 'CNN'
      ? L('데이터 출처: CNN Business Fear & Greed Index' + tsTxt + (v.live ? ' · 5분마다 자동 갱신' : '') + ' · 투자 참고용이며 투자 권고가 아닙니다.',
          'Source: CNN Business Fear & Greed Index' + tsTxt + (v.live ? ' · refreshes every 5 minutes' : '') + ' · for reference only, not investment advice.')
      : L('⚠ CNN 자료를 아직 받지 못해 대체 지표(feargreedchart.com)를 표시 중입니다 · 투자 참고용이며 투자 권고가 아닙니다.',
          '⚠ CNN data is not available yet, showing an alternative source (feargreedchart.com) · for reference only, not investment advice.'));
  } catch(e) {
    console.error('Fear&Greed \uc624\ub958:', e);
    setT('fear-score-label', L('\ub370\uc774\ud130 \uc870\ud68c \uc2e4\ud328 \u00b7 \uc7a0\uc2dc \ud6c4 \uc7ac\uc2dc\ub3c4', 'Could not load data · please retry'));
  } finally {
    if (btn) btn.disabled = false;
    if (icon) icon.textContent = '\u21ba';
  }
}

/* ── 보유 수량 계산 헬퍼 ── */
function calcShares(portEnd, priceNow, growth, monthNum) {
  if (!priceNow || priceNow <= 0 || !portEnd) return null;
  /* update()와 동일한 복리 환산: (1+growth)^(monthNum/12) */
  var priceAtMonth = priceNow * Math.pow(1 + growth, monthNum / 12);
  if (priceAtMonth <= 0) return null;
  return Math.floor(portEnd / priceAtMonth);
}
function fmtShares(shares) {
  if (shares === null || shares === undefined) return '—';
  return shares.toLocaleString('ko-KR') + '주';
}
window.addEventListener('load', function() { if (!document.getElementById('page-simulator')) return; fetchKodexPrice(); setTimeout(function(){ update(); }, 100); });

/* ════════════════════════════════════════
   [KOSPI] KOSPI 성장률 분석
════════════════════════════════════════ */

/* ════════════════════════════════════════
   [KOSDAQ] KOSDAQ 성장률 분석 — 독립 모듈
   기준: 1996-07-01, 기준지수 1000
   티커: ^KQ11 (Yahoo Finance)
════════════════════════════════════════ */
const KOSDAQ_BASE_DATE = new Date('1996-07-01');
const KOSDAQ_BASE_VAL  = 1000;

const KOSDAQ_HIST = {
  1996:1000,1997:660,1998:516,1999:1028,
  2000:2925,2001:859,2002:717,2003:556,2004:416,
  2005:694,2006:668,2007:668,2008:756,2009:393,
  2010:538,2011:535,2012:504,2013:491,2014:544,
  2015:583,2016:682,2017:631,2018:797,2019:629,
  2020:669,2021:980,2022:1033,2023:690,2024:854,2025:776
};

let _kosdaqPeriod  = 15;
let _kosdaqLastVal = null;
let _kosdaqFetching = false;
const _kosdaqHistCache = {};

function calcKosdaqRates(currentVal, asOfDate, periodYears, startVal, histDateStr) {
  const now = asOfDate || new Date();
  let sv, startDate, periodLabel;

  if (!periodYears || periodYears === 0) {
    sv = KOSDAQ_BASE_VAL;
    startDate = KOSDAQ_BASE_DATE;
    const totalMs  = now - KOSDAQ_BASE_DATE;
    const totalYrs = Math.floor(totalMs / (1000*60*60*24*365.25));
    const totalMons= Math.floor((totalMs / (1000*60*60*24*365.25) - totalYrs) * 12);
    periodLabel = '상장이후 전체 (1996.07.01 ~ 현재, ' + totalYrs + '년 ' + totalMons + '개월)';
  } else {
    const sy = now.getFullYear() - periodYears;
    sv = startVal || KOSDAQ_HIST[sy] || null;
    if (!sv) return;
    startDate = new Date(sy, now.getMonth(), now.getDate());
    periodLabel = histDateStr
      ? '최근 ' + periodYears + '년 (' + histDateStr + ' ~ 현재) (Yahoo)'
      : '최근 ' + periodYears + '년 (' + sy + '년 추정 ~ 현재) (내장)';
  }
  if (!sv || sv <= 0) return;

  const diffYrs = (now - startDate) / (1000*60*60*24*365.25);
  if (diffYrs <= 0.1) return;

  const cagr    = Math.pow(currentVal / sv, 1 / diffYrs) - 1;
  const monthly = Math.pow(1 + cagr, 1/12) - 1;
  const daily   = Math.pow(1 + cagr, 1/365.25) - 1;
  const svFmt   = sv.toLocaleString('ko-KR', {maximumFractionDigits:2});
  const curFmt  = currentVal.toLocaleString('ko-KR', {maximumFractionDigits:2});

  const annEl = document.getElementById('kosdaq-annual');
  const monEl = document.getElementById('kosdaq-monthly');
  const dayEl = document.getElementById('kosdaq-daily');
  const asSub = document.getElementById('kosdaq-annual-sub');
  const msSub = document.getElementById('kosdaq-monthly-sub');
  const dsSub = document.getElementById('kosdaq-daily-sub');

  if (annEl) { annEl.textContent = (cagr*100).toFixed(4)+'%';   annEl.style.color='var(--accent)'; }
  if (monEl) { monEl.textContent = (monthly*100).toFixed(4)+'%'; monEl.style.color='var(--accent2)'; }
  if (dayEl) { dayEl.textContent = (daily*100).toFixed(6)+'%';   dayEl.style.color='#fe9800'; }
  if (asSub) asSub.textContent = periodLabel + ' | ' + svFmt + ' → ' + curFmt;
  if (msSub) msSub.textContent = '연 ' + (cagr*100).toFixed(2) + '% → 월 환산';
  if (dsSub) dsSub.textContent = '연 ' + (cagr*100).toFixed(2) + '% → 일 환산';

  [10,20,30,40].forEach(y => {
    const el = document.getElementById('kosdaq-sim-'+y);
    if (el) el.textContent = fmtWon(Math.round(1e8 * Math.pow(1+cagr, y)));
  });
}

async function setKosdaqPeriod(years, btn) {
  _kosdaqPeriod = years;
  const tabsEl = document.getElementById('kosdaq-period-tabs');
  if (tabsEl) tabsEl.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');

  const curVal = _kosdaqLastVal || KOSDAQ_BASE_VAL;
  if (years === 0) { calcKosdaqRates(curVal, new Date(), 0, null, null); return; }

  const ck  = 'kosdaq_' + years;
  const now = new Date();
  const sy  = now.getFullYear() - years;

  let cached = _kosdaqHistCache[ck];
  if (!cached) {
    const origText = btn ? btn.textContent : '';
    if (btn) btn.textContent = '⏳';
    const targetDt = new Date(sy, now.getMonth(), now.getDate());
    const result   = await fetchHistoricalPrice('%5EKQ11', targetDt);
    if (btn) btn.textContent = origText;
    if (result && result.price > 0) {
      cached = result;
      _kosdaqHistCache[ck] = cached;
    }
  }

  const sv  = cached ? cached.price : KOSDAQ_HIST[sy] || null;
  const hd  = cached ? cached.date  : null;
  if (sv) calcKosdaqRates(curVal, now, years, sv, hd);
}

function applyKosdaqValue(price, src) {
  price = parseFloat(String(price).replace(/,/g,''));
  if (!price || price < 100 || price > 10000) return false;
  _kosdaqLastVal = price;
  const el = document.getElementById('kosdaq-current-val');
  if (el) el.textContent = price.toLocaleString('ko-KR', {minimumFractionDigits:2, maximumFractionDigits:2});
  const now = new Date();
  const ns  = now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0')+'-'
             +String(now.getDate()).padStart(2,'0')+' '+now.toTimeString().slice(0,8);
  const dl = document.getElementById('kosdaq-date-label');
  const sl = document.getElementById('kosdaq-source-label');
  if (dl) dl.textContent = ns + ' 기준';
  if (sl) sl.textContent = '출처: ' + src;

  /* 현재 선택된 기간으로 계산 */
  const py  = _kosdaqPeriod || 0;
  const ck  = 'kosdaq_' + py;
  const hc  = _kosdaqHistCache[ck];
  const sv2 = py===0 ? null : (hc ? hc.price : (KOSDAQ_HIST[now.getFullYear()-py]||null));
  calcKosdaqRates(price, now, py, sv2, hc ? hc.date : null);
  return true;
}

async function fetchKosdaq() {
  if (_kosdaqFetching) return;
  _kosdaqFetching = true;
  const btn  = document.getElementById('kosdaq-refresh-btn');
  const icon = document.getElementById('kosdaq-refresh-icon');
  const load = document.getElementById('kosdaq-loading');
  const dl   = document.getElementById('kosdaq-date-label');
  if (btn)  btn.disabled = true;
  if (icon) icon.textContent = '⏳';
  if (load) load.style.display = 'block';
  if (dl)   dl.textContent = '조회 중...';
  try {
    
    /* 2순위: Yahoo Finance ^KQ11 */
    const yfUrl = 'https://query1.finance.yahoo.com/v8/finance/chart/%5EKQ11?interval=1d&range=5d';
    const proxies = [
      'https://corsproxy.io/?'+encodeURIComponent(yfUrl),
      'https://api.allorigins.win/get?url='+encodeURIComponent(yfUrl),
    ];
    for (const pu of proxies) {
      try {
        const ctrl = new AbortController();
        const tid  = setTimeout(() => ctrl.abort(), 8000);
        let resp;
        try { resp = await fetch(pu,{cache:'no-cache',signal:ctrl.signal}); }
        finally { clearTimeout(tid); }
        if (!resp||!resp.ok) continue;
        let txt = await resp.text();
        try { const w=JSON.parse(txt); if(w.contents) txt=w.contents; } catch {}
        const j = JSON.parse(txt);
        const m = j?.chart?.result?.[0]?.meta;
        const p = m?.regularMarketPrice || m?.previousClose;
        if (p && applyKosdaqValue(p, 'Yahoo Finance')) return;
      } catch {}
    }
    /* 실패 */
    if (dl) dl.textContent = '조회 실패 — ↺ 재시도';
    const def = _kosdaqLastVal || 770;
    const py  = _kosdaqPeriod || 0;
    const ck  = 'kosdaq_' + py;
    const hc  = _kosdaqHistCache[ck];
    const sv  = py===0?null:(hc?hc.price:(KOSDAQ_HIST[new Date().getFullYear()-py]||null));
    calcKosdaqRates(def, new Date(), py, sv, hc?hc.date:null);
  } finally {
    _kosdaqFetching = false;
    if (btn)  btn.disabled = false;
    if (icon) icon.textContent = '↺';
    if (load) load.style.display = 'none';
  }
}

const KOSPI_BASE_DATE = new Date('1980-01-04');
const KOSPI_BASE_VAL  = 100;

function fmtWon(n) {
  if (SITE_EN) return wonEn(n);
  if (n >= 1e8) return (n/1e8).toFixed(2) + '억원';
  if (n >= 1e4) return Math.round(n/1e4).toLocaleString() + '만원';
  return Math.round(n).toLocaleString('ko-KR') + '원';
}

/* ════════════════════════════════════════
   [PERIOD] 기간별 성장률 계산
   과거 지수값: Yahoo Finance 실시간 조회 + 내장 테이블 fallback
════════════════════════════════════════ */
const _kospiPeriod  = { kospi: 15, k200: 15 };
const _kospiLastVal = { kospi: null, k200: null };
const _histCache    = {};

const KOSPI_HIST = {
  1980:100,1985:163,1990:909,1995:882,
  2000:1059,2001:694,2002:628,2003:811,2004:895,
  2005:1379,2006:1434,2007:1434,2008:1897,2009:1124,
  2010:1683,2011:2070,2012:1826,2013:1997,2014:2011,
  2015:1916,2016:1961,2017:2026,2018:2479,2019:2041,
  2020:2176,2021:2874,2022:2978,2023:2225,2024:2669,2025:2499
};
const K200_HIST = {
  1990:100,1995:113,
  2000:135,2001:88,2002:79,2003:104,2004:115,
  2005:178,2006:183,2007:183,2008:248,2009:143,
  2010:218,2011:271,2012:237,2013:261,2014:263,
  2015:249,2016:253,2017:263,2018:323,2019:262,
  2020:281,2021:379,2022:392,2023:290,2024:351,2025:325
};
function getFallbackVal(indexId, year) {
  const tbl = indexId === 'kospi' ? KOSPI_HIST : K200_HIST;
  if (tbl[year]) return tbl[year];
  const keys = Object.keys(tbl).map(Number).sort((a,b)=>a-b);
  for (let i = keys.length-1; i >= 0; i--) {
    if (keys[i] <= year) return tbl[keys[i]];
  }
  return null;
}

async function fetchHistoricalPrice(ticker, targetDate) {
  const p1 = Math.floor(targetDate.getTime()/1000) - 86400*7;
  const p2 = Math.floor(targetDate.getTime()/1000) + 86400*7;
  const yfUrl = 'https://query1.finance.yahoo.com/v8/finance/chart/'
    + ticker + '?interval=1d&period1=' + p1 + '&period2=' + p2;

  function parseYF(txt) {
    try { const w = JSON.parse(txt); if (w.contents) txt = w.contents; } catch {}
    let json; try { json = JSON.parse(txt); } catch { return null; }
    const r = json?.chart?.result?.[0];
    if (!r) return null;
    const closes     = r.indicators?.quote?.[0]?.close || [];
    const timestamps = r.timestamp || [];
    for (let i = 0; i < closes.length; i++) {
      if (closes[i] && closes[i] > 0) {
        let dateStr = '';
        if (timestamps[i]) {
          const d = new Date(timestamps[i] * 1000);
          dateStr = d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
        }
        return { price: parseFloat(closes[i]), date: dateStr, src: (r.meta && r.meta.dataSource) || null };
      }
    }
    return null;
  }

  function tryProxy(pu) {
    return new Promise(resolve => {
      const ctrl = new AbortController();
      const tid  = setTimeout(() => { ctrl.abort(); resolve(null); }, 4000);
      fetch(pu, { cache:'no-cache', signal:ctrl.signal })
        .then(r => r.ok ? r.text() : Promise.reject())
        .then(txt => { clearTimeout(tid); resolve(parseYF(txt)); })
        .catch(() => { clearTimeout(tid); resolve(null); });
    });
  }

  /* 두 프록시 동시 경쟁 — 먼저 성공한 것 사용 */
  const proxies = [
    'https://corsproxy.io/?' + encodeURIComponent(yfUrl),
    'https://api.allorigins.win/get?url=' + encodeURIComponent(yfUrl),
  ];
  return new Promise(resolve => {
    let done = false;
    const finish = v => { if (!done && v) { done = true; resolve(v); } };
    const p1p = tryProxy(proxies[0]);
    const p2p = tryProxy(proxies[1]);
    p1p.then(finish); p2p.then(finish);
    Promise.all([p1p, p2p]).then(([a, b]) => { if (!done) resolve(a || b || null); });
  });
}

async function setKospiPeriod(indexId, years, btn) {
  _kospiPeriod[indexId] = years;
  const tabsId = indexId === 'kospi' ? 'kospi-period-tabs' : 'k200-period-tabs';
  const tabsEl = document.getElementById(tabsId);
  if (tabsEl) tabsEl.querySelectorAll('.period-btn').forEach(b => {
    b.classList.remove('active');
  });
  if (btn) btn.classList.add('active');

  const curVal = _kospiLastVal[indexId] || (indexId==='kospi' ? _lastKospi : _lastKospi200);
  if (!curVal) return;

  if (years === 0) {
    calcIndexRatesByPeriod(indexId, curVal, new Date(), 0, null);
    return;
  }

  const cacheKey     = indexId + '_' + years;
  const cacheDateKey = cacheKey + '_date';
  const now          = new Date();
  const startYear    = now.getFullYear() - years;

  let startVal  = _histCache[cacheKey]     || null;
  let startDate = _histCache[cacheDateKey] || null;

  if (!startVal) {
    const origText = btn ? btn.textContent : '';
    if (btn) btn.textContent = '⏳';
    const ticker   = indexId === 'kospi' ? '%5EKS11' : '%5EKS200';
    const targetDt = new Date(startYear, now.getMonth(), now.getDate());
    const result   = await fetchHistoricalPrice(ticker, targetDt);
    if (btn) btn.textContent = origText;
    if (result && result.price > 0) {
      startVal  = result.price;
      startDate = result.date;
      _histCache[cacheKey]     = startVal;
      _histCache[cacheDateKey] = startDate;
    } else {
      startVal  = getFallbackVal(indexId, startYear);
      startDate = null; /* fallback: 날짜 없음 */
    }
  }
  if (startVal) calcIndexRatesByPeriod(indexId, curVal, now, years, startVal, startDate);
}

function calcIndexRatesByPeriod(indexId, currentVal, asOfDate, periodYears, startVal, histDateStr) {
  const now = asOfDate || new Date();
  const isKospi    = indexId === 'kospi';
  const BASE_DATE  = isKospi ? KOSPI_BASE_DATE : K200_BASE_DATE;
  const BASE_VAL   = isKospi ? KOSPI_BASE_VAL  : K200_BASE_VAL;
  const BASE_LABEL = isKospi ? '1980.01.04' : '1990.01.03';

  let startDate, periodLabel, sv;
  if (periodYears === 0) {
    sv          = BASE_VAL;
    startDate   = BASE_DATE;
    const totalMs   = now - BASE_DATE;
    const totalYrs  = Math.floor(totalMs / (1000*60*60*24*365.25));
    const totalMons = Math.floor((totalMs / (1000*60*60*24*365.25) - totalYrs) * 12);
    periodLabel = '상장이후 전체 (' + BASE_LABEL + ' ~ 현재, ' + totalYrs + '년 ' + totalMons + '개월)';
  } else {
    sv = startVal || getFallbackVal(indexId, now.getFullYear()-periodYears);
    startDate = new Date(now.getFullYear()-periodYears, now.getMonth(), now.getDate());
    const ck  = indexId + '_' + periodYears;
    const cachedDate = histDateStr || _histCache[ck+'_date'];
    if (cachedDate) {
      /* 실제 조회 날짜 표시 */
      periodLabel = '최근 ' + periodYears + '년 (' + cachedDate + ' ~ 현재) (Yahoo)';
    } else {
      /* fallback: 연도만 표시 */
      periodLabel = '최근 ' + periodYears + '년 (' + (now.getFullYear()-periodYears) + '년 추정 ~ 현재) (내장)';
    }
  }
  if (!sv || sv <= 0) return;

  const diffYrs = (now - startDate) / (1000*60*60*24*365.25);
  if (diffYrs <= 0.1) return;

  const cagr    = Math.pow(currentVal / sv, 1 / diffYrs) - 1;
  const monthly = Math.pow(1 + cagr, 1/12) - 1;
  const daily   = Math.pow(1 + cagr, 1/365.25) - 1;
  const p = indexId;

  const annEl = document.getElementById(p+'-annual');
  const monEl = document.getElementById(p+'-monthly');
  const dayEl = document.getElementById(p+'-daily');
  if (annEl) { annEl.textContent = (cagr*100).toFixed(4)+'%'; annEl.style.color='var(--accent)'; }
  if (monEl) { monEl.textContent = (monthly*100).toFixed(4)+'%'; monEl.style.color='var(--accent2)'; }
  if (dayEl) { dayEl.textContent = (daily*100).toFixed(6)+'%'; dayEl.style.color='#fe9800'; }

  const cp       = (cagr*100).toFixed(2);
  const startFmt = sv.toLocaleString('ko-KR', {maximumFractionDigits:2});
  const curFmt   = currentVal.toLocaleString('ko-KR', {maximumFractionDigits:2});
  const as = document.getElementById(p+'-annual-sub');
  const ms = document.getElementById(p+'-monthly-sub');
  const ds = document.getElementById(p+'-daily-sub');
  if (as) as.textContent = periodLabel + ' | ' + startFmt + ' → ' + curFmt;
  if (ms) ms.textContent = L('연 '+cp+'% → 월 환산', cp+'% a year → per month');
  if (ds) ds.textContent = L('연 '+cp+'% → 일 환산', cp+'% a year → per day');

  [10,20,30,40].forEach(y => {
    const el = document.getElementById(p+'-sim-'+y);
    if (el) el.textContent = fmtWon(Math.round(1e8*Math.pow(1+cagr,y)));
  });
}

function calcKospiRates(currentVal, asOfDate) {
  _kospiLastVal.kospi = currentVal;
  const py  = _kospiPeriod.kospi || 0;
  const sv  = py === 0 ? null : (_histCache['kospi_'+py] || getFallbackVal('kospi', (asOfDate||new Date()).getFullYear()-py));
  const hd  = _histCache['kospi_'+py+'_date'] || null;
  calcIndexRatesByPeriod('kospi', currentVal, asOfDate, py, sv, hd);
}

/* ═══════════════════════════════════════
   [KOSPI-FETCH] KOSPI 지수 조회
   데이터: [MARKET-DATA] 시세 계층 (data/*.json)
   2순위: CORS 프록시 순차 시도
   실패 시 마지막 성공값 유지
═══════════════════════════════════════ */

let _lastKospi  = 2500;
let _isFetching = false;

function nowStr() {
  const n = new Date();
  return n.getFullYear() + '-'
    + String(n.getMonth()+1).padStart(2,'0') + '-'
    + String(n.getDate()).padStart(2,'0')
    + ' ' + n.toTimeString().slice(0,8);
}

function applyKospiValue(price, src) {
  price = parseFloat(String(price).replace(/,/g,''));
  if (!price || isNaN(price) || price < 200 || price > 20000) return false;
  _lastKospi = price;
  document.getElementById('kospi-current-val').textContent =
    price.toLocaleString('ko-KR', {minimumFractionDigits:2, maximumFractionDigits:2});
  document.getElementById('kospi-date-label').textContent  = nowStr() + ' 기준';
  document.getElementById('kospi-source-label').textContent = '출처: ' + src;
  calcKospiRates(price, new Date());
  return true;
}


/* ── Yahoo Finance JSON 파싱 ── */
function parseYahooJson(raw) {
  try {
    let json = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (json.contents) json = JSON.parse(json.contents);
    const r = json?.chart?.result?.[0];
    if (!r) return null;
    const m = r.meta;
    const closes = r.indicators?.quote?.[0]?.close;
    const p = m.regularMarketPrice || m.previousClose
           || (closes ? closes.filter(Boolean).slice(-1)[0] : null);
    return (p && p >= 200) ? parseFloat(p) : null;
  } catch { return null; }
}

/* ── 2순위: CORS 프록시 순차 시도 ── */
async function tryYahooProxies() {
  const yfUrl = 'https://query1.finance.yahoo.com/v8/finance/chart/%5EKS11?interval=1d&range=3d';
  const proxies = [
    'https://corsproxy.io/?' + encodeURIComponent(yfUrl),
    'https://api.allorigins.win/raw?url=' + encodeURIComponent(yfUrl),
    'https://thingproxy.freeboard.io/fetch/' + yfUrl,
    yfUrl,
  ];
  for (const url of proxies) {
    try {
      const ctrl = new AbortController();
      const tid  = setTimeout(() => ctrl.abort(), 8000);
      let resp;
      try {
        resp = await fetch(url, { signal: ctrl.signal, cache: 'no-cache' });
      } finally { clearTimeout(tid); }
      if (!resp || !resp.ok) continue;
      const txt  = await resp.text();
      const price = parseYahooJson(txt);
      if (price) return price;
    } catch { /* 다음 프록시 */ }
  }
  return null;
}

/* ── 메인 갱신 함수 ── */
async function fetchKospi() {
  if (_isFetching) return;
  _isFetching = true;

  const btn  = document.getElementById('kospi-refresh-btn');
  const icon = document.getElementById('kospi-refresh-icon');
  const load = document.getElementById('kospi-loading');
  btn.disabled     = true;
  icon.textContent = '⏳';
  load.style.display   = 'block';
  document.getElementById('kospi-date-label').textContent   = '조회 중...';
  document.getElementById('kospi-source-label').textContent = '';

  try {

    /* 2순위: Yahoo Finance CORS 프록시 */
    const price = await tryYahooProxies();
    if (price && applyKospiValue(price, 'Yahoo Finance (^KS11)')) { return; }

    /* 둘 다 실패 — 이전 성공값 유지 */
    document.getElementById('kospi-date-label').textContent =
      nowStr() + ' 기준 (이전값 유지)';
    document.getElementById('kospi-source-label').textContent =
      '⚠ 조회 실패 — 직전 지수 ' + _lastKospi.toLocaleString('ko-KR') + ' 유지';
    calcKospiRates(_lastKospi, new Date());

  } finally {
    btn.disabled     = false;
    icon.textContent = '↺';
    load.style.display   = 'none';
    _isFetching      = false;
  }
}

/* ════════════════════════════════════════
   앱 탭 전환
════════════════════════════════════════ */
/* ════════════════════════════════════════
   [NAV] 탭 그룹 드롭다운
════════════════════════════════════════ */

/* [NAV-SUB] 하위 메뉴 펼치기: 누르면(터치·좁은 화면) 열고 닫기, 오른쪽 공간이 부족하면 왼쪽으로 */
function navSubFit(par) {
  var sub = par.querySelector('.drop-sub'); if (!sub) return;
  sub.classList.remove('flip');
  var r = par.getBoundingClientRect();
  if (window.innerWidth > 640 && r.right + 236 > window.innerWidth - 8) sub.classList.add('flip');
}
document.addEventListener('click', function (e) {
  var b = e.target.closest && e.target.closest('.drop-parent-btn'); if (!b) return;
  e.stopPropagation();
  var par = b.parentNode, open = !par.classList.contains('open');
  par.parentNode.querySelectorAll('.drop-parent').forEach(function (p) { p.classList.remove('open'); p.firstElementChild.setAttribute('aria-expanded', 'false'); });
  if (open) { par.classList.add('open'); b.setAttribute('aria-expanded', 'true'); navSubFit(par); }
});
document.addEventListener('mouseover', function (e) {
  var par = e.target.closest && e.target.closest('.drop-parent'); if (par && !par._fitAt) { navSubFit(par); par._fitAt = 1; setTimeout(function () { par._fitAt = 0; }, 400); }
});

/* 탭 버튼 바로 아래에 드롭다운 놓기 — 문서 좌표(absolute)라 스크롤해도 화면에 붙어 따라오지 않음 · 화면 오른쪽 밖이면 안쪽으로 */
function placeTabDrop(btn, drop) {
  var rect = btn.getBoundingClientRect(), op = drop.offsetParent || document.body, base = op.getBoundingClientRect();
  var left = Math.min(rect.left, document.documentElement.clientWidth - drop.offsetWidth - 8);
  drop.style.top = (rect.bottom + 4 - base.top - op.clientTop) + 'px';
  drop.style.left = (Math.max(8, left) - base.left - op.clientLeft) + 'px';
}
window.addEventListener('resize', function () {                       /* 화면 크기·방향이 바뀌면 열린 메뉴 자리 다시 맞춤 */
  var drop = document.querySelector('.tab-dropdown.open'), btn = drop && document.getElementById(drop.id.replace(/-drop$/, '-btn'));
  if (btn) placeTabDrop(btn, drop);
});

function toggleTabGroup(grpId) {
  const btn  = document.getElementById('grp-' + grpId + '-btn');
  const drop = document.getElementById('grp-' + grpId + '-drop');
  const isOpen = drop.classList.contains('open');
  // 모든 드롭다운 닫기
  document.querySelectorAll('.tab-dropdown').forEach(d => d.classList.remove('open'));
  document.querySelectorAll('.tab-group-btn').forEach(b => b.classList.remove('open'));
  if (!isOpen) {
    drop.classList.add('open');
    placeTabDrop(btn, drop);
    btn.classList.add('open');
    /* 하위 메뉴가 있는 그룹: 지금 보고 있는 도구가 든 하위 메뉴를 펼친 채로 (터치·좁은 화면) */
    drop.querySelectorAll('.drop-parent').forEach(function (p) {
      var on = !!p.querySelector('.drop-item.active') && (window.innerWidth <= 640 || !window.matchMedia('(hover: hover)').matches);
      p.classList.toggle('open', on); p.firstElementChild.setAttribute('aria-expanded', on ? 'true' : 'false');
    });
  }
}

function switchSubTab(tab, grpId, btn) {
  // 드롭다운 닫기
  document.querySelectorAll('.tab-dropdown').forEach(d => d.classList.remove('open'));
  document.querySelectorAll('.tab-group-btn').forEach(b => b.classList.remove('open'));
  // 페이지 전환
  document.querySelectorAll('.app-page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + tab).classList.add('active');
  if (window.kcmpRender) window.kcmpRender(tab);   /* [KODEX-CMP] 코스피 비교 차트 (시뮬레이터 탭만 해당) */
  // drop-item active
  document.querySelectorAll('.drop-item').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  // 그룹 버튼 has-active
  document.querySelectorAll('.tab-group-btn').forEach(b => b.classList.remove('has-active'));
  const grpBtn = document.getElementById('grp-' + grpId + '-btn');
  if (grpBtn) { grpBtn.classList.add('has-active'); }
  // 메인 탭 active 해제
  document.querySelectorAll('#mainNav .app-tab').forEach(b => b.classList.remove('active'));
  // 탭 진입 시 초기화
  if (tab === 'home' && window.homeRender) window.homeRender();
  if (window.fcRender) window.fcRender(tab);   /* [FC] 연봉·퇴직금·주담대·중개수수료 + [TAX] 세금 계산기 */
  if (tab === 'simulator') fetchKodexPrice();
  if (tab === 'fear') fetchFearGreed();
  /* 공포·탐욕 탭이 열려 있는 동안 5분마다 자동 갱신 */
  clearInterval(window._fearTimer); window._fearTimer = null;
  if (tab === 'fear') window._fearTimer = setInterval(function () { if (!document.hidden) fetchFearGreed(); }, 5 * 60 * 1000);
  if (tab === 'etfcagr' && window.ecRender) window.ecRender();
  if (tab === 'mcap' && window.mcRender) window.mcRender();
  if (tab === 'aptrank' && window.apRender) window.apRender();
  if (window.dvRender) window.dvRender();   /* ETF 분배 달력: 열리면 그리고, 다른 탭이면 자동 갱신 중지 */
  if (tab === 'muhan') requestAnimationFrame(function(){ requestAnimationFrame(function(){ if (typeof muhanInit === 'function') muhanInit(); }); });
  if (tab === 'tigerdiv')  {
    if (window._tigerdivState) {
      /* 분배금 모드 버튼 active 직접 복원 */
      const curMode = window._tigerdivState.investMode;
      ['receive','reinvest','partial'].forEach(function(mode) {
        const b = document.getElementById('tigerdiv-mode-' + mode);
        if (b) b.classList.toggle('active', mode === curMode);
      });
      const pb = document.getElementById('tigerdiv-partial-ratio-block');
      if (pb) pb.style.display = curMode === 'partial' ? 'block' : 'none';
    }
      /* ── tax-mode-tab (직접입력/과세표준) 복원 ── */
      if (window._tigerdivState) {
        var _taxMode     = window._tigerdivState.taxMode     || 'manual';
        var _bracketType = window._tigerdivState.bracketType || 'separate';
        var _solPg2 = document.getElementById('page-tigerdiv');
        if (_solPg2) {
          _solPg2.querySelectorAll('.tax-mode-tab').forEach(function(b) {
            b.classList.toggle('active', b.id === 'tigerdiv-ttab-' + _taxMode);
          });
          _solPg2.querySelectorAll('.tax-type-btn').forEach(function(b) {
            b.classList.toggle('active',
              b.id === 'tigerdiv-ttype-' + _bracketType);
          });
          /* 패널 표시 */
          var _mp = document.getElementById('tigerdiv-tax-panel-manual');
          var _bp = document.getElementById('tigerdiv-tax-panel-bracket');
          if (_mp) _mp.style.display = _taxMode === 'manual'  ? '' : 'none';
          if (_bp) _bp.style.display = _taxMode === 'bracket' ? '' : 'none';
          /* 종합/분리 정보 패널 */
          var _si = document.getElementById('tigerdiv-tax-separate-info');
          var _ci = document.getElementById('tigerdiv-tax-comprehensive-info');
          if (_si) _si.style.display = _bracketType === 'separate'      ? '' : 'none';
          if (_ci) _ci.style.display = _bracketType === 'comprehensive' ? '' : 'none';
        }
      }
    tigerdivUpdate(); tigerdivFetchPrice();
  }
  if (tab === 'tigersemi') {
    if (window._tigersemiState) {
      /* 분배금 모드 버튼 active 직접 복원 */
      const curMode = window._tigersemiState.investMode;
      ['receive','reinvest','partial'].forEach(function(mode) {
        const b = document.getElementById('tigersemi-mode-' + mode);
        if (b) b.classList.toggle('active', mode === curMode);
      });
      const pb = document.getElementById('tigersemi-partial-ratio-block');
      if (pb) pb.style.display = curMode === 'partial' ? 'block' : 'none';
    }
      /* ── tax-mode-tab (직접입력/과세표준) 복원 ── */
      if (window._tigersemiState) {
        var _taxMode     = window._tigersemiState.taxMode     || 'manual';
        var _bracketType = window._tigersemiState.bracketType || 'separate';
        var _solPg2 = document.getElementById('page-tigersemi');
        if (_solPg2) {
          _solPg2.querySelectorAll('.tax-mode-tab').forEach(function(b) {
            b.classList.toggle('active', b.id === 'tigersemi-ttab-' + _taxMode);
          });
          _solPg2.querySelectorAll('.tax-type-btn').forEach(function(b) {
            b.classList.toggle('active',
              b.id === 'tigersemi-ttype-' + _bracketType);
          });
          /* 패널 표시 */
          var _mp = document.getElementById('tigersemi-tax-panel-manual');
          var _bp = document.getElementById('tigersemi-tax-panel-bracket');
          if (_mp) _mp.style.display = _taxMode === 'manual'  ? '' : 'none';
          if (_bp) _bp.style.display = _taxMode === 'bracket' ? '' : 'none';
          /* 종합/분리 정보 패널 */
          var _si = document.getElementById('tigersemi-tax-separate-info');
          var _ci = document.getElementById('tigersemi-tax-comprehensive-info');
          if (_si) _si.style.display = _bracketType === 'separate'      ? '' : 'none';
          if (_ci) _ci.style.display = _bracketType === 'comprehensive' ? '' : 'none';
        }
      }
    tigersemiUpdate(); tigersemiFetchPrice();
  }
  if (tab === 'tiger')     {
    const tigerPg = document.getElementById('page-tiger');
    if (tigerPg && window._tigerState) {
      tigerPg.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
      const modeMap = { receive: 0, reinvest: 1, partial: 2 };
      const mBtns = tigerPg.querySelectorAll('.mode-btn');
      const idx = modeMap[window._tigerState.investMode];
      if (mBtns[idx]) mBtns[idx].classList.add('active');
      const pb = document.getElementById('tiger-partial-ratio-block');
      if (pb) pb.style.display = window._tigerState.investMode === 'partial' ? 'block' : 'none';
    }
      /* ── tax-mode-tab (직접입력/과세표준) 복원 ── */
      if (window._tigerState) {
        var _taxMode     = window._tigerState.taxMode     || 'manual';
        var _bracketType = window._tigerState.bracketType || 'separate';
        var _solPg2 = document.getElementById('page-tiger');
        if (_solPg2) {
          _solPg2.querySelectorAll('.tax-mode-tab').forEach(function(b) {
            b.classList.toggle('active', b.id === 'tiger-ttab-' + _taxMode);
          });
          _solPg2.querySelectorAll('.tax-type-btn').forEach(function(b) {
            b.classList.toggle('active',
              b.id === 'tiger-ttype-' + _bracketType);
          });
          /* 패널 표시 */
          var _mp = document.getElementById('tiger-tax-panel-manual');
          var _bp = document.getElementById('tiger-tax-panel-bracket');
          if (_mp) _mp.style.display = _taxMode === 'manual'  ? '' : 'none';
          if (_bp) _bp.style.display = _taxMode === 'bracket' ? '' : 'none';
          /* 종합/분리 정보 패널 */
          var _si = document.getElementById('tiger-tax-separate-info');
          var _ci = document.getElementById('tiger-tax-comprehensive-info');
          if (_si) _si.style.display = _bracketType === 'separate'      ? '' : 'none';
          if (_ci) _ci.style.display = _bracketType === 'comprehensive' ? '' : 'none';
        }
      }
    tigerUpdate(); tigerFetchPrice();
  }
  if (tab === 'sol')       {
    /* 저장된 모드 상태로 버튼 active 복원 */
    const solPg = document.getElementById('page-sol');
    if (solPg && window._solState) {
      solPg.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
      const modeMap = { receive: 0, reinvest: 1, partial: 2 };
      const mBtns = solPg.querySelectorAll('.mode-btn');
      const idx = modeMap[window._solState.investMode];
      if (mBtns[idx]) mBtns[idx].classList.add('active');
      const pb = document.getElementById('sol-partial-ratio-block');
      if (pb) pb.style.display = window._solState.investMode === 'partial' ? 'block' : 'none';
    }
      /* ── tax-mode-tab (직접입력/과세표준) 복원 ── */
      if (window._solState) {
        var _taxMode     = window._solState.taxMode     || 'manual';
        var _bracketType = window._solState.bracketType || 'separate';
        var _solPg2 = document.getElementById('page-sol');
        if (_solPg2) {
          _solPg2.querySelectorAll('.tax-mode-tab').forEach(function(b) {
            b.classList.toggle('active', b.id === 'sol-ttab-' + _taxMode);
          });
          _solPg2.querySelectorAll('.tax-type-btn').forEach(function(b) {
            b.classList.toggle('active',
              b.id === 'sol-ttype-' + _bracketType);
          });
          /* 패널 표시 */
          var _mp = document.getElementById('sol-tax-panel-manual');
          var _bp = document.getElementById('sol-tax-panel-bracket');
          if (_mp) _mp.style.display = _taxMode === 'manual'  ? '' : 'none';
          if (_bp) _bp.style.display = _taxMode === 'bracket' ? '' : 'none';
          /* 종합/분리 정보 패널 */
          var _si = document.getElementById('sol-tax-separate-info');
          var _ci = document.getElementById('sol-tax-comprehensive-info');
          if (_si) _si.style.display = _bracketType === 'separate'      ? '' : 'none';
          if (_ci) _ci.style.display = _bracketType === 'comprehensive' ? '' : 'none';
          /* 슬라이더 dimming 복원 */
          var _niTax = document.getElementById('sol-ni-tax');
          var _slTax = document.getElementById('sol-sl-tax');
          if (_niTax && _slTax) {
            var _hdr = _niTax.closest('.slider-header');
            var _dim = (_taxMode === 'bracket');
            if (_hdr) { _hdr.style.opacity = _dim ? '0.4' : '1'; _hdr.style.pointerEvents = _dim ? 'none' : 'auto'; }
            _slTax.style.opacity = _dim ? '0.4' : '1';
            _slTax.style.pointerEvents = _dim ? 'none' : 'auto';
          }
        }
      }
    solUpdate(); solFetchPrice();
  }
  if (tab === 'loan')      calcLoan();
  if (tab === 'compound')  { setCpdMode('simple', document.getElementById('cpd-mode-simple')); calcCompound(); }
  if (tab === 'cagr')      calcCAGR();
  if (tab === 'fx')        { fetchFxRates(); if (window.dxyRender) window.dxyRender(); }
  if (tab === 'health')    calcHealth();
  if (tab === 'kospi') {
    fetchKospi().then(() => {
      const py = _kospiPeriod.kospi || 0;
      if (py > 0) {
        const tabsEl = document.getElementById('kospi-period-tabs');
        const activeBtn = tabsEl ? tabsEl.querySelector('.period-btn.active') : null;
        setKospiPeriod('kospi', py, activeBtn);
      }
    });
  }
  if (tab === 'kospi200') {
    fetchKospi200().then(() => {
      const py = _kospiPeriod.k200 || 0;
      if (py > 0) {
        const tabsEl = document.getElementById('k200-period-tabs');
        const activeBtn = tabsEl ? tabsEl.querySelector('.period-btn.active') : null;
        setKospiPeriod('k200', py, activeBtn);
      }
    });
  }
  if (tab === 'kosdaq')    {
    fetchKosdaq().then(() => {
      const py = _kosdaqPeriod || 0;
      if (py > 0) {
        const tabsEl = document.getElementById('kosdaq-period-tabs');
        const activeBtn = tabsEl ? tabsEl.querySelector('.period-btn.active') : null;
        setKosdaqPeriod(py, activeBtn);
      }
    });
  }
  if (INDEX_CONFIG[tab]) {   /* 제너릭 지수 (미국·아시아) */
    fetchIndex(tab).then(() => {
      const py = _indexPeriod[tab] || 0;
      if (py > 0) {
        /* 현재가 갱신 완료 후 기간별 과거값 조회 */
        const tabsEl = document.getElementById(tab+'-period-tabs');
        const activeBtn = tabsEl ? tabsEl.querySelector('.period-btn.active') : null;
        setIndexPeriod(tab, py, activeBtn);
      }
    });
  }

  if (tab === 'moneyspeed') { if (typeof msRenderRealty === 'function') msRenderRealty(); setTimeout(function(){ if (typeof fetchMSAll === 'function') fetchMSAll(); }, 400); }}

// 외부 클릭 시 드롭다운 닫기
document.addEventListener('click', e => {
  if (!e.target.closest('.tab-group') && !e.target.closest('.tab-dropdown')) {
    document.querySelectorAll('.tab-dropdown').forEach(d => d.classList.remove('open'));
    document.querySelectorAll('.tab-group-btn').forEach(b => b.classList.remove('open'));
  }
}, true);

/* ════════════════════════════════════════
   [COMPOUND] 복리 계산기
════════════════════════════════════════ */

function getCpdWon(id) {
  const raw = (document.getElementById('cpd-' + id).value || '0').replace(/,/g, '');
  const n   = parseFloat(raw) || 0;
  const u   = cpdUnit[id];
  return n * (u === 'eok' ? 1e8 : u === 'man' ? 1e4 : 1);
}
function setCpdUnit(id, unit, btn) {
  const won  = getCpdWon(id);
  cpdUnit[id] = unit;
  const disp = won / (unit === 'eok' ? 1e8 : unit === 'man' ? 1e4 : 1);
  document.getElementById('cpd-' + id).value = commaFmt(
    unit === 'won' ? Math.round(disp) : parseFloat(disp.toFixed(4))
  );
  document.querySelectorAll('[data-field="cpd-' + id + '"]')
    .forEach(b => b.classList.toggle('active', b === btn));
  calcCompound();
}
function onCpdInput(id) {
  const el = document.getElementById('cpd-' + id);
  const cv = el.selectionStart; const ov = el.value;
  const fmt = typingNumFmt(ov);
  el.value = fmt;
  try { el.setSelectionRange(Math.max(0, cv + fmt.length - ov.length), Math.max(0, cv + fmt.length - ov.length)); } catch {}
  calcCompound();
}
function onCpdBlur(id) {
  const won  = getCpdWon(id);
  const unit = cpdUnit[id];
  const disp = won / (unit === 'eok' ? 1e8 : unit === 'man' ? 1e4 : 1);
  document.getElementById('cpd-' + id).value = commaFmt(
    unit === 'won' ? Math.round(disp) : parseFloat(disp.toFixed(4))
  );
}
function setCpdMode(mode, btn) {
  cpdMode = mode;
  document.getElementById('cpd-mode-simple').classList.toggle('active', mode === 'simple');
  document.getElementById('cpd-mode-dca').classList.toggle('active', mode === 'dca');
  document.getElementById('cpd-dca-section').style.display = mode === 'dca' ? '' : 'none';
  document.getElementById('cpd-th-dep').style.display = mode === 'dca' ? '' : 'none';
  calcCompound();
}
function toggleCpdTax() {
  cpdTaxOn = !cpdTaxOn;
  syncCpdTaxUI();
  calcCompound();
}
/* 세금 스위치 화면을 cpdTaxOn 상태와 맞춤 (초기 표시도 이 함수 하나로) */
function syncCpdTaxUI() {
  const sw  = document.getElementById('cpd-tax-sw');
  if (!sw) return;
  const blk = document.getElementById('cpd-tax-block');
  sw.classList.toggle('on', cpdTaxOn);
  document.getElementById('cpd-tax-off').style.color = cpdTaxOn ? 'var(--text3)' : 'var(--text2)';
  document.getElementById('cpd-tax-on').style.color  = cpdTaxOn ? '#f04452' : 'var(--text3)';
  blk.style.opacity = cpdTaxOn ? '1' : '0.3';
  blk.style.pointerEvents = cpdTaxOn ? 'auto' : 'none';
}
document.addEventListener('DOMContentLoaded', syncCpdTaxUI);
function setCpdTaxPreset(v) {
  document.getElementById('cpd-tax-rate').value = v;
  calcCompound();
}
function setCpdChartTab(tab, btn) {
  cpdChartTab = tab;
  document.querySelectorAll('#cpd-ctab-val, #cpd-ctab-ret').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  calcCompound();
}

/* 결과 화면을 비움 (입력이 잘못됐을 때 이전 결과가 남지 않도록) */
function cpdClear(msg) {
  ['cpd-s-final','cpd-s-profit','cpd-s-cagr'].forEach(id => { const e = document.getElementById(id); if (e) e.textContent = '—'; });
  const f = document.getElementById('cpd-s-final-sub'); if (f) f.textContent = msg || L('입력값을 확인하세요', 'Check your inputs');
  const pr = document.getElementById('cpd-s-profit-sub'); if (pr) pr.textContent = L('수익률 —', 'Return —');
  const cg = document.getElementById('cpd-s-cagr-sub'); if (cg) cg.textContent = L('월평균 —', 'Monthly —');
  const tb = document.getElementById('cpdTableBody'); if (tb) tb.innerHTML = '';
  if (cpdChart) { cpdChart.destroy(); cpdChart = null; }
}

/* 적립식 실효 수익률(IRR): 0개월에 원금, 매월 말 적립, 마지막 달 말 평가액 → 월 IRR 을 연율로 */
function cpdIRR(principal, monthly, months, final) {
  const npv = i => {
    let v = -principal, d = 1;
    for (let m = 1; m <= months; m++) { d /= (1 + i); v -= monthly * d; }
    return v + final * d;
  };
  let lo = -0.99, hi = 1;
  if (npv(lo) * npv(hi) > 0) return null;
  for (let k = 0; k < 200; k++) {
    const mid = (lo + hi) / 2;
    if (npv(lo) * npv(mid) <= 0) hi = mid; else lo = mid;
  }
  return (lo + hi) / 2;
}

function calcCompound() {
  const principal = getCpdWon('principal');
  const ratePct   = parseFloat(document.getElementById('cpd-rate').value);
  const rateY     = ratePct / 100;
  const yearsRaw  = parseInt(document.getElementById('cpd-years').value, 10);
  const freq      = parseInt(document.getElementById('cpd-freq').value, 10) || 1;
  const taxPct    = parseFloat(document.getElementById('cpd-tax-rate').value);
  const taxRate   = cpdTaxOn ? Math.min(Math.max(isNaN(taxPct) ? 0 : taxPct, 0), 100) / 100 : 0;
  const monthly   = cpdMode === 'dca' ? getCpdWon('monthly') : 0;

  // 슬라이더 동기화
  if (!isNaN(ratePct)) document.getElementById('cpd-rate-sl').value = Math.min(Math.max(ratePct, 0.1), 30);
  if (!isNaN(yearsRaw)) document.getElementById('cpd-years-sl').value = Math.min(Math.max(yearsRaw, 1), 50);
  const dep = document.getElementById('cpd-annual-dep');
  if (dep) dep.textContent = fmt(monthly * 12) + L(' / 년', ' / yr');

  if (isNaN(rateY) || rateY <= -1) { cpdClear(L('연 이율을 확인하세요', 'Check the annual rate')); return; }
  if (isNaN(yearsRaw) || yearsRaw < 1) { cpdClear(L('투자 기간은 1년 이상이어야 합니다', 'The term must be at least 1 year')); return; }
  if (principal < 0 || monthly < 0 || (principal <= 0 && monthly <= 0)) {
    cpdClear(cpdMode === 'dca' ? L('초기 투자금 또는 월 적립금을 입력하세요', 'Enter an initial investment or a monthly contribution') : L('초기 투자금액을 입력하세요', 'Enter the initial investment')); return;
  }
  const years = Math.min(yearsRaw, 100);

  /* 시뮬레이션
     · 적립: 매월 말 납입 (그 달 이자는 붙지 않음)
     · 복리 주기 ≤ 월(연·반기·분기·월): 매달 잔액 × 연이율/12 를 쌓아 두었다가 주기마다 원금에 더함 (주기 안은 단리)
     · 복리 주기 > 월(주·일): 주기마다 잔액 × 연이율/주기수 를 바로 더하고, 달이 바뀌는 시점에 적립
     · 세금: 이자가 원금에 붙을 때마다 그 이자에만 적용 */
  let balance = principal, totalInvest = principal, totalInterest = 0;
  const yearRows = [];
  const pushYear = y => yearRows.push({
    y, balance: Math.round(balance), totalInvest: Math.round(totalInvest),
    totalDeposit: Math.round(totalInvest - principal), totalInterest: Math.round(totalInterest),
    ret: totalInvest > 0 ? (balance / totalInvest - 1) * 100 : 0,
  });
  if (freq <= 12) {
    const step = 12 / freq;                 // 이자가 붙는 간격(개월) — 1·2·4·12회는 나누어떨어짐
    let accrued = 0;
    for (let m = 1; m <= years * 12; m++) {
      accrued += balance * rateY / 12;
      balance += monthly; totalInvest += monthly;
      if (m % step === 0) {
        const net = accrued * (1 - taxRate);
        balance += net; totalInterest += net; accrued = 0;
      }
      if (m % 12 === 0) pushYear(m / 12);
    }
  } else {
    for (let p = 1; p <= years * freq; p++) {
      const net = balance * rateY / freq * (1 - taxRate);
      balance += net; totalInterest += net;
      const n = Math.floor(p * 12 / freq) - Math.floor((p - 1) * 12 / freq);   // 이번 주기 안에 끝난 달 수
      if (n > 0) { balance += monthly * n; totalInvest += monthly * n; }
      if (p % freq === 0) pushYear(p / freq);
    }
  }

  const final   = yearRows[years - 1].balance;
  const profit  = final - totalInvest;
  const retPct  = totalInvest > 0 ? (final / totalInvest - 1) * 100 : 0;
  /* 실효 CAGR: 일반 복리는 (최종/원금)^(1/년)−1, 적립식은 납입 시점을 반영한 연환산 IRR */
  let cagrMon = null, cagr = null;
  if (monthly > 0) {
    cagrMon = cpdIRR(principal, monthly, years * 12, final);
    if (cagrMon !== null) { if (Math.abs(cagrMon) < 1e-10) cagrMon = 0; cagr = Math.pow(1 + cagrMon, 12) - 1; }
  } else {
    cagr = Math.pow(final / principal, 1 / years) - 1;
    cagrMon = Math.pow(1 + cagr, 1 / 12) - 1;
  }

  // 요약 카드
  document.getElementById('cpd-s-final').textContent = fmt(final);
  document.getElementById('cpd-s-final-sub').textContent = L('총 투입 ', 'Total paid in ') + fmt(Math.round(totalInvest));
  document.getElementById('cpd-s-profit').textContent = (profit >= 0 ? '+' : '') + fmt(Math.round(profit));
  document.getElementById('cpd-s-profit-sub').textContent = L('수익률 ', 'Return ') + (retPct >= 0 ? '+' : '') + retPct.toFixed(2) + '%';
  document.getElementById('cpd-s-cagr').textContent = cagr === null ? '—' : (cagr >= 0 ? '+' : '') + (cagr * 100).toFixed(2) + '%';
  document.getElementById('cpd-s-cagr-sub').textContent = cagr === null ? L('월평균 —', 'Monthly —')
    : L('월평균 ', 'Monthly ') + (cagrMon >= 0 ? '+' : '') + (cagrMon * 100).toFixed(3) + '%' + (monthly > 0 ? L(' · 적립 시점 반영(IRR)', ' · IRR (deposit timing)') : '');

  // 테이블
  const tbody = document.getElementById('cpdTableBody');
  tbody.innerHTML = '';
  yearRows.forEach((r, i) => {
    const tr = document.createElement('tr');
    if (i === yearRows.length - 1) tr.classList.add('cagr-highlight');
    tr.innerHTML = `
      <td>${L(r.y + '년차', 'Year ' + r.y)}</td>
      <td>${fmt(r.totalInvest - (cpdMode === 'dca' ? r.totalDeposit : 0))}</td>
      ${cpdMode === 'dca' ? `<td style="color:var(--accent);">+${fmt(r.totalDeposit)}</td>` : ''}
      <td class="pos">+${fmt(r.totalInterest)}</td>
      <td>${fmt(r.balance)}</td>
      <td class="${r.ret >= 0 ? 'pos' : 'neg'}">${r.ret >= 0 ? '+' : ''}${r.ret.toFixed(2)}%</td>`;
    tbody.appendChild(tr);
  });

  // 차트
  const labels   = yearRows.map(r => L(r.y + '년차', 'Y' + r.y));
  const valData  = yearRows.map(r => r.balance);
  const retData  = yearRows.map(r => parseFloat(r.ret.toFixed(2)));
  const invData  = yearRows.map(r => r.totalInvest);

  if (cpdChart) cpdChart.destroy();
  let datasets, yLabel;
  if (cpdChartTab === 'val') {
    datasets = [{
      label: L('총 자산', 'Balance'),
      data: valData,
      backgroundColor: valData.map((v,i) => i === valData.length-1 ? 'rgba(49,130,246,0.9)' : 'rgba(49,130,246,0.55)'),
      borderRadius: 5,
      borderSkipped: false,
    }];
    yLabel = v => fmt(v, true);
  } else {
    datasets = [{
      label: L('수익률', 'Return'),
      data: retData,
      backgroundColor: retData.map((v,i) => i === retData.length-1 ? 'rgba(49,130,246,0.9)' : 'rgba(49,130,246,0.5)'),
      borderRadius: 5,
      borderSkipped: false,
    }];
    yLabel = v => v.toFixed(1) + '%';
  }
  cpdChart = new Chart(document.getElementById('cpdChart'), {
    type: 'bar',
    data: { labels, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#202027', borderColor: fgA(0.1), borderWidth: 1,
          titleColor: '#9e9ea4', bodyColor: '#e4e4e5', padding: 12,
          callbacks: { label: ctx => ' ' + ctx.dataset.label + ': ' + (cpdChartTab === 'val' ? fmt(ctx.parsed.y) : ctx.parsed.y.toFixed(2) + '%') }
        }
      },
      scales: {
        x: { ticks: { color: '#6d6d76', font: { size: 11 } }, grid: { display: false }, border: { display: false } },
        y: { ticks: { color: '#6d6d76', font: { size: 11 }, callback: yLabel }, grid: { color: fgA(0.04) }, border: { display: false } }
      }
    }
  });
}

/* ════════════════════════════════════════
   [LOAN] 대출 이자 계산기
════════════════════════════════════════ */
let loanMethod = 'equal';
const loanUnit_s = { amount: 'won' };
const LOAN_DESC = {
  equal:     '매월 원금+이자를 동일하게 납부. 초기 이자 비중이 높고 후반 원금 비중이 높아집니다.',
  principal: '매월 원금을 균등하게 상환, 이자는 잔여원금에 따라 감소. 초기 부담이 크지만 총이자가 적습니다.',
  bullet:    '대출 기간 동안 이자만 납부하고 만기에 원금 전액 상환. 월납입액이 가장 적지만 총이자가 가장 많습니다.',
  graduated: '초기에는 납입금이 적고 매년 일정 비율로 증가. 초기 부담이 가볍고 소득 증가에 맞춰 상환하는 방식입니다.',
};
function getLoanWon(id) {
  const raw = (document.getElementById('loan-' + id).value || '0').replace(/,/g,'');
  const n = parseFloat(raw)||0, u = loanUnit_s[id]||'won';
  return n * (u==='eok'?1e8:u==='man'?1e4:1);
}
function syncLoanAmountFromSlider(val) {
  const won  = parseInt(val);
  const unitBtns = document.querySelectorAll('[data-field="loan-amount"].active');
  const unit = unitBtns.length ? unitBtns[0].dataset.unit : 'won';
  let disp;
  if (unit === 'eok') disp = (won/1e8).toFixed(2);
  else if (unit === 'man') disp = Math.round(won/1e4).toLocaleString('ko-KR');
  else disp = won.toLocaleString('ko-KR');
  const el = document.getElementById('loan-amount');
  if (el) el.value = disp;
  calcLoan();
}

function setLoanUnit(id,unit,btn) {
  const won=getLoanWon(id); loanUnit_s[id]=unit;
  const disp=won/(unit==='eok'?1e8:unit==='man'?1e4:1);
  document.getElementById('loan-'+id).value=commaFmt(unit==='won'?Math.round(disp):parseFloat(disp.toFixed(4)));
  document.querySelectorAll('[data-field="loan-'+id+'"]').forEach(b=>b.classList.toggle('active',b===btn));
  if (id === 'amount') {
    const sl = document.getElementById('loan-amount-sl');
    if (sl) sl.value = Math.min(Math.max(won, parseInt(sl.min)), parseInt(sl.max));
  }
  calcLoan();
}
function onLoanInput(id) {
  const el=document.getElementById('loan-'+id), cv=el.selectionStart, ov=el.value;
  const f2=typingNumFmt(ov);
  el.value=f2; try{el.setSelectionRange(Math.max(0,cv+f2.length-ov.length),Math.max(0,cv+f2.length-ov.length));}catch{}
  calcLoan();
}
function onLoanBlur(id) {
  if (id === 'amount') {
    const sl = document.getElementById('loan-amount-sl');
    const w  = getLoanWon('amount');
    if (sl) sl.value = Math.min(Math.max(w, parseInt(sl.min)), parseInt(sl.max));
  }
  const won=getLoanWon(id),unit=loanUnit_s[id]||'won';
  const disp=won/(unit==='eok'?1e8:unit==='man'?1e4:1);
  document.getElementById('loan-'+id).value=commaFmt(unit==='won'?Math.round(disp):parseFloat(disp.toFixed(4)));
}

let gradMode = 'fixed';

const GRAD_MODE_DESC = {
  fixed: 'A=초회이자, D=A×k%/12 · PMT=A+(m-1)×D (선형 증가)',
  arith: '초회납입금 A + 월체증금 D 직접 입력 · PMT=A+(m-1)×D',
  geo:   '초회납입금 A + 월체증률 k_m · PMT=A×(1+k_m)^(m-1) (복리 증가)',
};

let gradType = 'manual';

function setLoanMethod(method,btn) {
  loanMethod=method;
  ['equal','principal','bullet','graduated'].forEach(m=>document.getElementById('loan-method-'+m).classList.toggle('active',m===method));
  document.getElementById('loan-method-desc').textContent=LOAN_DESC[method];
  /* 체증식 전용 옵션 패널 */
  const gradeOpts = document.getElementById('loan-grade-options');
  if(gradeOpts) gradeOpts.style.display = method==='graduated' ? '' : 'none';
  const isGrad = method==='graduated';
  const graceBlock = document.getElementById('loan-grace-block');
  const gradSummary = document.getElementById('loan-grad-summary');
  if(graceBlock)  graceBlock.style.display  = isGrad ? '' : 'none';
  if(gradSummary) gradSummary.style.display = isGrad ? '' : 'none';
  calcLoan();
}
/* ════════════════════════════════════════
   [RATE] 기준금리 조회
   BOK: ECOS 실인증키 + CORS 프록시
   Fed: US Treasury Fiscal Data API (CORS 기본지원) + FRED via corsproxy
════════════════════════════════════════ */

const BOK_API_KEY = 'RVTLLDCO3IW1YUKQSSPJ';

/* CORS 프록시 경유 fetch */

/* FRED 텍스트 파일 파싱 */

/* BOK ECOS JSON 파싱 */

/* ── 미국 연준 기준금리 ──
   1순위: US Treasury Fiscal Data API (CORS 기본지원, 인증 불필요)
          → avg_interest_rates 에서 단기 채권 금리 사용
   2순위: FRED FEDFUNDS.txt via corsproxy.io
   3순위: FRED DFEDTARU.txt (Fed 목표범위 상단) via corsproxy.io */

/* ── 한국은행 기준금리 ──
   실인증키 RVTLLDCO3IW1YUKQSSPJ 사용
   1순위: 직접 호출 (ECOS가 인증된 키에 CORS 허용하는 경우)
   2순위: corsproxy.io 경유
   3순위: allorigins 경유
   통계표 722Y001 / 항목 0101000 (기준금리) */

/* 결과 화면을 비움 (입력이 잘못됐을 때 이전 결과가 남지 않도록) */
function loanClear(msg) {
  const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
  set('loan-s-monthly', '—'); set('loan-s-monthly-sub', msg || '입력값을 확인하세요');
  set('loan-s-interest', '—'); set('loan-s-interest-sub', '이자율 —');
  set('loan-s-total', '—'); set('loan-s-total-sub', '대출금 대비 —배');
  ['loan-g-first','loan-g-last','loan-g-step','loan-g-rate'].forEach(id => set(id, '—'));
  const tb = document.getElementById('loanTableBody'); if (tb) tb.innerHTML = '';
  window._loanSchedule = []; window._loanTotalYears = 0;
  const mb = document.getElementById('loanMonthlyBody'); if (mb) mb.innerHTML = '';
}

function calcLoan() {
  const principal=Math.round(getLoanWon('amount'));
  const ratePct=parseFloat(document.getElementById('loan-rate').value);
  const rateY=ratePct/100;
  const yearsIn=parseInt(document.getElementById('loan-years').value,10);
  if(!isNaN(ratePct)) document.getElementById('loan-rate-sl').value=Math.min(Math.max(ratePct,0.1),20);
  if(!isNaN(yearsIn)) document.getElementById('loan-years-sl').value=Math.min(Math.max(yearsIn,1),50);
  /* 거치기간 슬라이더 동기화 */
  const graceEl=document.getElementById('loan-grace');
  const graceSlEl=document.getElementById('loan-grace-sl');
  if(graceEl&&graceSlEl) graceSlEl.value=Math.min(Math.max(parseInt(graceEl.value,10)||0,0),60);
  if(!(principal>0)) { loanClear('대출금액을 입력하세요'); return; }
  if(isNaN(rateY)||rateY<0) { loanClear('연 금리를 확인하세요 (0% 이상)'); return; }
  if(isNaN(yearsIn)||yearsIn<1) { loanClear('대출 기간은 1년 이상이어야 합니다'); return; }
  const years=Math.min(yearsIn,100);
  const rateM=rateY/12, months=years*12;
  let schedule=[];
  /* 모든 회차는 원 단위 정수로 계산: 이자 = 반올림(잔액 × 월이율), 원금 = 납입금 − 이자,
     마지막 회차는 남은 원금을 전부 갚아 잔액이 정확히 0 이 되도록 맞춤 */
  if(loanMethod==='equal'){
    const pmtExact = rateM>0 ? principal*rateM*Math.pow(1+rateM,months)/(Math.pow(1+rateM,months)-1) : principal/months;
    const pmt=Math.round(pmtExact);
    let bal=principal;
    for(let i=1;i<=months;i++){
      const ip=Math.round(bal*rateM);
      const pp=i<months?Math.min(pmt-ip,bal):bal;
      bal-=pp;
      schedule.push({payment:pp+ip,principal:pp,interest:ip,balance:bal});
    }
    document.getElementById('loan-s-label1').textContent='월 납입금 (균등)';
    document.getElementById('loan-s-monthly').textContent=fmt(pmt);
    const lastPay=schedule[months-1].payment;
    document.getElementById('loan-s-monthly-sub').textContent=lastPay===pmt?'매월 동일':'매월 동일 · 마지막 회차 '+fmt(lastPay);
  } else if(loanMethod==='principal'){
    const ppBase=Math.round(principal/months); let bal=principal;
    for(let i=1;i<=months;i++){
      const ip=Math.round(bal*rateM);
      const pp=i<months?Math.min(ppBase,bal):bal;
      bal-=pp;
      schedule.push({payment:pp+ip,principal:pp,interest:ip,balance:bal});
    }
    document.getElementById('loan-s-label1').textContent='첫달 납입금';
    document.getElementById('loan-s-monthly').textContent=fmt(schedule[0].payment);
    document.getElementById('loan-s-monthly-sub').textContent='→ '+fmt(schedule[months-1].payment)+'로 감소';
  } else if(loanMethod==='bullet') {
    const ip=Math.round(principal*rateM);
    for(let i=1;i<=months;i++){
      const pp=i<months?0:principal;
      schedule.push({payment:ip+pp,principal:pp,interest:ip,balance:i<months?principal:0});
    }
    document.getElementById('loan-s-label1').textContent='월 이자 납입금';
    document.getElementById('loan-s-monthly').textContent=fmt(ip);
    document.getElementById('loan-s-monthly-sub').textContent='만기 원금 '+fmt(principal)+' 일시상환';
  } else {
    /* ─────────────────────────────────────────────────────────
       체증식원리금상환 — 단순 현가합산법 (부동산계산기 방식)
       ▸ 이자 = 잔액 × (연금리 / 12)
       ▸ A(초회납입금) = 첫 상환달 이자  → 원금 0으로 시작
       ▸ D(월체증금)   = (P - A×Ann) / Bnn  (현가합산 역산)
             Ann = (1-(1+r)^-n) / r            (r=0 이면 n)
             Bnn = ((1-(1+r)^-n)/r - n×(1+r)^-n) / r   (r=0 이면 n(n-1)/2)
       ▸ m회차 PMT = A + (m-1)×D
       ▸ 원금 음수 방지: PMT = max(PMT, 이자) · 원금은 잔액을 넘지 않음
       ▸ 마지막 회차: 잔여원금 전액 + 이자
       ▸ 거치기간: 이자만 납부, 이후 잔액 기준으로 재계산
    ──────────────────────────────────────────────────────────── */

    const graceMo_g = Math.max(parseInt(document.getElementById('loan-grace')?.value,10)||0,0);
    const repayMo_g = months - graceMo_g;
    if (repayMo_g < 1) { loanClear('거치기간이 대출 기간보다 짧아야 합니다'); return; }

    /* ── 현가합산 계수 ── */
    function calcAnnBnn(n_mo, r) {
      if (r <= 0) return { Ann: n_mo, Bnn: n_mo * (n_mo - 1) / 2 };
      const v   = Math.pow(1+r, -n_mo);
      const Ann = (1 - v) / r;
      const Bnn = (Ann - n_mo * v) / r;
      return { Ann, Bnn };
    }

    /* ── 거치기간 스케줄 ── */
    let balG = principal;
    for (let m = 0; m < graceMo_g; m++) {
      const ig = Math.round(balG * rateM);
      schedule.push({ payment:ig, principal:0, interest:ig, balance:balG, grace:true });
    }

    /* ── A, D 계산 ── */
    const { Ann, Bnn } = calcAnnBnn(repayMo_g, rateM);
    const A_g = Math.round(balG * rateM);   /* 첫 상환달 이자 → 원금 0 */
    const D_g = Bnn > 0 ? (balG - A_g * Ann) / Bnn : 0;

    /* ── 상환 스케줄 ── */
    for (let m = 1; m <= repayMo_g; m++) {
      const ig     = Math.round(balG * rateM);
      const isLast = (m === repayMo_g);
      let pmt_g, pp_g;
      if (isLast) {
        pp_g  = balG;
        pmt_g = pp_g + ig;
      } else {
        const raw = Math.round(A_g + (m-1) * D_g);
        pp_g  = Math.min(Math.max(raw, ig) - ig, balG);
        pmt_g = pp_g + ig;
      }
      balG -= pp_g;
      schedule.push({ payment:pmt_g, principal:pp_g, interest:ig,
                      balance:balG, grace:false });
    }

    /* ── 요약 ── */
    const firstPayG = schedule.find(r => !r.grace)?.payment || 0;
    const lastPayG  = schedule[schedule.length-1].payment;
    const D_ann_g   = Math.round(D_g * 12);
    const chRate_g  = A_g > 0 ? (D_g / A_g * 100).toFixed(4) + '%' : '—';

    document.getElementById('loan-s-label1').textContent = '1회차 납입금' + (A_g > 0 ? ' (원금 0)' : '');
    document.getElementById('loan-s-monthly').textContent = fmt(firstPayG);
    document.getElementById('loan-s-monthly-sub').textContent =
      '→ ' + fmt(lastPayG) + ' (마지막) · 매월 +' + fmt(Math.round(D_g)) + ' (연 +' + fmt(D_ann_g) + ') 체증';

    const gs = document.getElementById('loan-grad-summary');
    if (gs) gs.style.display = '';
    const sG = (id,v) => { const e=document.getElementById(id); if(e) e.textContent=v; };
    sG('loan-g-first', fmt(firstPayG));
    sG('loan-g-last',  fmt(lastPayG));
    sG('loan-g-step',  '연 +' + fmt(D_ann_g));
    sG('loan-g-rate',  '체증률 ' + chRate_g);
  }
  const totPay=schedule.reduce((s,r)=>s+r.payment,0);
  const totInt=schedule.reduce((s,r)=>s+r.interest,0);
  document.getElementById('loan-s-interest').textContent=fmt(Math.round(totInt));
  document.getElementById('loan-s-interest-sub').textContent='이자율 '+((totInt/principal)*100).toFixed(1)+'%';
  document.getElementById('loan-s-total').textContent=fmt(Math.round(totPay));
  document.getElementById('loan-s-total-sub').textContent='대출금 대비 '+(totPay/principal).toFixed(2)+'배';
  /* ── 연간 테이블 ── */
  const tbody=document.getElementById('loanTableBody'); tbody.innerHTML='';
  const totalMo=schedule.length;
  const totalYears=Math.ceil(totalMo/12);
  for(let y=1;y<=totalYears;y++){
    const sl=schedule.slice((y-1)*12,y*12);
    if(!sl.length) break;
    const yP=sl.reduce((s,r)=>s+r.payment,0);
    const yPr=sl.reduce((s,r)=>s+r.principal,0);
    const yI=sl.reduce((s,r)=>s+r.interest,0);
    const yB=sl[sl.length-1].balance;
    const isGraceOnly=sl.every(r=>r.grace);
    const tr=document.createElement('tr'); if(y===totalYears)tr.classList.add('cagr-highlight');
    const labelSuffix=isGraceOnly?' <span style="font-size:9px;color:var(--text3);">(거치)</span>':'';
    tr.innerHTML=`<td>${y}년차${labelSuffix}</td><td>${fmt(Math.round(yP))}</td><td>${fmt(Math.round(yPr))}</td><td style="color:#f04452;">${fmt(Math.round(yI))}</td><td>${fmt(Math.round(yB))}</td>`;
    tbody.appendChild(tr);
  }
  /* ── 월간 테이블 (현재 뷰가 월간이면 즉시 렌더) ── */
  window._loanSchedule = schedule;
  window._loanTotalYears = totalYears;
  if(document.getElementById('loan-monthly-view')?.style.display !== 'none'){
    renderLoanMonthly();
  }
}

let _loanView = 'annual';
function setLoanView(view, btn) {
  _loanView = view;
  ['annual','monthly'].forEach(v => {
    document.getElementById('loan-view-'+v).classList.toggle('active', v===view);
  });
  document.getElementById('loan-annual-view').style.display  = view==='annual'  ? '' : 'none';
  document.getElementById('loan-monthly-view').style.display = view==='monthly' ? '' : 'none';
  /* 카드 타이틀 변경 */
  const titleEl = document.getElementById('loan-detail-title');
  if(titleEl) titleEl.textContent = view==='annual' ? '연간 납입 내역' : '월간 납입 내역';
  /* 월간 전환 시 버튼 텍스트 리셋 */
  const expandBtn = document.getElementById('btn-expand-loan');
  if(expandBtn) expandBtn.textContent = '▶ 전체 펼치기';
  if(view === 'monthly') renderLoanMonthly();
}

function renderLoanMonthly() {
  const tbody = document.getElementById('loanMonthlyBody');
  if(!tbody) return;
  saveOpenYears(tbody);
  const schedule   = window._loanSchedule || [];
  const totalYears = window._loanTotalYears || 0;
  tbody.innerHTML = '';

  for(let y=1; y<=totalYears; y++){
    const sl = schedule.slice((y-1)*12, y*12);
    if(!sl.length) break;
    const isGraceOnly = sl.every(r=>r.grace);
    /* 연차 헤더 행 */
    const hdrTr = insertYearAccordionRow(tbody, y, 5);
    if(isGraceOnly){
      const td = hdrTr.querySelector('td');
      if(td) td.innerHTML += ' <span style="font-size:9px;color:var(--text3);">(거치)</span>';
    }
    sl.forEach((r, i) => {
      const tr = document.createElement('tr');
      tr.dataset.yrRow = y;
      tr.style.display = 'none'; /* 기본 접힘 */
      if(y === totalYears && i === sl.length-1) tr.classList.add('cagr-highlight');
      const ppColor = r.principal < 0 ? 'color:#f04452;' : '';
      tr.innerHTML = `
        <td style="color:var(--text3);">${i+1}월</td>
        <td>${fmt(r.payment)}</td>
        <td style="${ppColor}">${fmt(r.principal)}</td>
        <td style="color:#f04452;">${fmt(r.interest)}</td>
        <td>${fmt(r.balance)}</td>`;
      tbody.appendChild(tr);
    });
  }
  restoreOpenYears(tbody);
}

/* ═══════════════════════════════════════
   [US-INDEX] 제너릭 지수 조회 시스템 — 미국 6종 + 아시아 11종 (INDEX_CONFIG 에 추가하면 페이지만 만들면 됨)
═══════════════════════════════════════ */
const INDEX_CONFIG = {
  nasdaq:   { name:'나스닥 종합', ticker:'%5EIXIC', baseDate:'1971-02-08', baseVal:100,   defaultVal:18000, minP:1000,  maxP:100000 },
  nasdaq100:{ name:'나스닥 100',  ticker:'%5ENDX',  baseDate:'1985-01-31', baseVal:250,   defaultVal:22000, minP:1000,  maxP:200000 },
  dowjones: { name:'다우존스',    ticker:'%5EDJI',  baseDate:'1896-05-26', baseVal:40.94, defaultVal:42000, minP:100,   maxP:500000 },
  sp500:    { name:'S&P 500',    ticker:'%5EGSPC', baseDate:'1928-01-03', baseVal:17.66, defaultVal:5800,  minP:100,   maxP:50000  },
  sox:      { name:'필라델피아 반도체', ticker:'%5ESOX', baseDate:'1993-12-01', baseVal:200, defaultVal:null, minP:50, maxP:200000 },
  /* 기준일·기준값 미확인 → baseVal:null — '전체 기간'은 data/history.json(^DJUSSC)의 첫 데이터부터 계산
     과거값은 Actions가 CNBC 주봉(2000.02~)으로 수집 (야후는 현재가만 제공) */
  djsemi:   { name:'다우존스 미국 반도체', ticker:'%5EDJUSSC', baseDate:null, baseVal:null, defaultVal:null, minP:50, maxP:2000000, histSrc:'CNBC' },
  /* ── 아시아 (일본·중국·홍콩·대만) — 현재가·과거 주간 종가는 data/*.json (Actions: 야후 → EastMoney → CNBC)
     since: 지수 값이 처음 존재하는 날 (그보다 앞선 '최근 N년' 버튼은 비활성) · period: 처음 선택된 기간
     taiex: 기준은 '1966년 연평균 = 100' → 연중 가운데(7월 1일)를 기준일로 계산 */
  n225:    { name:'닛케이 225', ticker:'%5EN225', baseDate:'1949-05-16', baseVal:176.21, defaultVal:null, minP:1000, maxP:1000000, histSrc:'Yahoo' },
  topix:   { name:'TOPIX', ticker:'%5ETOPX', baseDate:'1968-01-04', baseVal:100, defaultVal:null, minP:100, maxP:100000, histSrc:'CNBC' },
  sse:     { name:'상해종합지수', ticker:'000001.SS', baseDate:'1990-12-19', baseVal:100, defaultVal:null, minP:100, maxP:100000, histSrc:'Yahoo·EastMoney' },
  csi300:  { name:'CSI 300', ticker:'000300.SS', baseDate:'2004-12-31', baseVal:1000, defaultVal:null, minP:300, maxP:100000, histSrc:'EastMoney' },
  szse:    { name:'선전성분지수', ticker:'399001.SZ', baseDate:'1994-07-20', baseVal:1000, defaultVal:null, minP:500, maxP:200000, histSrc:'Yahoo·EastMoney' },
  chinext: { name:'창업판지수', ticker:'399006.SZ', baseDate:'2010-05-31', baseVal:1000, defaultVal:null, minP:300, maxP:100000, histSrc:'EastMoney' },
  star50:  { name:'과창판50', ticker:'000688.SS', baseDate:'2019-12-31', baseVal:1000, defaultVal:null, minP:200, maxP:100000, histSrc:'EastMoney', period:5 },
  hsi:     { name:'항셍지수', ticker:'%5EHSI', baseDate:'1964-07-31', baseVal:100, defaultVal:null, minP:1000, maxP:500000, histSrc:'Yahoo' },
  hscei:   { name:'홍콩H지수', ticker:'%5EHSCE', baseDate:'2000-01-03', baseVal:2000, defaultVal:null, minP:1000, maxP:200000, histSrc:'Yahoo', since:'1994-08-08' },
  hstech:  { name:'항셍테크지수', ticker:'HSTECH.HK', baseDate:'2014-12-31', baseVal:3000, defaultVal:null, minP:500, maxP:200000, histSrc:'EastMoney', period:10 },
  taiex:   { name:'대만 가권지수', ticker:'%5ETWII', baseDate:'1966-07-01', baseVal:100, defaultVal:null, minP:1000, maxP:1000000, histSrc:'Yahoo·EastMoney', baseLabel:'1966년 평균', baseLabelEn:'1966 avg.' },
};

/* 해외 지수 연간 fallback 테이블 (연초 기준) */
const OVERSEAS_HIST = {
  nasdaq:   {1990:455,1995:1052,2000:4069,2005:2175,2010:2326,2015:4777,2020:8973,2021:12888,2022:15645,2023:10939,2024:15011,2025:19310},
  nasdaq100:{1990:455,1995:1052,2000:4069,2005:1660,2010:1860,2015:4236,2020:8733,2021:12667,2022:16320,2023:11630,2024:16543,2025:20940},
  dowjones: {1990:2810,1995:3838,2000:11497,2005:10783,2010:10428,2015:17832,2020:28538,2021:30606,2022:36338,2023:33136,2024:37690,2025:42732},
  sp500:    {1990:353,1995:459,2000:1469,2005:1248,2010:1115,2015:2059,2020:3231,2021:3756,2022:4797,2023:3853,2024:4770,2025:5882},
  sox:      {},   /* 내장값 없음 — 과거값은 data/history.json(^SOX)에서만 사용 */
  djsemi:   {},   /* 내장값 없음 — 과거값은 data/history.json(^DJUSSC)에서만 사용 */
};

const _indexCache    = {};
const _indexFetching = {};
/* 해외 지수 기간 상태 */
const _indexPeriod   = {};
Object.keys(INDEX_CONFIG).forEach(k => { _indexPeriod[k] = INDEX_CONFIG[k].period || 15; });
const _indexSrc      = {};   /* 현재가를 받아 온 곳 (data/market.json 의 src) */
const _indexHistCache = {}; /* {id_years: {price, date}} */

function calcIndexRates(id, price, asOf, periodYears, startVal, histDateStr) {
  const cfg      = INDEX_CONFIG[id];
  const baseDate = new Date(cfg.baseDate);
  const now      = asOf || new Date();
  periodYears    = periodYears || 0;

  let sv, startDate, periodLabel;
  if (periodYears === 0) {
    /* 기준값이 없는 지수는 보유 데이터의 첫 날짜·값(startVal, histDateStr)부터 계산 */
    const fromData  = cfg.baseVal == null;
    if (fromData && !(startVal > 0 && histDateStr)) return;
    sv          = fromData ? startVal : cfg.baseVal;
    startDate   = fromData ? new Date(histDateStr) : baseDate;
    const totalMs   = now - startDate;
    const totalYrs  = Math.floor(totalMs / (1000*60*60*24*365.25));
    const totalMons = Math.floor((totalMs / (1000*60*60*24*365.25) - totalYrs) * 12);
    const bdLabel   = fromData ? histDateStr.replace(/-/g,'.') : (cfg.baseLabel || cfg.baseDate.replace(/-/g,'.'));
    const bdLabelEn = fromData ? bdLabel : (cfg.baseLabelEn || bdLabel);
    periodLabel = L((fromData ? '데이터 시작 이후 전체 (' : '기준일 이후 전체 (') + bdLabel + ' ~ 현재, ' + totalYrs + '년 ' + totalMons + '개월)',
                    (fromData ? 'All data (' : 'All time (') + bdLabelEn + ' – today, ' + totalYrs + 'y ' + totalMons + 'm)');
  } else {
    const sy = now.getFullYear() - periodYears;
    const ck = id + '_' + periodYears;
    sv = startVal || (OVERSEAS_HIST[id] && OVERSEAS_HIST[id][sy]) || null;
    if (!sv) return;
    startDate = new Date(sy, now.getMonth(), now.getDate());
    const cachedDate = histDateStr || (_indexHistCache[ck] && _indexHistCache[ck].date);
    const hsrc = (_indexHistCache[ck] && _indexHistCache[ck].src) || cfg.histSrc || 'Yahoo';   /* 실제로 받은 과거 값의 출처 */
    if (cachedDate) {
      periodLabel = L('최근 ' + periodYears + '년 (' + cachedDate + ' ~ 현재) (' + hsrc + ')', 'Last ' + periodYears + ' years (' + cachedDate + ' – today) (' + hsrc + ')');
    } else {
      periodLabel = L('최근 ' + periodYears + '년 (' + sy + '년 추정 ~ 현재) (내장)', 'Last ' + periodYears + ' years (' + sy + ' estimate – today) (built-in)');
    }
  }
  if (!sv || sv <= 0) return;

  const diffYrs = (now - startDate) / (1000*60*60*24*365.25);
  if (diffYrs <= 0.1) return;

  const cagr    = Math.pow(price / sv, 1 / diffYrs) - 1;
  const monthly = Math.pow(1 + cagr, 1/12) - 1;
  const daily   = Math.pow(1 + cagr, 1/365.25) - 1;
  const cp      = (cagr*100).toFixed(2);
  const startFmt = sv.toLocaleString('ko-KR', {maximumFractionDigits:2});
  const curFmt   = price.toLocaleString('ko-KR', {maximumFractionDigits:2});

  const annEl = document.getElementById(id+'-annual');
  const monEl = document.getElementById(id+'-monthly');
  const dayEl = document.getElementById(id+'-daily');
  if (annEl) { annEl.textContent = (cagr*100).toFixed(4)+'%'; annEl.style.color='var(--accent)'; }
  if (monEl) { monEl.textContent = (monthly*100).toFixed(4)+'%'; monEl.style.color='var(--accent2)'; }
  if (dayEl) { dayEl.textContent = (daily*100).toFixed(6)+'%'; dayEl.style.color='#fe9800'; }

  const as = document.getElementById(id+'-annual-sub');
  const ms = document.getElementById(id+'-monthly-sub');
  const ds = document.getElementById(id+'-daily-sub');
  if (as) as.textContent = periodLabel + ' | ' + startFmt + ' → ' + curFmt;
  if (ms) ms.textContent = L('연 '+cp+'% → 월 환산', cp+'% a year → per month');
  if (ds) ds.textContent = L('연 '+cp+'% → 일 환산', cp+'% a year → per day');

  [10,20,30,40].forEach(y => {
    const el = document.getElementById(id+'-sim-'+y);
    if (el) el.textContent = fmtWon(Math.round(1e8*Math.pow(1+cagr,y)));
  });
}

/* 기준값이 없는 지수의 '전체 기간' 시작점: data/history.json 의 첫 데이터 → 없으면 Yahoo 월봉 첫 값
   결과는 _indexHistCache[id+'_0'] = {price, date:'YYYY-MM-DD'} 로 저장 */
async function indexFirstPoint(id) {
  const ck = id + '_0';
  if (_indexHistCache[ck]) return _indexHistCache[ck];
  const sym = decodeURIComponent(INDEX_CONFIG[id].ticker);
  const ymd = t => { const d = new Date(t); return d.getUTCFullYear() + '-' + String(d.getUTCMonth()+1).padStart(2,'0') + '-' + String(d.getUTCDate()).padStart(2,'0'); };
  let fp = null;
  try {
    const h = window.mdLoad ? await window.mdLoad('history.json') : null;
    const s = h && h.series && h.series[sym];
    if (s && s.length && s[0][1] > 0) fp = { price: s[0][1], date: ymd(s[0][0] * 86400000) };
  } catch (e) {}
  if (!fp) {
    try {
      const r = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/' + INDEX_CONFIG[id].ticker + '?interval=1mo&range=max');
      const j = await r.json(), res = j.chart.result[0], ts = res.timestamp || [], cl = res.indicators.quote[0].close || [];
      for (let i = 0; i < ts.length; i++) if (cl[i] > 0) { fp = { price: cl[i], date: ymd(ts[i] * 1000) }; break; }
    } catch (e) {}
  }
  if (fp) _indexHistCache[ck] = fp;
  return fp;
}

/* 결과 칸을 비우고 이유를 보여 줌 (숫자를 지어내지 않음) */
function indexNoData(id, msg, msgEn) {
  [id+'-annual', id+'-monthly', id+'-daily', id+'-sim-10', id+'-sim-20', id+'-sim-30', id+'-sim-40'].forEach(k => { const el = document.getElementById(k); if (el) el.textContent = '—'; });
  const as = document.getElementById(id+'-annual-sub'), ms = document.getElementById(id+'-monthly-sub'), ds = document.getElementById(id+'-daily-sub');
  if (as) as.textContent = L(msg, msgEn || msg);
  if (ms) ms.textContent = L('CAGR의 월 환산', 'CAGR converted to a monthly rate');
  if (ds) ds.textContent = L('CAGR의 일 환산', 'CAGR converted to a daily rate');
}

/* 지수가 생기기 전으로 거슬러 가는 '최근 N년' 버튼은 끔 (since 또는 기준일 기준, 날짜가 지나면 자동으로 켜짐) */
function indexPeriodGuard(id) {
  const cfg = INDEX_CONFIG[id], since = cfg.since || cfg.baseDate;
  if (!since) return;
  const now = new Date(), s0 = new Date(since);
  document.querySelectorAll('#' + id + '-period-tabs .period-btn').forEach(b => {
    const m = /setIndexPeriod\('[^']+',(\d+)/.exec(b.getAttribute('onclick') || ''), y = m ? +m[1] : 0;
    const off = y > 0 && new Date(now.getFullYear() - y, now.getMonth(), now.getDate()) < s0;
    b.disabled = off;
    b.title = off ? L('이 지수는 ' + since.slice(0, 4) + '년부터 있어 계산할 수 없습니다', 'This index starts in ' + since.slice(0, 4)) : '';
  });
}

/* 기간 선택 버튼 클릭 */
async function setIndexPeriod(id, years, btn) {
  if (btn && btn.disabled) return;
  _indexPeriod[id] = years;
  const tabsEl = document.getElementById(id+'-period-tabs');
  if (tabsEl) tabsEl.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');

  const curVal = _indexCache[id] || INDEX_CONFIG[id].defaultVal;
  if (!curVal) return;   /* 현재 지수 미조회 + 기본값 없음 */
  if (years === 0) {
    if (INDEX_CONFIG[id].baseVal == null) {          /* 기준값 없는 지수: 데이터 첫 값 사용 */
      const fp = await indexFirstPoint(id);
      if (fp) calcIndexRates(id, curVal, new Date(), 0, fp.price, fp.date);
      return;
    }
    calcIndexRates(id, curVal, new Date(), 0, null, null);
    return;
  }

  const ck  = id + '_' + years;
  const now = new Date();
  const sy  = now.getFullYear() - years;

  let cached = _indexHistCache[ck];
  /* 기준값 없는 지수: 보유 데이터보다 긴 기간이면 숫자를 지어내지 않고 안내 */
  if (!cached && INDEX_CONFIG[id].baseVal == null) {
    const fp = await indexFirstPoint(id);
    const target = new Date(sy, now.getMonth(), now.getDate());
    if (fp && new Date(fp.date) - target > 31 * 86400000) {
      [id+'-annual', id+'-monthly', id+'-daily', id+'-sim-10', id+'-sim-20', id+'-sim-30', id+'-sim-40'].forEach(k => { const el = document.getElementById(k); if (el) el.textContent = '—'; });
      const as = document.getElementById(id+'-annual-sub');
      if (as) as.textContent = '데이터가 ' + fp.date.replace(/-/g,'.') + '부터 있어 최근 ' + years + '년은 계산할 수 없습니다 — [전체 기간]을 이용하세요';
      const ms = document.getElementById(id+'-monthly-sub'), ds = document.getElementById(id+'-daily-sub');
      if (ms) ms.textContent = 'CAGR의 월 환산'; if (ds) ds.textContent = 'CAGR의 일 환산';
      return;
    }
  }
  if (!cached) {
    const origText = btn ? btn.textContent : '';
    if (btn) btn.textContent = '⏳';
    /* Yahoo Finance로 N년 전 일봉 조회 */
    const cfg = INDEX_CONFIG[id];
    const targetDt = new Date(sy, now.getMonth(), now.getDate());
    const result   = await fetchHistoricalPrice(cfg.ticker, targetDt);
    if (btn) btn.textContent = origText;
    if (result && result.price > 0) {
      cached = result;
      _indexHistCache[ck] = cached;
    }
  }

  const sv   = cached ? cached.price : (OVERSEAS_HIST[id] && OVERSEAS_HIST[id][sy]) || null;
  const hd   = cached ? cached.date  : null;
  if (sv) calcIndexRates(id, curVal, now, years, sv, hd);
  else indexNoData(id, sy + '년 지수를 불러오지 못했습니다 — 잠시 후 다시 눌러 주세요', 'Could not load the ' + sy + ' index level — please try again shortly');
}

function applyIndexValue(id, price, src) {
  const cfg = INDEX_CONFIG[id];
  price = parseFloat(String(price).replace(/,/g,''));
  if (!price || price < cfg.minP || price > cfg.maxP) return false;
  _indexCache[id] = price;
  document.getElementById(id+'-current-val').textContent =
    price.toLocaleString('ko-KR', {minimumFractionDigits:2, maximumFractionDigits:2});
  const now    = new Date();
  const nowStr = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0') + '-'
    + String(now.getDate()).padStart(2,'0') + ' ' + now.toTimeString().slice(0,8);
  document.getElementById(id+'-date-label').textContent    = L(nowStr + ' 기준', nowStr);
  document.getElementById(id+'-source-label').textContent  = L('출처: ', 'Source: ') + src;
  const py  = _indexPeriod[id] || 0;
  const ck  = id + '_' + py;
  const hc  = _indexHistCache[ck];
  const sv2 = py === 0 ? (hc ? hc.price : null) : (hc ? hc.price : (OVERSEAS_HIST[id] && OVERSEAS_HIST[id][(now.getFullYear()-py)]) || null);
  const hd2 = hc ? hc.date : null;
  calcIndexRates(id, price, now, py, sv2, hd2);
  return true;
}

async function tryYahooIndex(id) {
  const cfg    = INDEX_CONFIG[id];
  const yfUrl  = 'https://query1.finance.yahoo.com/v8/finance/chart/' + cfg.ticker + '?interval=1d&range=3d';
  const proxies = [
    'https://corsproxy.io/?' + encodeURIComponent(yfUrl),
    'https://api.allorigins.win/raw?url=' + encodeURIComponent(yfUrl),
    'https://thingproxy.freeboard.io/fetch/' + yfUrl,
    yfUrl,
  ];
  for (const url of proxies) {
    try {
      const ctrl = new AbortController();
      const tid  = setTimeout(() => ctrl.abort(), 8000);
      let resp;
      try { resp = await fetch(url, { signal: ctrl.signal, cache: 'no-cache' }); }
      finally { clearTimeout(tid); }
      if (!resp || !resp.ok) continue;
      const txt  = await resp.text();
      let json;
      try { json = JSON.parse(txt); } catch { continue; }
      if (json.contents) { try { json = JSON.parse(json.contents); } catch { continue; } }
      const r = json?.chart?.result?.[0];
      if (!r) continue;
      const m = r.meta;
      const cls = r.indicators?.quote?.[0]?.close;
      const p   = m.regularMarketPrice || m.previousClose || (cls ? cls.filter(Boolean).slice(-1)[0] : null);
      if (p && p >= cfg.minP) { _indexSrc[id] = m.dataSource || 'Yahoo Finance'; return parseFloat(p); }
    } catch {}
  }
  return null;
}

async function fetchIndex(id) {
  if (_indexFetching[id]) return;
  _indexFetching[id] = true;
  const btn  = document.getElementById(id+'-refresh-btn');
  const icon = document.getElementById(id+'-refresh-icon');
  const load = document.getElementById(id+'-loading');
  btn.disabled = true; icon.textContent = '⏳'; load.style.display = 'block';
  document.getElementById(id+'-date-label').textContent   = '조회 중...';
  document.getElementById(id+'-source-label').textContent = '';
  indexPeriodGuard(id);
  try {
    const p = await tryYahooIndex(id);
    if (p && applyIndexValue(id, p, _indexSrc[id] || 'Yahoo Finance')) return;
    /* 대체: data/history.json 에 저장된 마지막 주간 종가 (현재가 수집이 모두 실패했을 때) */
    try {
      const h = window.mdLoad ? await window.mdLoad('history.json') : null;
      const s = h && h.series && h.series[decodeURIComponent(INDEX_CONFIG[id].ticker)];
      const last = s && s.length ? s[s.length - 1] : null;   /* 3주 넘게 지난 값은 쓰지 않음 */
      if (last && Date.now() / 86400000 - last[0] < 21 && applyIndexValue(id, last[1], '저장된 주간 종가 (실시간 시세 조회 실패)')) {
        const d = new Date(last[0] * 86400000);
        document.getElementById(id+'-date-label').textContent =
          d.getUTCFullYear() + '-' + String(d.getUTCMonth()+1).padStart(2,'0') + '-' + String(d.getUTCDate()).padStart(2,'0') + ' 종가 기준';
        return;
      }
    } catch (e) {}
    // 실패 — 이전값 유지
    const prev = _indexCache[id] || INDEX_CONFIG[id].defaultVal;
    const now  = new Date();
    if (!prev) {   /* 기본값 없는 지수: 숫자를 지어내지 않음 */
      document.getElementById(id+'-date-label').textContent   = '데이터 없음';
      document.getElementById(id+'-source-label').textContent = '⚠ 조회 실패 — 잠시 후 [지수 갱신]을 눌러주세요';
      return;
    }
    const ns   = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0') + '-'
      + String(now.getDate()).padStart(2,'0') + ' ' + now.toTimeString().slice(0,8);
    document.getElementById(id+'-date-label').textContent    = ns + ' 기준 (이전값 유지)';
    document.getElementById(id+'-source-label').textContent  = '⚠ 조회 실패 — 직전 지수 ' + prev.toLocaleString('ko-KR') + ' 유지';
    calcIndexRates(id, prev, now);
  } finally {
    btn.disabled = false; icon.textContent = '↺'; load.style.display = 'none';
    _indexFetching[id] = false;
  }
}

/* ═══════════════════════════════════════
   [KOSPI200] KOSPI 200 성장률
   기준: 1990-01-03 / 지수 100
   티커: ^KS200 (Yahoo Finance)
═══════════════════════════════════════ */
const K200_BASE_DATE = new Date('1990-01-03');
const K200_BASE_VAL  = 100;
let   _lastKospi200  = 350;
let   _isFetching200 = false;

function applyK200Value(price, src) {
  price = parseFloat(String(price).replace(/,/g,''));
  if (!price || isNaN(price) || price < 50 || price > 10000) return false;
  _lastKospi200 = price;
  document.getElementById('k200-current-val').textContent =
    price.toLocaleString('ko-KR', {minimumFractionDigits:2, maximumFractionDigits:2});
  const now    = new Date();
  const nowStr = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0') + '-'
    + String(now.getDate()).padStart(2,'0') + ' ' + now.toTimeString().slice(0,8);
  document.getElementById('k200-date-label').textContent    = nowStr + ' 기준';
  document.getElementById('k200-source-label').textContent  = '출처: ' + src;
  calcKospi200Rates(price, now);
  return true;
}

function calcKospi200Rates(currentVal, asOfDate) {
  _kospiLastVal.k200 = currentVal;
  const py = _kospiPeriod.k200 || 0;
  const sv = py === 0 ? null : (_histCache['k200_'+py] || getFallbackVal('k200', (asOfDate||new Date()).getFullYear()-py));
  const hd = _histCache['k200_'+py+'_date'] || null;
  calcIndexRatesByPeriod('k200', currentVal, asOfDate, py, sv, hd);
}

async function tryYahooK200() {
  const yfUrl = 'https://query1.finance.yahoo.com/v8/finance/chart/%5EKS200?interval=1d&range=3d';
  const enc   = encodeURIComponent(yfUrl);
  const proxies = [
    'https://corsproxy.io/?' + enc,
    'https://api.allorigins.win/raw?url=' + enc,
    'https://thingproxy.freeboard.io/fetch/' + yfUrl,
    yfUrl,
  ];
  for (const url of proxies) {
    try {
      const ctrl = new AbortController();
      const tid  = setTimeout(() => ctrl.abort(), 8000);
      let resp;
      try { resp = await fetch(url, { signal: ctrl.signal, cache: 'no-cache' }); }
      finally { clearTimeout(tid); }
      if (!resp || !resp.ok) continue;
      const txt  = await resp.text();
      let json;
      try { json = JSON.parse(txt); } catch { continue; }
      if (json.contents) { try { json = JSON.parse(json.contents); } catch { continue; } }
      const r = json?.chart?.result?.[0];
      if (!r) continue;
      const m = r.meta;
      const closes = r.indicators?.quote?.[0]?.close;
      const price  = m.regularMarketPrice || m.previousClose
                  || (closes ? closes.filter(Boolean).slice(-1)[0] : null);
      if (price && price >= 50) return parseFloat(price);
    } catch {}
  }
  return null;
}

async function fetchKospi200() {
  if (_isFetching200) return;
  _isFetching200 = true;
  const btn  = document.getElementById('k200-refresh-btn');
  const icon = document.getElementById('k200-refresh-icon');
  const load = document.getElementById('k200-loading');
  btn.disabled = true; icon.textContent = '⏳'; load.style.display = 'block';
  document.getElementById('k200-date-label').textContent   = '조회 중...';
  document.getElementById('k200-source-label').textContent = '';
  try {
    
    const price = await tryYahooK200();
    if (price && applyK200Value(price, 'Yahoo Finance (^KS200)')) return;
    /* 실패 — 이전값 유지 */
    const now = new Date();
    const nowStr = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0') + '-'
      + String(now.getDate()).padStart(2,'0') + ' ' + now.toTimeString().slice(0,8);
    document.getElementById('k200-date-label').textContent    = nowStr + ' 기준 (이전값 유지)';
    document.getElementById('k200-source-label').textContent  = '⚠ 조회 실패 — 직전 지수 ' + _lastKospi200.toLocaleString('ko-KR') + ' 유지';
    calcKospi200Rates(_lastKospi200, now);
  } finally {
    btn.disabled = false; icon.textContent = '↺'; load.style.display = 'none'; _isFetching200 = false;
  }
}

/* ════════════════════════════════════════
   [CAGR] CAGR 계산기
════════════════════════════════════════ */
let cagrChart2    = null;
let cagrChartTab2 = 'value';
let _cagrCache    = null;
const cagrUnit    = { start: 'won', end: 'won' };
let cagrPeriodMode = 'years'; // 'years' | 'date'

function fmtC(n) {
  if (SITE_EN) return wonEn(n);
  if (Math.abs(n) >= 1e12) return (n/1e12).toFixed(2) + '조원';
  if (Math.abs(n) >= 1e8)  return (n/1e8).toFixed(2)  + '억원';
  if (Math.abs(n) >= 1e4)  return Math.round(n/1e4).toLocaleString() + '만원';
  return Math.round(n).toLocaleString('ko-KR') + '원';
}

/* ── CAGR 금액 단위 탭 ── */
function getCagrWon(id) {
  const raw = (document.getElementById('cagr-' + id).value || '0').replace(/,/g,'');
  const n   = parseFloat(raw) || 0;
  const u   = cagrUnit[id];
  return n * (u === 'eok' ? 1e8 : u === 'man' ? 1e4 : 1);
}
function setCagrUnit(id, unit, btn) {
  const won  = getCagrWon(id);
  cagrUnit[id] = unit;
  const disp = won / (unit === 'eok' ? 1e8 : unit === 'man' ? 1e4 : 1);
  document.getElementById('cagr-' + id).value = commaFmt(
    unit === 'won' ? Math.round(disp) : parseFloat(disp.toFixed(4))
  );
  document.querySelectorAll('[data-field="cagr-' + id + '"]')
    .forEach(b => b.classList.toggle('active', b === btn));
  calcCAGR();
}
function onCagrAmtInput(id) {
  const el = document.getElementById('cagr-' + id);
  const cv = el.selectionStart;
  const ov = el.value;
  const fmt = typingNumFmt(ov);
  el.value = fmt;
  try { el.setSelectionRange(Math.max(0, cv + fmt.length - ov.length), Math.max(0, cv + fmt.length - ov.length)); } catch{}
  calcCAGR();
}
function onCagrAmtBlur(id) {
  const won  = getCagrWon(id);
  const unit = cagrUnit[id];
  const disp = won / (unit === 'eok' ? 1e8 : unit === 'man' ? 1e4 : 1);
  document.getElementById('cagr-' + id).value = commaFmt(
    unit === 'won' ? Math.round(disp) : parseFloat(disp.toFixed(4))
  );
}

/* ── CAGR 기간 모드 (년수/날짜) ── */
function setCagrPeriodMode(mode, btn) {
  cagrPeriodMode = mode;
  document.getElementById('cagr-period-years-btn').classList.toggle('active', mode === 'years');
  document.getElementById('cagr-period-date-btn').classList.toggle('active', mode === 'date');
  document.getElementById('cagr-period-years-panel').style.display = mode === 'years' ? '' : 'none';
  document.getElementById('cagr-period-date-panel').style.display  = mode === 'date'  ? '' : 'none';
  if (mode === 'date') {
    const today = new Date().toISOString().slice(0,10);
    if (!document.getElementById('cagr-date-end').value) {
      document.getElementById('cagr-date-end').value = today;
    }
    calcCAGRFromDates();
  } else {
    calcCAGR();
  }
}
function calcCAGRFromDates() {
  const s = document.getElementById('cagr-date-start').value;
  const e = document.getElementById('cagr-date-end').value;
  const lbl = document.getElementById('cagr-date-period-label');
  if (!s || !e) { if (lbl) lbl.textContent = L('기간: 시작일과 종료일을 입력하세요', 'Period: enter a start and end date'); cagrClear(L('기간을 확인하세요', 'Check the period')); return; }
  const ms   = new Date(e) - new Date(s);
  const yrs  = ms / (1000 * 60 * 60 * 24 * 365.25);
  if (!(yrs > 0)) { if (lbl) lbl.textContent = L('기간: 종료일은 시작일보다 뒤여야 합니다', 'Period: the end date must be after the start date'); cagrClear(L('기간을 확인하세요', 'Check the period')); const re = document.getElementById('cagr-rev-end'); if (re) re.textContent = '—'; return; }
  document.getElementById('cagr-years').value = parseFloat(yrs.toFixed(4));   /* 계산 정밀도 유지 (표시는 소수 2자리) */
  document.getElementById('cagr-years-sl').value = Math.min(Math.round(yrs), 50);
  document.getElementById('cagr-date-period-label').textContent =
    L('기간: ' + yrs.toFixed(2) + '년 (' + Math.round(ms/(1000*60*60*24)) + '일)', 'Period: ' + yrs.toFixed(2) + ' years (' + Math.round(ms/(1000*60*60*24)) + ' days)');
  calcCAGR();
}

function setCagrChartTab(tab, btn) {
  cagrChartTab2 = tab;
  document.querySelectorAll('#cagr-ctab-value, #cagr-ctab-return').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  if (_cagrCache) renderCagrChart(_cagrCache);
}

/* 결과 화면을 비움 (입력이 잘못됐을 때 이전 결과가 남지 않도록) */
function cagrClear(msg) {
  ['cagr-result','cagr-monthly-rate','cagr-daily-rate','cagr-total-return','cagr-total-profit','cagr-double','cagr-ten'].forEach(id => {
    const e = document.getElementById(id); if (e) { e.textContent = '—'; e.style.color = ''; }
  });
  const sub = document.getElementById('cagr-result-sub'); if (sub) sub.textContent = msg || L('입력값을 확인하세요', 'Check your inputs');
  const tb = document.getElementById('cagrTableBody'); if (tb) tb.innerHTML = '';
  _cagrCache = null;
  if (cagrChart2) { cagrChart2.destroy(); cagrChart2 = null; }
}

function calcCAGR() {
  const start = getCagrWon('start');
  const end   = getCagrWon('end');
  const years  = parseFloat(document.getElementById('cagr-years').value);
  /* 슬라이더 동기화 */
  if (cagrPeriodMode === 'years' && !isNaN(years)) document.getElementById('cagr-years-sl').value = Math.min(Math.max(Math.round(years), 1), 50);

  if (!(start > 0)) { cagrClear(L('초기 금액을 입력하세요', 'Enter the starting value')); calcCAGRReverse(); return; }
  if (!(end > 0))   { cagrClear(L('최종 금액을 입력하세요', 'Enter the ending value')); calcCAGRReverse(); return; }
  if (!(years > 0)) { cagrClear(L('투자 기간을 확인하세요 (0보다 커야 함)', 'Check the period (must be above 0)')); calcCAGRReverse(); return; }
  if (years > 200)  { cagrClear(L('투자 기간은 200년 이하로 입력하세요', 'Enter a period of 200 years or less')); calcCAGRReverse(); return; }

  const startWan = start / 10000;
  const endWan   = end   / 10000;
  const cagr  = Math.pow(end / start, 1 / years) - 1;
  const totalReturn = (end / start - 1) * 100;
  const totalProfit = end - start;

  /* 자산 2배/10배 도달 기간 (72/CAGR 법칙과 정확 계산) */
  const double = cagr > 0 ? Math.log(2)  / Math.log(1 + cagr) : Infinity;
  const ten    = cagr > 0 ? Math.log(10) / Math.log(1 + cagr) : Infinity;

  /* 결과 표시 */
  const cagrPct = (cagr * 100).toFixed(2);
  const cagrEl  = document.getElementById('cagr-result');
  cagrEl.textContent = (cagr >= 0 ? '+' : '') + cagrPct + '%';
  cagrEl.style.color = cagr >= 0 ? 'var(--accent)' : '#f04452';

  document.getElementById('cagr-result-sub').textContent =
    L(years.toFixed(2) + '년 동안 ' + fmtC(start) + ' → ' + fmtC(end), fmtC(start) + ' → ' + fmtC(end) + ' over ' + years.toFixed(2) + ' years');
  document.getElementById('cagr-total-return').textContent =
    (totalReturn >= 0 ? '+' : '') + totalReturn.toFixed(2) + '%';
  document.getElementById('cagr-total-return').className =
    'cagr-metric-val ' + (totalReturn >= 0 ? 'pos' : 'neg');
  document.getElementById('cagr-total-profit').textContent =
    (totalProfit >= 0 ? '+' : '') + fmtC(totalProfit);
  document.getElementById('cagr-total-profit').className =
    'cagr-metric-val ' + (totalProfit >= 0 ? 'pos' : 'neg');
  document.getElementById('cagr-double').textContent =
    isFinite(double) ? double.toFixed(1) + L('년', ' yrs') : '—';
  document.getElementById('cagr-ten').textContent =
    isFinite(ten) ? ten.toFixed(1) + L('년', ' yrs') : '—';

  /* 월평균·일평균 성장률 */
  const monthly_r = Math.pow(1 + cagr, 1/12) - 1;
  const daily_r   = Math.pow(1 + cagr, 1/365.25) - 1;
  const mEl = document.getElementById('cagr-monthly-rate');
  const dEl = document.getElementById('cagr-daily-rate');
  if (mEl) { mEl.textContent = (monthly_r >= 0 ? '+' : '') + (monthly_r*100).toFixed(4) + '%'; mEl.style.color = monthly_r >= 0 ? 'var(--accent2)' : '#f04452'; }
  if (dEl) { dEl.textContent = (daily_r   >= 0 ? '+' : '') + (daily_r  *100).toFixed(6) + '%'; dEl.style.color = daily_r   >= 0 ? '#fe9800'        : '#f04452'; }

  /* 연도별 테이블 */
  const tbody = document.getElementById('cagrTableBody');
  tbody.innerHTML = '';
  const rows = [];
  let prev = start;
  const nRows = Math.max(1, Math.ceil(years - 0.01));      /* 날짜 모드의 몇 일 남짓한 끝자투리는 마지막 해에 합침 */
  for (let y = 1; y <= nRows; y++) {
    const last     = y === nRows;
    const t        = last ? years : y;                       /* 기간이 소수면 마지막 행은 종료 시점(예: 2.5년) */
    const val      = last ? end : start * Math.pow(1 + cagr, y);
    const profit   = val - prev;
    const cumProfit = val - start;
    const cumRet   = (val / start - 1) * 100;
    rows.push({ y, t, label: Math.abs(t - Math.round(t)) < 0.005 ? L(Math.round(t) + '년차', 'Year ' + Math.round(t)) : L(t.toFixed(2) + '년 (종료)', t.toFixed(2) + ' yrs (end)'), val, profit, cumProfit, cumRet });
    prev = val;
  }
  rows.forEach((r, i) => {
    const tr = document.createElement('tr');
    if (i === rows.length - 1) tr.classList.add('cagr-highlight');
    tr.innerHTML = `
      <td>${r.label}</td>
      <td>${fmt(Math.round(r.val))}</td>
      <td class="${r.profit>=0?'pos':'neg'}">${r.profit>=0?'+':''}${fmt(Math.round(r.profit))}</td>
      <td class="${r.cumProfit>=0?'pos':'neg'}">${r.cumProfit>=0?'+':''}${fmt(Math.round(r.cumProfit))}</td>
      <td class="${r.cumRet>=0?'pos':'neg'}">${r.cumRet>=0?'+':''}${r.cumRet.toFixed(2)}%</td>`;
    tbody.appendChild(tr);
  });

  _cagrCache = { start, end, years, cagr, rows };
  renderCagrChart(_cagrCache);
  calcCAGRReverse();
}

/* 역산
   · 필요 최종금액 = 초기 금액 × (1 + 목표 CAGR)^기간
   · 필요 기간     = ln(최종 금액 / 초기 금액) / ln(1 + 목표 CAGR)  — 입력한 최종 금액에 목표 CAGR 로 닿는 기간 */
function calcCAGRReverse() {
  const start      = getCagrWon('start');
  const end        = getCagrWon('end');
  const years      = parseFloat(document.getElementById('cagr-years').value);
  const targetRate = parseFloat(document.getElementById('cagr-target-rate').value);
  const endEl = document.getElementById('cagr-rev-end'), yrEl = document.getElementById('cagr-rev-years');
  if (isNaN(targetRate) || targetRate <= -100 || !(start > 0)) { endEl.textContent = '—'; yrEl.textContent = '—'; return; }
  const cagrR = targetRate / 100;
  endEl.textContent = years > 0 ? fmtC(Math.round(start * Math.pow(1 + cagrR, years))) : '—';
  if (!(end > 0)) { yrEl.textContent = '—'; return; }
  const g = Math.log(end / start), r = Math.log(1 + cagrR);
  let txt;
  if (Math.abs(g) < 1e-12) txt = L('0년 (이미 도달)', '0 (already there)');
  else if (r === 0 || g / r < 0) txt = L('도달 불가', 'Not reachable');                 /* 목표 CAGR 0% 이거나 방향이 반대 */
  else txt = (g / r).toFixed(1) + L('년', ' yrs');
  yrEl.textContent = txt;
}

function renderCagrChart(cache) {
  const { start, end, years, cagr, rows } = cache;
  const labels   = [L('0년차', 'Year 0'), ...rows.map(r => r.label)];
  const valData  = [start,   ...rows.map(r => Math.round(r.val))];
  const retData  = [0,       ...rows.map(r => parseFloat((r.cumRet).toFixed(2)))];

  const isDark      = true;
  const accentColor = '#3182f6';
  const blueColor   = '#3182f6';

  let datasets, yLabel;
  if (cagrChartTab2 === 'value') {
    datasets = [{
      label: L('자산 규모', 'Value'),
      data: valData,
      backgroundColor: valData.map((v,i) => i === valData.length-1 ? 'rgba(49,130,246,0.9)' : 'rgba(49,130,246,0.5)'),
      borderRadius: 5,
      borderSkipped: false,
    }];
    yLabel = v => fmtC(v, true) || fmt(v, true);
  } else {
    datasets = [{
      label: L('누적 수익률', 'Cumulative return'),
      data: retData,
      backgroundColor: retData.map((v,i) => i === retData.length-1 ? 'rgba(49,130,246,0.9)' : 'rgba(49,130,246,0.5)'),
      borderRadius: 5,
      borderSkipped: false,
    }];
    yLabel = v => v.toFixed(1) + '%';
  }

  const opts = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#202027',
        borderColor: fgA(0.1),
        borderWidth: 1,
        titleColor: '#9e9ea4',
        bodyColor: '#e4e4e5',
        padding: 12,
        callbacks: {
          label: ctx => {
            const v = ctx.parsed.y;
            return cagrChartTab2 === 'value'
              ? ' ' + fmtC(Math.round(v))
              : ' ' + (v >= 0 ? '+' : '') + v.toFixed(2) + '%';
          }
        }
      }
    },
    scales: {
      x: {
        ticks: { color: '#6d6d76', font: { size: 11 }, maxRotation: 0 },
        grid: { display: false },
        border: { display: false },
      },
      y: {
        ticks: { color: '#6d6d76', font: { size: 11 }, callback: yLabel },
        grid: { color: fgA(0.04) },
        border: { display: false },
      },
    },
  };

  if (cagrChart2) cagrChart2.destroy();
  cagrChart2 = new Chart(document.getElementById('cagrChart'), {
    type: 'bar',
    data: { labels, datasets },
    options: opts,
  });
}

/* ════════════════════════════════════════
   [MONEYSPEED] 돈·자산·노동의 가치 속도 — 실시간 데이터
   귀금속(금/은): Yahoo Finance GC=F / SI=F
   주가지수: Yahoo Finance 기존 패턴 재활용
   기간: 현재 ~ 15년 전
════════════════════════════════════════ */

var _msFetching = false;
var _msIndexData = {}; /* {ticker: {cur, hist15, histDate}} */
var _msMetalData = {}; /* {gold: {cur, hist15}, silver: {cur, hist15}} */

/* 15년 전 날짜 */
function ms15yAgo() {
  var d = new Date();
  d.setFullYear(d.getFullYear() - 15);
  return d;
}

/* 소형 숫자 포맷 */
function msFmt(n) {
  if (!n || !isFinite(n)) return '—';
  return n.toLocaleString('ko-KR', {maximumFractionDigits: 2});
}

/* CAGR 계산 */
function msCAGR(cur, hist, years) {
  if (!cur || !hist || hist <= 0 || years <= 0) return null;
  return Math.pow(cur / hist, 1 / years) - 1;
}

/* 요약표 셀 업데이트 */
function msUpdateSumRow(prefix, start, end, cagrPct, mult) {
  var sEl = document.getElementById('ms-' + prefix + '-start');
  var eEl = document.getElementById('ms-' + prefix + '-end');
  var cEl = document.getElementById('ms-' + prefix + '-cagr');
  var mEl = document.getElementById('ms-' + prefix + '-mult');
  if (sEl && start) sEl.textContent = start;
  if (eEl && end)   eEl.textContent = end;
  if (cEl && cagrPct !== null) { cEl.textContent = (cagrPct >= 0 ? '+' : '') + cagrPct.toFixed(1) + '%'; }
  if (mEl && mult)  mEl.textContent = '×' + mult;
}

/* 바 차트 업데이트 (최대 CAGR 기준 상대 폭) */
var _msMaxCAGR = 0;
function msUpdateBar(id, cagrPct) {
  if (cagrPct > _msMaxCAGR) _msMaxCAGR = cagrPct;
  /* 최대 15%를 100%로 */
  var pct = Math.min(Math.max(cagrPct / 15 * 100, 2), 100);
  var bar = document.getElementById('ms-bar-' + id);
  var val = document.getElementById('ms-bar-' + id + '-val');
  if (bar) bar.style.width = pct + '%';
  if (val) val.textContent = (cagrPct >= 0 ? '+' : '') + cagrPct.toFixed(1) + '%';
}

/* 주가지수 테이블 행 생성 */
function msRenderIndexTable() {
  var configs = [
    { id:'kospi',  name:'코스피 (^KS11)' },
    { id:'k200',   name:'코스피200 (^KS200)' },
    { id:'nasdaq', name:'나스닥 종합 (^IXIC)' },
    { id:'ndx',    name:'나스닥100 (^NDX)' },
    { id:'sp500',  name:'S&P500 (^GSPC)' },
    { id:'dji',    name:'다우존스 (^DJI)' }
  ];
  var tbody = document.getElementById('ms-index-table');
  if (!tbody) return;
  var rows = '';
  var hasAny = false;
  configs.forEach(function(cfg) {
    var d = _msIndexData[cfg.id];
    if (!d || !d.cur || !d.hist15) {
      rows += '<tr style="border-bottom:1px solid rgba(var(--fg-rgb),0.04);">'
        + '<td style="padding:6px 10px;color:var(--text2);">' + cfg.name + '</td>'
        + '<td colspan="4" style="padding:6px 10px;text-align:center;color:var(--text3);">조회 중...</td>'
        + '</tr>';
      return;
    }
    hasAny = true;
    var yrs   = (new Date() - new Date(d.histDate || '')) / (1000*60*60*24*365.25) || 15;
    var cagr  = msCAGR(d.cur, d.hist15, yrs);
    var mult  = d.hist15 > 0 ? (d.cur / d.hist15) : null;
    var cp    = cagr !== null ? (cagr * 100).toFixed(1) : '—';
    var mpStr = mult !== null ? '×' + mult.toFixed(1) : '—';
    rows += '<tr style="border-bottom:1px solid rgba(var(--fg-rgb),0.04);">'
      + '<td style="padding:6px 10px;color:var(--text2);">' + cfg.name + '</td>'
      + '<td style="padding:6px 10px;text-align:center;color:var(--text3);">' + msFmt(d.hist15) + 'pt</td>'
      + '<td style="padding:6px 10px;text-align:center;color:var(--text3);">' + msFmt(d.cur) + 'pt</td>'
      + '<td style="padding:6px 10px;text-align:center;font-family:var(--mono);font-weight:600;color:#3182f6;">'
        + (cagr !== null ? (cagr >= 0 ? '+' : '') + cp + '%' : '—') + '</td>'
      + '<td style="padding:6px 10px;text-align:center;color:var(--text3);">' + mpStr + '</td>'
      + '</tr>';
  });
  tbody.innerHTML = rows || '<tr><td colspan="5" style="padding:12px;text-align:center;color:var(--text3);">데이터 없음</td></tr>';
}

/* ── Yahoo Finance 현재가 조회 (기존 tryYahooIndex 패턴) ── */
async function msFetchYahoo(ticker, isKrw) {
  var yfUrl = 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(ticker) + '?interval=1d&range=5d';
  var proxies = [
    'https://corsproxy.io/?' + encodeURIComponent(yfUrl),
    'https://api.allorigins.win/raw?url=' + encodeURIComponent(yfUrl)
  ];
  for (var i = 0; i < proxies.length; i++) {
    try {
      var ctrl = new AbortController();
      var tid  = setTimeout(function() { ctrl.abort(); }, 8000);
      var resp;
      try { resp = await fetch(proxies[i], { cache: 'no-cache', signal: ctrl.signal }); }
      finally { clearTimeout(tid); }
      if (!resp || !resp.ok) continue;
      var txt  = await resp.text();
      var json; try { json = JSON.parse(txt); } catch { continue; }
      if (json.contents) { try { json = JSON.parse(json.contents); } catch { continue; } }
      var r = json && json.chart && json.chart.result && json.chart.result[0];
      if (!r) continue;
      var m  = r.meta;
      var cl = r.indicators && r.indicators.quote && r.indicators.quote[0] && r.indicators.quote[0].close;
      var p  = m.regularMarketPrice || m.previousClose || (cl ? cl.filter(Boolean).slice(-1)[0] : null);
      if (p && p > 0) return parseFloat(p);
    } catch(e) {}
  }
  return null;
}

/* ── 귀금속 조회 ── */
async function fetchMSMetals() {
  var btn  = document.getElementById('ms-metal-btn');
  var load = document.getElementById('ms-metal-loading');
  var date = document.getElementById('ms-metal-date');
  if (btn) btn.disabled = true;
  if (load) load.style.display = '';

  var TROY = 31.1035; /* 1 troy oz = 31.1035g */

  /* 현재 USD/KRW 환율 — 조회 실패 시 임의 값을 쓰지 않음 */
  var usdKrw = (typeof _fxRates !== 'undefined' && _fxRates && _fxRates['USD']) || null;

  try {
    /* 1. 현재 금 가격 */
    var goldCur = await msFetchYahoo('GC=F', false); /* USD/troy oz */
    var silverCur = await msFetchYahoo('SI=F', false); /* USD/troy oz */

    /* 환율 최신화 시도 */
    var krwRate = await msFetchYahoo('USDKRW=X', false);
    if (krwRate && krwRate > 800 && krwRate < 2500) usdKrw = krwRate;

    /* 2. 15년 전 금/은 가격 */
    var date15y = ms15yAgo();
    var gold15  = await fetchHistoricalPrice('GC%3DF', date15y);
    var silver15= await fetchHistoricalPrice('SI%3DF', date15y);

    /* 15년 전 USD/KRW */
    var krw15Res = await fetchHistoricalPrice('USDKRW%3DX', date15y);
    var usdKrw15 = krw15Res && krw15Res.price > 500 ? krw15Res.price : null;
    if (!usdKrw || !usdKrw15) {           /* 환율이 없으면 원화 환산 CAGR 을 만들지 않음 */
      if (date) date.textContent = '원/달러 환율(현재 또는 15년 전)을 불러오지 못해 원화 환산을 건너뜀 — ↺ 갱신으로 다시 시도';
      return;
    }

    var now = new Date();

    /* 금 CAGR */
    if (goldCur && gold15 && gold15.price) {
      var goldCurKrw  = goldCur / TROY * usdKrw;
      var gold15Krw   = gold15.price / TROY * usdKrw15;
      var yrs15 = (now - new Date(gold15.date || '')) / (1000*60*60*24*365.25) || 15;
      var goldCAGR = msCAGR(goldCurKrw, gold15Krw, yrs15);
      _msMetalData.gold = { cur: goldCurKrw, hist15: gold15Krw, cagr: goldCAGR };

      var el1 = document.getElementById('ms-gold-cagr-big');
      var el2 = document.getElementById('ms-gold-detail');
      if (el1) el1.textContent = (goldCAGR >= 0 ? '+' : '') + (goldCAGR * 100).toFixed(1) + '%';
      if (el2) el2.textContent = 'g당 ' + Math.round(gold15Krw).toLocaleString('ko-KR') + '원 → ' + Math.round(goldCurKrw).toLocaleString('ko-KR') + '원 (' + gold15.date + ')';

      /* 요약표 업데이트 */
      msUpdateSumRow('gold',
        'g당 ' + Math.round(gold15Krw/100)*100 + '원',
        'g당 ' + Math.round(goldCurKrw/100)*100 + '원',
        goldCAGR * 100,
        (goldCurKrw / gold15Krw).toFixed(1)
      );
    }

    /* 은 CAGR */
    if (silverCur && silver15 && silver15.price) {
      var silverCurKrw = silverCur / TROY * usdKrw;
      var silver15Krw  = silver15.price / TROY * usdKrw15;
      var yrs15s = (now - new Date(silver15.date || '')) / (1000*60*60*24*365.25) || 15;
      var silverCAGR = msCAGR(silverCurKrw, silver15Krw, yrs15s);
      _msMetalData.silver = { cur: silverCurKrw, hist15: silver15Krw, cagr: silverCAGR };

      var el3 = document.getElementById('ms-silver-cagr-big');
      var el4 = document.getElementById('ms-silver-detail');
      if (el3) el3.textContent = (silverCAGR >= 0 ? '+' : '') + (silverCAGR * 100).toFixed(1) + '%';
      if (el4) el4.textContent = 'g당 ' + silver15Krw.toFixed(0) + '원 → ' + silverCurKrw.toFixed(0) + '원 (' + silver15.date + ')';

      msUpdateSumRow('silver',
        'g당 ' + Math.round(silver15Krw) + '원',
        'g당 ' + Math.round(silverCurKrw) + '원',
        silverCAGR * 100,
        (silverCurKrw / silver15Krw).toFixed(1)
      );
    }

    var nowStr = now.toISOString().slice(0,10);
    if (date) date.textContent = nowStr + ' 기준 · 원달러 ' + Math.round(usdKrw) + '원 · 15년 전: ' + date15y.toISOString().slice(0,7);

  } catch(e) {
    console.error('MS Metals error:', e);
    var el = document.getElementById('ms-metal-date');
    if (el) el.textContent = '조회 실패 — ↺ 갱신 버튼 재시도';
  } finally {
    if (btn)  btn.disabled = false;
    if (load) load.style.display = 'none';
  }
}

/* ── 주가지수 조회 ── */
var _msIdxConfigs = [
  { id:'kospi',  ticker:'%5EKS11',  name:'코스피',    min:200, max:20000 },
  { id:'k200',   ticker:'%5EKS200', name:'코스피200', min:50,  max:10000 },
  { id:'nasdaq', ticker:'%5EIXIC',  name:'나스닥',    min:500, max:100000 },
  { id:'ndx',    ticker:'%5ENDX',   name:'나스닥100', min:500, max:200000 },
  { id:'sp500',  ticker:'%5EGSPC',  name:'S&P500',    min:100, max:50000 },
  { id:'dji',    ticker:'%5EDJI',   name:'다우존스',  min:100, max:500000 }
];

async function fetchMSIndices() {
  var btn  = document.getElementById('ms-index-btn');
  var load = document.getElementById('ms-index-loading');
  var date = document.getElementById('ms-index-date');
  if (btn) btn.disabled = true;
  if (load) load.style.display = '';

  var date15y = ms15yAgo();

  try {
    var curPrices = {};

    /* Yahoo Finance fallback 병렬 */
    var yPromises = _msIdxConfigs.map(async function(cfg) {
      if (curPrices[cfg.id] && curPrices[cfg.id] >= cfg.min) return;
      var p = await msFetchYahoo(decodeURIComponent(cfg.ticker), false);
      if (p && p >= cfg.min && p <= cfg.max) curPrices[cfg.id] = p;
    });
    await Promise.all(yPromises);

    /* 15년 전 가격 병렬 조회 */
    var histPromises = _msIdxConfigs.map(async function(cfg) {
      var res = await fetchHistoricalPrice(cfg.ticker, date15y);
      if (res && res.price >= cfg.min) {
        _msIndexData[cfg.id] = { cur: curPrices[cfg.id] || null, hist15: res.price, histDate: res.date };
      } else {
        _msIndexData[cfg.id] = { cur: curPrices[cfg.id] || null, hist15: null, histDate: null };
      }
      /* cur 업데이트 */
      if (curPrices[cfg.id]) _msIndexData[cfg.id].cur = curPrices[cfg.id];
    });
    await Promise.all(histPromises);

    /* 바 차트 + 요약표 업데이트 */
    _msMaxCAGR = 0;
    _msIdxConfigs.forEach(function(cfg) {
      var d = _msIndexData[cfg.id];
      if (!d || !d.cur || !d.hist15) return;
      var yrs  = d.histDate ? Math.max(1, (new Date() - new Date(d.histDate)) / (1000*60*60*24*365.25)) : 15;
      var cagr = msCAGR(d.cur, d.hist15, yrs);
      if (cagr === null) return;
      var cp   = cagr * 100;
      msUpdateBar(cfg.id, cp);
      var mult = (d.cur / d.hist15).toFixed(1);
      /* 요약표 */
      msUpdateSumRow(cfg.id === 'k200' ? 'k200' : cfg.id,
        msFmt(d.hist15) + 'pt',
        msFmt(d.cur) + 'pt',
        cp,
        mult
      );
    });

    /* 테이블 렌더 */
    msRenderIndexTable();

    var nowStr = new Date().toISOString().slice(0,10);
    if (date) date.textContent = nowStr + ' 기준 현재가 vs 15년 전 (Yahoo Finance) · 가격지수, 배당 미포함';
    var stat = document.getElementById('ms-sum-status');
    if (stat) stat.textContent = nowStr + ' 기준 갱신 완료';

  } catch(e) {
    console.error('MS Indices error:', e);
    if (date) date.textContent = '조회 실패 — ↺ 갱신 버튼 재시도';
  } finally {
    if (btn)  btn.disabled = false;
    if (load) load.style.display = 'none';
  }
}

/* ── 부동산: 국토교통부 실거래가 원자료로 계산한 연도별 평균 거래금액 (data/realty.json, Actions 수집) ──
   시작 = 가장 이른 연도(2006) · 끝 = 가장 최근의 '다 끝난' 해 · CAGR = (끝 평균 / 시작 평균)^(1/연수) − 1 */
async function msRenderRealty() {
  var j = null;
  try { j = window.mdLoad ? await window.mdLoad('realty.json') : null; } catch (e) {}
  var ys = j && j.years ? Object.keys(j.years).map(Number).sort(function (a, b) { return a - b; }) : [];
  var thisYear = new Date().getFullYear();
  var full = ys.filter(function (y) { return y < thisYear; });
  function setT(id, v) { var el = document.getElementById(id); if (el) el.textContent = v; }
  function eok(v) { return (v / 10000).toFixed(2) + '억'; }
  if (full.length < 2) { setT('ms-re-seoul-detail', '실거래 자료 수집 중 (GitHub Actions)'); setT('ms-re-gn-detail', '실거래 자료 수집 중 (GitHub Actions)'); return; }
  var y0 = full[0], y1 = full[full.length - 1], n = y1 - y0;
  /* 중간 연도가 빠져 있으면(수집 중) 시작~끝 계산은 가능하지만 표시로 알림 */
  var missing = []; for (var y = y0; y <= y1; y++) if (!j.years[y]) missing.push(y);
  setT('ms-re-hdr', y0 + '→' + y1 + ' · 국토교통부 실거래가 · 아파트 매매 평균 거래금액');
  [['seoul', 'seoul', '서울'], ['gn', 'gangnam', '강남구']].forEach(function (k) {
    var a = j.years[y0][k[1]], b = j.years[y1][k[1]];
    if (!a || !b) return;
    var cg = Math.pow(b.mean / a.mean, 1 / n) - 1, cm = Math.pow(b.median / a.median, 1 / n) - 1, sg = function (v) { return (v >= 0 ? '+' : '') + (v * 100).toFixed(1) + '%'; };
    setT('ms-re-' + k[0] + '-name', k[2] + ' 아파트 평균 실거래가 (' + y0 + '→' + y1 + ')');
    setT('ms-re-' + k[0] + '-start', eok(a.mean)); setT('ms-re-' + k[0] + '-end', eok(b.mean));
    setT('ms-re-' + k[0] + '-cagr', sg(cg)); setT('ms-re-' + k[0] + '-mult', '×' + (b.mean / a.mean).toFixed(1));
    setT('ms-re-' + k[0] + '-title', k[2] + ' 아파트 평균 실거래가 CAGR (' + y0 + '→' + y1 + ', ' + n + '년)');
    setT('ms-re-' + k[0] + '-big', sg(cg));
    setT('ms-re-' + k[0] + '-detail', '평균 ' + eok(a.mean) + ' → ' + eok(b.mean) + ' (×' + (b.mean / a.mean).toFixed(2) + '배) · 거래 ' + a.n.toLocaleString('ko-KR') + '건 → ' + b.n.toLocaleString('ko-KR') + '건');
    setT('ms-re-' + k[0] + '-median', '중앙값 ' + eok(a.median) + ' → ' + eok(b.median) + ' · CAGR ' + sg(cm));
  });
  if (missing.length) setT('ms-re-hdr', y0 + '→' + y1 + ' · 국토교통부 실거래가 (일부 연도 수집 중: ' + missing.join(', ') + ')');
}

/* 귀금속 + 주가지수 통합 갱신 */
async function fetchMSAll() {
  var btn  = document.getElementById('ms-refresh-btn');
  var icon = document.getElementById('ms-refresh-icon');
  if (btn)  btn.disabled = true;
  if (icon) icon.textContent = '⏳';
  try {
    await Promise.all([fetchMSMetals(), fetchMSIndices()]);
  } finally {
    if (btn)  btn.disabled = false;
    if (icon) icon.textContent = '↺';
  }
}

/* ════════════════════════════════════════════════════════════
   [MUHAN-ENGINE] 무한매수법 4.0 계산 엔진 (순수 함수 · DOM 없음)
   · T값 변화, 평단/잔금/별지점, 오늘의 주문표, 기록 추천을 계산
   · muhan4.pages.dev 와 같은 결과가 나오도록 차등 테스트로 검증됨
════════════════════════════════════════════════════════════ */
var MHE = (function () {
  var STD_SPLITS = [20, 30, 40], EXT_SPLITS = [50, 60, 70, 80, 90, 100];
  var EXT_WARN = '50분할 이상은 라오어 문서 범위(20~40분할) 밖이에요.\n\n' +
    '· 리버스모드 매도 배수가 문서에 없어 앱이 자체 공식(1 − 2/분할수)으로 계산해요\n' +
    '· 1회 매수금이 작아져서, 원금이 부족하면 1주 값이 1회 매수금을 넘을 수 있어요\n\n계속할까요?';
  var DEF_BIGNUM = 12, DEF_LOC_SHARES = 1, DEF_LOC_LINES = 8;
  var COMBO = ['limit_sell_buy_full', 'limit_sell_buy_half', 'buy_full_limit_sell', 'buy_half_limit_sell', 'reverse_sell_buy'];
  var REVERSE = ['reverse_sell', 'reverse_quarter_buy', 'reverse_sell_buy'];

  function r2(x) { return Math.round(x * 100) / 100; }
  function isExtSplits(n) { return n > 40; }
  /* 리버스 매도 배수: 20분할 0.9 · 40분할 0.95 · 30분할 0.925(2026-09-24 이전 기록) · 그 외 1 − 2/분할 */
  function reverseMult(splits, date) {
    if (splits === 30 && (date === undefined || String(date).slice(0, 10) < '2026-09-24')) return 0.925;
    return ({ 20: 0.9, 40: 0.95 })[splits] != null ? ({ 20: 0.9, 40: 0.95 })[splits] : 1 - 2 / splits;
  }
  /* 거래 1건이 T값에 주는 변화 */
  function nextT(t, type, splits, date) {
    var n = splits == null ? 20 : splits;
    switch (type) {
      case 'full_buy': return t + 1;
      case 'half_buy': return t + 0.5;
      case 'quarter_sell': return t * 0.75;
      case 'limit_sell': return t * 0.25;
      case 'limit_sell_buy_full': case 'buy_full_limit_sell': return t * 0.25 + 1;
      case 'limit_sell_buy_half': case 'buy_half_limit_sell': return t * 0.25 + 0.5;
      case 'reverse_sell': return t * reverseMult(n, date);
      case 'reverse_quarter_buy': return t + (n - t) * 0.25;
      case 'reverse_sell_buy': { var s = t * reverseMult(n, date); return s + (n - s) * 0.25; }
    }
  }
  function defaultTarget(ticker) { return ticker === 'SOXL' ? 20 : 15; }
  function targetOf(ticker, target) { return target != null ? target : defaultTarget(ticker); }
  function bigNumOf(v) { return v != null ? v : DEF_BIGNUM; }
  function locShares(v) { return Math.max(1, Math.min(20, Math.floor(v != null ? v : DEF_LOC_SHARES))); }
  function locLines(v) { return Math.max(1, Math.min(80, Math.floor(v != null ? v : DEF_LOC_LINES))); }
  /* 별% = 목표% − 목표% × 2/분할 × T */
  function starPercent(ticker, splits, t, target) { var p = targetOf(ticker, target); return p - p * 2 / splits * t; }
  function priceAt(avg, pct) { return Math.round(avg * (1 + pct / 100) * 100) / 100; }
  function snap(x, tick) { return !tick || tick <= 0 ? x : Math.round(x / tick) * tick; }
  function oneTickBelow(x, tick) { return !tick || tick <= 0 ? Math.round((x - 0.01) * 100) / 100 : snap(x, tick) - tick; }
  function phaseOf(t, splits, qty, hasTx) {
    if (qty === 0 && !hasTx) return '처음매수';
    if (qty === 0) return '종료';
    if (t > splits - 1) return '소진모드';
    return t < splits / 2 ? '전반전' : '후반전';
  }
  function isOverSell(sellQty, holdQty) { return sellQty > 0 && holdQty >= 0 && sellQty > holdQty; }
  function isPriceOdd(price, ref) { if (!ref || ref <= 0 || !(price > 0)) return false; var k = price / ref; return k >= 5 || k <= 0.2; }

  /* 세션 상태 계산 (거래를 순서대로 적용) */
  function compute(settings, txs, midEntry) {
    var t = midEntry ? midEntry.tValue : 0, avg = midEntry ? midEntry.avgPrice : 0, qty = midEntry ? midEntry.totalQuantity : 0;
    var invested = midEntry ? midEntry.avgPrice * midEntry.totalQuantity : 0, returned = 0, realized = 0, realizedCost = 0;
    function buy(p, q) { var nq = qty + q; avg = nq > 0 ? (avg * qty + p * q) / nq : p; qty = nq; invested += p * q; }
    function sell(p, q) { realized += (p - avg) * q; realizedCost += avg * q; qty = Math.max(0, qty - q); returned += p * q; }
    (txs || []).forEach(function (x) {
      t = x.tOverride !== undefined ? x.tOverride : nextT(t, x.type, settings.splits, x.date);
      switch (x.type) {
        case 'full_buy': case 'half_buy': case 'reverse_quarter_buy': buy(x.price, x.quantity); break;
        case 'quarter_sell': case 'limit_sell': case 'reverse_sell': sell(x.price, x.quantity); break;
        case 'limit_sell_buy_full': case 'limit_sell_buy_half': case 'reverse_sell_buy':
          sell(x.sellPrice || 0, x.sellQuantity || 0); buy(x.price, x.quantity); break;
        case 'buy_full_limit_sell': case 'buy_half_limit_sell':
          buy(x.price, x.quantity); sell(x.sellPrice || 0, x.sellQuantity || 0); break;
      }
    });
    var cash = settings.totalCapital - invested + returned;
    var sp = starPercent(settings.ticker, settings.splits, t, settings.targetProfit);
    var star = avg > 0 ? snap(priceAt(avg, sp), settings.tickSize) : 0;
    var left = settings.splits - t;
    return {
      tValue: t, avgPrice: Math.round(avg * 1e4) / 1e4, totalQuantity: qty,
      remainingCapital: r2(cash), totalInvested: r2(invested), totalReturned: r2(returned),
      starPercent: r2(sp), starPrice: star, buyPoint: star > 0 ? oneTickBelow(star, settings.tickSize) : 0, sellPoint: star,
      limitSellPrice: avg > 0 ? snap(priceAt(avg, targetOf(settings.ticker, settings.targetProfit)), settings.tickSize) : 0,
      buyAmount: r2(left <= 0 ? 0 : cash / left), isFirstHalf: t < settings.splits / 2,
      realizedPnL: r2(realized), realizedCost: r2(realizedCost),
      phase: phaseOf(t, settings.splits, qty, (txs || []).length > 0)
    };
  }
  /* 거래별 누적 상태 (차트·CSV용) */
  function history(settings, txs, midEntry) {
    var out = [];
    for (var i = 1; i <= txs.length; i++) {
      var s = compute(settings, txs.slice(0, i), midEntry);
      out.push({ date: txs[i - 1].date, tValue: s.tValue, avgPrice: s.avgPrice, remainingCapital: s.remainingCapital,
                 totalQuantity: s.totalQuantity, realizedPnL: s.realizedPnL });
    }
    return out;
  }
  /* 매도별 실현 손익 상세 */
  function realizedDetail(txs, hist) {
    var out = [], prev = 0;
    for (var i = 0; i < hist.length; i++) {
      var d = hist[i].realizedPnL - prev; prev = hist[i].realizedPnL;
      if (Math.abs(d) > 1e-6) {
        var x = txs[i], combo = COMBO.indexOf(x.type) >= 0;
        out.push({ date: x.date, type: x.type, sellPrice: combo ? x.sellPrice || 0 : x.price,
                   sellQty: combo ? x.sellQuantity || 0 : x.quantity, realized: d, cumulative: hist[i].realizedPnL });
      }
    }
    return out;
  }
  /* 하방 LOC 사다리: amount ÷ (기준수량 + i × 줄당수량) */
  function ladder(list, amount, baseQty, lines, perLine, tick) {
    for (var i = 1; i <= lines; i++) {
      var p = snap(Math.floor(amount / (baseQty + i * perLine) * 100) / 100, tick);
      if (p < 1) break;
      list.push({ label: '', type: 'buy', method: 'LOC', price: p, quantity: perLine });
    }
  }
  /* 오늘의 주문표. rev = {starPrice, isFirstDay} (리버스모드) · close = 직전 종가 */
  function orders(st, s, rev, close) {
    var out = [];
    if (st.phase === '종료') return out;
    var bigMul = 1 + bigNumOf(s.bigNumPercent) / 100;
    var bigNum = close ? snap(Math.round(close * bigMul * 100) / 100, s.tickSize) : 0;
    if (st.phase === '처음매수') {
      if (!close || st.buyAmount <= 0) return out;
      var q0 = Math.max(1, Math.floor(st.buyAmount / bigNum));
      out.push({ label: '★ 처음매수', type: 'buy', method: 'LOC', price: bigNum, quantity: q0 });
      ladder(out, st.buyAmount, q0, locLines(s.lowerLocLines) + 2, locShares(s.lowerLocShares), s.tickSize);
      return out;
    }
    if (rev) {
      var half = s.splits / 2, sq = st.totalQuantity > 0 ? Math.max(1, Math.floor(st.totalQuantity / half)) : 0;
      if (rev.isFirstDay) {
        if (sq > 0) out.push({ label: 'MOC 처음매도', type: 'sell', method: 'MOC', price: 0, quantity: sq });
        return out;
      }
      var quarter = st.remainingCapital / 4;
      var revBuy = rev.starPrice > 0 ? oneTickBelow(rev.starPrice, s.tickSize) : 0;
      var useBig = s.disableBigNum !== true && bigNum > 0 && revBuy > 0 && bigNum <= revBuy;
      var bp = useBig ? bigNum : revBuy, canBuy = bp > 0 && quarter >= bp;
      if (sq > 0 && rev.starPrice > 0) {
        out.push(canBuy ? { label: '★ 리버스매도', type: 'sell', method: 'LOC', price: snap(rev.starPrice, s.tickSize), quantity: sq }
                        : { label: 'MOC 매도', type: 'sell', method: 'MOC', price: 0, quantity: sq });
      }
      if (canBuy) {
        var bq = Math.max(1, Math.floor(quarter / bp));
        var o = { label: useBig ? '★ 큰수 쿼터매수' : '★ 쿼터매수', type: 'buy', method: 'LOC', price: bp, quantity: bq };
        if (useBig) o.altPrice = revBuy;
        out.push(o);
        ladder(out, quarter, bq, locLines(s.lowerLocLines), locShares(s.lowerLocShares), s.tickSize);
      }
      return out;
    }
    var big = s.disableBigNum !== true && bigNum > 0 && bigNum <= st.buyPoint, mainP = big ? bigNum : st.buyPoint;
    if (st.buyAmount > 0 && st.buyPoint > 0) {
      var label = big ? '★ 큰수' : '★ 별지점', base, main;
      if (st.isFirstHalf) {
        var nStar = Math.max(1, Math.floor(st.buyAmount / 2 / mainP));
        var nAvg = Math.max(1, Math.max(1, Math.floor(st.buyAmount / st.avgPrice)) - nStar);
        base = nStar + nAvg;
        main = { label: label, type: 'buy', method: 'LOC', price: mainP, quantity: nStar };
        if (big) main.altPrice = st.buyPoint;
        out.push(main, { label: '평단가', type: 'buy', method: 'LOC', price: snap(st.avgPrice, s.tickSize), quantity: nAvg });
      } else {
        base = Math.max(1, Math.floor(st.buyAmount / mainP));
        main = { label: label, type: 'buy', method: 'LOC', price: mainP, quantity: base };
        if (big) main.altPrice = st.buyPoint;
        out.push(main);
      }
      ladder(out, st.buyAmount, base, locLines(s.lowerLocLines), locShares(s.lowerLocShares), s.tickSize);
    }
    if (st.totalQuantity > 0 && st.sellPoint > 0) {
      var qs = Math.max(1, Math.floor(st.totalQuantity / 4)), rest = st.totalQuantity - qs;
      out.push({ label: '★ 쿼터매도', type: 'sell', method: 'LOC', price: st.sellPoint, quantity: qs });
      if (rest > 0) out.push({ label: targetOf(s.ticker, s.targetProfit) + '% 지정가', type: 'sell', method: '지정가', price: st.limitSellPrice, quantity: rest });
    }
    return out;
  }
  /* RSI(14) — sma: 최근 14일 단순평균 / wilder: 지수평활 */
  function rsi(closes, n, method) {
    n = n || 14;
    if (!Array.isArray(closes) || closes.length < n + 1) return null;
    var up = [], dn = [];
    for (var i = 1; i < closes.length; i++) { var d = closes[i] - closes[i - 1]; up.push(d > 0 ? d : 0); dn.push(d < 0 ? -d : 0); }
    var sum = function (a) { return a.reduce(function (x, y) { return x + y; }, 0); }, au, ad;
    if ((method || 'sma') === 'sma') { au = sum(up.slice(-n)) / n; ad = sum(dn.slice(-n)) / n; }
    else { au = sum(up.slice(0, n)) / n; ad = sum(dn.slice(0, n)) / n;
      for (var k = n; k < up.length; k++) { au = (au * (n - 1) + up[k]) / n; ad = (ad * (n - 1) + dn[k]) / n; } }
    return ad === 0 ? (au === 0 ? 50 : 100) : 100 - 100 / (1 + au / ad);
  }

  /* 기록 추천 (오늘의 거래 기록 시트) — 직전 종가·세션 고가로 체결 가능 유형 판정 */
  function closeBefore(dateStr, prices, back) {
    if (!prices.length) return null;
    var d = new Date(dateStr + 'T12:00:00'); d.setDate(d.getDate() - back);
    var key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    for (var i = prices.length - 1; i >= 0; i--) if (prices[i].date <= key) return prices[i];
    return prices[prices.length - 1];
  }
  function recommend(ctx) {
    /* ctx: {settings, prior(=기록일 이전 상태), cur(=현재 상태), date, prices, back, isReverse, revStar, txs} */
    var s = ctx.settings, A = ctx.prior, day = closeBefore(ctx.date, ctx.prices, ctx.back), close = day ? day.close : null;
    var bigMul = 1 + bigNumOf(s.bigNumPercent) / 100, bigNum = close ? Math.round(close * bigMul * 100) / 100 : 0;
    var mainP = s.disableBigNum !== true && bigNum > 0 && bigNum < A.buyPoint ? bigNum : A.buyPoint;
    var set = {}, suspect = null;
    if (close && A.phase !== '처음매수' && A.phase !== '종료' && !ctx.isReverse) {
      var fullOK = A.isFirstHalf ? close <= A.avgPrice : close <= mainP, halfOK = A.isFirstHalf && !fullOK && close <= mainP;
      if (fullOK) set.full_buy = 1; else if (halfOK) set.half_buy = 1;
      if (A.totalQuantity > 0 && A.sellPoint > 0 && close >= A.sellPoint) set.quarter_sell = 1;
      if (A.totalQuantity > 0 && A.limitSellPrice > 0) {
        var rh = day.regularHigh, ph = day.postHigh, eh = day.preHigh, L = A.limitSellPrice;
        var preHit = eh != null && eh >= L, postHit = ph != null && ph >= L;
        var dayHit = (rh != null && rh >= L) || preHit, afterOnly = !dayHit && ph != null && ph >= L;
        var noSess = rh == null && ph == null && eh == null && close >= L;
        if (dayHit || afterOnly || noSess) set.limit_sell = 1;
        if (!(rh != null && rh >= L)) {
          if (preHit && day.preHighSuspect) suspect = { session: '프리장', price: eh };
          else if (postHit && day.postHighSuspect) suspect = { session: '애프터장', price: ph };
        }
        if (dayHit) { if (fullOK) set.limit_sell_buy_full = 1; else if (halfOK) set.limit_sell_buy_half = 1; }
        if (afterOnly) { if (fullOK) set.buy_full_limit_sell = 1; else if (halfOK) set.buy_half_limit_sell = 1; }
      }
    }
    return { set: set, close: close, day: day, mainP: mainP, suspect: suspect, bigMul: bigMul };
  }
  /* 유형별 자동 입력값 */
  function prefill(type, ctx, rec) {
    var s = ctx.settings, A = ctx.prior, e = ctx.cur, o = ctx.revStar || 0, half = s.splits / 2, c = rec.close;
    var out = { buyPrice: '', buyQty: '', sellPrice: '', sellQty: '' };
    var ladderQty = c !== null && c ? orders(A, s, undefined, c).filter(function (x) { return x.type === 'buy' && x.price >= c; })
      .reduce(function (a, x) { return a + x.quantity; }, 0) : 0;
    function buyQty(halfType) {
      var q = halfType ? (rec.mainP > 0 ? Math.max(1, Math.floor(A.buyAmount / 2 / rec.mainP)) : 0)
                       : (A.avgPrice > 0 ? Math.max(1, Math.floor(A.buyAmount / A.avgPrice)) : 0);
      return ladderQty > 0 ? ladderQty : q;
    }
    function bp() { var p = c != null && c ? c : (A.buyPoint > 0 ? A.buyPoint : null); return p ? p.toFixed(2) : ''; }
    function limitQty() { return String(Math.max(1, A.totalQuantity - Math.max(1, Math.floor(A.totalQuantity / 4)))); }
    var lp = A.limitSellPrice > 0 ? A.limitSellPrice.toFixed(2) : '';
    function q2s(q) { return q > 0 ? String(q) : ''; }
    switch (type) {
      case 'full_buy': case 'half_buy': out.buyPrice = bp(); out.buyQty = q2s(buyQty(type === 'half_buy')); break;
      case 'quarter_sell': out.sellPrice = c ? c.toFixed(2) : (A.sellPoint > 0 ? A.sellPoint.toFixed(2) : '');
        out.sellQty = String(Math.max(1, Math.floor(A.totalQuantity / 4))); break;
      case 'limit_sell': out.sellPrice = lp; out.sellQty = limitQty(); break;
      case 'limit_sell_buy_full': case 'limit_sell_buy_half': case 'buy_full_limit_sell': case 'buy_half_limit_sell':
        out.sellPrice = lp; out.sellQty = limitQty(); out.buyPrice = bp();
        out.buyQty = q2s(buyQty(type === 'limit_sell_buy_half' || type === 'buy_half_limit_sell')); break;
      case 'reverse_sell': case 'reverse_sell_buy':
        var sq = e.totalQuantity > 0 ? Math.max(1, Math.floor(e.totalQuantity / half)) : 0;
        out.sellPrice = c ? c.toFixed(2) : (o > 0 ? o.toFixed(2) : ''); out.sellQty = q2s(sq);
        if (type === 'reverse_sell') break;
      /* falls through */
      case 'reverse_quarter_buy':
        var p = c != null && c ? c : (o > 0 ? Math.round((o - 0.01) * 100) / 100 : 0);
        var q = p > 0 ? Math.max(1, Math.floor(e.remainingCapital / 4 / p)) : 0;
        out.buyPrice = p > 0 ? p.toFixed(2) : ''; out.buyQty = q2s(q); break;
    }
    return out;
  }

  return {
    STD_SPLITS: STD_SPLITS, EXT_SPLITS: EXT_SPLITS, EXT_WARN: EXT_WARN, DEF_BIGNUM: DEF_BIGNUM,
    DEF_LOC_SHARES: DEF_LOC_SHARES, DEF_LOC_LINES: DEF_LOC_LINES, COMBO: COMBO, REVERSE: REVERSE,
    isExtSplits: isExtSplits, reverseMult: reverseMult, nextT: nextT, defaultTarget: defaultTarget, targetOf: targetOf,
    bigNumOf: bigNumOf, locShares: locShares, locLines: locLines, starPercent: starPercent, priceAt: priceAt,
    snap: snap, oneTickBelow: oneTickBelow, isOverSell: isOverSell, isPriceOdd: isPriceOdd,
    compute: compute, history: history, realizedDetail: realizedDetail, orders: orders, rsi: rsi,
    closeBefore: closeBefore, recommend: recommend, prefill: prefill
  };
})();
if (typeof module !== 'undefined') module.exports = MHE;

/* ════════════════════════════════════════════════════════════
   [MUHAN] 무한매수법 기록 — 화면 (muhan4.pages.dev 동일 기능 · 로그인 대신 데이터 코드)
   구조: 저장소(세션들) → MH.state → render() 가 #mh-root 를 다시 그림
         버튼/입력은 data-act / data-in 속성 → 아래 이벤트 위임에서 처리
   데이터: localStorage 'muhan4-store' · 코드 내보내기/불러오기로 기기 간 이동
   시세: data/muhan.json (GitHub Actions) → 없으면 data/market.json → 프록시
════════════════════════════════════════════════════════════ */
(function () {
  var E = MHE, KEY = 'muhan4-store', OLD_KEY = 'muhan4_data';
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var uid = function () { return (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); };
  var ymd = function (d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  var today = function () { return ymd(new Date()); };
  var daysAgo = function (n) { var d = new Date(); d.setDate(d.getDate() - n); return ymd(d); };
  var r2 = function (x) { return Math.round(x * 100) / 100; };
  /* 금액 표기 (원본과 동일 규칙) */
  function fmt(v, cur, dec) { dec = dec == null ? 2 : dec; return cur === 'KRW' ? '₩' + Math.round(v).toLocaleString() : '$' + Number(v).toFixed(dec); }
  function fmtL(v, cur) { return cur === 'KRW' ? '₩' + Math.round(v).toLocaleString() : '$' + Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 }); }
  var sign = function (v) { return v >= 0 ? '+' : ''; };
  /* 세션 색상: 사이트 팔레트(파랑·빨강·주황) 3가지 · 이전에 고른 색은 가까운 색으로 표시 */
  var COLORS = [['blue', '파랑', '#3182f6'], ['rose', '빨강', '#f04452'], ['amber', '주황', '#fe9800']];
  var COLOR_ALIAS = { violet: 'blue', cyan: 'blue', teal: 'blue', green: 'blue', pink: 'rose' };
  function colorHex(k) { k = COLOR_ALIAS[k] || k; var c = COLORS.filter(function (x) { return x[0] === k; })[0]; return c ? c[2] : null; }
  function rgba(hex, a) { var h = hex.replace('#', ''); return 'rgba(' + parseInt(h.slice(0, 2), 16) + ',' + parseInt(h.slice(2, 4), 16) + ',' + parseInt(h.slice(4, 6), 16) + ',' + a + ')'; }
  var TYPE_LABEL = { full_buy: '1회매수', half_buy: '절반매수', quarter_sell: '쿼터매도', limit_sell: '지정가매도', limit_sell_buy_full: '지정가+매수',
    limit_sell_buy_half: '지정가+반매수', buy_full_limit_sell: '매수+지정가(AF)', buy_half_limit_sell: '반매수+지정가(AF)', reverse_sell: 'R매도',
    reverse_quarter_buy: 'R쿼터매수', reverse_sell_buy: 'R매도+매수' };
  var TYPE_COLOR = { full_buy: 'mh-ok', half_buy: 'mh-ok', quarter_sell: 'mh-warn', limit_sell: 'mh-bad', limit_sell_buy_full: 'mh-info',
    limit_sell_buy_half: 'mh-ac', buy_full_limit_sell: 'mh-info', buy_half_limit_sell: 'mh-ac', reverse_sell: 'mh-rev', reverse_quarter_buy: 'mh-info', reverse_sell_buy: 'mh-rev' };
  var TYPE_FULL = { full_buy: '1회매수', half_buy: '절반매수', quarter_sell: '쿼터매도', limit_sell: '지정가매도', limit_sell_buy_full: '지정가매도+1회매수',
    limit_sell_buy_half: '지정가매도+절반매수', buy_full_limit_sell: '1회매수+지정가매도(AF)', buy_half_limit_sell: '절반매수+지정가매도(AF)',
    reverse_sell: '리버스매도', reverse_quarter_buy: '리버스쿼터매수', reverse_sell_buy: '리버스매도+매수' };
  var NORMAL_TYPES = [
    { type: 'full_buy', label: '1회 매수', desc: 'T + 1', group: 'buy' }, { type: 'half_buy', label: '절반 매수', desc: 'T + 0.5', group: 'buy' },
    { type: 'quarter_sell', label: '쿼터매도', desc: 'T × 0.75', group: 'sell' }, { type: 'limit_sell', label: '지정가매도', desc: 'T × 0.25', group: 'sell' },
    { type: 'limit_sell_buy_full', label: '지정가매도 + 1회매수', desc: 'T×0.25 + 1', group: 'combined' },
    { type: 'limit_sell_buy_half', label: '지정가매도 + 절반매수', desc: 'T×0.25 + 0.5', group: 'combined' },
    { type: 'buy_full_limit_sell', label: '1회매수 + 지정가매도(애프터)', desc: 'T×0.25 + 1', group: 'combined' },
    { type: 'buy_half_limit_sell', label: '절반매수 + 지정가매도(애프터)', desc: 'T×0.25 + 0.5', group: 'combined' }];
  function reverseTypes(splits, date) {
    return [{ type: 'reverse_sell', label: '리버스 매도', desc: 'T × ' + String(Math.round(E.reverseMult(splits, date) * 1e4) / 1e4), group: 'sell' },
            { type: 'reverse_quarter_buy', label: '쿼터매수', desc: 'T+(' + splits + '-T)×0.25', group: 'buy' },
            { type: 'reverse_sell_buy', label: '리버스매도 + 쿼터매수', desc: '매도+매수', group: 'combined' }];
  }
  var REC_ORDER = ['limit_sell_buy_full', 'limit_sell_buy_half', 'buy_full_limit_sell', 'buy_half_limit_sell', 'limit_sell', 'quarter_sell', 'full_buy', 'half_buy'];
  function groupOf(t) { return (t === 'full_buy' || t === 'half_buy' || t === 'reverse_quarter_buy') ? 'buy' : (t === 'quarter_sell' || t === 'limit_sell' || t === 'reverse_sell') ? 'sell' : 'combined'; }

  /* ── 저장소 ── */
  function newSession(name) { return { id: uid(), name: name || '세션 1', settings: null, transactions: [], isReverseMode: false, reverseStarPrice: null, archivedCycles: [], midEntry: null }; }
  function migrateOld(old) {   /* 이전 버전(muhan4_data) → 새 구조 */
    var st = old.settings || {}, map = { buy_first: 'full_buy', buy_avg: 'full_buy', buy_manual: 'full_buy', sell_profit: 'limit_sell', sell_quarter: 'quarter_sell' };
    var settings = st.ticker ? { ticker: st.ticker, splits: st.splits || 40, totalCapital: st.seed || 20000,
      targetProfit: st.targetPct != null ? st.targetPct : E.defaultTarget(st.ticker), bigNumPercent: st.bigNumPct != null ? st.bigNumPct : 12,
      lowerLocShares: 1, lowerLocLines: 8 } : null;
    var list = (old.sessions || []).filter(function (s) { return (s.trades || []).length; }).map(function (s, i) {
      var n = newSession(settings ? settings.ticker + ' #' + (i + 1) : '세션 ' + (i + 1)); n.settings = settings ? JSON.parse(JSON.stringify(settings)) : null;
      n.transactions = (s.trades || []).map(function (t) { return { id: uid(), date: String(t.date).slice(0, 10) + 'T12:00:00', type: map[t.type] || 'full_buy', price: +t.price, quantity: +t.qty }; })
        .sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
      return n;
    });
    if (!list.length) { var s0 = newSession(); s0.settings = settings; list = [s0]; }
    return { sessions: list, activeSessionId: list[0].id };
  }
  function normalize(d) {
    if (!d || !Array.isArray(d.sessions) || !d.sessions.length) return null;
    d.sessions.forEach(function (s) { s.transactions = s.transactions || []; s.archivedCycles = s.archivedCycles || []; if (s.isReverseMode == null) s.isReverseMode = false; if (s.midEntry === undefined) s.midEntry = null; });
    var act = d.sessions.filter(function (s) { return !s.archived; })[0] || d.sessions[0];
    if (!d.sessions.some(function (s) { return s.id === d.activeSessionId && !s.archived; })) d.activeSessionId = act.id;
    return { sessions: d.sessions, activeSessionId: d.activeSessionId };
  }
  function load() {
    try { var n = normalize(JSON.parse(localStorage.getItem(KEY) || 'null')); if (n) return n; } catch (e) {}
    try { var o = JSON.parse(localStorage.getItem(OLD_KEY) || 'null'); if (o && (o.settings || o.sessions)) { var m = migrateOld(o); localStorage.setItem(KEY, JSON.stringify(m)); return m; } } catch (e) {}
    var s = newSession(); return { sessions: [s], activeSessionId: s.id };
  }
  var store = load();
  function save() { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) {} }
  function active() { var a = store.sessions.filter(function (s) { return s.id === store.activeSessionId; })[0];
    return a && !a.archived ? a : (store.sessions.filter(function (s) { return !s.archived; })[0] || a || store.sessions[0]); }
  function live() { return store.sessions.filter(function (s) { return !s.archived; }); }
  /* 세션 변경은 항상 이 함수를 통해 → 저장 + 다시 그리기 */
  function mut(fn, keepScroll) { fn(); save(); render(); }
  function upd(patch) { mut(function () { var s = active(); s.settings = Object.assign({}, s.settings, patch); }); }

  /* ── 화면 상태 · 사용자 환경설정 ── */
  var LS = function (k, d) { var v = localStorage.getItem(k); return v == null ? d : v; };
  var MH = window.MH = {
    view: 'now', menu: false, sheet: null, pop: null, tabDir: null,
    setup: null, fontScale: Number(LS('muhan4-fontScale', '1')) || 1,
    todo: LS('muhan4-order-todo', 'true') !== 'false', rsiOn: LS('muhan4-rsi', 'true') !== 'false',
    rsiMethod: LS('muhan4-rsi-method', 'sma') === 'wilder' ? 'wilder' : 'sma', vixOn: LS('muhan4-vix', 'true') !== 'false',
    chartPeriod: '1y', anScope: null, anOpen: null, restartOpen: false, restartCap: '', restartSplits: 20, manualDate: today(), manualClose: '',
    market: {}, marketTicker: null, fx: null, fear: null, vix: [], loading: false, failed: false, now: new Date()
  };

  /* ── 미국 시간 헬퍼 ── */
  function nyParts(d) { var p = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(d || new Date());
    var g = function (t) { return (p.filter(function (x) { return x.type === t; })[0] || {}).value || ''; };
    return { date: g('year') + '-' + g('month') + '-' + g('day'), wd: g('weekday'), min: Number(g('hour')) % 24 * 60 + Number(g('minute')) }; }
  function closeSettling(d) { var n = nyParts(d); return n.wd !== 'Sat' && n.wd !== 'Sun' && n.min >= 960 && n.min < 975 || localStorage.getItem('muhan4-debug-settling') === '1'; }
  function marketState(d) { var n = nyParts(d); if (n.wd === 'Sat' || n.wd === 'Sun') return 'CLOSED';
    return n.min >= 240 && n.min < 570 ? 'PRE' : n.min >= 570 && n.min < 960 ? 'REGULAR' : n.min >= 960 && n.min < 1200 ? 'POST' : 'CLOSED'; }
  function isEDT(d) { return (new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', timeZoneName: 'short' }).formatToParts(d || new Date()).filter(function (x) { return x.type === 'timeZoneName'; })[0] || {}).value === 'EDT'; }
  /* 확정 종가만 (오늘 미국장 마감 전 일봉 제외) */
  function settledOnly(list) { var n = nyParts(); var afterClose = n.min >= 960;
    var seen = {}; return list.filter(function (p) { if (seen[p.date]) return false; seen[p.date] = 1; return p.date < n.date || (p.date === n.date && afterClose); })
      .sort(function (a, b) { return a.date < b.date ? -1 : 1; }); }

  /* ── 시세 로딩 ([MARKET-DATA] 의 mdLoad 재사용) ── */
  function dayStr(dn) { return ymd(new Date(dn * 86400000 + 12 * 3600000)); }
  async function loadMarket(ticker) {
    MH.loading = true; MH.failed = false;
    var mk = { ticker: ticker, prices: [], long: [], quote: null };
    try {
      var m = window.mdLoad ? await window.mdLoad('muhan.json') : null;
      var t = m && m.tickers && m.tickers[ticker];
      if (t) {
        mk.prices = (t.days || []).map(function (d) { return Object.assign({}, d); });
        mk.long = (t.closes || []).map(function (c) { return { date: dayStr(c[0]), close: c[1] }; });
        mk.quote = t.quote || null;
      }
      if (m && m.fx) MH.fx = m.fx;
      if (m && m.fear) MH.fear = m.fear;
      if (m && m.vix) MH.vix = m.vix.map(function (c) { return { date: dayStr(c[0]), close: c[1] }; });
      if (!mk.prices.length) {        /* 대체: market.json 의 최근 30일 종가 */
        var mm = window.mdLoad ? await window.mdLoad('market.json') : null, q = mm && mm.quotes && mm.quotes[ticker];
        if (q && q.daily) mk.prices = q.daily.map(function (p) { return { date: ymd(new Date(p[0] * 1000)), close: p[1] }; });
        if (q) mk.quote = { price: q.price, time: q.time };
        if (!MH.fx && mm && mm.quotes && mm.quotes['USDKRW=X']) { var u = mm.quotes['USDKRW=X']; MH.fx = { rate: u.price, date: u.time ? ymd(new Date(u.time * 1000)) : today() }; }
      }
      if (!mk.prices.length) {        /* 최후: Yahoo 직접 (프록시 경유) */
        var r = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(ticker) + '?interval=1d&range=1y');
        var j = await r.json(), res = j.chart.result[0], ts = res.timestamp || [], q0 = res.indicators.quote[0];
        ts.forEach(function (s, i) { if (q0.close[i]) mk.prices.push({ date: ymd(new Date(s * 1000)), close: Math.round(q0.close[i] * 100) / 100, open: q0.open[i], dayHigh: q0.high[i] }); });
        mk.long = mk.prices.map(function (p) { return { date: p.date, close: p.close }; });
      }
    } catch (e) { }
    mk.prices = settledOnly(mk.prices);
    if (!mk.long.length) mk.long = mk.prices.map(function (p) { return { date: p.date, close: p.close }; });
    else { var last = mk.long[mk.long.length - 1].date; mk.prices.forEach(function (p) { if (p.date > last) mk.long.push({ date: p.date, close: p.close }); }); mk.long = settledOnly(mk.long); }
    MH.market[ticker] = mk; MH.loading = false; MH.failed = mk.prices.length === 0;
    if (active().settings && active().settings.ticker === ticker) render();
  }
  /* ── 현재 세션의 화면용 계산 (원본 대시보드와 같은 규칙) ── */
  function avg5(list) { return list.length >= 5 ? Math.round(list.slice(-5).reduce(function (a, p) { return a + p.close; }, 0) / 5 * 100) / 100 : null; }
  function derive() {
    var ses = active(), s = ses.settings, txs = ses.transactions, mid = ses.midEntry, isRev = !!ses.isReverseMode;
    var st = E.compute(s, txs, mid), isCustom = s.isCustom === true, cur = s.currency || 'USD', tdy = today();
    var orderDone = !!(ses.orderDone && ses.orderDone.date === tdy && ses.orderDone.done);
    var isRevTx = function (t) { return E.REVERSE.indexOf(t.type) >= 0; }, lastNon = -1;
    for (var i = txs.length - 1; i >= 0; i--) if (!isRevTx(txs[i])) { lastNon = i; break; }
    var revAfter = txs.slice(lastNon + 1).some(isRevTx), revFirstDay = isRev && !revAfter;
    var tk = cur === 'KRW' ? '' : s.ticker, mk = tk ? MH.market[tk] : null;
    var hn = mk ? mk.prices.slice(-11) : [];
    var manual = (s.manualCloses || []).filter(function (m) { return m.close > 0; }).slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; }).slice(-11)
      .map(function (m) { return { date: m.date, close: m.close }; });
    var ot = hn.length > 0 ? hn : (isCustom && manual.length > 0 ? manual : hn);
    var failed = MH.failed && !MH.loading && !isCustom && ot.length === 0;
    var since = daysAgo(380);
    var rsiPrices = MH.rsiOn && mk ? mk.long.filter(function (p) { return p.date >= since; }).slice(-365) : [];
    var rsiVal = rsiPrices.length < 60 ? null : E.rsi(rsiPrices.map(function (p) { return p.close; }), 14, MH.rsiMethod);
    var vix = MH.vixOn && !isCustom ? MH.vix.slice(-60) : [];
    var a5 = avg5(ot);
    /* 리버스 별지점 자동 추종: 비어 있거나, 직전 5일 평균 값이었다면 새 5일 평균으로 갱신 */
    if (isRev && a5 != null) {
      if (ses.reverseStarPrice == null) { ses.reverseStarPrice = a5; save(); }
      else if (ses.reverseStarPrice !== a5) {
        for (var b = ot.length - 1; b >= 5; b--) { if (avg5(ot.slice(b - 5, b)) === ses.reverseStarPrice) { ses.reverseStarPrice = a5; save(); break; } }
      }
    }
    var rStar = ses.reverseStarPrice;
    var close = ot.length > 0 ? ot[ot.length - 1].close : (isCustom && typeof s.manualClose === 'number' && s.manualClose > 0 ? s.manualClose : undefined);
    var recDate = s.recordDateBasis !== 'us' ? tdy : (ot.length > 0 ? ot[ot.length - 1].date : daysAgo(1));
    var recorded = txs.some(function (t) { return t.date.slice(0, 10) === recDate; });
    var bigMax = (function () {
      var B = isRev ? (rStar != null && rStar > 0 ? Math.round((rStar - 0.01) * 100) / 100 : 0) : st.buyPoint;
      if (!close || close <= 0 || B <= 0) return 40;
      var at = function (p) { return Math.round(close * (1 + p / 100) * 100) / 100; };
      var y = Math.min(40, Math.max(0, Math.round((B / close - 1) * 1e4) / 100));
      while (y > 0 && at(y) > B) y = Math.round((y - 0.01) * 100) / 100;
      while (y < 40 && at(Math.round((y + 0.01) * 100) / 100) <= B) y = Math.round((y + 0.01) * 100) / 100;
      return y;
    })();
    var orders = isRev ? E.orders(st, s, { starPrice: rStar != null ? rStar : 0, isFirstDay: revFirstDay }, close) : E.orders(st, s, undefined, close);
    /* 어제 주문표: 어제 이전 거래 기준 + 어제 종가 */
    var yd = daysAgo(1), yClose = null;
    for (var k = ot.length - 1; k >= 0; k--) if (ot[k].date < yd) { yClose = ot[k].close; break; }
    var cut = s.recordDateBasis !== 'us' ? yd : daysAgo(2);
    var beforeTx = txs.filter(function (t) { return t.date.slice(0, 10) < cut; }), En = E.compute(s, beforeTx, mid);
    var noY = yClose == null || isRev, yOrders = En.phase === '종료' || noY ? [] : E.orders(En, s, undefined, yClose);
    var uptoTx = txs.filter(function (t) { return t.date.slice(0, 10) <= cut; }), yAfter;
    if (!noY && uptoTx.length !== beforeTx.length) { var B2 = E.compute(s, uptoTx, mid);
      if (B2.phase !== '종료') { var he = E.orders(B2, s, undefined, yClose); if (JSON.stringify(he) !== JSON.stringify(yOrders)) yAfter = he; } }
    var hist = E.history(s, txs, mid), realized = E.realizedDetail(txs, hist);
    var pnl = st.totalReturned - st.totalInvested, pnlPct = st.totalInvested > 0 ? pnl / st.totalInvested * 100 : 0;
    var tgt = E.targetOf(s.ticker, s.targetProfit), backPrice = st.avgPrice > 0 ? Math.round(st.avgPrice * (1 - tgt / 100) * 100) / 100 : 0;
    var cycleKey = txs.length > 0 ? ses.id + ':' + txs[0].id : '';
    var days = txs.length >= 2 ? Math.max(1, Math.floor((new Date(txs[txs.length - 1].date) - new Date(txs[0].date)) / 864e5) + 1) : Math.max(1, txs.length);
    var range = txs.length >= 2 ? (function () { var a = new Date(txs[0].date), z = new Date(txs[txs.length - 1].date), f = function (d) { return (d.getMonth() + 1) + '/' + d.getDate(); }; return f(a) + ' — ' + f(z); })() : undefined;
    return { ses: ses, s: s, txs: txs, mid: mid, isRev: isRev, rStar: rStar, st: st, isCustom: isCustom, cur: cur, orderDone: orderDone,
      revAfter: revAfter, revFirstDay: revFirstDay, mk: mk, hn: hn, manual: manual, ot: ot, failed: failed, rsiPrices: rsiPrices, rsiVal: rsiVal,
      vix: vix, a5: a5, close: close, recDate: recDate, recorded: recorded, bigMax: bigMax, orders: orders, yd: yd, yClose: yClose,
      yOrders: yOrders, yAfter: yAfter, hist: hist, realized: realized, pnl: pnl, pnlPct: pnlPct, tgt: tgt, backPrice: backPrice,
      phaseLabel: isRev ? '리버스모드' : st.phase, cycleKey: cycleKey, celebrate: st.phase === '종료' && pnl > 0 && cycleKey !== '',
      days: days, range: range, settling: closeSettling(MH.now), fx: MH.fx };
  }
  /* 사이클 시작 (복리/단리/원금·분할 변경) — 현재 사이클을 완료 목록에 보관하고 새로 시작 */
  function startNewCycle(capital, splits) {
    mut(function () {
      var ses = active();
      if (ses.settings && ses.transactions.length > 0) {
        var u = E.compute(ses.settings, ses.transactions, ses.midEntry), d = u.totalReturned - u.totalInvested;
        ses.archivedCycles.push({ id: uid(), settings: ses.settings, transactions: ses.transactions, totalInvested: u.totalInvested,
          totalReturned: u.totalReturned, pnl: r2(d), pnlPercent: r2(u.totalInvested > 0 ? d / u.totalInvested * 100 : 0),
          archivedAt: new Date().toISOString(), midEntry: ses.midEntry || null });
      }
      if (ses.settings) { ses.settings = Object.assign({}, ses.settings, { totalCapital: capital }); if (splits) ses.settings.splits = splits; }
      ses.transactions = []; ses.isReverseMode = false; ses.reverseStarPrice = null; ses.midEntry = null;
    });
    MH.restartOpen = false;
  }
  /* ════ 화면 그리기 ════ */
  var _charts = [];
  function render() {
    var root = $('mh-root'); if (!root) return;
    root.style.zoom = MH.fontScale;
    _charts.forEach(function (c) { try { c.destroy(); } catch (e) {} }); _charts = [];
    var ses = active(), html = '';
    if (live().length > 1) html += viewSessionTabs();
    if (!ses.settings) { if (!MH.setup || MH.setup.sid !== ses.id) MH.setup = newSetup(ses.id); html += viewSetup(); }
    else {
      var tk = (ses.settings.currency || 'USD') === 'KRW' ? '' : ses.settings.ticker;
      if (tk && !MH.market[tk] && MH.marketTicker !== tk) { MH.marketTicker = tk; loadMarket(tk); }
      if (!MH.fear && !MH._fearReq) { MH._fearReq = true; loadMarket(tk || 'TQQQ'); }
      var D = derive(); html += viewTop(D) + (MH.view === 'an' ? viewAnalysis() : viewNow(D));
      if ((D.st.phase !== '종료' || D.isRev) && !MH.menu) html += '<button class="mh-fab" data-act="rec-open">＋ 오늘 기록하기</button>';
      if (D.celebrate && localStorage.getItem('muhan4-celebrated:' + D.cycleKey) == null && !MH.sheet) MH.sheet = { kind: 'celebrate', key: D.cycleKey };
    }
    root.innerHTML = html + '<div id="mh-sheet-host">' + (MH.sheet ? viewSheet() : '') + '</div>' + (MH.pop ? viewPop() : '');
    initCharts();
  }

  /* ── 세션 탭 ── */
  function viewSessionTabs() {
    var act = active().id, all = store.sessions;
    return '<div class="mh-stabs" data-noswipe>' + live().map(function (ss) {
      var idx = all.indexOf(ss), on = ss.id === act, col = colorHex(ss.color);
      var t = ss.settings && ss.transactions.length > 0 ? E.compute(ss.settings, ss.transactions).tValue : null;
      var sty = on && col ? ' style="background:' + rgba(col, .15) + ';color:' + col + ';border-color:' + rgba(col, .35) + '"' : '';
      return '<div class="mh-stab" draggable="true" data-drag="' + idx + '"><button class="mh-stab-b' + (on ? ' on' : '') + '"' + sty + ' data-act="ses-go" data-v="' + ss.id + '">' +
        '<span>' + (col && !on ? '<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:' + col + ';margin-right:5px"></span>' : '') + esc(ss.name) +
        (t !== null ? '<span class="t">T' + t.toFixed(1) + '</span>' : '') + '</span>' + (ss.nickname ? '<span class="nick">' + esc(ss.nickname) + '</span>' : '') + '</button>' +
        '<button class="mh-ico" data-act="ses-menu" data-v="' + ss.id + '" aria-label="세션 메뉴">⋮</button></div>';
    }).join('') + '<button class="mh-ico" data-act="ses-add" title="새 세션 추가" style="font-size:18px">＋</button></div>';
  }
  function viewPop() {
    var p = MH.pop, n = live().length;
    return '<div class="mh-overlay" data-act="pop-close"></div><div class="mh-pop" style="top:' + p.top + 'px;left:' + p.left + 'px">' +
      '<button data-act="ses-rename" data-v="' + p.id + '">🎨 이름·색상</button>' +
      (n > 1 ? '<button data-act="ses-archive" data-v="' + p.id + '">📦 보관</button><button data-act="ses-del" data-v="' + p.id + '" class="mh-bad">삭제</button>' : '') + '</div>';
  }

  /* ── 설정 화면 (새로 시작 / 중간 진입) ── */
  function newSetup(sid) { return { sid: sid, ticker: 'TQQQ', custom: false, name: '', currency: 'USD', close: '', tick: '', splits: 40, mid: false,
    cap: '', avg: '', qty: '', cash: '', t: '', target: String(E.defaultTarget('TQQQ')), big: '12', shares: '1', lines: '8' }; }
  function setupCalc(u) {
    var cap = Number(u.cap) || 0, avg = Number(u.avg) || 0, qty = Number(u.qty) || 0, cash = Number(u.cash) || 0, T = Number(u.t) || 0;
    var total = avg * qty + cash, one = u.mid ? (total > 0 && u.splits - T > 0 ? cash / (u.splits - T) : 0) : (cap > 0 ? cap / u.splits : 0);
    var tg = Number(u.target), bg = Number(u.big), sh = Number(u.shares), ln = Number(u.lines);
    var okT = isFinite(tg) && tg > 0 && tg <= 50, okB = isFinite(bg) && bg >= 0 && bg <= 40, okS = isFinite(sh) && sh >= 1 && sh <= 20 && Number.isInteger(sh),
        okL = isFinite(ln) && ln >= 1 && ln <= 80 && Number.isInteger(ln);
    var tk = u.custom ? u.name.trim() : u.ticker, sp = E.starPercent(tk, u.splits, T, okT ? tg : undefined), star = avg > 0 ? E.priceAt(avg, sp) : 0;
    var midOK = avg > 0 && qty > 0 && cash > 0 && T > 0 && T < u.splits;
    return { cap: cap, total: total, one: one, T: T, star: star, midOK: midOK, valid: okT && okB && okS && okL && (u.mid ? midOK : cap > 0) };
  }
  function viewSetup() {
    var u = MH.setup, sym = u.currency === 'KRW' ? '₩' : '$';
    var tickerBtns = ['TQQQ', 'SOXL'].map(function (t) { return '<button class="mh-btn' + (!u.custom && u.ticker === t ? ' mh-btn-sel' : '') + '" style="flex:1;font-weight:700" data-act="su-ticker" data-v="' + t + '">' + t + '</button>'; }).join('') +
      '<button class="mh-btn' + (u.custom ? ' mh-btn-sel' : '') + '" style="flex:1" data-act="su-custom">⚙ 커스텀</button>';
    var splitBtn = function (n) { return '<button class="mh-btn' + (u.splits === n ? ' mh-btn-sel' : '') + '" data-act="su-splits" data-v="' + n + '">' + n + '분할</button>'; };
    var field = function (lbl, hint, key, step, min, max, help) {
      return '<div><div class="mh-row" style="margin-bottom:6px"><label class="mh-lbl" style="margin:0">' + lbl + '</label><span class="mh-tiny mh-faint">' + hint + '</span></div>' +
        '<input class="mh-in" type="number" step="' + step + '" min="' + min + '" max="' + max + '" value="' + esc(u[key]) + '" data-in="su:' + key + '">' +
        '<p class="mh-help">' + help + '</p></div>';
    };
    var custom = u.custom ? '<div class="mh-note warn" style="margin-top:10px">⚠ <b>라오어가 추천하지 않는 비표준 모드</b>입니다. 종목명·통화·종가를 직접 관리하셔야 하며, TQQQ/SOXL 관련 자동 시세·차트 기능은 숨겨집니다.</div>' +
      '<div style="margin-top:10px"><label class="mh-lbl">종목명</label><input class="mh-in" style="font-family:var(--font)" type="text" maxlength="32" placeholder="예: 삼성전자 / 005930 / 나스닥100 ETF" value="' + esc(u.name) + '" data-in="su:name"></div>' +
      '<div style="margin-top:10px"><label class="mh-lbl">통화</label><div style="display:flex;gap:6px"><button class="mh-btn' + (u.currency === 'USD' ? ' mh-btn-sel' : '') + '" style="flex:1" data-act="su-cur" data-v="USD">USD ($)</button><button class="mh-btn' + (u.currency === 'KRW' ? ' mh-btn-sel' : '') + '" style="flex:1" data-act="su-cur" data-v="KRW">KRW (₩)</button></div></div>' +
      '<div style="margin-top:10px"><label class="mh-lbl">오늘 종가 (선택)</label><input class="mh-in" type="number" min="0" step="' + (u.currency === 'KRW' ? '1' : '0.01') + '" placeholder="' + (u.currency === 'KRW' ? '예: 68000' : '예: 75.62') + '" value="' + esc(u.close) + '" data-in="su:close"><p class="mh-help">별지점·큰수·LOC 주문가 계산에 사용. 대시보드에서도 매일 갱신할 수 있어요</p></div>' +
      '<div style="margin-top:10px"><label class="mh-lbl">호가 단위 (선택)</label><input class="mh-in" type="number" min="0" step="1" placeholder="미입력 시 스냅 없음" value="' + esc(u.tick) + '" data-in="su:tick"><p class="mh-help">모든 주문·기준 가격을 이 단위(원)로 맞춰줘요. 비워두면 스냅 안 함</p></div>' : '';
    var amounts = u.mid ?
      '<div class="mh-grid2">' + [['avg', '평단가 (' + sym + ')', '0.0001', '현재 평균매수가'], ['qty', '보유수량 (주)', '1', '현재 보유 주수'], ['cash', '잔금 (' + sym + ')', '0.01', '남은 투자금'], ['t', 'T값', '0.5', '현재 T값']]
        .map(function (f) { return '<div><label class="mh-lbl">' + f[1] + '</label><input class="mh-in" type="number" step="' + f[2] + '" placeholder="' + f[3] + '" value="' + esc(u[f[0]]) + '" data-in="su:' + f[0] + '"></div>'; }).join('') + '</div>' :
      '<div><label class="mh-lbl">원금 (' + sym + ')</label><input class="mh-in" type="number" placeholder="' + (u.currency === 'KRW' ? '30000000' : '20000') + '" value="' + esc(u.cap) + '" data-in="su:cap"></div>';
    return '<div style="text-align:center;padding:18px 0 14px"><h1 style="margin:0;font-size:22px;font-weight:800">무한매수법</h1><p class="mh-ac" style="margin:2px 0 10px;font-weight:700">V4.0</p>' +
      '<button class="mh-btn" style="font-size:12px" data-act="code-import">☁ 코드로 데이터 불러오기</button></div>' +
      '<div class="mh-card" style="padding:18px;display:flex;flex-direction:column;gap:18px">' +
      '<div><label class="mh-lbl">종목</label><div style="display:flex;gap:6px">' + tickerBtns + '</div>' + custom + '</div>' +
      '<div><label class="mh-lbl">분할 수</label><div class="mh-grid3">' + E.STD_SPLITS.map(splitBtn).join('') + '</div>' +
      '<p class="mh-tiny" style="margin:8px 0 6px"><span class="mh-warn" style="font-weight:700">⚠ 비권장</span> <span class="mh-faint">라오어 문서 범위(20~40) 밖</span></p>' +
      '<div class="mh-grid3">' + E.EXT_SPLITS.map(splitBtn).join('') + '</div><p class="mh-help">적을수록 공격적, 클수록 안정적</p></div>' +
      field('목표 수익률 (%)', '기본 ' + E.defaultTarget(u.custom ? u.name : u.ticker) + '% (라오어 원칙)', 'target', '0.5', '1', '50', '별%, 지정가매도 가격, 리버스 복귀 조건에 적용됩니다') +
      field('큰수 % (종가 × 배수)', '기본 12% · 범위 0~40%', 'big', '0.5', '0', '40', '증권사 LOC 상한 회피용 매수 가격. 낮을수록 보수적(체결 조건 까다로움), 높을수록 공격적. 급등락장에서 조정 필요') +
      field('하방 LOC 줄 수', '기본 8줄 · 범위 1~80줄', 'lines', '1', '1', '80', '메인 매수 아래 LOC를 몇 줄 깔지 설정. 값이 클수록 더 깊은 하락까지 대비 (처음매수는 +2줄)') +
      field('하방 LOC 주식 수 (1줄당)', '기본 1주 · 범위 1~20주', 'shares', '1', '1', '20', '하방 LOC 1줄에 몇 주씩 걸지 설정. 값이 클수록 LOC 가격 간격이 넓어져 촘촘함이 줄어듦. 투자금이 클 때 활용') +
      '<div style="display:flex;gap:6px"><button class="mh-btn' + (!u.mid ? ' mh-btn-sel' : '') + '" style="flex:1" data-act="su-mid" data-v="0">새로 시작</button><button class="mh-btn' + (u.mid ? ' mh-btn-sel' : '') + '" style="flex:1" data-act="su-mid" data-v="1">중간 진입</button></div>' +
      amounts + '<div id="mh-su-dyn">' + setupDyn() + '</div></div>' +
      '<p class="mh-small mh-faint" style="text-align:center">초심자는 TQQQ 추천, 익숙해지면 SOXL</p>';
  }
  function setupDyn() {
    var u = MH.setup, c = setupCalc(u), sym = u.currency === 'KRW' ? '₩' : '$', rows = [];
    if (u.mid && c.midOK) rows = [['원금 (자동계산)', sym + c.total.toLocaleString()], ['분할', u.splits + '회'], ['T값', String(c.T)], ['별지점', sym + c.star.toFixed(2)], ['1회 매수금', sym + c.one.toFixed(2)]];
    if (!u.mid && c.cap > 0) rows = [['원금', sym + c.cap.toLocaleString()], ['분할', u.splits + '회'], ['1회 매수금', sym + c.one.toFixed(2)]];
    return (rows.length ? '<div class="mh-note" style="margin-bottom:12px">' + rows.map(function (r, i) {
        return '<div class="mh-row" style="padding:3px 0' + (i === rows.length - 1 ? ';border-top:1px solid var(--m-bd);margin-top:4px;padding-top:7px' : '') + '"><span>' + r[0] + '</span><span class="mh-mono' + (i === rows.length - 1 ? ' mh-ac' : '') + '" style="font-weight:600">' + r[1] + '</span></div>'; }).join('') + '</div>' : '') +
      '<button class="mh-btn mh-btn-p" style="width:100%;padding:14px;font-size:15px" data-act="su-start"' + (c.valid ? '' : ' disabled') + '>' + (u.mid ? '중간 진입하기' : '시작하기') + '</button>';
  }

  /* ── 상단 바 + ⋮ 메뉴 ── */
  function toggleRow(title, on, act, help, extra) {
    return '<div class="mh-msec"><div class="mh-row"><span style="font-size:13px">' + title + '</span><button class="mh-toggle' + (on ? ' on' : '') + '" data-act="' + act + '" aria-pressed="' + on + '"></button></div>' +
      '<div class="mh-tiny mh-faint" style="margin-top:4px;line-height:1.5">' + help + '</div>' + (extra || '') + '</div>';
  }
  function applyRow(title, hint, id, val, unit, step, min, max, act, help) {
    return '<div class="mh-msec"><div class="mh-row"><span style="font-size:13px">' + title + '</span><span class="mh-tiny mh-faint">' + hint + '</span></div>' +
      '<div class="mh-mrow" style="margin-top:6px"><input class="mh-in" id="' + id + '" type="number" step="' + step + '" min="' + min + '"' + (max ? ' max="' + max + '"' : '') + ' value="' + esc(val) + '">' +
      (unit ? '<span class="mh-small mh-faint">' + unit + '</span>' : '') + '<button class="mh-btn mh-btn-sel" style="padding:6px 10px;font-size:12px" data-act="' + act + '">적용</button></div>' +
      '<div class="mh-tiny mh-faint" style="margin-top:4px">' + help + '</div></div>';
  }
  function viewMenu(D) {
    var s = D.s, cur = D.cur, nArch = store.sessions.length - live().length;
    var sb = function (n) { return '<button class="mh-btn' + (s.splits === n ? ' mh-btn-sel' : '') + '" style="padding:6px 4px;font-size:12px" data-act="m-splits" data-v="' + n + '">' + n + '</button>'; };
    return '<div class="mh-overlay" data-act="menu-close"></div><div class="mh-menu" data-noswipe>' +
      '<div class="mh-msec"><div class="mh-row"><span style="font-size:13px">글자 크기</span><span class="mh-small mh-ac mh-mono">' + Math.round(MH.fontScale * 100) + '%</span></div>' +
      '<input class="mh-slider" type="range" min="1" max="1.3" step="0.05" value="' + MH.fontScale + '" data-in="font"><div class="mh-row mh-tiny mh-faint"><span>보통</span><span>최대</span></div></div>' +
      toggleRow('주문 체크리스트', MH.todo, 'tg-todo', '주문표에서 넣은 주문 체크 · 다음날 자동 초기화') +
      toggleRow('RSI 표시', MH.rsiOn, 'tg-rsi', '14일 RSI 참고 지표 · 무한매수법 계산에는 영향 없음', MH.rsiOn ? '<div style="display:flex;gap:6px;margin-top:6px">' +
        [['sma', '증권사식'], ['wilder', '와일더']].map(function (m) { return '<button class="mh-btn' + (MH.rsiMethod === m[0] ? ' mh-btn-sel' : '') + '" style="flex:1;padding:5px;font-size:12px" data-act="rsi-m" data-v="' + m[0] + '">' + m[1] + '</button>'; }).join('') +
        '</div><div class="mh-tiny mh-faint" style="margin-top:4px">증권사식(SMA) = 메리츠 등 국내 HTS와 같은 값 · 와일더 = TradingView·investing.com 기준</div>' : '') +
      toggleRow('VIX 표시', MH.vixOn, 'tg-vix', '시장 변동성 지수 · 무한매수법 계산에는 영향 없음') +
      toggleRow('전일자(미국 거래일) 기준', s.recordDateBasis === 'us', 'tg-basis', '기록 기본 날짜를 미국 거래일(전일)로 · 종가 자동입력·추천도 맞춤') +
      applyRow('목표 수익률', '기본 ' + E.defaultTarget(s.ticker) + '%', 'mh-m-target', E.targetOf(s.ticker, s.targetProfit), '%', '0.5', '1', '50', 'ap-target', '별%, 지정가매도, 리버스복귀에 적용') +
      applyRow('큰수 %', '기본 12% · 0~40', 'mh-m-big', E.bigNumOf(s.bigNumPercent), '%', '0.5', '0', '40', 'ap-big', '큰수 매수가 = 종가 × (1+%/100). 급등락장에서 조정') +
      toggleRow('큰수 미사용 (별지점만)', s.disableBigNum === true, 'tg-nobig', '큰수로 안 낮추고 항상 별지점에 LOC 매수 (거부 한도 증권사별 상이: 메리츠 ~120% 주의 · 키움 ~150% 여유 · 처음매수 제외)') +
      applyRow('하방 LOC 줄 수', '기본 8줄 · 1~80', 'mh-m-lines', E.locLines(s.lowerLocLines), '줄', '1', '1', '80', 'ap-lines', '메인 매수 아래 LOC 줄 수. 클수록 더 깊은 하락까지 대비 (처음매수 +2)') +
      applyRow('하방 LOC 주식 수', '기본 1주 · 1~20', 'mh-m-shares', E.locShares(s.lowerLocShares), '주', '1', '1', '20', 'ap-shares', '하방 LOC 1줄당 주식 수. 클수록 가격 간격 넓어짐') +
      (D.isCustom ? applyRow('호가 단위', '', 'mh-m-tick', s.tickSize || '', cur === 'KRW' ? '원' : '', '1', '0', '', 'ap-tick', '모든 주문·기준 가격을 이 단위로 맞춤. 비우면 스냅 안 함') : '') +
      '<div class="mh-msec"><div class="mh-row"><span style="font-size:13px">분할 수</span><span class="mh-tiny mh-faint">현재 ' + s.splits + '분할</span></div>' +
      '<div class="mh-grid3" style="margin-top:6px">' + E.STD_SPLITS.map(sb).join('') + '</div><div class="mh-tiny" style="margin:6px 0"><span class="mh-warn">⚠ 비권장</span> <span class="mh-faint">라오어 문서 범위(20~40) 밖</span></div>' +
      '<div class="mh-grid3">' + E.EXT_SPLITS.map(sb).join('') + '</div>' + (D.txs.length > 0 ? '<div class="mh-tiny mh-warn" style="margin-top:6px">⚠ 진행 중인 거래가 있어요. 변경 시 계산 재산출</div>' : '') + '</div>' +
      applyRow('원금 (' + (cur === 'KRW' ? '₩' : '$') + ')', '현재 ' + fmtL(s.totalCapital, cur), 'mh-m-cap', s.totalCapital, '', '1', '1', '', 'ap-cap', '잔금/매수금 계산 기준. 추가 입금 시 늘리기') +
      '<div class="mh-msec"><button class="mh-mbtn mh-ac" data-act="code-export">☁ 코드 내보내기</button><button class="mh-mbtn" data-act="code-import">☁ 코드로 불러오기</button></div>' +
      '<div class="mh-msec"><button class="mh-mbtn mh-ac" data-act="ses-add">세션 추가</button><button class="mh-mbtn" data-act="archive-box">📦 보관함' + (nArch > 0 ? ' (' + nArch + ')' : '') + '</button>' +
      (live().length > 1 ? '<button class="mh-mbtn" data-act="ses-archive" data-v="' + D.ses.id + '">📦 이 세션 보관</button>' : '') +
      '<button class="mh-mbtn mh-bad" data-act="ses-reset">세션 초기화</button>' + (live().length > 1 ? '<button class="mh-mbtn mh-bad" data-act="ses-del" data-v="' + D.ses.id + '">세션 삭제</button>' : '') + '</div></div>';
  }
  function viewTop(D) {
    var s = D.s, col = colorHex(D.ses.color);
    return '<div class="mh-top"' + (col ? ' style="border-bottom:3px solid ' + rgba(col, .55) + '"' : '') + '><div class="mh-row" style="position:relative">' +
      '<div style="min-width:0"><div style="display:flex;align-items:center;gap:6px"><h1 style="margin:0;font-size:17px;font-weight:800">무한매수법 4.0</h1>' +
      ((D.isCustom || E.isExtSplits(s.splits)) ? '<span class="mh-chip mh-chip-warn">⚠ 비추천</span>' : '') + '</div>' +
      '<div style="display:flex;align-items:center;gap:5px;margin-top:3px;flex-wrap:wrap"><span class="mh-small mh-muted">' + esc(s.ticker) + ' · ' + s.splits + '분할 · ' + (D.cur === 'KRW' ? '₩' : '$') + s.totalCapital.toLocaleString() + '</span>' +
      (MH.todo ? '<span class="mh-chip ' + (D.orderDone ? 'mh-chip-ac' : 'mh-chip-warn') + '">' + (D.orderDone ? '주문 ✓' : '주문 전') + '</span>' : '') +
      '<span class="mh-chip ' + (D.recorded ? 'mh-chip-ac' : 'mh-chip-warn') + '">' + (D.recorded ? '기록 ✓' : '기록 전') + '</span></div></div>' +
      '<div style="display:flex;align-items:center;gap:4px;flex-shrink:0"><button class="mh-btn" style="padding:5px 9px;font-size:11px" data-act="code-export">☁ 코드</button>' +
      '<button class="mh-ico" style="font-size:20px" data-act="menu" aria-label="설정 메뉴">⋮</button>' + (MH.menu ? viewMenu(D) : '') + '</div></div></div>' +
      '<div class="mh-tabs"><button class="mh-tab' + (MH.view !== 'an' ? ' on' : '') + '" data-act="view" data-v="now">현재</button>' +
      '<button class="mh-tab' + (MH.view === 'an' ? ' on' : '') + '" data-act="view" data-v="an">분석' + (D.ses.archivedCycles.length > 0 ? ' (' + D.ses.archivedCycles.length + ')' : '') + '</button>' +
      (MH.view === 'an' ? '<button class="mh-btn" style="margin-left:auto;padding:5px 10px;font-size:12px" data-act="export">⤓ 내보내기</button>' : '') + '</div>';
  }
  /* ── 현재 탭 ── */
  function safe(fn, D) { try { return fn(D); } catch (e) { if (window.console) console.error('[MUHAN] ' + (fn.name || 'card'), e);
    return '<div class="mh-note bad" style="margin-bottom:10px">⚠️ 카드를 표시하지 못했어요 (' + esc(fn.name || '') + ': ' + esc(e && e.message) + '). 새로고침 후에도 반복되면 알려주세요.</div>'; } }
  function stat(k, v, cls, sub) { return '<div class="mh-stat"><div class="k">' + k + '</div><div class="v ' + (cls || '') + '">' + v + '</div>' + (sub ? '<div class="s">' + sub + '</div>' : '') + '</div>'; }
  function info(act, label) { return '<button class="mh-ico" style="font-size:12px;padding:2px 4px" data-act="' + act + '" aria-label="' + label + '">ⓘ</button>'; }
  function viewNow(D) {
    var s = D.s, st = D.st, cur = D.cur, h = '', pct = Math.min(100, st.tValue / s.splits * 100);
    /* T-VALUE */
    h += '<div class="mh-card" style="padding:16px"><div class="mh-row"><div><div class="mh-tiny mh-muted" style="letter-spacing:.08em">T-VALUE</div>' +
      (st.phase === '종료' ? '<div style="font-size:22px;font-weight:800;margin-top:4px">회차 종료</div>' :
        '<div style="margin-top:2px"><span class="mh-mono" style="font-size:34px;font-weight:800">' + String(Math.round(st.tValue * 1e5) / 1e5) + '</span><span class="mh-mono mh-faint" style="font-size:18px"> / ' + s.splits + '</span></div>') +
      '</div><span class="mh-chip ' + (D.isRev ? 'mh-chip-bad' : 'mh-chip-ac') + '" style="font-size:11px;padding:4px 10px">' + D.phaseLabel + '</span></div>' +
      '<div class="mh-bar" style="margin-top:12px"><i style="width:' + pct + '%"></i></div><div class="mh-row mh-tiny mh-faint mh-mono" style="margin-top:5px"><span>0</span><span>' + (s.splits / 2) + '</span><span>' + s.splits + '</span></div></div>';
    /* 평단/보유/잔금 */
    h += '<div class="mh-grid3" style="margin-bottom:8px">' + stat('평단가', st.avgPrice > 0 ? fmt(st.avgPrice, cur, 4) : '-') + stat('보유수량', st.totalQuantity + '주') + stat('잔금', fmtL(st.remainingCapital, cur)) + '</div>';
    if (st.avgPrice > 0 && st.totalQuantity > 0) {
      if (MH.loading && !D.close) h += '<div class="mh-grid2" style="margin-bottom:8px"><div class="mh-stat" style="height:52px;opacity:.5"></div><div class="mh-stat" style="height:52px;opacity:.5"></div></div>';
      else if (D.close) { var pr = (D.close - st.avgPrice) / st.avgPrice * 100;
        h += '<div class="mh-grid2" style="margin-bottom:8px">' + stat('보유수익률', sign(pr) + pr.toFixed(2) + '%', D.close >= st.avgPrice ? 'mh-ok' : 'mh-bad') +
          stat('평가금액', fmt(D.close * st.totalQuantity, cur, 2), '', cur === 'USD' && D.fx ? '(₩' + Math.round(D.close * st.totalQuantity * D.fx.rate).toLocaleString() + ')' : '') + '</div>'; }
    }
    if (st.realizedCost > 0) {
      var rp = st.realizedPnL / st.realizedCost * 100;
      h += '<div class="mh-card"><div class="mh-row"><div style="display:flex;align-items:center;gap:2px"><span class="mh-h3">이번 사이클 실현 손익</span>' + info('i-realized', '실현 손익 계산법 안내') + '</div>' +
        '<button class="mh-btn" style="padding:4px 9px;font-size:11px" data-act="realized-detail">매도 ' + D.realized.length + '건 상세 ›</button></div>' +
        '<div style="margin-top:6px"><span class="mh-mono ' + (st.realizedPnL >= 0 ? 'mh-ok' : 'mh-bad') + '" style="font-size:20px;font-weight:800">' + sign(st.realizedPnL) + fmt(st.realizedPnL, cur, 2) + '</span> ' +
        '<span class="mh-small mh-mono ' + (st.realizedPnL >= 0 ? 'mh-ok' : 'mh-bad') + '">(' + sign(rp) + rp.toFixed(2) + '%)</span>' +
        (cur === 'USD' && D.fx ? ' <span class="mh-tiny mh-faint mh-mono">≈ ₩' + Math.round(st.realizedPnL * D.fx.rate).toLocaleString() + '</span>' : '') + '</div>' +
        '<p class="mh-help">매도로 확정된 손익 · 보유분 평가는 보유수익률 참고</p></div>';
    }
    if (D.isRev) {
      var sq = st.totalQuantity > 0 ? Math.max(1, Math.floor(st.totalQuantity / (s.splits / 2))) + '주' : '-';
      h += '<div class="mh-grid3" style="margin-bottom:8px">' + stat('매도수량', sq, 'mh-rev') + stat('쿼터매수금', fmt(st.remainingCapital / 4, cur, 2), 'mh-info') + stat('복귀가격', D.backPrice > 0 ? fmt(D.backPrice, cur, 2) : '-', 'mh-ok') + '</div>';
      h += '<div class="mh-card"><div class="mh-row"><div><div class="mh-h3">리버스 별지점</div><p class="mh-tiny mh-faint" style="margin:2px 0 0">직전 5거래일 종가 평균</p></div>' +
        '<button class="mh-btn mh-btn-sel" style="padding:5px 10px;font-size:12px" data-act="rev-off">일반모드 복귀</button></div>' +
        '<div class="mh-mrow" style="margin-top:8px"><span class="mh-faint">' + (cur === 'KRW' ? '₩' : '$') + '</span><input class="mh-in" type="number" step="0.01" placeholder="' + (D.a5 != null ? '5일 평균 ' + fmt(D.a5, cur, 2) : '5일 평균 종가 입력') + '" value="' + (D.rStar != null ? D.rStar : '') + '" data-ch="rev-star">' +
        (D.a5 != null ? '<button class="mh-btn" style="padding:8px 10px;font-size:12px" data-act="rev-auto" title="5일 평균 종가로 자동 채우기">↻ 자동</button>' : '') + '</div>' +
        (D.a5 != null ? '<p class="mh-help">' + (D.rStar === D.a5 ? '✓ 직전 5거래일 종가 평균 <span class="mh-mono mh-ac">' + fmt(D.a5, cur, 2) + '</span> 자동 적용됨' : '직전 5거래일 종가 평균: <span class="mh-mono">' + fmt(D.a5, cur, 2) + '</span> (수동 수정됨)') + '</p>' : '') +
        (D.backPrice > 0 ? '<p class="mh-help">종가가 <span class="mh-mono mh-ok">' + fmt(D.backPrice, cur, 2) + '</span> 이상이면 일반모드로 복귀 <span class="mh-faint">(평단가 -' + D.tgt + '%)</span></p>' : '') +
        (D.backPrice > 0 && D.close != null && D.close >= D.backPrice ? '<div class="mh-note ok" style="margin-top:8px"><b class="mh-ok">✅ 복귀 조건 충족</b> — 최근 종가 <b>' + fmt(D.close, cur, 2) + '</b> ≥ 복귀가격 <b>' + fmt(D.backPrice, cur, 2) + '</b>. 확인했다면 위 \'일반모드 복귀\' 버튼으로 복귀하세요 (T값 유지)</div>' : '') + '</div>';
    } else {
      h += '<div class="mh-grid3" style="margin-bottom:6px">' + stat('별%', sign(st.starPercent) + st.starPercent.toFixed(2) + '%', st.starPercent >= 0 ? 'mh-ok' : 'mh-bad') +
        stat('별지점', st.starPrice > 0 ? fmt(st.starPrice, cur, 2) : '-', 'mh-warn') + stat('1회 매수금', fmt(st.buyAmount, cur, 2), 'mh-ac', cur === 'USD' && D.fx ? '(₩' + Math.round(st.buyAmount * D.fx.rate).toLocaleString() + ')' : '') + '</div>';
    }
    if (cur === 'USD' && D.fx) h += '<div class="mh-tiny mh-faint mh-mono" style="text-align:right;margin:0 0 10px">USD/KRW <b style="color:var(--m-tx)">₩' + Number(D.fx.rate).toLocaleString(undefined, { maximumFractionDigits: 2 }) + '</b>' + (D.fx.date ? ' (' + D.fx.date + ')' : '') + '</div>';
    if (D.failed) h += '<div class="mh-note warn" style="margin-bottom:10px"><b class="mh-warn">⚠️ 종가를 불러오지 못했어요</b><br>시세 서버가 일시적으로 응답하지 않아 <b>최근 종가 · 기록 추천 · 차트</b>를 계산할 수 없습니다. 주문표는 평단가 기준이라 그대로 사용할 수 있어요.<br>잠시 후 <b>새로고침</b>하면 다시 불러옵니다.</div>';
    if (D.ot.length > 0) h += safe(viewCloses, D);
    if (D.hn.length > 0 && D.ot[D.ot.length - 1].regularHigh != null) h += safe(viewBands, D);
    if (MH.rsiOn && D.rsiVal != null && D.rsiPrices.length > 0) h += safe(viewRsi, D);
    if (D.hn.length > 0) h += safe(viewCloseChart, D);
    if (MH.vixOn && !D.isCustom && D.vix.length > 0) h += safe(viewVix, D);
    if (!D.isCustom && MH.fear) h += safe(viewFear, D);
    if (st.phase === '소진모드' && !D.isRev) h += '<div class="mh-card" style="border-color:rgba(49,130,246,.4)"><div class="mh-h3 mh-rev">소진모드 감지</div><p class="mh-small mh-muted" style="line-height:1.6">T값이 ' + (s.splits - 1) + '을 넘어 1회분 미만이 남았습니다(소진). 리버스모드로 전환하여 보유 수량을 점진적으로 매도하고 쿼터매수로 리스크를 관리할 수 있습니다.</p><button class="mh-btn" style="width:100%;border-color:rgba(49,130,246,.5);color:var(--m-rev)" data-act="rev-on">리버스모드 진입</button></div>';
    if (!D.isRev && D.revAfter && st.phase !== '소진모드' && st.totalQuantity > 0) h += '<div class="mh-card"><div class="mh-h3 mh-rev">↩ 리버스모드 재진입</div><p class="mh-small mh-muted" style="line-height:1.6">이 사이클은 리버스모드 진행 중에 일반모드로 복귀한 상태예요. <b>실수로 복귀했다면</b> 아래 버튼으로 리버스모드를 이어갈 수 있어요 (T값·기록 유지, 진행하던 날부터 계속). 정상 복귀라면 일반모드 거래를 기록하면 이 안내는 사라집니다.</p><button class="mh-btn" style="width:100%;color:var(--m-rev)" data-act="rev-reenter">↩ 리버스모드 재진입</button></div>';
    if (!D.isRev && st.phase === '처음매수') {
      var pc = D.ot.length > 0 ? D.ot[D.ot.length - 1].close : null, bp = E.bigNumOf(s.bigNumPercent), bn = pc ? Math.round(pc * (1 + bp / 100) * 100) / 100 : null;
      h += '<div class="mh-card" style="border-color:var(--m-ac-b);background:linear-gradient(180deg,var(--m-ac-s),transparent)"><div class="mh-h3 mh-ac">☆ 새 사이클 시작</div><div class="mh-grid2" style="margin:10px 0">' +
        stat('1회 매수금', fmt(st.buyAmount, cur, 2), 'mh-ac') + stat('전일 종가', pc ? fmt(pc, cur, 2) : '—') + '</div>' +
        (bn !== null ? '<p class="mh-small" style="margin:0 0 6px">★ 큰수 = 종가 × ' + (1 + bp / 100).toFixed(2) + ' = <b class="mh-warn mh-mono">' + fmt(bn, cur, 2) + '</b> <span class="mh-faint">(큰수% 설정: ' + bp + '%)</span></p>' : '') +
        '<p class="mh-small mh-muted" style="margin:0">아래 주문표대로 LOC 매수를 걸고, 체결되면 <span class="mh-ac">오늘 기록하기</span> 버튼으로 기록해주세요.</p></div>';
    }
    if (D.isCustom && D.hn.length === 0) h += safe(viewManualCloses, D);
    if ((D.isRev && D.orders.length > 0) || (!D.isRev && st.phase !== '종료' && D.orders.length > 0)) { if (D.close != null) h += safe(viewLocCap, D); h += safe(viewOrders, D); }
    if (D.isRev && D.revFirstDay) h += '<div class="mh-card" style="border-color:rgba(49,130,246,.4)"><div class="mh-h3 mh-rev">리버스모드 첫날</div><div class="mh-small mh-muted" style="line-height:1.8;margin-top:6px"><p style="margin:0"><b class="mh-rev">MOC(시장가)</b>로 무조건 매도합니다.</p><p style="margin:0">매수는 하지 않습니다. (쿼터매수는 둘째날부터)</p><p style="margin:0">매도 수량: <b class="mh-mono">' + Math.max(1, Math.floor(st.totalQuantity / (s.splits / 2))) + '주</b> (보유수량 ÷ ' + (s.splits / 2) + ')</p></div></div>';
    if (st.phase === '종료' && D.txs.length > 0) h += safe(viewCycleEnd, D);
    if (D.hist.length >= 2) h += safe(viewAvgChart, D);
    if (D.txs.length > 0) h += safe(viewHistory, D);
    return h;
  }
  function viewCloses(D) {
    var B = D.ot.slice().reverse(), cur = D.cur, a = D.ot.length >= 5 ? D.ot.slice(-5).reduce(function (x, p) { return x + p.close; }, 0) / 5 : null;
    return '<div class="mh-card">' + (D.settling ? '<div class="mh-note warn" style="margin-bottom:8px"><b class="mh-warn">⏳ 종가 확정 전</b> — 미국장 마감 직후 ~15분은 야후 종가가 공식 종가와 몇 센트 다를 수 있어요. 잠시 후 새로고침하면 확정값으로 보정됩니다.</div>' : '') +
      '<div class="mh-row" style="margin-bottom:8px"><span class="mh-h3" style="font-weight:500">' + esc(D.s.ticker) + ' 최근 종가</span>' + (a ? '<span class="mh-small mh-warn mh-mono">5일 평균 ' + fmt(a, cur, 2) + '</span>' : '') + '</div>' +
      '<div class="mh-closes">' + B.slice(0, 10).map(function (p, i) {
        var prev = B[i + 1], ch = prev ? (p.close - prev.close) / prev.close * 100 : 0, d = new Date(p.date + 'T12:00:00');
        var hasH = p.dayHigh != null && p.dayHigh > p.close, hit = D.st.limitSellPrice > 0 && p.dayHigh != null && p.dayHigh >= D.st.limitSellPrice;
        var tip = '프 ' + (p.preHigh != null ? p.preHigh.toFixed(2) : '-') + ' · 정 ' + (p.regularHigh != null ? p.regularHigh.toFixed(2) : '-') + ' · 애 ' + (p.postHigh != null ? p.postHigh.toFixed(2) : '-');
        return '<div class="mh-cl"><div class="d">' + (d.getMonth() + 1) + '/' + d.getDate() + '</div><div class="c">' + fmt(p.close, cur, 2) + '</div>' +
          (prev ? '<div class="r ' + (ch >= 0 ? 'mh-ok' : 'mh-bad') + '">' + sign(ch) + ch.toFixed(1) + '%</div>' : '') +
          (hasH ? '<div class="h' + (hit ? ' mh-bad' : '') + '" title="' + tip + '">H ' + fmt(p.dayHigh, cur, 2) + '</div>' : '') + '</div>';
      }).join('') + '</div></div>';
  }
  /* 세션별 변동폭 (프리·정규·애프터) — SVG */
  function viewBands(D) {
    var e = D.ot[D.ot.length - 1], vals = [e.preHigh, e.preLow, e.regularHigh, e.regularLow, e.postHigh, e.postLow, e.open, e.close].filter(function (v) { return v != null && v > 0; });
    if (!vals.length) return '';
    var mn = Math.min.apply(null, vals), mx = Math.max.apply(null, vals), pad = Math.max((mx - mn) * 0.12, 0.3), lo = mn - pad, hi = mx + pad;
    var W = 320, H = 204, L = 40, R = 12, T = 16, Bm = 38, w = W - L - R, ih = H - T - Bm, y = function (v) { return T + ih - (v - lo) / (hi - lo) * ih; };
    var wt = { pre: 5.5, regular: 6.5, post: 4 }, tot = 16, gap = 4, x = L, cols = {};
    ['pre', 'regular', 'post'].forEach(function (k) { var cw = w * wt[k] / tot; cols[k] = { x: x + gap / 2, w: cw - gap }; x += cw; });
    var step = (function () { var r = (hi - lo) / 3, o = Math.pow(10, Math.floor(Math.log10(r))), u = r / o; return (u <= 1 ? 1 : u <= 2 ? 2 : u <= 5 ? 5 : 10) * o; })();
    var dec = step >= 1 ? 0 : step >= 0.1 ? 1 : 2, ticks = []; for (var v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) ticks.push(Math.round(v * 1e3) / 1e3);
    var up = e.open != null && e.close >= e.open, bodyC = up ? '#3182f6' : '#f04452', edt = isEDT();
    var times = edt ? { pre: '17:00–22:30', regular: '22:30–05:00', post: '05:00–07:00' } : { pre: '18:00–23:30', regular: '23:30–06:00', post: '06:00–08:00' };
    var names = { pre: '프리', regular: '정규', post: '애프터' }, sess = { pre: [e.preHigh, e.preLow], regular: [e.regularHigh, e.regularLow], post: [e.postHigh, e.postLow] };
    var svg = ticks.map(function (t) { return '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y(t) + '" y2="' + y(t) + '" stroke="currentColor" stroke-opacity=".08"/><text x="' + (L - 6) + '" y="' + (y(t) + 3) + '" text-anchor="end" font-size="9" fill="currentColor" fill-opacity=".45">' + t.toFixed(dec) + '</text>'; }).join('');
    ['pre', 'regular', 'post'].forEach(function (k) {
      var c = cols[k], hv = sess[k][0], lv = sess[k][1], reg = k === 'regular';
      if (hv != null && lv != null) {
        svg += '<rect x="' + c.x + '" y="' + y(hv) + '" width="' + c.w + '" height="' + Math.max(1, y(lv) - y(hv)) + '" fill="' + (reg ? rgba(bodyC, .14) : 'rgba(139,149,161,.16)') + '" stroke="' + (reg ? rgba(bodyC, .5) : 'rgba(139,149,161,.4)') + '" rx="2"/>' +
          '<text x="' + (c.x + c.w / 2) + '" y="' + (y(hv) - 4) + '" text-anchor="middle" font-size="9.5" fill="currentColor" font-family="var(--mono)">' + hv.toFixed(2) + '</text>' +
          '<text x="' + (c.x + c.w / 2) + '" y="' + (y(lv) + 11) + '" text-anchor="middle" font-size="9.5" fill="currentColor" fill-opacity=".75" font-family="var(--mono)">' + lv.toFixed(2) + '</text>';
      }
      if (reg && e.open != null) { var top = Math.max(e.open, e.close), bot = Math.min(e.open, e.close); svg += '<rect x="' + (c.x + c.w * 0.3) + '" y="' + y(top) + '" width="' + (c.w * 0.4) + '" height="' + Math.max(2, y(bot) - y(top)) + '" fill="' + bodyC + '" rx="1.5"/>'; }
      svg += '<text x="' + (c.x + c.w / 2) + '" y="' + (H - 20) + '" text-anchor="middle" font-size="10" fill="currentColor">' + names[k] + '</text><text x="' + (c.x + c.w / 2) + '" y="' + (H - 8) + '" text-anchor="middle" font-size="8.5" fill="currentColor" fill-opacity=".5" font-family="var(--mono)">' + times[k] + '</text>';
    });
    var marks = [['avg', D.st.avgPrice > 0 ? D.st.avgPrice : 0, '#3182f6'], ['buy', D.st.phase !== '종료' ? D.st.buyPoint : 0, '#3182f6'], ['sell', D.st.totalQuantity > 0 ? D.st.sellPoint : 0, '#fe9800'], ['lim', D.st.totalQuantity > 0 ? D.st.limitSellPrice : 0, '#f04452']];
    marks.forEach(function (m) { if (m[1] > lo && m[1] < hi) svg += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y(m[1]) + '" y2="' + y(m[1]) + '" stroke="' + m[2] + '" stroke-dasharray="3 3" stroke-opacity=".7"/>'; });
    var d = new Date(e.date + 'T12:00:00'), chg = e.open != null && e.open > 0 ? (e.close - e.open) / e.open * 100 : null;
    return '<div class="mh-card"><div class="mh-row"><div><div class="mh-h3">' + (d.getMonth() + 1) + '/' + d.getDate() + ' 거래일</div><p class="mh-tiny mh-faint" style="margin:2px 0 0">세션별 변동폭</p></div>' +
      '<div style="text-align:right"><div class="mh-mono" style="font-weight:700">$' + e.close.toFixed(2) + '</div><div class="mh-tiny mh-mono">' + (chg != null ? '<span style="color:' + bodyC + '">' + (up ? '▲' : '▼') + ' ' + Math.abs(chg).toFixed(2) + '%</span> ' : '') + (e.open != null ? '<span class="mh-faint">시가 $' + e.open.toFixed(2) + '</span>' : '') + '</div></div></div>' +
      '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;height:auto;margin-top:6px;color:var(--m-tx)">' + svg + '</svg>' +
      '<div class="mh-row mh-tiny mh-faint" style="margin-top:4px"><span>밴드 = 고·저, 몸통 = 시가~종가 · KST</span><span class="mh-warn">' + (edt ? '☀ 서머타임' : '❄ 표준시') + '</span></div></div>';
  }
  function viewRsi(D) {
    var v = D.rsiVal, z = v >= 70 ? ['과매수', 'mh-bad'] : v <= 30 ? ['과매도', 'mh-info'] : ['중립', 'mh-muted'], last = D.rsiPrices[D.rsiPrices.length - 1].date, d = new Date(last + 'T12:00:00');
    return '<div class="mh-card"><div class="mh-row"><div style="display:flex;align-items:center;gap:2px"><span class="mh-h3" style="font-weight:500">' + esc(D.s.ticker) + ' RSI (14일)</span>' + info('i-rsi', 'RSI 설명 보기') + '</div><span class="mh-tiny mh-faint mh-mono">' + (d.getMonth() + 1) + '/' + d.getDate() + ' 종가 기준</span></div>' +
      '<div style="margin:6px 0 8px"><span class="mh-mono ' + z[1] + '" style="font-size:24px;font-weight:800">' + v.toFixed(2) + '</span> <span class="mh-chip ' + (z[1] === 'mh-bad' ? 'mh-chip-bad' : '') + '">' + z[0] + '</span></div>' +
      '<div style="position:relative;height:6px;border-radius:3px;background:linear-gradient(90deg,rgba(49,130,246,.45) 0 30%,rgba(139,149,161,.25) 30% 70%,rgba(240,68,82,.45) 70%)"><span style="position:absolute;top:-3px;left:' + Math.min(100, Math.max(0, v)) + '%;width:10px;height:10px;border-radius:50%;background:var(--m-tx);transform:translateX(-50%)"></span></div>' +
      '<div class="mh-row mh-tiny mh-faint mh-mono" style="margin-top:4px"><span>0</span><span>30 과매도</span><span>70 과매수</span><span>100</span></div>' +
      '<p class="mh-help">' + (MH.rsiMethod === 'wilder' ? '와일더(원전)' : '증권사식(SMA)') + ' · 참고 지표입니다 — 무한매수법 T값·별지점·주문가 계산에는 쓰이지 않습니다. 일봉 확정 종가 ' + D.rsiPrices.length + '개 기준.</p></div>';
  }
  var PERIODS = []; for (var _m = 1; _m <= 11; _m++) PERIODS.push([_m + 'm', _m + '달', _m * 31]); for (var _y = 1; _y <= 10; _y++) PERIODS.push([_y + 'y', _y + '년', _y * 365]);
  function periodData(D) { var p = PERIODS.filter(function (x) { return x[0] === MH.chartPeriod; })[0] || PERIODS[11], from = daysAgo(p[2]); return { p: p, list: (D.mk ? D.mk.long : []).filter(function (x) { return x.date >= from; }) }; }
  function viewCloseChart(D) {
    var pd = periodData(D), o = pd.list; if (o.length < 2) return '';
    var c = o.map(function (x) { return x.close; }), mn = Math.min.apply(null, c), mx = Math.max.apply(null, c), last = c[c.length - 1], ch = c[0] > 0 ? (last - c[0]) / c[0] * 100 : 0;
    return '<div class="mh-card"><div class="mh-row"><span class="mh-h3">' + esc(D.s.ticker) + ' 종가 추이</span><div style="display:flex;align-items:center;gap:6px">' +
      '<select class="mh-sel" data-ch="period">' + PERIODS.map(function (p) { return '<option value="' + p[0] + '"' + (p[0] === pd.p[0] ? ' selected' : '') + '>' + p[1] + '</option>'; }).join('') + '</select>' +
      '<span class="mh-small mh-mono ' + (ch >= 0 ? 'mh-ok' : 'mh-bad') + '">' + sign(ch) + ch.toFixed(1) + '%</span></div></div>' +
      '<div class="mh-grid3" style="margin:10px 0">' + stat(pd.p[1] + ' 최저', '$' + mn.toFixed(2)) + stat('현재', '$' + last.toFixed(2), 'mh-ac') + stat(pd.p[1] + ' 최고', '$' + mx.toFixed(2)) + '</div>' +
      '<div class="mh-chart"><canvas data-chart="close"></canvas></div></div>';
  }
  function viewVix(D) {
    var v = D.vix[D.vix.length - 1].close, p = D.vix.length >= 2 ? D.vix[D.vix.length - 2].close : null, d = new Date(D.vix[D.vix.length - 1].date + 'T12:00:00');
    var z = v < 20 ? ['안정', 'mh-info'] : v < 30 ? ['주의', 'mh-warn'] : v < 40 ? ['불안', 'mh-warn'] : ['공포', 'mh-bad'], ch = p ? v - p : null;
    return '<div class="mh-card"><div class="mh-row"><div style="display:flex;align-items:center;gap:2px"><span class="mh-h3" style="font-weight:500">VIX 변동성 지수</span>' + info('i-vix', 'VIX 설명 보기') + '</div><span class="mh-tiny mh-faint mh-mono">' + (d.getMonth() + 1) + '/' + d.getDate() + ' 종가 기준</span></div>' +
      '<div style="margin:6px 0 8px;display:flex;align-items:center;gap:8px"><span class="mh-mono ' + z[1] + '" style="font-size:24px;font-weight:800">' + v.toFixed(2) + '</span><span class="mh-chip">' + z[0] + '</span>' +
      (ch != null ? '<span class="mh-tiny mh-mono ' + (ch >= 0 ? 'mh-bad' : 'mh-info') + '">' + (ch >= 0 ? '▲ ' : '▼ ') + Math.abs(ch).toFixed(2) + ' (' + sign(ch) + (ch / p * 100).toFixed(2) + '%)</span>' : '') + '</div>' +
      '<div style="position:relative;height:6px;border-radius:3px;background:linear-gradient(90deg,rgba(49,130,246,.45) 0 40%,rgba(254,152,0,.4) 40% 60%,rgba(254,152,0,.4) 60% 80%,rgba(240,68,82,.5) 80%)"><span style="position:absolute;top:-3px;left:' + Math.min(100, v / 50 * 100) + '%;width:10px;height:10px;border-radius:50%;background:var(--m-tx);transform:translateX(-50%)"></span></div>' +
      '<div class="mh-row mh-tiny mh-faint mh-mono" style="margin-top:4px"><span>0</span><span>20 주의</span><span>30 불안</span><span>40 공포</span></div>' +
      '<p class="mh-help">참고 지표입니다 — 무한매수법 T값·별지점·주문가 계산에는 쓰이지 않습니다.</p></div>';
  }
  var FEAR_KO = { 'extreme fear': '극단적 공포', fear: '공포', neutral: '중립', greed: '탐욕', 'extreme greed': '극단적 탐욕' };
  var FEAR_COL = { 'extreme fear': '#f04452', fear: '#fe9800', neutral: '#fe9800', greed: '#3182f6', 'extreme greed': '#3182f6' };
  function viewFear() {
    var f = MH.fear, u = f.current, col = FEAR_COL[u.rating] || '#fe9800', lbl = FEAR_KO[u.rating] || u.rating;
    return '<div class="mh-card"><div class="mh-row"><div style="display:flex;align-items:center;gap:2px"><span class="mh-h3" style="font-weight:500">공포 &amp; 탐욕 지수</span>' + info('i-fear', '공포 탐욕 지수 설명 보기') + '</div>' +
      '<a href="https://edition.cnn.com/markets/fear-and-greed" target="_blank" rel="noopener noreferrer" class="mh-tiny mh-faint">CNN</a></div>' +
      '<div style="margin:6px 0 12px"><span class="mh-mono" style="font-size:26px;font-weight:800;color:' + col + '">' + Math.round(u.score) + '</span> <span class="mh-small" style="color:' + col + '">' + lbl + '</span></div>' +
      '<div role="button" data-act="i-fear-range" style="cursor:pointer"><div class="mh-gauge"><span class="k" style="left:' + Math.min(100, Math.max(0, u.score)) + '%"></span></div>' +
      '<div class="mh-row mh-tiny mh-faint" style="margin-top:5px"><span>극단적 공포</span><span>공포</span><span>중립</span><span>탐욕</span><span>극단적 탐욕</span></div></div>' +
      (f.historical && f.historical.length >= 2 ? '<div class="mh-chart" style="height:150px;margin-top:10px"><canvas data-chart="fear"></canvas></div>' : '') + '</div>';
  }
  function viewManualCloses(D) {
    var cur = D.cur, list = D.manual.slice().reverse();
    return '<div class="mh-card"><div class="mh-row"><label class="mh-lbl" style="margin:0">종가 직접 입력 (' + esc(D.s.ticker) + ')</label>' + (D.a5 != null ? '<span class="mh-tiny mh-warn mh-mono">5일 평균 ' + fmt(D.a5, cur, 2) + '</span>' : D.s.manualClose > 0 ? '<span class="mh-tiny mh-faint mh-mono">' + (cur === 'KRW' ? '₩' : '$') + D.s.manualClose.toLocaleString() + '</span>' : '') + '</div>' +
      '<div class="mh-mrow" style="margin-top:8px"><input class="mh-in" type="date" style="flex:1.2" value="' + MH.manualDate + '" data-in="mc-date"><input class="mh-in" type="number" style="flex:1" min="0" step="' + (cur === 'KRW' ? '1' : '0.01') + '" placeholder="' + (cur === 'KRW' ? '예: 39840' : '예: 75.62') + '" value="' + esc(MH.manualClose) + '" data-in="mc-close" data-enter="mc-add"><button class="mh-btn mh-btn-sel" data-act="mc-add">추가</button></div>' +
      (list.length ? '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px">' + list.map(function (m) { return '<span class="mh-chip" style="font-size:11px">' + m.date.slice(5).replace('-', '/') + ' <b class="mh-mono">' + fmt(m.close, cur, 2) + '</b><button class="mh-ico" style="font-size:11px;padding:0 2px" data-act="mc-del" data-v="' + m.date + '">✕</button></span>'; }).join('') + '</div>' : '') +
      '<p class="mh-help">' + (list.length ? '날짜별로 쌓으면 <b>최근 종가·5일 평균(리버스 별지점)·기록 추천</b>이 자동 종목과 똑같이 계산돼요. 같은 날짜를 다시 넣으면 수정됩니다.' : '매일 종가를 날짜별로 추가해 주세요. 별지점·큰수·LOC 주문가 계산에 사용되고, <b>5일치가 쌓이면</b> 5일 평균(리버스 별지점)도 자동 계산됩니다.') + '</p></div>';
  }
  function viewLocCap(D) {
    var q = D.mk && D.mk.quote, ms = marketState(), livePx = (ms === 'PRE' || ms === 'REGULAR') && q && q.price, base = livePx ? q.price : D.close, lbl = livePx ? '현재가' : '직전 종가';
    if (MH.capManual == null || MH.capBase !== base) { if (!MH.capEdited) MH.capVal = String(base); MH.capBase = base; }
    var v = Number(MH.capVal), ok = isFinite(v) && v > 0, cap = ok ? Math.floor(v * 1.2 * 100) / 100 : 0, cur = D.cur;
    var MS = { PRE: '프리장', REGULAR: '정규장', POST: '애프터장', CLOSED: '장 마감' };
    return '<div class="mh-card"><div class="mh-row"><div><div class="mh-h3">LOC 매수 상한 (×1.2)</div><p class="mh-tiny mh-faint" style="margin:2px 0 0">' + esc(D.s.ticker) + ' · 증권사 거부 한도 참고</p></div>' + (D.isCustom ? '' : '<span class="mh-chip">' + MS[ms] + '</span>') + '</div>' +
      '<div class="mh-mrow" style="margin-top:10px"><span class="mh-faint">' + (cur === 'KRW' ? '₩' : '$') + '</span><input class="mh-in" type="number" step="0.01" inputmode="decimal" placeholder="기준가 입력" value="' + esc(MH.capVal) + '" data-in="cap"><button class="mh-btn" style="padding:8px 10px;font-size:12px" data-act="cap-auto" title="' + lbl + '로 자동 채우기">↻ 자동</button></div>' +
      '<p class="mh-tiny mh-faint" style="margin:5px 0 8px"><span class="mh-warn">기준가</span> = ' + lbl + ' (자동 <span class="mh-mono">' + fmt(base, cur, 2) + '</span>)' + (MH.capEdited ? ' · 수동 수정됨' : '') + '</p>' +
      '<div class="mh-note mh-row" style="padding:12px"><span>LOC 매수 상한 (기준가 ×1.2)</span><span id="mh-cap-out" class="mh-mono mh-warn" style="font-size:17px;font-weight:800">' + (ok ? fmt(cap, cur, 2) : '-') + '</span></div>' +
      '<p class="mh-small" style="margin:8px 0 2px">⚠️ LOC 매수 지정가가 <b id="mh-cap-out2" class="mh-warn mh-mono">' + (ok ? fmt(cap, cur, 2) : '—') + '</b>를 초과하면 증권사에서 매수 주문이 거부될 수 있습니다.</p>' +
      '<p class="mh-tiny mh-faint" style="margin:0">시세는 최대 15분 지연될 수 있고, 종가는 마감 시 변동됩니다. 참고용으로만 사용하세요.</p></div>';
  }
  function orderRow(o, cur, withInfo) {
    var star = o.label.charAt(0) === '★';
    return '<div class="mh-obox ' + o.type + '"><div style="display:flex;align-items:center;gap:5px;min-width:0">' + (withInfo && star ? info('i-star', '별지점 설명') : '') +
      '<span class="mh-small">' + esc(o.label || 'LOC') + '</span><span class="mh-tag' + (o.method === '지정가' ? ' lim' : o.method === 'MOC' ? ' moc' : '') + '">' + o.method + '</span></div>' +
      '<div style="display:flex;align-items:center;gap:8px"><span class="p">' + (o.method === 'MOC' ? '시장가' : fmt(o.price, cur, 2)) + '</span><span class="mh-small mh-muted mh-mono">' + o.quantity + '주</span></div></div>';
  }
  function viewOrders(D) {
    var cur = D.cur, sells = D.orders.filter(function (o) { return o.type === 'sell'; }), buys = D.orders.filter(function (o) { return o.type === 'buy'; }), bp = E.bigNumOf(D.s.bigNumPercent), mx = D.bigMax;
    var notice = D.isRev && !D.revFirstDay && D.orders.some(function (o) { return o.type === 'sell' && o.method === 'MOC'; }) ? '쿼터매수금(' + fmt(D.st.remainingCapital / 4, cur, 2) + ')으로 1주도 매수할 수 없어, 매수 주문 없이 MOC 무조건매도만 시행합니다. 매도로 잔금이 쌓여 1주 매수가 가능해지면 쿼터매수가 다시 표시됩니다' : null;
    var h = '<div class="mh-card"><div class="mh-row" style="margin-bottom:8px"><span class="mh-h3">오늘의 주문</span><div style="display:flex;align-items:center;gap:6px">' +
      (D.yOrders.length > 0 ? '<button class="mh-btn" style="padding:4px 8px;font-size:11px" data-act="yesterday">↺ 어제 주문표</button>' : '') + '<span class="mh-small mh-muted">' + D.orders.length + '건</span></div></div>';
    if (D.settling) h += '<div class="mh-note warn" style="margin-bottom:8px"><b class="mh-warn">⏳ 종가 확정 전</b> — 마감 직후 ~15분은 종가가 공식 종가와 몇 센트 다를 수 있어, 아래 주문 가격이 확정 후 살짝 달라질 수 있어요. 잠시 후 새로고침 해주세요.</div>';
    if (sells.length) h += '<div class="mh-small mh-bad" style="font-weight:600;margin:4px 0 6px">● 매도</div>' + sells.map(function (o) { return orderRow(o, cur, false); }).join('');
    if (buys.length) h += '<div class="mh-small mh-ok" style="font-weight:600;margin:10px 0 6px">● 매수</div>' + buys.map(function (o) {
      var r = orderRow(o, cur, true);
      if (['★ 큰수', '★ 별지점', '★ 큰수 쿼터매수', '★ 쿼터매수'].indexOf(o.label) >= 0) {
        r += '<div class="mh-odet">' +
          (o.altPrice != null && o.price < o.altPrice ? '<div><b class="mh-warn">📈 급등 대비</b> — 종가가 큰수 위로 마감하면 이 매수가 안 잡혀요. 별지점 <b class="mh-mono mh-warn">' + fmt(o.altPrice, cur, 2) + '</b>에 LOC 매수를 걸거나 아래 슬라이더로 큰수%를 올려보세요. <span class="mh-faint">무한매수는 매일 체결이 원칙입니다.</span></div>' : '') +
          (o.altPrice != null ? '<div style="' + (o.price < o.altPrice ? 'margin-top:8px;padding-top:8px;border-top:1px solid var(--m-bd)' : '') + '"><div class="mh-row mh-tiny"><span>큰수% 실시간 조정</span><span class="mh-mono"><b class="mh-warn" id="mh-big-lbl">' + bp + '%</b> · 큰수 ' + fmt(o.price, cur, 2) + '</span></div>' +
            '<input class="mh-slider" type="range" min="0" max="' + mx + '" step="0.01" value="' + Math.min(bp, mx) + '" data-in="big-live" data-ch="big-set" data-max="' + mx + '">' +
            '<div class="mh-row mh-tiny mh-faint mh-mono"><span>0%</span><span>기본 12%</span><span>' + mx + '%' + (mx < 40 ? ' (별지점)' : '') + '</span></div></div>' : '') +
          '<div class="mh-row" style="margin-top:8px"><div><div class="mh-tiny">큰수 미사용 (별지점만)' + info('i-broker', '증권사별 한도') + '</div><div class="mh-tiny mh-faint">켜면 항상 별지점에 LOC 매수 · 거부 한도는 증권사별 상이 (ⓘ)</div></div>' +
          '<button class="mh-toggle' + (D.s.disableBigNum === true ? ' on' : '') + '" data-act="tg-nobig"></button></div></div>';
      }
      return r;
    }).join('');
    if (notice) h += '<div class="mh-note" style="margin-top:6px"><span class="mh-info">ⓘ</span> ' + notice + '</div>';
    if (MH.todo) h += '<button class="mh-done' + (D.orderDone ? ' on' : '') + '" data-act="order-done">' + (D.orderDone ? '<span class="ic">✓</span> 오늘 주문 완료 · 내일 자동 초기화' : '<span class="ic"></span> 오늘 주문 다 넣었어요') + '</button>';
    return h + '</div>';
  }
  function viewCycleEnd(D) {
    var cur = D.cur, s = D.s, win = D.pnl > 0, cmp = r2(s.totalCapital + D.pnl), meta = win ? ['🚀', '🚀 축하합니다!', '회차를 성공적으로 종료했어요'] : ['💪', '🙏 고생하셨어요', '다음 회차에서는 더 좋은 결과 있길!'];
    var h = '<div class="mh-card" style="text-align:center;border-color:' + (win ? 'var(--m-ac-b)' : 'var(--m-bd)') + '"><div style="font-size:34px">' + meta[0] + '</div><div class="mh-h3" style="font-size:17px;margin-top:4px">' + meta[1] + '</div>' +
      '<p class="mh-small mh-muted">' + D.days + '일 만에 ' + meta[2] + '</p><div class="mh-tiny mh-faint">' + (win ? '🏆 최종 수익' : '최종 손익') + '</div>' +
      '<div class="mh-mono ' + (D.pnl >= 0 ? 'mh-ok' : 'mh-bad') + '" style="font-size:26px;font-weight:800">' + sign(D.pnl) + '$' + D.pnl.toLocaleString(undefined, { maximumFractionDigits: 2 }) + '</div>' +
      '<div class="mh-small mh-mono ' + (D.pnlPct >= 0 ? 'mh-ok' : 'mh-bad') + '">' + sign(D.pnlPct) + D.pnlPct.toFixed(2) + '%</div>' +
      '<div class="mh-note" style="text-align:left;margin:12px 0">' + [['총 투자', '$' + D.st.totalInvested.toLocaleString()], ['총 회수', '$' + D.st.totalReturned.toLocaleString()], ['거래 횟수', D.txs.length + '회']].map(function (r) { return '<div class="mh-row"><span>' + r[0] + '</span><span class="mh-mono">' + r[1] + '</span></div>'; }).join('') + '</div>' +
      '<button class="mh-btn mh-btn-p" style="width:100%;margin-bottom:6px" data-act="restart" data-v="' + cmp + '">🚀 복리 재시작</button>' +
      '<button class="mh-btn" style="width:100%;margin-bottom:6px" data-act="restart" data-v="' + s.totalCapital + '">단리 재시작</button>' +
      '<button class="mh-btn" style="width:100%" data-act="restart-open"><span>⚙ 원금 / 분할 변경 후 재시작</span> <span class="mh-faint">' + (MH.restartOpen ? '▴' : '▾') + '</span></button>';
    if (MH.restartOpen) {
      var sb = function (n) { return '<button class="mh-btn' + (MH.restartSplits === n ? ' mh-btn-sel' : '') + '" style="padding:6px;font-size:12px" data-act="rs-splits" data-v="' + n + '">' + n + '분할</button>'; };
      h += '<div style="text-align:left;margin-top:10px"><div class="mh-row"><span class="mh-small">원금 (' + (cur === 'KRW' ? '₩' : '$') + ')</span><div style="display:flex;gap:4px"><button class="mh-btn" style="padding:3px 8px;font-size:11px" data-act="rs-cap" data-v="' + cmp + '" title="복리 = ' + fmtL(cmp, cur) + '">복리</button><button class="mh-btn" style="padding:3px 8px;font-size:11px" data-act="rs-cap" data-v="' + s.totalCapital + '" title="단리 = ' + fmtL(s.totalCapital, cur) + '">단리</button></div></div>' +
        '<input class="mh-in" style="margin-top:6px" type="number" step="1" min="1" value="' + esc(MH.restartCap) + '" data-in="rs-cap">' +
        '<div class="mh-row" style="margin-top:10px"><span class="mh-small">분할 수</span><span class="mh-tiny mh-faint">기존 ' + s.splits + '분할</span></div><div class="mh-grid3" style="margin-top:6px">' + E.STD_SPLITS.map(sb).join('') + '</div>' +
        '<div class="mh-tiny" style="margin:6px 0"><span class="mh-warn">⚠ 비권장</span> <span class="mh-faint">라오어 문서 범위(20~40) 밖</span></div><div class="mh-grid3">' + E.EXT_SPLITS.map(sb).join('') + '</div>' +
        '<button class="mh-btn mh-btn-p" style="width:100%;margin-top:10px" data-act="rs-apply">적용 후 재시작</button></div>';
    }
    return h + '</div>';
  }
  function viewAvgChart(D) {
    var tab = MH.avgTab || 'avg';
    return '<div class="mh-card"><div class="mh-row"><span class="mh-h3">평단가 추이</span><div style="display:flex;gap:4px">' +
      [['avg', '평단가'], ['tq', 'T값 / 보유수량'], ['pnl', '실현 손익']].map(function (t) { return '<button class="mh-tab' + (tab === t[0] ? ' on' : '') + '" style="padding:3px 8px;font-size:11px" data-act="avg-tab" data-v="' + t[0] + '">' + t[1] + '</button>'; }).join('') +
      '</div></div><div class="mh-chart" style="margin-top:8px"><canvas data-chart="avg"></canvas></div></div>';
  }
  function viewHistory(D) {
    var cur = D.cur;
    return '<div class="mh-card"><div class="mh-h3" style="margin-bottom:8px">거래 히스토리 <span class="mh-faint" style="font-weight:400">(' + D.txs.length + '건)</span></div>' + D.txs.slice().reverse().map(function (t) {
      var d = new Date(t.date), combo = E.COMBO.indexOf(t.type) >= 0;
      return '<div class="mh-hist"><div style="min-width:0"><span class="mh-faint mh-mono">' + (d.getMonth() + 1) + '/' + d.getDate() + '</span> <span class="' + TYPE_COLOR[t.type] + '" style="font-weight:600">' + TYPE_LABEL[t.type] + '</span> ' +
        (combo ? '<div class="mh-tiny mh-mono" style="margin-top:2px"><span class="mh-bad">S ' + fmt(t.sellPrice || 0, cur, 2) + ' × ' + t.sellQuantity + '</span> · <span class="mh-ok">B ' + fmt(t.price, cur, 2) + ' × ' + t.quantity + '</span></div>' :
          '<span class="mh-mono">' + fmt(t.price, cur, 2) + ' × ' + t.quantity + '</span>') + (t.tOverride !== undefined ? ' <span class="mh-chip">T 수동</span>' : '') + '</div>' +
        '<div style="display:flex;gap:2px;flex-shrink:0"><button class="mh-ico" data-act="tx-edit" data-v="' + t.id + '" aria-label="수정">✎</button><button class="mh-ico" data-act="tx-del" data-v="' + t.id + '" aria-label="삭제">✕</button></div></div>';
    }).join('') + '</div>';
  }
  /* ── 분석 탭 ── */
  function completedOf(ses, st) {   /* 진행 중이지만 전량 매도로 끝난 사이클 (재시작 전) */
    if (!ses.settings || ses.transactions.length === 0 || st.phase !== '종료') return null;
    var p = st.totalReturned - st.totalInvested, last = ses.transactions.reduce(function (a, t) { return t.date > a ? t.date : a; }, ses.transactions[0].date);
    return { id: ses.id + ':current', settings: ses.settings, transactions: ses.transactions, totalInvested: st.totalInvested, totalReturned: st.totalReturned,
      pnl: r2(p), pnlPercent: r2(st.totalInvested > 0 ? p / st.totalInvested * 100 : 0), archivedAt: last, midEntry: ses.midEntry || null };
  }
  function addMonthly(s, txs, mid, into) { if (!txs.length) return; var prev = 0; E.history(s, txs, mid).forEach(function (h) { var d = h.realizedPnL - prev; prev = h.realizedPnL; if (Math.abs(d) > 1e-6) { var k = h.date.slice(0, 7); into[k] = (into[k] || 0) + d; } }); }
  function monthlySeries(m) { var cum = 0; return Object.keys(m).sort().map(function (k) { cum += m[k]; var p = k.split('-'); return { label: p[0].slice(2) + '/' + parseInt(p[1], 10), pnl: r2(m[k]), cumulative: r2(cum) }; }); }
  function analysisData() {
    var all = store.sessions, multi = all.length > 1, scope = MH.anScope || (multi ? 'all' : active().id);
    if (scope !== 'all' && !all.some(function (s) { return s.id === scope; })) scope = 'all';
    var list = scope === 'all' ? all : all.filter(function (s) { return s.id === scope; }), aggs = {}, pending = {};
    var agg = function (c) { return aggs[c] || (aggs[c] = { currency: c, completedPnl: 0, completedCost: 0, ongoingRealized: 0, ongoingCost: 0, totalCapital: 0, invested: 0, remaining: 0, archiveCount: 0, monthly: {} }); };
    list.forEach(function (ses) {
      var cur = (ses.settings && ses.settings.currency) || 'USD', A = agg(cur), counted = !(scope === 'all' && ses.archived);
      if (counted) A.totalCapital += ses.settings ? ses.settings.totalCapital : 0;
      if (ses.settings) {
        var st = E.compute(ses.settings, ses.transactions, ses.midEntry);
        if (counted) { A.invested += st.avgPrice * st.totalQuantity; A.remaining += st.remainingCapital; }
        var c = completedOf(ses, st);
        if (c) { pending[ses.id] = c; A.completedPnl += c.pnl; A.completedCost += c.totalInvested; A.archiveCount++; }
        else { A.ongoingRealized += st.realizedPnL; A.ongoingCost += st.realizedCost; }
        addMonthly(ses.settings, ses.transactions, ses.midEntry, A.monthly);
      }
      ses.archivedCycles.forEach(function (cy) { var B = agg(cy.settings.currency || 'USD'); B.completedPnl += cy.pnl; B.completedCost += cy.totalInvested; B.archiveCount++; addMonthly(cy.settings, cy.transactions, cy.midEntry, B.monthly); });
    });
    var cards = ['USD', 'KRW'].filter(function (c) { return aggs[c]; }).map(function (c) { return aggs[c]; });
    var perSes = all.map(function (ses) { var cur = (ses.settings && ses.settings.currency) || 'USD', arch = ses.archivedCycles.reduce(function (a, c) { return a + c.pnl; }, 0);
      var st = ses.settings ? E.compute(ses.settings, ses.transactions, ses.midEntry) : null;
      return { id: ses.id, name: (ses.archived ? '📦 ' : '') + ses.name, currency: cur, pnl: arch + (st ? st.realizedPnL : 0), count: ses.archivedCycles.length + (st && completedOf(ses, st) ? 1 : 0) }; });
    var cycles = []; list.forEach(function (ses) { if (pending[ses.id]) cycles.push({ cycle: pending[ses.id], name: ses.name, sid: ses.id, pending: true });
      ses.archivedCycles.forEach(function (c) { cycles.push({ cycle: c, name: ses.name, sid: ses.id, pending: false }); }); });
    cycles.sort(function (a, b) { return a.cycle.archivedAt < b.cycle.archivedAt ? 1 : -1; });
    return { multi: multi, scope: scope, cards: cards, single: cards.length === 1, perSes: perSes, cycles: cycles };
  }
  function viewAnalysis() {
    var A = analysisData(), h = '', fx = MH.fx;
    MH._an = A;
    if (A.multi) h += '<div style="display:flex;gap:6px;overflow-x:auto;margin-bottom:10px">' + '<button class="mh-tab' + (A.scope === 'all' ? ' on' : '') + '" data-act="an-scope" data-v="all">전체 세션</button>' +
      store.sessions.map(function (s) { return '<button class="mh-tab' + (A.scope === s.id ? ' on' : '') + '" data-act="an-scope" data-v="' + s.id + '">' + (s.archived ? '📦 ' : '') + esc(s.name) + '</button>'; }).join('') + '</div>';
    A.cards.forEach(function (g, i) {
      var r = g.currency, tot = g.completedPnl + g.ongoingRealized, cost = g.completedCost + g.ongoingCost, pct = cost > 0 ? tot / cost * 100 : 0, inv = g.totalCapital > 0 ? Math.min(100, g.invested / g.totalCapital * 100) : 0;
      h += '<div class="mh-card" style="border-color:var(--m-ac-b);background:linear-gradient(180deg,var(--m-ac-s),transparent)"><div class="mh-row"><span class="mh-small mh-muted">총 실현 손익' + (A.single ? '' : ' · ' + r) + '</span><span class="mh-tiny mh-faint">' + g.archiveCount + '개 완료</span></div>' +
        '<div style="margin-top:6px"><span class="mh-mono ' + (tot >= 0 ? 'mh-ok' : 'mh-bad') + '" style="font-size:26px;font-weight:800">' + sign(tot) + fmt(tot, r, 2) + '</span> <span class="mh-small mh-mono ' + (tot >= 0 ? 'mh-ok' : 'mh-bad') + '">(' + sign(pct) + pct.toFixed(2) + '%)</span></div>' +
        (r === 'USD' && fx ? '<div class="mh-tiny mh-faint mh-mono">≈ ₩' + Math.round(tot * fx.rate).toLocaleString() + ' (₩' + Number(fx.rate).toLocaleString(undefined, { maximumFractionDigits: 2 }) + ')</div>' : '') +
        '<div class="mh-grid2" style="margin-top:12px"><div><div class="mh-tiny mh-muted">완료 사이클</div><div class="mh-mono mh-small ' + (g.completedPnl >= 0 ? 'mh-ok' : 'mh-bad') + '">' + sign(g.completedPnl) + fmt(g.completedPnl, r, 2) + '</div></div>' +
        '<div><div class="mh-tiny mh-muted">진행 중 (미완료)</div><div class="mh-mono mh-small ' + (g.ongoingRealized >= 0 ? 'mh-ok' : 'mh-bad') + '">' + sign(g.ongoingRealized) + fmt(g.ongoingRealized, r, 2) + '</div></div></div></div>';
      h += '<div class="mh-card"><div class="mh-h3">자산 현황' + (A.single ? '' : ' · ' + r) + '</div><div class="mh-grid3" style="margin:10px 0">' + stat('총 원금', fmtL(g.totalCapital, r)) + stat('투자 중', fmtL(g.invested, r), 'mh-ac') + stat('잔금', fmtL(g.remaining, r)) + '</div>' +
        '<div class="mh-row"><div class="mh-bar" style="flex:1"><i style="width:' + inv + '%"></i></div><span class="mh-tiny mh-mono">투자 ' + inv.toFixed(0) + '%</span></div><p class="mh-help">투자 중 = 보유분 원가(평단 × 보유수량). 총 원금 대비 비중</p></div>';
      var ms = monthlySeries(g.monthly);
      h += '<div class="mh-card"><div class="mh-row"><span class="mh-h3">월별 실현 손익' + (A.single ? '' : ' · ' + r) + '</span><span class="mh-tiny mh-faint">막대 = 월 손익 · 선 = 누적</span></div>' +
        (ms.length ? '<div class="mh-chart" style="margin-top:8px"><canvas data-chart="monthly" data-i="' + i + '"></canvas></div>' : '<div class="mh-note" style="text-align:center;margin-top:8px;padding:22px">아직 매도(실현) 기록이 없어요</div>') + '</div>';
      g.series = ms;
    });
    if (A.multi && A.scope === 'all') h += '<div class="mh-card"><div class="mh-h3" style="margin-bottom:8px">세션별 손익 (완료 + 진행 중)</div>' + A.perSes.map(function (p) {
      return '<button class="mh-type" data-act="an-scope" data-v="' + p.id + '"><span>' + esc(p.name) + '</span><span class="mh-small"><span class="mh-faint">' + p.count + '건</span> <b class="mh-mono ' + (p.pnl >= 0 ? 'mh-ok' : 'mh-bad') + '">' + sign(p.pnl) + fmt(p.pnl, p.currency, 2) + '</b></span></button>'; }).join('') + '</div>';
    h += '<div class="mh-small mh-muted" style="font-weight:600;margin:4px 2px 6px">완료 사이클' + (A.cycles.length ? ' <span class="mh-faint">(' + A.cycles.length + ')</span>' : '') + '</div>';
    if (!A.cycles.length) h += '<div class="mh-card mh-small mh-muted" style="text-align:center;padding:18px">아직 완료된 사이클이 없어요. 사이클을 끝내면 여기에 기록돼요.</div>';
    A.cycles.forEach(function (x) {
      var c = x.cycle, open = MH.anOpen === c.id, cur = c.settings.currency || 'USD', end = new Date(c.archivedAt), st0 = c.transactions[0] ? new Date(c.transactions[0].date) : null;
      var rng = st0 ? (st0.getMonth() + 1) + '/' + st0.getDate() + ' ~ ' + (end.getMonth() + 1) + '/' + end.getDate() : end.getFullYear() + '.' + (end.getMonth() + 1) + '.' + end.getDate();
      h += '<div class="mh-card" style="padding:0;overflow:hidden"><button class="mh-type" style="margin:0;border:0;border-radius:0;background:transparent" data-act="an-open" data-v="' + c.id + '">' +
        '<span><b>' + esc(c.settings.ticker) + '</b> <span class="mh-chip">' + c.settings.splits + '분할</span>' + (A.scope === 'all' && A.multi ? ' <span class="mh-tiny mh-faint">· ' + esc(x.name) + '</span>' : '') + (x.pending ? ' <span class="mh-chip mh-chip-warn">재시작 전</span>' : '') + '</span>' +
        '<span style="text-align:right"><span class="mh-mono mh-small ' + (c.pnl >= 0 ? 'mh-ok' : 'mh-bad') + '" style="font-weight:700">' + sign(c.pnl) + fmt(c.pnl, cur, 2) + ' (' + sign(c.pnlPercent) + c.pnlPercent.toFixed(1) + '%)</span><br><span class="mh-tiny mh-faint">' + rng + ' ' + (open ? '▴' : '▾') + '</span></span></button>';
      if (open) h += viewCycleDetail(c, !x.pending && x.sid === store.activeSessionId);
      h += '</div>';
    });
    return h;
  }
  function viewCycleDetail(c, canDel) {
    var cur = c.settings.currency || 'USD', hist = E.history(c.settings, c.transactions, c.midEntry), det = E.realizedDetail(c.transactions, hist), m = c.settings.totalCapital, v = c.settings.splits;
    MH._cycleHist = MH._cycleHist || {}; MH._cycleHist[c.id] = hist;
    return '<div style="padding:0 14px 14px"><div class="mh-row mh-small"><span class="mh-muted">사이클 당시 원금</span><span class="mh-mono">' + fmtL(m, cur) + ' <span class="mh-faint">· ' + v + '분할 · 1회 ' + fmtL(m / v, cur) + '</span></span></div>' +
      '<div class="mh-grid3" style="margin:8px 0">' + stat('총 투자', fmtL(c.totalInvested, cur)) + stat('총 회수', fmtL(c.totalReturned, cur)) + stat('손익', sign(c.pnl) + fmt(c.pnl, cur, 2), c.pnl >= 0 ? 'mh-ok' : 'mh-bad') + '</div>' +
      (det.length ? '<button class="mh-type" data-act="realized-detail" data-v="' + c.id + '"><span class="mh-small">매도로 확정된 손익</span><span class="mh-small mh-faint">매도 ' + det.length + '건 상세 ›</span></button>' : '') +
      (hist.length >= 2 ? '<div class="mh-small mh-muted" style="margin:6px 0">평단가 추이</div><div class="mh-chart" style="height:140px"><canvas data-chart="cycle" data-v="' + c.id + '"></canvas></div>' : '') +
      '<div style="margin-top:8px">' + c.transactions.map(function (t) { var d = new Date(t.date), combo = E.COMBO.indexOf(t.type) >= 0;
        return '<div class="mh-row mh-tiny" style="padding:4px 0;border-bottom:1px solid var(--m-bd)"><span><span class="mh-faint mh-mono">' + (d.getMonth() + 1) + '/' + d.getDate() + '</span> <span class="' + TYPE_COLOR[t.type] + '">' + TYPE_LABEL[t.type] + '</span></span><span class="mh-mono">' +
          (combo ? 'S' + fmt(t.sellPrice || 0, cur, 2) + 'x' + t.sellQuantity + ' B' + fmt(t.price, cur, 2) + 'x' + t.quantity : fmt(t.price, cur, 2) + ' x ' + t.quantity) + '</span></div>'; }).join('') + '</div>' +
      (canDel ? '<button class="mh-btn mh-btn-danger" style="width:100%;margin-top:10px;font-size:12px" data-act="cycle-del" data-v="' + c.id + '">삭제</button>' : '') + '</div>';
  }
  /* ════ 아래에서 올라오는 시트 / 모달 ════ */
  function sheet(title, sub, body, wide) {
    return '<div class="mh-sheet-bg" data-act="sheet-bg"><div class="mh-sheet" data-noswipe' + (wide ? ' style="max-width:520px"' : '') + '><div class="grab"></div>' +
      '<div class="mh-row" style="margin-bottom:12px"><div><h3>' + title + '</h3>' + (sub ? '<p class="mh-small mh-muted" style="margin:3px 0 0">' + sub + '</p>' : '') + '</div><button class="mh-ico" style="font-size:18px" data-act="sheet-close" aria-label="닫기">✕</button></div>' + body + '</div></div>';
  }
  function okBtn() { return '<button class="mh-btn mh-btn-sel" style="width:100%;margin-top:16px;padding:12px" data-act="sheet-close">확인</button>'; }
  var INFO = {
    'i-star': ['★ 별지점 / 큰수 매수가', '<p>무한매수법은 <b class="mh-warn">별지점</b> 가격으로 LOC 매수를 거는 것이 원칙입니다.</p><p>다만 별지점이 종가 대비 너무 높으면 증권사가 LOC 주문을 거부할 수 있어, 안전 가격으로 <b>★ 큰수 = 종가 × (1 + 큰수%)</b>를 도입했습니다. 별지점이 큰수보다 높으면 큰수로 LOC를 겁니다.</p>' +
      '<div class="mh-note"><b>시장 상황에 따른 한계</b><ul style="margin:6px 0;padding-left:18px"><li><b>📉 폭락 시</b> — 종가가 큰수보다 훨씬 낮아지면 LOC 지정가(큰수)와 실제 체결가 차이가 벌어져 매수 효율이 떨어질 수 있습니다.</li><li><b>📈 폭등 시</b> — 종가가 큰수 위로 마감하면 LOC가 체결되지 않아 매수를 못 잡을 수 있습니다.</li></ul>시장 상황에 따라 <b>⋮ 메뉴에서 큰수%를 조정</b>하거나, 증권사 앱에서 <b>적절한 LOC 가격을 직접 정해</b> 거는 것이 좋습니다.</div>' +
      '<div class="mh-note warn" style="margin-top:8px"><b>큰수~별지점 미체결 구간</b><br>큰수로 LOC를 걸면 종가가 <b>큰수와 별지점 사이</b>로 마감할 때 매수(종가 ≤ 큰수)도 쿼터매도(종가 ≥ 별지점)도 안 잡혀 그날 거래가 빌 수 있습니다. 급등이 예상되면 <b>별지점</b>(쿼터매도 한 틱 아래)에 LOC 매수를 걸면 매도와 맞붙어 이 구간이 사라집니다.</div>'],
    'i-broker': ['증권사별 LOC 매수 거부 한도', '<p>LOC 매수 지정가가 기준가 대비 일정 비율을 넘으면 증권사에서 주문이 거부될 수 있는데, 이 <b>한도가 증권사마다 다릅니다</b>.</p><div class="mh-note"><div class="mh-row"><span>메리츠증권</span><b class="mh-warn">약 120%</b></div><div class="mh-row"><span>키움증권</span><b class="mh-ok">약 150%</b></div></div>' +
      '<p>한도가 넉넉한 증권사(예: 키움 150%)는 별지점이 대부분 한도 안에 들어와, <b>큰수 미사용(별지점만)을 켜도 거부 없이 걸리는 경우가 많습니다</b> — 큰수~별지점 미체결 구간 걱정 없이 운용할 수 있어요.</p><p>한도가 낮은 증권사(예: 메리츠 120%)는 별지점이 한도를 넘기 쉬워 <b>큰수 사용을 권장</b>합니다.</p>' +
      '<div class="mh-note warn">위 수치는 사용자 제보 기반 참고용입니다. 정확한 한도는 이용 중인 증권사 공지·고객센터에서 꼭 확인하세요. 위의 \'LOC 매수 상한\' 카드는 보수적인 ×1.2(120%) 기준입니다.</div>'],
    'i-rsi': ['RSI란?', '<p style="margin-top:0">최근 <b>14거래일</b> 동안 <b class="mh-ok">오른 날의 힘</b>과 <b class="mh-bad">내린 날의 힘</b> 중 어느 쪽이 셌는지를 0~100으로 나타낸 숫자입니다.</p>' +
      '<div class="mh-ibox"><div class="mh-mono">RSI = 상승폭 합 ÷ (상승폭 합 + 하락폭 합) × 100</div><div class="mh-muted" style="margin-top:6px">예) 14일 동안 오른 날 상승폭 합 <b class="mh-ok">$14</b>, 내린 날 하락폭 합 <b class="mh-bad">$6</b></div>' +
      '<div class="mh-mono mh-ac" style="margin-top:6px">→ 14 ÷ (14 + 6) × 100 = 70</div></div>' +
      '<div style="margin:12px 0;line-height:1.9"><div><b>50</b> <span class="mh-muted">— 오른 힘과 내린 힘이 팽팽</span></div><div><b class="mh-bad">70 이상 · 과매수</b> <span class="mh-muted">— 최근 상승이 강했다</span></div><div><b class="mh-info">30 이하 · 과매도</b> <span class="mh-muted">— 최근 하락이 강했다</span></div></div>' +
      '<p>⚠️ <b>매매 신호가 아닙니다.</b> <span class="mh-muted">과매수라고 반드시 떨어지지 않고, 과매도라고 반드시 오르지 않습니다. 추세가 강할 땐 70 위나 30 아래에 몇 주씩 머무르기도 합니다.</span></p>' +
      '<hr class="mh-hr"><p><b>계산 방식이 두 가지</b><span class="mh-muted">라 증권사마다 값이 몇 포인트 다릅니다. ⋮ 메뉴에서 바꿀 수 있어요.</span></p>' +
      '<div class="mh-ibox" style="line-height:1.8"><div><b class="mh-ac">증권사식(SMA)</b> <span class="mh-muted">— 최근 14일치만 단순 평균. 메리츠 등 국내 HTS와 같은 값</span></div><div><b class="mh-ac">와일더(원전)</b> <span class="mh-muted">— 과거 값의 영향을 계속 남기는 방식. TradingView·investing.com 기준</span></div></div>' +
      '<p class="mh-muted" style="margin-bottom:0">라오어 무한매수법에는 RSI가 없습니다. <b style="color:var(--m-tx)">T값·별지점·주문가 계산에 전혀 쓰이지 않는</b> 참고용 지표입니다.</p>'],
    'i-vix': ['VIX란?', '<p style="margin-top:0">미국 S&amp;P500 <b>옵션 가격</b>에서 뽑아낸 <b class="mh-ac">앞으로 30일간 예상 변동성</b>입니다. 시카고옵션거래소(CBOE)가 산출합니다.</p>' +
      '<p><b>왜 \'공포지수\'라고 부르나요?</b> <span class="mh-muted">시장이 불안해지면 하락에 대비한 보험(풋옵션)을 사려는 사람이 늘어 옵션 값이 비싸집니다. VIX는 그 옵션 값으로 계산되니,</span> <b>불안할수록 올라갑니다.</b></p>' +
      '<div class="mh-ibox" style="line-height:1.9"><div><b>숫자 읽는 법</b> <span class="mh-muted">— 연율(1년 기준) 표기입니다.</span></div><div class="mh-muted">VIX <b class="mh-ac">16</b> = 앞으로 1년간 약 <b style="color:var(--m-tx)">±16%</b> 움직일 것으로 시장이 보고 있다는 뜻</div>' +
      '<div class="mh-mono mh-muted">한 달 기준 환산 → 16 ÷ √12 ≈ <b style="color:var(--m-tx)">±4.6%</b></div></div>' +
      '<div style="margin:12px 0;line-height:1.9"><div><b class="mh-info">20 미만 · 안정</b> <span class="mh-muted">— 평온한 장세</span></div><div><b class="mh-warn">20~30 · 주의</b> <span class="mh-muted">— 변동성 확대</span></div>' +
      '<div><b style="color:#fe9800">30~40 · 불안</b> <span class="mh-muted">— 큰 조정 국면</span></div><div><b class="mh-bad">40 이상 · 공포</b> <span class="mh-muted">— 급락·패닉 (2020년 코로나 초기엔 80을 넘겼습니다)</span></div></div>' +
      '<p><b>무한매수법과의 관계</b> <span class="mh-muted">— VIX가 높으면 하루 등락이 커져 LOC 주문이 더 자주 체결되고 평단가도 빠르게 움직입니다. 다만</span> <b>T값·별지점·주문가 계산에는 전혀 쓰이지 않는</b> <span class="mh-muted">참고용입니다.</span></p>' +
      '<p class="mh-muted" style="margin-bottom:0">미국 정규장 <b style="color:var(--m-tx)">확정 종가</b> 기준이며, 전일 대비도 종가끼리 비교합니다. ⋮ 메뉴에서 숨길 수 있어요.</p>'],
    'i-fear': ['공포 &amp; 탐욕 지수란?', '<p style="margin-top:0">CNN이 시장 참여자들의 <b class="mh-ac">심리</b>를 0~100으로 나타낸 지표입니다. 아래 <b>7가지</b>를 종합해서 계산합니다.</p>' +
      '<div class="mh-ibox" style="line-height:1.95">' + [['주가 모멘텀', 'S&amp;P500이 125일 평균에서 얼마나 떨어져 있나'], ['주가 강도', '52주 신고가 종목이 신저가보다 많은가'], ['주가 폭', '오르는 종목의 거래량 vs 내리는 종목의 거래량'],
        ['풋/콜 비율', '하락 베팅(풋)이 상승 베팅(콜)보다 많은가'], ['시장 변동성', 'VIX'], ['안전자산 수요', '주식 대신 국채로 돈이 몰리나'], ['정크본드 수요', '고위험 채권을 사려는 사람이 있나']]
        .map(function (x, i) { return '<div><b>' + (i + 1) + '. ' + x[0] + '</b> <span class="mh-muted">— ' + x[1] + '</span></div>'; }).join('') + '</div>' +
      '<div style="margin:12px 0;line-height:1.9;font-weight:700"><div><span style="color:#f04452">0~25 극단적 공포</span> <span class="mh-faint">·</span> <span style="color:#fe9800">25~45 공포</span></div><div style="color:#fe9800">45~55 중립</div>' +
      '<div><span style="color:#3182f6">55~75 탐욕</span> <span class="mh-faint">·</span> <span style="color:#3182f6">75~100 극단적 탐욕</span></div></div>' +
      '<p><b>VIX와 뭐가 다른가요?</b> <span class="mh-muted">VIX는 옵션 가격 하나로 계산한</span> <b>변동성 숫자</b><span class="mh-muted">이고, 공포·탐욕 지수는 그 VIX를</span> <b>포함한 7개 지표</b><span class="mh-muted">를 묶은</span> <b>심리 종합 점수</b><span class="mh-muted">입니다.</span></p>' +
      '<p style="margin-bottom:0">⚠️ <span class="mh-muted">흔히 역발상 참고로 쓰이지만</span> <b>매매 신호가 아닙니다.</b> <span class="mh-muted">공포 구간이 몇 달씩 이어지기도 합니다. 무한매수법 계산에는 전혀 쓰이지 않는 참고용 지표입니다.</span></p>'],
    'i-realized': ['실현 손익 계산법', '<p>매도할 때마다 <b>(매도가 − 매도 시점 평단가) × 매도수량</b>을 누적합니다 (평균법).</p><div class="mh-note mh-mono" style="line-height:1.8">예) 평단가 $110 · 쿼터매도 5주 @ $130 → <span class="mh-ok">+$100 수익</span><br>예) 평단가 $110 · 매도 5주 @ $100 → <span class="mh-bad">−$50 손실</span></div>' +
      '<p>매도가가 평단가보다 낮으면 자동으로 손실(음수)로 잡힙니다. 후반전 별지점이 평단가 아래일 때의 손실도 정확히 반영됩니다.</p><p>보유 중인 주식의 평가손익(미실현)은 포함하지 않습니다 — 그건 <b>보유수익률</b> 카드에서 확인하세요. 사이클이 전량 매도로 종료되면 이 실현 손익이 최종 손익과 같아집니다.</p>']
  };
  function viewSheet() {
    var S = MH.sheet, k = S.kind;
    if (INFO[k]) return sheet(INFO[k][0], '', '<div class="mh-info-body">' + INFO[k][1] + '</div>' + okBtn());
    if (k === 'i-fear-range') { var sc = MH.fear.current.score, lbl = FEAR_KO[MH.fear.current.rating] || '';
      return sheet('공포 &amp; 탐욕 구간', '현재 <b>' + Math.round(sc) + ' · ' + lbl + '</b>', [['극단적 공포', 0, 25, '#f04452'], ['공포', 25, 45, '#fe9800'], ['중립', 45, 55, '#fe9800'], ['탐욕', 55, 75, '#3182f6'], ['극단적 탐욕', 75, 100, '#3182f6']].map(function (z) {
        var on = sc >= z[1] && (z[2] === 100 ? sc <= 100 : sc < z[2]); return '<div class="mh-row" style="padding:8px 4px;border-bottom:1px solid var(--m-bd)"><span><span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:' + z[3] + ';margin-right:6px"></span><span class="' + (on ? '' : 'mh-muted') + '" style="' + (on ? 'font-weight:700' : '') + '">' + z[0] + '</span></span><span class="mh-mono mh-small">' + z[1] + ' ~ ' + z[2] + (on ? ' <span class="mh-chip mh-chip-ac">현재</span>' : '') + '</span></div>'; }).join('') +
        '<p class="mh-help">CNN 공포·탐욕 지수 기준 · 0=극단적 공포, 100=극단적 탐욕</p>' + okBtn()); }
    if (k === 'record') return viewRecord();
    if (k === 'edit') return viewEdit();
    if (k === 'realized') return viewRealizedDetail();
    if (k === 'yesterday') return viewYesterday();
    if (k === 'export') return viewExport();
    if (k === 'archive') return viewArchiveBox();
    if (k === 'rename') return viewRename();
    if (k === 'delete') return viewDelete();
    if (k === 'code-export') return viewCodeExport();
    if (k === 'code-import') return viewCodeImport();
    if (k === 'celebrate') return viewCelebrate();
    return '';
  }

  /* ── 오늘의 거래 기록 ── */
  function recCtx(dateStr) {
    var D = derive(), s = D.s, us = s.recordDateBasis === 'us';
    var prior = E.compute(s, D.txs.filter(function (t) { return t.date.slice(0, 10) < dateStr; }), D.mid || undefined);
    return { D: D, ctx: { settings: s, prior: prior, cur: D.st, date: dateStr, prices: D.ot, back: us ? 0 : 1, isReverse: D.isRev, revStar: D.rStar || 0, txs: D.txs } };
  }
  function openRecord() {
    var D = derive(), us = D.s.recordDateBasis === 'us', d = us ? (D.ot.length > 0 ? D.ot[D.ot.length - 1].date : daysAgo(1)) : today();
    MH.sheet = { kind: 'record', step: 'type', date: d, type: null, bp: '', bq: '', sp: '', sq: '', tManual: false, tVal: '' }; render();
  }
  function recState() {
    var S = MH.sheet, rc = recCtx(S.date), ctx = rc.ctx, rec = E.recommend(ctx), D = rc.D;
    var dayDone = D.txs.some(function (t) { return t.date.slice(0, 10) === S.date; });
    var both = null;
    if (!dayDone && rec.set.quarter_sell && rec.set.limit_sell) {
      var a = E.prefill('quarter_sell', ctx, rec), b = E.prefill('limit_sell', ctx, rec), qp = Number(a.sellPrice), qq = Number(a.sellQty), lp = Number(b.sellPrice), lq = Number(b.sellQty);
      if (qp > 0 && qq > 0 && lp > 0 && lq > 0 && qq + lq === ctx.prior.totalQuantity) both = { qPrice: qp, qQty: qq, lPrice: lp, lQty: lq };
    }
    var best = REC_ORDER.filter(function (t) { return rec.set[t]; })[0] || null, bestFill = best !== null && !dayDone ? E.prefill(best, ctx, rec) : null;
    var bestOK = (function () { if (best === null || bestFill === null) return false; var g = groupOf(best), bo = Number(bestFill.buyPrice) > 0 && Number(bestFill.buyQty) > 0, so = Number(bestFill.sellPrice) > 0 && Number(bestFill.sellQty) > 0; return g === 'buy' ? bo : (g === 'sell' || bo) && so; })();
    var first = null; if (!D.isRev && ctx.prior.phase === '처음매수' && rec.close && !dayDone) { var f = E.prefill('full_buy', ctx, rec); if (Number(f.buyPrice) > 0 && Number(f.buyQty) > 0) first = { price: Number(f.buyPrice), qty: Number(f.buyQty) }; }
    return { D: D, ctx: ctx, rec: rec, both: both, best: best, bestFill: bestFill, bestOK: bestOK, first: first };
  }
  function viewRecord() {
    var S = MH.sheet, R = recState(), D = R.D, cur = D.cur, list = D.isRev ? reverseTypes(D.s.splits, S.date) : NORMAL_TYPES;
    var dl = new Date(S.date + 'T12:00:00').toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' });
    var settle = D.settling ? '<p class="mh-tiny mh-warn" style="margin:6px 0 0">⏳ 종가 확정 전 — 자동입력 가격·수량이 실제 체결과 다를 수 있어요. 증권사 체결 알림과 대조하거나 잠시 후 새로고침 후 기록하세요.</p>' : '';
    if (S.step === 'type') {
      var b = '';
      if (D.failed && R.rec.close == null && !D.isRev && R.ctx.prior.phase !== '처음매수' && R.ctx.prior.phase !== '종료') b += '<div class="mh-note warn" style="margin-bottom:10px"><b class="mh-warn">⚠️ 종가를 불러오지 못해</b> 오늘의 추천과 원탭 기록을 계산할 수 없어요. 앱을 새로고침한 뒤 다시 확인하시거나, 아래에서 직접 선택해 기록해 주세요.</div>';
      if (R.rec.suspect) b += '<div class="mh-note warn" style="margin-bottom:10px"><b>⚠️ 실제 체결이 아닐 수 있어요</b><br>' + R.rec.suspect.session + ' <b>' + fmt(R.rec.suspect.price, cur, 2) + '</b>는 그 순간에만 찍히고 <b>이어진 거래가 없어요.</b><div class="mh-tiny mh-faint">증권사 체결 내역을 확인한 뒤 기록하세요.</div></div>';
      if (R.both) b += '<div class="mh-note ac" style="margin-bottom:10px"><div class="mh-row"><div><div class="mh-tiny mh-ac" style="font-weight:700">📌 오늘의 추천 — 전량 매도 · 회차 종료 🎉</div><div style="font-weight:700;margin:2px 0">지정가매도 + 쿼터매도</div>' +
        '<div class="mh-small mh-mono"><span class="mh-bad">지정가</span> ' + fmt(R.both.lPrice, cur, 2) + ' × ' + R.both.lQty + '주</div><div class="mh-small mh-mono"><span class="mh-warn">쿼터 LOC</span> ' + fmt(R.both.qPrice, cur, 2) + ' × ' + R.both.qQty + '주 <span class="mh-faint">(종가)</span></div></div>' +
        '<button class="mh-btn mh-btn-p" data-act="rec-both">이대로 기록</button></div><p class="mh-tiny mh-faint" style="margin:6px 0 0">가격이 서로 달라 별도 거래 2건으로 기록돼요(각각 수정 가능) · 보유 전량 매도 → 회차 종료 · T값 자동</p>' + settle + '</div>';
      if (!R.both && R.bestOK) { var g = groupOf(R.best), f = R.bestFill;
        b += '<div class="mh-note ac" style="margin-bottom:10px"><div class="mh-row"><div><div class="mh-tiny mh-ac" style="font-weight:700">📌 오늘의 추천</div><div style="font-weight:700;margin:2px 0">' + list.filter(function (x) { return x.type === R.best; })[0].label + '</div>' +
          (g !== 'buy' ? '<div class="mh-small mh-mono"><span class="mh-bad">매도</span> ' + fmt(Number(f.sellPrice), cur, 2) + ' × ' + f.sellQty + '주</div>' : '') + (g !== 'sell' ? '<div class="mh-small mh-mono"><span class="mh-ok">매수</span> ' + fmt(Number(f.buyPrice), cur, 2) + ' × ' + f.buyQty + '주</div>' : '') +
          '</div><button class="mh-btn mh-btn-p" data-act="rec-best">이대로 기록</button></div><p class="mh-tiny mh-faint" style="margin:6px 0 0">수량·가격을 바꾸려면 아래에서 직접 선택 · T값 자동 계산</p>' + settle + '</div>'; }
      if (R.first) b += '<div class="mh-note ac" style="margin-bottom:10px"><div class="mh-row"><div><div class="mh-tiny mh-ac" style="font-weight:700">🎯 처음매수 LOC를 걸었다면</div><div style="font-weight:700;margin:2px 0">1회 매수</div><div class="mh-small mh-mono"><span class="mh-ok">매수</span> ' + fmt(R.first.price, cur, 2) + ' × ' + R.first.qty + '주 <span class="mh-faint">(종가)</span></div></div>' +
        '<button class="mh-btn mh-btn-p" data-act="rec-first">이대로 기록</button></div><p class="mh-tiny mh-faint" style="margin:6px 0 0"><b>주문을 걸어둔 경우만 기록하세요</b> · LOC 사다리 전부 체결 기준 · 변경은 아래에서 · T값 자동</p>' + settle + '</div>';
      if (D.isRev) b += '<div class="mh-note" style="margin-bottom:10px"><b class="mh-rev">리버스모드</b><div class="mh-tiny mh-faint">평단보다 높은 가격에 매수가 일어났을 때 사용합니다.</div></div>';
      var btn = function (x) { if ((x.group !== 'buy' && D.st.totalQuantity === 0) || (D.st.phase === '처음매수' && x.type !== 'full_buy')) return '';
        return '<button class="mh-type" data-act="rec-type" data-v="' + x.type + '"><span>' + x.label + (R.rec.set[x.type] ? ' <span class="mh-chip mh-chip-ac">추천</span>' : '') + '</span><span class="mh-tiny mh-faint mh-mono" style="background:var(--m-ac-s);padding:2px 6px;border-radius:5px">' + x.desc + '</span></button>'; };
      var grp = function (g, t, cond) { var items = list.filter(function (x) { return x.group === g; }).map(btn).join(''); return cond && items ? '<div class="mh-tiny mh-faint" style="margin:8px 0 6px">' + t + '</div>' + items : ''; };
      b += grp('buy', '매수', true) + grp('sell', '매도', D.st.totalQuantity > 0) + grp('combined', '복합 거래', D.st.totalQuantity > 0 && D.st.phase !== '처음매수');
      return sheet('오늘의 거래 기록', dl + ' · ' + D.phaseLabel, b);
    }
    var ty = S.type, g = groupOf(ty), isS = g === 'sell' || g === 'combined', isB = g === 'buy' || g === 'combined', sym = cur === 'KRW' ? '₩' : '$';
    var pair = function (pk, qk) { return '<div class="mh-grid2"><div><label class="mh-lbl">체결가 (' + sym + ')</label><input class="mh-in" type="number" step="0.01" value="' + esc(S[pk]) + '" data-in="rec:' + pk + '"></div><div><label class="mh-lbl">수량</label><input class="mh-in" type="number" value="' + esc(S[qk]) + '" data-in="rec:' + qk + '"></div></div>'; };
    var body = '<label class="mh-lbl">날짜</label><input class="mh-in" type="date" value="' + S.date + '" data-ch="rec-date">' +
      (D.settling ? '<div class="mh-note warn" style="margin-top:8px"><b class="mh-warn">⏳ 종가 확정 전</b> — 자동입력된 체결가·수량이 실제 체결과 다를 수 있어요. 증권사 체결 알림 기준으로 확인·수정하거나, 잠시 후(마감 +15분) 새로고침하면 확정 종가로 채워집니다.</div>' : '') +
      (isS ? '<div class="mh-small mh-bad" style="font-weight:600;margin:12px 0 6px">● 매도</div>' + pair('sp', 'sq') : '') + (isB ? '<div class="mh-small mh-ok" style="font-weight:600;margin:12px 0 6px">● 매수</div>' + pair('bp', 'bq') : '') +
      '<div class="mh-note" style="margin-top:12px"><div class="mh-row"><span>T값 변화</span><span class="mh-mono" id="mh-rec-t"></span></div>' +
      '<div class="mh-row" style="margin-top:6px"><span class="mh-small">T값 직접 입력 <span class="mh-faint">(변칙 거래용)</span></span><button class="mh-toggle' + (S.tManual ? ' on' : '') + '" data-act="rec-tman"></button></div>' +
      (S.tManual ? '<input class="mh-in" style="margin-top:8px" type="number" step="0.01" value="' + esc(S.tVal) + '" data-in="rec:tVal"><p class="mh-help">체결 후 결과 T값을 직접 입력합니다. 처방된 수량과 다르게 매수·매도한 변칙 거래에 사용하세요.</p>' : '') + '</div>' +
      '<div id="mh-rec-warn"></div><div class="mh-grid2" style="margin-top:14px"><button class="mh-btn" data-act="rec-back">뒤로</button><button class="mh-btn mh-btn-p" id="mh-rec-save" data-act="rec-save">기록하기</button></div>';
    return sheet(list.filter(function (x) { return x.type === ty; })[0].label, dl + ' · ' + D.phaseLabel, body);
  }
  /* 기록 시트의 실시간 계산 (T 변화·경고·버튼) — 입력 포커스를 유지하려고 부분 갱신 */
  function recLive() {
    var S = MH.sheet; if (!S || S.kind !== 'record' || S.step !== 'detail') return;
    var D = derive(), ty = S.type, g = groupOf(ty), isS = g === 'sell' || g === 'combined', isB = g === 'buy' || g === 'combined', cur = D.cur;
    var tAuto = E.nextT(D.st.tValue, ty, D.s.splits, S.date), tShow = S.tManual && S.tVal !== '' && !isNaN(Number(S.tVal)) ? Number(S.tVal) : tAuto;
    var tEl = $('mh-rec-t'); if (tEl) tEl.innerHTML = '<span class="mh-faint">' + D.st.tValue.toFixed(2) + '</span> → <b class="mh-ac">' + tShow.toFixed(2) + '</b>' + (S.tManual ? ' <span class="mh-warn mh-tiny">(수동)</span>' : '');
    var sellQ = isS ? Number(S.sq) : 0, hold = D.st.totalQuantity + ((ty === 'buy_full_limit_sell' || ty === 'buy_half_limit_sell') ? (Number(S.bq) || 0) : 0);
    var over = E.isOverSell(sellQ, hold), last = D.ot.length > 0 ? D.ot[D.ot.length - 1].close : null;
    var oddS = isS && E.isPriceOdd(Number(S.sp), last), oddB = isB && E.isPriceOdd(Number(S.bp), last), amt = g === 'buy' ? Number(S.bp) * Number(S.bq) : 0;
    var tooMuch = g === 'buy' && amt > 0 && D.st.remainingCapital > 0 && amt > D.st.remainingCapital, w = '';
    if (over) w = '<div class="mh-note bad" style="margin-top:10px"><b>⚠️ 초과 매도</b> — 매도 수량 ' + sellQ.toLocaleString() + '주가 보유 수량 ' + hold.toLocaleString() + '주보다 많아요. 수량을 확인하거나 빠뜨린 매수를 먼저 기록하세요. 이대로 저장하면 수익이 비정상으로 부풀 수 있어요.</div>';
    else if (oddS || oddB || tooMuch) w = '<div class="mh-note warn" style="margin-top:10px">' + ((oddS || oddB) && last != null ? '<div><b>⚠️ 가격 확인</b> — 입력 체결가가 최근 종가 ' + fmt(last, cur) + '와 5배 이상 차이나요. 단위·자릿수를 확인하세요.</div>' : '') +
      (tooMuch ? '<div><b>⚠️ 금액 확인</b> — 이번 매수 금액 ' + fmt(amt, cur) + '이 잔금 ' + fmt(D.st.remainingCapital, cur) + '보다 커요. 수량을 확인하세요.</div>' : '') + '</div>';
    var wEl = $('mh-rec-warn'); if (wEl) wEl.innerHTML = w;
    var btn = $('mh-rec-save'); if (btn) btn.disabled = over;
    S._tAuto = tAuto;
  }
  function addTx(o) { active().transactions.push(Object.assign({ id: uid() }, o)); }
  function saveRecord() {
    var S = MH.sheet, D = derive(), ty = S.type, g = groupOf(ty), isS = g === 'sell' || g === 'combined', hold = D.st.totalQuantity + ((ty === 'buy_full_limit_sell' || ty === 'buy_half_limit_sell') ? (Number(S.bq) || 0) : 0);
    if (E.isOverSell(isS ? Number(S.sq) : 0, hold)) return;
    var tx = { date: S.date + 'T12:00:00', type: ty, price: 0, quantity: 0 };
    if (g === 'buy') { tx.price = Number(S.bp); tx.quantity = Number(S.bq); if (!tx.price || !tx.quantity) return; }
    else if (g === 'sell') { tx.price = Number(S.sp); tx.quantity = Number(S.sq); if (!tx.price || !tx.quantity) return; }
    else { tx.sellPrice = Number(S.sp); tx.sellQuantity = Number(S.sq); tx.price = Number(S.bp); tx.quantity = Number(S.bq); if (!tx.sellPrice || !tx.sellQuantity || !tx.price || !tx.quantity) return; }
    if (S.tManual && S.tVal !== '' && !isNaN(Number(S.tVal))) tx.tOverride = Number(S.tVal);
    MH.sheet = null; mut(function () { addTx(tx); });
  }

  /* ── 거래 수정 ── */
  function viewEdit() {
    var S = MH.sheet, ses = active(), tx = ses.transactions.filter(function (t) { return t.id === S.id; })[0]; if (!tx) return '';
    var combo = E.COMBO.indexOf(tx.type) >= 0, isSell = ['quarter_sell', 'limit_sell', 'reverse_sell'].indexOf(tx.type) >= 0;
    var pair = function (lg, pk, qk) { return '<div class="mh-small" style="font-weight:600;margin:12px 0 6px">' + lg + '</div><div class="mh-grid2"><div><label class="mh-lbl">체결가</label><input class="mh-in" type="number" step="0.01" value="' + esc(S[pk]) + '" data-in="ed:' + pk + '"></div><div><label class="mh-lbl">수량</label><input class="mh-in" type="number" value="' + esc(S[qk]) + '" data-in="ed:' + qk + '"></div></div>'; };
    return sheet('<span class="' + TYPE_COLOR[tx.type] + '">' + TYPE_LABEL[tx.type] + '</span> 수정', '', '<label class="mh-lbl">날짜</label><input class="mh-in" type="date" value="' + S.date + '" data-in="ed:date">' +
      (combo ? pair('매도', 'sp', 'sq') : '') + pair(combo ? '매수' : isSell ? '매도' : '매수', 'p', 'q') +
      '<div class="mh-note" style="margin-top:12px"><div class="mh-row"><span>T값 변화</span><span class="mh-mono" id="mh-ed-t"></span></div><div class="mh-row" style="margin-top:6px"><span class="mh-small">T값 직접 입력 <span class="mh-faint">(변칙 거래용)</span></span><button class="mh-toggle' + (S.tManual ? ' on' : '') + '" data-act="ed-tman"></button></div>' +
      (S.tManual ? '<input class="mh-in" style="margin-top:8px" type="number" step="0.01" value="' + esc(S.tVal) + '" data-in="ed:tVal">' : '') + '</div><div id="mh-ed-warn"></div>' +
      '<button class="mh-btn mh-btn-p" style="width:100%;margin-top:14px" id="mh-ed-save" data-act="ed-save">저장</button>');
  }
  function editInfo() {
    var S = MH.sheet, ses = active(), s = ses.settings, txs = ses.transactions, i = txs.findIndex(function (t) { return t.id === S.id; }), tx = txs[i];
    var tBefore = i <= 0 ? (ses.midEntry ? ses.midEntry.tValue : 0) : E.compute(s, txs.slice(0, i), ses.midEntry).tValue;
    var tAuto = E.nextT(tBefore, tx.type, s.splits, S.date), holdBefore = E.compute(s, txs.slice(0, Math.max(0, i)), ses.midEntry).totalQuantity;
    var combo = E.COMBO.indexOf(tx.type) >= 0, isSell = ['quarter_sell', 'limit_sell', 'reverse_sell'].indexOf(tx.type) >= 0;
    var sellQ = combo ? Number(S.sq) : isSell ? Number(S.q) : 0, hold = holdBefore + ((tx.type === 'buy_full_limit_sell' || tx.type === 'buy_half_limit_sell') ? (Number(S.q) || 0) : 0);
    return { tx: tx, tBefore: tBefore, tAuto: tAuto, over: E.isOverSell(sellQ, hold), sellQ: sellQ, hold: hold, combo: combo };
  }
  function editLive() {
    var S = MH.sheet; if (!S || S.kind !== 'edit') return; var I = editInfo();
    var shown = S.tManual && S.tVal !== '' && !isNaN(Number(S.tVal)) ? Number(S.tVal) : I.tAuto;
    var t = $('mh-ed-t'); if (t) t.innerHTML = '<span class="mh-faint">' + I.tBefore.toFixed(2) + '</span> → <b class="mh-ac">' + shown.toFixed(2) + '</b>' + (S.tManual ? ' <span class="mh-warn mh-tiny">(수동)</span>' : '');
    var w = $('mh-ed-warn'); if (w) w.innerHTML = I.over ? '<div class="mh-note bad" style="margin-top:10px"><b>⚠️ 초과 매도</b> — 매도 수량 ' + I.sellQ.toLocaleString() + '주가 이 시점 보유 수량 ' + I.hold.toLocaleString() + '주보다 많아요. 수량을 확인하세요.</div>' : '';
    var b = $('mh-ed-save'); if (b) b.disabled = I.over;
  }
  function saveEdit() {
    var S = MH.sheet, I = editInfo(); if (I.over) return;
    mut(function () { var tx = I.tx; tx.price = Number(S.p); tx.quantity = Number(S.q); tx.date = S.date + 'T12:00:00';
      if (I.combo) { tx.sellPrice = Number(S.sp); tx.sellQuantity = Number(S.sq); }
      if (S.tManual && S.tVal !== '' && !isNaN(Number(S.tVal))) tx.tOverride = Number(S.tVal); else delete tx.tOverride; MH.sheet = null; });
  }
  /* ── 매도별 실현 손익 상세 ── */
  function viewRealizedDetail() {
    var S = MH.sheet, det, cur, total;
    if (S.cycleId) { var A = MH._an, c = A && A.cycles.filter(function (x) { return x.cycle.id === S.cycleId; })[0]; if (!c) return '';
      c = c.cycle; cur = c.settings.currency || 'USD'; det = E.realizedDetail(c.transactions, E.history(c.settings, c.transactions, c.midEntry)); }
    else { var D = derive(); det = D.realized; cur = D.cur; }
    total = det.length ? det[det.length - 1].cumulative : 0; MH._realizedChart = det;
    return sheet('매도별 실현 손익', '매도 ' + det.length + '건 · 합계 <b class="' + (total >= 0 ? 'mh-ok' : 'mh-bad') + '">' + sign(total) + fmt(total, cur, 2) + '</b>' + (cur === 'USD' && MH.fx ? ' <span class="mh-faint">≈ ₩' + Math.round(total * MH.fx.rate).toLocaleString() + '</span>' : ''),
      (det.length >= 2 ? '<div class="mh-row mh-tiny mh-faint"><span>매도별 손익 추이</span><span>막대 = 건별 · 선 = 누적</span></div><div class="mh-chart" style="height:150px;margin:6px 0 10px"><canvas data-chart="realized"></canvas></div>' : '') +
      det.slice().reverse().map(function (r) { var d = new Date(r.date);
        return '<div class="mh-hist"><span><span class="mh-faint mh-mono">' + (d.getMonth() + 1) + '/' + d.getDate() + '</span> <span class="' + TYPE_COLOR[r.type] + '">' + TYPE_LABEL[r.type] + '</span> <span class="mh-mono mh-tiny">' + fmt(r.sellPrice, cur, 2) + ' × ' + r.sellQty + '주</span></span>' +
          '<span class="mh-mono" style="text-align:right"><b class="' + (r.realized >= 0 ? 'mh-ok' : 'mh-bad') + '">' + sign(r.realized) + fmt(r.realized, cur, 2) + '</b><br><span class="mh-tiny mh-faint">누적 ' + sign(r.cumulative) + fmt(r.cumulative, cur, 2) + '</span></span></div>'; }).join('') + okBtn());
  }
  /* ── 어제 주문표 ── */
  function viewYesterday() {
    var D = derive(), cur = D.cur, mode = MH.sheet.mode || 'after', list = D.yAfter && mode === 'after' ? D.yAfter : D.yOrders;
    var d = new Date(D.yd + 'T12:00:00'), wd = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];
    var diff = (function () { if (!D.yAfter) return null; var f = function (L, t) { return L.filter(function (o) { return o.type === t && o.label.charAt(0) === '★'; })[0]; };
      var a = f(D.yOrders, 'sell'), b = f(D.yAfter, 'sell'), c = f(D.yOrders, 'buy'), e = f(D.yAfter, 'buy');
      return { sell: a && b && a.price !== b.price ? { label: a.label, from: a.price, to: b.price } : null, buy: c && e && c.price !== e.price ? { label: e.label, from: c.price, to: e.price } : null }; })();
    var b = '<p class="mh-small mh-muted" style="line-height:1.6;margin-top:0">한국 새벽 5시에 종가가 갱신되면서 \'오늘의 주문\'표가 새 거래일용으로 다시 계산되어, 어제 LOC를 걸 때 봤던 가격을 확인하기 위한 화면입니다.</p>';
    if (D.yAfter) b += '<div style="display:flex;gap:6px;margin-bottom:8px"><button class="mh-btn' + (mode === 'after' ? ' mh-btn-sel' : '') + '" style="flex:1;font-size:12px" data-act="y-mode" data-v="after">어제 기록 반영 후</button><button class="mh-btn' + (mode === 'before' ? ' mh-btn-sel' : '') + '" style="flex:1;font-size:12px" data-act="y-mode" data-v="before">기록 전 (새벽)</button></div>' +
      '<div class="mh-note warn" style="margin-bottom:8px"><b>⚠️ 어제 기록으로 주문가가 바뀐 날이에요</b> — 어제 낮에 거래를 기록하시면 그 순간 주문표가 다시 계산돼요.' +
      (diff && (diff.sell || diff.buy) ? '<div class="mh-mono" style="margin-top:4px">' + (diff.sell ? diff.sell.label + ' ' + fmt(diff.sell.from, cur, 2) + ' → <b>' + fmt(diff.sell.to, cur, 2) + '</b><br>' : '') + (diff.buy ? diff.buy.label + ' ' + fmt(diff.buy.from, cur, 2) + ' → <b>' + fmt(diff.buy.to, cur, 2) + '</b>' : '') + '</div>' : '') +
      '<div style="margin-top:4px">기록한 뒤 주문하셨다면 <b>기록 반영 후</b>, 주문을 먼저 걸었다면 <b>기록 전</b>이 실제 거신 값이에요.</div></div>';
    var sells = list.filter(function (o) { return o.type === 'sell'; }), buys = list.filter(function (o) { return o.type === 'buy'; });
    if (sells.length) b += '<div class="mh-small mh-bad" style="font-weight:600;margin:6px 0">● 매도</div>' + sells.map(function (o) { return orderRow(o, cur, false); }).join('');
    if (buys.length) b += '<div class="mh-small mh-ok" style="font-weight:600;margin:10px 0 6px">● 매수</div>' + buys.map(function (o) { return orderRow(o, cur, false) +
      (o.altPrice != null && o.altPrice > 0 ? '<div class="mh-note" style="margin:-2px 0 8px"><b class="mh-warn">📈 급등 대비</b> — 종가가 큰수 위로 마감하면 이 매수가 안 잡혀요. 별지점 <b class="mh-mono">' + fmt(o.altPrice, cur, 2) + '</b>에 LOC 매수를 걸거나 ⋮에서 큰수%를 올리세요. <span class="mh-faint">무한매수는 매일 체결이 원칙입니다.</span></div>' : ''); }).join('');
    return sheet('어제 주문표', (d.getMonth() + 1) + '월 ' + d.getDate() + '일 (' + wd + ') 기준 · 종가 <b class="mh-mono">$' + (D.yClose || 0).toFixed(2) + '</b>', b + '<button class="mh-btn" style="width:100%;margin-top:12px" data-act="sheet-close">닫기</button>');
  }
  /* ── 내보내기 (CSV 2개 · 엑셀 · JSON) ── */
  var TX_COLS = [['session', '세션'], ['cycle', '사이클'], ['date', '날짜'], ['ticker', '종목'], ['splits', '분할'], ['type', '유형'], ['buyPrice', '매수가'], ['buyQty', '매수수량'], ['sellPrice', '매도가'], ['sellQty', '매도수량'], ['tValue', 'T값'], ['currency', '통화']];
  var CY_COLS = [['session', '세션'], ['status', '상태'], ['ticker', '종목'], ['splits', '분할'], ['currency', '통화'], ['capital', '원금'], ['invested', '총투자'], ['returned', '총회수'], ['pnl', '손익'], ['pnlPercent', '손익률(%)'], ['startDate', '시작일'], ['endDate', '종료일'], ['txCount', '거래수']];
  function txRows(name, cyc, s, txs, mid) { if (!s || !txs.length) return []; var h = E.history(s, txs, mid), cur = s.currency || 'USD';
    return txs.map(function (t, i) { var combo = E.COMBO.indexOf(t.type) >= 0, buy = ['full_buy', 'half_buy', 'reverse_quarter_buy'].indexOf(t.type) >= 0 || combo, sell = ['quarter_sell', 'limit_sell', 'reverse_sell'].indexOf(t.type) >= 0;
      return { session: name, cycle: cyc, date: t.date.slice(0, 10), ticker: s.ticker, splits: s.splits, type: TYPE_FULL[t.type] || t.type, buyPrice: buy ? t.price : null, buyQty: buy ? t.quantity : null,
        sellPrice: combo ? (t.sellPrice != null ? t.sellPrice : null) : sell ? t.price : null, sellQty: combo ? (t.sellQuantity != null ? t.sellQuantity : null) : sell ? t.quantity : null, tValue: Math.round(h[i].tValue * 1e5) / 1e5, currency: cur }; }); }
  function exportSets(scope) {
    var list = store.sessions.filter(function (s) { return s.settings; }); if (scope !== 'all') list = list.filter(function (s) { return s.id === scope; });
    var tx = [], cy = [];
    list.forEach(function (n) {
      n.archivedCycles.forEach(function (c, i) { tx = tx.concat(txRows(n.name, String(i + 1), c.settings, c.transactions, c.midEntry));
        var f = c.transactions[0]; cy.push({ session: n.name, status: '완료', ticker: c.settings.ticker, splits: c.settings.splits, currency: c.settings.currency || 'USD', capital: c.settings.totalCapital,
          invested: r2(c.totalInvested), returned: r2(c.totalReturned), pnl: r2(c.pnl), pnlPercent: r2(c.pnlPercent), startDate: f ? f.date.slice(0, 10) : '-', endDate: c.archivedAt.slice(0, 10), txCount: c.transactions.length }); });
      tx = tx.concat(txRows(n.name, '진행중', n.settings, n.transactions, n.midEntry));
      if (n.transactions.length) { var r = E.compute(n.settings, n.transactions, n.midEntry);
        cy.push({ session: n.name, status: '진행중', ticker: n.settings.ticker, splits: n.settings.splits, currency: n.settings.currency || 'USD', capital: n.settings.totalCapital, invested: r2(r.totalInvested),
          returned: r2(r.totalReturned), pnl: r2(r.realizedPnL), pnlPercent: r2(r.realizedCost > 0 ? r.realizedPnL / r.realizedCost * 100 : 0), startDate: n.transactions[0].date.slice(0, 10), endDate: '-', txCount: n.transactions.length }); }
    });
    var nm = scope === 'all' ? '전체' : (list[0] ? list[0].name : 'export');
    return { list: list, tx: tx, cy: cy, base: 'muhan4-' + (nm.replace(/[^\w가-힣-]+/g, '_').slice(0, 30) || 'export') + '-' + today().replace(/-/g, '') };
  }
  function csv(cols, rows) { var q = function (v) { if (v == null) return ''; var t = String(v); return /[",\n\r]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; };
    return '\uFEFF' + [cols.map(function (c) { return q(c[1]); }).join(',')].concat(rows.map(function (r) { return cols.map(function (c) { return q(r[c[0]]); }).join(','); })).join('\r\n'); }
  function download(name, blob) { var u = URL.createObjectURL(blob), a = document.createElement('a'); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(u); }, 1000); }
  function viewExport() {
    var S = MH.sheet, withData = store.sessions.filter(function (s) { return s.settings; }), multi = withData.length > 1;
    if (!S.scope) S.scope = multi ? 'all' : (withData[0] ? withData[0].id : 'all');
    var X = exportSets(S.scope);
    return sheet('내보내기', '거래 ' + X.tx.length + '건 · 사이클 ' + X.cy.length + '개',
      (multi ? '<div class="mh-small mh-muted" style="margin-bottom:6px">범위</div><div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px"><button class="mh-btn' + (S.scope === 'all' ? ' mh-btn-sel' : '') + '" style="font-size:12px" data-act="ex-scope" data-v="all">전체 세션</button>' +
        withData.map(function (s) { return '<button class="mh-btn' + (S.scope === s.id ? ' mh-btn-sel' : '') + '" style="font-size:12px" data-act="ex-scope" data-v="' + s.id + '">' + esc(s.name) + '</button>'; }).join('') + '</div>' : '') +
      '<div class="mh-small mh-muted" style="margin-bottom:6px">형식 선택</div><div class="mh-grid3"><button class="mh-btn" data-act="ex-csv"' + (S.busy ? ' disabled' : '') + '>CSV</button><button class="mh-btn" data-act="ex-xlsx"' + (S.busy ? ' disabled' : '') + '>' + (S.busy ? '생성 중…' : '엑셀') + '</button><button class="mh-btn" data-act="ex-json"' + (S.busy ? ' disabled' : '') + '>JSON</button></div>' +
      '<div class="mh-tiny mh-faint" style="margin-top:10px;line-height:1.7">· CSV는 거래내역·사이클요약 <b>2개 파일</b>로 받아집니다 (엑셀은 시트 2개 1파일)<br>· 거래내역·사이클요약 모두 <b>진행 중 사이클 포함</b>. 통화는 행마다 표시<br>· JSON은 데이터 원본(세션 구조 그대로)</div>' +
      (S.msg ? '<div class="mh-note ok" style="margin-top:10px">✓ ' + S.msg + '</div>' : ''));
  }
  async function exportXlsx() {
    var S = MH.sheet, X = exportSets(S.scope); S.busy = true; S.msg = null; render();
    try {
      if (!window.XLSX) await new Promise(function (ok, no) { var sc = document.createElement('script'); sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'; sc.onload = ok; sc.onerror = no; document.head.appendChild(sc); });
      var sheetOf = function (cols, rows) { return XLSX.utils.aoa_to_sheet([cols.map(function (c) { return c[1]; })].concat(rows.map(function (r) { return cols.map(function (c) { return r[c[0]]; }); }))); };
      var wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, sheetOf(TX_COLS, X.tx), '거래내역'); XLSX.utils.book_append_sheet(wb, sheetOf(CY_COLS, X.cy), '사이클요약');
      XLSX.writeFile(wb, X.base + '.xlsx'); S.msg = '엑셀 파일을 내려받았어요';
    } catch (e) { S.msg = '엑셀 생성에 실패했어요. CSV로 시도해 주세요.'; }
    S.busy = false; render();
  }
  /* ── 보관함 / 이름·색상 / 삭제 ── */
  function viewArchiveBox() {
    var arch = store.sessions.filter(function (s) { return s.archived; });
    return sheet('📦 보관함', '보관된 세션은 탭에서 숨겨지지만 분석 누계엔 그대로 남아요', (arch.length ? arch.map(function (u) {
      var cur = (u.settings && u.settings.currency) || 'USD', p = u.archivedCycles.reduce(function (a, c) { return a + c.pnl; }, 0) + (u.settings ? E.compute(u.settings, u.transactions, u.midEntry).realizedPnL : 0);
      return '<div class="mh-hist"><div><div style="font-weight:600">' + esc(u.name) + '</div><div class="mh-tiny mh-faint">' + (u.settings ? esc(u.settings.ticker) + ' · ' + u.settings.splits + '분할' : '미설정') + ' · 완료 ' + u.archivedCycles.length + '회 ·<span class="mh-mono ' + (p >= 0 ? 'mh-ok' : 'mh-bad') + '"> ' + sign(p) + fmt(p, cur, 2) + '</span></div></div>' +
        '<div style="display:flex;gap:4px"><button class="mh-btn mh-btn-sel" style="padding:5px 10px;font-size:12px" data-act="unarchive" data-v="' + u.id + '">복구</button><button class="mh-btn mh-btn-danger" style="padding:5px 10px;font-size:12px" data-act="ses-del" data-v="' + u.id + '">삭제</button></div></div>'; }).join('')
      : '<div class="mh-note" style="text-align:center;padding:20px">보관된 세션이 없어요</div>') + okBtn());
  }
  function viewRename() {
    var S = MH.sheet, col = colorHex(S.color);
    return sheet('세션 이름·색상', '', '<label class="mh-lbl">이름</label><input class="mh-in" style="font-family:var(--font)" type="text" maxlength="24" placeholder="예: 키움 SOXL" value="' + esc(S.name) + '" data-in="rn:name" data-enter="rn-save">' +
      '<label class="mh-lbl" style="margin-top:12px">닉네임 <span class="mh-faint">— 탭 이름 아래 작게 표시 (선택)</span></label><input class="mh-in" style="font-family:var(--font)" type="text" maxlength="20" placeholder="예: 키움 1234 / ISA / 남편계좌" value="' + esc(S.nick) + '" data-in="rn:nick" data-enter="rn-save">' +
      '<label class="mh-lbl" style="margin-top:12px">색상 <span class="mh-faint">— 탭·상단 띠·배경으로 구분됩니다</span></label><div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">' +
      '<button class="mh-btn' + (!S.color ? ' mh-btn-sel' : '') + '" style="padding:5px 10px;font-size:12px" data-act="rn-color" data-v="">기본</button>' + COLORS.map(function (c) {
        return '<button title="' + c[1] + '" data-act="rn-color" data-v="' + c[0] + '" style="width:26px;height:26px;border-radius:50%;border:2px solid ' + ((COLOR_ALIAS[S.color] || S.color) === c[0] ? 'var(--m-tx)' : 'transparent') + ';background:' + c[2] + ';cursor:pointer"></button>'; }).join('') + '</div>' +
      '<div class="mh-note" style="margin-top:12px"><div class="mh-tiny mh-faint">미리보기</div><span class="mh-stab-b on" style="display:inline-flex;margin-top:6px' + (col ? ';background:' + rgba(col, .15) + ';color:' + col + ';border-color:' + rgba(col, .35) : '') + '"><span>' + esc(S.name.trim() || '세션 이름') + '<span class="t">T1.0</span></span>' + (S.nick.trim() ? '<span class="nick">' + esc(S.nick.trim()) + '</span>' : '') + '</span> <span class="mh-tiny mh-faint">← 탭 모양</span></div>' +
      '<div class="mh-grid2" style="margin-top:14px"><button class="mh-btn" data-act="sheet-close">취소</button><button class="mh-btn mh-btn-p" data-act="rn-save">저장</button></div>');
  }
  function viewDelete() {
    var S = MH.sheet, d = store.sessions.filter(function (s) { return s.id === S.id; })[0]; if (!d) return '';
    var cur = (d.settings && d.settings.currency) || 'USD', tot = d.archivedCycles.reduce(function (a, c) { return a + c.pnl; }, 0) + (d.settings ? E.compute(d.settings, d.transactions, d.midEntry).realizedPnL : 0);
    var canArch = store.sessions.some(function (s) { return s.id !== S.id && !s.archived; }) && !d.archived, ok = (S.typed || '').trim() === '삭제';
    return sheet('<span class="mh-bad">⚠️ 세션 삭제</span>', '', '<div class="mh-note bad"><b>"' + esc(d.name) + '" 세션을 <span class="mh-bad">영구 삭제</span>합니다.</b><div style="margin-top:4px">이 세션의 <b>완료 사이클 ' + d.archivedCycles.length + '회</b>와 진행 중 기록이 모두 사라지고,<b> 누적 실현 손익 ' + sign(tot) + fmt(tot, cur, 2) + '</b>가<b class="mh-bad"> 분석 누계에서 영구히 빠집니다.</b> 되돌릴 수 없어요.</div></div>' +
      '<div class="mh-note ac" style="margin-top:10px">💡 기록을 <b>남기고</b> 탭만 정리하려면 <b>보관</b>을 쓰세요. 탭에서 숨겨지지만 분석 누계엔 그대로 남고, 언제든 복구할 수 있어요.' + (canArch ? '<button class="mh-btn mh-btn-sel" style="width:100%;margin-top:8px" data-act="del-archive" data-v="' + d.id + '">📦 삭제 대신 보관하기 (추천)</button>' : '') +
      '<div class="mh-tiny mh-faint" style="margin-top:6px">· 그래도 삭제하려면, 먼저 <b>분석 → 내보내기</b>로 백업을 권장합니다</div></div>' +
      '<label class="mh-lbl" style="margin-top:12px">정말 삭제하려면 아래에 <b class="mh-bad">삭제</b> 를 입력하세요</label><input class="mh-in" style="font-family:var(--font)" type="text" placeholder="삭제" autocomplete="off" value="' + esc(S.typed || '') + '" data-in="del:typed">' +
      '<div class="mh-grid2" style="margin-top:12px"><button class="mh-btn" data-act="sheet-close">취소</button><button class="mh-btn mh-btn-danger" id="mh-del-go" data-act="del-go" data-v="' + d.id + '"' + (ok ? '' : ' disabled') + '>영구 삭제</button></div>');
  }
  /* ── 데이터 코드 (로그인 대신 기기 간 이동) ── */
  function toCode(o) { var j = JSON.stringify(o); try { return btoa(unescape(encodeURIComponent(j))); } catch (e) { return btoa(j); } }
  function fromCode(c) { var t = String(c).replace(/\s/g, ''); try { return JSON.parse(decodeURIComponent(escape(atob(t)))); } catch (e) { try { return JSON.parse(atob(t)); } catch (e2) { return null; } } }
  function viewCodeExport() {
    var code = toCode({ v: 4, exportedAt: new Date().toISOString(), sessions: store.sessions, activeSessionId: store.activeSessionId });
    return sheet('☁ 데이터 코드 내보내기', '모든 세션·기록·완료 사이클이 들어 있어요', '<textarea class="mh-in" id="mh-code-out" rows="5" readonly style="resize:none;font-size:11px">' + code + '</textarea>' +
      '<p class="mh-help">이 코드를 복사해 다른 기기의 무한매수법 탭에서 <b>☁ 코드로 불러오기</b>에 붙여넣으면 그대로 이어서 쓸 수 있어요. 기록이 바뀔 때마다 새 코드를 저장해 두세요.</p>' +
      '<div class="mh-grid2" style="margin-top:12px"><button class="mh-btn" data-act="sheet-close">닫기</button><button class="mh-btn mh-btn-p" data-act="code-copy">' + (MH.sheet.copied ? '✓ 복사됨' : '📋 복사') + '</button></div>');
  }
  function viewCodeImport() {
    return sheet('☁ 코드로 데이터 불러오기', '다른 기기에서 복사한 코드를 붙여넣으세요', '<textarea class="mh-in" rows="5" style="resize:none;font-size:11px" placeholder="코드 붙여넣기" data-in="imp:code">' + esc(MH.sheet.code || '') + '</textarea>' +
      (MH.sheet.err ? '<div class="mh-note bad" style="margin-top:8px">' + MH.sheet.err + '</div>' : '') + '<p class="mh-help">불러오면 이 기기의 현재 무한매수법 기록이 코드 내용으로 <b>바뀝니다</b>. 필요하면 먼저 코드 내보내기로 백업하세요.</p>' +
      '<div class="mh-grid2" style="margin-top:12px"><button class="mh-btn" data-act="sheet-close">취소</button><button class="mh-btn mh-btn-p" data-act="code-apply">불러오기</button></div>');
  }
  function applyCode() {
    var d = fromCode(MH.sheet.code || ''), n = null;
    if (d && d.sessions) n = normalize(d);
    else if (d && (d.settings || d.sessions === undefined && d.trades)) n = migrateOld(d);
    else if (d && d.settings !== undefined) n = migrateOld(d);
    if (!n) { MH.sheet.err = '올바른 코드가 아니에요. 코드 내보내기로 만든 문자열을 그대로 붙여넣어 주세요.'; render(); return; }
    store = n; save(); MH.sheet = null; MH.view = 'now'; MH.setup = null; render();
  }
  /* ── 사이클 완료 축하 ── */
  function viewCelebrate() {
    var D = derive(), cur = D.cur, conf = '';
    var cols = ['#3182f6', '#3182f6', '#fe9800', '#3182f6', '#3182f6', '#3182f6'];
    for (var i = 0; i < 46; i++) conf += '<span class="mh-conf" style="left:' + (Math.random() * 100) + '%;background:' + cols[i % cols.length] + ';--dx:' + Math.round(Math.random() * 160 - 80) + 'px;--rot:' + Math.round(Math.random() * 720) + 'deg;--d:' + (1800 + Math.random() * 1600) + 'ms;--dl:' + Math.round(Math.random() * 600) + 'ms"></span>';
    var lastDay = D.txs[D.txs.length - 1].date.slice(0, 10), j = D.txs.length - 1; while (j > 0 && D.txs[j - 1].date.slice(0, 10) === lastDay) j--;
    var finalT = j === 0 ? (D.mid ? D.mid.tValue : D.st.tValue) : D.hist[j - 1].tValue, ret = r2(D.s.totalCapital + D.pnl), cmp = ret;
    return '<div class="mh-cel" data-act="cel-close"><div class="mh-cel-box" data-noswipe role="dialog" aria-labelledby="mh-cel-h">' + conf +
      '<button class="mh-ico" style="position:absolute;right:10px;top:10px;font-size:16px" data-act="cel-close" aria-label="닫기">✕</button>' +
      '<div class="mh-tiny mh-ac" style="letter-spacing:.1em;font-weight:700">CYCLE COMPLETE · 회차 종료</div><h1 id="mh-cel-h" style="margin:6px 0;font-size:24px">축하합니다! 🎉</h1>' +
      '<p class="mh-small mh-muted" style="margin:0 0 12px">' + D.days + '일 만에 ' + D.txs.length + '번의 거래를 완수하고<br>마침내 익절로 회차를 마쳤습니다</p>' +
      '<div class="mh-note ac"><div class="mh-tiny mh-faint">실현 손익 · REALIZED P&amp;L</div><div class="mh-mono mh-ok" style="font-size:28px;font-weight:800">' + sign(D.pnl) + fmtL(D.pnl, cur) + '</div>' +
      '<div class="mh-small mh-mono mh-ok">▲ ' + sign(D.pnlPct) + D.pnlPct.toFixed(2) + '%</div>' + (cur === 'USD' && D.fx ? '<div class="mh-tiny mh-faint mh-mono">≈ ₩' + Math.round(D.pnl * D.fx.rate).toLocaleString() + '</div>' : '') + '</div>' +
      '<div class="mh-note" style="text-align:left;margin:10px 0">' + [['종목', esc(D.s.ticker) + ' · ' + D.s.splits + '분할'], ['기간', D.range ? D.range + ' · ' + D.days + '일' : D.days + '일'], ['총 거래', D.txs.length + '회'], ['매도전 T값', finalT.toFixed(2) + ' / ' + D.s.splits], ['총 회수', fmtL(ret, cur)]]
        .map(function (r) { return '<div class="mh-row mh-small" style="padding:2px 0"><span class="mh-muted">' + r[0] + '</span><span class="mh-mono">' + r[1] + '</span></div>'; }).join('') + '</div>' +
      '<button class="mh-btn mh-btn-p" style="width:100%;margin-bottom:6px" data-act="cel-restart" data-v="' + cmp + '">🚀 복리 재시작</button>' +
      '<button class="mh-btn" style="width:100%;margin-bottom:6px" data-act="cel-restart" data-v="' + D.s.totalCapital + '">단리 재시작</button>' +
      '<button class="mh-btn" style="width:100%" data-act="cel-fresh">⚙ 원금 / 분할 변경 후 재시작</button></div></div>';
  }
  /* ════ 차트 (Chart.js) ════ */
  function cssVar(n) { return getComputedStyle($('page-muhan')).getPropertyValue(n).trim() || '#888'; }
  function mkChart(cv, cfg) { if (!window.Chart) return; try { _charts.push(new Chart(cv.getContext('2d'), cfg)); } catch (e) {} }
  function baseOpts(yfmt) {
    var t3 = cssVar('--m-t3'), bd = cssVar('--m-bd');
    return { responsive: true, maintainAspectRatio: false, animation: false, interaction: { mode: 'index', intersect: false },
      plugins: { legend: { display: false }, tooltip: { callbacks: yfmt ? { label: function (c) { return (c.dataset.label ? c.dataset.label + ' ' : '') + yfmt(c.parsed.y); } } : {} } },
      scales: { x: { ticks: { color: t3, font: { size: 10 }, maxTicksLimit: 6, autoSkip: true }, grid: { display: false } }, y: { ticks: { color: t3, font: { size: 10 }, callback: yfmt || undefined }, grid: { color: bd } } } };
  }
  function initCharts() {
    var root = $('mh-root'); if (!root || !window.Chart) return;
    var ac = cssVar('--m-ac'), ok = cssVar('--m-ok'), bad = cssVar('--m-bad'), info = cssVar('--m-info'), warn = cssVar('--m-warn');
    root.querySelectorAll('canvas[data-chart]').forEach(function (cv) {
      var k = cv.getAttribute('data-chart'), D, cur;
      if (k === 'close') { D = derive(); var pd = periodData(D), o = pd.list, yrs = o[0].date.slice(0, 4) !== o[o.length - 1].date.slice(0, 4), up = o[o.length - 1].close >= o[0].close;
        var lab = o.map(function (p) { var d = new Date(p.date + 'T12:00:00'), y2 = String(d.getFullYear()).slice(2); return pd.p[2] >= 365 ? y2 + '/' + (d.getMonth() + 1) : yrs ? y2 + '/' + (d.getMonth() + 1) + '/' + d.getDate() : (d.getMonth() + 1) + '/' + d.getDate(); });
        var ds = [{ data: o.map(function (p) { return p.close; }), borderColor: up ? ok : bad, backgroundColor: (up ? 'rgba(49,130,246,.12)' : 'rgba(240,68,82,.12)'), fill: true, pointRadius: 0, borderWidth: 1.6, tension: .2 }];
        if (D.st.avgPrice > 0) ds.push({ label: '평단가', data: o.map(function () { return D.st.avgPrice; }), borderColor: info, borderDash: [4, 4], pointRadius: 0, borderWidth: 1 });
        mkChart(cv, { type: 'line', data: { labels: lab, datasets: ds }, options: baseOpts(function (v) { return '$' + Number(v).toFixed(2); }) }); }
      if (k === 'fear') { var h = MH.fear.historical, yr = new Date().getFullYear();
        var lb = h.map(function (p) { var d = new Date(p.date + 'T12:00:00'); return d.getFullYear() !== yr ? d.getFullYear() + '.' + (d.getMonth() + 1) + '/' + d.getDate() : (d.getMonth() + 1) + '/' + d.getDate(); });
        var col = function (v) { return v >= 75 ? '#3182f6' : v >= 55 ? '#3182f6' : v >= 45 ? '#fe9800' : v >= 25 ? '#fe9800' : '#f04452'; };
        var o2 = baseOpts(function (v) { return Number(v).toFixed(0); }); o2.scales.y.min = 0; o2.scales.y.max = 100;
        mkChart(cv, { type: 'line', data: { labels: lb, datasets: [{ data: h.map(function (p) { return p.score; }), pointRadius: 0, borderWidth: 1.6, tension: .25, segment: { borderColor: function (c) { return col(c.p1.parsed.y); } }, borderColor: '#fe9800' }] }, options: o2 }); }
      if (k === 'avg') { D = derive(); var hs = D.hist, tab = MH.avgTab || 'avg', lbl = hs.map(function (p) { var d = new Date(p.date); return (d.getMonth() + 1) + '/' + d.getDate(); });
        var data = tab === 'avg' ? { labels: lbl, datasets: [{ label: '평단가', data: hs.map(function (p) { return p.avgPrice; }), borderColor: ac, pointRadius: 2, borderWidth: 1.6 }] } :
          tab === 'tq' ? { labels: lbl, datasets: [{ label: 'T값', data: hs.map(function (p) { return p.tValue; }), borderColor: ac, pointRadius: 2, borderWidth: 1.6, yAxisID: 'y' }, { label: '보유수량', data: hs.map(function (p) { return p.totalQuantity; }), borderColor: info, pointRadius: 2, borderWidth: 1.4, yAxisID: 'y1' }] } :
          { labels: lbl, datasets: [{ label: '누적 실현 손익', data: hs.map(function (p) { return p.realizedPnL; }), borderColor: ok, pointRadius: 2, borderWidth: 1.6 }] };
        var o3 = baseOpts(); if (tab === 'tq') o3.scales.y1 = { position: 'right', ticks: { color: cssVar('--m-t3'), font: { size: 10 } }, grid: { display: false } }; o3.plugins.legend = { display: tab === 'tq', labels: { color: cssVar('--m-t2'), boxWidth: 10, font: { size: 10 } } };
        mkChart(cv, { type: 'line', data: data, options: o3 }); }
      if (k === 'monthly') { var g = MH._an.cards[Number(cv.getAttribute('data-i'))], ms = g.series, c2 = g.currency, f = function (v) { return c2 === 'KRW' ? '₩' + Math.round(v).toLocaleString() : '$' + Math.round(v).toLocaleString(); };
        mkChart(cv, { type: 'bar', data: { labels: ms.map(function (x) { return x.label; }), datasets: [{ type: 'bar', label: '월 손익', data: ms.map(function (x) { return x.pnl; }), backgroundColor: ms.map(function (x) { return x.pnl >= 0 ? 'rgba(49,130,246,.7)' : 'rgba(240,68,82,.7)'; }), maxBarThickness: 40, borderRadius: 3 },
          { type: 'line', label: '누적', data: ms.map(function (x) { return x.cumulative; }), borderColor: ac, pointRadius: 2, borderWidth: 1.6 }] }, options: baseOpts(f) }); }
      if (k === 'realized') { var det = MH._realizedChart || [];
        mkChart(cv, { type: 'bar', data: { labels: det.map(function (r) { var d = new Date(r.date); return (d.getMonth() + 1) + '/' + d.getDate(); }), datasets: [{ type: 'bar', label: '건별 손익', data: det.map(function (r) { return r2(r.realized); }), backgroundColor: det.map(function (r) { return r.realized >= 0 ? 'rgba(49,130,246,.7)' : 'rgba(240,68,82,.7)'; }), borderRadius: 3, maxBarThickness: 28 },
          { type: 'line', label: '누적', data: det.map(function (r) { return r2(r.cumulative); }), borderColor: ac, pointRadius: 2, borderWidth: 1.6 }] }, options: baseOpts() }); }
      if (k === 'cycle') { var hh = (MH._cycleHist || {})[cv.getAttribute('data-v')] || [];
        mkChart(cv, { type: 'line', data: { labels: hh.map(function (p) { var d = new Date(p.date); return (d.getMonth() + 1) + '/' + d.getDate(); }), datasets: [{ label: '평단가', data: hh.map(function (p) { return p.avgPrice; }), borderColor: ac, pointRadius: 2, borderWidth: 1.6 }] }, options: baseOpts() }); }
    });
  }

  /* ════ 이벤트 (위임) ════ */
  function confirmSplits(n, txCount) {
    if (E.isExtSplits(n) && !confirm(E.EXT_WARN)) return false;
    return confirm(txCount > 0 ? '거래가 ' + txCount + '건 있습니다. 분할 수를 변경하면 별%, 매수금, 페이즈 등이 새 분할 수로 재계산됩니다.\n계속할까요?' : '분할 수를 ' + n + '분할로 변경할까요?');
  }
  function numIn(id) { var el = $(id); return el ? Number(el.value) : NaN; }
  function onClick(e) {
    var el = e.target.closest('[data-act]'); if (!el || !$('mh-root').contains(el)) return;
    var a = el.getAttribute('data-act'), v = el.getAttribute('data-v'), ses = active(), s = ses.settings, u = MH.setup;
    if ((a === 'sheet-bg' || a === 'cel-close') && e.target !== el) return;   /* 시트 내부 클릭은 무시 */
    switch (a) {
      /* 세션 */
      case 'ses-go': store.activeSessionId = v; MH.view = 'now'; MH.menu = false; save(); render(); break;
      case 'ses-add': mut(function () { var n = newSession('세션 ' + (store.sessions.length + 1)); store.sessions.push(n); store.activeSessionId = n.id; MH.menu = false; MH.view = 'now'; }); break;
      case 'ses-menu': var r = el.getBoundingClientRect(); MH.pop = { id: v, top: r.bottom + 4, left: Math.min(r.left, window.innerWidth - 170) }; render(); break;
      case 'pop-close': MH.pop = null; render(); break;
      case 'ses-rename': var t = store.sessions.filter(function (x) { return x.id === v; })[0]; MH.pop = null; MH.menu = false; MH.sheet = { kind: 'rename', id: v, name: t.name, nick: t.nickname || '', color: t.color || null }; render(); break;
      case 'rn-color': MH.sheet.color = v || null; render(); break;
      case 'rn-save': mut(function () { var S = MH.sheet, t2 = store.sessions.filter(function (x) { return x.id === S.id; })[0]; if (S.name.trim()) t2.name = S.name.trim(); t2.color = S.color || undefined; t2.nickname = S.nick.trim() || undefined; MH.sheet = null; }); break;
      case 'ses-archive': MH.pop = null; MH.menu = false; archive(v); break;
      case 'del-archive': MH.sheet = null; archive(v); break;
      case 'unarchive': mut(function () { store.sessions.forEach(function (x) { if (x.id === v) x.archived = false; }); }); break;
      case 'ses-del': MH.pop = null; MH.menu = false; MH.sheet = { kind: 'delete', id: v, typed: '' }; render(); break;
      case 'del-go': if ((MH.sheet.typed || '').trim() !== '삭제') return; deleteSession(v); break;
      case 'ses-reset': MH.menu = false; if (confirm(ses.archivedCycles.length > 0 ? '이 세션을 초기화하면 완료 사이클 ' + ses.archivedCycles.length + '회 기록도 사라집니다.\n계속할까요? (기록을 남기려면 \'보관\'을 쓰세요)' : '이 세션을 초기화할까요?'))
        mut(function () { ses.settings = null; ses.transactions = []; ses.isReverseMode = false; ses.reverseStarPrice = null; ses.midEntry = null; MH.setup = null; }); else render(); break;
      case 'archive-box': MH.menu = false; MH.sheet = { kind: 'archive' }; render(); break;
      /* 설정 화면 */
      case 'su-ticker': if (Number(u.target) === E.defaultTarget(u.custom ? u.name : u.ticker)) u.target = String(E.defaultTarget(v)); u.ticker = v; u.custom = false; render(); break;
      case 'su-custom': if (!u.custom && !confirm('무한매수법은 TQQQ·SOXL 등 미국 ETF에 최적화된 전략입니다.\n라오어는 다른 종목(한국주식·개별주 등) 적용을 추천하지 않습니다.\n계속하시겠습니까?')) return; u.custom = true; render(); break;
      case 'su-cur': u.currency = v; render(); break;
      case 'su-splits': var n = Number(v); if (n !== u.splits && E.isExtSplits(n) && !confirm(E.EXT_WARN)) return; u.splits = n; render(); break;
      case 'su-mid': u.mid = v === '1'; render(); break;
      case 'su-start': startSetup(); break;
      /* 상단 */
      case 'menu': MH.menu = !MH.menu; render(); break;
      case 'menu-close': MH.menu = false; render(); break;
      case 'view': MH.view = v; MH.menu = false; render(); break;
      case 'tg-todo': MH.todo = !MH.todo; localStorage.setItem('muhan4-order-todo', String(MH.todo)); render(); break;
      case 'tg-rsi': MH.rsiOn = !MH.rsiOn; localStorage.setItem('muhan4-rsi', String(MH.rsiOn)); render(); break;
      case 'rsi-m': MH.rsiMethod = v; localStorage.setItem('muhan4-rsi-method', v); render(); break;
      case 'tg-vix': MH.vixOn = !MH.vixOn; localStorage.setItem('muhan4-vix', String(MH.vixOn)); render(); break;
      case 'tg-basis': upd({ recordDateBasis: s.recordDateBasis === 'us' ? 'kst' : 'us' }); break;
      case 'tg-nobig': upd({ disableBigNum: s.disableBigNum !== true }); break;
      case 'ap-target': var x1 = numIn('mh-m-target'); if (!isFinite(x1) || x1 <= 0 || x1 > 50) { alert('1 ~ 50 사이의 값을 입력하세요'); return; } upd({ targetProfit: r2(x1) }); break;
      case 'ap-big': var x2 = numIn('mh-m-big'); if (!isFinite(x2) || x2 < 0 || x2 > 40) { alert('0 ~ 40 사이의 값을 입력하세요'); return; } upd({ bigNumPercent: r2(x2) }); break;
      case 'ap-lines': var x3 = numIn('mh-m-lines'); if (!isFinite(x3) || x3 < 1 || x3 > 80 || !Number.isInteger(x3)) { alert('1 ~ 80 사이 정수를 입력하세요'); return; } upd({ lowerLocLines: x3 }); break;
      case 'ap-shares': var x4 = numIn('mh-m-shares'); if (!isFinite(x4) || x4 < 1 || x4 > 20 || !Number.isInteger(x4)) { alert('1 ~ 20 사이 정수를 입력하세요'); return; } upd({ lowerLocShares: x4 }); break;
      case 'ap-tick': var tv = ($('mh-m-tick').value || '').trim(); if (tv === '') { upd({ tickSize: undefined }); return; } var x5 = Number(tv); if (!isFinite(x5) || x5 < 0) { alert('0 이상 숫자를 입력하세요 (비우면 스냅 해제)'); return; } upd({ tickSize: x5 > 0 ? x5 : undefined }); break;
      case 'ap-cap': var x6 = numIn('mh-m-cap'); if (!isFinite(x6) || x6 <= 0) { alert('1 이상의 값을 입력하세요'); return; } x6 = r2(x6); if (x6 !== s.totalCapital && confirm('원금을 ' + fmtL(x6, s.currency || 'USD') + '로 변경할까요?\n잔금 = 원금 - 총투자 + 총회수')) upd({ totalCapital: x6 }); break;
      case 'm-splits': var ns = Number(v); if (ns === s.splits) return; if (confirmSplits(ns, ses.transactions.length)) upd({ splits: ns }); break;
      /* 리버스 */
      case 'rev-on': mut(function () { ses.isReverseMode = true; ses.reverseStarPrice = null; }); break;
      case 'rev-off': if (confirm('일반모드로 복귀할까요? (T값 유지)')) mut(function () { ses.isReverseMode = false; ses.reverseStarPrice = null; }); break;
      case 'rev-reenter': if (confirm('리버스모드로 재진입할까요? (T값·기록 유지 — 진행하던 지점부터 계속)')) mut(function () { ses.isReverseMode = true; ses.reverseStarPrice = null; }); break;
      case 'rev-auto': mut(function () { ses.reverseStarPrice = derive().a5; }); break;
      /* 주문표 */
      case 'order-done': mut(function () { var d0 = today(), on = !!(ses.orderDone && ses.orderDone.date === d0 && ses.orderDone.done); ses.orderDone = { date: d0, done: !on }; }); break;
      case 'yesterday': MH.sheet = { kind: 'yesterday', mode: 'after' }; render(); break;
      case 'y-mode': MH.sheet.mode = v; render(); break;
      case 'cap-auto': MH.capEdited = false; MH.capBase = null; render(); break;
      case 'mc-add': var mv = Number(MH.manualClose); if (!MH.manualDate || !isFinite(mv) || mv <= 0) return;
        mut(function () { var L = (s.manualCloses || []).filter(function (m) { return m.date !== MH.manualDate; }).concat([{ date: MH.manualDate, close: r2(mv) }]).sort(function (p, q) { return p.date < q.date ? -1 : 1; }).slice(-30);
          var ns2 = Object.assign({}, s, { manualCloses: L }); if (L[L.length - 1].date === MH.manualDate) ns2.manualClose = r2(mv); ses.settings = ns2; MH.manualClose = ''; }); break;
      case 'mc-del': mut(function () { var L = (s.manualCloses || []).filter(function (m) { return m.date !== v; }); ses.settings = Object.assign({}, s, { manualCloses: L.length ? L : undefined }); }); break;
      /* 사이클 */
      case 'restart': startNewCycle(Number(v)); break;
      case 'restart-open': MH.restartOpen = !MH.restartOpen; if (MH.restartOpen) { var D0 = derive(); MH.restartCap = String(r2(s.totalCapital + D0.pnl)); MH.restartSplits = s.splits; } render(); break;
      case 'rs-cap': MH.restartCap = v; render(); break;
      case 'rs-splits': var rs = Number(v); if (rs !== MH.restartSplits && E.isExtSplits(rs) && !confirm(E.EXT_WARN)) return; MH.restartSplits = rs; render(); break;
      case 'rs-apply': var rc = Number(MH.restartCap); if (!isFinite(rc) || rc <= 0) { alert('원금은 1 이상의 값을 입력하세요'); return; } startNewCycle(r2(rc), MH.restartSplits); break;
      case 'cel-close': localStorage.setItem('muhan4-celebrated:' + MH.sheet.key, '1'); MH.sheet = null; render(); break;
      case 'cel-restart': localStorage.setItem('muhan4-celebrated:' + MH.sheet.key, '1'); MH.sheet = null; startNewCycle(Number(v)); break;
      case 'cel-fresh': localStorage.setItem('muhan4-celebrated:' + MH.sheet.key, '1'); MH.sheet = null; var D1 = derive(); MH.restartCap = String(r2(s.totalCapital + D1.pnl)); MH.restartSplits = s.splits; MH.restartOpen = true; render(); break;
      case 'avg-tab': MH.avgTab = v; render(); break;
      /* 분석 */
      case 'an-scope': MH.anScope = v; MH.anOpen = null; render(); break;
      case 'an-open': MH.anOpen = MH.anOpen === v ? null : v; render(); break;
      case 'cycle-del': if (confirm('이 아카이브를 삭제할까요?')) mut(function () { ses.archivedCycles = ses.archivedCycles.filter(function (c) { return c.id !== v; }); }); break;
      case 'export': MH.sheet = { kind: 'export' }; render(); break;
      case 'ex-scope': MH.sheet.scope = v; MH.sheet.msg = null; render(); break;
      case 'ex-csv': var X = exportSets(MH.sheet.scope); download(X.base + '-거래내역.csv', new Blob([csv(TX_COLS, X.tx)], { type: 'text/csv;charset=utf-8' }));
        setTimeout(function () { download(X.base + '-사이클요약.csv', new Blob([csv(CY_COLS, X.cy)], { type: 'text/csv;charset=utf-8' })); }, 400); MH.sheet.msg = 'CSV 2개 파일을 내려받았어요 (거래내역 · 사이클요약)'; render(); break;
      case 'ex-json': var X2 = exportSets(MH.sheet.scope); download(X2.base + '.json', new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), scope: MH.sheet.scope === 'all' ? '전체' : X2.list[0].name, sessions: X2.list }, null, 2)], { type: 'application/json;charset=utf-8' }));
        MH.sheet.msg = 'JSON 파일을 내려받았어요'; render(); break;
      case 'ex-xlsx': exportXlsx(); break;
      /* 기록 */
      case 'rec-open': MH.menu = false; openRecord(); break;
      case 'rec-type': var R = recState(), f = E.prefill(v, R.ctx, R.rec); Object.assign(MH.sheet, { step: 'detail', type: v, tManual: false, tVal: '', bp: f.buyPrice, bq: f.buyQty, sp: f.sellPrice, sq: f.sellQty }); render(); recLive(); break;
      case 'rec-back': MH.sheet.step = 'type'; MH.sheet.type = null; render(); break;
      case 'rec-tman': var S = MH.sheet; S.tManual = !S.tManual; if (S.tManual && S.tVal === '') S.tVal = E.nextT(derive().st.tValue, S.type, s.splits, S.date).toFixed(2); render(); recLive(); break;
      case 'rec-save': saveRecord(); break;
      case 'rec-best': var R2 = recState(); if (!R2.bestOK) return; var g = groupOf(R2.best), bf = R2.bestFill, tx = { date: MH.sheet.date + 'T12:00:00', type: R2.best, price: 0, quantity: 0 };
        if (g === 'buy') { tx.price = Number(bf.buyPrice); tx.quantity = Number(bf.buyQty); } else if (g === 'sell') { tx.price = Number(bf.sellPrice); tx.quantity = Number(bf.sellQty); }
        else { tx.sellPrice = Number(bf.sellPrice); tx.sellQuantity = Number(bf.sellQty); tx.price = Number(bf.buyPrice); tx.quantity = Number(bf.buyQty); }
        MH.sheet = null; mut(function () { addTx(tx); }); break;
      case 'rec-both': var R3 = recState(); if (!R3.both) return; var dd = MH.sheet.date + 'T12:00:00'; MH.sheet = null;
        mut(function () { addTx({ date: dd, type: 'limit_sell', price: R3.both.lPrice, quantity: R3.both.lQty }); addTx({ date: dd, type: 'quarter_sell', price: R3.both.qPrice, quantity: R3.both.qQty }); }); break;
      case 'rec-first': var R4 = recState(); if (!R4.first) return; var d4 = MH.sheet.date + 'T12:00:00'; MH.sheet = null; mut(function () { addTx({ date: d4, type: 'full_buy', price: R4.first.price, quantity: R4.first.qty }); }); break;
      case 'tx-edit': var tx0 = ses.transactions.filter(function (t) { return t.id === v; })[0];
        MH.sheet = { kind: 'edit', id: v, p: String(tx0.price), q: String(tx0.quantity), sp: String(tx0.sellPrice != null ? tx0.sellPrice : ''), sq: String(tx0.sellQuantity != null ? tx0.sellQuantity : ''), date: tx0.date.slice(0, 10), tManual: tx0.tOverride !== undefined, tVal: tx0.tOverride !== undefined ? String(tx0.tOverride) : '' };
        render(); editLive(); break;
      case 'ed-tman': var S2 = MH.sheet; S2.tManual = !S2.tManual; if (S2.tManual && S2.tVal === '') S2.tVal = editInfo().tAuto.toFixed(2); render(); editLive(); break;
      case 'ed-save': saveEdit(); break;
      case 'tx-del': if (confirm('이 기록을 삭제할까요?')) mut(function () { ses.transactions = ses.transactions.filter(function (t) { return t.id !== v; }); }); break;
      case 'realized-detail': MH.sheet = { kind: 'realized', cycleId: v || null }; render(); break;
      /* 데이터 코드 */
      case 'code-export': MH.menu = false; MH.sheet = { kind: 'code-export' }; render(); break;
      case 'code-import': MH.menu = false; MH.sheet = { kind: 'code-import', code: '' }; render(); break;
      case 'code-copy': var ta = $('mh-code-out'); (navigator.clipboard ? navigator.clipboard.writeText(ta.value) : Promise.reject()).catch(function () { ta.select(); document.execCommand('copy'); });
        MH.sheet.copied = true; render(); break;
      case 'code-apply': applyCode(); break;
      case 'sheet-bg': case 'sheet-close': MH.sheet = null; render(); break;
      default: if (INFO[a] || a === 'i-fear-range') { MH.sheet = { kind: a }; render(); }
    }
  }
  function archive(id) { mut(function () { var others = store.sessions.filter(function (x) { return x.id !== id && !x.archived; }); if (!others.length) return;
    store.sessions.forEach(function (x) { if (x.id === id) x.archived = true; }); if (store.activeSessionId === id) store.activeSessionId = others[0].id; }); }
  function deleteSession(id) { mut(function () { var rest = store.sessions.filter(function (x) { return x.id !== id; }), lv = rest.filter(function (x) { return !x.archived; });
    if (!lv.length) { MH.sheet = null; return; } store.sessions = rest; if (store.activeSessionId === id) store.activeSessionId = lv[0].id; MH.sheet = MH.sheet && MH.sheet.kind === 'delete' ? null : MH.sheet; }); }
  function startSetup() {
    var u = MH.setup, c = setupCalc(u); if (!c.valid) return;
    if (u.custom && !u.name.trim()) { alert('종목명을 입력해주세요.'); return; }
    var tk = u.custom ? u.name.trim() : u.ticker, st = { ticker: tk, splits: u.splits, targetProfit: r2(Number(u.target)), bigNumPercent: r2(Number(u.big)), lowerLocShares: Number(u.shares), lowerLocLines: Number(u.lines) };
    if (u.custom) { st.isCustom = true; st.currency = u.currency; if (Number(u.close) > 0) st.manualClose = Number(u.close); if (Number(u.tick) > 0) st.tickSize = Number(u.tick); }
    mut(function () { var ses = active();
      if (u.mid) { st.totalCapital = c.total; ses.midEntry = { tValue: c.T, avgPrice: Number(u.avg), totalQuantity: Number(u.qty), remainingCapital: Number(u.cash) }; } else st.totalCapital = c.cap;
      ses.settings = st; if (ses.name === '세션 1' || ses.name.indexOf('세션 ') === 0) ses.name = tk + ' ' + u.splits + '분할'; MH.setup = null; MH.view = 'now'; });
  }
  function onInput(e) {
    var el = e.target, k = el.getAttribute('data-in'); if (!k || !$('mh-root').contains(el)) return;
    var p = k.split(':'), val = el.value;
    if (p[0] === 'su') { MH.setup[p[1]] = val; var dyn = $('mh-su-dyn'); if (dyn) dyn.innerHTML = setupDyn(); return; }
    if (p[0] === 'rec') { MH.sheet[p[1]] = val; recLive(); return; }
    if (p[0] === 'ed') { MH.sheet[p[1]] = val; editLive(); return; }
    if (p[0] === 'rn') { MH.sheet[p[1]] = val; return; }
    if (p[0] === 'del') { MH.sheet.typed = val; var b = $('mh-del-go'); if (b) b.disabled = val.trim() !== '삭제'; return; }
    if (p[0] === 'imp') { MH.sheet.code = val; return; }
    if (k === 'font') { MH.fontScale = Number(val); localStorage.setItem('muhan4-fontScale', val); $('mh-root').style.zoom = MH.fontScale; return; }
    if (k === 'cap') { MH.capVal = val; MH.capEdited = true; var n = Number(val), ok = isFinite(n) && n > 0, cur = active().settings.currency || 'USD', t = ok ? fmt(Math.floor(n * 1.2 * 100) / 100, cur, 2) : '-';
      if ($('mh-cap-out')) $('mh-cap-out').textContent = t; if ($('mh-cap-out2')) $('mh-cap-out2').textContent = ok ? t : '—'; return; }
    if (k === 'big-live') { var mx = Number(el.getAttribute('data-max')), y = Number(val); var w = y > Math.floor(mx) ? mx : Math.round(y); if ($('mh-big-lbl')) $('mh-big-lbl').textContent = w + '%'; return; }
    if (k === 'mc-date') { MH.manualDate = val; return; } if (k === 'mc-close') { MH.manualClose = val; return; }
    if (k === 'rs-cap') { MH.restartCap = val; return; }
  }
  function onChange(e) {
    var el = e.target, k = el.getAttribute('data-ch'); if (!k || !$('mh-root').contains(el)) return;
    if (k === 'rev-star') { mut(function () { active().reverseStarPrice = el.value ? Number(el.value) : null; }); return; }
    if (k === 'period') { MH.chartPeriod = el.value; render(); return; }
    if (k === 'rec-date') { MH.sheet.date = el.value; render(); recLive(); return; }
    if (k === 'big-set') { var mx = Number(el.getAttribute('data-max')), y = Number(el.value); upd({ bigNumPercent: y > Math.floor(mx) ? mx : Math.round(y) }); }
  }
  function onKey(e) { if (e.key !== 'Enter') return; var el = e.target, a = el.getAttribute && el.getAttribute('data-enter'); if (!a) return; e.preventDefault(); var b = document.createElement('span'); b.setAttribute('data-act', a); $('mh-root').appendChild(b); onClick({ target: b }); }
  /* 세션 탭 드래그 순서 변경 · 좌우 스와이프로 세션 이동 */
  var dragFrom = null, touch = null;
  function bind() {
    var root = $('mh-root'); if (!root || root._mhBound) return; root._mhBound = true;
    root.addEventListener('click', onClick); root.addEventListener('input', onInput); root.addEventListener('change', onChange); root.addEventListener('keydown', onKey);
    root.addEventListener('dragstart', function (e) { var t = e.target.closest('[data-drag]'); if (!t) return; dragFrom = Number(t.getAttribute('data-drag')); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(dragFrom)); });
    root.addEventListener('dragover', function (e) { var t = e.target.closest('[data-drag]'); if (!t || dragFrom === null) return; e.preventDefault(); var to = Number(t.getAttribute('data-drag'));
      root.querySelectorAll('.mh-stab').forEach(function (x) { x.classList.remove('drop-l', 'drop-r'); }); if (to !== dragFrom) t.classList.add(to < dragFrom ? 'drop-l' : 'drop-r'); });
    root.addEventListener('drop', function (e) { var t = e.target.closest('[data-drag]'); if (!t || dragFrom === null) return; e.preventDefault(); var to = Number(t.getAttribute('data-drag')), from = dragFrom; dragFrom = null;
      if (to !== from) mut(function () { var L = store.sessions.slice(), m = L.splice(from, 1)[0]; L.splice(to, 0, m); store.sessions = L; }); else render(); });
    root.addEventListener('dragend', function () { dragFrom = null; root.querySelectorAll('.mh-stab').forEach(function (x) { x.classList.remove('drop-l', 'drop-r'); }); });
    root.addEventListener('touchstart', function (e) { if (e.target.closest('[data-noswipe], input, textarea, select, canvas')) { touch = null; return; } var t = e.touches[0]; touch = { x: t.clientX, y: t.clientY, t: Date.now() }; }, { passive: true });
    root.addEventListener('touchend', function (e) { if (!touch) return; var t0 = touch; touch = null; var L = live(); if (L.length <= 1 || MH.sheet) return; var t = e.changedTouches[0], dx = t.clientX - t0.x, dy = t.clientY - t0.y;
      if (Date.now() - t0.t < 600 && Math.abs(dx) > 80 && Math.abs(dx) > Math.abs(dy) * 1.5) { var i = L.findIndex(function (x) { return x.id === active().id; });
        if (dx < 0 && i >= 0 && i < L.length - 1) { store.activeSessionId = L[i + 1].id; save(); render(); } else if (dx > 0 && i > 0) { store.activeSessionId = L[i - 1].id; save(); render(); } } }, { passive: true });
    setInterval(function () { MH.now = new Date(); }, 60000);
  }
  /* 탭 진입 시 호출 ([NAV] switchSubTab 의 훅) */
  window.muhanInit = function () { bind(); MH.now = new Date(); render(); };
  window.MHdebug = { get store() { return store; }, derive: derive, render: render };
})();



/* ════════════════════════════════════════
   [CORP-TAX] 법인세 계산기 — 순수 계산 CT.calc(개별 법인) · CT.group(연결납세) + 화면
   근거(2026-10 현행 원문 확인: 법인세법·시행령·시행규칙 서식, 조특법·시행령, 농특세법·시행령, 지방세법·지특법)
   · 세율 법인세법 §55: 2026.1.1. 이후 개시 사업연도 10·20·22·25% (2023~2025년 개시 9·19·21·24%)
       §60의2①1호 소규모 성실신고확인 법인(2025년 개시분부터): 200억 이하 19%(2026~ 20%)·22%·25%
       사업연도 1년 미만: 세율(과세표준 × 12/월수) × 월수/12 (1개월 미만은 1개월)
   · 기부금 §24·조특법 §88의4⑬·서식 별지 21호: 기준소득금액 − 이월결손금(공제한도 내)
       특례 50% → 우리사주 30% → 일반 10%(사회적기업 2026년 개시분부터 30%, 그 전 20%), 이월분(10년) 먼저
   · 고유목적사업준비금 §29(비영리): 이자·배당 100% + 그 밖의 수익사업소득 50%(장학 공익법인 80%, 조특법 §74 대상 100%)
   · 이월결손금 §13·§91: 소득의 100%(중소기업·조특법 §74 대상 비영리) / 80%(그 밖, 외국법인)
   · 토지 등 양도소득 §55의2: 주택·별장·입주권·분양권 20%, 비사업용 토지 10%, 미등기 40% — 차손은 같은 세율 → 다른 세율 순 상계
   · 미환류소득 조특법 §100의32(상호출자제한기업집단): 2026년~ 투자포함 80%·투자제외 30%(배당 공제), 그 전 70%·15% × 세율 20%
   · 최저한세 조특법 §132·령 §126: 감면 전 과세표준 × (중소 7% · 졸업 후 1~3년 8% · 4~5년 9% · 일반 100억 10%·1천억 12%·초과 17%)
       배제 순서(령 §126⑤): 손금산입 → 세액공제(조문 순) → 세액감면 → 소득공제·비과세 / 창업감면 100%·중소기업 R&D 공제는 적용 제외
   · 중소기업 특별세액감면 한도 §7①3: 1억원(상시근로자 감소 시 1명당 500만원 차감)
   · 농어촌특별세 농특세법 §5: 실제 공제·감면받은 조특법 감면세액 × 20% (§6·§7·§10·§30의4 등 비과세, 외국납부세액공제·손금산입은 대상 아님)
   · 지점세 §96: (소득금액 − 법인세 − 법인지방소득세 − 재투자 자본 증가 − 과소자본 손금불산입 + 자본 감소) × 조약세율(기본 20%)
   · 법인지방소득세 지방세법 §103의19~23·§103의31: 과세표준(외국납부 법인세액 차감)에 법인세율의 1/10, 토지 등 1/10, 미환류 법인세의 10%
       법인세 감면 연동 없음 · 최저한세 없음 · 지특법 §167의5 인구감소지역 고용 공제(1명 45만원, 중소 70만원) · 분납 100만원 초과
   금액 단위: 원 · 세액은 원 미만 버림
════════════════════════════════════════ */
var CT = (function () {
  var INF = Infinity;
  var RATES = {
    '2026': [[2e8, 0.10], [200e8, 0.20], [3000e8, 0.22], [INF, 0.25]],
    '2025': [[2e8, 0.09], [200e8, 0.19], [3000e8, 0.21], [INF, 0.24]],
    '2024': [[2e8, 0.09], [200e8, 0.19], [3000e8, 0.21], [INF, 0.24]]
  };
  var SMALL = { '2026': [[200e8, 0.20], [3000e8, 0.22], [INF, 0.25]], '2025': [[200e8, 0.19], [3000e8, 0.21], [INF, 0.24]] };
  var MIN_LARGE = [[100e8, 0.10], [1000e8, 0.12], [INF, 0.17]];
  var MIN_FLAT = { sme: 0.07, grad3: 0.08, grad5: 0.09 };
  function floor(x) { return Math.floor(x + 1e-6); }
  function pos(x) { return x > 0 ? x : 0; }
  function brackets(year, small) { return small && SMALL[year] ? SMALL[year] : RATES[year] || RATES['2026']; }
  /* 누진 세액 · m < 12 이면 연 환산(법 §55②, 지방세법 §103의21②) */
  function prog(T, br, m, scale) {
    if (!(T > 0)) return 0;
    m = m || 12;
    var Ta = T * 12 / m, prev = 0, t = 0;
    for (var i = 0; i < br.length; i++) {
      if (Ta > prev) t += (Math.min(Ta, br[i][0]) - prev) * br[i][1] * (scale || 1);
      prev = br[i][0];
    }
    return floor(t * m / 12);
  }
  /* 토지 등 양도소득(§55의2, 령 §92의2⑨) — 자산별 양도소득, 차손은 같은 세율 그룹 → 다른 세율 그룹 순 */
  function landTax(items) {
    var RATE = { house: 0.2, right: 0.2, nonbiz: 0.1, unreg: 0.4 };
    var g = { 0.1: { gain: 0, loss: 0 }, 0.2: { gain: 0, loss: 0 }, 0.4: { gain: 0, loss: 0 } };
    (items || []).forEach(function (it) {
      var v = (it.sale || 0) - (it.book || 0), r = RATE[it.type];
      if (!r || (!it.sale && !it.book)) return;
      if (v >= 0) g[r].gain += v; else g[r].loss += -v;
    });
    var keys = [0.4, 0.2, 0.1], net = {};
    keys.forEach(function (k) { var d = Math.min(g[k].gain, g[k].loss); net[k] = g[k].gain - d; g[k].loss -= d; });
    /* 남은 차손은 다른 세율 자산의 양도소득에서 차감 — 둘 이상이면 양도소득 비율로 안분(소득세법 시행령 §167② 준용) */
    var base0 = {}; keys.forEach(function (k) { base0[k] = net[k]; });
    keys.forEach(function (k) {
      var L = g[k].loss; if (!(L > 0)) return;
      var others = keys.filter(function (j) { return j !== k && base0[j] > 0; });
      var sum = others.reduce(function (a, j) { return a + base0[j]; }, 0);
      if (!(sum > 0)) return;
      var take = Math.min(L, others.reduce(function (a, j) { return a + net[j]; }, 0));
      others.forEach(function (j) { net[j] = pos(net[j] - take * base0[j] / sum); });
    });
    var tax = 0, local = 0, rows = [];
    keys.forEach(function (k) { if (net[k] > 0) { var t = floor(net[k] * k); tax += t; local += floor(net[k] * k / 10); rows.push([k, net[k], t]); } });
    return { tax: tax, local: local, rows: rows, gain: g[0.1].gain + g[0.2].gain + g[0.4].gain };
  }
  /* 미환류소득(조특법 §100의32) */
  function unreturned(u, year) {
    if (!u || !u.on) return { tax: 0, local: 0 };
    var newRule = year === '2026';
    var ratioA = newRule ? 0.8 : 0.7, ratioB = newRule ? 0.3 : 0.15;
    var income = Math.min(3000e8, pos(u.corpIncome || 0));
    var common = (newRule ? (u.dividend || 0) : 0) + (u.wage || 0) + (u.coop || 0) * 3;
    var amt = u.method === 'B' ? income * ratioB - common : income * ratioA - (u.invest || 0) - common;
    var un = pos(amt), over = pos(-amt);
    var base = pos(un - (u.reserve || 0) - (u.carryExcess || 0));
    var tax = floor(base * 0.2);
    return { tax: tax, local: floor(tax * 0.1), unret: floor(un), over: floor(over), base: floor(base), ratio: u.method === 'B' ? ratioB : ratioA, income: income };
  }
  function calc(o) {
    var r = { notes: [] }, N = function (k) { return +o[k] || 0; };
    var year = String(o.year || '2026'), m = Math.min(12, Math.max(1, Math.round(o.months || 12)));
    var entity = o.entity || 'dom';
    var small = !!o.small && year !== '2024' && entity !== 'for';
    if (o.small && year === '2024') r.notes.push('2024년 이전 개시 사업연도에는 소규모 성실신고확인대상 법인 특례세율이 없어 일반 세율로 계산했습니다.');
    var kind = o.kind || 'sme';
    if (small && kind !== 'large') { kind = 'large'; r.notes.push('소규모 성실신고확인대상 법인은 조세특례제한법상 중소기업에서 제외되어 일반기업 기준(이월결손금 80%·최저한세 10%~·중소기업 감면 불가)으로 계산했습니다.'); }
    var sme = kind === 'sme';
    r.year = year; r.m = m; r.small = small; r.kind = kind; r.sme = sme; r.entity = entity;
    r.br = brackets(year, small);
    var np74 = entity === 'np' && +o.npRate === 1;
    var lossRate = entity === 'for' ? 0.8 : (sme || np74) ? 1 : 0.8;
    r.lossRate = lossRate;
    /* 1) 세무조정 */
    r.ni = N('ni'); r.add = N('addIn') + N('nonDesig'); r.ded = N('dedIn');
    r.npSep = entity === 'np' ? N('npSep') : 0;
    var R = r.ni + r.add - r.ded - r.npSep;
    r.pre = R;
    /* 2) 기부금 */
    var spCur = N('spCur'), spCarry = N('spCarry'), genCur = N('genCur'), genCarry = N('genCarry'), esCur = N('esCur');
    var genRate = o.social ? (year === '2026' ? 0.3 : 0.2) : 0.1;
    var S = R + spCur + genCur + esCur;
    var Lfor = Math.min(N('carryLoss'), pos(S) * lossRate);
    var A = pos(S - Lfor) * 0.5;
    var spCarryUsed = Math.min(spCarry, A), spCurOk = Math.min(spCur, pos(A - spCarryUsed)), spDed = spCarryUsed + spCurOk;
    var B = pos(S - Lfor - spDed) * 0.3, esOk = Math.min(esCur, B);
    var C = pos(S - Lfor - spDed - esOk) * genRate;
    var genCarryUsed = Math.min(genCarry, C), genCurOk = Math.min(genCur, pos(C - genCarryUsed));
    var D = { S: S, Lfor: Lfor, A: A, B: B, C: C, genRate: genRate,
      spCarryUsed: floor(spCarryUsed), spExcess: floor(spCur - spCurOk), esExcess: floor(esCur - esOk),
      genCarryUsed: floor(genCarryUsed), genExcess: floor(genCur - genCurOk), spDed: floor(spDed),
      spCarryLeft: floor(spCarry - spCarryUsed), genCarryLeft: floor(genCarry - genCarryUsed),
      any: spCur + spCarry + genCur + genCarry + esCur > 0 };
    r.don = D;
    var I = R + D.spExcess + D.esExcess + D.genExcess - D.spCarryUsed - D.genCarryUsed;
    /* 3) 고유목적사업준비금 (비영리) */
    r.reserve = 0;
    if (entity === 'np' && N('npReserve') > 0) {
      var intDiv = Math.min(N('npInt'), pos(I));
      var lossLim = Math.min(N('carryLoss'), pos(I) * lossRate);
      var other = I - intDiv - lossLim - D.spDed;
      var rate = +o.npRate || 0.5;
      var lim = other >= 0 ? intDiv + other * rate : pos(intDiv + other);
      r.reserveLimit = floor(lim);
      r.reserve = floor(Math.min(N('npReserve'), lim));
      r.reserveExcess = N('npReserve') - r.reserve;
      I -= r.reserve;
    }
    r.income = I;
    r.lossNow = I < 0 ? -I : 0;
    /* 4) 과세표준 — 이월결손금 → 비과세 → 소득공제 (조특법 해당분은 최저한세 대상) */
    var rest = pos(I);
    r.carryLoss = N('carryLoss');
    r.lossDed = floor(Math.min(r.carryLoss, rest * lossRate)); rest -= r.lossDed;
    r.lossLeft = r.carryLoss - r.lossDed;
    r.ntLaw = Math.min(N('nontax'), rest); rest -= r.ntLaw;
    r.ntCt = Math.min(N('nontaxCt'), rest); rest -= r.ntCt;
    r.idLaw = Math.min(N('incDed'), rest); rest -= r.idLaw;
    r.idCt = Math.min(N('incDedCt'), rest); rest -= r.idCt;
    var T = floor(rest);
    var ctLoss = Math.min(N('ctDed'), r.ded);          /* 조특법 손금산입·익금불산입 (최저한세 대상) */
    var T0 = T + ctLoss + r.ntCt + r.idCt;              /* 감면 전 과세표준 */
    r.T0 = T0;
    /* 5) 최저한세 대상 / 제외 감면·공제 */
    var stRate = +o.stRate || 0, spcRate = +o.spcRate || 0;
    var stExempt = stRate >= 1;
    r.spcCap = pos(1e8 - N('empDrop') * 5e6);
    var smeOnly = N('stIncome') > 0 || N('spcIncome') > 0;
    if (smeOnly && !sme) r.notes.push('창업중소기업 감면·중소기업 특별세액감면은 중소기업만 받을 수 있어 0원으로 계산했습니다.');
    function reductions(Tx, taxx) {
      if (!sme || !(Tx > 0)) return { st: 0, sp: 0 };
      var sh = function (x) { return Math.min(1, pos(x) / Tx); };
      var st = floor(taxx * sh(N('stIncome')) * stRate);
      var sp = Math.min(r.spcCap, floor(taxx * sh(N('spcIncome')) * spcRate));
      if (st > 0 && sp > 0) { if (st >= sp) sp = 0; else st = 0; }   /* 조특법 §127④ 중복 지원 배제 → 큰 쪽 */
      return { st: st, sp: sp };
    }
    /* 세액공제 (조문 순: §10 R&D → §24 투자 → §29의7·8 고용 → §30의4 사회보험료 → 기타) */
    var credits = [
      { k: 'rnd', name: '연구·인력개발비 세액공제', v: N('crRnd'), min: !sme, nt: false },
      { k: 'inv', name: '통합투자세액공제', v: N('crInv'), min: true, nt: true },
      { k: 'emp', name: '통합고용·고용증대 세액공제', v: N('crEmp'), min: true, nt: true },
      { k: 'soc', name: '중소기업 사회보험료 세액공제', v: sme ? N('crSoc') : 0, min: true, nt: false },
      { k: 'oth', name: '그 밖의 공제·감면 (최저한세 대상)', v: N('crOthMin'), min: true, nt: !!o.crOthMinNt },
      { k: 'othx', name: '그 밖의 공제·감면 (최저한세 제외)', v: N('crOthEx'), min: false, nt: !!o.crOthExNt }
    ];
    if (!sme && N('crSoc') > 0) r.notes.push('중소기업 사회보험료 세액공제는 중소기업만 받을 수 있어 0원으로 계산했습니다.');
    /* 6) 최저한세 배제 계산 */
    var minTax = MIN_FLAT[kind] != null ? floor(T0 * MIN_FLAT[kind]) : floor(prog(T0, MIN_LARGE, 12));
    r.minRateText = MIN_FLAT[kind] != null ? Math.round(MIN_FLAT[kind] * 100) + '%' : '10~17%';
    r.minTax = minTax;
    function state(x1, x4) {   /* x1: 배제한 손금산입, x4: 배제한 소득공제·비과세 → 과세표준·산출세액·감면 */
      var Tx = T + x1 + x4, taxx = prog(Tx, r.br, m), red = reductions(Tx, taxx);
      return { T: Tx, tax: taxx, red: red };
    }
    function subjTotal(s, crEx, redEx) {
      var c = credits.filter(function (x) { return x.min; }).reduce(function (a, x) { return a + x.v; }, 0) - crEx;
      var rd = (stExempt ? 0 : s.red.st) + s.red.sp - redEx;
      return c + rd;
    }
    var x1 = 0, x4 = 0, crEx = 0, redEx = 0, st = state(0, 0);
    function after(s) { return s.tax - subjTotal(s, crEx, redEx); }   /* 음수 그대로 — 배제액 = 최저한세 − (산출세액 − 감면·공제) */
    if (after(st) < minTax) {
      /* ① 손금산입·익금불산입 */
      if (ctLoss > 0) {
        var lo = 0, hi = ctLoss;
        if (after(state(hi, 0)) < minTax) lo = hi; else { while (hi - lo > 1) { var mid = Math.floor((lo + hi) / 2); if (after(state(mid, 0)) >= minTax) hi = mid; else lo = mid; } lo = hi; }
        x1 = lo; st = state(x1, 0);
      }
      /* ② 세액공제 */
      var cMin = credits.filter(function (x) { return x.min; }).reduce(function (a, x) { return a + x.v; }, 0);
      if (after(st) < minTax) crEx = Math.min(cMin, minTax - after(st));
      /* ③ 세액감면 */
      var rMin = (stExempt ? 0 : st.red.st) + st.red.sp;
      if (after(st) < minTax) redEx = Math.min(rMin, minTax - after(st));
      /* ④ 소득공제·비과세 (조특법) */
      var ctInc = r.ntCt + r.idCt;
      if (after(st) < minTax && ctInc > 0) {
        var lo4 = 0, hi4 = ctInc;
        var f = function (x) { var s = state(x1, x); return s.tax - (cMin - crEx) - ((stExempt ? 0 : s.red.st) + s.red.sp - redEx); };
        if (f(hi4) < minTax) lo4 = hi4; else { while (hi4 - lo4 > 1) { var md = Math.floor((lo4 + hi4) / 2); if (f(md) >= minTax) hi4 = md; else lo4 = md; } lo4 = hi4; }
        x4 = lo4; st = state(x1, x4);
      }
    }
    r.minEx = { loss: x1, credit: crEx, red: redEx, income: x4 };
    r.minExTotal = x1 + x4 > 0 || crEx + redEx > 0;
    T = st.T; r.base = T; r.tax = st.tax;
    var Ta = T * 12 / m, prev = 0; r.topRate = 0;
    r.br.forEach(function (b) { if (Ta > prev) r.topRate = b[1]; prev = b[0]; });
    /* 감면 배분: 배제는 §6 → §7 순 */
    var stA = st.red.st, spA = st.red.sp, rx = redEx;
    if (!stExempt) { var d1 = Math.min(stA, rx); stA -= d1; rx -= d1; }
    var d2 = Math.min(spA, rx); spA -= d2;
    r.startup = stA; r.special = spA; r.stExempt = stExempt;
    if (st.red.st === 0 && st.red.sp === 0 && N('stIncome') > 0 && N('spcIncome') > 0 && sme) {}
    if (sme && N('stIncome') > 0 && N('spcIncome') > 0) r.notes.push('창업중소기업 감면과 중소기업 특별세액감면은 같은 사업연도에 함께 받을 수 없어(조특법 §127) 감면액이 큰 쪽만 반영했습니다.');
    /* 공제 배분: 배제는 조문 순 */
    var cx = crEx;
    credits.forEach(function (c) { c.applied = c.v; if (c.min && cx > 0) { var d = Math.min(c.v, cx); c.applied -= d; cx -= d; c.excluded = d; } });
    r.credits = credits;
    /* 7) 법인세법 공제: 외국납부세액(§57) · 재해손실(§58) */
    var sh = function (x) { return T > 0 ? Math.min(1, pos(x) / T) : 0; };
    r.foreignLimit = floor(r.tax * sh(N('foreignIncome')));
    r.foreign = Math.min(N('foreignPaid'), r.foreignLimit);
    r.foreignCarry = N('foreignPaid') - r.foreign;
    /* 적용 순서(법 §59): 세액감면 → 이월공제 안 되는 공제(재해손실) → 이월공제 되는 공제(외국납부·조특법 공제, 조문 순) */
    var room = r.tax;
    var takeR = function (v) { var d = Math.min(pos(v), room); room -= d; return d; };
    r.startupReq = r.startup; r.specialReq = r.special;
    r.startup = takeR(r.startup); r.special = takeR(r.special);
    r.redLost = r.startupReq + r.specialReq - r.startup - r.special;   /* 감면은 이월되지 않음 */
    var others = r.foreign + credits.reduce(function (a, c) { return a + c.applied; }, 0);
    r.disaster = 0;
    var lostRatio = N('assetsBefore') > 0 ? N('assetsLost') / N('assetsBefore') : 0;
    if (lostRatio >= 0.2) r.disaster = takeR(Math.min(N('assetsLost'), floor(pos(room - others) * Math.min(1, lostRatio))));
    else if (N('assetsLost') > 0) r.notes.push('재해손실세액공제는 사업용 자산의 20% 이상을 잃은 경우에만 받을 수 있어 반영하지 않았습니다.');
    r.lostRatio = lostRatio;
    var fReq = r.foreign; r.foreign = takeR(fReq); r.foreignCarry += fReq - r.foreign;
    r.unused = 0;
    credits.forEach(function (c) { var want = c.applied; c.applied = takeR(want); c.carry = want - c.applied; r.unused += c.carry; });
    r.taxAfter = room;   /* 각 사업연도 소득에 대한 결정세액 */
    /* 8) 토지 등 양도소득 · 미환류소득 */
    r.land = landTax(o.land);
    r.unret = unreturned(o.unret, year);
    r.penalty = N('penalty'); r.addBack = N('addBack');
    /* 9) 지점세 (외국법인) */
    r.branch = 0;
    /* 10) 법인지방소득세 */
    r.localForeign = r.foreign > 0 ? N('foreignPaid') : 0;   /* 외국납부세액공제를 받으면 외국법인세액을 과세표준에서 차감 */
    r.localBase = pos(T - r.localForeign);
    r.localForeignCarry = pos(r.localForeign - T);
    r.localTax = prog(r.localBase, r.br, m, 0.1);
    r.localPop = Math.min(r.localTax, N('popWorkers') * (sme ? 700000 : 450000));
    r.localTotal = r.localTax - r.localPop + r.land.local + r.unret.local + floor(r.penalty * 0.1);
    r.localPrepaid = N('localPrepaid');
    r.localPay = r.localTotal - r.localPrepaid;
    var lb = pos(r.localPay - floor(r.penalty * 0.1));
    r.localInst = lb > 2e6 ? floor(lb / 2) : lb > 1e6 ? lb - 1e6 : 0;
    if (entity === 'for' && o.branchOn) {
      var bBase = I - (r.taxAfter + r.land.tax + r.penalty + r.addBack) - r.localTotal - N('capInc') - N('thinCap') + Math.min(N('capDec'), N('unRet'));
      r.branchBase = floor(pos(bBase));
      r.branchRate = o.branchRate != null && o.branchRate !== '' ? +o.branchRate : 0.2;
      r.branch = floor(r.branchBase * r.branchRate);
    }
    r.total = r.taxAfter + r.land.tax + r.unret.tax + r.branch + r.penalty + r.addBack;   /* 총부담세액 */
    r.prepaid = N('prepaid');
    r.pay = r.total - r.prepaid;
    var instBase = pos(r.pay - r.penalty - r.addBack);
    r.inst = instBase > 2e7 ? floor(instBase / 2) : instBase > 1e7 ? instBase - 1e7 : 0;
    r.instMonths = sme ? 2 : 1;
    /* 11) 농어촌특별세 — 실제 받은 조특법 감면세액 × 20% (손금산입·외국납부·§6·§7·§10·§30의4 제외) */
    var ntCredit = credits.reduce(function (a, c) { return a + (c.nt ? c.applied : 0); }, 0);
    var ntIncome = (r.ntCt + r.idCt - x4) > 0 ? prog(T + (r.ntCt + r.idCt - x4), r.br, m) - r.tax : 0;
    r.ruralBase = ntCredit + ntIncome; r.ruralIncome = ntIncome;
    r.rural = floor(r.ruralBase * 0.2);
    r.grand = pos(r.pay) + r.rural + pos(r.localPay);
    r.eff = T > 0 ? r.taxAfter / T : 0;
    r.effAll = I > 0 ? (r.taxAfter + r.rural + r.localTax - r.localPop) / I : 0;
    return r;
  }
  /* 연결납세(§76의13~15, 령 §120의22) — rows: [{name, income, preLoss, ntDed, credit, prepaid, sme}] */
  function group(o) {
    var year = String(o.year || '2026'), m = Math.min(12, Math.max(1, Math.round(o.months || 12)));
    var br = brackets(year, false), rows = (o.rows || []).filter(function (x) { return x.income || x.preLoss || x.ntDed || x.credit || x.prepaid; });
    var res = { rows: rows, year: year, m: m, br: br };
    rows.forEach(function (x) {
      x.rate = x.sme ? 1 : 0.8;
      x.inc = x.income || 0;
      x.preDed = Math.min(x.preLoss || 0, pos(x.inc) * x.rate);   /* 연결 전 결손금은 자기 소득에서만 */
    });
    var posSum = rows.reduce(function (a, x) { return a + pos(x.inc); }, 0);
    var negSum = rows.reduce(function (a, x) { return a + pos(-x.inc); }, 0);
    res.income = posSum - negSum;
    /* 당기 결손 법인의 결손금 → 소득 법인의 개별귀속소득 비율로 배분 */
    rows.forEach(function (x) { x.lossIn = x.inc > 0 && posSum > 0 ? negSum * x.inc / posSum : 0; x.after = pos(x.inc) - Math.min(pos(x.inc), x.lossIn); });
    /* 연결 이월결손금(연결 후 발생) — 한도: 개별귀속액 × 80%(중소 100%) − 연결 전 결손금 공제액 */
    var cap = rows.map(function (x) { return pos(Math.min(x.after, pos(x.inc) * x.rate) - x.preDed); });
    var capSum = cap.reduce(function (a, b) { return a + b; }, 0);
    var gl = Math.min(o.groupLoss || 0, capSum);
    rows.forEach(function (x, i) {
      x.preDed = Math.min(x.preDed, x.after);
      x.grpDed = capSum > 0 ? gl * cap[i] / capSum : 0;
      x.base = pos(x.after - x.preDed - x.grpDed - (x.ntDed || 0));
    });
    res.base = floor(rows.reduce(function (a, x) { return a + x.base; }, 0));
    res.tax = prog(res.base, br, m);
    res.rate = res.base > 0 ? res.tax / res.base : 0;
    rows.forEach(function (x) {
      x.tax = floor(x.base * res.rate);
      x.final = pos(x.tax - (x.credit || 0));
      x.pay = x.final - (x.prepaid || 0);
      x.settle = x.inc < 0 ? floor(-x.inc * res.rate) : 0;   /* 결손 법인이 받을 정산금(결손금 × 연결세율) */
      x.local = floor(x.base * res.rate / 10);
    });
    res.groupLoss = floor(gl); res.groupLossLeft = (o.groupLoss || 0) - floor(gl);
    res.final = rows.reduce(function (a, x) { return a + x.final; }, 0);
    res.local = prog(res.base, br, m, 0.1);
    return res;
  }
  return { calc: calc, group: group, prog: prog, landTax: landTax, unreturned: unreturned, RATES: RATES, SMALL: SMALL, MIN_LARGE: MIN_LARGE, MIN_FLAT: MIN_FLAT };
})();

/* [CORP-TAX] 화면 — 입력(data-fc="ct")·억/만/원 단위·버튼 토글은 [FC-UI] 공통 처리 */
(function () {
  if (!document.getElementById('page-corptax')) return;   /* 도구별 페이지 분리: 법인세 화면이 있는 페이지에서만 */
  function $(id) { return document.getElementById(id); }
  function setT(id, v) { var e = $(id); if (e) e.textContent = v; }
  function setH(id, v) { var e = $(id); if (e) e.innerHTML = v; }
  function numOf(e) { return e ? (parseFloat(String(e.value).replace(/,/g, '')) || 0) : 0; }
  var UNIT = { eok: 1e8, man: 1e4, won: 1 };
  function amt(id) { var e = $(id); return Math.round(numOf(e) * (UNIT[e && e.getAttribute('data-unit')] || 1)); }
  function won(n) { return (n < 0 ? '−' : '') + Math.round(Math.abs(n)).toLocaleString('ko-KR') + '원'; }
  function eok(n) {
    var neg = n < 0; n = Math.round(Math.abs(n) / 1e4) * 1e4;
    var e = Math.floor(n / 1e8), m = Math.round((n - e * 1e8) / 1e4), s;
    if (!e) s = m.toLocaleString('ko-KR') + '만원'; else s = e.toLocaleString('ko-KR') + '억' + (m ? ' ' + m.toLocaleString('ko-KR') + '만원' : '원');
    return (neg ? '−' : '') + s;
  }
  function pct(v, d) { var t = (v * 100).toFixed(d == null ? 2 : d); if (t.indexOf('.') >= 0) t = t.replace(/\.?0+$/, ''); return t + '%'; }
  function seg(name) { var b = document.querySelector('.fc-seg[data-name="' + name + '"] .mode-btn.active'); return b ? b.getAttribute('data-v') : null; }
  function chk(id) { var e = $(id); return !!(e && e.checked); }
  function show(id, on) { var e = $(id); if (e) e.style.display = on ? '' : 'none'; }
  function minus(n) { return n ? '−' + won(n) : '0원'; }
  function plus(n) { return n ? '+' + won(n) : '0원'; }
  function rows(list) {
    return list.filter(Boolean).map(function (r) { return '<tr' + (r[2] ? ' class="' + r[2] + '"' : '') + '><td>' + r[0] + '</td><td style="text-align:right;">' + r[1] + '</td></tr>'; }).join('');
  }
  function sum(key, txt) {
    var e = $('ct-sum-' + key); if (!e) return;
    e.textContent = txt || '입력 없음'; e.classList.toggle('on', !!txt);
    var d = e.closest('.inc-sec'); if (d) d.classList.toggle('has-v', !!txt);
  }
  var KIND = { sme: '중소기업', grad3: '중소기업 졸업 후 1~3년차', grad5: '중소기업 졸업 후 4~5년차', large: '일반기업' };
  var KIND_S = { sme: '중소', grad3: '졸업 1~3년', grad5: '졸업 4~5년', large: '일반' }, ENT_S = { np: '비영리', 'for': '외국법인' };
  function yShort(y) { return y === '2026' ? '2026년~' : y === '2025' ? '2025년' : '2023~24년'; }
  var ENT = { dom: '내국 영리법인', np: '비영리법인', 'for': '외국법인 국내사업장' };
  var LAND = { 0.4: '미등기 토지 등 (40%)', 0.2: '주택·별장·입주권·분양권 (20%)', 0.1: '비사업용 토지 (10%)' };
  function brText(br) {
    var prev = 0;
    return br.map(function (b) {
      var lo = prev, hi = b[0]; prev = hi;
      return [hi === Infinity ? eok(lo) + ' 초과' : (lo ? eok(lo) + ' 초과 ~ ' : '') + eok(hi) + (lo ? '' : ' 이하'), b[1]];
    });
  }
  function yearText(y) { return y === '2026' ? '2026년 이후 개시 사업연도' : y === '2025' ? '2025년 개시 사업연도' : '2023~2024년 개시 사업연도'; }
  function rateTable(br, base, m, small, y) {
    var Ta = base * 12 / m, prev = 0;
    setT('ct-rate-title', '법인세율 — ' + yearText(y) + (small ? ' · 소규모 성실신고확인대상 법인' : ''));
    setH('ct-rates', brText(br).map(function (b, i) {
      var lo = prev; prev = br[i][0];
      return '<tr' + (Ta > lo && base > 0 ? ' class="fc-hl"' : '') + '><td>' + b[0] + '</td><td>' + pct(b[1], 0) + '</td><td>' + pct(b[1] / 10, 1) + '</td></tr>';
    }).join(''));
  }
  function notes(list) { setH('ct-notes', list.map(function (t) { return '<p class="fc-note" style="margin:8px 0 0;">※ ' + t + '</p>'; }).join('')); }

  /* ── 연결납세 ── */
  function renderGroup() {
    var y = $('ct-year').value, m = +$('ct-months').value, list = [];
    for (var i = 1; i <= 5; i++) {
      list.push({ no: i, income: ($('ct-g' + i + '-sign').value === 'loss' ? -1 : 1) * amt('ct-g' + i + '-inc'), preLoss: amt('ct-g' + i + '-pre'),
        ntDed: amt('ct-g' + i + '-nt'), credit: amt('ct-g' + i + '-cr'), prepaid: amt('ct-g' + i + '-pp'), sme: chk('ct-g' + i + '-sme') });
    }
    var g = CT.group({ year: y, months: m, rows: list, groupLoss: amt('ct-gloss') });
    var pay = g.rows.reduce(function (a, x) { return a + x.pay; }, 0), settle = g.rows.reduce(function (a, x) { return a + x.settle; }, 0);
    var local = g.rows.reduce(function (a, x) { return a + x.local; }, 0);
    setT('ct-label', '연결법인 전체 — 납부할 법인세 + 법인지방소득세');
    setT('ct-pay', won(Math.max(0, pay) + local));
    setT('ct-pay-sub', g.base > 0 ? '연결 법인세 ' + won(pay) + ' (모회사가 일괄 신고·납부) + 법인지방소득세 ' + won(local) + ' (각 법인이 따로 신고) · ' + yearText(y) : '연결과세표준이 0원이라 낼 법인세가 없습니다');
    setT('ct-k1', won(g.income)); setT('ct-k2', won(g.base)); setT('ct-k3', g.base > 0 ? pct(g.rate) : '—');
    sum('base', yShort(y) + ' · ' + m + '개월 · 연결 ' + g.rows.length + '개 법인');
    sum('grp', g.rows.length ? '연결소득 ' + eok(g.income) : '');
    var head = '<tr class="fc-total"><td>법인</td><td style="text-align:right;">개별귀속 과세표준 · 법인세 · 납부(환급)</td></tr>';
    var per = g.rows.map(function (x) {
      return ['<b>' + (x.no === 1 ? '모회사' : '자회사 ' + (x.no - 1)) + '</b> <small>' + (x.inc < 0 ? '결손 ' + won(-x.inc) + ' → 정산금 ' + won(x.settle) + ' 받음' : '소득 ' + won(x.inc) + (x.lossIn ? ' − 결손 배분 ' + won(Math.round(x.lossIn)) : '') + (x.preDed ? ' − 연결 전 결손금 ' + won(Math.round(x.preDed)) : '') + (x.grpDed ? ' − 연결 이월결손금 ' + won(Math.round(x.grpDed)) : '') + (x.ntDed ? ' − 비과세·소득공제 ' + won(x.ntDed) : '')) + ' · 지방소득세 ' + won(x.local) + '</small>',
        won(Math.round(x.base)) + ' · ' + won(x.tax) + (x.credit ? ' − 공제 ' + won(Math.min(x.credit, x.tax)) : '') + ' → <b>' + won(x.pay) + '</b>'];
    });
    setH('ct-table', head + rows([
      ['소득 법인의 소득 합계', won(g.rows.reduce(function (a, x) { return a + Math.max(0, x.inc); }, 0))],
      ['결손 법인의 결손금 합계 <small>(소득 법인에 소득 비율로 배분)</small>', minus(g.rows.reduce(function (a, x) { return a + Math.max(0, -x.inc); }, 0))],
      ['<b>연결소득금액</b>', won(g.income), 'fc-total'],
      ['연결 전 이월결손금 <small>(그 법인 소득에서만, 80% · 중소 100%)</small>', minus(Math.round(g.rows.reduce(function (a, x) { return a + x.preDed; }, 0)))],
      ['연결 이월결손금' + (g.groupLossLeft > 0 ? ' <small>(남은 ' + won(g.groupLossLeft) + ')</small>' : ''), minus(g.groupLoss)],
      ['비과세·소득공제', minus(g.rows.reduce(function (a, x) { return a + (x.ntDed || 0); }, 0))],
      ['<b>연결과세표준</b>', won(g.base), 'fc-total'],
      ['<b>연결산출세액</b> <small>(연결세율 ' + (g.base > 0 ? pct(g.rate, 4) : '—') + ')</small>', won(g.tax), 'fc-total']
    ].concat(per).concat([
      ['<b>연결법인 납부 합계</b>' + (settle ? ' <small>(결손 법인에 줄 정산금 합계 ' + won(settle) + ')</small>' : ''), won(pay), 'fc-hl'],
      ['법인지방소득세 합계 <small>(개별귀속 과세표준 × 연결세율의 1/10)</small>', won(local)]
    ])));
    rateTable(g.br, g.base, m, false, y);
    notes(['연결 모회사가 연결과세표준·연결산출세액을 일괄 신고·납부하고, 각 법인의 감면·공제·기납부세액은 법인별로 빼서 계산합니다. 법인별 최저한세·감면 한도는 각 법인 감면·공제 칸에 반영한 금액으로 넣으세요.']);
  }

  function render() {
    var mode = seg('ct-mode') || 'one';
    var entity = $('ct-entity').value, group = mode === 'group';
    ['ct-sec-adj', 'ct-sec-don', 'ct-sec-ded', 'ct-sec-red', 'ct-sec-cr', 'ct-sec-land', 'ct-sec-unret', 'ct-sec-local', 'ct-sec-etc'].forEach(function (id) { show(id, !group); });
    show('ct-sec-np', !group && entity === 'np'); show('ct-sec-branch', !group && entity === 'for'); show('ct-sec-grp', group);
    show('ct-entity-f', !group); show('ct-kind-row', !group); show('ct-small-f', !group && entity !== 'for'); show('ct-social-f', !group && entity === 'dom');
    if (group) return renderGroup();
    var land = [
      { type: 'house', sale: amt('ct-l-house-s'), book: amt('ct-l-house-b') }, { type: 'right', sale: amt('ct-l-right-s'), book: amt('ct-l-right-b') },
      { type: 'nonbiz', sale: amt('ct-l-nonbiz-s'), book: amt('ct-l-nonbiz-b') }, { type: 'unreg', sale: amt('ct-l-unreg-s'), book: amt('ct-l-unreg-b') }
    ];
    var o = {
      year: $('ct-year').value, months: +$('ct-months').value, kind: $('ct-kind').value, small: chk('ct-small'), entity: entity, social: entity === 'dom' && chk('ct-social'),
      ni: (seg('ct-sign') === 'loss' ? -1 : 1) * amt('ct-ni'), addIn: amt('ct-add'), dedIn: amt('ct-ded'), ctDed: amt('ct-ctded'), nonDesig: amt('ct-nondesig'),
      npSep: amt('ct-np-sep'), npInt: amt('ct-np-int'), npRate: +$('ct-np-rate').value, npReserve: amt('ct-np-res'),
      spCur: amt('ct-spcur'), spCarry: amt('ct-spcarry'), genCur: amt('ct-gencur'), genCarry: amt('ct-gencarry'), esCur: amt('ct-escur'),
      carryLoss: amt('ct-loss'), nontax: amt('ct-nontax'), nontaxCt: amt('ct-nontax-ct'), incDed: amt('ct-incded'), incDedCt: amt('ct-incded-ct'),
      stIncome: amt('ct-st-inc'), stRate: +$('ct-st-rate').value, spcIncome: amt('ct-spc-inc'), spcRate: +$('ct-spc-rate').value, empDrop: numOf($('ct-empdrop')),
      crRnd: amt('ct-cr-rnd'), crInv: amt('ct-cr-inv'), crEmp: amt('ct-cr-emp'), crSoc: amt('ct-cr-soc'),
      crOthMin: amt('ct-cr-othmin'), crOthMinNt: chk('ct-cr-othmin-nt'), crOthEx: amt('ct-cr-othex'), crOthExNt: chk('ct-cr-othex-nt'),
      foreignPaid: amt('ct-fpaid'), foreignIncome: amt('ct-finc'), assetsLost: amt('ct-dis-lost'), assetsBefore: amt('ct-dis-before'),
      land: land,
      unret: { on: chk('ct-ur-on'), method: seg('ct-ur-method') || 'A', corpIncome: amt('ct-ur-inc'), invest: amt('ct-ur-inv'), wage: amt('ct-ur-wage'),
        coop: amt('ct-ur-coop'), dividend: amt('ct-ur-div'), reserve: amt('ct-ur-res'), carryExcess: amt('ct-ur-carry') },
      branchOn: entity === 'for' && chk('ct-br-on'), branchRate: +$('ct-br-rate').value, capInc: amt('ct-br-inc'), capDec: amt('ct-br-dec'), unRet: amt('ct-br-unret'), thinCap: amt('ct-br-thin'),
      popWorkers: numOf($('ct-pop')), localPrepaid: amt('ct-lprepaid'),
      penalty: amt('ct-penalty'), addBack: amt('ct-addback'), prepaid: amt('ct-prepaid')
    };
    show('ct-ur-inv-f', o.unret.method === 'A'); show('ct-ur-div-f', o.year === '2026'); show('ct-ur-box', o.unret.on); show('ct-br-box', o.branchOn);
    var r = CT.calc(o), m = r.m, D = r.don, yt = yearText(r.year);
    /* 접은 항목 요약 */
    sum('base', yShort(r.year) + ' · ' + m + '개월 · ' + (entity === 'dom' ? '' : ENT_S[entity] + ' · ') + KIND_S[r.kind] + (r.small ? ' · 소규모' : '') + (o.social ? ' · 사회적기업' : ''));
    sum('adj', '차가감소득 ' + eok(r.pre));
    sum('np', r.reserve ? '준비금 ' + eok(r.reserve) : o.npSep ? '분리과세 ' + eok(o.npSep) : '');
    var dx = D.spExcess + D.esExcess + D.genExcess;
    sum('don', D.any ? (dx ? '한도초과 ' + eok(dx) : '한도 내') : '');
    var dd = r.lossDed + r.ntLaw + r.ntCt + r.idLaw + r.idCt;
    sum('ded', dd ? '공제 ' + eok(dd) : '');
    sum('red', r.startup + r.special ? '감면 ' + won(r.startup + r.special) : (o.stIncome || o.spcIncome ? '감면 0원' : ''));
    var crSum = r.credits.reduce(function (a, c) { return a + c.applied; }, 0) + r.foreign + r.disaster;
    sum('cr', crSum ? '공제 ' + won(crSum) : '');
    sum('land', r.land.tax ? '추가 ' + won(r.land.tax) : r.land.gain ? '차손 상계 0원' : '');
    sum('unret', o.unret.on ? '법인세 ' + won(r.unret.tax) : '');
    sum('branch', o.branchOn ? '지점세 ' + won(r.branch) : '');
    sum('local', o.popWorkers || o.localPrepaid ? '공제·기납부 ' + won(r.localPop + o.localPrepaid) : '');
    sum('etc', r.penalty + r.addBack + r.prepaid ? '기납부 ' + eok(r.prepaid) + (r.penalty + r.addBack ? ' · 가산 ' + eok(r.penalty + r.addBack) : '') : '');
    /* 결과 */
    var refund = r.pay < 0;
    setT('ct-label', '납부할 법인세 + 농어촌특별세 + 법인지방소득세');
    setT('ct-pay', won(r.grand));
    setT('ct-pay-sub', r.total > 0 || r.localTotal > 0
      ? (refund ? '법인세 환급 ' + won(-r.pay) + ' (따로 돌려받음) · ' : '법인세 ' + won(Math.max(0, r.pay)) + ' + ') + (r.rural ? '농어촌특별세 ' + won(r.rural) + ' + ' : '') + '법인지방소득세 ' + won(Math.max(0, r.localPay)) + (r.localPay < 0 ? ' (지방소득세 환급 ' + won(-r.localPay) + ')' : '') + ' · ' + yt + (m < 12 ? ' (' + m + '개월)' : '')
      : r.income < 0 ? '이번 사업연도는 결손금 ' + won(r.lossNow) + '이 생겨 낼 법인세가 없습니다 — 다음 사업연도부터 15년간 이월결손금으로 공제'
      : '과세표준이 0원이라 낼 법인세가 없습니다');
    setT('ct-k1', won(r.income)); setT('ct-k2', won(r.base));
    setT('ct-k3', r.base > 0 ? pct(r.eff) : '—');
    var don = D.any ? [
      ['<b>기부금 한도 계산</b> <small>기준소득금액 ' + won(Math.floor(D.S)) + (D.Lfor ? ' − 이월결손금 ' + won(Math.floor(D.Lfor)) : '') + '</small>', ''],
      ['특례기부금 한도 <small>(50%) ' + won(Math.floor(D.A)) + '</small>', D.spCarryUsed ? '이월분 손금산입 ' + minus(D.spCarryUsed) : ''],
      D.spExcess ? ['특례기부금 한도초과 <small>(손금불산입 · 10년 이월)</small>', plus(D.spExcess)] : null,
      o.esCur ? ['우리사주조합기부금 한도 <small>(30%) ' + won(Math.floor(D.B)) + '</small>', D.esExcess ? plus(D.esExcess) + ' 한도초과' : '한도 내'] : null,
      ['일반기부금 한도 <small>(' + pct(D.genRate, 0) + (o.social ? ' · 사회적기업' : '') + ') ' + won(Math.floor(D.C)) + '</small>', D.genCarryUsed ? '이월분 손금산입 ' + minus(D.genCarryUsed) : ''],
      D.genExcess ? ['일반기부금 한도초과 <small>(손금불산입 · 10년 이월)</small>', plus(D.genExcess)] : null
    ] : [];
    var np = entity === 'np' && (o.npReserve || o.npSep) ? [
      o.npReserve ? ['고유목적사업준비금 손금산입 <small>(한도 ' + won(r.reserveLimit) + (r.reserveExcess ? ' · 한도초과 ' + won(r.reserveExcess) + ' 손금불산입' : '') + ')</small>', minus(r.reserve)] : null
    ] : [];
    var crRows = r.credits.filter(function (c) { return c.v; }).map(function (c) {
      var ex = (c.excluded ? ' · 최저한세로 ' + won(c.excluded) + ' 배제' : '') + (c.carry ? ' · 세액 부족 ' + won(c.carry) + ' 이월' : '');
      return [c.name + ' <small>(' + (c.min ? '최저한세 대상' : '최저한세 제외') + (c.nt ? ' · 농특세 과세' : '') + ex + ')</small>', minus(c.applied)];
    });
    var mx = r.minEx, minRows = r.minExTotal ? [
      ['<b>최저한세로 적용 배제</b> <small>(령 §126⑤ 순서: 손금산입 → 세액공제 → 세액감면 → 소득공제·비과세)</small>', ''],
      mx.loss ? ['조특법 손금산입 배제 → 과세표준에 다시 더함', plus(mx.loss)] : null,
      mx.credit ? ['세액공제 배제 <small>(이월 가능한 공제는 다음 사업연도로)</small>', won(mx.credit)] : null,
      mx.red ? ['세액감면 배제 <small>(소멸)</small>', won(mx.red)] : null,
      mx.income ? ['조특법 비과세·소득공제 배제 → 과세표준에 다시 더함', plus(mx.income)] : null
    ] : [];
    var landRows = r.land.rows.length || r.land.gain ? [['<b>토지 등 양도소득에 대한 법인세</b> <small>(§55의2 · 각 사업연도 소득과 별도 추가)</small>', '']].concat(r.land.rows.map(function (x) {
      return [LAND[x[0]] + ' <small>양도소득 ' + won(x[1]) + '</small>', plus(x[2])];
    })).concat(r.land.rows.length ? [] : [['양도차익이 차손과 상계되어 과세할 소득 없음', '0원']]) : [];
    var U = r.unret;
    var urRows = o.unret.on ? [
      ['<b>미환류소득에 대한 법인세</b> <small>(조특법 §100의32 · ' + (o.unret.method === 'B' ? '투자 제외' : '투자 포함') + ' ' + pct(U.ratio, 0) + ')</small>', ''],
      ['기업소득 <small>(한도 3,000억원)</small> × ' + pct(U.ratio, 0) + ' − 환류액', U.unret ? won(U.unret) + ' 미환류' : won(U.over) + ' 초과환류 (2년 이월)'],
      U.unret ? ['과세 대상 <small>(차기환류적립금·이월 초과환류액 차감 후)</small> × 20%', plus(U.tax)] : null
    ] : [];
    var brRows = o.branchOn ? [
      ['<b>지점세</b> <small>(§96 · 과세표준 ' + won(r.branchBase) + ' × ' + pct(r.branchRate, 1) + ')</small>', plus(r.branch)]
    ] : [];
    setH('ct-table', rows([
      ['결산서상 당기순' + (r.ni < 0 ? '손실' : '이익'), won(r.ni)],
      ['익금산입·손금불산입' + (o.nonDesig ? ' <small>(비지정기부금 ' + won(o.nonDesig) + ' 포함)</small>' : ''), plus(r.add)],
      ['손금산입·익금불산입' + (o.ctDed ? ' <small>(조특법 ' + won(Math.min(o.ctDed, r.ded)) + ' 포함)</small>' : ''), minus(r.ded)],
      r.npSep ? ['분리과세 이자소득 <small>(원천징수로 끝, 과세표준에서 제외)</small>', minus(r.npSep)] : null,
      ['차가감소득금액', won(r.pre), 'fc-total']
    ].concat(don).concat(np).concat([
      ['<b>각 사업연도 소득금액</b>', won(r.income), 'fc-total'],
      ['이월결손금 <small>(한도: 소득의 ' + (r.lossRate * 100) + '%' + (r.lossLeft > 0 ? ' · 남은 ' + won(r.lossLeft) : '') + ')</small>', minus(r.lossDed)],
      r.ntLaw ? ['비과세소득 (법인세법)', minus(r.ntLaw)] : null,
      r.ntCt ? ['비과세소득 (조특법 · 최저한세 대상)', minus(r.ntCt)] : null,
      r.idLaw ? ['소득공제 (법인세법)', minus(r.idLaw)] : null,
      r.idCt ? ['소득공제 (조특법 · 최저한세 대상)', minus(r.idCt)] : null,
      mx.loss + mx.income ? ['최저한세로 배제되어 다시 더한 금액', plus(mx.loss + mx.income)] : null,
      ['<b>과세표준</b>', won(r.base), 'fc-total'],
      ['세율' + (m < 12 ? ' <small>(과세표준 × 12/' + m + ' 로 연 환산 후 × ' + m + '/12)</small>' : ''), r.base > 0 ? '최고 ' + pct(r.topRate, 0) : '—'],
      ['<b>산출세액</b>', won(r.tax), 'fc-total'],
      ['최저한세 <small>(감면 전 과세표준 ' + won(r.T0) + ' × ' + r.minRateText + ')</small>', won(r.minTax)]
    ]).concat(minRows).concat([
      r.startup || r.startupReq ? ['창업중소기업 등 세액감면' + (r.stExempt ? ' <small>(100% · 최저한세 제외)</small>' : ''), minus(r.startup)] : null,
      r.special || r.specialReq ? ['중소기업 특별세액감면 <small>(한도 ' + won(r.spcCap) + ')</small>', minus(r.special)] : null,
      r.disaster ? ['재해손실세액공제 <small>(상실비율 ' + pct(r.lostRatio, 1) + ')</small>', minus(r.disaster)] : null,
      r.foreign ? ['외국납부세액공제 <small>(한도 ' + won(r.foreignLimit) + (r.foreignCarry ? ' · 이월 ' + won(r.foreignCarry) : '') + ')</small>', minus(r.foreign)] : (o.foreignPaid ? ['외국납부세액공제 <small>(국외원천소득을 넣어야 한도 계산)</small>', '0원'] : null)
    ]).concat(crRows).concat([
      ['<b>각 사업연도 소득에 대한 결정세액</b>', won(r.taxAfter), 'fc-total']
    ]).concat(landRows).concat(urRows).concat(brRows).concat([
      r.penalty ? ['가산세', plus(r.penalty)] : null,
      r.addBack ? ['감면분 추가납부세액', plus(r.addBack)] : null,
      ['<b>총부담세액</b> <small>(실효세율 ' + (r.base > 0 ? pct(r.eff) : '—') + ')</small>', won(r.total), 'fc-total'],
      ['기납부세액 <small>(중간예납·원천징수)</small>', minus(r.prepaid)],
      ['<b>' + (r.pay < 0 ? '환급받을 법인세' : '차감 납부할 법인세') + '</b>', won(Math.abs(r.pay)), 'fc-hl'],
      r.inst ? ['분납 가능 금액 <small>(납부기한 후 ' + r.instMonths + '개월 안에)</small>', won(r.inst)] : null,
      r.inst ? ['신고 때 먼저 낼 금액', won(r.pay - r.inst)] : null,
      ['<b>농어촌특별세</b> <small>(조특법 감면세액 ' + won(r.ruralBase) + ' × 20%' + (r.ruralIncome ? ' · 비과세·소득공제분 ' + won(r.ruralIncome) + ' 포함' : '') + ')</small>', won(r.rural), r.rural ? 'fc-hl' : ''],
      ['<b>법인지방소득세</b>', '', 'fc-total'],
      ['과세표준' + (r.localForeign ? ' <small>(법인세 과세표준 − 외국법인세액 ' + won(r.localForeign) + ')</small>' : ' <small>(법인세 과세표준과 같음)</small>'), won(r.localBase)],
      ['산출세액 <small>(법인세율의 1/10' + (m < 12 ? ' · 연 환산' : '') + ' · 법인세 감면·공제는 연동 안 됨)</small>', won(r.localTax)],
      r.localPop ? ['인구감소지역 고용 세액공제 <small>(지특법 §167의5 · ' + o.popWorkers + '명)</small>', minus(r.localPop)] : null,
      r.land.local ? ['토지 등 양도소득분', plus(r.land.local)] : null,
      r.unret.local ? ['미환류소득분 <small>(법인세의 10%)</small>', plus(r.unret.local)] : null,
      r.penalty ? ['가산세 <small>(법인세 가산세의 10%)</small>', plus(Math.floor(r.penalty * 0.1))] : null,
      r.localPrepaid ? ['특별징수세액', minus(r.localPrepaid)] : null,
      ['<b>' + (r.localPay < 0 ? '환급받을 법인지방소득세' : '납부할 법인지방소득세') + '</b>', won(Math.abs(r.localPay)), 'fc-hl'],
      r.localInst ? ['지방소득세 분납 가능 금액 <small>(1개월 · 중소기업 2개월)</small>', won(r.localInst)] : null,
      ['법인세 + 농특세 + 지방소득세 부담 <small>(각 사업연도 소득 대비 ' + (r.income > 0 ? pct(r.effAll) : '—') + ')</small>', won(r.taxAfter + r.rural + r.localTax - r.localPop), 'fc-total']
    ])));
    rateTable(r.br, r.base, m, r.small, r.year);
    notes(r.notes);
  }
  window.fcRegister('ct', render, 'corptax');
})();

/* ════════════════════════════════════════
   [DIV-CALC] 배당금 계산기 — 배당 지급 주기(월·분기·반년·연) 선택 · 수령/재투자/일부 재투자 · 적립식 · 배당소득세
   · 배당은 매달 (적립 후 잔고 × 연 배당률 ÷ 12)씩 쌓이다가 지급월(주기의 마지막 달)에 한꺼번에 지급 → 재투자도 지급월에만
     (지급 주기가 길수록 재투자 복리가 늦게 붙음 · 적립식 중간 납입분은 보유한 달수만큼만 배당)
   · 주가 변동: 매달 잔고 × (1 + 연간 주가 변동률)^(1/12)
   · 세금: 그 해 세전 배당 합계로 실효세율을 정해 그 해 지급분마다 적용 (종합과세는 TAX.financial — Gross-up·비교과세 반영)
════════════════════════════════════════ */
var DVC = (function () {
  /* taxRateOf(연간 세전 배당) → 실효세율 (0~1) */
  function sim(o) {
    var p = [1, 3, 6, 12].indexOf(+o.period) >= 0 ? +o.period : 3;
    var years = Math.max(1, Math.min(50, Math.round(o.years || 1)));
    var mRate = (o.rate || 0) / 12, mGrow = Math.pow(1 + (o.growth || 0), 1 / 12) - 1;
    var reinvestShare = o.mode === 'reinvest' ? 1 : o.mode === 'partial' ? Math.min(1, Math.max(0, o.partial || 0)) : 0;
    var taxRateOf = o.taxRateOf || function () { return 0; };
    var monthly = Math.max(0, o.monthly || 0);
    var port = Math.max(0, o.amount || 0), pending = 0, invest = port, totNet = 0, totTax = 0, totGross = 0, rows = [];
    for (var y = 1; y <= years; y++) {
      /* 그 해 세전 배당 합계에 맞는 실효세율 — 재투자로 세율이 배당액에 영향을 주므로 몇 번 맞춰 봄 */
      var rate = taxRateOf(0), run = null;
      for (var it = 0; it < 4; it++) {
        run = year(port, pending, rate);
        var nr = taxRateOf(run.gross);
        if (Math.abs(nr - rate) < 1e-12) break;
        rate = nr;
      }
      run = year(port, pending, rate);
      port = run.port; pending = run.pending;
      invest += run.deposit; totNet += run.net; totTax += run.tax; totGross += run.gross;
      run.label = y + '년차'; run.y = y; run.taxRate = rate; run.totNet = totNet; run.invest = invest;
      rows.push(run);
    }
    function year(port0, pend0, rate) {
      var P = port0, pend = pend0, r = { portStart: port0, deposit: 0, gross: 0, tax: 0, net: 0, reinvest: 0, price: 0, months: [] };
      for (var m = 1; m <= 12; m++) {
        var mo = { m: m, start: P, deposit: monthly };
        P += monthly; r.deposit += monthly;
        mo.after = P;
        pend += P * mRate;                              /* 이달 몫 배당 적립 */
        var pay = m % p === 0;
        mo.pay = pay; mo.gross = 0; mo.tax = 0; mo.net = 0; mo.reinvest = 0;
        if (pay) {
          mo.gross = pend; mo.tax = pend * rate; mo.net = pend - mo.tax; pend = 0;
          mo.reinvest = mo.net * reinvestShare;
          P += mo.reinvest;
        }
        var before = P;
        P *= 1 + mGrow;
        mo.price = P - before; mo.end = P;
        r.gross += mo.gross; r.tax += mo.tax; r.net += mo.net; r.reinvest += mo.reinvest; r.price += mo.price;
        r.months.push(mo);
      }
      r.port = P; r.pending = pend;
      return r;
    }
    var last = rows[rows.length - 1];
    return { rows: rows, period: p, years: years, invest: invest, totNet: totNet, totTax: totTax, totGross: totGross, final: last.port, pending: last.pending };
  }
  return { sim: sim };
})();

/* [DIV-CALC] 화면 — 입력·단위·슬라이더는 [SIM-UNIT] 공용(simOnInput·setFancyUnit), 표 펼치기는 toggleAllYears 공용 */
(function () {
  if (!document.getElementById('page-divcalc')) return;   /* 도구별 페이지 분리: 배당금 계산기 화면이 있는 페이지에서만 */
  var PG = 'page-divcalc';
  var st = { mode: 'reinvest', period: 3, dca: false, tax: true, taxMode: 'wh', chart: 'annual' };
  var chart = null, cache = null;
  var FREQ = { 1: '월', 3: '분기', 6: '반년', 12: '연' }, FREQ_N = { 1: '매월', 3: '분기마다', 6: '반년마다', 12: '1년에 한 번' };
  function $(id) { return document.getElementById('divcalc-' + id); }
  function setT(id, v) { var e = $(id); if (e) e.textContent = v; }
  function num(id) { var e = $(id); return e ? parseFloat(String(e.value).replace(/,/g, '')) : NaN; }
  function won(f) { return simReadWon(PG, f); }
  function pct(v, d) { return (v * 100).toFixed(d == null ? 2 : d) + '%'; }
  function seg(box, btn) { box.querySelectorAll('.mode-btn,.tax-mode-tab').forEach(function (b) { b.classList.toggle('active', b === btn); }); }
  function sw(id, on) {
    var s = $(id + '-switch'); if (s) s.classList.toggle('on', on);
    var off = $(id + '-off-label'), onl = $(id + '-on-label');
    if (off) off.style.color = on ? 'var(--text3)' : 'var(--text2)';
    if (onl) onl.style.color = on ? 'var(--accent)' : 'var(--text3)';
    var b = $(id + '-block'); if (b) { b.style.opacity = on ? '1' : '0.3'; b.style.pointerEvents = on ? 'auto' : 'none'; }
  }

  /* ── 세금: 그 해 세전 배당 → 실효세율 ── */
  function taxRateOf(gross) {
    if (!st.tax) return 0;
    if (st.taxMode === 'manual') return Math.min(1, Math.max(0, (num('ni-tax') || 0) / 100));
    if (st.taxMode === 'wh' || !(gross > 0)) return 0.154;
    var kind = $('divkind').value, o = { other: won('otherincome'), interest: won('otherfin') };
    o[kind] = gross;
    var r = TAX.financial(o), base = TAX.financial({ other: o.other, interest: o.interest });
    return Math.max(0, (r.finTax - base.finTax) / gross);   /* 다른 금융소득에 붙는 세금은 빼고 이 배당 몫만 */
  }

  function update() {
    var amount = won('amount'), years = Math.round(num('ni-years')), rate = num('ni-rate') / 100, growth = num('ni-growth') / 100;
    if ([years, rate, growth].some(isNaN)) return;
    var monthly = st.dca ? won('monthly') : 0;
    setT('dca-annual-label', fmt(won('monthly') * 12) + ' / 년');
    var partial = (num('ni-partial') || 50) / 100;
    $('partial-block').style.display = st.mode === 'partial' ? '' : 'none';
    setT('partial-desc', '배당금의 ' + Math.round(partial * 100) + '%는 재투자, ' + (100 - Math.round(partial * 100)) + '%는 수령');
    $('tax-panel-manual').style.display = st.taxMode === 'manual' ? '' : 'none';
    $('tax-panel-comp').style.display = st.taxMode === 'comp' ? '' : 'none';
    $('tax-panel-wh').style.display = st.taxMode === 'wh' ? '' : 'none';
    if (amount <= 0 && monthly <= 0) {
      ['s-annual', 's-final', 's-total', 's-port', 's-cagr'].forEach(function (k) { setT(k, '0원'); });
      ['s-annual-sub', 's-final-sub', 's-total-sub', 's-port-sub', 's-cagr-sub'].forEach(function (k) { setT(k, ''); });
      $('tbody').innerHTML = ''; cache = null; if (chart) { chart.destroy(); chart = null; }
      return;
    }
    var r = DVC.sim({ amount: amount, monthly: monthly, years: years, rate: rate, growth: growth, period: st.period, mode: st.mode, partial: partial, taxRateOf: taxRateOf });
    var R = r.rows, first = R[0], last = R[R.length - 1], p = r.period, perYear = 12 / p;
    var sfx = st.tax ? ' (세후)' : '';
    var payOf = function (row, i) { var a = row.months.filter(function (m) { return m.pay; }); return a[i == null ? a.length - 1 : i]; };
    setT('s-annual-label', '1년차 연간 배당금' + sfx);
    setT('s-annual', fmt(first.net));
    setT('s-annual-sub', (p === 12 ? '연 1회' : FREQ[p] + ' 지급 · 연 ' + perYear + '회') + ' · 첫 회 ' + fmt(payOf(first, 0).net));
    setT('s-final-label', r.years + '년차 연간 배당금' + sfx);
    setT('s-final', fmt(last.net));
    setT('s-final-sub', '월 평균 ' + fmt(last.net / 12) + ' · 마지막 회 ' + fmt(payOf(last).net));
    setT('s-total-label', '누적 배당금' + sfx);
    setT('s-total', fmt(r.totNet));
    setT('s-total-sub', '총 투입 대비 ' + (r.invest > 0 ? (r.totNet / r.invest * 100).toFixed(1) : '0.0') + '%');
    setT('s-port-label', r.years + '년차 종료 자산');
    setT('s-port', fmt(r.final));
    setT('s-port-sub', '총 투입 ' + fmt(r.invest) + ' 대비 ' + (r.invest > 0 ? (r.final / r.invest).toFixed(2) : '0') + '배');
    var cg = simAssetCagr(amount, monthly, r.years, r.final);
    if (cg == null) { setT('s-cagr', '—'); setT('s-cagr-sub', ''); }
    else { var cm = Math.pow(1 + cg, 1 / 12) - 1; setT('s-cagr', (cg >= 0 ? '+' : '') + (cg * 100).toFixed(2) + '%'); setT('s-cagr-sub', '월 평균 ' + (cm >= 0 ? '+' : '') + (cm * 100).toFixed(3) + '%'); }
    /* 세금 요약 */
    setT('tax-first-label', fmt(first.tax));
    setT('tax-total-label', fmt(r.totTax));
    setT('tax-eff-label', first.gross > 0 ? pct(first.tax / first.gross) : '—');
    if (st.taxMode === 'comp') {
      var kindTxt = $('divkind').selectedOptions[0].textContent;
      setT('comp-note', '1년차 세전 배당 ' + fmt(first.gross) + (first.gross + won('otherfin') > 2e7 ? ' → 금융소득 2,000만원 초과, 종합과세' : ' → 2,000만원 이하, 15.4%로 끝') + ' (' + kindTxt + ')');
    }
    /* 목표 역산 */
    var tgt = won('target'), need = rate > 0 ? tgt * 12 / rate : 0;
    setT('target-result', rate > 0 ? fmt(need) : '—');
    setT('target-sub', '세전 · 배당률 ' + (rate * 100).toFixed(2).replace(/\.?0+$/, '') + '% 기준 · ' + FREQ_N[p] + ' 약 ' + fmt(tgt * p) + ' 지급'
      + (st.tax && rate > 0 ? ' · 세후로 받으려면 약 ' + fmt(need / Math.max(0.01, 1 - (first.gross > 0 ? first.tax / first.gross : 0.154))) : ''));
    cache = r;
    renderTable(r);
    try { renderChart(); } catch (e) { console.error('divcalc chart', e); }
  }

  function renderTable(r) {
    var tb = $('tbody'); if (!tb) return;
    try { saveOpenYears(tb); } catch (e) {}
    var price = num('ni-price') || 0, growth = num('ni-growth') / 100, tax = st.tax, dca = st.dca;
    $('th-deposit').classList.toggle('col-hidden', !dca);
    $('th-gross').style.display = tax ? '' : 'none';
    $('th-tax').style.display = tax ? '' : 'none';
    $('th-shares').style.display = price > 0 ? '' : 'none';
    setT('th-net', tax ? '배당금 (세후)' : '배당금');
    var B = 'border-top:1px solid rgba(var(--fg-rgb),0.06);', html = '';
    var pc = function (v, s) { v = Math.round(v); if (Math.abs(v) <= 2) v = 0; return '<td style="' + (s || '') + 'color:' + (v >= 0 ? '#3182f6' : '#f04452') + ';">' + (v >= 0 ? '+' : '') + fmt(v) + '</td>'; };
    var dash = '<span style="color:var(--text3);">—</span>';
    r.rows.forEach(function (row, yi) {
      var lastY = yi === r.rows.length - 1;
      html += '<tr class="yr-acc-hdr" data-yr="' + row.y + '">'
        + '<td style="' + B + '"><span style="display:flex;align-items:center;gap:8px;"><span class="yr-acc-arrow" style="font-size:11px;color:var(--text3);transition:transform 0.15s;">▶</span><span>' + row.label + '</span></span></td>'
        + '<td style="' + B + '">' + fmt(row.portStart) + '</td>'
        + '<td class="' + (dca ? '' : 'col-hidden') + '" style="' + B + 'color:var(--accent);">' + fmt(row.deposit) + '</td>'
        + (tax ? '<td style="' + B + 'color:#fe9800;">' + fmt(row.gross) + '</td><td style="' + B + 'color:#f04452;">' + fmt(row.tax) + '</td>' : '')
        + '<td style="' + B + '">' + fmt(row.net) + '</td>'
        + pc(row.price, B)
        + '<td style="' + B + '">' + fmt(row.port) + '</td>'
        + (price > 0 ? '<td style="' + B + '">' + fmtShares(calcShares(row.port, price, growth, row.y * 12)) + '</td>' : '')
        + '</tr>';
      row.months.forEach(function (m, mi) {
        var n = (row.y - 1) * 12 + m.m;
        html += '<tr data-yr-row="' + row.y + '" style="display:none;"' + (lastY && mi === 11 ? ' class="highlight"' : '') + '>'
          + '<td style="color:var(--text3);">' + n + '개월' + (m.pay ? ' <span style="color:var(--accent);font-size:10px;">지급</span>' : '') + '</td>'
          + '<td>' + fmt(m.start) + '</td>'
          + '<td class="' + (dca ? '' : 'col-hidden') + '">' + (m.deposit > 0 ? '<span style="color:var(--accent);">+' + fmt(m.deposit) + '</span>' : dash) + '</td>'
          + (tax ? '<td style="color:#fe9800;">' + (m.pay ? fmt(m.gross) : dash) + '</td><td style="color:#f04452;">' + (m.pay ? fmt(m.tax) : dash) + '</td>' : '')
          + '<td>' + (m.pay ? fmt(m.net) : dash) + '</td>'
          + pc(m.price)
          + '<td>' + fmt(m.end) + '</td>'
          + (price > 0 ? '<td>' + fmtShares(calcShares(m.end, price, growth, n)) + '</td>' : '')
          + '</tr>';
      });
    });
    tb.innerHTML = html;
    tb.querySelectorAll('.yr-acc-hdr').forEach(function (h) { h.onclick = function () { toggleYearGroup(this); }; });
    try { restoreOpenYears(tb); } catch (e) {}
  }

  function renderChart() {
    if (!cache || typeof Chart === 'undefined') return;
    var r = cache, annual = st.chart === 'annual', labels = [], data = [], titles = [];
    if (annual) r.rows.forEach(function (row) { labels.push(row.label); data.push(Math.round(row.net)); titles.push(row.label); });
    else r.rows.forEach(function (row) {
      var k = 0;
      row.months.forEach(function (m) { if (!m.pay) return; labels.push(k === 0 ? row.label : ''); data.push(Math.round(m.net)); titles.push(row.label + ' ' + m.m + '월 지급'); k++; });
    });
    var lbl = annual ? '연간 배당금' : (FREQ[r.period] + ' 배당금');
    setT('leg-label', lbl + (st.tax ? ' (세후)' : ''));
    var line = !annual && r.period === 1;
    var ds = line ? { label: lbl, data: data, borderColor: '#3182f6', backgroundColor: 'rgba(49,130,246,0.12)', fill: true, pointRadius: 0, pointHoverRadius: 4, borderWidth: 2, tension: 0.2 }
      : { label: lbl, data: data, backgroundColor: 'rgba(49,130,246,0.7)', borderRadius: annual || data.length <= 40 ? 5 : 2, borderSkipped: false };
    var opts = {
      responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
      plugins: { legend: { display: false }, tooltip: { backgroundColor: '#202027', borderColor: fgA(0.1), borderWidth: 1, titleColor: '#9e9ea4', bodyColor: '#e4e4e5', padding: 12,
        callbacks: { title: function (it) { return titles[it[0].dataIndex]; }, label: function (c) { return ' ' + c.dataset.label + ': ' + fmt(c.parsed.y); } } } },
      scales: {
        x: { ticks: { color: '#6d6d76', font: { size: 11 }, maxRotation: 0, autoSkip: annual, callback: function (v, i) { var l = this.getLabelForValue(i); return l !== '' ? l : null; } }, grid: { display: false }, border: { display: false } },
        y: { ticks: { color: '#6d6d76', font: { size: 11 }, callback: function (v) { return fmt(v, true); } }, grid: { color: fgA(0.04) }, border: { display: false }, beginAtZero: true }
      }
    };
    if (chart) chart.destroy();
    chart = new Chart($('chart'), { type: line ? 'line' : 'bar', data: { labels: labels, datasets: [ds] }, options: opts });
  }

  /* ── 화면 조작 (HTML onclick 에서 호출) ── */
  window.divcalcUpdate = update;
  window.divcalcSetMode = function (m, btn) { st.mode = m; seg(btn.parentNode, btn); update(); };
  window.divcalcSetFreq = function (p, btn) { st.period = p; seg(btn.parentNode, btn); update(); };
  window.divcalcToggle = function (k) { st[k] = !st[k]; sw(k, st[k]); update(); };
  window.divcalcSetTaxMode = function (m, btn) { st.taxMode = m; seg(btn.parentNode, btn); update(); };
  window.divcalcSetChart = function (t, btn) { st.chart = t; seg(btn.parentNode, btn); btn.parentNode.querySelectorAll('.chart-tab').forEach(function (b) { b.classList.toggle('active', b === btn); }); renderChart(); };
  window.divcalcSync = function (f, fromSlider) {   /* 숫자 입력(년·%) ↔ 슬라이더 */
    var n = $('ni-' + f), s = $('sl-' + f);
    if (fromSlider) n.value = s.value; else if (n.value !== '' && !isNaN(+n.value)) s.value = Math.min(Math.max(+n.value, +s.min), +s.max);
    update();
  };
  window.divcalcTaxPreset = function (v, btn) { $('ni-tax').value = v; btn.parentNode.querySelectorAll('.preset-btn').forEach(function (b) { b.classList.toggle('active', b === btn); }); update(); };
  sw('dca', st.dca); sw('tax', st.tax);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', update); else update();
})();

/* ════════════════════════════════════════
   [FIRE] 파이어족 계산기 — 순수 계산 FIRE.calc
   · 매달 초 저축액 투입 → 한 달 수익률 (1+연 수익률)^(1/12) − 1 · 저축액은 해마다 '저축액 증가율'만큼 늘어남
   · 물가: 생활비·부업소득·연금은 현재 가치로 입력 → 매달 (1+물가상승률)^(개월/12) 를 곱한 명목 금액으로 계산
   · 목표 자산
       swr  (인출률 · 4% 룰): (월 생활비 − 은퇴 후 월 소득) × 12 ÷ 인출률  — 그 시점 물가로 환산
       life (기대수명까지): 은퇴 후 매달 (생활비 − 은퇴 후 소득 − 연금) 을 빼고 은퇴 후 수익률로 굴려 기대수명까지 0원 아래로 내려가지 않는 최소 자산
   · 은퇴(FIRE) 시점: 매달 초 자산이 그 달의 목표 자산 이상이 되는 첫 달 → 그 뒤로는 저축을 멈추고 생활비를 인출
════════════════════════════════════════ */
var FIRE = (function () {
  var MAXM = 100 * 12;
  function mr(a) { return Math.pow(1 + (a || 0), 1 / 12) - 1; }
  function prep(o) {
    var c = {};
    for (var k in o) c[k] = o[k];
    c.age = Math.max(0, +o.age || 0); c.life = Math.max(c.age + 1, +o.life || 90);
    c.rm = mr(o.ret); c.rp = mr(o.retPost != null ? o.retPost : o.ret);
    c.inf = 1 + (o.infl || 0);
    c.need = Math.max(0, (o.spend || 0) - (o.side || 0));      /* 은퇴 후 매달 자산에서 꺼낼 돈 (현재 가치, 연금 전) */
    c.endM = Math.round((c.life - c.age) * 12);               /* 기대수명이 되는 달 (지금부터) */
    return c;
  }
  function P(c, k) { return Math.pow(c.inf, k / 12); }          /* k개월 뒤 물가 지수 */
  function withdraw(c, k) {                                     /* k개월째(지금 기준) 은퇴 후 인출액 (명목, 음수면 남는 돈) */
    var age = c.age + k / 12;
    var pen = c.pension > 0 && age >= (c.pensionAge || 65) ? c.pension : 0;
    return (c.spend - (c.side || 0) - pen) * P(c, k);
  }
  /* k개월째 자산 A 로 은퇴했을 때 기대수명까지 버티는지 · 소진되면 그 달 */
  function drawdown(c, k, A) {
    for (var t = k; t < c.endM; t++) {
      A -= withdraw(c, t);
      if (A < -0.5) return { ok: false, out: t, left: A };
      A *= 1 + c.rp;
    }
    return { ok: true, left: A };
  }
  /* life 방식: k개월째 필요한 최소 자산 (명목) — 뒤에서부터 need[t] = max(0, 인출[t] + need[t+1] ÷ (1+수익률)) */
  function lifeTable(c) {
    var need = new Array(c.endM + 1); need[c.endM] = 0;
    for (var t = c.endM - 1; t >= 0; t--) need[t] = Math.max(0, withdraw(c, t) + need[t + 1] / (1 + c.rp));
    return need;
  }
  function lifeNeed(c, k) { if (!c.need_) c.need_ = lifeTable(c); return k >= c.endM ? 0 : c.need_[k]; }
  function target(c, k) { return c.mode === 'life' ? lifeNeed(c, k) : (c.swr > 0 ? c.need * 12 / c.swr * P(c, k) : Infinity); }
  /* 저축 단계: 매달 초 목표 확인 → 저축 → 수익. 달성한 달(fireM) 반환 */
  function accumulate(c, monthly, limit) {
    var A = c.assets || 0, g = 1 + (c.saveGrowth || 0);
    for (var k = 0; k <= limit; k++) {
      if (A >= target(c, k) - 0.5) return { m: k, A: A };
      A += monthly * Math.pow(g, Math.floor(k / 12));
      A *= 1 + c.rm;
    }
    return { m: -1, A: A };
  }
  function calc(o) {
    var c = prep(o), r = { c: c };
    r.target0 = target(c, 0);                                   /* 지금 은퇴한다면 필요한 자산 */
    var lim = Math.min(MAXM, Math.max(c.endM - 1, 0));
    var f = accumulate(c, c.monthly || 0, lim);
    r.fireM = f.m; r.reached = f.m >= 0;
    r.fireAge = r.reached ? c.age + f.m / 12 : null;
    r.fireAssets = r.reached ? f.A : null;
    r.fireTarget = r.reached ? target(c, f.m) : null;
    r.fireTargetReal = r.reached ? r.fireTarget / P(c, f.m) : null;
    /* 목표 나이에 은퇴하려면 필요한 월 저축액 (첫해 기준, 이후 증가율 반영) */
    var tm = Math.round(((+o.targetAge || 0) - c.age) * 12);
    r.targetM = tm;
    if (tm >= 0 && tm < c.endM) {
      if (accumulate(c, 0, tm).m >= 0) r.needMonthly = 0;
      else {
        var lo = 0, hi = 1e6;
        while (accumulate(c, hi, tm).m < 0 && hi < 1e12) hi *= 4;
        for (var i = 0; i < 60 && hi - lo > 1; i++) { var mid = (lo + hi) / 2; if (accumulate(c, mid, tm).m >= 0) hi = mid; else lo = mid; }
        r.needMonthly = hi < 1e12 ? hi : null;
      }
    } else r.needMonthly = null;
    /* 코스트 FIRE: 더 저축하지 않아도 일반 은퇴 나이에 목표에 닿는 지금 자산 */
    var cm = Math.round(((+o.coastAge || 65) - c.age) * 12);
    if (cm > 0 && cm < c.endM) { r.coastM = cm; r.coast = target(c, cm) / Math.pow(1 + c.rm, cm); r.coastOk = (c.assets || 0) >= r.coast; }
    /* 연도별 흐름 (지금 ~ 기대수명) */
    var A = c.assets || 0, g = 1 + (c.saveGrowth || 0), rows = [], y = null, out = null, retired = false;
    for (var k = 0; k < c.endM; k++) {
      if (k % 12 === 0) { y = { k: k, age: c.age + k / 12, start: A, save: 0, gain: 0, wd: 0, P: P(c, k), tgt: target(c, k) }; rows.push(y); }
      if (!retired && r.reached && k >= r.fireM) retired = true;
      if (!retired) { var s = (c.monthly || 0) * Math.pow(g, Math.floor(k / 12)); A += s; y.save += s; }
      else {
        var w = withdraw(c, k);
        if (w > A) { if (out == null && w - A > 0.5) out = k; w = Math.max(0, A); }   /* 자산이 바닥나면 있는 만큼만 */
        A -= w; y.wd += w;
      }
      var gain = A > 0 ? A * (retired ? c.rp : c.rm) : 0;
      A += gain; y.gain += gain;
      y.end = A; y.retired = retired; y.Pend = P(c, k + 1);
    }
    r.rows = rows; r.endAssets = A;
    r.depleteAge = out != null ? c.age + out / 12 : null;
    if (r.reached) {
      r.firstWd = withdraw(c, r.fireM);                         /* 은퇴 첫 달 인출액 (명목) */
      r.firstWdReal = r.firstWd / P(c, r.fireM);
      r.wdRate = r.fireAssets > 0 ? r.firstWd * 12 / r.fireAssets : 0;
    }
    r.saveRate = o.income > 0 ? (c.monthly || 0) / o.income : null;
    return r;
  }
  return { calc: calc, mr: mr };
})();

/* [FIRE] 화면 — 입력(data-fc="fire")·억/만/원 단위·버튼은 [FC-UI] 공통 처리 */
(function () {
  if (!document.getElementById('page-fire')) return;   /* 도구별 페이지 분리: 파이어족 계산기 화면이 있는 페이지에서만 */
  function $(id) { return document.getElementById(id); }
  function setT(id, v) { var e = $(id); if (e) e.textContent = v; }
  function setH(id, v) { var e = $(id); if (e) e.innerHTML = v; }
  function numOf(id) { var e = $(id); return e ? (parseFloat(String(e.value).replace(/,/g, '')) || 0) : 0; }
  var UNIT = { eok: 1e8, man: 1e4, won: 1 };
  function amt(id) { var e = $(id); return Math.round(numOf(id) * (UNIT[e && e.getAttribute('data-unit')] || 1)); }
  function won(n) { return (n < 0 ? '−' : '') + Math.round(Math.abs(n)).toLocaleString('ko-KR') + '원'; }
  function eok(n) {
    var neg = n < 0; n = Math.round(Math.abs(n) / 1e4) * 1e4;
    var e = Math.floor(n / 1e8), m = Math.round((n - e * 1e8) / 1e4), s;
    if (!e) s = m.toLocaleString('ko-KR') + '만원'; else s = e.toLocaleString('ko-KR') + '억' + (m ? ' ' + m.toLocaleString('ko-KR') + '만원' : '원');
    return (neg ? '−' : '') + s;
  }
  function pct(v, d) { return (v * 100).toFixed(d == null ? 1 : d) + '%'; }
  function seg(name) { var b = document.querySelector('.fc-seg[data-name="' + name + '"] .mode-btn.active'); return b ? b.getAttribute('data-v') : null; }
  function ym(months) { var y = Math.floor(months / 12), m = Math.round(months - y * 12); if (m === 12) { y++; m = 0; } return (y ? y + '년' : '') + (m ? (y ? ' ' : '') + m + '개월' : (y ? '' : '0개월')); }
  function ageTxt(a) { var y = Math.floor(a + 1e-9), m = Math.round((a - y) * 12); if (m === 12) { y++; m = 0; } return y + '세' + (m ? ' ' + m + '개월' : ''); }
  var chart = null;
  function render() {
    var mode = seg('fire-mode') || 'swr', real = (seg('fire-view') || 'real') === 'real';
    var o = {
      mode: mode, age: numOf('fire-age'), life: numOf('fire-life'), assets: amt('fire-assets'), income: amt('fire-income'),
      monthly: amt('fire-monthly'), saveGrowth: numOf('fire-sg') / 100, spend: amt('fire-spend'), side: amt('fire-side'),
      pension: amt('fire-pension'), pensionAge: numOf('fire-page') || 65, swr: numOf('fire-swr') / 100,
      ret: numOf('fire-ret') / 100, retPost: numOf('fire-retp') / 100, infl: numOf('fire-infl') / 100,
      targetAge: numOf('fire-tage'), coastAge: numOf('fire-cage') || 65
    };
    $('fire-swr-f').style.display = mode === 'swr' ? '' : 'none';
    if (!(o.age > 0) || !(o.life > o.age)) { setT('fire-age-out', '—'); setT('fire-sub', '현재 나이와 기대 수명(현재 나이보다 많게)을 넣어 주세요'); return; }
    var r = FIRE.calc(o), c = r.c;
    /* 결과 카드 */
    if (r.reached) {
      setT('fire-label', r.fireM === 0 ? '이미 경제적 자유를 달성했습니다' : 'FIRE 달성 예상 나이');
      setT('fire-age-out', ageTxt(r.fireAge));
      setT('fire-sub', (r.fireM === 0 ? '지금 자산 ' + eok(o.assets) + '이 목표 자산 ' + eok(r.target0) + ' 이상입니다' : '지금부터 ' + ym(r.fireM) + ' 뒤 · 그때 자산 ' + eok(r.fireAssets) + (o.infl ? ' (현재 가치 ' + eok(r.fireAssets / Math.pow(1 + o.infl, r.fireM / 12)) + ')' : ''))
        + ' · 은퇴 첫 달 생활비 인출 ' + won(Math.max(0, r.firstWd)) + (o.infl ? ' (현재 가치 ' + won(Math.max(0, r.firstWdReal)) + ')' : ''));
    } else {
      setT('fire-label', 'FIRE 달성 예상 나이');
      setT('fire-age-out', '기대 수명 안에 어려움');
      setT('fire-sub', '지금 조건으로는 ' + ageTxt(o.life) + ' 전에 목표 자산에 닿지 못합니다 — 저축액·수익률을 높이거나 생활비를 낮춰 보세요');
    }
    setT('fire-k1', eok(r.target0));
    setT('fire-k1-l', mode === 'swr' ? '목표 자산 (현재 가치)' : '지금 은퇴 시 필요 자산');
    setT('fire-k2', r.needMonthly == null ? '—' : r.needMonthly === 0 ? '0원 (이미 충분)' : won(Math.ceil(r.needMonthly / 1e4) * 1e4));
    setT('fire-k2-l', Math.round(o.targetAge) + '세 은퇴에 필요한 월 저축');
    setT('fire-k3', r.coast != null ? eok(r.coast) : '—');
    setT('fire-k3-l', '코스트 FIRE (' + Math.round(o.coastAge) + '세 기준)');
    /* 상세 */
    var lines = [];
    if (mode === 'swr') lines.push(['목표 자산 <small>(월 생활비 ' + won(o.spend) + (o.side ? ' − 은퇴 후 소득 ' + won(o.side) : '') + ') × 12 ÷ 인출률 ' + pct(o.swr, 2).replace(/\.?0+%$/, '%') + '</small>', eok(r.target0), 'fc-total']);
    else lines.push(['지금 은퇴하면 필요한 자산 <small>(' + ageTxt(o.life) + '까지 매달 생활비를 꺼내 쓰고 은퇴 후 수익률 ' + pct(o.retPost) + '로 굴릴 때 0원이 되는 금액)</small>', eok(r.target0), 'fc-total']);
    if (r.reached && r.fireM > 0) {
      lines.push(['FIRE 시점 목표 자산 <small>(물가 ' + pct(o.infl) + ' 반영 · 그때 금액)</small>', eok(r.fireTarget)]);
      lines.push(['FIRE 시점 실제 자산', eok(r.fireAssets)]);
    }
    if (r.reached) lines.push(['은퇴 첫해 실제 인출률 <small>(첫 달 인출액 × 12 ÷ 은퇴 자산)</small>', pct(r.wdRate, 2)]);
    if (r.saveRate != null) lines.push(['저축률 <small>(월 저축 ÷ 월 세후 소득)</small>', pct(r.saveRate)]);
    lines.push(['연 수익률 실질 환산 <small>(은퇴 전 · 물가 차감)</small>', pct((1 + o.ret) / (1 + o.infl) - 1, 2)]);
    if (r.coast != null) lines.push(['코스트 FIRE <small>(더 저축하지 않아도 ' + Math.round(o.coastAge) + '세에 목표에 닿는 지금 자산)</small>', r.coastOk ? '달성 ✓ (지금 ' + eok(o.assets) + ')' : eok(r.coast - o.assets) + ' 부족']);
    if (r.reached) lines.push(r.depleteAge != null
      ? ['자산 소진 나이 <small>(은퇴 후 생활비를 꺼내 쓰다 0원이 되는 때)</small>', '<span style="color:#f04452;">' + ageTxt(r.depleteAge) + '</span>', '']
      : [ageTxt(o.life) + ' 때 남는 자산 <small>(현재 가치)</small>', eok(r.endAssets / Math.pow(1 + o.infl, (o.life - o.age)))]);
    if (o.pension > 0) lines.push(['연금 <small>(' + Math.round(o.pensionAge) + '세부터 월 ' + won(o.pension) + ', 현재 가치)</small>', mode === 'swr' ? '목표 자산엔 미반영 · 은퇴 후 흐름에 반영' : '목표 자산·흐름에 반영']);
    setH('fire-table', lines.map(function (x) { return '<tr' + (x[2] ? ' class="' + x[2] + '"' : '') + '><td>' + x[0] + '</td><td style="text-align:right;">' + x[1] + '</td></tr>'; }).join(''));
    /* 연도별 */
    var dv = function (v, row, end) { return real ? v / (end ? row.Pend : row.P) : v; };
    setH('fire-years', r.rows.map(function (y) {
      var fireRow = r.reached && r.fireM >= y.k && r.fireM < y.k + 12;
      return '<tr' + (fireRow ? ' class="fc-hl"' : '') + '><td>' + Math.floor(y.age + 1e-9) + '세' + (fireRow ? ' 🔥' : '') + '</td><td>' + (y.save ? eok(dv(y.save, y, true)) : '—') + '</td><td>' + eok(dv(y.gain, y, true)) + '</td><td>' + (y.wd ? '<span style="color:#f04452;">−' + eok(dv(y.wd, y, true)) + '</span>' : '—') + '</td><td>' + eok(dv(y.end, y, true)) + '</td></tr>';
    }).join(''));
    setT('fire-years-note', real ? '금액은 모두 현재 가치(물가 ' + pct(o.infl) + '를 빼서 지금 돈으로 환산)입니다.' : '금액은 그해 실제 금액(미래 금액)입니다.');
    /* 차트 */
    if (typeof Chart === 'undefined') return;
    var labels = [], A = [], T = [];
    r.rows.forEach(function (y) { labels.push(Math.floor(y.age + 1e-9) + '세'); A.push(Math.round(dv(y.start, y))); T.push(!r.reached || y.k <= r.fireM ? Math.round(dv(y.tgt, y)) : null); });
    var last = r.rows[r.rows.length - 1]; labels.push(Math.round(o.life) + '세'); A.push(Math.round(dv(last.end, last, true))); T.push(null);
    var ds = [
      { label: '자산', data: A, borderColor: '#3182f6', backgroundColor: 'rgba(49,130,246,0.12)', fill: true, pointRadius: 0, pointHoverRadius: 4, borderWidth: 2, tension: 0.2 },
      { label: '목표 자산', data: T, borderColor: '#fe9800', borderDash: [6, 4], fill: false, pointRadius: 0, pointHoverRadius: 3, borderWidth: 1.6, spanGaps: false }
    ];
    var opts = {
      responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
      plugins: { legend: { display: false }, tooltip: { backgroundColor: '#202027', borderColor: fgA(0.1), borderWidth: 1, titleColor: '#9e9ea4', bodyColor: '#e4e4e5', padding: 12,
        callbacks: { label: function (x) { return x.parsed.y == null ? null : ' ' + x.dataset.label + ': ' + eok(x.parsed.y); } } } },
      scales: { x: { ticks: { color: '#6d6d76', font: { size: 11 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 10 }, grid: { display: false }, border: { display: false } },
        y: { beginAtZero: true, ticks: { color: '#6d6d76', font: { size: 11 }, callback: function (v) { return fmt(v, true); } }, grid: { color: fgA(0.04) }, border: { display: false } } }
    };
    if (chart) { chart.data.labels = labels; chart.data.datasets = ds; chart.options = opts; chart.update('none'); }
    else chart = new Chart($('fire-chart'), { type: 'line', data: { labels: labels, datasets: ds }, options: opts });
  }
  window.fcRegister('fire', render, 'fire');
})();

/* ════════════════════════════════════════
   [RE-TAX] 재산세(PTX) · 종합부동산세(JBX) 계산 — 2026년 과세기준일(6.1) 현행 법령
   근거(2026-10 국가법령정보센터 원문 확인)
   · 지방세법 [시행 2026.1.1] 제110조(과세표준·과표상한), 제111조(세율), 제111조의2(1세대1주택 특례세율 — 2026년분까지),
     제112조(도시지역분 0.14%), 제115조(납기), 제118조(분할납부), 제122조(세부담상한 — 주택 제외), 제146조(소방분), 제151조(지방교육세 20%)
   · 지방세법 시행령 [2026.5.29 개정] 제109조(공정시장가액비율: 토지·건축물 70%, 주택 60%, 2026년 1세대1주택 43/44/45%), 제109조의2(과표상한율 5%)
   · 종합부동산세법 제8조(공제 9억·1세대1주택 12억·법인 0), 제9조(세율·재산세 공제·1세대1주택 세액공제), 제10조(세부담상한 150%),
     제13~15조(토지), 제20조(분납) · 시행령 제2조의4(주택 60%·토지 100%), 제4조의3(재산세 공제), 제5조(세부담상한) · 농특세법 제5조(20%)
   금액 단위: 원 · 고지 세액은 10원 미만 버림(국고금관리법 제47조·지방회계법)
════════════════════════════════════════ */
var PTX = (function () {
  var INF = Infinity;
  function fl10(x) { return Math.floor(Math.max(0, x) / 10 + 1e-9) * 10; }
  function prog(base, br) {      /* br: [[상한, 세율], …] — 구간별 누진 */
    if (!(base > 0)) return 0;
    var t = 0, prev = 0;
    for (var i = 0; i < br.length; i++) { if (base > prev) t += (Math.min(base, br[i][0]) - prev) * br[i][1]; prev = br[i][0]; }
    return t;
  }
  var HOUSE = [[6e7, 0.001], [1.5e8, 0.0015], [3e8, 0.0025], [INF, 0.004]];
  var HOUSE_ONE = [[6e7, 0.0005], [1.5e8, 0.001], [3e8, 0.002], [INF, 0.0035]];
  var LAND_AGG = [[5e7, 0.002], [1e8, 0.003], [INF, 0.005]];
  var LAND_SEP = [[2e8, 0.002], [1e9, 0.003], [INF, 0.004]];
  var LAND_SPLIT = { farm: 0.0007, luxury: 0.04, other: 0.002 };
  var BLDG = { general: 0.0025, luxury: 0.04, factory: 0.005, newfactory: 0.0125 };
  var FIRE = [[6e6, 0.0004], [1.3e7, 0.0005], [2.6e7, 0.0006], [3.9e7, 0.0008], [6.4e7, 0.001], [INF, 0.0012]];
  /* 주택 공정시장가액비율 (시행령 제109조①2호) */
  function houseRatio(price, one) { return one ? (price <= 3e8 ? 0.43 : price <= 6e8 ? 0.44 : 0.45) : 0.6; }
  /* 소방분 지역자원시설세 (법 제146조③④) */
  function fireTax(base, mult) { return prog(base, FIRE) * (mult || 1); }
  /* 주택 1채 — o: {price, prev, one, urban, share, flex, bldg, fireMult} · 세액은 지분 비율만큼 */
  function house(o) {
    var price = Math.max(0, +o.price || 0), one = !!o.one, share = o.share == null ? 1 : Math.min(1, Math.max(0, +o.share));
    var ratio = houseRatio(price, one), raw = price * ratio, base = raw, capped = false;
    if (o.prev > 0) {   /* 과표상한(법 제110조③): 직전연도 시가표준액 × 올해 비율 + 올해 과표 × 5% */
      var cap = o.prev * ratio + raw * 0.05;
      if (cap < raw) { base = cap; capped = true; }
    }
    base = Math.floor(base);
    var flex = Math.max(-0.5, Math.min(0.5, +o.flex || 0));
    var std = prog(base, HOUSE), stdFlex = std * (1 + flex);
    var special = one && price <= 9e8, tax;
    if (special) { var sp = prog(base, HOUSE_ONE); tax = flex && stdFlex < sp ? stdFlex : sp; special = !(flex && stdFlex < sp); }   /* 탄력세율 세액이 더 적으면 특례 대신 탄력세율(법 제111조의2③) */
    else tax = stdFlex;
    var urban = o.urban === false ? 0 : base * 0.0014;
    var fireBase = Math.max(0, +o.bldg || 0) * ratio, fire = fireBase > 0 ? fireTax(fireBase, o.fireMult) : 0;
    var r = { price: price, ratio: ratio, raw: raw, base: base, capped: capped, special: special, flex: flex, share: share,
      stdFull: std, taxFull: tax, urbanFull: urban, fireBase: fireBase };
    r.tax = fl10(tax * share); r.urban = fl10(urban * share); r.edu = fl10(tax * share * 0.2); r.fire = fl10(fire * share);
    r.std = std * share;                                /* 종부세 재산세 공제 분모용 (표준세율 · 지분) */
    r.prop = r.tax + r.urban;                          /* 재산세 (본세 + 도시지역분) */
    r.total = r.tax + r.urban + r.edu + r.fire;
    return r;
  }
  /* 토지 — kind: agg(종합합산) · sep(별도합산) · split(분리과세: farm/luxury/other) · prevTax: 전년 재산세 상당액(세부담상한 150%) */
  function land(o) {
    var v = Math.max(0, +o.value || 0), base = Math.floor(v * 0.7), flex = Math.max(-0.5, Math.min(0.5, +o.flex || 0)), tax;
    if (o.kind === 'agg') tax = prog(base, LAND_AGG); else if (o.kind === 'sep') tax = prog(base, LAND_SEP); else tax = base * (LAND_SPLIT[o.split] || 0.002);
    tax *= 1 + flex;
    var urban = o.urban === false ? 0 : base * 0.0014, r = { base: base, ratio: 0.7 };
    r.taxRaw = tax; r.capT = false; r.capU = false;
    if (o.prevTax > 0 && tax > o.prevTax * 1.5) { tax = o.prevTax * 1.5; r.capT = true; }
    if (o.prevUrban > 0 && urban > o.prevUrban * 1.5) { urban = o.prevUrban * 1.5; r.capU = true; }
    r.tax = fl10(tax); r.urban = fl10(urban); r.edu = fl10(tax * 0.2); r.fire = 0;
    r.prop = r.tax + r.urban; r.total = r.tax + r.urban + r.edu;
    return r;
  }
  /* 건축물 — kind: general/luxury/factory/newfactory · 소방분은 재산세 과세표준(시가표준액 × 70%) 기준 */
  function building(o) {
    var v = Math.max(0, +o.value || 0), base = Math.floor(v * 0.7), flex = Math.max(-0.5, Math.min(0.5, +o.flex || 0));
    var tax = base * (BLDG[o.kind] || 0.0025) * (1 + flex), urban = o.urban === false ? 0 : base * 0.0014, r = { base: base, ratio: 0.7 };
    r.capT = false; r.capU = false;
    if (o.prevTax > 0 && tax > o.prevTax * 1.5) { tax = o.prevTax * 1.5; r.capT = true; }
    if (o.prevUrban > 0 && urban > o.prevUrban * 1.5) { urban = o.prevUrban * 1.5; r.capU = true; }
    var fire = fireTax(base, o.fireMult);
    r.tax = fl10(tax); r.urban = fl10(urban); r.edu = fl10(tax * 0.2); r.fire = fl10(fire);
    r.prop = r.tax + r.urban; r.total = r.tax + r.urban + r.edu + r.fire;
    return r;
  }
  /* 분할납부(법 제118조): 납기별 세액 250만원 초과 → 500만원 이하는 250만원 초과분, 그 이상은 50% 이하, 3개월 안 */
  function installment(x) { return x > 5e6 ? fl10(x / 2) : x > 2.5e6 ? x - 2.5e6 : 0; }
  return { house: house, land: land, building: building, houseRatio: houseRatio, prog: prog, installment: installment, fl10: fl10,
    HOUSE: HOUSE, HOUSE_ONE: HOUSE_ONE, LAND_AGG: LAND_AGG, LAND_SEP: LAND_SEP, FIRE: FIRE };
})();

var JBX = (function () {
  var INF = Infinity, prog = PTX.prog, fl10 = PTX.fl10;
  var H2 = [[3e8, 0.005], [6e8, 0.007], [12e8, 0.01], [25e8, 0.013], [50e8, 0.015], [94e8, 0.02], [INF, 0.027]];
  var H3 = [[3e8, 0.005], [6e8, 0.007], [12e8, 0.01], [25e8, 0.02], [50e8, 0.03], [94e8, 0.04], [INF, 0.05]];
  var L_AGG = [[15e8, 0.01], [45e8, 0.02], [INF, 0.03]];
  var L_SEP = [[200e8, 0.005], [400e8, 0.006], [INF, 0.007]];
  function ageRate(a) { return a >= 70 ? 0.4 : a >= 65 ? 0.3 : a >= 60 ? 0.2 : 0; }
  function holdRate(y) { return y >= 15 ? 0.5 : y >= 10 ? 0.4 : y >= 5 ? 0.2 : 0; }
  /* 주택분 — useprev: 직전연도 상당액 계산(과표상한·탄력세율·도시지역분 제외, 직전연도 공시가격·나이·보유기간) */
  function houseTax(o, usePrev) {
    var owner = o.owner || 'person', one = owner === 'person' && o.count === 'one';
    var rows = (o.houses || []).filter(function (h) { return (usePrev ? h.prev : h.price) > 0; }).map(function (h) {
      var price = usePrev ? h.prev : h.price, share = h.share == null ? 1 : h.share;
      var p = PTX.house({ price: price, prev: usePrev ? 0 : h.prev, one: !!h.propOne, share: share, urban: false, flex: usePrev ? 0 : o.flex });
      return { h: h, price: price, share: share, value: price * share, p: p };
    });
    var r = { one: one, rows: rows };
    r.value = rows.reduce(function (a, x) { return a + x.value; }, 0);
    r.ded = owner === 'corp' ? 0 : one ? 12e8 : 9e8;
    r.base = Math.max(0, Math.floor((r.value - r.ded) * 0.6));
    /* 세율(법 제9조): corp 일반 법인 2.7%·5% 단일 / corpProg 공익법인 직접사용·공공주택사업자 등 → 주택 수 무관 일반 누진 / person·corpPub(그 밖의 공익법인) → 주택 수별 */
    var heavy = owner !== 'corpProg' && o.count === 'three';
    r.heavy = heavy;
    r.gross = owner === 'corp' ? r.base * (heavy ? 0.05 : 0.027) : prog(r.base, heavy ? H3 : H2);
    /* 재산세 공제(시행령 제4조의3①): 부과액 × (종부세 과표 × 재산세 공정시장가액비율 × 표준세율 0.4%) ÷ 표준세율로 계산한 재산세 상당액 */
    r.propTax = rows.reduce(function (a, x) { return a + x.p.tax; }, 0);
    r.propStd = rows.reduce(function (a, x) { return a + x.p.std; }, 0);
    r.propRatio = r.value > 0 ? rows.reduce(function (a, x) { return a + x.value * x.p.ratio; }, 0) / r.value : 0.6;
    r.num = r.base * r.propRatio * 0.004;
    r.propDed = r.base > 0 && r.propStd > 0 ? Math.floor(r.propTax * Math.min(1, r.num / r.propStd) + 1e-6) : 0;
    r.calc = Math.max(0, r.gross - r.propDed);
    /* 1세대1주택 세액공제 — 주택 수 제외 주택(일시적 2주택·상속·지방 저가 등)분은 공시가격 비율로 빼고 적용 */
    r.ageRate = 0; r.holdRate = 0; r.credit = 0;
    if (one) {
      var age = usePrev ? (o.age || 0) - 1 : (o.age || 0), yrs = usePrev ? (o.years || 0) - 1 : (o.years || 0);
      r.ageRate = ageRate(age); r.holdRate = holdRate(yrs);
      r.creditRate = Math.min(0.8, r.ageRate + r.holdRate);
      var excl = rows.reduce(function (a, x) { return a + (x.h.excl ? x.value : 0); }, 0);
      r.creditBase = r.value > 0 ? r.calc * (r.value - excl) / r.value : 0;
      r.credit = Math.floor(r.creditBase * r.creditRate);
    }
    r.tax = Math.max(0, r.calc - r.credit);
    return r;
  }
  /* 토지분 — kind agg/sep · value 공시지가 합 */
  function landTax(value, kind, usePrev) {
    var r = { value: value || 0, ded: kind === 'agg' ? 5e8 : 80e8 };
    r.base = Math.max(0, Math.floor(r.value - r.ded));
    r.gross = prog(r.base, kind === 'agg' ? L_AGG : L_SEP);
    var p = PTX.land({ value: r.value, kind: kind, urban: false });
    r.propTax = p.tax; r.propStd = p.taxRaw;
    r.num = r.base * 0.7 * (kind === 'agg' ? 0.005 : 0.004);
    r.propDed = r.base > 0 && r.propStd > 0 ? Math.floor(r.propTax * Math.min(1, r.num / r.propStd) + 1e-6) : 0;
    r.tax = Math.max(0, r.gross - r.propDed);
    return r;
  }
  function capApply(cur, prev, propTax) {   /* 세부담상한 150%: (올해 재산세 + 종부세) ≤ 직전연도 상당액 × 150% */
    var limit = prev * 1.5;
    if (cur.tax + propTax <= limit) return { tax: cur.tax, capped: false, limit: limit };
    return { tax: Math.max(0, Math.floor(limit - propTax)), capped: true, limit: limit };
  }
  function calc(o) {
    var res = { notes: [] };
    var H = houseTax(o, false);
    res.house = H;
    H.final = H.tax; H.capped = false;
    var capOn = o.owner !== 'corp' && H.rows.length && H.tax > 0;
    if (capOn) {
      var allPrev = (o.houses || []).filter(function (h) { return h.price > 0; }).every(function (h) { return h.prev > 0; });
      if (allPrev) {
        var P = houseTax(o, true);
        H.prevTotal = P.propTax + P.tax; H.prevProp = P.propTax; H.prevJb = P.tax;
        var c = capApply(H, H.prevTotal, H.propTax);
        H.final = c.tax; H.capped = c.capped; H.limit = c.limit;
      } else H.capUnknown = true;
    }
    res.land = {};
    ['agg', 'sep'].forEach(function (k) {
      var L = o.land && o.land[k];
      if (!L || !(L.value > 0)) return;
      var T = landTax(L.value, k, false); T.final = T.tax; T.capped = false;
      if (L.prev > 0 && T.tax > 0) {
        var Pv = landTax(L.prev, k, true), prevTotal = Pv.propTax + Pv.tax, cc = capApply(T, prevTotal, T.propTax);
        T.prevTotal = prevTotal; T.final = cc.tax; T.capped = cc.capped; T.limit = cc.limit;
      }
      res.land[k] = T;
    });
    var landSum = (res.land.agg ? res.land.agg.final : 0) + (res.land.sep ? res.land.sep.final : 0);
    res.jb = fl10(H.final + landSum);
    res.rural = fl10(res.jb * 0.2);
    res.total = res.jb + res.rural;
    /* 분납(법 제20조): 250만원 초과 → 500만원 이하는 250만원 초과분, 초과는 50% · 농특세는 같은 비율 */
    res.inst = res.jb > 5e6 ? fl10(res.jb / 2) : res.jb > 2.5e6 ? res.jb - 2.5e6 : 0;
    res.ruralInst = res.jb > 0 && res.inst > 0 ? fl10(res.rural * res.inst / res.jb) : (res.rural > 5e6 ? fl10(res.rural / 2) : 0);
    return res;
  }
  return { calc: calc, houseTax: houseTax, landTax: landTax, H2: H2, H3: H3, L_AGG: L_AGG, L_SEP: L_SEP, ageRate: ageRate, holdRate: holdRate };
})();

/* [RE-TAX] 화면 — 재산세(data-fc="ptx") · 종합부동산세(data-fc="jbx") · 입력·단위·버튼은 [FC-UI] 공통 처리 */
(function () {
  var PT = document.getElementById('page-proptax'), JB = document.getElementById('page-jongbu');
  if (!PT && !JB) return;   /* 도구별 페이지 분리: 해당 화면이 있는 페이지에서만 */
  function $(id) { return document.getElementById(id); }
  function setT(id, v) { var e = $(id); if (e) e.textContent = v; }
  function setH(id, v) { var e = $(id); if (e) e.innerHTML = v; }
  function numOf(id) { var e = $(id); return e ? (parseFloat(String(e.value).replace(/,/g, '')) || 0) : 0; }
  var UNIT = { eok: 1e8, man: 1e4, won: 1 };
  function amt(id) { var e = $(id); return Math.round(numOf(id) * (UNIT[e && e.getAttribute('data-unit')] || 1)); }
  function chk(id) { var e = $(id); return !!(e && e.checked); }
  function seg(name) { var b = document.querySelector('.fc-seg[data-name="' + name + '"] .mode-btn.active'); return b ? b.getAttribute('data-v') : null; }
  function show(id, on) { var e = $(id); if (e) e.style.display = on ? '' : 'none'; }
  function won(n) { return (n < 0 ? '−' : '') + Math.round(Math.abs(n)).toLocaleString('ko-KR') + '원'; }
  function eok(n) {
    var neg = n < 0; n = Math.round(Math.abs(n) / 1e4) * 1e4;
    var e = Math.floor(n / 1e8), m = Math.round((n - e * 1e8) / 1e4), s;
    if (!e) s = m.toLocaleString('ko-KR') + '만원'; else s = e.toLocaleString('ko-KR') + '억' + (m ? ' ' + m.toLocaleString('ko-KR') + '만원' : '원');
    return (neg ? '−' : '') + s;
  }
  function pct(v, d) { var t = (v * 100).toFixed(d == null ? 2 : d); if (t.indexOf('.') >= 0) t = t.replace(/\.?0+$/, ''); return t + '%'; }
  function rows(list) { return list.filter(Boolean).map(function (r) { return '<tr' + (r[2] ? ' class="' + r[2] + '"' : '') + '><td>' + r[0] + '</td><td style="text-align:right;">' + r[1] + '</td></tr>'; }).join(''); }
  function brRows(br, base, fmt) {
    var prev = 0, acc = 0;
    return br.map(function (b) {
      var lo = prev, hi = b[0], on = base > lo && (base <= hi || hi === Infinity);
      var label = hi === Infinity ? eok(lo) + ' 초과' : (lo ? eok(lo) + ' 초과 ~ ' : '') + eok(hi) + (lo ? '' : ' 이하');
      var txt = (acc ? won(Math.round(acc)) + ' + ' + (lo ? eok(lo) + ' 초과분 × ' : '') : '') + pct(b[1], 3);
      if (hi !== Infinity) acc += (hi - lo) * b[1];
      prev = hi;
      return '<tr' + (on ? ' class="fc-hl"' : '') + '><td>' + label + '</td><td>' + (fmt ? fmt(b, lo) : txt) + '</td></tr>';
    }).join('');
  }
  function fireMult(id) { return +($(id) ? $(id).value : 1) || 1; }

  /* ── 재산세 ── */
  function renderPT() {
    var kind = seg('ptx-kind') || 'house', urban = chk('ptx-urban'), flex = numOf('ptx-flex') / 100;
    show('ptx-house-box', kind === 'house'); show('ptx-bldg-box', kind === 'bldg'); show('ptx-land-box', kind === 'land');
    var r, lines = [], title = '', basis = 0, rateBr = null, rateBase = 0, schedule = '';
    if (kind === 'house') {
      var price = amt('ptx-price'), one = chk('ptx-one');
      r = PTX.house({ price: price, prev: amt('ptx-prev'), one: one, urban: urban, share: Math.min(100, numOf('ptx-share') || 100) / 100, flex: flex, bldg: amt('ptx-bldg'), fireMult: fireMult('ptx-fire') });
      basis = price * r.share;
      lines = [
        ['주택 공시가격', won(price)],
        ['공정시장가액비율 <small>(' + (one ? '1세대1주택 특례 — 공시가격 ' + (price <= 3e8 ? '3억 이하' : price <= 6e8 ? '3억 초과 6억 이하' : '6억 초과') : '일반 주택') + ')</small>', pct(r.ratio, 0)],
        ['과세표준 산정액 <small>(공시가격 × ' + pct(r.ratio, 0) + ')</small>', won(Math.floor(r.raw))],
        r.capped ? ['과세표준 상한 적용 <small>(전년 공시가격 × ' + pct(r.ratio, 0) + ' + 올해 산정액 × 5%)</small>', won(r.base), 'fc-hl'] : (amt('ptx-prev') > 0 ? ['과세표준 상한 <small>(전년 대비 상승폭이 작아 해당 없음)</small>', '—'] : null),
        ['<b>과세표준</b>', won(r.base), 'fc-total'],
        ['세율 <small>(' + (r.special ? '1세대1주택 특례세율 0.05~0.35% — 공시가격 9억 이하' : '표준세율 0.1~0.4%' + (one && price > 9e8 ? ' — 9억 초과라 특례세율 제외' : '')) + (flex ? ' · 탄력세율 ' + (flex > 0 ? '+' : '') + pct(flex, 0) : '') + ')</small>', ''],
        r.share < 1 ? ['지분 <small>(세액 × 지분율)</small>', pct(r.share, 2)] : null,
        ['<b>재산세</b>', won(r.tax), 'fc-total'],
        ['재산세 도시지역분 <small>(과세표준 × 0.14%' + (urban ? '' : ' · 도시지역 밖이라 없음') + ')</small>', won(r.urban)],
        ['지방교육세 <small>(재산세 × 20%)</small>', won(r.edu)],
        ['지역자원시설세 (소방분) <small>' + (r.fireBase > 0 ? '(건물분 시가표준액 × ' + pct(r.ratio, 0) + ' = ' + won(Math.floor(r.fireBase)) + ' 기준)' : '(건물분 시가표준액을 넣으면 계산)') + '</small>', won(r.fire)],
        ['<b>합계</b>', won(r.total), 'fc-hl']
      ];
      if (one && price <= 9e8 && !r.special && flex) lines.splice(6, 0, ['※ 탄력세율 세액이 특례세율보다 적어 탄력세율 적용 (지방세법 §111의2③)', '']);
      /* 납기: 주택은 7월·9월 각 1/2 — 재산세(본세+도시지역분) 20만원 이하면 조례에 따라 7월 한 번에 */
      var half = r.prop <= 2e5;
      var jul = half ? r.total : PTX.fl10(r.total / 2), sep = r.total - jul;
      schedule = half ? '7월에 한 번에 ' + won(r.total) + ' (재산세 20만원 이하 — 대부분 지자체 조례)' : '7월 ' + won(jul) + ' · 9월 ' + won(sep);
      rateBr = r.special ? PTX.HOUSE_ONE : PTX.HOUSE; rateBase = r.base;
      title = '주택';
    } else if (kind === 'bldg') {
      var v = amt('ptx-bvalue');
      r = PTX.building({ value: v, kind: $('ptx-bkind').value, urban: urban, flex: flex, prevTax: amt('ptx-bprev'), prevUrban: amt('ptx-bprevu'), fireMult: fireMult('ptx-bfire') });
      basis = v;
      var bk = $('ptx-bkind'); var bkTxt = bk.options[bk.selectedIndex].text;
      lines = [
        ['건축물 시가표준액', won(v)],
        ['<b>과세표준</b> <small>(× 공정시장가액비율 70%)</small>', won(r.base), 'fc-total'],
        ['세율 <small>(' + bkTxt + (flex ? ' · 탄력세율 ' + (flex > 0 ? '+' : '') + pct(flex, 0) : '') + ')</small>', ''],
        ['<b>재산세</b>' + (r.capT ? ' <small>(세부담상한 — 전년 × 150%)</small>' : ''), won(r.tax), 'fc-total'],
        ['재산세 도시지역분 <small>(과세표준 × 0.14%' + (urban ? '' : ' · 도시지역 밖') + (r.capU ? ' · 세부담상한' : '') + ')</small>', won(r.urban)],
        ['지방교육세 <small>(재산세 × 20%)</small>', won(r.edu)],
        ['지역자원시설세 (소방분) <small>(과세표준 기준 0.04~0.12%' + (fireMult('ptx-bfire') > 1 ? ' × ' + fireMult('ptx-bfire') + '배' : '') + ')</small>', won(r.fire)],
        ['<b>합계</b>', won(r.total), 'fc-hl']
      ];
      schedule = '7월 16일 ~ 31일 한 번에 ' + won(r.total);
      title = '건축물';
    } else {
      var lv = amt('ptx-lvalue'), lk = $('ptx-lkind').value, split = lk.indexOf('split-') === 0;
      r = PTX.land({ value: lv, kind: split ? 'split' : lk, split: split ? lk.slice(6) : null, urban: urban, flex: flex, prevTax: amt('ptx-lprev'), prevUrban: amt('ptx-lprevu') });
      basis = lv;
      var lkEl = $('ptx-lkind'); var lkTxt = lkEl.options[lkEl.selectedIndex].text;
      lines = [
        ['토지 공시지가 합계', won(lv)],
        ['<b>과세표준</b> <small>(× 공정시장가액비율 70%)</small>', won(r.base), 'fc-total'],
        ['세율 <small>(' + lkTxt + (flex ? ' · 탄력세율 ' + (flex > 0 ? '+' : '') + pct(flex, 0) : '') + ')</small>', ''],
        ['<b>재산세</b>' + (r.capT ? ' <small>(세부담상한 — 전년 × 150%)</small>' : ''), won(r.tax), 'fc-total'],
        ['재산세 도시지역분 <small>(과세표준 × 0.14%' + (urban ? '' : ' · 도시지역 밖') + (r.capU ? ' · 세부담상한' : '') + ')</small>', won(r.urban)],
        ['지방교육세 <small>(재산세 × 20%)</small>', won(r.edu)],
        ['<b>합계</b>', won(r.total), 'fc-hl']
      ];
      schedule = '9월 16일 ~ 30일 한 번에 ' + won(r.total);
      rateBr = lk === 'agg' ? PTX.LAND_AGG : lk === 'sep' ? PTX.LAND_SEP : null; rateBase = r.base;
      title = '토지';
    }
    var perDue = kind === 'house' && r.prop > 2e5 ? PTX.fl10(r.prop / 2) : r.prop, inst = PTX.installment(perDue);   /* 납기별 재산세(도시지역분 포함) 250만원 초과 */
    if (inst) lines.push(['분할납부 가능 금액 <small>(' + (kind === 'house' ? '7월·9월 납기마다 ' : '') + '재산세 ' + won(perDue) + ' 중 · 납부기한 후 3개월 안)</small>', won(inst)]);
    setH('ptx-table', rows(lines));
    setT('ptx-label', title + ' 재산세 합계 (1년)');
    setT('ptx-pay', won(r.total));
    setT('ptx-sub', schedule);
    setT('ptx-k1', won(r.base)); setT('ptx-k2', won(r.tax)); setT('ptx-k3', basis > 0 ? pct(r.total / basis, 3) : '—');
    $('ptx-rate-card').style.display = rateBr ? '' : 'none';
    if (rateBr) { setT('ptx-rate-title', kind === 'house' ? (rateBr === PTX.HOUSE_ONE ? '주택 재산세 1세대1주택 특례세율 (공시가격 9억 이하)' : '주택 재산세 표준세율') : (rateBr === PTX.LAND_AGG ? '토지 종합합산 세율' : '토지 별도합산 세율')); setH('ptx-rates', brRows(rateBr, rateBase)); }
  }

  /* ── 종합부동산세 ── */
  var lastCount = 'one';
  function renderJB() {
    var owner = $('jbx-owner').value, count = seg('jbx-count') || 'one';
    if (owner !== 'person' && count === 'one') count = 'two';
    var one = owner === 'person' && count === 'one';
    show('jbx-one-btn', owner === 'person'); show('jbx-one-box', one);
    document.querySelectorAll('.jbx-excl-col').forEach(function (e) { e.style.display = one ? '' : 'none'; });
    if (owner !== 'person' && seg('jbx-count') === 'one') {   /* 법인은 1세대1주택 없음 → 2주택 이하로 */
      document.querySelectorAll('.fc-seg[data-name="jbx-count"] .mode-btn').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-v') === 'two'); });
    }
    if (count !== lastCount) {   /* 주택 수 구분을 바꾸면 재산세 1세대1주택 특례 체크 기본값도 맞춤 (직접 바꿀 수 있음) */
      for (var j = 1; j <= 5; j++) { var cb = $('jbx-h' + j + '-one'); if (cb) cb.checked = one && j === 1; }
      lastCount = count;
    }
    var houses = [];
    for (var i = 1; i <= 5; i++) {
      houses.push({ price: amt('jbx-h' + i + '-p'), prev: amt('jbx-h' + i + '-v'), share: Math.min(100, numOf('jbx-h' + i + '-s') || 100) / 100,
        propOne: chk('jbx-h' + i + '-one'), excl: one && chk('jbx-h' + i + '-ex') });
    }
    var o = { owner: owner, count: count, age: numOf('jbx-age'), years: numOf('jbx-years'), houses: houses, flex: numOf('jbx-flex') / 100,
      land: { agg: { value: amt('jbx-agg'), prev: amt('jbx-agg-prev') }, sep: { value: amt('jbx-sep'), prev: amt('jbx-sep-prev') } } };
    var r = JBX.calc(o), H = r.house;
    var lines = [];
    if (H.rows.length) {
      lines = lines.concat([
        ['<b>주택분</b>', '', 'fc-total'],
        ['공시가격 합계' + (H.rows.some(function (x) { return x.share < 1; }) ? ' <small>(지분 반영)</small>' : ''), won(H.value)],
        ['공제금액 <small>(' + (owner === 'corp' ? '법인 — 공제 없음' : one ? '1세대1주택자 12억' : '9억') + ')</small>', '−' + won(Math.min(H.value, H.ded))],
        ['<b>과세표준</b> <small>(× 공정시장가액비율 60%)</small>', won(H.base), 'fc-total'],
        ['종합부동산세액 <small>(' + (owner === 'corp' ? (H.heavy ? '법인 3주택 이상 5%' : '법인 2.7%') : H.heavy ? '3주택 이상 세율 — 과세표준 12억 초과분 2~5%' : '2주택 이하 세율 0.5~2.7%') + ')</small>', won(Math.floor(H.gross))],
        ['재산세 공제 <small>(주택분 재산세 ' + won(H.propTax) + ' × [과세표준 × 재산세 비율 ' + pct(H.propRatio, 2) + ' × 0.4% ÷ 표준세율 재산세 ' + won(Math.round(H.propStd)) + '])</small>', '−' + won(H.propDed)],
        ['<b>산출세액</b>', won(Math.floor(H.calc)), 'fc-total']
      ]);
      if (one) {
        lines.push(['1세대1주택 세액공제 <small>(고령자 ' + pct(H.ageRate, 0) + ' + 장기보유 ' + pct(H.holdRate, 0) + ', 한도 80%' + (H.creditBase < H.calc - 0.5 ? ' · 주택 수 제외 주택분 ' + won(Math.round(H.calc - H.creditBase)) + '은 공제 제외' : '') + ')</small>', '−' + won(H.credit)]);
      }
      if (H.capped) lines.push(['세부담상한 <small>(올해 재산세 ' + won(H.propTax) + ' + 종부세가 전년 상당액 ' + won(Math.round(H.prevTotal)) + '의 150%를 넘는 부분)</small>', '−' + won(H.tax - H.final), 'fc-hl']);
      else if (H.prevTotal != null) lines.push(['세부담상한 <small>(전년 상당액 ' + won(Math.round(H.prevTotal)) + ' × 150% = ' + won(Math.round(H.limit)) + ' — 넘지 않음)</small>', '해당 없음']);
      else if (H.capUnknown) lines.push(['세부담상한 <small>(모든 주택의 전년 공시가격을 넣으면 계산)</small>', '—']);
      lines.push(['<b>주택분 종합부동산세</b>', won(H.final), 'fc-total']);
    }
    var LK = { agg: '종합합산 토지 (나대지·잡종지 등 · 공제 5억 · 1~3%)', sep: '별도합산 토지 (상가·사무실 부속토지 등 · 공제 80억 · 0.5~0.7%)' };
    ['agg', 'sep'].forEach(function (k) {
      var T = r.land[k]; if (!T) return;
      lines = lines.concat([
        ['<b>토지분 — ' + LK[k] + '</b>', '', 'fc-total'],
        ['과세표준 <small>(공시지가 ' + won(T.value) + ' − ' + eok(T.ded) + ', 비율 100%)</small>', won(T.base)],
        ['종합부동산세액', won(Math.floor(T.gross))],
        ['재산세 공제 <small>(토지분 재산세 ' + won(T.propTax) + ' 중 과세표준 해당분)</small>', '−' + won(T.propDed)],
        T.capped ? ['세부담상한 <small>(전년 상당액 ' + won(Math.round(T.prevTotal)) + ' × 150%)</small>', '−' + won(T.tax - T.final), 'fc-hl'] : null,
        ['<b>토지분 종합부동산세</b>', won(T.final), 'fc-total']
      ]);
    });
    lines = lines.concat([
      ['<b>종합부동산세</b>', won(r.jb), 'fc-hl'],
      ['농어촌특별세 <small>(종부세 × 20%)</small>', won(r.rural)],
      ['<b>납부할 세액 합계</b>', won(r.total), 'fc-hl'],
      r.inst ? ['분납 가능 금액 <small>(종부세 ' + won(r.inst) + ' + 농특세 ' + won(r.ruralInst) + ' · 납부기한 후 6개월 안)</small>', won(r.inst + r.ruralInst)] : null,
      r.inst ? ['12월 15일까지 낼 금액', won(r.total - r.inst - r.ruralInst)] : null
    ]);
    setH('jbx-table', rows(lines));
    setT('jbx-pay', won(r.total));
    var anyBase = (H.base || 0) + (r.land.agg ? r.land.agg.base : 0) + (r.land.sep ? r.land.sep.base : 0);
    setT('jbx-sub', r.total > 0 ? '종합부동산세 ' + won(r.jb) + ' + 농어촌특별세 ' + won(r.rural) + ' · 12월 1~15일 납부' : anyBase > 0 ? '재산세 공제·세액공제로 낼 세금이 없습니다' : H.value > 0 ? '공시가격 합계가 공제금액(' + eok(H.ded) + ') 이하라 종합부동산세 대상이 아닙니다' : '주택 공시가격을 넣어 주세요');
    setT('jbx-k1', won(H.base || 0)); setT('jbx-k2', won(r.jb)); setT('jbx-k3', H.value > 0 ? pct(r.total / (H.value + (r.land.agg ? r.land.agg.value : 0) + (r.land.sep ? r.land.sep.value : 0)), 3) : '—');
    setT('jbx-rate-title', owner === 'corp' ? '법인 세율 — 2주택 이하 2.7% · 3주택 이상 5% (단일)' : H.heavy ? '주택분 세율 — 3주택 이상 (과세표준 12억 이하는 2주택 이하와 같음)' : '주택분 세율 — 2주택 이하');
    setH('jbx-rates', owner === 'corp' ? '<tr class="fc-hl"><td>과세표준 전체</td><td>' + (H.heavy ? '5%' : '2.7%') + '</td></tr>' : brRows(H.heavy ? JBX.H3 : JBX.H2, H.base));
    var notes = [];
    if (owner === 'person' && count === 'one' && H.rows.filter(function (x) { return !x.h.excl; }).length > 1) notes.push('1세대1주택자는 주택 수에서 빼는 주택(일시적 2주택·상속주택·지방 저가주택 등)을 빼면 1채여야 합니다. 나머지 주택에 "주택 수 제외"를 체크하세요.');
    setH('jbx-notes', notes.map(function (t) { return '<p class="fc-note" style="margin:8px 0 0;">※ ' + t + '</p>'; }).join(''));
  }
  if (PT) window.fcRegister('ptx', renderPT, 'proptax');
  if (JB) window.fcRegister('jbx', renderJB, 'jongbu');
})();

/* ════════════════════════════════════════
   [SHARE] 공유 — 오른쪽 아래 공유 버튼 하나로: 공개 설정 · 링크 복사 · 카카오톡 공유 · 카드 이미지 저장 · 다른 앱으로 공유
   · 결과 링크: 화면 입력값 가운데 기본값과 달라진 것만 주소 ?s= 에 담음 → 받은 사람이 열면 같은 계산이 그대로 보임
   · 카카오톡: 결과 카드(세로 1080×1350)를 카카오 서버에 올려 피드 메시지 이미지로 — [결과 보기][나도 해보기] 버튼
     (자바스크립트 키는 Worker /auth/config 의 kakao_js · 없으면 휴대폰 공유창 / 링크 복사로 대신)
   · 카드 내용: 계산기가 직접 넘겨 주는 카드가 있으면 그것을, 없으면 화면의 큰 결과·요약 칸을 읽어 만듦
   window.shareCard.open({
     key: 'salary-rank',            // 주소(경로) — 공유 링크 https://d-capitalism.com/<key>/ · 파일 이름
     chip: '연봉 순위', title: '국내 나의 연봉 순위', label: '전체 근로소득자 기준',
     big: '상위 12.3%', sub: '근로소득자 2,085만 명 중 약 256만 번째',
     gauge: 87.7,                   // 0(하위)~100(상위) 막대 위 내 위치 · 없으면 생략
     rows: [['내 연봉', '5,000만원', true], …],   // [이름, 값, 숨김 가능(금액)] 최대 4줄
     bigSecret, subSecret,          // 금액 비공개일 때 큰 숫자·설명도 가릴지
     source: '국세청 근로소득 천분위 자료 2024년 귀속'
   })
   window.dcState — 화면 입력값 저장·복원 (내 저장함과 같이 씀)
════════════════════════════════════════ */
(function () {
  var SITE = 'https://d-capitalism.com/', W = 1080, H = 1350, FONT = '"Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
  function font(w, s) { return w + ' ' + s + 'px ' + FONT; }
  function fit(ctx, text, maxW, size, weight, min) {          /* 너비에 맞게 글자 크기 줄이기 */
    var s = size; ctx.font = font(weight, s);
    while (s > (min || 12) && ctx.measureText(text).width > maxW) { s -= 2; ctx.font = font(weight, s); }
    return s;
  }
  function wrap(ctx, text, maxW, maxLines) {                  /* 한글은 글자 단위로, 공백 우선 줄바꿈 */
    var words = String(text).split(' '), lines = [], cur = '';
    words.forEach(function (w) {
      var t = cur ? cur + ' ' + w : w;
      if (ctx.measureText(t).width <= maxW) { cur = t; return; }
      if (cur) lines.push(cur);
      cur = w;
      while (ctx.measureText(cur).width > maxW) {             /* 한 단어가 너무 길면 글자 단위로 자름 */
        var i = cur.length; while (i > 1 && ctx.measureText(cur.slice(0, i)).width > maxW) i--;
        lines.push(cur.slice(0, i)); cur = cur.slice(i);
      }
    });
    if (cur) lines.push(cur);
    if (lines.length > maxLines) { lines = lines.slice(0, maxLines); var l = lines[maxLines - 1]; while (l.length > 1 && ctx.measureText(l + '…').width > maxW) l = l.slice(0, -1); lines[maxLines - 1] = l + '…'; }
    return lines;
  }
  function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function mark(ctx, x, y, n) {                               /* 로고: 파란 둥근 사각형 + 흰 계단 (assets/favicon.svg) */
    var k = n / 30;
    ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
    ctx.fillStyle = '#3182f6'; rr(ctx, 0, 0, 30, 30, 8); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.3; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(7.5, 22); ctx.lineTo(12, 22); ctx.lineTo(12, 17.5); ctx.lineTo(16.5, 17.5); ctx.lineTo(16.5, 13); ctx.lineTo(21, 13); ctx.lineTo(21, 8.5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(17.8, 8.5); ctx.lineTo(21, 8.5); ctx.lineTo(21, 11.7); ctx.stroke();
    ctx.restore();
  }
  function draw(o, hide) {
    var c = document.createElement('canvas'); c.width = W; c.height = H;
    var ctx = c.getContext('2d'), X = 84, CW = W - X * 2;
    var BIG = hide && o.bigSecret ? '금액 비공개' : o.big, SUB = hide && o.subSecret ? '' : o.sub;
    /* 배경 */
    var g = ctx.createLinearGradient(0, 0, W * 0.5, H); g.addColorStop(0, '#141925'); g.addColorStop(1, '#0b0d12');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    var rg = ctx.createRadialGradient(W, 0, 0, W, 0, 900); rg.addColorStop(0, 'rgba(49,130,246,0.26)'); rg.addColorStop(1, 'rgba(49,130,246,0)');
    ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
    /* 오른쪽 위로 올라가는 계단 (노동자 → 자본가) — 글자·숫자 상자와 겹치지 않는 머리 오른쪽에 은은하게 */
    var sg = ctx.createLinearGradient(700, 380, W, 150); sg.addColorStop(0, 'rgba(49,130,246,0.03)'); sg.addColorStop(1, 'rgba(49,130,246,0.32)');
    ctx.strokeStyle = sg; ctx.lineWidth = 22; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(740, 372); ctx.lineTo(830, 372); ctx.lineTo(830, 304); ctx.lineTo(920, 304); ctx.lineTo(920, 236); ctx.lineTo(1010, 236); ctx.lineTo(1010, 168); ctx.lineTo(1100, 168); ctx.stroke();
    /* 머리: 로고 · 사이트 이름 · 분류 칩 */
    mark(ctx, X, 76, 68);
    ctx.fillStyle = '#e8eaee'; ctx.font = font(700, 38); ctx.textBaseline = 'middle'; ctx.fillText('디코딩 자본주의', X + 88, 111);
    var bw = ctx.measureText('디코딩 자본주의').width;
    if (o.chip) {
      ctx.font = font(500, 28); var cw = ctx.measureText(o.chip).width + 44, cx = X + 88 + bw + 24;
      if (cx + cw > W - X) cx = W - X - cw;
      rr(ctx, cx, 88, cw, 46, 23); ctx.fillStyle = 'rgba(49,130,246,0.16)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(49,130,246,0.55)'; ctx.stroke();
      ctx.fillStyle = '#9cc2ff'; ctx.fillText(o.chip, cx + 22, 112);
    }
    ctx.textBaseline = 'alphabetic';
    /* 제목 · 기준 */
    var y = 290;
    fit(ctx, o.title, CW, 54, 700, 30); ctx.fillStyle = '#f2f3f5'; ctx.fillText(o.title, X, y);
    if (o.label) { y += 56; fit(ctx, o.label, CW, 32, 400, 16); ctx.fillStyle = '#8b919d'; ctx.fillText(o.label, X, y); }
    /* 큰 결과 */
    y += 190;
    var bs = fit(ctx, BIG, CW, 168, 700, 60);
    var bg = ctx.createLinearGradient(X, y - bs, X + ctx.measureText(BIG).width, y); bg.addColorStop(0, '#5aa0ff'); bg.addColorStop(1, '#2f7bf5');
    ctx.fillStyle = hide && o.bigSecret ? '#6f7582' : bg; ctx.fillText(BIG, X - 4, y);
    /* 설명 */
    if (SUB) {
      ctx.font = font(500, 36); ctx.fillStyle = '#c9cdd4';
      wrap(ctx, SUB, CW, 2).forEach(function (l, i) { y += i ? 52 : 74; ctx.fillText(l, X, y); });
    }
    /* 위치 막대 (하위 ← → 상위) */
    if (o.gauge != null && isFinite(o.gauge)) {
      y += 64;
      var gx = X, gw = CW, gh = 20, pos = Math.max(0, Math.min(100, o.gauge));
      rr(ctx, gx, y, gw, gh, gh / 2); ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fill();
      var fg = ctx.createLinearGradient(gx, 0, gx + gw, 0); fg.addColorStop(0, 'rgba(49,130,246,0.25)'); fg.addColorStop(1, '#3182f6');
      rr(ctx, gx, y, Math.max(gh, gw * pos / 100), gh, gh / 2); ctx.fillStyle = fg; ctx.fill();
      var mx = gx + gw * pos / 100;
      ctx.beginPath(); ctx.arc(Math.max(gx + 16, Math.min(gx + gw - 16, mx)), y + gh / 2, 22, 0, Math.PI * 2); ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.lineWidth = 7; ctx.strokeStyle = '#3182f6'; ctx.stroke();
      y += gh + 48; ctx.font = font(500, 26); ctx.fillStyle = '#7d8390';
      var gl = o.gaugeLabels || ['하위', '중위', '상위'];
      ctx.textAlign = 'left'; ctx.fillText(gl[0], gx, y); ctx.textAlign = 'center'; ctx.fillText(gl[1], gx + gw / 2, y); ctx.textAlign = 'right'; ctx.fillText(gl[2], gx + gw, y); ctx.textAlign = 'left';
    }
    /* 숫자 상자 */
    var rows = (o.rows || []).filter(function (r) { return r && r[1] != null && r[1] !== ''; }).slice(0, 4);
    if (rows.length) {
      var rh = 76, top = o.gauge != null && isFinite(o.gauge) ? Math.max(y + 46, 900 - (rows.length - 3) * 40) : y + 90, bh = rows.length * rh + 28;   /* 위치 막대가 없으면 설명 바로 아래로 */
      if (top + bh > H - 170) top = H - 170 - bh;
      rr(ctx, X, top, CW, bh, 26); ctx.fillStyle = 'rgba(255,255,255,0.045)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.stroke();
      rows.forEach(function (r, i) {
        var ry = top + 14 + i * rh + rh / 2 + 12;
        if (i) { ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fillRect(X + 32, top + 14 + i * rh, CW - 64, 2); }
        ctx.font = font(400, 32); ctx.fillStyle = '#a5abb6'; ctx.textAlign = 'left';
        var lw = Math.min(ctx.measureText(r[0]).width, CW * 0.5); ctx.fillText(r[0], X + 36, ry, CW * 0.5);
        var v = hide && r[2] ? '비공개' : String(r[1]);
        ctx.textAlign = 'right'; fit(ctx, v, CW - 72 - lw - 30, 38, 700, 22); ctx.fillStyle = hide && r[2] ? '#6f7582' : '#f2f3f5'; ctx.fillText(v, W - X - 36, ry);
        ctx.textAlign = 'left';
      });
    }
    /* 바닥: 나도 해보기 · 주소 · 출처 */
    var fy = H - 104;
    ctx.font = font(700, 34); ctx.fillStyle = '#ffffff';
    rr(ctx, X, fy - 48, ctx.measureText('나도 계산해 보기 →').width + 52, 70, 35); ctx.fillStyle = '#3182f6'; ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.fillText('나도 계산해 보기 →', X + 26, fy);
    ctx.font = font(500, 30); ctx.fillStyle = '#c3c7cf'; ctx.textAlign = 'right';
    fit(ctx, 'd-capitalism.com/' + o.key, CW * 0.48, 30, 500, 20); ctx.fillText('d-capitalism.com/' + o.key, W - X, fy - 4);
    ctx.textAlign = 'left';
    if (o.source) { fit(ctx, '자료: ' + o.source, CW, 24, 400, 16); ctx.fillStyle = '#6a707c'; ctx.fillText('자료: ' + o.source, X, H - 40); }
    return c;
  }
  /* 카드에 쓸 글자의 한글 글꼴 조각까지 받아 둔 뒤 그림 (구글 한글 글꼴은 글자 범위별로 나뉨) */
  function fontsReady(o) {
    var txt = [o.chip, o.title, o.label, o.big, o.sub, o.source, (o.gaugeLabels || []).join(' '), '디코딩 자본주의 나도 계산해 보기 → 하위 중위 상위 자료: 비공개 금액 d-capitalism.com/' + o.key]
      .concat((o.rows || []).map(function (r) { return r ? r[0] + ' ' + r[1] : ''; })).join(' ');
    return document.fonts && document.fonts.load ? Promise.all([700, 500, 400].map(function (w) { return document.fonts.load(font(w, 40), txt); })).catch(function () {}) : Promise.resolve();
  }
  function blobOf(c) { return new Promise(function (res) { c.toBlob(function (b) { res(b); }, 'image/png'); }); }

  /* ════════ 화면 입력값: 기본값을 기억해 두고, 달라진 것만 담기 · 되돌리기 (공유 링크 · 내 저장함) ════════ */
  var State = (function () {
    function page() { return document.querySelector('.app-page.active') || document.querySelector('.app-page'); }
    function skip(e) { var t = e.type; return t === 'search' || t === 'file' || t === 'password' || t === 'hidden' || t === 'button' || t === 'submit' || !!(e.closest && e.closest('.site-search, [data-share-skip]')); }
    function q(s) { return window.CSS && CSS.escape ? CSS.escape(s) : String(s).replace(/["\\]/g, '\\$&'); }
    function norm(v) { return String(v == null ? '' : v).replace(/,/g, '').trim(); }
    /* 버튼 묶음(.mode-btn 의 부모): 이름은 data-name, 없으면 화면 안 순서 */
    function groups(pg) {
      var seen = [];
      pg.querySelectorAll('.mode-btn').forEach(function (b) { var g = b.parentElement; if (g && seen.indexOf(g) < 0) seen.push(g); });
      return seen.map(function (g, i) {
        return { g: g, k: g.getAttribute('data-name') || '#' + i, btns: Array.prototype.filter.call(g.children, function (c) { return c.classList && c.classList.contains('mode-btn'); }) };
      });
    }
    function act(btns) { for (var i = 0; i < btns.length; i++) if (btns[i].classList.contains('active')) return i; return -1; }
    function defVal(e) {
      if (e.tagName === 'SELECT') { for (var i = 0; i < e.options.length; i++) if (e.options[i].defaultSelected) return e.options[i].value; return e.options.length ? e.options[0].value : ''; }
      return e.defaultValue;
    }
    function capture() {
      document.querySelectorAll('[data-unit]').forEach(function (e) { if (e.__u0 === undefined) e.__u0 = e.getAttribute('data-unit'); });
      document.querySelectorAll('.app-page').forEach(function (pg) { groups(pg).forEach(function (x) { if (x.g.__a0 === undefined) x.g.__a0 = act(x.btns); }); });
    }
    function snapshot(diff) {
      var pg = page(), d = { v: {}, g: {}, u: {} };
      if (!pg) return d;
      pg.querySelectorAll('input[id], select[id], textarea[id]').forEach(function (e) {
        if (skip(e)) return;
        var u = e.getAttribute('data-unit'), uch = !!u && (!diff || u !== e.__u0);
        if (uch) d.u[e.id] = u;
        if (e.type === 'checkbox' || e.type === 'radio') { if (!diff || e.checked !== e.defaultChecked) d.v[e.id] = e.checked ? 1 : 0; }
        else if (!diff || uch || norm(e.value) !== norm(defVal(e))) d.v[e.id] = e.value;   /* 단위를 바꿨으면 값도 함께 (단위만 바뀌면 뜻이 달라짐) */
      });
      groups(pg).forEach(function (x) { var a = act(x.btns); if (a >= 0 && (!diff || a !== x.g.__a0)) d.g[x.k] = a; });
      return d;
    }
    function restore(d) {
      var pg = page(); if (!pg || !d) return;
      /* 버튼 묶음 먼저 (보이는 입력칸·단위가 달라질 수 있음) — 사용자가 누른 것처럼 click */
      if (d.s) pg.querySelectorAll('.fc-seg[data-name]').forEach(function (s) {        /* 예전 저장 형식: 이름 → data-v */
        var want = d.s[s.getAttribute('data-name')]; if (want == null) return;
        s.querySelectorAll('.mode-btn').forEach(function (b) { if (b.getAttribute('data-v') === String(want) && !b.classList.contains('active')) b.click(); });
      });
      if (d.g) {
        var gs = groups(pg);
        Object.keys(d.g).forEach(function (k) {
          var x = null; gs.forEach(function (y) { if (y.k === k) x = y; });
          var b = x && x.btns[+d.g[k]];
          if (b && !b.classList.contains('active') && !b.disabled) b.click();
        });
      }
      Object.keys(d.v || {}).forEach(function (id) {
        var e = document.getElementById(id);
        if (!e || !pg.contains(e) || !/^(INPUT|SELECT|TEXTAREA)$/.test(e.tagName) || skip(e)) return;
        if (d.u && typeof d.u[id] === 'string' && e.getAttribute('data-unit') !== d.u[id]) {
          e.setAttribute('data-unit', d.u[id]);
          document.querySelectorAll('.unit-btn[data-fc-unit="' + q(id) + '"]').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-unit') === d.u[id]); });
        }
        var val = d.v[id];
        if (e.type === 'checkbox' || e.type === 'radio') { if (e.checked !== !!+val) { e.checked = !!+val; e.dispatchEvent(new Event('change', { bubbles: true })); } return; }
        val = String(val);
        if (e.value === val) return;
        if (e.tagName === 'SELECT' && !Array.prototype.some.call(e.options, function (o) { return o.value === val; })) return;   /* 선택지가 아직 없으면(자료 불러오는 중) 다음 번에 */
        e.value = val;
        e.dispatchEvent(new Event('input', { bubbles: true }));
        if (e.tagName === 'SELECT' || e.type === 'range' || e.type === 'date' || e.type === 'month') e.dispatchEvent(new Event('change', { bubbles: true }));
      });
      if (window.fcRender) { try { window.fcRender(); } catch (er) {} }
    }
    /* 자료를 불러온 뒤에야 생기는 선택지까지 맞추려고 몇 번 되풀이 */
    function apply(d, done) { var n = 0; (function again() { restore(d); if (++n < 4) setTimeout(again, n * 900); else if (done) done(); })(); }
    function enc(d) {
      var o = {};
      ['v', 'g', 'u'].forEach(function (k) { if (d && d[k] && Object.keys(d[k]).length) o[k] = d[k]; });
      if (!Object.keys(o).length) return '';
      var bytes = new TextEncoder().encode(JSON.stringify(o)), bin = '';
      for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }
    function dec(t) {
      try {
        if (!t || t.length > 12000) return null;
        var b = t.replace(/-/g, '+').replace(/_/g, '/'); while (b.length % 4) b += '=';
        var bin = atob(b), bytes = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        var o = JSON.parse(new TextDecoder().decode(bytes)), r = {};
        if (!o || typeof o !== 'object') return null;
        ['v', 'g', 'u'].forEach(function (k) {
          if (!o[k] || typeof o[k] !== 'object' || Array.isArray(o[k])) return;
          r[k] = {};
          Object.keys(o[k]).slice(0, 500).forEach(function (x) { var y = o[k][x]; if (typeof y === 'string') r[k][x] = y.slice(0, 300); else if (typeof y === 'number' && isFinite(y)) r[k][x] = y; });
        });
        return r;
      } catch (e) { return null; }
    }
    function count(d) { return d ? ['v', 'g', 'u'].reduce(function (n, k) { return n + (d[k] ? Object.keys(d[k]).length : 0); }, 0) : 0; }
    return { page: page, snapshot: snapshot, restore: restore, apply: apply, enc: enc, dec: dec, capture: capture, count: count };
  })();
  window.dcState = State;

  /* ════════ 카드 내용: 계산기가 넘겨 준 것 → 없으면 화면의 큰 결과·요약 칸을 읽어서 ════════ */
  var REG = []; try { REG = JSON.parse((document.getElementById('etfmd-routes') || {}).textContent || '[]'); } catch (e) {}
  var GROUP = { money: '돈', stock: '주식·ETF', realty: '부동산', passive: '패시브인컴' };
  var SIM = ['s-port', 's-annual', 's-final', 's-total', 's-cagr'];
  var IDS = {                                                     /* 큰 결과 칸이 없는 계산기: 첫 번째가 큰 숫자, 나머지는 숫자 칸 */
    simulator: SIM, sol: SIM.map(function (x) { return 'sol-' + x; }), tiger: SIM.map(function (x) { return 'tiger-' + x; }),
    tigerdiv: SIM.map(function (x) { return 'tigerdiv-' + x; }), tigersemi: SIM.map(function (x) { return 'tigersemi-' + x; }),
    divcalc: SIM.map(function (x) { return 'divcalc-' + x; }),
    loan: ['loan-s-monthly', 'loan-s-interest', 'loan-s-total'], compound: ['cpd-s-final', 'cpd-s-profit', 'cpd-s-cagr'],
    cagr: ['cagr-result', 'cagr-monthly-rate', 'cagr-daily-rate'],
    health: ['h-w-total', 'h-w-employer', 'h-w-annual', 'h-l-total', 'h-l-annual']
  };
  function pageKey() { var m = location.pathname.match(/^\/([a-z0-9\-]+)\/?$/); return m ? m[1] : ''; }
  function route(k) { for (var i = 0; i < REG.length; i++) if (REG[i].path === k) return REG[i]; return null; }
  function txt(e) { return e ? String(e.textContent || '').replace(/\s+/g, ' ').trim() : ''; }
  function vis(e) { return !!e && e.offsetParent !== null; }
  function empty(v) { return !v || /^[—–\-\s·.]*$/.test(v) || /NaN|Infinity|undefined/.test(v); }
  function money(v) { return /[0-9].*(원|억|만)/.test(String(v || '')); }
  function labelOf(e) {
    var c = e.closest('.sum-cell'); if (c && c.querySelector('.sum-cell-label')) return txt(c.querySelector('.sum-cell-label'));
    var p = e.previousElementSibling; return p ? txt(p).slice(0, 40) : '';
  }
  function subOf(e) { var n = e.nextElementSibling; return n && /-sub$/.test(n.id || '') ? txt(n) : ''; }
  function generic() {
    var pg = State.page(), key = pageKey(), r = route(key);
    if (!pg || !key || !r) return null;
    var o = null, hv = pg.querySelector('.fc-hero-val');
    if (vis(hv) && !empty(txt(hv))) {
      var box = hv.parentElement, hl = box.querySelector('.fc-hero-label'), hs = box.querySelector('.fc-hero-sub');
      o = { big: txt(hv), label: txt(hl), sub: txt(hs), rows: [] };
      box.querySelectorAll('.fc-kpis > div').forEach(function (d) { var p = d.querySelector('p'), b = d.querySelector('b'); if (p && vis(b) && !empty(txt(b))) o.rows.push([txt(p), txt(b)]); });
    } else {
      var pid = (pg.id || '').replace(/^page-/, ''), els = (IDS[pid] || []).map(function (id) { return document.getElementById(id); })
        .filter(function (e) { return vis(e) && pg.contains(e) && !empty(txt(e)); });
      if (!els.length) { var ix = pg.querySelector('.idx-rate-num'); if (vis(ix) && !empty(txt(ix))) els = [ix]; }
      if (!els.length) return null;
      o = { big: txt(els[0]), label: labelOf(els[0]), sub: subOf(els[0]), rows: els.slice(1).map(function (e) { return [labelOf(e), txt(e)]; }) };
    }
    if (empty(o.sub)) o.sub = '';
    var h1 = pg.querySelector('h1');
    o.key = key; o.title = txt(h1) || r.title; o.chip = GROUP[r.group] || '계산 결과';
    o.bigSecret = money(o.big); o.subSecret = money(o.sub);
    o.rows = o.rows.filter(function (x) { return x[0] && !empty(x[1]); }).slice(0, 4).map(function (x) { return [x[0], x[1], money(x[1])]; });
    return o;
  }

  /* ════════ 공유 창 (오른쪽 아래 버튼) ════════ */
  var KSDK = 'https://t1.kakaocdn.net/kakao_js_sdk/2.8.3/kakao.min.js', KSRI = 'sha384-oroumrnFVE0xtgqyDZJARgERibXg2C28380uaUZz2kHDS5CR7tu20eGiOU6GkTpy';
  var OPT_KEY = 'dc_share_opt', IOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var st = { el: null, fab: null, spec: null, override: null, openedAt: 0, lastFocus: null, ogBlob: {},
             kimg: {}, kup: {}, pblob: {}, prevUrl: null, sdkP: null, opt: { inp: true, amt: true } };
  try { var so = JSON.parse(localStorage.getItem(OPT_KEY) || 'null'); if (so) { st.opt.inp = so.inp !== false; st.opt.amt = so.amt !== false; } } catch (e) {}
  var ICON = {
    share: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="18" cy="5" r="2.6" stroke="currentColor" stroke-width="1.9"/><circle cx="6" cy="12" r="2.6" stroke="currentColor" stroke-width="1.9"/><circle cx="18" cy="19" r="2.6" stroke="currentColor" stroke-width="1.9"/><path d="M8.3 10.8l7.4-4.4M8.3 13.2l7.4 4.4" stroke="currentColor" stroke-width="1.9"/></svg>',
    x: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
    link: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    kakao: '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path fill="#191919" d="M12 3C6.48 3 2 6.48 2 10.77c0 2.77 1.85 5.2 4.64 6.57-.2.74-.74 2.7-.85 3.12-.13.52.19.51.4.37.17-.11 2.66-1.8 3.74-2.53.67.1 1.36.15 2.07.15 5.52 0 10-3.48 10-7.68C22 6.48 17.52 3 12 3z"/></svg>',
    card: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3" stroke="currentColor" stroke-width="2"/><circle cx="9" cy="10" r="1.8" fill="currentColor"/><path d="M4 18l5-5 4 4 3-3 4 4" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
    more: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3v12M7.5 7.5L12 3l4.5 4.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'
  };
  function toast(t) {
    var el = document.getElementById('dca-toast');
    if (!el) { el = document.createElement('div'); el.id = 'dca-toast'; el.className = 'dca-toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
    el.textContent = t; el.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(function () { el.classList.remove('on'); }, 2800);
  }
  function copy(text, done) {
    function legacy() {
      var t = document.createElement('textarea'); t.value = text; t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.opacity = '0';
      document.body.appendChild(t); t.select(); var ok = false; try { ok = document.execCommand('copy'); } catch (e) {} t.remove();
      if (ok) done(); else window.prompt('아래 주소를 복사해 주세요', text);
    }
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, legacy); else legacy();
  }
  function links() {
    var key = pageKey(), base = SITE + (key ? key + '/' : ''), s = '';
    if (st.opt.inp && key) s = State.enc(State.snapshot(true));
    return { clean: base, result: s ? base + '?s=' + s : base, has: !!s };
  }
  function sig() { return JSON.stringify([st.spec, !st.opt.amt]); }
  function cfg() { return window.dcConfig ? window.dcConfig().catch(function () { return {}; }) : Promise.resolve({}); }
  function sdk() {
    if (st.sdkP) return st.sdkP;
    st.sdkP = cfg().then(function (j) {
      var key = j && j.kakao_js; if (!key) return null;
      return new Promise(function (res) {
        if (window.Kakao) return res(window.Kakao);
        var s = document.createElement('script'); s.src = KSDK; s.integrity = KSRI; s.crossOrigin = 'anonymous';
        s.onload = function () { res(window.Kakao || null); }; s.onerror = function () { res(null); };
        document.head.appendChild(s);
      }).then(function (K) { if (!K) return null; try { if (!K.isInitialized()) K.init(key); } catch (e) { return null; } return K; });
    }).catch(function () { return null; });
    st.sdkP.then(function (K) { if (!K) st.sdkP = null; });          /* 실패하면 다음에 다시 시도 */
    return st.sdkP;
  }
  /* 창을 열 때 미리: 미리보기 · 저장용 카드 · 카카오 서버에 카드 올리기 (누르는 순간 바로 보내야 팝업이 막히지 않음) */
  function prepare() {
    var o = st.spec, k = sig(), hide = !st.opt.amt, img = st.el.querySelector('.dsh-prev');
    if (!o) {                                                        /* 결과 카드가 없는 화면: 공유창에 붙일 대표 이미지를 미리 받아 둠 */
      img.removeAttribute('src');
      var key = pageKey() || 'home';
      if (!st.ogBlob[key]) fetch('/assets/og/' + (route(pageKey()) ? key : 'home') + '.png').then(function (r) { return r.ok ? r.blob() : null; }).then(function (b) { if (b) st.ogBlob[key] = b; }).catch(function () {});
      return;
    }
    fontsReady(o).then(function () {
      if (sig() !== k) return;
      blobOf(draw(o, hide)).then(function (b) {                      /* 세로 카드 하나로: 미리보기 · 저장 · 카카오 메시지 이미지 · 공유창 첨부 */
        if (sig() !== k || !b) return;
        st.pblob[k] = b;
        if (st.prevUrl) URL.revokeObjectURL(st.prevUrl);
        st.prevUrl = URL.createObjectURL(b); img.src = st.prevUrl;
        if (!st.kimg[k] && !st.kup[k]) {
          st.kup[k] = 1;
          sdk().then(function (K) {
            if (!K) return;
            return K.Share.uploadImage({ file: [new File([b], 'd-capitalism-card.png', { type: 'image/png' })] }).then(function (r) {
              var u = r && r.infos && r.infos.original && r.infos.original.url; if (u) st.kimg[k] = u;
            });
          }).catch(function () {}).then(function () { delete st.kup[k]; });
        }
      });
    });
  }
  function ogImg(key) { return SITE + 'assets/og/' + (key && route(key) ? key : 'home') + '.png'; }
  function cut(t, n) { t = String(t || '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1) + '…' : t; }
  function message() {
    var o = st.spec, key = pageKey(), r = route(key) || {}, hide = !st.opt.amt, title, desc;
    if (o) {
      var big = hide && o.bigSecret ? '' : o.big;
      title = o.title + (big ? ' · ' + big : '');
      desc = [o.label, hide && o.subSecret ? '' : o.sub].filter(Boolean).join(' — ');
    } else {
      title = r.share || r.title || document.title;
      var md = document.querySelector('meta[name="description"]'); desc = r.desc || (md && md.content) || '';
    }
    return { title: cut(title, 90), desc: cut(desc || '공식 통계·실제 시세로 계산하는 자본주의 계산기', 140) };
  }
  function kakao() {
    var L = links(), m = message(), key = pageKey();
    var K = window.Kakao;
    if (K && K.isInitialized && K.isInitialized() && K.Share) {
      var btns = [{ title: '나도 해보기', link: { mobileWebUrl: L.clean, webUrl: L.clean } }];
      if (L.has || (st.opt.inp && st.spec)) btns.unshift({ title: '결과 보기', link: { mobileWebUrl: L.result, webUrl: L.result } });   /* 기본값 그대로여도 결과가 있으면 [결과 보기] */
      var img = st.spec && st.kimg[sig()];
      try {
        K.Share.sendDefault({ objectType: 'feed',
          content: { title: m.title, description: m.desc, imageUrl: img || ogImg(key), imageWidth: img ? W : 1200, imageHeight: img ? H : 630, link: { mobileWebUrl: L.result, webUrl: L.result } },
          buttons: btns });
        return;
      } catch (e) {}
    }
    /* 카카오 공유를 쓸 수 없을 때: 휴대폰은 공유창(카카오톡 선택), 컴퓨터는 링크 복사 */
    if (navigator.share && (IOS || /Android/i.test(navigator.userAgent))) more();
    else copy(L.result, function () { toast('링크를 복사했어요. 카카오톡 대화창에 붙여 넣어 주세요'); });
  }
  function saveCard() {
    var o = st.spec; if (!o) return;
    var b = st.pblob[sig()], name = 'd-capitalism-' + o.key + '.png';
    if (!b) { toast('카드를 만드는 중이에요. 잠시 뒤 다시 눌러 주세요'); prepare(); return; }
    var f = new File([b], name, { type: 'image/png' });
    if (IOS && navigator.canShare && navigator.canShare({ files: [f] })) {        /* 아이폰: 공유창의 '이미지 저장' → 사진 앱 */
      navigator.share({ files: [f] }).catch(function () {}); return;
    }
    var u = URL.createObjectURL(b), a = document.createElement('a');
    a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(u); }, 5000);
    toast('카드 이미지를 저장했어요');
  }
  /* 휴대폰·PC 공유창: 결과 카드(없으면 대표 이미지)를 글·링크와 함께 보냄 */
  function cardFile() {
    var key = pageKey() || 'home', b = st.spec ? st.pblob[sig()] : st.ogBlob[key];
    return b ? new File([b], 'd-capitalism-' + (st.spec ? st.spec.key : key) + '.png', { type: 'image/png' }) : null;
  }
  function more() {
    if (!navigator.share) return copy(links().result, function () { toast('링크를 복사했어요'); });
    var L = links(), m = message(), f = cardFile();
    var withImg = f && navigator.canShare && navigator.canShare({ files: [f] });
    var data = withImg ? { files: [f], title: m.title, text: m.title + '\n' + L.result } : { title: m.title, text: m.title, url: L.result };
    navigator.share(data).catch(function (e) {
      if (withImg && e && e.name !== 'AbortError') navigator.share({ title: m.title, text: m.title, url: L.result }).catch(function () {});   /* 이미지를 못 받는 곳이면 링크만 */
    });
    if (!f) prepare();
  }
  function currentSpec() {
    var key = pageKey(), pg = State.page();
    if (!key || !pg) return null;
    var reg = window.dcShareSpec || {};                       /* 계산기가 직접 만들어 둔 카드 (순위·성적표 등) — 결과가 없으면 null */
    if (Object.prototype.hasOwnProperty.call(reg, key)) return reg[key] && reg[key].big ? reg[key] : null;
    if (st.override && st.override.key === key) return st.override;
    return generic();
  }
  function sync() {
    var el = st.el, o = st.spec, hasInp = !!pageKey() && State.count(State.snapshot(false)) > 0;   /* 입력칸이 있는 화면이면 항상 (안 바꿨으면 링크는 그냥 주소) */
    var amtOn = !!o && (o.bigSecret || o.subSecret || (o.rows || []).some(function (r) { return r && r[2]; }));
    el.querySelector('[data-o="inp"]').hidden = !hasInp;
    el.querySelector('[data-o="amt"]').hidden = !amtOn;
    el.querySelector('.dsh-opts').hidden = !hasInp && !amtOn;
    el.querySelector('[data-o="inp"] input').checked = st.opt.inp;
    el.querySelector('[data-o="amt"] input').checked = st.opt.amt;
    el.querySelector('.dsh-prev-wrap').hidden = !o;
    el.querySelector('[data-a="card"]').hidden = !o;
    el.querySelector('[data-a="more"]').hidden = !navigator.share;
  }
  function openPanel(spec) {
    if (!st.el) build();
    st.spec = spec || currentSpec();
    st.lastFocus = document.activeElement;
    sync(); prepare(); sdk();                                          /* 카드가 없는 화면도 카카오 공유는 쓰므로 SDK 는 항상 미리 */
    st.el.hidden = false; st.scrim.hidden = false; st.openedAt = Date.now();
    st.fab.classList.add('on'); st.fab.setAttribute('aria-expanded', 'true'); st.fab.setAttribute('aria-label', '공유 닫기'); st.fab.innerHTML = ICON.x;
    var f = st.el.querySelector('[data-a="copy"]'); if (f) f.focus({ preventScroll: true });
  }
  function closePanel(back) {
    if (!st.el || st.el.hidden) return;
    st.el.hidden = true; st.scrim.hidden = true;
    st.fab.classList.remove('on'); st.fab.setAttribute('aria-expanded', 'false'); st.fab.setAttribute('aria-label', '공유하기'); st.fab.innerHTML = ICON.share;
    if (back && st.lastFocus && st.lastFocus.focus) st.lastFocus.focus({ preventScroll: true });
  }
  function build() {
    var fab = document.createElement('button');
    fab.type = 'button'; fab.className = 'dsh-fab'; fab.setAttribute('aria-label', '공유하기'); fab.setAttribute('aria-expanded', 'false'); fab.setAttribute('aria-controls', 'dsh-pop'); fab.innerHTML = ICON.share;
    var el = document.createElement('div');
    el.id = 'dsh-pop'; el.className = 'dsh-pop'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', '공유하기'); el.hidden = true;
    el.innerHTML =
      '<div class="dsh-card dsh-prev-wrap"><img class="dsh-prev" alt="공유되는 결과 카드 미리보기"></div>' +
      '<div class="dsh-card dsh-opts"><p class="dsh-h">공유 시 공개 설정</p>' +
        '<label class="dsh-opt" data-o="inp"><span>내 입력값 공개<small>링크를 연 사람에게 내 계산이 그대로 보여요</small></span><input type="checkbox"></label>' +
        '<label class="dsh-opt" data-o="amt"><span>금액 공개<small>끄면 카드에 금액 대신 ‘비공개’로 표시해요</small></span><input type="checkbox"></label></div>' +
      '<button type="button" class="dsh-b" data-a="copy">' + ICON.link + '<span>링크 복사</span></button>' +
      '<button type="button" class="dsh-b dsh-kakao" data-a="kakao">' + ICON.kakao + '<span>카카오톡 공유</span></button>' +
      '<button type="button" class="dsh-b" data-a="card">' + ICON.card + '<span>카드 이미지 저장</span></button>' +
      '<button type="button" class="dsh-b" data-a="more">' + ICON.more + '<span>다른 앱으로 공유</span></button>';
    var scrim = document.createElement('div'); scrim.className = 'dsh-scrim'; scrim.hidden = true;   /* 뒤 화면을 어둡게 (누르면 닫힘) */
    document.body.appendChild(scrim); document.body.appendChild(el); document.body.appendChild(fab);
    st.el = el; st.fab = fab; st.scrim = scrim;
    fab.addEventListener('click', function () { if (el.hidden) openPanel(); else closePanel(true); });
    el.addEventListener('change', function (e) {
      var o = e.target.closest('[data-o]'); if (!o) return;
      st.opt[o.getAttribute('data-o')] = e.target.checked;
      try { localStorage.setItem(OPT_KEY, JSON.stringify(st.opt)); } catch (er) {}
      prepare();
    });
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-a]'); if (!b) return;
      var a = b.getAttribute('data-a');
      if (a === 'copy') copy(links().result, function () { toast(links().has ? '내 계산이 담긴 링크를 복사했어요' : '링크를 복사했어요'); });
      else if (a === 'kakao') kakao();
      else if (a === 'card') saveCard();
      else if (a === 'more') more();
    });
    document.addEventListener('click', function (e) {
      if (el.hidden || Date.now() - st.openedAt < 80) return;
      var path = e.composedPath ? e.composedPath() : [];                 /* 버튼 아이콘을 바꾸면 눌린 요소가 문서에서 빠지므로 경로로 판단 */
      if (path.indexOf(el) >= 0 || path.indexOf(fab) >= 0 || el.contains(e.target) || fab.contains(e.target)) return;
      closePanel(false);
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !el.hidden) closePanel(true); });
    window.addEventListener('popstate', function () { closePanel(false); st.override = null; });
  }
  /* 계산기 안의 개별 공유 버튼(아파트 순위표의 단지별 '순위 공유')이 부르는 입구 */
  function open(o) {
    if (!o || !o.big) return;
    st.override = o;
    openPanel(o);
  }
  /* 공유받은 링크(?s=)로 들어왔을 때: 입력값을 되살리고 안내 */
  function arrive() {
    var m = location.search.match(/[?&]s=([A-Za-z0-9_\-]+)/); if (!m) return;
    var d = State.dec(m[1]);
    try { history.replaceState(history.state, '', location.pathname + location.search.replace(/([?&])s=[^&]*&?/, '$1').replace(/[?&]$/, '') + location.hash); } catch (e) {}
    if (!d || !State.count(d)) return;
    State.apply(d);
    var pg = State.page(), host = pg && (pg.querySelector('.header-left') || pg);
    if (!host || document.getElementById('dsh-notice')) return;
    var n = document.createElement('div'); n.id = 'dsh-notice'; n.className = 'dsh-notice'; n.setAttribute('role', 'status');
    n.innerHTML = '<span>공유받은 계산 결과예요. 값을 바꿔 직접 계산해 보세요.</span><a href="' + location.pathname + '">처음 값으로</a><button type="button" aria-label="안내 닫기">✕</button>';
    n.querySelector('button').addEventListener('click', function () { n.remove(); });
    host.appendChild(n);
  }
  window.shareCard = { open: open, draw: draw, spec: function () { return currentSpec(); } };
  if (typeof SITE_EN !== 'undefined' && SITE_EN) return;                 /* 영어 페이지는 공유 버튼 없음 */
  State.capture();
  function init() {
    State.capture();
    if (!document.querySelector('.app-page')) return;
    build();
    arrive();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();

/* ════════════════════════════════════════
   [WHATIF] 그때 샀더라면 계산기 — data/whatif.json (Actions '그때 샀더라면 자료 갱신': 매일)
   · 월봉 종가 c / 배당 재투자 반영 a(국내: 네이버 수정주가 × 야후 배당 비율, 미국: 야후 수정종가)
   · 달러 자산은 그 달 원달러 환율로 원화 환산 (원화로 사서 원화로 평가) — 끄면 달러 기준
   · 한 번에: 시작 달 종가에 전액 매수 → 지금 종가로 평가
     매달 적립: 시작 달부터 이번 달까지 매달 종가에 같은 금액 매수 (소수점 단위 매수 가정)
   · 연평균 수익률: 한 번에 = (지금 가치 ÷ 원금)^(12 ÷ 개월 수) − 1 · 적립 = 납입 시점을 반영한 연환산 내부수익률(IRR)
   · 아파트: 서울·강남 3구 아파트 매매 실거래 중위가격(연도별) — 한 채의 가격이 같은 비율로 움직였다고 가정
════════════════════════════════════════ */
var WIF = (function () {
  function mi(s) { s = String(s); return +s.slice(0, 4) * 12 + (s.length > 4 ? +s.slice(5, 7) - 1 : 0); }
  function txt(n) { return Math.floor(n / 12) + '.' + String(n % 12 + 1).padStart(2, '0'); }
  /* 자산의 월별 원화(또는 달러) 가격 함수 */
  function priceFn(as, fx, o) {
    var arr = o.div && as.a ? as.a : as.c, s = mi(as.start), yearly = !!as.yearly;
    var fs = mi(fx.start), conv = as.cur === 'USD' && o.krw;
    var end = yearly ? Math.floor(s / 12) * 12 + (arr.length - 1) * 12 + 11 : s + arr.length - 1;
    return {
      start: yearly ? s : (conv ? Math.max(s, fs) : s), end: yearly ? end : (conv ? Math.min(end, fs + fx.v.length - 1) : end), yearly: yearly,
      at: function (k) {
        var p = yearly ? arr[Math.floor(k / 12) - Math.floor(s / 12)] : arr[k - s];
        if (p == null) return null;
        if (conv) { var f = fx.v[Math.min(fx.v.length - 1, k - fs)]; if (f == null) return null; p *= f; }
        return p;
      }
    };
  }
  function irr(flows, final) {   /* flows: 월별 납입액(0..n−1, 월초) · final: n개월 뒤 가치 → 월 수익률 */
    var n = flows.length;
    function fv(i) { var g = 1 + i, v = 0; for (var k = 0; k < n; k++) v += flows[k] * Math.pow(g, n - k); return v; }
    var lo = -0.99, hi = 2;
    if (fv(lo) > final || fv(hi) < final) return null;
    for (var it = 0; it < 200; it++) { var mid = (lo + hi) / 2; if (fv(mid) < final) lo = mid; else hi = mid; }
    return (lo + hi) / 2;
  }
  /* o: {start: 월 번호, amount, mode:'lump'|'dca', div, krw} */
  function calc(as, fx, o) {
    var P = priceFn(as, fx, o), r = { P: P, as: as };
    var s = Math.max(o.start, P.start), e = P.end;
    if (P.yearly) s = Math.max(Math.floor(o.start / 12) * 12, Math.floor(P.start / 12) * 12);
    r.clamped = s !== o.start && !(P.yearly && Math.floor(s / 12) === Math.floor(o.start / 12));
    r.s = s; r.e = e;
    if (s > e) { r.err = 'range'; return r; }
    var units = 0, inv = 0, pts = [], peak = 0, mdd = 0, flows = [], p0 = P.at(s);
    var step = P.yearly ? 12 : 1;
    for (var k = s; k <= e; k += step) {
      var p = P.at(k); if (!(p > 0)) continue;
      if (o.mode === 'dca' && !P.yearly) { units += o.amount / p; inv += o.amount; flows.push(o.amount); }
      else if (k === s) { units = o.amount / p; inv = o.amount; }
      var v = units * p; pts.push([k, v, inv]);
      if (p > peak) peak = p; else if (peak > 0) mdd = Math.min(mdd, p / peak - 1);
    }
    if (!pts.length) { r.err = 'range'; return r; }
    var last = pts[pts.length - 1];
    r.pts = pts; r.value = last[1]; r.inv = last[2]; r.profit = r.value - r.inv; r.ret = r.inv > 0 ? r.value / r.inv - 1 : 0;
    r.months = P.yearly ? (Math.floor(e / 12) - Math.floor(s / 12)) * 12 : e - s;
    if (o.mode === 'dca' && !P.yearly) { var m = irr(flows, r.value * (1 + 0)); r.cagr = m == null ? null : Math.pow(1 + m, 12) - 1; }
    else r.cagr = r.months >= 1 ? Math.pow(r.value / r.inv, 12 / r.months) - 1 : null;
    r.mdd = mdd; r.p0 = p0; r.p1 = P.at(e); r.priceX = r.p1 / p0;
    return r;
  }
  return { calc: calc, mi: mi, txt: txt, priceFn: priceFn, irr: irr };
})();

/* [WHATIF] 화면 — 입력(data-fc="wif")은 [FC-UI] 공통 처리 */
(function () {
  if (!document.getElementById('page-whatif')) return;
  function $(id) { return document.getElementById(id); }
  function setT(id, v) { var e = $(id); if (e) e.textContent = v; }
  function setH(id, v) { var e = $(id); if (e) e.innerHTML = v; }
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function numOf(id) { var e = $(id); return e ? (parseFloat(String(e.value).replace(/,/g, '')) || 0) : 0; }
  var UNIT = { eok: 1e8, man: 1e4, won: 1 };
  function amt(id) { var e = $(id); return Math.round(numOf(id) * (UNIT[e && e.getAttribute('data-unit')] || 1)); }
  function seg(name) { var b = document.querySelector('.fc-seg[data-name="' + name + '"] .mode-btn.active'); return b ? b.getAttribute('data-v') : null; }
  function won(n) { return (n < 0 ? '−' : '') + Math.round(Math.abs(n)).toLocaleString('ko-KR') + '원'; }
  function eok(n) {
    var neg = n < 0; n = Math.abs(n);
    if (n >= 1e12) { var j = Math.floor(n / 1e12), e2 = Math.round((n - j * 1e12) / 1e8); return (neg ? '−' : '') + j.toLocaleString('ko-KR') + '조' + (e2 ? ' ' + e2.toLocaleString('ko-KR') + '억원' : '원'); }
    n = Math.round(n / 1e4) * 1e4;
    var e = Math.floor(n / 1e8), m = Math.round((n - e * 1e8) / 1e4), s;
    if (!e) s = m.toLocaleString('ko-KR') + '만원'; else s = e.toLocaleString('ko-KR') + '억' + (m ? ' ' + m.toLocaleString('ko-KR') + '만원' : '원');
    return (neg ? '−' : '') + s;
  }
  function pctS(v, d) { if (v == null || !isFinite(v)) return '—'; var a = Math.abs(v * 100); var t = a >= 1000 ? Math.round(a).toLocaleString('ko-KR') : a.toFixed(d == null ? 1 : d); return (v < 0 ? '−' : '+') + t + '%'; }
  var GROUPS = [['kr', '국내 주식'], ['idx', '지수·ETF'], ['us', '미국 주식'], ['coin', '코인'], ['etc', '금·은·달러'], ['apt', '아파트']];
  var D = null, A = {}, loading = false, chart = null, share = null;
  var now = new Date(Date.now() + 9 * 3600e3), NOWM = now.getUTCFullYear() * 12 + now.getUTCMonth();
  function ymTxt(k, yearly) { return yearly ? Math.floor(k / 12) + '년' : Math.floor(k / 12) + '년 ' + (k % 12 + 1) + '월'; }
  function fill() {
    var sel = $('wif-asset');
    sel.innerHTML = GROUPS.map(function (g) {
      var xs = D.assets.filter(function (a) { return a.g === g[0]; });
      return xs.length ? '<optgroup label="' + g[1] + '">' + xs.map(function (a) { return '<option value="' + esc(a.id) + '"' + (a.id === '005930.KS' ? ' selected' : '') + '>' + esc(a.name) + ' (' + (a.yearly ? a.start : a.start.slice(0, 4)) + '년~)</option>'; }).join('') + '</optgroup>' : '';
    }).join('');
    setStart(NOWM - 120);
  }
  /* '산 때' 선택 범위 = 고른 자산의 자료가 있는 기간 (달러 자산을 원화로 볼 때는 환율 자료 시작 이후, 아파트는 연 단위) */
  function cur() { return A[$('wif-asset').value] || D.assets[0]; }
  function range(as) {
    var P = WIF.priceFn(as, D.fx, { div: true, krw: $('wif-krw').checked });
    if (as.yearly) return [Math.floor(P.start / 12) * 12, Math.floor(NOWM / 12) * 12 + NOWM % 12];
    return [P.start, Math.min(NOWM, P.end)];
  }
  var want = null;   /* 사용자가 고른(또는 빠른 버튼) 시점 — 범위 밖이면 범위 안으로 맞춰 보여 주되, 자산을 바꾸면 다시 이 시점 기준으로 맞춤 */
  function syncDate() {
    var as = cur(), rg = range(as), lo = rg[0], hi = rg[1];
    var k = Math.max(lo, Math.min(hi, want == null ? NOWM - 120 : want));
    var y = Math.floor(k / 12), ylo = Math.floor(lo / 12), yhi = Math.floor(hi / 12), ys = '';
    for (var yy = yhi; yy >= ylo; yy--) ys += '<option value="' + yy + '">' + yy + '년</option>';
    var ysel = $('wif-y'); if (ysel.getAttribute('data-r') !== ylo + '-' + yhi) { ysel.innerHTML = ys; ysel.setAttribute('data-r', ylo + '-' + yhi); }
    ysel.value = String(y);
    var m0 = y === ylo ? lo % 12 : 0, m1 = y === yhi ? hi % 12 : 11, ms = '';
    for (var m = m0; m <= m1; m++) ms += '<option value="' + (m + 1) + '">' + (m + 1) + '월</option>';
    var msel = $('wif-m'); if (msel.getAttribute('data-r') !== m0 + '-' + m1) { msel.innerHTML = ms; msel.setAttribute('data-r', m0 + '-' + m1); }
    msel.value = String(k % 12 + 1);
    /* 자료 시작 전 시점의 빠른 버튼은 누를 수 없게 */
    document.querySelectorAll('.wif-pre').forEach(function (b) {
      var t = b.getAttribute('data-ago') ? NOWM - 12 * (+b.getAttribute('data-ago')) : WIF.mi(b.getAttribute('data-ym'));
      var off = (as.yearly ? Math.floor(t / 12) * 12 : t) < lo;
      b.disabled = off; b.title = off ? as.name + ' 자료는 ' + (as.yearly ? Math.floor(lo / 12) + '년' : Math.floor(lo / 12) + '년 ' + (lo % 12 + 1) + '월') + '부터 있습니다' : '';
    });
    return k;
  }
  function setStart(k) { want = k; syncDate(); }
  function opts() {
    return { start: (+$('wif-y').value) * 12 + (+$('wif-m').value) - 1, mode: seg('wif-mode') || 'lump',
      amount: (seg('wif-mode') || 'lump') === 'dca' ? amt('wif-mamt') : amt('wif-amt'), div: $('wif-div').checked, krw: $('wif-krw').checked };
  }
  function render() {
    if (!D) { load(); return; }
    syncDate();
    var as = cur(), o = opts();
    var dcaOk = !as.yearly;
    if (!dcaOk && o.mode === 'dca') o.mode = 'lump';
    $('wif-dca-btn').disabled = !dcaOk;
    $('wif-amt-f').style.display = o.mode === 'dca' ? 'none' : ''; $('wif-mamt-f').style.display = o.mode === 'dca' ? '' : 'none';
    $('wif-m-f').style.visibility = as.yearly ? 'hidden' : '';
    $('wif-div-f').style.display = as.a ? '' : 'none';
    $('wif-krw-f').style.display = as.cur === 'USD' ? '' : 'none';
    var r = WIF.calc(as, D.fx, o), notes = [];
    if (o.start > NOWM) r.err = 'future';
    if (r.err || !(o.amount > 0)) {
      setT('wif-label', '그때 샀더라면'); setT('wif-val', '—');
      setT('wif-sub', r.err === 'future' ? '미래 날짜는 계산할 수 없습니다.' : !(o.amount > 0) ? '투자 금액을 넣어 주세요.' : as.name + ' 자료가 없는 기간입니다.');
      ['wif-k1', 'wif-k2', 'wif-k3'].forEach(function (k) { setT(k, '—'); }); setH('wif-cmp', ''); share = null; (window.dcShareSpec = window.dcShareSpec || {})['what-if'] = null;
      if (chart) { chart.destroy(); chart = null; } return;
    }
    if (r.clamped) notes.push(as.name + ' 자료는 ' + ymTxt(r.P.start, as.yearly) + '부터 있어 그때부터 계산했습니다.');
    if (as.yearly) notes.push('아파트는 그 해 서울' + (as.id === 'APT-gangnam' ? ' 강남 3구(강남·서초·송파)' : '') + ' 아파트 매매 실거래 중위가격으로 계산합니다. 한 채의 값이 중위가격과 같은 비율로 움직였다고 가정하며, 대출·세금·관리비·전월세 수익은 넣지 않았습니다. 올해는 지금까지 거래 기준입니다.');
    if (as.cur === 'USD' && o.krw) notes.push('달러 자산은 그 달 원달러 환율로 원화로 바꿔 사고, 지금 환율로 원화 가치를 계산했습니다(환차익·환차손 포함).');
    if (as.a && o.div) notes.push('배당금은 받은 날 같은 종목을 다시 산다고 보고 계산했습니다(세금 제외)' + (as.g === 'kr' && r.s < 2000 * 12 + 1 ? ' — 2000년 이전 배당은 자료가 없어 빠져 있습니다.' : '.'));
    if (as.id === '^KS11' || as.id === '^KQ11') notes.push('지수 자체(배당 미포함)로 계산했습니다. 실제 지수 ETF는 보수·배당이 더해집니다.');
    var startTxt = ymTxt(r.s, as.yearly), mode = o.mode;
    setT('wif-label', startTxt + '에 ' + as.name + ' ' + (mode === 'dca' ? '매달 ' + eok(o.amount) + '씩' : eok(o.amount)) + ' 샀다면');
    setT('wif-val', eok(r.value));
    var endTxt = as.yearly ? Math.floor(r.e / 12) + '년' : (as.t ? as.t.replace(/-/g, '.') : ymTxt(r.e));
    setH('wif-sub', '원금 ' + eok(r.inv) + ' → <b style="color:' + (r.profit >= 0 ? 'var(--red, #f04452)' : 'var(--accent)') + ';">' + (r.profit >= 0 ? '+' : '−') + eok(Math.abs(r.profit)) + '</b> · ' + endTxt + ' 기준' + (as.cur === 'USD' && !o.krw ? ' (달러 기준을 원화 금액으로 표시)' : ''));
    setT('wif-k1', pctS(r.ret)); setT('wif-k2', r.cagr == null ? '—' : pctS(r.cagr, 2)); setT('wif-k3', (r.mdd * 100).toFixed(1) + '%');
    setH('wif-notes', notes.map(function (t) { return '<p class="fc-note" style="margin:8px 0 0;">※ ' + t + '</p>'; }).join(''));
    /* 같은 돈을 다른 곳에 넣었다면 */
    var rows = D.assets.map(function (x) {
      var oo = { start: o.start, amount: o.amount, mode: x.yearly ? 'lump' : mode, div: o.div, krw: true }, q = WIF.calc(x, D.fx, oo);
      if (q.err || q.clamped || (x.yearly && mode === 'dca')) return null;
      return { x: x, q: q };
    }).filter(Boolean).sort(function (a, b) { return b.q.value - a.q.value; });
    var inv = mode === 'dca' ? null : o.amount, cash = rows.length ? rows[0].q.inv : o.amount;
    setH('wif-cmp', rows.map(function (z, i) {
      var on = z.x.id === as.id;
      return '<tr' + (on ? ' class="fc-hl"' : '') + '><td>' + (i + 1) + '</td><td style="text-align:left;">' + esc(z.x.name) + '</td><td style="text-align:right;">' + eok(z.q.value) + '</td><td style="text-align:right;color:' + (z.q.ret >= 0 ? '#f04452' : '#3182f6') + ';">' + pctS(z.q.ret) + '</td><td style="text-align:right;">' + (z.q.cagr == null ? '—' : pctS(z.q.cagr, 1)) + '</td></tr>';
    }).join('') + '<tr><td>—</td><td style="text-align:left;">현금으로 그냥 들고 있었다면</td><td style="text-align:right;">' + eok(cash) + '</td><td style="text-align:right;">0%</td><td style="text-align:right;">0%</td></tr>');
    setT('wif-cmp-sub', ymTxt(o.start) + '부터 같은 돈을 ' + (mode === 'dca' ? '매달 ' + eok(o.amount) + '씩' : eok(o.amount)) + ' 넣었다면 · 원화 기준 · 자료가 그때부터 있는 ' + rows.length + '개');
    /* 그래프 */
    if (typeof Chart !== 'undefined') {
      var labels = r.pts.map(function (p) { return as.yearly ? String(Math.floor(p[0] / 12)) : txt2(p[0]); });
      var ds = [{ label: '평가 금액', data: r.pts.map(function (p) { return Math.round(p[1]); }), borderColor: '#3182f6', backgroundColor: 'rgba(49,130,246,0.12)', fill: true, pointRadius: 0, pointHoverRadius: 4, borderWidth: 2, tension: 0.15 },
                { label: '넣은 돈', data: r.pts.map(function (p) { return Math.round(p[2]); }), borderColor: '#fe9800', borderDash: [6, 4], fill: false, pointRadius: 0, borderWidth: 1.5 }];
      var opt = { responsive: true, maintainAspectRatio: false, animation: false, interaction: { mode: 'index', intersect: false },
        plugins: { legend: { display: false }, tooltip: { backgroundColor: '#202027', borderColor: fgA(0.1), borderWidth: 1, titleColor: '#9e9ea4', bodyColor: '#e4e4e5', padding: 12, callbacks: { label: function (c) { return ' ' + c.dataset.label + ': ' + eok(c.parsed.y); } } } },
        scales: { x: { ticks: { color: '#6d6d76', font: { size: 11 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 }, grid: { display: false }, border: { display: false } },
                  y: { ticks: { color: '#6d6d76', font: { size: 11 }, callback: function (v) { return fmt(v, true); } }, grid: { color: fgA(0.04) }, border: { display: false } } } };
      if (chart) { chart.data.labels = labels; chart.data.datasets = ds; chart.options = opt; chart.update('none'); }
      else chart = new Chart($('wif-chart'), { type: 'line', data: { labels: labels, datasets: ds }, options: opt });
    }
    /* 공유 카드 */
    var ks = A['^KS11'] && WIF.calc(A['^KS11'], D.fx, { start: r.s, amount: o.amount, mode: as.yearly ? 'lump' : mode, div: true, krw: true });
    var sp = A['SPY'] && WIF.calc(A['SPY'], D.fx, { start: r.s, amount: o.amount, mode: as.yearly ? 'lump' : mode, div: true, krw: true });
    var rank = rows.findIndex(function (z) { return z.x.id === as.id; });
    share = { key: 'what-if', chip: '그때 샀더라면', title: startTxt + ' ' + as.name + (mode === 'dca' ? ' 매달 ' + eok(o.amount) + '씩' : ' ' + eok(o.amount)),
      label: '샀다면 지금(' + endTxt + ') 얼마?', big: eok(r.value), sub: '수익률 ' + pctS(r.ret) + (r.cagr != null ? ' · 연평균 ' + pctS(r.cagr, 1) : ''),
      rows: [['넣은 돈', eok(r.inv)], ['수익', (r.profit >= 0 ? '+' : '−') + eok(Math.abs(r.profit))],
             ks && !ks.err && !ks.clamped && as.id !== '^KS11' ? ['같은 기간 코스피', pctS(ks.ret)] : null,
             sp && !sp.err && !sp.clamped && as.id !== 'SPY' ? ['같은 기간 S&P 500', pctS(sp.ret)] : (rank >= 0 ? ['비교 자산 ' + rows.length + '개 중', (rank + 1) + '위'] : null)],
      source: (as.yearly ? '국토교통부 실거래가 (연도별 중위가격)' : '네이버 금융·Yahoo Finance 월봉') + (as.a && o.div ? ' · 배당 재투자' : '') + (as.cur === 'USD' && o.krw ? ' · 원화 환산' : '') };
    (window.dcShareSpec = window.dcShareSpec || {})['what-if'] = share;   /* 오른쪽 아래 공유 창이 이 카드를 씀 */
  }
  function txt2(k) { return String(Math.floor(k / 12)).slice(2) + '.' + String(k % 12 + 1).padStart(2, '0'); }
  function load() {
    if (loading || !window.mdLoad) return; loading = true;
    window.mdLoad('whatif.json').then(function (d) {
      loading = false;
      if (!d || !d.assets) { setT('wif-sub', '자료를 불러오지 못했습니다. 잠시 뒤 다시 열어 주세요.'); return; }
      D = d; A = {}; d.assets.forEach(function (a) { A[a.id] = a; });
      fill();
      setH('wif-src', '자료: 네이버 금융·Yahoo Finance 월봉 · 원달러 환율(Yahoo·FRED) · 국토교통부 아파트 실거래가 — ' + d.updated.slice(0, 10) + ' 갱신');
      var pg = $('page-whatif'); if (pg && pg.classList.contains('active')) render();
    }).catch(function () { loading = false; setT('wif-sub', '자료를 불러오지 못했습니다.'); });
  }
  document.addEventListener('click', function (e) {
    if (!e.target.closest) return;
    var b = e.target.closest('.wif-pre');
    if (b && D) {
      var ago = b.getAttribute('data-ago'), ym = b.getAttribute('data-ym');
      setStart(ago ? NOWM - 12 * (+ago) : WIF.mi(ym));
      document.querySelectorAll('.wif-pre').forEach(function (x) { x.classList.toggle('on', x === b); });
      render(); return;
    }
  });
  function pick(e) {   /* 연·월을 직접 고르면 그 시점을 기억 — FC-UI 가 input·change 에서 다시 그리기 전에(캡처 단계) 먼저 반영 */
    if (!e.target || !D || (e.target.id !== 'wif-y' && e.target.id !== 'wif-m')) return;
    var y = +$('wif-y').value, m = +$('wif-m').value - 1;
    if (e.target.id === 'wif-y' && want != null) m = want % 12;   /* 연도만 바꾸면 고른 달 유지 (그 해에 없으면 가장 가까운 달) */
    want = y * 12 + m;
    document.querySelectorAll('.wif-pre').forEach(function (x) { x.classList.remove('on'); });
  }
  document.addEventListener('input', pick, true);
  document.addEventListener('change', pick, true);
  window.fcRegister('wif', render, 'whatif');
})();

/* ════════════════════════════════════════
   [HOUSE-YEARS] 내 연봉으로 집 사기까지 몇 년 — data/apt_area.json(지역별 단지 최근 실거래 중위값) · data/realty.json(서울 연도별 중위가)
   · 월 실수령 = 연봉 실수령액 계산기(FC.salary — 4대보험·근로소득세 간이세액표, 비과세 식대 월 20만원, 본인 1명) · 해마다 연봉 상승률만큼 올려 다시 계산
   · 매달 저축(실수령 × 저축률 또는 정액)을 모은 돈에 더하고, 모은 돈은 연 수익률로 불어남 (월 복리)
   · 필요한 돈 = 그때 집값 × (1 − 대출 비율) + 취득세(지방교육세·농특세 포함, 1주택·생애최초 감면 선택) + 중개보수(부가세 포함)
     그때 집값 = 지금 집값 × (1 + 집값 상승률)^(경과 개월 ÷ 12)
   · 모은 돈 ≥ 필요한 돈이 되는 첫 달 = 집을 살 수 있는 때 (100년 안에 안 되면 '어려움')
════════════════════════════════════════ */
var HYC = (function () {
  function cost(price, first) {
    var a = TAX.acquisition({ price: price, kind: 'buy', houses: 1, big: false, relief: first && price <= 12e8 ? 'first' : 'none' });
    var b = FC.brokerage({ kind: 'sale', prop: 'house', price: price });
    return { acq: a.total, broker: b.fee + b.vat, total: a.total + b.fee + b.vat };
  }
  function netMonthly(annual) { return annual > 0 ? FC.salary({ annual: annual, nontax: 2e5, family: 1, kids: 0, ratio: 100 }).net : 0; }
  /* o: {salary, mode:'rate'|'fixed', rate, fixed, saved, raise, ret, grow, price, ltv, costs, first} */
  function calc(o, maxYears) {
    var mr = Math.pow(1 + (o.ret || 0), 1 / 12) - 1, A = Math.max(0, o.saved || 0), y = -1, net = 0, save = 0, rows = [], M = (maxYears || 100) * 12;
    function need(m) {
      var p = o.price * Math.pow(1 + (o.grow || 0), m / 12);
      var c = o.costs ? cost(p, o.first) : { acq: 0, broker: 0, total: 0 };
      return { price: p, cash: p * (1 - (o.ltv || 0)), cost: c, total: p * (1 - (o.ltv || 0)) + c.total };
    }
    for (var m = 0; m <= M; m++) {
      if (Math.floor(m / 12) !== y) {
        y = Math.floor(m / 12);
        var sal = o.salary * Math.pow(1 + (o.raise || 0), y);
        net = netMonthly(sal);
        save = o.mode === 'fixed' ? o.fixed * Math.pow(1 + (o.raise || 0), y) : net * (o.rate || 0);
        rows.push({ y: y, salary: sal, net: net, save: save, start: A, need: need(m).total });
      }
      var N = need(m);
      if (A >= N.total - 0.5) return { m: m, A: A, need: N, rows: rows, first: rows[0] };
      A = A * (1 + mr) + Math.max(0, save);
      rows[rows.length - 1].end = A;
    }
    return { m: -1, A: A, rows: rows, first: rows[0], need: need(M) };
  }
  return { calc: calc, cost: cost, netMonthly: netMonthly };
})();

/* [HOUSE-YEARS] 화면 — 입력(data-fc="hy")은 [FC-UI] 공통 처리 */
(function () {
  if (!document.getElementById('page-houseyears')) return;
  function $(id) { return document.getElementById(id); }
  function setT(id, v) { var e = $(id); if (e) e.textContent = v; }
  function setH(id, v) { var e = $(id); if (e) e.innerHTML = v; }
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function numOf(id) { var e = $(id); return e ? (parseFloat(String(e.value).replace(/,/g, '')) || 0) : 0; }
  var UNIT = { eok: 1e8, man: 1e4, won: 1 };
  function amt(id) { var e = $(id); return Math.round(numOf(id) * (UNIT[e && e.getAttribute('data-unit')] || 1)); }
  function seg(name) { var b = document.querySelector('.fc-seg[data-name="' + name + '"] .mode-btn.active'); return b ? b.getAttribute('data-v') : null; }
  function won(n) { return (n < 0 ? '−' : '') + Math.round(Math.abs(n)).toLocaleString('ko-KR') + '원'; }
  function eok(n) {
    var neg = n < 0; n = Math.round(Math.abs(n) / 1e4) * 1e4;
    var e = Math.floor(n / 1e8), m = Math.round((n - e * 1e8) / 1e4), s;
    if (!e) s = m.toLocaleString('ko-KR') + '만원'; else s = e.toLocaleString('ko-KR') + '억' + (m ? ' ' + m.toLocaleString('ko-KR') + '만원' : '원');
    return (neg ? '−' : '') + s;
  }
  function ym(m) { var y = Math.floor(m / 12), r = m % 12; return y ? y + '년' + (r ? ' ' + r + '개월' : '') : r + '개월'; }
  var D = null, R = null, loading = false, chart = null, share = null;
  function regionPrice(key, size) {   /* key: 'all' | '시도' | '시도 시군구' → [가격(원), 설명] */
    var x = key === 'all' ? D.all : (D.sgg[key] || D.sido[key]);
    if (!x) return null;
    var py = (x.py || 0) * 1e4, v, how;
    if (size === '59' || size === '84') {
      var p = x['p' + size], n = x['n' + size];
      if (p) { v = p * 1e4; how = '전용 ' + size + '㎡형(' + (size === '59' ? '55~65' : '80~90') + '㎡) 거래 ' + n + '개 단지의 중위값'; }
      else { v = py * (+size / 3.3058); how = '전용 ' + size + '㎡형 거래가 적어 평당 중위가 × ' + (+size / 3.3058).toFixed(1) + '평'; }
    } else { v = x.med * 1e4; how = '단지 ' + x.n.toLocaleString('ko-KR') + '개의 최근 실거래가 중위값 (면적 무관)'; }
    return [v, how, x];
  }
  function fill() {
    var sel = $('hy-region'), h = '<option value="all">전국</option>';
    var sidos = Object.keys(D.sido);
    h += '<optgroup label="시·도">' + sidos.map(function (s) { return '<option value="' + esc(s) + '"' + (s === '서울' ? ' selected' : '') + '>' + esc(s) + '</option>'; }).join('') + '</optgroup>';
    sidos.forEach(function (s) {
      var gs = Object.keys(D.sgg).filter(function (k) { return k.indexOf(s + ' ') === 0; });
      if (gs.length) h += '<optgroup label="' + esc(s) + '">' + gs.map(function (k) { return '<option value="' + esc(k) + '">' + esc(k) + '</option>'; }).join('') + '</optgroup>';
    });
    sel.innerHTML = h;
  }
  function seoulCagr() {   /* 서울 아파트 실거래 중위가 최근 10년 연평균 상승률 (올해는 빼고 마지막 완결 연도까지) */
    if (!R || !R.years) return null;
    var ys = Object.keys(R.years).sort(), last = ys[ys.length - 2], first = String(+last - 10);
    if (!R.years[first]) return null;
    return [Math.pow(R.years[last].seoul.median / R.years[first].seoul.median, 1 / 10) - 1, first, last];
  }
  function opts() {
    var size = seg('hy-size') || '84', reg = $('hy-region').value, rp = size === 'custom' ? null : regionPrice(reg, size);
    return {
      salary: amt('hy-salary'), mode: seg('hy-save') || 'rate', rate: numOf('hy-rate') / 100, fixed: amt('hy-fixed'), saved: amt('hy-saved'),
      raise: numOf('hy-raise') / 100, ret: numOf('hy-ret') / 100, grow: numOf('hy-grow') / 100,
      price: size === 'custom' ? amt('hy-price') : (rp ? rp[0] : 0), how: rp ? rp[1] : '직접 넣은 집값', ltv: $('hy-loan').checked ? numOf('hy-ltv') / 100 : 0,
      costs: $('hy-costs').checked, first: $('hy-first').checked, size: size, reg: reg, age: numOf('hy-age')
    };
  }
  function render() {
    if (!D) { load(); return; }
    var o = opts();
    $('hy-rate-f').style.display = o.mode === 'rate' ? '' : 'none'; $('hy-fixed-f').style.display = o.mode === 'fixed' ? '' : 'none';
    $('hy-price-f').style.display = o.size === 'custom' ? '' : 'none'; $('hy-region-f').style.display = o.size === 'custom' ? 'none' : '';
    $('hy-ltv-f').style.display = $('hy-loan').checked ? '' : 'none';
    var net0 = HYC.netMonthly(o.salary);
    setT('hy-net', o.salary > 0 ? '월 실수령 약 ' + won(net0) + (o.mode === 'rate' ? ' → 매달 ' + won(net0 * o.rate) + ' 저축' : '') : '');
    var sc = seoulCagr(); if (sc) setT('hy-grow-hint', '참고: 서울 아파트 실거래 중위가 ' + sc[1] + '→' + sc[2] + '년 연평균 ' + (sc[0] * 100).toFixed(1) + '%');
    if (!(o.price > 0) || !(o.salary > 0)) {
      setT('hy-val', '—'); setT('hy-sub', !(o.salary > 0) ? '연봉을 넣어 주세요.' : '집값을 넣어 주세요.'); share = null; (window.dcShareSpec = window.dcShareSpec || {})['house-years'] = null; return;
    }
    var r = HYC.calc(o, 100), place = o.size === 'custom' ? '이 집' : (o.reg === 'all' ? '전국' : o.reg) + ' ' + (o.size === 'any' ? '아파트' : o.size + '㎡ 아파트');
    var pir = o.price / Math.max(1, net0 * 12), pirG = o.price / o.salary;
    setT('hy-label', '연봉 ' + eok(o.salary) + '으로 ' + place + ' 사기까지');
    if (r.m >= 0) {
      setT('hy-val', r.m === 0 ? '지금 바로 가능' : ym(r.m));
      setT('hy-sub', (r.m === 0 ? '모은 돈 ' + eok(o.saved) + '으로 필요한 돈 ' + eok(r.need.total) + '을 이미 넘습니다' : (o.age > 0 ? Math.floor(o.age + r.m / 12) + '세에 · ' : '') + '그때 집값 ' + eok(r.need.price) + ' · 필요한 돈 ' + eok(r.need.total)));
    } else {
      setT('hy-val', '100년 안에 어려움');
      setT('hy-sub', '집값이 오르는 속도가 저축이 늘어나는 속도보다 빨라 따라잡지 못합니다 — 저축률·수익률을 높이거나 대출·지역을 바꿔 보세요');
    }
    setT('hy-k1', pir.toFixed(1) + '년'); setT('hy-k2', pirG.toFixed(1) + '배'); setT('hy-k3', eok(o.price));
    /* 계산 내역 */
    var c0 = o.costs ? HYC.cost(o.price, o.first) : null, lines = [
      ['목표 집값 (지금) <small>(' + esc(o.how) + ')</small>', won(o.price)],
      o.ltv ? ['대출 <small>(집값의 ' + Math.round(o.ltv * 100) + '% — 실제 한도는 LTV·DSR 규제로 달라짐)</small>', '−' + won(o.price * o.ltv)] : null,
      c0 ? ['취득세·지방교육세 <small>(1주택' + (o.first ? ' · 생애최초 감면' : '') + ')</small>', '+' + won(c0.acq)] : null,
      c0 ? ['중개보수 <small>(상한요율 · 부가세 포함)</small>', '+' + won(c0.broker)] : null,
      ['<b>지금 필요한 돈</b>', won(o.price * (1 - o.ltv) + (c0 ? c0.total : 0)), 'fc-total'],
      ['모은 돈', '−' + won(o.saved)],
      ['월 저축 (첫해)', won(r.first ? r.first.save : 0)],
      ['한 푼도 안 쓰고 모으면 <small>(집값 ÷ 연 실수령액, 집값·월급 그대로 가정)</small>', pir.toFixed(1) + '년', 'fc-hl'],
      ['연봉 대비 집값 <small>(집값 ÷ 세전 연봉 — PIR과 비슷한 지표)</small>', pirG.toFixed(1) + '배'],
      r.m > 0 ? ['<b>집을 살 수 있는 때</b> <small>(연봉 +' + (o.raise * 100).toFixed(1) + '%·집값 +' + (o.grow * 100).toFixed(1) + '%·저축 수익률 ' + (o.ret * 100).toFixed(1) + '% 매년)</small>', ym(r.m) + ' 뒤', 'fc-hl'] : null
    ];
    setH('hy-table', lines.filter(Boolean).map(function (x) { return '<tr' + (x[2] ? ' class="' + x[2] + '"' : '') + '><td>' + x[0] + '</td><td style="text-align:right;">' + x[1] + '</td></tr>'; }).join(''));
    /* 지역별 비교 (같은 조건) */
    var cmp = [['all', '전국']].concat(Object.keys(D.sido).map(function (k) { return [k, k]; })).map(function (k) {
      var rp = o.size === 'custom' ? regionPrice(k[0], '84') : regionPrice(k[0], o.size), oo = {}; for (var z in o) oo[z] = o[z];
      if (!rp) return null; oo.price = rp[0];
      var q = HYC.calc(oo, 100);
      return { k: k, p: rp[0], m: q.m, pir: rp[0] / Math.max(1, net0 * 12) };
    }).filter(Boolean).sort(function (a, b) { return (a.m < 0 ? 1e9 : a.m) - (b.m < 0 ? 1e9 : b.m) || a.p - b.p; });
    setT('hy-cmp-sub', (o.size === 'custom' ? '84㎡ 아파트' : o.size === 'any' ? '아파트 (면적 무관)' : o.size + '㎡ 아파트') + ' 중위값 · 같은 연봉·저축 조건');
    setH('hy-cmp', cmp.map(function (z) {
      var on = z.k[0] === o.reg && o.size !== 'custom';
      return '<tr' + (on ? ' class="fc-hl"' : '') + '><td>' + esc(z.k[1]) + '</td><td style="text-align:right;">' + eok(z.p) + '</td><td style="text-align:right;">' + z.pir.toFixed(1) + '년</td><td style="text-align:right;"><b>' + (z.m < 0 ? '100년+' : z.m === 0 ? '지금' : ym(z.m)) + '</b></td></tr>';
    }).join(''));
    /* 그래프: 모은 돈 vs 필요한 돈 */
    if (typeof Chart !== 'undefined') {
      var yrs = r.m >= 0 ? Math.max(3, Math.ceil(r.m / 12) + 2) : 40, labels = [], A = [], N = [];
      var oo2 = {}; for (var z2 in o) oo2[z2] = o[z2];
      var mr = Math.pow(1 + o.ret, 1 / 12) - 1, Acc = o.saved;
      for (var y = 0; y <= yrs; y++) {
        labels.push(y ? y + '년' : '지금');
        var p = o.price * Math.pow(1 + o.grow, y), c = o.costs ? HYC.cost(p, o.first).total : 0;
        A.push(Math.round(Acc)); N.push(Math.round(p * (1 - o.ltv) + c));
        var sal = o.salary * Math.pow(1 + o.raise, y), net = HYC.netMonthly(sal), sv = o.mode === 'fixed' ? o.fixed * Math.pow(1 + o.raise, y) : net * o.rate;
        for (var k = 0; k < 12; k++) Acc = Acc * (1 + mr) + Math.max(0, sv);
      }
      var ds = [{ label: '모은 돈', data: A, borderColor: '#3182f6', backgroundColor: 'rgba(49,130,246,0.12)', fill: true, pointRadius: 0, pointHoverRadius: 4, borderWidth: 2, tension: 0.15 },
                { label: '필요한 돈', data: N, borderColor: '#f04452', borderDash: [6, 4], fill: false, pointRadius: 0, borderWidth: 1.6 }];
      var opt = { responsive: true, maintainAspectRatio: false, animation: false, interaction: { mode: 'index', intersect: false },
        plugins: { legend: { display: false }, tooltip: { backgroundColor: '#202027', borderColor: fgA(0.1), borderWidth: 1, titleColor: '#9e9ea4', bodyColor: '#e4e4e5', padding: 12, callbacks: { label: function (c) { return ' ' + c.dataset.label + ': ' + eok(c.parsed.y); } } } },
        scales: { x: { ticks: { color: '#6d6d76', font: { size: 11 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 10 }, grid: { display: false }, border: { display: false } },
                  y: { beginAtZero: true, ticks: { color: '#6d6d76', font: { size: 11 }, callback: function (v) { return fmt(v, true); } }, grid: { color: fgA(0.04) }, border: { display: false } } } };
      if (chart) { chart.data.labels = labels; chart.data.datasets = ds; chart.options = opt; chart.update('none'); }
      else chart = new Chart($('hy-chart'), { type: 'line', data: { labels: labels, datasets: ds }, options: opt });
    }
    /* 공유 카드 */
    var rk = cmp.findIndex(function (z) { return z.k[0] === o.reg; });
    share = { key: 'house-years', chip: '집 사기 계산기', title: '연봉 ' + eok(o.salary) + '으로 ' + place,
      label: o.mode === 'rate' ? '실수령의 ' + Math.round(o.rate * 100) + '% 저축 · 연봉 +' + (o.raise * 100).toFixed(1) + '% · 집값 +' + (o.grow * 100).toFixed(1) + '%/년' : '매달 ' + eok(o.fixed) + ' 저축 · 집값 +' + (o.grow * 100).toFixed(1) + '%/년',
      big: r.m < 0 ? '100년+' : r.m === 0 ? '지금 가능' : ym(r.m), sub: r.m > 0 ? (o.age > 0 ? Math.floor(o.age + r.m / 12) + '세에 내 집 마련' : '모아야 내 집 마련') : r.m === 0 ? '이미 살 수 있는 돈이 있습니다' : '저축만으로는 따라잡기 어렵습니다',
      rows: [['목표 집값 (지금)', eok(o.price)], ['한 푼도 안 쓰고 모으면', pir.toFixed(1) + '년'], ['연봉 대비 집값', pirG.toFixed(1) + '배'],
             rk >= 0 && o.size !== 'custom' ? ['전국 ' + cmp.length + '개 지역 중', '빠른 순 ' + (rk + 1) + '위'] : (o.ltv ? ['대출 비율', Math.round(o.ltv * 100) + '%'] : null)],
      source: '국토교통부 아파트 실거래가 (단지별 최근 거래 중위값) · ' + (D.updated || '').slice(0, 10) };
    (window.dcShareSpec = window.dcShareSpec || {})['house-years'] = share;   /* 오른쪽 아래 공유 창이 이 카드를 씀 */
  }
  function load() {
    if (loading || !window.mdLoad) return; loading = true;
    Promise.all([window.mdLoad('apt_area.json'), window.mdLoad('realty.json').catch(function () { return null; })]).then(function (x) {
      loading = false; var d = x[0];
      if (!d || !d.sido) { setT('hy-sub', '자료를 불러오지 못했습니다. 잠시 뒤 다시 열어 주세요.'); return; }
      D = d; R = x[1]; fill();
      setH('hy-src', '집값: 국토교통부 아파트 매매 실거래가 — 최근 1년 거래된 단지마다 가장 최근 거래 1건의 중위값 (' + (d.updated || '').slice(0, 10) + ' 갱신)');
      var pg = $('page-houseyears'); if (pg && pg.classList.contains('active')) render();
    }).catch(function () { loading = false; setT('hy-sub', '자료를 불러오지 못했습니다.'); });
  }
  window.fcRegister('hy', render, 'houseyears');
})();

/* ════════════════════════════════════════
   [RETIRE] 노후 준비 성적표 — 모든 금액은 '지금 돈 가치'(실질) 기준
   근거(2026-10 확인)
   · 국민연금법(2026.1.1 시행 개정): 기본연금액 = Σ(구간 비례상수 × (A + B) × 구간 가입월수 ÷ 총 가입월수) × (1 + 0.05 × 20년 초과 가입연수)
       비례상수 1988~98년 2.4(A + 0.75B) · 1999~2007년 1.8 · 2008년 1.5 → 매년 0.015 감소 → 2025년 1.245 · 2026년~ 1.29(소득대체율 43%)
       가입 20년 미만: × (0.5 + 0.05 × 10년 초과 연수), 10년 미만은 연금 없음(반환일시금) · A값(2026년) 3,193,511원
       기준소득월액 41만~659만원(2026.7~) · 수급 개시 1969년생 이후 65세(출생연도별 60~65세)
       조기 수령 1년당 −6%(최대 5년) · 연기 1년당 +7.2%(최대 5년) · 매년 물가만큼 인상(실질 가치 유지)
   · 적정 노후생활비: 국민연금연구원 국민노후보장패널 10차(2025.12 발표) — 개인 적정 197.6만·최소 139.2만, 부부 적정 298.1만·최소 216.6만
   · 사적연금 연금소득세(소득세법 §129): 70세 미만 5.5% · 80세 미만 4.4% · 80세 이상 3.3% (지방세 포함)
   · 퇴직연금: 해마다 연봉의 1/12 적립(DC 최소 부담금 · 퇴직금 30일분과 같은 크기)
   · 은퇴 후: 퇴직연금·개인연금·그 밖의 자산을 은퇴부터 계획 나이까지 매달 같은 실질 금액으로 나눠 씀(실질 수익률로 굴리며)
════════════════════════════════════════ */
var RTC = (function () {
  var A2026 = 3193511, BMIN = 41e4, BMAX = 659e4;
  function constAt(y) { return y >= 2026 ? 1.29 : y >= 2008 ? 1.5 - 0.015 * (y - 2008) : y >= 1999 ? 1.8 : 2.4; }
  function pensionAge(birth) { return birth <= 1952 ? 60 : birth <= 1956 ? 61 : birth <= 1960 ? 62 : birth <= 1964 ? 63 : birth <= 1968 ? 64 : 65; }
  /* 국민연금 예상 월액(지금 돈 가치) — o: {birth, startAge, endAge, income(월 세전), claimAge} */
  function nps(o) {
    var B = Math.min(BMAX, Math.max(BMIN, o.income || 0)), A = A2026;
    var y0 = Math.max(1988, o.birth + o.startAge), y1 = o.birth + Math.min(60, o.endAge);   /* 가입: 시작 나이 ~ min(은퇴, 60세) 직전 */
    var years = Math.max(0, y1 - y0);
    var r = { years: years, B: B, A: A, base: pensionAge(o.birth) };
    if (years < 10) { r.monthly = 0; r.short = true; return r; }
    var sum = 0;
    for (var y = y0; y < y1; y++) sum += (y < 1999 ? constAt(y) * (A + 0.75 * B) : constAt(y) * (A + B));
    var avg = sum / years;                                   /* Σ 상수 × (A+B) × 구간 비중 */
    var annual = years >= 20 ? avg * (1 + 0.05 * (years - 20)) : avg * (0.5 + 0.05 * (years - 10));
    var claim = Math.max(r.base - 5, Math.min(r.base + 5, o.claimAge || r.base));
    var adj = claim < r.base ? 1 - 0.06 * (r.base - claim) : 1 + 0.072 * (claim - r.base);
    r.claim = claim; r.adj = adj; r.annual = annual; r.monthly = annual / 12 * adj;
    r.ratio = r.monthly / B;                                 /* 내 소득 대비 (소득대체율) */
    return r;
  }
  function taxRate(age) { return age < 70 ? 0.055 : age < 80 ? 0.044 : 0.033; }
  /* 지금부터 은퇴까지 적립 → 은퇴~계획 나이까지 매달 같은 실질 금액 인출 */
  function grow(pv, monthly, months, rm) { var v = pv; for (var i = 0; i < months; i++) v = v * (1 + rm) + monthly; return v; }
  function annuity(pv, months, rm) { if (!(months > 0)) return 0; return rm ? pv * rm / (1 - Math.pow(1 + rm, -months)) : pv / months; }
  /* o: {age, retire, plan, household, target, income, salaryYear, npsMode, npsDirect, npsStart, npsClaim, spouseNps,
         dc, dcAdd, ps, psAdd, other, otherAdd, ret, infl} */
  function calc(o) {
    var rr = (1 + o.ret) / (1 + o.infl) - 1, rm = Math.pow(1 + rr, 1 / 12) - 1;
    var nAcc = Math.max(0, Math.round((o.retire - o.age) * 12)), nPay = Math.max(1, Math.round((o.plan - o.retire) * 12));
    var birth = 2026 - Math.round(o.age);
    var r = { rr: rr, nAcc: nAcc, nPay: nPay, birth: birth };
    r.np = o.npsMode === 'direct' ? { monthly: o.npsDirect, claim: o.npsClaim || pensionAge(birth), base: pensionAge(birth), direct: true }
                                  : nps({ birth: birth, startAge: o.npsStart, endAge: o.retire, income: o.income, claimAge: o.npsClaim });
    if (r.np.direct) { var b0 = r.np.base, c0 = Math.max(b0 - 5, Math.min(b0 + 5, r.np.claim)); r.np.claim = c0; }
    r.spouse = o.household === 'couple' ? (o.spouseNps || 0) : 0;
    var dcAdd = o.dcOn ? o.salaryYear / 12 / 12 : 0;            /* 연봉 1/12 을 해마다 → 매달 1/144 */
    r.pots = [
      ['퇴직연금·퇴직금', grow(o.dc, dcAdd, nAcc, rm), true],
      ['연금저축·IRP', grow(o.ps, o.psAdd, nAcc, rm), true],
      ['그 밖의 노후 자산', grow(o.other, o.otherAdd, nAcc, rm), false]
    ].map(function (p) { return { name: p[0], pv: p[1], gross: annuity(p[1], nPay, rm), taxed: p[2] }; });
    /* 나이별 월 소득 (실질) */
    var rows = [], sumInc = 0, sumNeed = 0, gap = 0, gapNeed = 0;
    for (var a = Math.floor(o.retire); a < o.plan; a++) {
      var t = taxRate(a), npm = a >= r.np.claim ? r.np.monthly : 0, spm = a >= r.np.claim ? r.spouse : 0;   /* 배우자도 같은 나이 기준으로 단순화 */
      var pots = r.pots.map(function (p) { return p.taxed ? p.gross * (1 - t) : p.gross; });
      var inc = npm + spm + pots.reduce(function (s, v) { return s + v; }, 0);
      rows.push({ age: a, nps: npm + spm, pots: pots, inc: inc });
      sumInc += inc; sumNeed += o.target;
      if (inc < o.target) { gap += o.target - inc; }
    }
    r.rows = rows;
    r.avgInc = rows.length ? sumInc / rows.length : 0;
    r.cover = sumNeed > 0 ? sumInc / sumNeed : 0;
    /* 모자란 돈을 채우려면 은퇴까지 매달 더 모아야 할 돈 (실질) — 부족분의 은퇴 시점 현재가치 */
    var short = 0;
    rows.forEach(function (x, i) { var d = o.target - x.inc; if (d > 0) short += d * 12 / Math.pow(1 + rr, i + 0.5); });
    r.shortPV = short;
    r.needMonthly = short > 0 ? (nAcc > 0 ? (rm ? short * rm / (Math.pow(1 + rm, nAcc) - 1) : short / nAcc) : null) : 0;
    r.grade = gradeOf(r.cover);
    return r;
  }
  function gradeOf(c) { return c >= 1.2 ? 'A+' : c >= 1 ? 'A' : c >= 0.9 ? 'B+' : c >= 0.8 ? 'B' : c >= 0.65 ? 'C' : c >= 0.5 ? 'D' : 'F'; }
  return { calc: calc, nps: nps, pensionAge: pensionAge, constAt: constAt, gradeOf: gradeOf, A2026: A2026 };
})();

/* [RETIRE] 화면 — 입력(data-fc="rt")은 [FC-UI] 공통 처리 */
(function () {
  if (!document.getElementById('page-retire')) return;
  function $(id) { return document.getElementById(id); }
  function setT(id, v) { var e = $(id); if (e) e.textContent = v; }
  function setH(id, v) { var e = $(id); if (e) e.innerHTML = v; }
  function numOf(id) { var e = $(id); return e ? (parseFloat(String(e.value).replace(/,/g, '')) || 0) : 0; }
  var UNIT = { eok: 1e8, man: 1e4, won: 1 };
  function amt(id) { var e = $(id); return Math.round(numOf(id) * (UNIT[e && e.getAttribute('data-unit')] || 1)); }
  function seg(name) { var b = document.querySelector('.fc-seg[data-name="' + name + '"] .mode-btn.active'); return b ? b.getAttribute('data-v') : null; }
  function won(n) { return (n < 0 ? '−' : '') + Math.round(Math.abs(n)).toLocaleString('ko-KR') + '원'; }
  function man(n) { var v = Math.round(n / 1e3) / 10; return (v >= 100 ? Math.round(v).toLocaleString('ko-KR') : v.toLocaleString('ko-KR')) + '만원'; }
  function eok(n) {
    var neg = n < 0; n = Math.round(Math.abs(n) / 1e4) * 1e4;
    var e = Math.floor(n / 1e8), m = Math.round((n - e * 1e8) / 1e4), s;
    if (!e) s = m.toLocaleString('ko-KR') + '만원'; else s = e.toLocaleString('ko-KR') + '억' + (m ? ' ' + m.toLocaleString('ko-KR') + '만원' : '원');
    return (neg ? '−' : '') + s;
  }
  var LIVING = { single: { min: 1392000, fit: 1976000 }, couple: { min: 2166000, fit: 2981000 } };
  var GRADES = ['F', 'D', 'C', 'B', 'B+', 'A', 'A+'], GCOL = { 'A+': '#3182f6', A: '#3182f6', 'B+': '#22a06b', B: '#22a06b', C: '#fe9800', D: '#f04452', F: '#f04452' };
  var chart = null, share = null, lastHh = 'single', lastBase = null;
  function claimOpts(base) {   /* 수령 시작 나이: 기본 나이 ± 5년 (조기 −6%/년 · 연기 +7.2%/년) — 기본 나이를 고른 상태였으면 새 기본 나이로 */
    if (lastBase === base) return;
    var sel = $('rt-claim'), prev = lastBase, cur = +sel.value, h = '';
    for (var a = base - 5; a <= base + 5; a++) h += '<option value="' + a + '">' + a + '세' + (a < base ? ' (조기 수령 ' + (6 * (base - a)) + '% 감액)' : a > base ? ' (연기 +' + (7.2 * (a - base)).toFixed(1) + '%)' : ' (정상 수령)') + '</option>';
    sel.innerHTML = h;
    sel.value = String(!cur || cur === prev ? base : Math.max(base - 5, Math.min(base + 5, cur)));
    lastBase = base;
  }
  function render() {
    var hh = seg('rt-hh') || 'single', age = numOf('rt-age'), birth = 2026 - Math.round(age), base = RTC.pensionAge(birth);
    claimOpts(base);
    if (hh !== lastHh) {   /* 1인 ↔ 부부: 목표 생활비가 적정값 그대로면 새 가구의 적정값으로 */
      if (amt('rt-target') === LIVING[lastHh].fit || amt('rt-target') === LIVING[lastHh].min) { var k = amt('rt-target') === LIVING[lastHh].min ? 'min' : 'fit'; $('rt-target').value = LIVING[hh][k].toLocaleString('ko-KR'); $('rt-target').setAttribute('data-unit', 'won'); document.querySelectorAll('.unit-btn[data-fc-unit="rt-target"]').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-unit') === 'won'); }); }
      lastHh = hh;
    }
    document.querySelectorAll('.rt-pre').forEach(function (b) { var v = b.getAttribute('data-k') === 'rich' ? LIVING[hh].fit * 1.5 : LIVING[hh][b.getAttribute('data-k')]; b.setAttribute('data-won', v); b.querySelector('b').textContent = man(v); });
    var mode = seg('rt-npsmode') || 'auto';
    $('rt-auto-box').style.display = mode === 'auto' ? '' : 'none'; $('rt-direct-f').style.display = mode === 'direct' ? '' : 'none';
    $('rt-spouse-f').style.display = hh === 'couple' ? '' : 'none';
    var o = { age: age, retire: numOf('rt-retire'), plan: +$('rt-plan').value, household: hh, target: amt('rt-target'), income: amt('rt-income'),
      salaryYear: amt('rt-income') * 12, npsMode: mode, npsDirect: amt('rt-npsdirect'), npsStart: numOf('rt-npsstart'), npsClaim: +$('rt-claim').value,
      spouseNps: amt('rt-spouse'), dc: amt('rt-dc'), dcOn: $('rt-dcon').checked, ps: amt('rt-ps'), psAdd: amt('rt-psadd'), other: amt('rt-other'), otherAdd: amt('rt-otheradd'),
      ret: numOf('rt-ret') / 100, infl: numOf('rt-infl') / 100 };
    var err = !(age >= 18 && age < 100) ? '나이를 넣어 주세요 (18~99세).' : !(o.retire >= age) ? '은퇴 나이는 지금 나이 이상이어야 합니다.' : !(o.plan > o.retire) ? '계획 나이는 은퇴 나이보다 많아야 합니다.' : !(o.target > 0) ? '목표 월 생활비를 넣어 주세요.' : '';
    if (err) { setT('rt-grade', '—'); setT('rt-sub', err); share = null; (window.dcShareSpec = window.dcShareSpec || {})['retirement-score'] = null; return; }
    var r = RTC.calc(o), np = r.np, pct = Math.round(r.cover * 100);
    setT('rt-grade', r.grade); $('rt-grade').style.color = GCOL[r.grade];
    setH('rt-sub', '노후 생활비의 <b>' + pct + '%</b>를 준비했습니다 · 은퇴 후 월 평균 <b>' + man(r.avgInc) + '</b> / 목표 ' + man(o.target) + ' <small>(지금 돈 가치)</small>');
    var gi = GRADES.indexOf(r.grade);
    setH('rt-scale', GRADES.map(function (g, i) { return '<span class="rt-g' + (i === gi ? ' on' : '') + '" style="' + (i === gi ? 'background:' + GCOL[g] + ';border-color:' + GCOL[g] + ';' : '') + '">' + g + '</span>'; }).join(''));
    setT('rt-k1', man(r.avgInc)); setT('rt-k2', man(np.monthly + r.spouse));
    setT('rt-k3', r.needMonthly == null ? '은퇴 후라 해당 없음' : r.needMonthly > 0 ? won(Math.ceil(r.needMonthly / 1e3) * 1e3) : '0원 (충분)');
    setT('rt-k3-l', r.cover >= 1 && r.needMonthly > 0 ? '모자란 해(공백기)까지 채우려면 매달 더' : '100% 채우려면 매달 더');
    /* 소득원 표 */
    var taxNote = '연금소득세 3.3~5.5% 뺀 금액';
    var first = r.rows[0], afterNp = r.rows.find(function (x) { return x.nps > 0; }) || first;
    var lines = [
      ['<b>국민연금</b> <small>(' + (np.direct ? '직접 넣은 예상액' : '가입 ' + np.years + '년 · 기준소득 ' + man(np.B) + ' · 소득대체율 ' + (np.ratio * 100).toFixed(1) + '%') + ' · ' + np.claim + '세부터' + (np.adj && np.adj !== 1 ? ' · ' + (np.adj < 1 ? '조기 ' : '연기 ') + ((np.adj - 1) * 100).toFixed(1) + '%' : '') + ')</small>', np.short ? '<span style="color:#f04452;">가입 10년 미만 — 연금 없음</span>' : man(np.monthly)],
      o.household === 'couple' ? ['배우자 국민연금 <small>(' + np.claim + '세부터로 계산)</small>', man(r.spouse)] : null
    ].concat(r.pots.map(function (p, i) {
      var net = r.rows.reduce(function (s2, x) { return s2 + x.pots[i]; }, 0) / Math.max(1, r.rows.length);   /* 나이별 세율을 반영한 평균 */
      return [p.name + ' <small>(은퇴 때 ' + eok(p.pv) + ' → ' + o.retire + '~' + o.plan + '세 ' + (o.plan - o.retire) + '년간 나눠 받음' + (p.taxed ? ' · ' + taxNote + ', 평균' : '') + ')</small>', man(net)];
    })).concat([
      ['<b>은퇴 직후 월 소득</b> <small>(' + first.age + '세' + (afterNp.age > first.age ? ' — 국민연금 받기 전 ' + (afterNp.age - first.age) + '년' : '') + ')</small>', man(first.inc), first.inc < o.target ? 'fc-hl' : ''],
      afterNp.age > first.age ? ['<b>국민연금 받은 뒤 월 소득</b> <small>(' + afterNp.age + '세~)</small>', man(afterNp.inc)] : null,
      ['<b>은퇴 기간 월 평균</b> <small>(' + o.retire + '~' + o.plan + '세)</small>', man(r.avgInc), 'fc-total'],
      ['목표 월 생활비', man(o.target)],
      ['<b>노후 생활비 준비율</b>', pct + '% · ' + r.grade, 'fc-hl']
    ]);
    if (r.needMonthly > 0) lines.push([(r.cover >= 1 ? '평균은 충분하지만 목표보다 모자란 해까지 모두 채우려면' : '모자란 달을 모두 채우려면') + ' <small>(은퇴 시점에 ' + eok(r.shortPV) + ' 더 필요 → 은퇴까지 매달)</small>', '+' + won(Math.ceil(r.needMonthly / 1e3) * 1e3)]);
    else if (r.needMonthly == null && r.shortPV > 0) lines.push(['목표보다 모자란 해를 채우는 데 필요한 돈 <small>(은퇴 시점 기준)</small>', eok(r.shortPV)]);
    setH('rt-table', lines.filter(Boolean).map(function (x) { return '<tr' + (x[2] ? ' class="' + x[2] + '"' : '') + '><td>' + x[0] + '</td><td style="text-align:right;">' + x[1] + '</td></tr>'; }).join(''));
    /* 진단 */
    var tips = [], gapYrs = afterNp.age - first.age;
    if (np.short) tips.push('국민연금은 최소 10년 가입해야 받을 수 있습니다. 임의가입·추후납부로 가입 기간을 채우세요.');
    if (gapYrs > 0 && first.inc < o.target) tips.push('은퇴 후 국민연금을 받기 전 ' + gapYrs + '년(' + first.age + '~' + (afterNp.age - 1) + '세)은 월 ' + man(o.target - first.inc) + '이 모자랍니다 — 이 \'소득 공백기\'를 메울 연금저축·IRP를 따로 준비하거나 은퇴를 늦추는 것이 효과적입니다.');
    if ((np.monthly + r.spouse) / o.target < 0.4) tips.push('국민연금이 목표 생활비의 ' + Math.round((np.monthly + r.spouse) / o.target * 100) + '%만 채웁니다. 연금저축·IRP는 연 900만원까지 세액공제(13.2~16.5%)를 받아 노후 소득을 늘리기 좋습니다.');
    if (o.psAdd < 25e4 && r.cover < 1) tips.push('연금저축·IRP에 매달 ' + man(75e4) + '(연 900만원)까지 넣으면 연말정산에서 최대 148만5천원을 돌려받습니다.');
    if (r.cover >= 1) tips.push('목표 생활비를 은퇴 기간 내내 채울 수 있습니다. 수익률을 1%p 낮춰도 괜찮은지 확인해 보세요.');
    setH('rt-tips', tips.map(function (t) { return '<li>' + t + '</li>'; }).join(''));
    /* 그래프: 나이별 소득원 (누적 막대) + 목표 */
    if (typeof Chart !== 'undefined') {
      var labels = r.rows.map(function (x) { return x.age + '세'; });
      var ds = [{ label: '국민연금' + (o.household === 'couple' ? '(부부)' : ''), data: r.rows.map(function (x) { return Math.round(x.nps); }), backgroundColor: '#3182f6', stack: 's' }];
      var pc = ['#22a06b', '#a855f7', '#fe9800'];
      r.pots.forEach(function (p, i) { ds.push({ label: p.name, data: r.rows.map(function (x) { return Math.round(x.pots[i]); }), backgroundColor: pc[i], stack: 's' }); });
      ds.push({ type: 'line', label: '목표 생활비', data: r.rows.map(function () { return o.target; }), borderColor: '#f04452', borderDash: [6, 4], pointRadius: 0, borderWidth: 1.6, fill: false });
      var opt = { responsive: true, maintainAspectRatio: false, animation: false, interaction: { mode: 'index', intersect: false },
        plugins: { legend: { display: true, position: 'bottom', labels: { color: '#9e9ea4', boxWidth: 10, boxHeight: 10, font: { size: 11 } } }, tooltip: { backgroundColor: '#202027', borderColor: fgA(0.1), borderWidth: 1, titleColor: '#9e9ea4', bodyColor: '#e4e4e5', padding: 12, callbacks: { label: function (c) { return ' ' + c.dataset.label + ': ' + man(c.parsed.y); } } } },
        scales: { x: { stacked: true, ticks: { color: '#6d6d76', font: { size: 11 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 12 }, grid: { display: false }, border: { display: false } },
                  y: { stacked: true, beginAtZero: true, ticks: { color: '#6d6d76', font: { size: 11 }, callback: function (v) { return Math.round(v / 1e4).toLocaleString('ko-KR') + '만'; } }, grid: { color: fgA(0.04) }, border: { display: false } } } };
      if (chart) { chart.destroy(); }
      chart = new Chart($('rt-chart'), { type: 'bar', data: { labels: labels, datasets: ds }, options: opt });
    }
    share = { key: 'retirement-score', chip: '노후 준비 성적표', title: '나의 노후 준비 성적표', label: Math.round(age) + '세 · ' + o.retire + '세 은퇴 · ' + o.plan + '세까지 · ' + (hh === 'couple' ? '부부' : '1인 가구'),
      big: r.grade + '  ' + pct + '%', sub: '노후 생활비의 ' + pct + '%를 준비했어요', gauge: Math.min(100, pct / 1.2), gaugeLabels: ['0%', '60%', '120% 이상'],
      rows: [['은퇴 후 월 평균 소득', man(r.avgInc), true], ['목표 월 생활비', man(o.target), true], ['국민연금 예상 월액', man(np.monthly + r.spouse), true],
             r.needMonthly > 0 ? ['100% 채우려면 매달', '+' + man(r.needMonthly), true] : ['준비 상태', '목표 달성']],
      source: '국민연금법(2026 개정) · 국민연금연구원 노후보장패널 · 지금 돈 가치 기준' };
    (window.dcShareSpec = window.dcShareSpec || {})['retirement-score'] = share;   /* 오른쪽 아래 공유 창이 이 카드를 씀 */
  }
  document.addEventListener('click', function (e) {
    if (!e.target.closest) return;
    var b = e.target.closest('.rt-pre');
    if (b) { var t = $('rt-target'); t.setAttribute('data-unit', 'won'); t.value = Math.round(+b.getAttribute('data-won')).toLocaleString('ko-KR'); document.querySelectorAll('.unit-btn[data-fc-unit="rt-target"]').forEach(function (u) { u.classList.toggle('active', u.getAttribute('data-unit') === 'won'); }); render(); return; }
  });
  window.fcRegister('rt', render, 'retire');
})();

/* ════════════════════════════════════════
   [NPR] 국민연금 손익 계산기 — 낸 돈 대비 받는 돈 · 세대별 손익 (2025년 개정 국민연금법, 2026.1.1 시행)
   근거(2026-10 확인)
   · 보험료율(직장 = 근로자·사용자 절반씩): 1988~92년 3% · 1993~97년 6%(근로자 2 · 사용자 2 · 퇴직금전환금 2)
       · 1998.1~1999.3 9%(3 · 3 · 3) · 1999.4~2025년 9%(4.5 · 4.5)
       · 개정: 2026년 9.5% → 해마다 0.5%p → 2033년~ 13%   (개정 전 제도: 9% 유지)
     지역가입자: 1995.7 3% → 2000.7부터 해마다 7월 1%p ↑ → 2005.7~ 9% (전액 본인 부담) · 1995.7 이전은 가입 대상 아님
   · 기본연금액(월) = Σ(가입 월마다 비례상수 × (A + B)) ÷ 2,880   … 법 제51조 산식(×(1+0.05×20년 초과 연수), 20년 미만 ×(0.5+0.05×10년 초과 연수))과 같은 값
       비례상수: 1988~98년 2.4 (A + 0.75B) · 1999~2007년 1.8 · 2008년 1.5 → 매년 0.015 ↓ → 2025년 1.245
       개정: 2026년~ 1.29 (소득대체율 43%) · 개정 전 제도: 2026년 1.23 · 2027년 1.215 · 2028년~ 1.2 (40%)
   · A값(2026년) 3,193,511원(보건복지부 고시 제2026-12호) · 기준소득월액 41만~659만원(2026.7~)
   · 가입 10년(120개월) 미만: 연금 없음 → 반환일시금(낸 보험료 + 이자)
   · 수급 개시: 1952년생 이전 60세 · 53~56년생 61세 · 57~60년생 62세 · 61~64년생 63세 · 65~68년생 64세 · 69년생~ 65세
     조기 1년당 −6%(최대 5년) · 연기 1년당 +7.2%(최대 5년) · 받는 동안 매년 물가만큼 인상
   · 크레딧(노령연금 받을 때 가입기간에 더함, 본인 부담 없음)
       군복무: 인정소득 A값의 1/2 — 2008년 이후 입대 6개월 · 2026년 전역 12개월(개정) · 2027년 이후 전역 복무기간 전체(2026.10 국회 통과, 육군 18개월)
       출산·입양: 인정소득 A값 — 둘째 12 · 셋째부터 18개월씩(2008년 이후, 최대 50개월) · 개정: 첫째 12개월 신설·50개월 상한 폐지(2026년~) · 2027년 이후 둘째 15개월(2026.10 국회 통과)
   · 기대여명: 국가데이터처 2024년 생명표 — 65세 남 19.5년 · 여 23.7년
   · 모든 금액은 2026년 임금 수준(지금 돈 가치): 지난 보험료도 국민연금 재평가처럼 임금 상승만큼 올려서 셈, 소득은 평생 같은 위치(A값 대비 비율)로 가정
════════════════════════════════════════ */
var NPR = (function () {
  var A = 3193511, BMIN = 41e4, BMAX = 659e4, LIFE65 = { m: 19.5, f: 23.7 };
  function pensionAge(b) { return b <= 1952 ? 60 : b <= 1956 ? 61 : b <= 1960 ? 62 : b <= 1964 ? 63 : b <= 1968 ? 64 : 65; }
  /* 보험료율(%) — [전체, 본인] · 0 이면 그달은 가입 대상 아님 */
  function rate(y, m, law, kind) {
    if (y < 1988) return [0, 0];
    var t;
    if (y >= 2026) t = law === 'old' ? 9 : Math.min(13, 9 + 0.5 * (y - 2025));
    if (kind === 'local') {
      if (y < 2026) {
        if (y < 1995 || (y === 1995 && m < 7)) return [0, 0];
        t = y < 2000 || (y === 2000 && m < 7) ? 3 : Math.min(9, 4 + (y - 2000) - (m < 7 ? 1 : 0));
      }
      return [t, t];
    }
    if (y < 2026) {
      if (y <= 1992) return [3, 1.5];
      if (y <= 1997) return [6, 2];
      if (y === 1998 || (y === 1999 && m < 4)) return [9, 3];
      return [9, 4.5];
    }
    return [t, t / 2];
  }
  function coef(y, law) {
    if (y <= 1998) return 2.4;
    if (y <= 2007) return 1.8;
    if (y <= 2025) return 1.5 - 0.015 * (y - 2008);
    if (law === 'old') return y === 2026 ? 1.23 : y === 2027 ? 1.215 : 1.2;
    return 1.29;
  }
  function clampB(v) { return Math.min(BMAX, Math.max(BMIN, v)); }
  /* 크레딧 개월 — mil: 'none' | 'p08'(2025년 이전 전역) | 'y26'(2026년 전역) | 'y27'(2027년 이후 전역) · kids: 자녀 수 · era: 'p25' | 'y26' | 'y27' (출생·입양 시기) */
  function credits(o, law) {
    var mil = { none: 0, p08: 6, y26: 12, y27: 18 }[o.mil || 'none'] || 0;
    if (law === 'old') mil = Math.min(mil, 6);
    var k = Math.max(0, Math.min(10, Math.round(o.kids || 0))), kid = 0;
    for (var i = 1; i <= k; i++) {
      if (law === 'old' || o.era === 'p25') kid += i === 1 ? 0 : i === 2 ? 12 : 18;
      else kid += i === 1 ? 12 : i === 2 ? (o.era === 'y27' ? 15 : 12) : 18;
    }
    if (law === 'old' || o.era === 'p25') kid = Math.min(50, kid);
    return { mil: mil, kid: kid };
  }
  /* o: {birth, sex 'm'|'f', kind 'work'|'local', income(월, 지금 돈), startAge, endAge, gap(개월), claim(나이·없으면 정상), life(몇 세까지·없으면 기대여명), mil, kids, era, basis 'mine'|'total'}
     law: 'new'(2026 개정) | 'old'(개정 전 9%·40%) */
  function calc(o, law) {
    law = law || 'new';
    var base = pensionAge(o.birth), claim = Math.max(base - 5, Math.min(base + 5, Math.round(o.claim || base)));
    var B = clampB(o.income || 0), kind = o.kind === 'local' ? 'local' : 'work';
    var endAge = Math.min(o.endAge, claim, 65);                    /* 받기 시작하면 더 낼 수 없음 · 임의계속가입은 65세까지 */
    var y0 = o.birth + Math.round(o.startAge), y1 = o.birth + Math.round(endAge);
    var gap = Math.max(0, Math.round(o.gap || 0));
    var N = 0, sumC = 0, payTot = 0, payMine = 0, byAge = {}, lastY = 0;
    for (var y = Math.max(1988, y0); y < y1; y++) {
      for (var m = 1; m <= 12; m++) {
        var r = rate(y, m, law, kind);
        if (!r[0]) continue;
        if (gap > 0) { gap--; continue; }                           /* 내지 않은 기간은 앞쪽(사회 초년)에서 뺌 */
        N++; lastY = y;
        sumC += y <= 1998 ? 2.4 * (A + 0.75 * B) : coef(y, law) * (A + B);
        var t = r[0] / 100 * B, mi = r[1] / 100 * B, age = y - o.birth;
        payTot += t; payMine += mi;
        byAge[age] = byAge[age] || [0, 0]; byAge[age][0] += t; byAge[age][1] += mi;
      }
    }
    var cr = credits(o, law), cC = coef(Math.max(2028, o.birth + claim), law);   /* 크레딧은 받을 때(수급권 취득) 제도의 상수로 */
    var Nc = N + cr.mil + cr.kid;
    var res = { law: law, base: base, claim: claim, B: B, A: A, N: N, Nc: Nc, credits: cr, payTot: payTot, payMine: payMine, byAge: byAge,
                avgRate: N ? payTot / N / B * 100 : 0 };
    res.pay = o.basis === 'total' || kind === 'local' ? payTot : payMine;
    var lifeAge = o.life > 0 ? o.life : 65 + LIFE65[o.sex === 'f' ? 'f' : 'm'];
    res.lifeAge = lifeAge;
    if (Nc < 120) {                                                 /* 10년 미만: 반환일시금 (지금 돈 가치로는 낸 돈만큼 + 이자) */
      res.short = true; res.monthly = 0; res.recv = payTot; res.months = 0;
      res.ratio = res.pay ? res.recv / res.pay : 0; res.gain = res.recv - res.pay; res.breakeven = null;
      return res;
    }
    sumC += cC * (A + A / 2) * cr.mil + cC * (A + A) * cr.kid;
    var full = sumC / 2880, adj = claim < base ? 1 - 0.06 * (base - claim) : 1 + 0.072 * (claim - base);
    res.full = full; res.adj = adj; res.monthly = full * adj;
    res.replace = res.monthly / B;                                   /* 내 소득 대비 */
    res.months = Math.max(0, Math.round((lifeAge - claim) * 12));
    res.recv = res.monthly * res.months;
    res.ratio = res.pay ? res.recv / res.pay : 0;
    res.gain = res.recv - res.pay;
    res.breakeven = res.monthly > 0 ? claim + res.pay / res.monthly / 12 : null;
    return res;
  }
  /* 세대별: 같은 소득·가입 나이·성별·유형으로 출생연도만 바꿔 개정 후/개정 전 비교 (크레딧·공백 제외, 정상 수령) */
  function cohorts(o, years) {
    return years.map(function (b) {
      var p = { birth: b, sex: o.sex, kind: o.kind, income: o.income, startAge: o.startAge, endAge: Math.min(o.endAge, 60), gap: 0, claim: 0, life: o.life, mil: 'none', kids: 0, basis: o.basis };
      var n = calc(p, 'new'), d = calc(p, 'old');
      return { birth: b, now: n, old: d };
    });
  }
  return { calc: calc, cohorts: cohorts, rate: rate, coef: coef, pensionAge: pensionAge, A: A, BMIN: BMIN, BMAX: BMAX, LIFE65: LIFE65 };
})();

/* [NPR] 화면 — 입력(data-fc="np")은 [FC-UI] 공통 처리 */
(function () {
  if (!document.getElementById('page-npsroi')) return;
  function $(id) { return document.getElementById(id); }
  function setT(id, v) { var e = $(id); if (e) e.textContent = v; }
  function setH(id, v) { var e = $(id); if (e) e.innerHTML = v; }
  function numOf(id) { var e = $(id); return e ? (parseFloat(String(e.value).replace(/,/g, '')) || 0) : 0; }
  var UNIT = { eok: 1e8, man: 1e4, won: 1 };
  function amt(id) { var e = $(id); return Math.round(numOf(id) * (UNIT[e && e.getAttribute('data-unit')] || 1)); }
  function seg(name) { var b = document.querySelector('.fc-seg[data-name="' + name + '"] .mode-btn.active'); return b ? b.getAttribute('data-v') : null; }
  function won(n) { return (n < 0 ? '−' : '') + Math.round(Math.abs(n)).toLocaleString('ko-KR') + '원'; }
  function man(n) { var v = Math.round(n / 1e3) / 10; return (n < 0 ? '−' : '') + (Math.abs(v) >= 100 ? Math.round(Math.abs(v)).toLocaleString('ko-KR') : Math.abs(v).toLocaleString('ko-KR')) + '만원'; }
  function eok(n) {
    var neg = n < 0; n = Math.round(Math.abs(n) / 1e4) * 1e4;
    var e = Math.floor(n / 1e8), m = Math.round((n - e * 1e8) / 1e4), s;
    if (!e) s = m.toLocaleString('ko-KR') + '만원'; else s = e.toLocaleString('ko-KR') + '억' + (m ? ' ' + m.toLocaleString('ko-KR') + '만원' : '원');
    return (neg ? '−' : '') + s;
  }
  function signed(n, f) { return (n > 0 ? '+' : n < 0 ? '−' : '') + f(Math.abs(n)); }
  function x2(v) { return (Math.round(v * 100) / 100).toFixed(2) + '배'; }
  function ym(m) { var y = Math.floor(m / 12), r = m % 12; return (y ? y + '년' : '') + (r ? (y ? ' ' : '') + r + '개월' : '') || '0개월'; }
  function ageTxt(a) { var y = Math.floor(a + 1e-9), mo = Math.min(11, Math.round((a - y) * 12)); return y + '세' + (mo ? ' ' + mo + '개월' : ''); }
  var chartG = null, chartC = null, lastBase = null, share = null;
  function claimOpts(base) {   /* 받기 시작 나이: 정상 나이 ± 5년 — 정상 나이를 고른 상태였으면 새 정상 나이로 */
    if (lastBase === base) return;
    var sel = $('np-claim'), prev = lastBase, cur = +sel.value, h = '';
    for (var a = base - 5; a <= base + 5; a++) h += '<option value="' + a + '">' + a + '세' + (a < base ? ' (조기 수령 ' + (6 * (base - a)) + '% 감액)' : a > base ? ' (연기 +' + (7.2 * (a - base)).toFixed(1) + '%)' : ' (정상 수령)') + '</option>';
    sel.innerHTML = h;
    sel.value = String(!cur || cur === prev ? base : Math.max(base - 5, Math.min(base + 5, cur)));
    lastBase = base;
  }
  function chartOpts(yFmt, stacked) {
    return { responsive: true, maintainAspectRatio: false, animation: false, interaction: { mode: 'index', intersect: false },
      plugins: { legend: { display: true, position: 'bottom', labels: { color: '#9e9ea4', boxWidth: 10, boxHeight: 10, font: { size: 11 } } },
        tooltip: { backgroundColor: '#202027', borderColor: fgA(0.1), borderWidth: 1, titleColor: '#9e9ea4', bodyColor: '#e4e4e5', padding: 12,
          callbacks: { label: function (c) { return ' ' + c.dataset.label + ': ' + yFmt(c.parsed.y, true); } } } },
      scales: { x: { ticks: { color: '#6d6d76', font: { size: 11 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 12 }, grid: { display: false }, border: { display: false } },
                y: { beginAtZero: true, ticks: { color: '#6d6d76', font: { size: 11 }, callback: function (v) { return yFmt(v); } }, grid: { color: fgA(0.04) }, border: { display: false } } } };
  }
  function clearOut(msg) {
    setT('np-val', '—'); setT('np-sub', msg); ['np-k1', 'np-k2', 'np-k3'].forEach(function (k) { setT(k, '—'); });
    setH('np-reform', ''); setH('np-table', ''); setT('np-gen-note', '');
    share = null; (window.dcShareSpec = window.dcShareSpec || {})['national-pension'] = null;
  }
  function render() {
    var birth = Math.round(numOf('np-birth')), sex = seg('np-sex') || 'm', kind = seg('np-kind') || 'work';
    var basis = kind === 'local' ? 'total' : (seg('np-basis') || 'mine');
    $('np-basis-f').style.display = kind === 'local' ? 'none' : '';
    var okBirth = birth >= 1940 && birth <= 2010;
    var base = NPR.pensionAge(okBirth ? birth : 1990);
    claimOpts(base);
    var o = { birth: birth, sex: sex, kind: kind, income: amt('np-income'), startAge: numOf('np-start'), endAge: numOf('np-end'), gap: numOf('np-gap'),
              claim: +$('np-claim').value, life: +$('np-life').value, mil: $('np-mil').value, kids: +$('np-kids').value, era: $('np-era').value, basis: basis };
    var err = !okBirth ? '출생 연도를 넣어 주세요 (1940~2010년).' : !(o.income > 0) ? '월 소득을 넣어 주세요.' : !(o.startAge >= 18 && o.startAge < 65) ? '가입 시작 나이는 18~64세로 넣어 주세요.'
      : !(o.endAge > o.startAge && o.endAge <= 65) ? '납부 끝 나이는 시작 나이보다 많고 65세 이하여야 합니다.' : o.life && o.life <= o.claim ? '받는 기간이 없습니다 — 몇 세까지 받는지를 늘려 주세요.' : '';
    if (err) return clearOut(err);
    var r = NPR.calc(o, 'new'), d = NPR.calc(o, 'old');
    var payWord = basis === 'mine' ? '내가 낸 돈' : '낸 보험료(회사 몫 포함)';
    /* 히어로 */
    if (r.short) {
      setT('np-val', '연금 없음'); $('np-val').style.color = '#f04452';
      setH('np-sub', '가입기간 ' + ym(r.Nc) + ' — 10년(120개월)이 안 돼 연금 대신 <b>반환일시금</b>(낸 보험료 ' + eok(r.payTot) + ' + 이자)을 받습니다');
      setT('np-k1', '0원'); setT('np-k2', '반환일시금'); setT('np-k3', '해당 없음');
    } else {
      setT('np-val', x2(r.ratio)); $('np-val').style.color = r.ratio >= 1 ? '' : '#f04452';
      setH('np-sub', payWord + ' <b>' + eok(r.pay) + '</b> → 평생 받는 돈 <b>' + eok(r.recv) + '</b> <small>(' + r.claim + '세부터 ' + ageTxt(r.lifeAge) + '까지 · 지금 돈 가치)</small>');
      setT('np-k1', won(Math.round(r.monthly / 10) * 10));
      setT('np-k2', signed(r.gain, eok)); $('np-k2').style.color = r.gain >= 0 ? '' : '#f04452';
      setT('np-k3', r.breakeven != null && r.breakeven <= r.lifeAge ? ageTxt(r.breakeven) : '기대수명 안에는 어려움');
    }
    /* 개혁 전 vs 후 */
    var rows = [
      [basis === 'mine' ? '낸 돈 <small>(본인)</small>' : '낸 돈 <small>(회사 몫 포함)</small>', eok(d.pay), eok(r.pay), signed(r.pay - d.pay, eok), r.pay > d.pay],
      ['월 연금', r.short ? '—' : man(d.monthly), r.short ? '—' : man(r.monthly), r.short ? '—' : signed(r.monthly - d.monthly, man), false],
      ['평생 받는 돈', eok(d.recv), eok(r.recv), signed(r.recv - d.recv, eok), false],
      ['평생 손익', signed(d.gain, eok), signed(r.gain, eok), signed(r.gain - d.gain, eok), r.gain < d.gain],
      ['<b>수익비</b> <small>(받는 돈 ÷ 낸 돈)</small>', x2(d.ratio), x2(r.ratio), signed(Math.round((r.ratio - d.ratio) * 100) / 100, function (v) { return v.toFixed(2) + '배'; }), r.ratio < d.ratio]
    ];
    if (r.credits.mil + r.credits.kid !== d.credits.mil + d.credits.kid) rows.push(['크레딧 인정', ym(d.credits.mil + d.credits.kid), ym(r.credits.mil + r.credits.kid), '+' + ym(r.credits.mil + r.credits.kid - d.credits.mil - d.credits.kid), false]);
    setH('np-reform', rows.map(function (x) { return '<tr><td>' + x[0] + '</td><td style="text-align:right;">' + x[1] + '</td><td style="text-align:right;">' + x[2] + '</td><td style="text-align:right;' + (x[4] ? 'color:#f04452;' : '') + '">' + x[3] + '</td></tr>'; }).join(''));
    /* 계산 내역 */
    var cap = o.income > NPR.BMAX ? ' <small>(상한 적용)</small>' : o.income < NPR.BMIN ? ' <small>(하한 적용)</small>' : '';
    var cur = NPR.rate(2026, 10, 'new', kind)[0];
    var lines = [
      ['기준소득월액' + cap, won(r.B)],
      ['보험료 낸 기간', ym(r.N) + (o.gap > 0 ? ' <small>(안 낸 ' + ym(Math.round(o.gap)) + ' 제외)</small>' : '')],
      r.credits.mil || r.credits.kid ? ['크레딧', [r.credits.mil ? '군복무 ' + r.credits.mil + '개월' : '', r.credits.kid ? '출산 ' + r.credits.kid + '개월' : ''].filter(Boolean).join(' · ')] : null,
      ['연금 가입기간 합계', ym(r.Nc), r.short ? 'fc-hl' : ''],
      ['지금(2026년) 월 보험료', won(Math.round(r.B * cur / 100)) + (kind === 'work' ? ' <small>(내 몫 ' + won(Math.round(r.B * cur / 200)) + ' · 회사 ' + won(Math.round(r.B * cur / 200)) + ')</small>' : '') + ' <small>· 요율 ' + cur + '%</small>'],
      ['평생 보험료 <small>(본인 부담)</small>', eok(r.payMine)],
      kind === 'work' ? ['평생 보험료 <small>(회사 부담 포함)</small>', eok(r.payTot)] : null,
      ['평균 보험료율 <small>(전체 기간)</small>', r.avgRate.toFixed(2) + '%'],
      r.short ? null : ['월 예상 연금 <small>(' + r.claim + '세부터' + (r.adj !== 1 ? ' · ' + (r.adj < 1 ? '조기 ' : '연기 ') + ((r.adj - 1) * 100).toFixed(1) + '%' : '') + ')</small>', won(Math.round(r.monthly / 10) * 10)],
      r.short ? null : ['내 소득 대비 연금 <small>(소득대체율)</small>', (r.replace * 100).toFixed(1) + '%'],
      r.short ? null : ['받는 기간', ym(r.months) + ' <small>(' + ageTxt(r.lifeAge) + '까지)</small>'],
      ['평생 받는 돈', eok(r.recv), 'fc-total'],
      kind === 'work' && !r.short ? ['낸 돈 대비 받는 돈 <small>(본인 부담 기준 / 회사 몫 포함)</small>', x2(r.recv / r.payMine) + ' / ' + x2(r.recv / r.payTot), 'fc-hl'] : ['낸 돈 대비 받는 돈', x2(r.ratio), 'fc-hl']
    ];
    setH('np-table', lines.filter(Boolean).map(function (x) { return '<tr' + (x[2] ? ' class="' + x[2] + '"' : '') + '><td>' + x[0] + '</td><td style="text-align:right;">' + x[1] + '</td></tr>'; }).join(''));
    /* 세대별 */
    var years = [1960, 1965, 1970, 1975, 1980, 1985, 1990, 1995, 2000, 2005];
    if (years.indexOf(birth) < 0) { years.push(birth); years.sort(function (a, b) { return a - b; }); }
    var gens = NPR.cohorts(o, years);
    var gNew = gens.map(function (g) { return g.now.short ? 0 : Math.round(g.now.ratio * 100) / 100; }), gOld = gens.map(function (g) { return g.old.short ? 0 : Math.round(g.old.ratio * 100) / 100; });
    var first = gens[0], last = gens[gens.length - 1];
    setH('np-gen-note', '같은 월 소득 ' + man(r.B) + ' · ' + Math.round(o.startAge) + '세부터 ' + Math.min(60, Math.round(o.endAge)) + '세까지 낸다고 하면 ' + first.birth + '년생은 낸 돈의 <b>' + x2(first.now.ratio) + '</b>, ' + last.birth + '년생은 <b>' + x2(last.now.ratio) + '</b>를 받습니다. 개혁 전 제도였다면 ' + last.birth + '년생은 ' + x2(last.old.ratio) + '였습니다. <small>(정상 수령 · 크레딧·안 낸 기간 제외 · 기대수명은 모든 세대에 2024 생명표 적용)</small>');
    if (typeof Chart !== 'undefined') {
      var colors = gens.map(function (g) { return g.birth === birth ? '#fe9800' : '#3182f6'; });
      var gopt = chartOpts(function (v, tip) { return tip ? (Math.round(v * 100) / 100).toFixed(2) + '배' : v + '배'; });
      gopt.plugins.tooltip.callbacks.title = function (it) { return it[0].label + (gens[it[0].dataIndex].birth === birth ? ' (나)' : ''); };
      var gdata = { labels: gens.map(function (g) { return g.birth + '년생'; }), datasets: [
        { type: 'bar', label: '개혁 후 (2026~)', data: gNew, backgroundColor: colors, borderRadius: 4, order: 2 },
        { type: 'line', label: '개혁 전 제도였다면', data: gOld, borderColor: '#9e9ea4', backgroundColor: '#9e9ea4', borderDash: [5, 4], borderWidth: 1.6, pointRadius: 2.5, fill: false, order: 1 } ] };
      if (chartG) chartG.destroy();
      chartG = new Chart($('np-gen'), { type: 'bar', data: gdata, options: gopt });
      /* 누적 */
      var a0 = Math.round(o.startAge), a1 = Math.ceil(r.lifeAge), labels = [], cp = [], cr = [], sp = 0, sr = 0;
      for (var a = a0; a <= a1; a++) {
        var row = r.byAge[a]; if (row) sp += basis === 'mine' && kind === 'work' ? row[1] : row[0];
        if (!r.short && a >= r.claim) sr += r.monthly * 12 * Math.max(0, Math.min(1, r.lifeAge - a));
        labels.push(a + '세'); cp.push(Math.round(sp)); cr.push(Math.round(sr));
      }
      var copt = chartOpts(function (v, tip) { return tip ? eok(v) : Math.round(v / 1e6) / 100 + '억'; });
      var cdata = { labels: labels, datasets: [
        { type: 'line', label: basis === 'mine' && kind === 'work' ? '누적 낸 돈 (본인)' : '누적 낸 보험료', data: cp, borderColor: '#f04452', backgroundColor: 'rgba(240,68,82,0.08)', borderWidth: 2, pointRadius: 0, fill: true, tension: 0.15 },
        { type: 'line', label: '누적 받는 연금', data: cr, borderColor: '#3182f6', backgroundColor: 'rgba(49,130,246,0.10)', borderWidth: 2, pointRadius: 0, fill: true, tension: 0.15 } ] };
      if (chartC) chartC.destroy();
      chartC = new Chart($('np-chart'), { type: 'line', data: cdata, options: copt });
    }
    /* 공유 카드 */
    share = { key: 'national-pension', chip: '국민연금 손익', title: birth + '년생 국민연금 손익',
      label: (kind === 'work' ? '직장' : '지역·임의') + '가입자 · ' + Math.round(o.startAge) + '~' + Math.round(Math.min(o.endAge, r.claim)) + '세 납부 · ' + r.claim + '세부터 수령' + (basis === 'total' ? ' · 회사 몫 포함' : ''),
      big: r.short ? '연금 없음' : x2(r.ratio), sub: r.short ? '가입 10년 미만 — 반환일시금' : payWord + ' ' + eok(r.pay) + ' → 받는 돈 ' + eok(r.recv), subSecret: true,
      rows: r.short ? [['가입기간', ym(r.Nc)]] : [['월 예상 연금', man(r.monthly), true], ['평생 손익', signed(r.gain, eok), true], ['본전 뽑는 나이', r.breakeven != null && r.breakeven <= r.lifeAge ? ageTxt(r.breakeven) : '—'], ['개혁 전이었다면', x2(d.ratio)]],
      source: '국민연금법(2025 개정 · 2026 시행) · A값 3,193,511원 · 2024 생명표 · 지금 돈 가치' };
    (window.dcShareSpec = window.dcShareSpec || {})['national-pension'] = share;   /* 오른쪽 아래 공유 창이 이 카드를 씀 */
  }
  window.fcRegister('np', render, 'npsroi');
})();

/* ════════════════════════════════════════
   [AVG] 주식 물타기·불타기 계산기 — 추가 매수 후 평균 단가 · 목표 평단 역산 · 분할 물타기 계획
   · 평균 단가 = (기존 수량 × 기존 평단 + Σ 추가 수량 × 매수가) ÷ 전체 수량   (증권사 평균단가처럼 수수료 제외)
   · 매입 원가(비용 포함) = Σ 수량 × 가격 × (1 + 매수 수수료)
   · 본전 가격 = 매입 원가 ÷ (수량 × (1 − 매도 수수료 − 매도 세금))   → 이 가격에 팔아야 비용까지 빼고 0원
   · 평가 손익 = 현재가 × 수량 × (1 − 매도 수수료 − 매도 세금) − 매입 원가
   · 목표 평단 T 를 가격 P 로 만들 추가 수량 q = 기존 수량 × (기존 평단 − T) ÷ (T − P)   (T 가 기존 평단과 P 사이일 때만)
   · 2026년 증권거래세(매도): 코스피 0.20%(거래세 0.05 + 농특세 0.15) · 코스닥 0.20% · 해외주식 거래세 없음
════════════════════════════════════════ */
var AVG = (function () {
  /* pos: {avg, qty} · buys: [{price, qty}] · cost: {buy, sell, tax} (비율, 0.00015 = 0.015%) · cur: 현재가 */
  function state(avg, qty, cost, cur) {
    var c = cost || { buy: 0, sell: 0, tax: 0 }, out = 1 - c.sell - c.tax;
    var basis = avg * qty * (1 + c.buy);
    var r = { avg: avg, qty: qty, amount: avg * qty, basis: basis };
    r.breakeven = qty > 0 && out > 0 ? basis / (qty * out) : null;
    if (cur > 0) {
      r.value = cur * qty; r.net = cur * qty * out; r.pl = r.net - basis; r.plPct = basis > 0 ? r.pl / basis : 0;
      r.need = r.breakeven != null ? r.breakeven / cur - 1 : null;      /* 현재가에서 본전까지 필요한 상승률 */
    }
    return r;
  }
  function apply(pos, buys, cost, cur) {
    var qty = pos.qty, amt = pos.avg * pos.qty, add = 0, addQty = 0, addCost = 0, rows = [];
    (buys || []).forEach(function (b) {
      if (!(b.price > 0 && b.qty > 0)) return;
      qty += b.qty; amt += b.price * b.qty; add += b.price * b.qty; addQty += b.qty;
      addCost += b.price * b.qty * (1 + (cost ? cost.buy : 0));
      rows.push({ price: b.price, qty: b.qty, amount: b.price * b.qty, avg: amt / qty, totalQty: qty });
    });
    var before = state(pos.avg, pos.qty, cost, cur), after = state(qty > 0 ? amt / qty : 0, qty, cost, cur);
    return { before: before, after: after, add: add, addQty: addQty, addCost: addCost, rows: rows, drop: pos.avg > 0 ? after.avg / pos.avg - 1 : 0 };
  }
  /* 목표 평단 T 를 가격 P 로 사서 만들 때 필요한 수량 (정수 주식이면 올림) */
  function target(pos, T, P, whole) {
    var num = pos.qty * (pos.avg - T), den = T - P;
    if (!(pos.qty > 0 && pos.avg > 0 && T > 0 && P > 0)) return { err: 'input' };
    if (Math.abs(T - pos.avg) < 1e-12) return { err: 'same' };
    if (Math.abs(den) < 1e-12) return { err: 'price-eq' };                                 /* 목표와 같은 가격으로는 영원히 못 맞춤 */
    if (!(num / den > 0)) return { err: T < pos.avg ? 'price-high' : 'price-low' };   /* 물타기는 P < T, 불타기는 P > T 여야 함 */
    var q = num / den;
    if (whole) q = Math.ceil(q - 1e-9);
    var avg = (pos.avg * pos.qty + P * q) / (pos.qty + q);
    return { qty: q, amount: q * P, avg: avg, exact: num / den };
  }
  /* 분할 물타기 계획: 현재가에서 step 만큼씩 내릴 때마다 매수
     mode 'amount'(같은 금액) | 'qty'(같은 수량) | 'double'(직전의 2배 금액) · first: 1회차 금액 또는 수량 */
  function plan(pos, cur, o, cost) {
    var qty = pos.qty, amt = pos.avg * pos.qty, invested = 0, rows = [], prevAmt = 0;
    for (var k = 1; k <= o.steps; k++) {
      var price = cur * (1 - o.step * k);
      if (!(price > 0)) break;
      var q;
      if (o.mode === 'qty') q = o.first;
      else {
        var money = o.mode === 'double' ? (k === 1 ? o.first : prevAmt * 2) : o.first;
        q = o.whole ? Math.floor(money / (price * (1 + (cost ? cost.buy : 0)))) : money / price;
      }
      if (!(q > 0)) { rows.push({ k: k, price: price, qty: 0, amount: 0, invested: invested, avg: qty ? amt / qty : 0, skip: true }); continue; }
      var a = price * q; prevAmt = a;
      qty += q; amt += a; invested += a * (1 + (cost ? cost.buy : 0));
      var st = state(amt / qty, qty, cost, price);
      rows.push({ k: k, price: price, qty: q, amount: a, invested: invested, avg: amt / qty, totalQty: qty, basis: st.basis, breakeven: st.breakeven, need: st.need, pl: st.pl, plPct: st.plPct });
    }
    return rows;
  }
  return { state: state, apply: apply, target: target, plan: plan };
})();

/* [AVG] 화면 — 입력(data-fc="av")은 [FC-UI] 공통 처리 */
(function () {
  if (!document.getElementById('page-avgdown')) return;
  function $(id) { return document.getElementById(id); }
  function setT(id, v) { var e = $(id); if (e) e.textContent = v; }
  function setH(id, v) { var e = $(id); if (e) e.innerHTML = v; }
  function numOf(id) { var e = $(id); if (!e) return 0; var s = String(e.value).replace(/,/g, '').trim(); return s === '' ? NaN : parseFloat(s); }
  function seg(name) { var b = document.querySelector('.fc-seg[data-name="' + name + '"] .mode-btn.active'); return b ? b.getAttribute('data-v') : null; }
  var FEES = { kr: { fb: '0.015', fs: '0.015', tax: '0.2' }, us: { fb: '0.25', fs: '0.25', tax: '0' } };
  var mkt = 'kr', lastMkt = 'kr', chart = null, share = null;
  function nfmt(v, max) { return (+v).toLocaleString('ko-KR', { maximumFractionDigits: max }); }
  function price(v) { if (v == null || !isFinite(v)) return '—'; return mkt === 'us' ? '$' + nfmt(v, 2) : nfmt(v, v < 1000 ? 2 : (Math.abs(v - Math.round(v)) < 1e-6 ? 0 : 1)) + '원'; }
  function money(v) {
    if (v == null || !isFinite(v)) return '—';
    var neg = v < 0, a = Math.abs(v);
    if (mkt === 'us') return (neg ? '−' : '') + '$' + nfmt(a, 2);
    return (neg ? '−' : '') + Math.round(a).toLocaleString('ko-KR') + '원';
  }
  function sMoney(v) { return (v > 0 ? '+' : '') + money(v); }
  function qtyT(v) { return nfmt(v, 4) + '주'; }
  function pct(v, d) { return v == null || !isFinite(v) ? '—' : (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v * 100).toFixed(d == null ? 2 : d) + '%'; }
  function plCls(v) { return v > 0 ? 'av-up' : v < 0 ? 'av-dn' : ''; }
  function setFees(m) {      /* 시장을 바꾸면, 비용 칸이 이전 시장 기본값 그대로일 때만 새 시장 기본값으로 */
    var prev = FEES[lastMkt], next = FEES[m];
    ['fb', 'fs', 'tax'].forEach(function (k) { var e = $('av-' + k); if (String(numOf('av-' + k)) === String(+prev[k]) || e.value === '') e.value = next[k]; });
  }
  function clear(msg) {
    setT('av-val', '—'); setT('av-sub', msg); ['av-k1', 'av-k2', 'av-k3'].forEach(function (k) { setT(k, '—'); });
    ['av-cmp', 'av-ladder', 'av-steps', 'av-steps-h', 'av-tips'].forEach(function (k) { setH(k, ''); });
    $('av-chart-wrap').style.display = 'none';
    share = null; (window.dcShareSpec = window.dcShareSpec || {})['averaging-down'] = null;
  }
  /* 전·후 비교 — curA: '후'를 평가할 가격 (분할 매수 계획은 다 산 시점의 마지막 매수가) */
  function cmpRows(b, a, cur, curA) {
    curA = curA || cur;
    var lb = AVG.state(b.avg, b.qty, COST, cur * 0.9), la = AVG.state(a.avg, a.qty, COST, curA * 0.9), same = curA === cur;
    var rows = [
      ['평균 단가', price(b.avg), price(a.avg), true],
      ['보유 수량', qtyT(b.qty), qtyT(a.qty)],
      ['매입 금액', money(b.amount), money(a.amount)],
      ['평가 금액 <small>(' + (same ? '현재가' : '전: 현재가 · 후: ' + price(curA)) + ')</small>', money(b.value), money(a.value)],
      ['평가 손익', '<span class="' + plCls(b.pl) + '">' + sMoney(b.pl) + ' (' + pct(b.plPct) + ')</span>', '<span class="' + plCls(a.pl) + '">' + sMoney(a.pl) + ' (' + pct(a.plPct) + ')</span>'],
      ['본전 가격' + (FEEON ? ' <small>(비용 포함)</small>' : ''), price(b.breakeven), price(a.breakeven), true],
      ['본전까지 필요한 상승', pct(b.need, 1), pct(a.need, 1), true],
      ['추가 10% 하락하면 <small>(' + (same ? price(cur * 0.9) : '각 가격에서') + ')</small>', '<span class="av-dn">' + sMoney(lb.pl) + '</span>', '<span class="av-dn">' + sMoney(la.pl) + '</span>']
    ];
    return rows.map(function (x) { return '<tr' + (x[3] ? ' class="fc-hl"' : '') + '><td>' + x[0] + '</td><td style="text-align:right;">' + x[1] + '</td><td style="text-align:right;">' + x[2] + '</td></tr>'; }).join('');
  }
  function ladder(items, cur) {
    items = items.filter(function (x) { return x && x[1] > 0 && isFinite(x[1]); }).sort(function (p, q) { return q[1] - p[1]; });
    return items.map(function (x) {
      var d = x[1] / cur - 1;
      return '<li><i style="background:' + x[2] + ';"></i><span>' + x[0] + '</span><b>' + price(x[1]) + '</b><em class="' + (Math.abs(d) < 5e-5 ? '' : plCls(d)) + '">' + (Math.abs(d) < 5e-5 ? '현재가' : pct(d, 1)) + '</em></li>';
    }).join('');
  }
  var COST = null, FEEON = true;
  function render() {
    var m = seg('av-mkt') || 'kr';
    if (m !== lastMkt) { setFees(m); lastMkt = m; }
    mkt = m;
    document.querySelectorAll('#page-avgdown .av-ccy').forEach(function (e) { e.textContent = m === 'us' ? '$' : '원'; });
    var mode = seg('av-mode') || 'buy', by = seg('av-by') || 'qty', pm = seg('av-pm') || 'amount';
    $('av-buy-box').style.display = mode === 'buy' ? '' : 'none';
    $('av-target-box').style.display = mode === 'target' ? '' : 'none';
    $('av-plan-box').style.display = mode === 'plan' ? '' : 'none';
    document.querySelectorAll('#page-avgdown .av-qu').forEach(function (e) { e.textContent = by === 'money' ? (m === 'us' ? '$' : '원') : '주'; });
    for (var i = 1; i <= 5; i++) { var qe = $('av-q' + i); qe.setAttribute('aria-label', i + '차 ' + (by === 'money' ? '매수 금액' : '수량')); if (i > 1) qe.placeholder = by === 'money' ? '금액' : '수량'; }
    setT('av-by-hint', by === 'money' ? '금액만큼 1주 단위로 삽니다 (수수료 포함) · 빈 줄은 빠짐' : '빈 줄은 계산에서 빠집니다 · 최대 5번');
    setT('av-first-l', pm === 'qty' ? '1회 매수 수량' : pm === 'double' ? '1회차 매수 금액 (다음부터 2배씩)' : '1회 매수 금액');
    setT('av-first-u', pm === 'qty' ? '주' : (m === 'us' ? '$' : '원'));
    FEEON = $('av-fee-on').checked;
    $('av-fee-box').style.display = FEEON ? '' : 'none'; $('av-fee-note').style.display = FEEON ? '' : 'none';
    var fb = numOf('av-fb'), fs = numOf('av-fs'), tx = numOf('av-tax');
    COST = FEEON ? { buy: (fb || 0) / 100, sell: (fs || 0) / 100, tax: (tx || 0) / 100 } : { buy: 0, sell: 0, tax: 0 };
    var avg = numOf('av-avg'), qty = numOf('av-qty'), cur = numOf('av-cur'), pos = { avg: avg, qty: qty };
    var err = !(avg > 0) ? '평균 단가를 넣어 주세요.' : !(qty > 0) ? '보유 수량을 넣어 주세요.' : !(cur > 0) ? '현재가를 넣어 주세요.'
      : FEEON && !(fb >= 0 && fs >= 0 && tx >= 0 && fs + tx < 100 && fb < 100) ? '수수료·세금을 0 이상으로 넣어 주세요.' : '';
    if (err) return clear(err);
    var before = AVG.state(avg, qty, COST, cur), tips = [], steps = '', head = '', title = '회차별 매수';
    $('av-chart-wrap').style.display = 'none'; $('av-cmp-card').style.display = '';
    if (mode === 'buy' || mode === 'target') {
      var buys = [], res, t = null;
      if (mode === 'buy') {
        for (var k = 1; k <= 5; k++) {
          var p = numOf('av-p' + k), v = numOf('av-q' + k);
          if (!(p > 0) || !(v > 0)) continue;
          var q = by === 'money' ? Math.floor(v / (p * (1 + COST.buy)) + 1e-9) : v;
          buys.push({ price: p, qty: q, money: by === 'money' ? v : null, k: k });
        }
        if (!buys.length) return clear('추가 매수가와 ' + (by === 'money' ? '금액' : '수량') + '을 한 줄 이상 넣어 주세요.');
        if (!buys.some(function (b) { return b.qty > 0; })) return clear('금액이 1주 가격보다 적습니다.');
      } else {
        var T = numOf('av-t'), P = numOf('av-tp');
        t = AVG.target(pos, T, P, true);
        if (t.err) return clear({ input: '목표 평단과 추가 매수가를 넣어 주세요.', same: '목표 평단이 지금 평단과 같습니다.', 'price-eq': '추가 매수가가 목표 평단과 같으면 아무리 사도 목표에 닿지 않습니다.',
          'price-high': '물타기로 평단을 낮추려면 추가 매수가가 목표 평단(' + price(T) + ')보다 낮아야 합니다.', 'price-low': '불타기로 평단을 올리려면 추가 매수가가 목표 평단(' + price(T) + ')보다 높아야 합니다.' }[t.err]);
        buys = [{ price: P, qty: t.qty, k: 1 }];
      }
      res = AVG.apply(pos, buys, COST, cur);
      var a = res.after, up = a.avg > avg;
      var word = up ? '불타기' : '물타기';
      setT('av-cmp-title', word + ' 전 vs 후');
      if (mode === 'buy') {
        setT('av-label', word + ' 후 평균 단가'); setT('av-val', price(a.avg));
        setH('av-sub', '평단 ' + price(avg) + ' → <b>' + price(a.avg) + '</b> (' + pct(res.drop) + ') · 본전까지 ' + pct(before.need, 1) + ' → <b>' + pct(a.need, 1) + '</b>');
        setT('av-k1-l', '추가 매수 금액'); setT('av-k1', money(res.addCost) + '');
      } else {
        setT('av-label', '목표 평단 ' + price(numOf('av-t')) + '까지 필요한 매수'); setT('av-val', qtyT(t.qty));
        setH('av-sub', price(numOf('av-tp')) + '에 <b>' + qtyT(t.qty) + '</b> · <b>' + money(t.amount * (1 + COST.buy)) + '</b> 더 사면 평단 <b>' + price(a.avg) + '</b>' + (Math.abs(t.exact - t.qty) > 1e-9 ? ' <small>(정확히는 ' + nfmt(t.exact, 2) + '주 → 1주 단위로 올림)</small>' : ''));
        setT('av-k1-l', '필요한 금액'); setT('av-k1', money(t.amount * (1 + COST.buy)));
      }
      setT('av-k2-l', '본전까지 필요한 상승'); setH('av-k2', pct(before.need, 1) + ' → ' + pct(a.need, 1));
      setT('av-k3-l', '평가 손익 (' + word + ' 후)'); setH('av-k3', '<span class="' + plCls(a.pl) + '">' + sMoney(a.pl) + '</span>');
      setH('av-cmp', cmpRows(before, a, cur));
      setH('av-ladder', ladder([['현재가', cur, '#9e9ea4'], ['기존 평단', avg, '#6d6d76'], [word + ' 후 평단', a.avg, '#3182f6'], [FEEON ? '본전 가격 (비용 포함)' : '본전 가격', a.breakeven, '#22a06b']], cur));
      /* 회차 표 */
      head = '<tr><th>회차</th><th style="text-align:right;">매수가</th><th style="text-align:right;">수량</th><th style="text-align:right;">금액</th><th style="text-align:right;">누적 평단</th></tr>';
      steps = '<tr><td>지금</td><td style="text-align:right;">' + price(avg) + '</td><td style="text-align:right;">' + qtyT(qty) + '</td><td style="text-align:right;">' + money(avg * qty) + '</td><td style="text-align:right;">' + price(avg) + '</td></tr>' +
        res.rows.map(function (rw, i) { var b = buys.filter(function (x) { return x.qty > 0; })[i] || {}; return '<tr><td>' + (mode === 'target' ? '추가' : (b.k || i + 1) + '차') + '</td><td style="text-align:right;">' + price(rw.price) + '</td><td style="text-align:right;">' + qtyT(rw.qty) + '</td><td style="text-align:right;">' + money(rw.amount) + (b.money ? ' <small>(남는 돈 ' + money(b.money - rw.amount * (1 + COST.buy)) + ')</small>' : '') + '</td><td style="text-align:right;">' + price(rw.avg) + '</td></tr>'; }).join('') +
        '<tr class="fc-total"><td>합계</td><td></td><td style="text-align:right;">' + qtyT(a.qty) + '</td><td style="text-align:right;">' + money(a.amount) + '</td><td style="text-align:right;">' + price(a.avg) + '</td></tr>';
      title = mode === 'target' ? '매수 내역' : '회차별 매수';
      /* 체크 포인트 */
      var ratio = res.add / (avg * qty);
      if (!up) {
        tips.push('평단은 ' + pct(res.drop, 1) + ' 내려갔고, 이 종목에 넣은 돈은 ' + money(avg * qty) + ' → ' + money(a.amount) + '로 <b>' + (1 + ratio).toFixed(2) + '배</b>가 됐습니다.');
        var l0 = AVG.state(avg, qty, COST, cur * 0.9).pl, l1 = AVG.state(a.avg, a.qty, COST, cur * 0.9).pl;
        tips.push('여기서 10% 더 떨어지면 손실이 ' + money(-l0) + '(물타기 안 했을 때) 대신 <b>' + money(-l1) + '</b>가 됩니다.');
        if (a.avg > cur) tips.push('현재가 ' + price(cur) + '에서 <b>' + pct(a.need, 1) + '</b> 오르면 본전입니다 (물타기 전에는 ' + pct(before.need, 1) + ').');
        if (before.plPct < -0.3) tips.push('지금 손실률이 ' + pct(before.plPct, 1) + '입니다. 손실이 커질수록 본전에 필요한 상승률은 급격히 커집니다 (−50%면 +100%).');
      } else {
        tips.push('불타기로 평단이 ' + pct(res.drop, 1) + ' 올랐습니다. 수익률은 낮아지지만 오르는 종목의 비중이 커집니다.');
        tips.push('현재가가 새 평단 ' + price(a.avg) + ' 아래로 ' + pct(a.avg / cur - 1, 1) + '만 떨어져도 손실로 바뀝니다.');
      }
      if (by === 'money' && mode === 'buy' && buys.some(function (b) { return b.qty === 0; })) tips.push('금액이 1주 가격보다 적은 줄은 매수하지 않았습니다.');
      /* 공유 카드 */
      share = { key: 'averaging-down', chip: up ? '불타기 계산기' : '물타기 계산기', title: '평단 ' + price(avg) + ' → ' + price(a.avg),
        label: (mode === 'target' ? '목표 평단 만들기 · ' : '') + '현재가 ' + price(cur) + ' · ' + (m === 'us' ? '해외 주식' : '국내 주식'),
        big: price(a.avg), sub: '본전까지 ' + pct(before.need, 1) + ' → ' + pct(a.need, 1),
        rows: [['평단 변화', pct(res.drop, 1)], ['추가 매수 금액', money(res.addCost), true], ['보유 수량', qtyT(qty) + ' → ' + qtyT(a.qty)], ['평가 손익', sMoney(a.pl) + ' (' + pct(a.plPct, 1) + ')', true]],
        source: '평균 단가 = 매입 금액 합 ÷ 전체 수량' + (FEEON ? ' · 수수료·거래세 반영 본전가' : '') };
    } else {
      /* 분할 매수 계획 */
      var n = +$('av-n').value, step = numOf('av-step') / 100, first = numOf('av-first');
      if (!(step > 0 && step < 1)) return clear('하락 간격을 0~100% 사이로 넣어 주세요.');
      if (!(first > 0)) return clear(pm === 'qty' ? '1회 매수 수량을 넣어 주세요.' : '1회 매수 금액을 넣어 주세요.');
      var rows = AVG.plan(pos, cur, { steps: n, step: step, mode: pm, first: first, whole: true }, COST);
      var done = rows.filter(function (x) { return !x.skip; });
      if (!done.length) return clear('1회 매수 금액이 1주 가격보다 적습니다.');
      var last = done[done.length - 1];
      setH('av-cmp-title', '물타기 전 vs ' + last.k + '번 산 뒤 <small class="fc-sub-inline">전: 현재가 ' + price(cur) + ' · 후: 마지막 매수가 ' + price(last.price) + '에서 평가</small>');
      setT('av-label', last.k + '번 나눠 산 뒤 평균 단가 (' + price(last.price) + '까지 하락 시)'); setT('av-val', price(last.avg));
      setH('av-sub', '총 <b>' + money(last.invested) + '</b> 추가 투입 · 평단 ' + price(avg) + ' → <b>' + price(last.avg) + '</b> (' + pct(last.avg / avg - 1, 1) + ')');
      setT('av-k1-l', '총 추가 투입'); setT('av-k1', money(last.invested));
      setT('av-k2-l', '마지막 가격에서 본전까지'); setT('av-k2', pct(last.need, 1));
      setT('av-k3-l', '현재가까지만 회복해도'); var atCur = AVG.state(last.avg, last.totalQty, COST, cur);
      setH('av-k3', '<span class="' + plCls(atCur.pl) + '">' + sMoney(atCur.pl) + '</span>');
      setH('av-cmp', cmpRows(before, AVG.state(last.avg, last.totalQty, COST, last.price), cur, last.price));
      setH('av-ladder', ladder([['현재가', cur, '#9e9ea4'], ['기존 평단', avg, '#6d6d76'], ['계획 후 평단', last.avg, '#3182f6'], ['본전 가격' + (FEEON ? ' (비용 포함)' : ''), last.breakeven, '#22a06b'], ['마지막 매수가', last.price, '#f04452']], cur));
      head = '<tr><th>회차</th><th style="text-align:right;">매수가</th><th style="text-align:right;">수량</th><th style="text-align:right;">금액</th><th style="text-align:right;">누적 투입</th><th style="text-align:right;">평단</th><th style="text-align:right;">본전까지</th></tr>';
      steps = rows.map(function (x) {
        return '<tr' + (x.skip ? ' style="opacity:.5;"' : '') + '><td>' + x.k + '차 <small>(' + pct(-step * x.k, 0) + ')</small></td><td style="text-align:right;">' + price(x.price) + '</td><td style="text-align:right;">' + (x.skip ? '살 수 없음' : qtyT(x.qty)) + '</td><td style="text-align:right;">' + money(x.amount) + '</td><td style="text-align:right;">' + money(x.invested) + '</td><td style="text-align:right;">' + price(x.avg) + '</td><td style="text-align:right;">' + (x.skip ? '—' : pct(x.need, 1)) + '</td></tr>';
      }).join('');
      title = '단계별 매수 계획 <small class="fc-sub-inline">현재가에서 ' + Math.round(step * 1000) / 10 + '%씩 내릴 때마다</small>';
      if (typeof Chart !== 'undefined') {
        $('av-chart-wrap').style.display = '';
        var lbl = ['지금'].concat(done.map(function (x) { return x.k + '차'; }));
        var fmtY = function (v) { return mkt === 'us' ? '$' + nfmt(v, 2) : (v >= 1e4 ? nfmt(Math.round(v / 1e3) / 10, 1) + '만' : nfmt(v, 0)); };
        var ds = [
          { label: '매수가', data: [cur].concat(done.map(function (x) { return x.price; })), borderColor: '#f04452', backgroundColor: '#f04452', borderWidth: 2, pointRadius: 3, tension: 0 },
          { label: '평균 단가', data: [avg].concat(done.map(function (x) { return x.avg; })), borderColor: '#3182f6', backgroundColor: '#3182f6', borderWidth: 2, pointRadius: 3, tension: 0 },
          { label: '본전 가격', data: [before.breakeven].concat(done.map(function (x) { return x.breakeven; })), borderColor: '#22a06b', borderDash: [5, 4], borderWidth: 1.6, pointRadius: 0, tension: 0 }
        ];
        var opt = { responsive: true, maintainAspectRatio: false, animation: false, interaction: { mode: 'index', intersect: false },
          plugins: { legend: { display: true, position: 'bottom', labels: { color: '#9e9ea4', boxWidth: 10, boxHeight: 10, font: { size: 11 } } },
            tooltip: { backgroundColor: '#202027', borderColor: fgA(0.1), borderWidth: 1, titleColor: '#9e9ea4', bodyColor: '#e4e4e5', padding: 12, callbacks: { label: function (c) { return ' ' + c.dataset.label + ': ' + price(c.parsed.y); } } } },
          scales: { x: { ticks: { color: '#6d6d76', font: { size: 11 } }, grid: { display: false }, border: { display: false } },
                    y: { ticks: { color: '#6d6d76', font: { size: 11 }, callback: fmtY }, grid: { color: fgA(0.04) }, border: { display: false } } } };
        if (chart) chart.destroy();
        chart = new Chart($('av-chart'), { type: 'line', data: { labels: lbl, datasets: ds }, options: opt });
      }
      var mult = last.invested / (avg * qty * (1 + COST.buy));
      tips.push(last.k + '번 모두 사면 지금 보유 금액의 <b>' + mult.toFixed(1) + '배</b>(' + money(last.invested) + ')를 더 넣게 됩니다. 그만큼 현금을 준비해 둘 수 있는지 먼저 확인하세요.');
      tips.push('주가가 ' + price(last.price) + '까지 내려가 계획대로 다 산 뒤에는 <b>' + pct(last.need, 1) + '</b>만 올라도 본전입니다 — 현재가(' + price(cur) + ')까지만 돌아와도 ' + sMoney(atCur.pl) + '.');
      if (pm === 'double') tips.push('2배씩 늘리면 마지막 회차 한 번에 ' + money(last.amount) + '이 들어갑니다. 하락이 계획보다 길어지면 감당하기 어려워질 수 있습니다.');
      if (rows.some(function (x) { return x.skip; })) tips.push('일부 회차는 금액이 1주 가격보다 적어 매수하지 못했습니다.');
      if (rows.length < n) tips.push(Math.round(step * 1000) / 10 + '%씩 ' + n + '번이면 가격이 0원 아래로 내려가므로 ' + rows.length + '번까지만 계산했습니다. 하락 간격이나 횟수를 줄여 보세요.');
      share = { key: 'averaging-down', chip: '분할 매수 계획', title: n + '번 나눠 물타기 · ' + Math.round(step * 1000) / 10 + '%씩',
        label: '현재가 ' + price(cur) + ' → ' + price(last.price) + '까지 · ' + { amount: '같은 금액', qty: '같은 수량', double: '2배씩' }[pm],
        big: price(last.avg), sub: '평단 ' + price(avg) + ' → ' + price(last.avg) + ' · 본전까지 ' + pct(last.need, 1),
        rows: [['총 추가 투입', money(last.invested), true], ['평단 변화', pct(last.avg / avg - 1, 1)], ['마지막 매수가', price(last.price)], ['현재가 회복 시', sMoney(atCur.pl), true]],
        source: '평균 단가 = 매입 금액 합 ÷ 전체 수량' + (FEEON ? ' · 수수료·거래세 반영' : '') };
    }
    setH('av-steps-title', title); setH('av-steps-h', head); setH('av-steps', steps);
    setH('av-tips', tips.map(function (x) { return '<li>' + x + '</li>'; }).join(''));
    (window.dcShareSpec = window.dcShareSpec || {})['averaging-down'] = share;   /* 오른쪽 아래 공유 창이 이 카드를 씀 */
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('.av-tq button'); if (!b) return;
    var avg = numOf('av-avg'), cur = numOf('av-cur'), k = b.getAttribute('data-k'), v;
    if (!(avg > 0)) return;
    v = k === 'mid' ? (avg + (cur > 0 ? cur : avg)) / 2 : avg * (1 + (+k) / 100);
    $('av-t').value = (mkt === 'us' ? Math.round(v * 100) / 100 : Math.round(v)).toLocaleString('ko-KR', { maximumFractionDigits: 2 });
    if (cur > 0) $('av-tp').value = $('av-cur').value;
    render();
  });
  window.fcRegister('av', render, 'avgdown');
})();

/* ════════════════════════════════════════
   [CGT] 부동산 양도소득세 계산기 — 2026년 현행 소득세법 기준 (거주자)
   근거(2026-10 확인)
   · 양도차익 = 양도가액 − 취득가액 − 필요경비(취득세·중개·법무 등 취득 부대비용, 자본적 지출, 양도 비용)
   · 1세대 1주택 비과세(소득세법 §89, 시행령 §154): 2년 이상 보유(취득 당시 조정대상지역이면 2년 거주도) · 양도가액 12억원 이하 전액 비과세
       12억원 초과(고가주택): 과세 양도차익 = 양도차익 × (양도가액 − 12억) ÷ 양도가액 (시행령 §160)
       일시적 2주택: 종전 주택을 신규 주택 취득일부터 3년 안에 팔고 종전 주택이 비과세 요건을 갖추면 1주택처럼 비과세
   · 장기보유특별공제(§95②): 3년 이상 보유한 토지·건물 — 표1 연 2%(15년 30%)
       1세대 1주택(2년 이상 거주) 표2: 보유 연 4%(최대 40%) + 거주 연 4%(최대 40%, 2~3년 8%) — 최대 80%
       다주택 중과 대상 주택 · 분양권 · 미등기: 공제 없음
   · 기본공제(§103) 250만원(사람별 연 1회) · 지방소득세 = 양도소득세의 10%
   · 세율(§104)
       기본세율 6~45%: 1,400만 6% · 5,000만 15% · 8,800만 24% · 1.5억 35% · 3억 38% · 5억 40% · 10억 42% · 초과 45%
       주택·조합원입주권: 1년 미만 70% · 2년 미만 60%    분양권: 1년 미만 70% · 1년 이상 60%
       토지·건물(주택 외): 1년 미만 50% · 2년 미만 40%    비사업용 토지: 기본세율 + 10%p (단기는 큰 세액)
       다주택 중과(§104⑦): 조정대상지역 주택 — 1세대 2주택 +20%p · 3주택 이상 +30%p, 단기 세율과 비교해 큰 세액
         2022.5.10~2026.5.9 양도분은 중과 한시 배제 → 연장 없이 종료, 2026.5.10 양도분부터 중과 재개
         경과조치(시행령 2026.3.1): 2026.5.9까지 계약·계약금 지급 + 계약일부터 4개월(기존 조정)·6개월(신규 조정) 안에 양도하면 배제
         조정대상지역(2025.10.16~): 서울 25개 구 전역 · 경기 과천·광명·의왕·하남, 성남 분당·수정·중원, 수원 영통·장안·팔달, 안양 동안, 용인 수지
   · 양도 시기: 잔금 청산일과 등기 접수일 중 빠른 날 · 예정신고: 양도일이 속한 달의 말일부터 2개월 이내
════════════════════════════════════════ */
var CGT = (function () {
  var HIGH = 12e8, BASIC_DED = 250e4, SURCHARGE_FROM = '2026-05-10';
  var BR = [[14e6, 0.06, 0], [50e6, 0.15, 126e4], [88e6, 0.24, 576e4], [150e6, 0.35, 1544e4], [300e6, 0.38, 1994e4], [500e6, 0.40, 2594e4], [1e9, 0.42, 3594e4], [Infinity, 0.45, 6594e4]];
  function basicTax(tb) { if (!(tb > 0)) return 0; for (var i = 0; i < BR.length; i++) if (tb <= BR[i][0]) return tb * BR[i][1] - BR[i][2]; return 0; }
  function marginal(tb) { for (var i = 0; i < BR.length; i++) if (tb <= BR[i][0]) return BR[i][1]; return 0.45; }
  function parse(d) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d || ''); return m ? { y: +m[1], m: +m[2], d: +m[3] } : null; }
  function iso(x) { return x.y + '-' + String(x.m).padStart(2, '0') + '-' + String(x.d).padStart(2, '0'); }
  /* 만 보유 연수 — 취득일 다음 날부터 셈(초일 불산입): 취득일의 n년 뒤 같은 날 이후면 n년 */
  function years(a, b) { var y = b.y - a.y; if (b.m < a.m || (b.m === a.m && b.d < a.d)) y--; return Math.max(0, y); }
  function addYears(a, n) { var y = a.y + n, m = a.m, d = a.d; if (m === 2 && d === 29 && !(y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0))) d = 28; return { y: y, m: m, d: d }; }
  function dueDate(s) { var y = s.y, m = s.m + 2; if (m > 12) { m -= 12; y++; } return { y: y, m: m, d: new Date(Date.UTC(y, m, 0)).getUTCDate() }; }
  /* o: {type 'house'|'presale'|'land'|'nonbiz', sell, buy, costAcq, costSell, acq 'YYYY-MM-DD', sale 'YYYY-MM-DD', reside(년),
         houses 1|2|3, adjusted(양도 주택이 조정대상지역), adjAtAcq(취득 당시 조정대상지역 — 비과세 2년 거주 요건), temp2(일시적 2주택 특례),
         exclude(중과 배제 주택), transition(2026.5.9 이전 계약 경과조치), owners 1|2} */
  function calc(o) {
    var a = parse(o.acq), s = parse(o.sale);
    if (!a || !s || iso(s) < iso(a)) return { err: 'date' };
    var hold = years(a, s), reside = Math.max(0, Math.floor((o.reside || 0) + 1e-9)), type = o.type || 'house', n = o.owners === 2 ? 2 : 1;
    var cost = (o.costAcq || 0) + (o.costSell || 0), gain = o.sell - o.buy - cost;
    var r = { hold: hold, reside: reside, gain: gain, cost: cost, type: type, due: iso(dueDate(s)), owners: n };
    if (!(gain > 0)) { r.zero = true; r.tax = r.local = r.total = 0; r.taxGain = 0; return r; }
    var oneHouse = type === 'house' && (o.houses === 1 || o.temp2);
    var exemptOk = oneHouse && hold >= 2 && (!o.adjAtAcq || reside >= 2);
    r.oneHouse = oneHouse; r.exemptOk = exemptOk;
    var taxGain = gain;
    if (exemptOk) {
      if (o.sell <= HIGH) { r.exempt = 'full'; r.taxGain = 0; r.tax = r.local = r.total = 0; r.saved = null; return r; }
      taxGain = gain * (o.sell - HIGH) / o.sell; r.exempt = 'high';
    }
    r.taxGain = taxGain;
    /* 중과 여부 */
    var sur = 0;
    if (type === 'house' && !oneHouse && o.houses >= 2 && o.adjusted && !o.exclude) {
      if (iso(s) >= SURCHARGE_FROM && !o.transition) sur = o.houses >= 3 ? 0.3 : 0.2;
      else r.deferred = true;                                          /* 유예 기간 또는 경과조치 → 기본세율 */
    }
    r.sur = sur;
    /* 장기보유특별공제 */
    var ltd = 0, table = '';
    if (hold >= 3 && type !== 'presale' && !sur) {
      if (exemptOk && reside >= 2) { ltd = Math.min(0.4, 0.04 * hold) + (reside >= 3 ? Math.min(0.4, 0.04 * reside) : 0.08); table = '1세대 1주택 (보유 ' + Math.round(Math.min(40, 4 * hold)) + '% + 거주 ' + Math.round(reside >= 3 ? Math.min(40, 4 * reside) : 8) + '%)'; }
      else { ltd = Math.min(0.3, 0.02 * hold); table = '일반 (보유 ' + hold + '년 × 2%)'; }
    }
    r.ltdRate = ltd; r.ltdTable = table; r.ltd = taxGain * ltd;
    r.income = taxGain - r.ltd;                                        /* 양도소득금액 */
    var each = r.income / n, base = Math.max(0, each - BASIC_DED);
    r.basicDed = Math.min(each, BASIC_DED) * n; r.taxBase = base * n;
    /* 세율 — 단기 보유 세율과 (중과·비사업용 가산) 누진세율 중 큰 세액 (§104 ⑦·①) */
    var short = type === 'presale' ? (hold < 1 ? 0.7 : 0.6) : type === 'house' ? (hold < 1 ? 0.7 : hold < 2 ? 0.6 : null) : (hold < 1 ? 0.5 : hold < 2 ? 0.4 : null);
    var add = type === 'nonbiz' ? 0.1 : sur, prog = basicTax(base) + add * base, t, rule, rate;
    var addTxt = type === 'nonbiz' ? '기본세율 + 10%p (비사업용 토지)' : '기본세율 + ' + add * 100 + '%p (' + (o.houses >= 3 ? '3주택 이상' : '2주택') + ' 중과)';
    if (type === 'presale') { t = base * short; rule = '분양권 ' + short * 100 + '% (보유 ' + (hold < 1 ? '1년 미만' : '1년 이상') + ')'; rate = short; }
    else if (short != null) {
      var st = base * short;
      if (add && prog > st) { t = prog; rule = addTxt + ' — 단기 ' + short * 100 + '%보다 큼'; rate = marginal(base) + add; }
      else { t = st; rule = '단기 보유 ' + short * 100 + '% (' + (hold < 1 ? '1년 미만' : '2년 미만') + ')' + (add ? ' — ' + addTxt.split(' (')[0] + '보다 큼' : ''); rate = short; }
    } else { t = prog; rule = add ? addTxt : '기본세율 6~45%'; rate = marginal(base) + add; }
    r.rule = rule; r.marginal = rate;
    r.taxEach = Math.floor(t); r.tax = r.taxEach * n;                  /* 원 단위 아래 버림 */
    r.localEach = Math.floor(r.taxEach * 0.1); r.local = r.localEach * n;
    r.total = r.tax + r.local; r.eff = r.total / gain;
    return r;
  }
  /* 같은 거래를 다른 날 팔았다면 — 보유 1·2·3년, 다음 보유·거주 연수가 차는 날 */
  function laterDates(o) {
    var a = parse(o.acq), s = parse(o.sale); if (!a || !s) return [];
    var cand = [], hold = years(a, s);
    for (var k = hold + 1; k <= Math.min(hold + 3, 16); k++) cand.push(addYears(a, k));
    return cand.map(function (d) { var p = {}; for (var k in o) p[k] = o[k]; p.sale = iso(d); p.reside = o.resideGrows ? (o.reside || 0) + years(s, d) : o.reside; return { date: p.sale, r: calc(p) }; });
  }
  return { calc: calc, basicTax: basicTax, years: years, laterDates: laterDates, parse: parse, iso: iso, HIGH: HIGH, SURCHARGE_FROM: SURCHARGE_FROM };
})();

/* [CGT] 화면 — 입력(data-fc="cgt")은 [FC-UI] 공통 처리 */
(function () {
  if (!document.getElementById('page-cgt')) return;
  function $(id) { return document.getElementById(id); }
  function setT(id, v) { var e = $(id); if (e) e.textContent = v; }
  function setH(id, v) { var e = $(id); if (e) e.innerHTML = v; }
  function numOf(id) { var e = $(id); return e ? (parseFloat(String(e.value).replace(/,/g, '')) || 0) : 0; }
  var UNIT = { eok: 1e8, man: 1e4, won: 1 };
  function amt(id) { var e = $(id); return Math.round(numOf(id) * (UNIT[e && e.getAttribute('data-unit')] || 1)); }
  function seg(name) { var b = document.querySelector('.fc-seg[data-name="' + name + '"] .mode-btn.active'); return b ? b.getAttribute('data-v') : null; }
  function won(n) { return (n < 0 ? '−' : '') + Math.round(Math.abs(n)).toLocaleString('ko-KR') + '원'; }
  function eok(n) {
    var neg = n < 0; n = Math.round(Math.abs(n) / 1e4) * 1e4;
    var e = Math.floor(n / 1e8), m = Math.round((n - e * 1e8) / 1e4), s;
    if (!e) s = m.toLocaleString('ko-KR') + '만원'; else s = e.toLocaleString('ko-KR') + '억' + (m ? ' ' + m.toLocaleString('ko-KR') + '만원' : '원');
    return (neg ? '−' : '') + s;
  }
  function both(n) { return n >= 1e6 ? won(n) + ' <small>(' + eok(n) + ')</small>' : won(n); }
  function pct(v, d) { return (v * 100).toFixed(d == null ? 1 : d).replace(/\.0+$/, '') + '%'; }
  function dot(d) { return d.replace(/-/g, '.'); }
  function today() { var k = new Date(Date.now() + 9 * 3600e3); return k.toISOString().slice(0, 10); }
  if (!$('cgt-sale').value) { $('cgt-sale').value = today(); }
  var share = null;
  function input() {
    var type = seg('cgt-type') || 'house', houses = +(seg('cgt-houses') || 1);
    return { type: type, sell: amt('cgt-sell'), buy: amt('cgt-buy'), costAcq: amt('cgt-cacq'), costSell: amt('cgt-csell'), acq: $('cgt-acq').value, sale: $('cgt-sale').value,
      reside: type === 'house' ? numOf('cgt-reside') : 0, houses: type === 'house' ? houses : 1, adjusted: $('cgt-adj').checked, adjAtAcq: $('cgt-adjacq').checked,
      temp2: houses === 2 && $('cgt-temp2').checked, exclude: $('cgt-excl').checked, transition: $('cgt-trans').checked, owners: +(seg('cgt-own') || 1) };
  }
  function ruleOf(r) {
    if (r.zero) return '양도차익 없음';
    if (r.exempt === 'full') return '1세대 1주택 비과세';
    return r.rule + (r.ltdRate ? ' · 장특공 ' + pct(r.ltdRate, 0) : '');
  }
  function clear(msg) {
    setT('cgt-val', '—'); setT('cgt-sub', msg); ['cgt-k1', 'cgt-k2', 'cgt-k3'].forEach(function (k) { setT(k, '—'); });
    ['cgt-table', 'cgt-scen', 'cgt-later', 'cgt-tips'].forEach(function (k) { setH(k, ''); });
    share = null; (window.dcShareSpec = window.dcShareSpec || {})['capital-gains-tax'] = null;
  }
  function render() {
    var o = input(), house = o.type === 'house';
    $('cgt-house-box').style.display = house ? '' : 'none';
    $('cgt-temp2-f').style.display = o.houses === 2 ? '' : 'none';
    $('cgt-adj-f').style.display = o.houses >= 2 ? '' : 'none';
    var surPossible = house && o.houses >= 2 && o.adjusted && !o.temp2;
    $('cgt-excl-f').style.display = surPossible ? '' : 'none';
    $('cgt-trans-f').style.display = surPossible && !o.exclude && o.sale >= CGT.SURCHARGE_FROM ? '' : 'none';
    if (o.houses < 2) { o.adjusted = false; }
    if (!surPossible) { o.exclude = false; }
    if (!(surPossible && o.sale >= CGT.SURCHARGE_FROM)) o.transition = false;
    var err = !(o.sell > 0) ? '양도가액을 넣어 주세요.' : !(o.buy >= 0) ? '취득가액을 넣어 주세요.' : !CGT.parse(o.acq) || !CGT.parse(o.sale) ? '취득일과 양도일을 넣어 주세요.' : o.sale < o.acq ? '양도일이 취득일보다 빠릅니다.' : '';
    if (err) return clear(err);
    var r = CGT.calc(o);
    if (r.err) return clear('날짜를 확인해 주세요.');
    /* 히어로 */
    var label = r.exempt === 'full' ? '비과세' : r.zero ? '0원' : won(r.total);
    setT('cgt-val', label); $('cgt-val').style.color = r.exempt === 'full' || r.zero ? '#22a06b' : '';
    if (r.zero) setH('cgt-sub', '양도차익이 ' + won(r.gain) + '로 없어서 낼 양도소득세가 없습니다');
    else if (r.exempt === 'full') setH('cgt-sub', '1세대 1주택 비과세 — 양도가액 12억원 이하, 보유 ' + r.hold + '년' + (o.adjAtAcq ? ' · 거주 ' + r.reside + '년' : '') + ' · 양도차익 <b>' + eok(r.gain) + '</b> 전부 비과세');
    else setH('cgt-sub', '양도차익 ' + eok(r.gain) + '의 <b>' + pct(r.eff) + '</b> · ' + ruleOf(r) + ' · 신고 기한 ' + dot(r.due));
    setT('cgt-k1', r.exempt === 'full' || r.zero ? '0원' : won(r.tax)); setT('cgt-k2', r.exempt === 'full' || r.zero ? '0원' : won(r.local));
    setT('cgt-k3', r.zero ? won(r.gain) : eok(r.gain - (r.total || 0)));
    /* 계산 과정 */
    var L = [
      ['양도가액', both(o.sell)], ['− 취득가액', both(o.buy)], ['− 필요경비 <small>(취득 부대비용 + 양도 비용·수리비)</small>', both(r.cost)],
      ['= 양도차익', both(r.gain), 'fc-total']
    ];
    if (!r.zero && r.exempt === 'full') L.push(['1세대 1주택 비과세 <small>(12억원 이하)</small>', '전액 비과세', 'fc-hl']);
    else if (!r.zero) {
      if (r.exempt === 'high') L.push(['× 고가주택 과세 비율 <small>((양도가액 − 12억) ÷ 양도가액 = ' + pct((o.sell - CGT.HIGH) / o.sell, 2) + ')</small>', both(r.taxGain)]);
      L.push(['− 장기보유특별공제 <small>(' + (r.ltdRate ? r.ltdTable + ' = ' + pct(r.ltdRate, 0) : r.sur ? '다주택 중과 대상은 공제 없음' : o.type === 'presale' ? '분양권은 공제 없음' : '보유 3년 미만') + ')</small>', both(r.ltd)]);
      L.push(['= 양도소득금액', both(r.income)]);
      L.push(['− 기본공제 <small>(' + (r.owners === 2 ? '250만원 × 2명' : '연 1회 250만원') + ')</small>', both(r.basicDed)]);
      L.push(['= 과세표준' + (r.owners === 2 ? ' <small>(2명 합계 · 1명당 ' + eok(r.taxBase / 2) + ')</small>' : ''), both(r.taxBase), 'fc-total']);
      L.push(['적용 세율', r.rule + (r.marginal ? ' <small>(최고 구간 ' + pct(r.marginal, 0) + ')</small>' : '')]);
      L.push(['양도소득세' + (r.owners === 2 ? ' <small>(1명당 ' + won(r.taxEach) + ')</small>' : ''), won(r.tax)]);
      L.push(['지방소득세 <small>(양도소득세의 10%)</small>', won(r.local)]);
      L.push(['<b>납부할 세금 합계</b>', '<b>' + won(r.total) + '</b>', 'fc-hl']);
      L.push(['예정신고·납부 기한 <small>(양도일이 속한 달 말일부터 2개월)</small>', dot(r.due)]);
    }
    L.push(['보유 기간' + (house ? ' · 거주 기간' : ''), r.hold + '년' + (house ? ' · ' + r.reside + '년' : '') + ' <small>(' + dot(o.acq) + ' → ' + dot(o.sale) + ')</small>']);
    setH('cgt-table', L.map(function (x) { return '<tr' + (x[2] ? ' class="' + x[2] + '"' : '') + '><td>' + x[0] + '</td><td style="text-align:right;">' + x[1] + '</td></tr>'; }).join(''));
    /* 주택 수·지역별 */
    if (house && !r.zero) {
      $('cgt-scen-card').style.display = '';
      var base = { exclude: false, transition: false, temp2: false }, cases = [
        ['1세대 1주택 <small>(비과세 요건 충족 가정)</small>', { houses: 1 }],
        ['2주택 · 비조정대상지역', { houses: 2, adjusted: false }],
        ['2주택 · 조정대상지역', { houses: 2, adjusted: true }],
        ['3주택 이상 · 조정대상지역', { houses: 3, adjusted: true }]
      ];
      setH('cgt-scen', cases.map(function (c) {
        var p = {}; for (var k in o) p[k] = o[k]; for (k in base) p[k] = base[k]; for (k in c[1]) p[k] = c[1][k];
        if (c[1].houses === 1) { p.adjAtAcq = false; }
        var x = CGT.calc(p), mine = p.houses === o.houses && (p.houses === 1 || p.adjusted === o.adjusted) && !o.temp2 && !o.exclude;
        return '<tr' + (mine ? ' class="fc-hl"' : '') + '><td>' + c[0] + (mine ? ' <small>← 지금 입력</small>' : '') + '</td><td><small>' + (x.exempt === 'full' ? '비과세' : ruleOf(x)) + (x.deferred ? ' · 중과 유예기간 양도' : '') + '</small></td><td style="text-align:right;">' + (x.exempt === 'full' ? '0원' : won(x.total)) + '</td></tr>';
      }).join(''));
    } else $('cgt-scen-card').style.display = 'none';
    /* 더 갖고 있다가 */
    var later = r.zero || r.exempt === 'full' ? [] : CGT.laterDates(Object.assign({}, o, { resideGrows: house && o.reside >= r.hold && o.reside > 0 }));
    var better = later.filter(function (x) { return !x.r.err && x.r.total < r.total; });
    $('cgt-later-card').style.display = later.length ? '' : 'none';
    setH('cgt-later', later.map(function (x) {
      var t = x.r.exempt === 'full' ? 0 : x.r.total, d = t - r.total;
      return '<tr><td>' + dot(x.date) + '</td><td>' + x.r.hold + '년</td><td><small>' + (x.r.exempt === 'full' ? '비과세' : ruleOf(x.r)) + '</small></td><td style="text-align:right;">' + won(t) + '</td><td style="text-align:right;' + (d < 0 ? 'color:#22a06b;' : '') + '">' + (d < 0 ? '−' + won(-d) : d > 0 ? '+' + won(d) : '같음') + '</td></tr>';
    }).join(''));
    /* 체크 포인트 */
    var tips = [];
    if (r.exempt === 'full') tips.push('비과세여도 양도가액이 12억원 이하면 신고 의무는 없지만, 비과세 요건(1세대·2년 보유' + (o.adjAtAcq ? '·2년 거주' : '') + ')을 양도일 기준으로 다시 확인하세요.');
    if (house && o.houses === 1 && !r.exemptOk && !r.zero) tips.push(r.hold < 2 ? '보유 2년이 안 돼 1세대 1주택 비과세를 받을 수 없습니다. ' + dot(CGT.iso({ y: CGT.parse(o.acq).y + 2, m: CGT.parse(o.acq).m, d: CGT.parse(o.acq).d })) + ' 이후에 양도하면 요건을 갖춥니다.' : '취득 당시 조정대상지역이라 2년 거주 요건이 있는데 거주가 ' + r.reside + '년이라 비과세를 받지 못합니다.');
    if (r.sur) tips.push('2026.5.10부터 조정대상지역 다주택 중과가 재개돼 +' + r.sur * 100 + '%p가 붙고 장기보유특별공제를 받지 못합니다. 비조정대상지역 주택을 먼저 팔거나 중과 배제 요건(지방 3억 이하·장기임대 등)을 확인해 보세요.');
    if (r.deferred) tips.push('다주택이지만 중과 유예기간(2022.5.10~2026.5.9) 양도 또는 경과조치에 해당해 기본세율과 장기보유특별공제가 적용됐습니다.');
    if (better.length) {                                               /* 가장 많이 줄어드는 금액의 90% 이상을 얻는 가장 이른 날 */
      var most = Math.max.apply(null, better.map(function (x) { return r.total - x.r.total; }));
      var bst = better.filter(function (x) { return r.total - x.r.total >= most * 0.9; })[0];
      tips.push(dot(bst.date) + '(보유 ' + bst.r.hold + '년) 이후에 팔면 세금이 <b>' + won(r.total - bst.r.total) + '</b> 줄어듭니다' + (bst.r.exempt === 'full' ? ' — 비과세' : '') + '.');
    }
    if (r.owners === 1 && !r.zero && r.exempt !== 'full' && r.taxBase > 14e6) {
      var co = CGT.calc(Object.assign({}, o, { owners: 2 }));
      if (co.total < r.total) tips.push('부부 공동명의(50:50)였다면 세금이 ' + won(co.total) + '으로 <b>' + won(r.total - co.total) + '</b> 적었을 것입니다 (명의는 취득 때 정해지며, 지금 증여로 바꾸면 증여세·취득세가 따로 듭니다).');
    }
    if (!r.zero && r.exempt !== 'full' && r.cost === 0) tips.push('취득세·중개수수료·확장 공사비 같은 필요경비를 넣으면 세금이 줄어듭니다. 증빙(영수증·계좌이체)이 있어야 인정됩니다.');
    if (!r.zero && r.exempt !== 'full') tips.push('양도일이 속한 달의 말일부터 2개월 안(' + dot(r.due) + '까지) 예정신고·납부해야 하며, 늦으면 신고불성실·납부지연 가산세가 붙습니다.');
    setH('cgt-tips', tips.map(function (t) { return '<li>' + t + '</li>'; }).join(''));
    /* 공유 카드 */
    var tname = { house: '주택', presale: '분양권', land: '토지·상가', nonbiz: '비사업용 토지' }[o.type];
    share = { key: 'capital-gains-tax', chip: '양도소득세 계산기', title: tname + ' ' + eok(o.sell) + '에 팔면 양도세는?',
      label: (house ? (o.houses === 1 ? '1주택' : o.houses === 2 ? '2주택' : '3주택 이상') + (o.houses >= 2 ? (o.adjusted ? ' · 조정대상지역' : ' · 비조정') : '') + ' · ' : '') + '보유 ' + r.hold + '년' + (house ? ' · 거주 ' + r.reside + '년' : '') + (r.owners === 2 ? ' · 공동명의' : ''),
      big: label, bigSecret: !(r.exempt === 'full' || r.zero), sub: r.zero ? '양도차익 없음' : r.exempt === 'full' ? '1세대 1주택 비과세' : '차익의 ' + pct(r.eff) + ' · ' + ruleOf(r),
      rows: r.zero || r.exempt === 'full' ? [['양도차익', eok(r.gain), true]] : [['양도차익', eok(r.gain), true], ['장기보유특별공제', r.ltdRate ? pct(r.ltdRate, 0) : '없음'], ['과세표준', eok(r.taxBase), true], ['세금 내고 남는 차익', eok(r.gain - r.total), true]],
      source: '2026년 소득세법 · 다주택 중과(2026.5.10~) · 지방소득세 포함' };
    (window.dcShareSpec = window.dcShareSpec || {})['capital-gains-tax'] = share;   /* 오른쪽 아래 공유 창이 이 카드를 씀 */
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('.cgt-cq button'); if (!b) return;
    var t = $('cgt-cacq'), v = Math.round(amt('cgt-buy') * (+b.getAttribute('data-k')) / 100);
    t.setAttribute('data-unit', 'won'); t.value = v.toLocaleString('ko-KR');
    document.querySelectorAll('.unit-btn[data-fc-unit="cgt-cacq"]').forEach(function (u) { u.classList.toggle('active', u.getAttribute('data-unit') === 'won'); });
    render();
  });
  window.fcRegister('cgt', render, 'cgt');
})();

/* ════════════════════════════════════════
   [CY] 청약 가점 계산기 — 주택공급에 관한 규칙 별표1 「가점제 적용기준」 (2026년 현행, 민영주택 일반공급)
   근거(2026-10 확인)
   · 총점 84점 = 무주택기간 32 + 부양가족 수 35 + 입주자저축 가입기간 17 · 기준일은 입주자모집공고일
   · 무주택기간: 만 30세가 되는 날부터 셈(그 전에 혼인했으면 혼인신고일부터). 주택을 처분했다면 무주택이 된 날(가장 최근 처분일)부터
       1년 미만 2점, 이후 1년마다 2점, 15년 이상 32점 · 만 30세 미만 미혼 0점 · 유주택자 0점
       소형·저가주택 1호(전용 60㎡ 이하 · 공시가격 수도권 1.6억·지방 1억 이하, 2024.12.18~ 비아파트 85㎡·5억/3억)는 그 보유기간도 무주택으로 인정
   · 부양가족: 본인 제외 · 0명 5점, 1명마다 5점, 6명 이상 35점
       배우자(세대 분리여도 인정) · 직계존속(배우자 쪽 포함, 신청자가 세대주이고 3년 이상 같은 등본, 직계존속이나 그 배우자가 주택 소유 시 제외)
       미혼 자녀(만 30세 이상은 1년 이상 같은 등본)
   · 가입기간: 6개월 미만 1점 · 6개월~1년 미만 2점 · 1~2년 미만 3점 · 이후 1년마다 1점 · 15년 이상 17점
       미성년(만 19세 미만) 때 가입한 기간은 최대 5년만 인정
       배우자 통장: 배우자 가입기간의 50%를 같은 표로 환산해 최대 3점 더함(합계 17점 한도, 2024.3.25~)
════════════════════════════════════════ */
var CY = (function () {
  function parse(d) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d || ''); if (!m) return null; var o = { y: +m[1], m: +m[2], d: +m[3] }; return o.m >= 1 && o.m <= 12 && o.d >= 1 && o.d <= 31 ? o : null; }
  function iso(x) { return x.y + '-' + String(x.m).padStart(2, '0') + '-' + String(x.d).padStart(2, '0'); }
  function cmp(a, b) { return iso(a) < iso(b) ? -1 : iso(a) > iso(b) ? 1 : 0; }
  function lastDay(y, m) { return new Date(Date.UTC(y, m, 0)).getUTCDate(); }
  /* n개월 뒤 같은 날 (그 달에 그 날이 없으면 말일 — 민법 §160③) */
  function addMonths(a, n) { var t = a.y * 12 + (a.m - 1) + n, y = Math.floor(t / 12), m = t - y * 12 + 1; return { y: y, m: m, d: Math.min(a.d, lastDay(y, m)) }; }
  function addYears(a, n) { return addMonths(a, 12 * n); }
  /* a부터 b까지 꽉 찬 개월 수 (a의 n개월 뒤 같은 날이 b 이하이면 n개월) */
  function months(a, b) {
    if (cmp(b, a) < 0) return 0;
    var n = (b.y - a.y) * 12 + (b.m - a.m);
    while (n > 0 && cmp(addMonths(a, n), b) > 0) n--;
    return n;
  }
  function homePts(yrs) { return Math.min(32, 2 * (yrs + 1)); }          /* yrs: 꽉 찬 무주택 연수 */
  function depPts(n) { return Math.min(35, 5 * (Math.min(6, n) + 1)); }
  function acctPts(mo) { return mo < 6 ? 1 : mo < 12 ? 2 : Math.min(17, Math.floor(mo / 12) + 2); }
  /* o: {ref, birth, married, marriage, home 'none'|'small'|'disposed'|'own', disposal, head(세대주), spouse(배우자 수 0/1 — married면 1),
         parents(직계존속), kids(미혼 자녀 30세 미만), kids30(만 30세 이상 미혼 자녀 1년+), join, spAcct, spJoin} */
  function calc(o) {
    var ref = parse(o.ref), birth = parse(o.birth), join = parse(o.join);
    if (!ref) return { err: 'ref' };
    if (!birth || cmp(birth, ref) >= 0) return { err: 'birth' };
    if (!join || cmp(join, ref) > 0) return { err: 'join' };
    if (cmp(join, birth) < 0) return { err: 'joinBirth' };
    var r = { ref: iso(ref) }, age = Math.floor(months(birth, ref) / 12), at30 = addYears(birth, 30);
    r.age = age;
    /* 1) 무주택기간 */
    var marriage = o.married ? parse(o.marriage) : null;
    if (o.married && (!marriage || cmp(marriage, ref) > 0)) return { err: 'marriage' };
    r.homeless = { pts: 0, years: 0, start: null, why: '' };
    if (o.home === 'own') r.homeless.why = 'own';
    else {
      var start = at30, basis = '만 30세';
      if (marriage && cmp(marriage, at30) < 0) { start = marriage; basis = '혼인신고일'; }
      if (o.home === 'disposed') {
        var disp = parse(o.disposal);
        if (!disp || cmp(disp, ref) > 0) return { err: 'disposal' };
        if (cmp(disp, start) > 0) { start = disp; basis = '주택 처분일'; }
      }
      if (cmp(start, ref) > 0) { r.homeless.why = 'young'; r.homeless.start = iso(start); }   /* 만 30세 전 미혼 */
      else {
        var y = Math.floor(months(start, ref) / 12);
        r.homeless = { pts: homePts(y), years: y, start: iso(start), basis: basis, months: months(start, ref),
          next: y < 15 ? iso(addYears(start, y + 1)) : null };
      }
    }
    /* 2) 부양가족 */
    var sp = o.married ? 1 : 0, par = o.head ? Math.max(0, Math.floor(o.parents || 0)) : 0;
    var kids = Math.max(0, Math.floor(o.kids || 0)), k30 = Math.max(0, Math.floor(o.kids30 || 0));
    var n = sp + par + kids + k30;
    r.dep = { pts: depPts(n), n: n, spouse: sp, parents: par, kids: kids + k30, parentsDropped: !o.head && (o.parents || 0) > 0 ? Math.floor(o.parents) : 0 };
    /* 3) 입주자저축 가입기간 — 미성년 기간은 최대 5년 */
    var adult = addYears(birth, 19), mo = months(join, ref), minorCut = false, nextBase = join;
    if (cmp(join, adult) < 0) {
      var minorEnd = cmp(ref, adult) < 0 ? ref : adult, minorMo = months(join, minorEnd);
      if (minorMo > 60) {
        minorCut = true;
        if (cmp(ref, adult) < 0) mo = 60;                     /* 아직 미성년 — 5년에서 멈춤 */
        else { nextBase = addYears(adult, -5); mo = months(nextBase, ref); }     /* 성년 이후 기간 + 미성년 5년 */
      }
    }
    var own = acctPts(mo), spP = 0, spMo = 0;
    if (o.married && o.spAcct) {
      var sj = parse(o.spJoin);
      if (!sj || cmp(sj, ref) > 0) return { err: 'spJoin' };
      spMo = months(sj, ref); spP = Math.min(3, acctPts(spMo / 2));
    }
    var need = mo < 6 ? 6 : mo < 12 ? 12 : (Math.floor(mo / 12) + 1) * 12;
    r.acct = { pts: Math.min(17, own + spP), own: own, spouse: spP, months: mo, spMonths: spMo, minorCut: minorCut, capped: own + spP > 17,
      next: own < 17 && cmp(ref, adult) >= 0 ? iso(addMonths(nextBase, need)) : null };
    r.total = r.homeless.pts + r.dep.pts + r.acct.pts;
    r.max = 32 + depPts(n) + 17;                                            /* 지금 가족 수로 가능한 최고점 */
    return r;
  }
  /* k년 뒤 점수 (가족 수는 그대로) */
  function project(o, years) {
    var ref = parse(o.ref), out = [];
    for (var k = 0; k <= years; k++) {
      var p = {}; for (var x in o) p[x] = o[x];
      p.ref = iso(addYears(ref, k));
      var r = calc(p); if (r.err) break;
      out.push({ k: k, date: p.ref, total: r.total, h: r.homeless.pts, d: r.dep.pts, a: r.acct.pts });
    }
    return out;
  }
  /* 목표 점수에 처음 닿는 날 (월 단위 탐색, 최대 years년) */
  function reach(o, target, years) {
    var ref = parse(o.ref), r0 = calc(o);
    if (r0.err) return null; if (r0.total >= target) return { date: iso(ref), months: 0 };
    for (var k = 1; k <= years * 12; k++) {
      var p = {}; for (var x in o) p[x] = o[x]; p.ref = iso(addMonths(ref, k));
      var r = calc(p); if (!r.err && r.total >= target) {
        /* 그 달 안에서 정확한 날짜 */
        var lo = addMonths(ref, k - 1), d = lo;
        for (var j = 0; j < 31; j++) { d = addDays(lo, j + 1); p.ref = iso(d); if (calc(p).total >= target) break; }
        return { date: iso(d), months: k };
      }
    }
    return null;
  }
  function addDays(a, n) { var t = new Date(Date.UTC(a.y, a.m - 1, a.d + n)); return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() }; }
  return { calc: calc, project: project, reach: reach, parse: parse, iso: iso, months: months, addYears: addYears, addMonths: addMonths, homePts: homePts, depPts: depPts, acctPts: acctPts };
})();

/* [CY] 화면 — 입력(data-fc="cy")은 [FC-UI] 공통 처리 */
(function () {
  if (!document.getElementById('page-cheongyak')) return;
  var SEOUL = [['2022', 47.69], ['2023', 56.17], ['2024', 59.68], ['2025', 65.81]], AVG = 65.81;   /* 서울 민영 평균 당첨 가점 — 청약홈(뉴시스 2026.3.30) */
  function $(id) { return document.getElementById(id); }
  function setT(id, v) { var e = $(id); if (e) e.textContent = v; }
  function setH(id, v) { var e = $(id); if (e) e.innerHTML = v; }
  function seg(name) { var b = document.querySelector('.fc-seg[data-name="' + name + '"] .mode-btn.active'); return b ? b.getAttribute('data-v') : null; }
  function cnt(id) { var v = parseInt(String($(id).value).replace(/[^\d]/g, ''), 10); return isFinite(v) ? Math.min(9, Math.max(0, v)) : 0; }
  function dot(d) { return d ? d.replace(/-/g, '.') : ''; }
  function today() { return new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10); }
  function ym(mo) { var y = Math.floor(mo / 12), m = mo % 12; return (y ? y + '년' : '') + (m ? (y ? ' ' : '') + m + '개월' : '') || '0개월'; }
  function pts(n) { return (Math.round(n * 100) / 100) + '점'; }
  function gap(a, b) { var d = Math.round((a - b) * 100) / 100; return d > 0 ? d + '점 높음' : d < 0 ? (-d) + '점 낮음' : '같음'; }
  var chart = null, share = null;
  if (!$('cy-ref').value) $('cy-ref').value = today();
  function input() {
    var mar = seg('cy-mar') === '1';
    return { ref: $('cy-ref').value, birth: $('cy-birth').value, married: mar, marriage: $('cy-mdate').value, home: seg('cy-home') || 'none', disposal: $('cy-disp').value,
      head: $('cy-head').checked, parents: cnt('cy-par'), kids: cnt('cy-kids'), kids30: cnt('cy-kids30'), join: $('cy-join').value, spAcct: mar && $('cy-spa').checked, spJoin: $('cy-spj').value };
  }
  var ERR = { ref: '기준일(입주자모집공고일)을 확인해 주세요.', birth: '생년월일을 기준일보다 앞선 날짜로 넣어 주세요.', join: '청약통장 가입일을 기준일 이전 날짜로 넣어 주세요.',
    joinBirth: '청약통장 가입일이 생년월일보다 빠릅니다.', marriage: '혼인신고일을 기준일 이전 날짜로 넣어 주세요.', disposal: '무주택이 된 날을 기준일 이전 날짜로 넣어 주세요.', spJoin: '배우자 통장 가입일을 기준일 이전 날짜로 넣어 주세요.' };
  function clear(msg) {
    setT('cy-val', '—'); setT('cy-sub', msg); ['cy-k1', 'cy-k2', 'cy-k3'].forEach(function (k) { setT(k, '—'); });
    ['cy-bars', 'cy-table', 'cy-cmp', 'cy-cmp-note', 'cy-reach', 'cy-scen', 'cy-tips'].forEach(function (k) { setH(k, ''); });
    if (chart) { chart.destroy(); chart = null; }
    share = null; (window.dcShareSpec = window.dcShareSpec || {})['cheongyak-score'] = null;
  }
  function chartOpts() {
    return { responsive: true, maintainAspectRatio: false, animation: false, interaction: { mode: 'index', intersect: false },
      plugins: { legend: { display: true, position: 'bottom', labels: { color: '#9e9ea4', boxWidth: 10, boxHeight: 10, font: { size: 11 } } },
        tooltip: { backgroundColor: '#202027', borderColor: fgA(0.1), borderWidth: 1, titleColor: '#9e9ea4', bodyColor: '#e4e4e5', padding: 12,
          callbacks: { label: function (c) { return ' ' + c.dataset.label + ': ' + (Math.round(c.parsed.y * 100) / 100) + '점'; } } } },
      scales: { x: { ticks: { color: '#6d6d76', font: { size: 11 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 9 }, grid: { display: false }, border: { display: false } },
                y: { min: 0, max: 84, ticks: { color: '#6d6d76', font: { size: 11 }, stepSize: 12, callback: function (v) { return v + '점'; } }, grid: { color: fgA(0.04) }, border: { display: false } } } };
  }
  function render() {
    var o = input();
    $('cy-mdate-f').style.display = o.married ? '' : 'none';
    $('cy-disp-f').style.display = o.home === 'disposed' ? '' : 'none';
    $('cy-spa-box').style.display = o.married ? '' : 'none';
    $('cy-spj-f').style.display = o.spAcct ? '' : 'none';
    $('cy-head-f').style.opacity = o.parents ? '' : '0.6';
    setH('cy-home-hint', { none: '세대원 모두 주택을 가진 적이 없음', disposed: '처분해서 지금은 무주택 — 무주택이 된 날부터 다시 셉니다',
      small: '전용 60㎡ 이하·공시가격 수도권 1.6억·지방 1억 이하 아파트(비아파트 85㎡·5억/3억 이하) 1채 — 민영주택 일반공급에선 무주택으로 봄', own: '주택을 가진 세대는 무주택기간이 0점입니다' }[o.home]);
    setH('cy-sp-note', o.married ? '배우자 <b>1명</b>은 자동으로 셉니다 (세대가 분리돼 있어도 인정)' : '기혼이면 배우자 1명이 자동으로 더해집니다');
    var r = CY.calc(o);
    if (r.err) return clear(ERR[r.err] || '입력을 확인해 주세요.');
    var h = r.homeless, d = r.dep, a = r.acct, ref = o.ref;
    /* 히어로 */
    setT('cy-val', r.total + '점');
    setH('cy-sub', '84점 만점 · 지금 가족 수로 최고 <b>' + r.max + '점</b> · 서울 2025년 평균 당첨 가점(' + AVG + '점)보다 <b>' + gap(r.total, AVG) + '</b>');
    setT('cy-k1', h.pts + ' / 32점'); setT('cy-k2', d.pts + ' / 35점'); setT('cy-k3', a.pts + ' / 17점');
    /* 항목 막대 */
    var bars = [['무주택기간', h.pts, 32, '#3182f6'], ['부양가족', d.pts, 35, '#22a06b'], ['청약통장', a.pts, 17, '#fe9800']];
    setH('cy-bars', bars.map(function (b) { return '<div class="cy-bar"><div class="cy-bar-h"><span>' + b[0] + '</span><b>' + b[1] + '<small> / ' + b[2] + '점</small></b></div><div class="cy-bar-t"><span style="width:' + (b[1] / b[2] * 100).toFixed(1) + '%;background:' + b[3] + ';"></span></div></div>'; }).join(''));
    /* 상세 */
    var L = [];
    if (h.why === 'own') L.push(['무주택기간', '주택 보유 중 → 0점']);
    else if (h.why === 'young') L.push(['무주택기간', '만 30세 전 미혼 → 0점 <small>(' + dot(h.start) + '부터 셈)</small>']);
    else {
      L.push(['무주택기간 시작일 <small>(' + h.basis + ')</small>', dot(h.start)]);
      L.push(['무주택 기간', ym(h.months) + ' → <b>' + h.pts + '점</b>']);
      if (h.next) L.push(['다음 +2점', dot(h.next)]);
    }
    L.push(['부양가족 <small>(' + [d.spouse ? '배우자 1' : '', d.parents ? '직계존속 ' + d.parents : '', d.kids ? '자녀 ' + d.kids : ''].filter(Boolean).join(' · ') + (d.n ? '' : '없음') + ')</small>', d.n + '명 → <b>' + d.pts + '점</b>']);
    L.push(['통장 가입기간' + (a.minorCut ? ' <small>(미성년 기간 5년만 인정)</small>' : ''), ym(a.months) + ' → <b>' + a.own + '점</b>']);
    if (o.spAcct) L.push(['배우자 통장 <small>(' + ym(a.spMonths) + '의 50%)</small>', '+' + a.spouse + '점' + (a.capped ? ' <small>(17점 한도로 ' + (17 - a.own) + '점만 반영)</small>' : '')]);
    if (a.next) L.push(['다음 +1점 <small>(본인 통장)</small>', dot(a.next)]);
    L.push(['<b>청약 가점 합계</b>', '<b>' + r.total + '점</b>', 'fc-hl']);
    setH('cy-table', L.map(function (x) { return '<tr' + (x[2] ? ' class="' + x[2] + '"' : '') + '><td>' + x[0] + '</td><td style="text-align:right;">' + x[1] + '</td></tr>'; }).join(''));
    /* 서울 평균과 비교 */
    var rows = SEOUL.map(function (s) { return [s[0] + '년 서울 평균', s[1], false]; }).concat([['내 점수', r.total, true], ['우리 가족 만점', r.max, false, true]]);
    setH('cy-cmp', rows.map(function (x) { return '<div class="cy-cmp-row' + (x[2] ? ' me' : '') + (x[3] ? ' mx' : '') + '"><span>' + x[0] + '</span><div class="cy-bar-t"><span style="width:' + (x[1] / 84 * 100).toFixed(1) + '%;"></span></div><b>' + pts(x[1]) + '</b></div>'; }).join(''));
    setH('cy-cmp-note', '서울 아파트 평균 당첨 가점은 4년 만에 약 18점 올라 2025년 <b>' + AVG + '점</b>으로 집계 이래 가장 높았습니다. ' + (r.max < AVG ? '지금 가족 수로는 무주택·통장 점수를 모두 채워도 최고 ' + r.max + '점이라 서울 평균에 못 미칩니다 — 추첨제·특별공급을 함께 노리세요.' : r.total >= AVG ? '내 점수는 이미 서울 평균 이상입니다. 인기 단지는 70점대 중반에서 당첨선이 형성되기도 합니다.' : '가족 수가 그대로여도 시간이 지나면 ' + r.max + '점까지 오를 수 있습니다.'));
    /* 앞으로 */
    var proj = CY.project(o, 15);
    if (typeof Chart !== 'undefined') {
      var lbl = proj.map(function (p) { return p.k ? p.date.slice(0, 4) + '.' + p.date.slice(5, 7) : '지금'; });
      var ds = [
        { label: '내 가점', data: proj.map(function (p) { return p.total; }), borderColor: '#3182f6', backgroundColor: 'rgba(49,130,246,0.10)', borderWidth: 2, pointRadius: 2.5, fill: true, stepped: false, tension: 0 },
        { label: '서울 2025 평균 당첨 (' + AVG + '점)', data: proj.map(function () { return AVG; }), borderColor: '#f04452', borderDash: [5, 4], borderWidth: 1.4, pointRadius: 0, fill: false },
        { label: '우리 가족 만점 (' + r.max + '점)', data: proj.map(function () { return r.max; }), borderColor: '#9e9ea4', borderDash: [2, 3], borderWidth: 1.2, pointRadius: 0, fill: false }
      ];
      if (chart) chart.destroy();
      chart = new Chart($('cy-chart'), { type: 'line', data: { labels: lbl, datasets: ds }, options: chartOpts() });
    }
    var gm = {}, g;
    for (g = 10; g <= r.max; g += 10) gm[g] = g + '점';
    gm[Math.ceil(AVG)] = '서울 2025 평균 넘기 (' + Math.ceil(AVG) + '점)';
    gm[r.max] = '우리 가족 만점 (' + r.max + '점)';
    var goals = Object.keys(gm).map(Number).filter(function (x) { return x > r.total; }).sort(function (p, q) { return p - q; }).slice(0, 5).map(function (x) { return [x, gm[x]]; });
    setH('cy-reach', goals.length ? goals.map(function (x) {
      var hit = x[0] <= r.max ? CY.reach(o, x[0], 40) : null, mo = hit ? CY.months(CY.parse(ref), CY.parse(hit.date)) : 0;
      return '<tr' + (x[0] === Math.ceil(AVG) ? ' class="fc-hl"' : '') + '><td>' + x[1] + '</td><td>' + (hit ? dot(hit.date) : '<small>가족 수가 그대로면 불가 (최고 ' + r.max + '점)</small>') + '</td><td style="text-align:right;">' + (hit ? (mo ? ym(mo) + ' 뒤' : '곧') : '—') + '</td></tr>';
    }).join('') : '<tr><td colspan="3">지금 가족 수로 받을 수 있는 최고 점수(' + r.max + '점)를 이미 받고 있습니다.</td></tr>');
    /* 이렇게 되면 */
    function alt(p, label, note) { var q = {}; for (var k in o) q[k] = o[k]; for (k in p) q[k] = p[k]; var x = CY.calc(q); return x.err ? null : [label + (note ? ' <small>' + note + '</small>' : ''), x.total]; }
    var S = [['지금 입력', r.total, true]];
    if (!o.married) S.push(alt({ married: true, marriage: ref }, '오늘 혼인신고하면', '배우자 +1명' + (h.why === 'young' ? ' · 무주택기간도 오늘부터' : '')));
    if (o.married && !o.spAcct && a.own < 17) S.push(alt({ spAcct: true, spJoin: CY.iso(CY.addYears(CY.parse(ref), -2)) }, '배우자 통장이 2년 이상이면', '최대 +3점'));
    S.push(alt({ kids: o.kids + 1 }, '자녀가 1명 더 있으면', '태아 포함'));
    var in3 = CY.iso(CY.addYears(CY.parse(ref), 3)), p3 = alt({ ref: in3, head: true, parents: o.parents + 2 }, '부모님 두 분과 3년 같이 살면', dot(in3) + ' 기준 · 세대주');
    var b3 = alt({ ref: in3 }, '그냥 3년 기다리면', dot(in3) + ' 기준');
    if (b3) S.push(b3); if (p3) S.push(p3);
    if (o.home === 'own') S.push(alt({ home: 'disposed', disposal: ref }, '오늘 집을 처분하면', '무주택기간이 오늘부터'));
    setH('cy-scen', S.filter(Boolean).map(function (x) { var df = x[1] - r.total; return '<tr' + (x[2] ? ' class="fc-hl"' : '') + '><td>' + x[0] + '</td><td style="text-align:right;">' + x[1] + '점</td><td style="text-align:right;' + (df > 0 ? 'color:#f04452;' : '') + '">' + (x[2] ? '—' : df > 0 ? '+' + df + '점' : df < 0 ? df + '점' : '같음') + '</td></tr>'; }).join(''));
    /* 체크 포인트 */
    var T = [];
    if (h.why === 'young') T.push('만 30세 전 미혼이라 무주택기간이 0점입니다. 만 30세가 되는 ' + dot(h.start) + '부터 2점으로 시작하고, 그 전에 혼인신고하면 신고일부터 셉니다.');
    if (h.why === 'own') T.push('주택을 가진 세대는 무주택기간 0점이고, 투기과열지구·조정대상지역의 가점제 물량은 무주택 세대구성원만 신청할 수 있습니다. 유주택자는 기존 주택 처분 조건의 추첨제 물량(1주택자)을 노려야 합니다.');
    if (o.home === 'disposed' && h.basis === '주택 처분일') T.push('집을 처분한 날부터 무주택기간을 다시 셉니다. 만 30세(혼인신고일)부터 계속 무주택이었다면 받았을 점수보다 낮아졌습니다.');
    if (d.parentsDropped) T.push('세대주가 아니어서 직계존속 ' + d.parentsDropped + '명이 부양가족에서 빠졌습니다. 직계존속은 신청자가 세대주이고 3년 이상 같은 등본에 있어야 인정됩니다.');
    if (o.parents) T.push('부모님이 부양가족으로 인정되려면 입주자모집공고일 기준 3년 이상 계속 같은 등본에 있어야 하고, 부모님이나 그 배우자가 집이 있으면 안 됩니다. 실제 같이 살지 않는 위장전입은 부정청약으로 당첨 취소·형사처벌·최대 10년 청약 제한 대상입니다.');
    if (a.capped) T.push('본인 통장 점수와 배우자 가산을 합치면 17점을 넘어 ' + (17 - a.own) + '점만 반영됐습니다.');
    if (a.minorCut) T.push('만 19세 전에 가입한 기간 중 5년만 인정돼, 실제 가입기간보다 짧게 계산됐습니다.');
    if (h.next && !h.why && h.pts < 32) { var dd = CY.months(CY.parse(ref), CY.parse(h.next)); if (dd < 2) T.push('<b>' + dot(h.next) + '</b>에 무주택기간 점수가 2점 오릅니다. 입주자모집공고일이 그 이후인 단지를 노리면 유리합니다.'); }
    if (r.total < 50) T.push('가점이 낮을 때는 추첨제 물량(투기과열지구 60㎡ 이하 60% · 85㎡ 초과 20%)과 신혼부부·생애최초·신생아 특별공급이 현실적인 경로입니다.');
    T.push('동점이면 청약통장 가입기간이 긴 사람이 우선이고, 가점을 잘못 입력해 당첨되면 부적격으로 당첨이 취소되고 일정 기간 다른 청약에 당첨될 수 없습니다. 신청 전에 청약홈 ‘청약 가점 계산’으로 한 번 더 확인하세요.');
    setH('cy-tips', T.map(function (t) { return '<li>' + t + '</li>'; }).join(''));
    /* 공유 카드 */
    share = { key: 'cheongyak-score', chip: '청약 가점 계산기', title: '내 청약 가점은 몇 점?',
      label: (o.married ? '기혼' : '미혼') + ' · 부양가족 ' + d.n + '명 · 통장 ' + ym(a.months) + ' · ' + dot(ref) + ' 기준',
      big: r.total + '점', sub: '84점 만점 · 서울 2025 평균 당첨 ' + AVG + '점보다 ' + gap(r.total, AVG), gauge: r.total / 84 * 100, gaugeLabels: ['0점', '42점', '84점'],
      rows: [['무주택기간', h.pts + ' / 32점'], ['부양가족', d.pts + ' / 35점'], ['청약통장', a.pts + ' / 17점']],
      source: '주택공급에 관한 규칙 별표1 (2026) · 서울 평균 가점: 한국부동산원 청약홈' };
    (window.dcShareSpec = window.dcShareSpec || {})['cheongyak-score'] = share;
  }
  /* 인원 ± 버튼 */
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('.cy-step button'); if (!b) return;
    var inp = b.parentNode.querySelector('input'), v = Math.min(9, Math.max(0, cnt(inp.id) + (+b.getAttribute('data-d'))));
    inp.value = v; inp.dispatchEvent(new Event('input', { bubbles: true }));
  });
  window.fcRegister('cy', render, 'cheongyak');
})();

/* ════════════════════════════════════════
   [AUTH] 간편 로그인(카카오·네이버·구글) · 내 저장함 — 서버는 방문자 카운터 Worker(worker/src/auth.js)
   · /auth/config 에 켜진 제공자가 하나도 없으면 로그인 버튼 자체를 숨김 (키 등록 전에는 사이트 변화 없음)
   · 로그인: 제공자 로그인 창 → https://d-capitalism.com/auth/callback/ (state·PKCE 확인, 첫 가입이면 약관·개인정보·만 14세 동의) → 토큰을 localStorage 'dc_auth' 에 보관
   · 계산기 화면의 '저장' 버튼: 그 화면의 입력값(입력칸·선택·체크·버튼 선택·단위)을 내 저장함에 저장 → /saved/ 에서 열면 ?load=번호 로 그대로 복원
════════════════════════════════════════ */
(function () {
  if (typeof SITE_EN !== 'undefined' && SITE_EN) return;                    /* 영어 페이지는 아직 로그인 없음 */
  var KEY = 'dc_auth', CFG = 'dc_cfg', EP = null, PROV = null;
  var NAME = { kakao: '카카오', naver: '네이버', google: '구글' };
  function $(id) { return document.getElementById(id); }
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function getAuth() { try { var a = JSON.parse(localStorage.getItem(KEY) || 'null'); return a && a.token && a.exp * 1000 > Date.now() ? a : null; } catch (e) { return null; } }
  function setAuth(a) { try { if (a) localStorage.setItem(KEY, JSON.stringify(a)); else localStorage.removeItem(KEY); } catch (e) {} }
  function api(method, path, body) {
    var a = getAuth(), h = { 'Content-Type': 'application/json' };
    if (a) h.Authorization = 'Bearer ' + a.token;
    return fetch(EP + path, { method: method, headers: h, body: body ? JSON.stringify(body) : undefined }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) { if (r.status === 401 && a) { setAuth(null); paint(); } if (!r.ok) { var e = new Error(j.error || r.status); e.status = r.status; e.body = j; throw e; } return j; });
    });
  }
  function endpoint() {
    if (window.__counterEP) return Promise.resolve(window.__counterEP);
    return (window.mdLoad ? window.mdLoad('counter.json') : fetch('/data/counter.json').then(function (r) { return r.json(); })).then(function (c) { window.__counterEP = c && c.endpoint; return window.__counterEP; });
  }
  var cfgP = null;
  function cfgJson() {                                                     /* /auth/config 전체 (로그인 제공자 · 카카오 공유 키) — 10분 보관 */
    try { var c = JSON.parse(sessionStorage.getItem(CFG) || 'null'); if (c && c.j && Date.now() - c.t < 6e5) return Promise.resolve(c.j); } catch (e) {}
    if (cfgP) return cfgP;
    cfgP = fetch(EP + '/auth/config').then(function (r) { return r.json(); }).then(function (j) {
      j = j || {}; try { sessionStorage.setItem(CFG, JSON.stringify({ t: Date.now(), j: j })); } catch (e) {} return j;
    }).catch(function () { cfgP = null; return {}; });
    return cfgP;
  }
  function config() { return cfgJson().then(function (j) { return j.providers || {}; }); }
  window.dcConfig = function () { return endpoint().then(function (ep) { if (!ep) return {}; EP = EP || ep.replace(/\/$/, ''); return cfgJson(); }); };
  /* ── 로그인 시작: state·PKCE 만들어 두고 제공자 로그인 창으로 ── */
  function rnd(n) { var a = new Uint8Array(n); crypto.getRandomValues(a); return Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join(''); }
  function b64u(buf) { return btoa(String.fromCharCode.apply(null, new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  function start(p) {
    var cid = PROV[p] && PROV[p].client_id; if (!cid) return;
    var redirect = location.origin + '/auth/callback/', state = rnd(16), verifier = rnd(32);
    try { sessionStorage.setItem('dc_auth_req', JSON.stringify({ p: p, state: state, verifier: verifier, back: location.pathname + location.search, t: Date.now() })); } catch (e) {}
    var q = function (o) { return Object.keys(o).map(function (k) { return k + '=' + encodeURIComponent(o[k]); }).join('&'); };
    if (p === 'kakao') location.href = 'https://kauth.kakao.com/oauth/authorize?' + q({ response_type: 'code', client_id: cid, redirect_uri: redirect, state: state });
    else if (p === 'naver') location.href = 'https://nid.naver.com/oauth2.0/authorize?' + q({ response_type: 'code', client_id: cid, redirect_uri: redirect, state: state });
    else crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)).then(function (h) {
      location.href = 'https://accounts.google.com/o/oauth2/v2/auth?' + q({ response_type: 'code', client_id: cid, redirect_uri: redirect, scope: 'openid profile', state: state,
        code_challenge: b64u(h), code_challenge_method: 'S256', prompt: 'select_account' });
    });
  }
  /* ── 화면: 위쪽 로그인 버튼 · 회원 메뉴 · 로그인 창 ── */
  var LOGO = {
    kakao: '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="#000" d="M12 3C6.48 3 2 6.48 2 10.77c0 2.77 1.85 5.2 4.64 6.57-.2.74-.74 2.7-.85 3.12-.13.52.19.51.4.37.17-.11 2.66-1.8 3.74-2.53.67.1 1.36.15 2.07.15 5.52 0 10-3.48 10-7.68C22 6.48 17.52 3 12 3z"/></svg>',
    naver: '<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path fill="#fff" d="M16.27 3v9.36L7.73 3H3v18h4.73v-9.36L16.27 21H21V3z"/></svg>',
    google: '<svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>'
  };
  function modal() {
    var el = $('dc-login');
    if (!el) {
      el = document.createElement('div'); el.id = 'dc-login'; el.className = 'dcl-ov'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', '로그인');
      document.body.appendChild(el);
      el.addEventListener('click', function (e) {
        if (e.target === el || e.target.closest('.dcl-x')) { el.classList.remove('open'); return; }
        var b = e.target.closest('[data-prov]'); if (b) start(b.getAttribute('data-prov'));
      });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape') el.classList.remove('open'); });
    }
    el.innerHTML = '<div class="dcl-box"><button type="button" class="dcl-x" aria-label="닫기">✕</button>' +
      '<div class="dcl-brand"><svg width="40" height="40" viewBox="0 0 30 30" aria-hidden="true"><rect width="30" height="30" rx="8" fill="#3182f6"/><path d="M7.5 22h4.5v-4.5h4.5V13h4.5V8.5" fill="none" stroke="#fff" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/><path d="M17.8 8.5h3.2v3.2" fill="none" stroke="#fff" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/></svg></div>' +
      '<h2 class="dcl-h">디코딩 자본주의 로그인</h2><p class="dcl-p">로그인하면 계산 결과를 <b>내 저장함</b>에 저장하고 어느 기기에서든 다시 열 수 있습니다.</p>' +
      ['kakao', 'naver', 'google'].filter(function (p) { return PROV[p]; }).map(function (p) {
        return '<button type="button" class="dcl-b dcl-' + p + '" data-prov="' + p + '">' + LOGO[p] + '<span>' + (p === 'kakao' ? '카카오 로그인' : p === 'naver' ? '네이버 로그인' : 'Google 계정으로 로그인') + '</span></button>';
      }).join('') +
      '<p class="dcl-s">처음 로그인하면 <a href="/terms/" target="_blank">이용약관</a>·<a href="/privacy/" target="_blank">개인정보처리방침</a> 동의 후 가입됩니다. 이메일·전화번호는 받지 않고 회원 식별값과 닉네임만 저장합니다. 만 14세 미만은 가입할 수 없습니다.</p></div>';
    el.classList.add('open');
    var f = el.querySelector('[data-prov]'); if (f) f.focus();
  }
  function paint() {
    var w = $('dc-auth'); if (!w) return;
    var a = getAuth();
    if (!PROV || !Object.keys(PROV).length) { w.hidden = true; return; }
    w.hidden = false;
    w.innerHTML = a
      ? '<button type="button" class="lang-btn dca-me" id="dca-me" aria-haspopup="menu" aria-expanded="false"><span class="dca-av">' + esc((a.user && a.user.nick || '회')[0]) + '</span><span class="dca-nm">' + esc(a.user && a.user.nick || '회원') + '</span><span class="lang-arrow">▼</span></button>' +
        '<div class="lang-menu dca-menu" id="dca-menu" role="menu"><a class="lang-opt" role="menuitem" href="/saved/"><span class="lang-name">내 저장함</span></a><button type="button" class="lang-opt" role="menuitem" data-act="logout"><span class="lang-name">로그아웃</span></button></div>'
      : '<button type="button" class="lang-btn dca-login" id="dca-login">로그인</button>';
    saveBtn();
  }
  /* ── 계산기 입력값 저장·복원 ── */
  function pageKey() { var m = location.pathname.match(/^\/([a-z0-9\-]+)\/?$/); return m ? m[1] : ''; }
  function activePage() { return document.querySelector('.app-page.active') || document.querySelector('.app-page'); }
  function snapshot() { return window.dcState ? window.dcState.snapshot(false) : {}; }   /* 화면 입력값 전체 ([SHARE] 의 dcState) */
  function toast(t) {
    var el = $('dca-toast'); if (!el) { el = document.createElement('div'); el.id = 'dca-toast'; el.className = 'dca-toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
    el.textContent = t; el.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(function () { el.classList.remove('on'); }, 2800);
  }
  function saveBtn() {
    var key = pageKey(), pg = activePage(), old = document.getElementById('dca-save');
    if (!key || !pg || key === 'saved' || !PROV || !Object.keys(PROV).length) { if (old) old.remove(); return; }
    var host = pg.querySelector('.header-left'); if (!host) return;
    if (!old) { old = document.createElement('button'); old.type = 'button'; old.id = 'dca-save'; old.className = 'dca-save'; host.appendChild(old); }
    old.innerHTML = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4 2h8a1 1 0 0 1 1 1v11l-5-3-5 3V3a1 1 0 0 1 1-1z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>' + (getAuth() ? '이 계산 내 저장함에 저장' : '로그인하고 이 계산 저장');
  }
  function doSave() {
    if (!getAuth()) { modal(); return; }
    var h1 = activePage().querySelector('h1'), def = (h1 ? h1.textContent.trim() : document.title) + ' · ' + new Date().toLocaleDateString('ko-KR');
    var title = prompt('저장할 이름', def); if (title == null) return;
    title = title.trim() || def;
    api('POST', '/saves', { page: pageKey(), title: title, data: snapshot() }).then(function () { toast('내 저장함에 저장했습니다'); })
      .catch(function (e) { toast(e.status === 409 ? '저장함이 가득 찼습니다 (최대 ' + ((e.body && e.body.max) || 200) + '개)' : e.status === 401 ? '다시 로그인해 주세요' : '저장하지 못했습니다'); });
  }
  function loadParam() {
    var m = location.search.match(/[?&]load=(\d+)/); if (!m || !getAuth()) return;
    api('GET', '/saves/' + m[1]).then(function (j) {
      var d = j.save && j.save.data; if (!d) return;
      if (window.dcState) window.dcState.apply(d);
      toast('‘' + j.save.title + '’ 불러옴');
      try { history.replaceState(null, '', location.pathname); } catch (e) {}
    }).catch(function () { toast('저장한 계산을 불러오지 못했습니다'); });
  }
  document.addEventListener('click', function (e) {
    if (!e.target.closest) return;
    if (e.target.closest('#dca-login')) { modal(); return; }
    if (e.target.closest('#dca-save')) { doSave(); return; }
    var me = e.target.closest('#dca-me'), menu = $('dca-menu');
    if (me && menu) { var o = !menu.classList.contains('open'); menu.classList.toggle('open', o); me.setAttribute('aria-expanded', o); return; }
    if (e.target.closest('[data-act="logout"]')) { setAuth(null); paint(); toast('로그아웃했습니다'); return; }
    if (menu && !e.target.closest('#dc-auth')) { menu.classList.remove('open'); if ($('dca-me')) $('dca-me').setAttribute('aria-expanded', 'false'); }
  });
  window.dcAuth = { get: getAuth, set: setAuth, open: function () { if (PROV) modal(); }, api: function (m, p, b) { return api(m, p, b); } };
  function init() {
    endpoint().then(function (ep) {
      if (!ep) return; EP = ep.replace(/\/$/, '');
      return config().then(function (p) {
        PROV = p; paint();
        if (getAuth()) { api('GET', '/auth/me').then(function (j) { var a = getAuth(); if (a && j.user) { a.user = j.user; setAuth(a); paint(); } }).catch(function () {}); }
        loadParam();
        if (/[?&]login=1/.test(location.search) && PROV && Object.keys(PROV).length) { if (!getAuth()) modal(); try { history.replaceState(null, '', location.pathname); } catch (e) {} }
      });
    }).catch(function () {});
  }
  /* 탭 이동(pushState·뒤로가기) 후 새 화면에 저장 버튼 다시 달기 */
  (function () { var ps = history.pushState; history.pushState = function () { var r = ps.apply(this, arguments); setTimeout(saveBtn, 30); return r; }; window.addEventListener('popstate', function () { setTimeout(saveBtn, 30); }); })();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
