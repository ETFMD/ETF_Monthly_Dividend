#!/usr/bin/env node
/* 가이드북 3-6 의 정적 HTML(검색엔진·데이터 못 불러올 때용)을 data/muhan_bt.json 과 화면과 같은 render 함수로 다시 만듦
   사용: node scripts/muhan_bt_snapshot.js  (src/index.html 의 <div id="mhbt-body"> 안을 바꿈 → 그다음 build_pages.py) */
'use strict';
const fs = require('fs'), path = require('path'), P = path.join(__dirname, '..', 'src/index.html');
let s = fs.readFileSync(P, 'utf8');
const a = s.indexOf('/* [MHBT-RENDER] */'), b = s.indexOf('/* [/MHBT-RENDER] */');
const render = new Function(s.slice(a, b) + '\nreturn render;')();
const h = render(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data/muhan_bt.json'), 'utf8')), 'TQQQ', '12');
if (!h) throw new Error('render 결과 없음');
const open = '<div id="mhbt-body">', close = '</div>\n        </div>\n        <ul class="g-list">', i = s.indexOf(open), j = s.indexOf(close, i);
if (i < 0 || j < 0) throw new Error('mhbt-body 위치를 찾지 못함');
s = s.slice(0, i + open.length) + h + s.slice(j);
fs.writeFileSync(P, s);
console.log('3-6 정적 HTML 갱신 (' + h.length + '자)');
