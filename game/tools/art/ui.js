/* رسومات الواجهة: الشعار الذهبي، لوحة العنوان، أيقونات الأزرار ثلاثية الأبعاد، أوسمة المراحل، إكليل الغار */
'use strict';
const { f, starPts, archPath, rng } = require('./common');
const T = require('./tiles');
const { wrap, gloss, sparkle } = T;

const GOLD_DEFS = `
  <linearGradient id="uGold" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#fff8da"/><stop offset=".22" stop-color="#ffe08a"/><stop offset=".48" stop-color="#e3a42b"/>
    <stop offset=".66" stop-color="#fde6a0"/><stop offset=".85" stop-color="#bd7e14"/><stop offset="1" stop-color="#7a4906"/>
  </linearGradient>
  <linearGradient id="uText" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#fffbe8"/><stop offset=".35" stop-color="#ffe27a"/><stop offset=".55" stop-color="#f2b233"/><stop offset=".75" stop-color="#ffe9a6"/><stop offset="1" stop-color="#c88416"/>
  </linearGradient>
  <linearGradient id="uNavy" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1d3a8a"/><stop offset=".55" stop-color="#11265f"/><stop offset="1" stop-color="#0a1840"/></linearGradient>
  <filter id="uBevel" x="-10%" y="-10%" width="120%" height="120%">
    <feGaussianBlur in="SourceAlpha" stdDeviation="2.2" result="b"/>
    <feSpecularLighting in="b" surfaceScale="4" specularConstant="1" specularExponent="22" lighting-color="#fff6dc" result="s"><feDistantLight azimuth="235" elevation="45"/></feSpecularLighting>
    <feComposite in="s" in2="SourceAlpha" operator="in" result="s2"/>
    <feComposite in="SourceGraphic" in2="s2" operator="arithmetic" k1="0" k2="1" k3=".75" k4="0"/>
  </filter>
  <filter id="uShadow" x="-20%" y="-20%" width="140%" height="160%"><feDropShadow dx="0" dy="8" stdDeviation="8" flood-color="#020818" flood-opacity=".6"/></filter>
  <pattern id="uPat" width="40" height="40" patternUnits="userSpaceOnUse">
    <polygon points="${starPts(20, 20, 15, 7, 8, 0)}" fill="none" stroke="#2e56b8" stroke-width="1.4" opacity=".55"/>
  </pattern>`;

const svgUI = (w, h, body, vb = `0 0 ${w} ${h}`) =>
  `<svg width="${w}" height="${h}" viewBox="${vb}" xmlns="http://www.w3.org/2000/svg"><defs>${T.DEFS}${GOLD_DEFS}</defs>${body}</svg>`;

/** شكل الخرطوشة: مستطيل بطرفين مدبّبين (أسلوب اللوحات الإسلامية) */
function cartouche(x, y, w, h, tip = h * 0.42) {
  const m = h / 2;
  return `M${x + tip} ${y}H${x + w - tip}Q${x + w - tip * 0.12} ${y + m * 0.12} ${x + w} ${y + m}Q${x + w - tip * 0.12} ${y + h - m * 0.12} ${x + w - tip} ${y + h}` +
    `H${x + tip}Q${x + tip * 0.12} ${y + h - m * 0.12} ${x} ${y + m}Q${x + tip * 0.12} ${y + m * 0.12} ${x + tip} ${y}Z`;
}

