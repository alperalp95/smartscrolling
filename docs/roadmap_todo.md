# SmartScrolling - Proje Gelistirme Yol Haritasi

> **Versiyon:** v0.4 - Guncelleme Asamasinda
> **Tarih:** Nisan 2026
> **Hedef Platformlar:** Android, iOS (React Native / Expo)

---

## PHASE 0 - Urun Stratejisi ve Planlama

- [x] **P0-01** Hedef kitle arastirmasi yap (18-35 yas, bilgi dostu kullanicilar) - `docs/ROADMAP.md`, `docs/ftue_research.md` ve mevcut value-first FTUE/auth kararlarinda hedef kitle/persona varsayimlari dokumante edildi
- [x] **P0-02** Rakip analizi yap (Blinkist, Headway, Refind, ReadWise)
- [x] **P0-03** MVP kapsamini netlestir (hangi ozellikler ilk surumde olacak?)
- [x] **P0-04** Monetizasyon modelini belirle (Freemium + RevenueCat)
- [x] **P0-05** Kullanici yolculugu haritasini (user journey map) ciz
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
- [x] **P1-00e** Soft FTUE (First Time User Experience) yeniden tasarim: `ftue-modal.tsx` bileseni ve `ftueStore.ts` ile `hasSeenFtue` / `isFtueVisible` akisi tamamlandi; web-safe, once-per-session modal olarak hayata gecirildi

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
- [x] **P1-10** Upstash Redis kurulumu (P3-21 rate limiting ile local implementasyon, remote secret/deploy ve free smoke kabulü tamamlandi)

### 1.3 Kimlik Dogrulama (Oncelikli Baslanacak - P0)
- [x] **P1-11** E-posta/Sifre login ve Supabase `onAuthStateChange` dinleyicisi kurulumu
- [x] **P1-11b** Auth prompting: save/chat gibi korunan aksiyonlarda login yonlendirmesi ve profile CTA ekle
- [x] **P1-11c** Post-auth redirect: save/chat kaynakli login yonlendirmesinde kullaniciyi basarili auth sonrasinda geldigi ekrana geri dondur
- [x] **P1-11d** Value-first auth urun akisi: kullaniciyi feed ve demo kitap deneyimine anon al, auth'i save/sync/chat gibi niyet anlarinda iste
- [x] **P1-11e** Progressive profiling: ilgi alani secimi, gunluk hedef ve bildirim tercihi UI'lari `profile.tsx`'e eklendi; `userPreferences.ts` ile Supabase'e persist ediliyor; migration'lar `p1_11e_daily_goal_preference` ve `p1_11e_notification_preference` uygulandı
- [x] **P1-11f** Guest mode mesajlasmasi: misafir kullanicinin neleri yapabilecegini ve login ile hangi degerleri kazanacagini UI seviyesinde netlestir
- [x] **P1-12** Veritabani guvenligi: Yeni kullanicilarda `public.users` tablosunu otomatik dolduran Postgres Trigger
- [x] **P1-13** Google OAuth ve Apple Sign-In yapilandirmasi (Google provider/callback/allowlist + Android dev build smoke tamam; Apple native foundation tamam, release-oncesi Apple paid team/config/iOS smoke ayrildi)
- [x] **P1-14** RLS guvenligi: `20260415174141_p1_14_rls_hardening.sql` migration'i ile `reading_progress`, `bookmarks`, `chat_sessions`, `user_activity` tablolarina granular SELECT/INSERT/UPDATE/DELETE politikalari eklendi

