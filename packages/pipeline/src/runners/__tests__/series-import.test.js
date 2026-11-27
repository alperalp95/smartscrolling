import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { splitIntoCards, summarizeSections } from '../../series/split.js';
import { filterSections, parseWikiExtract } from '../../series/wiki-sections.js';
import { run as runCandidates } from '../series-candidates.js';
import { parseArgs, run, slugify, validateSeriesConfig } from '../series-import.js';

const COMMONS = 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Kule.jpg/960px-Kule.jpg';
const LOCAL_TR = 'https://upload.wikimedia.org/wikipedia/tr/thumb/a/ab/Logo.png/960px-Logo.png';

const EXTRACT = [
  'Giriş cümlesi birdir. Giriş cümlesi ikidir.',
  '',
  '== Tarih ==',
  'Tarih bölümü cümlesi. Bir başka tarih cümlesi.',
  '',
  '== Kaynakça ==',
  'Bu bölüm atılmalı.',
].join('\n');

function apiPage({ title, extract = EXTRACT, revid = 42, thumb = null, missing = false }) {
  if (missing) return { query: { pages: [{ title, missing: true }] } };
  const page = { pageid: 1, title, extract, revisions: [{ revid }] };
  if (thumb) page.thumbnail = { source: thumb, width: 960, height: 600 };
  return { query: { pages: [page] } };
}

function fakeFetch(pagesByTitle, members = {}) {
  const calls = [];
  const impl = async (url, opts) => {
    calls.push({ url, opts });
    const u = new URL(url);
    const cm = u.searchParams.get('cmtitle');
    if (cm) {
      const list = members[cm] ?? [];
      return {
        ok: true,
        json: async () => ({ query: { categorymembers: list.map((t) => ({ title: t })) } }),
      };
    }
    const title = u.searchParams.get('titles');
    const body = pagesByTitle[title];
    if (!body) return { ok: false, status: 404, json: async () => ({}) };
    return { ok: true, json: async () => body };
  };
  impl.calls = calls;
  return impl;
}

function fakeClient({ existing = {} } = {}) {
  const log = { inserts: [], updates: [], rpcs: [] };
  let nextId = 1;
  const client = {
    log,
    from(table) {
      assert.equal(table, 'series');
      return {
        select() {
          return {
            eq: (_col, slug) => ({
              maybeSingle: async () => ({ data: existing[slug] ?? null, error: null }),
            }),
          };
        },
        insert(payload) {
          return {
            select: () => ({
              single: async () => {
                const id = `id-${nextId++}`;
                log.inserts.push({ ...payload, _id: id });
                return { data: { id }, error: null };
              },
            }),
          };
        },
        update(payload) {
          return {
            eq: async (col, val) => {
              log.updates.push({ ...payload, _eq: [col, val] });
              return { error: null };
            },
          };
        },
      };
    },
    async rpc(name, args) {
      log.rpcs.push({ name, args });
      return { error: null };
    },
  };
  return client;
}

const tmpDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'series-test-'));
const baseConfig = (extra = {}) => ({
  series: [{ title: 'Galata Kulesi', free: true, category: '📜 TARİH', sections: null, ...extra }],
});
const quiet = () => {};
const deps = (extra) => ({ cacheDir: tmpDir(), sleep: async () => {}, log: quiet, ...extra });

test('config: geçerli liste kabul edilir, _aciklama alanları yok sayılır', () => {
  const r = validateSeriesConfig({
    _aciklama: 'x',
    series: [{ _aciklama: 'y', ...baseConfig().series[0] }],
  });
  assert.deepEqual(r.errors, []);
  assert.equal(r.items.length, 1);
});

test('config: eksik başlık, bilinmeyen alan, geçersiz kategori ve bölüm listesi hata verir', () => {
  const r = validateSeriesConfig({
    series: [
      { free: true, category: '📜 TARİH', sections: null },
      { title: 'A', category: '📜 TARİH', sections: null, renk: 'mavi' },
      { title: 'B', category: 'YOK', sections: null },
      { title: 'C', category: '📜 TARİH', sections: 'Tarih' },
    ],
  });
  const all = r.errors.join('\n');
  assert.equal(r.errors.length, 4);
  assert.match(all, /başlık/);
  assert.match(all, /bilinmeyen alan: renk/);
  assert.match(all, /kategori/);
  assert.match(all, /sections/);
});

test('config: aynı slug iki kez yazılırsa hata verir', () => {
  const s = baseConfig().series[0];
  const r = validateSeriesConfig({ series: [s, { ...s }] });
  assert.match(r.errors.join('\n'), /slug/);
});