/** شعار «نور المعرفة»: خرطوشة كحلية بإطار ذهبي وتاج مسجد ونص ذهبي بخط رقّاص */
function logo() {
  const W = 900, H = 420;
  const cx = W / 2;
  const crest = `
    <path d="M${cx - 120} 150H${cx + 120}L${cx + 96} 120H${cx - 96}Z" fill="url(#uGold)" filter="url(#uBevel)"/>
    <path d="M${cx - 58} 124C${cx - 66} 84 ${cx - 30} 58 ${cx} 34C${cx + 30} 58 ${cx + 66} 84 ${cx + 58} 124Z" fill="url(#uGold)" filter="url(#uBevel)"/>
    <path d="M${cx} 34V10" stroke="url(#uGold)" stroke-width="6"/><circle cx="${cx}" cy="16" r="6" fill="url(#uGold)"/>
    ${[-96, 96].map((d) => `<rect x="${cx + d - 9}" y="52" width="18" height="74" fill="url(#uGold)" filter="url(#uBevel)"/>
      <path d="M${cx + d - 12} 54C${cx + d - 12} 40 ${cx + d} 30 ${cx + d} 22C${cx + d} 30 ${cx + d + 12} 40 ${cx + d + 12} 54Z" fill="url(#uGold)"/>`).join('')}
    ${[-46, 0, 46].map((d) => `<path d="${archPath(cx + d - 12, 92, 24, 32, 18)}" fill="#0a1840" opacity=".8"/>`).join('')}`;
  const body = `
    <g filter="url(#uShadow)">
      ${crest}
      <path d="${cartouche(20, 140, W - 40, 250)}" fill="url(#uGold)" filter="url(#uBevel)"/>
      <path d="${cartouche(36, 156, W - 72, 218)}" fill="url(#uNavy)"/>
      <path d="${cartouche(36, 156, W - 72, 218)}" fill="url(#uPat)"/>
      <path d="${cartouche(50, 168, W - 100, 194)}" fill="none" stroke="url(#uGold)" stroke-width="4"/>
      ${[[118, 265], [W - 118, 265]].map(([x, y]) => `<polygon points="${starPts(x, y, 20, 9, 8, 0)}" fill="url(#uGold)"/>`).join('')}
    </g>
    <text x="${cx}" y="306" text-anchor="middle" font-family="Rakkas" font-size="136" fill="#2a1602" stroke="#2a1602" stroke-width="14" stroke-linejoin="round" filter="url(#uShadow)">نور المعرفة</text>
    <text x="${cx}" y="306" text-anchor="middle" font-family="Rakkas" font-size="136" fill="url(#uText)" stroke="#8a4a06" stroke-width="2.5">نور المعرفة</text>`;
  return svgUI(W, H, body);
}

/** لوحة عنوان صغيرة للشريط العلوي */
function cart() {
  const W = 560, H = 150;
  return svgUI(W, H, `
    <g filter="url(#uShadow)">
      <path d="${cartouche(8, 10, W - 16, 120)}" fill="url(#uGold)" filter="url(#uBevel)"/>
      <path d="${cartouche(18, 20, W - 36, 100)}" fill="url(#uNavy)"/>
      <path d="${cartouche(18, 20, W - 36, 100)}" fill="url(#uPat)"/>
      <path d="${cartouche(28, 28, W - 56, 84)}" fill="none" stroke="url(#uGold)" stroke-width="3"/>
    </g>`);
}

