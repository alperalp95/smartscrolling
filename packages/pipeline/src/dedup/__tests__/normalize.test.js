import assert from 'node:assert/strict';
import { test } from 'node:test';
import { contentHash, normalizeForHash } from '../index.js';

test('IŞIK, ışık ve isik aynı hash', () => {
  const h = contentHash('IŞIK');
  assert.equal(contentHash('ışık'), h);
  assert.equal(contentHash('isik'), h);
  assert.equal(normalizeForHash('IŞIK'), 'isik');
});

test('İstanbul ve istanbul aynı hash', () => {
  assert.equal(contentHash('İstanbul'), contentHash('istanbul'));
  assert.equal(normalizeForHash('İstanbul'), 'istanbul');
});

test('şapkalı harfler ve diğer Türkçe harfler katlanır', () => {
  assert.equal(
    normalizeForHash('Kâğıt Hüküm Çiçek Öğle Şûra Îmân'),
    'kagit hukum cicek ogle sura iman',
  );
});

test('noktalama ve boşluk farkı aynı hash', () => {
  assert.equal(
    contentHash('Ahtapotun üç kalbi vardır.'),
    contentHash('  ahtapotun   üç kalbi,   vardır!!! '),
  );
});

test('sayılar korunur; farklı sayı farklı hash', () => {
  assert.equal(normalizeForHash('Everest 8.849 metre'), 'everest 8 849 metre');
  assert.notEqual(contentHash('Ahtapotun 3 kalbi vardır'), contentHash('Ahtapotun 2 kalbi vardır'));
});

test('contentHash 64 karakter hex döner', () => {
  assert.match(contentHash('merhaba'), /^[0-9a-f]{64}$/);
});
