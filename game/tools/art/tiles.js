/* قطع اللعب الست بتفاصيل غنية (256×256) + القطع الخاصة والفقاعات وأيقونات المعزّزات.
   القطع: نجمة · فانوس · رمّانة · عنب · ورقة · قطرة ماء (ألوان مختلفة بوضوح: أصفر، برتقالي، أحمر، بنفسجي، أخضر، أزرق) */
'use strict';
const { f, starPts, archPath } = require('./common');

const G = (id, stops, cx = '40%', cy = '32%', r = '78%', fx = '30%', fy = '20%') =>
  `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}" fx="${fx}" fy="${fy}">${stops.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('')}</radialGradient>`;

const DEFS = `
  <filter id="lit" x="-25%" y="-25%" width="150%" height="150%" color-interpolation-filters="sRGB">
    <feGaussianBlur in="SourceAlpha" stdDeviation="9" result="blur"/>
    <feSpecularLighting in="blur" surfaceScale="6" specularConstant=".5" specularExponent="20" lighting-color="#ffffff" result="spec">
      <feDistantLight azimuth="225" elevation="50"/>
    </feSpecularLighting>
    <feComposite in="spec" in2="SourceAlpha" operator="in" result="specIn"/>
    <feOffset in="SourceAlpha" dx="-6" dy="-10" result="off"/>
    <feGaussianBlur in="off" stdDeviation="9" result="offBlur"/>
    <feComposite in="SourceAlpha" in2="offBlur" operator="out" result="rim"/>
    <feFlood flood-color="#000" flood-opacity=".32" result="dk"/>
    <feComposite in="dk" in2="rim" operator="in" result="innerShadow"/>
    <feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="innerShadow"/><feMergeNode in="specIn"/></feMerge>
  </filter>
  <filter id="drop" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="8" stdDeviation="7" flood-color="#030a24" flood-opacity=".55"/></filter>
  <filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="9" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  <filter id="softglow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="16"/></filter>
  <filter id="blur3"><feGaussianBlur stdDeviation="3"/></filter>
  <linearGradient id="shine" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
  ${G('gPom', [[0, '#ffb3bf'], [0.28, '#ff4a64'], [0.62, '#d40a2c'], [0.88, '#8e0019'], [1, '#55000e']])}
  ${G('gCrown', [[0, '#ff6a7e'], [0.6, '#b8082a'], [1, '#62000f']], '45%', '30%')}
  ${G('gBerry', [[0, '#f3e4ff'], [0.25, '#c08cff'], [0.6, '#7e36ef'], [0.9, '#4310ae'], [1, '#2a0a73']], '38%', '30%', '75%', '30%', '22%')}
  ${G('gDrop', [[0, '#f2fdff'], [0.3, '#8adcff'], [0.7, '#1f95f2'], [1, '#0a4bb0']], '38%', '45%', '75%', '30%', '35%')}
  ${G('gGlass', [[0, '#fffdf0'], [0.3, '#ffe68f'], [0.7, '#ffa12a'], [1, '#c4560a']], '50%', '45%', '65%', '50%', '40%')}
  ${G('gGold', [[0, '#fff6c7'], [0.5, '#ffc928'], [1, '#b06a00']])}
  ${G('gWood', [[0, '#f3c08a'], [0.5, '#b56d2e'], [1, '#6e3b12']])}
  ${G('gRed', [[0, '#ffc0c0'], [0.5, '#ef3b3b'], [1, '#931515']])}
  ${G('gBlue', [[0, '#d8ecff'], [0.5, '#3f8bff'], [1, '#1740b8']])}
  ${G('gPurple', [[0, '#f1ddff'], [0.5, '#a35cff'], [1, '#5a1bbf']])}
  ${G('gGreen', [[0, '#d6ffd0'], [0.5, '#36c75a'], [1, '#137a33']])}
  <linearGradient id="gLeafA" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b6f56e"/><stop offset=".55" stop-color="#4fc236"/><stop offset="1" stop-color="#2b9a2e"/></linearGradient>
  <linearGradient id="gLeafB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3fa83a"/><stop offset=".5" stop-color="#23862c"/><stop offset="1" stop-color="#11521d"/></linearGradient>
  <linearGradient id="gMetal" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7a4706"/><stop offset=".45" stop-color="#ffe08a"/><stop offset=".6" stop-color="#e3a42b"/><stop offset="1" stop-color="#6b3d05"/></linearGradient>
  <linearGradient id="gMetalV" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff3c0"/><stop offset=".5" stop-color="#e0a22a"/><stop offset="1" stop-color="#7a4706"/></linearGradient>
  <radialGradient id="bubbleFill" cx="50%" cy="50%" r="50%"><stop offset=".55" stop-color="#bfe9ff" stop-opacity=".18"/><stop offset=".9" stop-color="#8fd8ff" stop-opacity=".55"/><stop offset="1" stop-color="#ffffff" stop-opacity=".85"/></radialGradient>
  <linearGradient id="rainbow" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7ff0ff"/><stop offset=".35" stop-color="#b48cff"/><stop offset=".65" stop-color="#ff8fd0"/><stop offset="1" stop-color="#ffe36b"/></linearGradient>`;

