import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { DEFAULT_MIX, parseArgs, parseMix, runCollect, shareFor } from '../../../runners/v2-collect.js';
import { makeCandidate } from '../types.js';

function fakeCollectors({ perSource = 7 } = {}) {
  const seen = [];
  const collector = (id) => ({
    name: `fake ${id}`,
    async collect({ limit, cursor, backfill }) {
      seen.push({ id, limit, cursor, backfill });
      const candidates = Array.from({ length: Math.min(limit, perSource) }, (_, i) =>
        makeCandidate({ source_key: `${id}:${i}`, source: 'enwiki_dyk', lang: 'en', hook_text: `hook number ${i} from source ${id}` }),
      );
      const result = { candidates, nextCursor: { offset: (cursor?.offset ?? 0) + candidates.length }, stats: { fake: true } };
      if (backfill) {
        result.backfill = {
          nextCursor: { next: backfill.cursor?.next === '2026-09' ? '2026-08' : '2026-09', offset: 0, from: backfill.from, done: false },
          stats: { taken: 0, months: [{ month: '2026-09', missing: true }] },
        };
      }
      return result;
    },
  });
  return { seen, collectors: { s1: collector('s1'), s2: collector('s2'), s3: collector('s3'), s4: collector('s4') } };
}

/** `pipeline_state` taklidi: getState/setState bellekte. */
function fakeStateRepo(initial = {}) {
  const store = new Map(Object.entries(initial));
  const calls = { get: [], set: [] };
  return {
    store,
    calls,
    getState: async (client, key) => {
      calls.get.push({ client, key });
      return store.has(key) ? store.get(key) : null;
    },
    setState: async (client, key, value) => {
      calls.set.push({ client, key, value });
      store.set(key, value);
    },
  };
}

async function tempDir() {
  return fs.mkdtemp(path.join(os.tmpdir(), 'v2-collect-'));
}

test('parseArgs: varsayılanlar dry-run, all, 200 toplam, varsayılan mix; geçersiz değerler hata', () => {
  assert.deepEqual(parseArgs([]), {
    source: 'all',
    sources: ['s3', 's4', 's2', 's1'],
    limit: 200,
    apply: false,
    mix: parseMix(DEFAULT_MIX),
    backfillFrom: null,
    backfillMonths: 1,
  });
  const s2 = parseArgs(['--source', 's2', '--limit', '20', '--dry-run', '--backfill-from', '2024-03', '--backfill-months', '2']);
  assert.deepEqual(s2.sources, ['s2']);
  assert.deepEqual(s2.mix, [{ id: 's2', quota: 15 }]); // --source karışımdaki payı korur
  assert.equal(s2.limit, 20);
  assert.equal(s2.backfillFrom, '2024-03');
  assert.equal(s2.backfillMonths, 2);
  assert.equal(parseArgs(['--source=s4', '--apply']).apply, true);
  // mix dışındaki kaynak --source ile seçilirse kalanın tamamını alır
  assert.deepEqual(parseArgs(['--source', 's1', '--mix', 's2:all']).mix, [{ id: 's1', quota: 'rest' }]);
  assert.throws(() => parseArgs(['--source', 's9']));
  assert.throws(() => parseArgs(['--limit', '0']));
  assert.throws(() => parseArgs(['--limit', '5x']));
  assert.throws(() => parseArgs(['--backfill-from', '2024-3']));
  assert.throws(() => parseArgs(['--backfill-from', '2024-13']));
  assert.throws(() => parseArgs(['--backfill-months', '0']));
  assert.throws(() => parseArgs(['--bogus']));
});

test('parseMix: varsayılan sıra ve paylar; hatalı girişler', () => {
  assert.deepEqual(parseMix(DEFAULT_MIX), [
    { id: 's3', quota: 'all' },
    { id: 's4', quota: 10 },
    { id: 's2', quota: 15 },
    { id: 's1', quota: 'rest' },
  ]);
  assert.deepEqual(parseMix(' s4:10 , s1 '), [
    { id: 's4', quota: 10 },
    { id: 's1', quota: 'all' },
  ]);
  assert.throws(() => parseMix('s9:all'));
  assert.throws(() => parseMix('s1:all,s1:10'));
  assert.throws(() => parseMix('s1:rest,s2:rest'));
  assert.throws(() => parseMix('s1:many'));
  assert.throws(() => parseMix(''));
});

