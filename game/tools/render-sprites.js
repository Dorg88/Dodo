#!/usr/bin/env node
/* يرسم صور اللعبة الفاخرة (القطع، القطع الخاصة، الفقاعات، أيقونات المعزّزات، خلفية اللعب) بإضاءة ثلاثية الأبعاد
   عبر مرشّحات SVG، ثم يصوّرها بمتصفح Chromium إلى PNG، ثم تُحوَّل إلى WebP (tools/sprites-to-webp.py).

   التشغيل:  node tools/render-sprites.js [--preview]
   يتطلب Playwright (مثبت مسبقاً في بيئة التطوير).  المخرجات: game/img/sprites/*.png ثم *.webp */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const OUT = path.join(__dirname, '..', 'img', 'sprites');
const PREVIEW = process.argv.includes('--preview');

function star(cx, cy, R, r, n = 5, rot = -Math.PI / 2) {
  const p = [];
  for (let i = 0; i < n * 2; i++) {
    const rad = i % 2 ? r : R;
    const a = rot + (i * Math.PI) / n;
    p.push(`${(cx + rad * Math.cos(a)).toFixed(1)},${(cy + rad * Math.sin(a)).toFixed(1)}`);
  }
  return p.join(' ');
}

/* ---------- المرشّحات والتدرّجات المشتركة ---------- */
const DEFS = `
<defs>
  <!-- إضاءة ثلاثية الأبعاد: لمعان من أعلى اليسار + ظل داخلي أسفل اليمين -->
  <filter id="lit" x="-25%" y="-25%" width="150%" height="150%" color-interpolation-filters="sRGB">
    <feGaussianBlur in="SourceAlpha" stdDeviation="10" result="blur"/>
    <feSpecularLighting in="blur" surfaceScale="7" specularConstant="0.58" specularExponent="18" lighting-color="#ffffff" result="spec">
      <feDistantLight azimuth="225" elevation="48"/>
    </feSpecularLighting>
    <feComposite in="spec" in2="SourceAlpha" operator="in" result="specIn"/>
    <feOffset in="SourceAlpha" dx="-7" dy="-11" result="off"/>
    <feGaussianBlur in="off" stdDeviation="8" result="offBlur"/>
    <feComposite in="SourceAlpha" in2="offBlur" operator="out" result="rim"/>
    <feFlood flood-color="#000000" flood-opacity="0.30" result="dk"/>
    <feComposite in="dk" in2="rim" operator="in" result="innerShadow"/>
    <feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="innerShadow"/><feMergeNode in="specIn"/></feMerge>
  </filter>
  <filter id="drop" x="-30%" y="-30%" width="160%" height="170%">
    <feDropShadow dx="0" dy="9" stdDeviation="7" flood-color="#0a0630" flood-opacity="0.45"/>
  </filter>
  <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
    <feGaussianBlur stdDeviation="9" result="b"/>
    <feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
  <filter id="softglow" x="-60%" y="-60%" width="220%" height="220%">
    <feGaussianBlur stdDeviation="16"/>
  </filter>
  <linearGradient id="shine" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
  </linearGradient>
  ${[
    ['gStar', '#fff3a3', '#ffc400', '#d07400'],
    ['gDate', '#ffc98a', '#d9701c', '#743006'],
    ['gPom', '#ff9cb0', '#e8173f', '#78031e'],
    ['gGrape', '#e2caff', '#8b3ff5', '#430da8'],
    ['gOlive', '#d6ff98', '#3cbd27', '#12631f'],
    ['gDrop', '#d6f5ff', '#16a3ff', '#054cb3'],
    ['gLeaf', '#c9ff9e', '#3fb33a', '#17602a'],
    ['gGold', '#fff6c7', '#ffc928', '#c27a00'],
    ['gRed', '#ffc0c0', '#ef3b3b', '#931515'],
    ['gWood', '#f3c08a', '#b56d2e', '#6e3b12'],
    ['gSteel', '#ffffff', '#c8d3e6', '#6f7f9c'],
    ['gBlue', '#d8ecff', '#3f8bff', '#1740b8'],
    ['gPurple', '#f1ddff', '#a35cff', '#5a1bbf'],
    ['gGreen', '#d6ffd0', '#36c75a', '#137a33'],
  ]
    .map(([id, a, b, c]) => `<radialGradient id="${id}" cx="40%" cy="32%" r="78%" fx="30%" fy="20%"><stop offset="0" stop-color="${a}"/><stop offset=".5" stop-color="${b}"/><stop offset="1" stop-color="${c}"/></radialGradient>`)
    .join('')}
  <radialGradient id="bubbleFill" cx="50%" cy="50%" r="50%"><stop offset=".55" stop-color="#bfe9ff" stop-opacity=".18"/><stop offset=".9" stop-color="#8fd8ff" stop-opacity=".55"/><stop offset="1" stop-color="#ffffff" stop-opacity=".85"/></radialGradient>
  <linearGradient id="rainbow" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#7ff0ff"/><stop offset=".35" stop-color="#b48cff"/><stop offset=".65" stop-color="#ff8fd0"/><stop offset="1" stop-color="#ffe36b"/>
  </linearGradient>
</defs>`;

