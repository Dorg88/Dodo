/* أدوات عامة: أرقام عربية، تخزين، أصوات */
(function () {
  const N = (window.Noor = window.Noor || {});

  N.ar = (n) => String(n).replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);
  N.wait = (ms) => new Promise((r) => setTimeout(r, ms));
  N.rand = (n) => Math.floor(Math.random() * n);
  N.shuffle = (arr) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };
  N.todayKey = () => {
    const d = new Date();
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  };

  /* ---------- حفظ التقدم ---------- */
  const KEY = 'noor-almarifa-save-v1';
  const DEFAULT_SAVE = () => ({
    unlocked: 1, // أعلى مستوى مفتوح
    levelStars: {}, // {levelId: stars}
    stars: 0, // رصيد النجوم للترميم
    restored: [], // عناصر الصحن المرمّمة
    points: 5, // نقاط المعرفة: العملة الوحيدة في اللعبة (بدلاً من الشراء)
    answerStreak: 0, // إجابات صحيحة متتالية في بنك الأسئلة
    answers: {}, // {qid: {c: صحيح, w: خطأ, last: رقم آخر ظهور, due: للمراجعة}}
    qCounter: 0,
    daily: { last: null, streak: 0 },
    sound: true,
  });

  // أسعار المساعدات بنقاط المعرفة — تُكسب فقط بالإجابة عن الأسئلة
  N.COSTS = { moves: 5, hammer: 3, arrow: 4, shuffle: 2 };
  N.EXTRA_MOVES = 5;
  N.POINTS_BY_DIFFICULTY = { 1: 1, 2: 2, 3: 3 };
  N.save = DEFAULT_SAVE();
  N.loadSave = () => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) N.save = Object.assign(DEFAULT_SAVE(), JSON.parse(raw));
    } catch (e) {
      /* التخزين غير متاح: نكمل بدون حفظ */
    }
    return N.save;
  };
  N.persist = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(N.save));
    } catch (e) {}
  };
  N.resetSave = () => {
    N.save = DEFAULT_SAVE();
    N.persist();
  };

  /* ---------- أصوات بسيطة مولّدة (بدون موسيقى) ---------- */
  let ctx = null;
  function tone(freq, dur, type = 'sine', vol = 0.07, delay = 0, slideTo = null) {
    if (!N.save.sound) return;
    try {
      ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
      const t = ctx.currentTime + delay;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + dur + 0.02);
    } catch (e) {}
  }
  N.sfx = {
    match(combo = 1) {
      const base = 440 * Math.pow(1.12, Math.min(combo, 8));
      tone(base, 0.12, 'sine', 0.06, 0, base * 1.5);
    },
    special() {
      tone(330, 0.25, 'triangle', 0.07, 0, 990);
    },
    swapFail() {
      tone(180, 0.12, 'sine', 0.06);
    },
    correct() {
      tone(523, 0.14, 'sine', 0.07);
      tone(784, 0.22, 'sine', 0.07, 0.12);
    },
    wrong() {
      tone(240, 0.25, 'triangle', 0.06, 0, 160);
    },
    win() {
      [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.25, 'sine', 0.06, i * 0.12));
    },
    tap() {
      tone(660, 0.05, 'sine', 0.03);
    },
  };
  N.vibrate = (ms) => {
    try {
      if (navigator.vibrate) navigator.vibrate(ms);
    } catch (e) {}
  };
})();
