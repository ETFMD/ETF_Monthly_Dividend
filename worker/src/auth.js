/* ── 간편 로그인 (카카오·네이버·구글) + 내 저장함 ──
 * 흐름 (OAuth 2.0 인가 코드 방식 · 비밀값은 이 Worker 에만 있음)
 *   1) 사이트가 GET /auth/config 로 켜진 제공자와 공개 client_id 를 받아 로그인 버튼을 보여 줌
 *   2) 이용자가 제공자 로그인 → 제공자가 https://d-capitalism.com/auth/callback/ 으로 code·state 를 돌려줌
 *      (state 는 사이트가 만들어 sessionStorage 에 두고 대조 — CSRF 방지 · 구글은 PKCE 도 함께)
 *   3) 콜백 페이지가 POST /auth/login {provider, code, redirect_uri, code_verifier} → Worker 가 비밀값으로 토큰 교환 → 회원 식별값·닉네임만 받음
 *      · 이미 회원이면 로그인 토큰 발급 · 처음이면 10분짜리 가입 티켓을 주고, 약관·개인정보·만 14세 이상 동의 후 POST /auth/signup 으로 가입
 *   4) 로그인 토큰 = HMAC-SHA256(AUTH_SECRET) 서명한 {uid, ver, exp} (30일) — 사이트가 localStorage 에 두고 Authorization: Bearer 로 보냄
 * 저장하는 개인정보: 로그인 제공자, 제공자 회원 식별값, 닉네임, 가입·최근 로그인 시각, 동의 시각, 저장한 계산 입력값 (이메일·전화번호·프로필 사진은 받지 않음)
 * 탈퇴: DELETE /auth/me → 회원·저장함 즉시 삭제 (카카오는 KAKAO_ADMIN_KEY 가 있으면 앱 연결도 끊음)
 * 비밀값(Worker secret): AUTH_SECRET(자동 생성) · KAKAO_CLIENT_ID(REST API 키) · KAKAO_CLIENT_SECRET(선택) · KAKAO_ADMIN_KEY(선택)
 *                        NAVER_CLIENT_ID · NAVER_CLIENT_SECRET · GOOGLE_CLIENT_ID · GOOGLE_CLIENT_SECRET — 있는 제공자만 켜짐
 */
const enc = new TextEncoder();
const TOKEN_DAYS = 30, TICKET_MIN = 10, MAX_SAVES = 200, MAX_DATA = 16000, TERMS_VER = '2026-10-09';

function b64u(buf) {
  const s = typeof buf === 'string' ? btoa(unescape(encodeURIComponent(buf))) : btoa(String.fromCharCode(...new Uint8Array(buf)));
  return s.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function unb64u(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '=';
  return decodeURIComponent(escape(atob(s)));
}
async function hmac(secret, data) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64u(await crypto.subtle.sign('HMAC', key, enc.encode(data)));
}
function safeEq(a, b) { if (a.length !== b.length) return false; let x = 0; for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i); return x === 0; }
async function sign(env, obj) { const p = b64u(JSON.stringify(obj)); return p + '.' + (await hmac(env.AUTH_SECRET, p)); }
async function verify(env, tok, kind) {
  if (!tok || !env.AUTH_SECRET) return null;
  const [p, s] = String(tok).split('.');
  if (!p || !s || !safeEq(s, await hmac(env.AUTH_SECRET, p))) return null;
  let o; try { o = JSON.parse(unb64u(p)); } catch (e) { return null; }
  if (o.k !== kind || !(o.exp > Date.now() / 1000)) return null;
  return o;
}

