/* محرّك الأسئلة: اختيار السؤال، خلط الخيارات، مراجعة الأخطاء (التكرار المتباعد) */
(function () {
  const N = (window.Noor = window.Noor || {});

  const Quiz = {
    bank: [],
    byId: {},

    init() {
      this.bank = (window.QUESTION_BANK || []).filter((q) => q.status !== 'rejected');
      this.byId = {};
      this.bank.forEach((q) => (this.byId[q.id] = q));
    },

    stat(id) {
      return N.save.answers[id];
    },

    /** يختار سؤالاً: أخطاء سابقة مستحقّة للمراجعة ← أسئلة جديدة ← الأقدم ظهوراً */
    pick({ categories = null, maxDifficulty = 3, only = null } = {}) {
      const save = N.save;
      let pool = this.bank.filter(
        (q) => (!categories || categories.includes(q.category)) && q.difficulty <= maxDifficulty
      );
      if (pool.length < 4) pool = this.bank.filter((q) => !categories || categories.includes(q.category));
      if (pool.length < 4) pool = this.bank;
      if (only) pool = pool.filter(only);
      if (!pool.length) return null;

      const due = pool.filter((q) => {
        const s = this.stat(q.id);
        return s && s.due && save.qCounter - s.last >= 4;
      });
      let q;
      if (due.length && Math.random() < 0.4) q = due[N.rand(due.length)];
      else {
        const fresh = pool.filter((q) => !this.stat(q.id));
        if (fresh.length) q = fresh[N.rand(fresh.length)];
        else {
          const sorted = [...pool].sort((a, b) => this.stat(a.id).last - this.stat(b.id).last);
          const head = sorted.slice(0, Math.max(1, Math.ceil(sorted.length * 0.3)));
          q = head[N.rand(head.length)];
        }
      }
      save.qCounter++;
      return q;
    },

    /** خيارات مخلوطة مع معرفة الصحيح */
    options(q) {
      return N.shuffle(q.options.map((text, i) => ({ text, correct: i === q.answer })));
    },

    record(q, correct) {
      const s = N.save.answers[q.id] || { c: 0, w: 0, last: 0, due: false };
      if (correct) s.c++;
      else s.w++;
      s.due = !correct;
      s.last = N.save.qCounter;
      N.save.answers[q.id] = s;
      N.persist();
    },

    dailyQuestion() {
      const day = N.todayKey();
      let h = 0;
      for (const ch of day) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
      return this.bank[h % this.bank.length];
    },

    categoryStats() {
      const out = {};
      for (const cat of Object.keys(N.CATEGORIES)) out[cat] = { total: 0, learned: 0 };
      for (const q of this.bank) {
        const o = out[q.category] || (out[q.category] = { total: 0, learned: 0 });
        o.total++;
        const s = this.stat(q.id);
        if (s && s.c > 0) o.learned++;
      }
      return out;
    },

    dueCount() {
      return this.bank.filter((q) => (this.stat(q.id) || {}).due).length;
    },
  };

  N.Quiz = Quiz;
})();
