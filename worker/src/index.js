/* 디코딩 자본주의 방문자 수 카운터 (Cloudflare Worker + D1)
 * · 같은 IP는 하루(한국 시간 기준) 1번만 셉니다.
 * · IP 원문은 저장하지 않습니다: SHA-256(SALT + 날짜 + IP) 해시만 그날 하루 중복 확인용으로 보관하고,
 *   매일 새벽 정리 작업이 2일 지난 해시를 지웁니다. 날짜마다 해시가 달라 다른 날과 연결할 수도 없습니다.
 * · POST /hit  → 오늘 처음 온 IP면 1 증가 후 {today, yesterday, max, maxDay, total} 반환
 *   GET  /     → 세지 않고 같은 값만 반환
 * · 허용된 사이트(ALLOWED_ORIGINS)에서 온 요청만 셉니다. 검색봇·크롤러는 세지 않습니다.
 *
 * GET /geo  → {country} 접속 국가 코드 (기본 언어 선택용 · 기록하지 않음)
 *
 * GET /fear → CNN 공포·탐욕 지수 (점수·과거값·7개 구성 지표·1년 추이)를 실시간에 가깝게 전달
 *   · CNN 은 브라우저에서 직접 부를 수 없어(CORS) 이 Worker 가 대신 받아 옵니다.
 *   · 5분 동안은 D1 에 저장한 값을 다시 씁니다 (workers.dev 에서는 Cache API 가 동작하지 않음).
 *
 * 한국 수집기 (/kr) — 해외 접속을 막는 운용사 사이트(RISE 등)를 한국 서버(Oracle Cloud 서울)가 대신 받아 둠
 *   · GET  /kr?u=…        저장된 응답 반환 + '계속 받아 달라'고 표시 (허용 주소만 · 처음이면 202 → 몇 분 뒤 다시)
 *   · GET  /kr/jobs?k=…   (수집기 전용) 30분 넘게 묵은 요청 주소 목록
 *   · POST /kr/put?k=…    (수집기 전용) [{u, st, v}] 받은 내용 저장
 *   · GET  /kr/status     수집기 마지막 접속 시각·국가·대기 주소 수
 *   · 수집기 열쇠는 원문 대신 SHA-256 값만 이 코드에 둠 · 3일 동안 아무도 찾지 않은 주소는 정리
 *
 * 15분마다(cron) GitHub Actions '시세 데이터 갱신'을 직접 실행시킴 (GitHub 자체 예약 실행은 자주 늦어지거나 누락됨)
 *   · 한국장과 공시 시간(평일 09~20시)·미국장(평일 22~07시, 한국 시간) 15분마다, 그 밖에는 3시간마다
 *   · GH_TOKEN(저장소 1개·Actions 쓰기 권한만 있는 토큰) 비밀값이 있을 때만 동작 · GET /status 로 마지막 실행 결과 확인
 */
const REPO = 'ETFMD/d-capitalism';
const WORKFLOW = 'update-market-data.yml';
const BOT = /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|kakaotalk-scrap|yeti|daum|headless|lighthouse|preview|python|curl|wget|java\/|go-http|axios|node-fetch/i;

const CNN_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const CNN_PARTS = [['market_momentum_sp500', '주가 모멘텀'], ['stock_price_strength', '주가 강도'], ['stock_price_breadth', '주가 폭'],
  ['put_call_options', '풋/콜 비율'], ['market_volatility_vix', '시장 변동성 (VIX)'], ['safe_haven_demand', '안전자산 수요'], ['junk_bond_demand', '정크본드 수요']];
const FEAR_TTL = 300;   // 초
const RELAY_HOSTS = ['www.tigeretf.com', 'investments.miraeasset.com', 'www.riseetf.co.kr', 'riseetf.co.kr', 'www.plusetf.co.kr'];   // /relay 허용 주소
const KR_HOSTS = ['www.riseetf.co.kr', 'riseetf.co.kr', 'www.kbam.co.kr', 'kbam.co.kr'];   // 한국 수집기 허용 주소
const KR_KEY = '66862eb910881b358a466876f4303e5ff3d92c59';     // SHA-256(수집기 열쇠) 앞 40자 (sha256() 과 같은 길이)
const KR_TTL = 1800, KR_KEEP = 3 * 86400, KR_MAX = 600;                                  // 다시 받는 주기 · 보관 · 최대 주소 수(초·개)
const r1 = (v) => (v == null || isNaN(v) ? null : Math.round(v * 10) / 10);

