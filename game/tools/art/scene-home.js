/* مشهد الصحن (الشاشة الرئيسية) بطبقات منفصلة 1080×1920:
   sky · minarets · dome · facade · tiles · iwan · lanterns · floor(base/inlay بالمنظور في post-art.py) · fountain · garden · front
   العناصر القابلة للترميم: dome, minarets, tiles, iwan, lanterns, floor, fountain, garden */
'use strict';
const C = require('./common');
const P = require('./props');
const { f, rng, archPath, starPts, patKhatam, patHex, patIslimi, filterMarble, muqarnas, cloud, foliage, trunk, DEFS_COMMON, DEFS_NATURE } = C;

const W = 1080, H = 1920;
const GROUND = 1080; // قاعدة الواجهة
const WING_Y = 780, PISH = { x0: 360, x1: 720, y: 640 };
const DOME = { cx: 540, base: 566, apex: 268 };
const MIN = [215, 865];
const LOWER = { y0: 948, y1: GROUND }, UPPER = { y0: 800, y1: 928 };
// أقواس الجناحين: ٤ في كل جناح
const ARCHES = (() => {
  const out = [];
  for (const [x0, x1] of [[24, PISH.x0 - 6], [PISH.x1 + 6, 1056]]) {
    const n = 4, bw = (x1 - x0) / n;
    for (let i = 0; i < n; i++) out.push({ x: x0 + i * bw, w: bw });
  }
  return out;
})();

const ORANGE = `<radialGradient id="orangeG" cx=".35" cy=".3"><stop offset="0" stop-color="#ffd27a"/><stop offset=".6" stop-color="#f48a1c"/><stop offset="1" stop-color="#c25808"/></radialGradient>`;
const LANSYM = `<symbol id="lanS" viewBox="0 0 200 380">${P.lantern('ls', { chain: 40, halo: true })}</symbol>`;

