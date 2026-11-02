/* عناصر مشتركة: فانوس معلّق مضيء، نبتة في أصيص مزخرف، أشعة ضوء */
'use strict';
const { f, rng, archPath, starPts, foliage } = require('./common');

/** فانوس معلّق (عرض 200 × ارتفاع 420 في إحداثياته)، مع هالة ضوء */
function lantern(id = 'L', { chain = 60, halo = true } = {}) {
  const top = chain;
  const g = `${id}glass`;
  return `
  <defs>
    <radialGradient id="${g}" cx="100" cy="${top + 158}" r="78" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#fffdf0"/><stop offset=".35" stop-color="#ffe08a"/><stop offset=".75" stop-color="#f39a26"/><stop offset="1" stop-color="#b8560c"/>
    </radialGradient>
    <radialGradient id="${id}halo" cx="100" cy="${top + 160}" r="190" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#ffdc8a" stop-opacity=".75"/><stop offset=".35" stop-color="#ffc65a" stop-opacity=".28"/><stop offset="1" stop-color="#ffb347" stop-opacity="0"/>
    </radialGradient>
  </defs>
  ${halo ? `<circle cx="100" cy="${top + 160}" r="190" fill="url(#${id}halo)"/>` : ''}
  ${chain ? `<g stroke="#6b4106" stroke-width="3" fill="none">${Array.from({ length: Math.floor(chain / 12) }, (_, i) => `<ellipse cx="100" cy="${6 + i * 12}" rx="${i % 2 ? 2.5 : 4.5}" ry="6"/>`).join('')}</g>` : ''}
  <circle cx="100" cy="${top + 6}" r="8" fill="none" stroke="url(#gold)" stroke-width="4"/>
  <circle cx="100" cy="${top + 18}" r="7" fill="url(#goldR)"/>
  <path d="M58 ${top + 70}Q60 ${top + 26} 100 ${top + 22}Q140 ${top + 26} 142 ${top + 70}Z" fill="url(#gold)" filter="url(#bevel)"/>
  <g fill="#5a3303" opacity=".75">${[70, 86, 100, 114, 130].map((x) => `<path d="${archPath(x - 4, top + 44, 8, 18, 6)}"/>`).join('')}</g>
  <rect x="50" y="${top + 68}" width="100" height="12" rx="3" fill="url(#gold)"/>
  <path d="M55 ${top + 80}L145 ${top + 80}L162 ${top + 150}L136 ${top + 240}L64 ${top + 240}L38 ${top + 150}Z" fill="url(#${g})"/>
  <g fill="none" stroke="#7a4806" stroke-width="5" stroke-linejoin="round">
    <path d="M55 ${top + 80}L145 ${top + 80}L162 ${top + 150}L136 ${top + 240}L64 ${top + 240}L38 ${top + 150}Z"/>
    <path d="M78 ${top + 80}L72 ${top + 150}L84 ${top + 240}M122 ${top + 80}L128 ${top + 150}L116 ${top + 240}M38 ${top + 150}H162"/>
  </g>
  <g fill="none" stroke="#a8670c" stroke-width="2.6" opacity=".95">
    <path d="${archPath(84, top + 94, 32, 52, 22)}"/><path d="${archPath(84, top + 160, 32, 66, 26)}"/>
    <path d="M47 ${top + 120}L64 ${top + 96}M153 ${top + 120}L136 ${top + 96}M48 ${top + 182}L66 ${top + 218}M152 ${top + 182}L134 ${top + 218}"/>
  </g>
  <g fill="#fff8d8" opacity=".9"><circle cx="100" cy="${top + 150}" r="3"/><circle cx="58" cy="${top + 150}" r="2.4"/><circle cx="142" cy="${top + 150}" r="2.4"/></g>
  <rect x="60" y="${top + 238}" width="80" height="10" rx="3" fill="url(#gold)"/>
  <path d="M66 ${top + 248}L134 ${top + 248}Q120 ${top + 290} 100 ${top + 298}Q80 ${top + 290} 66 ${top + 248}Z" fill="url(#gold)" filter="url(#bevel)"/>
  <circle cx="100" cy="${top + 306}" r="8" fill="url(#goldR)"/>
  <path d="M100 ${top + 312}L94 ${top + 336}H106Z" fill="url(#gold)"/>
  <ellipse cx="86" cy="${top + 120}" rx="8" ry="20" fill="#fff" opacity=".35" transform="rotate(12 86 ${top + 120})"/>`;
}

/** نبتة كثيفة بأزهار في أصيص كاشي (عرض 400 × ارتفاع 520) */
function plant(id = 'P', seed = 3, flowers = ['#ff7aa8', '#ffffff', '#ffd25a']) {
  const R = rng(seed);
  let fl = '';
  for (let i = 0; i < 30; i++) {
    const x = 60 + R() * 280, y = 40 + R() * 250, r = 7 + R() * 7;
    const col = flowers[i % flowers.length];
    fl += `<g transform="translate(${f(x)} ${f(y)})">${[0, 72, 144, 216, 288].map((a) => `<ellipse cx="0" cy="${f(-r * 0.6)}" rx="${f(r * 0.45)}" ry="${f(r * 0.65)}" transform="rotate(${a})" fill="${col}"/>`).join('')}<circle r="${f(r * 0.28)}" fill="#f0a21a"/></g>`;
  }
  return `
  <defs>
    <linearGradient id="${id}pot" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#0d2a6e"/><stop offset=".45" stop-color="#2e6fd6"/><stop offset=".6" stop-color="#5a9cf0"/><stop offset="1" stop-color="#0b2260"/>
    </linearGradient>
  </defs>
  ${foliage(200, 170, 380, 300, seed, ['#123a1e', '#1f5e2e', '#3a8a3a', '#6fb552', '#a8d97f'], null, { leaves: 50 })}
  ${fl}
  <path d="M90 330H310L290 500H110Z" fill="url(#${id}pot)"/>
  <path d="M100 360H300M96 330H304" stroke="url(#gold)" stroke-width="10"/>
  <g fill="#f6efe0" opacity=".9">${[140, 200, 260].map((x) => `<polygon points="${starPts(x, 425, 22, 10, 8, 0)}"/>`).join('')}</g>
  <path d="M110 500H290" stroke="url(#gold)" stroke-width="10"/>
  <path d="M100 330H300L292 400H108Z" fill="url(#cyl)" opacity=".7"/>`;
}

/** أشعة شمس مائلة (حزم ضوء) */
function rays(x, y, len, angle, n = 5, seed = 7, color = '#fff2c8') {
  const R = rng(seed);
  let out = '';
  for (let i = 0; i < n; i++) {
    const w = 40 + R() * 90;
    const off = (i - n / 2) * 70 + R() * 40;
    out += `<rect x="${f(x + off)}" y="${y}" width="${f(w)}" height="${len}" fill="${color}" opacity="${f(0.1 + R() * 0.16)}" transform="rotate(${angle} ${x} ${y})"/>`;
  }
  return `<g filter="url(#soft14)" style="mix-blend-mode:screen">${out}</g>`;
}

module.exports = { lantern, plant, rays };
