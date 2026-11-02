/* أدوات الرسم المشتركة: المواد (ذهب، حجر، رخام)، الأنماط الهندسية الإسلامية، الأقواس، المقرنصات، الغيوم، الأشجار */
'use strict';

/** مولّد أرقام عشوائية ثابت البذرة (لنتائج متكررة) */
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}
const f = (n) => Math.round(n * 10) / 10;

function starPts(cx, cy, R, r, n = 8, rot = -Math.PI / 2) {
  const p = [];
  for (let i = 0; i < n * 2; i++) {
    const rad = i % 2 ? r : R;
    const a = rot + (i * Math.PI) / n;
    p.push(f(cx + rad * Math.cos(a)) + ',' + f(cy + rad * Math.sin(a)));
  }
  return p.join(' ');
}

/** قوس مدبّب فارسي داخل مستطيل (x,y,w,h). sh = ارتفاع الجزء المنحني */
function archPath(x, y, w, h, sh = w * 0.62) {
  sh = Math.min(sh, h);
  const ys = y + sh;
  return `M${f(x)} ${f(y + h)}L${f(x)} ${f(ys)}C${f(x)} ${f(ys - sh * 0.5)} ${f(x + w * 0.3)} ${f(y + sh * 0.14)} ${f(x + w / 2)} ${f(y)}` +
    `C${f(x + w * 0.7)} ${f(y + sh * 0.14)} ${f(x + w)} ${f(ys - sh * 0.5)} ${f(x + w)} ${f(ys)}L${f(x + w)} ${f(y + h)}Z`;
}

/* ---------- المواد ---------- */
const DEFS_COMMON = `
<linearGradient id="gold" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#fff8da"/><stop offset=".18" stop-color="#ffe089"/><stop offset=".42" stop-color="#e3a42b"/>
  <stop offset=".6" stop-color="#fde6a0"/><stop offset=".8" stop-color="#bd7e14"/><stop offset="1" stop-color="#7a4906"/>
</linearGradient>
<linearGradient id="goldH" x1="0" y1="0" x2="1" y2="0">
  <stop offset="0" stop-color="#6e4105"/><stop offset=".2" stop-color="#c8891a"/><stop offset=".48" stop-color="#ffe9a6"/>
  <stop offset=".62" stop-color="#f0c450"/><stop offset=".85" stop-color="#a5650c"/><stop offset="1" stop-color="#5a3303"/>
</linearGradient>
<radialGradient id="goldR" cx=".38" cy=".3" r=".75">
  <stop offset="0" stop-color="#fffbe6"/><stop offset=".25" stop-color="#ffe08a"/><stop offset=".6" stop-color="#d69a22"/><stop offset="1" stop-color="#7a4906"/>
</radialGradient>
<linearGradient id="cyl" x1="0" y1="0" x2="1" y2="0">
  <stop offset="0" stop-color="#000a2a" stop-opacity=".55"/><stop offset=".22" stop-color="#000a2a" stop-opacity=".12"/>
  <stop offset=".58" stop-color="#fff4d6" stop-opacity=".22"/><stop offset=".72" stop-color="#fff4d6" stop-opacity=".05"/>
  <stop offset="1" stop-color="#000a2a" stop-opacity=".5"/>
</linearGradient>
<linearGradient id="stone" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#f4e2bd"/><stop offset="1" stop-color="#d9b984"/>
</linearGradient>
<linearGradient id="recess" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#3a2a22"/><stop offset=".55" stop-color="#6b4c36"/><stop offset="1" stop-color="#8a6a4c"/>
</linearGradient>
<filter id="bevel" x="-10%" y="-10%" width="120%" height="120%">
  <feGaussianBlur in="SourceAlpha" stdDeviation="1.6" result="b"/>
  <feSpecularLighting in="b" surfaceScale="3.5" specularConstant=".9" specularExponent="18" lighting-color="#fff6dc" result="s">
    <feDistantLight azimuth="235" elevation="42"/>
  </feSpecularLighting>
  <feComposite in="s" in2="SourceAlpha" operator="in" result="s2"/>
  <feComposite in="SourceGraphic" in2="s2" operator="arithmetic" k1="0" k2="1" k3=".8" k4="0"/>
</filter>
<filter id="stoneTex" x="0" y="0" width="100%" height="100%">
  <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="4" result="n"/>
  <feColorMatrix in="n" type="matrix" values="0 0 0 0 .45  0 0 0 0 .35  0 0 0 0 .25  0 0 0 .22 0" result="c"/>
  <feComposite in="c" in2="SourceGraphic" operator="in" result="c2"/>
  <feBlend in="SourceGraphic" in2="c2" mode="multiply"/>
</filter>
<filter id="soft2"><feGaussianBlur stdDeviation="2"/></filter>
<filter id="soft6"><feGaussianBlur stdDeviation="6"/></filter>
<filter id="soft14" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="14"/></filter>
<filter id="glowF" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="10"/></filter>
`;

