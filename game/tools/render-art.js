#!/usr/bin/env node
/* يرسم كل رسومات اللعبة الفاخرة إلى PNG في tools/art/out، ثم يركّبها post-art.py ويحوّلها إلى WebP في img/.
   التشغيل:  node tools/render-art.js [hall] [home] [tiles] [ui] ...   (بدون وسائط = الكل)
             python3 tools/post-art.py
   يتطلب Playwright (Chromium) و Pillow و numpy. */
'use strict';
const fs = require('fs');
const path = require('path');
const R = require('./art/render');
const OUT = path.join(__dirname, 'art', 'out');
fs.mkdirSync(OUT, { recursive: true });

const want = process.argv.slice(2);
const on = (k) => !want.length || want.includes(k);

(async () => {
  const t0 = Date.now();
  if (on('hall')) {
    const H = require('./art/scene-hall');
    const P = require('./art/props');
    const C = require('./art/common');
    await R.shot(H.farWall(), 500, 920, path.join(OUT, 'hall-far.png'), { transparent: false, scale: 2 });
    await R.shot(H.sideWall(), 2400, 1100, path.join(OUT, 'hall-wall.png'), { transparent: false });
    await R.shot(H.floor(), 1500, 3000, path.join(OUT, 'hall-floor.png'), { transparent: false });
    await R.shot(H.ceiling(), 1500, 3000, path.join(OUT, 'hall-ceil.png'), { transparent: false });
    const defs = `<defs>${C.DEFS_COMMON}${C.DEFS_NATURE}<radialGradient id="orangeG" cx=".35" cy=".3"><stop offset="0" stop-color="#ffd27a"/><stop offset="1" stop-color="#e06a10"/></radialGradient></defs>`;
    await R.shot(`<svg width="400" height="760" viewBox="0 0 200 380">${defs}${P.lantern('hl', { chain: 40 })}</svg>`, 400, 760, path.join(OUT, 'hall-lantern.png'));
    await R.shot(`<svg width="400" height="520" viewBox="0 0 400 520">${defs}${P.plant('hp', 4)}</svg>`, 400, 520, path.join(OUT, 'hall-plant.png'));
    await R.shot(`<svg width="1080" height="1920" viewBox="0 0 1080 1920">${defs}${P.rays(760, -200, 2600, 28, 6, 3)}</svg>`, 1080, 1920, path.join(OUT, 'hall-rays.png'));
  }
  if (on('home')) {
    const S = require('./art/scene-home');
    for (const [name, svg, w, h] of S.layers()) await R.shot(svg, w, h, path.join(OUT, 'home-' + name + '.png'), { transparent: true });
  }
  if (on('tiles')) {
    const T = require('./art/tiles');
    for (const [name, svg, size] of T.all()) await R.shot(svg, size, size, path.join(OUT, 'sp-' + name + '.png'), { transparent: true });
  }
  if (on('ui')) {
    const U = require('./art/ui');
    for (const [name, svg, w, h] of U.all()) await R.shot(svg, w, h, path.join(OUT, 'ui-' + name + '.png'), { transparent: true });
  }
  await R.close();
  console.log('rendered in', ((Date.now() - t0) / 1000).toFixed(1), 's');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
