// src/v2/prompts/write.js
// Yazar (writer) istemi. Tahmini token: sistem ~430 (1.400 karakter), kullanıcı ~70 + destek
// paragrafı (≤1.500 karakter ≈ ≤380) → çağrı başına ≈ 880 girdi; çıktı ≈ 150 JSON + gpt-oss
// "low" akıl yürütme ~200 ≈ 350. Yeniden yazımda önceki yanıt + not ≈ +250 girdi.
// Sınır: config roles.writer.maxTokens (1500).
// Tahmin: Türkçe ~3,2-3,5, İngilizce ~4 karakter/token.

/** config.roles.writer.maxTokens yoksa kullanılır. */
export const WRITE_MAX_TOKENS = 1500;

const SYSTEM = `Türkçe bilgi kartı yazıyorsun. Okur kartı bitirince "Aa, bunu bilmiyordum!" demeli.
Girdi: kanca, kaynak paragraf, kategori. Kanca kartın konusudur ve editörlerce kaynaklıdır; kaynak paragraf sadece bağlam ve ayrıntı içindir.
Odak:
- Kart kancadaki şaşırtıcı olgunun etrafında kalır. Kaynak paragraftan sadece bu olguyu açıklayan ya da destekleyen bilgiyi al.
- Kancayla ilgisi olmayan ayrıntı (hastalık, kariyer, başka olaylar, tarih listesi) ekleme. Az ama ilgili cümle, çok ama dağınık cümleden iyidir.
- Sadece kancada ya da kaynak paragrafta yazanı kullan. Sayı, tarih, isim ya da yorum uydurma.
Dil:
- Kaynak İngilizceyse anla ve kendi cümlelerinle doğal Türkçe yaz; kelime kelime çevirme.
- Yabancı terimleri Türkçeye çevir; gerekirse orijinalini ilk geçtiği yerde parantezde ver: "Kafaya verilen zayıf elektrik akımı (CES)".
- Anlamından emin olmadığın terimi tahminle çevirme (ör. "forced conversion" = zorla din değiştirtme, "evrim" değil).
- İlk cümle yabancı bir terimle ya da kısaltmayla başlamaz.
Biçim:
- title: 12-58 karakter, şaşırtıcı noktayı söyler. Türkçe cümle düzeni: sadece ilk harf ve özel adlar büyük ("Ahtapotun üç kalbi var", "Her Kelimesi Büyük Başlık" değil). "X nedir", "X kimdir" kalıbı yasak.
- content: 3-5 cümle, Türkçe karakterlerle (ı, ğ, ş, ç, ö, ü). İlk cümle şaşırtıcı olgunun kendisi; tanımla başlama.
- tags: 3-5 küçük harfli Türkçe etiket. read_time_sq: tahmini okuma süresi (saniye).
Kaynak paragraf kancayla çelişiyorsa ya da kart ilginç olmayacaksa yazma, şunu dön: {"skip":true,"reason":"..."}
Sadece JSON dön: {"title":"...","content":"...","tags":["..."],"read_time_sq":20}`;

/**
 * @param {{ hook: string, lang?: string, support: string, category: string }} input
 */
export function buildWritePrompt({ hook, lang, support, category }) {
  return {
    messages: [
      { role: 'system', content: SYSTEM },
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

/** Doğrulayıcı "unclear" dediğinde tek yeniden yazım için ek mesaj. */
export function buildUnclearFixMessages(previousText, unclearClaims) {
  const list = unclearClaims.map((c) => `- ${c}`).join('\n');
  return [
    { role: 'assistant', content: previousText || '(boş)' },
    {
      role: 'user',
      content: `Şu ifadeler kancada ya da kaynak paragrafta açıkça yok. Çıkar ya da kancaya/kaynağa birebir uyacak şekilde düzelt; aynı kurallar ve JSON biçimi:\n${list}`,
    },
  ];
}

export const WRITE_SYSTEM_PROMPT = SYSTEM;