/* ---------- أيقونات ثلاثية الأبعاد (256) ---------- */
const icons = {
  gift: wrap(`
    <rect x="52" y="112" width="152" height="118" rx="12" fill="url(#gRed)"/>
    <rect x="40" y="84" width="176" height="42" rx="10" fill="url(#gRed)"/>
    <rect x="114" y="84" width="28" height="146" fill="url(#gGold)"/>
    <rect x="40" y="96" width="176" height="16" fill="url(#gGold)" opacity=".9"/>
    <path d="M128 84C96 40 58 50 74 76C84 92 112 88 128 84Z" fill="url(#gGold)"/>
    <path d="M128 84C160 40 198 50 182 76C172 92 144 88 128 84Z" fill="url(#gGold)"/>
    <circle cx="128" cy="84" r="13" fill="url(#gGold)"/>`, `${gloss(84, 134, 18, 34, 0, 0.35)}${sparkle(196, 60, 12)}`),
  review: wrap(`
    <path d="M128 36A92 92 0 0 1 216 104L238 104L200 150L162 104L184 104A60 60 0 0 0 128 68Z" fill="url(#gGreen)"/>
    <path d="M128 220A92 92 0 0 1 40 152L18 152L56 106L94 152L72 152A60 60 0 0 0 128 188Z" fill="url(#gGreen)"/>
    <circle cx="128" cy="128" r="44" fill="url(#gGold)"/>
    <text x="128" y="160" text-anchor="middle" font-family="Baloo, sans-serif" font-weight="800" font-size="88" fill="#8a4b00">؟</text>`),
  scroll: wrap(`
    <rect x="62" y="56" width="132" height="150" fill="#f7e7c0"/>
    <path d="M62 56H194V206H62Z" fill="url(#shine)" opacity=".25"/>
    <g stroke="#a07a44" stroke-width="7" stroke-linecap="round">${[88, 110, 132, 154, 176].map((y, i) => `<line x1="84" y1="${y}" x2="${i % 2 ? 150 : 172}" y2="${y}"/>`).join('')}</g>
    <rect x="44" y="40" width="168" height="26" rx="13" fill="url(#gWood)"/><rect x="44" y="196" width="168" height="26" rx="13" fill="url(#gWood)"/>
    <circle cx="178" cy="186" r="18" fill="url(#gRed)"/>`),
  about: wrap(`
    <circle cx="128" cy="128" r="108" fill="url(#gBlue)"/>
    <path d="M70 176H186V164H70Z" fill="url(#gGold)"/>
    <path d="M90 164C84 120 108 96 128 78C148 96 172 120 166 164Z" fill="url(#gGold)"/>
    <path d="M128 78V58" stroke="#ffd36b" stroke-width="6"/><circle cx="128" cy="56" r="6" fill="#ffd36b"/>
    ${[78, 178].map((x) => `<rect x="${x - 6}" y="104" width="12" height="62" fill="url(#gGold)"/><path d="M${x - 8} 106L${x} 88L${x + 8} 106Z" fill="url(#gGold)"/>`).join('')}`, gloss(90, 74, 36, 14, -25, 0.6)),
  gear: wrap(`
    <g fill="url(#gGold)">${Array.from({ length: 10 }, (_, i) => `<rect x="114" y="18" width="28" height="44" rx="6" transform="rotate(${i * 36} 128 128)"/>`).join('')}
    <circle cx="128" cy="128" r="84"/></g>
    <circle cx="128" cy="128" r="36" fill="#1a3270"/><circle cx="128" cy="128" r="36" fill="none" stroke="#8a5a0c" stroke-width="6"/>`, gloss(96, 86, 30, 12, -30, 0.6)),
  book: wrap(`
    <path d="M128 70C98 50 54 52 24 64V206C54 194 98 192 128 212Z" fill="url(#gBlue)"/>
    <path d="M128 70C158 50 202 52 232 64V206C202 194 158 192 128 212Z" fill="url(#gBlue)"/>
    <path d="M128 76C102 60 64 60 38 70V194C64 186 102 186 128 202Z" fill="#fbf2dc"/>
    <path d="M128 76C154 60 192 60 218 70V194C192 186 154 186 128 202Z" fill="#f1e2bd"/>
    <g stroke="#b59a6a" stroke-width="5" stroke-linecap="round">${[96, 118, 140, 162].map((y) => `<line x1="56" y1="${y}" x2="108" y2="${y + 6}"/><line x1="148" y1="${y + 6}" x2="200" y2="${y}"/>`).join('')}</g>
    <path d="M128 76V202" stroke="#c8a96a" stroke-width="4"/>
    <path d="M176 60V110L188 98L200 110V58Z" fill="url(#gRed)"/>`),
  home: wrap(`
    <rect x="44" y="150" width="168" height="72" rx="6" fill="url(#gGold)"/>
    <path d="M70 152C62 102 100 74 128 50C156 74 194 102 186 152Z" fill="url(#gGold)"/>
    <path d="M128 50V28" stroke="#ffd36b" stroke-width="7"/><circle cx="128" cy="24" r="7" fill="#ffd36b"/>
    ${[30, 226].map((x) => `<rect x="${x - 9}" y="90" width="18" height="132" fill="url(#gGold)"/><path d="M${x - 11} 92L${x} 66L${x + 11} 92Z" fill="url(#gGold)"/>`).join('')}
    <path d="${archPath(108, 170, 40, 52, 28)}" fill="#1a3270"/>`, sparkle(190, 60, 12)),
  map: wrap(`
    <path d="M30 60L92 40L164 60L226 40V196L164 216L92 196L30 216Z" fill="#f4e2b8"/>
    <path d="M92 40V196M164 60V216" stroke="#d8bf8a" stroke-width="5"/>
    <path d="M56 182C80 150 70 120 110 112C150 104 140 80 184 70" stroke="#c0392b" stroke-width="7" fill="none" stroke-dasharray="12 10" stroke-linecap="round"/>
    <circle cx="56" cy="184" r="10" fill="url(#gGreen)"/>
    <path d="M184 52C170 52 162 62 162 74C162 92 184 112 184 112C184 112 206 92 206 74C206 62 198 52 184 52Z" fill="url(#gRed)"/><circle cx="184" cy="74" r="7" fill="#fff"/>`),
  dome: wrap(`
    <rect x="50" y="176" width="156" height="48" rx="6" fill="#f2e2bd"/>
    <rect x="70" y="150" width="116" height="30" fill="url(#gGold)"/>
    <path d="M66 154C56 96 98 66 128 40C158 66 200 96 190 154Z" fill="url(#gBlue)"/>
    <path d="M128 40V18" stroke="#ffd36b" stroke-width="7"/><circle cx="128" cy="14" r="7" fill="#ffd36b"/>
    <path d="${archPath(110, 190, 36, 34, 24)}" fill="#1a3270"/>`, `${sparkle(206, 70, 16)}${sparkle(50, 100, 10)}${sparkle(214, 150, 8)}`),
  lock: wrap(`
    <path d="M84 118V86A44 44 0 0 1 172 86V118" stroke="url(#gGold)" stroke-width="22" fill="none"/>
    <rect x="56" y="110" width="144" height="112" rx="18" fill="url(#gGold)"/>
    <circle cx="128" cy="156" r="14" fill="#5a3303"/><rect x="122" y="160" width="12" height="32" rx="5" fill="#5a3303"/>`),
};

