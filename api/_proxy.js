// Thin allow-listed proxy to the YouCam API. The visitor's own key arrives in the x-youcam-key header,
// is used for this request only, and is never logged or stored. A server key is used only if ALLOW_SERVER_KEY=1.
import { makeClient } from '../lib/youcam.mjs';

export const TASKS = new Set(['skin-analysis', 'skin-tone-analysis', 'makeup-vto']);

export function clientFor(req) {
  const given = String(req.headers['x-youcam-key'] || '').trim();
  const key = given || (process.env.ALLOW_SERVER_KEY === '1' ? process.env.YOUCAM_API_KEY : '');
  if (!/^sk-[A-Za-z0-9_\-]{20,}$/.test(key)) { const e = new Error('Paste your own YouCam API key to use live mode.'); e.status = 401; throw e; }
  return makeClient({ key, base: process.env.YOUCAM_BASE || 'https://yce-api-01.makeupar.com' });
}

export function wrap(fn) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    try { res.status(200).json(await fn(req, res)); }
    catch (e) {
      const msg = String(e.message || e).replace(/sk-[A-Za-z0-9_\-]{10,}/g, 'sk-***');
      res.status(e.status || 502).json({ error: msg });
    }
  };
}
