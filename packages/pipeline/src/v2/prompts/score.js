// src/v2/prompts/score.js
// Puanlayıcı (scorer) istemi. Çıktı KISA ANAHTARLI tek satır JSON:
//   {"items":[{"i":1,"s":7,"r":6,"d":0,"c":"TARİH","w":"kısa gerekçe"}]}
//   i = kanca no, s = surprise, r = tr_relevance, d = is_definition (0/1), c = kategori adı (emojisiz),
//   w = gerekçe, SADECE s ≥ 6 olanlarda, en fazla 6 kelime.
//   x = hassas (V2-05f): SADECE hassassa "x":1 yazılır; değilse alan yok (çıktı token'ı artmaz).
//       Hassas = odak ölüm/şiddet/trajedi ya da güncel siyaset (siyasi figür/parti/seçim, terör, savaş,
//       cinayet, intihar, felaket ölümleri, yakın tarihli ölüm) → rejected:sensitive. V2-15: bazı
//       konular tarihten bağımsız hassas (istem metnine bak); hayvan ölümü/uzak tarih değil.
//       İstem ≈ +90 token, V2-15 ile ≈ +110 daha.
// Neden: Groq qwen3.8-27b'nin dakikalık çıktı sınırı (OTPM) 1000 token. Eski uzun anahtarlı çıktı
// 15 kancada ≈ 1.180 token yazdı (dry-run 3) ve ikinci batch 429 ile düştü.
// Tahmini token (batch = 10 kanca): sistem ~560, kanca başına ~30 girdi → ≈ 860 girdi.
// Çıktı: gerekçesiz öğe ≈ 22, gerekçeli ≈ 40 token; kancaların ~%35'i s ≥ 6 → ≈ 10×22 + 4×18 + 10
// ≈ 300 (en kötü durum, hepsi gerekçeli: ≈ 410). Hedef ≤ 400 / batch.
// Sınır: config roles.scorer.maxTokens (600; OTPM 1000'in altında). Qwen3 düşünme modu config'te
// kapalı (Groq reasoning_effort=none); <think> blokları LLM katmanında yine ayıklanır.
// Tahmin: Türkçe ~3,2-3,5, İngilizce ~4 karakter/token.
import { CATEGORIES } from '../steps/common.js';

/** config.roles.scorer.maxTokens yoksa kullanılır. */
export const SCORE_MAX_TOKENS = 600;

/** İstemde emojisiz kategori adları (normalizeCategory bunları 8 sabit değere çevirir). */
export const CATEGORY_NAMES = Object.freeze(
  CATEGORIES.map((c) =>
    c
      .replace(/^[^\p{L}]+/u, '')
      .split(' & ')[0]
      .trim(),
  ),
);