const gloss = (cx, cy, rx, ry, rot = -25, op = 0.85) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="url(#shine)" opacity="${op}" transform="rotate(${rot} ${cx} ${cy})"/>`;
const sparkle = (x, y, r, op = 1) => `<path d="M${x} ${y - r}Q${x} ${y} ${x + r} ${y}Q${x} ${y} ${x} ${y + r}Q${x} ${y} ${x - r} ${y}Q${x} ${y} ${x} ${y - r}Z" fill="#fff" opacity="${op}"/>`;
const wrap = (body, extra = '') => `<g filter="url(#drop)"><g filter="url(#lit)">${body}</g>${extra}</g>`;
const svg = (body, size = 256) => `<svg width="${size}" height="${size}" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg"><defs>${DEFS}</defs>${body}</svg>`;

/* ---------- النجمة الذهبية بأوجه مضلّعة ---------- */
function goldStar() {
  const cx = 128, cy = 136, R = 116, r = 50;
  const P = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 ? r : R;
    P.push([cx + rad * Math.cos(a), cy + rad * Math.sin(a)]);
  }
  const L = [-0.5, -0.86];
  const hex = (t) => {
    const lo = [176, 104, 0], hi = [255, 246, 176];
    return '#' + lo.map((v, i) => Math.round(v + (hi[i] - v) * t).toString(16).padStart(2, '0')).join('');
  };
  let facets = '';
  for (let i = 0; i < 10; i += 2) {
    const O = P[i], Il = P[(i + 9) % 10], Ir = P[(i + 1) % 10];
    for (const [A, B, side] of [[Il, O, -1], [O, Ir, 1]]) {
      const mx = (A[0] + B[0] + cx) / 3 - cx, my = (A[1] + B[1] + cy) / 3 - cy;
      const len = Math.hypot(mx, my);
      // ميل الوجه: نحو الخارج ونحو جانبه
      const tx = -my / len * side * 0.55 + mx / len, ty = mx / len * side * 0.55 + my / len;
      const tl = Math.hypot(tx, ty);
      const d = (tx / tl) * L[0] + (ty / tl) * L[1];
      const t = Math.max(0, Math.min(1, 0.5 + d * 0.55));
      facets += `<polygon points="${f(cx)},${f(cy)} ${f(A[0])},${f(A[1])} ${f(B[0])},${f(B[1])}" fill="${hex(t)}" stroke="${hex(t)}" stroke-width="1"/>`;
    }
  }
  const outline = P.map(([x, y]) => f(x) + ',' + f(y)).join(' ');
  return svg(`<g filter="url(#drop)">
      <polygon points="${outline}" fill="#a85f00" stroke="#8a4a00" stroke-width="10" stroke-linejoin="round"/>
      ${facets}
      <polygon points="${starPts(cx, cy, 30, 14, 5)}" fill="#fff8d0" opacity=".85"/>
      <g opacity=".9">${sparkle(96, 70, 15)}${sparkle(176, 122, 9, 0.8)}</g>
      ${gloss(100, 104, 18, 8, -35, 0.7)}
    </g>`);
}