Not:
- `P1-13` icin gap audit cikartildi.
- Email/sifre auth omurgasi hazir.
- Google OAuth mobil akisi icin helper, callback route, profile button, Supabase provider config, redirect allowlist ve Google Cloud callback hizasi dogrulandi.
- Google login dev build uzerinde fiziksel Android cihazda smoke edildi; release oncesi EAS preview/internal veya production candidate build uzerinde tekrar smoke edilecek.
- Apple icin secilen teknik yol: iOS native `expo-apple-authentication` + Supabase `signInWithIdToken`; Apple private key/client secret mobil koda konmayacak.
- Apple native foundation eklendi: dependency/config, `socialAuth.ts` helper'i ve profile iOS-only Apple CTA hazir.
- `P1-13` repo kapsami kapandi; Apple tarafinda iOS fiziksel cihaz build/test akisi release-oncesi hesap bagimli blocker olarak ayrildi.
- Kullanıcıdan release oncesi beklenenler:
  - Apple Developer Program odemesi ve paid team erisimi
  - Team ID ve `com.smartscrolling.mobile` App ID / Sign in with Apple capability kurulumu
  - gerekirse Services ID, Key ID ve `.p8` private key ile Supabase Apple provider config
  - EAS iOS credentials/provisioning kurulumu
  - iOS fiziksel cihazda Apple Sign-In dev/preview build smoke
  - Google icin EAS preview/internal veya production candidate build uzerinde tekrar fiziksel cihaz smoke
  - release web/landing domain'i varsa Supabase `Site URL` degerini `http://localhost:3000` yerine gercek domain ile hizalama
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
- [x] **P1-15l** Production Wikipedia daily ingest job: release sonrasi sabah/aksam 15'er kayit hedefi ve haftalik 100 floor icin `target_saved`, `max_candidates`, `max_groq`, rate-limitte temiz durma, GitHub Actions cron ve weekly catch-up check eklendi (`docs/tasks/p1_15l_wikipedia_daily_ingest_job.md`)
- [ ] **P1-15m** Wikipedia seed registry ve freshness ops: koddaki seed havuzunu `core seed pool + expansion layer + cooldown/blacklist` modeliyle yonetilebilir hale getir; kategori verisini DB'de koru, seed'i sadece discovery politikasi olarak kullan (`docs/tasks/p1_15m_wikipedia_seed_registry_ops.md`)
- [ ] **P1-15n** Content ingest audit ve tuning loop: gunluk/haftalik run sonu `saved`, reject nedenleri, duplicate oranlari, Groq maliyeti ve seed performansini raporlayip prompt/policy tuning kararlarina bagla (`docs/tasks/p1_15n_content_ingest_audit_tuning.md`)
- [ ] **P1-15o** LLM provider abstraction: mevcut `convertToFact()` prompt ve JSON contract'ini bozmadan Groq'a sabit bagli conversion cagrilarini provider/model secilebilir adapter katmanina tasi (`docs/tasks/p1_15o_llm_provider_abstraction.md`)
- [ ] **P1-15p** LLM shadow benchmark ve cost audit: Groq ic/dış model adaylarini production insert yapmadan ayni source batch uzerinde JSON kalite, retry, latency, cost ve reject metrikleriyle karsilastir (`docs/tasks/p1_15p_llm_shadow_benchmark.md`)
- [ ] **P1-15q** LLM production fallback ve budget guard: rate/token limitte kontrollu fallback, run-level max fallback ve gunluk/aylik cost guard davranisini tanimla (`docs/tasks/p1_15q_llm_production_fallback_ops.md`)
- [ ] **P1-16** NASA APOD aktif hattini koru; ArXiv / PubMed backlog'unun yanina Turkce kaynak genislemesi icin `Khan Academy Turkce`, `TUBITAK Bilim Genc`, `TDV Islam Ansiklopedisi` ve uygun olursa `Saglik Bakanligi / Saglikli Bilgi` adaylarini degerlendir
- [x] **P1-17** Public domain / acik lisansli kitaplik ilk gercek katalogu Supabase `books` tablosuna yuklendi; `p3_05b_real_books_catalog`, `p3_27_learning_library_shortlist`, `p3_10c_full_readable_sections_phase1` migration'lari uygulandı; 10 kitaplik katalog aktif
- [x] **P1-17b** P6 catalog recovery: `Homo Deus` free anchor yapildi, `Kendime Dusunceler` kaldirildi, Library grid basligi sadeleştirildi ve free kitap gridde ilk kart olarak sabitlendi
- [x] **P1-18** Kitap erisim katmani `access_tier` alani (`free_anchor` / `premium`) ve `resolveBookAccess()` fonksiyonu ile runtime'a tasindi; `p3_26_book_access_policy` migration'i uygulandı
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
- [x] **P2-12** Fact quality review loop: production disi editor feedback katmani ile `good / bad / unsure` ve ozellikle `bad` comment sinyali toplayip Groq prompt/pipeline tuning icin kullan; ilk dilim in-memory review + JSON export olarak tamamlandi
- [x] **P2-12c** Feed review mode UI: `index.tsx` icinde `good / bad / unsure` verdict secimi, issue tag chipleri, zorunlu comment ve modal sheet olarak tamamlandi; `isReviewMode` flag ile internal modda aktif
- [x] **P2-12d** Fact review storage/export: `handleExportReviews()` ile in-memory review map'i JSON formatinda `Share` API uzerinden export ediliyor; `reviewsByFactId` state'i her session icin tutuluyor
- [x] **P2-13** Tek akis feed: `feedStore.ts`'de kategori filtre state'i yok; `index.tsx`'de kategori filtre UI bulunmuyor; feed tek kesintisiz akis olarak calisıyor
- [x] **P2-04** Kategori filtresi (Bilim, Tarih, Felsefe, Teknoloji, Saglik)
- [x] **P2-05** Icerik veritabani semasi olustur (facts tablosu)
- [x] **P2-06** Dogrulanmis kaynak etiketleme sistemi
- [x] **P2-07** Icerik kuratorluk sureci tanimla
- [x] **P2-08** "Begen / Kaydet / Paylas" aksiyonlarini UI seviyesinde ekle
- [x] **P2-08b** UI Kaydet state'ini Supabase `bookmarks` tablosuna optimistik olarak bagla; Begen state'i su an yalnizca local UI, kalici like/RPC isi Senior Backend Adim 4 altinda acik tutuluyor
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
- [x] **P3-10d** Reader rollout: 10 kitabin tamami icin `book_highlights` eklendi (free kitaplar ~25, premium kitaplar ~32-48 highlight); AI context `bookSectionContext.ts` uzerinden aktif bolum scope'una cekildi; section-based fetch ve highlight render aktif
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
- [x] **P3-21** Kullanim limiti / rate limiting (free: 5 soru/gun, premium: 50 soru/gun, Upstash Redis; `p3_21a`-`p3_21e`, remote deploy ve MVP free smoke kabulü tamamlandi; premium 51. soru yuk testi ileri dogrulama notu)
- [x] **P3-22** Sunucu proxy mimarisi (API anahtarinin gizlenmesi icin Supabase secrets entegrasyonu)