test('slugify: Türkçe-uyumlu küçük harf kısa hal', () => {
  assert.equal(slugify('Galata Kulesi'), 'galata-kulesi');
  assert.equal(slugify('İbn Haldun'), 'ibn-haldun');
  assert.equal(slugify('Çanakkale Savaşı (1915)'), 'canakkale-savasi-1915');
  assert.equal(slugify('ISPARTA'), 'isparta');
});

test('parseArgs: --publish değeri, --publish-all ve apply şartı', () => {
  assert.deepEqual(parseArgs(['--apply', '--publish', 'galata-kulesi']).publish, ['galata-kulesi']);
  assert.equal(parseArgs(['--apply', '--publish-all']).publishAll, true);
  assert.throws(() => parseArgs(['--publish', 'x']), /--apply/);
  assert.throws(() => parseArgs(['--bilinmeyen']), /bilinmeyen/);
});

test('dry-run: DB çağrısı yok, önizleme dosyası yazılır', async () => {
  const d = deps({
    client: fakeClient(),
    config: baseConfig(),
    fetchImpl: fakeFetch({ 'Galata Kulesi': apiPage({ title: 'Galata Kulesi', thumb: COMMONS }) }),
  });
  const { exitCode } = await run([], d);
  assert.equal(exitCode, 0);
  assert.equal(d.client.log.inserts.length, 0);
  assert.equal(d.client.log.rpcs.length, 0);
  const preview = JSON.parse(
    fs.readFileSync(path.join(d.cacheDir, 'series-galata-kulesi.json'), 'utf8'),
  );
  assert.equal(preview.slug, 'galata-kulesi');
  assert.equal(preview.cards.length, 2);
});

test('apply: yerel wikipedia/tr görseli → cover_url null', async () => {
  const d = deps({
    client: fakeClient(),
    config: baseConfig(),
    fetchImpl: fakeFetch({ 'Galata Kulesi': apiPage({ title: 'Galata Kulesi', thumb: LOCAL_TR }) }),
  });
  const { exitCode } = await run(['--apply'], d);
  assert.equal(exitCode, 0);
  assert.equal(d.client.log.inserts[0].cover_url, null);
});

test('apply: Commons görseli kabul, draft yazılır, RPC kartları SE-02 çıktısıyla aynı', async () => {
  const d = deps({
    client: fakeClient(),
    config: baseConfig(),
    fetchImpl: fakeFetch({
      'Galata Kulesi': apiPage({ title: 'Galata Kulesi', thumb: COMMONS, revid: 77 }),
    }),
  });
  const { exitCode } = await run(['--apply'], d);
  assert.equal(exitCode, 0);
  const { log } = d.client;

  const row = log.inserts[0];
  assert.equal(row.slug, 'galata-kulesi');
  assert.equal(row.cover_url, COMMONS);
  assert.equal(row.status, 'draft');
  assert.equal(row.is_free, true);
  assert.equal(row.source_revid, 77);
  assert.equal(row.source_url, 'https://tr.wikipedia.org/wiki/Galata_Kulesi');

  const cards = splitIntoCards(filterSections(parseWikiExtract(EXTRACT, 'Galata Kulesi'), null), {
    maxChars: 600,
  });
  assert.equal(log.rpcs.length, 1);
  assert.equal(log.rpcs[0].name, 'replace_series_cards');
  assert.equal(log.rpcs[0].args.p_series_id, row._id);
  assert.deepEqual(
    log.rpcs[0].args.p_cards,
    cards.map((c) => ({ position: c.position, section_title: c.sectionTitle, body: c.body })),
  );
  assert.deepEqual(row.sections, summarizeSections(cards));
  assert.equal(row.section_count, row.sections.length);
  assert.ok(!log.rpcs[0].args.p_cards.some((c) => c.body.includes('atılmalı')));
});

test('apply: seri zaten varsa güncellenir, status bozulmaz', async () => {
  const d = deps({
    client: fakeClient({ existing: { 'galata-kulesi': { id: 'var-1', status: 'published' } } }),
    config: baseConfig(),
    fetchImpl: fakeFetch({ 'Galata Kulesi': apiPage({ title: 'Galata Kulesi' }) }),
  });
  await run(['--apply'], d);
  assert.equal(d.client.log.inserts.length, 0);
  assert.equal(d.client.log.updates[0].status, undefined);
  assert.equal(d.client.log.rpcs[0].args.p_series_id, 'var-1');
});

