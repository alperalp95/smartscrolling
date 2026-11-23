import assert from 'node:assert/strict';
// Supabase repo: sahte client ile sorgu biçimi (ağ yok).
import { test } from 'node:test';
import {
  DuplicateInsertError,
  createMemoryStepsRepo,
  createStepsRepo,
  parseVector,
} from '../../db/steps-repo.js';

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
            const res = results[`${table}:${ops.map((o) => o[0]).join('.')}`] ??
              results[table] ?? { data: [], error: null };
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

test('matchSimilar: 5 argümanlı match_similar (p_kinds, p_exclude_candidate), ikinci sorgu yok, vector metni diziye', async () => {
  const client = fakeClient({
    'rpc:match_similar': {
      data: [
        { kind: 'fact', id: 'f1', text: 't', similarity: 0.95 },
        { kind: 'candidate', id: 'c1', text: 'h', similarity: 0.9, embedding: '[0.5,0.25]' },
      ],
      error: null,
    },
  });
  const repo = createStepsRepo(client);
  const rows = await repo.matchSimilar([0.1, 0.2], 0.85, 5, {
    kinds: ['fact', 'candidate'],
    excludeCandidate: 'c9',
  });
  assert.deepEqual(client.log[0], {
    rpc: 'match_similar',
    params: {
      p_embedding: [0.1, 0.2],
      p_threshold: 0.85,
      p_limit: 5,
      p_kinds: ['fact', 'candidate'],
      p_exclude_candidate: 'c9',
    },
  });
  assert.equal(client.log.length, 1, 'aday durumları için ikinci sorgu yapılmaz');
  assert.ok(Array.isArray(client.log[0].params.p_embedding), 'vektör düz JS dizisi olarak gider');
  assert.deepEqual(rows[1].embedding, [0.5, 0.25]);

  await repo.matchSimilar([0.1], 0.9, 5, { kinds: ['fact'] });
  assert.deepEqual(client.log[1].params.p_kinds, ['fact']);
  assert.equal(client.log[1].params.p_exclude_candidate, null);
  await repo.matchSimilar([0.1], 0.9, 5);
  assert.deepEqual(client.log[2].params.p_kinds, ['fact', 'candidate'], 'varsayılan DB ile aynı');
});

test('parseVector: PostgREST vector metni → dizi; listByStatus satırlarında da çevrilir', async () => {
  assert.deepEqual(parseVector('[1,2.5,-3]'), [1, 2.5, -3]);
  assert.deepEqual(parseVector([1, 2]), [1, 2]);
  assert.equal(parseVector(null), null);
  assert.equal(parseVector('bozuk'), null);
  const client = fakeClient({
    fact_candidates: {
      data: [{ id: 'c1', embedding: '[0.1,0.2]', scores: { draft_embedding: '[0.3]' } }],
      error: null,
    },
  });
  const [row] = await createStepsRepo(client).listByStatus('written', 5);
  assert.deepEqual(row.embedding, [0.1, 0.2]);
  assert.deepEqual(row.scores.draft_embedding, [0.3]);
});

test('bellek içi matchSimilar: p_kinds, p_exclude_candidate ve rejected filtresini taklit eder', async () => {
  const v = [1, 0, 0];
  const repo = createMemoryStepsRepo({
    candidates: [
      { id: 'self', hook_text: 'a', embedding: v },
      { id: 'other', hook_text: 'b', embedding: v },
      { id: 'dead', hook_text: 'c', embedding: v, status: 'rejected' },
    ],
    facts: [
      { id: 'f-pub', title: 'T', content: 'C', embedding: v, status: 'published' },
      { id: 'f-arch', title: 'T', content: 'C', embedding: v, status: 'archived' },
    ],
  });
  const ids = (rows) => rows.map((r) => r.id).sort();
  assert.deepEqual(
    ids(
      await repo.matchSimilar(v, 0.5, 10, {
        kinds: ['fact', 'candidate'],
        excludeCandidate: 'self',
      }),
    ),
    ['f-pub', 'other'],
  );
  assert.deepEqual(ids(await repo.matchSimilar(v, 0.5, 10, { kinds: ['fact'] })), ['f-pub']);
  assert.deepEqual(ids(await repo.matchSimilar(v, 0.5, 10)), ['f-pub', 'other', 'self']);
  assert.deepEqual(repo.lastMatchArgs().kinds, ['fact', 'candidate']);
});

test('insertQueuedFact: 23505 → DuplicateInsertError; başarı → id', async () => {
  const dup = createStepsRepo(
    fakeClient({ facts: { data: null, error: { code: '23505', message: 'duplicate key' } } }),
  );
  await assert.rejects(() => dup.insertQueuedFact({ title: 'x' }), DuplicateInsertError);
  const ok = createStepsRepo(fakeClient({ facts: { data: { id: 'new-id' }, error: null } }));
  assert.deepEqual(await ok.insertQueuedFact({ title: 'x' }), { id: 'new-id' });
  const other = createStepsRepo(
    fakeClient({ facts: { data: null, error: { code: '42501', message: 'denied' } } }),
  );
  await assert.rejects(
    () => other.insertQueuedFact({}),
    (e) => !(e instanceof DuplicateInsertError) && /denied/.test(e.message),
  );
});

test('updateCandidate: id ile update', async () => {
  const client = fakeClient();
  await createStepsRepo(client).updateCandidate('c1', { status: 'scored' });
  assert.deepEqual(client.log[0].ops, [
    ['update', { status: 'scored' }],
    ['eq', 'id', 'c1'],
  ]);
});