### Simdi Devam Edilebilecek En Net Isler
- [x] **S1** `book_highlights` ve AI context katmani section-reader modeliyle hizalandi; highlight render ve AI context aktif bolum scope'una cekildi
- [x] **S2** Kutuphane shortlist metadata audit'i cikarildi; takip gorevi `P3-27b` altinda title/description/language/source metadata kararlarina bolundu
- [x] **S3** Reader performans checklist'i hazirlandi; cok section'li kitaplar icin scroll, progress sync, popup ve chat test basliklari `P3-10h` altinda toplandi
- [x] **S4** Groq ceviri maliyeti optimizasyonu: translate modunda daha kucuk section chunk'i varsayilani ve karar notu `P3-10i` altinda hazirlandi

### 3.5 Monetizasyon ve Paywall (Gelir Modeli)
- [x] **P3-23** RevenueCat entegrasyonu tamamlandi: `purchases.ts` icinde `ensurePurchasesConfigured`, `getPremiumEntitlementStatus`, `purchasePackageSafe`, `restorePurchasesSafe`, `presentSmartScrollPaywall`, `presentCustomerCenterSafe` fonksiyonlari aktif; `premiumEntitlements.ts` ile `authStore`'a baglandı
- [x] **P3-24** Paywall ekrani `premium.tsx` olarak tamamlandi: RevenueCat offering'lerinden dinamik paket listeleme, satin alma ve restore akisi, benefit listesi ve loading state mevcut; `promptForPremium` ile uygulama icinden tetikleniyor
- [ ] **P3-24b** Reklam operasyon checklist'i: AdMob test/production ad unit'leri, Play Console `contains ads` beyanı ve consent/backoffice adimlarini release oncesi tamamla (`p3_24b_a` tamamlandi; Android AdMob app/ad unit hazir; Google Play odemesi ve iOS backoffice release oncesine ertelendi; guest/free/premium feed cadence placeholder smoke dogrulandi; gercek Android AdMob render ve consent/release smoke bekliyor)