function svg(defs, body) {
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><defs>${DEFS_COMMON}${DEFS_NATURE}${ORANGE}${defs}</defs>${body}</svg>`;
}

/* ---------------- السماء ---------------- */
function sky() {
  const defs = `
    <linearGradient id="skyG" x1="0" y1="0" x2="0" y2="${GROUND}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#2459c2"/><stop offset=".22" stop-color="#3b78d8"/><stop offset=".45" stop-color="#76b1ea"/>
      <stop offset=".66" stop-color="#bfe0f6"/><stop offset=".84" stop-color="#ffe6c0"/><stop offset="1" stop-color="#ffd49a"/>
    </linearGradient>
    <radialGradient id="sunG" cx="850" cy="430" r="560" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#fffbe8" stop-opacity=".95"/><stop offset=".2" stop-color="#fff0c4" stop-opacity=".6"/><stop offset=".55" stop-color="#ffe2a8" stop-opacity=".18"/><stop offset="1" stop-color="#ffe2a8" stop-opacity="0"/>
    </radialGradient>`;
  const R = rng(17);
  let raysB = '';
  for (let i = 0; i < 9; i++) {
    const a = -150 + i * 16 + R() * 8;
    raysB += `<polygon points="850,430 ${f(850 + 1600 * Math.cos((a * Math.PI) / 180))},${f(430 + 1600 * Math.sin((a * Math.PI) / 180))} ${f(850 + 1600 * Math.cos(((a + 5) * Math.PI) / 180))},${f(430 + 1600 * Math.sin(((a + 5) * Math.PI) / 180))}" fill="#fff6dc" opacity="${f(0.05 + R() * 0.06)}"/>`;
  }
  const skyline = `<g fill="#c3cde4" opacity=".75">
      <path d="M0 790V730H40V700Q70 660 100 700V730H160V760H230V790Z"/>
      <path d="M850 790V745H900V720Q935 680 970 720V745H1040V700H1052V680H1062V700H1080V790Z"/>
    </g>
    <g fill="#d6dcec" opacity=".8"><path d="M0 800V770H120V800ZM960 800V775H1080V800Z"/></g>`;
  const birds = [[300, 330, 1], [360, 300, 0.8], [700, 240, 0.9], [760, 270, 0.7], [180, 560, 0.6]]
    .map(([x, y, s]) => `<path d="M${x} ${y}q${12 * s} ${-12 * s} ${24 * s} 0q${12 * s} ${-12 * s} ${24 * s} 0" fill="none" stroke="#fdfdff" stroke-width="${f(4 * s)}" stroke-linecap="round"/>`).join('');
  const body = `
    <rect width="${W}" height="${H}" fill="url(#skyG)"/>
    <g filter="url(#soft14)">${raysB}</g>
    <circle cx="850" cy="430" r="560" fill="url(#sunG)"/>
    <circle cx="850" cy="430" r="46" fill="#fffdf2"/>
    ${cloud(-120, 150, 560, 240, 3)}
    ${cloud(560, 330, 620, 260, 8)}
    ${cloud(120, 470, 380, 150, 12, '#fff6e6', '#b4bde0')}
    ${cloud(700, 90, 320, 110, 21)}
    ${cloud(-60, 640, 420, 140, 5, '#fff3de', '#c3b8d8', '#efe2ea')}
    ${cloud(720, 640, 420, 140, 6, '#fff3de', '#c3b8d8', '#efe2ea')}
    ${skyline}
    ${birds}`;
  return svg(defs, body);
}

/* ---------------- المئذنتان ---------------- */
function minaret(cx) {
  const lowerW = 60, upperW = 50;
  const band = (y, w, h = 12) => `<rect x="${cx - w / 2}" y="${y}" width="${w}" height="${h}" fill="url(#goldH)"/>`;
  const brackets = (y, w, n = 7) => {
    let o = '';
    for (let i = 0; i < n; i++) {
      const bx = cx - w / 2 + (i * w) / (n - 1);
      o += `<path d="M${f(bx - 6)} ${y}Q${f(bx)} ${y + 26} ${f(bx + 6)} ${y}Z" fill="url(#gold)" stroke="#6b3f05" stroke-width="1"/>`;
    }
    return o;
  };
  const balcony = (y, w) => `
    <path d="M${cx - w / 2 + 14} ${y + 22}L${cx - w / 2} ${y}H${cx + w / 2}L${cx + w / 2 - 14} ${y + 22}Z" fill="url(#goldH)"/>
    ${brackets(y + 18, w - 26)}
    <rect x="${cx - w / 2}" y="${y - 18}" width="${w}" height="20" fill="url(#minHex)"/>
    <rect x="${cx - w / 2}" y="${y - 18}" width="${w}" height="20" fill="url(#cyl)"/>
    <rect x="${cx - w / 2 - 3}" y="${y - 22}" width="${w + 6}" height="6" rx="2" fill="url(#goldH)"/>`;
  return `
    <rect x="${cx - lowerW / 2}" y="560" width="${lowerW}" height="360" fill="url(#minK)"/>
    ${[600, 680, 760, 840].map((y) => band(y, lowerW, 9)).join('')}
    <rect x="${cx - lowerW / 2}" y="560" width="${lowerW}" height="360" fill="url(#cyl)"/>
    ${balcony(548, 96)}
    <rect x="${cx - upperW / 2}" y="345" width="${upperW}" height="190" fill="url(#minHex)"/>
    ${[380, 450].map((y) => band(y, upperW, 8)).join('')}
    <rect x="${cx - upperW / 2}" y="345" width="${upperW}" height="190" fill="url(#cyl)"/>
    ${balcony(330, 84)}
    <rect x="${cx - 23}" y="250" width="46" height="62" fill="#efe1c0"/>
    ${[-14, 0, 14].map((dx) => `<path d="${archPath(cx + dx - 5, 258, 10, 46, 9)}" fill="#152a5e"/>`).join('')}
    <rect x="${cx - 23}" y="250" width="46" height="62" fill="url(#cyl)"/>
    <rect x="${cx - 27}" y="246" width="54" height="8" rx="2" fill="url(#goldH)"/>
    <path d="M${cx - 27} 248C${cx - 32} 228 ${cx - 18} 214 ${cx} 196C${cx + 18} 214 ${cx + 32} 228 ${cx + 27} 248Z" fill="url(#minDome)"/>
    <path d="M${cx - 27} 248C${cx - 32} 228 ${cx - 18} 214 ${cx} 196C${cx + 18} 214 ${cx + 32} 228 ${cx + 27} 248Z" fill="url(#cyl)" opacity=".8"/>
    <path d="M${cx} 196V160" stroke="url(#goldH)" stroke-width="5"/>
    <circle cx="${cx}" cy="186" r="6" fill="url(#goldR)"/><circle cx="${cx}" cy="170" r="4.5" fill="url(#goldR)"/>
    <path d="M${cx - 9} 152A10 10 0 1 0 ${cx + 9} 152A7.5 7.5 0 1 1 ${cx - 9} 152Z" fill="url(#gold)"/>`;
}
function minarets() {
  const defs = `${patKhatam('minK', 30)}${patHex('minHex', 7, { bg: '#eedfbd' })}
    <linearGradient id="minDome" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7fe0ea"/><stop offset=".5" stop-color="#22a6c4"/><stop offset="1" stop-color="#0d5a8a"/></linearGradient>`;
  return svg(defs, `<g filter="url(#bevel)">${MIN.map(minaret).join('')}</g>`);
}

