/* الصوت: مؤثرات مولّدة (Web Audio) + موسيقى (ملفات audio/*.ogg|mp3) مع مفتاحين منفصلين في الإعدادات */
(function () {
  const N = (window.Noor = window.Noor || {});

  /* ================= المؤثرات الصوتية ================= */
  let ctx = null, out = null, verbIn = null, noiseBuf = null;
  const last = {}; // لمنع تكرار الصوت نفسه عشرات المرات في اللحظة نفسها

  function ac() {
    if (!ctx) {
      try {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) {
        return null;
      }
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 6;
      comp.connect(ctx.destination);
      out = ctx.createGain();
      out.gain.value = 0.9;
      out.connect(comp);
      const verb = ctx.createConvolver();
      const len = ctx.sampleRate * 1.3;
      const ir = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const d = ir.getChannelData(ch);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
      }
      verb.buffer = ir;
      verbIn = ctx.createGain();
      verbIn.gain.value = 0.28;
      verbIn.connect(verb).connect(comp);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const nd = noiseBuf.getChannelData(0);
      for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function ok(name, gap = 0.05) {
    if (!N.save.sound || !ac()) return false;
    const now = ctx.currentTime;
    if (last[name] && now - last[name] < gap) return false;
    last[name] = now;
    return true;
  }

  /** نغمة واحدة مع انزلاق اختياري في التردد وغلاف صوتي */
  function tone(f0, dur, { type = 'sine', vol = 0.15, at = 0, to = null, attack = 0.006, verb = 0.15, partial = 0 } = {}) {
    const t = ctx.currentTime + at;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(out);
    if (verb) {
      const s = ctx.createGain();
      s.gain.value = verb;
      g.connect(s).connect(verbIn);
    }
    const freqs = partial ? [f0, f0 * partial] : [f0];
    freqs.forEach((f, k) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(f, t);
      if (to) o.frequency.exponentialRampToValueAtTime(to * (f / f0), t + dur * 0.9);
      if (k) {
        const pg = ctx.createGain();
        pg.gain.value = 0.25;
        o.connect(pg).connect(g);
      } else o.connect(g);
      o.start(t);
      o.stop(t + dur + 0.05);
    });
  }

  /** ضوضاء مرشّحة (للوشوشة والانفجار والطرقات) */
  function hiss(dur, { vol = 0.15, at = 0, f = 1800, f2 = null, q = 1.2, type = 'bandpass', verb = 0.1 } = {}) {
    const t = ctx.currentTime + at;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const bp = ctx.createBiquadFilter();
    bp.type = type;
    bp.Q.value = q;
    bp.frequency.setValueAtTime(f, t);
    if (f2) bp.frequency.exponentialRampToValueAtTime(f2, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(bp).connect(g).connect(out);
    if (verb) {
      const s = ctx.createGain();
      s.gain.value = verb;
      g.connect(s).connect(verbIn);
    }
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
  }

  // سلّم خماسي يصعد مع كل سلسلة (combo)
  const PENTA = [523, 587, 659, 784, 880, 1047, 1175, 1319, 1568, 1760];

  N.sfx = {
    match(combo = 1) {
      if (!ok('match', 0.04)) return;
      const f = PENTA[Math.min(combo - 1, PENTA.length - 1)];
      tone(f * 0.7, 0.16, { to: f * 1.25, vol: 0.2, verb: 0.12 }); // «بلوب» فقاعي
      tone(f * 2, 0.08, { type: 'triangle', vol: 0.05, at: 0.02 });
      hiss(0.03, { vol: 0.05, f: 3500, q: 0.8 });
    },
    create() {
      if (!ok('create', 0.1)) return;
      [1047, 1319, 1568, 2093].forEach((f, i) => tone(f, 0.25, { type: 'triangle', vol: 0.07, at: i * 0.045, verb: 0.3 }));
    },
    rocket() {
      if (!ok('rocket', 0.08)) return;
      hiss(0.38, { vol: 0.22, f: 500, f2: 5000, q: 1.6, verb: 0.2 });
      tone(300, 0.3, { type: 'sawtooth', to: 1200, vol: 0.03 });
    },
    bomb() {
      if (!ok('bomb', 0.1)) return;
      tone(140, 0.5, { to: 38, vol: 0.4, verb: 0.25 });
      hiss(0.45, { vol: 0.25, f: 900, f2: 120, type: 'lowpass', q: 0.7, verb: 0.3 });
    },
    noor() {
      if (!ok('noor', 0.2)) return;
      [523, 659, 784, 1047, 1319, 1568, 2093, 2637].forEach((f, i) => tone(f, 0.6, { vol: 0.07, at: i * 0.05, verb: 0.45, partial: 2.76 }));
      hiss(0.8, { vol: 0.06, f: 6000, f2: 9000, q: 3, verb: 0.4 });
    },
    special() {
      this.rocket();
    },
    bubble() {
      if (!ok('bubble', 0.05)) return;
      tone(900 + Math.random() * 500, 0.09, { to: 1800, vol: 0.09, verb: 0.05 });
    },
    magic() {
      if (!ok('magic', 0.3)) return;
      [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.45, { vol: 0.08, at: i * 0.07, verb: 0.4, partial: 2.76 }));
    },
    swapFail() {
      if (!ok('fail', 0.1)) return;
      tone(260, 0.12, { type: 'triangle', to: 200, vol: 0.14, verb: 0.02 });
      tone(200, 0.14, { type: 'triangle', to: 160, vol: 0.12, at: 0.09, verb: 0.02 });
    },
    tap() {
      if (!ok('tap', 0.03)) return;
      tone(1200, 0.05, { vol: 0.05, verb: 0 });
    },
    select() {
      if (!ok('select', 0.03)) return;
      tone(880, 0.07, { type: 'triangle', to: 1320, vol: 0.07, verb: 0 });
    },
    correct() {
      if (!ok('correct', 0.2)) return;
      [1047, 1319, 1568].forEach((f, i) => tone(f, 0.55, { vol: 0.12, at: i * 0.09, verb: 0.35, partial: 2.76 }));
      tone(2093, 0.7, { vol: 0.07, at: 0.27, verb: 0.45, partial: 2.76 });
    },
    wrong() {
      if (!ok('wrong', 0.2)) return;
      tone(392, 0.3, { type: 'triangle', vol: 0.12, verb: 0.15 });
      tone(311, 0.45, { type: 'triangle', vol: 0.12, at: 0.18, verb: 0.15 });
    },
    coin() {
      if (!ok('coin', 0.08)) return;
      tone(988, 0.12, { type: 'square', vol: 0.035, verb: 0.1 });
      tone(1319, 0.35, { type: 'square', vol: 0.035, at: 0.08, verb: 0.2 });
    },
    star() {
      if (!ok('star', 0.15)) return;
      [1319, 1760, 2637].forEach((f, i) => tone(f, 0.35, { type: 'triangle', vol: 0.08, at: i * 0.06, verb: 0.35 }));
    },
    start() {
      if (!ok('start', 0.3)) return;
      hiss(0.35, { vol: 0.1, f: 400, f2: 3000, q: 1, verb: 0.2 });
      [587, 740, 880, 1175].forEach((f, i) => tone(f, 0.35, { type: 'triangle', vol: 0.08, at: 0.12 + i * 0.07, verb: 0.3 }));
    },
    lose() {
      if (!ok('lose', 0.3)) return;
      [587, 554, 523, 440].forEach((f, i) => tone(f, 0.4, { type: 'triangle', vol: 0.1, at: i * 0.16, verb: 0.3 }));
    },
    popup() {
      if (!ok('popup', 0.1)) return;
      tone(500, 0.14, { to: 1000, vol: 0.07, verb: 0.08 });
    },
    win() {
      // نغمة الفوز ملف موسيقي قصير؛ وإن تعذّر نعزفها بالمولّد
      if (!N.save.sound) return;
      if (!N.music.jingle('win')) [587, 740, 880, 1175, 1480].forEach((f, i) => tone(f, 0.5, { type: 'triangle', vol: 0.1, at: i * 0.1, verb: 0.35 }));
    },
  };

  /* ================= الموسيقى ================= */
  const EXT = (() => {
    try {
      return new Audio().canPlayType('audio/ogg; codecs="vorbis"') ? 'ogg' : 'mp3';
    } catch (e) {
      return 'mp3';
    }
  })();
  const VOL = { menu: 0.42, game: 0.36, win: 0.8 };
  const tracks = {};
  let current = null;
  let hiddenPaused = false;

  function track(name) {
    if (!tracks[name]) {
      const a = new Audio('audio/' + name + '.' + EXT);
      a.loop = name !== 'win';
      a.preload = 'auto';
      a.volume = 0;
      tracks[name] = a;
    }
    return tracks[name];
  }

  function fade(a, to, ms = 700, then) {
    clearInterval(a._fade);
    const from = a.volume;
    const steps = Math.max(1, Math.round(ms / 40));
    let k = 0;
    a._fade = setInterval(() => {
      k++;
      a.volume = Math.max(0, Math.min(1, from + ((to - from) * k) / steps));
      if (k >= steps) {
        clearInterval(a._fade);
        then && then();
      }
    }, 40);
  }

  N.music = {
    want: null,
    /** يشغّل مقطوعة (menu | game) مع انتقال ناعم */
    play(name) {
      this.want = name;
      if (!N.save.music || document.hidden) return;
      if (current === name && !track(name).paused) return;
      if (current && current !== name) {
        const old = track(current);
        fade(old, 0, 600, () => old.pause());
      }
      current = name;
      const a = track(name);
      const p = a.play();
      if (p && p.catch) p.catch(() => {}); // سيبدأ عند أول لمسة إن منع المتصفح التشغيل التلقائي
      fade(a, VOL[name] || 0.4, 900);
    },
    stop() {
      if (!current) return;
      const a = track(current);
      fade(a, 0, 500, () => a.pause());
      current = null;
    },
    /** مقطع قصير (الفوز) يخفض الموسيقى مؤقتاً */
    jingle(name) {
      try {
        const j = track(name);
        j.currentTime = 0;
        j.volume = VOL[name] || 0.8;
        const bg = current && track(current);
        if (bg && N.save.music) {
          fade(bg, 0.08, 300);
          setTimeout(() => current && N.save.music && fade(track(current), VOL[current] || 0.4, 1200), 3400);
        }
        const p = j.play();
        if (p && p.catch) p.catch(() => {});
        return true;
      } catch (e) {
        return false;
      }
    },
    setEnabled(on) {
      N.save.music = on;
      N.persist();
      if (on) {
        const w = this.want || 'menu';
        current = null;
        this.play(w);
      } else this.stop();
    },
    /** حالة المقاطع (للاختبار) */
    state() {
      const t = {};
      Object.entries(tracks).forEach(([k, a]) => (t[k] = { paused: a.paused, ready: a.readyState, error: a.error && a.error.code, volume: +a.volume.toFixed(2), time: +a.currentTime.toFixed(1) }));
      return { current, want: this.want, ext: EXT, tracks: t };
    },
    pauseAll() {
      Object.values(tracks).forEach((a) => a.pause());
      if (ctx && ctx.state === 'running') ctx.suspend();
      hiddenPaused = true;
    },
    resumeAll() {
      if (!hiddenPaused) return;
      hiddenPaused = false;
      if (ctx) ctx.resume();
      if (N.save.music && current) {
        const p = track(current).play();
        if (p && p.catch) p.catch(() => {});
      }
    },
  };

  // إيقاف الصوت عند الخروج من التطبيق أو إخفاء الصفحة
  document.addEventListener('visibilitychange', () => (document.hidden ? N.music.pauseAll() : N.music.resumeAll()));
  // أول لمسة: تفعيل الصوت وبدء الموسيقى المطلوبة إن منعها المتصفح سابقاً
  document.addEventListener(
    'pointerdown',
    () => {
      ac();
      if (N.save.music && N.music.want && current) {
        const a = track(current);
        if (a.paused) {
          const p = a.play();
          if (p && p.catch) p.catch(() => {});
        }
      }
    },
    { passive: true }
  );
  // صوت خفيف لكل زر
  document.addEventListener('click', (e) => {
    if (e.target.closest('button:not(.opt):not(#intro-start)')) N.sfx.tap();
  });
})();
