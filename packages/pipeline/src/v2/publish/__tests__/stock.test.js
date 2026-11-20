import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stockStatus } from '../index.js';

test('tam 3.0 gün → alarm yok', () => {
  const s = stockStatus({ queuedCount: 300, dailyCount: 100, minStockDays: 7 });
  assert.deepEqual(s, { stockDays: 3, belowTarget: true, alarm: false });
});

test('2.9 gün → alarm', () => {
  const s = stockStatus({ queuedCount: 290, dailyCount: 100, minStockDays: 7 });
  assert.equal(s.stockDays, 2.9);
  assert.equal(s.alarm, true);
});

test('2.96 gün yukarı yuvarlanmaz → 2.9, alarm', () => {
  const s = stockStatus({ queuedCount: 296, dailyCount: 100, minStockDays: 7 });
  assert.equal(s.stockDays, 2.9);
  assert.equal(s.alarm, true);
});

test('1 ondalık; kayan nokta artığı aşağı düşürmez (29/10 → 2.9)', () => {
  assert.equal(stockStatus({ queuedCount: 29, dailyCount: 10, minStockDays: 7 }).stockDays, 2.9);
  assert.equal(stockStatus({ queuedCount: 100, dailyCount: 30, minStockDays: 7 }).stockDays, 3.3);
});

test('minStockDays altı → belowTarget; tam hedef → değil', () => {
  assert.equal(stockStatus({ queuedCount: 690, dailyCount: 100, minStockDays: 7 }).belowTarget, true);
  assert.equal(stockStatus({ queuedCount: 700, dailyCount: 100, minStockDays: 7 }).belowTarget, false);
});

test('alarmStockDays özelleştirilebilir', () => {
  assert.equal(stockStatus({ queuedCount: 450, dailyCount: 100, minStockDays: 7, alarmStockDays: 5 }).alarm, true);
});

test('stok 0 → 0 gün, alarm', () => {
  assert.deepEqual(stockStatus({ queuedCount: 0, dailyCount: 100, minStockDays: 7 }), {
    stockDays: 0,
    belowTarget: true,
    alarm: true,
  });
});

test('dailyCount 0 → hata', () => {
  assert.throws(() => stockStatus({ queuedCount: 10, dailyCount: 0, minStockDays: 7 }), /dailyCount 0/);
});

test('geçersiz girdi → hata', () => {
  assert.throws(() => stockStatus({ queuedCount: -1, dailyCount: 10, minStockDays: 7 }), RangeError);
  assert.throws(() => stockStatus({ queuedCount: 1, dailyCount: -10, minStockDays: 7 }), RangeError);
});
