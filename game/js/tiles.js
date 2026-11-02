/* رسومات اللعبة (SVG) بطابع مرح للأطفال: قطع ملوّنة بوجوه مبتسمة، الحمامة «نوري»، والأيقونات.
   لا تُستخدم الرموز المقدّسة (كالمصحف) قطعاً تُفرقَع؛ ولا تصوير لأي شخصية مقدّسة. */
(function () {
  const N = (window.Noor = window.Noor || {});
  const INK = '#2b2250';

  function starPoints(cx, cy, R, r, n = 8, rot = -Math.PI / 2) {
    const pts = [];
    for (let i = 0; i < n * 2; i++) {
      const rad = i % 2 === 0 ? R : r;
      const a = rot + (i * Math.PI) / n;
      pts.push((cx + rad * Math.cos(a)).toFixed(1) + ',' + (cy + rad * Math.sin(a)).toFixed(1));
    }
    return pts.join(' ');
  }
  N.starPoints = starPoints;

  // تدرّجات لونية مشتركة (تُحقن مرة واحدة في الصفحة)
  N.injectDefs = function () {
    if (document.getElementById('noor-defs')) return;
    const grad = (id, a, b) =>
      `<radialGradient id="${id}" cx="35%" cy="28%" r="80%"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></radialGradient>`;
    const div = document.createElement('div');
    div.innerHTML = `<svg id="noor-defs" width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
      ${grad('tStar', '#fff7b0', '#ffc21a')}
      ${grad('tDate', '#ffc98a', '#d9701f')}
      ${grad('tPom', '#ff9aa9', '#e0294d')}
      ${grad('tGrape', '#d9b8ff', '#8a4ff0')}
      ${grad('tOlive', '#d2f7a1', '#4cb83a')}
      ${grad('tDrop', '#c4f1ff', '#2b9cf0')}
      ${grad('gGold', '#fff1b8', '#f2b51f')}
      ${grad('gBubble', '#ffffff', '#9fdcff')}
      <filter id="ruin"><feColorMatrix type="saturate" values="0.05"/></filter>
    </defs></svg>`;
    document.body.appendChild(div.firstElementChild);
  };

  const svg = (inner, vb = '0 0 100 100') => `<svg viewBox="${vb}" aria-hidden="true">${inner}</svg>`;

  // وجه مبتسم بعينين لامعتين (العينان ترمشان عبر CSS)
  const face = (cx, cy, s = 1) => `<g transform="translate(${cx} ${cy}) scale(${s})">
      <ellipse cx="-15" cy="7" rx="5.5" ry="3.4" fill="#ff6f9f" opacity=".55"/>
      <ellipse cx="15" cy="7" rx="5.5" ry="3.4" fill="#ff6f9f" opacity=".55"/>
      <g class="eyes">
        <ellipse cx="-9" cy="-4" rx="5.6" ry="6.8" fill="#fff" stroke="${INK}" stroke-width="1.6"/>
        <ellipse cx="9" cy="-4" rx="5.6" ry="6.8" fill="#fff" stroke="${INK}" stroke-width="1.6"/>
        <circle cx="-8" cy="-3" r="3.7" fill="${INK}"/><circle cx="10" cy="-3" r="3.7" fill="${INK}"/>
        <circle cx="-6.8" cy="-4.8" r="1.4" fill="#fff"/><circle cx="11.2" cy="-4.8" r="1.4" fill="#fff"/>
      </g>
      <path d="M-6 6 Q0 12.5 6 6" fill="none" stroke="${INK}" stroke-width="2.8" stroke-linecap="round"/>
    </g>`;
  const gloss = (cx, cy, rx, ry, rot = -30) =>
    `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#fff" opacity=".6" transform="rotate(${rot} ${cx} ${cy})"/>`;

  // ٦ قطع بألوان قوس قزح: نجمة، تمرة، رمّانة، عنب، زيتونة، قطرة ماء
  N.TILE_NAMES = ['النجمة', 'التمرة', 'الرمّانة', 'العنب', 'الزيتونة', 'قطرة الماء'];
  N.TILE_COLORS = ['#ffc21a', '#ff9f43', '#ff4d6d', '#a66cff', '#6fcf4a', '#3db8f5'];
  N.TILE_SVG = [
    // 0 نجمة صفراء
    svg(`<polygon points="${starPoints(50, 55, 47, 23, 5)}" fill="url(#tStar)" stroke="#c77800" stroke-width="5" stroke-linejoin="round"/>
         ${gloss(36, 38, 7, 4)}${face(50, 60, 0.82)}`),
    // 1 تمرة
    svg(`<ellipse cx="50" cy="57" rx="30" ry="37" fill="url(#tDate)" stroke="#7a3a0a" stroke-width="4.5"/>
         <ellipse cx="50" cy="20" rx="11" ry="6" fill="#ffd56b" stroke="#7a3a0a" stroke-width="3.5"/>
         ${gloss(36, 38, 7, 12, 20)}${face(50, 60, 0.9)}`),
    // 2 رمّانة
    svg(`<path d="M37 27 L35 11 L43 18 L50 8 L57 18 L65 11 L63 27 Z" fill="#e8344f" stroke="#8a0f28" stroke-width="4" stroke-linejoin="round"/>
         <circle cx="50" cy="59" r="35" fill="url(#tPom)" stroke="#8a0f28" stroke-width="4.5"/>
         ${gloss(35, 44, 8, 11, 30)}${face(50, 62, 0.95)}`),
    // 3 عنقود عنب
    svg(`<path d="M50 22 Q52 12 58 8" stroke="#7a4a1e" stroke-width="4" fill="none" stroke-linecap="round"/>
         <path d="M54 16 Q70 4 82 14 Q72 28 54 16 Z" fill="#5fc24a" stroke="#2c6e1f" stroke-width="3" stroke-linejoin="round"/>
         <g fill="url(#tGrape)" stroke="#4b1f99" stroke-width="3.5">
           <circle cx="31" cy="36" r="15"/><circle cx="50" cy="32" r="15"/><circle cx="69" cy="36" r="15"/>
           <circle cx="39" cy="56" r="16"/><circle cx="61" cy="56" r="16"/><circle cx="50" cy="76" r="16"/>
         </g>
         ${gloss(26, 30, 4, 6, 30)}${gloss(45, 26, 4, 6, 30)}${face(50, 58, 0.85)}`),
    // 4 زيتونة
    svg(`<path d="M58 20 Q60 10 66 6" stroke="#5b3a1a" stroke-width="4" fill="none" stroke-linecap="round"/>
         <path d="M62 12 Q80 2 92 12 Q78 24 62 12 Z" fill="#3e9b2f" stroke="#1f5e1a" stroke-width="3" stroke-linejoin="round"/>
         <ellipse cx="50" cy="58" rx="31" ry="37" fill="url(#tOlive)" stroke="#1f5e1a" stroke-width="4.5" transform="rotate(-12 50 58)"/>
         ${gloss(36, 40, 7, 12, 10)}${face(49, 61, 0.92)}`),
    // 5 قطرة ماء
    svg(`<path d="M50 6 C50 6 84 44 84 64 A34 33 0 0 1 16 64 C16 44 50 6 50 6 Z" fill="url(#tDrop)" stroke="#0d4f9a" stroke-width="4.5" stroke-linejoin="round"/>
         ${gloss(36, 50, 6, 12, 25)}${face(50, 66, 0.92)}`),
  ];

  // كرة «النور» بألوان قوس قزح (تمسح لوناً كاملاً)
  const wedges = N.TILE_COLORS.map((col, i) => {
    const a0 = ((i * 60 - 90) * Math.PI) / 180, a1 = (((i + 1) * 60 - 90) * Math.PI) / 180;
    const p = (a) => `${(50 + 40 * Math.cos(a)).toFixed(1)} ${(50 + 40 * Math.sin(a)).toFixed(1)}`;
    return `<path d="M50 50 L${p(a0)} A40 40 0 0 1 ${p(a1)} Z" fill="${col}"/>`;
  }).join('');
  N.NOOR_SVG = svg(`<circle cx="50" cy="50" r="44" fill="#fff" stroke="${INK}" stroke-width="4"/>${wedges}
     <circle cx="50" cy="50" r="40" fill="none" stroke="#fff" stroke-width="3"/>
     <polygon points="${starPoints(50, 50, 22, 10, 5)}" fill="#fff" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>
     ${gloss(34, 30, 9, 5)}`);

  // طبقات القطع الخاصة
  N.SPECIAL_OVERLAY = {
    row: svg(`<g fill="#fff" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"><path d="M2 50 L17 37 V63 Z"/><path d="M98 50 L83 37 V63 Z"/></g>
      <g stroke-linecap="round"><path d="M24 12 H76 M24 90 H76" stroke="${INK}" stroke-width="7"/><path d="M24 12 H76 M24 90 H76" stroke="#fff" stroke-width="3.5"/></g>`),
    col: svg(`<g fill="#fff" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"><path d="M50 2 L37 17 H63 Z"/><path d="M50 98 L37 83 H63 Z"/></g>
      <g stroke-linecap="round"><path d="M10 24 V76 M90 24 V76" stroke="${INK}" stroke-width="7"/><path d="M10 24 V76 M90 24 V76" stroke="#fff" stroke-width="3.5"/></g>`),
    bomb: svg(`<circle cx="50" cy="50" r="45" fill="none" stroke="#fff" stroke-width="6" stroke-dasharray="9 7"/>
      <circle cx="50" cy="50" r="45" fill="none" stroke="#ff4d6d" stroke-width="3" stroke-dasharray="9 7" stroke-dashoffset="8"/>`),
  };

  // فقاعة تغطي الخانة (عائق يُفرقَع بالمطابقة فوقه)
  N.DUST_ICON = svg(`<circle cx="50" cy="50" r="42" fill="url(#gBubble)" stroke="#3a8fd6" stroke-width="5" opacity=".95"/>
     ${gloss(34, 32, 12, 7)}<circle cx="68" cy="68" r="5" fill="#fff" opacity=".8"/>`);
  N.tileIcon = (type) => (type === 'dust' ? N.DUST_ICON : N.TILE_SVG[type]);

  // الحمامة «نوري» — مرشدة اللعبة
  N.MASCOT_SVG = svg(
    `<g class="m-all">
      <path d="M32 84 L6 74 L12 90 L4 102 L34 96 Z" fill="#dfe6f2" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/>
      <path d="M52 105 v8 M47 113 h10 M72 105 v8 M67 113 h10" stroke="#ff6b81" stroke-width="4.5" stroke-linecap="round"/>
      <ellipse cx="62" cy="84" rx="36" ry="25" fill="#f7f9ff" stroke="${INK}" stroke-width="3.5"/>
      <circle cx="64" cy="45" r="28" fill="#f7f9ff" stroke="${INK}" stroke-width="3.5"/>
      <ellipse cx="63" cy="69" rx="25" ry="13" fill="#f7f9ff"/>
      <path d="M41 64 Q63 76 87 64 L86 72 Q63 84 42 72 Z" fill="#3cc7a8" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>
      <path d="M48 70 Q63 77 80 70" stroke="#a78bfa" stroke-width="3" fill="none" stroke-linecap="round" opacity=".9"/>
      <g class="m-wing">
        <path d="M58 78 Q96 70 100 92 Q90 104 62 98 Q52 88 58 78 Z" fill="#cfd9ea" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/>
        <path d="M70 84 Q80 86 88 84 M68 91 Q80 94 92 91" stroke="${INK}" stroke-width="3.2" fill="none" stroke-linecap="round"/>
      </g>
      <ellipse cx="46" cy="54" rx="6" ry="3.6" fill="#ff6f9f" opacity=".55"/><ellipse cx="82" cy="54" rx="6" ry="3.6" fill="#ff6f9f" opacity=".55"/>
      <g class="eyes">
        <ellipse cx="54" cy="42" rx="7" ry="8.5" fill="#fff" stroke="${INK}" stroke-width="2"/><ellipse cx="74" cy="42" rx="7" ry="8.5" fill="#fff" stroke="${INK}" stroke-width="2"/>
        <circle cx="55" cy="43" r="4.6" fill="${INK}"/><circle cx="75" cy="43" r="4.6" fill="${INK}"/>
        <circle cx="56.6" cy="41" r="1.8" fill="#fff"/><circle cx="76.6" cy="41" r="1.8" fill="#fff"/>
      </g>
      <path d="M60 52 Q64 49.5 68 52 Q66 58.5 64 59.5 Q62 58.5 60 52 Z" fill="#ff8a7a" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>
      <ellipse cx="64" cy="51.6" rx="3.2" ry="1.6" fill="#fff"/>
    </g>`,
    '0 0 120 120'
  );

  // أيقونات الواجهة
  N.ICON = {
    star: `<svg class="ico" viewBox="0 0 24 24"><polygon points="${starPoints(12, 12.8, 11.2, 5.4, 5)}" fill="#ffc21a" stroke="#c77800" stroke-width="1.6" stroke-linejoin="round"/></svg>`,
    points: `<svg class="ico" viewBox="0 0 24 24"><path d="M12 2.5 A7 7 0 0 1 16.2 15 V17.5 H7.8 V15 A7 7 0 0 1 12 2.5 Z" fill="#ffe14d" stroke="#c77800" stroke-width="1.5" stroke-linejoin="round"/><rect x="8.2" y="17.5" width="7.6" height="3.4" rx="1.2" fill="#9aa6c2" stroke="#4b5675" stroke-width="1.2"/><path d="M10 9.5 Q12 7 14 9.5" stroke="#fff" stroke-width="1.4" fill="none" stroke-linecap="round"/></svg>`,
    hammer: `<svg class="ico" viewBox="0 0 24 24"><rect x="10.3" y="9" width="3.4" height="13" rx="1.4" fill="#d18a4a" stroke="#7a4a1e" stroke-width="1.2"/><rect x="3.5" y="3" width="17" height="7.5" rx="2.4" fill="#ff6b81" stroke="#8a0f28" stroke-width="1.4"/></svg>`,
    arrow: `<svg class="ico" viewBox="0 0 24 24"><path d="M1.5 12 L7 6.5 V10 H17 V6.5 L22.5 12 L17 17.5 V14 H7 V17.5 Z" fill="#3db8f5" stroke="#0d4f9a" stroke-width="1.4" stroke-linejoin="round"/></svg>`,
    shuffle: `<svg class="ico" viewBox="0 0 24 24"><g stroke="#8a4ff0" stroke-width="2.8" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7 H8 L16 17 H20 M3 17 H8 L10.5 14 M13.5 10 L16 7 H20"/><path d="M18 4 L21 7 L18 10 M18 14 L21 17 L18 20"/></g></svg>`,
  };
})();
