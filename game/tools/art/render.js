/* تصوير رسومات SVG/HTML إلى PNG عبر Chromium (Playwright) */
'use strict';
const path = require('path');
const { chromium } = require('playwright');

const FONTS = `
@font-face{font-family:Rakkas;src:url(file://${path.join(__dirname, 'fonts', 'rakkas-arabic.woff2')})}
@font-face{font-family:Lalezar;src:url(file://${path.join(__dirname, '..', '..', 'fonts', 'lalezar-arabic.woff2')})}
@font-face{font-family:Amiri;font-weight:700;src:url(file://${path.join(__dirname, '..', '..', 'fonts', 'amiri-arabic.woff2')})}
@font-face{font-family:Baloo;font-weight:400 800;src:url(file://${path.join(__dirname, '..', '..', 'fonts', 'baloo-arabic.woff2')})}
`;

let browser = null;
async function open() {
  if (!browser) browser = await chromium.launch();
  return browser;
}
async function close() {
  if (browser) await browser.close();
  browser = null;
}

/** يصوّر محتوى (SVG أو HTML) بأبعاد w×h إلى ملف PNG. transparent = خلفية شفافة */
async function shot(content, w, h, out, { transparent = true, scale = 1 } = {}) {
  const b = await open();
  const page = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: scale });
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>${FONTS}
    html,body{margin:0;padding:0;background:transparent;overflow:hidden}
    #root{position:relative;width:${w}px;height:${h}px;overflow:hidden}
    svg{display:block}</style></head><body><div id="root">${content}</div></body></html>`;
  await page.setContent(html, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(60);
  await page.locator('#root').screenshot({ path: out, omitBackground: transparent });
  await page.close();
}

module.exports = { open, close, shot };
