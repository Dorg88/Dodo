/* مشهد القاعة (خلفية اللعب): جدار أمامي بإيوان ومقرنصات وباب مضيء، جداران جانبيان بأقواس، أرضية رخام وسجادة، سقف مزخرف.
   تُرسم مسطّحة ثم تُسقَط بالمنظور في post-art.py */
'use strict';
const C = require('./common');
const { f, archPath, starPts, patKhatam, patHex, patIslimi, filterMarble, muqarnas, DEFS_COMMON, DEFS_NATURE } = C;

const svgWrap = (w, h, defs, body) =>
  `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg"><defs>${DEFS_COMMON}${DEFS_NATURE}${defs}</defs>${body}</svg>`;

/** الجدار الأمامي 500×920 (الإيوان الكبير) */
function farWall() {
  const W = 500, H = 920;
  const ax = 40, aw = 420, ay = 26;
  const m = muqarnas(ax, ay, aw, 400, 7, { seed: 11 });
  const doorX = 165, doorW = 170, doorY = 520;
  const defs = `
    ${patKhatam('fwK', 46)}${patHex('fwH', 13, { bg: '#f1e6cc' })}${patIslimi('fwI', 64)}${m.defs}
    <clipPath id="fwArch"><path d="${archPath(ax, ay, aw, H - ay, 300)}"/></clipPath>
    <linearGradient id="fwDoor" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fffdf2"/><stop offset=".5" stop-color="#ffefc6"/><stop offset="1" stop-color="#ffd98c"/>
    </linearGradient>
    <radialGradient id="fwDoorGlow" cx="250" cy="760" r="300" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#fff3c8" stop-opacity=".9"/><stop offset="1" stop-color="#ffcf7a" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="fwShade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#000814" stop-opacity=".55"/><stop offset=".45" stop-color="#000814" stop-opacity=".05"/><stop offset="1" stop-color="#000814" stop-opacity=".25"/>
    </linearGradient>`;
  const body = `
    <rect width="${W}" height="${H}" fill="url(#fwK)"/>
    <rect width="${W}" height="${H}" fill="#06123a" opacity=".25"/>
    <g clip-path="url(#fwArch)">
      <rect x="${ax}" y="${ay}" width="${aw}" height="${H}" fill="url(#fwI)"/>
      <rect x="${ax}" y="${ay}" width="${aw}" height="420" fill="#0b1f55"/>
      ${m.body}
      <rect x="${ax}" y="${ay}" width="${aw}" height="${H}" fill="url(#fwShade)"/>
      <path d="${archPath(doorX, doorY, doorW, H - doorY, 120)}" fill="url(#fwDoor)"/>
      <g opacity=".35" fill="#c9b48e">
        <path d="M${doorX} ${H - 120}Q${doorX + 40} ${H - 190} ${doorX + 70} ${H - 150}Q${doorX + 100} ${H - 230} ${doorX + 130} ${H - 160}Q${doorX + 150} ${H - 190} ${doorX + doorW} ${H - 130}V${H}H${doorX}Z"/>
        <ellipse cx="${doorX + doorW / 2}" cy="${H - 175}" rx="38" ry="44"/><rect x="${doorX + doorW / 2 - 3}" y="${H - 236}" width="6" height="22"/>
      </g>
      <path d="${archPath(doorX, doorY, doorW, H - doorY, 120)}" fill="none" stroke="url(#gold)" stroke-width="12"/>
      <path d="${archPath(doorX - 18, doorY - 18, doorW + 36, H - doorY + 18, 136)}" fill="none" stroke="url(#fwH)" stroke-width="20"/>
      ${[70, 370].map((x) => `<path d="${archPath(x, 560, 60, 190, 50)}" fill="#ffd27a"/><path d="${archPath(x, 560, 60, 190, 50)}" fill="none" stroke="url(#gold)" stroke-width="6"/>
         <path d="M${x + 30} 600V750M${x} 650H${x + 60}" stroke="#7a4806" stroke-width="4"/>`).join('')}
      <circle cx="250" cy="760" r="300" fill="url(#fwDoorGlow)"/>
    </g>
    <path d="${archPath(ax, ay, aw, H - ay, 300)}" fill="none" stroke="#06123a" stroke-width="30" opacity=".5"/>
    <path d="${archPath(ax, ay, aw, H - ay, 300)}" fill="none" stroke="url(#fwH)" stroke-width="24"/>
    <path d="${archPath(ax - 14, ay - 14, aw + 28, H - ay + 14, 312)}" fill="none" stroke="url(#gold)" stroke-width="9" filter="url(#bevel)"/>
    <path d="${archPath(ax + 13, ay + 15, aw - 26, H - ay, 286)}" fill="none" stroke="url(#gold)" stroke-width="6"/>
    <rect x="0" y="0" width="${W}" height="10" fill="url(#gold)"/>`;
  return svgWrap(W, H, defs, body);
}

