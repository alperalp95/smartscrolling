# İçerik Hattı v2 — "Aa, bunu bilmiyordum!" kart fabrikası

**Durum:** Taslak, kullanıcı onayı bekliyor · **Yazan:** Atlas · **Tarih:** 2026-11-20
**Dayanak:** `board/logs/R-04.md`, `P-01.md`, `P-02.md`, `P-03.md`

## 1. Neden
Bugünkü hat günde en fazla ~16 Wikipedia kartı üretebiliyor (fiilen Ağustos'ta 1–4/gün). 12 Ağustos'tan beri hiç kart üretmiyor:
- Groq, kullanılan `llama-3.1-8b-instant` modelini 2026-08-16'da kapattı.
- GitHub zamanlanmış workflow'u hareketsizlik nedeniyle kapattı.

Kartlar "X nedir / X kimdir" tarzında. Bunun üç nedeni var:
- Modele maddenin sadece tanım paragrafı veriliyor.
- Konu listesi elle yazılmış genel başlıklardan oluşuyor (Messi, Atatürk…).
- Şaşırtıcılığı ölçen bir adım yok.

Olgu hatası örneği de var: "Üre Kanseri".

## 2. Hedefler
| # | Hedef | Ölçüt |
|---|---|---|
| H1 | Okuyunca "aa, bilmiyordum" dedirten kart | Puanlayıcı skoru ≥ eşik; haftalık 10 kartlık örnekte kullanıcı onayı ≥ 8/10 |
| H2 | Hacim | İlk birikim döneminde ≥100 kart/gün; sonrasında sürdürülebilir 30–50 kart/gün |
| H3 | Doğruluk | Yayınlanan her kart iddia bazlı doğrulamadan geçmiş; haftalık örnekte olgu hatası 0 |
| H4 | Tekrar yok | Aynı bilginin farklı cümlelerle ikinci kartı yayınlanmaz |
| H5 | Maliyet | **0 $** (sadece ücretsiz tier'lar) |
| H6 | Sağlıklı döngü | Hat sessizce durmaz: kart üretilmeyen gün kullanıcıya bildirim gider |

**Kapsam dışı:**
- Kitap hattı
- Mobil arayüz değişiklikleri
- Mevcut 713 kartın yeniden yazımı (ayrı iş)
- Telif konusu (ayrı karar, bkz. §12)

## 3. Ana fikir: "kanca-önce"
Konu seçip ondan ilginç bir şey çıkarmaya çalışmıyoruz. **Zaten ilginç olarak seçilmiş bilgiden (kanca) başlıyoruz.** Modele makalenin tamamı değil, sadece kancayı destekleyen paragraf verilir.

## 4. Kaynaklar
| Kod | Kaynak | Hacim | Lisans | Faz |
|---|---|---|---|---|
| S1 | EN Wikipedia "Did you know" arşivi ([HF veri seti](https://huggingface.co/datasets/derenrich/enwiki-did-you-know), 97.015 kanca + görüntülenme sayısı) | Tek seferlik 97K | CC BY-SA 4.0 | 1 |
| S2 | EN Wikipedia "Did you know" yeni kancalar (`Wikipedia:Recent_additions`) | ~16–18/gün | CC BY-SA 4.0 | 1 |
| S3 | TR Vikipedi "Biliyor muydunuz?" arşivi + yeniler | Az, ama doğrudan Türkçe | CC BY-SA 4.0 | 1 |
| S4 | "List of common misconceptions" (3 alt liste) + "Unusual articles" | Birkaç bin, sabit | CC BY-SA 4.0 | 1 |
| S5 | Wikidata rekor şablonları (en eski / en küçük / ilk…) | Neredeyse sınırsız | CC0 | 2 |

- Eski hat emekliye ayrılır: TR Wikipedia seed listesi ve "Lüzumsuz Bilgiler" PDF yedeği.
- "Lüzumsuz Bilgiler" telif kararına kadar yeni hatta dahil edilmez.
- Kaynak İngilizceyse model İngilizce okur, Türkçe yazar. Ayrı bir çeviri adımı yoktur.
- Kartlar çeviri değil, kendi cümleleriyle yazılmış özgün metindir.

## 5. Akış
```
Topla ─► [aday havuzu] ─► Tekrar-1 ─► Puanla (toplu) ─► eşik ─► Kaynak paragrafı çek
      ─► Türkçe yaz ─► Tekrar-2 ─► Doğrula ─► [yayın stoğu] ─► Yayınla (günlük N)
```
1. **Topla:** Kaynaklardan kancalar `fact_candidates` tablosuna `new` durumunda girer. Her adayın kalıcı bir `source_key`'i olur (ör. `enwiki-dyk:2019-03-14:3`).
2. **Tekrar-1 (ucuz):** `source_key` daha önce görüldüyse ya da kanca metninin hash'i aynıysa aday elenir. Ardından embedding benzerliği tüm kartlara ve adaylara karşı ölçülür (§7).
3. **Puanla:** Tek çağrıda 10–20 aday. Her aday için 0–10 arası puanlar verilir:
   - `surprise`: şaşırtıcılık
   - `tr_relevance`: Türk okur için ilgi
   - `is_definition`: "X nedir/kimdir" cezası
   - `category`

   Puanlayıcı, S1'in görüntülenme sayılarıyla kalibre edilir: en çok ve en az görüntülenen kancalar few-shot örnek olarak kullanılır. Eşik config'tedir (varsayılan: en iyi ~%30).
4. **Kaynak paragrafı çek:** Kancanın kalın linkli makalesinden, kancayı destekleyen 1–2 paragraf alınır (en fazla ~1.500 karakter).
5. **Türkçe yaz:** 1 kart = başlık (12–58 karakter) + 3–5 cümle gövde + kategori. Kurallar:
   - "Kaynakta olmayanı ekleme."
   - Türkçe karakter zorunlu.
   - Kart tanımla başlamaz, şaşırtıcı noktayla başlar.
6. **Tekrar-2:** Bitmiş kart, embedding ile tüm yayınlanmış kartlara karşı ölçülür (§7).
7. **Doğrula:** Yazardan **farklı aile** bir model kartı iddialara böler. Her iddia kaynak paragrafa karşı `destekleniyor / desteklenmiyor / belirsiz` diye işaretlenir.
   - Tek bir "desteklenmiyor" varsa kart reddedilir.
   - "Belirsiz" varsa kart bir kez yeniden yazılır, olmazsa reddedilir.
   - `verified=true` artık sadece bu adımı geçen kartlarda olur.
8. **Yayın stoğu:** Geçen kartlar `queued` durumunda bekler. Günlük yayın adedi config'tedir.
   - Üretim bir gün aksarsa akış stoktan beslenmeye devam eder.
   - Stok hedefi en az 7 günlük kart.
9. **Yayınla:** Kartlar `published` olur. Kategori dengesi için yayın sırasında basit bir kota uygulanır.

## 6. Modeller (0 $) — rol başına birincil + yedek
| Rol | Birincil | Yedek | Aile |
|---|---|---|---|
| Puanlayıcı | Groq `qwen/qwen3.8-27b` | Cloudflare `@cf/qwen/qwen3-30b-a3b-fp8` | Alibaba |
| Yazar | Groq `openai/gpt-oss-120b` + `openai/gpt-oss-20b` (yük ikiye bölünür) | Cloudflare `@cf/openai/gpt-oss-20b` | OpenAI |
| Doğrulayıcı | Cloudflare `@cf/google/gemma-4-26b-a4b-it` | Gemini API free (Flash-Lite / Gemma 4) | Google |
| Embedding | Cloudflare `@cf/baai/bge-m3` (çok dilli, 1024 boyut) | GitHub Actions içinde yerel `multilingual-e5-small` | — |

**Limitler** (resmi sayfalar, 2026-11-20):
- Groq: her model için 30 istek/dk, 1.000 istek/gün, 200K token/gün.
- Cloudflare: 10.000 Neuron/gün.
- Hafif senaryoda en dar kova yazar: Groq'un iki modeli ~%85 dolu.

**Kurallar:**
- Model adları, sıralar, günlük üst sınırlar ve eşikler **tek bir config dosyasında** tutulur: `packages/pipeline/config/pipeline.config.json`. Kod bilmeyen biri düzenleyebilir; README'de açıklanır.
- Sağlayıcı katmanı OpenAI-uyumlu tek bir arayüzdür. Groq, Cloudflare ve Gemini yalnızca adaptördür. Model değiştirmek kod değil, config değişikliğidir.

## 7. Tekrar önleme (4 katman)
1. **Kaynak kimliği:** `source_key` için unique index; aynı kanca ikinci kez işlenmez.
2. **Metin parmak izi:** Normalize edilmiş metnin (küçük harf, noktalama ve boşluk temizlenmiş) sha256'sı; unique.
3. **Anlam benzerliği:** pgvector + `bge-m3` embedding. Karşılaştırma **tüm** kartlara karşı yapılır (HNSW index; `limit(1000)` yok).
   - Cosine ≥ 0,92 → tekrar, elenir.
   - 0,85–0,92 → gri bölge.
4. **Hakem:** Gri bölgedeki çiftlere ucuz model "aynı olgu mu, aynı konuda farklı olgu mu?" diye sorulur. Aynı konudaki farklı olgu geçer.

Mevcut 713 kartın embedding'i bir kerelik çıkarılır (backfill).

## 8. Dayanıklılık (canlıda sağlıklı döngü)
- **Sağlayıcı zinciri:** Her rol önce birincile gider. 429 ya da 5xx'te üstel bekleme uygulanır, sonra yedeğe geçilir. Yedek de doluysa iş ertesi güne kalır; hat çökmez.
- **Bütçe koruması:** Her sağlayıcı için günlük token/istek sayacı tutulur. Limitin %90'ında o sağlayıcı o gün için bırakılır.
- **İş kuyruğu:** Her aday kendi durumunu taşır (`new → scored → written → verified → queued → published` / `rejected:<neden>`). Yarıda kalan run kaldığı yerden devam eder.
- **Ölçüm:** Her run `pipeline_runs` tablosuna şunları yazar: adım başına sayılar, red nedenleri, sağlayıcı başına token, süre.
- **Alarm:** Bildirim GitHub Issue olarak açılır; GitHub sahibine e-posta gönderir. Tetikleyiciler:
  - Gün içinde 0 kart `queued` oldu
  - Stok 3 günün altına düştü
  - Bir sağlayıcı 3 run üst üste hata verdi
- **Canlı tutma:** GitHub'ın workflow'u kapatmaması için aylık bir keepalive workflow çalışır. Supabase'i yayındayken kullanıcı trafiği ayakta tutar.
- **Model kapanışı:** Bir model 404/"decommissioned" dönerse alarm açılır ve hat otomatik olarak yedeğe geçer.

## 9. Veri modeli (özet — ayrıntı Köprü'nün görev kartında)
- **Yeni `fact_candidates`:**
  - `id`, `source_key` (unique), `source`, `hook_text`, `source_url`, `lang`, `status`, `scores` (jsonb), `reject_reason`, `support_paragraph`, `created_at`
  - RLS: **herkese kapalı**, sadece service role.
- **`facts` tablosuna eklenecekler:**
  - `source_key`, `content_hash` (unique), `embedding vector(1024)`, `wow_score`, `verification` (jsonb), `attribution`, `status` (`queued`/`published`), `published_at`
  - Uygulamanın gördüğü sorgu yalnızca `published` kartları getirir.
- **Yeni `pipeline_runs`:** ölçüm tablosu, service role.

## 10. Kalite ve insan kontrolü
- Yayın **otomatik**. Her hafta 10 rastgele kart kullanıcıya örnek olarak gelir (GitHub Issue). Kullanıcının işaretlediği kötü kartlar prompt ve eşik ayarına girdi olur.
- Model seçimi bir kerelik **30 kancalık kör Türkçe testi** ile doğrulanır: aynı 30 kanca, aday yazar modellerle yazılır; kullanıcı hangisinin hangi model olduğunu bilmeden puanlar.

## 11. Lisans
- Wikipedia kaynaklı her kartta atıf bulunur: "Kaynak: Wikipedia, CC BY-SA 4.0" + makale linki. Bu bilgi `attribution` alanında tutulur ve uygulamada gösterilir.
- Wikidata (CC0) için atıf zorunlu değildir, ama gösterilir.

## 12. Riskler ve açık kararlar
| Risk | Etki | Önlem |
|---|---|---|
| Ücretsiz limitler değişir / model kapanır (Groq 2026'da 10 model kapattı) | Üretim düşer | Yedek zinciri + stok + alarm; gerekirse ilk ücretli kademe Groq ~3,7 $/ay |
| Groq'un free limitleri resmi tabloda "örnek" olarak geçiyor | Kapasite tahmini yanlış olabilir | Faz 0'da kullanıcı konsoldan gerçek limiti okur |
| Küçük doğrulayıcı hata kaçırır | Yanlış bilgi yayınlanır | Haftalık örnek + kullanıcı geri bildirimi; gerekirse doğrulayıcı büyütülür |
| DYK kancalarının bir kısmı Türk okura niş | Düşük ilgi | `tr_relevance` puanı + eşik |
| Kaynak tükenmesi (97K → puanlamadan sonra ~30K) | ~10 ay sonra hız düşer | Günlük yeni kancalar + S5 Wikidata; uzun vadede 30–50/gün |

**Kullanıcı kararı bekleyenler:**
- (a) Otomatik yayın + haftalık örnek: önerilen, varsayılan.
- (b) "Lüzumsuz Bilgiler" ve telifli kitaplar ne olacak? Bu spec'te hariç tutuldu.
- (c) Mevcut 713 karttan zayıf/hatalı olanların temizliği: ayrı görev.
