/* المقدمة: شعار العتبة الحسينية المقدسة ← شعار شعبة البحوث والدراسات ← بطاقة عنوان اللعبة */
(function () {
  const N = (window.Noor = window.Noor || {});
  const LOGO_MS = 2600;

  N.runIntro = function (done) {
    const intro = document.getElementById('intro');
    if (!intro) return done && done();
    const slides = [...intro.querySelectorAll('.intro-slide')];
    const S = N.starPoints;
    document.getElementById('intro-star').innerHTML = `<svg viewBox="0 0 200 200" aria-hidden="true">
      <polygon points="${S(100, 100, 96, 73.5)}" fill="none" stroke="#f5c542" stroke-opacity=".35" stroke-width="2"/>
      <polygon points="${S(100, 100, 80, 61.2)}" fill="url(#gGold)" stroke="#8a5a00" stroke-width="4" stroke-linejoin="round"/>
      <polygon points="${S(100, 100, 36, 27.5)}" fill="#fff6d0" stroke="#8a5a00" stroke-width="3" stroke-linejoin="round"/>
      <circle cx="100" cy="100" r="9" fill="#f5c542"/>
    </svg>`;

    let i = -1;
    let timer;
    let finished = false;

    function show(n) {
      clearTimeout(timer);
      slides.forEach((s, k) => s.classList.toggle('show', k === n));
      i = n;
      if (n < slides.length - 1) timer = setTimeout(() => show(n + 1), LOGO_MS);
    }

    function finish() {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      N.sfx.win();
      intro.classList.add('leaving');
      setTimeout(() => {
        intro.remove();
        done && done();
      }, 550);
    }

    // النقر على شريحة شعار ينتقل للتالية؛ زر «ابدأ» يُنهي المقدمة (ويفعّل الصوت بلمسة المستخدم)
    intro.addEventListener('click', (e) => {
      if (e.target.closest('#intro-start')) return finish();
      if (i < slides.length - 1) show(i + 1);
    });

    // ننتظر تحميل الشعارات حتى لا تظهر شريحة فارغة
    const imgs = [...intro.querySelectorAll('img')];
    Promise.all(imgs.map((im) => (im.decode ? im.decode().catch(() => {}) : Promise.resolve()))).then(() => show(0));
  };
})();
