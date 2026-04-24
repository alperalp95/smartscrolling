# SmartScrolling - Proje Gelistirme Yol Haritasi

> **Versiyon:** v0.4 - Guncelleme Asamasinda
> **Tarih:** Nisan 2026
> **Hedef Platformlar:** Android, iOS (React Native / Expo)

---

## PHASE 0 - Urun Stratejisi ve Planlama

- [ ] **P0-01** Hedef kitle arastirmasi yap (18-35 yas, bilgi dostu kullanicilar)
- [ ] **P0-02** Rakip analizi yap (Blinkist, Headway, Refind, ReadWise)
- [x] **P0-03** MVP kapsamini netlestir (hangi ozellikler ilk surumde olacak?)
- [x] **P0-04** Monetizasyon modelini belirle (Freemium + RevenueCat)
- [ ] **P0-05** Kullanici yolculugu haritasini (user journey map) ciz
- [x] **P0-06** Wireframe / Lo-fi prototip hazirla - Browser UI Demo (`demo/index.html`)
- [x] **P0-07** Icerik lisansi ve telif hakki stratejisini belirle (API, Gutenberg, Wikipedia)
- [ ] **P0-08** Yapay zeka kullanim maliyetlerini tahmin et

---

## PHASE 1 - Altyapi ve Temel Kurulum

### 1.0 Stabilizasyon Sprinti (En Yuksek Oncelik - P0)
- [x] **P1-00** Kod kalite kapilari: `npm run lint` ve `npx tsc --noEmit` hatalarini sifirla
- [x] **P1-00b** Veri sozlesmesini hizala: Supabase semasi, frontend tipleri ve UI alan adlarini tekillestir
- [x] **P1-00c** Dokuman gerceklik guncellemesi: roadmap, architecture ve README dosyalarini mevcut duruma gore duzelt
- [x] **P1-00d** CI guvence katmani: GitHub Actions icine `typecheck` ve mumkunse Supabase function check adimlarini ekle
- [ ] **P1-00e** Soft FTUE (First Time User Experience) yeniden tasarim: ilk deneme web preview stabilitesini bozdugu icin kontrollu rollback yapildi; ikinci deneme arastirma notlarina gore web-safe, route-level ve progressive sekilde yeniden ele alinacak

### 1.1 Proje Kurulumu
- [x] **P1-01** Monorepo yapisini kur (Turborepo)
- [x] **P1-02** React Native + Expo projesi baslat (`create-expo-app` SDK 54, 908 paket)
- [x] **P1-03** TypeScript konfigurasyonu yap (strict mode, path aliases)
- [x] **P1-04** Biome (ESLint + Prettier) kurulumu
- [x] **P1-05** CI/CD pipeline kur (GitHub Actions + EAS Build)

### 1.2 Backend Altyapisi
- [x] **P1-06** Supabase projesi olustur (Auth + Database + Storage)
- [x] **P1-07** Veritabani semasini tasarla (users, books, facts, bookmarks, reading_progress, user_activity)
- [x] **P1-08** Row-Level Security (RLS) politikalarini tanimla
- [x] **P1-09** Supabase Edge Functions ortamini kur (Deno + TypeScript)
- [ ] **P1-10** Upstash Redis kurulumu (P3-21 rate limiting isi ile birlikte, auth ve chat history sonrasinda devreye alinacak)