/* ---------------- القبّة ---------------- */
function domeOutline() {
  // نقاط الحافة اليسرى للقبّة (من القاعدة إلى القمة) — لحساب خطوط الطول
  const segs = [
    [[396, 568], [344, 520], [348, 432], [420, 372]],
    [[420, 372], [470, 328], [520, 300], [540, 268]],
  ];
  const pts = [];
  for (const [p0, p1, p2, p3] of segs)
    for (let i = 0; i <= 40; i++) {
      const t = i / 40, u = 1 - t;
      pts.push([
        u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
        u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
      ]);
    }
  return pts;
}
function dome() {
  const cx = DOME.cx;
  const outline = 'M396 568C344 520 348 432 420 372C470 328 520 300 540 268C560 300 610 328 660 372C732 432 736 520 684 568Z';
  const pts = domeOutline();
  let meridians = '';
  for (const deg of [-62, -38, -14, 14, 38, 62]) {
    const t = Math.sin((deg * Math.PI) / 180);
    meridians += `<polyline points="${pts.map(([x, y]) => f(cx + t * (cx - x)) + ',' + f(y)).join(' ')}" fill="none" stroke="#f3cf6a" stroke-width="3" opacity=".8"/>`;
  }
  let lat = '';
  for (const k of [12, 34, 58]) {
    const [x, y] = pts[k];
    const rx = cx - x;
    lat += `<path d="M${f(x)} ${f(y)}A${f(rx)} ${f(rx * 0.16)} 0 0 0 ${f(cx + rx)} ${f(y)}" fill="none" stroke="#f3cf6a" stroke-width="3.2" opacity=".85"/>`;
  }
  // الطبلة: نوافذ على أسطوانة
  let drum = '';
  for (let d = -75; d <= 75; d += 25) {
    const s = Math.sin((d * Math.PI) / 180), c = Math.cos((d * Math.PI) / 180);
    const x = cx + s * 132, w = 30 * c;
    drum += `<path d="${archPath(x - w / 2, 594, w, 70, w * 0.7)}" fill="#0e1e48"/><path d="${archPath(x - w / 2, 594, w, 70, w * 0.7)}" fill="none" stroke="url(#gold)" stroke-width="${f(3 * c + 1)}"/>`;
  }
  const defs = `${patIslimi('domeI', 56)}${patKhatam('drumK', 26)}
    <clipPath id="domeC"><path d="${outline}"/></clipPath>
    <radialGradient id="domeShade" cx="540" cy="450" r="215" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#000a30" stop-opacity="0"/><stop offset=".62" stop-color="#000a30" stop-opacity=".05"/><stop offset="1" stop-color="#000a30" stop-opacity=".62"/>
    </radialGradient>
    <radialGradient id="domeLight" cx="612" cy="392" r="170" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#fff6dc" stop-opacity=".62"/><stop offset=".5" stop-color="#fff6dc" stop-opacity=".12"/><stop offset="1" stop-color="#fff6dc" stop-opacity="0"/>
    </radialGradient>`;
  const body = `
    <rect x="404" y="572" width="272" height="110" fill="url(#drumK)"/>
    ${drum}
    <rect x="404" y="572" width="272" height="110" fill="url(#cyl)"/>
    <rect x="398" y="580" width="284" height="10" fill="url(#goldH)"/>
    <g clip-path="url(#domeC)">
      <rect x="330" y="250" width="420" height="330" fill="url(#domeI)"/>
      ${meridians}${lat}
      <rect x="330" y="250" width="420" height="330" fill="url(#domeShade)"/>
      <rect x="330" y="250" width="420" height="330" fill="url(#domeLight)"/>
      <path d="M640 330C700 380 712 450 690 520" stroke="#ffffff" stroke-width="14" fill="none" opacity=".28" filter="url(#soft6)"/>
    </g>
    <path d="${outline}" fill="none" stroke="#0a1c52" stroke-width="3" opacity=".6"/>
    <path d="M392 566Q540 600 688 566L690 580Q540 616 390 580Z" fill="url(#gold)" filter="url(#bevel)"/>
    <g filter="url(#bevel)">
      <path d="M540 268V208" stroke="url(#goldH)" stroke-width="7"/>
      <circle cx="540" cy="256" r="12" fill="url(#goldR)"/><circle cx="540" cy="232" r="9" fill="url(#goldR)"/>
      <path d="M526 196A16 16 0 1 0 554 196A12 12 0 1 1 526 196Z" fill="url(#gold)"/>
    </g>`;
  return svg(defs, body);
}

