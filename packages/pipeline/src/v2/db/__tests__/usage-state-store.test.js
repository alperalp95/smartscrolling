import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  USAGE_STATE_PREFIX,
  createStateUsageStore,
  createUsageTracker,
} from '../../../llm/usage.js';
import { RUNS_TABLE, insertRun } from '../runs-repo.js';
import { STATE_TABLE } from '../state-repo.js';

/** Config'ten bağımsız sabit limitler: Groq model başına 200K token/gün, %90'da dur. */
const providers = {
  groq: { stopAtPercent: 90, dailyLimits: { perModel: { requests: 1000, tokens: 200000 } } },
};

/** `pipeline_state` sahte client'ı (bellekte); upsert/select çağrılarını kaydeder. */
function fakeStateClient({ rows = {}, failUpsert = false, failSelect = false } = {}) {
  const store = new Map(Object.entries(rows));
  const calls = { select: [], upsert: [] };
  return {
    store,
    calls,
    from(table) {
      assert.equal(table, STATE_TABLE);
      return {
        select() {
          return {
            eq(_col, key) {
              return {
                async maybeSingle() {
                  calls.select.push(key);
                  if (failSelect) return { data: null, error: { message: 'select down' } };
                  return {
                    data: store.has(key) ? { value: structuredClone(store.get(key)) } : null,
                    error: null,
                  };
                },
              };
            },
          };
        },
        async upsert(row, options) {
          calls.upsert.push({ row: structuredClone(row), options });
          if (failUpsert) return { data: null, error: { message: 'upsert down' } };
          store.set(row.key, structuredClone(row.value));
          return { data: null, error: null };
        },
      };
    },
  };
}

test('state usage store: anahtar llm-usage:<gün>, okuma/yazma', async () => {
  const client = fakeStateClient({
    rows: { 'llm-usage:2026-11-21': { date: '2026-11-21', providers: { groq: { requests: 3 } } } },
  });
  const store = createStateUsageStore({ client });
  assert.equal(USAGE_STATE_PREFIX, 'llm-usage:');
  assert.equal(store.kind, 'db');
  assert.equal(store.key('2026-11-21'), 'llm-usage:2026-11-21');
  assert.deepEqual(await store.load('2026-11-21'), {
    date: '2026-11-21',
    providers: { groq: { requests: 3 } },
  });
  assert.equal(await store.load('2026-11-22'), null);
  await store.save('2026-11-22', { date: '2026-11-22', providers: {} });
  assert.deepEqual(client.calls.upsert[0].options, { onConflict: 'key' });
  assert.equal(client.calls.upsert[0].row.key, 'llm-usage:2026-11-22');
  assert.ok(client.calls.upsert[0].row.updated_at);
  assert.deepEqual(client.store.get('llm-usage:2026-11-22'), { date: '2026-11-22', providers: {} });
});

test('state usage store + tracker: aynı günün ikinci run’ı bütçeyi DB’den devralır', async () => {
  const client = fakeStateClient();
  const now = () => Date.parse('2026-11-21T03:17:00Z');

  const run1 = createUsageTracker({ providers, store: createStateUsageStore({ client }), now });
  await run1.record('groq', 'openai/gpt-oss-120b', { inputTokens: 100000, outputTokens: 79999 });
  const saved = client.store.get('llm-usage:2026-11-21');
  assert.equal(saved.providers.groq.models['openai/gpt-oss-120b'].tokens, 179999);

  // Yeni süreç (Actions'ta yeni run): bellek boş, sayaç DB'den gelir.
  const run2 = createUsageTracker({ providers, store: createStateUsageStore({ client }), now });
  assert.equal((await run2.check('groq', 'openai/gpt-oss-120b')).allowed, true);
  await run2.record('groq', 'openai/gpt-oss-120b', { inputTokens: 1 });
  const blocked = await run2.check('groq', 'openai/gpt-oss-120b');
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.reason, 'budget');
});

test('state usage store + tracker: UTC gün değişiminde yeni anahtar, sayaç sıfır', async () => {
  const client = fakeStateClient();
  let t = Date.parse('2026-11-21T23:59:00Z');
  const tracker = createUsageTracker({
    providers,
    store: createStateUsageStore({ client }),
    now: () => t,
  });
  await tracker.record('groq', 'qwen/qwen3.8-27b', { inputTokens: 500, outputTokens: 100 });
  t = Date.parse('2026-11-22T00:01:00Z');
  await tracker.record('groq', 'qwen/qwen3.8-27b', { inputTokens: 10, outputTokens: 0 });
  assert.equal(
    client.store.get('llm-usage:2026-11-21').providers.groq.models['qwen/qwen3.8-27b'].tokens,
    600,
  );
  assert.equal(
    client.store.get('llm-usage:2026-11-22').providers.groq.models['qwen/qwen3.8-27b'].tokens,
    10,
  );
  assert.ok(client.calls.select.includes('llm-usage:2026-11-22'));
  assert.equal((await tracker.snapshot()).date, '2026-11-22');
});

test('state usage store: yazma hatası hattı durdurmaz (onError + errors sayacı), okuma hatası fırlatır', async () => {
  const seen = [];
  const client = fakeStateClient({ failUpsert: true });
  const store = createStateUsageStore({
    client,
    onError: (err, day) => seen.push([day, err.message]),
  });
  const tracker = createUsageTracker({
    providers,
    store,
    now: () => Date.parse('2026-11-21T10:00:00Z'),
  });
  await tracker.record('groq', 'qwen/qwen3.8-27b', { inputTokens: 1 });
  await tracker.record('groq', 'qwen/qwen3.8-27b', { inputTokens: 1 });
  assert.equal(store.errors, 2);
  assert.equal(seen[0][0], '2026-11-21');
  assert.match(seen[0][1], /upsert down/);
  assert.equal((await tracker.snapshot()).providers.groq.models['qwen/qwen3.8-27b'].requests, 2);

  const broken = createStateUsageStore({ client: fakeStateClient({ failSelect: true }) });
  await assert.rejects(() => broken.load('2026-11-21'), /select down/);
  assert.throws(() => createStateUsageStore({}), /client gerekli/);
});

test('insertRun: pipeline_runs’a yazar, id döner; hata fırlatır', async () => {
  const inserted = [];
  const client = (error) => ({
    from(table) {
      assert.equal(table, RUNS_TABLE);
      return {
        insert(row) {
          inserted.push(row);
          return {
            select(cols) {
              assert.equal(cols, 'id');
              return {
                single: async () =>
                  error ? { data: null, error } : { data: { id: 'r1' }, error: null },
              };
            },
          };
        },
      };
    },
  });
  assert.deepEqual(await insertRun(client(null), { ok: true }), { id: 'r1' });
  assert.deepEqual(inserted[0], { ok: true });
  await assert.rejects(
    () => insertRun(client({ message: 'rls' }), {}),
    /pipeline_runs yazılamadı: rls/,
  );
});
