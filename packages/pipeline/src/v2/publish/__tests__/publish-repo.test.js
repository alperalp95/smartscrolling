import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPublishRepo } from '../index.js';
import { fakeSupabase } from './helpers.js';

const NOW = new Date('2026-11-20T06:00:00.000Z');

test('markPublished: tek update, in(id) + sadece status=queued filtresi, published_at = enjekte now', async () => {
  const client = fakeSupabase(() => ({ data: [{ id: 1 }, { id: 3 }], error: null }));
  const repo = createPublishRepo(client);

  const res = await repo.markPublished([1, 2, 3], NOW);

  assert.equal(client.queries.length, 1);
  const [q] = client.queries;
  assert.equal(q.table, 'facts');
  const ops = q.ops.map((o) => o.method);
  assert.deepEqual(ops.filter((m) => m === 'update'), ['update']);
  const update = q.ops.find((o) => o.method === 'update');
  assert.deepEqual(update.args[0], { status: 'published', published_at: '2026-11-20T06:00:00.000Z' });
  assert.deepEqual(q.ops.find((o) => o.method === 'in').args, ['id', [1, 2, 3]]);
  assert.deepEqual(q.ops.find((o) => o.method === 'eq').args, ['status', 'queued']);
  assert.deepEqual(res, { publishedIds: [1, 3] });
});

test('markPublished: boş liste → DB çağrısı yok', async () => {
  const client = fakeSupabase();
  const res = await createPublishRepo(client).markPublished([], NOW);
  assert.deepEqual(res, { publishedIds: [] });
  assert.equal(client.queries.length, 0);
});

test('markPublished: DB hatası fırlatılır', async () => {
  const client = fakeSupabase(() => ({ data: null, error: { message: 'boom' } }));
  await assert.rejects(createPublishRepo(client).markPublished([1], NOW), /markPublished başarısız: boom/);
});

test('listQueued: status=queued, wow azalan, eski önce, limit', async () => {
  const rows = [{ id: 1, category: 'bilim', wow_score: 9, created_at: '2026-11-01T00:00:00Z' }];
  const client = fakeSupabase(() => ({ data: rows, error: null }));
  const res = await createPublishRepo(client).listQueued(50);
  assert.deepEqual(res, rows);
  const [q] = client.queries;
  assert.equal(q.table, 'facts');
  assert.deepEqual(q.ops.find((o) => o.method === 'select').args, ['id, category, wow_score, created_at']);
  assert.deepEqual(q.ops.find((o) => o.method === 'eq').args, ['status', 'queued']);
  const orders = q.ops.filter((o) => o.method === 'order').map((o) => o.args);
  assert.deepEqual(orders[0], ['wow_score', { ascending: false, nullsFirst: false }]);
  assert.deepEqual(orders[1], ['created_at', { ascending: true }]);
  assert.deepEqual(q.ops.find((o) => o.method === 'limit').args, [50]);
  assert.ok(!q.ops.some((o) => o.method === 'update'));
});

test('countQueued: head count, status=queued', async () => {
  const client = fakeSupabase(() => ({ data: null, count: 42, error: null }));
  assert.equal(await createPublishRepo(client).countQueued(), 42);
  const [q] = client.queries;
  assert.deepEqual(q.ops.find((o) => o.method === 'select').args, ['id', { count: 'exact', head: true }]);
  assert.deepEqual(q.ops.find((o) => o.method === 'eq').args, ['status', 'queued']);
});