### 3.6 Icerik Stratejisi Kararlari (Yeni Oncelik)
- [x] **P3-25** Kutuphaneyi `AI-assisted learning library` olarak yeniden konumlandir; aktif katalog 10 kitaplik non-fiction shortlist ile tarih/bilim/felsefe/toplum odagina cekildi
- [x] **P3-26** Free/Premium icerik kuralini runtime'a tasi: 1 adet `free_anchor_book` herkese acik, diger kitaplar auth + premium gate ile reader/library davranisina baglandi (entitlement'in gercek odeme baglantisi P3-23'te tamamlanacak)
- [x] **P3-27** Public-domain non-fiction shortlist hazirla: 10 kitaplik ilk ogrenme katalogu Supabase `books` tablosuna migration ile eklendi
- [x] **P3-28** Roman katalogunu secondary/backlog stratejisine cek; aktif katalog roman yerine `context-heavy nonfiction` olarak standardize edildi

---

## PHASE 3.6 - MVP Kritik: Kullanici Tutundurma (Retention)

> Bu ozellikler MVP'ye dahil edilmezse ilk haftada kullanici kaybi yuksek olur.

### Streak Sistemi
- [x] **P35-01** Gunluk giris / okuma serisi (streak) sayaci - `user_activity` uzerinden gercek streak hesaplama profile summary'ye baglandi (`docs/tasks/p35_01_real_streak_counter.md`)
- [x] **P35-02** Streak kirilma uyarisi - `ActivitySummary` streak-risk state'i P35-12 single local reminder copy'sine baglandi; ayrica pending notification, remote push veya freeze migration'i eklenmedi (`docs/tasks/p35_02_streak_break_warning.md`)
- [x] **P35-03** Streak rekoru goruntuleme - son 90 gun `user_activity` verisinden hesaplanan en iyi seri profil ozetinde `Rekor: X gun` olarak gosteriliyor; kalici rekor kolonu MVP disi tutuldu (`docs/tasks/p35_03_best_streak_summary.md`)
- [ ] **P35-04** Streak korumasi (1 gunluk grace period veya freeze)
- [x] **P35-05** `user_activity` tablosu ile gunluk kayit tut - feed kart goruntuleme, reader sayfa ilerlemesi ve basarili AI soru sayisi `incrementDailyActivity()` ile gunluk kayda yaziliyor

### Ilerleme Gostergesi
- [x] **P35-06** Ana ekranda "Bugun X kart okudun" ozet widget'i - feed overlay bugunku `facts_read` sayisini ve varsa kart hedefini kompakt activity ring olarak gosteriyor; basa don butonu activity ring ile hizalandi; kart okundu sayimi progress esigi gecildikten sonra yapiliyor; fiziksel Android cihazlarda collapsed kart safe-layout ve paging viewport polish'i eklendi (`docs/tasks/p35_06_today_cards_widget.md`, `docs/tasks/p35_06a_compact_feed_activity_ring.md`, `docs/tasks/p35_06b_align_feed_activity_controls.md`, `docs/tasks/p35_06c_feed_read_qualification_threshold.md`, `docs/tasks/p35_06d_feed_collapsed_safe_layout.md`, `docs/tasks/p35_06e_feed_paging_viewport_fix.md`)
- [x] **P35-07** Gunluk hedef belirleme (orn: 3 kart / 5 kart) - profile UI + Supabase `users.daily_goal_type/value` persistence tamamlandi; dakika hedefi gercek zaman olcumu gelene kadar kaldirildi; profil yuzeyi ozet + `Duzenle` davranisina alindi (`docs/tasks/p35_07b_card_only_daily_goal.md`, `docs/tasks/p35_07c_daily_goal_summary_edit.md`)
- [x] **P35-08** Dairesel ilerleme cubugu animasyonu - feed activity ring mevcut progress'e kisa React Native `Animated` gecisiyle doluyor; yeni dependency eklenmedi (`docs/tasks/p35_08_activity_ring_animation.md`)
- [x] **P35-09** Haftalik aktivite grafigi - profil ozetindeki 7 gunluk nokta satiri, `facts_read` degerini gosteren kompakt haftalik bar grafige donusturuldu (`docs/tasks/p35_09_weekly_activity_graph.md`)

