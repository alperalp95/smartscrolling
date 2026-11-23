import { test } from 'node:test';
import assert from 'node:assert/strict';
import { insertCandidates, CANDIDATES_TABLE } from '../candidates-repo.js';
import { makeCandidate } from '../../sources/types.js';

/**
 * Supabase query builder taklidi. `existingHashes` tabloda olan hook_hash'ler, `existingKeys`
 * tabloda olan source_key'ler; upsert ignoreDuplicates ile çakışanları döndürmez.
 */
function fakeClient({ existingHashes = [], existingKeys = [], upsertError = null } = {}) {
  const calls = { select: [], upsert: [] };
  const hashes = new Set(existingHashes);
  const keys = new Set(existingKeys);
  let failNext = upsertError;
  return {
    calls,
    from(table) {
      assert.equal(table, CANDIDATES_TABLE);
      return {
        select(columns) {
          return {
            in(column, values) {
              calls.select.push({ columns, column, values });
              return Promise.resolve({ data: values.filter((v) => hashes.has(v)).map((v) => ({ hook_hash: v })), error: null });
            },
          };
        },
        upsert(rows, options) {
          calls.upsert.push({ rows, options });
          return {
            select(columns) {
              if (failNext && rows.length > 1) {
                const error = failNext;
                failNext = null;
                return Promise.resolve({ data: null, error });
              }
              const inserted = [];
              for (const row of rows) {
                if (keys.has(row.source_key)) continue;
                if (hashes.has(row.hook_hash)) {
                  return Promise.resolve({ data: null, error: { code: '23505', message: 'hook_hash' } });
                }
                keys.add(row.source_key);
                hashes.add(row.hook_hash);
                inserted.push({ [columns]: row.source_key });
              }
              return Promise.resolve({ data: inserted, error: null });
            },
          };
        },
      };
    },
  };
}

const cand = (key, text) =>
  makeCandidate({ source_key: key, source: 'enwiki_dyk', lang: 'en', hook_text: text, source_url: 'https://en.wikipedia.org/wiki/X', source_meta: { views: 1 } });

test('insertCandidates: upsert onConflict source_key + ignoreDuplicates, {inserted, skipped}', async () => {
  const client = fakeClient({ existingKeys: ['k2'] });
  const result = await insertCandidates(client, [cand('k1', 'cats can purr loudly at night'), cand('k2', 'dogs can bark loudly at night')]);
  assert.deepEqual(result, { inserted: 1, skipped: 1 });
  assert.equal(client.calls.upsert.length, 1);
  const { rows, options } = client.calls.upsert[0];
  assert.deepEqual(options, { onConflict: 'source_key', ignoreDuplicates: true });
  assert.deepEqual(Object.keys(rows[0]).sort(), ['hook_hash', 'hook_text', 'lang', 'source', 'source_key', 'source_meta', 'source_url']);
});

test('insertCandidates: tabloda ve parti içinde aynı hook_hash sessizce atlanır', async () => {
  const existing = cand('old', 'cats can purr loudly at night');
  const client = fakeClient({ existingHashes: [existing.hook_hash] });
  const result = await insertCandidates(client, [
    cand('k1', 'Cats can purr, loudly at night!'), // normalize → aynı hash, tabloda var
    cand('k2', 'owls can see in the dark well'),
    cand('k3', 'Owls can see in the dark, well.'), // parti içi tekrar
    cand('k2', 'a different text with the same key'), // parti içi source_key tekrarı
  ]);
  assert.deepEqual(result, { inserted: 1, skipped: 3 });
  assert.deepEqual(
    client.calls.upsert[0].rows.map((r) => r.source_key),
    ['k2'],
  );
});

test('insertCandidates: yarışta 23505 gelirse satır satır dener, çakışanı atlar', async () => {
  const client = fakeClient({ upsertError: { code: '23505', message: 'duplicate key hook_hash' } });
  const result = await insertCandidates(client, [cand('k1', 'cats can purr loudly at night'), cand('k2', 'owls can see in the dark well')]);
  assert.deepEqual(result, { inserted: 2, skipped: 0 });
  assert.equal(client.calls.upsert.length, 3);
});

test('insertCandidates: başka DB hatası fırlatılır; boş liste DB’ye dokunmaz', async () => {
  const client = fakeClient({ upsertError: { code: '42P01', message: 'relation does not exist' } });
  await assert.rejects(insertCandidates(client, [cand('k1', 'cats can purr loudly at night'), cand('k2', 'owls can see in the dark well')]), /relation does not exist/);

  const untouched = fakeClient();
  assert.deepEqual(await insertCandidates(untouched, []), { inserted: 0, skipped: 0 });
  assert.equal(untouched.calls.select.length + untouched.calls.upsert.length, 0);
});