const SYSTEM = `Türk okur için bilgi kartı adaylarını puanlıyorsun. Hedef tepki: "Aa, bunu bilmiyordum, ne garipmiş!"
Her kanca (TR ya da EN) için kısa anahtarlarla:
- s (surprise) 0-10: sıradan okuru ne kadar şaşırtır? Yüksek: zıtlık, rekor, beklenmedik bağlantı, yaygın yanlış bilinen gerçek. Düşük: bilinen, beklenen ya da sıradan bilgi; "X şunu tedavi eder / şunu yapar / şurada kullanılır" türü ürün-yöntem-kurum açıklaması; "eser filme uyarlandı", "kişi şu ödülü aldı" türü olağan haber.
- r (tr_relevance) 0-10: Türk okur anlar ve ilgilenir mi? Çok yerel/niş (küçük kasaba yöneticisi, alt lig oyuncusu) düşük.
- d (is_definition): kanca sadece "X nedir / kimdir / nerededir / ne işe yarar" bilgisiyse 1, değilse 0.
- c (kategori): ${CATEGORY_NAMES.join(', ')}
  İpucu: dizi/TV/film/roman/öykü/şiir/opera → SANAT; edebiyat/müzik/sanat eseri ve kelime kökeni/dil → SANAT; hayvan/bitki → BİLİM; matematik → BİLİM; hava olayı/afet → BİLİM ya da TARİH, asla SAĞLIK; sporcu hakkındaki kart → SPOR; SAĞLIK sadece tıp/hastalık/beslenme; BİYOGRAFİ sadece odak bir kişinin hayatıysa; yer/şehir/park → TARİH ya da en uygun olan; şirket/marka/mağaza/ürün tarihi → TARİH (TEKNOLOJİ sadece bilişim, yazılım, cihaz, mühendislik buluşu).
- w (gerekçe): SADECE s 6 ve üstüyse, en fazla 6 kelime; s 6'nın altındaysa w yazma.
- x (hassas): odak ölüm/şiddet/trajedi ya da güncel siyasetse (siyasi figür/parti/seçim, terör, savaş, cinayet, idam/infaz, intihar, felaket ölümleri, yakın tarihli ölüm) "x":1 yaz; değilse x yazma. Ayrıca hassas: din ve kutsal figürler etrafındaki tartışma/tasvir/sansür, ibadetle ilgili devlet politikası (ör. ezan dili); etnik/dil siyaseti, ırkçılık, antisemitizm; darbe/cunta; Türkiye siyasi figürleri (cumhurbaşkanı, başbakan, parti liderleri; ölmüş olsalar bile). Tarihten bağımsız hassas (x:1): çok ölümlü kaza/felaket/afet · Etnik/dinî gruba yönelik şiddet, pogrom, katliam · kişiye yönelik şiddet ve öldürme anlatısı · insan ölümlerinin konunun merkezinde olduğu doğa olayları · Dinî metinlerin kökeni/doğruluğu iddiaları, ölüm kültleri, inanç pratikleri · Silahlar, kürtaj, güncel ABD/İsrail-Filistin siyaseti · Çocuk yaşta evlilik · yaşayan kurum/gazeteye ya da tarihî Türk figürüne siyasi itham. Hayvan ölümü ve uzak tarih (Bizans, Osmanlı) tek başına hassas değil.
  Örnek: "Charlie Kirk'ün yüzü suikastinin ardından memelere yerleştirildi" → x:1 · "Saddam Hüseyin idam edildi, Libya yas ilan etti" → x:1 · "Türkçe ezan 1932–1950 arasında okundu" → x:1 · "Bookland, barkodlara göre kitapların geldiği hayali ülke" → x yok · "Kanlı Kilise, Fatih'te camiye çevrilmeyen tek Bizans kilisesi" → x yok
Kalibrasyon (s/r):
ÇOK İLGİNÇ
- "Ahtapotun üç kalbi ve mavi kanı vardır." 9/8
- "Kleopatra, piramitlerin yapımından çok Ay'a inişe daha yakın bir zamanda yaşadı." 10/8
- "Oxford Üniversitesi, Aztek İmparatorluğu'ndan daha eskidir." 9/7
- "Vikingler boynuzlu miğfer takmazdı; bu imaj 19. yüzyıl operasından gelir." 8/7
SIKICI / TANIM / SIRADAN
- "Paris, Fransa'nın başkentidir." 1/5, d=1
- "Kafaya elektrik veren bir cihaz kaygı ve uykusuzluk tedavisinde kullanılabilir." 3/5
- "Ünlü bir oyun iki kez filme uyarlandı ve Broadway'de yeniden sahnelendi." 3/4
- "John Smith 1950-1954 arasında Ohio'da bir kasabanın belediye başkanıydı." 2/1
- "Fotosentez, bitkilerin ışıkla besin üretmesidir." 1/6, d=1
Emin değilsen düşük puan ver; 6 ve üstü gerçekten şaşırtıcı olanlara.
Sadece tek satır JSON dön, boşluksuz: {"items":[{"i":1,"s":3,"r":5,"d":0,"c":"${CATEGORY_NAMES[0]}"},{"i":2,"s":8,"r":7,"d":0,"c":"${CATEGORY_NAMES[1]}","w":"yaygın inanışın tersi"}]}`;

/**
 * @param {Array<{ id: number, lang?: string, hook: string }>} items  kısa sayısal id'ler
 * @returns {{ messages: Array<{role:string, content:string}> }}
 */
export function buildScorePrompt(items) {
  const lines = items.map(
    (it) => `${it.id} [${it.lang || 'en'}] ${String(it.hook).replace(/\s+/g, ' ').trim()}`,
  );
  return {
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: `Kancalar:\n${lines.join('\n')}` },
    ],
  };
}

export const SCORE_SYSTEM_PROMPT = SYSTEM;
