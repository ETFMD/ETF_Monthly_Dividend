#!/usr/bin/env node
/* 나의 직업 수명 — 검색엔진·첫 화면용 정적 HTML 채우기
   src/index.html 의 [JOBLIFE-ENGINE] (화면과 같은 계산·같은 줄 HTML)을 그대로 실행해
   <!-- [JL-SNAP:pop|top|cats|all] --> 칸을 채움 · 화면이 열리면 스크립트가 지금 날짜로 다시 그림
   사용: node scripts/joblife_snapshot.js   (build-pages 워크플로가 페이지 생성 직전에 실행) */
const fs = require('fs'), path = require('path');
const p = path.join(__dirname, '..', 'src', 'index.html');
let s = fs.readFileSync(p, 'utf8');
const a = s.indexOf('var JL = (function'), b = s.indexOf('/* [/JOBLIFE-ENGINE] */');
if (a < 0 || b < 0) throw new Error('JOBLIFE-ENGINE 을 찾지 못함');
const JL = new Function(s.slice(a, b).replace(/if \(typeof module[^\n]*\n/, '') + '\nreturn JL;')();
const d = new Date(), NOW = d.getFullYear() + d.getMonth() / 12, esc = JL.esc;
const all = JL.ranked('mid');
const html = {
  pop: JL.POP.map(n => { const x = JL.byName(n), r = JL.calc(x, 'mid');
    return '<button type="button" class="jl-card" data-job="' + esc(n) + '"><span class="e" aria-hidden="true">' + JL.CAT[x.c].icon + '</span><b>' + esc(n) + '</b><small><em>' + JL.span(r.onset) + '</em> 남음</small></button>'; }).join(''),
  top: all.slice(0, 5).map((o, i) => JL.rowHTML(i + 1, o.x, o.r, NOW)).join(''),
  cats: '<button type="button" class="on" data-cat="all">전체</button>' + JL.CATS.map(k => '<button type="button" data-cat="' + k + '">' + JL.CAT[k].icon + ' ' + esc(JL.CAT[k].name) + '</button>').join(''),
  all: all.slice(0, 30).map((o, i) => JL.rowHTML(i + 1, o.x, o.r, NOW)).join('')
};
let n = 0;
for (const k in html) {
  const re = new RegExp('(<!-- \\[JL-SNAP:' + k + '\\] -->)[\\s\\S]*?(<!-- \\[/JL-SNAP:' + k + '\\] -->)');
  if (!re.test(s)) throw new Error('JL-SNAP:' + k + ' 칸 없음');
  s = s.replace(re, (m, x, y) => x + html[k] + y); n++;
}
fs.writeFileSync(p, s);
console.log('joblife snapshot: ' + n + '칸 · 직업 ' + JL.JOBS.length + '개 · 기준 ' + d.getFullYear() + '-' + (d.getMonth() + 1));
