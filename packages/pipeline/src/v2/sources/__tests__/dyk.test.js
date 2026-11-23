import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  collectDykArchive,
  parseDykArchiveRow,
  parseDykArchiveRows,
  pickSplit,
} from '../dyk-archive.js';
import { collectDykRecent, parseRecentAdditionsHtml, recentAdditionsPages } from '../dyk-recent.js';
import { dykSourceKey } from '../dyk.js';
import { fakeHttp, fixture, jsonFixture } from './helpers.js';

const rows = jsonFixture('hf-dyk-rows.json');
const recentHtml = fixture('recent-additions.html');

test('dykSourceKey: tarih + set saati + sıra', () => {
  assert.equal(dykSourceKey('2024-02-02', '12:00', 3), 'enwiki-dyk:2024-02-02T1200:3');
  assert.equal(dykSourceKey('2026-10-29', '0011', 0), 'enwiki-dyk:2026-10-29T0011:0');
});

test('S1: HF satırı → source_key, temiz hook_text, kalın makale URL’si, görüntülenme', () => {
  const c = parseDykArchiveRow(rows.rows[0]);
  assert.equal(c.source_key, 'enwiki-dyk:2024-02-02T1200:0');
  assert.equal(c.source, 'enwiki_dyk');
  assert.equal(c.lang, 'en');
  assert.equal(
    c.hook_text,
    'William Thomas Pike, a convicted felon, published a biographical series, which includes traders, bishops, and a lord mayor of London, but almost no women',
  );
  assert.equal(c.source_url, 'https://en.wikipedia.org/wiki/William_Thomas_Pike');
  assert.equal(c.source_meta.views, 5830);
  assert.equal(c.source_meta.row_idx, 96984);
});

test('S1: subject_article yoksa kancadaki kalın link kullanılır; "?" makale adında korunur', () => {
  const quoted = parseDykArchiveRow(rows.rows[1]);
  assert.equal(quoted.hook_text, '"he would, wouldn\'t he"');
  assert.equal(quoted.source_url, "https://en.wikipedia.org/wiki/Well_he_would,_wouldn't_he%3F");
  assert.equal(quoted.source_meta.views, null);

  const noSubject = parseDykArchiveRow(rows.rows[4]);
  assert.equal(noSubject.source_url, 'https://en.wikipedia.org/wiki/Donald_H._Bochkay');
});

test('S1: boş ve zaman damgası olmayan satırlar atlanır; deterministik', () => {
  const parsed = parseDykArchiveRows(rows);
  assert.equal(parsed.consumed, 5);
  assert.equal(parsed.skipped, 2);
  assert.deepEqual(
    parsed.candidates.map((c) => c.source_key),
    [
      'enwiki-dyk:2024-02-02T1200:0',
      'enwiki-dyk:2024-02-02T1200:7',
      'enwiki-dyk:2024-02-02T0000:0',
    ],
  );
  assert.deepEqual(parseDykArchiveRows(rows), parsed);
});

test('S1: limit dolunca durur, consumed sadece okunan satırlar', () => {
  const parsed = parseDykArchiveRows(rows, 1);
  assert.equal(parsed.candidates.length, 1);
  assert.equal(parsed.consumed, 1);
});

test('S1: pickSplit default/train seçer', () => {
  assert.deepEqual(
    pickSplit({
      splits: [
        { config: 'x', split: 'test' },
        { config: 'default', split: 'train' },
      ],
    }),
    { config: 'default', split: 'train' },
  );
  assert.throws(() => pickSplit({ splits: [] }));
});

test('S1 toplayıcı: /splits → /rows, offset ilerlemesini döndürür', async () => {
  const http = fakeHttp((url) => {
    if (url.pathname === '/splits')
      return { splits: [{ dataset: 'd', config: 'default', split: 'train' }] };
    assert.equal(url.pathname, '/rows');
    assert.equal(url.searchParams.get('dataset'), 'derenrich/enwiki-did-you-know');
    assert.equal(url.searchParams.get('offset'), '96984');
    return rows;
  });
  const result = await collectDykArchive({ http, limit: 2, cursor: { offset: 96984 } });
  assert.equal(result.candidates.length, 2);
  assert.deepEqual(result.nextCursor, { offset: 96986, total: 96989, exhausted: false });
  assert.equal(http.calls.length, 2);
});

