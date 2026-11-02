/* المقدمة: شعار العتبة الحسينية المقدسة ← شعار شعبة البحوث والدراسات ← بطاقة عنوان اللعبة */
(function () {
  const N = (window.Noor = window.Noor || {});
  const LOGO_MS = 2600;

  N.runIntro = function (done) {
    const intro = document.getElementById('intro');
    if (!intro) return done && done();
    const slides = [...intro.querySelectorAll('.intro-slide')];
    const S = N.starPoints;
    document.getElementById('intro-star').innerHTML = `<svg class="burst-star" viewBox="0 0 200 200" aria-hidden="true">
      <polygon points="${S(100, 100, 98, 62, 12)}" fill="#fff6b0" opacity=".85"/>
      <polygon points="${S(100, 100, 80, 50, 12)}" fill="#ffd23f"/>
    </svg><div class="intro-dove">${N.MASCOT_SVG}</div>`;

    let i = -1;
    let timer;
    let finished = false;

    function show(n) {
      clearTimeout(timer);
      slides.forEach((s, k) => s.classList.toggle('show', k === n));
      i = n;
      if (n < slides.length - 1) timer = setTimeout(() => show(n + 1), LOGO_MS);
      else N.music.play('menu'); // بطاقة العنوان: تبدأ الموسيقى
    }

    function finish() {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      N.sfx.start();
      N.music.play('menu');
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
