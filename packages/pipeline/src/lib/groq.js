// src/lib/groq.js
// Groq SDK wrapper - ham kaynagi SmartScrolling fact kartina donusturur.
import Groq from 'groq-sdk';
import { evaluateFactMedia, normalizeFactMediaUrl } from './fact-media-policy.js';
import { deriveFactVisualKey } from './fact-visual-key.js';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const CATEGORY_MAP = {
  science: '\u{1F52C} B\u0130L\u0130M',
  history: '\u{1F4DC} TAR\u0130H',
  philosophy: '\u{1F9E0} FELSEFE',
  technology: '\u{1F4BB} TEKNOLOJ\u0130',
  health: '\u{1F331} SA\u011ELIK',
};

const CATEGORY_PROMPT_MAP = {
  science: `BILIM kartlari:
- once temel kavrami veya mekanizmayi acikla
- sonra neden onemli oldugunu anlat
- mumkunse bir gozlem, deney, kesif ya da sonuc bagla
- konu ansiklopedik degil, ogretici ve merak uyandirici hissettirmeli
- kaynakta yazmayan mekanizma, sonuc veya yorum ekleme`,
  history: `TARIH kartlari:
- once donemi, olay akisini veya ana aktoru netlestir
- neden-sonuc iliskisini kur
- uzun vadeli etkiyi veya donusumu anlat
- kart tek bir isim etiketi gibi degil, tarihsel baglam girisi gibi okunmali
- kaynakta acikca gecmeyen tarihsel yorum veya ek baglam uydurma`,
  philosophy: `FELSEFE kartlari:
- once temel fikri ya da problemi acikla
- sonra bu fikrin neden tartisildigini anlat
- mumkunse karsi gorus, sinir veya bugunku onemini ekle
- metin soyut ama anlasilir olmali; kullaniciyi daha derin okumaya tesvik etmeli
- kaynakta olmayan filozof yorumu, sonuc veya karsi gorus ekleme`,
  technology: `TEKNOLOJI kartlari:
- once ne oldugunu ve nasil calistigini anlat
- sonra neyi degistirdigini veya neden etkili oldugunu acikla
- mumkunse sinir, trade-off veya tarihsel kirilma noktasini ekle
- konu urun tanitimi gibi degil, ogretici analiz gibi okunmali
- kaynakta acikca bulunmayan teknik detay veya etki ekleme`,
  health: `SAGLIK kartlari:
- once mekanizmayi veya ana kavrami netlestir
- sonra etkisini, onemini ya da baglamini anlat
- sansasyonel veya kesin tibbi iddia gibi yazma
- dil sakin, guvenli ve bilgilendirici olmali
- kaynakta olmayan tibbi yorum, tavsiye veya kesinlik ekleme`,
};

