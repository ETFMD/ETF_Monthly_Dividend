#!/usr/bin/env node
/* 가이드북 3-6 의 정적 HTML(검색엔진·데이터 못 불러올 때용)을 data/muhan_bt.json 과 화면과 같은 render 함수로 다시 만듦
   · 한국어: src/index.html · 영어: scripts/i18n/muhan_guidebook_en.html — 각각 <div id="mhbt-body"> 안을 바꿈
   사용: node scripts/muhan_bt_snapshot.js  → 그다음 python3 scripts/i18n/make_en.py && python3 scripts/build_pages.py */
'use strict';
const fs = require('fs'), path = require('path'), R = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(R, 'src/index.html'), 'utf8');
const a = src.indexOf('/* [MHBT-RENDER] */'), b = src.indexOf('/* [/MHBT-RENDER] */');
const render = new Function(src.slice(a, b) + '\nreturn render;')();
const data = JSON.parse(fs.readFileSync(path.join(R, 'data/muhan_bt.json'), 'utf8'));
for (const [file, lang] of [['src/index.html', 'ko'], ['scripts/i18n/muhan_guidebook_en.html', 'en']]) {
  const P = path.join(R, file);
  let s = fs.readFileSync(P, 'utf8');
  const h = render(data, 'TQQQ', '12', lang);
  if (!h) throw new Error('render 결과 없음');
  const open = '<div id="mhbt-body">', close = '</div>\n        </div>\n        <ul class="g-list">', i = s.indexOf(open), j = s.indexOf(close, i);
  if (i < 0 || j < 0) throw new Error(file + ': mhbt-body 위치를 찾지 못함');
  s = s.slice(0, i + open.length) + h + s.slice(j);
  fs.writeFileSync(P, s);
  console.log(file + ' 3-6 정적 HTML 갱신 (' + lang + ', ' + h.length + '자)');
}