/* ---------------- الواجهة (الأساس، حجر) ---------------- */
function crenels(x0, x1, y, h = 16, w = 22) {
  let o = '';
  for (let x = x0; x < x1 - w / 2; x += w * 1.6) o += `<path d="M${f(x)} ${y}V${y - h * 0.6}L${f(x + w / 2)} ${y - h}L${f(x + w)} ${y - h * 0.6}V${y}Z"/>`;
  return o;
}
function facade() {
  const defs = `<linearGradient id="arcDark" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a1d18"/><stop offset=".6" stop-color="#4f3a2c"/><stop offset="1" stop-color="#6e5440"/></linearGradient>`;
  let arches = '';
  for (const a of ARCHES) {
    const p = a.w * 0.14;
    arches += `<path d="${archPath(a.x + p, UPPER.y0 + 10, a.w - 2 * p, UPPER.y1 - UPPER.y0 - 10, (a.w - 2 * p) * 0.6)}" fill="url(#arcDark)"/>`;
    arches += `<path d="${archPath(a.x + p, LOWER.y0 + 6, a.w - 2 * p, LOWER.y1 - LOWER.y0 - 6, (a.w - 2 * p) * 0.62)}" fill="url(#arcDark)"/>`;
  }
  const body = `
    <g filter="url(#stoneTex)">
      <rect x="20" y="${WING_Y}" width="1040" height="${GROUND - WING_Y}" fill="url(#stone)"/>
      <rect x="${PISH.x0}" y="${PISH.y}" width="${PISH.x1 - PISH.x0}" height="${GROUND - PISH.y}" fill="url(#stone)"/>
    </g>
    <g fill="#e6cf9f">${crenels(20, PISH.x0, WING_Y)}${crenels(PISH.x1, 1060, WING_Y)}${crenels(PISH.x0, PISH.x1, PISH.y, 18, 24)}</g>
    <rect x="20" y="${WING_Y}" width="1040" height="18" fill="#cdb07a"/>
    <rect x="20" y="${UPPER.y1}" width="1040" height="${LOWER.y0 - UPPER.y1}" fill="#cdb07a"/>
    ${arches}
    <path d="${archPath(410, 690, 260, GROUND - 690, 160)}" fill="url(#arcDark)"/>
    <rect x="20" y="${GROUND - 8}" width="1040" height="8" fill="#9c8058"/>
    <rect x="${PISH.x0}" y="${PISH.y}" width="${PISH.x1 - PISH.x0}" height="${GROUND - PISH.y}" fill="#000" opacity=".04"/>
    <rect x="20" y="${WING_Y}" width="18" height="${GROUND - WING_Y}" fill="#000" opacity=".12"/>`;
  return svg(defs, body);
}

/* ---------------- الزخارف (كاشي) ---------------- */
function tiles() {
  const defs = `${patKhatam('tK', 24)}${patHex('tH', 6)}${patIslimi('tI', 40)}`;
  let o = '';
  for (const a of ARCHES) {
    const p = a.w * 0.14;
    for (const [y0, y1] of [[UPPER.y0 + 10, UPPER.y1], [LOWER.y0 + 6, LOWER.y1]]) {
      const ax = a.x + p, aw = a.w - 2 * p;
      // إطار كاشي حول القوس وزخرفة فوق الكتفين
      o += `<path d="M${f(a.x + 4)} ${y0 - 4}H${f(a.x + a.w - 4)}V${f(y0 + aw * 0.62)}H${f(a.x + 4)}Z" fill="url(#tK)"/>`;
      o += `<path d="${archPath(ax - 3, y0 - 3, aw + 6, y1 - y0 + 3, (aw + 6) * 0.6)}" fill="#2a1d18"/>`;
      o += `<path d="${archPath(ax, y0, aw, y1 - y0, aw * 0.6)}" fill="url(#arcIn)"/>`;
      o += `<path d="${archPath(ax - 3, y0 - 3, aw + 6, y1 - y0 + 3, (aw + 6) * 0.6)}" fill="none" stroke="#f4ecd8" stroke-width="3"/>`;
      o += `<path d="M${f(a.x + 4)} ${y0 - 4}H${f(a.x + a.w - 4)}" stroke="url(#gold)" stroke-width="3"/>`;
    }
  }
  const body = `
    <defs><linearGradient id="arcIn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#132a63"/><stop offset=".55" stop-color="#1f3f86"/><stop offset="1" stop-color="#3a5aa0"/></linearGradient></defs>
    <rect x="20" y="${WING_Y}" width="1040" height="18" fill="url(#tH)"/>
    <rect x="20" y="${WING_Y - 2}" width="1040" height="4" fill="url(#gold)"/><rect x="20" y="${WING_Y + 16}" width="1040" height="3" fill="url(#gold)"/>
    <rect x="20" y="${UPPER.y1}" width="1040" height="${LOWER.y0 - UPPER.y1}" fill="url(#tI)"/>
    <rect x="20" y="${UPPER.y1 - 1}" width="1040" height="3" fill="url(#gold)"/><rect x="20" y="${LOWER.y0 - 2}" width="1040" height="3" fill="url(#gold)"/>
    ${o}
    <rect x="${PISH.x0}" y="${PISH.y}" width="${PISH.x1 - PISH.x0}" height="${GROUND - PISH.y}" fill="url(#tI)"/>`;
  return svg(defs, body);
}

