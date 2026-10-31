// Records the demo with local headless Chromium. Output: demo/raw/*.webm + demo/marks.json
import { chromium } from '/Users/m3-max/.npm/_npx/86170c4cd1c5da32/node_modules/playwright/index.mjs';
import fs from 'node:fs'; import path from 'node:path';
const ROOT = '/Users/m3-max/Documents/GitHub/tryproof';
const LIVE = process.env.APP_URL || 'https://tryproof-sepia2.vercel.app';
const env = Object.fromEntries(fs.readFileSync(`${ROOT}/.env.local`, 'utf8').trim().split('\n').map((l) => l.split(/=(.*)/s).slice(0, 2)));
const dur = [1, 2, 3, 4, 5, 6].map((i) => parseFloat(fs.readFileSync(`${ROOT}/demo/audio/dur${i}.txt`, 'utf8')));
fs.rmSync(`${ROOT}/demo/raw`, { recursive: true, force: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const ctxStart = Date.now();
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, recordVideo: { dir: `${ROOT}/demo/raw`, size: { width: 1920, height: 1080 } } });
const page = await ctx.newPage();
await page.goto(`file://${ROOT}/demo/stage.html?u=${encodeURIComponent(LIVE)}`);
const frame = await (await page.waitForSelector('#app')).contentFrame();
await frame.waitForSelector('.face', { timeout: 30000 });
const cap = (s, t, d, a) => page.evaluate(([s, t, d, a]) => setCaption(s, t, d, a), [s, t, d, a]);
const scrollTo = (sel, block = 'start') => frame.evaluate(([sel, block]) => document.querySelector(sel).scrollIntoView({ behavior: 'smooth', block }), [sel, block]);
const wait = (ms) => page.waitForTimeout(ms);
const t0 = Date.now(); const marks = { offset: (t0 - ctxStart) / 1000 };
const now = () => (Date.now() - t0) / 1000;
const hold = async (name, i, fn) => { marks[name] = now(); const p = fn ? fn() : Promise.resolve(); await p; const rest = dur[i] + 0.5 - (now() - marks[name]); if (rest > 0) await wait(rest * 1000); };

await cap('The idea', 'A try-on that checks itself', 'Render a look, then check it against the same skin model.', ['skin-analysis', 'skin-tone-analysis', 'makeup-vto']);
await hold('p1', 0, async () => { await wait(5500); await scrollTo('#faces', 'center'); });

await cap('1  Read', 'Skin Analysis + Color Tones', 'Eight concerns scored 0 to 100, higher is clearer. Tap a row to see where it was found.', ['skin-analysis', 'skin-tone-analysis']);
await hold('p2', 1, async () => {
  await frame.click('.face[data-id="dev"]');
  await frame.waitForSelector('#result:not([hidden])', { timeout: 20000 });
  await wait(1500);
  await frame.locator('.bar').nth(3).click(); await wait(2500);   // texture overlay
  await frame.locator('.bar').nth(6).click();                      // oiliness overlay
});

await cap('2  Prescribe', 'Scores set the try-on', 'Smoothing, coverage, glow and under-eye strength, each with a reason.', ['makeup-vto']);
await hold('p3', 2, async () => { await scrollTo('#c-rx'); await wait(5000); await scrollTo('#c-rx .reason', 'center'); });

await cap('3  Prove', 'Skin Analysis scores the render', 'Worse? It backs the setting off and renders again.', ['skin-analysis', 'makeup-vto']);
await hold('p4', 3, async () => {
  await scrollTo('#c-proof'); await wait(2500);
  await frame.locator('#c-proof .tabs button').nth(0).click(); await wait(2500);
  await scrollTo('#c-proof table', 'center'); await wait(3500);
  await frame.locator('#c-proof .tabs button').nth(1).click(); await wait(2000);
  await scrollTo('#c-proof .callout', 'center'); await wait(3500);
  await frame.locator('#c-proof .tabs button').nth(2).click();
});

await cap('4  Shop', 'A spec a shopper can use', 'Shade, coverage and finish, written as plain product requirements.', []);
await hold('p5', 4, async () => { await scrollTo('#c-shelf'); });

await cap('Live mode', 'Your selfie, your key', 'A real run: upload, skin read, try-on, re-score, verdict.', ['skin-analysis', 'skin-tone-analysis', 'makeup-vto']);
marks.p6 = now();
await frame.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' })); await wait(800);
await frame.click('#tab-live'); await wait(600);
await frame.locator('#key').fill(env.YOUCAM_API_KEY);
await frame.locator('#photo').setInputFiles(`${ROOT}/public/samples/maya.jpg`); await wait(800);
marks.liveStart = now();
await frame.click('#run-live');
let ok = false;
try { await frame.waitForSelector('#result:not([hidden]) #c-hood h2', { timeout: 150000 }); ok = true; } catch {}
marks.liveDone = now(); marks.liveOk = ok;
if (ok) { await wait(1500); await scrollTo('#c-proof'); await wait(4000); await scrollTo('#c-read'); await wait(2500); }
else { marks.note = await frame.locator('#live-note').textContent(); await wait(3000); }
marks.end = now();
await page.screenshot({ path: `${ROOT}/demo/last-frame.png` });
const vpath = await page.video().path();
await ctx.close(); await browser.close();
marks.video = vpath;
fs.writeFileSync(`${ROOT}/demo/marks.json`, JSON.stringify(marks, null, 1));
console.log(JSON.stringify(marks));
