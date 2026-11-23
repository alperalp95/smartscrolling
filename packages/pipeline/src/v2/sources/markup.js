// Wiki işaretlemesi (HTML ve wikitext) → düz metin ve link yardımcıları. Saf fonksiyonlar, ağ yok.

const NAMED_ENTITIES = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  minus: '−',
  times: '×',
  thinsp: ' ',
  zwj: '',
  zwnj: '',
  shy: '',
};

/**
 * HTML varlıklarını çözer (&amp;, &#39;, &#x2013; ...).
 * @param {string} text
 * @returns {string}
 */
export function decodeEntities(text) {
  return String(text ?? '').replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code) => {
    if (code[0] === '#') {
      const n = code[1].toLowerCase() === 'x' ? Number.parseInt(code.slice(2), 16) : Number.parseInt(code.slice(1), 10);
      if (!Number.isFinite(n)) return match;
      if (n === 160 || n === 8201) return ' ';
      try {
        return String.fromCodePoint(n);
      } catch {
        return match;
      }
    }
    const named = NAMED_ENTITIES[code.toLowerCase()];
    return named ?? match;
  });
}

function tidySpaces(text) {
  return text
    .replace(/[   ]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .trim();
}

/**
 * MediaWiki HTML parçasını düz metne çevirir: kaynak dipnotları ([1]), "citation needed"
 * etiketleri, stil blokları ve tüm etiketler silinir; varlıklar çözülür; boşluk sadeleşir.
 *
 * @param {string} html
 * @returns {string}
 */
export function htmlToText(html) {
  const stripped = String(html ?? '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<sup\b[^>]*class="[^"]*(?:reference|noprint|Inline-Template)[^"]*"[^>]*>[\s\S]*?<\/sup>/gi, '')
    .replace(/<span\b[^>]*class="[^"]*(?:mw-editsection|noprint)[^"]*"[^>]*>[\s\S]*?<\/span>/gi, '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '');
  return tidySpaces(decodeEntities(stripped));
}

/**
 * `open` ... `close` arasındaki dengeli blokları siler (iç içe olabilir). `keep(inner)` bir string
 * dönerse blok onunla değiştirilir.
 *
 * @param {string} text
 * @param {string} open
 * @param {string} close
 * @param {(inner: string) => string | null} [keep]
 */
export function replaceBalanced(text, open, close, keep = () => null) {
  let out = '';
  let i = 0;
  while (i < text.length) {
    const start = text.indexOf(open, i);
    if (start === -1) {
      out += text.slice(i);
      break;
    }
    out += text.slice(i, start);
    let depth = 0;
    let j = start;
    let end = -1;
    while (j < text.length) {
      if (text.startsWith(open, j)) {
        depth += 1;
        j += open.length;
      } else if (text.startsWith(close, j)) {
        depth -= 1;
        j += close.length;
        if (depth === 0) {
          end = j;
          break;
        }
      } else {
        j += 1;
      }
    }
    if (end === -1) {
      // Kapanmamış blok: geri kalanı at.
      break;
    }
    const inner = text.slice(start + open.length, end - close.length);
    const replacement = keep(inner);
    out += replacement ?? '';
    i = end;
  }
  return out;
}

/** {{'}} şablonu için yer tutucu: '''kalın''' temizliğine takılmasın diye en sonda kesmeye döner. */
const APOS = String.fromCharCode(0xe000);

const FILE_NAMESPACES = /^\s*(?:file|image|dosya|resim|media|category|kategori)\s*:/i;

/** Metni koruyan basit şablonlar: {{lang|xx|metin}} → metin, {{'}} → ' vb. */
function keepTemplate(inner) {
  const parts = inner.split('|').map((p) => p.trim());
  const name = parts[0].toLowerCase();
  if (name === "'") return APOS;
  if (name === '!') return '|';
  if (name === 'spaced ndash' || name === 'snd' || name === 'spaced en dash') return ' – ';
  if (name === 'ndash') return '–';
  if (name === 'mdash') return '—';
  if (['nowrap', 'nobr', 'small', 'smaller', 'em', 'strong', 'noitalic', 'not a typo', 'sic'].includes(name)) {
    return parts.slice(1).filter((p) => !p.includes('=')).join(' ');
  }
  if (name === 'lang' || name === 'transliteration' || name === 'transl') {
    return parts[parts.length - 1].includes('=') ? parts[2] ?? '' : parts[parts.length - 1];
  }
  if (name === 'convert' || name === 'cvt') {
    return parts.slice(1, 3).join(' ');
  }
  return null;
}

/**
 * Wikitext parçasını düz metne çevirir: <ref>, yorumlar, dosya/kategori linkleri, şablonlar
 * (birkaç metin koruyan şablon hariç), tablolar ve HTML etiketleri silinir; [[a|b]] → b,
 * '''kalın''' / ''italik'' → düz.
 *
 * @param {string} wikitext
 * @returns {string}
 */
export function wikitextToText(wikitext) {
  let text = String(wikitext ?? '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<ref\b[^>]*\/>/gi, '')
    .replace(/<ref\b[^>]*>[\s\S]*?<\/ref>/gi, '')
    .replace(/<nowiki>([\s\S]*?)<\/nowiki>/gi, '$1');

  text = replaceBalanced(text, '{{', '}}', keepTemplate);
  text = replaceBalanced(text, '{|', '|}');
  text = replaceBalanced(text, '[[', ']]', (inner) => {
    if (FILE_NAMESPACES.test(inner)) return '';
    const pipe = inner.indexOf('|');
    const label = pipe === -1 ? inner : inner.slice(pipe + 1);
    return label.replace(/^:/, '');
  });

  text = text
    // [http://x etiket] → etiket
    .replace(/\[(?:https?:)?\/\/[^\s\]]+\s+([^\]]+)\]/g, '$1')
    .replace(/\[(?:https?:)?\/\/[^\]]+\]/g, '')
    // ''Lost'''un → italik kapanışı + kesme işareti (MediaWiki de böyle işler)
    .replace(/(?<!')(''[^'\n]+)'''(?=\p{L})/gu, `$1''${APOS}`)
    .replace(/'{2,5}/g, '')
    .replace(/<div\b[^>]*>[\s\S]*?<\/div>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '');

  return tidySpaces(decodeEntities(text).replaceAll(APOS, "'"));
}

/**
 * Wikitext'ten dosya/kategori linklerini (iç içe linkli açıklamalarıyla) ve <div> bloklarını siler.
 * @param {string} wikitext
 * @returns {string}
 */
export function stripFileLinks(wikitext) {
  return replaceBalanced(String(wikitext ?? ''), '[[', ']]', (inner) =>
    FILE_NAMESPACES.test(inner) ? '' : `[[${inner}]]`,
  ).replace(/<div\b[^>]*>[\s\S]*?<\/div>/gi, ' ');
}

/**
 * Wiki makale adından kalıcı URL üretir. Aynı makale her zaman aynı URL'yi verir
 * (boşluk → _, fragment atılır, yüzde kodlaması normalize edilir).
 *
 * @param {'en' | 'tr' | string} lang
 * @param {string} title  Ham başlık ya da href yolu ("./Foo", "/wiki/Foo%3F", "Foo bar").
 * @returns {string | null}
 */
export function wikiUrl(lang, title) {
  if (!title) return null;
  let t = String(title).trim();
  // Sorgu dizesi sadece href/URL girdisinde atılır; ham başlıkta "?" makale adının parçasıdır.
  const isHref = /^(?:(?:https?:)?\/\/|\/|\.\/)/.test(t);
  t = t.replace(/^(?:https?:)?\/\/[^/]+/, '').replace(/^\.\//, '').replace(/^\/wiki\//, '');
  if (isHref) t = t.split('?')[0];
  t = t.split('#')[0];
  try {
    t = decodeURIComponent(t);
  } catch {
    // Bozuk kodlama: olduğu gibi bırak.
  }
  t = decodeEntities(t).replace(/\s+/g, '_').replace(/^_+|_+$/g, '');
  if (!t) return null;
  // MediaWiki ilk harfi büyütür; TR vikide i → İ.
  t = (lang === 'tr' ? t.charAt(0).toLocaleUpperCase('tr-TR') : t.charAt(0).toUpperCase()) + t.slice(1);
  const encoded = encodeURIComponent(t)
    .replace(/%2C/g, ',')
    .replace(/%3A/g, ':')
    .replace(/%2F/g, '/')
    .replace(/%3B/g, ';')
    .replace(/%40/g, '@')
    .replace(/%24/g, '$')
    .replace(/%21/g, '!');
  return `https://${lang}.wikipedia.org/wiki/${encoded}`;
}

/** Makale olmayan ad alanları (dosya, yardım, proje sayfaları ...). */
const NON_ARTICLE = /^(?:file|image|dosya|resim|help|yardım|wikipedia|vikipedi|wp|special|özel|category|kategori|template|şablon|portal|talk|user|kullanıcı|draft|taslak|module|modül|mos|wiktionary|wikt|commons|meta|s|q|d|n|v|b|voy|species)\s*:/i;

function hrefToTitle(href) {
  const raw = decodeEntities(href);
  const m = raw.match(/^(?:\.\/|\/wiki\/)([^?]+)$/);
  if (!m) return null;
  let title = m[1];
  try {
    title = decodeURIComponent(title);
  } catch {
    // olduğu gibi
  }
  title = title.split('#')[0];
  if (!title || NON_ARTICLE.test(title)) return null;
  return title;
}

/**
 * HTML parçasındaki makale linklerini sırayla döndürür (dosya/yardım/kırmızı link hariç).
 * @param {string} html
 * @returns {string[]} başlıklar
 */
export function articleLinksFromHtml(html) {
  const titles = [];
  for (const m of String(html ?? '').matchAll(/<a\b[^>]*\bhref="([^"]+)"[^>]*>/gi)) {
    if (/\bclass="[^"]*\bnew\b/.test(m[0])) continue; // kırmızı link (makale yok)
    const title = hrefToTitle(m[1]);
    if (title) titles.push(title);
  }
  return titles;
}

/**
 * HTML parçasında ilk kalın (<b>) bölümdeki ilk makale linkinin başlığı.
 * @param {string} html
 * @returns {string | null}
 */
export function boldLinkFromHtml(html) {
  for (const m of String(html ?? '').matchAll(/<b\b[^>]*>([\s\S]*?)<\/b>/gi)) {
    const [first] = articleLinksFromHtml(m[1]);
    if (first) return first;
  }
  return null;
}

/**
 * Wikitext parçasındaki [[link]] hedeflerini sırayla döndürür (dosya/kategori hariç).
 * @param {string} wikitext
 * @returns {string[]}
 */
export function linksFromWikitext(wikitext) {
  const titles = [];
  for (const m of String(wikitext ?? '').matchAll(/\[\[([^[\]|]+)(?:\|[^[\]]*)?\]\]/g)) {
    const target = m[1].trim().replace(/^:/, '');
    if (!target || NON_ARTICLE.test(target) || target.startsWith('#')) continue;
    titles.push(target.split('#')[0]);
  }
  return titles;
}

/**
 * Wikitext'te ilk '''kalın''' bölümdeki ilk link hedefi.
 * @param {string} wikitext
 * @returns {string | null}
 */
export function boldLinkFromWikitext(wikitext) {
  for (const m of String(wikitext ?? '').matchAll(/'{3,5}([\s\S]*?)'{3,5}/g)) {
    const [first] = linksFromWikitext(m[1]);
    if (first) return first;
  }
  return null;
}

/**
 * Metnin ilk `max` cümlesi (kısaltmalar ve "U.S." gibi baş harfler bölünmez).
 * @param {string} text
 * @param {number} [max]
 * @returns {string}
 */
export function firstSentences(text, max = 2) {
  const src = String(text ?? '').trim();
  const sentences = [];
  let start = 0;
  const re = /[.!?]["”’)]?\s+(?=["“(]?[A-Z0-9ÇĞİÖŞÜ])/g;
  let m;
  while ((m = re.exec(src)) && sentences.length < max) {
    const before = src.slice(start, m.index + 1);
    if (/(?:\b[A-Z]\.|\b(?:e\.g|i\.e|etc|vs|Dr|Mr|Mrs|Ms|St|Jr|Sr|No|ca|c|approx|Gen|Col|Lt|Mt|U\.S)\.)$/.test(before)) continue;
    sentences.push(src.slice(start, m.index + m[0].trimEnd().length).trim());
    start = m.index + m[0].length;
  }
  if (sentences.length < max && start < src.length) sentences.push(src.slice(start).trim());
  return sentences.join(' ').trim();
}

/**
 * Bir başlıktan kısa, deterministik bir anahtar parçası üretir ("Ancient Rome" → "ancient-rome").
 * @param {string} text
 * @returns {string}
 */
export function slugify(text) {
  return String(text ?? '')
    .toLocaleLowerCase('en-US')
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/ı/g, 'i')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
