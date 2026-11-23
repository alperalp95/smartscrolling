import { createHttpClient } from '../sources/http.js';
// src/v2/steps/support.js
// Destek paragrafı: `scored` adayın source_url makalesini MediaWiki API'den
// (action=parse&prop=text) çeker, kancayla en çok örtüşen 1–2 paragrafı
// (≤1.500 karakter) support_paragraph'a yazar. Bulunamazsa giriş paragrafına
// düşmez → rejected:no_support. Ayrıştırma support-parse.js'te (saf).
//
// Bağımlılık: deps.http (createHttpClient: ≥200 ms aralık, 429/5xx'te üstel bekleme, en fazla 3 deneme)
// ya da deps.fetch (testte; aynı istemciyle sarılır). LLM kullanmaz.
import { STATUS, forEachCandidate, newStats, nowIso, reject } from './common.js';
import { extractParagraphs, parseWikiUrl, selectSupport } from './support-parse.js';

export { USER_AGENT } from '../sources/http.js';

let defaultHttp = null;
/** Modül içinde bir kez oluşturulan varsayılan istemci (istekler arası aralık run boyunca korunur). */
function getDefaultHttp() {
  defaultHttp ??= createHttpClient();
  return defaultHttp;
}

function resolveHttp(deps) {
  if (deps.http) return deps.http;
  if (deps.fetch) return createHttpClient({ fetchImpl: deps.fetch, sleep: deps.sleep });
  return getDefaultHttp();
}

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
 * @param {{ getJson: (url: string) => Promise<any> }} http
 * @returns {Promise<{ ok: true, html: string } | { ok: false, missing: true }>}
 *   Sayfa yoksa missing; ağ/429/5xx hatasında (yeniden denemelerden sonra) exception (attempts++).
 */
export async function fetchArticleHtml(http, ref) {
  let body;
  try {
    body = await http.getJson(buildParseUrl(ref));
  } catch (err) {
    if (err?.status === 404) return { ok: false, missing: true };
    throw err;
  }
  if (body?.error) {
    if (body.error.code === 'missingtitle' || body.error.code === 'invalidtitle')
      return { ok: false, missing: true };
    throw new Error(`Wikipedia API hatası: ${body.error.code}`);
  }
  const html = typeof body?.parse?.text === 'string' ? body.parse.text : body?.parse?.text?.['*'];
  if (typeof html !== 'string') throw new Error('Wikipedia yanıtında parse.text yok');
  return { ok: true, html };
}

/**
 * @param {{ repo, fetch?, now?, log? }} deps
 * @param {{ limit?: number }} [opts]
 */
export async function runSupport(deps, { limit = 50 } = {}) {
  const stats = newStats('support');
  const http = resolveHttp(deps);
  const cands = await deps.repo.listByStatus(STATUS.SCORED, limit, { hasSupport: false });

  await forEachCandidate(deps, cands, stats, async (cand) => {
    const ref = parseWikiUrl(cand.source_url);
    if (!ref) {
      await reject(deps, cand, 'no_support', stats, {
        scores: {
          ...(cand.scores ?? {}),
          support: { error: 'source_url Wikipedia makalesi değil' },
        },
      });
      return;
    }
    const article = await fetchArticleHtml(http, ref);
    const picked = article.ok
      ? selectSupport(extractParagraphs(article.html), cand.hook_text, {
          lang: cand.lang || ref.lang,
        })
      : null;
    if (!picked) {
      await reject(deps, cand, 'no_support', stats, {
        scores: {
          ...(cand.scores ?? {}),
          support: { error: article.ok ? 'örtüşen paragraf yok' : 'makale bulunamadı' },
        },
      });
      return;
    }
    await deps.repo.updateCandidate(cand.id, {
      support_paragraph: picked.text,
      scores: {
        ...(cand.scores ?? {}),
        support: {
          paragraphs: picked.indexes,
          coverage: picked.coverage,
          main_fact: picked.mainFact,
          at: nowIso(deps.now),
        },
      },
    });
    stats.advanced += 1;
  });
  return stats;
}