/* ---------- الأنماط الهندسية ---------- */
/** نمط «الخاتم»: نجمة ثمانية وصلبان — كاشي أزرق وفيروزي */
function patKhatam(id, T = 48, c = {}) {
  const { bg = '#173a94', star = '#1fb2c8', line = '#f2f6ff', inner = '#f7f3e6', dot = '#f3c24a', corner = '#2c63c9' } = c;
  const h = T / 2;
  const s1 = T * 0.36;
  const sq = (r, rot) => {
    const p = [];
    for (let i = 0; i < 4; i++) {
      const a = rot + (i * Math.PI) / 2;
      p.push(f(h + r * Math.cos(a)) + ',' + f(h + r * Math.sin(a)));
    }
    return p.join(' ');
  };
  return `<pattern id="${id}" width="${T}" height="${T}" patternUnits="userSpaceOnUse">
    <rect width="${T}" height="${T}" fill="${bg}"/>
    ${[[0, 0], [T, 0], [0, T], [T, T]].map(([x, y]) => `<polygon points="${starPts(x, y, T * 0.2, T * 0.09, 4, 0)}" fill="${corner}" stroke="${line}" stroke-width="${T * 0.025}"/>`).join('')}
    <polygon points="${sq(s1 * 1.414 * 0.72, Math.PI / 4)}" fill="${star}" stroke="${line}" stroke-width="${T * 0.035}"/>
    <polygon points="${sq(s1 * 1.414 * 0.72, 0)}" fill="${star}" stroke="${line}" stroke-width="${T * 0.035}"/>
    <polygon points="${sq(s1 * 1.414 * 0.72, Math.PI / 4)}" fill="${star}"/>
    <polygon points="${starPts(h, h, T * 0.2, T * 0.1, 8, 0)}" fill="${inner}"/>
    <circle cx="${h}" cy="${h}" r="${T * 0.055}" fill="${dot}"/>
    <path d="M${h} 0V${T * 0.08}M${h} ${T}V${T * 0.92}M0 ${h}H${T * 0.08}M${T} ${h}H${T * 0.92}" stroke="${line}" stroke-width="${T * 0.025}"/>
  </pattern>`;
}

/** نمط سداسي بنجوم سداسية */
function patHex(id, T = 36, c = {}) {
  const { bg = '#f4ead2', hex = '#2a8fb8', star = '#173a94', line = '#ffffff', dot = '#e7b13a' } = c;
  const W = T * Math.sqrt(3);
  const H = T * 3;
  const hexAt = (cx, cy, r) => {
    const p = [];
    for (let i = 0; i < 6; i++) {
      const a = Math.PI / 6 + (i * Math.PI) / 3;
      p.push(f(cx + r * Math.cos(a)) + ',' + f(cy + r * Math.sin(a)));
    }
    return p.join(' ');
  };
  const cell = (cx, cy) =>
    `<polygon points="${hexAt(cx, cy, T * 0.92)}" fill="${hex}" stroke="${line}" stroke-width="${T * 0.05}"/>
     <polygon points="${starPts(cx, cy, T * 0.66, T * 0.36, 6, -Math.PI / 2)}" fill="${star}" stroke="${line}" stroke-width="${T * 0.04}"/>
     <circle cx="${f(cx)}" cy="${f(cy)}" r="${f(T * 0.16)}" fill="${dot}"/>`;
  return `<pattern id="${id}" width="${f(W)}" height="${f(H)}" patternUnits="userSpaceOnUse">
    <rect width="${f(W)}" height="${f(H)}" fill="${bg}"/>
    ${cell(0, 0)}${cell(W, 0)}${cell(W / 2, H / 2)}${cell(0, H)}${cell(W, H)}
  </pattern>`;
}

