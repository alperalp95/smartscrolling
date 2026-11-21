// src/v2/prompts/write.js
// Yazar (writer) istemi. Tahmini token: sistem ~1.130 (≈3.740 karakter; yorum yasağı, başlık kuralları,
// 3 kötü/iyi başlık örneği, V2-05f ad/sayı sadakati ve bağımsız ilk cümle kuralı dahil), kullanıcı ~70 + destek paragrafı (ortalama ~700, en çok 1.500
// karakter ≈ 200-430) → çağrı başına ≈ 1.260-1.500 girdi; çıktı ≈ 120 JSON (2-4 cümle) + gpt-oss
// "low" akıl yürütme ~180 ≈ 300. Kural düzeltmesi / onarımda önceki yanıt + not ≈ +250-300 girdi.
// Sınır: config roles.writer.maxTokens (1000; Groq OTPM 1000'i aşmaz).
// Tahmin: Türkçe ~3,2-3,5, İngilizce ~4 karakter/token.

/** config.roles.writer.maxTokens yoksa kullanılır. */
export const WRITE_MAX_TOKENS = 1000;

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
- Kişi adlarını kaynaktaki yazımıyla aynen yaz, başka bir adla değiştirme ("Osama bin Laden"; "Ömer bin Laden" değil). Yer adlarının yerleşik Türkçesi olur (Hindistan, Viyana).
- Sayı ve yılları kaynaktaki gibi yaz; birim çevirme, yaş/süre/fark hesaplama.
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
- Terimin bağlamdaki doğru Türkçe karşılığını kullan, sözlükteki ilk anlamını değil: "rehearsal" = prova ("rehberlik" ya da "tatbikat" değil), "thesis" = tez.
- İlk cümle yabancı bir terimle ya da kısaltmayla başlamaz.
Başlık:
- 12-58 karakter. Olguyu söyleyen, yüklemli, tam ve doğal bir Türkçe cümle; yarım kalmış bir parça ya da sadece isim tamlaması değil.
- Türkçe cümle düzeni: ilk harf büyük, sonra sadece özel adlar büyük ("Ahtapotun üç kalbi var", "Her Kelimesi Büyük Başlık" değil). Sonda nokta yok.
- Gövdedeki olguyla aynı şeyi söyler; gövdede olmayan bilgi ya da yorum eklemez. "X nedir", "X kimdir" kalıbı yasak.
Kötü başlık: "hamlet en çok filme çekilen öykü" (küçük harf, eksik) · İyi: "Hamlet, Külkedisi'nden sonra en çok filme çekilen hikâye"
Kötü başlık: "Helmi Kurrik'in 1930'larda kanlı yemekler üzerine tez" (yüklem yok) · İyi: "Helmi Kurrik yüksek lisans tezini kanlı yemeklere ayırdı"
Kötü başlık: "Rehberlik tatbikatı dört gün sürdü" ("rehearsal" yanlış çevrilmiş) · İyi: "Bin Ladin baskınının son provası dört gün sürdü"
Biçim:
- title: yukarıdaki başlık kuralları.
- content: ${range} cümle, Türkçe karakterlerle (ı, ğ, ş, ç, ö, ü). İlk cümle şaşırtıcı olgunun kendisi; tanımla başlama.
- İlk cümle başlık okunmadan tek başına anlaşılır: konuyu açıkça adlandırır, öznesi vardır. Kötü: "1932 yılında resmi olarak başlatıldı." (ne başlatıldı?) · İyi: "Türkiye'de ezan 1932'den 1950'ye kadar Türkçe okundu."
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
// Kod sadakat kontrolü (steps/fidelity.js): claim zaten "bu ad/sayı kaynakta yok: X".
const FIDELITY_KINDS = new Set(['name', 'number']);
const TITLE_LABEL = 'başlık metindeki olguyla aynı şeyi söylemiyor ya da bir terim yanlış çevrilmiş';

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
      if (FIDELITY_KINDS.has(c.kind)) return `- ${c.claim}${why ? ` (${why})` : ''}`;
      const label = c.kind === 'title' ? TITLE_LABEL : VERDICT_LABEL[c.verdict] ?? c.verdict;
      return `- "${c.claim}" (${label}${why ? `: ${why}` : ''})`;
    })
    .join('\n');
  return [
    { role: 'assistant', content: previousText || '(boş)' },
    {
      role: 'user',
      content:
        `Doğrulama şu iddiaları kancada ya da kaynak paragrafta bulamadı:\n${list}\n` +
        `${REPAIR_MARKER}: bu iddiaları çıkar ya da kancaya/kaynağa birebir uyacak şekilde düzelt. ` +
        'Yeni bilgi, yorum ya da genelleme ekleme. Sorunlu ifade başlıktaysa başlığı da düzelt: başlık gövdedeki olguyu ' +
        'söyleyen, yüklemli, doğal bir Türkçe cümle olsun; terimleri doğru çevir. Diğer cümlelere dokunma. ' +
        `Gövde ${sentenceRange(limits)} cümle kalmalı; aynı kurallar ve aynı JSON biçimi. ` +
        'Düzeltince ilginç bir kart kalmıyorsa {"skip":true,"reason":"..."} dön.',
    },
  ];
}

export const WRITE_SYSTEM_PROMPT = buildWriteSystemPrompt();