/* ---------- الفانوس المضيء ---------- */
function lanternTile() {
  return svg(`<circle cx="128" cy="140" r="104" fill="#ffc861" opacity=".55" filter="url(#softglow)"/>
    <g filter="url(#drop)">
      <circle cx="128" cy="22" r="11" fill="none" stroke="url(#gMetal)" stroke-width="7"/>
      <path d="M86 78Q88 40 128 34Q168 40 170 78Z" fill="url(#gMetalV)" stroke="#6b3d05" stroke-width="4"/>
      <g fill="#6b3d05" opacity=".8">${[100, 116, 128, 140, 156].map((x) => `<path d="${archPath(x - 4, 50, 8, 18, 6)}"/>`).join('')}</g>
      <rect x="74" y="74" width="108" height="16" rx="5" fill="url(#gMetal)" stroke="#6b3d05" stroke-width="3"/>
      <path d="M82 90H174L192 150L164 214H92L64 150Z" fill="url(#gGlass)"/>
      <g fill="none" stroke="#7a4706" stroke-width="7" stroke-linejoin="round">
        <path d="M82 90H174L192 150L164 214H92L64 150Z"/>
        <path d="M106 90L98 150L110 214M150 90L158 150L146 214M64 150H192"/>
      </g>
      <g fill="none" stroke="#b77400" stroke-width="3.5"><path d="${archPath(112, 100, 32, 44, 18)}"/><path d="${archPath(112, 158, 32, 50, 20)}"/></g>
      <circle cx="128" cy="150" r="14" fill="#fffef0" filter="url(#blur3)"/>
      <rect x="86" y="212" width="84" height="14" rx="5" fill="url(#gMetal)" stroke="#6b3d05" stroke-width="3"/>
      <path d="M96 226H160Q150 246 128 250Q106 246 96 226Z" fill="url(#gMetalV)" stroke="#6b3d05" stroke-width="3"/>
      ${gloss(96, 124, 9, 24, 12, 0.55)}${sparkle(178, 64, 11)}
    </g>`);
}

/* ---------- الرمّانة ---------- */
function pomegranate() {
  let specks = '';
  for (let i = 0; i < 26; i++) {
    const a = i * 2.4, d = 20 + ((i * 37) % 70);
    specks += `<circle cx="${f(128 + Math.cos(a) * d)}" cy="${f(150 + Math.sin(a) * d * 0.9)}" r="${f(1.5 + (i % 3))}" fill="#ffd0d8" opacity=".35"/>`;
  }
  return svg(wrap(
    `<path d="M128 58C182 56 226 98 222 152C218 206 176 240 126 238C76 236 36 204 34 152C32 96 74 60 128 58Z" fill="url(#gPom)"/>
     ${specks}
     <path d="M104 72L94 34L114 50L128 22L142 50L162 34L152 72Z" fill="url(#gCrown)" stroke="#5a000e" stroke-width="4" stroke-linejoin="round"/>
     <ellipse cx="128" cy="72" rx="26" ry="8" fill="#5a000e" opacity=".7"/>
     <path d="M198 120Q214 160 196 200" stroke="#ff8a9a" stroke-width="6" fill="none" opacity=".55" stroke-linecap="round"/>`,
    `${gloss(94, 112, 30, 17, -35, 0.75)}<circle cx="82" cy="104" r="7" fill="#fff" opacity=".9"/>${sparkle(178, 96, 11)}`
  ));
}