test('S1 toplayıcı: veri seti bittiyse /rows isteği atılmaz', async () => {
  const http = fakeHttp((url) => {
    if (url.pathname === '/splits') return { splits: [{ config: 'default', split: 'train' }] };
    throw new Error('rows çağrılmamalı');
  });
  const result = await collectDykArchive({
    http,
    limit: 5,
    cursor: { offset: 97015, total: 97015, exhausted: true },
  });
  assert.equal(result.candidates.length, 0);
  assert.equal(result.nextCursor.exhausted, true);
});

test('S2: Recent additions HTML → setler, sıra, kalın link, bozuk satır atlanır', () => {
  const { candidates, skipped, sets } = parseRecentAdditionsHtml(recentHtml);
  assert.equal(sets, 2);
  assert.equal(skipped, 1); // "... that ?"
  assert.deepEqual(
    candidates.map((c) => c.source_key),
    [
      'enwiki-dyk:2024-02-02T1200:0',
      'enwiki-dyk:2024-02-02T1200:1',
      'enwiki-dyk:2024-02-02T1200:3',
      'enwiki-dyk:2024-02-02T1200:4',
      'enwiki-dyk:2024-02-02T0000:0',
      'enwiki-dyk:2024-02-02T0000:1',
    ],
  );
  const [pike, yobidashi, pagtatag, quoted, , misheard] = candidates;
  assert.equal(yobidashi.hook_text, 'yobidashi often receive their trousers from sumo wrestlers');
  assert.equal(yobidashi.source_url, 'https://en.wikipedia.org/wiki/Yobidashi');
  assert.equal(
    pagtatag.hook_text,
    "SB19's second EP, Pagtatag!, is part of a trilogy about their artistry",
  );
  assert.equal(pagtatag.source_url, 'https://en.wikipedia.org/wiki/Pagtatag!');
  assert.equal(quoted.source_url, "https://en.wikipedia.org/wiki/Well_he_would,_wouldn't_he%3F");
  // kalın link yoksa ilk makale linki
  assert.equal(misheard.source_url, 'https://en.wikipedia.org/wiki/Vegetable');
  assert.ok(pike.hook_text.startsWith('William Thomas Pike, a convicted felon'));
});

test('S1 ve S2 aynı kanca için aynı source_key (ve aynı hook_hash) üretir', () => {
  const s1 = parseDykArchiveRows(rows).candidates;
  const s2 = parseRecentAdditionsHtml(recentHtml).candidates;
  for (const key of ['enwiki-dyk:2024-02-02T1200:0', 'enwiki-dyk:2024-02-02T0000:0']) {
    const a = s1.find((c) => c.source_key === key);
    const b = s2.find((c) => c.source_key === key);
    assert.ok(a && b, key);
    assert.equal(a.source_url, b.source_url);
    assert.equal(a.hook_hash, b.hook_hash);
  }
});

test('S2: deterministik ve sayfa listesi bu ay + geçen ay', () => {
  assert.deepEqual(parseRecentAdditionsHtml(recentHtml), parseRecentAdditionsHtml(recentHtml));
  assert.deepEqual(recentAdditionsPages(new Date('2026-11-20T10:00:00Z')), [
    'Wikipedia:Recent_additions',
    'Wikipedia:Did_you_know_archive/2026/October',
  ]);
  assert.deepEqual(
    recentAdditionsPages(new Date('2027-01-03T10:00:00Z'))[1],
    'Wikipedia:Did_you_know_archive/2026/December',
  );
});

test('S2 toplayıcı: iki sayfayı action=parse ile okur, tekrarları eler, limit uygular', async () => {
  const http = fakeHttp((url) => {
    assert.equal(url.searchParams.get('action'), 'parse');
    return { parse: { title: url.searchParams.get('page'), text: recentHtml } };
  });
  const result = await collectDykRecent({ http, limit: 4, now: new Date('2026-11-20T00:00:00Z') });
  assert.equal(http.calls.length, 2);
  assert.equal(result.candidates.length, 4);
  assert.equal(result.stats.available, 6); // ikinci sayfadaki aynı anahtarlar elendi
  // eskiden yeniye sıralı; imleç son alınan kanca
  assert.deepEqual(
    result.candidates.map((c) => c.source_key),
    [
      'enwiki-dyk:2024-02-02T0000:0',
      'enwiki-dyk:2024-02-02T0000:1',
      'enwiki-dyk:2024-02-02T1200:0',
      'enwiki-dyk:2024-02-02T1200:1',
    ],
  );
  assert.deepEqual(result.nextCursor, { after: '2024-02-02T1200:1' });
  assert.equal(result.backfill, undefined);
});
