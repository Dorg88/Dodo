/* مسارات رسومات اللعبة (مرسومة مسبقاً عبر tools/render-art.js)، الحمامة «نوري»، والأيقونات.
   لا تُستخدم الرموز المقدّسة (كالمصحف) قطعاً تُفرقَع؛ ولا تصوير لأي شخصية مقدّسة. */
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

  // مرشّح «قبل الترميم» لعناصر الصحن (يُحقن مرة واحدة)
  N.injectDefs = function () {
    if (document.getElementById('noor-defs')) return;
    const div = document.createElement('div');
    div.innerHTML = `<svg id="noor-defs" width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
      <filter id="ruin"><feColorMatrix type="matrix" values="0.33 0.62 0.15 0 0.02  0.29 0.56 0.13 0 0.02  0.22 0.44 0.1 0 0.02  0 0 0 1 0"/></filter></defs></svg>`;
    document.body.appendChild(div.firstElementChild);
  };

  const SP = (n) => 'img/sprites/' + n + '.webp';
  const UI = (n) => 'img/ui/' + n + '.webp';
  N.SPRITES = {
    tiles: ['star', 'lantern', 'pomegranate', 'grapes', 'leaf', 'drop'].map(SP),
    noor: SP('noor'),
    ov: { row: SP('ov-row'), col: SP('ov-col'), bomb: SP('ov-bomb') },
    bubble: [null, SP('bubble1'), SP('bubble2')],
    icon: {
      hammer: SP('ic-hammer'), row: SP('ic-row'), col: SP('ic-col'), shuffle: SP('ic-shuffle'),
      star: SP('ic-star'), q: SP('ic-q'), check: SP('ic-check'), moves: SP('ic-moves'),
    },
  };
  N.UIART = {
    logo: UI('logo'), cart: UI('cart'), laurel: UI('laurel'),
    node: { done: UI('node-done'), cur: UI('node-cur'), lock: UI('node-lock') },
    icon: {
      gift: UI('ic-gift'), review: UI('ic-review'), scroll: UI('ic-scroll'), about: UI('ic-about'), gear: UI('ic-gear'),
      book: UI('ic-book'), home: UI('ic-home'), map: UI('ic-map'), dome: UI('ic-dome'), lock: UI('ic-lock'),
    },
  };
  N.ARTS = { hall: 'img/art/hall.webp', title: 'img/art/title.webp', blur: 'img/art/blur.webp' };
  N.img = (src, cls = '') => `<img class="${cls}" src="${src}" alt="" draggable="false">`;

  /** تحميل الصور مسبقاً حتى تظهر فوراً عند أول استخدام */
  N.preloadSprites = function () {
    const all = [...N.SPRITES.tiles, N.SPRITES.noor, ...Object.values(N.SPRITES.ov), N.SPRITES.bubble[1], N.SPRITES.bubble[2],
      ...Object.values(N.SPRITES.icon), ...Object.values(N.UIART.node), N.UIART.laurel, N.ARTS.hall, N.ARTS.blur];
    return Promise.all(all.map((src) => new Promise((res) => {
      const im = new Image();
      im.onload = im.onerror = () => res();
      im.src = src;
    })));
  };

  // ٦ قطع: نجمة، فانوس، رمّانة، عنب، ورقة، قطرة ماء (لا تُستخدم الرموز المقدّسة قطعاً تُفرقَع)
  N.TILE_NAMES = ['النجمة', 'الفانوس', 'الرمّانة', 'العنب', 'الورقة', 'قطرة الماء'];
  N.TILE_COLORS = ['#ffc61a', '#ff9a2a', '#f0284f', '#9a4ff5', '#4cc432', '#22aaff'];
  N.tileIcon = (type) => N.img(type === 'dust' ? N.SPRITES.bubble[1] : N.SPRITES.tiles[type], 'gimg');

  // الحمامة «نوري» — مرشدة اللعبة (تظليل ناعم)
  const INK = '#2c3a72';
  N.MASCOT_SVG = `<svg viewBox="0 0 120 120" aria-hidden="true"><defs>
      <radialGradient id="mBody" cx="40%" cy="30%" r="80%"><stop offset="0" stop-color="#ffffff"/><stop offset=".6" stop-color="#eef2fb"/><stop offset="1" stop-color="#bcc7e0"/></radialGradient>
      <linearGradient id="mWing" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4f7ff"/><stop offset="1" stop-color="#aebbd8"/></linearGradient>
      <linearGradient id="mScarf" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#1fb8a0"/><stop offset=".5" stop-color="#4fe0c4"/><stop offset="1" stop-color="#159a86"/></linearGradient>
      <radialGradient id="mBeak" cx="40%" cy="30%"><stop offset="0" stop-color="#ffd0a0"/><stop offset="1" stop-color="#f07a4a"/></radialGradient>
    </defs><g class="m-all">
      <path d="M32 84 L6 74 L12 90 L4 102 L34 96 Z" fill="url(#mWing)" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>
      <path d="M52 105 v8 M47 113 h10 M72 105 v8 M67 113 h10" stroke="#ff7a8a" stroke-width="4.5" stroke-linecap="round"/>
      <ellipse cx="62" cy="84" rx="36" ry="25" fill="url(#mBody)" stroke="${INK}" stroke-width="2.6"/>
      <circle cx="64" cy="45" r="28" fill="url(#mBody)" stroke="${INK}" stroke-width="2.6"/>
      <ellipse cx="63" cy="69" rx="25" ry="13" fill="#f6f8ff"/>
      <path d="M41 64 Q63 76 87 64 L86 72 Q63 84 42 72 Z" fill="url(#mScarf)" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>
      <path d="M48 70 Q63 77 80 70" stroke="#ffd36b" stroke-width="2.6" fill="none" stroke-linecap="round"/>
      <g class="m-wing">
        <path d="M58 78 Q96 70 100 92 Q90 104 62 98 Q52 88 58 78 Z" fill="url(#mWing)" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>
        <path d="M70 84 Q80 86 88 84 M68 91 Q80 94 92 91" stroke="#8a97bd" stroke-width="2.6" fill="none" stroke-linecap="round"/>
      </g>
      <ellipse cx="46" cy="54" rx="6" ry="3.6" fill="#ff8fb0" opacity=".6"/><ellipse cx="82" cy="54" rx="6" ry="3.6" fill="#ff8fb0" opacity=".6"/>
      <g class="eyes">
        <ellipse cx="54" cy="42" rx="7" ry="8.5" fill="#fff" stroke="${INK}" stroke-width="1.6"/><ellipse cx="74" cy="42" rx="7" ry="8.5" fill="#fff" stroke="${INK}" stroke-width="1.6"/>
        <circle cx="55" cy="43" r="4.8" fill="#1d2a5c"/><circle cx="75" cy="43" r="4.8" fill="#1d2a5c"/>
        <circle cx="56.8" cy="40.8" r="1.9" fill="#fff"/><circle cx="76.8" cy="40.8" r="1.9" fill="#fff"/>
      </g>
      <path d="M60 52 Q64 49.5 68 52 Q66 58.5 64 59.5 Q62 58.5 60 52 Z" fill="url(#mBeak)" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/>
      <ellipse cx="64" cy="51.6" rx="3.2" ry="1.6" fill="#fff" opacity=".9"/>
      <ellipse cx="54" cy="30" rx="10" ry="5" fill="#fff" opacity=".8" transform="rotate(-20 54 30)"/>
    </g></svg>`;

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