### 1.3 Kimlik Dogrulama (Oncelikli Baslanacak - P0)
- [x] **P1-11** E-posta/Sifre login ve Supabase `onAuthStateChange` dinleyicisi kurulumu
- [x] **P1-11b** Auth prompting: save/chat gibi korunan aksiyonlarda login yonlendirmesi ve profile CTA ekle
- [x] **P1-11c** Post-auth redirect: save/chat kaynakli login yonlendirmesinde kullaniciyi basarili auth sonrasinda geldigi ekrana geri dondur
- [x] **P1-11d** Value-first auth urun akisi: kullaniciyi feed ve demo kitap deneyimine anon al, auth'i save/sync/chat gibi niyet anlarinda iste
- [ ] **P1-11e** Progressive profiling: ilgi alani secimi UI'i eklendi; sonraki adim olarak preference persistence, gunluk hedef ve kullanicinin profilden bilinclli sekilde acabilecegi bildirim tercihi dilimlerini tamamla
- [x] **P1-11f** Guest mode mesajlasmasi: misafir kullanicinin neleri yapabilecegini ve login ile hangi degerleri kazanacagini UI seviyesinde netlestir
- [x] **P1-12** Veritabani guvenligi: Yeni kullanicilarda `public.users` tablosunu otomatik dolduran Postgres Trigger
- [ ] **P1-13** Google OAuth ve Apple Sign-In yapilandirmasi (Dashboard provider config + Expo redirect URI + production callback allowlist)
- [ ] **P1-14** RLS guvenligi: `auth.uid() = user_id` sarti ile korunan ozel tablolarin (bookmarks, progress) guncellenmesi

Not:
- `P1-13` icin gap audit cikartildi.
- Email/sifre auth omurgasi hazir, ancak social auth tarafinda su an hem UI hem callback handling hem de dashboard/provider hizasi eksik.
- Onerilen sira: once Google OAuth mobil akisini tamamla, sonra Apple Sign-In native entegrasyonuna gec.
- Google icin ilk kod dilimi eklendi: helper, callback route ve profile button hazir. Kalan kritik kisim dashboard/provider/allowlist hizasi ve smoke test.
- Apple tarafinda iOS fiziksel cihaz build/test akisi su an hesap bagimli blocker altinda: kullanilan Apple hesabinda developer team bulunmadigi icin EAS credential/provisioning kurulumu ilerleyemedi.
- `P1-11e` altinda sonraki kucuk dilimler ayrildi:
  - preference persistence
  - daily goal preference
  - notification preference
  - bildirim karari "default acik" degil; mevcut profile `Bildirimler` yuzeyi uzerinden kullanicinin bilinclli tercihiyle acilacak
  - gercek permission/schedule isi ise daha sonraki retention slice'ina birakildi

### 1.4 Veri ve Icerik Yonetimi (MVP)
- [ ] **P1-15** Curated kaynaklar uzerinden "hap bilgi" uretim hattini MVP hedefi olan minimum 1500 karta cikar; kategori esitligi hedefleme, bunun yerine her cekirdek kategoride en az 150 kaliteli kartlik `minimum healthy floor` olustur
- [x] **P1-15b** Source registry/whitelist katmani ekle: hangi kaynaklarin `verified` rozetini alabilecegini sistem seviyesinde tanimla
- [x] **P1-15c** Duplicate fingerprint katmani ekle: `source_url` disinda metin benzerligi ile tekrar eden kartlari ele
- [x] **P1-15d** Pipeline run summary loglari: `saved`, `duplicate`, `quality_rejected`, `groq_failed` gibi neden bazli ozetleri gorunur yap
- [x] **P1-15e** Fact quality gate: dusuk kaliteli title/content/kategori/tag kombinasyonlarini DB insert oncesi ele
- [x] **P1-15f** Category prompt strategy: cekirdek kategori setini genis tut, Groq promptunu kategoriye gore ozellestir; tema havuzlarini source selection katmanina baglama isi sonraki slice'ta derinlestirilecek
- [ ] **P1-15g** Geriye donuk facts backfill backlog'u: mevcut kayitlari `source_url` uzerinden tekrar cekip yeni "source-faithful" prompt ile yeniden uret, quality gate'i gecenleri kontrollu batch'lerle update et
- [ ] **P1-15h** Topic registry ve freshness stratejisi: mevcut seed sistemini release sonrasi `core seed pool + expansion layer + freshness layer` modeline evrilt, haftalik kontrollu ingest ve `topic_registry` veri modelini planla
- [ ] **P1-15i** Editorial value pilotu: `tellable / why should I care` odakli yeni fact promptu, Turkish rewrite kalite artisi ve low-value source rejection sonrasinda temiz `facts` pilot reset + 10 kartlik review batch'i tamamla
- [x] **P1-15j** Duplicate / freshness memory ilk slice'i: son 60 gunde ayni kategoride benzer topic'leri hafif fingerprint ile Groq oncesi skip et, `duplicate_recent_topic` metriğini `run-all` ozetine ekle
- [x] **P1-15k** PDF curated source lane ilk slice'i: `Luzumsuz Bilgiler Ansiklopedisi` gibi Turkce kitap/PDF kaynaklarini mevcut discovery hattini bozmadan JSON tabanli ayri source lane olarak Groq + quality gate + insert zincirine bagla
- [ ] **P1-16** NASA APOD aktif hattini koru; ArXiv / PubMed backlog'unun yanina Turkce kaynak genislemesi icin `Khan Academy Turkce`, `TUBITAK Bilim Genc`, `TDV Islam Ansiklopedisi` ve uygun olursa `Saglik Bakanligi / Saglikli Bilgi` adaylarini degerlendir
- [ ] **P1-17** Public domain / acik lisansli 3-5 kitaplik ilk gercek katalogu Supabase `books` tablosuna yukle
- [ ] **P1-18** Telifli (Sapiens, Cosmos) kitaplarin "Demo Chapter" olarak kullanim sinirlarini ayarla
- [ ] **P1-19** Icerik yasam dongusu ekle: `draft/review/approved/published` status modeli (MVP sonrasi operasyon olgunlastirma; otomatik pipeline yeterli gelmezse devreye alinacak)
- [ ] **P1-19b** Gutenberg kitap akisi: `Storage`ta raw EN source, `book_sections` icinde TR reader edition stratejisini ilk kitapta apply et

