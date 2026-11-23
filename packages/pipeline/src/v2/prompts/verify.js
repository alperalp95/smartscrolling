// src/v2/prompts/verify.js
// Doğrulayıcı (verifier) istemi. Kanıt = KANCA + DESTEK PARAGRAFI (DYK kancaları editörlerce
// kaynaklıdır; Wikipedia makalesinde geçmeyen kanca bilgisi de kanıt sayılır).
// Tahmini token: sistem ~520 (≈1.750 karakter, 2 iddia + 1 başlık örneği dahil), kullanıcı ≈ kanca ~35
// + paragraf ~200 (ortalama ~700, en çok 1.500 karakter) + kart ~100 → çağrı başına ≈ 820 girdi.
// Çıktı: başlık iddiası + en fazla 5 gövde iddiası (≤12 kelime), "why" sadece supported olmayanlarda,
// + title_match → ≈ 170-270 token. Sınır: config roles.verifier.maxTokens
// (yanıt kesilirse finish_reason=length → hata, yedek model).
// Başlık kontrolü (V2-05e): ilk iddia her zaman başlığın kendisi; ayrıca "başlık, metindeki olguyla
// aynı şeyi mi söylüyor, terimler doğru çevrilmiş mi?" sorusu title_match alanında cevaplanır.
// title_match=false → kart onarım turuna girer (steps/verify.js).
// V2-05f: farklı kişi adı/sayı unsupported (asıl güvence kodda: steps/fidelity.js). Sistem ≈ +20 token.
// Tahmin: Türkçe ~3,2-3,5, İngilizce ~4 karakter/token.

/** config.roles.verifier.maxTokens yoksa kullanılır. */
export const VERIFY_MAX_TOKENS = 800;
export const VERIFY_MAX_CLAIMS = 6;

const SYSTEM = `Bir bilgi kartını SADECE verilen kanıta göre denetliyorsun; kendi bilgini kullanma.
Kanıt iki parçadır: KANCA (editörlerce kaynaklı, doğru kabul et) ve DESTEK PARAGRAFI.
1. Kartı en fazla ${VERIFY_MAX_CLAIMS} atomik iddiaya böl; her iddia tek olgu, en fazla 12 kelime. İlk iddia her zaman başlığın kendisidir (başlık gövdeyi tekrar etse bile).
2. Her iddiaya karar ver:
- supported: KANCA ya da DESTEK PARAGRAFI'ndan biri bunu açıkça ya da doğrudan çıkarılabilir şekilde söylüyor. Eş anlamlı ifade, özetleme, birim/çeviri farkı ve isimden türetme (ör. Adi + Dassler → Adidas) supported'dır.
- unsupported: SADECE kanıtta olmayan yeni bir olgu, sayı, tarih, isim, neden-sonuç ya da yorum/değerlendirme ekliyorsa veya kanıtla çelişiyorsa. Yanlış çevrilmiş terim de kanıtla çelişir. Kanıttakinden farklı bir kişi adı ya da sayı da çelişir (Osama → "Ömer" unsupported).
- unclear: kanıt iddianın bir kısmını destekliyor, gerisi için karar veremiyorsun.
3. Başlığı ayrıca sor: başlık, metindeki ve kanıttaki olguyla aynı şeyi mi söylüyor? Terimler doğru çevrilmiş mi? Evetse "title_match":true, değilse "title_match":false ve "title_why" (en fazla 8 kelime).
Kart Türkçe, kanıt İngilizce olabilir; dile değil anlama bak. Karar vermeden önce kancanın ve paragrafın tamamına bak.
Örnekler:
Kanıt: "Adolf "Adi" Dassler registered Adidas, from Adi Dassler" · İddia: "Adidas adı Adi ve Dassler'den türetildi" → supported
Değerlendirme/önem iddiaları ("dönemin tartışmalarında önemli yer edindi", "büyük ilgi gördü") kanıtta açıkça yoksa unsupported'dır (why: "önem iddiası, kanıtta yok").
Kanıt: "Libya declared three days of mourning" · İddia: "Bu yas nadir bir örnekti" → unsupported, why: "yorum, kanıtta yok"
Başlık örneği: kanıt "the final rehearsal lasted four days", başlık "Rehberlik tatbikatı dört gün sürdü" → title_match:false, title_why: "rehearsal = prova, rehberlik değil"
Kısa yaz. "why" sadece supported olmayan iddialarda, en fazla 8 kelime.
Sadece JSON dön: {"claims":[{"claim":"<başlık>","verdict":"supported"},{"claim":"...","verdict":"unsupported","why":"..."}],"title_match":true}`;

/**
 * @param {{ hook?: string, title: string, content: string, support: string }} input
 */
export function buildVerifyPrompt({ hook, title, content, support }) {
  const hookText =
    String(hook ?? '')
      .replace(/\s+/g, ' ')
      .trim() || '(yok)';
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
