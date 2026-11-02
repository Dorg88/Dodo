/* واجهة اللعبة: الشاشات، بنك الأسئلة، المساعدات، الفوز والخسارة */
(function () {
  const N = window.Noor;
  const $ = (s) => document.querySelector(s);
  const ar = N.ar;

  const ICON = N.ICON;
  // لون ورمز لكل قسم في بنك الأسئلة
  const CAT_STYLE = {
    quran: ['📖', '#3d9bff'], prophet: ['🌙', '#2fbf71'], masumeen: ['✨', '#a66cff'], aqeedah: ['💡', '#ffa41b'],
    fiqh: ['🕋', '#ff5c7a'], akhlaq: ['💖', '#ff7ab6'], duas: ['🤲', '#22b8a5'], history: ['📜', '#ff8a3d'],
    places: ['🕌', '#5b7cff'], occasions: ['🎉', '#e8559a'],
  };
  const CHAPTER_COLORS = ['#3d9bff', '#2fbf71', '#a66cff', '#ffa41b', '#ff5c7a', '#22b8a5'];

  /** الحمامة «نوري» مع فقاعة كلام اختيارية */
  function mascot(mood = 'happy', text = '', cls = '') {
    return `<div class="mascot-wrap ${cls}">${text ? `<div class="speech">${text}</div>` : ''}<div class="mascot ${mood}">${N.MASCOT_SVG}</div></div>`;
  }

  /** قصاصات ملوّنة تتساقط احتفالاً */
  function confetti(n = 70) {
    const box = document.createElement('div');
    box.className = 'confetti';
    const cols = N.TILE_COLORS.concat(['#ffffff', '#ff7ab6']);
    for (let i = 0; i < n; i++) {
      const p = document.createElement('i');
      p.style.left = Math.random() * 100 + '%';
      p.style.background = cols[i % cols.length];
      p.style.animationDelay = Math.random() * 0.5 + 's';
      p.style.animationDuration = 1.6 + Math.random() * 1.4 + 's';
      p.style.setProperty('--dx', Math.random() * 160 - 80 + 'px');
      p.style.setProperty('--r', Math.random() * 900 - 450 + 'deg');
      if (i % 3 === 0) p.classList.add('round');
      box.appendChild(p);
    }
    document.body.appendChild(box);
    setTimeout(() => box.remove(), 3600);
  }

  /** عبارة تشجيع كبيرة فوق اللوحة */
  function praise(text) {
    const host = $('#screen-game');
    const el = document.createElement('div');
    el.className = 'praise-pop';
    el.textContent = text;
    host.appendChild(el);
    setTimeout(() => el.remove(), 1300);
  }

  const BOOSTERS = [
    { id: 'hammer', name: 'المطرقة', desc: 'تزيل قطعة واحدة تختارها' },
    { id: 'arrow', name: 'السهم', desc: 'يمسح صفاً كاملاً تختاره' },
    { id: 'shuffle', name: 'الخلط', desc: 'يعيد ترتيب القطع' },
  ];
  const DIFF_NAMES = { 1: 'سهل', 2: 'متوسط', 3: 'صعب' };
  const LETTERS = ['أ', 'ب', 'ج', 'د'];

  let G = null; // حالة المستوى الجاري
  let bankReturn = null; // إلى أين نعود من بنك الأسئلة
  let bankDifficulty = 1;

  /* ---------- أدوات الواجهة ---------- */
  function show(name) {
    document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === 'screen-' + name));
    window.scrollTo(0, 0);
  }

  let toastTimer;
  function toast(html, ms = 1700) {
    const t = $('#toast');
    t.innerHTML = html;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), ms);
  }

  function openModal(html, cls = '') {
    const m = $('#modal');
    m.querySelector('.modal-card').className = 'modal-card ' + cls;
    m.querySelector('.modal-card').innerHTML = html;
    m.classList.remove('hidden');
    N.sfx.popup();
    return m.querySelector('.modal-card');
  }
  function closeModal() {
    $('#modal').classList.add('hidden');
  }

  function refreshPoints() {
    document.querySelectorAll('[data-points]').forEach((e) => (e.textContent = ar(N.save.points)));
    document.querySelectorAll('[data-stars]').forEach((e) => (e.textContent = ar(N.save.stars)));
    if (G) renderBoosters();
  }

  /* ---------- نافذة السؤال ---------- */
  /** يعرض سؤالاً ويعيد {correct, points, bonus, action} */
  function askQuestion({ q, categories, maxDifficulty = 3, title = '', subtitle = '', award = true, buttons = null }) {
    q = q || N.Quiz.pick({ categories, maxDifficulty });
    if (!q) return Promise.resolve({ correct: false, points: 0, bonus: 0, action: 'none' });
    buttons = buttons || [{ id: 'ok', label: 'متابعة', primary: true }];
    const options = N.Quiz.options(q);
    return new Promise((resolve) => {
      const card = openModal(
        `<div class="q-top">
           <span class="chip">${N.CATEGORIES[q.category] || ''}</span>
           <span class="diff d${q.difficulty}">${DIFF_NAMES[q.difficulty] || ''} (+${ar(N.POINTS_BY_DIFFICULTY[q.difficulty] || 1)})</span>
         </div>
         ${title ? `<h3 class="q-title">${title}</h3>` : ''}
         ${subtitle ? `<p class="q-sub">${subtitle}</p>` : ''}
         <p class="q-text">${q.question}</p>
         <div class="q-options">${options
           .map((o, i) => `<button class="opt c${i}" data-i="${i}"><span class="letter">${LETTERS[i]}</span><span>${o.text}</span></button>`)
           .join('')}</div>
         <div class="q-feedback"></div>
         <div class="q-actions"></div>`,
        'qcard'
      );
      let result = null;
      card.querySelectorAll('.opt').forEach((btn) =>
        btn.addEventListener('click', () => {
          if (result) return;
          const chosen = options[+btn.dataset.i];
          const correct = chosen.correct;
          result = award ? N.Quiz.answerForPoints(q, correct) : (N.Quiz.record(q, correct), { points: 0, bonus: 0 });
          result.correct = correct;
          card.querySelectorAll('.opt').forEach((b, i) => {
            b.disabled = true;
            if (options[i].correct) b.classList.add('right');
            else if (b === btn) b.classList.add('wrong');
            else b.classList.add('dim');
          });
          if (correct) {
            N.sfx.correct();
            N.vibrate(20);
            confetti(45);
            if (award && result.points) setTimeout(() => N.sfx.coin(), 350);
          } else N.sfx.wrong();
          const gain = correct && award ? `<span class="gain">${ICON.points} +${ar(result.points)}${result.bonus ? ` – مكافأة السلسلة +${ar(result.bonus)}` : ''}</span>` : '';
          card.querySelector('.q-feedback').innerHTML = `
            <div class="fb ${correct ? 'ok' : 'no'}">
              ${mascot(correct ? 'happy' : 'sad', correct ? 'أحسنت! 🎉' : 'لا بأس، هكذا نتعلّم! 💪', 'mini')}
              <b>${correct ? 'إجابة صحيحة!' : 'الإجابة الصحيحة باللون الأخضر'}</b> ${gain}
              <p>${q.explanation || ''}</p>
              ${q.source ? `<small>المصدر: ${q.source}</small>` : ''}
            </div>`;
          const acts = card.querySelector('.q-actions');
          acts.innerHTML = buttons.map((b) => `<button class="btn ${b.primary ? 'primary' : 'ghost'}" data-a="${b.id}">${b.label}</button>`).join('');
          acts.querySelectorAll('button').forEach((b) =>
            b.addEventListener('click', () => {
              closeModal();
              refreshPoints();
              resolve(Object.assign({ action: b.dataset.a }, result));
            })
          );
          card.querySelector('.q-feedback').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        })
      );
    });
  }

  /* ---------- الشاشة الرئيسية (الصحن) ---------- */
  function renderHome(justRestored) {
    $('#courtyard').innerHTML || ($('#courtyard').innerHTML = N.courtyardSVG());
    N.applyCourtyard($('#courtyard svg'), N.save.restored, justRestored);
    refreshPoints();

    const items = N.COURTYARD_ITEMS;
    const next = items.find((it) => !N.save.restored.includes(it.id));
    const done = N.save.restored.length;
    const card = $('#restore-card');
    if (!next) {
      card.innerHTML = `${mascot('happy', '', 'tiny')}<div class="rc-text"><b>اكتمل الصحن — ما شاء الله! 🎉</b><small>رمّمت ${ar(done)} من ${ar(items.length)} – مراحل جديدة قريباً</small></div>`;
    } else {
      const can = N.save.stars >= next.cost;
      card.innerHTML = `
        ${mascot('happy', '', 'tiny')}
        <div class="rc-text"><b>${can ? 'هيا نرمّم' : 'اجمع النجوم لترميم'} ${next.name} ${next.emoji}</b><small>${can ? 'عندك نجوم كافية!' : 'العب المستويات لتكسب النجوم ⭐'} – ${ar(done)} من ${ar(items.length)}</small></div>
        <button class="btn ${can ? 'gold pulse' : 'disabled'}" id="btn-restore">${ICON.star} ${ar(next.cost)}</button>`;
      $('#btn-restore').onclick = () => {
        if (N.save.stars < next.cost) return toast('تحتاج نجوماً أكثر — العب المستويات لتكسبها');
        N.save.stars -= next.cost;
        N.save.restored.push(next.id);
        N.persist();
        N.sfx.star();
        renderHome(next.id);
        toast(`تم ترميم ${next.name} ✨`);
        confetti(60);
      };
    }

    const cur = Math.min(N.save.unlocked, N.LEVELS.length);
    const allDone = N.save.unlocked > N.LEVELS.length;
    $('#btn-play').innerHTML = allDone ? 'أتممت كل المستويات! 🏆' : `<small>العب</small> المستوى ${ar(cur)}`;
    $('#btn-play').onclick = () => (allDone ? renderMap() : startLevel(cur));
    $('#daily-dot').classList.toggle('hidden', N.save.daily.last === N.todayKey());
    show('home');
    N.music.play('menu');
  }

  /* ---------- الخريطة ---------- */
  function renderMap() {
    const ROW = 96;
    const XS = [50, 76, 50, 24];
    const html = N.CHAPTERS.map((ch, ci) => {
      const levels = N.LEVELS.filter((l) => l.chapter === ch.id);
      const pts = levels.map((l, i) => [XS[i % XS.length], i * ROW + ROW / 2]);
      const d = pts.map(([x, y], i) => (i ? `C${pts[i - 1][0]} ${y - ROW / 2}, ${x} ${pts[i - 1][1] + ROW / 2}, ${x} ${y}` : `M${x} ${y}`)).join(' ');
      const nodes = levels
        .map((l, i) => {
          const locked = l.id > N.save.unlocked;
          const current = l.id === N.save.unlocked;
          const st = N.save.levelStars[l.id] || 0;
          const cls = locked ? 'locked' : current ? 'current' : 'done';
          return `<button class="node ${cls}" data-l="${l.id}" style="left:${pts[i][0]}%;top:${pts[i][1]}px" ${locked ? 'disabled' : ''}>
              <span class="num">${locked ? '🔒' : ar(l.id)}</span>
              ${locked ? '' : `<i class="nstars">${[1, 2, 3].map((k) => `<em class="${k <= st ? 'on' : ''}">★</em>`).join('')}</i>`}
              ${current ? mascot('happy', '', 'here') : ''}
            </button>`;
        })
        .join('');
      return `<section class="chapter" style="--chc:${CHAPTER_COLORS[ci % CHAPTER_COLORS.length]}">
        <div class="ch-banner"><small>الفصل ${ar(ch.id)}</small><b>${ch.name}</b></div>
        <div class="path" style="height:${levels.length * ROW}px">
          <svg viewBox="0 0 100 ${levels.length * ROW}" preserveAspectRatio="none" aria-hidden="true">
            <path d="${d}" fill="none" stroke="rgba(255,255,255,.9)" stroke-width="10" stroke-linecap="round" stroke-dasharray="2 16" vector-effect="non-scaling-stroke"/>
          </svg>
          ${nodes}
        </div>
      </section>`;
    }).join('');
    $('#map-list').innerHTML = html;
    $('#map-list').querySelectorAll('.node:not(.locked)').forEach((b) => (b.onclick = () => startLevel(+b.dataset.l)));
    show('map');
    N.music.play('menu');
    const cur = $('#map-list .node.current');
    if (cur) cur.scrollIntoView({ block: 'center' });
  }

  /* ---------- بنك الأسئلة ---------- */
  function openBank(fromGame = false) {
    bankReturn = fromGame ? 'game' : 'home';
    $('#bank-back').textContent = fromGame ? 'العودة إلى اللعب ←' : 'رجوع ←';
    renderBank();
    show('bank');
    if (!fromGame) N.music.play('menu');
  }

  function renderBank() {
    refreshPoints();
    const stats = N.Quiz.categoryStats();
    const due = N.Quiz.dueCount();
    $('#bank-prices').innerHTML = `
      <span class="price">+${ar(N.EXTRA_MOVES)} حركات = ${ICON.points}${ar(N.COSTS.moves)}</span>
      ${BOOSTERS.map((b) => `<span class="price">${ICON[b.id]} ${b.name} = ${ICON.points}${ar(N.COSTS[b.id])}</span>`).join('')}`;
    $('#bank-diff').innerHTML = [1, 2, 3]
      .map((d) => `<button class="seg ${d === bankDifficulty ? 'on' : ''}" data-d="${d}">${DIFF_NAMES[d]} <small>+${ar(N.POINTS_BY_DIFFICULTY[d])}</small></button>`)
      .join('');
    $('#bank-diff').querySelectorAll('.seg').forEach((b) => (b.onclick = () => ((bankDifficulty = +b.dataset.d), renderBank())));
    $('#bank-streak').innerHTML = `سلسلة الإجابات الصحيحة: <b>${ar(N.save.answerStreak)}</b> — كل ٣ إجابات متتالية تمنحك نقطة إضافية`;

    const cards = [
      `<button class="cat special" data-c="mixed" style="--cc:#ff5c7a"><span class="cat-emoji">🎲</span><b>أسئلة متنوعة</b><small>من جميع الأقسام</small></button>`,
      `<button class="cat special ${due ? '' : 'muted'}" data-c="review" style="--cc:#ffa41b"><span class="cat-emoji">🔁</span><b>مراجعة أخطائي</b><small>${due ? ar(due) + ' سؤال للمراجعة' : 'لا توجد أخطاء بعد'}</small></button>`,
      ...Object.entries(N.CATEGORIES).map(([id, name]) => {
        const s = stats[id] || { total: 0, learned: 0 };
        const pct = s.total ? Math.round((s.learned / s.total) * 100) : 0;
        const [emo, col] = CAT_STYLE[id] || ['⭐', '#3d9bff'];
        return `<button class="cat" data-c="${id}" style="--cc:${col}" ${s.total ? '' : 'disabled'}>
          <span class="cat-emoji">${emo}</span><b>${name}</b><small>تعلّمت ${ar(s.learned)} من ${ar(s.total)}</small>
          <span class="bar"><span style="width:${pct}%"></span></span></button>`;
      }),
    ];
    $('#bank-cats').innerHTML = cards.join('');
    $('#bank-cats').querySelectorAll('.cat:not([disabled])').forEach((b) => (b.onclick = () => runBank(b.dataset.c)));
  }

  async function runBank(cat) {
    while (true) {
      let q;
      if (cat === 'review') {
        q = N.Quiz.pick({ only: (x) => (N.Quiz.stat(x.id) || {}).due });
        if (!q) {
          toast('لا توجد أسئلة للمراجعة — أحسنت!');
          break;
        }
      } else {
        const categories = cat === 'mixed' ? null : [cat];
        q = N.Quiz.pick({ categories, only: (x) => x.difficulty === bankDifficulty }) || N.Quiz.pick({ categories });
      }
      if (!q) break;
      const backLabel = bankReturn === 'game' ? 'العودة إلى اللعب' : 'رجوع';
      const res = await askQuestion({
        q,
        buttons: [
          { id: 'next', label: 'سؤال آخر', primary: true },
          { id: 'back', label: backLabel },
        ],
      });
      renderBank();
      if (res.action === 'back') {
        if (bankReturn === 'game') return leaveBank();
        break;
      }
    }
  }

  function leaveBank() {
    if (bankReturn === 'game' && G) {
      show('game');
      refreshPoints();
      if (G.board.moves <= 0 && !G.board.ended) showOutOfMoves();
    } else renderHome();
  }

  /* ---------- سؤال اليوم ---------- */
  function dayKey(offset) {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  }

  async function daily() {
    const today = N.todayKey();
    const dd = N.save.daily;
    if (dd.last === today) {
      openModal(`<h3>سؤال اليوم</h3><p>أجبت عن سؤال اليوم. عُد غداً لسؤال جديد!</p>
        <p class="big">🔥 ${ar(dd.streak)} ${dd.streak > 2 ? 'أيام' : 'يوم'} متتالية</p>
        <div class="q-actions"><button class="btn primary" id="m-ok">حسناً</button></div>`);
      $('#m-ok').onclick = closeModal;
      return;
    }
    const res = await askQuestion({ q: N.Quiz.dailyQuestion(), title: 'سؤال اليوم', subtitle: 'إجابة صحيحة = نقاط السؤال + ٢ نقطة مكافأة يومية' });
    dd.streak = dd.last === dayKey(-1) ? dd.streak + 1 : 1;
    dd.last = today;
    if (res.correct) N.save.points += 2;
    N.persist();
    toast(res.correct ? `${ICON.points} +٢ مكافأة سؤال اليوم – 🔥 ${ar(dd.streak)}` : `🔥 ${ar(dd.streak)} — حاول غداً`);
    renderHome();
  }

  /* ---------- الإعدادات ---------- */
  function settings() {
    const card = openModal(`<h3>الإعدادات</h3>
      <label class="row-set"><span>🎵 الموسيقى</span><input type="checkbox" id="set-music" ${N.save.music ? 'checked' : ''}></label>
      <label class="row-set"><span>🔊 المؤثرات الصوتية</span><input type="checkbox" id="set-sound" ${N.save.sound ? 'checked' : ''}></label>
      <div class="about">
        <b>عن اللعبة</b>
        <p>«نور المعرفة» لعبة مطابقة تعليمية على نهج أهل البيت (ع). لا توجد مشتريات داخل اللعبة: كل المساعدات تُكسب بالإجابة عن الأسئلة.</p>
        <p class="credit">إصدار: <b>شعبة البحوث والدراسات — قسم الشؤون الدينية</b><br>الأمانة العامة للعتبة الحسينية المقدسة</p>
        <p class="warn">الأسئلة الحالية نسخة أولية (${ar(N.Quiz.bank.length)} سؤالاً) وتحتاج إلى مراجعة علمية قبل النشر.</p>
      </div>
      <div class="q-actions">
        <button class="btn primary" id="set-close">إغلاق</button>
        <button class="btn danger" id="set-reset">مسح التقدم</button>
      </div>`);
    card.querySelector('#set-sound').onchange = (e) => {
      N.save.sound = e.target.checked;
      N.persist();
      N.sfx.tap();
    };
    card.querySelector('#set-music').onchange = (e) => N.music.setEnabled(e.target.checked);
    card.querySelector('#set-close').onclick = closeModal;
    card.querySelector('#set-reset').onclick = () => {
      if (!confirm('هل تريد مسح كل التقدم؟')) return;
      N.resetSave();
      closeModal();
      renderHome();
    };
  }

  /* ---------- المستوى ---------- */
  function goalHTML(g, withNeed = false) {
    const done = g.left <= 0;
    return `<div class="goal ${done ? 'done' : ''}"><span class="gi">${N.tileIcon(g.type)}</span><b>${done ? '✓' : ar(withNeed ? g.need : g.left)}</b></div>`;
  }

  function startLevel(id) {
    const level = N.levelById(id);
    if (!level) return;
    const ch = N.chapterOf(level);
    const goals = level.goals.map((g) => ({ type: g.type, need: g.count, left: g.count }));
    const dust = level.layout.join('').split('').reduce((a, ch2) => a + (ch2 === 'd' ? 1 : ch2 === 'D' ? 2 : 0), 0);
    if (dust) goals.push({ type: 'dust', need: dust, left: dust });
    const tutorial =
      id <= 2
        ? `<div class="tips">
            <p>👆 اسحب القطعة نحو جارتها لتجمع <b>٣ قطع متشابهة</b> أو أكثر.</p>
            <p>🚀 ٤ قطع في خط = <b>سهم</b></p>
            <p>💥 قطع على شكل زاوية = <b>انفجار</b></p>
            <p>🌈 ٥ قطع في خط = <b>كرة النور</b></p>
            <p>❓ القطعة التي عليها <b class="qmark">؟</b> تسألك سؤالاً، وإذا أجبت صحيحاً تربح هدية!</p>
            <p>💡 علِقت؟ اذهب إلى <b>بنك الأسئلة</b> واجمع النقاط.</p>
          </div>`
        : dust
          ? `<div class="tips"><p>🫧 فرقِع <b>الفقاعات</b> بمطابقة القطع فوقها!</p></div>`
          : '';
    const card = openModal(
      `${mascot('happy', id === 1 ? 'أهلاً! أنا نوري 🕊️ هيا نلعب!' : 'هل أنت مستعد؟ 😄', 'top')}
       <div class="lvl-head"><small>الفصل ${ar(ch.id)} – ${ch.name}</small><h2>المستوى ${ar(id)}</h2></div>
       <p class="lbl">اجمع:</p>
       <div class="goals big">${goals.map((g) => goalHTML(g, true)).join('')}</div>
       <p class="lbl moves-lbl">في ${ar(level.moves)} حركة</p>
       ${tutorial}
       <div class="q-actions"><button class="btn play" id="lvl-go">ابدأ</button><button class="btn ghost" id="lvl-cancel">رجوع</button></div>`,
      'lvlcard'
    );
    card.querySelector('#lvl-cancel').onclick = closeModal;
    card.querySelector('#lvl-go').onclick = () => {
      closeModal();
      N.sfx.start();
      playLevel(level);
    };
  }

  function playLevel(level) {
    if (G) G.board.destroy();
    show('game');
    N.music.play('game');
    $('#hud-level').textContent = 'المستوى ' + ar(level.id);
    const ch = N.chapterOf(level);
    const board = new N.Board($('#board-host'), level, {
      onUpdate: renderHUD,
      onPraise: praise,
      askKnowledge: async () => {
        const r = await askQuestion({
          categories: ch.categories,
          maxDifficulty: ch.maxDifficulty,
          title: 'قطعة المعرفة!',
          subtitle: 'أجب صحيحاً لتحصل على شعاع نور يمسح صفاً + حركة إضافية',
        });
        return r.correct;
      },
      onWin: (info) => showWin(level, info),
      onOutOfMoves: showOutOfMoves,
      onBoosterUsed: renderBoosters,
    });
    G = { board, level, chapter: ch, bonusTried: false, earned: 0 };
    renderHUD(board);
    renderBoosters();
  }

  function renderHUD(board) {
    $('#hud-moves').textContent = ar(Math.max(0, board.moves));
    $('#hud-moves').parentElement.classList.toggle('low', board.moves <= 3);
    $('#hud-goals').innerHTML = board.goals.map((g) => goalHTML(g)).join('');
  }

  function renderBoosters() {
    if (!G) return;
    $('#boosters').innerHTML =
      BOOSTERS.map(
        (b) => `<button class="booster ${G.board.mode === b.id ? 'active' : ''} ${N.save.points < N.COSTS[b.id] ? 'poor' : ''}" data-b="${b.id}" title="${b.desc}">
          ${ICON[b.id]}<span>${b.name}</span><small>${ICON.points}${ar(N.COSTS[b.id])}</small></button>`
      ).join('') +
      `<button class="booster bank" id="btn-bank-game">${ICON.points}<span>بنك الأسئلة</span><small data-points>${ar(N.save.points)}</small></button>`;
    $('#boosters').querySelectorAll('[data-b]').forEach((b) => (b.onclick = () => useBooster(b.dataset.b)));
    $('#btn-bank-game').onclick = () => {
      if (G.board.busy) return;
      if (G.board.mode) refundMode();
      openBank(true);
    };
  }

  function refundMode() {
    const kind = G.board.cancelMode();
    if (kind) {
      N.save.points += N.COSTS[kind];
      N.persist();
    }
  }

  function useBooster(kind) {
    const b = G.board;
    if (b.busy || b.ended || b.moves <= 0) return;
    if (b.mode === kind) {
      refundMode();
      renderBoosters();
      return toast('أُلغي المعزّز');
    }
    if (b.mode) refundMode();
    const cost = N.COSTS[kind];
    if (N.save.points < cost) return needPoints(cost);
    N.save.points -= cost;
    N.persist();
    if (kind === 'shuffle') {
      b.boosterShuffle();
      refreshPoints();
      return;
    }
    b.enterMode(kind);
    refreshPoints();
    toast(kind === 'hammer' ? 'اختر القطعة التي تريد إزالتها' : 'اختر قطعة في الصف الذي تريد مسحه');
  }

  function needPoints(cost) {
    const card = openModal(`${mascot('sad', 'نحتاج نقاطاً أكثر! 💡', 'top')}<h3>النقاط لا تكفي</h3>
      <p>تحتاج ${ICON.points}${ar(cost)} — رصيدك ${ICON.points}${ar(N.save.points)}</p>
      <p>أجب عن أسئلة في بنك الأسئلة لتكسب النقاط، ثم عُد لإكمال المستوى من حيث توقفت.</p>
      <div class="q-actions"><button class="btn primary" id="m-bank">اذهب إلى بنك الأسئلة</button><button class="btn ghost" id="m-cancel">إلغاء</button></div>`);
    card.querySelector('#m-bank').onclick = () => {
      closeModal();
      openBank(true);
    };
    card.querySelector('#m-cancel').onclick = closeModal;
  }

  function showOutOfMoves() {
    const b = G.board;
    N.sfx.lose();
    const cost = N.COSTS.moves;
    const can = N.save.points >= cost;
    const card = openModal(`${mascot('sad', 'لا تقلق! يمكنك أن تكمل 💪', 'top')}
      <h3>انتهت الحركات!</h3>
      <p class="center">بقي عليك:</p>
      <div class="goals big">${b.goals.filter((g) => g.left > 0).map((g) => goalHTML(g)).join('')}</div>
      <p class="hint-text">استخدم نقاط المعرفة 💡 لتكمل، أو اجمعها من بنك الأسئلة.</p>
      <div class="q-actions col">
        <button class="btn ${can ? 'play' : 'disabled'}" id="oom-buy">+${ar(N.EXTRA_MOVES)} حركات مقابل ${ICON.points}${ar(cost)}</button>
        <button class="btn primary" id="oom-bank">اكسب نقاطاً من بنك الأسئلة (رصيدك ${ar(N.save.points)})</button>
        <button class="btn ghost" id="oom-retry">أعد المحاولة</button>
        <button class="btn ghost" id="oom-exit">الخروج</button>
      </div>`);
    card.querySelector('#oom-buy').onclick = () => {
      if (N.save.points < cost) return toast('رصيدك لا يكفي — اذهب إلى بنك الأسئلة');
      N.save.points -= cost;
      N.persist();
      closeModal();
      b.addMoves(N.EXTRA_MOVES);
      N.sfx.coin();
      refreshPoints();
      toast(`+${ar(N.EXTRA_MOVES)} حركات — بالتوفيق!`);
    };
    card.querySelector('#oom-bank').onclick = () => {
      closeModal();
      openBank(true);
    };
    card.querySelector('#oom-retry').onclick = () => {
      closeModal();
      playLevel(G.level);
    };
    card.querySelector('#oom-exit').onclick = () => {
      closeModal();
      exitLevel();
    };
  }

  function commitStars(level, earned) {
    const prev = N.save.levelStars[level.id] || 0;
    if (earned > prev) {
      N.save.stars += earned - prev;
      N.save.levelStars[level.id] = earned;
    }
    N.save.unlocked = Math.max(N.save.unlocked, level.id + 1);
    N.persist();
  }

  function showWin(level, { movesLeft }) {
    const movesBonus = movesLeft >= Math.ceil(level.moves * 0.2) ? 1 : 0;
    G.earned = 1 + movesBonus + (G.bonusOk ? 1 : 0);
    commitStars(level, G.earned);
    const line = (ok, text) => `<li class="${ok ? 'ok' : ''}">${ok ? '✓' : '○'} ${text}</li>`;
    if (!G.celebrated) {
      G.celebrated = true;
      confetti(110);
    }
    const card = openModal(`${mascot('happy', 'رائع! أنت بطل! 🏆', 'top jump')}
      <h2 class="win-title">أحسنت! فزت في المستوى ${ar(level.id)}</h2>
      <div class="win-stars">${[1, 2, 3].map((i) => `<span class="${i <= G.earned ? 'on' : ''}">${ICON.star}</span>`).join('')}</div>
      <ul class="win-list">
        ${line(true, 'إتمام المستوى')}
        ${line(movesBonus, `إنهاء المستوى ومعك ${ar(Math.ceil(level.moves * 0.2))} حركات أو أكثر`)}
        ${line(G.bonusOk, 'الإجابة عن سؤال المكافأة')}
      </ul>
      <div class="q-actions col">
        ${G.bonusTried ? '' : `<button class="btn gold" id="win-bonus">سؤال المكافأة: نجمة إضافية</button>`}
        <button class="btn play" id="win-next">متابعة</button>
      </div>`);
    const bonus = card.querySelector('#win-bonus');
    if (bonus)
      bonus.onclick = async () => {
        G.bonusTried = true;
        const r = await askQuestion({ categories: G.chapter.categories, maxDifficulty: 3, title: 'سؤال المكافأة' });
        G.bonusOk = r.correct;
        showWin(level, { movesLeft });
      };
    card.querySelector('#win-next').onclick = () => {
      closeModal();
      exitLevel();
      if (N.save.stars > 0) toast(`${ICON.star} رصيدك ${ar(N.save.stars)} — رمّم الصحن!`);
    };
  }

  function exitLevel() {
    if (G) G.board.destroy();
    G = null;
    renderHome();
  }

  /* ---------- التشغيل ---------- */
  function init() {
    N.injectDefs();
    N.loadSave();
    N.Quiz.init();
    document.querySelectorAll('[data-go]').forEach((b) =>
      b.addEventListener('click', () => {
        const go = b.dataset.go;
        if (go === 'map') renderMap();
        else if (go === 'bank') openBank(false);
        else if (go === 'daily') daily();
        else if (go === 'settings') settings();
        else if (go === 'home') renderHome();
      })
    );
    $('#bank-back').onclick = leaveBank;
    $('#btn-exit').onclick = () => {
      if (!G || G.board.busy) return;
      const card = openModal(`<h3>الخروج من المستوى؟</h3><p>سيضيع تقدمك في هذا المستوى.</p>
        <div class="q-actions"><button class="btn danger" id="ex-yes">خروج</button><button class="btn ghost" id="ex-no">متابعة اللعب</button></div>`);
      card.querySelector('#ex-yes').onclick = () => (closeModal(), exitLevel());
      card.querySelector('#ex-no').onclick = closeModal;
    };
    document.querySelectorAll('.ico-points').forEach((e) => (e.outerHTML = ICON.points));
    document.querySelectorAll('.ico-star').forEach((e) => (e.outerHTML = ICON.star));
    renderHome();
    N.runIntro();
  }

  /** زر الرجوع في أندرويد: يعيد true إذا تعاملت معه اللعبة، وfalse للخروج من التطبيق */
  function onBack() {
    if (document.getElementById('intro')) return true; // أثناء المقدمة
    const modal = $('#modal');
    if (!modal.classList.contains('hidden')) {
      const card = modal.querySelector('.modal-card');
      const btn =
        card.querySelector('.q-actions [data-a="back"]') ||
        card.querySelector('.q-actions [data-a]') ||
        card.querySelector('#lvl-cancel, #m-cancel, #ex-no, #set-close, #m-ok');
      if (btn) btn.click(); // السؤال الذي لم يُجب عنه بعد، ونوافذ الفوز والخسارة، لا تُغلق بالرجوع
      return true;
    }
    const active = document.querySelector('.screen.active');
    const id = active ? active.id : 'screen-home';
    if (id === 'screen-game') $('#btn-exit').click();
    else if (id === 'screen-bank') leaveBank();
    else if (id !== 'screen-home') renderHome();
    else return false;
    return true;
  }

  N.App = { startLevel, openBank, renderHome, askQuestion, onBack, current: () => G };
  document.addEventListener('DOMContentLoaded', init);
})();