/* ---------- أوسمة المراحل ---------- */
function node(kind) {
  const face = { done: ['#3b62c4', '#1a3a8a', '#0b1c4f'], cur: ['#9df07a', '#2fae36', '#10641f'], lock: ['#56607a', '#343c52', '#1c2133'] }[kind];
  return `<svg width="256" height="256" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg"><defs>${T.DEFS}${GOLD_DEFS}
    <radialGradient id="nf" cx="42%" cy="32%" r="75%"><stop offset="0" stop-color="${face[0]}"/><stop offset=".55" stop-color="${face[1]}"/><stop offset="1" stop-color="${face[2]}"/></radialGradient></defs>
    <ellipse cx="128" cy="214" rx="96" ry="26" fill="#000" opacity=".35" filter="url(#blur3)"/>
    <path d="M28 150V176C28 206 228 206 228 176V150Z" fill="#7a4906"/>
    <path d="M28 150V176C28 206 228 206 228 176V150Z" fill="url(#uGold)" opacity=".85"/>
    <ellipse cx="128" cy="150" rx="100" ry="58" fill="url(#uGold)" filter="url(#uBevel)"/>
    <ellipse cx="128" cy="146" rx="84" ry="46" fill="url(#nf)"/>
    <ellipse cx="128" cy="146" rx="84" ry="46" fill="none" stroke="#5a3303" stroke-width="3" opacity=".6"/>
    <ellipse cx="104" cy="126" rx="36" ry="12" fill="#fff" opacity="${kind === 'lock' ? 0.12 : 0.25}"/>
  </svg>`;
}

function laurel() {
  const R = rng(3);
  let leaves = '';
  for (const side of [-1, 1]) {
    for (let i = 0; i < 9; i++) {
      const t = i / 8;
      const a = Math.PI * (0.62 + 0.5 * t);
      const x = 128 + side * Math.cos(a) * -112, y = 120 + Math.sin(a) * 100;
      const rot = side * (t * 120 - 30);
      for (const o of [-1, 1])
        leaves += `<ellipse cx="${f(x + o * 10)}" cy="${f(y - 6)}" rx="20" ry="8" transform="rotate(${f(rot + o * 40 * side)} ${f(x + o * 10)} ${f(y - 6)})" fill="url(#uGold)" stroke="#7a4906" stroke-width="2"/>`;
    }
  }
  return `<svg width="256" height="256" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg"><defs>${T.DEFS}${GOLD_DEFS}</defs>
    <g filter="url(#uShadow)"><path d="M40 90Q40 214 128 226Q216 214 216 90" fill="none" stroke="url(#uGold)" stroke-width="7"/>${leaves}</g></svg>`;
}

function all() {
  const list = [['logo', logo(), 900, 420], ['cart', cart(), 560, 150]];
  for (const [k, body] of Object.entries(icons)) list.push(['ic-' + k, svgUI(256, 256, body), 256, 256]);
  for (const k of ['done', 'cur', 'lock']) list.push(['node-' + k, node(k), 256, 256]);
  list.push(['laurel', laurel(), 256, 256]);
  return list;
}

module.exports = { all };