const SOURCE_PROMPT_MAP = {
  wikipedia: `Wikipedia kartlari:
- her dogru ansiklopedi maddesi feed icin uygun degildir; sadece anlatmaya deger ve merak uyandiran konulari kartlastir
- kart bir ansiklopedi ozetine degil, anlatilabilir bir kesfe benzemeli
- konu cok lokal, dusuk etkili veya sadece "X bir koydur / Y bir politikacidir" seviyesindeyse title alanini bos birak
- proper noun kullanabilirsin ama tek basina isim yetmez; neden onemli oldugunu veya neden ilginc oldugunu acikca hissettir
- konu cok genis ve ders kitabi bolum basligi gibi kalıyorsa onu daha keskin bir aciya daralt; daraltamiyorsan title alanini bos birak
- bina, yol, secim bolgesi, kucuk yerlesim, siradan biyografi ve kuru istatistik konularini ancak acik bir tarihsel/bilimsel/kulturel onemi varsa kullan
- turizm, ekonomi, idari yerlesim, siradan kultur/eglence ve liste maddeleri feed icin zayifsa title alanini bos birak
- sayisal kiyas, "X kat", "en buyuk", "en eski", "ilk" gibi kesin iddialari yalnizca ham metinde acikca varsa yaz
- kaynakta net olmayan karsilastirmalari guvenli ve genel ifadeye cevir; kesin rakam uydurma`,
  nasa_apod: `NASA APOD kartlari:
- kart APOD aciklamasindaki gercek uzay olayina, goreve, nesneye veya gozleme sadik kalmali
- basligi fazla genelleme; kaynakta gecen gorev, teleskop, gok cismi veya ozel ismi korumaya calis
- kaynakta "Artemis II", "Arecibo", "ISS", "Centaurus A", "M13" gibi ayirt edici bir isim varsa bunu silme
- gorselin anlattigi olayi genel uzay bilgisine cevirmeyip ayni konu ekseninde tut
- kaynakta olmayan astronomi yorumu veya siirsel ekleme yapma
- kart bir gorsel aciklamasi gibi akmamali; kullaniciya ne gordugunu degil, neden ilginc oldugunu anlat
- Turkceyi sade, temiz ve dogal kur; teknik terim varsa bir cumle icinde anlasilir hale getir`,
  stanford_philosophy: `Stanford Encyclopedia of Philosophy kartlari:
- kavrami veya filozofu dogrudan ansiklopedik sadakatle anlat
- terimin teknik adini korumaya calis; konuyu baska bir felsefi akima kaydirma
- metni yorumlayip populerlestirirken akademik cekirdegi bozma
- kaynakta gecmeyen karsi gorus, ek filozof veya tarihsel baglam uydurma`,
  medlineplus: `MedlinePlus kartlari:
- saglik bilgisini sakin, acik ve kaynak sadakatiyle yaz
- tibbi tavsiye, sansasyon veya kesin yargi ekleme
- konu bir durum, sistem veya koruyucu saglik basligiysa ayni eksende kal
- cok genis bir saglik dersi basligi gibi yazma; kullaniciya ilk cumlede somut bir ogrenme odulu ver
- kaynakta olmayan risk, tedavi veya klinik sonuc uydurma`,
  pdf_curated: `PDF curated kartlari:
- kaynak zaten Turkce aciklayici ve populer-bilim tonunda olabilir; senin gorevin onu uygulamaya uygun, daha temiz ve daha akici hale getirmek
- basligi varsayilan olarak kaynakta oldugu gibi koru; title alanina kaynak basligini aynen yaz
- ancak baslik bos, kirik veya acikca kullanilamaz durumdaysa daha temiz bir baslik uret
- metni salt ozetleme; icinden en merak uyandiran aciyi sec
- fazla tekrar, uzun dolambacli anlatim ve gereksiz yan detaylari at
- kart "bunu neden bileyim?" sorusuna net cevap vermeli
- kaynakta verilen ilgi cekici sayi, tarih veya donum noktasi varsa mumkunse koru
- kaynakta olmayan yeni iddia ekleme`,
};

const ALLOWED_CATEGORIES = new Set(Object.values(CATEGORY_MAP));
const LOW_QUALITY_TITLE_PATTERNS = [/\bkimdir\b/i, /\bnedir\b/i, /\bnasil\b/i, /\?$/];
const TITLE_ALIGNMENT_STOPWORDS = new Set([
  'bir',
  've',
  'ile',
  'icin',
  'olan',
  'olarak',
  'neden',
  'nedir',
  'nasil',
  'gibi',
  'daha',
  'cok',
  'ile',
  'the',
  'of',
  'and',
  'in',
  'to',
]);

function wordCount(text) {
  return (text ?? '').trim().split(/\s+/).filter(Boolean).length;
}

function normalizeKeywordToken(token) {
  return token
    .normalize('NFD')
    .replaceAll(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replaceAll(/[^a-z0-9]/g, '')
    .trim();
}

function extractTitleKeywords(title) {
  return [
    ...new Set(
      (title ?? '')
        .split(/\s+/)
        .map((token) => normalizeKeywordToken(token))
        .filter((token) => token.length >= 4 && !TITLE_ALIGNMENT_STOPWORDS.has(token)),
    ),
  ];
}

function hasTitleContentAlignment(title, content) {
  const keywords = extractTitleKeywords(title);

  if (keywords.length === 0) {
    return true;
  }

  const normalizedContent = normalizeKeywordToken(content ?? '');
  const matched = keywords.filter((keyword) => normalizedContent.includes(keyword));
  return matched.length >= Math.min(2, keywords.length);
}

function normalizeCategoryHint(categoryHint) {
  if (typeof categoryHint !== 'string') {
    return 'science';
  }

  const normalized = categoryHint.trim().toLowerCase();
  return CATEGORY_MAP[normalized] ? normalized : 'science';
}

function normalizeCategory(parsedCategory, categoryHint) {
  const trimmed = typeof parsedCategory === 'string' ? parsedCategory.trim() : '';

  if (ALLOWED_CATEGORIES.has(trimmed)) {
    return trimmed;
  }

  return CATEGORY_MAP[normalizeCategoryHint(categoryHint)];
}

function normalizeTags(tags) {
  if (!Array.isArray(tags)) {
    return [];
  }

  return tags
    .filter((tag) => typeof tag === 'string')
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 5);
}