### Push Notification
- [x] **P35-10** Expo Push Notification entegrasyonu - native foundation, local scheduling helper'lari, P35-10c push token persistence ve P35-10d self-test remote sender tamamlandi; fiziksel Android development build'de token kaydi ve Expo receipt `status: ok` smoke edildi (`docs/tasks/p35_10a_push_notification_foundation.md`, `docs/tasks/p35_10b_notification_permission_and_schedule.md`, `docs/tasks/p35_10c_remote_push_token_foundation.md`, `docs/tasks/p35_10d_remote_push_sender_smoke.md`)
- [x] **P35-11** Kullaniciya ozel bildirim saati ayari - profile hour chips + `users.notification_hour/minute` migration remote'a uygulandi; fiziksel Android development build smoke basarili goruldu (`docs/tasks/p35_11_notification_time_preference.md`)
- [x] **P35-12** Streak hatirlatici bildirimi - local-only best-effort schedule/cancel/reconcile ve P35-02 streak-risk copy baglandi; fiziksel Android development build smoke basarili goruldu (`docs/tasks/p35_12_streak_reminder_notification.md`)
- [x] **P35-13** Yeni icerik bildirimi - MVP'de single daily local copy baglandi; P35-13b backend content freshness push daily ingest sonrasi broadcast MVP olarak eklendi ve GitHub Actions daily workflow smoke Expo receipt `status: ok` ile tamamlandi; interest-based token hedefleme MVP sonrasina ayrildi (`docs/tasks/p35_13_new_content_notification.md`, `docs/tasks/p35_13_backend_content_freshness_push.md`)
- [x] **P35-14** Bildirim tercihlerini profil ayarlarindan yonetme - profile toggle + `users.notifications_enabled` persistence tamamlandi; OS permission artik kullanici aksiyonuyla P35-10b local akisa bagli

---

## PHASE 4 - Kisilestirme ve Gelismis Gamification

> Bu asama MVP sonrasi 2. surum icin planlanmistir.

- [x] **P4-01** Kullanici ilgi alani secimi ilk slice'i profile ekraninda devreye alindi; kayit sonrasi profil UI'i ozet + `Duzenle` davranisina alindi; kapsam feed siralama/onboarding etkisiyle genisletilecek (`docs/tasks/p4_01b_interest_summary_edit.md`)
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
- [ ] **P6-09b** Apple App Store Yasal Zorunluluklari: Profilde aninda isleyen "Hesabi ve Verilerimi Sil" butonu ve AI Chat ekraninda "Yanlis Icerigi Raporla" butonlarinin zorunlu entegrasyonu (`docs/tasks/p6_09b_app_store_compliance.md`) - implementation + remote apply/deploy tamam, emulator smoke bekliyor
- [x] **P6-09c** Kitap katalog/highlight recovery: `Homo Deus` free anchor yapildi, `Kendime Dusunceler` kaldirildi, reader section basliklari kaldirildi ve highlight seed remote'a uygulandi (`docs/tasks/p6_book_catalog_highlight_recovery.md`)
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
| Kategori filtresi | Kaldirilacak | Phase 2 / P2-13 |
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
- [x] Eksik olan TypeScript tiplerini DB uzerinden uret (`npx supabase gen types --linked --lang typescript --schema public > apps/mobile/src/types/supabase.ts`)

### Adim 2: Authentication Akisinin Insasi
- [x] `public.users` tablosuna trigger bagla: Supabase Auth ile olusan kullaniciyi otomatik `public.users` tablosuna yaz
- [x] Frontend'de root layout icinde `supabase.auth.onAuthStateChange` ekle ve Zustand state'ine bagla
- [x] RLS politikalarini kontrol et: `facts` public okunabilir, `bookmarks` ve `reading_progress` kesinlikle `auth.uid() = user_id` olmali