/* ---------- العنب ---------- */
function grapes() {
  const rows = [[84, [84, 128, 172]], [120, [62, 106, 150, 194]], [156, [84, 128, 172]], [190, [106, 150]], [222, [128]]];
  let berries = '';
  for (const [y, xs] of rows)
    for (const x of xs) {
      const r = y > 200 ? 22 : 25;
      berries += `<circle cx="${x}" cy="${y}" r="${r}" fill="url(#gBerry)"/>
        <ellipse cx="${x - 8}" cy="${y - 10}" rx="7" ry="4.5" fill="#fff" opacity=".85" transform="rotate(-30 ${x - 8} ${y - 10})"/>
        <path d="M${x + 14} ${y - 6}Q${x + 20} ${y + 6} ${x + 10} ${y + 16}" stroke="#d6b8ff" stroke-width="3" fill="none" opacity=".6"/>`;
    }
  return svg(`<g filter="url(#drop)">
    <path d="M128 60Q130 36 148 22" stroke="#6b4422" stroke-width="9" fill="none" stroke-linecap="round"/>
    <path d="M144 36C150 14 184 6 206 22C198 30 214 44 200 52C194 60 178 58 172 52C162 58 146 52 144 36Z" fill="url(#gLeafA)" stroke="#1d5a1d" stroke-width="3"/>
    <path d="M150 40Q176 30 200 30M170 36Q176 46 172 52" stroke="#1d5a1d" stroke-width="2.5" fill="none"/>
    <g filter="url(#lit)">${berries}</g>
    ${sparkle(198, 104, 10)}
  </g>`);
}

/* ---------- الورقة الخضراء ---------- */
function leaf() {
  // ورقة عريضة في إحداثيات محلية أفقية ثم تُدار ٤٥°
  let veins = '';
  for (let i = -3; i <= 3; i++) {
    const x = i * 30;
    veins += `<path d="M${x} 0Q${x + 18} -26 ${x + 40} -${54 - Math.abs(i) * 7}" stroke="#d8ffa8" stroke-width="3.2" fill="none" opacity=".8"/>`;
    veins += `<path d="M${x} 0Q${x + 18} 26 ${x + 40} ${54 - Math.abs(i) * 7}" stroke="#9bd86c" stroke-width="3.2" fill="none" opacity=".6"/>`;
  }
  return svg(wrap(
    `<g transform="translate(130 128) rotate(-42)">
       <path d="M-150 6Q-136 4 -122 0" stroke="#3c6e1e" stroke-width="11" stroke-linecap="round"/>
       <path d="M-124 0C-70 -96 62 -96 128 0Z" fill="url(#gLeafA)"/>
       <path d="M-124 0C-70 92 62 92 128 0Z" fill="url(#gLeafB)"/>
       <path d="M-124 0Q0 -8 128 0" stroke="#efffd0" stroke-width="5" fill="none" stroke-linecap="round"/>
       ${veins}
     </g>`,
    `${gloss(104, 108, 40, 11, -42, 0.55)}${sparkle(196, 70, 11)}`
  ));
}

/* ---------- قطرة الماء ---------- */
function drop() {
  return svg(wrap(
    `<path d="M128 14C128 14 218 112 218 162A90 88 0 0 1 38 162C38 112 128 14 128 14Z" fill="url(#gDrop)"/>
     <path d="M196 150A70 70 0 0 1 120 236Q170 220 196 150Z" fill="#c9f3ff" opacity=".5"/>
     <path d="M128 14C128 14 218 112 218 162A90 88 0 0 1 38 162C38 112 128 14 128 14Z" fill="none" stroke="#0a4bb0" stroke-width="3" opacity=".5"/>`,
    `<path d="M80 124Q92 82 124 52" stroke="#fff" stroke-width="13" fill="none" stroke-linecap="round" opacity=".85"/>
     <circle cx="84" cy="152" r="8" fill="#fff" opacity=".85"/>${sparkle(168, 130, 12)}`
  ));
}

