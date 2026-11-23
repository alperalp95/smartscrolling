// src/v2/publish/stock.js
// Stok durumu (saf): bekleyen ('queued') kart kaç günlük yayına yeter?
// Spec: docs/specs/content-pipeline-v2.md §5 adım 8 (hedef ≥ 7 gün), §8 alarm (< 3 gün).

export const DEFAULT_ALARM_STOCK_DAYS = 3;

function requireNonNegativeNumber(value, name) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} 0 ya da pozitif bir sayı olmalı (şu an: ${JSON.stringify(value)})`);
  }
}

/**
 * stockDays 1 ondalığa AŞAĞI yuvarlanır (2.96 gün → 2.9): alarm yukarı yuvarlamayla gizlenmesin.
 *
 * @param {{ queuedCount: number, dailyCount: number, minStockDays: number, alarmStockDays?: number }} input
 * @returns {{ stockDays: number, belowTarget: boolean, alarm: boolean }}
 */
export function stockStatus({ queuedCount, dailyCount, minStockDays, alarmStockDays = DEFAULT_ALARM_STOCK_DAYS } = {}) {
  if (dailyCount === 0) throw new RangeError('dailyCount 0 olamaz (stok günü hesaplanamaz)');
  if (typeof dailyCount !== 'number' || !Number.isFinite(dailyCount) || dailyCount < 0) {
    throw new RangeError(`dailyCount pozitif bir sayı olmalı (şu an: ${JSON.stringify(dailyCount)})`);
  }
  requireNonNegativeNumber(queuedCount, 'queuedCount');
  requireNonNegativeNumber(minStockDays, 'minStockDays');
  requireNonNegativeNumber(alarmStockDays, 'alarmStockDays');

  // Küçük epsilon: 29/10*10 = 28.999… gibi artıklar 2.8'e düşmesin.
  const stockDays = Math.floor((queuedCount / dailyCount) * 10 + 1e-9) / 10;
  return {
    stockDays,
    belowTarget: stockDays < minStockDays,
    alarm: stockDays < alarmStockDays,
  };
}
