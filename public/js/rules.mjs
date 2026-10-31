// TryProof rules engine: turns Skin AI scores into Makeup VTO parameters, and decides when to adjust.
// Scores are YouCam ui_score values (0-100, higher = clearer skin).

export const CONCERNS = ['redness', 'acne', 'dark_circle_v2', 'texture', 'pore', 'radiance', 'oiliness', 'age_spot'];
export const LABELS = {
  redness: 'Redness', acne: 'Blemishes', dark_circle_v2: 'Dark circles', texture: 'Texture',
  pore: 'Pores', radiance: 'Radiance', oiliness: 'Oiliness', age_spot: 'Spots',
};
// Which prescription lever is expected to move which concern.
export const LEVERS = {
  smooth: { label: 'Skin smoothing', concerns: ['texture', 'pore'] },
  coverage: { label: 'Foundation coverage', concerns: ['redness', 'acne', 'age_spot'] },
  glow: { label: 'Foundation glow', concerns: ['radiance'] },
  underEye: { label: 'Under-eye concealer', concerns: ['dark_circle_v2'] },
};

const clamp = (n, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, Math.round(n)));
export const sev = (score) => Math.max(0, Math.min(1, (92 - score) / 50)); // 92+ = no action, 42 = worst

const score = (s, k) => (typeof s[k] === 'number' ? s[k] : s[k]?.ui_score ?? 92);

export function lighten(hex, amount = 0.1) {
  const h = hex.replace('#', '');
  const c = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  const out = c.map((v) => clamp(v + (255 - v) * amount, 0, 255));
  return '#' + out.map((v) => v.toString(16).padStart(2, '0')).join('');
}

export function prescribe(scores, tone) {
  const s = Object.fromEntries(CONCERNS.map((k) => [k, sev(score(scores, k))]));
  const skin = tone?.skin_color || '#c8a28a';
  const oily = s.oiliness > 0.25;
  const rx = {
    skin,
    concealerShade: lighten(skin, 0.1),
    levers: {
      smooth: clamp(25 + 60 * Math.max(s.texture, s.pore)),
      coverage: clamp(35 + 55 * Math.max(s.redness, s.acne, s.age_spot)),
      glow: oily ? 0 : clamp(10 + 40 * s.radiance),
      underEye: clamp(25 + 65 * s.dark_circle_v2),
    },
    finish: oily ? 'matte' : 'natural glow',
    reasons: [],
  };
  const L = LABELS;
  const why = (lever, concerns, text) => rx.reasons.push({ lever, concerns, text });
  why('smooth', ['texture', 'pore'], `${L.texture} ${score(scores, 'texture')} and ${L.pore.toLowerCase()} ${score(scores, 'pore')} set smoothing to ${rx.levers.smooth}.`);
  why('coverage', ['redness', 'acne', 'age_spot'], `Weakest of redness ${score(scores, 'redness')}, blemishes ${score(scores, 'acne')}, spots ${score(scores, 'age_spot')} sets coverage to ${rx.levers.coverage}.`);
  why('underEye', ['dark_circle_v2'], `${L.dark_circle_v2} ${score(scores, 'dark_circle_v2')} sets under-eye concealer to ${rx.levers.underEye}.`);
  why('glow', ['radiance', 'oiliness'], oily
    ? `${L.oiliness} ${score(scores, 'oiliness')} is high, so glow is held at 0 for a matte finish.`
    : `${L.radiance} ${score(scores, 'radiance')} sets glow to ${rx.levers.glow}.`);
  return rx;
}

// The same look for everyone: the ablation baseline.
export function genericLook(tone) {
  const skin = tone?.skin_color || '#c8a28a';
  return { skin, concealerShade: lighten(skin, 0.1), levers: { smooth: 50, coverage: 50, glow: 20, underEye: 50 }, finish: 'generic preset', reasons: [] };
}

export function toEffects(rx) {
  return [
    { category: 'skin_smooth', skinSmoothStrength: rx.levers.smooth, skinSmoothColorIntensity: 40 },
    { category: 'foundation', palettes: [{ color: rx.skin, colorIntensity: 35, glowIntensity: rx.levers.glow, coverageIntensity: rx.levers.coverage }] },
    { category: 'concealer', palettes: [{ color: rx.concealerShade, colorIntensity: 45, colorUnderEyeIntensity: rx.levers.underEye, coverageLevel: clamp(35 + 0.5 * rx.levers.coverage) }] },
  ];
}

export function deltas(before, after) {
  return Object.fromEntries(CONCERNS.map((k) => [k, { before: score(before, k), after: score(after, k), delta: score(after, k) - score(before, k) }]));
}

// Feedback step. For each lever, look at the concerns it is meant to move:
//  - a concern that got WORSE (drop of regressAt or more) means the setting is too strong, so back it off by 25
//  - otherwise, a concern that barely moved and is still weak gets a stronger setting by 25
// Runs once, so a run costs at most one extra render and one extra re-score.
export function adjust(rx, before, after, { minGain = 3, regressAt = 3, goodEnough = 90 } = {}) {
  const d = deltas(before, after);
  const next = JSON.parse(JSON.stringify(rx));
  const changes = [];
  for (const [lever, info] of Object.entries(LEVERS)) {
    if (lever === 'glow' && rx.levers.glow === 0) continue; // oily skin stays matte on purpose
    const targets = info.concerns.filter((c) => sev(d[c].before) > 0);
    if (!targets.length) continue;
    const from = rx.levers[lever];
    const regressed = targets.filter((c) => d[c].delta <= -regressAt).sort((a, b) => d[a].delta - d[b].delta)[0];
    if (regressed && from > 0) {
      next.levers[lever] = clamp(from - 25);
      changes.push({ lever, from, to: next.levers[lever], concern: regressed, gain: d[regressed].delta, after: d[regressed].after, kind: 'back_off' });
      continue;
    }
    const worst = targets.reduce((a, b) => (d[a].after <= d[b].after ? a : b));
    if (d[worst].delta < minGain && d[worst].after < goodEnough && from < 100) {
      next.levers[lever] = clamp(from + 25);
      changes.push({ lever, from, to: next.levers[lever], concern: worst, gain: d[worst].delta, after: d[worst].after, kind: 'strengthen' });
    }
  }
  return { rx: next, changes };
}

// How good a render is for THIS skin: gains on the concerns that needed work, regressions count double.
export function objective(d) {
  let total = 0;
  for (const v of Object.values(d)) {
    if (sev(v.before) <= 0) { if (v.delta < 0) total += 2 * v.delta; continue; }
    total += v.delta >= 0 ? v.delta : 2 * v.delta;
  }
  return Math.round(total * 10) / 10;
}

export function summarize(d) {
  const rows = Object.entries(d);
  const improved = rows.filter(([, v]) => v.delta > 0).length;
  const worse = rows.filter(([, v]) => v.delta < 0).length;
  const mean = rows.reduce((a, [, v]) => a + v.delta, 0) / rows.length;
  return { improved, worse, mean: Math.round(mean * 10) / 10 };
}
