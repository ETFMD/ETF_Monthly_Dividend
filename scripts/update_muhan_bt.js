#!/usr/bin/env node
/* 무한매수법 실제 일봉 백테스트 → data/muhan_bt.json
   · 계산 엔진은 src/index.html 의 [MUHAN-ENGINE](var MHE)을 그대로 읽어 씀 — 화면 주문표·기록과 같은 규칙 (엔진이 바뀌면 결과도 따라 바뀜)
   · 가격: data/etfcagr.json 의 TQQQ·SOXL 일별 종가(수정주가, 분배금 제외) — 시세 봇이 갱신
   · 설정 조합: 분할 20·30·40 × 목표% (TQQQ 10·15·20 / SOXL 15·20·25) × 큰수 5·12·20%
   · 전체 기간(상장 첫날부터) + 시작 연도별(매년 첫 거래일 시작 → 오늘까지) 결과 · 같은 기간 그냥 보유(B&H) 비교
   · 가정: 원금 $20,000, 회차가 끝나면 번 돈까지 다음 회차 원금(복리), LOC는 종가로 체결, 지정가 매도는 정규장 고가가 닿으면 지정가로 체결,
           수수료·세금·환율·현금 이자 없음
   사용: node scripts/update_muhan_bt.js */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'src/index.html'), 'utf8');
const a = src.indexOf('var MHE = (function'), b = src.indexOf("if (typeof module !== 'undefined') module.exports = MHE;", a);
if (a < 0 || b < 0) throw new Error('MHE 엔진을 src/index.html 에서 찾지 못함');
const MHE = new Function(src.slice(a, b) + '\nreturn MHE;')();
if (!MHE.backtest) throw new Error('MHE.backtest 없음');

const J = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/etfcagr.json'), 'utf8'));
const CAP = 20000;
const GRID = { TQQQ: [10, 15, 20], SOXL: [15, 20, 25] }, SPLITS = [20, 30, 40], BIGS = [5, 12, 20];
if (process.argv.includes('--close-only')) for (const t of ['TQQQ', 'SOXL']) delete J.series[t].h;
const DEF = { TQQQ: '20-15-12', SOXL: '20-20-12' };   // 라오어 기본 (20분할 · 목표 15/20% · 큰수 12%)

function series(raw) {
  const d = [raw.d0]; for (let i = 0; i < raw.dd.length; i++) d.push(d[i] + raw.dd[i]);
  return { d, c: raw.c, h: raw.h || null, ymd: k => new Date(d[k] * 864e5).toISOString().slice(0, 10) };
}
const r1 = x => Math.round(x * 10) / 10;
function cagr(v0, v1, days) { return (Math.pow(v1 / v0, 365.25 / days) - 1) * 100; }
function mdd(eq, from) {
  let peak = -Infinity, m = 0, pk = from, a = from, z = from;
  for (let i = from; i < eq.length; i++) {
    const v = eq[i]; if (v == null) continue;
    if (v > peak) { peak = v; pk = i; }
    const dd = v / peak - 1; if (dd < m) { m = dd; a = pk; z = i; }
  }
  return { v: m * 100, a, z };
}
function median(x) { const s = x.slice().sort((p, q) => p - q), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : null; }

const out = { updated: new Date().toISOString(), source: J.updated || null, cap: CAP, splits: SPLITS, bigs: BIGS, targets: GRID, def: DEF, t: {} };
for (const tk of ['TQQQ', 'SOXL']) {
  const S = series(J.series[tk]), n = S.c.length, last = n - 1;
  // 시작 연도: 상장 다음 해 ~ 2년 이상 남는 해 (매년 첫 거래일)
  const y0 = +S.ymd(0).slice(0, 4) + 1, y1 = +S.ymd(last).slice(0, 4) - 2, starts = [];
  for (let y = y0; y <= y1; y++) { const k = S.d.findIndex((_, i) => S.ymd(i) >= y + '-01-01'); if (k >= 0) starts.push([y, k]); }
  // 연말 인덱스 (연도별 수익률용)
  const ye = []; for (let i = 0; i < n; i++) if (i === last || S.ymd(i + 1).slice(0, 4) !== S.ymd(i).slice(0, 4)) ye.push(i);
  const T = { from: S.ymd(0), to: S.ymd(last), years: ye.map(i => +S.ymd(i).slice(0, 4)), starts: starts.map(x => x[0]) };
  // 그냥 보유
  const bm = mdd(S.c, 0);
  T.bh = { cagr: r1(cagr(S.c[0], S.c[last], S.d[last] - S.d[0])), mdd: r1(bm.v), mddFrom: S.ymd(bm.a), mddTo: S.ymd(bm.z),
           mult: r1(S.c[last] / S.c[0]), ye: ye.map(i => +(S.c[i] / S.c[0]).toPrecision(5)),
           roll: starts.map(([, k]) => r1(cagr(S.c[k], S.c[last], S.d[last] - S.d[k]))) };
  T.bh.rollMed = r1(median(T.bh.roll)); T.bh.rollMin = Math.min(...T.bh.roll);
  T.rows = [];
  for (const sp of SPLITS) for (const tg of GRID[tk]) for (const bg of BIGS) {
    const s = { ticker: tk, splits: sp, targetProfit: tg, bigNumPercent: bg, lowerLocShares: 1 };
    const R = MHE.backtest(s, S.c, CAP, S.h), m = mdd(R.eq, 0), fin = R.eq[last];
    const cyc = R.cycles, done = R.open ? cyc.slice(0, -1) : cyc;
    const roll = starts.map(([, k]) => { const Q = MHE.backtest(s, S.c.slice(k), CAP, S.h && S.h.slice(k)); return r1(cagr(CAP, Q.eq[Q.eq.length - 1], S.d[last] - S.d[k])); });
    const lg = cyc.reduce((p, c) => (c.days > p.days ? c : p), cyc[0]);
    T.rows.push({ id: sp + '-' + tg + '-' + bg, sp, tg, bg,
      cagr: r1(cagr(CAP, fin, S.d[last] - S.d[0])), mdd: r1(m.v), mddFrom: S.ymd(m.a), mddTo: S.ymd(m.z), mult: r1(fin / CAP),
      cycles: done.length, loss: done.filter(c => c.pnl < 0).length, rev: cyc.filter(c => c.rev).length,
      longest: lg ? Math.round(S.d[Math.min(last, lg.start + lg.days)] - S.d[lg.start]) : 0, longestFrom: lg ? S.ymd(lg.start) : null,
      open: R.open ? { from: S.ymd(cyc[cyc.length - 1].start), pnl: r1(cyc[cyc.length - 1].pnl * 100), rev: cyc[cyc.length - 1].rev } : null,
      ye: ye.map(i => +(R.eq[i] / CAP).toPrecision(5)),
      roll, rollMed: r1(median(roll)), rollMin: Math.min(...roll), beat: roll.filter((v, i) => v > T.bh.roll[i]).length });
  }
  out.t[tk] = T;
  process.stdout.write(tk + ' 완료 · ' + T.rows.length + '개 설정 · 시작 연도 ' + starts.length + '개\n');
}
fs.writeFileSync(path.join(ROOT, 'data/muhan_bt.json'), JSON.stringify(out));
process.stdout.write('data/muhan_bt.json 저장\n');
