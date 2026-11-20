// src/v2/steps/support.js
// Destek paragrafı: `scored` adayın source_url makalesini MediaWiki API'den
// (action=parse&prop=text) çeker, kancayla en çok örtüşen 1–2 paragrafı
// (≤1.500 karakter) support_paragraph'a yazar. Bulunamazsa giriş paragrafına
// düşmez → rejected:no_support. Ayrıştırma support-parse.js'te (saf).
//
// Bağımlılık: deps.fetch (varsayılan global fetch). LLM kullanmaz.
import { STATUS, forEachCandidate, newStats, nowIso, reject } from './common.js';
import { extractParagraphs, parseWikiUrl, selectSupport } from './support-parse.js';

export const USER_AGENT = 'content-pipeline/2.0 (educational fact app)';
const TIMEOUT_MS = 20000;

export function buildParseUrl({ lang, title }) {
  const params = new URLSearchParams({
    action: 'parse',
    page: title,
    prop: 'text',
    format: 'json',
    formatversion: '2',
    redirects: '1',
    disableeditsection: '1',
    disabletoc: '1',
  });
  return `https://${lang}.wikipedia.org/w/api.php?${params}`;
}

/**
 * Makale HTML'ini çeker.
 * @returns {Promise<{ ok: true, html: string } | { ok: false, missing: true }>}
 *   Sayfa yoksa missing; ağ/5xx hatasında exception (attempts++).
 */
export async function fetchArticleHtml(fetchImpl, ref) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  timer.unref?.();
  try {
    const res = await fetchImpl(buildParseUrl(ref), {
      headers: { 'User-Agent': USER_AGENT, 'Api-User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: controller.signal,
    });
    if (res.status === 404) return { ok: false, missing: true };
    if (!res.ok) throw new Error(`Wikipedia HTTP ${res.status}`);
    const body = await res.json();
    if (body?.error) {
      if (body.error.code === 'missingtitle' || body.error.code === 'invalidtitle') return { ok: false, missing: true };
      throw new Error(`Wikipedia API hatası: ${body.error.code}`);
    }
    const html = typeof body?.parse?.text === 'string' ? body.parse.text : body?.parse?.text?.['*'];
    if (typeof html !== 'string') throw new Error('Wikipedia yanıtında parse.text yok');
    return { ok: true, html };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * @param {{ repo, fetch?, now?, log? }} deps
 * @param {{ limit?: number }} [opts]
 */
export async function runSupport(deps, { limit = 50 } = {}) {
  const stats = newStats('support');
  const fetchImpl = deps.fetch ?? globalThis.fetch;
  const cands = await deps.repo.listByStatus(STATUS.SCORED, limit, { hasSupport: false });

  await forEachCandidate(deps, cands, stats, async (cand) => {
    const ref = parseWikiUrl(cand.source_url);
    if (!ref) {
      await reject(deps, cand, 'no_support', stats, {
        scores: { ...(cand.scores ?? {}), support: { error: 'source_url Wikipedia makalesi değil' } },
      });
      return;
    }
    const article = await fetchArticleHtml(fetchImpl, ref);
    const picked = article.ok
      ? selectSupport(extractParagraphs(article.html), cand.hook_text, { lang: cand.lang || ref.lang })
      : null;
    if (!picked) {
      await reject(deps, cand, 'no_support', stats, {
        scores: { ...(cand.scores ?? {}), support: { error: article.ok ? 'örtüşen paragraf yok' : 'makale bulunamadı' } },
      });
      return;
    }
    await deps.repo.updateCandidate(cand.id, {
      support_paragraph: picked.text,
      scores: {
        ...(cand.scores ?? {}),
        support: { paragraphs: picked.indexes, coverage: picked.coverage, main_fact: picked.mainFact, at: nowIso(deps.now) },
      },
    });
    stats.advanced += 1;
  });
  return stats;
}
