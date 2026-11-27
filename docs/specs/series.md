# Spec — Seriler (uzun, kesintisiz okuma dizileri)

**Durum:** Taslak, kullanıcı onayı bekliyor · **Yazan:** Atlas (PO) · **Tarih:** 2026-11-27
**Tasarım taslağı:** scratchpad `series-mockup/seriler-taslak.html` — kullanıcı seçimi: sekme **A (vitrin + raflar)**, okuma **R2 (aşağı kaydır, akış gibi)**, premium kilidi taslaktaki gibi.

## 1. Neden
- Akış tek tek kısa bilgi kartları gösteriyor; derinlik yok. Seriler tek bir konuyu baştan sona, kart kart okutur.
- Premium'a gerçek bir değer: bugünkü avantajlar (reklamsız akış, günde 30 soru, serbest soru) zayıf.
- LLM'siz: metin kaynaktan **aynen** alınır, kart sınırı dolunca bir sonraki karta **kesintisiz** devam eder. Özet, atlama, yeniden yazma yok → yazım hatası ve LLM kotası sorunu yok (kullanıcı kararı).

## 2. Hedefler
| # | Hedef | Ölçüt |
|---|---|---|
| H1 | Yeni "Seriler" sekmesi | Sekme çubuğunda Akış ile Profil arasında; taslak A yerleşimi |
| H2 | Kesintisiz okuma | Seri, kaynak metnin seçilen bölümlerini cümle sınırında bölünmüş kartlar halinde, sırayla gösterir; hiçbir cümle atlanmaz, kesilmez |
| H3 | Uzunluk sınırı yok | Seri, kaynağın seçilen bölümleri kadar uzun olabilir (kullanıcı: "uzun olması daha iyi") |
| H4 | Ücretsiz / premium | 5–10 seri tamamen ücretsiz; diğerleri premium, ilk 3 kartı ücretsiz önizleme |
| H5 | Kilit sunucuda | Premium olmayan kullanıcı premium serinin 4.+ kartını API'den de alamaz |
| H6 | Kaldığın yerden | Seri açılınca son okunan kart; "Devam et" rafı |
| H7 | Akış etkilenmez | Seri kartları `facts` tablosunda değil; akış sırası, tekrar kontrolü, içerik hattı değişmez |

## 3. Kapsam dışı
- LLM ile özetleme/yeniden yazma/çeviri.
- İngilizce kaynaklar (çeviri gerektirir).
- Uygulama içinde seri oluşturma ekranı (seriler betikle eklenir, §6).
- Seri içinde "Karta Sor", beğeni, kart kaydetme (ileride).
- Kaynak madde güncellenince seriyi otomatik yenileme (sürüm sabitlenir).
- Telifi bitmiş kitaplar (Vikikaynak) — ileride ayrı kaynak olarak eklenebilir.

## 4. Kaynak
- **Türkçe Vikipedi "Seçkin" (230) ve "Kaliteli" (344) maddeleri** aday havuzudur (27.11 sayımı). Bir betik bu listeyi uzunluk ve Commons görseli bilgisiyle çıkarır; **kullanıcı/editör hangi maddelerin seri olacağını seçer** (futbol sezonu, tek çeşme gibi ilgisizler elenir).
- Metin MediaWiki API düz metin olarak alınır (`prop=extracts&explaintext`), **maddenin o anki sürüm numarası** (`revid`) saklanır.
- Atılanlar: Kaynakça, Notlar, Dış bağlantılar, Ayrıca bakınız, Kaynakça benzeri bölümler; boş bölümler; tablo/liste artıkları.
- Kapak görseli: maddenin **serbest lisanslı Commons** görseli (`pageimages` + `pilicense=free`; `upload.wikimedia.org/wikipedia/tr/` yerel "adil kullanım" dosyaları **kullanılmaz** — ör. Galata Kulesi logosu, Sabahattin Ali fotoğrafı). Commons görseli yoksa kapak marka degradesi (yer tutucu).
- Lisans: metin CC BY-SA 4.0, aynen alıntı; seri kapağında ve her kartın altında atıf (§7).

