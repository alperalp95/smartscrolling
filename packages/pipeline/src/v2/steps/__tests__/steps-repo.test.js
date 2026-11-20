// Supabase repo: sahte client ile sorgu biçimi (ağ yok).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DuplicateInsertError, createStepsRepo } from '../../db/steps-repo.js';

/** Zincirlenebilir sahte PostgREST sorgusu; her çağrıyı kaydeder, sonunda `result` döner. */
function fakeClient(results = {}) {
  const log = [];
  const builder = (table) => {
    const ops = [];
    const q = new Proxy(
      {},
      {
        get(_, prop) {
          if (prop === 'then') {
            const res = results[`${table}:${ops.map((o) => o[0]).join('.')}`] ?? results[table] ?? { data: [], error: null };
            log.push({ table, ops });
            return (resolve) => resolve(res);
          }
          return (...args) => {
            ops.push([prop, ...args]);
            return q;
          };
        },
      },
    );
    return q;
  };
  return {
    log,
    from: (table) => builder(table),
    rpc: async (name, params) => {
      log.push({ rpc: name, params });
      return results[`rpc:${name}`] ?? { data: [], error: null };
    },
  };
}

test('listByStatus: durum + scores/support filtreleri + created_at sırası + limit', async () => {
  const client = fakeClient();
  const repo = createStepsRepo(client);
  await repo.listByStatus('new', 15, { scoresHas: 'dedup_hook' });
  await repo.listByStatus('written', 5, { scoresLacks: 'dedup_card' });
  await repo.listByStatus('scored', 5, { hasSupport: false });
  const [a, b, c] = client.log;
  assert.equal(a.table, 'fact_candidates');
  assert.deepEqual(a.ops[1], ['eq', 'status', 'new']);
  assert.deepEqual(a.ops[2], ['not', 'scores->dedup_hook', 'is', null]);
  assert.deepEqual(a.ops.at(-2), ['order', 'created_at', { ascending: true }]);
  assert.deepEqual(a.ops.at(-1), ['limit', 15]);
  assert.deepEqual(b.ops[2], ['is', 'scores->dedup_card', null]);
  assert.deepEqual(c.ops[2], ['is', 'support_paragraph', null]);
});

test('matchSimilar: match_similar RPC + aday durumları eklenir', async () => {
  const client = fakeClient({
    'rpc:match_similar': {
      data: [
        { kind: 'fact', id: 'f1', text: 't', similarity: 0.95 },
        { kind: 'candidate', id: 'c1', text: 'h', similarity: 0.9 },
      ],
      error: null,
    },
    fact_candidates: { data: [{ id: 'c1', status: 'rejected' }], error: null },
  });
  const repo = createStepsRepo(client);
  const rows = await repo.matchSimilar([0.1, 0.2], 0.85, 5);
  assert.deepEqual(client.log[0], { rpc: 'match_similar', params: { p_embedding: [0.1, 0.2], p_threshold: 0.85, p_limit: 5 } });
  assert.equal(rows[0].status, undefined);
  assert.equal(rows[1].status, 'rejected');
});

test('insertQueuedFact: 23505 → DuplicateInsertError; başarı → id', async () => {
  const dup = createStepsRepo(fakeClient({ facts: { data: null, error: { code: '23505', message: 'duplicate key' } } }));
  await assert.rejects(() => dup.insertQueuedFact({ title: 'x' }), DuplicateInsertError);
  const ok = createStepsRepo(fakeClient({ facts: { data: { id: 'new-id' }, error: null } }));
  assert.deepEqual(await ok.insertQueuedFact({ title: 'x' }), { id: 'new-id' });
  const other = createStepsRepo(fakeClient({ facts: { data: null, error: { code: '42501', message: 'denied' } } }));
  await assert.rejects(() => other.insertQueuedFact({}), (e) => !(e instanceof DuplicateInsertError) && /denied/.test(e.message));
});

test('updateCandidate: id ile update', async () => {
  const client = fakeClient();
  await createStepsRepo(client).updateCandidate('c1', { status: 'scored' });
  assert.deepEqual(client.log[0].ops, [['update', { status: 'scored' }], ['eq', 'id', 'c1']]);
});