/* ---------------- الإيوان الذهبي ---------------- */
function iwan() {
  const ax = 410, aw = 260, ay = 690;
  const m = muqarnas(ax, ay, aw, 220, 6, { seed: 4 });
  const defs = `${patHex('iH', 7)}${patIslimi('iI', 44)}${m.defs}
    <clipPath id="iwArch"><path d="${archPath(ax, ay, aw, GROUND - ay, 160)}"/></clipPath>
    <linearGradient id="doorG" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8a5208"/><stop offset=".5" stop-color="#ffd86b"/><stop offset="1" stop-color="#8a5208"/></linearGradient>
    <radialGradient id="doorGlow" cx="540" cy="1010" r="120" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#ffe6a6" stop-opacity=".8"/><stop offset="1" stop-color="#ffe6a6" stop-opacity="0"/></radialGradient>`;
  const doorX = 494, doorW = 92, doorY = 960;
  const studs = [];
  for (let y = doorY + 40; y < GROUND - 10; y += 18) for (const x of [doorX + 14, doorX + 32, doorX + doorW - 32, doorX + doorW - 14]) studs.push(`<circle cx="${x}" cy="${y}" r="2.6"/>`);
  const body = `
    <rect x="${PISH.x0}" y="${PISH.y}" width="${PISH.x1 - PISH.x0}" height="${GROUND - PISH.y}" fill="url(#iH)"/>
    <rect x="${PISH.x0 + 18}" y="${PISH.y + 18}" width="${PISH.x1 - PISH.x0 - 36}" height="${GROUND - PISH.y - 18}" fill="#123178"/>
    <g clip-path="url(#iwArch)">
      <rect x="${ax}" y="${ay}" width="${aw}" height="${GROUND - ay}" fill="url(#iI)"/>
      <rect x="${ax}" y="${ay}" width="${aw}" height="230" fill="#0b1f55"/>
      ${m.body}
      <rect x="${ax}" y="${ay}" width="${aw}" height="${GROUND - ay}" fill="#000a2a" opacity=".12"/>
    </g>
    <circle cx="540" cy="1010" r="120" fill="url(#doorGlow)"/>
    <path d="${archPath(doorX, doorY, doorW, GROUND - doorY, 60)}" fill="url(#doorG)"/>
    <path d="M540 ${doorY + 14}V${GROUND}" stroke="#6b3f05" stroke-width="3"/>
    <g fill="#fff3c0">${studs.join('')}</g>
    <path d="${archPath(doorX, doorY, doorW, GROUND - doorY, 60)}" fill="none" stroke="#6b3f05" stroke-width="3"/>
    <g filter="url(#bevel)">
      <path d="${archPath(ax - 6, ay - 6, aw + 12, GROUND - ay + 6, 166)}" fill="none" stroke="url(#gold)" stroke-width="12"/>
      <rect x="${PISH.x0}" y="${PISH.y}" width="${PISH.x1 - PISH.x0}" height="${GROUND - PISH.y}" fill="none" stroke="url(#gold)" stroke-width="10"/>
      <rect x="${PISH.x0 + 18}" y="${PISH.y + 18}" width="${PISH.x1 - PISH.x0 - 36}" height="${GROUND - PISH.y - 18}" fill="none" stroke="url(#gold)" stroke-width="5"/>
      ${[PISH.x0, PISH.x1].map((x) => `<rect x="${x - 14}" y="${PISH.y - 40}" width="28" height="44" fill="url(#goldH)"/>
        <path d="M${x - 16} ${PISH.y - 38}C${x - 18} ${PISH.y - 56} ${x - 6} ${PISH.y - 66} ${x} ${PISH.y - 76}C${x + 6} ${PISH.y - 66} ${x + 18} ${PISH.y - 56} ${x + 16} ${PISH.y - 38}Z" fill="url(#gold)"/>
        <path d="M${x} ${PISH.y - 76}V${PISH.y - 94}" stroke="url(#goldH)" stroke-width="3"/><circle cx="${x}" cy="${PISH.y - 96}" r="4" fill="url(#goldR)"/>`).join('')}
    </g>`;
  return svg(defs, body);
}