## 5. Bölme kuralı (saf, test edilebilir)
- Girdi: bölümler listesi `[{ heading, text }]`; çıktı: sıralı kartlar `[{ position, sectionTitle, body }]`.
- Kart gövdesi en çok **N karakter** (config; varsayılan 600 — akış kartı uzunluğuna yakın, 1 karta ~1 dk). Bölme **cümle sonunda** yapılır; tek cümle N'den uzunsa kelime sınırında bölünür ve bir sonraki kart o cümlenin devamıyla başlar (cümle atlanmaz).
- Bölüm değişince yeni kart başlar; kart başlığı = bölüm başlığı (alt bölümlerde en yakın başlık). Aynı bölümün devam kartlarında başlık tekrar eder.
- İlk kart: madde giriş paragrafı, başlık = madde adı.
- Metin karakter karakter korunur (boşluk normalleştirme hariç); test: kartlar birleştirilince kaynak metin (boşluk normalize) elde edilir.

## 6. Seri ekleme akışı (editör, kod bilmeden)
1. `packages/pipeline/config/series.json`: elle düzenlenen liste — her satır `{ "title": "<Vikipedi madde adı>", "free": true|false, "category": "<uygulama kategorisi>", "sections": null | ["<bölüm>", ...] }`. `sections: null` = tüm madde (§4 atılanlar hariç). Açıklama alanlarıyla; README'de anlatılır.
2. `series-candidates` betiği: seçkin+kaliteli adayları (başlık, karakter, tahmini kart sayısı, Commons görseli var mı) bir dosyaya döker — editör buradan seçer.
3. `series-import` betiği: listedeki her maddeyi çeker, böler, `draft` olarak yazar (`--apply` olmadan sadece önizleme dosyası). Yayın: `--publish <slug>` ya da editör onayıyla toplu.
4. Aynı madde ikinci kez içe aktarılırsa yeni sürümle **değiştirir** (kullanıcının ilerlemesi pozisyon üzerinden korunur; kart sayısı azaldıysa son karta kırpılır).

