import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BM_ARCHIVE_PAGES, collectTrBm, parseBmArchivePage, parseBmDailyPage } from '../trwiki-bm.js';
import { fakeHttp, fixture, jsonFixture } from './helpers.js';

const daily = jsonFixture('trwiki-bm-daily.json');
const archiveWt = fixture('trwiki-bm-archive.wikitext');
const content = (title) => daily.query.pages.find((p) => p.title === title).revisions[0].slots.main.content;

test('S3 günlük sayfa: source_key, temiz metin, kalın link (pipe’lı)', () => {
  const title = 'Vikipedi:Biliyor muydunuz?/2026-10-01';
  const { date, candidates } = parseBmDailyPage(title, content(title));
  assert.equal(date, '2026-10-01');
  assert.equal(candidates.length, 1);
  const [c] = candidates;
  assert.equal(c.source_key, 'trwiki-bm:2026-10-01:0');
  assert.equal(c.source, 'trwiki_bm');
  assert.equal(c.lang, 'tr');
  assert.equal(
    c.hook_text,
    'Tarihin belli zamanlarında, Yahudilerin, Hristiyan (ve bazen Müslüman) çocukların kanlarından matsa yaptıklarına inanılmıştır.',
  );
  assert.equal(c.source_url, 'https://tr.wikipedia.org/wiki/Kan_iftiras%C4%B1');
});

test('S3 günlük sayfa: görsel/div silinir, dosya açıklamasındaki link kaynak olmaz', () => {
  const title = 'Vikipedi:Biliyor muydunuz?/2026-10-05';
  const [c] = parseBmDailyPage(title, content(title)).candidates;
  assert.equal(c.hook_text, 'Sevilay Öztürk, paralimpik oyunlarda yüzme branşında madalya kazanan ilk Türk sporcudur.');
  assert.equal(c.source_url, 'https://tr.wikipedia.org/wiki/Sevilay_%C3%96zt%C3%BCrk');
});

test('S3 günlük sayfa: boş sayfa ve tarihsiz başlık aday üretmez', () => {
  assert.equal(parseBmDailyPage('Vikipedi:Biliyor muydunuz?/2026-10-02', '   \n').candidates.length, 0);
  assert.equal(parseBmDailyPage('Vikipedi:Biliyor muydunuz?/Depo', "'''[[X]]''' uzun bir metin burada yer alıyor.").candidates.length, 0);
});

test('S3 arşiv: {{*as}} satırları, tırnak ve "...ki" temizliği, boş satır atlanır', () => {
  const { candidates, skipped } = parseBmArchivePage(BM_ARCHIVE_PAGES[0], archiveWt);
  assert.equal(skipped, 1);
  assert.deepEqual(
    candidates.map((c) => c.source_key),
    ['trwiki-bm:arsiv-ekim-2010-oncesi:0', 'trwiki-bm:arsiv-ekim-2010-oncesi:1', 'trwiki-bm:arsiv-ekim-2010-oncesi:3'],
  );
  assert.equal(candidates[0].hook_text, 'Yahudilik dininin peygamberi Musa\'nın adı, (sudan) "çekmek/çıkarmak" anlamına gelir.');
  assert.equal(candidates[0].source_url, 'https://tr.wikipedia.org/wiki/Musa');
  assert.equal(candidates[1].source_url, 'https://tr.wikipedia.org/wiki/Galatasaray_Spor_Kul%C3%BCb%C3%BC_tarihi');
  assert.equal(candidates[2].hook_text, "Türkiye'de 1932 - 1950 yılları arasında ezan Türkçe okunmuştur");
  assert.equal(candidates[2].source_url, 'https://tr.wikipedia.org/wiki/T%C3%BCrk%C3%A7e_ezan');
  assert.deepEqual(parseBmArchivePage(BM_ARCHIVE_PAGES[0], archiveWt), { candidates, skipped });
});

test('S3 toplayıcı: günlükler tarih sırasıyla, ileri tarih okunmaz, sonra arşiv; imleç döner', async () => {
  const http = fakeHttp((url) => {
    if (url.searchParams.get('generator') === 'allpages') {
      assert.equal(url.searchParams.get('gapprefix'), 'Biliyor muydunuz?/2');
      return daily;
    }
    return {
      query: {
        pages: BM_ARCHIVE_PAGES.map((title, i) => ({
          title,
          revisions: [{ slots: { main: { content: i === 0 ? archiveWt : '' } } }],
        })),
      },
    };
  });
  const result = await collectTrBm({ http, limit: 3, now: new Date('2026-11-20T08:00:00Z') });
  assert.deepEqual(
    result.candidates.map((c) => c.source_key),
    ['trwiki-bm:2026-10-01:0', 'trwiki-bm:2026-10-05:0', 'trwiki-bm:arsiv-ekim-2010-oncesi:0'],
  );
  assert.deepEqual(result.nextCursor, { dailyFrom: '2026-10-05', archiveOffset: 1, archiveDone: false });
  assert.equal(result.stats.archive_available, 3);
});

test('S3 toplayıcı: imleçten devam eder (gapfrom) ve görülen tarihleri atlar', async () => {
  const http = fakeHttp((url) => {
    assert.equal(url.searchParams.get('gapfrom'), 'Biliyor muydunuz?/2026-10-01');
    return daily;
  });
  const result = await collectTrBm({
    http,
    limit: 5,
    cursor: { dailyFrom: '2026-10-01', archiveOffset: 3, archiveDone: true },
    now: new Date('2026-11-20T08:00:00Z'),
  });
  assert.deepEqual(result.candidates.map((c) => c.source_key), ['trwiki-bm:2026-10-05:0']);
  assert.equal(http.calls.length, 1); // arşiv bitti → istek yok
});
