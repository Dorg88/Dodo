/* الفصول والمستويات
   رموز المخطط: '.' خانة عادية، 'x' فراغ، 'd' غبار (طبقة واحدة)، 'D' غبار (طبقتان)
   أنواع القطع: 0 نجمة، 1 هلال، 2 رمّانة، 3 مصحف، 4 فانوس، 5 قبّة */
(function () {
  const N = (window.Noor = window.Noor || {});

  N.CATEGORIES = {
    quran: 'القرآن الكريم',
    prophet: 'النبي ﷺ والسيرة',
    prophets: 'قصص الأنبياء (ع)',
    masumeen: 'المعصومون الأربعة عشر (ع)',
    aqeedah: 'أصول الدين',
    fiqh: 'فروع الدين والأحكام',
    akhlaq: 'الأخلاق والحديث',
    duas: 'الأدعية والزيارات',
    history: 'التاريخ الإسلامي',
    places: 'المشاهد المشرّفة',
    occasions: 'المناسبات الإسلامية',
    karbala: 'كربلاء والعتبة الحسينية',
    science: 'العلوم والطبيعة',
    social: 'المجتمع والأسرة والآداب',
    general: 'ثقافة عامة',
  };

  N.CHAPTERS = [
    { id: 1, name: 'نور القرآن', categories: ['quran'], maxDifficulty: 1 },
    { id: 2, name: 'السيرة النبوية', categories: ['prophet', 'prophets'], maxDifficulty: 2 },
    { id: 3, name: 'أهل البيت (ع)', categories: ['masumeen', 'occasions', 'karbala'], maxDifficulty: 2 },
    { id: 4, name: 'العقيدة والأحكام', categories: ['aqeedah', 'fiqh', 'social'], maxDifficulty: 2 },
    { id: 5, name: 'الدعاء والأخلاق', categories: ['duas', 'akhlaq', 'science'], maxDifficulty: 3 },
    { id: 6, name: 'التاريخ والمشاهد', categories: ['history', 'places', 'karbala', 'general'], maxDifficulty: 3 },
  ];

  const full = (rows = 8, cols = 8) => Array(rows).fill('.'.repeat(cols));

  N.LEVELS = [
    // ---------- الفصل الأول ----------
    { id: 1, chapter: 1, moves: 20, colors: 5, layout: full(7, 7), goals: [{ type: 0, count: 12 }], knowledgeRate: 0.05 },
    { id: 2, chapter: 1, moves: 22, colors: 5, layout: full(7, 7), goals: [{ type: 1, count: 14 }, { type: 3, count: 14 }], knowledgeRate: 0.05 },
    {
      id: 3, chapter: 1, moves: 22, colors: 5, goals: [], knowledgeRate: 0.05,
      layout: ['........', '........', '..dddd..', '..dddd..', '..dddd..', '..dddd..', '........', '........'],
    },
    {
      id: 4, chapter: 1, moves: 24, colors: 5, goals: [{ type: 4, count: 18 }], knowledgeRate: 0.05,
      layout: ['x......x', '........', '........', 'dddddddd', '........', '........', '........', 'x......x'],
    },
    // ---------- الفصل الثاني ----------
    { id: 5, chapter: 2, moves: 24, colors: 5, layout: full(), goals: [{ type: 0, count: 20 }, { type: 2, count: 20 }], knowledgeRate: 0.05 },
    {
      id: 6, chapter: 2, moves: 22, colors: 5, goals: [{ type: 3, count: 18 }], knowledgeRate: 0.05,
      layout: ['xxx..xxx', 'xx....xx', 'x......x', '........', '........', 'x......x', 'xx....xx', 'xxx..xxx'],
    },
    {
      id: 7, chapter: 2, moves: 28, colors: 5, goals: [], knowledgeRate: 0.05,
      layout: ['........', '........', '........', '........', '........', '........', 'DDDDDDDD', 'DDDDDDDD'],
    },
    {
      id: 8, chapter: 2, moves: 26, colors: 5, layout: full(9, 8), knowledgeRate: 0.05,
      goals: [{ type: 1, count: 15 }, { type: 4, count: 15 }, { type: 5, count: 15 }],
    },
    // ---------- الفصل الثالث ----------
    {
      id: 9, chapter: 3, moves: 28, colors: 5, goals: [], knowledgeRate: 0.06,
      layout: ['xx....xx', 'xx.dd.xx', '..dddd..', '.dddddd.', '.dddddd.', '..dddd..', 'xx.dd.xx', 'xx....xx'],
    },
    { id: 10, chapter: 3, moves: 26, colors: 5, layout: full(), goals: [{ type: 1, count: 25 }, { type: 0, count: 25 }], knowledgeRate: 0.06 },
    {
      id: 11, chapter: 3, moves: 30, colors: 5, goals: [], knowledgeRate: 0.06,
      layout: ['........', '........', 'DDDDDDDD', 'd......d', 'd......d', 'DDDDDDDD', '........', '........'],
    },
    {
      id: 12, chapter: 3, moves: 26, colors: 5, goals: [{ type: 4, count: 20 }], knowledgeRate: 0.06,
      layout: ['........', '...xx...', '........', 'dd....dd', 'dd....dd', '........', '...xx...', '........'],
    },
    // ---------- الفصل الرابع ----------
    { id: 13, chapter: 4, moves: 30, colors: 6, layout: full(), goals: [{ type: 5, count: 20 }], knowledgeRate: 0.06 },
    {
      id: 14, chapter: 4, moves: 24, colors: 5, goals: [], knowledgeRate: 0.06,
      layout: ['d.d.d.d.', '.d.d.d.d', 'd.d.d.d.', '.d.d.d.d', 'd.d.d.d.', '.d.d.d.d', 'd.d.d.d.', '.d.d.d.d'],
    },
    {
      id: 15, chapter: 4, moves: 28, colors: 6, goals: [{ type: 2, count: 18 }, { type: 3, count: 18 }], knowledgeRate: 0.06,
      layout: ['xx....xx', 'x......x', '........', '........', '...xx...', '...xx...', '...xx...', '........'],
    },
    {
      id: 16, chapter: 4, moves: 32, colors: 5, goals: [], knowledgeRate: 0.06,
      layout: ['........', '.dddddd.', '.dDDDDd.', '.dDDDDd.', '.dDDDDd.', '.dDDDDd.', '.dddddd.', '........'],
    },
    // ---------- الفصل الخامس ----------
    {
      id: 17, chapter: 5, moves: 28, colors: 6, layout: full(9, 8), knowledgeRate: 0.07,
      goals: [{ type: 0, count: 20 }, { type: 4, count: 20 }],
    },
    {
      id: 18, chapter: 5, moves: 30, colors: 5, goals: [{ type: 1, count: 15 }], knowledgeRate: 0.07,
      layout: ['x..xx..x', '........', 'DD....DD', 'DD....DD', 'DD....DD', 'DD....DD', '........', 'x..xx..x'],
    },
    {
      id: 19, chapter: 5, moves: 30, colors: 6, goals: [{ type: 5, count: 22 }, { type: 2, count: 22 }], knowledgeRate: 0.07,
      layout: ['xxx..xxx', 'xx....xx', 'x......x', '........', '........', '........', '........', '........'],
    },
    {
      id: 20, chapter: 5, moves: 34, colors: 5, goals: [], knowledgeRate: 0.07,
      layout: ['DDDDDDDD', 'D......D', 'D......D', 'D..dd..D', 'D..dd..D', 'D......D', 'D......D', 'DDDDDDDD'],
    },
    // ---------- الفصل السادس ----------
    {
      id: 21, chapter: 6, moves: 30, colors: 6, layout: full(), knowledgeRate: 0.07,
      goals: [{ type: 0, count: 18 }, { type: 1, count: 18 }, { type: 3, count: 18 }],
    },
    {
      id: 22, chapter: 6, moves: 32, colors: 6, goals: [], knowledgeRate: 0.07,
      layout: ['........', '........', 'dd.dd.dd', 'dd.dd.dd', 'dd.dd.dd', 'dd.dd.dd', 'dddddddd', 'dddddddd'],
    },
    {
      id: 23, chapter: 6, moves: 30, colors: 6, goals: [{ type: 4, count: 24 }], knowledgeRate: 0.07,
      layout: ['x......x', 'x......x', '........', '..DDDD..', '..DDDD..', '........', 'x......x', 'x......x'],
    },
    {
      id: 24, chapter: 6, moves: 36, colors: 6, layout: full(9, 8), knowledgeRate: 0.08,
      goals: [{ type: 0, count: 20 }, { type: 2, count: 20 }, { type: 4, count: 20 }, { type: 5, count: 20 }],
    },
  ];

  N.levelById = (id) => N.LEVELS.find((l) => l.id === id);
  N.chapterOf = (level) => N.CHAPTERS.find((c) => c.id === level.chapter);
})();
