import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadConfig } from '../../llm/index.js';
import { WRITERS, parseArgs, runWriterCompare } from '../v2-writer-compare.js';

const ENV = {
  GROQ_API_KEY: 'gk-test-1234',
  CLOUDFLARE_API_TOKEN: 'cf-test-1234',
  CLOUDFLARE_ACCOUNT_ID: 'acct-test-1234',
};

const INPUT = {
  candidates: [
    {
      hook_text: 'Hook bir',
      lang: 'en',
      support_paragraph: 'Destek bir.',
      scores: { category: 'BİLİM' },
    },
    {
      hook_text: 'Hook iki',
      lang: 'tr',
      support_paragraph: 'Destek iki.',
      scores: { category: 'TARİH' },
    },
    { hook_text: 'Destek yok', lang: 'en', scores: {} },
  ],
};

function makeFetch({ failModel } = {}) {
  return async (url, init) => {
    const body = JSON.parse(init.body);
    if (failModel && String(body.model) === failModel) {
      return new Response(JSON.stringify({ error: { message: 'bad request' } }), { status: 400 });
    }
    const card = {
      title: `T ${body.model}`,
      content: `İçerik ${body.model}`,
      tags: [],
      read_time_sq: 10,
    };
    return new Response(
      JSON.stringify({
        choices: [{ message: { content: JSON.stringify(card) }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 10 },
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  };
}

async function run(extra = {}, argv = []) {
  const files = {};
  const result = await runWriterCompare(['--input', 'in.json', ...argv], {
    config: loadConfig(),
    env: ENV,
    fetch: makeFetch(extra),
    sleep: async () => {},
    now: () => Date.parse('2026-11-21T10:00:00Z'),
    log: () => {},
    readFile: async () => JSON.stringify(INPUT),
    writeFile: async (p, d) => {
      files[p.replace(/\\/g, '/').split('/').pop()] = d;
    },
    cacheDir: 'cache',
  });
  return { result, files };
}

test('parseArgs: varsayılanlar ve hata', () => {
  assert.deepEqual(parseArgs([]), { input: null, count: 15, seed: 42 });
  assert.equal(parseArgs(['--count=3', '--seed', '7']).seed, 7);
  assert.throws(() => parseArgs(['--count', '0']), /pozitif/);
});

test('2 kanca x 3 yazar: 6 kart, anahtar doğru eşleşir', async () => {
  const { result, files } = await run();
  const md = files['writer-compare-2026-11-21.md'];
  assert.equal((md.match(/^### [ABC]$/gm) || []).length, 6);
  assert.equal((md.match(/Puan \(1-5\): ___/g) || []).length, 6);
  assert.match(md, /## Bilgi 2/);
  assert.match(md, /1–5 puanlayın/);
  const key = JSON.parse(files['writer-compare-2026-11-21.key.json']);
  assert.deepEqual(Object.keys(key), ['Bilgi 1', 'Bilgi 2']);
  for (const k of Object.values(key))
    assert.deepEqual(Object.values(k).sort(), [...WRITERS].sort());
  // Bilgi 1'deki A kartının başlığı anahtardaki modele ait olmalı
  const model = key['Bilgi 1'].A.split(':').slice(1).join(':');
  const sec = md.split('## Bilgi 2')[0];
  assert.ok(sec.includes(`### A\n\n**T ${model}**`));
  assert.equal(result.cards.length, 2);
});

test('aynı seed aynı sıra', async () => {
  const a = await run({}, ['--seed', '5']);
  const b = await run({}, ['--seed', '5']);
  assert.deepEqual(a.result.key, b.result.key);
});

test('bir yazar hata verirse kart (hata) olur, script durmaz', async () => {
  const { result, files } = await run({ failModel: 'openai/gpt-oss-20b' });
  const md = files['writer-compare-2026-11-21.md'];
  assert.equal((md.match(/^\(hata\)$/gm) || []).length, 2);
  assert.equal((md.match(/^### [ABC]$/gm) || []).length, 6);
  assert.equal(Object.keys(result.key).length, 2);
});
