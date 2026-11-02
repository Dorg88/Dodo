/* الصحن: مشهد يرمّمه اللاعب بالنجوم (عمارة فقط — بدون أي تصوير لأشخاص) */
(function () {
  const N = (window.Noor = window.Noor || {});

  N.COURTYARD_ITEMS = [
    { id: 'floor', name: 'بلاط الصحن', cost: 2, desc: 'بلاط بنقوش النجمة الثمانية' },
    { id: 'fountain', name: 'النافورة', cost: 2, desc: 'نافورة الوضوء في وسط الصحن' },
    { id: 'garden', name: 'الحديقة', cost: 3, desc: 'نخيل وأزهار حول الصحن' },
    { id: 'lanterns', name: 'الفوانيس', cost: 3, desc: 'فوانيس تضيء الأروقة ليلاً' },
    { id: 'tiles', name: 'الزخارف القاشانية', cost: 3, desc: 'كاشي أزرق يزيّن الجدران' },
    { id: 'iwan', name: 'الإيوان', cost: 4, desc: 'البوابة الكبرى بمقرنصاتها الذهبية' },
    { id: 'minarets', name: 'المئذنتان', cost: 4, desc: 'مئذنتان شامختان' },
    { id: 'dome', name: 'القبّة الذهبية', cost: 5, desc: 'تاج الصحن المتلألئ' },
  ];

  const S = N.starPoints;

  function palm(x, flip = 1) {
    const f = (dx, dy) => `${x + dx * flip},${dy}`;
    return `<g>
      <path d="M${x} 262 Q${x + 6 * flip} 210 ${x - 2 * flip} 165" stroke="#7a5230" stroke-width="7" fill="none" stroke-linecap="round"/>
      <g fill="#1f8f4e" stroke="#0f5c30" stroke-width="1.5">
        <path d="M${f(-2, 165)} Q${f(-35, 150)} ${f(-48, 180)} Q${f(-28, 160)} ${f(-2, 168)}Z"/>
        <path d="M${f(-2, 165)} Q${f(30, 145)} ${f(46, 172)} Q${f(26, 156)} ${f(-2, 168)}Z"/>
        <path d="M${f(-2, 165)} Q${f(-22, 132)} ${f(-46, 140)} Q${f(-22, 142)} ${f(-2, 166)}Z"/>
        <path d="M${f(-2, 165)} Q${f(20, 130)} ${f(42, 134)} Q${f(20, 140)} ${f(-2, 166)}Z"/>
        <path d="M${f(-2, 165)} Q${f(0, 135)} ${f(-6, 124)} Q${f(4, 138)} ${f(0, 165)}Z"/>
      </g>
      <g fill="#c56a1b"><circle cx="${x - 6 * flip}" cy="170" r="3"/><circle cx="${x + 1 * flip}" cy="172" r="3"/></g>
    </g>`;
  }

  function lantern(x, y) {
    return `<g>
      <line x1="${x}" y1="${y - 18}" x2="${x}" y2="${y - 8}" stroke="#6b4a1a" stroke-width="1.5"/>
      <circle class="glow" cx="${x}" cy="${y + 4}" r="14" fill="#ffd66b" opacity=".35"/>
      <path d="M${x - 5} ${y - 6} L${x} ${y - 10} L${x + 5} ${y - 6}Z" fill="#e0a91f"/>
      <path d="M${x - 6} ${y - 5} H${x + 6} L${x + 8} ${y + 4} L${x + 5} ${y + 13} H${x - 5} L${x - 8} ${y + 4}Z" fill="#ffcf4d" stroke="#8a5a00" stroke-width="1.5"/>
    </g>`;
  }

  function minaret(x) {
    return `<g>
      <rect x="${x - 8}" y="60" width="16" height="152" fill="#efe3c6" stroke="#8b7355" stroke-width="1.5"/>
      <rect x="${x - 8}" y="120" width="16" height="8" fill="#1f8fb0"/>
      <rect x="${x - 8}" y="160" width="16" height="8" fill="#1f8fb0"/>
      <rect x="${x - 13}" y="88" width="26" height="7" rx="2" fill="#e0a91f" stroke="#8a5a00" stroke-width="1"/>
      <rect x="${x - 6}" y="68" width="12" height="20" fill="#1f8fb0" opacity=".85"/>
      <path d="M${x - 9} 60 Q${x - 9} 40 ${x} 28 Q${x + 9} 40 ${x + 9} 60Z" fill="url(#cyGold)" stroke="#8a5a00" stroke-width="1.2"/>
      <line x1="${x}" y1="28" x2="${x}" y2="16" stroke="#c99a1a" stroke-width="2"/>
      <circle cx="${x}" cy="18" r="2.5" fill="#f5c542"/>
    </g>`;
  }

  N.courtyardSVG = function () {
    const niches = [30, 75, 120, 280, 325, 370]
      .map((x) => `<path d="M${x - 14} 212 V172 Q${x - 14} 156 ${x} 150 Q${x + 14} 156 ${x + 14} 172 V212Z" fill="#b89d6e"/>`)
      .join('');
    const nicheFrames = [30, 75, 120, 280, 325, 370]
      .map((x) => `<path d="M${x - 17} 212 V172 Q${x - 17} 153 ${x} 146 Q${x + 17} 153 ${x + 17} 172 V212" fill="none" stroke="#1f8fb0" stroke-width="4"/>`)
      .join('');
    return `<svg class="courtyard" viewBox="0 0 400 300" role="img" aria-label="صحن المقام">
      <defs>
        <linearGradient id="cySky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#14245a"/><stop offset=".55" stop-color="#3b4f9a"/><stop offset="1" stop-color="#f2b06a"/>
        </linearGradient>
        <linearGradient id="cyGold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#fff0a8"/><stop offset=".5" stop-color="#f2c234"/><stop offset="1" stop-color="#b9820f"/>
        </linearGradient>
        <linearGradient id="cyWater" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#8ff0ff"/><stop offset="1" stop-color="#1b9fc0"/>
        </linearGradient>
        <pattern id="cyFloor" width="26" height="26" patternUnits="userSpaceOnUse">
          <rect width="26" height="26" fill="#f2e6cb"/>
          <polygon points="${S(13, 13, 11, 8.4)}" fill="#2a9fb8" opacity=".8"/>
          <polygon points="${S(13, 13, 4.5, 3.4)}" fill="#f5c542"/>
        </pattern>
        <pattern id="cyKashi" width="14" height="14" patternUnits="userSpaceOnUse">
          <rect width="14" height="14" fill="#1e6fa8"/>
          <polygon points="7,1 13,7 7,13 1,7" fill="#5fc4e0"/>
          <circle cx="7" cy="7" r="2" fill="#fff"/>
        </pattern>
      </defs>

      <!-- السماء والأساس (دائماً ظاهر) -->
      <rect width="400" height="300" fill="url(#cySky)"/>
      <g fill="#fff" opacity=".8"><circle cx="40" cy="30" r="1.2"/><circle cx="90" cy="18" r="1"/><circle cx="330" cy="26" r="1.3"/><circle cx="372" cy="58" r="1"/><circle cx="250" cy="14" r="1"/></g>
      <path d="M352 40 A16 16 0 1 0 366 64 A13 13 0 1 1 352 40Z" fill="#fff6d0"/>

      <g data-item="dome">
        <rect x="160" y="96" width="80" height="44" fill="#efe3c6" stroke="#8b7355" stroke-width="1.5"/>
        <g fill="#1f8fb0">${[170, 186, 202, 218].map((x) => `<path d="M${x} 132 V116 Q${x + 6} 106 ${x + 12} 116 V132Z"/>`).join('')}</g>
        <path d="M156 98 C148 70 172 52 200 30 C228 52 252 70 244 98Z" fill="url(#cyGold)" stroke="#8a5a00" stroke-width="1.5"/>
        <path d="M178 90 C176 70 188 56 200 44" stroke="#fff6c0" stroke-width="3" fill="none" opacity=".6"/>
        <line x1="200" y1="30" x2="200" y2="8" stroke="#c99a1a" stroke-width="3"/>
        <circle cx="200" cy="14" r="4" fill="#f5c542"/>
      </g>

      <g data-item="minarets">${minaret(112)}${minaret(288)}</g>

      <!-- الجدار -->
      <rect x="0" y="140" width="400" height="74" fill="#d9c49a" stroke="#8b7355" stroke-width="1"/>
      <path d="M60 160 L66 176 L62 190 M340 170 L334 184" stroke="#8b7355" stroke-width="1" fill="none" opacity=".6"/>
      ${niches}

      <g data-item="tiles">
        <rect x="0" y="140" width="400" height="10" fill="url(#cyKashi)"/>
        <rect x="0" y="206" width="400" height="8" fill="url(#cyKashi)"/>
        ${nicheFrames}
      </g>

      <g data-item="iwan">
        <rect x="158" y="112" width="84" height="102" fill="url(#cyKashi)" stroke="#8a5a00" stroke-width="2"/>
        <rect x="158" y="112" width="84" height="102" fill="none" stroke="url(#cyGold)" stroke-width="5"/>
        <path d="M172 214 V160 Q172 132 200 122 Q228 132 228 160 V214Z" fill="url(#cyGold)" stroke="#8a5a00" stroke-width="1.5"/>
        <path d="M180 214 V162 Q180 140 200 132 Q220 140 220 162 V214Z" fill="#14306b"/>
        <g stroke="#f5c542" stroke-width="1.2" fill="none" opacity=".9">
          <path d="M184 150 Q200 136 216 150"/><path d="M188 142 Q200 132 212 142"/><path d="M186 158 Q200 146 214 158"/>
        </g>
        <polygon points="${S(200, 182, 9, 6.9)}" fill="#f5c542"/>
      </g>

      <g data-item="lanterns">${[30, 75, 120, 280, 325, 370].map((x) => lantern(x, 178)).join('')}${lantern(200, 166)}</g>

      <!-- الأرضية -->
      <rect x="0" y="214" width="400" height="86" fill="#cbb48a"/>
      <g data-item="floor"><rect x="0" y="214" width="400" height="86" fill="url(#cyFloor)"/></g>

      <g data-item="garden">
        ${palm(26, 1)}${palm(374, -1)}
        <g>${[52, 76, 324, 348].map((x) => `<ellipse cx="${x}" cy="262" rx="13" ry="8" fill="#2a9a55"/><circle cx="${x - 5}" cy="258" r="2.5" fill="#ff7aa2"/><circle cx="${x + 4}" cy="257" r="2.5" fill="#fff"/><circle cx="${x}" cy="262" r="2.5" fill="#ffd34d"/>`).join('')}</g>
      </g>

      <g data-item="fountain">
        <ellipse cx="200" cy="266" rx="58" ry="16" fill="#e8dcc0" stroke="#8b7355" stroke-width="2"/>
        <ellipse cx="200" cy="264" rx="50" ry="12" fill="url(#cyWater)"/>
        <rect x="194" y="238" width="12" height="24" fill="#e8dcc0" stroke="#8b7355" stroke-width="1.5"/>
        <ellipse cx="200" cy="238" rx="18" ry="5" fill="#e8dcc0" stroke="#8b7355" stroke-width="1.5"/>
        <g class="jet" stroke="#bff6ff" stroke-width="2.5" fill="none" stroke-linecap="round">
          <path d="M200 236 Q200 214 200 212"/><path d="M200 222 Q188 220 184 236"/><path d="M200 222 Q212 220 216 236"/>
        </g>
      </g>
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
