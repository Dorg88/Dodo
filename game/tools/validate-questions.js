#!/usr/bin/env node
/* يفحص بنك الأسئلة: node tools/validate-questions.js
   يتحقق من: تفرّد المعرّفات والأسئلة، صحة القسم والصعوبة، وجود ٤ خيارات مختلفة، رقم الإجابة، الشرح والمصدر. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'js/levels.js'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'data/questions.js'), 'utf8'), ctx);

const CATEGORIES = ctx.window.Noor.CATEGORIES;
const bank = ctx.window.QUESTION_BANK || [];
const errors = [];
const warnings = [];
const ids = new Set();
const texts = new Map();
const norm = (s) => String(s || '').replace(/[ً-ْـ]/g, '').replace(/\s+/g, ' ').trim();

bank.forEach((q, i) => {
  const where = `#${i + 1} (${q.id || 'بدون معرّف'})`;
  if (!q.id) errors.push(`${where}: لا يوجد معرّف id`);
  else if (ids.has(q.id)) errors.push(`${where}: المعرّف مكرر`);
  ids.add(q.id);
  if (!CATEGORIES[q.category]) errors.push(`${where}: قسم غير معروف "${q.category}"`);
  if (![1, 2, 3].includes(q.difficulty)) errors.push(`${where}: الصعوبة يجب أن تكون 1 أو 2 أو 3`);
  if (!q.question || !q.question.trim()) errors.push(`${where}: نص السؤال فارغ`);
  if (!Array.isArray(q.options) || q.options.length !== 4) errors.push(`${where}: يجب أن تكون الخيارات ٤ بالضبط`);
  else {
    if (q.options.some((o) => !String(o).trim())) errors.push(`${where}: يوجد خيار فارغ`);
    if (new Set(q.options.map(norm)).size !== 4) errors.push(`${where}: يوجد خياران متطابقان`);
  }
  if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer > 3) errors.push(`${where}: رقم الإجابة يجب أن يكون بين 0 و 3`);
  if (!['draft', 'approved', 'rejected'].includes(q.status)) errors.push(`${where}: الحالة يجب أن تكون draft أو approved أو rejected`);
  if (!q.explanation) warnings.push(`${where}: لا يوجد شرح`);
  if (!q.source) warnings.push(`${where}: لا يوجد مصدر`);
  // المكرر = نفس نص السؤال مع نفس الإجابة الصحيحة (أسئلة «أيّ مما يلي…» تتكرر صياغتها بإجابات مختلفة)
  const t = norm(q.question) + '|' + norm(Array.isArray(q.options) ? q.options[q.answer] : '');
  if (texts.has(t)) warnings.push(`${where}: سؤال مكرر مع ${texts.get(t)}`);
  texts.set(t, q.id);
});

const count = (key) => bank.reduce((m, q) => ((m[q[key]] = (m[q[key]] || 0) + 1), m), {});
console.log(`\nعدد الأسئلة: ${bank.length}`);
console.log('حسب القسم:', count('category'));
console.log('حسب الصعوبة:', count('difficulty'));
console.log('حسب الحالة:', count('status'));
warnings.forEach((w) => console.log('تنبيه: ' + w));
errors.forEach((e) => console.log('خطأ: ' + e));
console.log(errors.length ? `\n✗ ${errors.length} خطأ` : '\n✓ البنك سليم');
process.exit(errors.length ? 1 : 0);