function providers(env) {
  const out = {};
  if (env.KAKAO_CLIENT_ID) out.kakao = { client_id: env.KAKAO_CLIENT_ID };
  if (env.NAVER_CLIENT_ID && env.NAVER_CLIENT_SECRET) out.naver = { client_id: env.NAVER_CLIENT_ID };
  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) out.google = { client_id: env.GOOGLE_CLIENT_ID };
  return out;
}
function redirectOk(env, uri) {   /* 사이트(허용 출처)의 /auth/callback/ 만 */
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  return allowed.some((o) => uri === o + '/auth/callback/');
}
async function form(url, body, headers) {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8', ...(headers || {}) }, body: new URLSearchParams(body).toString() });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error('token: ' + (j.error_description || j.error || r.status));
  return j;
}
async function getJSON(url, token) {
  const r = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error('profile: ' + r.status);
  return j;
}
/* 제공자 code → {provider, pid, nick} */
async function profile(env, p, code, redirect, verifier, state) {
  if (p === 'kakao') {
    const body = { grant_type: 'authorization_code', client_id: env.KAKAO_CLIENT_ID, redirect_uri: redirect, code };
    if (env.KAKAO_CLIENT_SECRET) body.client_secret = env.KAKAO_CLIENT_SECRET;
    const t = await form('https://kauth.kakao.com/oauth/token', body);
    const u = await getJSON('https://kapi.kakao.com/v2/user/me', t.access_token);
    const nick = (u.kakao_account && u.kakao_account.profile && u.kakao_account.profile.nickname) || (u.properties && u.properties.nickname) || '';
    return { provider: p, pid: String(u.id), nick };
  }
  if (p === 'naver') {
    const t = await form('https://nid.naver.com/oauth2.0/token', { grant_type: 'authorization_code', client_id: env.NAVER_CLIENT_ID, client_secret: env.NAVER_CLIENT_SECRET, code, state: state || '' });
    const u = await getJSON('https://openapi.naver.com/v1/nid/me', t.access_token);
    if (!u.response || !u.response.id) throw new Error('naver profile');
    return { provider: p, pid: String(u.response.id), nick: u.response.nickname || u.response.name || '' };
  }
  if (p === 'google') {
    const body = { grant_type: 'authorization_code', client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, redirect_uri: redirect, code };
    if (verifier) body.code_verifier = verifier;
    const t = await form('https://oauth2.googleapis.com/token', body);
    const u = await getJSON('https://openidconnect.googleapis.com/v1/userinfo', t.access_token);
    if (!u.sub) throw new Error('google profile');
    return { provider: p, pid: String(u.sub), nick: u.name || u.given_name || '' };
  }
  throw new Error('provider');
}
function cleanNick(s) { s = String(s || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 30); return s || '회원'; }
async function issue(env, user) {
  const exp = Math.floor(Date.now() / 1000) + TOKEN_DAYS * 86400;
  return { token: await sign(env, { k: 'u', uid: user.id, v: user.ver || 0, exp }), exp, user: pub(user) };
}
function pub(u) { return { id: u.id, provider: u.provider, nick: u.nick, created: u.created }; }
async function me(env, req) {
  const h = req.headers.get('Authorization') || '';
  const t = await verify(env, h.replace(/^Bearer\s+/i, ''), 'u');
  if (!t) return null;
  const u = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(t.uid).first();
  if (!u || (u.ver || 0) !== (t.v || 0)) return null;
  return u;
}