function normalizeTitle(title) {
  if (typeof title !== 'string') {
    return '';
  }

  return title.replace(/\s+/g, ' ').trim();
}

function toSentenceCase(text) {
  if (!text) {
    return '';
  }

  return text.charAt(0).toLocaleUpperCase('tr-TR') + text.slice(1);
}

function derivePdfCuratedFallbackTitle(sourceTitle) {
  const normalizedSourceTitle = normalizeTitle(sourceTitle)
    .replace(/^\d+(?:\.\d+)?\s*/u, '')
    .trim();

  if (!normalizedSourceTitle) {
    return '';
  }

  return toSentenceCase(normalizedSourceTitle);
}

function detectSourceKind(sourceLabel) {
  const normalized = typeof sourceLabel === 'string' ? sourceLabel.toLowerCase() : '';

  if (normalized.includes('wikipedia')) {
    return 'wikipedia';
  }

  if (normalized.startsWith('nasa apod')) {
    return 'nasa_apod';
  }

  if (normalized.includes('stanford encyclopedia')) {
    return 'stanford_philosophy';
  }

  if (normalized.includes('medlineplus')) {
    return 'medlineplus';
  }

  if (normalized.includes('luzumsuz bilgiler ansiklopedisi')) {
    return 'pdf_curated';
  }

  return 'generic';
}

function normalizeFactPayload(
  parsed,
  categoryHint,
  sourceLabel,
  sourceUrl,
  imageUrl,
  sourceTitle,
  sourceExcerpt,
) {
  const sourceKind = detectSourceKind(sourceLabel);
  const isPdfCurated = sourceKind === 'pdf_curated';
  const normalizedTitle = normalizeTitle(
    parsed.title || (isPdfCurated ? derivePdfCuratedFallbackTitle(sourceTitle) : ''),
  );
  const normalizedCategory =
    sourceKind === 'wikipedia'
      ? CATEGORY_MAP[normalizeCategoryHint(categoryHint)]
      : normalizeCategory(parsed.category, categoryHint);
  const normalizedContent = typeof parsed.content === 'string' ? parsed.content.trim() : '';
  const normalizedTags = normalizeTags(parsed.tags);
  const visualKey = deriveFactVisualKey({
    sourceLabel,
    category: normalizedCategory,
    title: normalizedTitle,
    tags: normalizedTags,
    sourceTitle,
    content: normalizedContent,
  });
  const mediaPolicy = evaluateFactMedia({
    sourceLabel,
    mediaUrl: imageUrl,
  });
  const normalizedMediaUrl = normalizeFactMediaUrl(imageUrl);

  return {
    title:
      !isPdfCurated && LOW_QUALITY_TITLE_PATTERNS.some((pattern) => pattern.test(normalizedTitle))
        ? ''
        : normalizedTitle,
    content: normalizedContent,
    category: normalizedCategory,
    tags: normalizedTags,
    read_time_sq: parsed.read_time_sq ?? 15,
    source_url: sourceUrl,
    source_label: sourceLabel,
    verified: true,
    media_url: mediaPolicy.ok ? normalizedMediaUrl || null : null,
    visual_key: visualKey,
    published_at: new Date().toISOString().split('T')[0],
    _category_hint: categoryHint,
    _source_title: sourceTitle ?? '',
    _source_kind: sourceKind,
    _source_excerpt: typeof sourceExcerpt === 'string' ? sourceExcerpt.slice(0, 400) : '',
    _media_policy_reason: mediaPolicy.reason,
  };
}

function extractFailedGeneration(err) {
  if (!err?.message) {
    return null;
  }

  try {
    const parsed = JSON.parse(err.message);
    return typeof parsed?.error?.failed_generation === 'string'
      ? parsed.error.failed_generation
      : null;
  } catch {
    return null;
  }
}

async function requestFactJson(systemPrompt, userPrompt) {
  const response = await groq.chat.completions.create({
    model: 'llama-3.1-8b-instant',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.35,
    max_tokens: 900,
    response_format: { type: 'json_object' },
  });

  const raw = response.choices[0]?.message?.content;
  if (!raw) {
    return null;
  }

  return JSON.parse(raw);
}