Not:
- `P1-19b` kod seviyesi hazir.
- Gutenberg bootstrap calisiyor.
- `--translate-tr` pilotu iki kez denendi.
- Mevcut blokaj Groq `rate_limit_exceeded`; ilk apply bu nedenle beklemede.

---

## PHASE 2 - Gunluk Bilgi Akisi (Scroll Feed)

- [x] **P2-01** "Gunluk Bilgi" ekran tasarimi
- [x] **P2-02** Dikey kaydirma (FlashList) implementasyonu
- [x] **P2-03** Bilgi karti bileseni olustur (baslik, icerik, kaynak, kategori etiketi)
- [x] **P2-03b** Feed reading interactions: kart ici genis okuma modu, pause etkisi, uzun baslik ellipsis ve scroll cakismasi azaltma
- [x] **P2-03c** Feed freshness: refresh, kategori degisimi, app'e geri donus ve `Akis` sekmesine tekrar basma anlarinda kontrollu rotation/shuffle davranisi
- [x] **P2-03d** Feed payload optimization: feed sorgusunu hafif projection'a indir ve ilk acilis icin kucuk ilk sayfa + arka plan prefetch modeli kullan
- [x] **P2-03e** Feed performance measurement: veri sorgusu, ilk kart gorunumu ve ilk gorsel yuklenmesini ayri loglarla olc
- [ ] **P2-03f** Feed query strategy backlog'u: server-side freshness / weighted ranking / kategoriye ozel ilk sayfa stratejisini daha sonra degerlendir
- [ ] **P2-12** Fact quality review loop: production disi editor feedback katmani ile `good / bad / unsure` ve ozellikle `bad` comment sinyali toplayip Groq prompt/pipeline tuning icin kullan
- [ ] **P2-12c** Feed review mode UI: debug/internal modda fact kartlari icin hafif `good / bad / unsure` review paneli ve `bad` icin zorunlu comment akisi
- [ ] **P2-12d** Fact review storage/export: review sinyallerini basit Supabase tablo veya JSON/CSV export modeliyle analiz edilebilir hale getir
- [x] **P2-04** Kategori filtresi (Bilim, Tarih, Felsefe, Teknoloji, Saglik)
- [x] **P2-05** Icerik veritabani semasi olustur (facts tablosu)
- [x] **P2-06** Dogrulanmis kaynak etiketleme sistemi
- [x] **P2-07** Icerik kuratorluk sureci tanimla
- [x] **P2-08** "Begen / Kaydet / Paylas" aksiyonlarini UI seviyesinde ekle
- [x] **P2-08b** UI Begen/Kaydet state'lerini Supabase DB'ye gercek zamanli bagla (Optimistik UI)
- [x] **P2-08c** `Kutuphane` icinde `Kaydettiklerim` yuzeyi ekle; auth kullanicida saved fact kartlarini, misafirde giris yonlendirmeli placeholder'i goster
- [x] **P2-08d** Bookmark sync ilk optimizasyonu: `syncSavedFacts()` cagrisini feed fetch zincirinden cikar, hydration'i auth/session listener'a birak
- [x] **P2-09** Infinite scroll + pagination implementasyonu
- [x] **P2-10** Supabase sema ve TypeScript tiplerini linked remote projeden generate edip mobil tip katmanina bagla (`npx supabase gen types`)
- [x] **P2-11** Facts veri modeli hizasi: generated `facts` row tipini saf tut, UI-only alanlari normalize katmanina tasi

