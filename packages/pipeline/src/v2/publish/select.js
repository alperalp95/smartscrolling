// src/v2/publish/select.js
// Yayın seçimi (saf): stoktaki 'queued' kartlardan bugün yayınlanacakları seçer.
// Spec: docs/specs/content-pipeline-v2.md §5 adım 9 (kategori kotası).

export const DEFAULT_MAX_CATEGORY_SHARE = 0.3;
export const UNCATEGORIZED = 'uncategorized';

function categoryOf(card) {
  return card.category == null || card.category === '' ? UNCATEGORIZED : String(card.category);
}

function wowOf(card) {
  const n = typeof card.wow_score === 'string' ? Number(card.wow_score) : card.wow_score;
  return typeof n === 'number' && Number.isFinite(n) ? n : Number.NEGATIVE_INFINITY;
}

function timeOf(card) {
  const t = card.created_at instanceof Date ? card.created_at.getTime() : Date.parse(card.created_at);
  return Number.isFinite(t) ? t : Number.POSITIVE_INFINITY;
}

function compareIds(a, b) {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  const sa = String(a);
  const sb = String(b);
  if (sa === sb) return 0;
  return sa < sb ? -1 : 1;
}

/** wow_score azalan → created_at artan (eski önce) → id artan. Puanı olmayan en sona. */
export function comparePublishPriority(a, b) {
  const wa = wowOf(a);
  const wb = wowOf(b);
  if (wa !== wb) return wb > wa ? 1 : -1;
  const ta = timeOf(a);
  const tb = timeOf(b);
  if (ta !== tb) return ta < tb ? -1 : 1;
  return compareIds(a.id, b.id);
}

/**
 * Kategori başına üst sınır: ceil(dailyCount * maxCategoryShare).
 * 10 * 0.3 = 3.0000000000000004 gibi kayan nokta artıklarının 4'e yuvarlanmaması için
 * çarpım önce 9 ondalığa yuvarlanır.
 */
export function categoryQuota(dailyCount, maxCategoryShare = DEFAULT_MAX_CATEGORY_SHARE) {
  return Math.ceil(Number((dailyCount * maxCategoryShare).toFixed(9)));
}

/**
 * @param {{ id: string|number, category: string, wow_score: number|null, created_at: string|Date }[]} queued
 * @param {{ dailyCount: number, maxCategoryShare?: number }} options
 * @returns {{ selected: (string|number)[], byCategory: Record<string, number>, filledBeyondQuota: number }}
 */
export function selectForPublish(queued, { dailyCount, maxCategoryShare = DEFAULT_MAX_CATEGORY_SHARE } = {}) {
  if (!Array.isArray(queued)) throw new TypeError('queued bir dizi olmalı');
  if (!Number.isInteger(dailyCount) || dailyCount < 0) {
    throw new RangeError(`dailyCount 0 ya da pozitif tam sayı olmalı (şu an: ${JSON.stringify(dailyCount)})`);
  }
  if (typeof maxCategoryShare !== 'number' || !(maxCategoryShare > 0 && maxCategoryShare <= 1)) {
    throw new RangeError(`maxCategoryShare 0'dan büyük, 1'den küçük ya da eşit olmalı (şu an: ${JSON.stringify(maxCategoryShare)})`);
  }

  const result = { selected: [], byCategory: {}, filledBeyondQuota: 0 };
  if (dailyCount === 0 || queued.length === 0) return result;

  const quota = categoryQuota(dailyCount, maxCategoryShare);
  const ranked = [...queued].sort(comparePublishPriority);
  const overQuota = [];

  const take = (card) => {
    const cat = categoryOf(card);
    result.selected.push(card.id);
    result.byCategory[cat] = (result.byCategory[cat] ?? 0) + 1;
  };

  // 1. tur: kota içinde, öncelik sırasıyla.
  for (const card of ranked) {
    if (result.selected.length >= dailyCount) break;
    if ((result.byCategory[categoryOf(card)] ?? 0) < quota) take(card);
    else overQuota.push(card);
  }

  // 2. tur: gün dolmadıysa kotayı aşan adaylarla, aynı sırayla doldur (gün boş kalmasın).
  for (const card of overQuota) {
    if (result.selected.length >= dailyCount) break;
    take(card);
    result.filledBeyondQuota += 1;
  }

  return result;
}
