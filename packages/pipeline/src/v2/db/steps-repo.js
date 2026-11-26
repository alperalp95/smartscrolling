// src/v2/db/steps-repo.js
// İçerik hattı v2 adımlarının veri erişimi. İki uygulama, aynı arayüz:
//   createStepsRepo(client)        → Supabase (service role client enjekte edilir)
//   createMemoryStepsRepo(seed)    → bellek içi (testler ve --dry-run)
//
// Arayüz:
//   listByStatus(status, limit, filter?)  filter: { scoresHas?, scoresLacks?, hasSupport? }
//   updateCandidate(id, patch)
//   matchSimilar(embedding, threshold, limit, { kinds?, excludeCandidate? })
//                                               → [{ kind, id, text, similarity }]
//     match_similar(p_embedding, p_threshold, p_limit, p_kinds text[], p_exclude_candidate uuid):
//     DB tarafında aday için rejected + p_exclude_candidate, fact için published/queued dışı elenir.
//   insertQueuedFact(row)                       → { id }; unique çakışmada DuplicateInsertError
//
// Vektörler: yazarken düz JS dizisi gönderilir; PostgREST vector kolonunu metin ("[0.1,0.2]")
// döndürür → parseVector ile diziye çevrilir.
import { cosineSimilarity } from '../../dedup/index.js';

export class DuplicateInsertError extends Error {
  constructor(message = 'unique çakışması') {
    super(message);
    this.name = 'DuplicateInsertError';
  }
}

const CANDIDATE_COLUMNS =
  'id, source_key, source, lang, hook_text, hook_hash, source_url, source_meta, support_paragraph, status, scores, reject_reason, fact_id, attempts, created_at';

export const DEFAULT_MATCH_KINDS = Object.freeze(['fact', 'candidate']);

/** PostgREST vector metni ("[0.1,0.2]") → dizi; dizi/null olduğu gibi. Bozuk metin → null. */
export function parseVector(v) {
  if (Array.isArray(v) || v == null) return v ?? null;
  if (typeof v !== 'string') return null;
  try {
    const parsed = JSON.parse(v);
    return Array.isArray(parsed) && parsed.every((x) => typeof x === 'number') ? parsed : null;
  } catch {
    return null;
  }
}

/** Satırdaki vektör alanlarını (embedding, scores.draft_embedding) diziye çevirir. */
function parseRowVectors(row) {
  if (!row || typeof row !== 'object') return row;
  const out = { ...row };
  if (typeof out.embedding === 'string') out.embedding = parseVector(out.embedding);
  if (out.scores && typeof out.scores.draft_embedding === 'string') {
    out.scores = { ...out.scores, draft_embedding: parseVector(out.scores.draft_embedding) };
  }
  return out;
}

function matchOptions({ kinds = DEFAULT_MATCH_KINDS, excludeCandidate = null } = {}) {
  return { kinds: [...kinds], excludeCandidate: excludeCandidate ?? null };
}

function fail(what, error) {
  const err = new Error(`[steps-repo] ${what}: ${error?.message ?? error}`);
  err.code = error?.code;
  return err;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 */
export function createStepsRepo(client) {
  if (!client || typeof client.from !== 'function')
    throw new TypeError('createStepsRepo: Supabase client gerekli');

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
      return (data ?? []).map(parseRowVectors);
    },

    async countByStatus(status) {
      const { count, error } = await client
        .from('fact_candidates')
        .select('id', { count: 'exact', head: true })
        .eq('status', status);
      if (error) throw fail('countByStatus', error);
      return count ?? 0;
    },

    async updateCandidate(id, patch) {
      const { error } = await client.from('fact_candidates').update(patch).eq('id', id);
      if (error) throw fail('updateCandidate', error);
    },

    async matchSimilar(embedding, threshold, limit, opts = {}) {
      const { kinds, excludeCandidate } = matchOptions(opts);
      const { data, error } = await client.rpc('match_similar', {
        p_embedding: embedding,
        p_threshold: threshold,
        p_limit: limit,
        p_kinds: kinds,
        p_exclude_candidate: excludeCandidate,
      });
      if (error) throw fail('matchSimilar', error);
      return (data ?? []).map(parseRowVectors);
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
 * Bellek içi repo. `match_similar` RPC'sini taklit eder: p_kinds içindeki türler;
 * facts (sadece published/queued, metin = title\ncontent) + embedding'i olan, rejected
 * olmayan ve p_exclude_candidate dışındaki adaylar (metin = hook_text).
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
  const factRows = facts.map((f, i) => ({
    id: f.id ?? `fact-seed-${i + 1}`,
    status: 'published',
    ...clone(f),
  }));
  let factSeq = 0;
  let lastMatchArgs = null;
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
        .filter(
          (c) =>
            filter.hasSupport === undefined || Boolean(c.support_paragraph) === filter.hasSupport,
        )
        .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
        .slice(0, limit)
        .map(clone);
    },

    async countByStatus(status) {
      return cands.filter((c) => c.status === status).length;
    },

    async updateCandidate(id, patch) {
      calls.updateCandidate += 1;
      const c = cands.find((x) => x.id === id);
      if (!c) throw new Error(`[memory-repo] aday yok: ${id}`);
      Object.assign(c, clone(patch));
    },

    async matchSimilar(embedding, threshold, limit, opts = {}) {
      calls.matchSimilar += 1;
      const { kinds, excludeCandidate } = matchOptions(opts);
      lastMatchArgs = { threshold, limit, kinds, excludeCandidate };
      const out = [];
      for (const f of kinds.includes('fact') ? factRows : []) {
        if (!Array.isArray(f.embedding) || !['published', 'queued'].includes(f.status)) continue;
        if (f.embedding.length !== embedding.length) continue;
        out.push({
          kind: 'fact',
          id: f.id,
          text: `${f.title}\n${f.content}`,
          similarity: cosineSimilarity(f.embedding, embedding),
        });
      }
      for (const c of kinds.includes('candidate') ? cands : []) {
        if (c.status === 'rejected' || (excludeCandidate !== null && c.id === excludeCandidate))
          continue;
        if (!Array.isArray(c.embedding) || c.embedding.length !== embedding.length) continue;
        out.push({
          kind: 'candidate',
          id: c.id,
          text: c.hook_text,
          similarity: cosineSimilarity(c.embedding, embedding),
        });
      }
      return out
        .filter((m) => m.similarity >= threshold)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);
    },

    async insertQueuedFact(row) {
      calls.insertQueuedFact += 1;
      const clash = factRows.find(
        (f) =>
          (row.content_hash && f.content_hash === row.content_hash) ||
          (row.source_key && f.source_key === row.source_key),
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
    lastMatchArgs: () => clone(lastMatchArgs),
  };
}
