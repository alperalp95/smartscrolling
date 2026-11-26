// src/v2/media/wiki-image.js
// Vikipedi sayfasının kapak görseli (Wikimedia Commons). Ağ hatası kartı asla engellemez.
const USER_AGENT = 'SmartScrolling-Pipeline/1.0 (contact@smartscrolling.app)';
// Wikimedia küçük resimleri artık thumb.wikimedia.org'dan da veriyor (2026-11 gözlemi).
const COMMONS_PREFIXES = [
  'https://upload.wikimedia.org/wikipedia/commons/',
  'https://thumb.wikimedia.org/wikipedia/commons/',
];
// Wikimedia sadece belirli genişlikleri üretir (330, 500, 960 çalışıyor; 640 → 400 hatası).
const TARGET_WIDTH = '960px-';
const BAD_EXTENSIONS = /\.(tiff?|bmp|psd|raw)(\?|$)/i;
const SENSITIVE_NAME_PARTS = [
  'casualt',
  'corpse',
  'dead_',
  'killed',
  'massacre',
  'execution',
  'hanging',
  'impal',
  'holocaust',
  'genocide',
  'war_dead',
  'atrocity',
  'beheading',
  'lynching',
];
const TIMEOUT_MS = 8000;

/** Özet JSON'undan güvenli Commons görseli (saf); uygun değilse null. */
export function pickCommonsImage(summaryJson) {
  const url = summaryJson?.thumbnail?.source ?? summaryJson?.originalimage?.source ?? null;
  if (typeof url !== 'string' || !COMMONS_PREFIXES.some((prefix) => url.startsWith(prefix))) {
    return null;
  }
  if (BAD_EXTENSIONS.test(url)) return null;
  let name = url;
  try {
    name = decodeURIComponent(url);
  } catch {
    // çözülemezse ham URL'ye bak
  }
  const lower = name.toLowerCase();
  if (SENSITIVE_NAME_PARTS.some((part) => lower.includes(part))) return null;
  return url.replace('330px-', TARGET_WIDTH);
}

function parseWikiPage(sourceUrl) {
  try {
    const u = new URL(sourceUrl);
    const host = u.hostname.match(/^([a-z-]+)\.(?:m\.)?wikipedia\.org$/);
    const page = u.pathname.match(/^\/wiki\/(.+)$/);
    if (!host || !page) return null;
    return { lang: host[1], title: page[1] };
  } catch {
    return null;
  }
}

/** Kaynak Vikipedi URL'sinden görsel adresi; hata/404/zaman aşımı → null (asla fırlatmaz). */
export async function resolveWikiImage(sourceUrl, { fetchImpl = fetch } = {}) {
  const page = parseWikiPage(sourceUrl);
  if (!page) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const url = `https://${page.lang}.wikipedia.org/api/rest_v1/page/summary/${page.title}`;
    const res = await fetchImpl(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: controller.signal,
    });
    if (!res?.ok) return null;
    return pickCommonsImage(await res.json());
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