test('shareFor: all/rest kalanın tamamı, sayı min(sayı, kalan), kalan yoksa 0', () => {
  assert.equal(shareFor({ quota: 'all' }, 50), 50);
  assert.equal(shareFor({ quota: 'rest' }, 7), 7);
  assert.equal(shareFor({ quota: 30 }, 50), 30);
  assert.equal(shareFor({ quota: 30 }, 12), 12);
  assert.equal(shareFor({ quota: 'all' }, 0), 0);
});

test('runner --mix: varsayılan dağılım s3 → s4 (≤10) → s2 (≤15) → s1 (kalan); --limit toplamı sınırlar', async () => {
  const cacheDir = await tempDir();
  const { collectors, seen } = fakeCollectors({ perSource: 25 });
  const result = await runCollect({ args: ['--limit', '100'], collectors, http: {}, cacheDir, log: () => {} });
  assert.deepEqual(
    seen.map((s) => [s.id, s.limit]),
    [
      ['s3', 100],
      ['s4', 10],
      ['s2', 15],
      ['s1', 50],
    ],
  );
  assert.equal(result.candidates.length, 75);
  assert.deepEqual(
    Object.fromEntries(Object.entries(result.summary).map(([id, s]) => [id, s.count])),
    { s3: 25, s4: 10, s2: 15, s1: 25 },
  );
});

test('runner --mix: limit dolunca sonraki kaynaklar çağrılmaz; hata veren kaynağın payı sonrakine geçer', async () => {
  const cacheDir = await tempDir();
  const { collectors, seen } = fakeCollectors({ perSource: 25 });
  const result = await runCollect({ args: ['--limit', '40'], collectors, http: {}, cacheDir, log: () => {} });
  assert.deepEqual(
    seen.map((s) => [s.id, s.limit]),
    [
      ['s3', 40],
      ['s4', 10],
      ['s2', 5],
    ],
  );
  assert.equal(result.summary.s1.skipped, 'limit');
  assert.equal(result.candidates.length, 40);

  const broken = fakeCollectors({ perSource: 25 });
  broken.collectors.s2 = { name: 'broken', collect: async () => Promise.reject(new Error('boom')) };
  const r2 = await runCollect({ args: ['--limit', '40', '--mix', 's2:all,s1:rest'], collectors: broken.collectors, http: {}, cacheDir, log: () => {} });
  assert.equal(r2.failed, 1);
  assert.equal(r2.summary.s2.error, 'boom');
  assert.deepEqual(broken.seen.map((s) => [s.id, s.limit]), [['s1', 40]]);
  assert.equal(r2.candidates.length, 25);
});

test('runner dry-run: client/insert/DB state çağrılmaz; imleç .cache dosyasından okunur, dosya ilerletilmez', async () => {
  const cacheDir = await tempDir();
  const stateFile = path.join(cacheDir, 'v2-collect-state.json');
  const initial = { 'cursor:s3': { offset: 11 }, s4: { offset: 5 }, 'cursor:s2-backfill': { next: '2026-09', offset: 0 } };
  await fs.writeFile(stateFile, JSON.stringify(initial));
  const { collectors, seen } = fakeCollectors();
  const repo = fakeStateRepo();
  let getClientCalls = 0;
  let insertCalls = 0;
  const lines = [];
  const result = await runCollect({
    args: ['--limit', '30', '--backfill-from', '2024-03'],
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
    getState: repo.getState,
    setState: repo.setState,
    cacheDir,
    now: new Date('2026-11-20T12:00:00Z'),
    log: (line) => lines.push(line),
  });
  assert.equal(getClientCalls, 0);
  assert.equal(insertCalls, 0);
  assert.equal(repo.calls.get.length + repo.calls.set.length, 0);
  const byId = Object.fromEntries(seen.map((s) => [s.id, s]));
  assert.equal(byId.s2.cursor, null);
  assert.deepEqual(byId.s2.backfill, { from: '2024-03', months: 1, cursor: { next: '2026-09', offset: 0 } });
  assert.deepEqual(byId.s3.cursor, { offset: 11 });
  assert.deepEqual(byId.s4.cursor, { offset: 5 }); // eski dosya biçimi
  assert.equal(byId.s3.backfill, undefined);
  assert.equal(result.candidates.length, 28);

  assert.deepEqual(JSON.parse(await fs.readFile(stateFile, 'utf8')), initial);
  const out = JSON.parse(await fs.readFile(path.join(cacheDir, 'v2-collect-all-2026-11-20.json'), 'utf8'));
  assert.equal(out.dry_run, true);
  assert.equal(out.cursor_store, 'file');
  assert.equal(out.mix, 's3:all,s4:10,s2:15,s1:rest');
  assert.equal(out.candidates.length, 28);
  assert.ok(lines.some((l) => l.includes('[s2] fake s2: 7 aday (pay 15)')));
  assert.ok(lines.some((l) => l.includes('backfill: 0 aday') && l.includes('2026-09 (sayfa yok)')));
  assert.ok(lines.filter((l) => l.startsWith('  - ')).length <= 20);
});

