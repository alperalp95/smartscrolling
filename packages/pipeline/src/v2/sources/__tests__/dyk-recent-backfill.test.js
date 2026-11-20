import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  advanceBackfillCursor,
  collectDykRecent,
  compareDykPosition,
  monthArchivePages,
  normalizeBackfillCursor,
  shiftMonth,
} from '../dyk-recent.js';
import { fakeHttp, fixture } from './helpers.js';

const recentHtml = fixture('recent-additions.html'); // 2 set, 6 aday (2024-02-02 00:00 ve 12:00)
const NOW = new Date('2026-11-20T03:00:00Z');
const missing = { error: { code: 'missingtitle', info: "The page you specified doesn't exist." } };

/** Sayfa adına göre yanıt: `pages[page]` ya `'html'`, ya `'missing'`, ya da bir Error. Liste dışı sayfa → missing. */
function wikiHttp(pages = {}) {
  return fakeHttp((url) => {
    const page = url.searchParams.get('page');
    const kind = pages[page] ?? (page === 'Wikipedia:Recent_additions' || page.startsWith('Wikipedia:Did_you_know_archive/2026/October') ? 'html' : 'missing');
    if (kind instanceof Error) throw kind;
    if (kind === 'missing') return missing;
    if (kind === 'empty') return { parse: { title: page, text: '<p>no sets</p>' } };
    return { parse: { title: page, text: recentHtml } };
  });
}

const requested = (http) => http.calls.map((u) => u.searchParams.get('page'));

test('shiftMonth: Ocak → önceki yılın Aralığı, Aralık → sonraki yılın Ocağı', () => {
  assert.equal(shiftMonth('2024-01', -1), '2023-12');
  assert.equal(shiftMonth('2023-12', 1), '2024-01');
  assert.equal(shiftMonth('2026-11', -2), '2026-09');
  assert.equal(shiftMonth('2025-03', -14), '2024-01');
  assert.throws(() => shiftMonth('2024-13', -1));
});

test('monthArchivePages: önce Recent_additions, sonra Did_you_know_archive adı', () => {
  assert.deepEqual(monthArchivePages('2024-03'), [
    'Wikipedia:Recent_additions/2024/March',
    'Wikipedia:Did_you_know_archive/2024/March',
  ]);
  assert.deepEqual(monthArchivePages('2025-01')[1], 'Wikipedia:Did_you_know_archive/2025/January');
});

test('normalizeBackfillCursor: imleç yoksa S2 penceresinin bir önceki ayı (bugün-2 ay); Ocak sınırı', () => {
  assert.deepEqual(normalizeBackfillCursor(null, { from: '2024-02', now: NOW }), { next: '2026-09', offset: 0, from: '2024-02', done: false });
  assert.deepEqual(normalizeBackfillCursor(null, { from: '2024-02', now: new Date('2027-01-05T00:00:00Z') }).next, '2026-11');
  assert.deepEqual(normalizeBackfillCursor(null, { from: '2024-02', now: new Date('2027-02-05T00:00:00Z') }).next, '2026-12');
  assert.deepEqual(normalizeBackfillCursor({ next: '2024-01', offset: 0 }, { from: '2024-02', now: NOW }).done, true);
  assert.deepEqual(normalizeBackfillCursor({ next: '2025-05', offset: 12 }, { from: '2024-02', now: NOW }), {
    next: '2025-05',
    offset: 12,
    from: '2024-02',
    done: false,
  });
});

test('compareDykPosition: set zamanı, sonra sıra (sayısal)', () => {
  assert.ok(compareDykPosition('2024-02-02T0000:9', '2024-02-02T1200:0') < 0);
  assert.ok(compareDykPosition('2024-02-02T1200:10', '2024-02-02T1200:2') > 0);
  assert.equal(compareDykPosition('2024-02-02T1200:3', '2024-02-02T1200:3'), 0);
});

test('S2 imleç: sadece imleçten yeni kancalar döner; yeni yoksa imleç korunur', async () => {
  const first = await collectDykRecent({ http: wikiHttp(), limit: 50, cursor: { after: '2024-02-02T0000:1' }, now: NOW });
  assert.deepEqual(
    first.candidates.map((c) => c.source_key),
    ['enwiki-dyk:2024-02-02T1200:0', 'enwiki-dyk:2024-02-02T1200:1', 'enwiki-dyk:2024-02-02T1200:3', 'enwiki-dyk:2024-02-02T1200:4'],
  );
  assert.deepEqual(first.nextCursor, { after: '2024-02-02T1200:4' });

  const second = await collectDykRecent({ http: wikiHttp(), limit: 50, cursor: first.nextCursor, now: NOW });
  assert.equal(second.candidates.length, 0);
  assert.deepEqual(second.nextCursor, { after: '2024-02-02T1200:4' });
});

test('S2 imleç: bir sayfa okunamazsa imleç ilerlemez', async () => {
  const http = wikiHttp({ 'Wikipedia:Did_you_know_archive/2026/October': new Error('HTTP 503') });
  const result = await collectDykRecent({ http, limit: 50, cursor: null, now: NOW });
  assert.equal(result.candidates.length, 6);
  assert.equal(result.nextCursor, null);
});

