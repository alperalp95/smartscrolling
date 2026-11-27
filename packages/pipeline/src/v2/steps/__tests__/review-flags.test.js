import assert from 'node:assert/strict';
import { test } from 'node:test';
import { findSensitiveTerms, reviewFlags } from '../review-flags.js';

const CFG = {
  sensitiveStems: ['cinayet', 'öldürül', 'massacre', 'tortur'],
  sensitiveWords: ['idam', 'killed'],
};
const opts = { stems: CFG.sensitiveStems, words: CFG.sensitiveWords };

test('findSensitiveTerms: kök eşleşmesi', () => {
  assert.deepEqual(findSensitiveTerms('Gerçek bir cinayete dayanan öykü', opts), ['cinayet']);
  assert.deepEqual(findSensitiveTerms('Öldürülen kral', opts), ['öldürül']);
});

test('findSensitiveTerms: büyük harf ve İ/ı katlama', () => {
  assert.deepEqual(findSensitiveTerms('MASSACRE', opts), ['massacre']);
  assert.deepEqual(findSensitiveTerms('İdam edildi', opts), ['idam']);
  assert.deepEqual(findSensitiveTerms('ÖLDÜRÜLDÜ', opts), ['öldürül']);
});

test('findSensitiveTerms: kelime tam eşleşir, başka kelimenin başı sayılmaz', () => {
  assert.deepEqual(findSensitiveTerms('idame ettirdi', opts), []);
  assert.deepEqual(findSensitiveTerms('skilled worker', opts), []);
  assert.deepEqual(findSensitiveTerms('he was killed.', opts), ['killed']);
});

test('findSensitiveTerms: tekrarsız, bulunma sırasıyla; özel karakterler kaçışlanır', () => {
  assert.deepEqual(findSensitiveTerms('tortur ve cinayet, tortur', opts), ['tortur', 'cinayet']);
  assert.deepEqual(findSensitiveTerms('abc', { stems: ['a.c', '('] }), []);
});

test('reviewFlags: config boş/yoksa null', () => {
  const card = { title: 'cinayet', content: 'x' };
  assert.equal(reviewFlags({}, card, undefined), null);
  assert.equal(reviewFlags({}, card, {}), null);
});

test('reviewFlags: başlık, metin ve kanca taranır', () => {
  assert.deepEqual(reviewFlags({ hook_text: 'h' }, { title: 'Cinayet', content: 'x' }, CFG), {
    reasons: ['sensitive_term'],
    terms: ['cinayet'],
  });
  assert.deepEqual(
    reviewFlags({ hook_text: 'a massacre' }, { title: 't', content: 'c' }, CFG)?.terms,
    ['massacre'],
  );
  assert.equal(reviewFlags({ hook_text: 'h' }, { title: 't', content: 'c' }, CFG), null);
});