test('apply --publish: yalnız seçilen seri içe aktarılır ve yayınlanır', async () => {
  const d = deps({
    client: fakeClient(),
    config: {
      series: [
        { title: 'Galata Kulesi', free: true, category: '📜 TARİH', sections: null },
        { title: 'İbn Haldun', free: false, category: '👤 BİYOGRAFİ', sections: null },
      ],
    },
    fetchImpl: fakeFetch({
      'Galata Kulesi': apiPage({ title: 'Galata Kulesi' }),
      'İbn Haldun': apiPage({ title: 'İbn Haldun' }),
    }),
  });
  const { exitCode } = await run(['--apply', '--publish', 'ibn-haldun'], d);
  assert.equal(exitCode, 0);
  assert.equal(d.client.log.inserts.length, 1);
  assert.equal(d.client.log.inserts[0].slug, 'ibn-haldun');
  const pub = d.client.log.updates.find((u) => u.status === 'published');
  assert.ok(pub?.published_at);
});

test('bozuk config: ağ ve DB çağrısı yapılmadan hata kodu 1', async () => {
  const d = deps({
    client: fakeClient(),
    config: { series: [{ category: 'YOK' }] },
    fetchImpl: fakeFetch({}),
  });
  const { exitCode } = await run(['--apply'], d);
  assert.equal(exitCode, 1);
  assert.equal(d.fetchImpl.calls.length, 0);
  assert.equal(d.client.log.inserts.length, 0);
});

test('bulunamayan madde: o madde hata sayılır, diğerleri sürer', async () => {
  const d = deps({
    client: fakeClient(),
    config: {
      series: [
        { title: 'Yok Madde', free: false, category: '📜 TARİH', sections: null },
        { title: 'Galata Kulesi', free: true, category: '📜 TARİH', sections: null },
      ],
    },
    fetchImpl: fakeFetch({
      'Yok Madde': apiPage({ title: 'Yok Madde', missing: true }),
      'Galata Kulesi': apiPage({ title: 'Galata Kulesi' }),
    }),
  });
  const { exitCode } = await run(['--apply'], d);
  assert.equal(exitCode, 1);
  assert.equal(d.client.log.inserts.length, 1);
});

test('series-candidates: üyeleri listeler, Commons kapak ve kart sayısını çıkarır', async () => {
  const d = deps({
    fetchImpl: fakeFetch(
      {
        'Galata Kulesi': apiPage({ title: 'Galata Kulesi', thumb: COMMONS }),
        'İbn Haldun': apiPage({ title: 'İbn Haldun', thumb: LOCAL_TR }),
      },
      {
        'Kategori:Seçkin maddeler': ['Galata Kulesi'],
        'Kategori:Kaliteli maddeler': ['İbn Haldun', 'Galata Kulesi'],
      },
    ),
  });
  const { exitCode, items } = await runCandidates([], d);
  assert.equal(exitCode, 0);
  assert.equal(items.length, 2);
  const galata = items.find((i) => i.title === 'Galata Kulesi');
  assert.equal(galata.hasCommonsCover, true);
  assert.equal(galata.estimatedCards, 2);
  assert.equal(items.find((i) => i.title === 'İbn Haldun').hasCommonsCover, false);
  assert.ok(fs.existsSync(path.join(d.cacheDir, 'series-candidates.json')));
});

// --- cover (elle kapak seçimi) ---

const THUMB =
  'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/Galata.jpg/960px-Galata.jpg';

function commonsBody({ thumburl = THUMB, nonFree = false, missing = false, noInfo = false } = {}) {
  if (missing) return { query: { pages: { '-1': { title: 'File:X.jpg', missing: '' } } } };
  const page = { title: 'File:Galata Tower.jpg' };
  if (!noInfo) {
    page.imageinfo = [
      {
        thumburl,
        extmetadata: {
          LicenseShortName: { value: 'CC BY-SA 4.0' },
          ...(nonFree ? { NonFree: { value: 'true' } } : {}),
        },
      },
    ];
  }
  return { query: { pages: { 123: page } } };
}

/** tr.wikipedia isteklerini maddeye, commons isteklerini verilen gövdeye yönlendirir. */
function routedFetch(commons) {
  const wiki = fakeFetch({
    'Galata Kulesi': apiPage({ title: 'Galata Kulesi', thumb: COMMONS }),
  });
  const calls = [];
  const impl = async (url, opts) => {
    calls.push(url);
    if (new URL(url).host === 'commons.wikimedia.org') {
      return { ok: true, json: async () => commons };
    }
    return wiki(url, opts);
  };
  impl.calls = calls;
  return impl;
}

const coverOf = async (cover, commons) => {
  const d = deps({
    client: fakeClient(),
    config: baseConfig(cover === undefined ? {} : { cover }),
    fetchImpl: routedFetch(commons ?? commonsBody()),
  });
  const out = await run(['--apply'], d);
  return { out, d };
};