---

## PHASE 3 - Kitap Okuma Modulu

### 3.1 Kitap Kutuphanesi
- [x] **P3-01** Kitap listesi ekrani (kapak, yazar, emoji, kategori, grid)
- [x] **P3-02** Arama ve filtreleme cubugu
- [ ] **P3-03** Kitap detay sayfasi (ozet, okuyucu istatistikleri)
- [x] **P3-04** "Okumaya Basla" ve "Devam Et" butonlari
- [x] **P3-05** Ucretsiz / premium kitap ayrimi
- [x] **P3-05b** Kutuphane kaynagini demo katalogdan dogrudan Supabase `books` tablosuna tasi
- [x] **P3-05c** Kitap icerik saklama modeli: `books` + `book_sections` + Supabase Storage kaynak dosyasi yapisini kur

### 3.2 Okuyucu Ekrani
- [x] **P3-06** Sayfali dikey kaydirmali okuyucu modu
- [ ] **P3-07** Alternatif: Yatay kaydirmali sayfa gorunumu
- [ ] **P3-08** Yazi boyutu, satir araligi, font ayarlari
- [ ] **P3-09** Gece / gunduz modu
- [x] **P3-10** Okuma ilerleme senkronizasyonu: Her 1000ms debounce ile scroll pozisyonunu Supabase `reading_progress` tablosuna UPSERT etme
- [x] **P3-10b** Reader veri kaynagini sabit slice'lardan `book_sections` tablosuna tasi ve section bazli fetch yap
- [x] **P3-10c** Ilk iki kitapta tam okunabilir phase-1 akis: `Kendime Dusunceler` ve `The Problems of Philosophy` icin daha uzun section seti, yenilenmis highlight verisi ve remote migration kapanisini tamamla
- [ ] **P3-10d** Reader rollout sirasi: Groq kotasi beklenirken `book_highlights` + AI context hizasi, reader performans checklist'i ve shortlist metadata cleanup islerini bitir
- [ ] **P3-11** Sayfa gecis animasyonu (Reanimated)

### 3.3 Kelime ve Referans Sistemi
- [x] **P3-12** Kitap metnine etiketleme (sari keyword + mavi reference)
- [x] **P3-12b** Highlight kaynagini local tanim sozlugunden `book_highlights` tablosuna tasi ve section bazli metadata ile yonet
- [x] **P3-13** Vurgulanan kelimelere dokunma (tap) olayi ekleme
- [x] **P3-14** AI popup bileseni tasarla ve gelistir
- [x] **P3-15** Edge katmani: `ai-definition` fonksiyonu yazimi. Deno uzerinden Groq API baglantisi ve baglamsal kelime tanimlari
- [ ] **P3-16** Tanimlari favorilere kaydetme (Backlog: MVP icin zorunlu degil, ancak tekrar kullanilan ogrenme akislarinda yeniden degerlendirilecek)

