#!/usr/bin/env node
// HIKAYA: one Word document (Arabic, right to left) from the per-character
// script files written by hikaya_recover.py, so the document always matches
// the TXT files word for word.
//
//   NODE_PATH=~/HIKAYA/node_tools/node_modules node hikaya_scripts_docx.js \
//       -o Episodes_01_06.docx --title "…" Episode_01.txt … Episode_06.txt
//
// Each episode: its heading, its status (original script or recovered
// transcript), then one section per character with that character's name and
// recording; delivery directions in brackets; «#» notes (file, time range,
// attribution, hand corrections) in small grey type. Needs: npm install docx.

const fs = require("fs");
const path = require("path");
const {
  AlignmentType, BorderStyle, Document, Footer, HeadingLevel, Packer, PageBreak, PageNumber,
  Paragraph, ShadingType, Table, TableCell, TableRow, TextRun, WidthType,
} = require("docx");

const FONT = { ascii: "Arial", hAnsi: "Arial", cs: "Arial" };
const INK = "2E2419", GOLD = "8A5A1E", GREY = "7A6A55", WARN = "A33A1E";

function run(text, opts = {}) {
  const size = opts.size || 24;
  return new TextRun({
    // RLM first: the run reads right to left even when it opens with a file name
    text: "\u200F" + text, font: FONT, rightToLeft: true, size, sizeComplexScript: size,
    bold: !!opts.bold, boldComplexScript: !!opts.bold, italics: !!opts.italics, italicsComplexScript: !!opts.italics,
    color: opts.color || INK,
  });
}

function para(children, opts = {}) {
  return new Paragraph({
    // no alignment on right-to-left paragraphs: Word (and LibreOffice) then align
    // them to their start, the right; «right» would mean their end in Word
    bidirectional: true, alignment: opts.alignment,
    spacing: { before: opts.before || 0, after: opts.after ?? 120, line: opts.line || 300 },
    heading: opts.heading, keepNext: opts.keepNext, children: Array.isArray(children) ? children : [children],
    border: opts.border, shading: opts.shading, indent: opts.indent,
  });
}

function parse(file) {
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  const ep = { title: "", status: [], sections: [] };
  let i = 0;
  while (i < lines.length && !/^الحلقة\s+\d+/.test(lines[i].trim())) i++;
  ep.title = (lines[i] || "").trim();
  i++;
  while (i < lines.length && /^=+$/.test(lines[i].trim())) i++;
  while (i < lines.length && lines[i].trim() !== "") ep.status.push(lines[i++].trim());
  let prevBlank = true;
  for (; i < lines.length; i++) {
    const t = lines[i].trim();
    const head = prevBlank && t.match(/^\[([^\[\]]+?)\s+[—–-]\s+([^\[\]]+)\]$/);
    prevBlank = t === "";
    if (!t) continue;
    if (head) ep.sections.push({ name: head[1].trim(), file: head[2].trim(), items: [] });
    else if (!ep.sections.length) continue;
    else if (t.startsWith("#")) ep.sections.at(-1).items.push({ kind: "note", text: t.replace(/^#\s*/, "") });
    else if (/^\[[^\]]*\]$/.test(t)) ep.sections.at(-1).items.push({ kind: "direction", text: t });
    else ep.sections.at(-1).items.push({ kind: "line", text: t });
  }
  return ep;
}

function episodeBlocks(ep) {
  const out = [];
  out.push(new Paragraph({ children: [new PageBreak()] }));
  out.push(para(run(ep.title, { size: 36, bold: true, color: INK }), { heading: HeadingLevel.HEADING_1, after: 160 }));
  const original = ep.status.some((s) => s.includes("النص الأصلي —"));
  out.push(para(ep.status.map((s, k) => run((k ? " " : "") + s, { size: 21, color: original ? INK : WARN })), {
    shading: { type: ShadingType.CLEAR, fill: original ? "EEF3E6" : "F8E9DF", color: "auto" },
    border: { right: { style: BorderStyle.SINGLE, size: 18, color: original ? "5B7A3A" : WARN, space: 6 } },
    after: 240, line: 320,
  }));
  for (const sec of ep.sections) {
    out.push(para([run(sec.name, { size: 28, bold: true, color: GOLD }), run(`   ${sec.file}`, { size: 18, color: GREY })], {
      heading: HeadingLevel.HEADING_2, before: 240, after: 80, keepNext: true,
      border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "DCCDAE", space: 2 } },
    }));
    for (const it of sec.items) {
      if (it.kind === "note") {
        const warn = it.text.includes("⚠") || it.text.includes("تصحيح يدوي");
        out.push(para(run(it.text, { size: 17, color: warn ? WARN : GREY }), { after: 20, keepNext: true }));
      } else if (it.kind === "direction") {
        out.push(para(run(it.text, { size: 22, italics: true, color: GOLD }), { after: 20, keepNext: true }));
      } else {
        out.push(para(run(it.text, { size: 26 }), { after: 140, line: 360 }));
      }
    }
  }
  return out;
}

