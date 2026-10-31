import { clientFor, wrap, TASKS } from './_proxy.js';
export default wrap(async (req) => {
  const { task, id } = req.query || {};
  if (!TASKS.has(task) || !id) { const e = new Error('Bad request'); e.status = 400; throw e; }
  const yc = clientFor(req);
  const s = await yc.status(task, id);
  if (task === 'makeup-vto' && s.task_status === 'success' && s.results?.url) {
    // Re-host the render so it can be scored again (YouCam cannot fetch its own long signed URLs) and so the browser gets pixels.
    const { file_id, buf, type } = await yc.rehost(s.results.url);
    return { task_status: 'success', file_id, image: `data:${type};base64,${buf.toString('base64')}` };
  }
  if (s.task_status === 'error') return { task_status: 'error', error: s.error || s.error_message || 'task failed' };
  return s;
});
