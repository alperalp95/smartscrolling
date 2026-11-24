import assert from 'node:assert/strict';
import { test } from 'node:test';
import { contentHash } from '../../dedup/index.js';
import { run } from '../v2-backfill-embeddings.js';

function makeClient(rows, { hashTaken = new Set() } = {}) {
  const updates = [];
  return {
    updates,
    from() {
      return {
        select() {
          const q = {
            is: () => q,
            order: () => q,
            limit: (n) => Promise.resolve({ data: rows.slice(0, n), error: null }),
          };
          return q;
        },
        update(patch) {
          return {
            eq(_col, id) {
              if (patch.content_hash && hashTaken.has(patch.content_hash)) {
                return Promise.resolve({ error: { code: '23505', message: 'duplicate key' } });
              }
              updates.push({ id, patch });
              return Promise.resolve({ error: null });
            },
          };
        },
      };
    },
  };
}

function makeLlm({ failCall = -1 } = {}) {
  const calls = [];
  return {
    calls,
    async embed(texts) {
      calls.push(texts);
      if (calls.length - 1 === failCall) throw new Error('boom');
      return { vectors: texts.map((t) => [t.length, 1]) };
    },
  };
}

const mkRows = (n) =>
  Array.from({ length: n }, (_, i) => ({
    id: `id-${String(i).padStart(3, '0')}`,
    title: ` T${i} `,
    content: ` C${i} `,
    content_hash: null,
  }));

const quiet = () => {};

test('dry-run: llm ve update çağrılmaz', async () => {
  const client = makeClient(mkRows(5));
  const llm = makeLlm();
  const { exitCode, result } = await run([], { client, llm, log: quiet });
  assert.equal(exitCode, 0);
  assert.equal(result.processed, 5);
  assert.equal(llm.calls.length, 0);
  assert.equal(client.updates.length, 0);
});

test('apply: 120 satır → 3 grup, doğru metin + hash yazılır', async () => {
  const client = makeClient(mkRows(120));
  const llm = makeLlm();
  const { exitCode, result } = await run(['--apply'], { client, llm, log: quiet });
  assert.equal(exitCode, 0);
  assert.deepEqual(
    llm.calls.map((c) => c.length),
    [50, 50, 20],
  );
  assert.equal(result.written, 120);
  assert.equal(client.updates.length, 120);
  const u = client.updates[7];
  const text = 'T7\nC7';
  assert.equal(u.id, 'id-007');
  assert.deepEqual(u.patch.embedding, [text.length, 1]);
  assert.equal(u.patch.content_hash, contentHash(text));
});

test('dolu content_hash üzerine yazılmaz', async () => {
  const rows = [{ ...mkRows(1)[0], content_hash: 'old' }];
  const client = makeClient(rows);
  await run(['--apply'], { client, llm: makeLlm(), log: quiet });
  assert.equal('content_hash' in client.updates[0].patch, false);
});

test('hash çakışması: embedding yazılır, hash yazılmaz, sayaç artar', async () => {
  const client = makeClient(mkRows(2), { hashTaken: new Set([contentHash('T0\nC0')]) });
  const { result } = await run(['--apply'], { client, llm: makeLlm(), log: quiet });
  assert.equal(result.duplicate_hash, 1);
  assert.equal(result.written, 2);
  assert.equal(result.errors, 0);
  const first = client.updates.find((u) => u.id === 'id-000');
  assert.equal('content_hash' in first.patch, false);
  assert.ok(first.patch.embedding);
});

test('embedding hatası: grup atlanır, hata artar, sonraki grup devam eder', async () => {
  const client = makeClient(mkRows(120));
  const llm = makeLlm({ failCall: 1 });
  const { exitCode, result } = await run(['--apply'], { client, llm, log: quiet });
  assert.equal(exitCode, 1);
  assert.equal(llm.calls.length, 3);
  assert.equal(result.errors, 50);
  assert.equal(result.written, 70);
});

test('--limit uygulanır', async () => {
  const client = makeClient(mkRows(30));
  const { result } = await run(['--limit', '10'], { client, log: quiet });
  assert.equal(result.processed, 10);
});
