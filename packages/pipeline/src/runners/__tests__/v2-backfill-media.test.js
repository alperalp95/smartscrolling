import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseArgs, run } from '../v2-backfill-media.js';

const IMG = 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Octopus.jpg';

/** Supabase zincirini taklit eden sahte istemci; çağrıları kaydeder. */
function fakeClient(rows) {
  const log = { selects: [], updates: [] };
  const client = {
    log,
    from(table) {
      assert.equal(table, 'facts');
      const q = { filters: [], limit: null };
      const builder = {
        select(cols) {
          q.mode = 'select';
          q.cols = cols;
          return builder;
        },
        update(patch) {
          q.mode = 'update';
          q.patch = patch;
          return builder;
        },
        not(col, op, val) {
          q.filters.push(['not', col, op, val]);
          return builder;
        },
        is(col, val) {
          q.filters.push(['is', col, val]);
          return builder;
        },
        in(col, vals) {
          q.filters.push(['in', col, vals]);
          return builder;
        },
        eq(col, val) {
          q.filters.push(['eq', col, val]);
          return builder;
        },
        order() {
          return builder;
        },
        limit(n) {
          q.limit = n;
          return builder;
        },
        // biome-ignore lint/suspicious/noThenProperty: Supabase sorgu oluşturucusu await edilebilir (thenable); sahte de öyle olmalı.
        then(resolve) {
          if (q.mode === 'select') {
            log.selects.push(q);
            resolve({ data: rows.slice(0, q.limit ?? rows.length), error: null });
          } else {
            log.updates.push(q);
            resolve({ error: null });
          }
        },
      };
      return builder;
    },
  };
  return client;
}

const ROWS = [
  { id: 'a', title: 'Ahtapot', source_url: 'https://tr.wikipedia.org/wiki/Ahtapot' },
  { id: 'b', title: 'Yok', source_url: 'https://en.wikipedia.org/wiki/Nothing' },
];
const resolveImage = async (url) => (url.includes('Ahtapot') ? IMG : null);

test('parseArgs: varsayılan dry-run, limit 100', () => {
  assert.deepEqual(parseArgs([]), { apply: false, dryRun: true, limit: 100 });
  assert.deepEqual(parseArgs(['--apply', '--limit', '5']), {
    apply: true,
    dryRun: false,
    limit: 5,
  });
  assert.throws(() => parseArgs(['--limit', '0']));
});

test('dry-run: hiç update çağırmaz, her kart için satır basar', async () => {
  const client = fakeClient(ROWS);
  const lines = [];
  const sleeps = [];
  const { exitCode } = await run([], {
    client,
    resolveImage,
    sleep: async (ms) => sleeps.push(ms),
    log: (l) => lines.push(l),
  });
  assert.equal(exitCode, 0);
  assert.equal(client.log.updates.length, 0);
  assert.ok(lines.some((l) => l.includes(`Ahtapot → ${IMG}`)));
  assert.ok(lines.some((l) => l.includes('Yok → yok')));
  assert.deepEqual(sleeps, [300, 300]);
});

test('--apply: sadece bulunanları yazar, update da media_url IS NULL ile korunur', async () => {
  const client = fakeClient(ROWS);
  const { exitCode, result } = await run(['--apply'], {
    client,
    resolveImage,
    sleep: async () => {},
    log: () => {},
  });
  assert.equal(exitCode, 0);
  assert.equal(client.log.updates.length, 1);
  const up = client.log.updates[0];
  assert.deepEqual(up.patch, { media_url: IMG });
  assert.deepEqual(up.filters, [
    ['eq', 'id', 'a'],
    ['is', 'media_url', null],
  ]);
  assert.equal(result.written, 1);
  assert.equal(result.not_found, 1);
});

test('sorgu filtresi: source_key not null, media_url null, status published/queued, limit', async () => {
  const client = fakeClient([]);
  await run(['--limit', '7'], { client, resolveImage, sleep: async () => {}, log: () => {} });
  const q = client.log.selects[0];
  assert.deepEqual(q.filters, [
    ['not', 'source_key', 'is', null],
    ['is', 'media_url', null],
    ['in', 'status', ['published', 'queued']],
  ]);
  assert.equal(q.limit, 7);
});
