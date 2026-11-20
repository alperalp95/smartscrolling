// src/v2/prompts/verify.js
// Doğrulayıcı (verifier) istemi. Tahmini token: sistem ~180 (570 karakter), kullanıcı ≈
// kart ~150 + destek paragrafı ≤380 → çağrı başına ≈ 720 girdi; çıktı ≈ 250 (5-8 iddia).
// Tahmin: Türkçe ~3,2-3,5, İngilizce ~4 karakter/token.

export const VERIFY_MAX_TOKENS = 1000;

const SYSTEM = `Bir bilgi kartını SADECE verilen kaynak paragrafa göre denetliyorsun; kendi bilgini kullanma.
1. Kartı (başlık dahil) atomik iddialara böl: her iddia tek bir olgu.
2. Her iddiaya bir karar ver:
- supported: kaynakta açıkça yazıyor.
- unsupported: kaynakla çelişiyor ya da kaynakta olmayan yeni bir olgu (sayı, tarih, isim, yer) ekliyor.
- unclear: kaynak kısmen destekliyor ya da ifade kaynaktan daha güçlü/genel.
Kart Türkçe, kaynak İngilizce olabilir; dile değil anlama bak.
Sadece JSON dön: {"claims":[{"claim":"...","verdict":"supported","why":"en fazla 10 kelime"}]}`;

/**
 * @param {{ title: string, content: string, support: string }} input
 */
export function buildVerifyPrompt({ title, content, support }) {
  return {
    messages: [
      { role: 'system', content: SYSTEM },
      {
        role: 'user',
        content: `KAYNAK:\n${String(support).trim()}\n\nKART:\nBaşlık: ${String(title).trim()}\n${String(content).trim()}`,
      },
    ],
  };
}

export const VERIFY_SYSTEM_PROMPT = SYSTEM;
