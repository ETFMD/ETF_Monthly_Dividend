/* 공유 미리보기 이미지(1200×630) 생성 — assets/og/<경로>.png
   routes.json 의 도구 이름·설명으로 그림. 도구를 추가·이름 변경했을 때만 다시 실행하면 됩니다.
   실행: node scripts/make_og_images.js   (playwright-core 와 Chromium, 한글 글꼴(Noto Sans CJK KR) 필요) */
const fs = require('fs'), path = require('path');
const { chromium } = require(process.env.PW_CORE || 'playwright-core');
const ROOT = path.join(__dirname, '..');
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/routes.json'), 'utf8'));
const GROUP = { simulator: '분배 시뮬레이터', finance: '금융 계산기', etc: '기타 금융 자료', index: '지수 성장률' };
const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function page(r, home) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{width:1200px;height:630px;font-family:'Noto Sans CJK KR','Noto Sans KR',sans-serif;color:#f2f2f4;
       background:radial-gradient(900px 500px at 85% -10%,rgba(49,130,246,.28),transparent 60%),radial-gradient(700px 420px at -10% 110%,rgba(240,68,82,.16),transparent 60%),#101217;}
  .wrap{position:absolute;inset:0;padding:72px 84px;display:flex;flex-direction:column}
  .top{display:flex;align-items:center;gap:16px;font-size:30px;font-weight:700;color:#d5d8de}
  .logo{width:46px;height:46px;border-radius:12px;background:linear-gradient(135deg,#3182f6,#1b5fd1);display:flex;align-items:center;justify-content:center;font-size:26px;color:#fff}
  .chip{margin-left:auto;font-size:22px;font-weight:500;color:#8fb8ff;border:1.5px solid rgba(49,130,246,.55);border-radius:999px;padding:6px 20px}
  h1{margin-top:auto;font-size:${r.short.length > 22 ? 60 : 72}px;line-height:1.18;font-weight:800;letter-spacing:-1.5px;word-break:keep-all}
  p{margin-top:26px;font-size:28px;line-height:1.5;color:#a9adb7;word-break:keep-all;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;max-width:1000px}
  .bar{position:absolute;left:0;top:0;bottom:0;width:10px;background:linear-gradient(#3182f6,#f04452)}
  </style></head><body><div class="bar"></div><div class="wrap">
  <div class="top"><div class="logo">₩</div>${esc(cfg.brand)}${home ? '' : `<span class="chip">${esc(GROUP[r.group] || '')}</span>`}</div>
  <h1>${esc(home ? '돈은 늘고, 현금의 가치는 줄어듭니다' : r.short)}</h1>
  <p>${esc(r.desc)}</p></div></body></html>`;
}
(async () => {
  const b = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
  const pg = await b.newPage({ viewport: { width: 1200, height: 630 } });
  const list = [{ ...cfg.home, path: 'home', home: true }, ...cfg.routes];
  for (const r of list) {
    await pg.setContent(page(r, r.home), { waitUntil: 'load' });
    await pg.screenshot({ path: path.join(ROOT, 'assets/og', r.path + '.png') });
    console.log('  og', r.path);
  }
  await b.close();
})();
