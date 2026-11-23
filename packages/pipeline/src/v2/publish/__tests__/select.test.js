import assert from 'node:assert/strict';
import { test } from 'node:test';
import { categoryQuota, selectForPublish } from '../index.js';

function card(id, category, wow, created = '2026-11-01T00:00:00Z') {
  return { id, category, wow_score: wow, created_at: created };
}

test('sıralama: wow azalan, eşitlikte eski önce, sonra id', () => {
  const queued = [
    card('a', 'bilim', 5, '2026-11-03T00:00:00Z'),
    card('b', 'tarih', 9, '2026-11-05T00:00:00Z'),
    card('c', 'doga', 7, '2026-11-02T00:00:00Z'),
    card('d', 'sanat', 7, '2026-11-01T00:00:00Z'),
    card('f', 'spor', 6, '2026-11-01T00:00:00Z'),
    card('e', 'uzay', 6, '2026-11-01T00:00:00Z'),
  ];
  const res = selectForPublish(queued, { dailyCount: 6, maxCategoryShare: 1 });
  assert.deepEqual(res.selected, ['b', 'd', 'c', 'e', 'f', 'a']);
  assert.equal(res.filledBeyondQuota, 0);
});

test('sıralama: puanı olmayan (null) kart en sona kalır', () => {
  const queued = [card('x', 'bilim', null), card('y', 'tarih', 1)];
  assert.deepEqual(selectForPublish(queued, { dailyCount: 1, maxCategoryShare: 1 }).selected, [
    'y',
  ]);
});

test('kota: 10 * 0.3 kayan nokta artığına rağmen 3', () => {
  assert.equal(categoryQuota(10, 0.3), 3);
  assert.equal(categoryQuota(100, 0.3), 30);
  assert.equal(categoryQuota(7, 0.3), 3);
});

test('kota: 10 kartlık günde tek kategoriden en fazla 3, kota dolunca diğer kategoriler', () => {
  const queued = [];
  for (let i = 0; i < 8; i += 1) queued.push(card(`bilim-${i}`, 'bilim', 10 - i * 0.1));
  for (let i = 0; i < 4; i += 1) queued.push(card(`tarih-${i}`, 'tarih', 5 - i * 0.1));
  for (let i = 0; i < 4; i += 1) queued.push(card(`doga-${i}`, 'doga', 4 - i * 0.1));
  for (let i = 0; i < 4; i += 1) queued.push(card(`uzay-${i}`, 'uzay', 3 - i * 0.1));

  const res = selectForPublish(queued, { dailyCount: 10 });
  assert.equal(res.selected.length, 10);
  assert.deepEqual(res.byCategory, { bilim: 3, tarih: 3, doga: 3, uzay: 1 });
  assert.deepEqual(res.selected.slice(0, 3), ['bilim-0', 'bilim-1', 'bilim-2']);
  assert.ok(!res.selected.includes('bilim-3'));
  assert.ok(!res.selected.includes('tarih-3'));
  assert.equal(res.filledBeyondQuota, 0);
});

test('kota: aday azsa kalan yer kotayı aşanla aynı sırayla doldurulur, filledBeyondQuota sayılır', () => {
  const queued = [
    card('b1', 'bilim', 9),
    card('b2', 'bilim', 8),
    card('b3', 'bilim', 7),
    card('b4', 'bilim', 6),
    card('b5', 'bilim', 5.5),
    card('b6', 'bilim', 5),
    card('t1', 'tarih', 4),
    card('t2', 'tarih', 3),
  ];
  const res = selectForPublish(queued, { dailyCount: 10 });
  // Kota 3: bilim 3 + tarih 2 = 5; kalan 5 yer için sadece 3 bilim kartı var → hepsi alınır.
  assert.deepEqual(res.selected, ['b1', 'b2', 'b3', 't1', 't2', 'b4', 'b5', 'b6']);
  assert.deepEqual(res.byCategory, { bilim: 6, tarih: 2 });
  assert.equal(res.filledBeyondQuota, 3);
});

test("kota: doldurma dailyCount'ta durur", () => {
  const queued = [
    card('b1', 'bilim', 9),
    card('b2', 'bilim', 8),
    card('b3', 'bilim', 7),
    card('t1', 'tarih', 1),
  ];
  // dailyCount 3 → kota ceil(0.9) = 1: b1, t1, sonra kota dışı b2 ile dolar; b3 dışarıda.
  const res = selectForPublish(queued, { dailyCount: 3 });
  assert.deepEqual(res.selected, ['b1', 't1', 'b2']);
  assert.equal(res.filledBeyondQuota, 1);
});

test('queued boş → selected: []', () => {
  assert.deepEqual(selectForPublish([], { dailyCount: 10 }), {
    selected: [],
    byCategory: {},
    filledBeyondQuota: 0,
  });
});

test('dailyCount > aday sayısı → hepsi seçilir', () => {
  const queued = [card(1, 'bilim', 3), card(2, 'tarih', 2), card(3, 'bilim', 1)];
  const res = selectForPublish(queued, { dailyCount: 50 });
  assert.deepEqual([...res.selected].sort(), [1, 2, 3]);
  assert.deepEqual(res.byCategory, { bilim: 2, tarih: 1 });
  assert.equal(res.filledBeyondQuota, 0);
});

test('girdi dizisi değiştirilmez (saf)', () => {
  const queued = [card('a', 'bilim', 1), card('b', 'bilim', 9)];
  const copy = structuredClone(queued);
  selectForPublish(queued, { dailyCount: 2 });
  assert.deepEqual(queued, copy);
});

test('geçersiz dailyCount / maxCategoryShare → hata', () => {
  assert.throws(() => selectForPublish([], { dailyCount: -1 }), RangeError);
  assert.throws(() => selectForPublish([], { dailyCount: 1.5 }), RangeError);
  assert.throws(() => selectForPublish([], { dailyCount: 10, maxCategoryShare: 0 }), RangeError);
});
