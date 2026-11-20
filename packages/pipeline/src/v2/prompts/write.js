// src/v2/prompts/write.js
// Yazar (writer) istemi. Tahmini token: sistem ~250 (790 karakter), kullanıcı ~70 + destek
// paragrafı (≤1.500 karakter ≈ ≤380) → çağrı başına ≈ 700 girdi; çıktı ≈ 150 JSON + gpt-oss
// "low" akıl yürütme ~200 ≈ 350. Yeniden yazımda önceki yanıt + not ≈ +250 girdi.
// Tahmin: Türkçe ~3,2-3,5, İngilizce ~4 karakter/token.

export const WRITE_MAX_TOKENS = 1500;

const SYSTEM = `Türkçe bilgi kartı yazıyorsun. Okur kartı bitirince "Aa, bunu bilmiyordum!" demeli.
Girdi: kanca, kaynak paragraf, kategori. Kaynak İngilizceyse anla ve kendi cümlelerinle Türkçe yaz; kelime kelime çevirme.
Kurallar:
- title: 12-58 karakter, şaşırtıcı noktayı söyler. "X nedir", "X kimdir" kalıbı yasak.
- content: 3-5 cümle, doğal Türkçe, Türkçe karakterlerle (ı, ğ, ş, ç, ö, ü). İlk cümle şaşırtıcı olgunun kendisi; tanımla başlama.
- Sadece kaynak paragrafta yazanı kullan. Sayı, tarih, isim ya da yorum ekleme.
- tags: 3-5 küçük harfli Türkçe etiket. read_time_sq: tahmini okuma süresi (saniye).
Kanca kaynakla desteklenmiyorsa ya da kart ilginç olmayacaksa yazma, şunu dön: {"skip":true,"reason":"..."}
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
          `Kanca (${lang || 'en'}): ${String(hook).replace(/\s+/g, ' ').trim()}\n` +
          `Kaynak paragraf:\n${String(support).trim()}`,
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
      content: `Şu ifadeler kaynak paragrafta açıkça yok. Çıkar ya da kaynağa birebir uyacak şekilde düzelt; aynı kurallar ve JSON biçimi:\n${list}`,
    },
  ];
}

export const WRITE_SYSTEM_PROMPT = SYSTEM;