/** نسيج الجدار الجانبي (مسطّح): u = العمق (من الكاميرا إلى البعيد)، v = الارتفاع. W×H */
function sideWall(W = 2400, H = 1100) {
  const bays = 6;
  const bw = W / bays;
  const dadoY = H * 0.74;
  const frieze = H * 0.1;
  const defs = `${patKhatam('swK', 54)}${patHex('swH', 14, { bg: '#efe2c4' })}${patIslimi('swI', 70)}${filterMarble('swM', 5, '#efe6d6')}
    <linearGradient id="swPier" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#d8c094"/><stop offset=".5" stop-color="#f6e7c6"/><stop offset="1" stop-color="#b99c6c"/></linearGradient>
    <linearGradient id="swNiche" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#04102e" stop-opacity=".65"/><stop offset=".6" stop-color="#04102e" stop-opacity=".15"/><stop offset="1" stop-color="#04102e" stop-opacity=".35"/></linearGradient>`;
  let body = `<rect width="${W}" height="${H}" fill="url(#swK)"/><rect width="${W}" height="${H}" fill="#04102e" opacity=".22"/>`;
  for (let i = 0; i < bays; i++) {
    const x = i * bw;
    const nx = x + bw * 0.16, nw = bw * 0.68, ny = frieze + 40;
    body += `
      <path d="${archPath(nx, ny, nw, dadoY - ny, nw * 0.62)}" fill="url(#swI)"/>
      <path d="${archPath(nx, ny, nw, dadoY - ny, nw * 0.62)}" fill="url(#swNiche)"/>
      <path d="${archPath(nx + nw * 0.25, ny + 120, nw * 0.5, dadoY - ny - 160, nw * 0.4)}" fill="#ffcf7a" opacity=".9"/>
      <path d="${archPath(nx + nw * 0.25, ny + 120, nw * 0.5, dadoY - ny - 160, nw * 0.4)}" fill="none" stroke="url(#gold)" stroke-width="8"/>
      <path d="M${f(nx + nw * 0.5)} ${ny + 160}V${f(dadoY - 40)}M${f(nx + nw * 0.25)} ${f(ny + 300)}H${f(nx + nw * 0.75)}" stroke="#7a4806" stroke-width="7"/>
      <path d="${archPath(nx, ny, nw, dadoY - ny, nw * 0.62)}" fill="none" stroke="url(#swH)" stroke-width="26"/>
      <path d="${archPath(nx - 14, ny - 14, nw + 28, dadoY - ny + 14, nw * 0.66)}" fill="none" stroke="url(#gold)" stroke-width="9"/>
      <rect x="${f(x - bw * 0.05)}" y="${frieze}" width="${f(bw * 0.1)}" height="${f(dadoY - frieze)}" fill="url(#swPier)"/>
      <rect x="${f(x - bw * 0.05)}" y="${frieze}" width="${f(bw * 0.1)}" height="26" fill="url(#gold)"/>`;
  }
  body += `
    <rect y="0" width="${W}" height="${frieze}" fill="#0c2364"/>
    <rect y="${frieze * 0.25}" width="${W}" height="${frieze * 0.5}" fill="url(#swH)"/>
    <rect y="${frieze - 12}" width="${W}" height="14" fill="url(#gold)"/>
    <rect y="0" width="${W}" height="10" fill="url(#gold)"/>
    <rect y="${dadoY}" width="${W}" height="${H - dadoY}" fill="#fff" filter="url(#swM)"/>
    ${Array.from({ length: bays * 2 }, (_, i) => `<rect x="${f(i * bw / 2 + 24)}" y="${f(dadoY + 40)}" width="${f(bw / 2 - 48)}" height="${f(H - dadoY - 80)}" rx="8" fill="none" stroke="#b89a6a" stroke-width="6"/>`).join('')}
    <rect y="${dadoY - 8}" width="${W}" height="16" fill="url(#gold)"/>`;
  return svgWrap(W, H, defs, body);
}

