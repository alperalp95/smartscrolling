import assert from 'node:assert/strict';
// Runner v2-process: --apply olmadan DB repo'su oluşturulmaz; dry-run bellek içi repo + çıktı dosyası.
import { test } from 'node:test';
import { normalizeInput, parseArgs, runProcess } from '../../../runners/v2-process.js';
import { createMemoryStepsRepo } from '../../db/steps-repo.js';
import { resolveSteps } from '../index.js';
import { FIXED_NOW, TEST_CONFIG, fakeLlm } from './helpers.js';

const INPUT = {
  candidates: [
    {
      source_key: 'enwiki-dyk:1',
      source: 'enwiki_dyk',
      lang: 'en',
      hook_text: 'hook one about squid eyes',
      hook_hash: 'h1',
      source_url: 'https://en.wikipedia.org/wiki/Squid',
      source_meta: { views: 10 },
    },
    {
      source_key: 'enwiki-dyk:2',
      source: 'enwiki_dyk',
      lang: 'en',
      hook_text: '',
      hook_hash: 'h2',
    },
  ],
};

function spyFactory(impl) {
  const fn = async () => {
    fn.calls += 1;
    return impl?.();
  };
  fn.calls = 0;
  return fn;
}

test('parseArgs: varsayılan dry-run, tüm adımlar; geçersiz adım hata', () => {
  const o = parseArgs([]);
  assert.equal(o.apply, false);
  assert.equal(o.steps, 'dedup,score,support,write,verify,enqueue');
  assert.equal(o.limit, 50);
  assert.equal(parseArgs(['--apply', '--limit', '7']).limit, 7);
  assert.throws(() => parseArgs(['--steps', 'dedup,foo']), /bilinmeyen adım/);
  assert.throws(() => parseArgs(['--limit', '0']), /pozitif/);
});

test('resolveSteps: "dedup" iki tekrar adımını açar, sıra sabit', () => {
  assert.deepEqual(resolveSteps('enqueue,dedup,score'), [
    'dedup-hook',
    'score',
    'dedup-card',
    'enqueue',
  ]);
  assert.deepEqual(resolveSteps('dedup,score,support,write,verify,enqueue'), [
    'dedup-hook',
    'score',
    'support',
    'write',
    'dedup-card',
    'verify',
    'enqueue',
  ]);
});

test('normalizeInput: V2-04 biçimi; boş kanca atlanır', () => {
  const list = normalizeInput(INPUT);
  assert.equal(list.length, 1);
  assert.equal(list[0].status, 'new');
  assert.equal(list[0].source_meta.views, 10);
  assert.equal(normalizeInput([INPUT.candidates[0]]).length, 1);
});

test('runner: --apply olmadan DB repo oluşturulmaz; çıktı .cache/v2-process-<tarih>.json', async () => {
  const createDbRepo = spyFactory();
  const written = {};
  const llm = fakeLlm({ embed: (texts) => texts.map(() => [1, 0, 0]) });
  const res = await runProcess(['--input', 'adaylar.json', '--steps', 'dedup'], {
    config: TEST_CONFIG,
    llm,
    now: FIXED_NOW,
    log: () => {},
    createDbRepo,
    readFile: async () => JSON.stringify(INPUT),
    writeFile: async (p, data) => {
      written[p] = JSON.parse(data);
    },
    cacheDir: '/tmp/cache',
  });
  assert.equal(createDbRepo.calls, 0);
  assert.equal(res.mode, 'dry-run');
  const outPath = Object.keys(written)[0];
  assert.match(outPath.replace(/\\/g, '/'), /\/tmp\/cache\/v2-process-2026-11-20\.json$/);
  const out = written[outPath];
  assert.equal(out.input_count, 1);
  assert.deepEqual(out.status_counts, { new: 1 });
  assert.equal(out.candidates[0].embedding, '[vector 3]');
  assert.deepEqual(out.steps, ['dedup-hook', 'dedup-card']);
});

test('runner: dry-run --input olmadan çalışmaz (DB okunmaz)', async () => {
  const createDbRepo = spyFactory();
  await assert.rejects(
    () => runProcess([], { config: TEST_CONFIG, llm: fakeLlm({}), log: () => {}, createDbRepo }),
    /--input/,
  );
  assert.equal(createDbRepo.calls, 0);
});

test('runner: --apply → DB repo fabrikası çağrılır, dosya yazılmaz', async () => {
  const repo = createMemoryStepsRepo({ candidates: [] });
  const createDbRepo = spyFactory(() => repo);
  let wrote = false;
  const res = await runProcess(['--apply'], {
    config: TEST_CONFIG,
    llm: fakeLlm({}),
    now: FIXED_NOW,
    log: () => {},
    createDbRepo,
    writeFile: async () => {
      wrote = true;
    },
  });
  assert.equal(createDbRepo.calls, 1);
  assert.equal(res.mode, 'apply');
  assert.equal(wrote, false);
  assert.ok(repo.calls.listByStatus >= 7);
});
