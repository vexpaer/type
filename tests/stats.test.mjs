import test from 'node:test';
import assert from 'node:assert/strict';
import { getStats, safeFilename } from '../src/stats.js';
test('word and reading counts reflect empty, English and mixed-language writing', () => {
  assert.deepEqual(getStats(''), {words:0,characters:0,reading:0});
  assert.equal(getStats('A quiet place to write.').words, 5);
  assert.ok(getStats('你好，世界。 Hello world!').words >= 4);
  assert.equal(getStats('word '.repeat(221)).reading, 2);
});
test('character counts handle emoji as code points and filenames are portable', () => {
  assert.equal(getStats('a😀中').characters, 3);
  assert.equal(safeFilename(' a/b:c? '), 'a-b-c-.txt');
  assert.equal(safeFilename('...'), 'Untitled.txt');
});
