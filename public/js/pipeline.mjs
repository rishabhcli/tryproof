// The TryProof loop. `api` is injected so the same code runs in Node (cache builder) and in the browser (live mode via proxy).
//   api.analyze(fileId) -> { scores: {concern:{ui_score}}, masks: {concern:url} }
//   api.tone(fileId)    -> { skin_color, lip_color, ... }
//   api.tryOn(fileId, effects) -> { fileId, image }   (image is whatever the host can render: URL, data URL or Buffer)
import { prescribe, genericLook, toEffects, adjust, deltas, summarize, objective } from './rules.mjs';

export const UNITS = { analyze: 12, tone: 20, tryOn: 1 };

export async function runLoop({ api, fileId, before, tone, withGeneric = true, onStep = () => {} }) {
  const calls = [];
  const note = (task) => { calls.push({ task, units: UNITS[task] }); };

  if (!before) { onStep('Skin AI is reading the face'); before = await api.analyze(fileId); note('analyze'); }
  if (!tone) { onStep('Reading skin tone for the shade'); tone = await api.tone(fileId); note('tone'); }

  const rx0 = prescribe(before.scores, tone);
  const rounds = [];
  let rx = rx0;
  for (let n = 1; n <= 2; n++) {
    onStep(n === 1 ? 'Rendering the prescribed look' : 'Skin AI asked for a stronger setting, re-rendering');
    const t = await api.tryOn(fileId, toEffects(rx)); note('tryOn');
    onStep('Skin AI is re-scoring the rendered look');
    const after = await api.analyze(t.fileId); note('analyze');
    const d = deltas(before.scores, after.scores);
    const round = { n, rx, image: t.image, scores: after.scores, deltas: d, summary: summarize(d), objective: objective(d) };
    rounds.push(round);
    if (n === 2) break;
    const adj = adjust(rx, before.scores, after.scores);
    round.changes = adj.changes;
    if (!adj.changes.length) break;
    rx = adj.rx;
  }

  let generic = null;
  if (withGeneric) {
    onStep('Rendering the one-size-fits-all preset for comparison');
    const grx = genericLook(tone);
    const t = await api.tryOn(fileId, toEffects(grx)); note('tryOn');
    const after = await api.analyze(t.fileId); note('analyze');
    const d = deltas(before.scores, after.scores);
    generic = { rx: grx, image: t.image, scores: after.scores, deltas: d, summary: summarize(d), objective: objective(d) };
  }
  const chosen = rounds.reduce((a, b) => (b.objective > a.objective ? b : a)).n;
  return { before, tone, rx0, rounds, chosen, generic, calls, units: calls.reduce((a, c) => a + c.units, 0) };
}