/** زخرفة نباتية (إسليمي): وردة ثمانية وأغصان ملتفّة */
function patIslimi(id, T = 70, c = {}) {
  const { bg = '#123a8c', vine = '#38c6d6', leaf = '#7fe0e6', rose = '#f6f1e4', heart = '#f0b93a', edge = '#0b2766' } = c;
  const h = T / 2;
  const petals = Array.from({ length: 8 }, (_, i) =>
    `<ellipse cx="${h}" cy="${f(h - T * 0.12)}" rx="${f(T * 0.055)}" ry="${f(T * 0.12)}" transform="rotate(${i * 45} ${h} ${h})" fill="${rose}" stroke="${edge}" stroke-width="${T * 0.012}"/>`
  ).join('');
  const vinePath = `M0 ${h}C${T * 0.18} ${T * 0.18} ${T * 0.32} ${T * 0.2} ${h} ${T * 0.02}M${T} ${h}C${T * 0.82} ${T * 0.82} ${T * 0.68} ${T * 0.8} ${h} ${T * 0.98}` +
    `M${h} 0C${T * 0.82} ${T * 0.18} ${T * 0.8} ${T * 0.32} ${T} ${h}M${h} ${T}C${T * 0.18} ${T * 0.82} ${T * 0.2} ${T * 0.68} 0 ${h}`;
  const lf = (x, y, rot) => `<path d="M0 0C${T * 0.04} ${-T * 0.05} ${T * 0.11} ${-T * 0.05} ${T * 0.14} 0C${T * 0.11} ${T * 0.05} ${T * 0.04} ${T * 0.05} 0 0Z" transform="translate(${f(x)} ${f(y)}) rotate(${rot})" fill="${leaf}" stroke="${edge}" stroke-width="${T * 0.01}"/>`;
  return `<pattern id="${id}" width="${T}" height="${T}" patternUnits="userSpaceOnUse">
    <rect width="${T}" height="${T}" fill="${bg}"/>
    <path d="${vinePath}" fill="none" stroke="${edge}" stroke-width="${T * 0.05}" stroke-linecap="round"/>
    <path d="${vinePath}" fill="none" stroke="${vine}" stroke-width="${T * 0.028}" stroke-linecap="round"/>
    ${lf(T * 0.16, T * 0.25, -60)}${lf(T * 0.84, T * 0.75, 120)}${lf(T * 0.75, T * 0.16, 30)}${lf(T * 0.25, T * 0.84, 210)}
    ${petals}
    <circle cx="${h}" cy="${h}" r="${f(T * 0.07)}" fill="${heart}" stroke="${edge}" stroke-width="${T * 0.012}"/>
    ${[[0, 0], [T, 0], [0, T], [T, T]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="${f(T * 0.09)}" fill="${heart}" stroke="${edge}" stroke-width="${T * 0.012}"/>`).join('')}
  </pattern>`;
}

/** رخام: أرضية فاتحة مع عروق رفيعة متموّجة وتغيّم خفيف */
function filterMarble(id, seed = 3, base = '#f6efe3', vein = '#8f857c', cloudy = [0.88, 0.84, 0.78]) {
  const band = Array(24).fill(0).concat([0.35, 0.75, 0.35]).concat(Array(24).fill(0)).join(' ');
  return `<filter id="${id}" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
    <feTurbulence type="fractalNoise" baseFrequency=".0045 .010" numOctaves="4" seed="${seed}" result="n"/>
    <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1 0 0 0 0" result="a"/>
    <feComponentTransfer in="a" result="v"><feFuncA type="table" tableValues="${band}"/></feComponentTransfer>
    <feFlood flood-color="${vein}" result="vc"/>
    <feComposite in="vc" in2="v" operator="in" result="veins"/>
    <feGaussianBlur in="veins" stdDeviation=".5" result="veinsB"/>
    <feTurbulence type="fractalNoise" baseFrequency=".0025" numOctaves="2" seed="${seed + 5}" result="cl"/>
    <feColorMatrix in="cl" type="matrix" values="0 0 0 0 ${cloudy[0]}  0 0 0 0 ${cloudy[1]}  0 0 0 0 ${cloudy[2]}  .7 0 0 0 -.28" result="cloud"/>
    <feFlood flood-color="${base}" result="base"/>
    <feMerge result="m"><feMergeNode in="base"/><feMergeNode in="cloud"/><feMergeNode in="veinsB"/></feMerge>
    <feComposite in="m" in2="SourceAlpha" operator="in"/>
  </filter>`;
}

/* ---------- المقرنصات ---------- */
/** صفوف من الخلايا المقوّسة (مقرنصات) داخل مستطيل، تُقصّ بمسار القوس */
function muqarnas(x, y, w, h, tiers = 6, c = {}) {
  const { light = '#fff3c4', mid = '#e0a630', dark = '#7a4a0a', cellIn = '#1b4aa8', cellIn2 = '#0b2a6e', rim = '#6b3f05', seed = 5 } = c;
  const R = rng(seed);
  let out = '';
  const th = h / tiers;
  for (let t = 0; t < tiers; t++) {
    const n = 2 + t * 2;
    const cw = w / n;
    const off = t % 2 ? cw / 2 : 0;
    for (let i = -1; i <= n; i++) {
      const cx = x + off + i * cw;
      const cy = y + t * th;
      if (cx + cw < x - 1 || cx > x + w + 1) continue;
      const pad = cw * 0.06;
      out += `<path d="${archPath(cx + pad, cy, cw - pad * 2, th * 1.15, th * 0.7)}" fill="url(#muqCell)" stroke="${rim}" stroke-width="${f(cw * 0.04)}"/>`;
      out += `<path d="${archPath(cx + cw * 0.24, cy + th * 0.28, cw * 0.52, th * 0.85, th * 0.42)}" fill="${R() < 0.5 ? cellIn : cellIn2}" opacity=".92"/>`;
      out += `<path d="M${f(cx + cw * 0.26)} ${f(cy + th * 0.62)}Q${f(cx + cw / 2)} ${f(cy + th * 0.3)} ${f(cx + cw * 0.74)} ${f(cy + th * 0.62)}" stroke="${light}" stroke-width="${f(cw * 0.03)}" fill="none" opacity=".7"/>`;
    }
  }
  const defs = `<linearGradient id="muqCell" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${light}"/><stop offset=".45" stop-color="${mid}"/><stop offset="1" stop-color="${dark}"/></linearGradient>`;
  return { defs, body: out };
}