test('runner: konsolda kaynak başına en fazla 5 örnek kanca', async () => {
  const cacheDir = await tempDir();
  const { collectors } = fakeCollectors();
  const lines = [];
  await runCollect({ args: ['--source', 's1', '--limit', '50'], collectors, http: {}, cacheDir, log: (l) => lines.push(l) });
  assert.equal(lines.filter((l) => l.startsWith('  - ')).length, 5);
});

test('runner --apply: imleçler pipeline_state\'ten okunur ve yazılır (.cache yok sayılır); sonraki run DB imlecinden başlar', async () => {
  const cacheDir = await tempDir();
  // .cache'te farklı bir imleç olsa da --apply onu kullanmaz
  await fs.writeFile(path.join(cacheDir, 'v2-collect-state.json'), JSON.stringify({ 'cursor:s1': { offset: 999 } }));
  const { collectors, seen } = fakeCollectors();
  const client = { fake: true };
  const repo = fakeStateRepo({ 'cursor:s1': { offset: 100 } });
  const inserts = [];
  const insert = async (c, candidates) => {
    assert.equal(c, client);
    inserts.push(candidates.length);
    return { inserted: candidates.length, skipped: 0 };
  };
  const common = { collectors, http: {}, getClient: async () => client, insert, getState: repo.getState, setState: repo.setState, cacheDir, log: () => {} };

  await runCollect({ args: ['--source', 's1', '--limit', '4', '--apply'], ...common });
  assert.deepEqual(inserts, [4]);
  assert.deepEqual(seen[0].cursor, { offset: 100 });
  assert.deepEqual(repo.calls.get.map((g) => g.key), ['cursor:s1']);
  assert.ok(repo.calls.get.every((g) => g.client === client));
  assert.deepEqual(repo.calls.set, [{ client, key: 'cursor:s1', value: { offset: 104 } }]);

  await runCollect({ args: ['--source', 's1', '--limit', '4', '--apply'], ...common });
  assert.deepEqual(seen[1].cursor, { offset: 104 });
  assert.deepEqual(repo.store.get('cursor:s1'), { offset: 108 });
  // .cache dosyasına dokunulmadı
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(cacheDir, 'v2-collect-state.json'), 'utf8')), { 'cursor:s1': { offset: 999 } });
});

test('runner --apply: S2 backfill imleci cursor:s2-backfill anahtarında okunur/yazılır', async () => {
  const cacheDir = await tempDir();
  const { collectors, seen } = fakeCollectors();
  const repo = fakeStateRepo({ 'cursor:s2-backfill': { next: '2026-09', offset: 0, from: '2024-03', done: false } });
  const args = ['--source', 's2', '--limit', '20', '--backfill-from', '2024-03', '--apply'];
  await runCollect({
    args,
    collectors,
    http: {},
    getClient: async () => ({}),
    insert: async (c, list) => ({ inserted: list.length, skipped: 0 }),
    getState: repo.getState,
    setState: repo.setState,
    cacheDir,
    log: () => {},
  });
  assert.deepEqual(seen[0].backfill.cursor, { next: '2026-09', offset: 0, from: '2024-03', done: false });
  assert.deepEqual(repo.calls.get.map((g) => g.key), ['cursor:s2', 'cursor:s2-backfill']);
  assert.deepEqual(repo.calls.set.map((s) => s.key), ['cursor:s2', 'cursor:s2-backfill']);
  assert.equal(repo.store.get('cursor:s2-backfill').next, '2026-08');
});

test('runner --apply: insert hata verirse imleç yazılmaz; null imleç yazılmaz', async () => {
  const cacheDir = await tempDir();
  const { collectors } = fakeCollectors();
  collectors.s3 = { name: 'null cursor', collect: async () => ({ candidates: [], nextCursor: null, stats: {} }) };
  const repo = fakeStateRepo();
  const result = await runCollect({
    args: ['--limit', '20', '--mix', 's1:5,s3:all', '--apply'],
    collectors,
    http: {},
    getClient: async () => ({}),
    insert: async () => {
      throw new Error('db down');
    },
    getState: repo.getState,
    setState: repo.setState,
    cacheDir,
    log: () => {},
  });
  assert.equal(result.summary.s1.error, 'db down');
  assert.equal(repo.calls.set.length, 0);
});