export async function auth(req, env, url, json) {
  const path = url.pathname, now = Math.floor(Date.now() / 1000);
  if (path === '/auth/config' && req.method === 'GET') return json({ providers: env.AUTH_SECRET ? providers(env) : {}, terms: TERMS_VER, kakao_js: env.KAKAO_JS_KEY || '' });   /* kakao_js: 카카오톡 공유용 자바스크립트 키(공개 값) */
  if (!env.AUTH_SECRET) return json({ error: 'auth disabled' }, 503);
  let body = {};
  if (req.method === 'POST') { try { body = await req.json(); } catch (e) { return json({ error: 'bad json' }, 400); } }

  if (path === '/auth/login' && req.method === 'POST') {
    const p = body.provider;
    if (!providers(env)[p]) return json({ error: 'provider disabled' }, 400);
    if (!body.code || (p !== 'naver' && !redirectOk(env, body.redirect_uri || ''))) return json({ error: 'bad request' }, 400);
    let prof;
    try { prof = await profile(env, p, String(body.code), body.redirect_uri, body.code_verifier, body.state); } catch (e) { return json({ error: 'oauth', detail: String(e.message || e) }, 401); }
    const u = await env.DB.prepare('SELECT * FROM users WHERE provider = ? AND pid = ?').bind(prof.provider, prof.pid).first();
    if (u) {
      await env.DB.prepare('UPDATE users SET last = ? WHERE id = ?').bind(now, u.id).run();
      return json(await issue(env, u));
    }
    const ticket = await sign(env, { k: 't', p: prof.provider, pid: prof.pid, nick: cleanNick(prof.nick), exp: now + TICKET_MIN * 60 });
    return json({ need_consent: true, ticket, nick: cleanNick(prof.nick), provider: prof.provider, terms: TERMS_VER });
  }
  if (path === '/auth/signup' && req.method === 'POST') {
    const t = await verify(env, body.ticket, 't');
    if (!t) return json({ error: 'ticket expired' }, 401);
    const a = body.agree || {};
    if (!a.age14 || !a.terms || !a.privacy) return json({ error: 'consent required' }, 400);
    await env.DB.prepare('INSERT OR IGNORE INTO users (provider, pid, nick, created, last, agreed, terms_ver, ver) VALUES (?, ?, ?, ?, ?, ?, ?, 0)')
      .bind(t.p, t.pid, t.nick, now, now, now, TERMS_VER).run();
    const u = await env.DB.prepare('SELECT * FROM users WHERE provider = ? AND pid = ?').bind(t.p, t.pid).first();
    return json(await issue(env, u));
  }

  const u = await me(env, req);
  if (!u) return json({ error: 'login required' }, 401);
  if (path === '/auth/me' && req.method === 'GET') {
    const c = await env.DB.prepare('SELECT COUNT(*) AS n FROM saves WHERE uid = ?').bind(u.id).first();
    return json({ user: pub(u), saves: c ? c.n : 0, max: MAX_SAVES });
  }
  if (path === '/auth/logout-all' && req.method === 'POST') {   /* 모든 기기에서 로그아웃 (토큰 무효화) */
    await env.DB.prepare('UPDATE users SET ver = COALESCE(ver, 0) + 1 WHERE id = ?').bind(u.id).run();
    return json({ ok: true });
  }
  if (path === '/auth/me' && req.method === 'DELETE') {          /* 회원 탈퇴 — 회원 정보·저장함 즉시 삭제 */
    if (u.provider === 'kakao' && env.KAKAO_ADMIN_KEY) {
      try { await form('https://kapi.kakao.com/v1/user/unlink', { target_id_type: 'user_id', target_id: u.pid }, { Authorization: 'KakaoAK ' + env.KAKAO_ADMIN_KEY }); } catch (e) {}
    }
    await env.DB.batch([env.DB.prepare('DELETE FROM saves WHERE uid = ?').bind(u.id), env.DB.prepare('DELETE FROM users WHERE id = ?').bind(u.id)]);
    return json({ ok: true });
  }
  if (path === '/saves' && req.method === 'GET') {
    const r = await env.DB.prepare('SELECT id, page, title, created FROM saves WHERE uid = ? ORDER BY id DESC LIMIT ?').bind(u.id, MAX_SAVES).all();
    return json({ saves: r.results || [] });
  }
  if (path === '/saves' && req.method === 'POST') {
    const page = String(body.page || '').replace(/[^a-z0-9\-]/g, '').slice(0, 60), title = String(body.title || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 80);
    const data = JSON.stringify(body.data || {});
    if (!page || !title || data.length > MAX_DATA) return json({ error: 'bad request' }, 400);
    const c = await env.DB.prepare('SELECT COUNT(*) AS n FROM saves WHERE uid = ?').bind(u.id).first();
    if (c && c.n >= MAX_SAVES) return json({ error: 'full', max: MAX_SAVES }, 409);
    const r = await env.DB.prepare('INSERT INTO saves (uid, page, title, data, created) VALUES (?, ?, ?, ?, ?)').bind(u.id, page, title, data, now).run();
    return json({ ok: true, id: r.meta && r.meta.last_row_id });
  }
  const m = path.match(/^\/saves\/(\d+)$/);
  if (m) {
    const id = +m[1];
    if (req.method === 'GET') {
      const s = await env.DB.prepare('SELECT id, page, title, data, created FROM saves WHERE id = ? AND uid = ?').bind(id, u.id).first();
      if (!s) return json({ error: 'not found' }, 404);
      return json({ save: { ...s, data: JSON.parse(s.data) } });
    }
    if (req.method === 'DELETE') {
      await env.DB.prepare('DELETE FROM saves WHERE id = ? AND uid = ?').bind(id, u.id).run();
      return json({ ok: true });
    }
  }
  return json({ error: 'not found' }, 404);
}
