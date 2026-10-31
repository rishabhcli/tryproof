import { CONCERNS, LABELS, LEVERS, sev, summarize } from './rules.mjs';
import { runLoop, UNITS } from './pipeline.mjs';

const $ = (s, r = document) => r.querySelector(s);
const el = (tag, attrs = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') n.className = v; else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else if (v === true) n.setAttribute(k, ''); else if (v !== false && v != null) n.setAttribute(k, v);
  }
  for (const k of kids.flat()) if (k != null) n.append(k.nodeType ? k : document.createTextNode(k));
  return n;
};
const FACES = ['maya', 'dev', 'rosa'];
const cache = {};

// ---------- mode switch ----------
function setMode(live) {
  $('#tab-demo').setAttribute('aria-selected', String(!live));
  $('#tab-live').setAttribute('aria-selected', String(live));
  $('#demo-panel').hidden = live; $('#live-panel').hidden = !live;
}
$('#tab-demo').onclick = () => setMode(false);
$('#tab-live').onclick = () => setMode(true);

// ---------- demo mode ----------
async function load(id) {
  if (!cache[id]) cache[id] = await fetch(`cache/${id}/result.json`).then((r) => r.json());
  return cache[id];
}
async function initFaces() {
  const box = $('#faces');
  for (const id of FACES) {
    let r; try { r = await load(id); } catch { continue; }
    box.append(el('button', { class: 'face', role: 'listitem', 'aria-pressed': 'false', 'data-id': id, onclick: () => pick(id) },
      el('img', { src: `cache/${id}/before.jpg`, alt: `${r.name}, an AI-generated sample face`, loading: 'lazy' }),
      el('span', {}, el('b', {}, r.name), r.blurb)));
  }
}
async function pick(id) {
  document.querySelectorAll('.face').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === id)));
  const r = await load(id);
  await replay(r);
  render(r, { base: '' });
}
// Replays the recorded run's steps so the order of API calls is visible. Nothing is computed or faked here.
async function replay(r) {
  const labels = r.calls.map((c) => stepLabel(c.task));
  showProgress('Replaying the recorded run', labels);
  for (let i = 0; i < labels.length; i++) { mark(i, 'on'); await sleep(260); mark(i, 'done'); }
  $('#progress').hidden = true;
}
const stepLabel = (t) => ({ analyze: 'Skin Analysis', tone: 'Facial Color Tones', tryOn: 'Makeup Virtual Try-On' }[t]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function showProgress(title, labels) {
  $('#progress').hidden = false; $('#progress-title').textContent = title;
  const ol = $('#steps'); ol.replaceChildren(...labels.map((l) => el('li', {}, l)));
}
const mark = (i, cls) => { const li = $('#steps').children[i]; if (li) li.className = cls; };

// ---------- rendering ----------
const band = (s) => (s < 60 ? 'low' : s < 80 ? 'mid' : '');
function bars(scores, { pressed, onPick } = {}) {
  return el('div', { class: 'bars' }, CONCERNS.map((k) => {
    const s = scores[k].ui_score ?? scores[k];
    return el('button', { class: 'bar', type: 'button', 'aria-pressed': String(pressed === k), 'aria-label': `${LABELS[k]} ${s} of 100. Show where it was found.`, onclick: () => onPick?.(k) },
      el('span', {}, LABELS[k]), el('span', { class: 'track' }, el('span', { class: `fill ${band(s)}`, style: `width:${s}%;display:block` })), el('span', { class: 'num' }, String(s)));
  }));
}
function chip(d) { return el('span', { class: `chip ${d > 0 ? 'up' : d < 0 ? 'dn' : 'eq'}` }, d > 0 ? `+${d}` : String(d)); }
function compare(beforeSrc, afterSrc, labelA, labelB) {
  const wrap = el('div', { class: 'compare' });
  const top = el('img', { class: 'top-img', src: afterSrc, alt: labelB });
  const range = el('input', { type: 'range', min: 0, max: 100, value: 50, 'aria-label': 'Drag to compare before and after' });
  const handle = el('div', { class: 'handle' });
  range.addEventListener('input', () => { top.style.clipPath = `inset(0 0 0 ${range.value}%)`; handle.style.left = `${range.value}%`; });
  wrap.append(el('img', { src: beforeSrc, alt: labelA }), top, handle, el('span', { class: 'tag l' }, labelA), el('span', { class: 'tag r' }, labelB), range);
  return wrap;
}
const levelWord = (n) => (n < 35 ? 'light' : n < 60 ? 'medium' : n < 80 ? 'medium-full' : 'full');

function render(r, { base }) {
  const img = (p) => (p.startsWith('data:') || p.startsWith('blob:') || p.startsWith('http') ? p : base + p);
  const chosen = r.rounds.find((x) => x.n === r.chosen) || r.rounds[0];
  const beforeSrc = r.beforeSrc || img(`cache/${r.id}/before.jpg`);

  // 1. read
  const photoBox = el('div', { class: 'photo' }, el('img', { src: beforeSrc, alt: 'Face with the selected concern highlighted' }));
  const maskFor = (k) => (r.masks?.[k]) || (r.id && !r.live ? img(`cache/${r.id}/masks/${k}.jpg`) : null);
  let sel = null;
  const barsBox = el('div');
  const draw = () => {
    barsBox.replaceChildren(bars(r.before.scores, { pressed: sel, onPick: (k) => { sel = sel === k ? null : k; draw(); const m = sel && maskFor(sel); photoBox.firstChild.src = m || beforeSrc; } }));
  };
  draw();
  $('#c-read').replaceChildren(
    el('h2', {}, '1. Skin read'),
    el('p', { class: 'muted' }, 'Skin Analysis scores each concern from 0 to 100, where higher means clearer. Tap a row to see where the model found it.'),
    el('div', { class: 'read' }, photoBox, barsBox));

  // 2. prescription
  const rx = r.rx0;
  const lever = (k) => el('div', { class: 'lever' }, el('span', {}, LEVERS[k].label), el('span', { class: 'track' }, el('span', { class: 'fill', style: `width:${rx.levers[k]}%;display:block` })), el('span', { class: 'num' }, String(rx.levers[k])));
  $('#c-rx').replaceChildren(
    el('h2', {}, '2. Prescription'),
    el('p', { class: 'muted' }, 'A plain rules engine turns the scores into the settings sent to Makeup Virtual Try-On.'),
    el('p', {}, el('span', { class: 'swatch', style: `background:${rx.skin}` }), `Shade from Facial Color Tones: ${rx.skin}`),
    el('div', { class: 'levers' }, Object.keys(LEVERS).map(lever)),
    rx.reasons.map((x) => el('p', { class: 'reason' }, x.text)));

  // 3. proof
  const tabsBox = el('div', { class: 'tabs' });
  const stage = el('div');
  const tableBox = el('div');
  const views = r.rounds.map((x) => ({ key: `rx${x.n}`, label: r.rounds.length > 1 ? `Prescribed, round ${x.n}${x.n === r.chosen ? ' (kept)' : ''}` : 'Prescribed look', data: x }));
  if (r.generic) views.push({ key: 'gen', label: 'One-size preset', data: r.generic });
  let cur = views.find((v) => v.data === chosen);
  const show = () => {
    tabsBox.replaceChildren(...views.map((v) => el('button', { type: 'button', 'aria-pressed': String(v === cur), onclick: () => { cur = v; show(); } }, v.label)));
    stage.replaceChildren(compare(beforeSrc, img(cur.data.image), 'Before', 'Rendered'));
    const d = cur.data.deltas;
    tableBox.replaceChildren(el('table', {},
      el('thead', {}, el('tr', {}, el('th', {}, 'Concern'), el('th', { class: 'n' }, 'Before'), el('th', { class: 'n' }, 'Rendered'), el('th', { class: 'n' }, 'Change'))),
      el('tbody', {}, CONCERNS.map((k) => el('tr', {}, el('td', {}, LABELS[k]), el('td', { class: 'n' }, String(d[k].before)), el('td', { class: 'n' }, String(d[k].after)), el('td', { class: 'n' }, chip(d[k].delta)))))));
  };
  show();
  const notes = [];
  for (const x of r.rounds) for (const c of x.changes || []) {
    const verb = c.kind === 'back_off' ? 'backed off' : 'strengthened';
    const why = c.kind === 'back_off' ? `${LABELS[c.concern].toLowerCase()} read worse after rendering (${c.gain}, now ${c.after})` : `${LABELS[c.concern].toLowerCase()} moved only ${c.gain >= 0 ? '+' : ''}${c.gain} (now ${c.after})`;
    notes.push(`${LEVERS[c.lever].label} ${verb} from ${c.from} to ${c.to} because ${why}.`);
  }
  const sum = summarize(chosen.deltas);
  const callouts = [];
  if (notes.length) callouts.push(el('div', { class: 'callout warn' }, el('b', {}, 'Verifier caught something. '), notes.join(' '), r.rounds.length > 1 ? ` TryProof rendered again and kept round ${r.chosen}, the better of the two by score.` : ''));
  else callouts.push(el('div', { class: 'callout ok' }, el('b', {}, 'Verifier passed. '), 'No setting made a concern read worse, so the first render was kept.'));
  if (r.generic) callouts.push(el('p', { class: 'muted' }, `For comparison, the same one-size preset on this face changed the scores by ${r.generic.summary.mean >= 0 ? '+' : ''}${r.generic.summary.mean} on average, against ${sum.mean >= 0 ? '+' : ''}${sum.mean} for the prescribed look. Averages are close. The difference TryProof makes is that every look is scored against this skin and checked for regressions before it is shown.`));
  $('#c-proof').replaceChildren(
    el('h2', {}, '3. Try-on, scored again'),
    el('p', { class: 'muted' }, 'Drag the photo to compare. The scores come from running Skin Analysis on the rendered image, so they describe how the render reads to the model, not a clinical result.'),
    tabsBox, stage, tableBox, callouts,
    el('p', { class: 'muted' }, `${sum.improved} of 8 concerns improved, ${sum.worse} read worse.`));

  // 4. shelf
  const L = chosen.rx.levers;
  const item = (title, text) => el('div', { class: 'item' }, el('b', {}, title), el('span', {}, text));
  $('#c-shelf').replaceChildren(
    el('h2', {}, '4. What to shop for'),
    el('p', { class: 'muted' }, 'The verified settings written as a product spec a shopper or counter assistant can use. No brands are implied.'),
    el('div', { class: 'shelf' },
      item('Base', `Shade near ${rx.skin}, ${levelWord(L.coverage)} coverage (${L.coverage}), ${chosen.rx.finish}.`),
      item('Under-eye corrector', `Shade near ${chosen.rx.concealerShade}, ${levelWord(L.underEye)} strength (${L.underEye}).`),
      item('Smoothing primer', `${levelWord(L.smooth)} blur effect (${L.smooth}).`)));

  // 5. under the hood
  const tally = {}; for (const c of r.calls) tally[c.task] = (tally[c.task] || 0) + 1;
  $('#c-hood').replaceChildren(
    el('h2', {}, 'Under the hood'),
    el('p', { class: 'muted' }, `${r.calls.length} YouCam API tasks, about ${r.units} units for this face.`),
    el('ul', { class: 'calls' },
      el('li', {}, el('code', {}, 'skin-analysis'), ` ${tally.analyze} calls: 8 concerns before, then again on every render.`),
      el('li', {}, el('code', {}, 'skin-tone-analysis'), ` ${tally.tone || 0} call: skin shade for foundation and concealer.`),
      el('li', {}, el('code', {}, 'makeup-vto'), ` ${tally.tryOn} calls: skin_smooth, foundation and concealer effects set by the prescription.`)),
    r.live ? null : el('p', { class: 'muted' }, `Recorded ${new Date(r.created).toLocaleDateString('en-US', { dateStyle: 'medium' })} on an AI-generated face. Switch to Live to run your own selfie with your own key.`));
  $('#result').hidden = false;
  $('#c-read').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ---------- live mode ----------
let liveFile = null;
const keyEl = $('#key'), photoEl = $('#photo'), runBtn = $('#run-live');
const ready = () => { runBtn.disabled = !(keyEl.value.trim().startsWith('sk-') && liveFile); };
keyEl.addEventListener('input', ready);
photoEl.addEventListener('change', async () => { liveFile = photoEl.files[0] ? await resize(photoEl.files[0]) : null; ready(); });
async function resize(file) {
  const bmp = await createImageBitmap(file);
  const s = Math.min(1, 1280 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.9);
}
async function post(path, body) {
  const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-youcam-key': keyEl.value.trim() }, body: JSON.stringify(body) });
  const j = await r.json(); if (!r.ok) throw new Error(j.error || r.statusText); return j;
}
async function poll(task, id) {
  for (let i = 0; i < 60; i++) {
    await sleep(2500);
    const r = await fetch(`/api/poll?task=${task}&id=${encodeURIComponent(id)}`, { headers: { 'x-youcam-key': keyEl.value.trim() } });
    const j = await r.json(); if (!r.ok) throw new Error(j.error || r.statusText);
    if (j.task_status === 'success') return j;
    if (j.task_status === 'error') throw new Error(j.error || 'YouCam task failed');
  }
  throw new Error('Timed out waiting for YouCam');
}
const liveApi = {
  masks: {},
  async analyze(fileId) {
    const { task_id } = await post('/api/start', { task: 'skin-analysis', body: { src_file_id: fileId, dst_actions: CONCERNS, format: 'json', miniserver_args: { enable_mask_overlay: true } } });
    const j = await poll('skin-analysis', task_id);
    const scores = {}, masks = {};
    for (const o of j.results.output) if (CONCERNS.includes(o.type)) { scores[o.type] = { ui_score: o.ui_score }; masks[o.type] = o.mask_urls?.[0]; }
    return { scores, masks };
  },
  async tone(fileId) {
    const { task_id } = await post('/api/start', { task: 'skin-tone-analysis', body: { src_file_id: fileId, face_angle_strictness_level: 'flexible' } });
    return (await poll('skin-tone-analysis', task_id)).results.color;
  },
  async tryOn(fileId, effects) {
    const { task_id } = await post('/api/start', { task: 'makeup-vto', body: { version: '1.0', src_file_id: fileId, effects } });
    const j = await poll('makeup-vto', task_id);
    return { fileId: j.file_id, image: j.image };
  },
};
runBtn.onclick = async () => {
  runBtn.disabled = true; $('#live-note').textContent = '';
  const labels = ['Uploading the photo', 'Skin Analysis', 'Facial Color Tones', 'Makeup Virtual Try-On', 'Skin Analysis on the render', 'Checking and re-rendering if needed', 'One-size preset for comparison'];
  showProgress('Running live', labels);
  let i = 0; mark(0, 'on');
  try {
    const { file_id } = await post('/api/upload', { image: liveFile });
    mark(0, 'done');
    let first = null;
    const wrapped = { ...liveApi, analyze: async (f) => { const a = await liveApi.analyze(f); first ||= a; return a; } };
    const res = await runLoop({ api: wrapped, fileId: file_id, onStep: (m) => { i = Math.min(i + 1, labels.length - 1); mark(i - 1, 'done'); mark(i, 'on'); $('#live-note').textContent = m; } });
    $('#progress').hidden = true;
    render({ id: 'live', live: true, created: new Date().toISOString(), beforeSrc: liveFile, masks: first.masks, ...res }, { base: '' });
  } catch (e) {
    $('#progress').hidden = true; $('#live-note').textContent = `Could not finish: ${e.message}`;
  } finally { ready(); }
};

initFaces();
