// Bölümleri cümle sonunda kartlara böler (saf, ağ yok).

export const DEFAULT_MAX_CHARS = 600;

// Sonunda nokta olsa da cümle bitirmeyen kısaltmalar (küçük harf, noktasız).
const ABBREVIATIONS = new Set([
  'dr',
  'vb',
  'yy',
  'vs',
  'bkz',
  'sn',
  'prof',
  'doç',
  'yrd',
  'örn',
  'no',
]);

/** Bu kelime cümleyi bitiriyor mu? Kısaltma, "M.Ö.", sayı+nokta bitirmez. */
function endsSentence(word) {
  if (!/[.!?…]["'”’)\]]*$/.test(word)) return false;
  if (/[!?…]["'”’)\]]*$/.test(word)) return true;
  const bare = word.replace(/["'”’)\]]*$/, '');
  if (/^\d+\.$/.test(bare)) return false; // "1."
  if (/^(\p{L}\.)+$/u.test(bare)) return false; // "M.Ö.", "M.S.", "A."
  const stem = bare.slice(0, -1).toLocaleLowerCase('tr-TR');
  if (ABBREVIATIONS.has(stem)) return false;
  return true;
}

function toSentences(text) {
  const sentences = [];
  let cur = [];
  for (const word of text.split(/\s+/).filter(Boolean)) {
    cur.push(word);
    if (endsSentence(word)) {
      sentences.push(cur.join(' '));
      cur = [];
    }
  }
  if (cur.length) sentences.push(cur.join(' '));
  return sentences;
}

/** maxChars'tan uzun tek cümleyi kelime sınırında böler; tek kelime de uzunsa sert keser. */
function splitLongSentence(sentence, maxChars) {
  const parts = [];
  let cur = '';
  for (let word of sentence.split(' ')) {
    while (word.length > maxChars) {
      if (cur) {
        parts.push(cur);
        cur = '';
      }
      parts.push(word.slice(0, maxChars));
      word = word.slice(maxChars);
    }
    if (!word) continue;
    if (!cur) cur = word;
    else if (cur.length + 1 + word.length <= maxChars) cur += ` ${word}`;
    else {
      parts.push(cur);
      cur = word;
    }
  }
  if (cur) parts.push(cur);
  return parts;
}

/**
 * Bölümleri ≤maxChars karakterlik kartlara böler; kart bölüm sınırını aşmaz. position 1'den.
 * @returns {Array<{ position: number, sectionTitle: string, body: string }>}
 */
export function splitIntoCards(sections, { maxChars = DEFAULT_MAX_CHARS } = {}) {
  const cards = [];
  for (const section of sections) {
    let cur = '';
    const flush = () => {
      if (cur) cards.push({ position: cards.length + 1, sectionTitle: section.heading, body: cur });
      cur = '';
    };
    for (const sentence of toSentences(section.text ?? '')) {
      if (sentence.length > maxChars) {
        flush();
        const parts = splitLongSentence(sentence, maxChars);
        for (const p of parts.slice(0, -1)) {
          cur = p;
          flush();
        }
        cur = parts[parts.length - 1];
      } else if (!cur) {
        cur = sentence;
      } else if (cur.length + 1 + sentence.length <= maxChars) {
        cur += ` ${sentence}`;
      } else {
        flush();
        cur = sentence;
      }
    }
    flush();
  }
  return cards;
}

/** Kartlardan bölüm özeti: başlık, ilk pozisyon, kart sayısı (ardışık aynı başlık tek bölüm). */
export function summarizeSections(cards) {
  const out = [];
  for (const c of cards) {
    const last = out[out.length - 1];
    if (last && last.title === c.sectionTitle) last.cardCount += 1;
    else out.push({ title: c.sectionTitle, firstPosition: c.position, cardCount: 1 });
  }
  return out;
}
