// src/v2/steps/fidelity.js
// Özel ad ve sayı sadakati (V2-05f) — LLM'den bağımsız kod kontrolü.
// Karttaki (başlık + metin) özel adlar ve sayılar KANCA + DESTEK PARAGRAFI'nda geçmeli.
//   - Özel ad: büyük harfle başlayan kelime grupları (bin/van/von/de... bağlaçları dahil). Cümle başı
//     tek kelime atlanır (Türkçede her cümle büyük harfle başlar); cümle başında çok kelimeli grup
//     ("Ömer bin Laden ...") kontrol edilir.
//   - Tolerans: büyük/küçük harf ve aksan farkı (ı/i, ş/s, é/e), kesme işareti + Türkçe ek
//     (Laden'i, Dassler'ın), kesmesiz Türkçe ek (Yahudileri), İngilizce çoğul (Vikings), harf
//     çevirisi farkı (Napolyon/Napoleon, Aztek/Aztec: ünsüz iskeleti), küçük bir yerleşik Türkçe yazım
//     tablosu (Usame→Osama, Hindistan→India, Mayıs→May ...), ad türü kelimeler (Adası, Savaşı,
//     İmparatorluğu, Kraliçe ...) ve parantezde orijinali/kısaltması verilen çeviri ("Avrupa Ürün
//     Numarası (EAN)").
//   - Sayı: karttaki her rakam dizisi kanıtta geçmeli (yıl, tarih, adet). Binlik/ondalık ayırıcı
//     farkı (10.000 / 10,000; 3,5 / 3.5) ve kanıtta yazıyla verilen sayılar (three, dört, 16th)
//     tolere edilir. Kaynakta olmayan sayı (birim çevirisi, hesaplanan yaş/süre) yazılamaz.
// Eşleşmeyen ad/sayı → verify onarım turuna "bu ad/sayı kaynakta yok: X" ile girer; onarımdan sonra
// hâlâ varsa rejected:name_mismatch (steps/verify.js).

/** Nokta ile biten ama cümle bitirmeyen kısaltmalar (küçük harfe çevrilmiş). */
export const ABBREVIATIONS = new Set(['m.ö.', 'm.s.', 'mö.', 'ms.', 'vb.', 'vs.', 'dr.', 'prof.', 'st.', 'örn.', 'yy.', 'bkz.', 'no.', 'mr.', 'mrs.', 'jr.', 'sr.']);

