import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { parseArgs, runCollect } from '../../../runners/v2-collect.js';
import { makeCandidate } from '../types.js';

function fakeCollectors() {
  const seen = [];
  const collector = (id) => ({
    name: `fake ${id}`,
    async collect({ limit, cursor }) {
      seen.push({ id, limit, cursor });
      const candidates = Array.from({ length: Math.min(limit, 7) }, (_, i) =>
        makeCandidate({ source_key: `${id}:${i}`, source: 'enwiki_dyk', lang: 'en', hook_text: `hook number ${i} from source ${id}` }),
      );
      return { candidates, nextCursor: { offset: (cursor?.offset ?? 0) + candidates.length }, stats: { fake: true } };
    },
  });
  return { seen, collectors: { s1: collector('s1'), s2: collector('s2'), s3: collector('s3'), s4: collector('s4') } };
}

async function tempDir() {
  return fs.mkdtemp(path.join(os.tmpdir(), 'v2-collect-'));
}

test('parseArgs: varsayılanlar dry-run, all, 200; geçersiz değerler hata', () => {
  assert.deepEqual(parseArgs([]), { source: 'all', sources: ['s1', 's2', 's3', 's4'], limit: 200, apply: false });
  assert.deepEqual(parseArgs(['--source', 's2', '--limit', '20', '--dry-run']), { source: 's2', sources: ['s2'], limit: 20, apply: false });
  assert.equal(parseArgs(['--source=s4', '--apply']).apply, true);
  assert.throws(() => parseArgs(['--source', 's9']));
  assert.throws(() => parseArgs(['--limit', '0']));
  assert.throws(() => parseArgs(['--bogus']));
});

test('runner: --apply olmadan client alınmaz ve yazma fonksiyonu çağrılmaz; cache dosyası yazılır', async () => {
  const cacheDir = await tempDir();
  const { collectors, seen } = fakeCollectors();
  let getClientCalls = 0;
  let insertCalls = 0;
  const lines = [];
  const result = await runCollect({
    args: ['--source', 'all', '--limit', '3'],
    collectors,
    http: {},
    getClient: async () => {
      getClientCalls += 1;
      return {};
    },
    insert: async () => {
      insertCalls += 1;
      return { inserted: 0, skipped: 0 };
    },
    cacheDir,
    now: new Date('2026-11-20T12:00:00Z'),
    log: (line) => lines.push(line),
  });
  assert.equal(getClientCalls, 0);
  assert.equal(insertCalls, 0);
  assert.equal(seen.length, 4);
  assert.ok(seen.every((s) => s.limit === 3 && s.cursor === null));
  assert.equal(result.candidates.length, 12);

  const out = JSON.parse(await fs.readFile(path.join(cacheDir, 'v2-collect-all-2026-11-20.json'), 'utf8'));
  assert.equal(out.dry_run, true);
  assert.equal(out.candidates.length, 12);
  assert.equal(out.summary.s1.count, 3);
  // dry-run imleç durumunu ilerletmez
  await assert.rejects(fs.readFile(path.join(cacheDir, 'v2-collect-state.json'), 'utf8'));
  assert.ok(lines.some((l) => l.includes('[s1] fake s1: 3 aday')));
  assert.equal(lines.filter((l) => l.startsWith('  - ')).length, 12);
});

test('runner: konsolda kaynak başına en fazla 5 örnek kanca', async () => {
  const cacheDir = await tempDir();
  const { collectors } = fakeCollectors();
  const lines = [];
  await runCollect({ args: ['--source', 's1', '--limit', '50'], collectors, http: {}, cacheDir, log: (l) => lines.push(l) });
  assert.equal(lines.filter((l) => l.startsWith('  - ')).length, 5);
});

test('runner: --apply verilirse insert çağrılır ve imleç kaydedilir; sonraki run imleçten başlar', async () => {
  const cacheDir = await tempDir();
  const { collectors, seen } = fakeCollectors();
  const client = { fake: true };
  const inserts = [];
  const insert = async (c, candidates) => {
    assert.equal(c, client);
    inserts.push(candidates.length);
    return { inserted: candidates.length, skipped: 0 };
  };
  await runCollect({ args: ['--source', 's1', '--limit', '4', '--apply'], collectors, http: {}, getClient: async () => client, insert, cacheDir, log: () => {} });
  assert.deepEqual(inserts, [4]);
  const state = JSON.parse(await fs.readFile(path.join(cacheDir, 'v2-collect-state.json'), 'utf8'));
  assert.deepEqual(state, { s1: { offset: 4 } });

  await runCollect({ args: ['--source', 's1', '--limit', '4'], collectors, http: {}, cacheDir, log: () => {} });
  assert.deepEqual(seen[1].cursor, { offset: 4 });
});

test('runner: bir kaynak hata verirse diğerleri yine çalışır', async () => {
  const cacheDir = await tempDir();
  const { collectors } = fakeCollectors();
  collectors.s2 = { name: 'broken', collect: async () => Promise.reject(new Error('boom')) };
  const result = await runCollect({ args: ['--limit', '2'], collectors, http: {}, cacheDir, log: () => {} });
  assert.equal(result.failed, 1);
  assert.equal(result.summary.s2.error, 'boom');
  assert.equal(result.candidates.length, 6);
});
