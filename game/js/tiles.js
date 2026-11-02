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

  const svg = (inner, vb = '0 0 100 100') => `<svg viewBox="${vb}" aria-hidden="true">${inner}</svg>`;

  // مرشّح «الترميم» لعناصر الصحن غير المرمّمة (يُحقن مرة واحدة)
  N.injectDefs = function () {
    if (document.getElementById('noor-defs')) return;
    const div = document.createElement('div');
    div.innerHTML = `<svg id="noor-defs" width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
      <filter id="ruin"><feColorMatrix type="matrix" values="0.33 0.62 0.15 0 0.02  0.29 0.56 0.13 0 0.02  0.22 0.44 0.1 0 0.02  0 0 0 1 0"/></filter></defs></svg>`;
    document.body.appendChild(div.firstElementChild);
  };

  /* صور اللعبة الفاخرة: مرسومة بإضاءة ثلاثية الأبعاد عبر tools/render-sprites.js */
  const SP = (n) => 'img/sprites/' + n + '.webp';
  N.SPRITES = {
    tiles: ['star', 'date', 'pomegranate', 'grapes', 'olive', 'drop'].map(SP),
    noor: SP('noor'),
    ov: { row: SP('ov-row'), col: SP('ov-col'), bomb: SP('ov-bomb') },
    bubble: [null, SP('bubble1'), SP('bubble2')],
    icon: {
      hammer: SP('ic-hammer'), row: SP('ic-row'), col: SP('ic-col'), shuffle: SP('ic-shuffle'),
      star: SP('ic-star'), q: SP('ic-q'), check: SP('ic-check'), moves: SP('ic-moves'),
    },
    bg: SP('bg-game'),
  };
  N.img = (src, cls = '') => `<img class="${cls}" src="${src}" alt="" draggable="false">`;

  /** تحميل الصور مسبقاً حتى تظهر فوراً عند أول استخدام */
  N.preloadSprites = function () {
    const all = [...N.SPRITES.tiles, N.SPRITES.noor, ...Object.values(N.SPRITES.ov), N.SPRITES.bubble[1], N.SPRITES.bubble[2],
      ...Object.values(N.SPRITES.icon), N.SPRITES.bg];
    return Promise.all(all.map((src) => new Promise((res) => {
      const im = new Image();
      im.onload = im.onerror = () => res();
      im.src = src;
    })));
  };

  // ٦ قطع: نجمة، تمرة، رمّانة، عنب، زيتونة، قطرة ماء (لا تُستخدم الرموز المقدّسة قطعاً تُفرقَع)
  N.TILE_NAMES = ['النجمة', 'التمرة', 'الرمّانة', 'العنب', 'الزيتونة', 'قطرة الماء'];
  N.TILE_COLORS = ['#ffc61a', '#e8822a', '#f0284f', '#9a4ff5', '#4cc432', '#22aaff'];
  N.tileIcon = (type) => N.img(type === 'dust' ? N.SPRITES.bubble[1] : N.SPRITES.tiles[type], 'gimg');

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

  // أيقونات الواجهة (صور)
  const I = N.SPRITES.icon;
  N.ICON = {
    star: N.img(I.star, 'ico'),
    q: N.img(I.q, 'ico'),
    hammer: N.img(I.hammer, 'ico'),
    row: N.img(I.row, 'ico'),
    col: N.img(I.col, 'ico'),
    shuffle: N.img(I.shuffle, 'ico'),
    check: N.img(I.check, 'ico'),
    moves: N.img(I.moves, 'ico'),
  };
})();