/* ---------- الغيوم والأشجار (أسلوب مرسوم) ---------- */
/** غيمة ركامية: صف قاعدي مسطّح وفقاعات علوية، بثلاث طبقات إضاءة (ظل، وسط، ضوء دافئ) */
function cloud(x, y, w, h, seed = 1, light = '#fffaf0', shade = '#9fadd6', mid = '#dfe5f6') {
  const R = rng(seed);
  const puffs = [];
  const nb = 5 + Math.floor(w / 90);
  for (let i = 0; i < nb; i++) {
    const t = (i + 0.5) / nb;
    const r = h * (0.22 + 0.1 * R());
    puffs.push([x + t * w, y + h - r * 0.8, r]);
  }
  const nt = 3 + Math.floor(w / 140);
  for (let i = 0; i < nt; i++) {
    const t = 0.15 + (0.7 * (i + R() * 0.6)) / nt;
    const arch = Math.sin(t * Math.PI);
    const r = h * (0.25 + 0.3 * arch) * (0.8 + R() * 0.4);
    puffs.push([x + t * w, y + h - r * 0.9 - arch * h * 0.32, r]);
  }
  const L = (dx, dy, k, col, extra = '') => `<g fill="${col}" ${extra}>${puffs.map(([bx, by, r]) => `<circle cx="${f(bx + dx * r)}" cy="${f(by + dy * r)}" r="${f(r * k)}"/>`).join('')}</g>`;
  return `<g filter="url(#cloudF)">
    ${L(0, 0, 1, shade)}
    <ellipse cx="${f(x + w / 2)}" cy="${f(y + h - h * 0.12)}" rx="${f(w * 0.5)}" ry="${f(h * 0.14)}" fill="${shade}"/>
    ${L(0.06, -0.14, 0.86, mid)}
    ${L(0.2, -0.3, 0.62, light)}
    ${L(0.28, -0.42, 0.34, '#ffffff', 'opacity=".8"')}
  </g>`;
}
const DEFS_NATURE = `
<filter id="cloudF" x="-20%" y="-30%" width="140%" height="160%">
  <feTurbulence type="fractalNoise" baseFrequency=".04" numOctaves="3" seed="9" result="n"/>
  <feDisplacementMap in="SourceGraphic" in2="n" scale="18" xChannelSelector="R" yChannelSelector="G" result="d"/>
  <feGaussianBlur in="d" stdDeviation="2.2"/>
</filter>
<filter id="leafF" x="-20%" y="-20%" width="140%" height="140%">
  <feTurbulence type="fractalNoise" baseFrequency=".08" numOctaves="2" seed="21" result="n"/>
  <feDisplacementMap in="SourceGraphic" in2="n" scale="22" xChannelSelector="R" yChannelSelector="G"/>
</filter>
<linearGradient id="bark" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#3a2412"/><stop offset=".5" stop-color="#7a5230"/><stop offset="1" stop-color="#2e1c0e"/></linearGradient>
`;