test('cover: alan yoksa eski davranış (maddenin Commons görseli), Commons çağrısı yok', async () => {
  const { out, d } = await coverOf(undefined);
  assert.equal(out.exitCode, 0);
  assert.equal(d.client.log.inserts[0].cover_url, COMMONS);
  assert.ok(!d.fetchImpl.calls.some((u) => u.includes('commons.wikimedia.org')));
});

test('cover: null eski davranışla aynı', async () => {
  const { d } = await coverOf(null);
  assert.equal(d.client.log.inserts[0].cover_url, COMMONS);
});

test('cover: "none" → cover_url null, Commons çağrısı yok', async () => {
  const { out, d } = await coverOf('none');
  assert.equal(out.exitCode, 0);
  assert.equal(d.client.log.inserts[0].cover_url, null);
  assert.ok(!d.fetchImpl.calls.some((u) => u.includes('commons.wikimedia.org')));
});

for (const name of ['File:Galata Tower.jpg', 'Dosya:Galata Tower.jpg', 'Galata Tower.jpg']) {
  test(`cover: dosya adı "${name}" → 960px küçük resim URL'si`, async () => {
    const { out, d } = await coverOf(name);
    assert.equal(out.exitCode, 0);
    assert.equal(d.client.log.inserts[0].cover_url, THUMB);
    const call = d.fetchImpl.calls.find((u) => u.includes('commons.wikimedia.org'));
    const q = new URL(call).searchParams;
    assert.equal(q.get('titles'), 'File:Galata Tower.jpg');
    assert.equal(q.get('prop'), 'imageinfo');
    assert.equal(q.get('iiprop'), 'url|extmetadata');
    assert.equal(q.get('iiurlwidth'), '960');
  });
}

test('cover: NonFree dosya reddedilir, satır hata verir', async () => {
  const { out, d } = await coverOf('File:Galata Tower.jpg', commonsBody({ nonFree: true }));
  assert.equal(out.exitCode, 1);
  assert.equal(out.result.errors, 1);
  assert.equal(d.client.log.inserts.length, 0);
});

test('cover: bulunamayan dosya satır hatası; diğer satırlar devam eder', async () => {
  const wiki = fakeFetch({
    'Galata Kulesi': apiPage({ title: 'Galata Kulesi', thumb: COMMONS }),
    'Sabahattin Ali': apiPage({ title: 'Sabahattin Ali', thumb: COMMONS }),
  });
  const impl = async (url, opts) =>
    new URL(url).host === 'commons.wikimedia.org'
      ? { ok: true, json: async () => commonsBody({ missing: true }) }
      : wiki(url, opts);
  const d = deps({
    client: fakeClient(),
    config: {
      series: [
        { title: 'Galata Kulesi', free: true, category: '📜 TARİH', cover: 'Yok.jpg' },
        { title: 'Sabahattin Ali', free: true, category: '📜 TARİH' },
      ],
    },
    fetchImpl: impl,
  });
  const { exitCode, result } = await run(['--apply'], d);
  assert.equal(exitCode, 1);
  assert.equal(result.errors, 1);
  assert.equal(result.written, 1);
  assert.equal(d.client.log.inserts[0].slug, 'sabahattin-ali');
});

test('cover: imageinfo yoksa hata', async () => {
  const { out } = await coverOf('Galata Tower.jpg', commonsBody({ noInfo: true }));
  assert.equal(out.exitCode, 1);
});

test('cover: doğrudan URL config doğrulamasında açık hata verir', () => {
  const r = validateSeriesConfig(baseConfig({ cover: 'https://example.com/a.jpg' }));
  assert.equal(r.errors.length, 1);
  assert.match(r.errors[0], /cover/);
  assert.match(r.errors[0], /Commons dosya adı/);
});

test('cover: metin olmayan değer hata verir; "none" ve dosya adı kabul edilir', () => {
  assert.equal(validateSeriesConfig(baseConfig({ cover: 5 })).errors.length, 1);
  assert.equal(validateSeriesConfig(baseConfig({ cover: '  ' })).errors.length, 1);
  assert.deepEqual(validateSeriesConfig(baseConfig({ cover: 'none' })).errors, []);
  assert.deepEqual(validateSeriesConfig(baseConfig({ cover: 'Dosya:A b.jpg' })).errors, []);
});

test("cover: mevcut seri yeniden içe aktarılırken cover değişikliği cover_url'e yansır", async () => {
  const d = deps({
    client: fakeClient({ existing: { 'galata-kulesi': { id: 'old', status: 'published' } } }),
    config: baseConfig({ cover: 'none' }),
    fetchImpl: routedFetch(commonsBody()),
  });
  const { exitCode } = await run(['--apply'], d);
  assert.equal(exitCode, 0);
  assert.equal(d.client.log.updates[0].cover_url, null);
});
