/* شاشة البداية: لوحة الصحن المرسومة، البسملة، شعار «نور المعرفة»، زر «ابدأ اللعب» (يفعّل الصوت بلمسة المستخدم) */
(function () {
  const N = (window.Noor = window.Noor || {});

  N.runIntro = function (done) {
    const intro = document.getElementById('intro');
    if (!intro) return done && done();
    let finished = false;

    function finish() {
      if (finished) return;
      finished = true;
      N.sfx.start();
      N.music.play('menu');
      intro.classList.add('leaving');
      setTimeout(() => {
        intro.remove();
        done && done();
      }, 600);
    }

    intro.addEventListener('click', (e) => {
      if (e.target.closest('#intro-start')) finish();
    });
    const bg = new Image();
    bg.onload = bg.onerror = () => intro.classList.add('show');
    bg.src = N.ARTS.title;
  };
})();
