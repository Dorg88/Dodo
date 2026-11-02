/* واجهة اللعبة: الشاشات، «الدفع بالمعرفة» (أسئلة بدلاً من الشراء)، المعزّزات، الفوز والخسارة */
(function () {
  const N = window.Noor;
  const $ = (s) => document.querySelector(s);
  const ar = N.ar;
  const ICON = N.ICON;

  // لون ورمز لكل قسم
  const CAT_STYLE = {
    quran: ['📖', '#3d9bff'], prophet: ['🌙', '#2fbf71'], prophets: ['⛵', '#0ea5e9'], masumeen: ['✨', '#a66cff'], aqeedah: ['💡', '#ffa41b'],
    fiqh: ['🕋', '#ff5c7a'], akhlaq: ['💖', '#ff7ab6'], duas: ['🤲', '#22b8a5'], history: ['📜', '#ff8a3d'],
    places: ['🕌', '#5b7cff'], occasions: ['🎉', '#e8559a'],
    karbala: ['🚩', '#c0262d'], science: ['🔬', '#0f9f8f'], social: ['🤝', '#f97316'], general: ['🌍', '#6366f1'],
  };
  const CHAPTER_COLORS = ['#3d9bff', '#2fbf71', '#a66cff', '#ffa41b', '#ff5c7a', '#22b8a5'];

  // المعزّزات وأسعارها بالأسئلة (N.QPRICE)
  const BOOSTERS = [
    { id: 'hammer', name: 'المطرقة', hint: 'اضغط على القطعة التي تريد إزالتها' },
    { id: 'row', name: 'سهم أفقي', hint: 'اضغط على قطعة في الصف الذي تريد مسحه' },
    { id: 'col', name: 'سهم عمودي', hint: 'اضغط على قطعة في العمود الذي تريد مسحه' },
    { id: 'shuffle', name: 'الخلط', hint: '' },
  ];
  const DIFF_NAMES = { 1: 'سهل', 2: 'متوسط', 3: 'صعب' };
  const LETTERS = ['أ', 'ب', 'ج', 'د'];

  let G = null; // حالة المستوى الجاري
  let learnDifficulty = 1;

  /* ================= أدوات عامة ================= */
  function mascot(mood = 'happy', text = '', cls = '') {
    return `<div class="mascot-wrap ${cls}">${text ? `<div class="speech">${text}</div>` : ''}<div class="mascot ${mood}">${N.MASCOT_SVG}</div></div>`;
  }

  function confetti(n = 70) {
    const box = document.createElement('div');
    box.className = 'confetti';
    const cols = N.TILE_COLORS.concat(['#ffffff', '#ff7ab6', '#ffe14d']);
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

  /** عبارة تشجيع كبيرة مع أشعة خلفها */
  function praise(text) {
    const host = $('#screen-game');
    const el = document.createElement('div');
    el.className = 'praise-pop';
    el.innerHTML = `<i class="rays"></i><span>${text}</span>`;
    host.appendChild(el);
    setTimeout(() => el.remove(), 1400);
    react('cheer');
  }

  function show(name) {
    document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === 'screen-' + name));
    window.scrollTo(0, 0);
  }

  let toastTimer;
  function toast(html, ms = 1800) {
    const t = $('#toast');
    t.innerHTML = html;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), ms);
  }

  /** نافذة منبثقة بشريط عنوان (ribbon) وزر إغلاق اختياري */
  function openModal(html, cls = '', { title = '', ribbon = 'blue', onClose = null } = {}) {
    const m = $('#modal');
    const card = m.querySelector('.modal-card');
    card.className = 'modal-card ' + cls;
    card.innerHTML =
      (title ? `<div class="ribbon ${ribbon}"><span>${title}</span></div>` : '') +
      (onClose ? `<button class="x-close" aria-label="إغلاق">✕</button>` : '') +
      `<div class="mc-body">${html}</div>`;
    if (onClose) card.querySelector('.x-close').onclick = () => onClose();
    m.classList.remove('hidden');
    N.sfx.popup();
    return card;
  }
  function closeModal() {
    $('#modal').classList.add('hidden');
  }

  function refreshStars() {
    document.querySelectorAll('[data-stars]').forEach((e) => (e.textContent = ar(N.save.stars)));
  }

  /* ================= بطاقة السؤال (مشتركة) ================= */
  /** يرسم سؤالاً داخل حاوية، ويستدعي onAnswered(correct, setActions) بعد الإجابة */
  function renderQuestion(box, q, { header = '' } = {}, onAnswered) {
    const options = N.Quiz.options(q);
    box.innerHTML = `
      <div class="q-top">
        <span class="chip">${(CAT_STYLE[q.category] || ['⭐'])[0]} ${N.CATEGORIES[q.category] || ''}</span>
        ${header ? `<span class="q-num">${header}</span>` : `<span class="diff d${q.difficulty}">${DIFF_NAMES[q.difficulty] || ''}</span>`}
      </div>
      <p class="q-text">${q.question}</p>
      <div class="q-options">${options
        .map((o, i) => `<button class="opt c${i}" data-i="${i}"><span class="letter">${LETTERS[i]}</span><span class="ot">${o.text}</span></button>`)
        .join('')}</div>
      <div class="q-feedback"></div>
      <div class="q-actions"></div>`;
    box.classList.remove('q-in');
    void box.offsetWidth;
    box.classList.add('q-in');
    let done = false;
    box.querySelectorAll('.opt').forEach((btn) =>
      btn.addEventListener('click', () => {
        if (done) return;
        done = true;
        const correct = options[+btn.dataset.i].correct;
        box.querySelectorAll('.opt').forEach((b, i) => {
          b.disabled = true;
          if (options[i].correct) b.classList.add('right');
          else if (b === btn) b.classList.add('wrong');
          else b.classList.add('dim');
        });
        if (correct) {
          N.sfx.correct();
          N.vibrate(20);
          burstAt(btn);
        } else N.sfx.wrong();
        box.querySelector('.q-feedback').innerHTML = `
          <div class="fb ${correct ? 'ok' : 'no'}">
            ${mascot(correct ? 'happy' : 'sad', correct ? 'أحسنت! 🎉' : 'لا بأس، هكذا نتعلّم! 💪', 'mini')}
            <p>${q.explanation || ''}</p>
            ${q.source ? `<small>المصدر: ${q.source}</small>` : ''}
          </div>`;
        const setActions = (list) => {
          const acts = box.querySelector('.q-actions');
          acts.innerHTML = list.map((a, i) => `<button class="btn ${a.cls || (a.primary ? 'play' : 'ghost')}" data-k="${i}">${a.label}</button>`).join('');
          acts.querySelectorAll('button').forEach((b) => (b.onclick = () => list[+b.dataset.k].cb()));
          acts.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        };
        onAnswered(correct, setActions);
      })
    );
  }

  /** نجوم صغيرة تتطاير من عنصر (عند الإجابة الصحيحة) */
  function burstAt(el) {
    const r = el.getBoundingClientRect();
    for (let i = 0; i < 12; i++) {
      const p = document.createElement('i');
      p.className = 'ui-spark';
      const a = (i / 12) * Math.PI * 2;
      p.style.left = r.left + r.width / 2 + 'px';
      p.style.top = r.top + r.height / 2 + 'px';
      p.style.setProperty('--dx', Math.cos(a) * (60 + Math.random() * 50) + 'px');
      p.style.setProperty('--dy', Math.sin(a) * (40 + Math.random() * 40) + 'px');
      document.body.appendChild(p);
      setTimeout(() => p.remove(), 800);
    }
  }

  /** سؤال واحد (سؤال اليوم، سؤال المكافأة، التدرّب) → {correct, action} */
  function askQuestion({ q, categories, maxDifficulty = 3, title = 'سؤال', subtitle = '', buttons = null }) {
    q = q || N.Quiz.pick({ categories, maxDifficulty });
    if (!q) return Promise.resolve({ correct: false, action: 'none' });
    buttons = buttons || [{ id: 'ok', label: 'متابعة', primary: true }];
    return new Promise((resolve) => {
      const card = openModal(`${subtitle ? `<p class="q-sub">${subtitle}</p>` : ''}<div class="qbox"></div>`, 'qcard', { title });
      renderQuestion(card.querySelector('.qbox'), q, {}, (correct, setActions) => {
        N.Quiz.record(q, correct);
        setActions(buttons.map((b) => ({ label: b.label, primary: b.primary, cb: () => (closeModal(), resolve({ correct, action: b.id })) })));
      });
    });
  }

  /* ================= «الدفع بالمعرفة» ================= */
  /** بدلاً من الشراء: أسئلة متتالية حتى يبلغ عدد الإجابات الصحيحة السعر المطلوب. يعيد true عند النجاح. */
  function payWithQuestions({ price, rewardIcon, rewardLabel, categories = null, maxDifficulty = 2 }) {
    return new Promise((resolve) => {
      let correct = 0;
      const asked = new Set();
      const finish = (ok) => {
        closeModal();
        resolve(ok);
      };
      const card = openModal(
        `<div class="pay-head">
           <div class="pay-reward">${rewardIcon}<b>${rewardLabel}</b></div>
           <div class="pay-price">${ICON.q}<span>الثمن: <b>${price === 1 ? 'إجابة صحيحة واحدة' : price === 2 ? 'إجابتان صحيحتان' : ar(price) + ' إجابات صحيحة'}</b></span></div>
           <small class="pay-note">بدلاً من الشراء بالمال… ادفع بالمعرفة!</small>
           <div class="pay-dots">${Array.from({ length: price }, () => '<i></i>').join('')}</div>
         </div>
         <div class="qbox"></div>`,
        'paycard',
        { title: 'ادفع بالمعرفة', ribbon: 'gold', onClose: () => finish(false) }
      );
      const box = card.querySelector('.qbox');
      const dots = [...card.querySelectorAll('.pay-dots i')];
      const next = () => {
        const fresh = (x) => !asked.has(x.id);
        const q = N.Quiz.pick({ categories, maxDifficulty, only: fresh }) || N.Quiz.pick({ only: fresh });
        asked.add(q.id);
        renderQuestion(box, q, { header: `السؤال ${ar(Math.min(correct + 1, price))} من ${ar(price)}` }, (ok, setActions) => {
          N.Quiz.record(q, ok);
          if (ok) {
            dots[correct].classList.add('on');
            correct++;
          }
          if (correct >= price) setActions([{ label: 'استلم المكافأة 🎁', primary: true, cb: success }]);
          else setActions([{ label: ok ? 'السؤال التالي ←' : 'جرّب سؤالاً آخر ←', primary: true, cb: next }]);
        });
      };
      const success = () => {
        box.innerHTML = `<div class="pay-success">
            <i class="rays big"></i>
            ${mascot('happy', 'أحسنت! دفعت بالمعرفة 🎉', 'top jump')}
            <div class="reward-big">${rewardIcon}<b>${rewardLabel}</b></div>
          </div>
          <div class="q-actions"><button class="btn play big" id="pay-ok">تابع اللعب</button></div>`;
        confetti(80);
        N.sfx.win();
        box.querySelector('#pay-ok').onclick = () => finish(true);
      };
      next();
    });
  }

  /* ================= الشاشة الرئيسية ================= */
  function renderHome(justRestored) {
    $('#courtyard').innerHTML || ($('#courtyard').innerHTML = N.courtyardSVG());
    N.applyCourtyard($('#courtyard svg'), N.save.restored, justRestored);
    refreshStars();
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
        <div class="rc-text"><b>${can ? 'هيا نرمّم' : 'اجمع النجوم لترميم'} ${next.name} ${next.emoji}</b>
          <small>${can ? 'عندك نجوم كافية!' : 'العب المستويات لتكسب النجوم'}</small>
          <span class="rc-bar"><span style="width:${Math.round((done / items.length) * 100)}%"></span></span></div>
        <button class="btn ${can ? 'gold pulse' : 'disabled'}" id="btn-restore">${ICON.star}<b>${ar(next.cost)}</b></button>`;
      $('#btn-restore').onclick = () => {
        if (N.save.stars < next.cost) return toast('تحتاج نجوماً أكثر — العب المستويات لتكسبها ⭐');
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
    $('#btn-play').innerHTML = allDone ? '<span>أتممت كل المستويات! 🏆</span>' : `<span>المستوى ${ar(cur)}</span>`;
    $('#btn-play').onclick = () => (allDone ? renderMap() : startLevel(cur));
    $('#daily-dot').classList.toggle('hidden', N.save.daily.last === N.todayKey());
    show('home');
    N.music.play('menu');
  }

  /* ================= الخريطة ================= */
  function renderMap() {
    const ROW = 100;
    const XS = [50, 77, 50, 23];
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
    refreshStars();
    show('map');
    N.music.play('menu');
    const cur = $('#map-list .node.current');
    if (cur) cur.scrollIntoView({ block: 'center' });
  }

  /* ================= تعلّم (تدرّب حرّ على الأسئلة) ================= */
  function openLearn() {
    renderLearn();
    show('learn');
    N.music.play('menu');
  }

  function renderLearn() {
    refreshStars();
    const stats = N.Quiz.categoryStats();
    const due = N.Quiz.dueCount();
    $('#learn-diff').innerHTML = [1, 2, 3].map((d) => `<button class="seg ${d === learnDifficulty ? 'on' : ''}" data-d="${d}">${DIFF_NAMES[d]}</button>`).join('');
    $('#learn-diff').querySelectorAll('.seg').forEach((b) => (b.onclick = () => ((learnDifficulty = +b.dataset.d), renderLearn())));
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
    $('#learn-cats').innerHTML = cards.join('');
    $('#learn-cats').querySelectorAll('.cat:not([disabled])').forEach((b) => (b.onclick = () => runLearn(b.dataset.c)));
  }

  async function runLearn(cat) {
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
        q = N.Quiz.pick({ categories, only: (x) => x.difficulty === learnDifficulty }) || N.Quiz.pick({ categories });
      }
      if (!q) break;
      const res = await askQuestion({
        q,
        title: 'تعلّم',
        buttons: [
          { id: 'next', label: 'سؤال آخر ←', primary: true },
          { id: 'back', label: 'رجوع' },
        ],
      });
      renderLearn();
      if (res.action === 'back') break;
    }
  }

  /* ================= سؤال اليوم ================= */
  function dayKey(offset) {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  }

  async function daily() {
    const today = N.todayKey();
    const dd = N.save.daily;
    if (dd.last === today) {
      openModal(`${mascot('happy', 'عُد غداً لسؤال جديد!', 'top')}<p class="big">🔥 ${ar(dd.streak)} ${dd.streak > 2 ? 'أيام' : 'يوم'} متتالية</p>
        <div class="q-actions"><button class="btn play" id="m-ok">حسناً</button></div>`, '', { title: 'سؤال اليوم', onClose: closeModal });
      $('#m-ok').onclick = closeModal;
      return;
    }
    const res = await askQuestion({ q: N.Quiz.dailyQuestion(), title: 'سؤال اليوم', subtitle: 'أجب صحيحاً لتربح نجمة للترميم ⭐' });
    dd.streak = dd.last === dayKey(-1) ? dd.streak + 1 : 1;
    dd.last = today;
    if (res.correct) N.save.stars += 1;
    N.persist();
    toast(res.correct ? `${ICON.star} +١ نجمة — 🔥 ${ar(dd.streak)}` : `🔥 ${ar(dd.streak)} — حاول غداً`);
    renderHome();
  }

  /* ================= الإعدادات ================= */
  function settings() {
    const card = openModal(`
      <label class="row-set"><span>🎵 الموسيقى</span><input type="checkbox" id="set-music" ${N.save.music ? 'checked' : ''}></label>
      <label class="row-set"><span>🔊 المؤثرات الصوتية</span><input type="checkbox" id="set-sound" ${N.save.sound ? 'checked' : ''}></label>
      <div class="about">
        <b>عن اللعبة</b>
        <p>«نور المعرفة» لعبة مطابقة تعليمية على نهج أهل البيت (ع). لا توجد مشتريات: كل مساعدة تُدفع بالمعرفة، أي بالإجابة عن الأسئلة.</p>
        <p class="credit">إصدار: <b>شعبة البحوث والدراسات — قسم الشؤون الدينية</b><br>الأمانة العامة للعتبة الحسينية المقدسة</p>
        <p class="warn">الأسئلة الحالية نسخة أولية (${ar(N.Quiz.bank.length)} سؤالاً) وتحتاج إلى مراجعة علمية قبل النشر.</p>
      </div>
      <div class="q-actions"><button class="btn danger" id="set-reset">مسح التقدم</button></div>`, '', { title: 'الإعدادات', onClose: closeModal });
    card.querySelector('#set-sound').onchange = (e) => {
      N.save.sound = e.target.checked;
      N.persist();
      N.sfx.tap();
    };
    card.querySelector('#set-music').onchange = (e) => N.music.setEnabled(e.target.checked);
    card.querySelector('#set-reset').onclick = () => {
      if (!confirm('هل تريد مسح كل التقدم؟')) return;
      N.resetSave();
      closeModal();
      renderHome();
    };
  }

  /* ================= المستوى ================= */
  function goalHTML(g, withNeed = false) {
    const done = g.left <= 0;
    return `<div class="goal ${done ? 'done' : ''}" data-goal="${g.type}"><span class="gi">${N.tileIcon(g.type)}</span>
      ${done ? `<span class="gcheck">${ICON.check}</span>` : `<b>${ar(withNeed ? g.need : g.left)}</b>`}</div>`;
  }

  function levelGoals(level) {
    const goals = level.goals.map((g) => ({ type: g.type, need: g.count, left: g.count }));
    const dust = level.layout.join('').split('').reduce((a, ch2) => a + (ch2 === 'd' ? 1 : ch2 === 'D' ? 2 : 0), 0);
    if (dust) goals.push({ type: 'dust', need: dust, left: dust });
    return goals;
  }

  function startLevel(id) {
    const level = N.levelById(id);
    if (!level) return;
    const ch = N.chapterOf(level);
    const goals = levelGoals(level);
    const tutorial =
      id <= 2
        ? `<div class="tips">
            <p>👆 اسحب القطعة نحو جارتها لتجمع <b>٣ قطع متشابهة</b> أو أكثر.</p>
            <p>🚀 ٤ قطع في خط = <b>سهم</b> &nbsp; 💥 شكل زاوية = <b>انفجار</b> &nbsp; 🌈 ٥ قطع = <b>كرة النور</b></p>
            <p>🎁 علِقت؟ ادفع بالمعرفة: أجب عن أسئلة بدلاً من الشراء!</p>
          </div>`
        : goals.some((g) => g.type === 'dust')
          ? `<div class="tips"><p>🫧 فرقِع <b>الفقاعات</b> بمطابقة القطع فوقها!</p></div>`
          : '';
    const card = openModal(
      `${mascot('happy', id === 1 ? 'أهلاً! أنا نوري 🕊️ هيا نلعب!' : 'هل أنت مستعد؟ 😄', 'top')}
       <small class="lvl-ch">الفصل ${ar(ch.id)} – ${ch.name}</small>
       <div class="goal-board"><span class="gb-title">اجمع</span><div class="goals big">${goals.map((g) => goalHTML(g, true)).join('')}</div>
         <span class="gb-moves">${ICON.moves} ${ar(level.moves)} حركة</span></div>
       ${tutorial}
       <div class="q-actions"><button class="btn play big" id="lvl-go">العب</button></div>`,
      'lvlcard',
      { title: `المستوى ${ar(id)}`, onClose: closeModal }
    );
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
    $('#hud-mascot').innerHTML = `<div class="mascot">${N.MASCOT_SVG}</div>`;
    const ch = N.chapterOf(level);
    G = { level, chapter: ch, bonusTried: false, paid: {} };
    lastMoves = null;
    renderBoosters(); // قبل إنشاء اللوحة ليُحسب ارتفاع الشريط
    const board = new N.Board($('#board-host'), level, {
      onUpdate: renderHUD,
      onPraise: praise,
      onCollect: flyToGoal,
      onWin: (info) => showWin(level, info),
      onOutOfMoves: showOutOfMoves,
      onBoosterUsed: (kind) => {
        if (G) G.paid[kind] = false;
        renderBoosters();
      },
    });
    G.board = board;
    renderHUD(board);
    renderBoosters();
    goalBanner(level, board.goals);
  }

  /** شريط افتتاحي يعرض الأهداف ثم يطير إلى الأعلى */
  function goalBanner(level, goals) {
    const el = document.createElement('div');
    el.className = 'goal-banner';
    el.innerHTML = `<div class="ribbon gold"><span>المستوى ${ar(level.id)}</span></div>
      <div class="gb-in"><div class="goals big">${goals.map((g) => goalHTML(g, true)).join('')}</div></div>`;
    $('#screen-game').appendChild(el);
    setTimeout(() => el.remove(), 2100);
  }

  let lastMoves = null;
  function renderHUD(board) {
    const mv = $('#hud-moves');
    const moves = Math.max(0, board.moves);
    if (moves !== lastMoves) {
      mv.textContent = ar(moves);
      if (lastMoves !== null) {
        mv.classList.remove('tick');
        void mv.offsetWidth;
        mv.classList.add('tick');
      }
      lastMoves = moves;
    }
    const low = board.moves <= 3 && !board.ended;
    $('#hud-moves').parentElement.classList.toggle('low', low);
    $('#hud-goals').innerHTML = board.goals.map((g) => goalHTML(g)).join('');
    react(low ? 'worry' : null);
  }

  /** ردود فعل الحمامة في لوحة الأهداف */
  let reactTimer;
  function react(kind) {
    const m = $('#hud-mascot');
    if (!m) return;
    if (kind === 'cheer') {
      m.classList.remove('cheer');
      void m.offsetWidth;
      m.classList.add('cheer');
      clearTimeout(reactTimer);
      reactTimer = setTimeout(() => m.classList.remove('cheer'), 1200);
    } else m.classList.toggle('worry', kind === 'worry');
  }

  /** القطعة المجموعة تطير إلى عدّاد الهدف */
  function flyToGoal(type, rect) {
    const target = document.querySelector(`#hud-goals .goal[data-goal="${type}"] .gi`);
    if (!target || !rect) return;
    const to = target.getBoundingClientRect();
    const el = document.createElement('div');
    el.className = 'flyer';
    el.innerHTML = N.tileIcon(type);
    const size = Math.min(rect.width, 56);
    Object.assign(el.style, { left: rect.left + rect.width / 2 - size / 2 + 'px', top: rect.top + rect.height / 2 - size / 2 + 'px', width: size + 'px', height: size + 'px' });
    el.style.setProperty('--tx', to.left + to.width / 2 - (rect.left + rect.width / 2) + 'px');
    el.style.setProperty('--ty', to.top + to.height / 2 - (rect.top + rect.height / 2) + 'px');
    document.body.appendChild(el);
    setTimeout(() => {
      el.remove();
      const goal = target.closest('.goal');
      if (goal) {
        goal.classList.remove('bump');
        void goal.offsetWidth;
        goal.classList.add('bump');
      }
    }, 620);
  }

  function renderBoosters() {
    if (!G) return;
    const mode = G.board && G.board.mode;
    $('#boosters').innerHTML = BOOSTERS.map((b) => {
      const ready = G.paid[b.id];
      return `<button class="booster ${mode === b.id ? 'active' : ''} ${ready ? 'ready' : ''}" data-b="${b.id}">
          <span class="bmed">${ICON[b.id]}</span>
          <span class="bname">${b.name}</span>
          <span class="bprice">${ready ? '✓ جاهز' : `${ICON.q}<b>${ar(N.QPRICE[b.id])}</b>`}</span>
        </button>`;
    }).join('');
    $('#boosters').querySelectorAll('[data-b]').forEach((btn) => (btn.onclick = () => useBooster(btn.dataset.b)));
  }

  async function useBooster(kind) {
    const b = G && G.board;
    if (!b || b.busy || b.ended || b.moves <= 0) return;
    if (b.mode === kind) {
      b.cancelMode(); // يبقى المعزّز مدفوعاً وجاهزاً
      renderBoosters();
      return toast('أُلغي المعزّز — ما زال جاهزاً للاستخدام');
    }
    if (b.mode) b.cancelMode();
    const info = BOOSTERS.find((x) => x.id === kind);
    if (!G.paid[kind]) {
      const ok = await payWithQuestions({
        price: N.QPRICE[kind],
        rewardIcon: ICON[kind],
        rewardLabel: info.name,
        categories: G.chapter.categories,
        maxDifficulty: G.chapter.maxDifficulty,
      });
      if (!ok || !G || G.board !== b) return renderBoosters();
      G.paid[kind] = true;
    }
    if (kind === 'shuffle') {
      G.paid.shuffle = false;
      await b.boosterShuffle();
      renderBoosters();
      return;
    }
    b.enterMode(kind);
    renderBoosters();
    toast(info.hint);
  }

  function showOutOfMoves() {
    const b = G.board;
    N.sfx.lose();
    react('worry');
    const card = openModal(
      `${mascot('sad', 'لا تقلق! أجب واستمر في اللعب 💪', 'top')}
       <p class="center">بقي عليك:</p>
       <div class="goals big">${b.goals.filter((g) => g.left > 0).map((g) => goalHTML(g)).join('')}</div>
       <button class="btn play big buy" id="oom-buy"><span class="bl">+${ar(N.EXTRA_MOVES)} حركات</span>
         <small>${ICON.q} أجب عن ${ar(N.QPRICE.moves)} أسئلة بدلاً من الدفع</small></button>
       <div class="q-actions"><button class="btn ghost" id="oom-retry">إعادة المستوى</button><button class="btn danger" id="oom-exit">خروج</button></div>`,
      'lvlcard',
      { title: 'انتهت الحركات!', ribbon: 'red' }
    );
    card.querySelector('#oom-buy').onclick = async () => {
      closeModal();
      const ok = await payWithQuestions({
        price: N.QPRICE.moves,
        rewardIcon: ICON.moves,
        rewardLabel: `+${ar(N.EXTRA_MOVES)} حركات`,
        categories: G.chapter.categories,
        maxDifficulty: G.chapter.maxDifficulty,
      });
      if (!G || G.board !== b) return;
      if (!ok) return showOutOfMoves();
      b.addMoves(N.EXTRA_MOVES);
      N.sfx.coin();
      react(null);
      toast(`+${ar(N.EXTRA_MOVES)} حركات — بالتوفيق!`);
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
    if (!G.celebrated) {
      G.celebrated = true;
      confetti(120);
    }
    react('cheer');
    const line = (ok, text) => `<li class="${ok ? 'ok' : ''}">${ok ? '✓' : '○'} ${text}</li>`;
    const card = openModal(
      `<div class="win-stars"><i class="rays big"></i>${[1, 2, 3].map((i) => `<span class="${i <= G.earned ? 'on' : ''}">${ICON.star}</span>`).join('')}</div>
       ${mascot('happy', 'رائع! أنت بطل! 🏆', 'top jump')}
       <h3 class="win-title">أتممت المستوى ${ar(level.id)}</h3>
       <ul class="win-list">
         ${line(true, 'إتمام المستوى')}
         ${line(movesBonus, `إنهاء المستوى ومعك ${ar(Math.ceil(level.moves * 0.2))} حركات أو أكثر`)}
         ${line(G.bonusOk, 'الإجابة عن سؤال المكافأة')}
       </ul>
       <div class="q-actions col">
         ${G.bonusTried ? '' : `<button class="btn gold" id="win-bonus">${ICON.q} سؤال المكافأة: نجمة إضافية</button>`}
         <button class="btn play big" id="win-next">تابع</button>
       </div>`,
      'wincard',
      { title: 'أحسنت!', ribbon: 'gold' }
    );
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

  function pauseMenu() {
    if (!G || G.board.busy) return;
    const card = openModal(
      `${mascot('happy', 'خذ استراحة قصيرة ☕', 'top')}
       <label class="row-set"><span>🎵 الموسيقى</span><input type="checkbox" id="p-music" ${N.save.music ? 'checked' : ''}></label>
       <label class="row-set"><span>🔊 المؤثرات الصوتية</span><input type="checkbox" id="p-sound" ${N.save.sound ? 'checked' : ''}></label>
       <div class="q-actions col"><button class="btn play big" id="ex-no">متابعة اللعب</button><button class="btn danger" id="ex-yes">الخروج من المستوى</button></div>`,
      '',
      { title: 'إيقاف مؤقت', onClose: closeModal }
    );
    card.querySelector('#p-music').onchange = (e) => N.music.setEnabled(e.target.checked);
    card.querySelector('#p-sound').onchange = (e) => {
      N.save.sound = e.target.checked;
      N.persist();
    };
    card.querySelector('#ex-yes').onclick = () => (closeModal(), exitLevel());
    card.querySelector('#ex-no').onclick = closeModal;
  }

  function exitLevel() {
    if (G && G.board) G.board.destroy();
    G = null;
    renderHome();
  }

  /* ================= التشغيل ================= */
  function init() {
    N.injectDefs();
    N.loadSave();
    N.Quiz.init();
    N.preloadSprites();
    document.querySelectorAll('[data-go]').forEach((b) =>
      b.addEventListener('click', () => {
        const go = b.dataset.go;
        if (go === 'map') renderMap();
        else if (go === 'learn') openLearn();
        else if (go === 'daily') daily();
        else if (go === 'settings') settings();
        else if (go === 'home') renderHome();
      })
    );
    $('#btn-exit').onclick = pauseMenu;
    document.querySelectorAll('.ico-star').forEach((e) => (e.outerHTML = ICON.star));
    renderHome();
    N.runIntro();
  }

  /** زر الرجوع في أندرويد: يعيد true إذا تعاملت معه اللعبة، وfalse للخروج من التطبيق */
  function onBack() {
    if (document.getElementById('intro')) return true;
    const modal = $('#modal');
    if (!modal.classList.contains('hidden')) {
      const card = modal.querySelector('.modal-card');
      const btn = card.querySelector('.x-close') || card.querySelector('.q-actions [data-k="1"]') || card.querySelector('#ex-no, #m-ok');
      if (btn) btn.click(); // السؤال الذي لم يُجب عنه ونوافذ الفوز والخسارة لا تُغلق بالرجوع
      return true;
    }
    const active = document.querySelector('.screen.active');
    const id = active ? active.id : 'screen-home';
    if (id === 'screen-game') pauseMenu();
    else if (id !== 'screen-home') renderHome();
    else return false;
    return true;
  }

  N.App = { startLevel, renderHome, askQuestion, payWithQuestions, onBack, current: () => G };
  document.addEventListener('DOMContentLoaded', init);
})();
