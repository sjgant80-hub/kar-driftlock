import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as K from './kernel.mjs';

test('validateReadings accepts a strictly increasing sequence', () => {
  const r = K.validateReadings([
    { t: 0, value: 1 },
    { t: 1, value: 2 },
    { t: 2, value: 3 },
    { t: 3, value: 4 },
  ]);
  assert.equal(r.ok, true);
  assert.equal(r.readings.length, 4);
});

test('validateReadings and findStableWindow reject invalid input without throwing', () => {
  const bad = K.validateReadings([
    { t: 0, value: 0 },
    { t: 0, value: 1 },
  ]);
  assert.equal(bad.ok, false);

  const negEps = K.findStableWindow([{ t: 0, value: 0 }], 1, -1);
  assert.equal(negEps.ok, false);
});

test('validateReadings error message pins the exact violating and prior index', () => {
  // Kills the `i - 1` -> `i + 1` mutant in the message template: at index 2,
  // "index 1" and "index 3" are unambiguously different strings, so pinning
  // the exact text forces the true prior index, not a shifted one.
  const bad = K.validateReadings([
    { t: 0, value: 0 },
    { t: 5, value: 1 },
    { t: 5, value: 2 },
  ]);
  assert.equal(bad.ok, false);
  assert.equal(
    bad.why,
    'timestamps must be strictly increasing (index 2 does not exceed index 1)'
  );
});

test('findStableWindow returns a single reading as a length-1 window', () => {
  const r = K.findStableWindow([{ t: 0, value: 5 }], 1, 0.1);
  assert.deepEqual(r, {
    ok: true,
    startIndex: 0,
    endIndex: 0,
    length: 1,
    startTime: 0,
    endTime: 0,
  });
});

test('findStableWindow holds the whole array at epsilon 0 when drift is exact', () => {
  const readings = [
    { t: 0, value: 10 },
    { t: 1, value: 12 },
    { t: 2, value: 14 },
    { t: 3, value: 16 },
  ];
  const r = K.findStableWindow(readings, 2, 0);
  assert.deepEqual(r, {
    ok: true,
    startIndex: 0,
    endIndex: 3,
    length: 4,
    startTime: 0,
    endTime: 3,
  });
});

test('findStableWindow includes drift exactly equal to epsilon (boundary)', () => {
  const readings = [
    { t: 0, value: 0 },
    { t: 1, value: 5 },
  ];
  const r = K.findStableWindow(readings, 0, 5);
  assert.deepEqual(r, {
    ok: true,
    startIndex: 0,
    endIndex: 1,
    length: 2,
    startTime: 0,
    endTime: 1,
  });
});

test('findStableWindow breaks ties by keeping the first-occurring longest window', () => {
  const readings = [
    { t: 0, value: 0 },
    { t: 1, value: 0 },
    { t: 2, value: 100 },
    { t: 3, value: 100 },
  ];
  const r = K.findStableWindow(readings, 0, 0);
  assert.deepEqual(r, {
    ok: true,
    startIndex: 0,
    endIndex: 1,
    length: 2,
    startTime: 0,
    endTime: 1,
  });
});