async function cnnFear() {
  const since = new Date(Date.now() - 370 * 86400e3).toISOString().slice(0, 10);
  const headers = { 'User-Agent': CNN_UA, Referer: 'https://edition.cnn.com/markets/fear-and-greed', Origin: 'https://edition.cnn.com',
    Accept: 'application/json, text/plain, */*', 'Accept-Language': 'en-US,en;q=0.9,ko;q=0.8', 'Cache-Control': 'no-cache' };
  let err = null;
  for (const url of [`https://production.dataviz.cnn.io/index/fearandgreed/graphdata/${since}`, 'https://production.dataviz.cnn.io/index/fearandgreed/graphdata']) {
    try {
      const r = await fetch(url, { headers });
      if (!r.ok) throw new Error('CNN ' + r.status);
      const d = await r.json(), fg = d.fear_and_greed;
      if (!fg || fg.score == null) throw new Error('CNN 형식');
      return {
        source: 'CNN', score: r1(fg.score), rating: fg.rating || null, time: fg.timestamp || null,
        prev: { close: r1(fg.previous_close), w1: r1(fg.previous_1_week), m1: r1(fg.previous_1_month), y1: r1(fg.previous_1_year) },
        components: CNN_PARTS.filter(([k]) => d[k] && d[k].score != null).map(([k, n]) => ({ key: k, name: n, score: r1(d[k].score), rating: d[k].rating || null })),
        historical: ((d.fear_and_greed_historical || {}).data || []).map((p) => ({ date: new Date(p.x).toISOString().slice(0, 10), score: r1(p.y) })),
      };
    } catch (e) { err = e; }
  }
  throw err;
}
async function fear(env) {
  const now = Math.floor(Date.now() / 1000);
  const row = await env.DB.prepare('SELECT t, v FROM cache WHERE k = ?').bind('fear').first();
  if (row && now - row.t < FEAR_TTL) return { ...JSON.parse(row.v), fetched: row.t, cached: true };
  try {
    const v = await cnnFear();
    await env.DB.prepare('INSERT INTO cache (k, t, v) VALUES (?, ?, ?) ON CONFLICT(k) DO UPDATE SET t = excluded.t, v = excluded.v').bind('fear', now, JSON.stringify(v)).run();
    return { ...v, fetched: now, cached: false };
  } catch (e) {
    if (row) return { ...JSON.parse(row.v), fetched: row.t, cached: true, stale: true };   // CNN 일시 오류 → 직전 값
    throw e;
  }
}

async function dispatch(env) {
  let status = 0, detail = '';
  try {
    const r = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + env.GH_TOKEN, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28',
                 'User-Agent': 'etfmd-counter', 'Content-Type': 'application/json' },
      body: JSON.stringify({ ref: 'main' }),
    });
    status = r.status;
    if (status !== 204) detail = (await r.text()).slice(0, 200);
  } catch (e) { detail = String(e && e.message || e).slice(0, 200); }
  const now = Math.floor(Date.now() / 1000);
  await env.DB.prepare('INSERT INTO cache (k, t, v) VALUES (?, ?, ?) ON CONFLICT(k) DO UPDATE SET t = excluded.t, v = excluded.v')
    .bind('dispatch', now, JSON.stringify({ status, ok: status === 204, detail })).run();
}

function kstDay(ms) {
  return new Date(ms + 9 * 3600e3).toISOString().slice(0, 10);   // YYYY-MM-DD (한국 시간)
}
async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 40);
}
function corsHeaders(env, origin) {
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const ok = allowed.includes(origin);
  return {
    ok,
    headers: {
      'Access-Control-Allow-Origin': ok ? origin : (allowed[0] || '*'),
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
      Vary: 'Origin',
    },
  };
}
async function counts(env, day) {
  const yday = kstDay(Date.parse(day + 'T00:00:00+09:00') - 86400e3);
  const [t, y, s, m] = await env.DB.batch([
    env.DB.prepare('SELECT n FROM daily WHERE day = ?').bind(day),
    env.DB.prepare('SELECT n FROM daily WHERE day = ?').bind(yday),
    env.DB.prepare('SELECT COALESCE(SUM(n), 0) AS n FROM daily'),
    env.DB.prepare('SELECT day, n FROM daily ORDER BY n DESC, day DESC LIMIT 1'),   // 하루 최대 방문자 (같으면 최근 날)
  ]);
  const one = (r) => (r && r.results && r.results[0]) || null;
  const T = one(t), Y = one(y), S = one(s), M = one(m);
  return { day, today: T ? T.n : 0, yesterday: Y ? Y.n : 0, total: S ? S.n : 0, max: M ? M.n : 0, maxDay: M ? M.day : null };
}

