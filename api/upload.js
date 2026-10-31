import { clientFor, wrap } from './_proxy.js';
export const config = { api: { bodyParser: { sizeLimit: '4mb' } } };
export default wrap(async (req) => {
  if (req.method !== 'POST') { const e = new Error('POST only'); e.status = 405; throw e; }
  const m = /^data:(image\/(?:jpeg|png));base64,(.+)$/.exec(req.body?.image || '');
  if (!m) { const e = new Error('Send a JPEG or PNG data URL in "image".'); e.status = 400; throw e; }
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > 3.5 * 1024 * 1024) { const e = new Error('Image too large'); e.status = 413; throw e; }
  const yc = clientFor(req);
  return { file_id: await yc.upload(buf, m[1] === 'image/png' ? 'face.png' : 'face.jpg', m[1]) };
});
