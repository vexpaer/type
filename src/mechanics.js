/** Mechanical timing is independent of text insertion and can overlap at typing speed. */
export const IMPACT_MS = 58;
const clamp = (n, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, n));
const smooth = n => { const t = clamp(n); return t * t * (3 - 2 * t); };

export function strokeEnvelope(age, part = 'key') {
  if (age < 0) return 0;
  const [start, peak, end] = part === 'bar' ? [18, IMPACT_MS, 148]
    : part === 'ribbon' ? [12, 45, 150] : [0, 28, 172];
  if (age < start || age >= end) return 0;
  return age < peak ? smooth((age - start) / (peak - start)) : 1 - smooth((age - peak) / (end - peak));
}

export function overlappingStroke(times, now, part = 'key') {
  return times.reduce((amount, time) => Math.max(amount, strokeEnvelope(now - time, part)), 0);
}

/** A continuous spring retains its current position when the same key is retriggered. */
export function advanceKey(state, target, dt) {
  const steps = Math.max(1, Math.ceil(Math.min(dt, .05) / .004));
  const step = Math.min(dt, .05) / steps;
  for (let i = 0; i < steps; i++) {
    state.velocity += ((target - state.position) * 2200 - state.velocity * 85) * step;
    state.position += state.velocity * step;
  }
  return state.position;
}

/** Independent pivots along the segment; every raised slug meets the same platen point. */
export function typebarPose(index, count = 44) {
  const angle = (index / Math.max(1, count - 1) - .5) * 2.42;
  const pivot = [Math.sin(angle) * 1.48, .99, -1.38 + Math.cos(angle) * 1.23];
  const target = [0, 2.035, -1.535];
  const delta = target.map((n, i) => n - pivot[i]);
  const length = Math.hypot(...delta);
  const horizontal = Math.hypot(delta[0], delta[2]);
  return { pivot, target, length, raised: delta.map(n => n / length), resting: [delta[0] / horizontal * .9992, .04, delta[2] / horizontal * .9992] };
}

/** Bounded travel follows measured visual columns, including soft wraps and wide glyphs. */
export function carriageOffset(progress, travel = .7) {
  return (.5 - clamp(Number.isFinite(progress) ? progress : 0)) * travel;
}

/** A CSS homography maps all four editor corners onto the perspective paper plane. */
export function quadMatrix(width, height, points) {
  const [p0, p1, p2, p3] = points;
  const dx1 = p1.x - p2.x, dx2 = p3.x - p2.x, dx3 = p0.x - p1.x + p2.x - p3.x;
  const dy1 = p1.y - p2.y, dy2 = p3.y - p2.y, dy3 = p0.y - p1.y + p2.y - p3.y;
  const det = dx1 * dy2 - dx2 * dy1;
  const g = Math.abs(det) > 1e-10 ? (dx3 * dy2 - dx2 * dy3) / det : 0;
  const h = Math.abs(det) > 1e-10 ? (dx1 * dy3 - dx3 * dy1) / det : 0;
  return [(p1.x - p0.x + g * p1.x) / width, (p1.y - p0.y + g * p1.y) / width, 0, g / width,
    (p3.x - p0.x + h * p3.x) / height, (p3.y - p0.y + h * p3.y) / height, 0, h / height,
    0, 0, 1, 0, p0.x, p0.y, 0, 1];
}

/** Project the column of a queued mechanical strike without mutating the native editor. */
export function forecastTyping(text, start, end, pending) {
  const from = Math.max(0, Math.min(text.length, start));
  const to = Math.max(from, Math.min(text.length, end));
  return { text: text.slice(0, from) + pending + text.slice(to), caret: from + pending.length };
}