### 3.4 Yapay Zeka Sohbet Entegrasyonu
- [x] **P3-17** "Yapay Zekaya Sor" chat arayuzunun ilk sheet versiyonunu tasarla
- [x] **P3-18** Baglam yonetimi (aktif kitap / konu bilgisi prompt'a eklenmeli)
- [x] **P3-19** Edge katmani: `ai-chat` fonksiyonu uzerinden kitap baglamli sohbet ve persona prompting kurgusu
- [x] **P3-20** Sohbet gecmisini kaydet (Supabase)
- [ ] **P3-21** Kullanim limiti / rate limiting (freemium: 5 sorgu/gun, Upstash Redis)
- [x] **P3-22** Sunucu proxy mimarisi (API anahtarinin gizlenmesi icin Supabase secrets entegrasyonu)

### Simdi Devam Edilebilecek En Net Isler
- [x] **S1** `book_highlights` ve AI context katmani section-reader modeliyle hizalandi; highlight render ve AI context aktif bolum scope'una cekildi
- [x] **S2** Kutuphane shortlist metadata audit'i cikarildi; takip gorevi `P3-27b` altinda title/description/language/source metadata kararlarina bolundu
- [x] **S3** Reader performans checklist'i hazirlandi; cok section'li kitaplar icin scroll, progress sync, popup ve chat test basliklari `P3-10h` altinda toplandi
- [x] **S4** Groq ceviri maliyeti optimizasyonu: translate modunda daha kucuk section chunk'i varsayilani ve karar notu `P3-10i` altinda hazirlandi

### 3.5 Monetizasyon ve Paywall (Gelir Modeli)
- [ ] **P3-23** RevenueCat entegrasyonu ve Premium kullanici yetkilendirme (Entitlement) kontrollerinin kodlanmasi; `premium` kullanici tipi library, AI custom soru ve chat history runtime gate'lerine baglanacak
- [ ] **P3-24** Paywall (Odeme Duvari) ekraninin ve monetization policy'sinin implementasyonu; guest/free/premium akisi, reklam sonrasi yumusak upsell ve AI premium gecisleri bu baslikta tamamlanacak
- [ ] **P3-24b** Reklam operasyon checklist'i: AdMob test/production ad unit'leri, Play Console `contains ads` beyanı ve consent/backoffice adimlarini release oncesi tamamla

### 3.6 Icerik Stratejisi Kararlari (Yeni Oncelik)
- [x] **P3-25** Kutuphaneyi `AI-assisted learning library` olarak yeniden konumlandir; aktif katalog 10 kitaplik non-fiction shortlist ile tarih/bilim/felsefe/toplum odagina cekildi
- [x] **P3-26** Free/Premium icerik kuralini runtime'a tasi: 1 adet `free_anchor_book` herkese acik, diger kitaplar auth + premium gate ile reader/library davranisina baglandi (entitlement'in gercek odeme baglantisi P3-23'te tamamlanacak)
- [x] **P3-27** Public-domain non-fiction shortlist hazirla: 10 kitaplik ilk ogrenme katalogu Supabase `books` tablosuna migration ile eklendi
- [x] **P3-28** Roman katalogunu secondary/backlog stratejisine cek; aktif katalog roman yerine `context-heavy nonfiction` olarak standardize edildi

---

## PHASE 3.6 - MVP Kritik: Kullanici Tutundurma (Retention)

> Bu ozellikler MVP'ye dahil edilmezse ilk haftada kullanici kaybi yuksek olur.

### Streak Sistemi
- [ ] **P35-01** Gunluk giris / okuma serisi (streak) sayaci
- [ ] **P35-02** Streak kirilma uyarisi
- [ ] **P35-03** Streak rekoru kaydetme ve goruntuleme
- [ ] **P35-04** Streak korumasi (1 gunluk grace period veya freeze)
- [ ] **P35-05** `user_activity` tablosu ile gunluk kayit tut

### Ilerleme Gostergesi
- [ ] **P35-06** Ana ekranda "Bugun X kart okudun" ozet widget'i
- [ ] **P35-07** Gunluk hedef belirleme (orn: 3 kart / 5 sayfa)
- [ ] **P35-08** Dairesel ilerleme cubugu animasyonu
- [ ] **P35-09** Haftalik aktivite grafigi

### Push Notification
- [ ] **P35-10** Expo Push Notification entegrasyonu
- [ ] **P35-11** Kullaniciya ozel bildirim saati ayari
- [ ] **P35-12** Streak hatirlatici bildirimi
- [ ] **P35-13** Yeni icerik bildirimi
- [ ] **P35-14** Bildirim tercihlerini profil ayarlarindan yonetme

---

## PHASE 4 - Kisilestirme ve Gelismis Gamification

> Bu asama MVP sonrasi 2. surum icin planlanmistir.

- [ ] **P4-01** (P1-00e asamasinda devreye alindi, kapsam genisletilecek) 
- [ ] **P4-02** Kisilestirilmis bilgi onerileri (oneri motoru)
- [ ] **P4-03** Rozet ve basarim sistemi
- [ ] **P4-04** Detayli istatistik ekrani
- [ ] **P4-05** Haftalik ozet raporu (e-posta veya in-app)
- [ ] **P4-06** Arkadas ekleme ve karsilastirma (streak rekabeti)
- [ ] **P4-07** Sosyal paylasim
- [ ] **P4-08** Soft personalization backlog'u: `preferred_categories` / ilgi alanlari ile feed siralamasina hafif agirlik ver, ancak kesif dengesini koru

---

## PHASE 5 - Icerik Yonetimi (CMS/Admin)

- [ ] **P5-01** Admin paneli kurulumu (Next.js + Supabase Studio)
- [ ] **P5-02** Bilgi karti ekleme / duzenleme / silme arayuzu
- [ ] **P5-03** Kitap icerigi yukleme ve etiketleme (EPUB parse)
- [ ] **P5-04** Kelime/reference highlight editoru
- [ ] **P5-05** Icerik onay sureci (taslak -> onay -> yayin)
- [ ] **P5-06** Istatistik dashboard (en cok okunan, tiklanan kelimeler)

---

## PHASE 6 - Test, Optimizasyon ve Yayin

- [ ] **P6-01** Unit testler (Jest + React Native Testing Library)
- [ ] **P6-02** E2E testler (Maestro)
- [ ] **P6-03** Performans optimizasyonu (FlashList, RAM bellek sismelerini (Memory Leak) onlemek icin Native `expo-image` ile resim onbellekleme (Offline cache))
- [ ] **P6-04** Erisilebilirlik (a11y) kontrolleri
- [ ] **P6-05** App Store / Google Play gerekliliklerini karsila
- [ ] **P6-06** TestFlight ve Android Internal Testing asamasi
- [ ] **P6-07** Beta kullanici grubu olustur ve geri bildirim topla
- [ ] **P6-08** App Store Optimization (ASO)
- [ ] **P6-09** KVKK / GDPR uyumluluk kontrolu (Gizlilik Sozlesmesi Onaylama Adimlari)
- [ ] **P6-09b** Apple App Store Yasal Zorunluluklari: Profilde aninda isleyen "Hesabi ve Verilerimi Sil" butonu ve AI Chat ekraninda "Yanlis Icerigi Raporla" butonlarinin zorunlu entegrasyonu
- [ ] **P6-10** Crash reporting kurulumu (Sentry)
- [ ] **P6-11** Backend CI/CD: Supabase prod auto-deploy GitHub Action betiginin yazilmasi
- [ ] **P6-12** Analytics (Metrik) Entegrasyonu: PostHog veya Mixpanel ile "Event Taxonomy"nin (swipe_fact, read_book vb.) baglanmasi
- [ ] **P6-13** Release visual polish pass: mevcut davranisi bozmadan global visual language, profile, feed, library, premium/auth ve reader yuzeylerine kontrollu "makyaj" turu uygula

Not:
- `P6-13` release oncesi geri donulecek bir polish gorevi olarak ayrildi.
- Bu is redesign degil, mevcut yapinin davranisini koruyan dusuk riskli bir visual pass olarak ele alinacak.

---

## MVP Kapsami (Guncel)

| Ozellik | MVP'de Var mi? | Faz |
|---|---|---|
| Gunluk bilgi akisi (scroll feed) | Evet | Phase 2 |
| Kategori filtresi | Evet | Phase 2 |
| Kitap listesi ve okuyucu | Kismen | Phase 3 |
| Kelime popup (AI tanim) | Kismen | Phase 3 |
| Yapay Zekaya Sor (sohbet) | Planlandi | Phase 3 |
| Streak sistemi (gunluk seri) | Planlandi | Phase 3.5 |
| Ilerleme gostergesi + gunluk hedef | Planlandi | Phase 3.5 |
| Push notification (streak hatirlatici) | Planlandi | Phase 3.5 |
| Abonelik (RevenueCat) | Planlandi | Phase 3 |
| Rozet / basari sistemi | Sonraki surum | Phase 4 |
| Sosyal paylasim + arkadas | Sonraki surum | Phase 4 |
| Kisilestirilmis oneri motoru | Sonraki surum | Phase 4 |
| Aktif ogrenme (quiz modu) | Sonraki surum | Phase 4+ |
| Audio mod | Sonraki surum | Phase 5+ |

---

## Senior Backend Developer Teknik Gorev ve Adimlar Listesi (Uygulama Rehberi)

> Bu bolum, sistemin backend/veritabani eksiklerini tamamen production standartlarina getirmek icin gerekli olan komut ve teknik adimlari icerir.

### Adim 1: Supabase Yerel Gelistirme Ortaminin (Docker) Ayaga Kaldirilmasi
- [ ] Supabase CLI kur ve `supabase start` ile yerel Supabase docker konteynerlerini ayaga kaldir
- [ ] Mevcut migration betiginin yerel ortama basildigini onayla (`supabase db reset`)
- [ ] Eksik olan TypeScript tiplerini DB uzerinden uret (`supabase gen types typescript --local > apps/mobile/src/types/supabase.ts`)

### Adim 2: Authentication Akisinin Insasi
- [ ] `public.users` tablosuna trigger bagla: Supabase Auth ile olusan kullaniciyi otomatik `public.users` tablosuna yaz
- [ ] Frontend'de `apps/mobile/src/lib/supabase.ts` icerisine `supabase.auth.onAuthStateChange` ekle ve Zustand state'ine bagla
- [ ] RLS politikalarini kontrol et: `facts` public okunabilir, `bookmarks` ve `reading_progress` kesinlikle `auth.uid() = user_id` olmali

### Adim 3: Edge Functions'in Groq API'ye Baglanmasi
- [ ] `supabase/functions/ai-definition/index.ts` icine `word` ve `context` alan, Groq ile Turkce baglamsal tanim donen gercek endpoint yaz
- [ ] `supabase/functions/ai-chat/index.ts` icine kitap metadatasi ve soru baglamini prompt'a ekleyen sohbet endpoint'i yaz
- [ ] `supabase secrets set GROQ_API_KEY=xxx` ile gerekli secret'lari local ve remote projelere aktar

### Adim 4: Etkilesimlerin Kalicilastirilmasi
- [ ] Frontend'deki `toggleLike` fonksiyonunu gercek Supabase RPC veya insert cagrilarina donustur
- [ ] Reader ekranindan cikildiginda veya anlamli scroll araliklarinda `reading_progress` tablosuna UPSERT at
- [ ] Tum bu API isteklerinde optimistik UI paternini koru

### Adim 5: Backend Deployment (CI/CD Entegrasyonu)
- [ ] Supabase schema degisikliklerini prod'a tasiyacak GitHub Action betigini (`.github/workflows/supabase-deploy.yml`) yaz
- [ ] Edge function'lari `supabase functions deploy` ile canliya al
- [ ] Auth saglayicilarini (Google / Apple) Supabase Dashboard uzerinden yapilandir

---

*Son guncellenme: 2026-04-13 - v0.5*
