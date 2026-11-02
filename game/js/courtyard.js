/* الصحن: مشهد مرسوم بطبقات (img/art/home-*.webp)، يرمّم اللاعب عناصره بالنجوم (عمارة فقط — بدون تصوير لأشخاص) */
(function () {
  const N = (window.Noor = window.Noor || {});

  // المعرّفات نفسها في الإصدارات السابقة (يبقى التقدّم المحفوظ صالحاً)
  N.COURTYARD_ITEMS = [
    { id: 'floor', name: 'رخام الصحن', cost: 2, emoji: '✨' },
    { id: 'fountain', name: 'النافورة', cost: 2, emoji: '⛲' },
    { id: 'garden', name: 'الحديقة', cost: 3, emoji: '🌳' },
    { id: 'lanterns', name: 'الفوانيس', cost: 3, emoji: '🏮' },
    { id: 'tiles', name: 'الكاشي الأزرق', cost: 3, emoji: '💠' },
    { id: 'iwan', name: 'الإيوان الذهبي', cost: 4, emoji: '🚪' },
    { id: 'minarets', name: 'المئذنتان', cost: 4, emoji: '🕌' },
    { id: 'dome', name: 'القبّة', cost: 5, emoji: '🌟' },
  ];

  /** طبقات المشهد كصور بمواضع نسبية داخل حاوية بنسبة 9:16 */
  N.sceneHTML = function () {
    const M = N.HOME_LAYERS;
    const pct = (v, t) => ((v / t) * 100).toFixed(3) + '%';
    return M.layers
      .map((l) => `<img class="layer l-${l.id}" ${l.item ? `data-item="${l.id}"` : ''} src="img/art/home-${l.id}.webp" alt="" draggable="false"
        style="left:${pct(l.x, M.w)};top:${pct(l.y, M.h)};width:${pct(l.w, M.w)};height:${pct(l.h, M.h)}">`)
      .join('');
  };

  /** يطبّق حالة الترميم: العناصر غير المرمّمة باهتة كأنها قديمة، والتالي ينبض */
  N.applyCourtyard = function (root, restored, justRestored) {
    if (!root) return;
    const next = N.COURTYARD_ITEMS.find((it) => !restored.includes(it.id));
    root.querySelectorAll('[data-item]').forEach((el) => {
      const id = el.getAttribute('data-item');
      const done = restored.includes(id);
      el.classList.toggle('ruined', !done);
      el.classList.toggle('next', !done && !!next && next.id === id);
      el.classList.toggle('restored-now', id === justRestored);
    });
  };
})();