/** نسيج الأرضية (مسطّح): الأعلى = البعيد. رخام مربّعات + سجادة فارسية في الوسط */
function floor(W = 1500, H = 3000) {
  const sq = 250;
  const cw = W * 0.42, cx = (W - cw) / 2;
  const defs = `${filterMarble('flM', 7, '#f3ece0')}${filterMarble('flM2', 12, '#d9cbb3', '#7d6f62', [0.8, 0.74, 0.66])}
    <pattern id="flCarpet" width="${cw}" height="300" patternUnits="userSpaceOnUse" x="${cx}">
      <rect width="${cw}" height="300" fill="#8a1620"/>
      ${Array.from({ length: 6 }, (_, i) => Array.from({ length: 4 }, (_, j) => `<polygon points="${starPts(cw * (0.125 + 0.25 * j), 25 + 50 * i, 16, 7, 4, 0)}" fill="${(i + j) % 2 ? '#e3a83a' : '#1b3a8a'}"/>`).join('')).join('')}
      <path d="M0 0L${cw / 2} 150L${cw} 0M0 300L${cw / 2} 150L${cw} 300" stroke="#5a0c14" stroke-width="5" fill="none"/>
      <ellipse cx="${cw / 2}" cy="150" rx="${cw * 0.24}" ry="70" fill="#132f73" stroke="#e8b44a" stroke-width="7"/>
      <polygon points="${starPts(cw / 2, 150, 46, 20, 8, 0)}" fill="#e8b44a"/><circle cx="${cw / 2}" cy="150" r="12" fill="#8a1620"/>
    </pattern>`;
  let tiles = '';
  for (let y = 0; y < H; y += sq) for (let x = 0; x < W; x += sq) if (((x + y) / sq) % 2) tiles += `<rect x="${x}" y="${y}" width="${sq}" height="${sq}"/>`;
  const body = `
    <rect width="${W}" height="${H}" fill="#fff" filter="url(#flM)"/>
    <g fill="#fff" filter="url(#flM2)">${tiles}</g>
    <g stroke="#b48a3e" stroke-width="5" opacity=".8">${Array.from({ length: W / sq + 1 }, (_, i) => `<line x1="${i * sq}" y1="0" x2="${i * sq}" y2="${H}"/>`).join('')}${Array.from({ length: H / sq + 1 }, (_, i) => `<line x1="0" y1="${i * sq}" x2="${W}" y2="${i * sq}"/>`).join('')}</g>
    <rect x="${cx - 20}" y="0" width="${cw + 40}" height="${H}" fill="#0f2560"/>
    <rect x="${cx - 12}" y="0" width="${cw + 24}" height="${H}" fill="none" stroke="#e8b44a" stroke-width="6"/>
    <rect x="${cx}" y="0" width="${cw}" height="${H}" fill="url(#flCarpet)"/>
    <g fill="#e8b44a">${Array.from({ length: H / 40 }, (_, i) => `<circle cx="${cx - 10}" cy="${i * 40 + 20}" r="5"/><circle cx="${cx + cw + 10}" cy="${i * 40 + 20}" r="5"/>`).join('')}</g>
    <rect x="${cx}" y="0" width="${cw}" height="${H}" fill="none" stroke="#132f73" stroke-width="22"/>`;
  return svgWrap(W, H, defs, body);
}

/** نسيج السقف: صناديق مزخرفة بنجوم ذهبية وعوارض */
function ceiling(W = 1500, H = 3000) {
  const defs = `${patKhatam('ceK', 90, { bg: '#0b1f5a', star: '#c58a1a', line: '#ffe6a0', inner: '#163a8a', dot: '#ffd36b', corner: '#12307a' })}`;
  let beams = '';
  for (let y = 0; y < H; y += 375) beams += `<rect x="0" y="${y}" width="${W}" height="36" fill="url(#gold)"/>`;
  for (let x = 0; x <= W; x += 375) beams += `<rect x="${x - 18}" y="0" width="36" height="${H}" fill="url(#goldH)"/>`;
  const body = `<rect width="${W}" height="${H}" fill="url(#ceK)"/><rect width="${W}" height="${H}" fill="#020818" opacity=".25"/>${beams}`;
  return svgWrap(W, H, defs, body);
}

module.exports = { farWall, sideWall, floor, ceiling, svgWrap };