const APOSTROPHES = /['’ʼ‘`´"“”«»]/u;
const OPEN_QUOTES = /^["'“‘«(\[]+/u;

/** Karşılaştırma için katlama: küçük harf (tr-TR), aksanlar silinir, ı → i. */
export function fold(text) {
  return String(text ?? '')
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .replace(/ı/g, 'i')
    .replace(/ß/g, 'ss')
    .replace(/æ/g, 'ae')
    .replace(/[øœ]/g, 'o')
    .replace(/ł/g, 'l');
}

/** Metni katlanmış kelimelere böler (harf/rakam dışı her şey ayırıcı). */
export function foldTokens(text) {
  return fold(text).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

/**
 * Kelimelere ayırır; her kelimeye cümle başı bilgisi ekler.
 * @returns {Array<{ raw: string, start: boolean, end: boolean }>}
 */
export function walkWords(text) {
  const words = String(text ?? '').trim().split(/\s+/).filter(Boolean);
  const out = [];
  let start = true;
  for (const raw of words) {
    const last = raw.replace(/["'”’»)\]]+$/u, '').slice(-1);
    let end = ['.', '!', '?', '…'].includes(last);
    if (end) {
      const lower = raw.toLocaleLowerCase('tr-TR');
      if (ABBREVIATIONS.has(lower)) end = false;
      else if ([...raw].length === 2 && raw.endsWith('.') && /\p{Lu}/u.test(raw[0])) end = false; // "J."
      else if (/^\d+\.$/u.test(raw)) end = false; // "16. yüzyıl" sıra sayısı
    }
    out.push({ raw, start, end });
    start = end;
  }
  return out;
}

/** İlk cümle (cümle sonu işaretine kadar). */
export function firstSentence(text) {
  const words = walkWords(text);
  const out = [];
  for (const w of words) {
    out.push(w.raw);
    if (w.end) break;
  }
  return out.join(' ');
}

// --- Tablolar ----------------------------------------------------------------------------

// Türkçe ekler (katlanmış). Kesmesiz yazılmış eki ayırmak için.
const SUFFIXES = [
  'larinin', 'lerinin', 'larina', 'lerine', 'larinda', 'lerinde', 'larindan', 'lerinden', 'lari', 'leri', 'larin', 'lerin', 'lar', 'ler',
  'sinin', 'sunun', 'sina', 'sine', 'sinda', 'sinde', 'sindan', 'sinden', 'siyla', 'siyle',
  'ndaki', 'ndeki', 'daki', 'deki', 'taki', 'teki', 'ndan', 'nden', 'nda', 'nde', 'dan', 'den', 'tan', 'ten', 'da', 'de', 'ta', 'te',
  'nin', 'nun', 'yla', 'yle', 'ya', 'ye', 'yi', 'yu', 'na', 'ne', 'ni', 'nu', 'in', 'un', 'si', 'su', 'li', 'lu', 'ca', 'ce', 'i', 'u', 'a', 'e',
];

// Ad türü / unvan kelimeleri (katlanmış kök): özel adın parçası olabilir ama çevrilir → atlanır.
const GENERIC_STEMS = new Set(
  [
    'ada', 'adalar', 'yarimada', 'nehir', 'nehri', 'irmak', 'irmagi', 'dag', 'dagi', 'daglar', 'gol', 'golu', 'deniz', 'okyanus', 'korfez', 'bogaz', 'col', 'colu', 'orman', 'vadi', 'selale',
    'savas', 'savasi', 'muharebe', 'devrim', 'antlasma', 'antlasmasi', 'anlasma', 'anlasmasi', 'isyan', 'isyani', 'katliam', 'katliami',
    'cumhuriyet', 'cumhuriyeti', 'krallik', 'kralligi', 'imparatorluk', 'imparatorlugu', 'devlet', 'devleti', 'hanedan', 'hanedani', 'eyalet', 'eyaleti', 'bolge', 'bolgesi', 'sehir', 'sehri', 'kent', 'kenti', 'koy', 'koyu', 'il', 'ili', 'ilce', 'ilcesi',
    'universite', 'universitesi', 'okul', 'okulu', 'enstitu', 'enstitusu', 'muze', 'muzesi', 'kutuphane', 'kutuphanesi', 'saray', 'sarayi', 'kale', 'kalesi', 'kopru', 'koprusu', 'kule', 'kulesi',
    'cami', 'camii', 'kilise', 'kilisesi', 'katedral', 'katedrali', 'tapinak', 'tapinagi', 'sinagog', 'sinagogu', 'mezarlik', 'mezarligi', 'ciftlik', 'ciftligi', 'turbe', 'turbesi', 'manastir', 'manastiri', 'meydan', 'meydani', 'cadde', 'caddesi', 'sokak', 'sokagi', 'park', 'parki',
    'havalimani', 'liman', 'limani', 'istasyon', 'istasyonu', 'parti', 'partisi', 'birlik', 'birligi', 'dernek', 'dernegi', 'vakif', 'vakfi', 'sirket', 'sirketi', 'odul', 'odulu', 'kupa', 'kupasi', 'lig', 'ligi',
    'olimpiyat', 'olimpiyatlari', 'festival', 'festivali', 'gun', 'gunu', 'bayram', 'bayrami', 'gece', 'gecesi', 'ordu', 'ordusu', 'donanma', 'donanmasi', 'kongre', 'kongresi', 'meclis', 'meclisi', 'senato', 'senatosu',
    'mahkeme', 'mahkemesi', 'bakanlik', 'bakanligi', 'baskan', 'baskani', 'kral', 'krali', 'kralice', 'kralicesi', 'prens', 'prensi', 'prenses', 'imparator', 'imparatoru', 'imparatorice', 'sultan', 'sultani',
    'papa', 'papasi', 'aziz', 'azize', 'general', 'amiral', 'kaptan', 'profesor', 'doktor', 'sir', 'lord', 'leydi', 'sah', 'han', 'pasa', 'bey', 'hanim', 'efendi', 'hazreti', 'peygamber', 'halife',
    'yahudi', 'yahudiler', 'yahudileri', 'musluman', 'muslumanlar', 'hristiyan', 'hristiyanlar', 'katolik', 'protestan', 'ortodoks', 'sefarad', 'askenaz',
  ].map(fold),
);

// Yerleşik Türkçe yazımlar → kaynaktaki yazım(lar) (katlanmış önek; sondaki boşluk = tam kelime).
const TR_SPELLINGS = {
  // kişi adları
  usame: ['osama', 'usama'], ladin: ['laden'], omer: ['omar', 'umar'], osman: ['osman', 'othman', 'uthman', 'ottoman'], huseyin: ['hussein', 'husayn', 'hossein'],
  hasan: ['hassan', 'hasan'], muhammed: ['muhammad', 'mohammed', 'mohammad', 'muhammed', 'mehmed'], mehmet: ['mehmed', 'mehmet', 'mohammed', 'muhammad'], ahmet: ['ahmed', 'ahmad'],
  yusuf: ['joseph', 'yusuf'], suleyman: ['suleiman', 'sulayman', 'solomon', 'suleyman'], davut: ['david', 'dawud'], ibrahim: ['abraham', 'ibrahim'], ismail: ['ishmael', 'ismail'],
  isa: ['jesus', 'isa '], musa: ['moses', 'musa'], meryem: ['mary', 'maryam'], cengiz: ['genghis', 'chinggis'], timur: ['timur', 'tamerlane'], iskender: ['alexander', 'iskandar'],
  sezar: ['caesar'], aristo: ['aristotle'], eflatun: ['plato'], konfucyus: ['confucius'], hipokrat: ['hippocrates'], arsimet: ['archimedes'], oklid: ['euclid'],
  // ülke, bölge, halk, dil
  turkiye: ['turkey', 'turkiye', 'turkish'], turk: ['turk', 'turkish', 'turkic', 'ottoman'], turkce: ['turkish'], osmanli: ['ottoman'], abd: ['united states', 'usa ', 'u s ', 'us ', 'america'],
  amerika: ['america'], amerikan: ['america'], ingiltere: ['england', 'britain', 'british', 'united kingdom', 'uk '], ingiliz: ['english', 'british', 'britain', 'england'], ingilizce: ['english'],
  iskocya: ['scotland', 'scottish'], iskoc: ['scot'], irlanda: ['ireland', 'irish'], galler: ['wales', 'welsh'], almanya: ['germany', 'german'], alman: ['german'], almanca: ['german'],
  fransa: ['france', 'french'], fransiz: ['french', 'france'], fransizca: ['french'], italya: ['italy', 'italian'], italyan: ['italian', 'italy'], ispanya: ['spain', 'spanish'], ispanyol: ['spanish', 'spain'],
  portekiz: ['portugal', 'portuguese'], hollanda: ['netherlands', 'dutch', 'holland'], belcika: ['belgium', 'belgian'], isvicre: ['switzerland', 'swiss'], isvec: ['sweden', 'swedish'], norvec: ['norway', 'norwegian'],
  danimarka: ['denmark', 'danish'], finlandiya: ['finland', 'finnish'], izlanda: ['iceland', 'icelandic'], polonya: ['poland', 'polish'], macaristan: ['hungary', 'hungarian'], macar: ['hungarian', 'hungary'],
  avusturya: ['austria'], cekya: ['czech'], cek: ['czech'], romanya: ['romania', 'romanian'], bulgaristan: ['bulgaria'], yunanistan: ['greece', 'greek'], yunan: ['greek', 'greece'], rusya: ['russia'], rus: ['russia'],
  sovyet: ['soviet', 'ussr'], sscb: ['soviet', 'ussr'], ukrayna: ['ukrain'], misir: ['egypt'], cin: ['china', 'chinese'], japonya: ['japan'], japon: ['japan'], kore: ['korea'], hindistan: ['india'], hint: ['india', 'hindu'],
  israil: ['israel'], iran: ['iran', 'persia'], irak: ['iraq'], suriye: ['syria'], lubnan: ['leban'], urdun: ['jordan'], suudi: ['saudi'], arap: ['arab'], arapca: ['arabic'], afganistan: ['afghan'],
  kanada: ['canad'], meksika: ['mexic'], brezilya: ['brazil'], arjantin: ['argentin'], sili: ['chile'], peru: ['peru'], kuba: ['cuba'], avustralya: ['australia'], afrika: ['africa'], asya: ['asia'], avrupa: ['europe', 'european'],
  antarktika: ['antarctic'], kuzey: ['north'], guney: ['south'], dogu: ['east'], bati: ['west'], birlesik: ['united'], bm: ['united nations', 'un '], ab: ['european union', 'eu '],
  // şehirler
  moskova: ['moscow'], viyana: ['vienna', 'wien'], londra: ['london'], atina: ['athens'], roma: ['rome', 'roman'], venedik: ['venice'], napoli: ['naples'], floransa: ['florence'], milano: ['milan'],
  kudus: ['jerusalem'], yerusalim: ['jerusalem'], mekke: ['mecca', 'makkah'], medine: ['medina'], kahire: ['cairo'], iskenderiye: ['alexandria'], pekin: ['beijing', 'peking'], lizbon: ['lisbon'], varsova: ['warsaw'], prag: ['prague'],
  bruksel: ['brussels'], cenevre: ['geneva'], kopenhag: ['copenhagen'], munih: ['munich'], kolonya: ['cologne'], bizans: ['byzantin'],
  // gök cisimleri, dinler, bayramlar
  dunya: ['earth', 'world'], ay: ['moon', 'lunar'], gunes: ['sun', 'solar'], tanri: ['god'], kuran: ['quran', 'koran', 'qur'], incil: ['bible', 'gospel'], noel: ['christmas'], paskalya: ['easter'],
  ramazan: ['ramadan'], kurban: ['eid', 'sacrifice', 'adha'], birinci: ['first', 'i '], ikinci: ['second', 'ii '],
  // aylar ve günler
  ocak: ['january', 'jan '], subat: ['february', 'feb '], mart: ['march', 'mar '], nisan: ['april', 'apr '], mayis: ['may '], haziran: ['june', 'jun '], temmuz: ['july', 'jul '], agustos: ['august', 'aug '],
  eylul: ['september', 'sep '], ekim: ['october', 'oct '], kasim: ['november', 'nov '], aralik: ['december', 'dec '],
  pazartesi: ['monday'], sali: ['tuesday'], carsamba: ['wednesday'], persembe: ['thursday'], cuma: ['friday'], cumartesi: ['saturday'], pazar: ['sunday'],
};

// Sondaki/aradaki küçük harfli ad bağlaçları ("Osama bin Laden", "Hugo von Wiedenfeld").
const NAME_CONNECTORS = new Set(['bin', 'ibn', 'bint', 'van', 'von', 'der', 'den', 'de', 'da', 'di', 'du', 'del', 'della', 'des', 'la', 'le', 'al', 'el', 'ul', 'ben', 'y', 'of', 'af', 'zu']);

// Katlanmış kelime sonunda hal eki (bulunma, ayrılma, vasıta, çoğul).
const CASE_ENDING = /(?:[dt][ae]n?|l[ae]r[iu]?|y?l[ae]|n[iu]n)$/u;

// Cümle başında bir adın önüne gelebilen Türkçe kelimeler (grup başı olsa da ad sayılmaz).
const SENTENCE_STARTERS = new Set(
  ['bu', 'şu', 'o', 'bir', 'ilk', 'son', 'ancak', 'ayrıca', 'daha', 'en', 'her', 'ünlü', 'genç', 'eski', 'yeni', 'sonra', 'önce', 'ama', 'fakat', 'çünkü', 'hatta', 'yine', 'böylece',
    'bunun', 'onun', 'aynı', 'tüm', 'bütün', 'bazı', 'birçok', 'iki', 'üç', 'dört', 'beş', 'yani', 'üstelik', 'oysa', 'örneğin', 'dahası', 'ise', 'the', 'a', 'an'].map(fold),
);

// --- Kanıt dizini --------------------------------------------------------------------------

const NUMBER_WORDS = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
  sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90, hundred: 100, thousand: 1000,
  million: 1000000, billion: 1000000000, dozen: 12, first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10, eleventh: 11, twelfth: 12,
  thirteenth: 13, fourteenth: 14, fifteenth: 15, sixteenth: 16, seventeenth: 17, eighteenth: 18, nineteenth: 19, twentieth: 20, twice: 2, once: 1, half: 0.5,
  sifir: 0, bir: 1, iki: 2, uc: 3, dort: 4, bes: 5, alti: 6, yedi: 7, sekiz: 8, dokuz: 9, on: 10, yirmi: 20, otuz: 30, kirk: 40, elli: 50, altmis: 60, yetmis: 70, seksen: 80, doksan: 90,
  yuz: 100, bin: 1000, milyon: 1000000, milyar: 1000000000, birinci: 1, ikinci: 2, ucuncu: 3, dorduncu: 4, besinci: 5, ilk: 1, yarim: 0.5,
};

/** "10.000" / "10,000" → "10000"; "3,5" → "3.5"; "007" → "7". */
export function normalizeNumber(raw) {
  const s = String(raw);
  const plain = /^\d{1,3}(?:[.,]\d{3})+$/u.test(s) ? s.replace(/[.,]/g, '') : s.replace(',', '.');
  const n = Number(plain);
  return Number.isFinite(n) ? String(n) : s;
}

/** Metindeki rakam dizileri (ham). */
export function extractNumbers(text) {
  return String(text ?? '').match(/\d+(?:[.,]\d+)*/gu) ?? [];
}

function skeleton(word) {
  return word
    .replace(/ph/g, 'f')
    .replace(/th/g, 't')
    .replace(/ck/g, 'k')
    .replace(/j/g, 'c')
    .replace(/[cq]/g, 'k')
    .replace(/w/g, 'v')
    .replace(/x/g, 'ks')
    .replace(/y/g, 'i')
    .replace(/[aeiou]/g, '')
    .replace(/(.)\1+/g, '$1');
}

/**
 * Kanıt (kanca + destek paragrafı) dizini.
 * @param {string} text
 */
export function buildEvidence(text) {
  const tokens = foldTokens(text);
  const set = new Set(tokens);
  const skeletons = new Set();
  for (const t of tokens) {
    if (/^\d/u.test(t)) continue;
    const sk = skeleton(t);
    if (sk.length >= 3) skeletons.add(sk);
    if (t.endsWith('s') && t.length > 3) {
      const sk2 = skeleton(t.slice(0, -1));
      if (sk2.length >= 3) skeletons.add(sk2);
    }
  }
  const numbers = new Set(extractNumbers(text).map(normalizeNumber));
  for (let i = 0; i < tokens.length; i += 1) {
    const v = NUMBER_WORDS[tokens[i]];
    if (v === undefined) continue;
    numbers.add(String(v));
    const next = NUMBER_WORDS[tokens[i + 1]];
    if (next !== undefined) {
      if (v >= 20 && v < 100 && next < 10) numbers.add(String(v + next)); // twenty five → 25
      if (next >= 100 && v < 1000) numbers.add(String(v * next)); // three hundred → 300
    }
  }
  return { tokens: set, list: tokens, padded: ` ${tokens.join(' ')} `, skeletons, numbers };
}

// --- Eşleştirme ----------------------------------------------------------------------------

/** Kelimenin katlanmış hali + Türkçe eki ayrılmış adayları. */
function stems(word) {
  const out = [word];
  for (const s of SUFFIXES) {
    if (word.length - s.length >= 2 && word.endsWith(s)) out.push(word.slice(0, -s.length));
  }
  return out;
}

function isGeneric(word) {
  return stems(word).some((s) => GENERIC_STEMS.has(s));
}

function spellingMatch(stem, ev) {
  if (!Object.hasOwn(TR_SPELLINGS, stem)) return false;
  return TR_SPELLINGS[stem].some((v) => ev.padded.includes(` ${v}`));
}

/** Tek (katlanmış) ad parçası kanıtta var mı? */
export function namePartMatches(part, ev) {
  if (!part) return true;
  for (const s of stems(part)) {
    if (s.length < 2) continue;
    if (ev.tokens.has(s)) return true;
    if (ev.tokens.has(`${s}s`) || ev.tokens.has(`${s}es`)) return true; // Viking → Vikings
    if (spellingMatch(s, ev)) return true;
    const sk = skeleton(s);
    if (sk.length >= 3 && ev.skeletons.has(sk)) return true; // Napolyon ↔ Napoleon
  }
  // Kanıttaki bileşik kelimenin başı ("Kristal" ↔ "Kristallnacht").
  if (part.length >= 5 && ev.list.some((t) => t.length > part.length && t.startsWith(part))) return true;
  return false;
}

function coreOf(raw) {
  return raw.replace(/^[^\p{L}\p{N}]+/u, '').replace(/[^\p{L}\p{N}]+$/u, '');
}

/** Ad parçaları: kesme işaretinden önceki kısım, tire ile bölünmüş. */
function nameParts(core) {
  const base = core.split(APOSTROPHES)[0];
  return base
    .split(/[-‐‑–—./]/u)
    .map((p) => fold(p))
    .filter((p) => p && !/^\d+$/u.test(p));
}

/**
 * Metindeki özel ad gruplarını çıkarır.
 *   parenAfter: grubun hemen ardındaki parantezin içeriği ("Avrupa Ürün Numarası (EAN)" → "EAN")
 *   gloss: grup, başka bir grubun hemen ardından açılan parantezin içinde (çeviri/açıklama)
 * @returns {Array<{ text: string, words: string[], parenAfter: string|null, gloss: boolean, start: boolean }>}
 */
export function extractNameGroups(text) {
  const words = walkWords(text);
  const lowerWords = new Set(
    words
      .map((w) => coreOf(w.raw))
      .filter((c) => c && /^\p{Ll}/u.test(c))
      .map((c) => fold(c.split(APOSTROPHES)[0])),
  );
  const groups = [];
  let cur = null;
  let gloss = false; // şu an bir grubun ardından açılan parantezin içindeyiz
  const close = () => {
    if (cur) {
      while (cur.words.length && NAME_CONNECTORS.has(fold(cur.words.at(-1)))) cur.words.pop();
      if (cur.words.length) groups.push(cur);
    }
    cur = null;
  };
  for (let i = 0; i < words.length; i += 1) {
    const { raw, start } = words[i];
    const stripped = raw.replace(OPEN_QUOTES, '');
    if (/^["'“‘«]*\(/u.test(raw)) {
      const prev = cur ?? (groups.length && groups.at(-1).endIndex === i - 1 ? groups.at(-1) : null);
      if (prev) {
        const inner = [];
        for (let j = i; j < words.length; j += 1) {
          inner.push(words[j].raw);
          if (words[j].raw.includes(')')) break;
        }
        prev.parenAfter = inner.join(' ').replace(/^[^(]*\(/u, '').replace(/\).*$/u, '');
        gloss = true;
      }
      close();
    }
    const core = coreOf(stripped);
    const isCap = Boolean(core) && /^\p{Lu}/u.test(core);
    const isConnector = Boolean(core) && !isCap && NAME_CONNECTORS.has(fold(core));
    if (isCap) {
      if (!cur) cur = { words: [], start, parenAfter: null, gloss };
      cur.words.push(core);
      cur.endIndex = i;
    } else if (isConnector && cur) {
      cur.words.push(core);
    } else {
      close();
    }
    // Noktalama grubu keser ("Cochin, Kottayam ve Thiruvalla" → üç ayrı grup).
    if (/[,;:)"”»!?…]$|[^.]\.$/u.test(raw) && !/^\p{Lu}\.$/u.test(raw)) close();
    if (raw.includes(')')) gloss = false;
  }
  close();
  // Cümle başı: tek kelime atlanır; çok kelimeli grubun ilk kelimesi bilinen bir cümle başı kelimesiyse
  // ya da metinde küçük harfle de geçiyorsa (sıradan kelime) atlanır.
  return groups
    .map((g) => {
      let ws = g.words;
      if (g.start) {
        const first = fold(ws[0].split(APOSTROPHES)[0]);
        const commonWord =
          SENTENCE_STARTERS.has(first) ||
          stems(first).some((s) => lowerWords.has(s)) ||
          // Kesmesiz hal eki almış kelime özel ad değildir (Türkçede özel ada ek kesmeyle gelir):
          // "Günümüzde Kerala'da", "Memelerde Kirk'in".
          (!APOSTROPHES.test(ws[0]) && CASE_ENDING.test(first));
        if (ws.length === 1 || commonWord) ws = ws.slice(1);
      }
      while (ws.length && NAME_CONNECTORS.has(fold(ws[0]))) ws = ws.slice(1);
      const textOut = g.words.map((w, k) => (k === g.words.length - 1 ? w.split(APOSTROPHES)[0] : w)).join(' ');
      return { text: textOut, words: ws, parenAfter: g.parenAfter, gloss: g.gloss, start: g.start };
    })
    .filter((g) => g.words.length > 0);
}

/**
 * Kartın özel ad ve sayı sadakati.
 * @param {{ title?: string, content?: string }} card
 * @param {{ hook?: string, support?: string }} source
 * @returns {{ ok: boolean, names: Array<{ text: string, missing: string[] }>, numbers: string[] }}
 */
export function checkFidelity(card, { hook, support } = {}) {
  const ev = buildEvidence(`${hook ?? ''}\n${support ?? ''}`);
  const names = [];
  const seen = new Set();
  for (const field of [card?.title, card?.content]) {
    for (const g of extractNameGroups(field ?? '')) {
      const missing = [];
      for (const w of g.words) {
        if (NAME_CONNECTORS.has(fold(w))) continue;
        for (const part of nameParts(w)) {
          if (part.length < 2 || isGeneric(part)) continue;
          if (!namePartMatches(part, ev)) missing.push(w.split(APOSTROPHES)[0]);
        }
      }
      if (missing.length === 0) continue;
      // Bir adın hemen ardındaki parantezde Türkçe karşılığı/açıklaması ("Türkischer Tempel (Türk Tapınağı)").
      if (g.gloss) continue;
      // Parantezde orijinali/kısaltması kanıtta olan çeviri kabul ("Avrupa Ürün Numarası (EAN)").
      if (g.parenAfter && foldTokens(g.parenAfter).some((t) => t.length >= 2 && namePartMatches(t, ev))) continue;
      const key = fold(g.text);
      if (seen.has(key)) continue;
      seen.add(key);
      names.push({ text: g.text, missing: [...new Set(missing)] });
    }
  }
  const numbers = [];
  for (const raw of extractNumbers(`${card?.title ?? ''} ${card?.content ?? ''}`)) {
    const n = normalizeNumber(raw);
    if (!ev.numbers.has(n) && !numbers.includes(raw)) numbers.push(raw);
  }
  return { ok: names.length === 0 && numbers.length === 0, names, numbers };
}

/** Sadakat sorunlarını onarım turu için iddia biçimine çevirir (kind: 'name' | 'number'). */
export function fidelityProblems(result) {
  return [
    ...result.names.map((n) => ({
      claim: `bu ad kaynakta yok: ${n.text}`,
      verdict: 'unsupported',
      why: `"${n.missing.join('", "')}" kanca ve kaynakta geçmiyor; kaynaktaki adı aynen yaz ya da çıkar`,
      kind: 'name',
    })),
    ...result.numbers.map((n) => ({
      claim: `bu sayı kaynakta yok: ${n}`,
      verdict: 'unsupported',
      why: 'kaynaktaki sayıyı aynen yaz ya da çıkar; birim çevirme, hesaplama yapma',
      kind: 'number',
    })),
  ];
}
