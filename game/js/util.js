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
    answers: {}, // {qid: {c: صحيح, w: خطأ, last: رقم آخر ظهور, due: للمراجعة}}
    qCounter: 0,
    daily: { last: null, streak: 0 },
    sound: true, // المؤثرات الصوتية
    music: true, // الموسيقى
  });

  // «الدفع بالمعرفة»: بدلاً من الشراء بالمال، يُجيب اللاعب عن أسئلة واحداً تلو الآخر.
  // السعر = عدد الإجابات الصحيحة المطلوبة.
  N.QPRICE = { moves: 3, hammer: 1, row: 2, col: 2, shuffle: 1 };
  N.EXTRA_MOVES = 5;
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

  // المؤثرات والموسيقى في js/audio.js
  N.vibrate = (ms) => {
    try {
      if (navigator.vibrate) navigator.vibrate(ms);
    } catch (e) {}
  };
})();