/* أداة: لمعة زجاجية بيضاوية */
const gloss = (cx, cy, rx, ry, rot = -25, op = 0.85) =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="url(#shine)" opacity="${op}" transform="rotate(${rot} ${cx} ${cy})"/>`;
const sparkle = (x, y, r) =>
  `<path d="M${x} ${y - r} Q${x} ${y} ${x + r} ${y} Q${x} ${y} ${x} ${y + r} Q${x} ${y} ${x - r} ${y} Q${x} ${y} ${x} ${y - r} Z" fill="#fff"/>`;
const wrap = (body, extra = '') => `<g filter="url(#drop)"><g filter="url(#lit)">${body}</g>${extra}</g>`;

/* ---------- القطع الست ---------- */
const TILES = {
  star: wrap(
    `<polygon points="${star(128, 132, 116, 56)}" fill="url(#gStar)" stroke="#c46f00" stroke-width="10" stroke-linejoin="round"/>
     <polygon points="${star(128, 132, 64, 30)}" fill="#fff4a8" opacity=".55"/>`,
    `${gloss(98, 92, 26, 12, -30)}${sparkle(176, 74, 13)}`
  ),
  date: wrap(
    `<ellipse cx="128" cy="140" rx="74" ry="100" fill="url(#gDate)" stroke="#6b2e07" stroke-width="7" transform="rotate(-14 128 140)"/>
     <path d="M98 52 Q128 30 158 52 Q150 66 128 64 Q106 66 98 52 Z" fill="url(#gGold)" stroke="#7a4a05" stroke-width="5" stroke-linejoin="round"/>`,
    `${gloss(100, 110, 16, 40, 8, 0.75)}${sparkle(160, 196, 9)}`
  ),
  pomegranate: wrap(
    `<path d="M92 66 L84 26 L106 44 L128 18 L150 44 L172 26 L164 66 Z" fill="#c4163f" stroke="#6e0519" stroke-width="7" stroke-linejoin="round"/>
     <circle cx="128" cy="146" r="96" fill="url(#gPom)" stroke="#6e0519" stroke-width="7"/>`,
    `${gloss(92, 108, 30, 18, -35)}${sparkle(170, 98, 12)}`
  ),
  grapes: wrap(
    `<path d="M128 46 Q132 22 150 12" stroke="#6b3d14" stroke-width="10" fill="none" stroke-linecap="round"/>
     <path d="M140 34 Q182 2 214 30 Q184 66 140 34 Z" fill="url(#gLeaf)" stroke="#1d5a1d" stroke-width="6" stroke-linejoin="round"/>
     <g fill="url(#gGrape)" stroke="#3b0f8e" stroke-width="6">
       <circle cx="78" cy="88" r="40"/><circle cx="128" cy="78" r="40"/><circle cx="178" cy="88" r="40"/>
       <circle cx="100" cy="142" r="42"/><circle cx="156" cy="142" r="42"/><circle cx="128" cy="196" r="42"/>
     </g>`,
    `<g fill="#fff" opacity=".7"><ellipse cx="64" cy="74" rx="11" ry="7" transform="rotate(-30 64 74)"/><ellipse cx="114" cy="64" rx="11" ry="7" transform="rotate(-30 114 64)"/><ellipse cx="164" cy="74" rx="11" ry="7" transform="rotate(-30 164 74)"/><ellipse cx="86" cy="128" rx="11" ry="7" transform="rotate(-30 86 128)"/><ellipse cx="142" cy="128" rx="11" ry="7" transform="rotate(-30 142 128)"/><ellipse cx="114" cy="182" rx="11" ry="7" transform="rotate(-30 114 182)"/></g>`
  ),
  olive: wrap(
    `<path d="M150 56 Q154 26 170 12" stroke="#5b3a1a" stroke-width="10" fill="none" stroke-linecap="round"/>
     <path d="M160 30 Q206 2 236 30 Q200 64 160 30 Z" fill="url(#gLeaf)" stroke="#1d5a1d" stroke-width="6" stroke-linejoin="round"/>
     <ellipse cx="124" cy="146" rx="80" ry="98" fill="url(#gOlive)" stroke="#16532a" stroke-width="7" transform="rotate(-16 124 146)"/>`,
    `${gloss(96, 112, 18, 40, 10, 0.75)}${sparkle(164, 196, 10)}`
  ),
  drop: wrap(
    `<path d="M128 14 C128 14 216 112 216 160 A88 86 0 0 1 40 160 C40 112 128 14 128 14 Z" fill="url(#gDrop)" stroke="#063d8a" stroke-width="7" stroke-linejoin="round"/>`,
    `${gloss(96, 128, 15, 36, 22, 0.8)}<path d="M70 168 Q74 210 112 222" stroke="#fff" stroke-width="10" fill="none" stroke-linecap="round" opacity=".55"/>${sparkle(166, 132, 12)}`
  ),
};

/* ---------- القطع الخاصة ---------- */
const wedges = ['#ffd21f', '#ff8a2a', '#ff3d6b', '#a86bff', '#4fc8ff', '#5fd84a']
  .map((col, i) => {
    const a0 = ((i * 60 - 90) * Math.PI) / 180, a1 = (((i + 1) * 60 - 90) * Math.PI) / 180;
    const p = (a) => `${(128 + 92 * Math.cos(a)).toFixed(1)} ${(128 + 92 * Math.sin(a)).toFixed(1)}`;
    return `<path d="M128 128 L${p(a0)} A92 92 0 0 1 ${p(a1)} Z" fill="${col}"/>`;
  })
  .join('');
const SPECIALS = {
  noor: `<circle cx="128" cy="128" r="104" fill="#fff6b0" filter="url(#softglow)" opacity=".9"/>
    <g filter="url(#drop)"><g filter="url(#lit)"><circle cx="128" cy="128" r="96" fill="#fff"/>${wedges}
    <circle cx="128" cy="128" r="96" fill="none" stroke="#fff" stroke-width="8"/></g>
    <circle cx="128" cy="128" r="46" fill="#fff" filter="url(#glow)" opacity=".95"/>
    <polygon points="${star(128, 128, 40, 17)}" fill="#fff7c2"/>
    ${gloss(92, 78, 34, 16, -30, 0.9)}${sparkle(184, 72, 14)}${sparkle(66, 182, 9)}</g>`,
  'ov-row': `<g filter="url(#glow)" opacity=".98">
      <rect x="18" y="104" width="220" height="48" rx="24" fill="#fff" opacity=".35"/>
      <rect x="30" y="118" width="196" height="20" rx="10" fill="#fff"/>
      <path d="M8 128 L46 98 L46 158 Z" fill="#fff"/><path d="M248 128 L210 98 L210 158 Z" fill="#fff"/></g>`,
  'ov-col': `<g filter="url(#glow)" opacity=".98" transform="rotate(90 128 128)">
      <rect x="18" y="104" width="220" height="48" rx="24" fill="#fff" opacity=".35"/>
      <rect x="30" y="118" width="196" height="20" rx="10" fill="#fff"/>
      <path d="M8 128 L46 98 L46 158 Z" fill="#fff"/><path d="M248 128 L210 98 L210 158 Z" fill="#fff"/></g>`,
  'ov-bomb': `<g filter="url(#glow)">
      <circle cx="128" cy="128" r="112" fill="none" stroke="#fff" stroke-width="12" stroke-dasharray="26 18" opacity=".95"/>
      <circle cx="128" cy="128" r="112" fill="none" stroke="#ffd84a" stroke-width="5" stroke-dasharray="26 18" stroke-dashoffset="22"/>
      ${sparkle(128, 18, 16)}${sparkle(238, 128, 16)}${sparkle(128, 238, 16)}${sparkle(18, 128, 16)}</g>`,
  bubble1: `<g filter="url(#drop)"><circle cx="128" cy="128" r="104" fill="url(#bubbleFill)"/>
      <circle cx="128" cy="128" r="104" fill="none" stroke="url(#rainbow)" stroke-width="7" opacity=".9"/>
      <path d="M62 96 Q74 58 112 46" stroke="#fff" stroke-width="12" fill="none" stroke-linecap="round" opacity=".9"/>
      <circle cx="176" cy="178" r="9" fill="#fff" opacity=".85"/></g>`,
  bubble2: `<g filter="url(#drop)"><circle cx="128" cy="128" r="108" fill="url(#bubbleFill)"/>
      <circle cx="128" cy="128" r="108" fill="none" stroke="url(#rainbow)" stroke-width="10"/>
      <circle cx="128" cy="128" r="80" fill="#9fdcff" opacity=".35"/>
      <circle cx="128" cy="128" r="80" fill="none" stroke="url(#rainbow)" stroke-width="6" opacity=".9"/>
      <path d="M58 94 Q72 54 112 42" stroke="#fff" stroke-width="13" fill="none" stroke-linecap="round" opacity=".95"/>
      <circle cx="178" cy="180" r="10" fill="#fff" opacity=".9"/></g>`,
};

/* ---------- أيقونات المعزّزات والواجهة ---------- */
const ICONS = {
  'ic-hammer': wrap(
    `<rect x="112" y="96" width="34" height="150" rx="14" fill="url(#gWood)" stroke="#5a2e0b" stroke-width="6" transform="rotate(-35 128 128)"/>
     <rect x="38" y="34" width="168" height="76" rx="22" fill="url(#gRed)" stroke="#7a0f0f" stroke-width="7" transform="rotate(-35 128 128)"/>
     <rect x="52" y="44" width="140" height="18" rx="9" fill="#fff" opacity=".35" transform="rotate(-35 128 128)"/>`
  ),
  'ic-row': wrap(
    `<path d="M12 128 L72 70 L72 104 L184 104 L184 70 L244 128 L184 186 L184 152 L72 152 L72 186 Z" fill="url(#gGold)" stroke="#9a5a00" stroke-width="8" stroke-linejoin="round"/>`,
    `<rect x="80" y="108" width="96" height="12" rx="6" fill="#fff" opacity=".6"/>`
  ),
  'ic-col': wrap(
    `<path d="M128 12 L186 72 L152 72 L152 184 L186 184 L128 244 L70 184 L104 184 L104 72 L70 72 Z" fill="url(#gBlue)" stroke="#0d2f8a" stroke-width="8" stroke-linejoin="round"/>`,
    `<rect x="110" y="80" width="12" height="96" rx="6" fill="#fff" opacity=".6"/>`
  ),
  'ic-shuffle': wrap(
    `<path d="M128 30 A98 98 0 0 1 222 112 L246 112 L206 160 L166 112 L190 112 A66 66 0 0 0 128 62 Z" fill="url(#gPurple)" stroke="#3e0d8f" stroke-width="7" stroke-linejoin="round"/>
     <path d="M128 226 A98 98 0 0 1 34 144 L10 144 L50 96 L90 144 L66 144 A66 66 0 0 0 128 194 Z" fill="url(#gGreen)" stroke="#0e5a27" stroke-width="7" stroke-linejoin="round"/>`
  ),
  'ic-star': wrap(
    `<polygon points="${star(128, 134, 118, 54)}" fill="url(#gGold)" stroke="#a65c00" stroke-width="10" stroke-linejoin="round"/>
     <polygon points="${star(128, 134, 62, 28)}" fill="#fff4a8" opacity=".5"/>`,
    gloss(96, 92, 26, 12, -30)
  ),
  'ic-q': wrap(
    `<circle cx="128" cy="128" r="112" fill="url(#gGold)" stroke="#9a5a00" stroke-width="9"/>
     <circle cx="128" cy="128" r="84" fill="none" stroke="#b77400" stroke-width="6" opacity=".6"/>
     <text x="128" y="172" text-anchor="middle" font-family="Baloo Bhaijaan 2, sans-serif" font-weight="800" font-size="150" fill="#8a4b00">؟</text>`,
    gloss(90, 70, 40, 16, -25, 0.8)
  ),
  'ic-check': wrap(`<circle cx="128" cy="128" r="110" fill="url(#gGreen)" stroke="#0e5a27" stroke-width="9"/>
     <path d="M70 132 L110 172 L190 88" stroke="#fff" stroke-width="30" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`),
  'ic-moves': wrap(`<circle cx="128" cy="128" r="110" fill="url(#gBlue)" stroke="#0d2f8a" stroke-width="9"/>
     <path d="M86 92 L170 128 L86 164 Z" fill="#fff"/>`),
};

/* ---------- خلفية اللعب: قاعة بأقواس وفوانيس (مموّهة) ---------- */
function background() {
  const W = 1080, H = 1920;
  const arch = (x, w, top, bottom) =>
    `<path d="M${x} ${bottom} V${top + w * 0.55} Q${x} ${top + w * 0.08} ${x + w / 2} ${top} Q${x + w} ${top + w * 0.08} ${x + w} ${top + w * 0.55} V${bottom} Z"`;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1a1060"/><stop offset=".45" stop-color="#2a3fa6"/><stop offset="1" stop-color="#14306e"/></linearGradient>
    <linearGradient id="win" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b1a52"/><stop offset=".7" stop-color="#2d5fbf"/><stop offset="1" stop-color="#f5b25a"/></linearGradient>
    <linearGradient id="goldl" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff0a0"/><stop offset=".5" stop-color="#f2b62a"/><stop offset="1" stop-color="#a86a00"/></linearGradient>
    <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5a1430"/><stop offset="1" stop-color="#2a0718"/></linearGradient>
    <radialGradient id="lamp" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#ffe9a0" stop-opacity=".95"/><stop offset=".4" stop-color="#ffb84a" stop-opacity=".45"/><stop offset="1" stop-color="#ff9a2a" stop-opacity="0"/></radialGradient>
    <radialGradient id="vig" cx="50%" cy="45%" r="75%"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#05021a" stop-opacity=".7"/></radialGradient>
    <linearGradient id="ray" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff6d0" stop-opacity=".35"/><stop offset="1" stop-color="#fff6d0" stop-opacity="0"/></linearGradient>
    <pattern id="kashi" width="60" height="60" patternUnits="userSpaceOnUse">
      <rect width="60" height="60" fill="#1d4fb8"/><polygon points="${star(30, 30, 26, 20, 8)}" fill="#3fa8e8"/><polygon points="${star(30, 30, 11, 8.5, 8)}" fill="#ffd25a"/>
    </pattern>
    <pattern id="carpet" width="90" height="90" patternUnits="userSpaceOnUse">
      <rect width="90" height="90" fill="#7a1b3c"/><polygon points="45,8 82,45 45,82 8,45" fill="#a8284f"/><polygon points="${star(45, 45, 16, 7, 8)}" fill="#f2c14a"/>
    </pattern>
    <filter id="blur"><feGaussianBlur stdDeviation="7"/></filter>
  </defs>
  <g filter="url(#blur)">
    <rect width="${W}" height="${H}" fill="url(#wall)"/>
    <rect y="0" width="${W}" height="150" fill="url(#kashi)" opacity=".8"/>
    <rect y="150" width="${W}" height="14" fill="url(#goldl)"/>
    ${arch(330, 420, 250, 1400)} fill="url(#win)"/>
    <circle cx="640" cy="520" r="54" fill="#fff6d0"/><circle cx="662" cy="508" r="48" fill="#2a4fa8"/>
    ${[[420, 420], [480, 600], [560, 380], [700, 700], [460, 820], [610, 900]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4" fill="#fff"/>`).join('')}
    ${arch(330, 420, 250, 1400)} fill="none" stroke="url(#goldl)" stroke-width="22"/>
    ${arch(-120, 380, 420, 1450)} fill="url(#kashi)" opacity=".55"/>
    ${arch(-120, 380, 420, 1450)} fill="none" stroke="url(#goldl)" stroke-width="18"/>
    ${arch(820, 380, 420, 1450)} fill="url(#kashi)" opacity=".55"/>
    ${arch(820, 380, 420, 1450)} fill="none" stroke="url(#goldl)" stroke-width="18"/>
    <polygon points="430,250 650,250 900,1450 180,1450" fill="url(#ray)"/>
    <rect y="1400" width="${W}" height="520" fill="url(#floor)"/>
    <polygon points="0,1520 1080,1520 1080,1920 0,1920" fill="url(#carpet)" opacity=".85"/>
    <rect y="1400" width="${W}" height="16" fill="url(#goldl)"/>
    ${[[150, 520], [930, 520], [300, 330], [780, 330]]
      .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="150" fill="url(#lamp)"/><line x1="${x}" y1="0" x2="${x}" y2="${y - 50}" stroke="#c9902a" stroke-width="6"/>
      <path d="M${x - 34} ${y - 44} H${x + 34} L${x + 44} ${y} L${x + 30} ${y + 52} H${x - 30} L${x - 44} ${y} Z" fill="#ffd56a" stroke="#a86a00" stroke-width="6"/>`)
      .join('')}
    ${Array.from({ length: 26 }, (_, i) => {
      const x = (i * 397) % W, y = 200 + ((i * 613) % 1500), r = 12 + ((i * 7) % 26);
      return `<circle cx="${x}" cy="${y}" r="${r}" fill="#ffe6a0" opacity="${0.08 + ((i * 3) % 10) / 60}"/>`;
    }).join('')}
  </g>
  <rect width="${W}" height="${H}" fill="url(#vig)"/>
  </svg>`;
  return s;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const all = { ...TILES, ...SPECIALS, ...ICONS };
  const items = Object.entries(all)
    .map(([name, body]) => `<div class="sp" id="sp-${name}"><svg width="256" height="256" viewBox="0 0 256 256">${body}</svg></div>`)
    .join('');
  const html = `<!doctype html><html><head><meta charset="utf-8">
    <link rel="stylesheet" href="file://${path.join(__dirname, '..', 'fonts', 'fonts.css')}">
    <style>body{margin:0;background:${PREVIEW ? '#2b3f9a' : 'transparent'};display:flex;flex-wrap:wrap;gap:8px;padding:8px;width:1100px}
    .sp{width:256px;height:256px}</style></head><body><svg width="0" height="0" style="position:absolute">${DEFS}</svg>${items}</body></html>`;
  const tmp = path.join(OUT, '_sheet.html');
  fs.writeFileSync(tmp, html);
  const browser = await chromium.launch();
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  await page.goto('file://' + tmp);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  if (PREVIEW) {
    await page.screenshot({ path: path.join(OUT, '_preview.png'), fullPage: true });
  } else {
    for (const name of Object.keys(all)) {
      await page.locator('#sp-' + CSS_escape(name)).screenshot({ path: path.join(OUT, name + '.png'), omitBackground: true });
    }
    // الخلفية
    const bg = path.join(OUT, '_bg.html');
    fs.writeFileSync(bg, `<!doctype html><html><body style="margin:0">${background()}</body></html>`);
    const p2 = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
    await p2.goto('file://' + bg);
    await p2.screenshot({ path: path.join(OUT, 'bg-game.png') });
    fs.unlinkSync(bg);
  }
  fs.unlinkSync(tmp);
  await browser.close();
  console.log(PREVIEW ? 'preview written' : `rendered ${Object.keys(all).length} sprites + background`);
})();

function CSS_escape(s) {
  return s.replace(/[^a-zA-Z0-9_-]/g, (ch) => '\\' + ch);
}
