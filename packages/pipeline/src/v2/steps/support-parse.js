// src/v2/steps/support-parse.js
// Destek paragrafı ayrıştırma — saf fonksiyonlar (ağ yok).
//   extractParagraphs(html)          MediaWiki parse HTML'inden düz metin paragraflar
//   hookTerms / hookKeywords(hook)   kancadan terimler (stopword'süz; sayı/özel ad = "anchor")
//   selectSupport(paragraphs, hook)  en iyi paragraf (+ ana olgu eksikse ikinci aday, ≤1.500 kr) ya da null
//
// Giriş paragrafına "yedek" olarak düşülmez: hiçbir paragraf eşiği geçmezse null döner.
// Konunun adı (her paragrafta geçen kelime) düşük ağırlık alır (IDF), böylece sadece
// konuyu anan giriş paragrafı kancayı "destekliyor" sayılmaz. Sayılar ve özel adlar
// (kancanın ana olgusu) ANCHOR_WEIGHT kat ağırlık alır; "four" ile "4" eşleşir.

export const MAX_SUPPORT_CHARS = 1500;
export const MIN_PARAGRAPH_CHARS = 60;
export const MIN_COVERAGE = 0.35;
export const MIN_MATCHED_KEYWORDS = 2;
/** Sayı ve özel ad eşleşmesinin ağırlık çarpanı (kancanın ana olgusu genelde bunlarda). */
export const ANCHOR_WEIGHT = 2;
/** En iyi paragraf bu kapsamanın altındaysa ya da makalede geçen bir sayı/özel adı içermiyorsa ana olgu "eksik". */
export const MAIN_FACT_COVERAGE = 0.6;
/** İkinci aday eklenince ana paragrafın bütçeden alabileceği en büyük pay. */
const FIRST_SHARE_WITH_SECOND = 0.65;

const ENTITIES = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ndash: '–',
  mdash: '—',
  hellip: '…',
};