### Adim 3: Edge Functions'in Groq API'ye Baglanmasi
- [x] `supabase/functions/ai-definition/index.ts` icine `word` ve `context` alan, Groq ile Turkce baglamsal tanim donen gercek endpoint yaz
- [x] `supabase/functions/ai-chat/index.ts` icine kitap metadatasi ve soru baglamini prompt'a ekleyen sohbet endpoint'i yaz
- [x] `supabase secrets set GROQ_API_KEY=xxx` ile gerekli secret'lari remote projeye aktar; local secret/env degerleri developer makinesi bazinda korunur

### Adim 4: Etkilesimlerin Kalicilastirilmasi
- [ ] Frontend'deki `toggleLike` fonksiyonunu gercek Supabase RPC veya insert cagrilarina donustur
- [x] Reader ekranindan cikildiginda veya anlamli scroll araliklarinda `reading_progress` tablosuna UPSERT at
- [ ] Tum bu API isteklerinde optimistik UI paternini koru

### Adim 5: Backend Deployment (CI/CD Entegrasyonu)
- [ ] Supabase schema degisikliklerini prod'a tasiyacak GitHub Action betigini (`.github/workflows/supabase-deploy.yml`) yaz
- [ ] Edge function'lari `supabase functions deploy` ile canliya al
- [ ] Auth saglayicilarini (Google / Apple) Supabase Dashboard uzerinden yapilandir

---

## Kod Denetimi Ozeti - 2026-05-02

### Yapilip isaretlenmemis / yanlis anlatilan alanlar
- `P0-01` tamamlandi olarak isaretlendi; hedef kitle ve persona varsayimlari roadmap/FTUE dokumanlarinda mevcut.
- `P2-08b` metni duzeltildi: Supabase persistence su an `bookmarks`/Kaydet icin var; `toggleLike` kalici degil ve ayri backend isi olarak duruyor.
- `P2-09`, `P3-15`, `P3-17`-`P3-22`, `P35-07`, `P35-14` zaten kod/migration seviyesinde isaretli ve mevcut durumla uyumlu gorundu.

### Kodda mevcut ama urun olarak tamam sayilmamasi gereken alanlar
- `P35-05`, `P35-01` ve `P35-06` ilk retention dikeyi olarak kapandi; sonraki adim uyarilar/rekor/grace-period veya daha genis hedef UI'i.
- Profilde gercek seri sayaci ve rekor gosterimi baglandi; P35-02 streak kirilma uyarisi P35-12 single local reminder copy'sine baglandi. Grace/freeze davranisi henuz yok; `P35-04` acik kalmali.
- Google OAuth icin mobil helper, callback route, profil butonu, Dashboard/provider allowlist hizasi ve fiziksel Android dev build smoke tamam; Apple native foundation eklendi. `P1-13` kapandi; Apple Developer config ve iOS fiziksel cihaz smoke release-oncesi blocker olarak takip edilecek.
- RevenueCat/paywall kodu var; reklam tarafinda production AdMob render, consent ve store beyan smoke bekledigi icin `P3-24b` acik kalmali.
- Supabase Edge Function dosyalari ve CI sanity check var; schema/function prod deploy workflow'u yok. `P6-11` ve Backend Deployment adimlari acik kalmali.

### Devam icin onerilen sira
1. `P35-04` grace/freeze davranisini ayri urun karari olarak tut; MVP oncesi gereklilik netlestirilecek.
2. `P6-09b`: hesap/veri silme ve AI icerik raporlama akisini release blocker olarak ele al.
3. `P6-01`/`P6-02`: auth, bookmark, reader progress ve paywall icin minimum unit/e2e smoke seti kur.
4. `P1-15o`/`P1-15p`/`P1-15q`: LLM provider abstraction, shadow benchmark ve budget guard ile Groq limit riskini operasyonel hale getir.
5. `P35-13` interest-based token hedeflemeyi MVP sonrasi ayri task olarak ele al.

*Son guncellenme: 2026-05-12 - v0.8*
