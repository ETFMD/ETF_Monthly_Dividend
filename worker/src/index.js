/* 디코딩 자본주의 방문자 수 카운터 (Cloudflare Worker + D1)
 * · 같은 IP는 하루(한국 시간 기준) 1번만 셉니다.
 * · IP 원문은 저장하지 않습니다: SHA-256(SALT + 날짜 + IP) 해시만 그날 하루 중복 확인용으로 보관하고,
 *   매일 새벽 정리 작업이 2일 지난 해시를 지웁니다. 날짜마다 해시가 달라 다른 날과 연결할 수도 없습니다.
 * · POST /hit  → 오늘 처음 온 IP면 1 증가 후 {today, total} 반환
 *   GET  /     → 세지 않고 {today, total} 만 반환
 * · 허용된 사이트(ALLOWED_ORIGINS)에서 온 요청만 셉니다. 검색봇·크롤러는 세지 않습니다.
 *
 * GET /fear → CNN 공포·탐욕 지수 (점수·과거값·7개 구성 지표·1년 추이)를 실시간에 가깝게 전달
 *   · CNN 은 브라우저에서 직접 부를 수 없어(CORS) 이 Worker 가 대신 받아 옵니다.
 *   · 5분 동안은 D1 에 저장한 값을 다시 씁니다 (workers.dev 에서는 Cache API 가 동작하지 않음).
 */
const BOT = /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|kakaotalk-scrap|yeti|daum|headless|lighthouse|preview|python|curl|wget|java\/|go-http|axios|node-fetch/i;

const CNN_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const CNN_PARTS = [['market_momentum_sp500', '주가 모멘텀'], ['stock_price_strength', '주가 강도'], ['stock_price_breadth', '주가 폭'],
  ['put_call_options', '풋/콜 비율'], ['market_volatility_vix', '시장 변동성 (VIX)'], ['safe_haven_demand', '안전자산 수요'], ['junk_bond_demand', '정크본드 수요']];
const FEAR_TTL = 300;   // 초
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
  const t = await env.DB.prepare('SELECT n FROM daily WHERE day = ?').bind(day).first();
  const s = await env.DB.prepare('SELECT COALESCE(SUM(n), 0) AS n FROM daily').first();
  return { day, today: t ? t.n : 0, total: s ? s.n : 0 };
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
      if (url.pathname === '/fear' && req.method === 'GET') {
        try { return json(await fear(env)); } catch (e) { return json({ error: 'cnn', detail: String(e && e.message || e) }, 502); }
      }
      return json({ error: 'not found' }, 404);
    } catch (e) {
      return json({ error: 'server' }, 500);
    }
  },
  /* 매일 정리: 2일 지난 중복 확인용 해시 삭제 (일별 방문자 수는 계속 보관) */
  async scheduled(event, env) {
    const cut = kstDay(Date.now() - 2 * 86400e3);
    await env.DB.prepare('DELETE FROM visits WHERE day < ?').bind(cut).run();
  },
};
