import test from 'node:test';
import assert from 'node:assert/strict';
import { prescribe, genericLook, toEffects, adjust, deltas, summarize, objective, sev, lighten, CONCERNS } from '../public/js/rules.mjs';

const clear = Object.fromEntries(CONCERNS.map((k) => [k, 95]));
const tone = { skin_color: '#bd9d86' };

test('severity is zero for clear skin and capped at 1', () => {
  assert.equal(sev(95), 0);
  assert.equal(sev(92), 0);
  assert.equal(sev(10), 1);
  assert.ok(sev(62) > sev(80));
});

test('worse scores prescribe stronger levers', () => {
  const mild = prescribe({ ...clear, redness: 85 }, tone);
  const bad = prescribe({ ...clear, redness: 55 }, tone);
  assert.ok(bad.levers.coverage > mild.levers.coverage);
  const dark = prescribe({ ...clear, dark_circle_v2: 50 }, tone);
  assert.ok(dark.levers.underEye > mild.levers.underEye);
});

test('oily skin gets glow 0 and a matte finish', () => {
  const rx = prescribe({ ...clear, oiliness: 55 }, tone);
  assert.equal(rx.levers.glow, 0);
  assert.equal(rx.finish, 'matte');
});

test('dull dry skin gets glow', () => {
  const rx = prescribe({ ...clear, radiance: 60 }, tone);
  assert.ok(rx.levers.glow > 20);
});

test('effects match the YouCam makeup-vto schema', () => {
  const fx = toEffects(prescribe({ ...clear, redness: 60 }, tone));
  assert.deepEqual(fx.map((e) => e.category), ['skin_smooth', 'foundation', 'concealer']);
  const f = fx[1].palettes[0];
  for (const k of ['color', 'colorIntensity', 'glowIntensity', 'coverageIntensity']) assert.ok(k in f);
  assert.match(f.color, /^#[0-9a-f]{6}$/i);
  for (const e of fx) for (const v of JSON.stringify(e).match(/:\d+/g) ?? []) assert.ok(+v.slice(1) <= 100);
});

test('generic look is identical for every face except shade', () => {
  const a = genericLook({ skin_color: '#aaaaaa' });
  const b = genericLook({ skin_color: '#222222' });
  assert.deepEqual(a.levers, b.levers);
});

test('adjust raises only levers whose target concern barely moved, once', () => {
  const before = { ...clear, redness: 60, dark_circle_v2: 60, texture: 60 };
  const rx = prescribe(before, tone);
  const after = { ...before, redness: 90, dark_circle_v2: 61, texture: 80 };
  const { rx: next, changes } = adjust(rx, before, after);
  assert.deepEqual(changes.map((c) => c.lever), ['underEye']);
  assert.equal(next.levers.underEye, rx.levers.underEye + 25 > 100 ? 100 : rx.levers.underEye + 25);
  assert.equal(next.levers.coverage, rx.levers.coverage);
});

test('adjust leaves a matte lever alone', () => {
  const before = { ...clear, oiliness: 55, radiance: 60 };
  const rx = prescribe(before, tone);
  const { changes } = adjust(rx, before, before);
  assert.ok(!changes.some((c) => c.lever === 'glow'));
});

test('deltas and summary', () => {
  const d = deltas({ ...clear, redness: 60 }, { ...clear, redness: 80, pore: 90 });
  assert.equal(d.redness.delta, 20);
  const s = summarize(d);
  assert.equal(s.improved, 1);
  assert.equal(s.worse, 1);
});

test('lighten brightens a shade', () => {
  assert.ok(parseInt(lighten('#808080', 0.1).slice(1, 3), 16) > 0x80);
});

test('adjust backs a lever off when a target concern got worse', () => {
  const before = { ...clear, pore: 75, texture: 52 };
  const rx = prescribe(before, tone);
  const after = { ...before, pore: 63, texture: 64 };
  const { rx: next, changes } = adjust(rx, before, after);
  const c = changes.find((x) => x.lever === 'smooth');
  assert.equal(c.kind, 'back_off');
  assert.ok(next.levers.smooth < rx.levers.smooth);
});

test('objective penalises regressions double and ignores clear concerns that stay clear', () => {
  const b = { ...clear, redness: 60, pore: 70 };
  const good = objective(deltas(b, { ...b, redness: 80, pore: 72 }));
  const regress = objective(deltas(b, { ...b, redness: 80, pore: 60 }));
  assert.equal(good, 22);
  assert.equal(regress, 0);
});