/* ---------- القطع الخاصة والفقاعات (كما هي) ---------- */
const wedges = ['#ffd21f', '#ff8a2a', '#ff3d6b', '#a86bff', '#4fc8ff', '#5fd84a']
  .map((col, i) => {
    const a0 = ((i * 60 - 90) * Math.PI) / 180, a1 = (((i + 1) * 60 - 90) * Math.PI) / 180;
    const p = (a) => `${f(128 + 92 * Math.cos(a))} ${f(128 + 92 * Math.sin(a))}`;
    return `<path d="M128 128L${p(a0)}A92 92 0 0 1 ${p(a1)}Z" fill="${col}"/>`;
  })
  .join('');
const SPECIALS = {
  noor: `<circle cx="128" cy="128" r="104" fill="#fff6b0" filter="url(#softglow)" opacity=".9"/>
    <g filter="url(#drop)"><g filter="url(#lit)"><circle cx="128" cy="128" r="96" fill="#fff"/>${wedges}
    <circle cx="128" cy="128" r="96" fill="none" stroke="#fff" stroke-width="8"/></g>
    <circle cx="128" cy="128" r="46" fill="#fff" filter="url(#glow)" opacity=".95"/>
    <polygon points="${starPts(128, 128, 40, 17, 5)}" fill="#fff7c2"/>
    ${gloss(92, 78, 34, 16, -30, 0.9)}${sparkle(184, 72, 14)}${sparkle(66, 182, 9)}</g>`,
  'ov-row': `<g filter="url(#glow)" opacity=".98">
      <rect x="18" y="104" width="220" height="48" rx="24" fill="#fff" opacity=".35"/><rect x="30" y="118" width="196" height="20" rx="10" fill="#fff"/>
      <path d="M8 128L46 98L46 158Z" fill="#fff"/><path d="M248 128L210 98L210 158Z" fill="#fff"/></g>`,
  'ov-col': `<g filter="url(#glow)" opacity=".98" transform="rotate(90 128 128)">
      <rect x="18" y="104" width="220" height="48" rx="24" fill="#fff" opacity=".35"/><rect x="30" y="118" width="196" height="20" rx="10" fill="#fff"/>
      <path d="M8 128L46 98L46 158Z" fill="#fff"/><path d="M248 128L210 98L210 158Z" fill="#fff"/></g>`,
  'ov-bomb': `<g filter="url(#glow)">
      <circle cx="128" cy="128" r="112" fill="none" stroke="#fff" stroke-width="12" stroke-dasharray="26 18" opacity=".95"/>
      <circle cx="128" cy="128" r="112" fill="none" stroke="#ffd84a" stroke-width="5" stroke-dasharray="26 18" stroke-dashoffset="22"/>
      ${sparkle(128, 18, 16)}${sparkle(238, 128, 16)}${sparkle(128, 238, 16)}${sparkle(18, 128, 16)}</g>`,
  bubble1: `<g filter="url(#drop)"><circle cx="128" cy="128" r="104" fill="url(#bubbleFill)"/>
      <circle cx="128" cy="128" r="104" fill="none" stroke="url(#rainbow)" stroke-width="7" opacity=".9"/>
      <path d="M62 96Q74 58 112 46" stroke="#fff" stroke-width="12" fill="none" stroke-linecap="round" opacity=".9"/>
      <circle cx="176" cy="178" r="9" fill="#fff" opacity=".85"/></g>`,
  bubble2: `<g filter="url(#drop)"><circle cx="128" cy="128" r="108" fill="url(#bubbleFill)"/>
      <circle cx="128" cy="128" r="108" fill="none" stroke="url(#rainbow)" stroke-width="10"/>
      <circle cx="128" cy="128" r="80" fill="#9fdcff" opacity=".35"/>
      <circle cx="128" cy="128" r="80" fill="none" stroke="url(#rainbow)" stroke-width="6" opacity=".9"/>
      <path d="M58 94Q72 54 112 42" stroke="#fff" stroke-width="13" fill="none" stroke-linecap="round" opacity=".95"/>
      <circle cx="178" cy="180" r="10" fill="#fff" opacity=".9"/></g>`,
};