async function kr(req, env, url, json) {
  const now = Math.floor(Date.now() / 1000);
  const authed = async () => (await sha256(url.searchParams.get('k') || '')) === KR_KEY;
  if (url.pathname === '/kr' && req.method === 'GET') {
    let target;
    try { target = new URL(url.searchParams.get('u') || ''); } catch (e) { return json({ error: 'bad url' }, 400); }
    if (target.protocol !== 'https:' || !KR_HOSTS.includes(target.hostname)) return json({ error: 'host not allowed' }, 403);
    const u = target.toString();
    const row = await env.DB.prepare('SELECT t, st, v FROM kr WHERE u = ?').bind(u).first();
    if (row) await env.DB.prepare('UPDATE kr SET want = ? WHERE u = ?').bind(now, u).run();
    else {
      const c = await env.DB.prepare('SELECT COUNT(*) AS n FROM kr').first();
      if (c && c.n >= KR_MAX) return json({ error: 'full' }, 429);
      await env.DB.prepare('INSERT OR IGNORE INTO kr (u, want) VALUES (?, ?)').bind(u, now).run();
    }
    if (!row || row.t == null) return json({ pending: true }, 202);
    return new Response(row.v, { status: row.st || 200, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-KR-At': String(row.t) } });
  }
  if (url.pathname === '/kr/jobs' && req.method === 'GET') {
    if (!(await authed())) return json({ error: 'forbidden' }, 403);
    await env.DB.batch([
      env.DB.prepare('DELETE FROM kr WHERE want < ?').bind(now - KR_KEEP),
      env.DB.prepare('INSERT INTO cache (k, t, v) VALUES (?, ?, ?) ON CONFLICT(k) DO UPDATE SET t = excluded.t, v = excluded.v')
        .bind('kr_agent', now, JSON.stringify({ country: (req.cf && req.cf.country) || null, colo: (req.cf && req.cf.colo) || null })),
    ]);
    const r = await env.DB.prepare('SELECT u FROM kr WHERE t IS NULL OR t < ? ORDER BY t IS NOT NULL, t LIMIT 80').bind(now - KR_TTL).all();
    return json({ urls: (r.results || []).map((x) => x.u) });
  }
  if (url.pathname === '/kr/put' && req.method === 'POST') {
    if (!(await authed())) return json({ error: 'forbidden' }, 403);
    const items = await req.json();
    const st = (Array.isArray(items) ? items : []).filter((x) => x && typeof x.u === 'string' && typeof x.v === 'string')
      .map((x) => env.DB.prepare('UPDATE kr SET t = ?, st = ?, v = ? WHERE u = ?').bind(now, x.st | 0, x.v.slice(0, 1500000), x.u));
    if (st.length) await env.DB.batch(st);
    return json({ ok: st.length });
  }
  if (url.pathname === '/kr/status' && req.method === 'GET') {
    const [a, c] = await env.DB.batch([
      env.DB.prepare('SELECT t, v FROM cache WHERE k = ?').bind('kr_agent'),
      env.DB.prepare('SELECT COUNT(*) AS n, SUM(t IS NOT NULL) AS done FROM kr'),
    ]);
    const A = a.results && a.results[0], C = (c.results && c.results[0]) || {};
    return json({ agent: A ? { ...JSON.parse(A.v), at: new Date(A.t * 1000).toISOString() } : null, urls: C.n || 0, fetched: C.done || 0 });
  }
  return json({ error: 'not found' }, 404);
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const origin = req.headers.get('Origin') || '';
    const cors = corsHeaders(env, origin);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors.headers });
    const json = (obj, status = 200) => new Response(JSON.stringify(obj), {
      status, headers: { ...cors.headers, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    });
    const day = kstDay(Date.now());
    try {
      if (url.pathname === '/hit' && req.method === 'POST') {
        const ip = req.headers.get('CF-Connecting-IP') || '';
        const ua = req.headers.get('User-Agent') || '';
        if (cors.ok && ip && ua && !BOT.test(ua)) {
          const h = await sha256((env.SALT || '') + '|' + day + '|' + ip);
          const r = await env.DB.prepare('INSERT OR IGNORE INTO visits (day, h) VALUES (?, ?)').bind(day, h).run();
          if (r.meta && r.meta.changes > 0) {
            await env.DB.prepare('INSERT INTO daily (day, n) VALUES (?, 1) ON CONFLICT(day) DO UPDATE SET n = n + 1').bind(day).run();
          }
        }
        return json(await counts(env, day));
      }
      if (url.pathname === '/' && req.method === 'GET') return json(await counts(env, day));
      /* GET /geo → 접속 국가 (Cloudflare 가 IP 로 판별한 ISO 국가 코드) — 사이트 기본 언어 선택용, 저장하지 않음 */
      if (url.pathname === '/geo' && req.method === 'GET') return json({ country: (req.cf && req.cf.country) || null });
      if (url.pathname === '/status' && req.method === 'GET') {
        const row = await env.DB.prepare('SELECT t, v FROM cache WHERE k = ?').bind('dispatch').first();
        return json({ token: !!env.GH_TOKEN, lastDispatch: row ? { ...JSON.parse(row.v), at: new Date(row.t * 1000).toISOString() } : null });
      }
      /* GET /relay?u=… → 해외 서버(GitHub Actions)를 막는 운용사 사이트의 공개 분배금 자료만 대신 받아 옴 (허용 주소만 · GET 만) */
      if (url.pathname === '/relay' && req.method === 'GET') {
        let target;
        try { target = new URL(url.searchParams.get('u') || ''); } catch (e) { return json({ error: 'bad url' }, 400); }
        if (target.protocol !== 'https:' || !RELAY_HOSTS.includes(target.hostname)) return json({ error: 'host not allowed' }, 403);
        const r = await fetch(target.toString(), { headers: { 'User-Agent': CNN_UA, Accept: req.headers.get('Accept') || '*/*', 'Accept-Language': 'ko-KR,ko;q=0.9',
          Referer: target.origin + '/' }, redirect: 'follow' });
        return new Response(r.body, { status: r.status, headers: { 'Content-Type': r.headers.get('Content-Type') || 'text/plain', 'Cache-Control': 'no-store' } });
      }
      if (url.pathname.startsWith('/kr')) return await kr(req, env, url, json);
      if (url.pathname === '/fear' && req.method === 'GET') {
        try { return json(await fear(env)); } catch (e) { return json({ error: 'cnn', detail: String(e && e.message || e) }, 502); }
      }
      return json({ error: 'not found' }, 404);
    } catch (e) {
      return json({ error: 'server' }, 500);
    }
  },
  /* 15분마다: 시세 수집 실행 + 하루 한 번 오래된 방문 해시 정리 */
  async scheduled(event, env, ctx) {
    const t = new Date(event.scheduledTime || Date.now());
    const k = new Date(t.getTime() + 9 * 3600e3);                       // 한국 시간
    const h = k.getUTCHours(), m = k.getUTCMinutes(), dow = k.getUTCDay();   // 0=일
    if (h === 3 && m < 15) {                                             // 매일 03:00~03:14 (한국 시간)
      const cut = kstDay(Date.now() - 2 * 86400e3);
      ctx.waitUntil(env.DB.prepare('DELETE FROM visits WHERE day < ?').bind(cut).run());
    }
    if (!env.GH_TOKEN) return;
    const weekday = dow >= 1 && dow <= 5, usOpen = (h >= 22 && dow >= 1 && dow <= 5) || (h < 7 && dow >= 2 && dow <= 6);
    const market = (weekday && h >= 9 && h < 20) || usOpen;           // 09~20시: 한국장 + 장 마감 뒤 ETF 분배금 공시 시간
    if (!market && !(h % 3 === 0 && m < 15)) return;                    // 장 밖에는 3시간마다
    ctx.waitUntil(dispatch(env));
  },
};