function summaryTable(eps) {
  const widths = [1700, 2600, 4726];  // DXA, sums to the A4 text width with 1" margins
  const cell = (text, w, opts = {}) => new TableCell({
    width: { size: w, type: WidthType.DXA },
    shading: opts.fill ? { type: ShadingType.CLEAR, fill: opts.fill, color: "auto" } : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: [para(run(text, { size: 20, bold: !!opts.bold, color: opts.color }), { after: 0 })],
  });
  const rows = [new TableRow({ tableHeader: true, children: [
    cell("الحلقة", widths[0], { bold: true, fill: "EFE3C8" }), cell("المصدر", widths[1], { bold: true, fill: "EFE3C8" }),
    cell("الشخصيات (والملف)", widths[2], { bold: true, fill: "EFE3C8" })] })];
  for (const ep of eps) {
    const original = ep.status.some((s) => s.includes("النص الأصلي —"));
    rows.push(new TableRow({ children: [
      cell(ep.title.replace(/^الحلقة\s+/, ""), widths[0]),
      cell(original ? "النص الأصلي (مستعاد حرفيا)" : "تفريغ مستعاد من التسجيل", widths[1], { color: original ? "3E5A22" : WARN }),
      cell(ep.sections.map((s) => s.name).join("، "), widths[2]),
    ] }));
  }
  return new Table({ visuallyRightToLeft: true, width: { size: 9026, type: WidthType.DXA }, columnWidths: widths, rows });
}

function main() {
  const args = process.argv.slice(2);
  let out = "scripts.docx", title = "نصوص الحلقات";
  const files = [];
  for (let k = 0; k < args.length; k++) {
    if (args[k] === "-o") out = args[++k];
    else if (args[k] === "--title") title = args[++k];
    else files.push(args[k]);
  }
  const eps = files.map(parse);
  const intro = [
    para(run(title, { size: 44, bold: true, color: INK }), { alignment: AlignmentType.CENTER, after: 120 }),
    para(run("حكايا · ثم اهتديت — محمد التيجاني السماوي", { size: 26, color: GOLD }), { alignment: AlignmentType.CENTER, after: 360 }),
    para(run("كل شخصية في قسم مستقل يحمل اسمها واسم ملفها الصوتي. تعليمات الأداء بين أقواس مربعة ولا تُعرض في التطبيق. " +
      "الأسطر الصغيرة الرمادية ملاحظات: الملف والزمن داخل التسجيل، وسبب نسبة الملف إلى الشخصية، والتصحيحات اليدوية. " +
      "ترتيب الأقسام هنا حسب الشخصيات وليس ترتيب التشغيل.", { size: 22 }), { after: 240, line: 340 }),
    summaryTable(eps),
  ];
  const doc = new Document({
    creator: "HIKAYA tools", title, description: "Recovered per-character TTS scripts",
    styles: { default: { document: { run: { font: FONT, size: 24, rightToLeft: true } } } },
    sections: [{
      properties: { page: { margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } } },
      footers: { default: new Footer({ children: [para([run("صفحة ", { size: 18, color: GREY }),
        new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 18, color: GREY })], { alignment: AlignmentType.CENTER, after: 0 })] }) },
      children: [...intro, ...eps.flatMap((ep) => episodeBlocks(ep))],
    }],
  });
  Packer.toBuffer(doc).then((buf) => {
    fs.writeFileSync(out, buf);
    console.log(`${path.basename(out)}: ${eps.length} episodes, ${eps.reduce((n, e) => n + e.sections.length, 0)} character sections`);
  });
}

main();
