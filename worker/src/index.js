/* 디코딩 자본주의 방문자 수 카운터 (Cloudflare Worker + D1)
 * · 같은 IP는 하루(한국 시간 기준) 1번만 셉니다.
 * · IP 원문은 저장하지 않습니다: SHA-256(SALT + 날짜 + IP) 해시만 그날 하루 중복 확인용으로 보관하고,
 *   매일 새벽 정리 작업이 2일 지난 해시를 지웁니다. 날짜마다 해시가 달라 다른 날과 연결할 수도 없습니다.
 * · POST /hit  → 오늘 처음 온 IP면 1 증가 후 {today, total} 반환
 *   GET  /     → 세지 않고 {today, total} 만 반환
 * · 허용된 사이트(ALLOWED_ORIGINS)에서 온 요청만 셉니다. 검색봇·크롤러는 세지 않습니다.
 */
const BOT = /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|kakaotalk-scrap|yeti|daum|headless|lighthouse|preview|python|curl|wget|java\/|go-http|axios|node-fetch/i;

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