## 7. Uygulama
**Sekme (A):** Akış ile Profil arasında "Seriler" (ikon: üst üste kartlar). Sırasıyla:
- **Öne çıkan:** en yeni yayınlanan seri (ya da config'te işaretli) — büyük kapak, `PREMIUM` çipi (premium ise), kategori, başlık, "N kart · ~N dk".
- **Devam et:** kullanıcının başlayıp bitirmediği seriler (küçük kapak, "12 / 31 kart", ilerleme çizgisi). Hiç yoksa raf gizli.
- **Kategori rafları:** kategori başına yana kaydırılan dikey kapaklar (yalnızca serisi olan kategoriler).
- Boş durum (hiç seri yok): "Yakında" metni. Yüklenemedi: mevcut uygulamanın hata/yeniden dene kalıbı.

**Seri kapak sayfası:** büyük kapak, kategori + "Vikipedi seçkin/kaliteli madde", başlık, kart / süre / bölüm sayısı, kısa açıklama (maddenin ilk cümlesi), bölüm listesi (premium olmayan kullanıcıda kilitli bölümler soluk + kilit), düğme "Okumaya başla" / "Devam et (12/31)", altında "Kaynak: Vikipedi · CC BY-SA 4.0" + madde linki.

**Okuma (R2):** akıştaki gibi dikey sayfalı kaydırma, akış kartıyla aynı yazı stilleri. Üstte "Seri adı · 3 / 68" ve ✕. İlk kartta kapak görseli; diğer kartlar sadece bölüm başlığı (degrade meta) + başlık + gövde. Sağda ince ilerleme çizgisi. **Otomatik ilerleme yok** (akıştaki okuma sayacı burada kullanılmaz; uzun okuma). Her kartın altında küçük kaynak satırı.

**Premium kilidi:** premium seride premium olmayan kullanıcı ilk 3 kartı okur; 4. kart bulanık + "Serinin devamı Premium'da — N kart daha" kartı + "Premium'a geç" (mevcut Premium ekranına gider). Misafir de ilk 3 kartı ve ücretsiz serilerin tamamını okur.

**Premium ekranı:** avantaj listesine "Tüm seriler" eklenir.

## 8. Veri modeli (Supabase)
- `series`: `id uuid pk`, `slug text unique`, `title`, `summary`, `category`, `cover_url null`, `source_title`, `source_url`, `source_revid bigint`, `license text default 'CC BY-SA 4.0'`, `card_count int`, `section_count int`, `is_free bool`, `is_featured bool default false`, `status text check in ('draft','published')`, `published_at`, `created_at`, `updated_at`.
- `series_cards`: `id uuid pk`, `series_id fk → series on delete cascade`, `position int`, `section_title`, `body text`, `unique(series_id, position)`.
- `series_progress`: `user_id fk → auth.users on delete cascade`, `series_id fk`, `last_position int`, `completed_at null`, `updated_at`, `pk(user_id, series_id)`.
- **RLS:**
  - `series`: herkes (anon dahil) yalnızca `status='published'` okur; yazma yalnız service role.
  - `series_cards`: okunur ise seri yayında **ve** (`series.is_free` **veya** `position <= 3` **veya** `(auth.jwt() -> 'app_metadata' ->> 'premium')::boolean = true`). Premium bilgisi RevenueCat webhook'unun `app_metadata.premium` alanı (kullanıcı değiştiremez).
  - `series_progress`: kullanıcı yalnız kendi satırını okur/yazar. Misafir ilerlemesi cihazda (AsyncStorage).
- Hesap silme akışı `series_progress`'i de siler (FK cascade yeterli; `delete-account` function kontrol edilir).
- **Bölüm bilgisi (Atlas kararı):** `series.sections jsonb` = `[{ "title", "firstPosition", "cardCount" }]`. Kapak sayfası bölüm listesi ve "N kart daha" bundan çizilir; kilitli kartların metni istemciye hiç gelmez.
- **Premium tazeliği (Atlas kararı):** RLS premium bilgisini oturum belirtecinden (JWT) okur; bu ~1 saatte bir yenilenir. Satın alma / geri yükleme başarılı olunca uygulama `supabase.auth.refreshSession()` çağırır; ayrıca istemci kullanıcıyı premium bilirken premium seride 4. kart gelmezse bir kez yenileyip tekrar dener. Premium bitişinde en çok ~1 saat gecikme kabul.
- **Yeniden içe aktarma (Atlas kararı):** kartlar tek bir veritabanı işleminde (SQL fonksiyonu, service role) silinip yeniden yazılır; okuyan biri boşluk görmez. İlerleme pozisyonla korunur, kart sayısı azaldıysa son karta kırpılır. `is_free` yayından sonra değiştirilebilir (sadece RLS etkiler).
- **İlerleme (Atlas kararı):** `completed_at` = son karta ulaşıldı. Misafir ilerlemesi cihazda; giriş yapınca cihazdaki ilerleme sunucuya aktarılır, çakışmada **daha ileri pozisyon** kazanır.
- **Kategoriler (Atlas kararı):** `facts` ile aynı kategori metinleri (ör. `📜 TARİH`, `🔬 BİLİM`); raf başlıkları bu metinlerden.
- **Betikler (Atlas kararı):** `series-candidates` / `series-import` `packages/pipeline` içinde, mevcut Supabase istemcisi (`src/lib/supabase.js`) ve yerel `.env`'deki service role ile Atlas/editör bilgisayarında çalışır (CI yok). `.env` commit edilmez.

## 9. Kısıtlar
- Değerler yalnız temadan; temada olmayan değer açıklamalı yeni giriş.
- Türkçe metinler ve `toLocaleUpperCase('tr-TR')`.
- Yeni yerel paket beklenmiyor (FlashList, expo-image mevcut) → OTA ile gidebilir; migration önce canlıya, sonra uygulama.
- Ayarlar (`series.json`, karakter sınırı, önizleme kart sayısı 3) kod bilmeyenin düzenleyeceği yerde, README'de.
- Hassas içerik: editör seçimiyle kontrol (otomatik filtre yok); aday listesinde kategori/başlık görünür.

## 10. Açık konular
- Vikipedi metni herkese ücretsiz; premium değeri seçki ve okuma deneyiminden gelir (kullanıcıyla konuşulacak).
- İlk yayında kaç seri, hangileri: editör seçecek (öneri: 15 seri, 5–10 ücretsiz).
- Seri içi görseller (bölüm görselleri) ileride.

## 11. Kabul
- Birim: bölme kuralı (cümle sınırı, uzun cümle, bölüm geçişi, birleşince kaynak metin), atılan bölümler, Commons/yerel görsel ayrımı, config doğrulama.
- DB testleri (PGlite, mevcut kalıp): RLS — misafir ücretsiz serinin tüm kartlarını, premium serinin 1–3'ünü okur, 4'ünü okuyamaz; premium kullanıcı hepsini okur; `draft` seri görünmez; ilerleme sadece sahibine.
- Uygulama: sekme, raflar, kapak sayfası, okuma, kilit, devam et — bileşen testleri; emülatörde ekran görüntüleri.
- Gerçek veri: 3 seri (1 ücretsiz, 2 premium) içe aktarılıp emülatörde baştan sona okunur.
- typecheck, lint, test:unit, pipeline testleri geçer.
