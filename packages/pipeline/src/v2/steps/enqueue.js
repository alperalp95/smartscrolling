// src/v2/steps/enqueue.js
// Kuyruğa al: `verified` aday → facts satırı (status 'queued', verified true).
// Aday `queued` olur, fact_id dolar. content_hash/source_key unique çakışması
// → rejected:duplicate_insert.
import { contentHash } from '../../dedup/index.js';
import { DuplicateInsertError } from '../db/steps-repo.js';
import { STATUS, forEachCandidate, newStats, reject, wikiLang } from './common.js';
import { cardText } from './dedup-card.js';

export function sourceLabel(cand) {
  return wikiLang(cand) === 'tr' ? 'Vikipedi' : 'Wikipedia';
}

export function attributionText(cand) {
  return `Kaynak: ${sourceLabel(cand)} (CC BY-SA 4.0) — ${cand.source_url}`;
}

export const CONTEXT_MAX_CHARS = 2000;

/** Kaynak paragrafı: boşluk-normalize, kelime sınırında ≤2000 karakter; boşsa null (saf). */
export function contextText(cand, max = CONTEXT_MAX_CHARS) {
  const text = String(cand?.support_paragraph ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return null;
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  // Sonraki karakter boşluksa kesim zaten kelime sınırında.
  const out = text[max] === ' ' || lastSpace <= 0 ? cut : cut.slice(0, lastSpace);
  return out.trimEnd();
}

/** Adaydan facts satırı (saf). */
export function buildFactRow(cand) {
  const s = cand.scores ?? {};
  const d = s.draft ?? {};
  if (!d.title || !d.content) throw new Error('kart taslağı (scores.draft) yok');
  if (!s.category) throw new Error('kategori yok');
  if (!cand.source_url) throw new Error('source_url yok');
  return {
    title: d.title,
    content: d.content,
    category: s.category,
    tags: Array.isArray(d.tags) ? d.tags : [],
    read_time_sq: d.read_time_sq,
    source_url: cand.source_url,
    source_label: sourceLabel(cand),
    verified: true,
    status: 'queued',
    source_key: cand.source_key,
    content_hash: d.content_hash ?? contentHash(cardText(d)),
    embedding: Array.isArray(s.draft_embedding) ? s.draft_embedding : null,
    wow_score: typeof s.wow === 'number' ? s.wow : null,
    verification: s.verification ?? null,
    attribution: attributionText(cand),
    context_text: contextText(cand),
  };
}

/**
 * @param {{ repo, now?, log? }} deps
 * @param {{ limit?: number }} [opts]
 */
export async function runEnqueue(deps, { limit = 50 } = {}) {
  const stats = newStats('enqueue');
  const cands = await deps.repo.listByStatus(STATUS.VERIFIED, limit);

  await forEachCandidate(deps, cands, stats, async (cand) => {
    const row = buildFactRow(cand);
    let inserted;
    try {
      inserted = await deps.repo.insertQueuedFact(row);
    } catch (err) {
      if (err instanceof DuplicateInsertError || err?.name === 'DuplicateInsertError') {
        await reject(deps, cand, 'duplicate_insert', stats);
        return;
      }
      throw err;
    }
    await deps.repo.updateCandidate(cand.id, { status: STATUS.QUEUED, fact_id: inserted.id });
    stats.advanced += 1;
  });
  return stats;
}
