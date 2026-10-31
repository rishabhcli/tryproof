import { clientFor, wrap, TASKS } from './_proxy.js';
export default wrap(async (req) => {
  if (req.method !== 'POST') { const e = new Error('POST only'); e.status = 405; throw e; }
  const { task, body } = req.body || {};
  if (!TASKS.has(task)) { const e = new Error('Task not allowed'); e.status = 400; throw e; }
  if (!body?.src_file_id || body.src_file_url) { const e = new Error('Use src_file_id from /api/upload'); e.status = 400; throw e; }
  return { task_id: await clientFor(req).start(task, body) };
});
