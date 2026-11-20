// src/v2/prompts/verify.js
// Doğrulayıcı (verifier) istemi. Kanıt = KANCA + DESTEK PARAGRAFI (DYK kancaları editörlerce
// kaynaklıdır; Wikipedia makalesinde geçmeyen kanca bilgisi de kanıt sayılır).
// Tahmini token: sistem ~400 (≈1.350 karakter, 2 örnek dahil), kullanıcı ≈ kanca ~35 + paragraf
// ~200 (ortalama ~700, en çok 1.500 karakter) + kart ~100 → çağrı başına ≈ 700 girdi (ilk dry-run'da
// eski istemle ölçülen ortalama 530). Çıktı: en fazla 6 iddia, iddia ≤12 kelime, "why" sadece
// supported olmayanlarda → ≈ 150-250 token. Sınır: config roles.verifier.maxTokens
// (yanıt kesilirse finish_reason=length → hata, yedek model).
// Tahmin: Türkçe ~3,2-3,5, İngilizce ~4 karakter/token.

/** config.roles.verifier.maxTokens yoksa kullanılır. */
export const VERIFY_MAX_TOKENS = 800;
export const VERIFY_MAX_CLAIMS = 6;

const SYSTEM = `Bir bilgi kartını SADECE verilen kanıta göre denetliyorsun; kendi bilgini kullanma.
Kanıt iki parçadır: KANCA (editörlerce kaynaklı, doğru kabul et) ve DESTEK PARAGRAFI.
1. Kartı (başlık dahil) en fazla ${VERIFY_MAX_CLAIMS} atomik iddiaya böl; her iddia tek olgu, en fazla 12 kelime. Başlık gövdeyi tekrar ediyorsa ayrı iddia yazma.
2. Her iddiaya karar ver:
- supported: KANCA ya da DESTEK PARAGRAFI'ndan biri bunu açıkça ya da doğrudan çıkarılabilir şekilde söylüyor. Eş anlamlı ifade, özetleme, birim/çeviri farkı ve isimden türetme (ör. Adi + Dassler → Adidas) supported'dır.
- unsupported: SADECE kanıtta olmayan yeni bir olgu, sayı, tarih, isim, neden-sonuç ya da yorum/değerlendirme ekliyorsa veya kanıtla çelişiyorsa.
- unclear: kanıt iddianın bir kısmını destekliyor, gerisi için karar veremiyorsun.
Kart Türkçe, kanıt İngilizce olabilir; dile değil anlama bak. Karar vermeden önce kancanın ve paragrafın tamamına bak.
Örnekler:
Kanıt: "Adolf "Adi" Dassler registered Adidas, from Adi Dassler" · İddia: "Adidas adı Adi ve Dassler'den türetildi" → supported
Kanıt: "Libya declared three days of mourning" · İddia: "Bu yas nadir bir örnekti" → unsupported, why: "yorum, kanıtta yok"
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
