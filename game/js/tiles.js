/* رسومات القطع (SVG) — زخارف إسلامية بدون أي صور لأشخاص */
(function () {
  const N = (window.Noor = window.Noor || {});

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
      `<radialGradient id="${id}" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></radialGradient>`;
    const div = document.createElement('div');
    div.innerHTML = `<svg id="noor-defs" width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
      ${grad('gGold', '#fff1b8', '#e0a91f')}
      ${grad('gGreen', '#b6f5cf', '#1e9e58')}
      ${grad('gRed', '#ffb3b3', '#c8283a')}
      ${grad('gBlue', '#b9cdff', '#2a56c9')}
      ${grad('gPurple', '#e3c9ff', '#7a3fd0')}
      ${grad('gIvory', '#ffffff', '#d9cdb4')}
      ${grad('gNoor', '#ffffff', '#ffd55a')}
      <filter id="ruin"><feColorMatrix type="saturate" values="0.05"/></filter>
    </defs></svg>`;
    document.body.appendChild(div.firstElementChild);
  };

  const svg = (inner) => `<svg viewBox="0 0 100 100" aria-hidden="true">${inner}</svg>`;

  // ٦ أنواع: نجمة، هلال، رمانة، مصحف، فانوس، قبة
  N.TILE_NAMES = ['النجمة', 'الهلال', 'الرمّانة', 'المصحف', 'الفانوس', 'القبّة'];
  N.TILE_SVG = [
    // 0 نجمة ثمانية ذهبية
    svg(`<polygon points="${starPoints(50, 50, 44, 34)}" fill="url(#gGold)" stroke="#8a5a00" stroke-width="3.5" stroke-linejoin="round"/>
         <polygon points="${starPoints(50, 50, 20, 15.5)}" fill="#fff6d0" stroke="#8a5a00" stroke-width="2.5" stroke-linejoin="round"/>`),
    // 1 هلال أخضر
    svg(`<path d="M47 16 A36 36 0 1 0 81.7 64.6 A30 30 0 1 1 47 16 Z" fill="url(#gGreen)" stroke="#0d5a30" stroke-width="3.5" stroke-linejoin="round"/>
         <polygon points="${starPoints(70, 36, 10, 4.2, 5)}" fill="#eafff2" stroke="#0d5a30" stroke-width="2"/>`),
    // 2 رمّانة حمراء
    svg(`<circle cx="50" cy="57" r="33" fill="url(#gRed)" stroke="#7a0f1c" stroke-width="3.5"/>
         <path d="M37 28 L35 12 L43 19 L50 9 L57 19 L65 12 L63 28 Z" fill="#a8192b" stroke="#7a0f1c" stroke-width="3" stroke-linejoin="round"/>
         <ellipse cx="38" cy="47" rx="7" ry="10" fill="#fff" opacity=".45"/>`),
    // 3 مصحف أزرق بزخرفة ذهبية
    svg(`<rect x="20" y="13" width="60" height="74" rx="8" fill="url(#gBlue)" stroke="#102f7a" stroke-width="3.5"/>
         <rect x="28" y="21" width="44" height="58" rx="4" fill="none" stroke="#f5c542" stroke-width="3"/>
         <polygon points="${starPoints(50, 50, 14, 10.7)}" fill="#f5c542" stroke="#8a5a00" stroke-width="1.5"/>`),
    // 4 فانوس بنفسجي مضيء
    svg(`<circle cx="50" cy="11" r="5" fill="none" stroke="#3e1a6b" stroke-width="3"/>
         <path d="M35 29 L50 16 L65 29 Z" fill="#f5c542" stroke="#3e1a6b" stroke-width="3" stroke-linejoin="round"/>
         <path d="M32 30 H68 L75 52 L64 80 H36 L25 52 Z" fill="url(#gPurple)" stroke="#3e1a6b" stroke-width="3.5" stroke-linejoin="round"/>
         <ellipse cx="50" cy="54" rx="9" ry="15" fill="#ffe28a"/>
         <path d="M40 81 H60 L56 90 H44 Z" fill="#f5c542" stroke="#3e1a6b" stroke-width="2.5" stroke-linejoin="round"/>`),
    // 5 قبّة عاجية
    svg(`<line x1="50" y1="6" x2="50" y2="22" stroke="#c99a1a" stroke-width="4"/>
         <circle cx="50" cy="8" r="4" fill="#f5c542"/>
         <path d="M20 86 V62 Q20 30 50 21 Q80 30 80 62 V86 Z" fill="url(#gIvory)" stroke="#7d6646" stroke-width="3.5" stroke-linejoin="round"/>
         <path d="M41 86 V70 Q41 61 50 58 Q59 61 59 70 V86 Z" fill="#2fa7b8" stroke="#7d6646" stroke-width="2.5"/>`),
  ];

  // قطعة «النور» الخاصة (تمسح لوناً كاملاً)
  N.NOOR_SVG = svg(`<circle cx="50" cy="50" r="40" fill="url(#gNoor)" stroke="#c98a00" stroke-width="3"/>
     <polygon points="${starPoints(50, 50, 30, 23)}" fill="none" stroke="#fff" stroke-width="4" stroke-linejoin="round"/>
     <circle cx="50" cy="50" r="9" fill="#fff"/>`);

  // طبقات القطع الخاصة
  N.SPECIAL_OVERLAY = {
    row: svg(`<g fill="#fff" stroke="#00000055" stroke-width="1.5"><path d="M4 50 L20 38 V62 Z"/><path d="M96 50 L80 38 V62 Z"/><rect x="20" y="45" width="60" height="10" rx="5" opacity=".9"/></g>`),
    col: svg(`<g fill="#fff" stroke="#00000055" stroke-width="1.5"><path d="M50 4 L38 20 H62 Z"/><path d="M50 96 L38 80 H62 Z"/><rect x="45" y="20" width="10" height="60" rx="5" opacity=".9"/></g>`),
    bomb: svg(`<circle cx="50" cy="50" r="44" fill="none" stroke="#fff" stroke-width="5" stroke-dasharray="10 7"/>`),
  };

  // أيقونات صغيرة للأهداف
  N.tileIcon = (type) => (type === 'dust' ? N.DUST_ICON : N.TILE_SVG[type]);
  N.DUST_ICON = svg(`<rect x="12" y="12" width="76" height="76" rx="12" fill="#c9a66b" stroke="#7a5a2a" stroke-width="4"/>
     <path d="M25 40 L45 30 M55 70 L75 58 M30 70 L40 62" stroke="#7a5a2a" stroke-width="4" stroke-linecap="round"/>`);
})();
