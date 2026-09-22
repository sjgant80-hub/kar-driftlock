// kernel.mjs
// DriftLock — pure kernel: longest contiguous run of timestamped sensor readings
// whose cumulative drift from a nominal drift-rate stays within an epsilon band.
// No I/O. All exported functions are total: bad input returns {ok:false, why} rather than throwing.

function isPlainReading(r) {
  return (
    r !== null &&
    typeof r === 'object' &&
    Number.isFinite(r.t) &&
    Number.isFinite(r.value)
  );
}

// validateReadings :: any -> {ok:true, readings} | {ok:false, why}
export function validateReadings(readings) {
  if (!Array.isArray(readings)) {
    return { ok: false, why: 'readings must be an array' };
  }
  if (readings.length === 0) {
    return { ok: false, why: 'readings must contain at least one reading' };
  }
  for (let i = 0; i < readings.length; i++) {
    if (!isPlainReading(readings[i])) {
      return {
        ok: false,
        why: `reading at index ${i} must be {t:finite number, value:finite number}`,
      };
    }
    if (i > 0 && !(readings[i].t > readings[i - 1].t)) {
      return {
        ok: false,
        why: `timestamps must be strictly increasing (index ${i} does not exceed index ${i - 1})`,
      };
    }
  }
  return { ok: true, readings };
}

// driftAt :: (anchor, reading, driftRate) -> number
// Deviation of `reading` from the value predicted by extrapolating `anchor`
// forward at the nominal drift-rate. Internal — inputs are pre-validated by callers.
function driftAt(anchor, reading, driftRate) {
  const expected = anchor.value + driftRate * (reading.t - anchor.t);
  return reading.value - expected;
}

// findStableWindow :: (readings, driftRate, epsilon)
//   -> {ok:true, startIndex, endIndex, length, startTime, endTime} | {ok:false, why}
//
// For each candidate window start j, extends the window while every reading k in
// [j, i] deviates from the linear extrapolation anchored at j by at most epsilon.
// Ties on window length keep the earliest-occurring window (strict `>` on update).
export function findStableWindow(readings, driftRate, epsilon) {
  if (!Number.isFinite(driftRate)) {
    return { ok: false, why: 'driftRate must be a finite number' };
  }
  if (!Number.isFinite(epsilon)) {
    return { ok: false, why: 'epsilon must be a finite number' };
  }
  if (epsilon < 0) {
    return { ok: false, why: 'epsilon must be non-negative' };
  }

  const validated = validateReadings(readings);
  if (!validated.ok) return validated;
  const rs = validated.readings;
  const n = rs.length;

  let best = { startIndex: 0, endIndex: 0, length: 1 };

  for (let j = 0; j < n; j++) {
    const anchor = rs[j];
    let i = j;
    // NOTE: bound is checked AFTER touching rs[i], not before. For every real
    // (unmutated) j this is 0-indexed identical to the old `while (i < n)`
    // form, because j always enters this body already < n, so i === j starts
    // in range and self-drift is always 0 (abs(0) <= epsilon, epsilon >= 0
    // guaranteed above), so the first pass never breaks before incrementing.
    // The point of writing it this way: an off-by-one on the OUTER guard
    // (j <= n) can no longer hide as a silent length-0 no-op — it dereferences
    // rs[n] (undefined) and fails loudly instead of binding nothing.
    for (;;) {
      const drift = driftAt(anchor, rs[i], driftRate);
      if (Math.abs(drift) > epsilon) break;
      i++;
      if (i >= n) break;
    }
    const endIndex = i - 1;
    const length = endIndex - j + 1;
    if (length > best.length) {
      best = { startIndex: j, endIndex, length };
    }
  }

  return {
    ok: true,
    startIndex: best.startIndex,
    endIndex: best.endIndex,
    length: best.length,
    startTime: rs[best.startIndex].t,
    endTime: rs[best.endIndex].t,
  };
}