async function repairFailedGeneration(failedGeneration, categoryHint) {
  const repairSystemPrompt = `Sen bozuk JSON'u gecerli JSON'a ceviren bir duzeltme katmanisin.
Sadece gecerli bir JSON objesi dondur.
Anahtarlar: title, content, category, tags, read_time_sq
Kurallar:
- JSON disinda hicbir sey yazma
- Icerikte cift tirnak kullanma, gerekiyorsa alintiyi kaldir
- category su degerlerden biri olmali: "${CATEGORY_MAP.science}", "${CATEGORY_MAP.history}", "${CATEGORY_MAP.philosophy}", "${CATEGORY_MAP.technology}", "${CATEGORY_MAP.health}"
- tags bir string array olmali
- read_time_sq sayi olmali`;

  const repairUserPrompt = `Kategori ipucu: ${normalizeCategoryHint(categoryHint)}
Asagidaki bozuk veya eksik JSON taslagini gecerli JSON'a cevir:
---
${failedGeneration}
---`;

  try {
    return await requestFactJson(repairSystemPrompt, repairUserPrompt);
  } catch (repairErr) {
    console.error('[Groq] JSON repair hatasi:', repairErr.message);
    return null;
  }
}

async function requestFactJsonWithRecovery(systemPrompt, userPrompt, categoryHint) {
  try {
    return await requestFactJson(systemPrompt, userPrompt);
  } catch (err) {
    const failedGeneration = extractFailedGeneration(err);

    if (failedGeneration) {
      const repaired = await repairFailedGeneration(failedGeneration, categoryHint);

      if (repaired) {
        console.warn('[Groq] failed_generation recover edildi.');
        return repaired;
      }
    }

    throw err;
  }
}

function getCategoryPromptGuidance(categoryHint) {
  const normalized = normalizeCategoryHint(categoryHint);
  return CATEGORY_PROMPT_MAP[normalized] ?? CATEGORY_PROMPT_MAP.science;
}

function getSourcePromptGuidance(sourceLabel) {
  const sourceKind = detectSourceKind(sourceLabel);
  return SOURCE_PROMPT_MAP[sourceKind] ?? '';
}

function isWikipediaGroqContextPilotEnabled() {
  return process.env.WIKIPEDIA_GROQ_CONTEXT_PILOT !== '0';
}

function isGroqRateLimitError(err) {
  const message = String(err?.message ?? '').toLowerCase();
  return err?.status === 429 || message.includes('rate_limit_exceeded') || message.includes('rate limit reached');
}

function buildWikiContextBlock(wikiContext) {
  if (!isWikipediaGroqContextPilotEnabled() || !wikiContext) {
    return '';
  }

  const categories = Array.isArray(wikiContext.categories)
    ? wikiContext.categories.slice(0, 4).join(', ')
    : '';

  return [
    '',
    'Wikipedia enrichment:',
    `- canonicalTitle: ${wikiContext.canonicalTitle || 'yok'}`,
    `- normalizedCategory: ${wikiContext.normalizedCategory || 'yok'}`,
    `- description: ${wikiContext.description || 'yok'}`,
    `- summary: ${(wikiContext.summary || '').slice(0, 360) || 'yok'}`,
    `- categorySignals: ${categories || 'yok'}`,
  ].join('\n');
}

function buildSourceContext(rawText, sourceTitle, categoryHint, sourceLabel, wikiContext) {
  const trimmedRawText = (rawText ?? '').trim();
  const excerptPreview = trimmedRawText.split(/\n+/).slice(0, 2).join(' ').slice(0, 420);
  const notableHints = [];

  if (
    /\b(first|oldest|earliest|discovery|invention|revolution|empire|dynasty)\b/i.test(
      trimmedRawText,
    )
  ) {
    notableHints.push('kirilma noktasi veya ilk olma sinyali');
  }

  if (/\b(because|therefore|thus|neden|nasil|sonuc|etki)\b/i.test(trimmedRawText)) {
    notableHints.push('neden-sonuc veya mekanizma sinyali');
  }

  if (/\b(today|modern|gunumuz|bugun|hala)\b/i.test(trimmedRawText)) {
    notableHints.push('bugune baglanan onem hissi');
  }

  return [
    `Kaynak basligi: ${sourceTitle || 'yok'}`,
    `Kaynak tipi: ${sourceLabel || 'bilinmiyor'}`,
    `Kategori ipucu: ${normalizeCategoryHint(categoryHint)}`,
    `Kaynak ozeti: ${excerptPreview || 'yok'}`,
    `Notability sinyali: ${notableHints.join('; ') || 'belirgin sinyal yok'}`,
    buildWikiContextBlock(wikiContext),
  ].join('\n');
}