/* ---------------- الفوانيس ---------------- */
function lanterns() {
  let o = '';
  for (const a of ARCHES) {
    const w = 34;
    o += `<use href="#lanS" x="${f(a.x + a.w / 2 - w / 2)}" y="${LOWER.y0 + 4}" width="${w}" height="${f((w * 380) / 200)}"/>`;
  }
  o += `<use href="#lanS" x="${540 - 28}" y="${872}" width="56" height="${f((56 * 380) / 200)}"/>`;
  for (const a of ARCHES) {
    const w = 22;
    o += `<use href="#lanS" x="${f(a.x + a.w / 2 - w / 2)}" y="${UPPER.y0 + 14}" width="${w}" height="${f((w * 380) / 200)}"/>`;
  }
  return svg(LANSYM, o);
}

/* ---------------- النافورة ---------------- */
function fountain() {
  const cx = 540, cy = 1262, rx = 236, ry = 86;
  const oct = (rx2, ry2, dy = 0) => {
    const p = [];
    for (let i = 0; i < 8; i++) {
      const a = Math.PI / 8 + (i * Math.PI) / 4;
      p.push([cx + rx2 * Math.cos(a), cy + dy + ry2 * Math.sin(a)]);
    }
    return p;
  };
  const outer = oct(rx, ry), inner = oct(rx - 26, ry - 12);
  const wallH = 46;
  // الأوجه الأمامية للحوض
  let faces = '';
  for (let i = 0; i < 8; i++) {
    const [x0, y0] = outer[i], [x1, y1] = outer[(i + 1) % 8];
    if (Math.max(y0, y1) < cy) continue;
    faces += `<path d="M${f(x0)} ${f(y0)}L${f(x1)} ${f(y1)}L${f(x1)} ${f(y1 + wallH)}L${f(x0)} ${f(y0 + wallH)}Z" fill="url(#fK)"/>`;
    faces += `<path d="M${f(x0)} ${f(y0)}L${f(x1)} ${f(y1)}L${f(x1)} ${f(y1 + wallH)}L${f(x0)} ${f(y0 + wallH)}Z" fill="#000a2a" opacity="${f(0.08 + Math.abs(x0 + x1 - 2 * cx) / rx / 6)}"/>`;
    faces += `<path d="M${f(x0)} ${f(y0 + wallH)}L${f(x1)} ${f(y1 + wallH)}" stroke="url(#gold)" stroke-width="5"/>`;
  }
  const pts = (arr) => arr.map(([x, y]) => f(x) + ',' + f(y)).join(' ');
  const R = rng(5);
  let spray = '';
  for (let i = 0; i < 60; i++) {
    const a = R() * Math.PI * 2, d = 60 + R() * 120;
    spray += `<circle cx="${f(cx + Math.cos(a) * d)}" cy="${f(cy - 8 + Math.sin(a) * d * 0.3 - R() * 30)}" r="${f(1.5 + R() * 2.5)}" fill="#fff" opacity="${f(0.4 + R() * 0.5)}"/>`;
  }
  const jets = [-1, -0.5, 0.5, 1].map((k) => `<path d="M${cx} ${cy - 150}Q${f(cx + k * 90)} ${cy - 200} ${f(cx + k * 150)} ${cy - 4}" fill="none" stroke="#ffffff" stroke-width="5" opacity=".75" stroke-linecap="round"/>`).join('');
  const defs = `${patKhatam('fK', 20)}${filterMarble('fM', 9, '#f4ede2')}
    <radialGradient id="water" cx="${cx}" cy="${cy - 10}" r="${rx}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#9ff1ff"/><stop offset=".6" stop-color="#2fb6dc"/><stop offset="1" stop-color="#0b6aa0"/></radialGradient>
    <linearGradient id="col" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#b9a685"/><stop offset=".5" stop-color="#fff8e8"/><stop offset="1" stop-color="#a8946e"/></linearGradient>`;
  const body = `
    <ellipse cx="${cx}" cy="${cy + wallH + 6}" rx="${rx + 20}" ry="${ry * 0.6}" fill="#1a1208" opacity=".25" filter="url(#soft6)"/>
    ${faces}
    <polygon points="${pts(outer)}" fill="#fff" filter="url(#fM)"/>
    <polygon points="${pts(outer)}" fill="none" stroke="url(#gold)" stroke-width="4"/>
    <polygon points="${pts(inner)}" fill="url(#water)"/>
    <g fill="none" stroke="#e8fbff" stroke-width="2" opacity=".6">${[0.35, 0.6, 0.85].map((k) => `<ellipse cx="${cx}" cy="${cy - 4}" rx="${f(rx * k * 0.85)}" ry="${f(ry * k * 0.8)}"/>`).join('')}</g>
    <rect x="${cx - 18}" y="${cy - 120}" width="36" height="118" fill="url(#col)"/>
    <ellipse cx="${cx}" cy="${cy - 122}" rx="78" ry="24" fill="#fff" filter="url(#fM)"/>
    <path d="M${cx - 78} ${cy - 122}Q${cx} ${cy - 70} ${cx + 78} ${cy - 122}Z" fill="url(#col)"/>
    <ellipse cx="${cx}" cy="${cy - 126}" rx="64" ry="17" fill="url(#water)"/>
    <ellipse cx="${cx}" cy="${cy - 122}" rx="78" ry="24" fill="none" stroke="url(#gold)" stroke-width="3"/>
    <rect x="${cx - 7}" y="${cy - 166}" width="14" height="40" fill="url(#col)"/><circle cx="${cx}" cy="${cy - 168}" r="11" fill="url(#goldR)"/>
    ${jets}
    <path d="M${cx} ${cy - 176}Q${cx - 6} ${cy - 230} ${cx} ${cy - 250}Q${cx + 6} ${cy - 230} ${cx} ${cy - 176}" fill="#fff" opacity=".85"/>
    <g filter="url(#soft2)">${spray}</g>`;
  return svg(defs, body);
}

