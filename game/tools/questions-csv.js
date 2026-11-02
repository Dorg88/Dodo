#!/usr/bin/env node
/* تحويل بنك الأسئلة من/إلى CSV ليعمل عليه فريق الإعداد والمراجعة في Excel أو Google Sheets.

   تصدير البنك الحالي إلى جدول:
     node tools/questions-csv.js export data/questions.csv
   استيراد الجدول وتوليد data/questions.js:
     node tools/questions-csv.js import data/questions.csv

   أعمدة الجدول (الإجابة الصحيحة دائماً في عمود correct، واللعبة تخلط الخيارات تلقائياً):
     id, category, difficulty, question, correct, wrong1, wrong2, wrong3, explanation, source, status, reviewer
   - إذا تُرك id فارغاً يُولَّد تلقائياً حسب القسم (مثل QUR-0022).
   - status: draft (مسودة) | approved (معتمد) | rejected (مرفوض، لا يظهر في اللعبة). */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const JS_FILE = path.join(root, 'data/questions.js');
const COLS = ['id', 'category', 'difficulty', 'question', 'correct', 'wrong1', 'wrong2', 'wrong3', 'explanation', 'source', 'status', 'reviewer'];
const PREFIX = { quran: 'QUR', prophet: 'PRO', masumeen: 'IMM', aqeedah: 'AQD', fiqh: 'FQH', akhlaq: 'AKH', duas: 'DUA', history: 'HIS', places: 'PLC', occasions: 'OCC', prophets: 'NBI' };

function loadBank() {
  const ctx = { window: {} };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(JS_FILE, 'utf8'), ctx);
  return ctx.window.QUESTION_BANK || [];
}

function csvCell(v) {
  const s = v == null ? '' : String(v);
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function parseCSV(text) {
  text = text.replace(/^﻿/, '');
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') (cell += '"'), i++;
      else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') row.push(cell), (cell = '');
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell), rows.push(row), (row = []), (cell = '');
    } else cell += ch;
  }
  if (cell !== '' || row.length) row.push(cell), rows.push(row);
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

function exportCSV(out) {
  const bank = loadBank();
  const lines = [COLS.join(',')];
  for (const q of bank) {
    const wrong = q.options.filter((_, i) => i !== q.answer);
    const rec = { ...q, correct: q.options[q.answer], wrong1: wrong[0], wrong2: wrong[1], wrong3: wrong[2], reviewer: q.reviewer || '' };
    lines.push(COLS.map((c) => csvCell(rec[c])).join(','));
  }
  fs.writeFileSync(out, '﻿' + lines.join('\r\n') + '\r\n', 'utf8'); // BOM ليفتح Excel العربية بشكل صحيح
  console.log(`✓ صُدّر ${bank.length} سؤالاً إلى ${out}`);
}

function importCSV(file) {
  const rows = parseCSV(fs.readFileSync(file, 'utf8'));
  const header = rows.shift().map((h) => h.trim().toLowerCase());
  const missing = COLS.filter((c) => c !== 'reviewer' && !header.includes(c));
  if (missing.length) throw new Error('أعمدة ناقصة: ' + missing.join(', '));
  const counters = {};
  const bank = rows.map((r) => {
    const o = {};
    header.forEach((h, i) => (o[h] = (r[i] || '').trim()));
    return o;
  });
  bank.forEach((o) => {
    const m = /^([A-Z]+)-(\d+)$/.exec(o.id);
    if (m) counters[m[1]] = Math.max(counters[m[1]] || 0, +m[2]);
  });
  const out = bank.map((o) => {
    let id = o.id;
    if (!id) {
      const p = PREFIX[o.category] || 'GEN';
      counters[p] = (counters[p] || 0) + 1;
      id = `${p}-${String(counters[p]).padStart(4, '0')}`;
    }
    const q = {
      id,
      category: o.category,
      difficulty: parseInt(o.difficulty, 10) || 1,
      question: o.question,
      options: [o.correct, o.wrong1, o.wrong2, o.wrong3],
      answer: 0,
      explanation: o.explanation,
      source: o.source,
      status: o.status || 'draft',
    };
    if (o.reviewer) q.reviewer = o.reviewer;
    return q;
  });
  const body = out.map((q) => '  ' + JSON.stringify(q)).join(',\n');
  const js = `/* بنك الأسئلة — مولَّد تلقائياً من ${path.basename(file)} عبر tools/questions-csv.js
   ⚠️ لا تعدّل هذا الملف يدوياً إذا كان الجدول هو المرجع؛ عدّل الجدول ثم أعد الاستيراد. */
window.QUESTION_BANK = [
${body}
];
`;
  fs.writeFileSync(JS_FILE, js, 'utf8');
  console.log(`✓ استُورد ${out.length} سؤالاً إلى data/questions.js — شغّل الآن: node tools/validate-questions.js`);
}

const [cmd, file] = process.argv.slice(2);
if (cmd === 'export') exportCSV(file || path.join(root, 'data/questions.csv'));
else if (cmd === 'import') importCSV(file || path.join(root, 'data/questions.csv'));
else console.log('الاستخدام:\n  node tools/questions-csv.js export [ملف.csv]\n  node tools/questions-csv.js import [ملف.csv]');
