// fact_candidates yazma katmanı (content pipeline v2). Supabase client dışarıdan enjekte edilir.

export const CANDIDATES_TABLE = 'fact_candidates';
const CHUNK_SIZE = 500;
const UNIQUE_VIOLATION = '23505';

const COLUMNS = [
  'source_key',
  'source',
  'lang',
  'hook_text',
  'hook_hash',
  'source_url',
  'source_meta',
];

function toRow(candidate) {
  const row = {};
  for (const column of COLUMNS) row[column] = candidate[column] ?? null;
  row.source_meta = candidate.source_meta ?? {};
  return row;
}

function chunk(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/**
 * Adayları `fact_candidates`'e yazar.
 * - `source_key` çakışması: `upsert(..., { onConflict: 'source_key', ignoreDuplicates: true })` ile sessizce atlanır.
 * - `hook_hash` çakışması: hem parti içinde hem tabloda önceden elenir; yarışta yine de 23505
 *   gelirse parti satır satır yeniden denenir ve çakışan satırlar atlanır.
 *
 * @param {{ from: (table: string) => any }} client  Supabase client (service role)
 * @param {import('../sources/types.js').Candidate[]} candidates
 * @returns {Promise<{ inserted: number, skipped: number }>}
 */
export async function insertCandidates(client, candidates) {
  const list = Array.isArray(candidates) ? candidates : [];
  if (list.length === 0) return { inserted: 0, skipped: 0 };

  // 1) Parti içi tekrarlar (aynı source_key ya da aynı hook_hash).
  const seenKeys = new Set();
  const seenHashes = new Set();
  const unique = [];
  for (const candidate of list) {
    if (!candidate?.source_key || !candidate?.hook_hash) continue;
    if (seenKeys.has(candidate.source_key) || seenHashes.has(candidate.hook_hash)) continue;
    seenKeys.add(candidate.source_key);
    seenHashes.add(candidate.hook_hash);
    unique.push(candidate);
  }

  let inserted = 0;
  for (const part of chunk(unique, CHUNK_SIZE)) {
    // 2) Tabloda zaten olan hook_hash'ler.
    const { data: existing, error: selectError } = await client
      .from(CANDIDATES_TABLE)
      .select('hook_hash')
      .in(
        'hook_hash',
        part.map((c) => c.hook_hash),
      );
    if (selectError)
      throw new Error(`[candidates-repo] hook_hash select failed: ${selectError.message}`);
    const existingHashes = new Set((existing ?? []).map((r) => r.hook_hash));
    const rows = part.filter((c) => !existingHashes.has(c.hook_hash)).map(toRow);
    if (rows.length === 0) continue;

    // 3) source_key çakışmaları DO NOTHING; dönen satırlar = gerçekten eklenenler.
    const { data, error } = await client
      .from(CANDIDATES_TABLE)
      .upsert(rows, { onConflict: 'source_key', ignoreDuplicates: true })
      .select('source_key');

    if (!error) {
      inserted += data?.length ?? 0;
      continue;
    }
    if (error.code !== UNIQUE_VIOLATION)
      throw new Error(`[candidates-repo] upsert failed: ${error.message}`);

    // 4) Yarış: başka bir satırla hook_hash çakıştı → satır satır dene.
    for (const row of rows) {
      const single = await client
        .from(CANDIDATES_TABLE)
        .upsert([row], { onConflict: 'source_key', ignoreDuplicates: true })
        .select('source_key');
      if (!single.error) inserted += single.data?.length ?? 0;
      else if (single.error.code !== UNIQUE_VIOLATION) {
        throw new Error(`[candidates-repo] upsert failed: ${single.error.message}`);
      }
    }
  }

  return { inserted, skipped: list.length - inserted };
}