/* ---------------- الحديقة ---------------- */
function pot(cx, base, w = 150) {
  const h = w * 0.62;
  return `<path d="M${cx - w / 2} ${base - h}H${cx + w / 2}L${cx + w * 0.4} ${base}H${cx - w * 0.4}Z" fill="url(#gPot)"/>
    <path d="M${cx - w / 2} ${base - h}H${cx + w / 2}L${cx + w * 0.4} ${base}H${cx - w * 0.4}Z" fill="url(#cyl)" opacity=".75"/>
    <rect x="${cx - w / 2 - 6}" y="${base - h - 8}" width="${w + 12}" height="14" rx="4" fill="url(#gold)"/>
    <rect x="${cx - w * 0.42}" y="${base - 10}" width="${w * 0.84}" height="10" fill="url(#gold)"/>
    <g fill="#f6efe0">${[-0.25, 0, 0.25].map((k) => `<polygon points="${starPts(cx + k * w, base - h / 2, w * 0.08, w * 0.035, 8, 0)}"/>`).join('')}</g>
    <ellipse cx="${cx}" cy="${base + 4}" rx="${w * 0.5}" ry="10" fill="#1a1208" opacity=".25" filter="url(#soft6)"/>`;
}
function garden() {
  const defs = `<linearGradient id="gPot" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2d6fd6"/><stop offset="1" stop-color="#0d2a6e"/></linearGradient>`;
  const tree = (cx, base, seed) => `
    ${trunk(cx, base - 80, cx + 4, base - 300, 16, seed)}
    ${foliage(cx, base - 390, 290, 250, seed, undefined, true, { leaves: 40 })}
    ${pot(cx, base, 160)}`;
  const R = rng(9);
  let beds = '';
  for (const [x0, x1] of [[40, PISH.x0 - 10], [PISH.x1 + 10, 1040]]) {
    beds += `<rect x="${x0}" y="${GROUND - 20}" width="${x1 - x0}" height="34" rx="10" fill="#7a5a36"/>`;
    beds += foliage((x0 + x1) / 2, GROUND - 14, x1 - x0, 46, Math.floor(R() * 99), ['#1d4a26', '#2f7a36', '#56a043', '#9ad06a']);
    for (let i = 0; i < 26; i++) beds += `<circle cx="${f(x0 + 10 + R() * (x1 - x0 - 20))}" cy="${f(GROUND - 30 + R() * 22)}" r="${f(3 + R() * 3)}" fill="${['#ff6b8f', '#fff', '#ffd25a', '#ff9ec2'][i % 4]}"/>`;
  }
  return svg(defs, `${beds}${tree(118, 1250, 31)}${tree(962, 1250, 32)}`);
}

/* ---------------- المقدّمة (أشجار تؤطّر المشهد، دائماً ظاهرة) ---------------- */
function front() {
  const pal = ['#0c2614', '#173f20', '#2a6630', '#4f9440', '#8cc46a'];
  const body = `
    ${foliage(-70, 360, 340, 560, 41, pal, null, { leaves: 64, size: 1.1 })}
    ${foliage(1150, 460, 340, 560, 42, pal, null, { leaves: 64, size: 1.1 })}
    ${foliage(40, 1850, 420, 280, 43, pal, null, { leaves: 50 })}
    ${foliage(1040, 1850, 420, 280, 44, pal, null, { leaves: 50 })}`;
  return svg('', body);
}