/** شجرة/أغصان بأسلوب مرسوم: مئات الأوراق الصغيرة في عناقيد، يُلوَّن كلٌّ منها حسب اتجاه الضوء (من أعلى اليمين) */
function foliage(cx, cy, w, h, seed = 2, pal = ['#143a20', '#24602e', '#3f8a3a', '#79b956', '#b4de86'], fruit = null, opts = {}) {
  const R = rng(seed);
  const { leaves = 46, size = 1, light = [0.62, -0.78] } = opts;
  const m = Math.min(w, h);
  const clusters = [];
  const k = 6 + Math.floor((w * h) / 26000);
  for (let i = 0; i < k; i++) {
    const a = R() * Math.PI * 2, d = Math.sqrt(R()) * 0.72;
    clusters.push([cx + Math.cos(a) * d * w * 0.5, cy + Math.sin(a) * d * h * 0.5, m * (0.2 + R() * 0.12)]);
  }
  clusters.sort((p, q) => p[1] - q[1]);
  let base = '';
  const items = [];
  for (const [x, y, r] of clusters) {
    base += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r * 0.92)}"/>`;
    for (let j = 0; j < leaves; j++) {
      const a = R() * Math.PI * 2, d = Math.sqrt(R()) * r;
      const lx = x + Math.cos(a) * d, ly = y + Math.sin(a) * d;
      const nx = (lx - x) / r + ((x - cx) / w) * 0.8, ny = (ly - y) / r + ((y - cy) / h) * 0.8;
      const L = nx * light[0] + ny * light[1] + (R() - 0.5) * 0.5;
      items.push([L, lx, ly, (m * 0.05 + R() * m * 0.03) * size, R() * 180]);
    }
  }
  items.sort((p, q) => p[0] - q[0]);
  const col = (L) => (L < -0.55 ? pal[0] : L < -0.1 ? pal[1] : L < 0.35 ? pal[2] : L < 0.75 ? pal[3] : pal[4]);
  const leavesSvg = items.map(([L, x, y, s, rot]) => `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(s)}" ry="${f(s * 0.46)}" transform="rotate(${f(rot)} ${f(x)} ${f(y)})" fill="${col(L)}"/>`).join('');
  let fruits = '';
  if (fruit) {
    const lit = items.filter((it) => it[0] > -0.2);
    for (let i = 0; i < 18 && lit.length; i++) {
      const [, x, y] = lit[Math.floor(R() * lit.length)];
      fruits += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(m * 0.032)}" fill="url(#orangeG)"/>`;
    }
  }
  return `<g fill="${pal[0]}" filter="url(#leafF)">${base}</g>${leavesSvg}${fruits}`;
}

/** جذع شجرة منحنٍ مع أغصان */
function trunk(x0, y0, x1, y1, w = 22, seed = 1) {
  const R = rng(seed);
  const mx = (x0 + x1) / 2 + (R() - 0.5) * 60;
  const branches = [0.55, 0.7, 0.82].map((t) => {
    const bx = x0 + (x1 - x0) * t, by = y0 + (y1 - y0) * t;
    const dir = R() < 0.5 ? -1 : 1;
    return `<path d="M${f(bx)} ${f(by)}Q${f(bx + dir * 40)} ${f(by - 30)} ${f(bx + dir * (70 + R() * 50))} ${f(by - 70 - R() * 40)}" stroke="url(#bark)" stroke-width="${f(w * 0.4)}" fill="none" stroke-linecap="round"/>`;
  });
  return `<path d="M${f(x0)} ${f(y0)}Q${f(mx)} ${f((y0 + y1) / 2)} ${f(x1)} ${f(y1)}" stroke="url(#bark)" stroke-width="${w}" fill="none" stroke-linecap="round"/>${branches.join('')}`;
}

module.exports = { rng, f, starPts, archPath, DEFS_COMMON, DEFS_NATURE, patKhatam, patHex, patIslimi, filterMarble, muqarnas, cloud, foliage, trunk };
