/* 공유 미리보기 이미지(1200×630) 생성 — assets/og/<경로>.png
   routes.json 의 도구 이름·설명으로 그림. 도구를 추가·이름 변경했을 때만 다시 실행하면 됩니다.
   실행: node scripts/make_og_images.js   (playwright-core 와 Chromium, 한글 글꼴(Noto Sans CJK KR) 필요) */
const fs = require('fs'), path = require('path');
const { chromium } = require(process.env.PW_CORE || 'playwright-core');
const ROOT = path.join(__dirname, '..');
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/routes.json'), 'utf8'));
const GROUP = { money: '돈', stock: '주식·ETF', realty: '부동산', passive: '패시브인컴' };
const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
/* 로고: assets/favicon.svg 와 같은 계단 마크 */
const MARK = (n) => `<svg width="${n}" height="${n}" viewBox="0 0 30 30"><rect width="30" height="30" rx="8" fill="#3182f6"/><path d="M7.5 22h4.5v-4.5h4.5V13h4.5V8.5" fill="none" stroke="#fff" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/><path d="M17.8 8.5h3.2v3.2" fill="none" stroke="#fff" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
/* 배경: 오른쪽으로 올라가는 큰 계단 (노동자 → 자본가) */
const STAIRS = `<svg class="stairs" width="560" height="630" viewBox="0 0 560 630"><path d="M40 600H160V480H280V360H400V240H520V120" fill="none" stroke="url(#g)" stroke-width="26" stroke-linecap="round" stroke-linejoin="round"/><defs><linearGradient id="g" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#3182f6" stop-opacity=".05"/><stop offset="1" stop-color="#3182f6" stop-opacity=".55"/></linearGradient></defs></svg>`;
const STEPS = ['소득', '저축', '투자', '자산', '현금흐름', '사업'];
function page(r, home) {
  const title = home ? '노동자에서 <em>자본가로</em>' : esc(r.short);
  const sub = home ? '연봉·자산 순위부터 주식·부동산·패시브인컴까지, 공식 통계로 계산하는 무료 금융 도구 50종' : esc(r.desc);
  const big = home ? 84 : (r.short.length > 24 ? 56 : r.short.length > 16 ? 64 : 74);
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{width:1200px;height:630px;overflow:hidden;font-family:'Noto Sans CJK KR','Noto Sans KR',sans-serif;color:#f2f3f5;
       background:radial-gradient(820px 520px at 100% 0%,rgba(49,130,246,.22),transparent 62%),linear-gradient(160deg,#121621 0%,#0c0e13 100%);}
  .stairs{position:absolute;right:-10px;bottom:-6px}
  .wrap{position:absolute;inset:0;padding:64px 80px 58px;display:flex;flex-direction:column}
  .top{display:flex;align-items:center;gap:16px;font-size:30px;font-weight:700;color:#e4e6ea;letter-spacing:-.5px}
  .top svg{display:block}
  .chip{margin-left:18px;font-size:22px;font-weight:600;color:#8fb8ff;background:rgba(49,130,246,.14);border:1.5px solid rgba(49,130,246,.5);border-radius:999px;padding:5px 18px}
  h1{margin-top:auto;font-size:${big}px;line-height:1.16;font-weight:800;letter-spacing:-2px;word-break:keep-all;max-width:${home ? 1000 : 900}px}
  h1 em{font-style:normal;color:#4c94ff}
  p{margin-top:24px;font-size:28px;line-height:1.48;color:#a7acb6;word-break:keep-all;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;max-width:880px}
  .foot{margin-top:34px;display:flex;align-items:center;gap:10px;font-size:22px;color:#6f7582}
  .steps{display:flex;gap:8px}
  .steps span{padding:5px 14px;border-radius:8px;background:rgba(255,255,255,.06);color:#c3c7cf;font-weight:600}
  .steps span:last-child{background:#3182f6;color:#fff}
  .steps i{color:#4a505c;font-style:normal;align-self:center}
  </style></head><body>${STAIRS}<div class="wrap">
  <div class="top">${MARK(48)}${esc(cfg.brand)}${home ? '' : `<span class="chip">${esc(GROUP[r.group] || '')}</span>`}</div>
  <h1>${title}</h1>
  <p>${sub}</p>
  <div class="foot">${home ? `<div class="steps">${STEPS.map(x => `<span>${x}</span>`).join('<i>›</i>')}</div>` : `d-capitalism.com/${esc(r.path)}`}</div>
  </div></body></html>`;
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
