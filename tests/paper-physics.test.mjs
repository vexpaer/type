import test from 'node:test';
import assert from 'node:assert/strict';
import { PaperPhysics } from '../src/paper-physics.js';

test('the feed edge stays pinned while the free edge bends and settles', () => {
  const paper = new PaperPhysics(); paper.impulse(2.7, 1);
  for (let i = 0; i < 12; i++) paper.step(1 / 60);
  assert.equal(paper.sample(0), 0);
  assert.ok(paper.sample(1) > .01);
  assert.ok(paper.moving);
  for (let i = 0; i < 900; i++) paper.step(1 / 60);
  assert.ok(Math.abs(paper.sample(1)) < .0001);
  assert.equal(paper.moving, false);
});

test('rapid typing and long frames stay finite and bounded', () => {
  const paper = new PaperPhysics();
  for (let i = 0; i < 300; i++) { paper.impulse(i % 10 ? .38 : 2.7, i % 2 ? -1 : 1); paper.step(i % 3 ? 1 / 60 : .5); }
  assert.ok([...paper.offsets].every(n => Number.isFinite(n) && Math.abs(n) < 1));
  assert.ok(Number.isFinite(paper.twist) && Math.abs(paper.twist) < 1);
  assert.equal(paper.offsets[0], 0);
});

test('fixed stepping gives the same response across frame rates; reset stops motion', () => {
  const fast = new PaperPhysics(), slow = new PaperPhysics(); fast.impulse(2, -1); slow.impulse(2, -1);
  for (let i = 0; i < 120; i++) fast.step(1 / 120);
  for (let i = 0; i < 30; i++) slow.step(1 / 30);
  assert.ok(Math.abs(fast.sample(1) - slow.sample(1)) < .001);
  slow.reset(); assert.equal(slow.moving, false); assert.equal(slow.sample(1), 0);
});
