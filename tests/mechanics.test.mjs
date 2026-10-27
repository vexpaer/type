import test from 'node:test';
import assert from 'node:assert/strict';
import { strokeEnvelope, overlappingStroke, advanceKey, carriageOffset, quadMatrix, IMPACT_MS, forecastTyping } from '../src/mechanics.js';

test('overlapping strikes preserve an active stroke and meet the ribbon at impact', () => {
  assert.equal(strokeEnvelope(IMPACT_MS, 'bar'), 1);
  assert.ok(strokeEnvelope(IMPACT_MS, 'ribbon') > .9);
  assert.equal(overlappingStroke([0, 70], 70), strokeEnvelope(70));
  for (const age of [-20, 0, 12, 58, 90, 172, 300]) {
    for (const part of ['key', 'bar', 'ribbon']) assert.ok(strokeEnvelope(age, part) >= 0 && strokeEnvelope(age, part) <= 1);
  }
});

test('rapid same-key retriggers stay continuous, bounded, and settle across frame rates', () => {
  for (const fps of [30, 60, 120]) {
    const spring = { position: 0, velocity: 0 }, times = [];
    let previous = 0;
    for (let i = 0; i < fps * 5; i++) {
      const now = i / fps * 1000;
      if (i < fps * 2 && i % Math.max(1, Math.round(fps / 14)) === 0) times.push(now);
      advanceKey(spring, overlappingStroke(times, now) * .105, 1 / fps);
      assert.ok(Number.isFinite(spring.position) && spring.position >= -.00001 && spring.position <= .106);
      assert.ok(Math.abs(spring.position - previous) < .075);
      previous = spring.position;
    }
    assert.ok(Math.abs(spring.position) < .0001);
  }
});

test('carriage travel is bounded by visual line progress and returns on a soft wrap', () => {
  assert.equal(carriageOffset(0), .35); assert.equal(carriageOffset(1), -.35);
  assert.ok(carriageOffset(.02) > carriageOffset(.98));
  assert.equal(carriageOffset(-20), .35); assert.equal(carriageOffset(Infinity), .35);
  assert.ok(Math.abs(carriageOffset(.5)) < 1e-10);
});

test('the native editor homography aligns all four corners for affine and perspective paper', () => {
  for (const points of [
    [{ x: 20, y: 30 }, { x: 500, y: 30 }, { x: 500, y: 600 }, { x: 20, y: 600 }],
    [{ x: 100, y: 60 }, { x: 490, y: 47 }, { x: 530, y: 610 }, { x: 65, y: 570 }],
  ]) {
    const matrix = quadMatrix(480, 570, points);
    [[0, 0], [480, 0], [480, 570], [0, 570]].forEach(([x, y], i) => {
      const w = matrix[3] * x + matrix[7] * y + matrix[15];
      assert.ok(Math.abs((matrix[0] * x + matrix[4] * y + matrix[12]) / w - points[i].x) < 1e-8);
      assert.ok(Math.abs((matrix[1] * x + matrix[5] * y + matrix[13]) / w - points[i].y) < 1e-8);
    });
    assert.ok(matrix.every(Number.isFinite));
  }
});

test('queued strokes preserve correct columns under rapid input and mid-line edits', () => {
  assert.deepEqual(forecastTyping('', 0, 0, 'abc'), { text: 'abc', caret: 3 });
  assert.deepEqual(forecastTyping('Hello world', 5, 5, '!!'), { text: 'Hello!! world', caret: 7 });
  assert.deepEqual(forecastTyping('before AFTER', 7, 12, 'new'), { text: 'before newR', caret: 10 });
  assert.deepEqual(forecastTyping('漢字', 1, 1, 'abc'), { text: '漢abc字', caret: 4 });
});
