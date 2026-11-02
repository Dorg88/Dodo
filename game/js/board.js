/* محرّك لعبة المطابقة الثلاثية (Match-3) */
(function () {
  const N = (window.Noor = window.Noor || {});
  const SWAP_MS = 170;
  const POP_MS = 240;
  const key = (r, c) => r * 100 + c;
  const unkey = (k) => [Math.floor(k / 100), k % 100];
  let uid = 0;

  class Board {
    constructor(host, level, hooks) {
      this.host = host;
      this.level = level;
      this.hooks = hooks || {};
      this.moves = level.moves;
      this.pendingKnowledge = 0;
      this.busy = false;
      this.ended = false;
      this.mode = null; // وضع المعزّز: hammer | arrow
      this.selected = null;
      this.parseLayout();
      this.goals = level.goals.map((g) => ({ type: g.type, need: g.count, left: g.count }));
      const dustTotal = this.dust.flat().reduce((a, b) => a + b, 0);
      if (dustTotal) this.goals.push({ type: 'dust', need: dustTotal, left: dustTotal });
      this.build();
      this.fillInitial();
      this.bindInput();
      this.resetHint();
    }

    /* ---------- الإعداد ---------- */
    parseLayout() {
      const layout = this.level.layout;
      this.rows = layout.length;
      this.cols = layout[0].length;
      this.mask = layout.map((row) => [...row].map((ch) => ch !== 'x'));
      this.dust = layout.map((row) => [...row].map((ch) => (ch === 'd' ? 1 : ch === 'D' ? 2 : 0)));
      this.grid = layout.map((row) => [...row].map(() => null));
    }

    build() {
      const availW = Math.min(this.host.clientWidth || 360, 480) - 12;
      const availH = Math.max(260, window.innerHeight - 330);
      this.s = Math.floor(Math.min((availW - 24) / this.cols, availH / this.rows, 64));
      const el = document.createElement('div');
      el.className = 'board';
      el.dir = 'ltr';
      el.style.width = this.cols * this.s + 'px';
      el.style.height = this.rows * this.s + 'px';
      el.style.setProperty('--s', this.s + 'px');
      const cells = document.createElement('div');
      cells.className = 'cells';
      this.cellEls = this.mask.map((row) => row.map(() => null));
      for (let r = 0; r < this.rows; r++)
        for (let c = 0; c < this.cols; c++) {
          if (!this.mask[r][c]) continue;
          const ce = document.createElement('div');
          ce.className = 'cell' + ((r + c) % 2 ? ' alt' : '');
          ce.style.transform = `translate(${c * this.s}px, ${r * this.s}px)`;
          const d = document.createElement('div');
          d.className = 'dust d' + this.dust[r][c];
          ce.appendChild(d);
          cells.appendChild(ce);
          this.cellEls[r][c] = ce;
        }
      this.tilesEl = document.createElement('div');
      this.tilesEl.className = 'tiles';
      this.fxEl = document.createElement('div');
      this.fxEl.className = 'fx';
      el.append(cells, this.tilesEl, this.fxEl);
      this.el = el;
      this.host.innerHTML = '';
      this.host.appendChild(el);
    }

    makeTile(type, special = null, knowledge = false) {
      const t = { id: ++uid, type, special, knowledge, el: document.createElement('div') };
      this.renderTile(t);
      this.tilesEl.appendChild(t.el);
      return t;
    }

    renderTile(t) {
      let html = t.special === 'noor' ? N.NOOR_SVG : N.TILE_SVG[t.type];
      if (t.special && N.SPECIAL_OVERLAY[t.special]) html += `<div class="ov">${N.SPECIAL_OVERLAY[t.special]}</div>`;
      if (t.knowledge) html += '<div class="know-badge">؟</div>';
      t.el.className = 'tile' + (t.special ? ' sp sp-' + t.special : '') + (t.knowledge ? ' know' : '');
      t.el.innerHTML = html;
      t.el.style.setProperty('--blink', (Math.random() * 5).toFixed(2) + 's'); // رمش العيون في أوقات مختلفة
    }

    setPos(t, r, c, ms = 0, ease = 'ease') {
      t.el.style.transition = ms ? `transform ${ms}ms ${ease}` : 'none';
      t.el.style.transform = `translate(${c * this.s}px, ${r * this.s}px)`;
    }

    randomType() {
      return N.rand(this.level.colors);
    }

    knowledgeCount() {
      let n = 0;
      this.forTiles((t) => t.knowledge && n++);
      return n;
    }

    spawnTile() {
      const know = Math.random() < (this.level.knowledgeRate || 0) && this.knowledgeCount() < 2;
      return this.makeTile(this.randomType(), null, know);
    }

    fillInitial() {
      for (let r = 0; r < this.rows; r++)
        for (let c = 0; c < this.cols; c++) {
          if (!this.mask[r][c]) continue;
          let type;
          let guard = 0;
          do {
            type = this.randomType();
            guard++;
          } while (
            guard < 30 &&
            ((this.colorAt(r, c - 1) === type && this.colorAt(r, c - 2) === type) ||
              (this.colorAt(r - 1, c) === type && this.colorAt(r - 2, c) === type))
          );
          const t = this.makeTile(type);
          this.grid[r][c] = t;
          this.setPos(t, r, c);
        }
      if (!this.findValidMove()) this.reshuffleTypes();
    }

    /* ---------- أدوات الشبكة ---------- */
    inBounds(r, c) {
      return r >= 0 && r < this.rows && c >= 0 && c < this.cols && this.mask[r][c];
    }
    tileAt(r, c) {
      return this.inBounds(r, c) ? this.grid[r][c] : null;
    }
    colorAt(r, c) {
      const t = this.tileAt(r, c);
      return t && t.special !== 'noor' ? t.type : -1;
    }
    forCells(fn) {
      for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) if (this.mask[r][c]) fn(r, c);
    }
    forTiles(fn) {
      this.forCells((r, c) => this.grid[r][c] && fn(this.grid[r][c], r, c));
    }

    /* ---------- البحث عن التطابقات ---------- */
    findGroups() {
      const runs = [];
      for (let r = 0; r < this.rows; r++) {
        let c = 0;
        while (c < this.cols) {
          const t = this.colorAt(r, c);
          let e = c + 1;
          if (t >= 0) while (e < this.cols && this.colorAt(r, e) === t) e++;
          if (t >= 0 && e - c >= 3) {
            const cells = [];
            for (let x = c; x < e; x++) cells.push(key(r, x));
            runs.push({ dir: 'h', type: t, cells });
          }
          c = e;
        }
      }
      for (let c = 0; c < this.cols; c++) {
        let r = 0;
        while (r < this.rows) {
          const t = this.colorAt(r, c);
          let e = r + 1;
          if (t >= 0) while (e < this.rows && this.colorAt(e, c) === t) e++;
          if (t >= 0 && e - r >= 3) {
            const cells = [];
            for (let y = r; y < e; y++) cells.push(key(y, c));
            runs.push({ dir: 'v', type: t, cells });
          }
          r = e;
        }
      }
      // دمج المسارات المتقاطعة (شكل L أو T)
      const parent = runs.map((_, i) => i);
      const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
      const owner = new Map();
      runs.forEach((run, i) =>
        run.cells.forEach((k) => {
          if (owner.has(k)) parent[find(i)] = find(owner.get(k));
          else owner.set(k, i);
        })
      );
      const groups = new Map();
      runs.forEach((run, i) => {
        const root = find(i);
        if (!groups.has(root)) groups.set(root, { type: run.type, runs: [], cells: new Set() });
        const g = groups.get(root);
        g.runs.push(run);
        run.cells.forEach((k) => g.cells.add(k));
      });
      return [...groups.values()];
    }

    specialFor(g) {
      const maxLen = Math.max(...g.runs.map((r) => r.cells.length));
      if (maxLen >= 5) return 'noor';
      if (g.runs.some((r) => r.dir === 'h') && g.runs.some((r) => r.dir === 'v')) return 'bomb';
      if (maxLen === 4) return g.runs.find((r) => r.cells.length === 4).dir === 'h' ? 'row' : 'col';
      return null;
    }

    specialPos(g, swapKeys) {
      if (swapKeys) for (const k of swapKeys) if (g.cells.has(k)) return k;
      if (g.runs.length > 1) {
        const seen = new Set();
        for (const run of g.runs)
          for (const k of run.cells) {
            if (seen.has(k)) return k;
            seen.add(k);
          }
      }
      const longest = g.runs.reduce((a, b) => (b.cells.length > a.cells.length ? b : a));
      return longest.cells[Math.floor(longest.cells.length / 2)];
    }

    hasRunAt(r, c) {
      const t = this.colorAt(r, c);
      if (t < 0) return false;
      let h = 1;
      for (let x = c - 1; this.colorAt(r, x) === t; x--) h++;
      for (let x = c + 1; this.colorAt(r, x) === t; x++) h++;
      if (h >= 3) return true;
      let v = 1;
      for (let y = r - 1; this.colorAt(y, c) === t; y--) v++;
      for (let y = r + 1; this.colorAt(y, c) === t; y++) v++;
      return v >= 3;
    }

    findValidMove() {
      for (let r = 0; r < this.rows; r++)
        for (let c = 0; c < this.cols; c++) {
          for (const [dr, dc] of [[0, 1], [1, 0]]) {
            const r2 = r + dr, c2 = c + dc;
            const a = this.tileAt(r, c), b = this.tileAt(r2, c2);
            if (!a || !b) continue;
            if (a.special || b.special) return [[r, c], [r2, c2]];
            this.grid[r][c] = b;
            this.grid[r2][c2] = a;
            const ok = this.hasRunAt(r, c) || this.hasRunAt(r2, c2);
            this.grid[r][c] = a;
            this.grid[r2][c2] = b;
            if (ok) return [[r, c], [r2, c2]];
          }
        }
      return null;
    }

    /* ---------- الحركة ---------- */
    swapGrid(r1, c1, r2, c2) {
      const a = this.grid[r1][c1], b = this.grid[r2][c2];
      this.grid[r1][c1] = b;
      this.grid[r2][c2] = a;
      this.setPos(a, r2, c2, SWAP_MS);
      this.setPos(b, r1, c1, SWAP_MS);
    }

    useMove() {
      this.moves--;
      this.update();
    }

    update() {
      this.hooks.onUpdate && this.hooks.onUpdate(this);
    }

    canPlay() {
      return !this.busy && !this.ended && this.moves > 0;
    }

    async trySwap(r1, c1, r2, c2) {
      if (!this.canPlay() || this.mode) return;
      if (Math.abs(r1 - r2) + Math.abs(c1 - c2) !== 1) return;
      const a = this.tileAt(r1, c1), b = this.tileAt(r2, c2);
      if (!a || !b) return;
      this.clearHint();
      this.select(null);
      this.busy = true;
      this.swapGrid(r1, c1, r2, c2);
      await N.wait(SWAP_MS);
      const swapKeys = [key(r2, c2), key(r1, c1)];
      if (a.special === 'noor' || b.special === 'noor' || (a.special && b.special)) {
        this.useMove();
        await this.comboSwap(a, b, r2, c2, r1, c1);
        await this.cascade(this.findGroups());
      } else {
        const groups = this.findGroups();
        if (!groups.length) {
          if (a.special || b.special) {
            // تحريك قطعة خاصة يفعّلها حتى بدون تطابق
            this.useMove();
            const keys = new Set();
            if (a.special) keys.add(key(r2, c2));
            if (b.special) keys.add(key(r1, c1));
            await this.clearCells(keys, [], 1);
            await this.gravity();
            await this.cascade(this.findGroups());
          } else {
            N.sfx.swapFail();
            this.swapGrid(r1, c1, r2, c2);
            await N.wait(SWAP_MS);
            this.busy = false;
            this.resetHint();
            return;
          }
        } else {
          this.useMove();
          await this.cascade(groups, swapKeys);
        }
      }
      await this.settle();
      this.busy = false;
      this.resetHint();
    }

    async activateSpecial(r, c) {
      if (!this.canPlay()) return;
      this.clearHint();
      this.busy = true;
      this.useMove();
      await this.clearCells(new Set([key(r, c)]), [], 1);
      await this.gravity();
      await this.cascade(this.findGroups());
      await this.settle();
      this.busy = false;
      this.resetHint();
    }

    async cascade(groups, swapKeys = null) {
      let combo = 0;
      while (groups.length && !this.ended) {
        combo++;
        const clear = new Set();
        const creates = [];
        for (const g of groups) {
          g.cells.forEach((k) => clear.add(k));
          const sp = this.specialFor(g);
          if (sp) creates.push({ k: this.specialPos(g, combo === 1 ? swapKeys : null), type: sp === 'noor' ? 0 : g.type, special: sp });
        }
        N.sfx.match(combo);
        const words = { 2: 'رائع!', 3: 'ممتاز!', 4: 'مذهل!', 5: 'ما شاء الله!', 7: 'تبارك الله!' };
        if (words[combo]) this.praise(words[combo]);
        if (combo >= 4) this.shake();
        await this.clearCells(clear, creates, combo);
        await this.gravity();
        groups = this.findGroups();
      }
    }

    specialArea(t, r, c) {
      const out = [];
      if (t.special === 'row') for (let x = 0; x < this.cols; x++) this.inBounds(r, x) && out.push(key(r, x));
      else if (t.special === 'col') for (let y = 0; y < this.rows; y++) this.inBounds(y, c) && out.push(key(y, c));
      else if (t.special === 'bomb') {
        for (let dy = -2; dy <= 2; dy++)
          for (let dx = -2; dx <= 2; dx++) if (Math.abs(dx) + Math.abs(dy) <= 2 && this.inBounds(r + dy, c + dx)) out.push(key(r + dy, c + dx));
      } else if (t.special === 'noor') {
        const color = this.mostCommonColor();
        this.forTiles((tt, y, x) => tt.special !== 'noor' && tt.type === color && out.push(key(y, x)));
      }
      return out;
    }

    mostCommonColor() {
      const counts = {};
      this.forTiles((t) => t.special !== 'noor' && (counts[t.type] = (counts[t.type] || 0) + 1));
      // نفضّل لون هدف لم يكتمل
      const goal = this.goals.find((g) => g.type !== 'dust' && g.left > 0 && counts[g.type]);
      if (goal) return goal.type;
      return +Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
    }

    /** يمسح الخانات (ويُطلق القطع الخاصة التي بداخلها) ثم يضع القطع الخاصة الجديدة */
    async clearCells(keys, creates = [], combo = 1, preFired = new Set()) {
      const all = new Set(keys);
      const queue = [...keys];
      const fired = new Set(preFired);
      let sp = false;
      while (queue.length) {
        const k = queue.pop();
        const [r, c] = unkey(k);
        const t = this.grid[r][c];
        if (!t || !t.special || fired.has(t.id)) continue;
        fired.add(t.id);
        sp = true;
        this.fx(t.special, r, c);
        for (const k2 of this.specialArea(t, r, c))
          if (!all.has(k2)) {
            all.add(k2);
            queue.push(k2);
          }
      }
      if (sp) {
        N.sfx.special();
        N.vibrate(25);
        if (fired.size - preFired.size >= 2 || all.size >= 14) this.shake();
      }
      const removed = [];
      for (const k of all) {
        const [r, c] = unkey(k);
        const t = this.grid[r][c];
        if (this.dust[r][c] > 0) {
          this.dust[r][c]--;
          const g = this.goals.find((g) => g.type === 'dust');
          if (g && g.left > 0) g.left--;
          const d = this.cellEls[r][c].firstChild;
          d.className = 'dust d' + this.dust[r][c] + ' hit';
        }
        if (!t) continue;
        if (t.special !== 'noor') {
          const g = this.goals.find((g) => g.type === t.type && g.left > 0);
          if (g) g.left--;
        }
        if (t.knowledge) this.pendingKnowledge++;
        t.el.classList.add('pop');
        removed.push(t);
        if (removed.length <= 24) this.particles(r, c, t.special === 'noor' ? '#ffffff' : N.TILE_COLORS[t.type]);
        this.grid[r][c] = null;
      }
      this.update();
      await N.wait(POP_MS);
      removed.forEach((t) => t.el.remove());
      for (const cr of creates) {
        const [r, c] = unkey(cr.k);
        if (this.grid[r][c]) continue;
        const t = this.makeTile(cr.type, cr.special);
        t.el.classList.add('appear');
        this.setPos(t, r, c);
        this.grid[r][c] = t;
      }
    }

    async gravity() {
      let longest = 0;
      const starts = [];
      for (let c = 0; c < this.cols; c++) {
        const rowsList = [];
        for (let r = this.rows - 1; r >= 0; r--) if (this.mask[r][c]) rowsList.push(r);
        const tiles = [];
        const from = new Map();
        for (const r of rowsList) if (this.grid[r][c]) {
          tiles.push(this.grid[r][c]);
          from.set(this.grid[r][c], r);
        }
        rowsList.forEach((r, i) => (this.grid[r][c] = tiles[i] || null));
        tiles.forEach((t, i) => {
          const r = rowsList[i];
          const dist = r - from.get(t);
          if (dist > 0) {
            const ms = Math.min(140 + 50 * dist, 450);
            longest = Math.max(longest, ms);
            starts.push(() => this.setPos(t, r, c, ms, 'cubic-bezier(.45,.05,.6,1.18)'));
          }
        });
        const missing = rowsList.length - tiles.length;
        for (let j = 0; j < missing; j++) {
          const r = rowsList[tiles.length + j];
          const t = this.spawnTile();
          this.setPos(t, -(j + 1), c);
          this.grid[r][c] = t;
          const dist = r + j + 1;
          const ms = Math.min(140 + 50 * dist, 480);
          longest = Math.max(longest, ms);
          starts.push(() => this.setPos(t, r, c, ms, 'cubic-bezier(.45,.05,.6,1.18)'));
        }
      }
      if (!starts.length) return;
      void this.tilesEl.offsetWidth; // تثبيت مواقع البداية قبل الحركة
      starts.forEach((f) => f());
      await N.wait(longest + 20);
    }

    async comboSwap(a, b, ra, ca, rb, cb) {
      let keys = new Set();
      const preFired = new Set([a.id, b.id]);
      if (a.special === 'noor' && b.special === 'noor') {
        this.forCells((r, c) => keys.add(key(r, c)));
        this.fx('flash');
      } else if (a.special === 'noor' || b.special === 'noor') {
        const noor = a.special === 'noor' ? a : b;
        const other = noor === a ? b : a;
        const [nr, nc] = noor === a ? [ra, ca] : [rb, cb];
        const [or_, oc] = noor === a ? [rb, cb] : [ra, ca];
        keys.add(key(nr, nc));
        keys.add(key(or_, oc));
        preFired.delete(other.id);
        this.fx('flash');
        this.forTiles((t, r, c) => {
          if (t.special || t.type !== other.type) return;
          if (other.special) {
            t.special = other.special === 'bomb' ? 'bomb' : Math.random() < 0.5 ? 'row' : 'col';
            this.renderTile(t);
          }
          keys.add(key(r, c));
        });
        if (other.special) await N.wait(380);
      } else {
        const kinds = [a.special, b.special];
        const big = kinds.includes('bomb');
        const both = kinds[0] === 'bomb' && kinds[1] === 'bomb';
        if (both) {
          for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) this.inBounds(ra + dy, ca + dx) && keys.add(key(ra + dy, ca + dx));
          this.fx('bomb', ra, ca);
        } else {
          const span = big ? [-1, 0, 1] : [0];
          for (const d of span) {
            for (let x = 0; x < this.cols; x++) this.inBounds(ra + d, x) && keys.add(key(ra + d, x));
            for (let y = 0; y < this.rows; y++) this.inBounds(y, ca + d) && keys.add(key(y, ca + d));
            this.fx('row', ra + d, ca);
            this.fx('col', ra, ca + d);
          }
        }
      }
      N.sfx.special();
      await this.clearCells(keys, [], 1, preFired);
      await this.gravity();
    }

    /* ---------- بعد استقرار اللوحة ---------- */
    goalsDone() {
      return this.goals.every((g) => g.left <= 0);
    }

    async settle() {
      this.update();
      if (this.goalsDone()) return this.finishWin();
      while (this.pendingKnowledge > 0 && !this.ended) {
        this.pendingKnowledge--;
        const ok = this.hooks.askKnowledge ? await this.hooks.askKnowledge() : false;
        if (ok) {
          this.moves += 1;
          this.update();
          await this.beamRow();
          if (this.goalsDone()) return this.finishWin();
        }
      }
      if (this.moves <= 0) {
        this.hooks.onOutOfMoves && this.hooks.onOutOfMoves();
        return;
      }
      if (!this.findValidMove()) await this.shuffle();
    }

    async finishWin() {
      this.ended = true;
      this.clearHint();
      N.sfx.win();
      await N.wait(450);
      this.hooks.onWin && this.hooks.onWin({ movesLeft: this.moves });
    }

    // مكافأة سؤال المعرفة: شعاع نور يمسح الصف الأكثر فائدة
    async beamRow() {
      let best = 0, bestScore = -1;
      for (let r = 0; r < this.rows; r++) {
        let score = 0;
        for (let c = 0; c < this.cols; c++) {
          if (!this.inBounds(r, c)) continue;
          score += this.dust[r][c] * 2;
          const t = this.grid[r][c];
          if (t && this.goals.some((g) => g.type === t.type && g.left > 0)) score++;
        }
        if (score > bestScore) (bestScore = score), (best = r);
      }
      const keys = new Set();
      for (let c = 0; c < this.cols; c++) this.inBounds(best, c) && keys.add(key(best, c));
      this.fx('row', best, 0);
      N.sfx.special();
      await this.clearCells(keys, [], 1);
      await this.gravity();
      await this.cascade(this.findGroups());
    }

    addMoves(n) {
      this.moves += n;
      this.update();
      this.resetHint();
    }

    reshuffleTypes() {
      const normal = [];
      this.forTiles((t) => !t.special && normal.push(t));
      const types = normal.map((t) => t.type);
      for (let tries = 0; tries < 300; tries++) {
        N.shuffle(types);
        normal.forEach((t, i) => (t.type = tries > 150 ? this.randomType() : types[i]));
        if (!this.findGroups().length && this.findValidMove()) break;
      }
      normal.forEach((t) => this.renderTile(t));
    }

    async shuffle() {
      this.praise('خلط القطع');
      this.reshuffleTypes();
      this.forTiles((t) => {
        t.el.classList.remove('shuffle');
        void t.el.offsetWidth;
        t.el.classList.add('shuffle');
      });
      await N.wait(450);
    }

    /* ---------- المعزّزات ---------- */
    enterMode(kind) {
      this.clearHint();
      this.select(null);
      this.mode = kind;
      this.el.classList.add('targeting');
    }

    cancelMode() {
      const kind = this.mode;
      this.mode = null;
      this.el.classList.remove('targeting');
      this.resetHint();
      return kind;
    }

    async applyBooster(r, c) {
      const kind = this.mode;
      if (!this.tileAt(r, c) || this.busy) return;
      this.mode = null;
      this.el.classList.remove('targeting');
      this.busy = true;
      const keys = new Set();
      if (kind === 'hammer') {
        keys.add(key(r, c));
        this.fx('bomb', r, c);
      } else if (kind === 'arrow') {
        for (let x = 0; x < this.cols; x++) this.inBounds(r, x) && keys.add(key(r, x));
        this.fx('row', r, c);
      }
      N.sfx.special();
      await this.clearCells(keys, [], 1);
      await this.gravity();
      await this.cascade(this.findGroups());
      await this.settle();
      this.busy = false;
      this.hooks.onBoosterUsed && this.hooks.onBoosterUsed(kind);
      this.resetHint();
    }

    async boosterShuffle() {
      if (this.busy) return;
      this.busy = true;
      await this.shuffle();
      this.busy = false;
      this.resetHint();
    }

    /* ---------- المؤثرات ---------- */
    fx(kind, r = 0, c = 0) {
      const d = document.createElement('div');
      const s = this.s;
      if (kind === 'row') {
        d.className = 'beam h';
        d.style.top = r * s + 'px';
      } else if (kind === 'col') {
        d.className = 'beam v';
        d.style.left = c * s + 'px';
      } else if (kind === 'bomb') {
        d.className = 'burst';
        d.style.left = (c + 0.5) * s + 'px';
        d.style.top = (r + 0.5) * s + 'px';
      } else if (kind === 'noor' || kind === 'flash') {
        d.className = 'flash';
      } else return;
      this.fxEl.appendChild(d);
      setTimeout(() => d.remove(), 650);
    }

    /** جزيئات ملوّنة تتطاير من القطعة عند فرقعتها */
    particles(r, c, color) {
      const s = this.s;
      for (let i = 0; i < 6; i++) {
        const p = document.createElement('i');
        p.className = 'particle' + (i % 2 ? ' star' : '');
        const a = Math.random() * Math.PI * 2;
        const d = s * (0.6 + Math.random() * 0.8);
        p.style.left = (c + 0.5) * s + 'px';
        p.style.top = (r + 0.5) * s + 'px';
        p.style.setProperty('--dx', Math.cos(a) * d + 'px');
        p.style.setProperty('--dy', Math.sin(a) * d + 'px');
        p.style.background = color;
        this.fxEl.appendChild(p);
        setTimeout(() => p.remove(), 650);
      }
    }

    shake() {
      this.el.classList.remove('shake');
      void this.el.offsetWidth;
      this.el.classList.add('shake');
    }

    praise(text) {
      this.hooks.onPraise && this.hooks.onPraise(text);
    }

    /* ---------- الإدخال ---------- */
    bindInput() {
      const el = this.el;
      this._down = (e) => {
        if (this.busy || this.ended) return;
        const cell = this.cellFromEvent(e);
        if (!cell) return;
        e.preventDefault();
        this.drag = { r: cell[0], c: cell[1], x: e.clientX, y: e.clientY, moved: false };
        try {
          el.setPointerCapture(e.pointerId);
        } catch (err) {}
      };
      this._move = (e) => {
        const d = this.drag;
        if (!d || d.moved || this.mode) return;
        const dx = e.clientX - d.x, dy = e.clientY - d.y;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < this.s * 0.35) return;
        d.moved = true;
        const [dr, dc] = Math.abs(dx) > Math.abs(dy) ? [0, Math.sign(dx)] : [Math.sign(dy), 0];
        this.trySwap(d.r, d.c, d.r + dr, d.c + dc);
      };
      this._up = () => {
        const d = this.drag;
        this.drag = null;
        if (d && !d.moved) this.onTap(d.r, d.c);
      };
      el.addEventListener('pointerdown', this._down);
      el.addEventListener('pointermove', this._move);
      el.addEventListener('pointerup', this._up);
      el.addEventListener('pointercancel', () => (this.drag = null));
    }

    cellFromEvent(e) {
      const rect = this.el.getBoundingClientRect();
      const c = Math.floor((e.clientX - rect.left) / this.s);
      const r = Math.floor((e.clientY - rect.top) / this.s);
      return this.inBounds(r, c) ? [r, c] : null;
    }

    onTap(r, c) {
      if (this.mode) return this.applyBooster(r, c);
      const t = this.tileAt(r, c);
      if (!t || !this.canPlay()) return;
      if (this.selected) {
        const [sr, sc] = this.selected;
        if (sr === r && sc === c) return this.select(null);
        if (Math.abs(sr - r) + Math.abs(sc - c) === 1) return this.trySwap(sr, sc, r, c);
      }
      if (t.special) {
        this.select(null);
        return this.activateSpecial(r, c);
      }
      N.sfx.tap();
      this.select([r, c]);
    }

    select(cell) {
      if (this.selected) {
        const t = this.tileAt(...this.selected);
        t && t.el.classList.remove('selected');
      }
      this.selected = cell;
      if (cell) {
        const t = this.tileAt(...cell);
        t && t.el.classList.add('selected');
      }
    }

    /* ---------- التلميح ---------- */
    clearHint() {
      clearTimeout(this.hintTimer);
      this.el.querySelectorAll('.hint').forEach((e) => e.classList.remove('hint'));
    }

    resetHint() {
      this.clearHint();
      this.hintTimer = setTimeout(() => {
        if (!this.canPlay() || this.mode) return;
        const m = this.findValidMove();
        if (m) m.forEach(([r, c]) => this.tileAt(r, c).el.classList.add('hint'));
      }, 6000);
    }

    destroy() {
      this.ended = true;
      clearTimeout(this.hintTimer);
      this.el.remove();
    }
  }

  N.Board = Board;
})();