function decodeEntities(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, code) => {
    if (code[0] === '#') {
      const n =
        code[1].toLowerCase() === 'x'
          ? Number.parseInt(code.slice(2), 16)
          : Number.parseInt(code.slice(1), 10);
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
  for (;;) {
    const m = re.exec(cleaned);
    if (!m) break;
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

// Sayı kelimeleri rakama çevrilir ("four days" = "4 days"). Belirsiz olanlar (one, altı, yüz) yok.
const NUMBER_WORDS = {
  three: '3',
  four: '4',
  five: '5',
  six: '6',
  seven: '7',
  eight: '8',
  nine: '9',
  ten: '10',
  eleven: '11',
  twelve: '12',
  twenty: '20',
  thirty: '30',
  hundred: '100',
  thousand: '1000',
  million: '1000000',
  üç: '3',
  dört: '4',
  beş: '5',
  yedi: '7',
  sekiz: '8',
  dokuz: '9',
  milyon: '1000000',
  milyar: '1000000000',
};

function lowerFor(lang, s) {
  return lang === 'tr' ? s.toLocaleLowerCase('tr-TR') : s.toLowerCase();
}

function rawTokens(text) {
  return String(text ?? '')
    .normalize('NFC')
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

function normToken(raw, lang) {
  const t = lowerFor(lang, raw);
  return NUMBER_WORDS[t] ?? t;
}

function tokenize(text, lang) {
  return rawTokens(text).map((t) => normToken(t, lang));
}

const isNumber = (t) => /^\p{N}+$/u.test(t);

/** Basit kök: 5 harften uzun kelimelerde ilk 5 harf (Türkçe ekler / İngilizce çoğullar için). */
function stem(token) {
  if (isNumber(token)) return token;
  return token.length > 5 ? token.slice(0, 5) : token;
}

function stemSet(text, lang) {
  return new Set(tokenize(text, lang).map(stem));
}

function stripHookLead(hook) {
  return String(hook ?? '').replace(/^\s*(?:\.\.\.|…)\s*(?:that|ki)\s+/i, '');
}

/**
 * Kancadan terimler: { key (kök), anchor (sayı ya da özel ad) }, tekrarsız.
 * Özel ad: büyük harfle başlayan ve kancanın ilk kelimesi olmayan kelime (ilk kelime
 * cümle başı olabileceği için sayılmaz; DYK kancaları zaten küçük harfle başlar).
 */
export function hookTerms(hook, lang = 'en') {
  const terms = new Map();
  rawTokens(stripHookLead(hook)).forEach((raw, i) => {
    const t = normToken(raw, lang);
    const num = isNumber(t);
    if (!num && (t.length < 3 || STOPWORDS.has(t))) return;
    const key = stem(t);
    const proper = i > 0 && /^\p{Lu}/u.test(raw);
    const prev = terms.get(key);
    terms.set(key, { key, anchor: Boolean(prev?.anchor || num || proper) });
  });
  return [...terms.values()];
}

/** Kancadan anahtar kelime kökleri (tekrarsız). Sayılar korunur. */
export function hookKeywords(hook, lang = 'en') {
  return hookTerms(hook, lang).map((t) => t.key);
}

function splitSentences(text) {
  const parts = String(text).match(/[^.!?]+(?:[.!?]+["'”’)\]]*|$)/g) ?? [];
  const out = parts.map((x) => x.trim()).filter(Boolean);
  return out.length ? out : [String(text)];
}

function truncateAtSentence(text, max) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  return end > max * 0.4 ? cut.slice(0, end + 1) : cut.trimEnd();
}

/** Paragrafı bütçeye sığdırır: bütçeyi aşıyorsa sadece verilen köklerden birini içeren cümleler kalır. */
function focusSentences(text, keys, lang, budget) {
  if (text.length <= budget) return text;
  const wanted = new Set(keys);
  const kept = splitSentences(text).filter((sent) =>
    [...stemSet(sent, lang)].some((k) => wanted.has(k)),
  );
  return truncateAtSentence(kept.join(' ') || text, budget);
}

function termWeights(terms, stemSets) {
  const n = stemSets.length;
  return new Map(
    terms.map((t) => {
      const df = stemSets.filter((s) => s.has(t.key)).length;
      return [t.key, Math.log(1 + n / Math.max(1, df)) * (t.anchor ? ANCHOR_WEIGHT : 1)];
    }),
  );
}

/**
 * Paragrafları kanca terimleriyle puanlar: IDF ağırlığı × (sayı/özel ad ise ANCHOR_WEIGHT).
 * @returns {Array<{ index, text, coverage, matched, matchedKeys: string[] }>}
 */
export function scoreParagraphs(paragraphs, hook, lang = 'en') {
  const terms = hookTerms(hook, lang);
  if (terms.length === 0 || paragraphs.length === 0) return [];
  const stemSets = paragraphs.map((p) => stemSet(p, lang));
  const weight = termWeights(terms, stemSets);
  const total = terms.reduce((sum, t) => sum + weight.get(t.key), 0);
  return paragraphs.map((text, index) => {
    const matchedKeys = terms.filter((t) => stemSets[index].has(t.key)).map((t) => t.key);
    const got = matchedKeys.reduce((sum, k) => sum + weight.get(k), 0);
    return {
      index,
      text,
      coverage: total > 0 ? got / total : 0,
      matched: matchedKeys.length,
      matchedKeys,
    };
  });
}

/**
 * Kancayı en iyi destekleyen paragrafı seçer. En iyi paragraf kancanın ana olgusunu içermiyorsa
 * (makalede geçen bir sayı/özel ad eksik ya da kapsama < MAIN_FACT_COVERAGE), eksik terimleri en
 * çok kapsayan ikinci aday da eklenir (ilgili cümleleriyle). Toplam ≤ maxChars.
 * mainFact: seçilen metin kancadaki, makalede geçen tüm sayı/özel adları içeriyor mu.
 * @returns {{ text: string, indexes: number[], coverage: number, mainFact: boolean } | null}
 */
export function selectSupport(
  paragraphs,
  hook,
  { lang = 'en', maxChars = MAX_SUPPORT_CHARS } = {},
) {
  const all = scoreParagraphs(paragraphs, hook, lang);
  const eligible = all
    .filter((p) => p.coverage >= MIN_COVERAGE && p.matched >= MIN_MATCHED_KEYWORDS)
    .sort((a, b) => b.coverage - a.coverage || a.index - b.index);
  if (eligible.length === 0) return null;

  const best = eligible[0];
  const terms = hookTerms(hook, lang);
  const stemSets = paragraphs.map((p) => stemSet(p, lang));
  const weight = termWeights(terms, stemSets);
  const bestKeys = new Set(best.matchedKeys);
  const missing = terms.filter((t) => !bestKeys.has(t.key) && stemSets.some((s) => s.has(t.key)));
  const missingAnchors = missing.filter((t) => t.anchor);
  let mainFact = missingAnchors.length === 0 && best.coverage >= MAIN_FACT_COVERAGE;

  let second = null;
  if (!mainFact && missing.length > 0) {
    const missingTotal = missing.reduce((sum, t) => sum + weight.get(t.key), 0);
    for (const p of all) {
      if (p.index === best.index) continue;
      const covered = missing.filter((t) => stemSets[p.index].has(t.key));
      if (covered.length === 0) continue;
      const share = covered.reduce((sum, t) => sum + weight.get(t.key), 0) / missingTotal;
      // İkinci aday: eksik bir sayı/özel adı içermeli ya da eksiklerin en az 2'sini (%25+ ağırlık) kapsamalı.
      if (!covered.some((t) => t.anchor) && (covered.length < 2 || share < 0.25)) continue;
      if (
        !second ||
        share > second.share ||
        (share === second.share && p.coverage > second.p.coverage)
      ) {
        second = { p, share, keys: covered.map((t) => t.key) };
      }
    }
    if (second) mainFact = missingAnchors.every((t) => second.keys.includes(t.key));
  }

  let text;
  let indexes;
  if (!second) {
    text = truncateAtSentence(best.text, maxChars);
    indexes = [best.index];
  } else {
    const sep = '\n\n';
    const firstText = focusSentences(
      best.text,
      best.matchedKeys,
      lang,
      Math.floor(maxChars * FIRST_SHARE_WITH_SECOND),
    );
    const secondText = focusSentences(
      second.p.text,
      second.keys,
      lang,
      maxChars - firstText.length - sep.length,
    );
    const parts = [
      { index: best.index, text: firstText },
      { index: second.p.index, text: secondText },
    ].sort((a, b) => a.index - b.index);
    text = truncateAtSentence(parts.map((x) => x.text).join(sep), maxChars);
    indexes = parts.map((x) => x.index);
  }
  return { text, indexes, coverage: Math.round(best.coverage * 100) / 100, mainFact };
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
