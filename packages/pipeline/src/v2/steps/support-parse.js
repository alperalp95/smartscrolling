// src/v2/steps/support-parse.js
// Destek paragrafı ayrıştırma — saf fonksiyonlar (ağ yok).
//   extractParagraphs(html)          MediaWiki parse HTML'inden düz metin paragraflar
//   hookKeywords(hook, lang)         kancadan anahtar kelimeler (stopword'süz)
//   selectSupport(paragraphs, hook)  en çok örtüşen 1–2 paragraf (≤1.500 kr) ya da null
//
// Giriş paragrafına "yedek" olarak düşülmez: hiçbir paragraf eşiği geçmezse null döner.
// Konunun adı (her paragrafta geçen kelime) düşük ağırlık alır (IDF), böylece sadece
// konuyu anan giriş paragrafı kancayı "destekliyor" sayılmaz.

export const MAX_SUPPORT_CHARS = 1500;
export const MIN_PARAGRAPH_CHARS = 60;
export const MIN_COVERAGE = 0.35;
export const MIN_MATCHED_KEYWORDS = 2;

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', hellip: '…' };

function decodeEntities(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, code) => {
    if (code[0] === '#') {
      const n = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return ENTITIES[code.toLowerCase()] ?? m;
  });
}

/** HTML'den <p> paragraflarını düz metin olarak çıkarır (sırası korunur). */
export function extractParagraphs(html) {
  if (typeof html !== 'string' || !html) return [];
  const cleaned = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(style|script|table)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<sup\b[^>]*class="[^"]*\breference\b[^"]*"[^>]*>[\s\S]*?<\/sup>/gi, '');
  const out = [];
  const re = /<p\b[^>]*>([\s\S]*?)<\/p>/gi;
  let m;
  while ((m = re.exec(cleaned))) {
    const text = decodeEntities(m[1].replace(/<[^>]+>/g, ''))
      .replace(/\[(?:\d+|[a-z]|citation needed|kaynak belirtilmeli|note \d+)\]/gi, '')
      .replace(/\s+/g, ' ')
      .replace(/\s+([.,;:!?])/g, '$1')
      .trim();
    if (text.length >= MIN_PARAGRAPH_CHARS) out.push(text);
  }
  return out;
}

const STOPWORDS = new Set(
  (
    'the a an and or of to in on at by for with from as is are was were be been being that this these those ' +
    'it its his her their they he she who whom which what when where why how than then also only first ' +
    'into over after before about during while not no but can could would should has have had did does do ' +
    'one two more most some such many much very same other there here him them our your you we i ' +
    've veya ile bir bu şu o da de ki mi mı mu mü için gibi kadar daha en çok olan olarak olduğu ' +
    'sonra önce ise ama fakat ancak her hem ya yani tarafından üzerine üzerinde arasında kendi onun ' +
    'onların bunu şunu ilk iki dahi bile hangi neden nasıl nedir kimdir'
  ).split(/\s+/),
);

function lowerFor(lang, s) {
  return lang === 'tr' ? s.toLocaleLowerCase('tr-TR') : s.toLowerCase();
}

function tokenize(text, lang) {
  return lowerFor(lang, String(text ?? ''))
    .normalize('NFC')
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

/** Basit kök: 5 harften uzun kelimelerde ilk 5 harf (Türkçe ekler / İngilizce çoğullar için). */
function stem(token) {
  if (/^\p{N}+$/u.test(token)) return token;
  return token.length > 5 ? token.slice(0, 5) : token;
}

/** Kancadan anahtar kelime kökleri (tekrarsız). Sayılar korunur. */
export function hookKeywords(hook, lang = 'en') {
  const text = String(hook ?? '').replace(/^\s*(?:\.\.\.|…)\s*(?:that|ki)\s+/i, '');
  const seen = new Set();
  for (const t of tokenize(text, lang)) {
    const isNum = /^\p{N}+$/u.test(t);
    if (!isNum && (t.length < 3 || STOPWORDS.has(t))) continue;
    seen.add(stem(t));
  }
  return [...seen];
}

function truncateAtSentence(text, max) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  return end > max * 0.4 ? cut.slice(0, end + 1) : cut.trimEnd();
}

/**
 * Paragrafları kanca anahtar kelimeleriyle (IDF ağırlıklı) puanlar.
 * @returns {Array<{ index, text, coverage, matched }>}
 */
export function scoreParagraphs(paragraphs, hook, lang = 'en') {
  const keywords = hookKeywords(hook, lang);
  if (keywords.length === 0 || paragraphs.length === 0) return [];
  const stemSets = paragraphs.map((p) => new Set(tokenize(p, lang).map(stem)));
  const n = paragraphs.length;
  const weight = new Map(
    keywords.map((k) => {
      const df = stemSets.filter((s) => s.has(k)).length;
      return [k, Math.log(1 + n / Math.max(1, df))];
    }),
  );
  const total = keywords.reduce((sum, k) => sum + weight.get(k), 0);
  return paragraphs.map((text, index) => {
    const matchedKeys = keywords.filter((k) => stemSets[index].has(k));
    const got = matchedKeys.reduce((sum, k) => sum + weight.get(k), 0);
    return { index, text, coverage: total > 0 ? got / total : 0, matched: matchedKeys.length };
  });
}

/**
 * Kancayı en iyi destekleyen 1–2 paragrafı seçer.
 * @returns {{ text: string, indexes: number[], coverage: number } | null}
 */
export function selectSupport(paragraphs, hook, { lang = 'en', maxChars = MAX_SUPPORT_CHARS } = {}) {
  const scored = scoreParagraphs(paragraphs, hook, lang)
    .filter((p) => p.coverage >= MIN_COVERAGE && p.matched >= MIN_MATCHED_KEYWORDS)
    .sort((a, b) => b.coverage - a.coverage || a.index - b.index);
  if (scored.length === 0) return null;

  const best = scored[0];
  const picked = [best];
  const second = scored[1];
  if (second && second.coverage >= best.coverage * 0.6 && best.text.length + second.text.length + 2 <= maxChars) {
    picked.push(second);
  }
  picked.sort((a, b) => a.index - b.index);
  const text = truncateAtSentence(picked.map((p) => p.text).join('\n\n'), maxChars);
  return { text, indexes: picked.map((p) => p.index), coverage: Math.round(best.coverage * 100) / 100 };
}

/** source_url → { lang, title } (Wikipedia /wiki/<Başlık> biçimi). */
export function parseWikiUrl(sourceUrl) {
  let u;
  try {
    u = new URL(sourceUrl);
  } catch {
    return null;
  }
  const host = u.hostname.match(/^([a-z-]+)\.(?:m\.)?wikipedia\.org$/);
  if (!host) return null;
  let title = null;
  if (u.pathname.startsWith('/wiki/')) title = u.pathname.slice('/wiki/'.length);
  else if (u.searchParams.get('title')) title = u.searchParams.get('title');
  if (!title) return null;
  try {
    title = decodeURIComponent(title);
  } catch {
    // olduğu gibi kullan
  }
  return { lang: host[1], title: title.replace(/_/g, ' ') };
}
