import assert from 'node:assert/strict';
import { test } from 'node:test';
import { classifySimilarity, cosineSimilarity } from '../index.js';

test('cosine: özdeş vektör 1', () => {
  assert.ok(Math.abs(cosineSimilarity([1, 2, 3], [1, 2, 3]) - 1) < 1e-12);
});

test('cosine: dik vektör 0', () => {
  assert.equal(cosineSimilarity([1, 0], [0, 1]), 0);
});

test('cosine: farklı uzunluk hata', () => {
  assert.throws(() => cosineSimilarity([1, 2], [1, 2, 3]), RangeError);
});

test('classify: sınırlar', () => {
  assert.equal(classifySimilarity(0.92), 'duplicate');
  assert.equal(classifySimilarity(0.9199), 'gray');
  assert.equal(classifySimilarity(0.85), 'gray');
  assert.equal(classifySimilarity(0.8499), 'unique');
});

test('classify: özel eşikler', () => {
  const t = { duplicateThreshold: 0.9, grayZoneLow: 0.8 };
  assert.equal(classifySimilarity(0.9, t), 'duplicate');
  assert.equal(classifySimilarity(0.85, t), 'gray');
  assert.equal(classifySimilarity(0.79, t), 'unique');
});
