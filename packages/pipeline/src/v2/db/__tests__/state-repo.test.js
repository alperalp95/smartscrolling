import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getState, setState, STATE_TABLE } from '../state-repo.js';

/** `pipeline_state` için Supabase query builder taklidi (bellekte). */
function fakeClient({ rows = {}, error = null } = {}) {
  const store = new Map(Object.entries(rows));
  const calls = { select: [], upsert: [] };
  return {
    store,
    calls,
    from(table) {
      assert.equal(table, STATE_TABLE);
      return {
        select(columns) {
          return {
            eq(column, value) {
              return {
                maybeSingle() {
                  calls.select.push({ columns, column, value });
                  if (error) return Promise.resolve({ data: null, error });
                  return Promise.resolve({ data: store.has(value) ? { value: store.get(value).value } : null, error: null });
                },
              };
            },
          };
        },
        upsert(row, options) {
          calls.upsert.push({ row, options });
          if (error) return Promise.resolve({ data: null, error });
          store.set(row.key, row);
          return Promise.resolve({ data: null, error: null });
        },
      };
    },
  };
}

test('getState: kayıtlı değeri döner, yoksa null', async () => {
  const client = fakeClient({ rows: { 'cursor:s1': { value: { offset: 400 } } } });
  assert.deepEqual(await getState(client, 'cursor:s1'), { offset: 400 });
  assert.equal(await getState(client, 'cursor:s9'), null);
  assert.deepEqual(client.calls.select[0], { columns: 'value', column: 'key', value: 'cursor:s1' });
});

test('setState: key üzerinden upsert, updated_at yazılır; getState aynı değeri okur', async () => {
  const client = fakeClient();
  const now = new Date('2026-11-20T06:00:00Z');
  await setState(client, 'cursor:s2-backfill', { next: '2026-08', offset: 0 }, { now });
  assert.deepEqual(client.calls.upsert[0], {
    row: { key: 'cursor:s2-backfill', value: { next: '2026-08', offset: 0 }, updated_at: '2026-11-20T06:00:00.000Z' },
    options: { onConflict: 'key' },
  });
  assert.deepEqual(await getState(client, 'cursor:s2-backfill'), { next: '2026-08', offset: 0 });
});

test('state-repo: Supabase hatası anahtarla birlikte fırlatılır', async () => {
  const client = fakeClient({ error: { message: 'relation "pipeline_state" does not exist' } });
  await assert.rejects(getState(client, 'cursor:s1'), /pipeline_state okunamadı \(cursor:s1\)/);
  await assert.rejects(setState(client, 'cursor:s1', {}), /pipeline_state yazılamadı \(cursor:s1\)/);
});
