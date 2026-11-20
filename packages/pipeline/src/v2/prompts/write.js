// src/v2/prompts/write.js
// Yazar (writer) istemi. Tahmini token: sistem ~600 (≈2.000 karakter, yorum yasağı + 4 kısa örnek
// dahil), kullanıcı ~70 + destek paragrafı (ortalama ~700, en çok 1.500 karakter ≈ 200-430)
// → çağrı başına ≈ 870-1.100 girdi; çıktı ≈ 120 JSON (2-4 cümle) + gpt-oss "low" akıl yürütme ~180
// ≈ 300. Kural düzeltmesi / onarımda önceki yanıt + not ≈ +250-300 girdi.
// Sınır: config roles.writer.maxTokens (1500).
// Tahmin: Türkçe ~3,2-3,5, İngilizce ~4 karakter/token.

/** config.roles.writer.maxTokens yoksa kullanılır. */
export const WRITE_MAX_TOKENS = 1500;

const DEFAULT_LIMITS = Object.freeze({ minSentences: 2, maxSentences: 4 });

function sentenceRange({ minSentences = DEFAULT_LIMITS.minSentences, maxSentences = DEFAULT_LIMITS.maxSentences } = {}) {
  return minSentences === maxSentences ? `${minSentences}` : `${minSentences}-${maxSentences}`;
}

/** Sistem istemi; cümle aralığı config writing.minSentences/maxSentences'tan gelir. */
export function buildWriteSystemPrompt(limits = DEFAULT_LIMITS) {
  const range = sentenceRange(limits);
  return `Türkçe bilgi kartı yazıyorsun. Okur kartı bitirince "Aa, bunu bilmiyordum!" demeli.
Girdi: kanca, kaynak paragraf, kategori. Kanca kartın konusudur ve editörlerce kaynaklıdır; kaynak paragraf sadece bağlam ve ayrıntı içindir.
Odak:
- Kart kancadaki şaşırtıcı olgunun etrafında kalır. Kaynak paragraftan sadece bu olguyu açıklayan ya da destekleyen bilgiyi al.
- Kancayla ilgisi olmayan ayrıntı (hastalık, kariyer, başka olaylar, tarih listesi) ekleme. Az ama ilgili cümle, çok ama dağınık cümleden iyidir.
- Sadece kancada ya da kaynak paragrafta yazanı kullan. Sayı, tarih, isim uydurma.
Sadece olgu, yorum yok:
- Her cümle kancadaki ya da kaynak paragraftaki bir olguyu aktarır.
- Yorum, genelleme, çıkarım, değerlendirme cümlesi yasak: "bu da gösteriyor ki", "nadir bir örnek", "ilginç bir şekilde", "hızla yayıldı", "komedi unsuru oluşturuyor" gibi.
- Kaynakta yazmayan neden-sonuç kurma. Olgular bitince kartı bitir; kapanış ya da ders cümlesi ekleme.
Kötü (yorumlu): "Libya'da 3 gün yas ilan edildi. Bu yas, ulusal bir acıyı yansıtan nadir bir örnek oldu."
Kötü (yorumlu): "Kirk'in yüzü yapay zekayla ünlülerin görsellerine yerleştirildi. Akım internette hızla yayıldı."
İyi (olgusal): "Libya, Saddam Hüseyin'in idamı üzerine 3 günlük yas ilan etti. Kurban Bayramı kutlamalarına da son verildi."
İyi (olgusal): "Barkod sisteminde bütün kitaplar Bookland adlı kurgusal bir ülkeden gelir. Bu ülkenin ön ekleri 978 ve 979'dur."
Dil:
- Kaynak İngilizceyse anla ve kendi cümlelerinle doğal Türkçe yaz; kelime kelime çevirme.
- Yabancı terimleri Türkçeye çevir; gerekirse orijinalini ilk geçtiği yerde parantezde ver: "Kafaya verilen zayıf elektrik akımı (CES)".
- Anlamından emin olmadığın terimi tahminle çevirme (ör. "forced conversion" = zorla din değiştirtme, "evrim" değil).
- İlk cümle yabancı bir terimle ya da kısaltmayla başlamaz.
Biçim:
- title: 12-58 karakter, şaşırtıcı noktayı söyler. Türkçe cümle düzeni: sadece ilk harf ve özel adlar büyük ("Ahtapotun üç kalbi var", "Her Kelimesi Büyük Başlık" değil). "X nedir", "X kimdir" kalıbı yasak. Başlık da sadece olgu söyler.
- content: ${range} cümle, Türkçe karakterlerle (ı, ğ, ş, ç, ö, ü). İlk cümle şaşırtıcı olgunun kendisi; tanımla başlama.
- tags: 3-5 küçük harfli Türkçe etiket. read_time_sq: tahmini okuma süresi (saniye).
Kaynak paragraf kancayla çelişiyorsa ya da kart ilginç olmayacaksa yazma, şunu dön: {"skip":true,"reason":"..."}
Sadece JSON dön: {"title":"...","content":"...","tags":["..."],"read_time_sq":20}`;
}

