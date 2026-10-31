// Takes README/Devpost screenshots of the running demo with headless Playwright.
import { chromium } from '/Users/m3-max/.npm/_npx/86170c4cd1c5da32/node_modules/playwright/index.mjs';
const base = process.argv[2] || 'http://localhost:5173/';
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const ctx = await b.newContext({ viewport: { width: 414, height: 900 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
await p.goto(base); await p.waitForSelector('.face');
await p.screenshot({ path: 'docs/01-home.png' });
await p.click('.face[data-id="dev"]'); await p.waitForSelector('#result:not([hidden])', { timeout: 15000 }); await p.waitForTimeout(800);
for (const [id, name] of [['c-read', '02-read'], ['c-rx', '03-prescription'], ['c-proof', '04-proof'], ['c-shelf', '05-shelf']]) {
  await p.locator('#' + id).screenshot({ path: `docs/${name}.png` });
}
console.log('errors:', JSON.stringify(errs));
await b.close();
