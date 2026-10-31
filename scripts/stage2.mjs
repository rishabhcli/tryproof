// Stage 2: run the full loop for each cached face and write real results + rendered images to public/cache/<id>/.
import fs from 'node:fs';
import { makeClient } from '../lib/youcam.mjs';
import { runLoop } from '../public/js/pipeline.mjs';
import { CONCERNS } from '../public/js/rules.mjs';
const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').trim().split('\n').map((l) => l.split(/=(.*)/s).slice(0, 2)));
const yc = makeClient({ key: env.YOUCAM_API_KEY, base: env.YOUCAM_BASE });
const NAMES = { maya: 'Maya', dev: 'Dev', rosa: 'Rosa' };
const BLURB = { maya: 'Redness and blemishes', dev: 'Oily skin and rough texture', rosa: 'Dark circles and spots' };

for (const id of process.argv.slice(2)) {
  const dir = `public/cache/${id}`;
  if (fs.existsSync(`${dir}/result.json`)) { console.log(id, 'already cached'); continue; }
  const scores = JSON.parse(fs.readFileSync(`${dir}/analysis0.json`));
  const tone = JSON.parse(fs.readFileSync(`${dir}/tone.json`));
  const fileId = await yc.upload(fs.readFileSync(`${dir}/before.jpg`), `${id}.jpg`, 'image/jpeg');
  const imgs = {};
  const api = {
    analyze: async (fid) => {
      const a = await yc.run('skin-analysis', { src_file_id: fid, dst_actions: CONCERNS, format: 'json' });
      const s = {}; for (const o of a.results.output) if (CONCERNS.includes(o.type)) s[o.type] = { ui_score: o.ui_score, raw_score: o.raw_score };
      return { scores: s };
    },
    tone: async () => tone,
    tryOn: async (fid, effects) => {
      const v = await yc.run('makeup-vto', { version: '1.0', src_file_id: fid, effects });
      const { file_id, buf } = await yc.rehost(v.results.url);
      const name = `render${Object.keys(imgs).length}.jpg`; fs.writeFileSync(`${dir}/${name}`, buf); imgs[name] = 1;
      return { fileId: file_id, image: `cache/${id}/${name}` };
    },
  };
  const res = await runLoop({ api, fileId, before: { scores }, tone, onStep: (m) => console.log(id, m) });
  const out = { id, name: NAMES[id], blurb: BLURB[id], synthetic: true, created: new Date().toISOString(), ...res };
  fs.writeFileSync(`${dir}/result.json`, JSON.stringify(out, null, 1));
  console.log(id, 'DONE units', res.units, 'rounds', res.rounds.length, 'rx mean', res.rounds.map((r) => r.summary.mean), 'generic mean', res.generic?.summary.mean);
}
