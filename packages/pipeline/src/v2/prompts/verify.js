// src/v2/prompts/verify.js
// Doğrulayıcı (verifier) istemi. Kanıt = KANCA + DESTEK PARAGRAFI (DYK kancaları editörlerce
// kaynaklıdır; Wikipedia makalesinde geçmeyen kanca bilgisi de kanıt sayılır).
// Tahmini token: sistem ~230 (750 karakter), kullanıcı ≈ kanca ~40 + paragraf ≤380 + kart ~150
// → çağrı başına ≈ 800 girdi. Çıktı kısa tutulur: en fazla 6 iddia, iddia ≤12 kelime,
// "why" sadece supported olmayanlarda → ≈ 150-250 token. Sınır: config roles.verifier.maxTokens
// (1500; yanıt kesilirse finish_reason=length → hata, yedek model).
// Tahmin: Türkçe ~3,2-3,5, İngilizce ~4 karakter/token.

/** config.roles.verifier.maxTokens yoksa kullanılır. */
export const VERIFY_MAX_TOKENS = 1500;
export const VERIFY_MAX_CLAIMS = 6;

const SYSTEM = `Bir bilgi kartını SADECE verilen kanıta göre denetliyorsun; kendi bilgini kullanma.
Kanıt iki parçadır: KANCA (editörlerce kaynaklı, doğru kabul et) ve DESTEK PARAGRAFI.
1. Kartı (başlık dahil) en fazla ${VERIFY_MAX_CLAIMS} atomik iddiaya böl; her iddia tek olgu, en fazla 12 kelime. Başlık gövdeyi tekrar ediyorsa ayrı iddia yazma.
2. Her iddiaya karar ver:
- supported: KANCA ya da DESTEK PARAGRAFI'ndan biri açıkça söylüyor.
- unsupported: kanıtla çelişiyor ya da kanıtta olmayan yeni bir olgu (sayı, tarih, isim, yer) ekliyor; yanlış çeviri de unsupported.
- unclear: kanıt kısmen destekliyor ya da ifade kanıttan daha güçlü/genel.
Kart Türkçe, kanıt İngilizce olabilir; dile değil anlama bak.
Kısa yaz. "why" sadece supported olmayan iddialarda, en fazla 8 kelime.
Sadece JSON dön: {"claims":[{"claim":"...","verdict":"supported"},{"claim":"...","verdict":"unsupported","why":"..."}]}`;

/**
 * @param {{ hook?: string, title: string, content: string, support: string }} input
 */
export function buildVerifyPrompt({ hook, title, content, support }) {
  const hookText = String(hook ?? '').replace(/\s+/g, ' ').trim() || '(yok)';
  return {
    messages: [
      { role: 'system', content: SYSTEM },
      {
        role: 'user',
        content:
          `KANCA:\n${hookText}\n\n` +
          `DESTEK PARAGRAFI:\n${String(support).trim()}\n\n` +
          `KART:\nBaşlık: ${String(title).trim()}\n${String(content).trim()}`,
      },
    ],
  };
}

export const VERIFY_SYSTEM_PROMPT = SYSTEM;