/**
 * Ham metni Groq ile fact kartina donusturur.
 * @param {string} rawText
 * @param {string} sourceLabel
 * @param {string} sourceUrl
 * @param {string} categoryHint
 * @param {string} imageUrl
 * @returns {Promise<object|null>}
 */
export async function convertToFact(
  rawText,
  sourceLabel,
  sourceUrl,
  categoryHint,
  imageUrl,
  sourceTitle = '',
  options = {},
) {
  const categoryGuidance = getCategoryPromptGuidance(categoryHint);
  const sourceGuidance = getSourcePromptGuidance(sourceLabel);
  const normalizedCategoryHint = normalizeCategoryHint(categoryHint);
  const sourceKind = detectSourceKind(sourceLabel);
  const rawTextLimit = sourceKind === 'wikipedia' ? 2600 : 5000;
  const sourceContext = buildSourceContext(
    rawText,
    sourceTitle,
    normalizedCategoryHint,
    sourceLabel,
    options.wikiContext,
  );

  const systemPrompt = `Sen SmartScrolling adli Turkce bir bilgi ve egitim uygulamasi icin uzman icerik kuratorusun.
Gorevin: Sana verilen ham metni kullaniciya gercekten degerli, aciklayici ve merak uyandiran bir "Hap Bilgi" kartina donusturmektir.
Senin kartin kullanicida su hissi yaratmali: "Bunu bilmiyordum", "Bu neden boyleymis?", "Bunu birine anlatabilirim."
Sen bir yorumcu degilsin; yalnizca kaynakta acikca desteklenen bilgiyi daha okunur, dogal ve anlatilabilir Turkceyle yeniden ifade edersin.

CIKTI KURALLARI:
- Yanitin sadece gecerli bir JSON objesi olmali.
- title: Soru cumlesi degil, dogrudan anlamli bilgi basligi olmali. "Kimdir?", "Nedir?", "Nasil?" gibi kaliplarla bitmemeli. Maksimum 58 karakter.
- title: Yapay dramatizasyon, clickbait veya ansiklopedi maddesi etiketi gibi durmamali.
- title: Genel ders kitabi basligi gibi kalmamali. Baslik somut bir aci, mekanizma, kirilma noktasi veya sasirtici baglam hissettirmeli.
- title: Eger konu feed icin dusuk degerliyse veya gercekten ilgi cekici bir aci bulunamiyorsa title alanini BOS birak.
- content: 120-160 kelimelik, 5-6 cumlelik, temiz Turkce ile yazilmis aciklayici bir metin olmali.
- content: Ilk cumlede kullanicinin neden ilgilenmesi gerektigini hissettir.
- content: Ikinci cumlede basligin acmis oldugu bilgiyi dogrudan cevapla.
- content: Sonraki cumlelerde baglam, neden onemli oldugu veya neyi degistirdigi netlesmeli.
- content: Metin icinde cift tirnak kullanmaktan kacin. Eser veya kavram adlarini dogrudan acikla.
- category: Yalnizca su kategorilerden biri olmali: "${CATEGORY_MAP.science}", "${CATEGORY_MAP.history}", "${CATEGORY_MAP.philosophy}", "${CATEGORY_MAP.technology}", "${CATEGORY_MAP.health}"
- tags: 3-5 adet kisa etiket olmali.
- read_time_sq: 15 ile 28 arasinda tahmini okuma suresi.

EK KALITE KURALLARI:
- Kaynakta olmayan bilgi ekleme.
- Kaynakta yazmayan yorum, varsayim, cikarsama veya genelleme ekleme.
- Emin olmadigin hicbir seyi yazma; kaynakta acik degilse atla.
- Karttaki her iddia ham metindeki bilgiyle eslesmeli.
- Konuyu baska bir yone kaydirma.
- Fazla genel, anlamsiz veya clickbait baslik uretme.
- Ilk cumlede kullaniciya neden okumaya deger oldugunu hissettir; kart devamini merak ettirmeli.
- Turkce dogal olmali; kirik ceviri, tekrar eden cumle yapisi, ayni fikri iki kez soyleme veya anlamsiz kelime secimleri kabul edilmez.
- Turkce karakterleri dogru kullan: ç, ğ, ı, İ, ö, ş, ü. ASCII'ye kacma.
- Kart "ansiklopedi paragrafi" gibi degil, anlatilabilir bir kesif gibi okunmali.
- Kullanici "Bunu neden bileyim?" diye sorarsa kart bu soruya dolayli da olsa cevap vermeli.
- Baslik ne vaad ediyorsa ilk iki cumlede onu gercekten karsila; baslik-icerik uyumsuzlugu kabul edilmez.
- Ham kaynak urun icin zayifsa bunu "daha iyi" gostermeye calisma; bunun yerine title alanini bos birak ve kartin quality gate'den dusmesine izin ver.
- Kart konunun kendisi gibi davranmamali; kullanicida "kaynagina da bakayim" hissi uyandirmali.
- Kategori bos birakilamaz.

KATEGORIYE OZEL YAZIM YONLENDIRMESI:
${categoryGuidance}

KAYNAGA OZEL YAZIM YONLENDIRMESI:
${sourceGuidance || '- ek kaynak yonlendirmesi yok'}

ORNEK BASLIK YAKLASIMI:
- Kotu: "X Nedir?"
- Kotu: "Y Kimdir?"
- Iyi: "Budizm'in Dukkha Fikri"
- Iyi: "Robert Goddard ve Sivi Yakitli Roket"
- Iyi: "M13'e Gonderilen Arecibo Mesaji"

KARTI REDDETME KURALI:
- Eger kaynak sadece dusuk degerli, anlamsiz derecede lokal, kuru biyografik ya da "neden onemli oldugu" kurulamayacak bir bilgi veriyorsa title alanini bos birak.
- Eger temiz ve dogal Turkceyle anlatilabilir bir kart cikmiyorsa title alanini bos birak.`;

  const userPrompt = `Kategori ipucu: ${normalizedCategoryHint}
Kaynak baglami:
${sourceContext}

Ham metin:
---
${rawText.slice(0, rawTextLimit)}
---
Detayli hap bilgi JSON'unu uret.`;

  try {
    const firstPass = await requestFactJsonWithRecovery(
      systemPrompt,
      userPrompt,
      normalizedCategoryHint,
    );

    if (!firstPass) {
      return null;
    }

    let fact = normalizeFactPayload(
      firstPass,
      normalizedCategoryHint,
      sourceLabel,
      sourceUrl,
      imageUrl,
      sourceTitle,
      rawText,
    );

    if (wordCount(fact.content) < 95 || !hasTitleContentAlignment(fact.title, fact.content)) {
      const retryPrompt = `Ilk denemede icerik cok kisa, yuzeysel veya Turkce olarak zayif kaldi.
Asagidaki ham kaynaga tekrar bak ve bu kez ayni konuyu DAHA TEMIZ, DAHA DOGAL TURKCEYLE ve yine kisa kalacak sekilde anlat.

KURALLAR:
- Baslik yine soru cumlesi olmasin.
- Icerik 120-160 kelime araliginda kalsin.
- Konunun baglamini, neden onemli oldugunu ve ana sonucu daha acik anlat.
- Ilk iki cumle basligin vaadini dogrudan karsilasin.
- Ilk cumlede kullaniciya neden okumaya deger oldugunu hissettir.
- Ayni fikri tekrar etme.
- Genel ders kitabi anlatimi gibi kalma; daha keskin ve daha anlatilabilir bir aci sec.
- Cumleleri duz ve dogal Turkce kur.
- Turkce karakterleri dogru kullan: ç, ğ, ı, İ, ö, ş, ü.
- Metin icinde cift tirnak kullanma.
- Kaynaktan sapma ve uydurma bilgi ekleme.
- Yorum yapma; sadece kaynakta desteklenen bilgiyi daha acik anlat.
- Su kategori yazim yonlendirmesine sadik kal:
${categoryGuidance}

Ham metin:
---
${rawText.slice(0, rawTextLimit)}
---

Kaynak baglami:
${sourceContext}

Ilk deneme:
${JSON.stringify(firstPass)}

Sadece yeni JSON objesini uret.`;

      const secondPass = await requestFactJsonWithRecovery(
        systemPrompt,
        retryPrompt,
        normalizedCategoryHint,
      );

      if (secondPass) {
        fact = normalizeFactPayload(
          secondPass,
          normalizedCategoryHint,
          sourceLabel,
          sourceUrl,
          imageUrl,
          sourceTitle,
          rawText,
        );
      }
    }

    return fact;
  } catch (err) {
    if (isGroqRateLimitError(err)) {
      console.error('[Groq] Rate limit nedeniyle donusturme durduruldu:', err.message);
      return { _conversion_failed: true, _conversion_reason: 'rate_limit' };
    }

    console.error('[Groq] Donusturme hatasi:', err.message);
    return null;
  }
}