test('S2 backfill: ilk ay sayfası Recent_additions adıyla yoksa arşiv adı okunur; limit yarı yarıya paylaşılır', async () => {
  const http = wikiHttp({ 'Wikipedia:Did_you_know_archive/2026/September': 'html' });
  const result = await collectDykRecent({
    http,
    limit: 6,
    cursor: null,
    now: NOW,
    backfill: { from: '2024-03', months: 1, cursor: null },
  });
  assert.deepEqual(requested(http), [
    'Wikipedia:Recent_additions',
    'Wikipedia:Did_you_know_archive/2026/October',
    'Wikipedia:Recent_additions/2026/September',
    'Wikipedia:Did_you_know_archive/2026/September',
  ]);
  assert.equal(result.stats.recent_taken, 3);
  assert.equal(result.backfill.stats.taken, 3);
  assert.equal(result.candidates.length, 6);
  // ay yarım kaldı → aynı ayda offset ilerler
  assert.deepEqual(result.backfill.nextCursor, { next: '2026-09', offset: 3, from: '2024-03', done: false });
  assert.deepEqual(result.backfill.stats.months, [
    { month: '2026-09', page: 'Wikipedia:Did_you_know_archive/2026/September', sets: 2, candidates: 6, skipped: 1, offset: 0 },
  ]);
});

test('S2 backfill: yeni kanca azsa kalan pay backfill\'e geçer; ay bitince imleç önceki aya geçer', async () => {
  const http = wikiHttp({ 'Wikipedia:Recent_additions/2025/January': 'html' });
  const result = await collectDykRecent({
    http,
    limit: 20,
    cursor: { after: '2024-02-02T1200:3' }, // yeni sadece 1 kanca
    now: NOW,
    backfill: { from: '2024-03', months: 1, cursor: { next: '2025-01', offset: 2 } },
  });
  assert.equal(result.stats.recent_taken, 1);
  assert.equal(result.backfill.stats.taken, 4); // offset 2'den sonra kalan 4
  assert.deepEqual(result.backfill.nextCursor, { next: '2024-12', offset: 0, from: '2024-03', done: false });
  assert.ok(!requested(http).includes('Wikipedia:Did_you_know_archive/2025/January'));
});

test('S2 backfill: sayfası olmayan ay atlanır ve ay bütçesinden düşer', async () => {
  const http = wikiHttp({ 'Wikipedia:Did_you_know_archive/2026/August': 'html' });
  const result = await collectDykRecent({
    http,
    limit: 40,
    cursor: { after: '2099-01-01T0000:0' },
    now: NOW,
    backfill: { from: '2024-03', months: 2, cursor: null },
  });
  assert.deepEqual(result.backfill.stats.months[0], { month: '2026-09', missing: true });
  assert.equal(result.backfill.stats.months[1].month, '2026-08');
  assert.equal(result.backfill.stats.taken, 6);
  assert.deepEqual(result.backfill.nextCursor, { next: '2026-07', offset: 0, from: '2024-03', done: false });
  // months=2 → Temmuz okunmaz
  assert.ok(!requested(http).some((p) => p.includes('July')));
});

test('S2 backfill: sayfa var ama set yoksa ya da ağ hatası varsa imleç ilerlemez', async () => {
  for (const kind of ['empty', new Error('HTTP 503')]) {
    const http = wikiHttp({ 'Wikipedia:Recent_additions/2026/September': kind });
    const result = await collectDykRecent({ http, limit: 10, cursor: null, now: NOW, backfill: { from: '2024-03', months: 3, cursor: null } });
    assert.equal(result.backfill.stats.taken, 0);
    assert.ok(result.backfill.stats.months[0].error);
    assert.equal(result.backfill.stats.months.length, 1);
    assert.deepEqual(result.backfill.nextCursor, { next: '2026-09', offset: 0, from: '2024-03', done: false });
  }
});

test('S2 backfill: from ayına ulaşınca done; done imleçle hiç ay okunmaz', async () => {
  const http = wikiHttp({ 'Wikipedia:Recent_additions/2024/March': 'html' });
  const result = await collectDykRecent({
    http,
    limit: 50,
    cursor: { after: '2099-01-01T0000:0' },
    now: NOW,
    backfill: { from: '2024-03', months: 3, cursor: { next: '2024-03', offset: 0 } },
  });
  assert.equal(result.backfill.stats.taken, 6);
  assert.deepEqual(result.backfill.nextCursor, { next: '2024-02', offset: 0, from: '2024-03', done: true });
  assert.equal(result.backfill.stats.months.length, 1); // from'un ötesine (Şubat) geçilmez

  const http2 = wikiHttp();
  const again = await collectDykRecent({
    http: http2,
    limit: 50,
    cursor: { after: '2099-01-01T0000:0' },
    now: NOW,
    backfill: { from: '2024-03', months: 3, cursor: result.backfill.nextCursor },
  });
  assert.equal(again.backfill.stats.taken, 0);
  assert.equal(again.backfill.nextCursor.done, true);
  assert.equal(http2.calls.length, 2); // sadece normal pencere
});

test('advanceBackfillCursor: tam tüketilen ve eksik aylar geçilir, yarım ayda offset', () => {
  const cursor = { next: '2025-02', offset: 1, from: '2024-03', done: false };
  const entries = [
    { month: '2025-02', startOffset: 1, candidates: [1, 2, 3] },
    { month: '2025-01', startOffset: 0, candidates: [] },
    { month: '2024-12', startOffset: 0, candidates: [1, 2, 3, 4] },
  ];
  assert.deepEqual(advanceBackfillCursor(cursor, entries, 0), { next: '2025-02', offset: 1, from: '2024-03', done: false });
  assert.deepEqual(advanceBackfillCursor(cursor, entries, 2), { next: '2024-12', offset: 0, from: '2024-03', done: false });
  assert.deepEqual(advanceBackfillCursor(cursor, entries, 3), { next: '2024-12', offset: 1, from: '2024-03', done: false });
  assert.deepEqual(advanceBackfillCursor(cursor, entries, 6), { next: '2024-11', offset: 0, from: '2024-03', done: false });
});