/* ---------- أيقونات المعزّزات ---------- */
const ICONS = {
  'ic-hammer': wrap(
    `<rect x="112" y="96" width="34" height="150" rx="14" fill="url(#gWood)" stroke="#5a2e0b" stroke-width="6" transform="rotate(-35 128 128)"/>
     <rect x="38" y="34" width="168" height="76" rx="22" fill="url(#gRed)" stroke="#7a0f0f" stroke-width="7" transform="rotate(-35 128 128)"/>
     <rect x="52" y="44" width="140" height="18" rx="9" fill="#fff" opacity=".35" transform="rotate(-35 128 128)"/>`
  ),
  'ic-row': wrap(
    `<path d="M12 128L72 70L72 104L184 104L184 70L244 128L184 186L184 152L72 152L72 186Z" fill="url(#gGold)" stroke="#9a5a00" stroke-width="8" stroke-linejoin="round"/>`,
    `<rect x="80" y="108" width="96" height="12" rx="6" fill="#fff" opacity=".6"/>`
  ),
  'ic-col': wrap(
    `<path d="M128 12L186 72L152 72L152 184L186 184L128 244L70 184L104 184L104 72L70 72Z" fill="url(#gBlue)" stroke="#0d2f8a" stroke-width="8" stroke-linejoin="round"/>`,
    `<rect x="110" y="80" width="12" height="96" rx="6" fill="#fff" opacity=".6"/>`
  ),
  'ic-shuffle': wrap(
    `<path d="M128 30A98 98 0 0 1 222 112L246 112L206 160L166 112L190 112A66 66 0 0 0 128 62Z" fill="url(#gPurple)" stroke="#3e0d8f" stroke-width="7" stroke-linejoin="round"/>
     <path d="M128 226A98 98 0 0 1 34 144L10 144L50 96L90 144L66 144A66 66 0 0 0 128 194Z" fill="url(#gGreen)" stroke="#0e5a27" stroke-width="7" stroke-linejoin="round"/>`
  ),
  'ic-q': wrap(
    `<circle cx="128" cy="128" r="112" fill="url(#gGold)" stroke="#9a5a00" stroke-width="9"/>
     <circle cx="128" cy="128" r="84" fill="none" stroke="#b77400" stroke-width="6" opacity=".6"/>
     <text x="128" y="172" text-anchor="middle" font-family="Baloo, sans-serif" font-weight="800" font-size="150" fill="#8a4b00">؟</text>`,
    gloss(90, 70, 40, 16, -25, 0.8)
  ),
  'ic-check': wrap(`<circle cx="128" cy="128" r="110" fill="url(#gGreen)" stroke="#0e5a27" stroke-width="9"/>
     <path d="M70 132L110 172L190 88" stroke="#fff" stroke-width="30" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`),
  'ic-moves': wrap(`<circle cx="128" cy="128" r="110" fill="url(#gBlue)" stroke="#0d2f8a" stroke-width="9"/>
     <path d="M86 92L170 128L86 164Z" fill="#fff"/>`),
};

function all() {
  const list = [
    ['star', goldStar()], ['lantern', lanternTile()], ['pomegranate', pomegranate()],
    ['grapes', grapes()], ['leaf', leaf()], ['drop', drop()],
  ];
  for (const [k, body] of Object.entries(SPECIALS)) list.push([k, svg(body)]);
  for (const [k, body] of Object.entries(ICONS)) list.push([k, svg(body)]);
  // نجمة الواجهة = النجمة الذهبية نفسها
  list.push(['ic-star', goldStar()]);
  return list.map(([n, s]) => [n, s, 256]);
}

module.exports = { all, DEFS, svg, wrap, gloss, sparkle };