/**
 * @param {{ hook: string, lang?: string, support: string, category: string, minSentences?: number, maxSentences?: number }} input
 */
export function buildWritePrompt({ hook, lang, support, category, minSentences, maxSentences }) {
  return {
    messages: [
      { role: 'system', content: buildWriteSystemPrompt({ minSentences, maxSentences }) },
      {
        role: 'user',
        content:
          `Kategori: ${category}\n` +
          `Kanca (${lang || 'en'}, kartın konusu): ${String(hook).replace(/\s+/g, ' ').trim()}\n` +
          `Kaynak paragraf (bağlam):\n${String(support).trim()}`,
      },
    ],
  };
}

/** Kod kuralları ihlal edildiğinde tek yeniden yazım için ek mesajlar. */
export function buildRuleFixMessages(previousText, violations) {
  return [
    { role: 'assistant', content: previousText || '(boş)' },
    {
      role: 'user',
      content: `Kart şu kuralları ihlal ediyor: ${violations.join('; ')}. Aynı JSON biçiminde düzeltilmiş kartı yaz.`,
    },
  ];
}

/** Onarım mesajını tanımak için (testler ve log). */
export const REPAIR_MARKER = 'Kartı onar';

const VERDICT_LABEL = { unsupported: 'kaynakta yok', unclear: 'kaynakta açık değil' };

/**
 * Doğrulayıcı unsupported/unclear iddia bulduğunda TEK onarım turu için ek mesajlar.
 * @param {string} previousText  önceki kart (JSON)
 * @param {Array<{ claim: string, verdict: string, why?: string }>} problems  supported olmayan iddialar
 * @param {{ minSentences?: number, maxSentences?: number }} [limits]
 */
export function buildRepairMessages(previousText, problems, limits = DEFAULT_LIMITS) {
  const list = problems
    .map((c) => {
      const why = String(c.why ?? '').trim();
      return `- "${c.claim}" (${VERDICT_LABEL[c.verdict] ?? c.verdict}${why ? `: ${why}` : ''})`;
    })
    .join('\n');
  return [
    { role: 'assistant', content: previousText || '(boş)' },
    {
      role: 'user',
      content:
        `Doğrulama şu iddiaları kancada ya da kaynak paragrafta bulamadı:\n${list}\n` +
        `${REPAIR_MARKER}: bu iddiaları çıkar ya da kancaya/kaynağa birebir uyacak şekilde düzelt. ` +
        'Yeni bilgi, yorum ya da genelleme ekleme. Sorunlu ifade başlıktaysa başlığı da düzelt; diğer cümlelere dokunma. ' +
        `Gövde ${sentenceRange(limits)} cümle kalmalı; aynı kurallar ve aynı JSON biçimi. ` +
        'Düzeltince ilginç bir kart kalmıyorsa {"skip":true,"reason":"..."} dön.',
    },
  ];
}

export const WRITE_SYSTEM_PROMPT = buildWriteSystemPrompt();
