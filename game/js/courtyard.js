/* الصحن: مشهد نهاري مرح يرمّمه اللاعب بالنجوم (عمارة وحمام فقط — بدون أي تصوير لأشخاص) */
(function () {
  const N = (window.Noor = window.Noor || {});
  const INK = '#2b2250';

  N.COURTYARD_ITEMS = [
    { id: 'floor', name: 'بلاط الصحن', cost: 2, desc: 'بلاط ملوّن بنقوش النجمة', emoji: '🟦' },
    { id: 'fountain', name: 'النافورة', cost: 2, desc: 'نافورة ماء في وسط الصحن', emoji: '⛲' },
    { id: 'garden', name: 'الحديقة', cost: 3, desc: 'نخيل وأزهار ملوّنة', emoji: '🌴' },
    { id: 'lanterns', name: 'الفوانيس', cost: 3, desc: 'فوانيس مضيئة', emoji: '🏮' },
    { id: 'tiles', name: 'الزخارف', cost: 3, desc: 'كاشي أزرق جميل على الجدران', emoji: '✨' },
    { id: 'iwan', name: 'البوابة الذهبية', cost: 4, desc: 'الإيوان الكبير', emoji: '🚪' },
    { id: 'minarets', name: 'المئذنتان', cost: 4, desc: 'مئذنتان عاليتان', emoji: '🗼' },
    { id: 'dome', name: 'القبّة الذهبية', cost: 5, desc: 'القبّة اللامعة', emoji: '🌟' },
  ];

  const S = (cx, cy, R, r, n = 8) => N.starPoints(cx, cy, R, r, n);

  function cloud(x, y, s, cls = '') {
    return `<g class="cloud ${cls}" transform="translate(${x} ${y}) scale(${s})">
      <path d="M0 20 Q-2 6 12 6 Q16 -6 30 -2 Q40 -10 50 2 Q64 0 62 14 Q70 22 58 26 H6 Q-6 26 0 20 Z" fill="#fff" stroke="#bfe3f7" stroke-width="2"/>
    </g>`;
  }

  function dove(x, y, s = 1, flip = 1, cls = '') {
    return `<g class="dove ${cls}" transform="translate(${x} ${y}) scale(${s * flip} ${s})">
      <path d="M-12 2 L-20 -2 L-18 6 Z" fill="#dfe6f2" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>
      <ellipse cx="0" cy="2" rx="12" ry="7.5" fill="#f7f9ff" stroke="${INK}" stroke-width="1.8"/>
      <circle cx="9" cy="-6" r="6.5" fill="#f7f9ff" stroke="${INK}" stroke-width="1.8"/>
      <path class="dwing" d="M-6 0 Q2 -4 8 2 Q2 8 -6 4 Z" fill="#cfd9ea" stroke="${INK}" stroke-width="1.5"/>
      <circle cx="11" cy="-7" r="1.4" fill="${INK}"/>
      <path d="M15 -6 L19 -4.5 L15 -3.5 Z" fill="#ff8a7a"/>
    </g>`;
  }

  function palm(x, flip = 1) {
    const f = (dx, dy) => `${x + dx * flip},${dy}`;
    return `<g>
      <path d="M${x} 270 Q${x + 8 * flip} 215 ${x - 2 * flip} 166" stroke="${INK}" stroke-width="11" fill="none" stroke-linecap="round"/>
      <path d="M${x} 270 Q${x + 8 * flip} 215 ${x - 2 * flip} 166" stroke="#c98a4b" stroke-width="7" fill="none" stroke-linecap="round"/>
      <g fill="#4cd964" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round">
        <path d="M${f(-2, 165)} Q${f(-36, 148)} ${f(-50, 182)} Q${f(-28, 162)} ${f(-2, 170)}Z"/>
        <path d="M${f(-2, 165)} Q${f(32, 142)} ${f(48, 174)} Q${f(26, 158)} ${f(-2, 170)}Z"/>
        <path d="M${f(-2, 165)} Q${f(-24, 130)} ${f(-48, 138)} Q${f(-22, 144)} ${f(-2, 168)}Z"/>
        <path d="M${f(-2, 165)} Q${f(20, 126)} ${f(44, 132)} Q${f(20, 142)} ${f(-2, 168)}Z"/>
      </g>
      <g fill="#ff9f43" stroke="${INK}" stroke-width="1.5"><circle cx="${x - 7 * flip}" cy="172" r="4"/><circle cx="${x + 2 * flip}" cy="174" r="4"/></g>
    </g>`;
  }

  function lantern(x, y) {
    return `<g class="lantern">
      <line x1="${x}" y1="${y - 18}" x2="${x}" y2="${y - 9}" stroke="${INK}" stroke-width="1.8"/>
      <circle class="glow" cx="${x}" cy="${y + 3}" r="15" fill="#ffe066" opacity=".45"/>
      <path d="M${x - 6} ${y - 6} L${x} ${y - 11} L${x + 6} ${y - 6}Z" fill="#ff6b81" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>
      <path d="M${x - 7} ${y - 5} H${x + 7} L${x + 9} ${y + 4} L${x + 6} ${y + 14} H${x - 6} L${x - 9} ${y + 4}Z" fill="#ffd23f" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/>
    </g>`;
  }

  function minaret(x) {
    return `<g>
      <rect x="${x - 9}" y="62" width="18" height="150" rx="2" fill="#fff4dc" stroke="${INK}" stroke-width="2.5"/>
      <rect x="${x - 9}" y="120" width="18" height="9" fill="#3db8f5" stroke="${INK}" stroke-width="2"/>
      <rect x="${x - 9}" y="162" width="18" height="9" fill="#3db8f5" stroke="${INK}" stroke-width="2"/>
      <rect x="${x - 15}" y="90" width="30" height="8" rx="4" fill="#ffc21a" stroke="${INK}" stroke-width="2"/>
      <path d="M${x - 10} 62 Q${x - 10} 40 ${x} 26 Q${x + 10} 40 ${x + 10} 62Z" fill="url(#cyGold)" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>
      <line x1="${x}" y1="26" x2="${x}" y2="13" stroke="${INK}" stroke-width="2.5"/>
      <circle cx="${x}" cy="13" r="3.5" fill="#ffc21a" stroke="${INK}" stroke-width="1.5"/>
    </g>`;
  }

  N.courtyardSVG = function () {
    const xs = [30, 75, 120, 280, 325, 370];
    const niches = xs
      .map((x) => `<path d="M${x - 14} 214 V174 Q${x - 14} 158 ${x} 151 Q${x + 14} 158 ${x + 14} 174 V214Z" fill="#7fd0f5" stroke="${INK}" stroke-width="2"/>`)
      .join('');
    const nicheFrames = xs
      .map((x) => `<path d="M${x - 18} 214 V173 Q${x - 18} 153 ${x} 145 Q${x + 18} 153 ${x + 18} 173 V214" fill="none" stroke="#2f7fe0" stroke-width="5"/>`)
      .join('');
    return `<svg class="courtyard" viewBox="0 0 400 300" role="img" aria-label="صحن المقام">
      <defs>
        <linearGradient id="cySky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#4fc3ff"/><stop offset=".6" stop-color="#a6e6ff"/><stop offset="1" stop-color="#fff2c9"/>
        </linearGradient>
        <linearGradient id="cyGold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#fff3a8"/><stop offset=".5" stop-color="#ffc21a"/><stop offset="1" stop-color="#e09200"/>
        </linearGradient>
        <linearGradient id="cyWater" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#9ff0ff"/><stop offset="1" stop-color="#2b9cf0"/>
        </linearGradient>
        <pattern id="cyFloor" width="28" height="28" patternUnits="userSpaceOnUse">
          <rect width="28" height="28" fill="#fff6e3"/>
          <polygon points="${S(14, 14, 12, 9.2)}" fill="#3db8f5" stroke="#1f6fbf" stroke-width="1"/>
          <polygon points="${S(14, 14, 5, 3.8)}" fill="#ffc21a"/>
          <circle cx="0" cy="0" r="3" fill="#ff6b81"/><circle cx="28" cy="0" r="3" fill="#ff6b81"/><circle cx="0" cy="28" r="3" fill="#ff6b81"/><circle cx="28" cy="28" r="3" fill="#ff6b81"/>
        </pattern>
        <pattern id="cyKashi" width="16" height="16" patternUnits="userSpaceOnUse">
          <rect width="16" height="16" fill="#2f7fe0"/>
          <polygon points="8,1 15,8 8,15 1,8" fill="#7fe0ff"/>
          <circle cx="8" cy="8" r="2.4" fill="#fff"/>
        </pattern>
      </defs>

      <!-- السماء والشمس والغيوم (دائماً ظاهرة) -->
      <rect width="400" height="300" fill="url(#cySky)"/>
      <g class="sun">
        <g class="rays" stroke="#ffc21a" stroke-width="5" stroke-linecap="round">
          ${Array.from({ length: 10 }, (_, i) => {
            const a = (i * Math.PI) / 5;
            return `<line x1="${352 + 30 * Math.cos(a)}" y1="${48 + 30 * Math.sin(a)}" x2="${352 + 40 * Math.cos(a)}" y2="${48 + 40 * Math.sin(a)}"/>`;
          }).join('')}
        </g>
        <circle cx="352" cy="48" r="23" fill="#ffd23f" stroke="${INK}" stroke-width="2.5"/>
        <circle cx="344" cy="45" r="2.6" fill="${INK}"/><circle cx="360" cy="45" r="2.6" fill="${INK}"/>
        <path d="M344 54 Q352 61 360 54" stroke="${INK}" stroke-width="2.5" fill="none" stroke-linecap="round"/>
        <ellipse cx="338" cy="52" rx="4" ry="2.4" fill="#ff8fa3" opacity=".7"/><ellipse cx="366" cy="52" rx="4" ry="2.4" fill="#ff8fa3" opacity=".7"/>
      </g>
      ${cloud(20, 30, 0.9, 'c1')}${cloud(150, 12, 0.6, 'c2')}${cloud(250, 70, 0.55, 'c3')}

      <g data-item="dome">
        <rect x="158" y="96" width="84" height="46" fill="#fff4dc" stroke="${INK}" stroke-width="2.5"/>
        <g fill="#3db8f5" stroke="${INK}" stroke-width="1.8">${[168, 185, 202, 219].map((x) => `<path d="M${x} 134 V117 Q${x + 6.5} 106 ${x + 13} 117 V134Z"/>`).join('')}</g>
        <path d="M154 98 C146 70 172 50 200 28 C228 50 254 70 246 98Z" fill="url(#cyGold)" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
        <path d="M176 88 C174 70 186 56 199 44" stroke="#fffbe0" stroke-width="5" fill="none" stroke-linecap="round" opacity=".8"/>
        <line x1="200" y1="28" x2="200" y2="8" stroke="${INK}" stroke-width="3"/>
        <circle cx="200" cy="12" r="5" fill="#ffc21a" stroke="${INK}" stroke-width="2"/>
      </g>

      <g data-item="minarets">${minaret(110)}${minaret(290)}</g>

      <!-- الجدار -->
      <rect x="-4" y="140" width="408" height="76" fill="#ffe2b0" stroke="${INK}" stroke-width="2.5"/>
      ${niches}

      <g data-item="tiles">
        <rect x="-4" y="140" width="408" height="11" fill="url(#cyKashi)" stroke="${INK}" stroke-width="2"/>
        <rect x="-4" y="206" width="408" height="9" fill="url(#cyKashi)" stroke="${INK}" stroke-width="2"/>
        ${nicheFrames}
      </g>

      <g data-item="iwan">
        <rect x="156" y="110" width="88" height="106" rx="3" fill="url(#cyKashi)" stroke="${INK}" stroke-width="3"/>
        <path d="M170 216 V160 Q170 130 200 119 Q230 130 230 160 V216Z" fill="url(#cyGold)" stroke="${INK}" stroke-width="2.5"/>
        <path d="M179 216 V162 Q179 140 200 131 Q221 140 221 162 V216Z" fill="#7a5cff" stroke="${INK}" stroke-width="2"/>
        <polygon points="${S(200, 175, 11, 8.4)}" fill="#ffd23f" stroke="${INK}" stroke-width="1.5"/>
      </g>

      <g data-item="lanterns">${xs.map((x) => lantern(x, 180)).join('')}${lantern(200, 168)}</g>

      <!-- الأرضية -->
      <rect x="-4" y="214" width="408" height="90" fill="#f4dcae" stroke="${INK}" stroke-width="2.5"/>
      <g data-item="floor"><rect x="-4" y="214" width="408" height="90" fill="url(#cyFloor)" stroke="${INK}" stroke-width="2.5"/></g>

      <g data-item="garden">
        ${palm(26, 1)}${palm(374, -1)}
        <g>${[54, 80, 320, 346].map((x, i) => `<ellipse cx="${x}" cy="266" rx="15" ry="9" fill="#4cd964" stroke="${INK}" stroke-width="2"/>
          <circle cx="${x - 6}" cy="261" r="4" fill="${['#ff6b81', '#ffd23f', '#a66cff', '#ff9f43'][i]}" stroke="${INK}" stroke-width="1.4"/>
          <circle cx="${x + 5}" cy="259" r="4" fill="#fff" stroke="${INK}" stroke-width="1.4"/>
          <circle cx="${x}" cy="266" r="3.4" fill="${['#ffd23f', '#ff6b81', '#3db8f5', '#ff6b81'][i]}" stroke="${INK}" stroke-width="1.4"/>`).join('')}</g>
      </g>

      <g data-item="fountain">
        <ellipse cx="200" cy="268" rx="60" ry="17" fill="#fff4dc" stroke="${INK}" stroke-width="3"/>
        <ellipse cx="200" cy="266" rx="51" ry="12" fill="url(#cyWater)"/>
        <rect x="193" y="238" width="14" height="26" fill="#fff4dc" stroke="${INK}" stroke-width="2.2"/>
        <ellipse cx="200" cy="238" rx="20" ry="6" fill="#fff4dc" stroke="${INK}" stroke-width="2.2"/>
        <g class="jet" stroke="#4fc3ff" stroke-width="3.5" fill="none" stroke-linecap="round">
          <path d="M200 234 Q200 212 200 210"/><path d="M200 220 Q186 218 182 236"/><path d="M200 220 Q214 218 218 236"/>
        </g>
      </g>

      <!-- الحمام (دائماً ظاهر) -->
      ${dove(62, 133, 1, 1, 'd1')}${dove(338, 133, 1, -1, 'd2')}
      ${dove(0, 0, 0.8, 1, 'flying')}
    </svg>`;
  };

  /** يطبّق حالة الترميم على المشهد */
  N.applyCourtyard = function (svgEl, restored, justRestored) {
    const next = N.COURTYARD_ITEMS.find((it) => !restored.includes(it.id));
    svgEl.querySelectorAll('[data-item]').forEach((g) => {
      const id = g.getAttribute('data-item');
      const done = restored.includes(id);
      g.classList.toggle('ruined', !done);
      g.classList.toggle('next', !done && next && next.id === id);
      g.classList.toggle('restored-now', id === justRestored);
    });
  };
})();
