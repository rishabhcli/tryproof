// Direct YouCam client for Node (build scripts and the Vercel proxy share this).
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function makeClient({ key, base = 'https://yce-api-01.makeupar.com' }) {
  if (!key) throw new Error('Missing YouCam API key');
  const H = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };

  async function upload(buf, name = 'face.jpg', type = 'image/jpeg') {
    const r = await fetch(`${base}/s2s/v2.0/file`, {
      method: 'POST', headers: H,
      body: JSON.stringify({ files: [{ content_type: type, file_name: name, file_size: buf.length }] }),
    }).then((x) => x.json());
    const f = r?.data?.files?.[0];
    if (!f) throw new Error('file init failed: ' + JSON.stringify(r).slice(0, 300));
    const q = f.requests[0];
    const put = await fetch(q.url, { method: q.method || 'PUT', headers: q.headers, body: buf });
    if (!put.ok) throw new Error('file PUT failed ' + put.status);
    return f.file_id;
  }

  async function start(task, body) {
    const r = await fetch(`${base}/s2s/v2.0/task/${task}`, { method: 'POST', headers: H, body: JSON.stringify(body) }).then((x) => x.json());
    if (!r?.data?.task_id) throw new Error(`${task} start failed: ${JSON.stringify(r).slice(0, 300)}`);
    return r.data.task_id;
  }

  async function status(task, id) {
    const r = await fetch(`${base}/s2s/v2.0/task/${task}/${encodeURIComponent(id)}`, { headers: H }).then((x) => x.json());
    return r?.data ?? r;
  }

  async function run(task, body, { tries = 60, every = 2500 } = {}) {
    const id = await start(task, body);
    for (let i = 0; i < tries; i++) {
      await sleep(every);
      const s = await status(task, id);
      if (s.task_status === 'success') return s;
      if (s.task_status === 'error') throw new Error(`${task} error: ${JSON.stringify(s).slice(0, 300)}`);
    }
    throw new Error(`${task} timed out`);
  }

  async function rehost(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error('download failed ' + res.status);
    const buf = Buffer.from(await res.arrayBuffer());
    const type = res.headers.get('content-type') || 'image/jpeg';
    const file_id = await upload(buf, 'rendered.jpg', type.split(';')[0]);
    return { file_id, buf, type };
  }

  return { upload, start, status, run, rehost };
}