/** القائمة: [الاسم، SVG، العرض، الارتفاع] — الأرضية تُرسم مسطّحة (floor-*) وتُسقط في post-art.py */
function layers() {
  return [
    ['sky', sky(), W, H],
    ['minarets', minarets(), W, H],
    ['dome', dome(), W, H],
    ['facade', facade(), W, H],
    ['tiles', tiles(), W, H],
    ['iwan', iwan(), W, H],
    ['lanterns', lanterns(), W, H],
    ['floorbase', floorTex(false), FW, FH],
    ['floor', floorTex(true), FW, FH],
    ['fountain', fountain(), W, H],
    ['garden', garden(), W, H],
    ['front', front(), W, H],
  ];
}

/** نسيج أرضية الصحن (مسطّح، الأعلى = البعيد): بلاطات رخام كبيرة، ومع inlay نقوش نجمية ملوّنة */
const FW = 2400, FH = 1680;
function floorTex(inlay) {
  const S = FW, SH = FH, sq = 200;
  const defs = `${filterMarble('pM', 15, '#f6f0e5')}${filterMarble('pM2', 23, '#e9dfcf', '#8a8076', [0.86, 0.82, 0.76])}
    ${patKhatam('pK', 200, { bg: 'none', star: '#1f6f8b', line: '#e9c66a', inner: '#9a2a2a', dot: '#e9c66a', corner: '#0f3a63' })}`;
  if (!inlay) {
    let alt = '';
    for (let y = 0; y < SH; y += sq) for (let x = 0; x < S; x += sq) if (((x + y) / sq) % 2) alt += `<rect x="${x}" y="${y}" width="${sq}" height="${sq}"/>`;
    return `<svg width="${S}" height="${SH}" viewBox="0 0 ${S} ${SH}" xmlns="http://www.w3.org/2000/svg"><defs>${DEFS_COMMON}${defs}</defs>
      <rect width="${S}" height="${SH}" fill="#fff" filter="url(#pM)"/><g fill="#fff" filter="url(#pM2)">${alt}</g>
      <g stroke="#c7b28c" stroke-width="4">${Array.from({ length: S / sq + 1 }, (_, i) => `<line x1="${i * sq}" y1="0" x2="${i * sq}" y2="${SH}"/><line x1="0" y1="${i * sq}" x2="${S}" y2="${i * sq}"/>`).join('')}</g></svg>`;
  }
  // نقوش مطعّمة: نجوم ثمانية كبيرة في مربعات متناوبة + ممر مركزي مزخرف
  let stars = '';
  for (let y = 100; y < SH; y += 200) for (let x = 100; x < S; x += 200) {
    if (((x + y - 200) / 200) % 2) continue;
    stars += `<polygon points="${starPts(x, y, 62, 38, 8, 0)}" fill="#1d5f86" stroke="#e8c468" stroke-width="6"/>`;
    stars += `<polygon points="${starPts(x, y, 32, 15, 8, Math.PI / 8)}" fill="#a32b2b"/><circle cx="${x}" cy="${y}" r="9" fill="#e8c468"/>`;
  }
  const pathX = S / 2 - 260;
  return `<svg width="${S}" height="${SH}" viewBox="0 0 ${S} ${SH}" xmlns="http://www.w3.org/2000/svg"><defs>${DEFS_COMMON}${defs}
      <pattern id="pathP" width="260" height="130" patternUnits="userSpaceOnUse" x="${pathX}">
        <rect width="260" height="130" fill="#f4ecdc"/>
        <polygon points="${starPts(130, 65, 58, 30, 8, 0)}" fill="#13557a" stroke="#e8c468" stroke-width="6"/>
        <polygon points="${starPts(130, 65, 28, 14, 8, Math.PI / 8)}" fill="#e8c468"/>
        ${[0, 260].map((x) => `<polygon points="${starPts(x, 0, 34, 16, 4, 0)}" fill="#a32b2b"/><polygon points="${starPts(x, 130, 34, 16, 4, 0)}" fill="#a32b2b"/>`).join('')}
      </pattern></defs>
    ${stars}
    <rect x="${pathX}" y="0" width="520" height="${SH}" fill="url(#pathP)"/>
    <rect x="${pathX - 14}" y="0" width="14" height="${SH}" fill="#e8c468"/><rect x="${pathX + 520}" y="0" width="14" height="${SH}" fill="#e8c468"/>
  </svg>`;
}

module.exports = { layers, W, H, GROUND, FW, FH };
