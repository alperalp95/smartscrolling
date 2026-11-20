// src/v2/db/steps-repo.js
// İçerik hattı v2 adımlarının veri erişimi. İki uygulama, aynı arayüz:
//   createStepsRepo(client)        → Supabase (service role client enjekte edilir)
//   createMemoryStepsRepo(seed)    → bellek içi (testler ve --dry-run)
//
// Arayüz:
//   listByStatus(status, limit, filter?)  filter: { scoresHas?, scoresLacks?, hasSupport? }
//   updateCandidate(id, patch)
//   matchSimilar(embedding, threshold, limit)  → [{ kind, id, text, similarity, status? }]
//   insertQueuedFact(row)                       → { id }; unique çakışmada DuplicateInsertError
import { cosineSimilarity } from '../../dedup/index.js';

export class DuplicateInsertError extends Error {
  constructor(message = 'unique çakışması') {
    super(message);
    this.name = 'DuplicateInsertError';
  }
}

const CANDIDATE_COLUMNS =
  'id, source_key, source, lang, hook_text, hook_hash, source_url, source_meta, support_paragraph, status, scores, reject_reason, fact_id, attempts, created_at';

function fail(what, error) {
  const err = new Error(`[steps-repo] ${what}: ${error?.message ?? error}`);
  err.code = error?.code;
  return err;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 */
export function createStepsRepo(client) {
  if (!client || typeof client.from !== 'function') throw new TypeError('createStepsRepo: Supabase client gerekli');

  return {
    kind: 'supabase',

    async listByStatus(status, limit = 50, filter = {}) {
      let q = client.from('fact_candidates').select(CANDIDATE_COLUMNS).eq('status', status);
      if (filter.scoresHas) q = q.not(`scores->${filter.scoresHas}`, 'is', null);
      if (filter.scoresLacks) q = q.is(`scores->${filter.scoresLacks}`, null);
      if (filter.hasSupport === true) q = q.not('support_paragraph', 'is', null);
      if (filter.hasSupport === false) q = q.is('support_paragraph', null);
      const { data, error } = await q.order('created_at', { ascending: true }).limit(limit);
      if (error) throw fail('listByStatus', error);
      return data ?? [];
    },

    async updateCandidate(id, patch) {
      const { error } = await client.from('fact_candidates').update(patch).eq('id', id);
      if (error) throw fail('updateCandidate', error);
    },

    async matchSimilar(embedding, threshold, limit) {
      const { data, error } = await client.rpc('match_similar', {
        p_embedding: embedding,
        p_threshold: threshold,
        p_limit: limit,
      });
      if (error) throw fail('matchSimilar', error);
      const rows = data ?? [];
      // RPC durum döndürmüyor; aday eşleşmelerinin durumunu ayrıca oku (rejected filtrelensin).
      const candIds = rows.filter((r) => r.kind === 'candidate').map((r) => r.id);
      if (candIds.length === 0) return rows;
      const { data: st, error: stErr } = await client.from('fact_candidates').select('id, status').in('id', candIds);
      if (stErr) throw fail('matchSimilar(status)', stErr);
      const byId = new Map((st ?? []).map((r) => [r.id, r.status]));
      return rows.map((r) => (r.kind === 'candidate' ? { ...r, status: byId.get(r.id) ?? null } : r));
    },

    async insertQueuedFact(row) {
      const { data, error } = await client.from('facts').insert(row).select('id').single();
      if (error) {
        if (error.code === '23505') throw new DuplicateInsertError(error.message);
        throw fail('insertQueuedFact', error);
      }
      return { id: data.id };
    },
  };
}

const clone = (v) => (v === undefined ? v : structuredClone(v));

/**
 * Bellek içi repo. `match_similar` RPC'sini taklit eder: facts (published/queued,
 * metin = title\ncontent) + embedding'i olan adaylar (metin = hook_text).
 * @param {{ candidates?: object[], facts?: object[] }} [seed]
 */
export function createMemoryStepsRepo({ candidates = [], facts = [] } = {}) {
  const cands = candidates.map((c, i) => ({
    id: c.id ?? `cand-${i + 1}`,
    status: 'new',
    attempts: 0,
    scores: null,
    support_paragraph: null,
    reject_reason: null,
    embedding: null,
    fact_id: null,
    created_at: new Date(Date.UTC(2026, 10, 20, 0, 0, i)).toISOString(),
    ...clone(c),
  }));
  const factRows = facts.map((f, i) => ({ id: f.id ?? `fact-seed-${i + 1}`, status: 'published', ...clone(f) }));
  let factSeq = 0;
  const calls = { listByStatus: 0, updateCandidate: 0, matchSimilar: 0, insertQueuedFact: 0 };

  const hasKey = (c, k) => c.scores != null && c.scores[k] !== undefined && c.scores[k] !== null;

  return {
    kind: 'memory',
    calls,

    async listByStatus(status, limit = 50, filter = {}) {
      calls.listByStatus += 1;
      return cands
        .filter((c) => c.status === status)
        .filter((c) => !filter.scoresHas || hasKey(c, filter.scoresHas))
        .filter((c) => !filter.scoresLacks || !hasKey(c, filter.scoresLacks))
        .filter((c) => filter.hasSupport === undefined || Boolean(c.support_paragraph) === filter.hasSupport)
        .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
        .slice(0, limit)
        .map(clone);
    },

    async updateCandidate(id, patch) {
      calls.updateCandidate += 1;
      const c = cands.find((x) => x.id === id);
      if (!c) throw new Error(`[memory-repo] aday yok: ${id}`);
      Object.assign(c, clone(patch));
    },

    async matchSimilar(embedding, threshold, limit) {
      calls.matchSimilar += 1;
      const out = [];
      for (const f of factRows) {
        if (!Array.isArray(f.embedding) || !['published', 'queued'].includes(f.status)) continue;
        if (f.embedding.length !== embedding.length) continue;
        out.push({ kind: 'fact', id: f.id, text: `${f.title}\n${f.content}`, similarity: cosineSimilarity(f.embedding, embedding) });
      }
      for (const c of cands) {
        if (!Array.isArray(c.embedding) || c.embedding.length !== embedding.length) continue;
        out.push({ kind: 'candidate', id: c.id, text: c.hook_text, similarity: cosineSimilarity(c.embedding, embedding), status: c.status });
      }
      return out
        .filter((m) => m.similarity >= threshold)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);
    },

    async insertQueuedFact(row) {
      calls.insertQueuedFact += 1;
      const clash = factRows.find(
        (f) => (row.content_hash && f.content_hash === row.content_hash) || (row.source_key && f.source_key === row.source_key),
      );
      if (clash) throw new DuplicateInsertError(`facts unique çakışması (${clash.id})`);
      factSeq += 1;
      const id = `fact-${factSeq}`;
      factRows.push({ id, ...clone(row) });
      return { id };
    },

    /** Test/dry-run yardımcıları */
    candidates: () => cands.map(clone),
    facts: () => factRows.map(clone),
    get: (id) => clone(cands.find((x) => x.id === id)),
  };
}
