import assert from 'node:assert/strict';
import { test } from 'node:test';
import { run } from '../v2-backfill-context.js';

function makeClient(rows) {
  const updates = [];
  return {
    updates,
    from() {
      return {
        select() {
          const q = {
            is: () => q,
            ilike: () => q,
            order: () => q,
            limit: (n) => Promise.resolve({ data: rows.slice(0, n), error: null }),
          };
          return q;
        },
        update(patch) {
          return {
            eq(_col, id) {
              updates.push({ id, patch });
              return { is: () => Promise.resolve({ error: null }) };
            },
          };
        },
      };
    },
  };
}

const PARA_MATCH =
  'Ahtapotlar üç kalp taşır ve kanları bakır içerdiği için mavi renktedir; bu özellik soğuk sularda oksijen taşımayı kolaylaştırır.';
const PARA_FIRST =
  'Bu makalenin ilk anlamlı paragrafı, kartla hiç ortak kelimesi olmayan uzun bir giriş cümlesidir.';
const html = (...ps) => ps.map((p) => `<p>${p}</p>`).join('\n');

function makeHttp(pages) {
  const calls = [];
  return {
    calls,
    async getJson(url) {
      calls.push(url);
      const title = new URL(url).searchParams.get('page');
      const page = pages[title];
      if (page instanceof Error) throw page;
      return { parse: { text: page } };
    },
  };
}

const rows = [
  {
    id: 'f1',
    title: 'Ahtapot',
    content: 'Ahtapotlar üç kalp taşır ve kanları mavi renktedir.',
    source_url: 'https://tr.wikipedia.org/wiki/Ahtapot',
  },
];
const quiet = () => {};

test('dry-run: yazmaz, örnek loglar', async () => {
  const client = makeClient(rows);
  const http = makeHttp({ Ahtapot: html(PARA_FIRST, PARA_MATCH) });
  const lines = [];
  const { exitCode, result } = await run([], { client, http, log: (l) => lines.push(l) });
  assert.equal(exitCode, 0);
  assert.equal(client.updates.length, 0);
  assert.equal(result.written, 0);
  assert.equal(result.processed, 1);
  assert.ok(lines.some((l) => l.includes('örnek f1')));
});

test('apply: en iyi paragrafı yazar', async () => {
  const client = makeClient(rows);
  const http = makeHttp({ Ahtapot: html(PARA_FIRST, PARA_MATCH) });
  const { exitCode, result } = await run(['--apply'], { client, http, log: quiet });
  assert.equal(exitCode, 0);
  assert.equal(result.written, 1);
  assert.equal(client.updates.length, 1);
  assert.equal(client.updates[0].id, 'f1');
  assert.ok(client.updates[0].patch.context_text.includes('üç kalp'));
});

test('Wikipedia dışı kaynak atlanır', async () => {
  const client = makeClient([{ ...rows[0], id: 'f2', source_url: 'https://www.nasa.gov/x' }]);
  const http = makeHttp({});
  const { result } = await run(['--apply'], { client, http, log: quiet });
  assert.equal(result.skipped_source, 1);
  assert.equal(http.calls.length, 0);
  assert.equal(client.updates.length, 0);
});

test('eşleşen paragraf yok → makalenin ilk anlamlı paragrafı', async () => {
  const client = makeClient([
    { ...rows[0], title: 'Zzz', content: 'qqq www eee rrr', source_url: rows[0].source_url },
  ]);
  const http = makeHttp({ Ahtapot: html('Kısa.', PARA_FIRST) });
  const { result } = await run(['--apply'], { client, http, log: quiet });
  assert.equal(result.written, 1);
  assert.equal(client.updates[0].patch.context_text, PARA_FIRST);
});

test('fetch hatası → hata sayacı, devam eder, çıkış kodu 1', async () => {
  const client = makeClient([
    { ...rows[0], id: 'a', source_url: 'https://tr.wikipedia.org/wiki/Bozuk' },
    rows[0],
  ]);
  const http = makeHttp({ Bozuk: new Error('ağ'), Ahtapot: html(PARA_MATCH) });
  const { exitCode, result } = await run(['--apply'], { client, http, log: quiet });
  assert.equal(exitCode, 1);
  assert.equal(result.errors, 1);
  assert.equal(result.written, 1);
});
