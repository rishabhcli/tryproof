// Stage 1: for each sample face run Skin Analysis (8 concerns, SD) + Facial Color Tones, cache real results.
import fs from 'node:fs';
import { makeClient } from '../lib/youcam.mjs';
const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').trim().split('\n').map((l) => l.split(/=(.*)/s).slice(0, 2)));
const api = makeClient({ key: env.YOUCAM_API_KEY, base: env.YOUCAM_BASE });
const CONCERNS = ['redness', 'acne', 'dark_circle_v2', 'texture', 'pore', 'radiance', 'oiliness', 'age_spot'];
const faces = process.argv.slice(2);
for (const id of faces) {
  const dir = `public/cache/${id}`; fs.mkdirSync(`${dir}/masks`, { recursive: true });
  const buf = fs.readFileSync(`public/samples/${id}.jpg`);
  fs.copyFileSync(`public/samples/${id}.jpg`, `${dir}/before.jpg`);
  const file_id = await api.upload(buf, `${id}.jpg`, 'image/jpeg');
  if (!fs.existsSync(`${dir}/analysis0.json`)) {
    const a = await api.run('skin-analysis', { src_file_id: file_id, dst_actions: CONCERNS, format: 'json', miniserver_args: { enable_mask_overlay: true } });
    const out = {};
    for (const o of a.results.output) {
      if (!CONCERNS.includes(o.type)) continue;
      out[o.type] = { ui_score: o.ui_score, raw_score: o.raw_score };
      const mu = o.mask_urls?.[0];
      if (mu) { const r = await fetch(mu); if (r.ok) fs.writeFileSync(`${dir}/masks/${o.type}.jpg`, Buffer.from(await r.arrayBuffer())); }
    }
    fs.writeFileSync(`${dir}/analysis0.json`, JSON.stringify(out, null, 1));
    console.log(id, 'analysis', Object.entries(out).map(([k, v]) => `${k}:${v.ui_score}`).join(' '));
  }
  if (!fs.existsSync(`${dir}/tone.json`)) {
    const t = await api.run('skin-tone-analysis', { src_file_id: file_id, face_angle_strictness_level: 'flexible' });
    fs.writeFileSync(`${dir}/tone.json`, JSON.stringify(t.results.color, null, 1));
    console.log(id, 'tone', JSON.stringify(t.results.color));
  }
}
