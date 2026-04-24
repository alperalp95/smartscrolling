# 📝 SmartScrolling — Değişiklik Günlüğü (Changelog)

> Bu dosya, projedeki tüm değişiklikleri, eklemeleri ve çıkarmaları kronolojik olarak takip eder.  
> Her güncelleme sonrası bu dosya güncel tutulur.
>
> 📁 **Proje Dizini:** `c:\Users\Administrator\smartscrolling\`

---
### [v1.18] - 2026-04-23

#### Fact Pipeline Editorial Tuning Devam Etti
- Feed icin daha "anlatilabilir kesif" tonu hedeflenerek fact promptu genel ders kitabi basligi uretmemesi ve Turkce karakterleri dogru kullanmasi yonunde sikilastirildi.
- Wikipedia source seed havuzu bilim, tarih, felsefe ve teknoloji tarafinda daha keskin ve merak uyandirici konulara cekildi; saglik tarafinda fazla genel konu basliklari ayiklanmaya baslandi.
- Kucuk pilot batch yeniden kosuldu; Wikipedia artik tamamen bogulmuyor ve yeni adaylar tekrar facts tablosuna girebiliyor.

#### Duplicate / Freshness Memory Ilk Slice'i Eklendi
- Pipeline icine migration'siz ilk freshness katmani eklendi; son 60 gunde ayni kategoride benzer topic'ler hafif title fingerprint ile tespit edilip Groq'a gitmeden once skip edilmeye baslandi.
- `duplicate-policy.js` tarafinda `findRecentTopicDuplicate()` helper'i eklendi.
- `run-all` artik `duplicate_recent_topic` metrigi raporluyor; boylece source_url duplicate disindaki taze konu tekrarlarini da gozlemek mumkun.
- Bu slice semantic topic memory degil, ama ayni root konularin yakin aralikta yeniden secilmesini azaltan ilk ucuz savunma hattidir.

#### PDF Curated Source Lane Baslatildi
- `Luzumsuz Bilgiler Ansiklopedisi` benzeri Turkce kitap/PDF kaynaklarini mevcut Wikipedia discovery hattini bozmadan ayri source lane olarak pipeline'a sokan ilk slice eklendi.
- JSON tabanli sample source dosyasi ve buna bagli `pdf-curated` source reader yazildi.
- `Groq` tarafina `pdf_curated` source guidance eklendi; soru bazli ve aciklayici populer-bilim metinleri feed'e uygun, daha temiz ve daha anlatilabilir kartlara donusturme yonu verildi.
- Ayrica `run:pdf-curated` runner'i ve `run-all` icine opsiyonel `--pdf-curated-count / --pdf-curated-file` destegi eklendi.

---
### [v1.17] - 2026-04-22

#### Notification Preference Ilk Slice'i Eklendi
- `public.users` tablosu icin `notifications_enabled` alanini ekleyen yeni migration hazirlandi.
- `userPreferences` helper'i bildirim tercihini okuyup yazacak sekilde genisletildi.
- Onboarding store ve auth init zinciri bildirim preference hydration'i ile guncellendi.
- Profil ekranindaki mevcut `Bildirimler` satiri gercek preference toggle'ina baglandi; kullanici bu tercihi profilden bilinclli sekilde acip kapatabiliyor.
- Bu dilimde OS permission, saat secimi ve scheduling bilincli olarak sonraki retention isine birakildi.

---
### [v1.16] - 2026-04-22

#### Daily Goal Preference Ilk Slice'i Eklendi
- `public.users` tablosu icin `daily_goal_type` ve `daily_goal_value` alanlarini ekleyen yeni migration hazirlandi.
- `userPreferences` helper'i gunluk hedef preference'ini okuyup yazacak sekilde genisletildi.
- Onboarding store gunluk hedef state'i ve hydration davranisi ile guncellendi.
- Profil ekranina `3 kart`, `5 kart` ve `10 dakika` seceneklerini sunan yeni gunluk hedef karti eklendi; secim Supabase'e kaydedilip yeniden acilista geri yukleniyor.

---
### [v1.15] - 2026-04-21

#### Progressive Profiling Icin Ilgi Alani Persist Katmani Baslatildi
- `public.users.interests` alaninin zaten mevcut oldugu dogrulandi; ilk preference persistence slice'i icin migration gerekmedi.
- Yeni `userPreferences` helper'i ile profile ekranindaki interest picker secimi Supabase `users.interests` alanina yazilmaya basladi.
- Root auth init zinciri mevcut kullanicinin ilgi alanlarini hydrate ederek onboarding state'i remote veriyle hizalar hale getirildi.
- Boylece `P1-11e` altinda local kalan ilk profiling verisi kalici profile preference katmanina tasinmis oldu.

---
### [v1.14] - 2026-04-21

#### Progressive Profiling Bildirim Karari Netlestirildi
- `P1-11e` altindaki gorevler daha net ve uygulanabilir kucuk dilimlere ayrildi.
- Bildirim stratejisi "varsayilan acik" yerine, kullanicinin profildeki mevcut `Bildirimler` yuzeyi uzerinden bilinclli sekilde acabilecegi preference modeli olarak sabitlendi.
- Preference persistence, daily goal ve notification preference gorev dosyalari bu karar dogrultusunda guncellendi.
- Gercek permission isteme ve reminder scheduling isi ayri retention gorevi (`P35-10b`) olarak ayrik tutuldu.

---
### [v1.13] - 2026-04-21

#### Reader ve AI Refactor Ilk Dilimi Tamamlandi
- `P3-10d` ile reader ekranindaki aktif section takibi, sayfa tahmini ve progress sync sorumlulugu yeni `useReaderProgress` hook'una tasindi.
- `P3-10e` ile hem tanim hem sohbet akislarinin kullandigi aktif bolum odakli context uretimi ortak `bookSectionContext` helper'inda toplandi.
- `P3-15b` ile kelime popup'indaki AI tanim akisi `useDefinitionController` altina alinarak cache, in-flight guard ve fallback davranislari merkezilestirildi.
- `P3-19b` ile kitap baglamli AI sohbet akisi `useBookChat` icine tasinarak duplicate request guard, cooldown ve fallback cevap davranisi toparlandi.
- AI function invoke zinciri daha okunur hale getirildi; artik `non-2xx` hatalarinda mumkun oldugunca status ve response body mesaji loglanacak.
- Ayni failing kelime/soru icin kisa failure cooldown eklendi; tekrarlayan edge function spam'i ve donma hissi azaltildi.
- Tam katalog icin section rollout ve Gutenberg metadata acquisition isleri ayri task'lara ayrildi: `P3-10f` ve `P1-19b`.
- Storage-backed ilk kitap ingest runner'i eklendi; `source_storage_bucket + source_storage_path` metadata'si olan kitaplar icin ham text indirip `book_sections` tablosuna yazacak temel omurga hazirlandi.

---
### [v1.12] - 2026-04-20

#### P3-24 Monetization Policy Karari Netlesti
- Guest / free / premium kullanici tipleri reklam, kutuphane ve AI yetkileri acisindan policy seviyesinde ayrildi.
- Agresif olmayan monetization cizgisi benimsendi: guest ve free kullanici once urun degerini gorur, paywall yalnizca niyet anlarinda veya reklam sonrasi yumusak upsell olarak devreye girer.
- Satin alma / entitlement katmani icin `RevenueCat`, mobil reklam katmani icin ise `react-native-google-mobile-ads` + Google AdMob stack'i secildi.
- Roadmap'te `P3-23` ve `P3-24` aciklamalari bu policy'ye gore netlestirildi; RevenueCat artik sonraki surum notu degil, aktif Phase 3 monetization isi olarak cercevelendi.
- RevenueCat entitlement isi ve reklam/publisher operasyon akisi icin ayri checklist/task dosyalari eklendi; bundan sonra kullanicinin hangi dis hesaba ne zaman girmesi gerektigi net sekilde izlenebilecek.
- Ilk premium upsell slice'i eklendi: auth prompt omurgasina paralel merkezi bir `premium prompt` modal/store katmani kuruldu ve library ile reader icindeki premium kitap niyeti bu yuzeye baglandi.
- Reader AI chat'te ikinci premium slice eklendi: hazir sorular acik kalirken serbest metinle soru sorma premium prompt'a baglandi. Boylece free kullaniciya deger gosterilirken premium farki da yumusak sekilde netlestirildi.
- Premium anlatim dili reusable `premium upsell card` bilesenine tasindi; profile ve library ekranlarinda free kullaniciya reklam, tam kutuphane ve AI degerini agresif olmayan sekilde gosteren ortak bir CTA katmani eklendi.
- Feed icinde de bu dilin ilk kontrollu kullanim alani eklendi: premium olmayan kullanici yeterli sayida benzersiz kart gordugunde dismiss edilebilir hafif bir premium upsell karti goruyor. Bu kart, ileride reklam sonrasi ayni yere oturacak yapinin ilk UI omurgasi olarak eklendi; henuz reklam SDK'si baglanmadi.
- `P3-23` icin ilk entitlement omurgasi eklendi: root auth init zinciri artik `hydratePremiumEntitlement()` placeholder adapter'i uzerinden `hasPremium` state'ini merkezi store'a yaziyor. RevenueCat baglandiginda uygulama geneline yayilmis gate'leri tekrar dagitmadan sadece bu adapter gercek SDK ile degisecek.
- RevenueCat hazirlik dilimi eklendi: `react-native-purchases` ve `expo-dev-client` projeye kuruldu, guvenli bir `purchases` wrapper'i yazildi ve `app.json` icine platform API key placeholder'lari yerlestirildi. Bu asamada gercek davranis degismedi; key'ler gelince ayni omurga uzerinden entitlement okumasi aktiflesecek.
- RevenueCat UI katmani da eklendi: `react-native-purchases-ui` ile SmartScrolling icin `presentPaywallIfNeeded` ve `presentCustomerCenter` helper'lari yazildi. Verilen test API key `app.json` icine baglandi, entitlement id `SmartScroll Pro`, offering id `default` olarak kaydedildi.

#### P1-15 Hedef ve TR Wikipedia Yonelimi Guncellendi
- `P1-15` hedefi MVP icin minimum `1500` kart olarak yeniden cercevelendi; cekirdek kategorilerin her birinde en az `150` kaliteli kart tabani olusturma hedefi roadmap'e islendi.
- Wikipedia hatti tamamen `tr`'ye tasinmadi; daha guvenli hibrit model benimsendi. Kesif ve seed stabilitesi icin `en` havuzu korunurken, ilgili sayfanin `tr.wikipedia` karsiligi varsa Turkce summary ve Turkce page URL tercih edilmeye baslandi.
- Bu degisim Groq'un tam ceviri yukunu azaltip yari Turkce / yari Ingilizce cikti riskini dusurmeye yoneliktir.
- Geriye donuk facts backfill isi hemen baslatilmadi; source strategy yeterince oturduktan sonra, release oncesi kontrollu bir kalite turu olarak ele alinmasi gerektigi task notuna eklendi.
- Consistency gate'in saglik tarafi hafifce genisletildi; `vaccine/vaccines/vaccination`, `immune/immunity` ve `protection/prevent` alias'lari eklenerek MedlinePlus kartlarinda gereksiz `source_topic_drift` reject'lerini azaltma yonunde kucuk bir ayar yapildi.
- Felsefe tarafi da hafifce genisletildi; `epistemology`, `knowledge` ve `reason` alias'lari eklenerek Turkce ama konuya sadik kavram basliklarinin gereksiz drift reject'i yeme riski azaltildi.
- MedlinePlus icin kalp-damar tarafi da source'a daha sadik hale getirildi; topic title `Heart Diseases` olarak duzeltildi ve `heart/cardiac/cardiovascular/coronary/artery` alias'lari eklenerek kalp sagligi kartlarinda gereksiz drift reject'lerini azaltmaya yonelik bir tur daha yapildi.
- `Stanford` ve `MedlinePlus` connector'lerinde topic havuzlari buyutuldu; felsefe ve saglik kategorilerinde daha genis ama halen curated bir aday havuzu olusturuldu.
- `immune system` tarafinda da Turkce terim varyantlari genisletildi; `imun`, `imun sistem` ve `system -> sistem` alias'lari eklenerek MedlinePlus saglik kartlarinda bir tur daha drift azaltma ayari yapildi.
- 404 veren source seed'ler duzeltildi; `Stanford` tarafinda `Modularity of Mind` ve `John Rawls` ile daha stabil SEP entry'lerine gecildi, `MedlinePlus` tarafinda `Blood Pressure` topic'i `highbloodpressure.html` ile hizalandi.
- Wikipedia curated seed havuzu da genisletildi; bilim, tarih, felsefe, teknoloji ve saglik kategorilerine yeni seed topic'ler eklenerek benzersiz aday cikisini destekleyen daha genis bir baslangic havuzu olusturuldu.
- Seed sisteminin uzun vadeli siniri ve release sonrasi yonu not edildi; `P1-15h` ile `topic_registry + core seed pool + expansion layer + freshness layer` mimarisi backlog'a eklendi.
- Kategori sayimi cikarildi ve `Saglik` ile `Felsefe`nin geride oldugu goruldu; buna gore `Stanford` ve `MedlinePlus` source topic havuzlari ikinci kez hedefli sekilde buyutuldu.
- MedlinePlus tarafinda `obesity/stress/exercise/fitness/pressure/weight/hypertension` alias'lari eklenerek saglik kartlarinda drift azaltma turu daha yapildi; Stanford extraction'i de `maxParagraphs=2` ile hafifletilerek uzun entry'lerde Groq JSON kararsizligini azaltma yonunde ayarlandi.
- Kategori esitligi yerine `minimum healthy floor` urun karari uygulanarak yeni seed/topic genislemesi `Saglik` ve `Teknoloji` odagina kaydirildi; MedlinePlus'e yeni saglik topic'leri, Wikipedia seed havuzuna da saglik ve teknoloji icin yeni benzersiz konu basliklari eklendi.
- `report:facts` runner'i eklendi; kategori/source dagilimi ile `minimum healthy floor` acigi tek komutta gorulebilir hale geldi. Bu, kategori esitligi kovalamadan quality-first balanced growth kararini olculebilir hale getirir.
- Dengeli buyume yaklasimi korunarak `Saglik` ve `Teknoloji` icin bir tur daha hafif source/topic genislemesi yapildi; `MedlinePlus`e yeni saglik topic'leri, Wikipedia seed havuzuna ise saglik ve teknoloji icin ek benzersiz konu basliklari eklendi.
- Teknoloji tarafinda drift azaltma icin alias listesi bir tur daha genisletildi; `cloud/compiler/compression/computing/cryptography/database/distributed/search/software/source` eslesmeleri yeni teknoloji seed'lerinin Turkce ciktilarla daha stabil eslesmesini destekler hale getirildi.
- Son saglik diliminde `MedlinePlus`e `Digestive Health`, `Heart Health Tests`, `Mobility Aids`, `Patient Safety`; Wikipedia saglik havuzuna da benzer kavramlar eklendi. Ayrica `mobility/patient/rehabilitation/safety` alias'lari ile pratik saglik basliklarinda drift azaltma destegi verildi.

---
### [v1.11] - 2026-04-19

#### Feed Stabilite ve Dokuman Hizasi
- Feed'te hizli swipe sirasinda gorulen "iki kart ust uste aciliyormus" flicker'i azaltmak icin aktif kart takibi `index` bazindan `fact id` bazina tasindi.
- Pagination append akisinda mevcut sira korunup yalnizca yeni gelen kartlar listenin sonuna eklenecek sekilde feed ordering mantigi sertlestirildi; boylece "asagi gidemedim ama yukari cikinca yeni kartlar gordum" hissi azaltildi.
- `P2-02` task kaydi canli dogrulama ile kapatildi.
- `P2-03e` olcum task'i emulator sonucu notlariyla kapatildi.
- `P2-03g` media fallback dry-run sonucu degerlendirildi; runtime fallback + `visual_key` release icin yeterli kabul edildi.
- `P2-07` kuratorluk sureci, editorial queue'nun post-MVP backlog notu oldugu netlestirilerek kapatildi.

---
### [v1.10] - 2026-04-19

#### P2-03g Fact Visual Fallback Ilk Dilimi Eklendi
- Feed store tarafinda runtime `visual_key` turetimi eklendi; `media_url` bos oldugunda kartin kategori ve kaynak etiketine gore bir gorsel kimlik secilebiliyor.
- Feed karti artik `media_url` yoksa siyah kalmiyor; mevcut local arka plan asset'leri ve branded renk preset'leri ile fallback gorsel katmani render ediliyor.
- Bu ilk slice migration gerektirmeden runtime katmanda cozuldu; pipeline/DB tarafinda kalici `visual_key` ve mevcut bos kayitlar icin backfill sonraki adima birakildi.
- Sonraki dilimde `facts.visual_key` migration'i hazirlandi; pipeline yeni kayitlarda `visual_key` yazmaya basladi ve mobil feed DB'den gelen `visual_key` alanini runtime fallback'in onune alacak sekilde guncellendi.
- `backfill-fact-media.js` script'i eklendi; ilk turda sadece `Wikipedia` kaynakli ve `media_url` bos facts kayitlarini hedefliyor. Varsayilan calisma `dry-run`, gercek yazim ise yalnizca `--apply` ile yapiliyor.

#### P2-08c Saved Facts Surface Ilk Dilimi Eklendi
- `Kutuphane` ekranina `Kaydettiklerim` bolumu eklendi; giris yapmis kullanicida bookmark'tan hydrate edilen fact kartlari gorunur hale geldi.
- Misafir kullanicilar icin ayni alanda "giris yapinca burada birikir" mesajli placeholder ve profile yonlendirme CTA'si eklendi.
- Saved facts fetch'i kitap akisindan ayrilarak lightweight helper ile kuruldu; uygulama ici revisit davranisi sonraki slice'a birakildi.
- Ikinci dilimde kaydedilen fact kartlarina dokununca acilan lightweight `fact/[id]` detail route'u eklendi; kullanici kaynak linkiyle disarida derin okumaya devam edebiliyor.
- Ucuncu dilimde `Kutuphane` saved listesi `savedIds` degisimine baglanarak stale kalma sorunu kapatildi ve `Tumu` ile acilan `saved-facts` ekraninda kaydedilen tum fact'lerin listelendigi ayri bir tekrar okuma yuzeyi eklendi.
- Dorduncu dilimde saved-only liste ve fact detail icine `Kayittan Cikar` aksiyonu eklendi; bu aksiyon mevcut `toggleSave` state'ini kullandigi icin feed ve library ayni bookmark durumunu paylasiyor.

#### P2-08d Bookmark Sync Optimization Ilk Dilimi Eklendi
- `syncSavedFacts()` cagrisinin her feed fetch sonrasinda calismasi kaldirildi; bookmark hydration artik auth/session listener ve save mutation akisina bagli.
- Bu turda davranis degismeden, feed yenilenirken gereksiz bookmark sorgulari azaltildi.
- Ikinci dilimde save/unsave mutation sonrasi tam re-sync kaldirildi; optimistic local patch ve hata rollback'i korunarak her tikta tekrar bookmark sorgusu atilmasi engellendi.

#### P1-15 Prompt Guven Katmani Sıkılaştırildi
- Groq promptuna "yorum yapma, bilgi uydurma, yalnizca kaynakta acikca desteklenen bilgiyi yaz" kurali eklendi.
- Kategori bazli prompt yonlendirmeleri de ayni cizgiye cekildi; tarih, bilim, felsefe, teknoloji ve saglik kartlarinda kaynakta olmayan ek yorum veya baglam uydurulmamasi acikca belirtildi.
- Source title ve category hint uzerinden calisan rule-based consistency gate eklendi; ikinci bir LLM cagrisi olmadan `source_topic_drift` ve `category_mismatch` durumlari reject edilebilir hale geldi.
- Wikipedia category tahmini regex tabanindan skor tabanli keyword yaklasimina gecirildi; belirgin kategori sapmalari azaltilirken random source havuzundaki sinirda ornekler icin filtre sertligi arttirildi.
- Source relevance filtresi sertlestirilip `0 aday` durumunda kategori rotasyonunu kontrollu sekilde gevseten fallback eklendi; boylece hat tamamen tikanmadan devam ederken kalan dusuk degerli biyografi ornekleri sonraki filtre turu icin isaretlendi.
- Dusuk degerli biyografi filtresi rafine edildi; gorev/unvan ozeti agirlikli kisi maddeleri daha kolay elenirken, fikir/kuram/araştırma degeri tasiyabilecek kisiler tamamen bloklanmadi.
- Tam `run-all` kontrolunde Wikipedia hatti 30 denemede `0` aday uretti ve NASA upstream `503` dondu; bu da kalite filtrelerinin dogru yone gittigini ama random source havuzunda asiri secici kaldigini gosterdi.
- Bunun uzerine Wikipedia hatti kategori bazli curated / semi-curated seed topic havuzuyla guclendirildi; sistem artik once secilmis konu listelerinden aday toplamayi deniyor, yalnizca yetmezse random fallback'e dusuyor.
- Ilk probe'da `Stoicism` basarili sekilde kaydedildi; buna karsin `Industrial Revolution` ciktisi consistency gate tarafinda `source_topic_drift` olarak elendi. Bu da yeni source stratejisinin calistigini ama Ingilizce source title ile Turkce output arasindaki konu esleme heuristiginin halen bir tur iyilestirme istedigini gosterdi.
- Sonraki ince ayarda consistency gate'e sinirli bir `EN -> TR concept alias` katmani eklendi; boylece `Battle of Thermopylae` ve `Ethics` gibi seed konular gereksiz `source_topic_drift` reject'ine dusmeden kaydolabildi.
- Alias katmani saglik tarafi icin de genisletildi; `Public -> Halk` ve `Health -> Saglik` eslesmeleri eklenerek `public health` benzeri temel seed konularin gereksiz reject alma riski azaltildi.
- Sonraki dilimde source-aware prompt yapisi baslatildi; NASA APOD icin ayrik yazim yonlendirmesi eklendi ve consistency gate source title'a ek olarak source excerpt'i de dikkate alir hale getirildi.
- `run-all` icine hem Wikipedia hem NASA APOD icin `source_url` preflight skip katmani eklendi; veritabaninda zaten bulunan kaynaklar Groq'a gonderilmeden once batch kontrolle atlanarak tekrar token harcamasi azaltildi.
- Yeni curated kaynaklar olarak `Stanford Encyclopedia of Philosophy` ve `MedlinePlus` connector'leri eklendi; bu kaynaklar da ayni quality gate, consistency gate ve source policy hattina baglandi.
- Source-aware prompt yapisi `stanford_philosophy` ve `medlineplus` icin genisletildi; ilk probe'larda Stanford uzerinden yeni veri yazildi, sonraki probe'da da MedlinePlus `Mental Health` karti basarili sekilde DB'ye kaydoldu.

### [v1.09] - 2026-04-18

#### P2-03d Feed Payload Optimization Ilk Dilimi Eklendi
- Mobil feed sorgusunda `select('*')` kaldirildi ve sadece kartin gercekten kullandigi alanlar cekilecek sekilde projection daraltildi.
- Bu turda davranis degismedi; yalnizca feed payload'i hafifletildi.
- Ikinci dilimde ilk acilista daha kucuk sayfa boyutu kullanilip ikinci parti arka planda prefetche verildi; boylece ilk kartin daha hizli gorunmesi hedeflendi.

#### P2-03e Feed Performance Measurement Ilk Dilimi Eklendi
- Feed sorgusu, ilk kart gorunumu ve ilk gorsel yuklenmesi icin ayri performans loglari eklendi.
- Bu turda davranis degistirilmedi; amac 15 saniyelik yuklenme hissinin veri mi, UI mi yoksa gorsel tarafindan mi geldigini ayirmakti.

#### P2-03b Feed Reading Interactions Ilk Dilimi Eklendi
- Feed kartinda baslik veya metne dokununca kart ici genis okuma modu acildi.
- Genis okuma modunda ve kullanici karta basili tutarken auto-advance progress bar pause etkisi veriyor.
- Uzun basliklar ellipsis ile sinirlandi; tam metin yalnizca genis modda aciliyor.
- Metin scroll'u sadece genis modda aktif hale getirildi ve bu mod sirasinda ana feed swipe'i gecici olarak kapatilarak scroll cakismasi azaltildi.
- Expanded mod, popup kart gorunumu yerine ayni gorsel ustunde daha dogal bir okuma katmanina yaklastirildi.
- Feed kategori filtrelemesi, `facts.category` alanindaki emoji ve format farklarina karsi normalize edilerek yeniden calisir hale getirildi.

#### P2-03c Feed Freshness Ilk Dilimi Eklendi
- Feed sirasina kontrollu rotation mantigi eklendi; ilk gorulen kartlar refresh, kategori degisimi ve yeniden girislerde farklilasabiliyor.
- Pull-to-refresh ve kategori secimi artik yeni bir rotation seed ile birlikte calisiyor.
- Uygulama background'dan active'e dondugunde feed rotation yenilenip reset fetch tetikleniyor.
- Alt nav'daki `Akis` sekmesine tekrar basmak da refresh + rotation davranisini tetikliyor.
- Rotation mantigi ikinci turda seeded shuffle'a gecirildi; kart sirasi artik daha belirgin sekilde degisebiliyor.
- Feed page size buyutuldu ve kategori seciminde bos durum gorulurse sinirli backfill denemesi eklendi; `Saglik` ve `Felsefe` gibi kategorilerde "Icerik bulunamadi" olasiligi azaltildi.
- Android emulator'da `AbortError` yaratan raw REST fetch kaldirildi; `facts` akisi mevcut Supabase client uzerinden alinacak sekilde sadeleştirildi.

#### P1-15f Category Prompt Strategy Uygulamasi Yapildi
- Facts stratejisi `genis kategori + tema/alt konu` modeliyle netlestirildi; cekirdek kategori seti Bilim, Tarih, Felsefe, Teknoloji ve Saglik olarak korundu.
- `Spor`, `Biyografi` ve `Sanat Tarihi` secondary/backlog kategori olarak konumlandirildi.
- Pipeline `groq.js` katmanina kategoriye ozel prompt yonlendirmeleri eklendi; artik her kategori ayni veri modeline yazarken farkli anlatim vurgulari kullaniyor.
- Roadmap ve gorev dosyalari source whitelist, duplicate, logging, quality gate ve category prompt strategy gercegine gore hizalandi.
- Wikipedia connector'unda hedef kategori rotasyonu ve tema havuzu eslesmesi eklendi; random source selection artik sadece kategori tahmini degil, tema baglantisiyla da filtreleniyor.

#### Phase 2: P2-02 FlashList Gecisinin Ilk Turu Yapildi
- Mobil feed ekraninin ana liste katmani `FlatList`ten `FlashList`e tasindi.
- Pagination, refresh ve aktif kart takibi ayni davranis korunacak sekilde yeni listeye baglandi.
- Paket kurulumu sirasinda bozulan monorepo React type resolution, root `@types/react` cozumunu geri getirerek stabil hale alindi.
- Canli swipe ve pagination dogrulamasi bir sonraki adimda Android emulator ve web preview uzerinde tamamlanacak.

#### P1-15b Icin Ilk Source Whitelist Enforcement Dilimi Eklendi
- Pipeline icine ayri `source-policy` modulu eklendi ve `verified` rozetinin kaynaga gore hesaplanmasi teknik olarak enforce edilmeye baslandi.
- `insertFact` akisi artik `verified` alanini insert oncesi whitelist kurallariyla yeniden uretir; Groq ciktisi bu karari tek basina vermez.
- Ilk tur whitelist `wikipedia.org` ve `nasa.gov` ailesiyle sinirli tutuldu; genisleme sonraki backlog dilimlerine birakildi.

#### P1-15c Icin Ilk Duplicate Guard Dilimi Eklendi
- Pipeline icine ayri `duplicate-policy` modulu eklendi.
- `source_url` duplicate kontrolune ek olarak ayni kategori icinde normalize edilmis `title` esitligi ile ikinci bir guard eklendi.
- Metin fingerprint veya benzerlik skoru tabanli agir duplicate mantigi bilincli olarak sonraya birakildi.

#### P1-15d Icin Ilk Pipeline Run Summary Loglari Eklendi
- `insertFact` boolean yerine status kodu donen standart bir sonuc yapisina tasindi.
- `run-all` runner'i artik source bazli ve toplam summary olarak `saved`, `duplicate_source_url`, `duplicate_title`, `insert_error`, `groq_failed` ve `verified_true` sayilarini basiyor.
- `test.js` runner'i da yeni sonuc formatina uyarlandi.

#### P1-15e Icin Ilk Fact Quality Gate Dilimi Eklendi
- Pipeline icine ayri `quality-policy` modulu eklendi ve dusuk kaliteli fact ciktilari insert oncesi elenmeye baslandi.
- Kalite gate; title, content, source alanlari, kategori ve tag yeterliligini kontrol ederek `quality_rejected:*` status kodu uretir.
- Groq promptu soru-cumlesi basliklari ve bos kategori cikisini azaltacak sekilde sikilastirildi.
- Wikipedia random summary kaynaginda dusuk bilgi degerli maddeleri daha basta elemek icin source-level filtre eklendi.
- Groq katmanina, kisa veya yuzeysel icerik gelirse tek seferlik "daha derin anlat" retry mekanizmasi eklendi.
- `json_validate_failed` hatalarinda `failed_generation` taslagi uzerinden tek seferlik JSON repair recovery eklendi.

---
### [v1.08] - 2026-04-18

#### Phase 2: P2-11 Facts Veri Modeli Hizasi Tamamlandi
- `facts` generated row tipi saf hale getirildi; UI-only `likes` ve gradient alanlari artik schema tipine eklenmiyor.
- Feed normalize katmani, gorsel sunum icin gerekli varsayimlari runtime default olarak uretmeye tasindi.
- `P2-11` roadmap maddesi ve gorev kaydi, gereksiz DB migration acmadan veri modeli ile UI modeli ayrilarak kapatildi.

---
### [v1.07] - 2026-04-18

#### Phase 2: P2-10 Supabase Type Sync Tamamlandi
- Linked remote Supabase projesinden guncel TypeScript schema tipleri generate edilip `apps/mobile/src/types/supabase.ts` altina alindi.
- `src/types/index.ts` icinde generated `Database` ve temel row alias'lari export edildi.
- `facts`, `books`, `book_sections` ve `book_highlights` tarafindaki manuel row tiplerinin kritik kisimlari generated schema tiplerine baglandi.
- `P2-10` roadmap maddesi ve gorev kaydi bu ilk tam hizalama turu icin kapatildi.

---
### [v1.06] - 2026-04-18

#### P2-07 Icin Whitelist ve Duplicate Backlog Baglantilari Netlestirildi
- `content_curation_workflow` belgesine source whitelist enforcement ve duplicate enforcement siralari eklendi.
- `P1-15b` ve `P1-15c` backlog maddelerinin, `P2-07` operasyon kurallarinin teknik enforcement adimlari oldugu acikca baglandi.
- `P2-07` task dosyasinda whitelist/duplicate backlog referanslarini workflow'a baglama maddesi tamamlandi.

---
### [v1.05] - 2026-04-18

#### P2-07 Icin Field-Level Fact Kalite Kurallari Netlestirildi
- Icerik kuratorluk workflow belgesi temiz ASCII ile yeniden yazildi ve urun niyeti netlestirildi: fact karti nihai icerik degil, kullaniciyi kaynaga goturen merak giris noktasi olmali.
- `facts` alanlari icin field-level MVP checklist eklendi: `title`, `content`, `source_url`, `source_label`, `category`, `tags`, `verified`, `media_url`.
- Groq tarafinda "uydurma yapmama, kaynagi bozmama, daha derin okumayi anlamsizlastirmama" kurallari acikca yazildi.
- `P2-07` task dosyasinda minimum kalite checklist'i veri alanlarina baglama maddesi tamamlandi.

---
### [v1.04] - 2026-04-18

#### P2-07 Kapsami MVP Gercegine Gore Sadelestirildi
- Icerik kuratorluk surecinde tam manuel editor review queue'nun MVP icin zorunlu olmadigi netlestirildi.
- `P1-19` roadmap maddesi, post-MVP operasyon olgunlastirma isi olarak yeniden cercevelendi.
- `P2-07` task ve `content_curation_workflow` belgeleri, once otomatik quality gate + whitelist + duplicate kontrolune odaklanacak sekilde sadeletildi.

---
### [v1.03] - 2026-04-18

#### Phase 2: P2-07 Icerik Kuratorluk Sureci Baslatildi
- `P2-07` icin ayri task dosyasi acildi ve is alt adimlara bolundu.
- `docs/content_curation_workflow.md` ile feed'e girecek kartlar icin operasyonel lifecycle, review checklist'i ve verified/duplicate kurallari yazildi.
- `content_strategy` belgesi bu workflow'a referans verecek sekilde hizalandi.

---
### [v1.02] - 2026-04-18

#### Android ve iOS Icin Safe-Area / Gesture Bar Uyumlamasi Eklendi
- Root layout `SafeAreaProvider` ile sarmalandi; boylece tum ekranlar gercek cihaz inset degerlerini tutarli sekilde alabilecek.
- Alt tab bar artik sabit yukseklik yerine gercek bottom inset ile hesaplanacak; iOS home indicator ve Android gesture bar ile cakisma riski azaltildi.
- Feed ekraninda ust navbar ve alt aksiyon/progress alanlari sabit sayilar yerine `useSafeAreaInsets` ve `useBottomTabBarHeight` ile konumlanmaya basladi.
- Kitap okuyucu ekraninda ust navigasyon ve bolum pager alani da guvenli inset degerleriyle hizalandi.

---
### [v1.01] - 2026-04-18

#### Remote Feed URL Cozumlemesinde Double-Encode Hatasi Duzeltildi
- Android feed'de bazı Wikimedia gorselleri gelmiyordu; kok neden URL'in zaten encode edilmis karakterler icermesi ve istemci tarafinda bir kez daha encode edilmesiydi.
- `facts.media_url` uzak kaynaklari artik ham ama trimlenmis haliyle kullaniliyor; bu sayede `%28`, `%29`, `%2C` gibi mevcut kodlamalar bozulmuyor.
- Bu duzeltme ozellikle Lucien Brouha karti gibi parantezli dosya adlarina sahip gorselleri hedefliyor.

---
### [v1.00] - 2026-04-18

#### Android Feed Remote Gorselleri Icin `expo-image` Render Yolu Eklendi
- Remote `facts.media_url` verisinin Supabase'den dogru geldigi dogrulandi; sorun veri degil Android render katmaniydi.
- Feed kartinda uzak URL ile gelen arka plan resimleri icin `react-native` `Image` yerine daha guvenilir `expo-image` yolu eklendi.
- Yerel asset anahtarlari mevcut davranisini koruyor; degisiklik sadece remote DB gorsellerini hedefliyor.

---
### [v0.99] - 2026-04-18

#### Android Feed Karti Icin Scroll Alani ve DB-Gorsel Davranisi Geri Hizalandi
- Facts karti icindeki metin alani yeniden kendi icinde scroll olacak sekilde geri alindi; kartin geri kalan yuzeyi ana swipe davranisinda kalacak.
- Kategori bazli zorunlu fallback gorseller kaldirildi; feed arka plan resmi yeniden sadece veritabanindan gelen `media_url` kaynagina gore cizilecek.
- `media_url` cozumleyicisi trim ve URL encode ile sertlestirildi; gecerli olmayan kaynak varsa kart gorselsiz ama stabil kalacak.

---
### [v0.98] - 2026-04-18

#### Android Feed Icin Swipe ve Gorsel Fallback Sertlestirildi
- Facts karti icindeki dikey icerik `ScrollView` kaldirildi; boylece Android'de paged feed swipe hareketini yutan ic scroll katmani temizlendi.
- Facts kartlari artik tam ekran tek parca swipe yuzeyi gibi davranacak sekilde sadeletirildi.
- Remote gorsel yuklenemezse kart aninda kategoriye uygun yerel fallback gorseline donecek.
- Beklenen `AsyncStorage legacy storage` hatasi warning olarak gosterilmeyip sessiz fallback davranisina alindi.

---
### [v0.97] - 2026-04-17

#### Native Feed Icin Storage Warning Spam ve Gorsel Fallback Iyilestirildi
- Supabase auth storage fallback'i sertlestirildi; native `AsyncStorage` ilk hata sonrasinda tekrar tekrar denenmeyecek ve warning sadece bir kez loglanacak.
- Facts ekraninda media anahtari veya uzak gorsel cozulmezse kartlar kategoriye gore yerel fallback arka plan ile render edilecek.
- Bu duzeltme Android emulator / Expo Go testlerinde hem log gurultusunu azaltmayi hem de feed kartlarinin gorselsiz kalmamasini hedefliyor.

---
### [v0.96] - 2026-04-17

#### Native Feed Icin Anon Auth ve Gorsel Kaynak Cozumu Sertlestirildi
- Facts ekraninda anonim kullanicilar icin bookmark senkronu `getUser()` yerine `getSession()` ile kontrol edilmeye baslandi; boylece `Auth session missing!` hatasi gereksiz hata logu olarak gorunmeyecek.
- Feed kartlarinda gorsel kaynagi artik guvenli sekilde cozuluyor; bilinmeyen `media_url` anahtari gelirse kart bozulmadan arka plansiz render edilecek.
- Bu duzeltme Android emulator / Expo Go testlerinde facts ekraninin daha temiz ve stabil davranmasini hedefliyor.

---
### [v0.95] - 2026-04-17

#### Native AsyncStorage Sorunu Icin Supabase Auth Storage Fallback Eklendi
- Android emulator'da gorulen `AsyncStorageError: Native module is null` hatasi sonrasinda, Supabase auth storage katmani guvenli fallback ile sertlestirildi.
- Native ortamda `AsyncStorage` modulu erisilemez veya calisma aninda hata verirse, auth storage artik in-memory fallback ile devam edecek ve uygulama akisi coken bir hata vermeyecek.
- Bu cozum emulator / Expo Go ortaminda native storage hatalari olsa bile feed, reader ve Supabase sorgularinin calismaya devam etmesini hedefliyor.

---
### [v0.94] - 2026-04-17

#### Android Emulator Icin Duplicate React / Invalid Hook Call Sorunu Sertlestirildi
- Android emulator'da gorulen `Invalid hook call` hatasinin, workspace icinde birden fazla fiziksel React kopyasi bulunmasi ve Metro'nun bunlari farkli yerlerden cozmesiyle iliskili oldugu tespit edildi.
- `apps/mobile/metro.config.js` monorepo uyumlu hale getirildi; Metro artik root workspace `node_modules` altindaki tek React/React Native kopyasina zorlanacak.
- Bu degisiklik native/emulator tarafinda `expo-keep-awake` ve `withDevTools` uzerinden gorulen hook hatasini gidermeyi hedefliyor.

---
### [v0.93] - 2026-04-17

#### Phase 2: P2-09 Feed Pagination Gorevi Kapatildi
- Feed pagination task dosyasindaki son kontrol maddesi tamamlandi.
- Roadmap icinde `P2-09` maddesi gercek duruma gore `done` olarak guncellendi.
- Bir sonraki odak alani olarak `P2-07` icerik kuratorluk sureci ve feed kalitesini urun seviyesinde guclendirecek isler acik kaldi.

---
### [v0.92] - 2026-04-17

#### Phase 2: Feed Refresh/Reset Akisi Eklendi
- `P2-09` kapsaminda feed icin `refreshFacts` aksiyonu eklendi.
- Feed ekraninda pull-to-refresh / reset davranisi baglandi; boylece pagination altyapisi sadece ileri sayfa degil, temiz bastan yukleme akisina da kavustu.
- Gorev dosyasinda pagination'in refresh adimi tamamlandi.

---
### [v0.91] - 2026-04-17

#### Phase 2 Basladi: Feed Pagination Temeli Kuruldu
- `P2-09` icin task dosyasi acildi ve feed pagination isi alt adimlara bolundu.
- Feed store'a `hasMore`, `isLoadingMore` ve sayfa boyutu bazli yukleme mantigi eklendi.
- Feed ekrani `loadMoreFacts` akisina baglandi; boylece mevcut tam ekran akisi korunurken sonraki sayfalar icin altyapi hazirlandi.

---
### [v0.90] - 2026-04-16

#### FTUE Icin Arastirma Notu ve Yeniden Deneme Cercevesi Eklendi
- `roadmap_todo` icinde `P1-00e` maddesi, "tamamlandi" yerine kontrollu rollback sonrasi yeniden tasarim gerektiren is olarak guncellendi.
- `docs/ftue_research.md` olusturuldu; burada FTUE icin product-first ama web-safe ikinci deneme cercevesi yazildi.
- `lessons.md` icine FTUE'nin neden root-global modal yerine progressive, route-level ve inline yaklasimla gelmesi gerektigi ayri ders olarak eklendi.

---
### [v0.89] - 2026-04-16

#### Auth Prompt Web'de Eski Uygulama Ici Modal Davranisina Donduruldu
- FTUE entegrasyonu kontrollu rollback ile kaldirildiktan sonra, auth prompt'u web icin `window.confirm` akisinda tutmaya gerek kalmadi.
- `promptForAuth` yeniden store tabanli uygulama ici modal davranisina donduruldu.
- Root layout'ta `AuthPromptModal` yeniden web dahil tum platformlarda render edilecek sekilde geri alindi.

---
### [v0.88] - 2026-04-16

#### Feed Icin Web Kart Fallback Render'i Geri Alindi
- Geçmiş kayıtlar incelendiğinde feed'in görsel olarak bozulduğu noktanın `v0.84` ile eklenen web'e özel kart fallback render'i olduğu netleşti.
- Bu özel render tamamen kaldırıldı; feed tekrar eski tam ekran dikey scroll davranışına geri döndü.
- Bu turda yalnızca feed ekranının görünümü geri alındı; tıklanabilirlik için yapılan diğer izole düzeltmeler korundu.

---
### [v0.87] - 2026-04-16

#### Feed Veri Kaynagi Eski Gercek Akisa Geri Alindi
- Feed store icindeki fallback bilgi kartlari tamamen devreden cikarildi; bunlar yanlis urun hissi yaratiyordu.
- Feed yeniden dogrudan `facts` REST endpoint'inden okunacak sekilde geriye alindi.
- Hata durumunda artik yanlis fallback icerik gostermek yerine bos durum korunuyor; bu sayede yanlis veri gostermek yerine gercek veri sorununu ayri debug edebilecegiz.

---
### [v0.86] - 2026-04-16

#### FTUE Entegrasyonu Kontrollu Olarak Devreden Cikarildi
- Sorunlarin FTUE eklendikten sonra belirginlesmesi uzerine, root layout icindeki FTUE entegrasyonu tamamen devreden cikarildi.
- Profil ekranindaki FTUE giris yoluna bagli metin de notr hale getirildi; boylece uygulama FTUE oncesi auth/profiling davranisina daha yakin hale getirildi.
- Bu adim, yeni ozellik eklemek yerine web preview stabilitesini geri kazanmak icin kontrollu rollback amaciyla yapildi.

---
### [v0.85] - 2026-04-16

#### Web'de Inactive Tab Overlay Ihtimaline Karsi Ekranlar Gizlendi
- Feed, kutuphane, profil ve reader tab ekranlari web'de odakta degilken `display: none` ile gizleniyor.
- Bu degisiklik, bir sekmedeki tam ekran veya absolute katmanin diger sekmeleri gorunmez sekilde bloklamasi ihtimaline karsi yapildi.
- Bu turda yeni ozellik eklemek yerine sadece "tiklanamazlik" kok nedenini izole etmeye odaklanildi.

---
### [v0.84] - 2026-04-16

#### Web Preview Icin Sekme Overlay Riski Azaltildi ve Feed Gecici Olarak Okunur Moda Alindi
- Web'de sekmeler blur oldugunda ekranlarin unmount olmasi saglandi; boylece bir sekmedeki absolute katmanlarin diger sekmeleri ortmesi riski azaltildi.
- Feed, web preview icin gecici olarak okunur kart akisina alindi; bu degisiklik siyah tam ekran deneyim yerine gorunur ve tiklanabilir bir feed vermeyi hedefliyor.
- Bu tur "web preview stabil olsun" onceligiyle yapildi; native/mobil deneyim korunurken web tarafinda daha savunmali bir render secildi.

---
### [v0.83] - 2026-04-16

#### Koku Bulunan Web Sorunu Icin Auth ve FTUE Akisi Sadelestirildi
- Sorunun kullanicinin login olmamis olmasi degil, web preview'da auth init ve FTUE katmanlarinin UI'yi gereksiz yere bloklayacak hale gelmesi oldugu netlestirildi.
- Auth store artik ilk render'da bloklayici `isInitializing` durumuyla baslamiyor; UI oturum beklerken kilitlenmek yerine hemen kullanilabilir kaliyor.
- Web tarafinda FTUE'nin otomatik acilisi devre disi birakildi; boylece preview ortami kalici state ve modal overlay riskinden izole edildi.
- Feed tekrar guvenli fallback + arka planda remote yenileme modeline alindi; kullanici login olmasa bile ana akis bos kalmayacak sekilde sertlestirildi.

---
### [v0.82] - 2026-04-16

#### Web Stabilitesi Icin Modal ve Feed Veri Akisi Sertlestirildi
- FTUE ve auth prompt modal'lari web'de global overlay riski yaratmamasi icin root layout'tan kaldirildi; web tarafinda auth istemi yeniden yerel confirm akisina alindi.
- Feed veri akisi raw `fetch` yerine dogrudan Supabase client uzerinden okunacak sekilde guncellendi; timeout durumunda fallback fact'ler korunuyor.
- Bu tur, ozellikle `web preview` icin "hicbir yere tiklanamiyor" ve "feed bos kaliyor" hissini azaltmak uzere stabilite odakli yapildi.

---
### [v0.81] - 2026-04-16

#### Feed Icin Guvenli Rollback Yapildi
- Emergency fallback turunda feed'in baslangic verisini kalici fallback kartlara cekmemiz, gercek Supabase fact akisinin hic calismamasina neden oluyordu.
- Feed store yeniden gercek remote fetch odakli hale getirildi; fallback veri yalnizca hata durumunda kullaniliyor.
- Web'de gorunen bozulmus fallback kart akisi geri alindi ve feed'in onceki immersive tam ekran deneyimi korundu.

---
### [v0.80] - 2026-04-16

#### Web Feed ve Profil Icin Daha Sert Kullanilabilirlik Toparlamasi Yapildi
- Feed fallback akisi artik siyah immersive ekran yerine gorunur bilgi kartlariyla aciliyor; boylece web'de ilk yuklemede ekran bossa bile okunabilir ve tiklanabilir bir deneyim kalıyor.
- Profil auth karti sonsuz `Oturum kontrol ediliyor...` spinner'i yerine formu her zaman acabilir hale getirildi; auth init surerken kullanici yine de giris veya kayit deneyimine devam edebiliyor.
- Root auth init timeout'u kisaltildi ve timeout durumunda session `null` kabul edilerek uygulamanin kilitli bekleme durumunda kalmasi daha agresif bicimde engellendi.

---
### [v0.79] - 2026-04-16

#### Web Etkilesimi Icin Global Modal Render Koruma Eklendi
- `AuthPromptModal` ve `FtueModal`, `visible` false iken artik hic render edilmiyor.
- Boylece web preview'da gorunmeyen modal katmaninin tum dokunmalari yutmasi ve ekranlarin tiklanamaz hale gelmesi riski azaltildi.

---
### [v0.78] - 2026-04-16

#### Feed, Kutuphane ve Profil Icın Acil UX Fallback Katmani Eklendi
- Feed store baslangic durumu fallback kartlarla acilacak sekilde guncellendi; boylece remote veri gec gelse bile ekran bos kalmayacak.
- Kutuphane ekrani ilk render'da fallback kitap kataloguyla aciliyor; remote veri geldikce yerini canli veriye birakiyor.
- Profil ekranina, auth init beklenmedik sekilde uzun surerse sonsuz spinner yerine auth formunu gosteren local timeout korumasi eklendi.

---
### [v0.77] - 2026-04-16

#### Web Preview Icin Veri ve Auth Fallback Sertlestirmesi
- Feed fetch akisi timeout veya remote hata durumunda bos ekran vermek yerine fallback bilgi kartlariyla acilacak sekilde guclendirildi.
- Kutuphane ve tekil kitap fetch akislarina timeout fallback eklendi; Supabase gec cevap verirse local fallback katalog devreye girecek.
- Root layout icinde auth `getSession()` cagrisi icin timeout fallback eklendi ve Ionicons fontu explicit yuklenerek web preview'daki kayip ikon riski azaltildi.

---
### [v0.76] - 2026-04-16

#### FTUE Hydration Yarisi Sertlestirildi
- Soft FTUE store'una `hasHydrated` korumasi eklendi.
- Boylece persist hidrasyonu tamamlanmadan FTUE modal'i acilmiyor; web preview'da ilk yuklemede icerigin ustunun yarim/erken modal ile kaplanma riski azaltildi.

---
### [v0.75] - 2026-04-16

#### Soft FTUE Profiling'e Baglandi ve Kayitlar Kapatildi
- Soft FTUE icindeki ilk yol secimi (`Feed'e Gec` veya `Serbest Kitabi Gor`) artik onboarding store'a yaziliyor.
- Profile ekranindaki interest picker karti, kullanicinin FTUE'de sectigi ilk deneyim yoluna gore uyarlanan bir mesajla aciliyor.
- `P1-00e` task dosyasi, roadmap, mimari notlar ve mobil README mevcut FTUE gercegiyle hizalanarak kapatildi.

---
### [v0.74] - 2026-04-16

#### FTUE CTA'lari Gercek Akisa Baglandi
- Soft FTUE icindeki `Feed'e Gec` aksiyonu kesif akisini, `Serbest Kitabi Gor` aksiyonu ise dogrudan free anchor kitabi acacak sekilde baglandi.
- Boylece FTUE artik sadece tanitim katmani degil, urunun iki ana ilk deneyim yoluna gercek giris noktasi haline geldi.

---
### [v0.73] - 2026-04-16

#### Soft FTUE Iskeleti Baslatildi
- `P1-00e` icin task dosyasi acildi ve value-first bir FTUE omurgasi tanimlandi.
- İlk acilista tek sefer gostecek, kapatilabilir ve kalici durumda tutulacak `ftueStore` eklendi.
- Feed ve serbest kitaba yonlendiren global FTUE modal'i root layout altina baglandi.

---
### [v0.72] - 2026-04-16

#### P3-10c Remote Senkron ve Gorev Kapanisi Tamamlandi
- `20260416094637_p3_10c_full_readable_sections_phase1.sql` migration'i linked remote Supabase proje ile senkron durumda dogrulandi.
- `P3-10c` gorevindeki son acik madde kapatildi; ilk iki kitap icin full-readable phase-1 akis teknik ve dokumantasyon tarafinda tamamlandi.

---
### [v0.71] - 2026-04-16

#### Roadmap Gercek Duruma Gore Hizalandi
- Auth foundation, value-first auth ve guest mode tarafinda tamamlanmis ama roadmap'te acik gorunen maddeler guncellendi.
- `P1-11e` maddesi, gercek kalan kapsam olan profiling persist ve gunluk hedef/bildirim adimlari ile yeniden yazildi.
- `P3-10c` maddesi de teknik olarak biten UI/icerik hazirligindan ayrilarak yalnizca remote migration kapanisi acik kalacak sekilde netlestirildi.

---
### [v0.70] - 2026-04-16

#### Premium Kitap Rozeti Urun Diline Gore Sadelestirildi
- Kutuphane kartlarinda premium eserler icin `AUTH + PRO` rozeti kaldirildi, sadece `Premium` etiketi birakildi.
- Oturumsuz kullanici premium kitaba dokundugunda davranis korunarak once auth akisina yonlendirme devam ettirildi.
- Boylece kitap kartinda teknik kural yerine urun etiketinin gorunmesi saglandi.

---
### [v0.69] - 2026-04-16

#### Reader Section-Per-Screen Deneyimine Tasindi
- Reader ekraninda `book_sections` verisi olan kitaplar artik facts/feed mantigina yakin sekilde bolum bolum tam ekran davranisla okunuyor.
- Her section tek ekranlike his verecek sekilde `FlatList + pagingEnabled` yapisina tasindi; dikey scroll artik bolumler arasi gecis sagliyor.
- Navigation ustunde aktif bolum sayaci gosterilmeye baslandi ve highlight/popup akisi yeni section pager yapisinda korundu.

---
### [v0.68] - 2026-04-16

#### Full Readable Sections Phase-1 Hazirlandi
- `Kendime Dusunceler` ve `The Problems of Philosophy` icin 6'ser bolumluk daha uzun `book_sections` seed migration'i hazirlandi.
- `book_highlights` verisi bu iki kitap icin yeni bolum akislarina gore yenilendi.
- Reader fallback icerigi, eski `Ask ve Gurur` slice'i yerine `The Problems of Philosophy` ile hizalandi.

---
### [v0.66] - 2026-04-16

#### 10 Kitaplik Learning Library Remote'a Uygulandi
- `20260416093057_p3_27_learning_library_shortlist.sql` migration'i remote Supabase projesine basildi.
- 10 kitaplik non-fiction katalog artik remote `books` tablosunda aktif hale geldi; kütüphane runtime'i fallback yerine gercek katalogla hizalanmis durumda.

---

### [v0.65] - 2026-04-16

#### 10 Kitaplik Learning Library Shortlist Hazirlandi
- Aktif katalog roman agirliktan cikarilip 10 kitaplik non-fiction ogrenme rafina tasindi.
- `books` tablosu icin yeni migration hazirlandi; `Kendime Dusunceler` serbest anchor olarak korunurken kalan 9 eser premium shelf olarak tanimlandi.
- Mobil fallback katalogu ve kutuphane branded cover sistemi yeni shortlist'e gore guncellendi.

---

### [v0.64] - 2026-04-16

#### Book Access Policy Migration Remote'a Uygulandi
- `20260416091903_p3_26_book_access_policy.sql` migration'i remote Supabase projesine basildi.
- `access_tier` alani artik remote `books` tablosunda aktif; runtime free anchor / premium ayrimi veritabanindaki gercek veriyle hizalandi.

---

### [v0.63] - 2026-04-16

#### Book Access Policy Runtime'a Tasindi
- `books` tablosu icin `access_tier` bazli kitap erisim modeli hazirlandi; `Kendime Dusunceler` serbest anchor metin, kalan katalog ise premium katmana cekildi.
- Library ekraninda rozetler ve aciklama metinleri `FREE` / `AUTH + PRO` / `PREMIUM` davranisina gore guncellendi.
- Reader ekraninda auth ve premium icin ayri kilit durumlari eklendi; gercek entitlement baglantisinin RevenueCat gorevine birakildigi acikca belirtildi.

---

### [v0.57] - 2026-04-15

#### Book Sections Seed Migration Remote'a Uygulandi
- `20260415200314_p3_10b_seed_book_sections.sql` migration'i remote Supabase migration history listesinde `applied` olarak dogrulandi.
- `P3-10b` gorevindeki remote seed adimi tamamlandi; acik kalan tek teknik madde highlight/popup sistemini section bazli icerik modeliyle hizalamak.

---
### [v0.58] - 2026-04-15

#### Section Highlight ve Bolum Kaydirma Deneyimi Geri Geldi
- `book_sections` plain text verisi, kitap-ozel tanimlar kullanilarak yeniden keyword/reference highlight parcalarina cevrilmeye baslandi.
- Reader ekraninda section verisi varsa kart benzeri bolum bloklari ve `pagingEnabled` ile bolumler arasi daha net dikey kaydirma hissi eklendi.
- `P3-10b` gorevindeki son acik madde de kapanarak section bazli reader gecisi tamamlandi.

---
### [v0.59] - 2026-04-15

#### Reader Yeniden Tam Ekran Metin Akisina Yaklastirildi
- Section reader gorunumu kart hissinden cikarilip tekrar tam ekran metin akisina yaklastirildi.
- `Kendime Dusunceler` ve `Ask ve Gurur` icin gercek section metinlerinde gecen yeni anahtar kelime ve referans terimleri tanim sozlugune eklendi.
- Boylece highlighted word yapisi section tabanli okumada daha gorunur ve urun diline daha yakin hale geldi.

---
### [v0.60] - 2026-04-16

#### Book Highlights Kaynagi DB Tarafina Tasinmaya Basladi
- `book_highlights` tablosu icin section-aware metadata ve explanation alanlari iceren yeni migration hazirlandi.
- `Kendime Dusunceler` ve `Ask ve Gurur` icin ilk remote highlight seed verisi migration'a eklendi.
- Reader highlight sozlugu artik `book_highlights` tablosundan gelmeyi deniyor; veri yoksa mevcut local fallback korunuyor.

---
### [v0.61] - 2026-04-16

#### Book Highlights Migration Remote ile Senkronlandi
- `npx supabase db push --linked --yes` sonrasinda remote tarafin guncel oldugu dogrulandi ve `P3-12b` icindeki migration adimi kapatildi.
- Reader highlight akisi artik local fallback yerine oncelikle remote `book_highlights` verisini kullanacak durumda tutuldu.

---
### [v0.62] - 2026-04-16

#### Content Strategy ve Erisim Modeli Urun Karari Olarak Netlestirildi
- Kutuphane stratejisi genel okuma katalogundan `AI-assisted learning library` modeline kaydirildi.
- Roman agirligi secondary stratejiye cekildi; tarih, bilim, felsefe ve biyografi odakli non-fiction katalog ana yon olarak yazildi.
- MVP kitap erisim kuralı `1 serbest metin + diger metinlerde auth + premium katmaninda auth/premium birlikte` olacak sekilde dokumanlara islendi.
- `P3-16` tanim favorileri, MVP zorunlulugu olmadigi icin backlog seviyesinde yeniden konumlandirildi.

---

## Versiyon Geçmişi

---

### [v0.38] — 2026-04-15

#### Chat History Reader Hydration
- Reader ekrani acilisinda kullanici + kitap baglamina ait son `chat_sessions` kaydi yuklenir hale getirildi.
- Kayitli sohbet varsa mevcut mesajlar hydrate edilir; kayit yoksa ilk acilis fallback sohbet mesaji korunur.
- `npm run lint` ve `npm run typecheck` yeniden dogrulandi.

---

### [v0.37] — 2026-04-15

#### Chat History Persistence Baslangici
- `P3-20` icin gorev dosyasi `docs/tasks/` altinda olusturuldu.
- Mobil uygulamaya `chat_sessions` tablosu icin guvenli Supabase helper katmani eklendi.
- Auth yoksa fallback, auth varsa kullanici ve kitap baglamina gore son session'i yukle / kaydet altyapisi hazirlandi.

---

### [v0.36] — 2026-04-15

#### Kalite Kapilari Web Preview Sonrasi Tekrar Yesile Cekildi
- Web preview sirasinda olusan React tip uyumsuzlugu izole edilip `typecheck` tekrar basarili hale getirildi.
- Biome konfigürasyonu generated Expo dosyalarini (`.expo/**`) ve Supabase gecici link dosyalarini kalite kapsamindan cikaracak sekilde netlestirildi.
- `npm run lint` ve `npm run typecheck` yeniden dogrulandi.

---

### [v0.13] — 2026-04-13

#### Proje Denetim Raporu ve Aksiyon Planı Eklendi
- Senior business analyst bakışıyla tüm proje için kapsamlı değerlendirme raporu hazırlandı.
- Ürün, teknik mimari, AI entegrasyonu, Supabase, kalite ve operasyonel olgunluk başlıklarında eksikler dokümante edildi.
- Bulguların uygulanabilir hale gelmesi için adım adım aksiyon planı oluşturuldu.
- Eklenen dosyalar:
  - `docs/project_audit_report.md`
  - `docs/project_action_plan.md`

#### Roadmap Onceliklendirmesi Guncellendi
- `docs/roadmap_todo.md` yeniden duzenlenerek en uste ayri bir `Stabilizasyon Sprinti` blogu eklendi.
- `lint`, `typecheck`, veri sozlesmesi hizalamasi, dokuman gerceklik guncellemesi ve CI typecheck isleri P0 seviyesine tasindi.
- Icerik uretim tarafinda Reddit vurgusu kaldirilarak daha guvenilir kaynak onceligi benimsendi.
- Upstash Redis gorevi, AI akislari canliya alindiktan sonraki asamaya cekildi.
- MVP kapsam tablosundaki bazi ozellikler `Evet` yerine `Kismen` veya `Planlandi` olarak gercege uygun hale getirildi.

---

### [v0.12] — 2026-04-12

#### 🆕 UI ve UX Mükemmelleştirmeleri
- **Cross-Platform Render (Taşma) Düzeltildi:** Uygulamanın Web/Chrome Inspector üzerinde çalıştırıldığında altta yer alan barın ya da navbarın scrollu kesmesi, `useWindowDimensions()` hook'u kullanılarak %100 tam ekrana optimize edildi. Web genişlik sınırı `maxWidth: 500` yapılarak profesyonel Reels çerçevesine oturtuldu.
- **Dinamik Kategori Filtreleme:** Kategori butonları tam işlevsel hale getirildi. Seçilen kategoriye ait kartların reaktif olarak gelmesi (`useMemo`) ve Türkçe küçük/büyük harf ("İ, I" uyumsuzluğu) hatası `toLocaleUpperCase('tr-TR')` ile ebediyen düzeltildi. Çift tıklamada filtre kapanıyor.
- **"Home" İşlevi eklendi:** `⚡ SmartScrolling` ikonuna basıldığında listeyi en tepeye sıfırlayan (`scrollToOffset: 0`) özellik kazandırıldı.
- **Orijinal Makaleye Git:** Etiketlerin sağındaki orijinal makale kaynağı `📖 Wikipedia` yazısı Tıklanabilir (`Linking.openURL`) bir butona dönüştürüldü.
- **Metin Okunabilirliği:** Yüksek kontrastlı (beyaz) AI fotoğrafları kullanıldığında yazıların kaybolmasını engelleyen arka plan `opacity` değeri %55'e çıkarıldı ve güçlü bir `textShadow` efekti kondu.

#### 🤖 AI Verihattı (Pipeline) ve 4K Görsel Entegrasyonu
- **Otomatik İçerik Kazıma:** Node.js üzerinde çalışan `packages/pipeline` modülü ayağa kaldırılarak Groq (LLaMA 3) destekli otomatik içerik jeneratörü yazıldı.
- **Görsel Kalitesi (Pollinations.ai):** Unsplash yerine `Pollinations.ai`'ye geçildi. 1080x1920 dikey boyutunda `dark, atmospheric, 4k, hyper-detailed` prompt parametreleriyle metin yapısını bozmayan devasa çözünürlükte görseller entegre edildi.
- **Kalite Filtrasyonu:** Yetersiz veya "dedikodu" seviyesindeki içerik kayıplarından dolayı Reddit sistemi yapıdan çıkarıldı. Yerine salt API'lerden çekilen **Wikipedia** ve **NASA** modülleri aktifleştirildi.
- **Servis Dokümantasyonu:** Gelecekte bir komutla (`npm run run:all`) veritabanını nasıl zenginleştireceğimizi anlatan dokümantasyon `docs/ai_pipeline_architecture.md` dosyasına kalıcı olarak eklendi.

---

### [v0.11] — 2026-04-12

#### 🆕 Supabase Cloud Entegrasyonu & Frontend Hata Giderme

- **Cloud Veritabanı Geçişi:** Lokal veritabanı şeması ve test verileri (seed data) uzaktaki Supabase projeye (`gfbhzvaqngaxucbjljht`) başarılı bir şekilde taşındı. RLS (Row-Level Security) politikaları aktif edildi.
- **Güvenli Kimlik Yönetimi:** `.env` dosyası oluşturuldu ve `supabaseUrl`, `supabaseAnonKey` ortam değişkenleri ayarlandı.
- **Zustand Önbellek (Hydration) Sorunu Çözüldü:** `useFeedStore` (Zustand) üzerinde kalıcı hale gelmiş (persist) `isLoading: true` durumu tarayıcıları kilitleyerek uygulamanın sürekli "Yükleniyor" ekranında kalmasına neden oluyordu.
  - Zustand `persist` middleware'i tamamen kaldırıldı. Store, `feedStore.ts` adlı taze bir yapı ile baştan oluşturuldu.
  - `fetchFacts` içerisinde doğrulanan REST API `fetch()` sistemi kullanılarak initialization kilitlenmeleri bypass edildi.
- **Veri Eşleme Hataları Düzeltildi:** Veritabanından gelen property adları (`content` ve `source_label`) ile uygulamanın aradığı `item.text`, `item.source` değişkenleri eşlenerek UI sorunu çözüldü.
- **Web Paging Render Blokajı:** FlatList için dinamik yüklenen `listHeight > 0` şartı Web'in DOM hesaplamalarını bozduğu için kaldırıldı.

---

### [v0.10] — 2026-04-09

#### 🆕 UI Mimarisi: TikTok/Reels Tarzı SmartScrolling Akışı

- **Tam Ekran (Paging) Scroll:** Feed ekranı dikey yığınsal yapıdan çıkarılarak tam ekranlı `pagingEnabled` sistemine geçirildi (`FlatList`).
- **Absolute Overlay Tasarımı:** Kullanıcı arayüzü Tiktok mimarisi baz alınarak yeniden kodlandı:
  - Üst gezinme çubuğu (Top NavBar) scroll ile gizlenmek yerine kartların üzerine saydam bir "Static Overlay" olarak yerleştirildi. Böylece erişilebilirliği kalıcı kılındı.
  - "Hepsi" butonu yerine logoya yer verildi (**⚡ SmartScrolling**).
  - Aksiyon butonları (Beğen, Kaydet, Paylaş) dikey sütun olarak sağ alt köşeye taşındı.
  - Okuma süreleri `read_time_sq` değerine dinamik bağlanmış otomatik dolan (Auto-Scroll) ilerleme çubuğu ekranın statik alt tabanına yerleştirildi.
- Senkronize Dokunma Denetimleri (`onPressIn/Out`) ile ekrana basılı tutulduğunda akan zaman barının (ve otomatik kaydırmanın) durdurulması sağlandı.

#### 📝 İçerik Yönetim Stratejisi Belirlendi

- Wikipedia (Seçkin Maddeler), Reddit (AskHistorians vb.), NASA API ve Gutenberg projeleri kullanılarak "Verified" ve telifsiz bilgi çekme ağı planı dokümante edildi (`docs/content_strategy.md`).
- Roadmap "Phase 1.4 Veri ve İçerik Yönetimi" maddesi eklenerek yol haritası güncellendi.

---

### [v0.9] — 2026-04-09

#### 🆕 Backend Altyapısı (Phase 1.2) Kuruldu

- `supabase init` komutuyla Supabase lokal projesi başlatıldı ve yapılandırıldı.
- Veritabanı şeması ve **Row-Level Security (RLS)** kuralları `supabase/migrations/20260409000000_schema_and_rls.sql` içerisinde oluşturuldu:
  - Tablolar: `users`, `facts`, `books`, `book_highlights`, `reading_progress`, `bookmarks`, `chat_sessions`, `user_activity`.
  - Kullanıcıların sadece kendi verilerini görebilmesi/yönetebilmesi için RLS mekanizmaları güvenlik standartlarına (auth.uid()) göre kodlandı.
- Yapay zeka servisleri için Supabase Edge Functions çerçeveleri (`ai-chat` ve `ai-definition`) TypeScript + Deno temelli oluşturuldu.
- Demosu kurulacak bir sistem için `supabase/seed.sql` dosyası örnek verilerle (Sapiens, Kara Delikler vs.) dolduruldu.
- *Not: Lokal Supabase sunucusu ortamda Docker olmadığı için başlatılamadı.*

---

### [v0.8] — 2026-04-09

#### 🆕 Monorepo, Linter ve CI/CD Altyapısı Kuruldu

- **Turborepo** (`turbo.json`) eklendi ve proje monorepo (`workspaces: ["apps/*", "packages/*"]`) yapısına geçirildi.
- **Biome** (`biome.json`) yüklenerek proje standartlarına uygun (single quote, 100 line width, 2 spaces) formatter ve linter yapılandırıldı. ESLint ve Prettier'a modern/hızlı bir alternatif olarak devreye alındı.
- **GitHub Actions** (`.github/workflows/eas-build.yml`) eklendi:
  - Kod pushlandığında otomatik Biome lint/format check yapılması sağlandı.
  - Pull Request'lerde ve Main branch'indeki merge işlemlerinde **Expo EAS Build** üzerinden Android/iOS Production ve Preview build'leri tetiklenecek şekilde konfigüre edildi.

---

### [v0.7] — 2026-04-09

#### 🆕 Expo Projesi Yeniden Kuruldu + Tüm Ekranlar İmplementasyonu

- `create-expo-app` default template yeniden kuruldu (SDK 54 uyumlu, 908 paket)
- `app/_layout.tsx` → ThemeProvider kaldırıldı, dark-only StatusBar, `book/[id]` route eklendi
- `app/(tabs)/_layout.tsx` → 4 tab: Akış ✦, Kütüphane 📚, Okuyucu 📖, Profil 👤 — iOS frosted glass tab bar
- `app/(tabs)/index.tsx` → **Feed ekranı** tamamlandı:
  - 4 bilgi kartı (Bilim/Tarih/Felsefe/Teknoloji) renkli gradient header
  - Kategori chip filtresi (horizontal scroll)
  - Like (toggle) / Kaydet (toggle) / Paylaş aksiyonları
  - ✓ Doğrulandı rozeti, kaynak gösterimi
- `app/(tabs)/library.tsx` → **Kütüphane ekranı** tamamlandı:
  - iOS-style arama çubuğu
  - "Devam Et" horizontal scroll (ilerleme çubuğu %65 / %12)
  - 6 kitaplık grid (PRİM rozeti, yazar, emoji kapak)
  - Kitaba tıklayınca `book/[id]` reader'a yönlendirme
- `app/(tabs)/reader.tsx` → Okuyucu tab placeholder
- `app/(tabs)/profile.tsx` → **Profil ekranı** tamamlandı:
  - Avatar + kullanıcı adı + plan rozeti
  - 🔥 Streak: 7 gün sayacı, rekor 14 gün
  - 7 günlük aktivite dots (hepsi tamamlanmış, bugün glowing)
  - Stats grid: 42 Bilgi Kartı / 2 Kitap / 35 AI Sorgu
  - Settings listesi: Premium, Bildirimler, Görünüm, Dil, Çıkış
- `app/book/[id].tsx` → **Kitap Okuyucu ekranı** tamamlandı:
  - 4 paragraf Sapiens metni
  - Sarı highlighted `keyword` + mavi `reference` dokunulabilir kelimeler
  - Animated bottom sheet AI popup (Animated.spring)
  - AI typing efekti (karakter karakter yazılıyor)
  - "Yapay Zekaya Sor" CTA butonu
  - %22 ilerleme çubuğu
  - 5 kelime/kavram için tanım ve AI açıklaması
- ✅ **Uygulama http://localhost:8081 adresinde canlı ve doğrulandı**

---

### [v0.6] — 2026-04-08

#### 🆕 Browser UI Demo Oluşturuldu

- `demo/index.html` oluşturuldu — tek dosya, tarayıcıda açılabilen interaktif iOS demo
- Telefon frame (iPhone 14 oranı), Dynamic Island, status bar
- 4 ekran: Feed, Kütüphane, Okuyucu, Profil
- Tab bar navigasyon (JS ile ekranlar arası geçiş)
- Feed: bilgi kartları, kategori chips, like/save
- Kütüphane: kitap grid, devam et bölümü
- Okuyucu: highlighted kelimeler + AI bottom sheet popup + typing animasyonu
- Profil: streak sayacı, haftalık aktivite, istatistikler, ayarlar
- `npx serve` ile http://localhost:3456 adresinde yayınlandı
- ✅ Tüm ekranlar tarayıcıda doğrulandı

---

### [v0.5] — 2026-04-08

#### 🆕 Oluşturulan: `apps/mobile/` — Expo Projesi

- `create-expo-app` ile blank-typescript template kuruldu
- `package.json` güncellendi — tüm MVP bağımlılıkları eklendi:
  - expo-router, nativewind v4, zustand, tanstack-query, mmkv, supabase, flash-list, bottom-sheet, reanimated, lottie
- `app.json` → Expo Router, dark mode, scheme konfigürasyonu yapıldı
- `app/_layout.tsx` → GestureHandler + QueryClient root layout
- `app/(tabs)/_layout.tsx` → iOS frosted glass tab bar
- `app/(tabs)/index.tsx` → Feed placeholder
- `app/(tabs)/library.tsx` → Library placeholder
- `app/(tabs)/reader.tsx` → Reader placeholder
- `app/(tabs)/profile.tsx` → Profile placeholder
- `tailwind.config.js` → Design tokens (brand, surface, text renkleri)
- `babel.config.js` → NativeWind + path aliases + Reanimated
- `global.css` → NativeWind tailwind import
- `tsconfig.json` → strict + path aliases (@components, @stores, @hooks, @lib)
- `stores/useAuthStore.ts` → Zustand auth store
- `stores/useStreakStore.ts` → Zustand streak store
- `lib/supabase.ts` → Supabase client (env-based)
- `.env.example` → Supabase credential template
- `npm install` → 870 paket yüklendi ✅

---

### [v0.4] — 2026-04-08

#### 🆕 Oluşturulan: `tasks/lessons.md`

**Sebep:** `rules.md` kuralı gereği — her kullanıcı düzeltmesinden sonra dersler bu dosyaya eklenmeli.

**İçerik:**
- **L-001:** Dosyaları doğru dizine kaydetme kuralı (proje path vs. sistem path)
- **L-002:** CHANGELOG'un her değişiklikten sonra güncellenmesi zorunluluğu
- **L-003:** `IsArtifact` flag'i ile proje path'inin karıştırılmaması kuralı
- Hata istatistikleri tablosu eklendi

---

### [v0.3] — 2026-04-08

#### 🔁 Taşınan: `docs/roadmap_todo.md`

**Sebep:** Dosyalar yanlışlıkla sistem dizinine (`/.gemini/`) kaydedilmişti. Proje dizinine (`smartscrolling/docs/`) taşındı.

**Değişiklikler:**
- Dosya `c:\Users\Administrator\smartscrolling\docs\roadmap_todo.md` olarak yeniden oluşturuldu
- İçerik v0.2 ile tamamen aynı (kayıp yok)
- Phase 1 teknoloji listesi Biome ve EAS Build ile güncellendi
- Phase 2'de FlashList belirtildi (daha önce FlatList/FlashList ibaresi vardı)

#### 🔁 Taşınan: `docs/architecture.md`

**Sebep:** Aynı sebep — yanlış dizin.

**Değişiklikler:**
- Dosya `c:\Users\Administrator\smartscrolling\docs\architecture.md` olarak yeniden oluşturuldu
- `streak/` bileşen klasörü eklendi (StreakCounter, ProgressRing, ActivityGraph)
- Profil Tab'ı açıklamasına "& streak" eklendi
- Phase 3.5 süresi tahminine +1 hafta eklendi (toplam 13 → 14 hafta)
- Klasör yapısına `docs/` ve `rules.md` eklendi

#### 🆕 Oluşturulan: `CHANGELOG.md` (kök dizin)

- Proje kök dizininde (`c:\Users\Administrator\smartscrolling\CHANGELOG.md`) oluşturuldu
- Tüm geçmiş değişiklikler (v0.1, v0.2) kayıt altına alındı
- Proje dizini başlığa eklendi

---

### [v0.2] — 2026-04-08

#### 📋 Değiştirilen: `roadmap_todo.md`

**Eklenenler:**
- `Phase 3.5 — MVP Kritik: Kullanıcı Tutundurma (Retention)` bölümü eklendi
  - **Streak Sistemi** (P35-01 → P35-05):
    - Günlük okuma serisi (streak) sayacı
    - Streak kırılma uyarısı
    - Streak rekoru kaydetme ve görüntüleme
    - 1 günlük grace period / freeze koruması
    - `user_activity` DB tablosu görevi
  - **İlerleme Göstergesi** (P35-06 → P35-09):
    - "Bugün X kart okudun" özet widget'ı
    - Günlük hedef belirleme (kart / sayfa)
    - Dairesel ilerleme çubuğu + konfeti animasyonu
    - Haftalık aktivite grafiği (GitHub benzeri)
  - **Push Notification** (P35-10 → P35-14):
    - Expo Push Notification entegrasyonu
    - Kişiselleştirilebilir bildirim saati
    - Streak hatırlatıcı bildirimi
    - Yeni içerik bildirimi
    - Profil üzerinden bildirim tercihleri yönetimi

**Değiştirilenler:**
- `Phase 4` başlığı → "Kişiselleştirme ve Gelişmiş Gamification" olarak güncellendi
- `Phase 4` artık açıkça "MVP sonrası 2. sürüm" olarak işaretlendi
- `Phase 4` görevleri güncellendi:
  - `P4-03`: Streak görevi kaldırıldı (Phase 3.5'e taşındı)
  - `P4-06` yerine: Arkadaş ekleme ve streak rekabeti eklendi
  - `P4-07` yerine: Sosyal paylaşım kartı eklendi
- MVP Kapsamı tablosu güncellendi:
  - Faz sütunu eklendi
  - 3 yeni MVP özelliği eklendi (🆕 işaretiyle)
  - "Stripe abonelik" → "Abonelik (RevenueCat)" olarak düzeltildi
  - Audio mod ve Aktif öğrenme satırları eklendi

**Sürüm:** v0.1 → v0.2

---

### [v0.1] — 2026-04-08

#### 🆕 Oluşturulan: `docs/roadmap_todo.md`

**İlk sürüm oluşturuldu.** 6 fazda organize edilmiş proje yol haritası:

- **Phase 0** — Ürün Stratejisi ve Planlama (8 görev)
- **Phase 1** — Altyapı ve Temel Kurulum (14 görev)
- **Phase 2** — Günlük Bilgi Akışı / Scroll Feed (11 görev)
- **Phase 3** — Kitap Okuma Modülü (22 görev)
- **Phase 4** — Kişiselleştirme ve Gamification (7 görev)
- **Phase 5** — İçerik Yönetimi / CMS Admin (6 görev)
- **Phase 6** — Test, Optimizasyon ve Yayın (10 görev)
- **MVP Kapsamı** tablosu oluşturuldu

#### 🆕 Oluşturulan: `docs/architecture.md`

**İlk sürüm oluşturuldu.** İçeriği:

- Kullanıcı arayüzü akış şeması
- Teknoloji stack tabloları (Frontend, Backend, AI, EPUB, UI/UX, DevOps)
- PostgreSQL veritabanı şeması (8 tablo)
- Sistem mimarisi diyagramı
- Monorepo klasör yapısı
- Monetizasyon stratejisi
- Güvenlik ve uyumluluk notları
- Tahmini geliştirme süresi
- Önerilen başlangıç sırası

---

## 📌 Dosya Dizini

| Dosya | Konum | Açıklama | Son Güncelleme |
|---|---|---|---|
| `roadmap_todo.md` | `docs/roadmap_todo.md` | Proje geliştirme yol haritası ve görev listesi | v0.7 — 2026-04-09 |
| `architecture.md` | `docs/architecture.md` | Mimari tasarım ve teknoloji stack dokümanı | v0.3 — 2026-04-08 |
| `CHANGELOG.md` | `CHANGELOG.md` | Değişiklik günlüğü | v0.7 — 2026-04-09 |
| `rules.md` | `rules.md` | Geliştirme kuralları ve çalışma prensipleri | — |
| `lessons.md` | `tasks/lessons.md` | Hatalardan çıkarılan dersler | v0.4 — 2026-04-08 |
| `index.html` | `demo/index.html` | Tarayıcı UI demosu (iOS tasarımı) | v0.6 — 2026-04-08 |
| `index.tsx` (Feed) | `apps/mobile/app/(tabs)/index.tsx` | Feed ekranı | v0.7 — 2026-04-09 |
| `library.tsx` | `apps/mobile/app/(tabs)/library.tsx` | Kütüphane ekranı | v0.7 — 2026-04-09 |
| `profile.tsx` | `apps/mobile/app/(tabs)/profile.tsx` | Profil ekranı | v0.7 — 2026-04-09 |
| `[id].tsx` | `apps/mobile/app/book/[id].tsx` | Kitap okuyucu + AI popup | v0.7 — 2026-04-09 |

---

*Son güncellenme: 2026-04-12 — v0.12*
### [v0.14] - 2026-04-13

#### Stabilizasyon Sprinti - Ilk Uygulama Turu Tamamlandi
- `tasks/p1_00_stabilization_task_list.md` guncellendi; tamamlanan ve kalan maddeler netlestirildi.
- `docs/roadmap_todo.md` uzerinde `P1-00` ve `P1-00b` maddeleri tamamlandi olarak isaretlendi.
- Mobil uygulamada React Native JSX / TypeScript kok tipi sorunu giderildi ve `tsconfig` tarafinda React tip cozumlemesi tekillestirildi.
- `FactType`, feed store ve feed UI arasinda veri sozlesmesinin ilk hizalama turu tamamlandi.
- Repo genelinde lint ve format temizligi yapildi; `npm run lint` basarili hale getirildi.
- Mobil uygulama icin `apps/mobile` dizininde `npx tsc --noEmit` basarili hale getirildi.

#### Kalan Stabilizasyon ve Backend Isleri
- `P1-00c`: README, architecture ve diger dokumanlarin gercek durumla hizalanmasi
- `P1-00d`: CI icine `typecheck` ve backend kontrol adimlarinin eklenmesi
- `P2-08b`: bookmark/save davranisinin Supabase tarafinda kalicilastirilmasi
- `P3-10`: reading progress yaziminin backend'e baglanmasi
- `P3-15`: `ai-definition` edge function'inin gercek entegrasyonla tamamlanmasi

---
### [v0.15] - 2026-04-13

#### Dokuman Gerceklik Guncellemesi Tamamlandi
- `docs/architecture.md` mevcut repo gercegine gore yeniden yazildi.
- `apps/mobile/README.md` Expo starter metni yerine proje odakli kurulum ve durum dokumani ile degistirildi.
- `tasks/p1_00_stabilization_task_list.md` uzerinde dokuman hizalama gorevi tamamlandi olarak isaretlendi.
- `docs/roadmap_todo.md` uzerinde `P1-00c` tamamlandi olarak guncellendi.

#### Siradaki Isler
- `P1-00d`: CI icine `typecheck` ve backend kontrol adimlari eklenmesi
- `P2-08b`: bookmark/save davranisinin Supabase tarafinda kalicilastirilmasi
- `P3-10`: reading progress yaziminin backend'e baglanmasi
- `P3-15`: `ai-definition` edge function entegrasyonu

---
### [v0.16] - 2026-04-13

#### CI Guvence Katmani Tamamlandi
- Kök `package.json` icine `typecheck` ve `check:edge-functions` komutlari eklendi.
- GitHub Actions workflow'u guncellendi; artik lint yaninda mobil `typecheck` ve Supabase function entrypoint sanity check de calisiyor.
- `build-preview` ve `build-production` isleri artik `lint` ve `typecheck` kapilarindan sonra calisiyor.
- `tasks/p1_00_stabilization_task_list.md` uzerinde CI gorevi tamamlandi olarak isaretlendi.
- `docs/roadmap_todo.md` uzerinde `P1-00d` tamamlandi olarak guncellendi.

#### Siradaki Isler
- `P2-08b`: bookmark/save davranisinin Supabase tarafinda kalicilastirilmasi
- `P3-10`: reading progress yaziminin backend'e baglanmasi
- `P3-15`: `ai-definition` edge function entegrasyonu

---
### [v0.17] - 2026-04-14

#### P2-08b Bookmark Persistence - Ilk Alt Gorev Tamamlandi
- `tasks/p2_08b_bookmark_persistence.md` dosyasi olusturuldu ve alt gorevler parcali takip edilecek sekilde yazildi.
- `apps/mobile/src/store/feedStore.ts` icine auth varsa kullanicinin kayitli `fact_id` listesini `bookmarks` tablosundan hydrate eden `syncSavedFacts` akisi eklendi.
- Feed verisi yuklendikten sonra remote bookmark state'i yerel `savedIds` state'ine alinacak sekilde baglandi.
- Dogrulama: `npm run lint` ve `npm run typecheck` basarili.

#### Siradaki Alt Gorev
- `toggleSave` davranisini optimistic UI + Supabase insert/delete akisina baglamak

---
### [v0.18] - 2026-04-14

#### P2-08b Bookmark Persistence - Ikinci Alt Gorev Tamamlandi
- `apps/mobile/src/store/feedStore.ts` icinde `toggleSave` davranisi optimistic UI + Supabase `bookmarks` insert/delete akisina baglandi.
- Auth varsa save state remote olarak yazilip siliniyor, hata durumunda yerel state geri aliniyor.
- Auth yoksa kontrollu local fallback korunuyor.
- Dogrulama: `npm run lint` ve `npm run typecheck` basarili.

#### Siradaki Alt Gorev
- hata/fallback davranisini netlestirmek ve save akisinin task kayitlarini final hale getirmek

---
### [v0.19] - 2026-04-14

#### P2-08b Bookmark Persistence Tamamlandi
- `apps/mobile/src/store/feedStore.ts` icinde authenticated session varsa bookmark ID'leri Supabase'den hydrate edilir hale getirildi.
- `toggleSave` akisi optimistic UI + Supabase `bookmarks` insert/delete mantigina baglandi.
- Auth olmayan durumda kontrollu local fallback korunurken, remote yazim sonrasinda `savedIds` yeniden Supabase ile senkronize edildi.
- `tasks/p2_08b_bookmark_persistence.md` gorevi tamamlandi olarak kapatildi.
- `docs/roadmap_todo.md` uzerinde `P2-08b` tamamlandi olarak isaretlendi.
- Dogrulama: `npm run lint` ve `npm run typecheck` basarili.

#### Siradaki Is
- `P3-10`: reading progress yaziminin backend'e baglanmasi

---
### [v0.20] - 2026-04-14

#### Reading Progress Backend Hazirlik Katmani Eklendi
- `P3-10` gorevi icin ayri bir teknik task listesi olusturuldu ve is daha kucuk adimlara bolundu.
- Mobil uygulamaya `apps/mobile/src/lib/readingProgress.ts` veri erisim katmani eklendi.
- `reading_progress` tablosu icin oturum kontrolu, UUID dogrulamasi, mevcut ilerleme kaydini okuma ve `user_id, book_id` benzersizligine gore guvenli `upsert` akislarina hazir helper fonksiyonlar eklendi.
- Demo kitap kimlikleri halen string oldugu icin, gecersiz `bookId` durumunda remote yazim atlanacak sekilde korumali davranis tanimlandi.
- Supabase CLI tarafindan olusturulan `supabase/.temp/linked-project.json` dosyasi lint dengesini bozmamasi icin Biome formatina uygun hale getirildi.

#### Kalite Dogrulamasi
- `npm run lint` basarili.
- `npm run typecheck` basarili.

### [v0.31] - 2026-04-15

#### Auth Foundation Baslatildi
- `docs/tasks/p1_11_auth_foundation.md` altinda auth isinin parcali gorev takibi baslatildi.
- Mobil tarafta Zustand tabanli bir auth session store eklendi.
- Root layout icinde `supabase.auth.getSession()` ve `onAuthStateChange` ile merkezi session dinleyicisi baglandi.
- Profil ekranina temel email/sifre ile giris, kayit olma ve cikis yapma iskeleti eklendi.

#### Kalite Dogrulamasi
- `npm run lint` basarili.
- `npm run typecheck` basarili.

### [v0.32] - 2026-04-15

#### Auth User Bootstrap Trigger Eklendi
- `supabase/migrations/20260415000100_auth_user_bootstrap.sql` ile `auth.users` insert sonrasinda `public.users` tablosuna otomatik satir acan trigger eklendi.
- Trigger fonksiyonu `security definer` olarak yazildi ve `id`, `email`, `display_name`, `avatar_url` alanlarini guvenli sekilde senkronize edecek hale getirildi.
- Ayni auth gorevi altindaki `public.users` bootstrap maddesi `docs/tasks/p1_11_auth_foundation.md` uzerinde tamamlandi olarak isaretlendi.

#### Remote Deploy
- Eksik remote migration history kaydi onarildi ve `20260415000100_auth_user_bootstrap.sql` linked Supabase projeye basarili sekilde uygulandi.
- `docs/roadmap_todo.md` uzerinde `P1-12` tamamlandi olarak guncellendi.

### [v0.33] - 2026-04-15

#### Auth Sonrasi Bookmark Refresh Baglandi
- `feedStore` icine `clearSavedFacts` eklendi ve oturumsuz durumda `savedIds` state'i sifirlanir hale getirildi.
- Root layout icindeki auth state dinleyicisi, login sonrasi `syncSavedFacts()` cagiracak ve logout sonrasi bookmark state'ini temizleyecek sekilde guncellendi.
- `docs/tasks/p1_11_auth_foundation.md` uzerinde auth sonrasi merkezi refresh maddesi tamamlandi olarak isaretlendi.

### [v0.34] - 2026-04-15

#### OAuth Backlog Notlari Dokumante Edildi
- `docs/tasks/p1_11_auth_foundation.md` icine Google OAuth ve Apple Sign-In icin dashboard, redirect URI ve allowlist gereksinimleri eklendi.
- `docs/roadmap_todo.md` uzerindeki `P1-13` maddesi daha uygulanabilir alt kapsamla yeniden ifade edildi.
- `docs/architecture.md` ve `apps/mobile/README.md` icinde provider setup'in henuz backlog seviyesinde oldugu netlestirildi.

### [v0.35] - 2026-04-15

#### Web Preview Runtime Tehsisi ve Resolver Duzeltmesi
- `apps/mobile/tsconfig.json` icindeki problemli React path override kaldirildi; web bundler'in `@types/react` paketine gitmesi engellendi.
- `apps/mobile/metro.config.js` eklenerek `react`, `react-dom` ve JSX runtime paketleri mobil workspace icindeki tek kopyaya zorlandi.
- Web preview denemesinde `Invalid hook call` hatasi kaldirildi; bundle asamasi basarili sekilde tamamlandi.

### [v0.29] - 2026-04-15

#### Roadmap ve Content Strategy Scalable Yapiya Gore Guncellendi
- `docs/content_strategy.md` bastan yazilarak `facts` ve `books` akislarinin guncel repo durumu ile hizali hali dokumante edildi.
- `facts` icin source tier modeli, whitelist/source registry, duplicate fingerprint, quality gate ve editorial queue yaklasimi eklendi.
- `books` tarafi icin metadata, ingestion ve `book_chunks` benzeri reader-content modeli netlestirildi.
- `docs/roadmap_todo.md` uzerinde stale kalan bazi maddeler guncellendi; tamamlanan teknik isler isaretlendi.
- Yol haritasina source registry, duplicate fingerprint, content lifecycle ve kutuphaneyi demo katalogdan canli `books` tablosuna tasima gibi yeni scalable gorevler eklendi.

### [v0.30] - 2026-04-15

#### Markdown Dokumanlari `docs/` Altinda Toplandi
- Proje sahipligindeki dağinik markdown dosyalari `docs/` ve `docs/tasks/` altina tasindi.
- `CHANGELOG.md`, `ROADMAP.md` ve `rules.md` artik `docs/` altinda tutuluyor.
- Gorev takip dosyalari `tasks/` yerine `docs/tasks/` altina tasindi.
- Dokuman referanslari `apps/mobile/README.md`, `docs/architecture.md` ve `docs/rules.md` icinde yeni yollara gore guncellendi.

#### Roadmap Oncelik Netlestirmesi
- `P1-10` Upstash Redis maddesi, bagimli oldugu `P3-21` rate limiting isiyle birlikte ele alinacak sekilde yeniden ifade edildi.

### [v0.21] - 2026-04-14

#### Reader Ilerleme Gosterimi Dinamiklestirildi
- `apps/mobile/app/book/[id].tsx` dosyasindaki statik `Sayfa 42 / 248` ve `%22` ilerleme gostergesi kaldirildi.
- Scroll pozisyonundan turetilen `currentPage`, `completionPercent` ve `pagesLeft` state'leri eklendi.
- Okuyucu ekranindaki alt progress bar artik kaydirma hareketine gore canli guncelleniyor.
- Bu turda remote Supabase yazimi henuz eklenmedi; degisiklik yalnizca UI seviyesinde izole tutuldu.

#### Kalite Dogrulamasi
- `npm run lint` basarili.
- `npm run typecheck` basarili.

### [v0.22] - 2026-04-14

#### Reading Progress Senkronizasyonu Tamamlandi
- Reader ekranina mevcut ilerlemeyi Supabase'den okumaya hazir hydration akisi eklendi.
- Sayfa ilerlemesi degistiginde 1000ms debounce ile `reading_progress` tablosuna `upsert` atan senkronizasyon mantigi baglandi.
- Demo kitap kimlikleri halen `1`, `2` gibi string oldugu icin, gercek Supabase `books.id` degeri olmayan senaryolarda yazim kontrollu olarak atlanacak sekilde korundu.
- `P3-10` gorevi task listesi, roadmap, architecture ve mobile README dosyalarinda tamamlandi olarak kayda gecirildi.

#### Kalite Dogrulamasi
- `npm run lint` basarili.
- `npm run typecheck` basarili.

### [v0.23] - 2026-04-14

#### AI Definition Entegrasyonu Baslatildi
- `supabase/functions/ai-definition/index.ts` dosyasi starter sablonundan cikarilip Groq `chat/completions` tabanli gercek edge function akisina tasindi.
- Function tarafinda `word`, `context` ve `bookTitle` alanlarini alan, JSON cevap bekleyen ve `GROQ_API_KEY` secret'i yoksa kontrollu hata donen yapi kuruldu.
- Mobil tarafta `apps/mobile/src/lib/aiDefinition.ts` helper'i eklendi ve kitap popup'i `ai-definition` function'ini invoke edecek sekilde guncellendi.
- Groq veya deploy hazir degilse mevcut mock tanim/aciklama fallback'i korunarak UI'nin kirilmasi engellendi.

#### Kalite Dogrulamasi
- `npm run lint` basarili.
- `npm run typecheck` basarili.
- `npm run check:edge-functions` basarili.

### [v0.24] - 2026-04-14

#### AI Definition Deploy ve Takip Kayitlari Tamamlandi
- Remote Supabase proje uzerinde `GROQ_API_KEY` ve `GROQ_MODEL` secret'lari ayarlandi.
- `ai-definition` edge function remote projeye deploy edildi.
- `P3-15` gorevi task listesi, roadmap, architecture, mobile README ve stabilizasyon notlarinda tamamlandi olarak isaretlendi.
- Siradaki backend onceligi `ai-chat` edge function ve auth iskeleti olarak yeniden netlestirildi.

#### Not
- Guvenlik icin, paylasilmis Groq key'i bu is bittikten sonra rotate edilmelidir.
### [v0.25] - 2026-04-15

#### AI Chat Entegrasyonu Baslatildi
- `supabase/functions/ai-chat/index.ts` dosyasi starter sablonundan cikarilip Groq `chat/completions` tabanli gercek edge function akisina tasindi.
- Function tarafinda `question`, `context`, `bookTitle` ve sinirli `history` alanlarini alan kitap baglamli sohbet endpoint'i kuruldu.
- Mobil tarafta `apps/mobile/src/lib/aiChat.ts` helper'i eklendi ve kitap popup'indaki `Yapay Zekaya Sor` butonu basit bir chat sheet'e baglandi.
- Groq veya deploy hazir degilse sohbet tarafinda kontrollu fallback mesaji korunarak UI'nin kirilmasi engellendi.

#### Kalite Dogrulamasi
- `npm run lint` basarili.
- `npm run typecheck` basarili.
- `npm run check:edge-functions` basarili.

### [v0.26] - 2026-04-15

#### AI Chat Deploy ve Takip Kayitlari Tamamlandi
- `ai-chat` edge function remote Supabase projeye deploy edildi.
- `P3-19` gorevi task listesi, roadmap, architecture, mobile README ve stabilizasyon notlarinda tamamlandi olarak isaretlendi.
- Siradaki backend onceligi auth iskeleti, demo/gercek kitap kimligi hizalamasi ve sohbet gecmisi kalicilastirma olarak yeniden netlestirildi.

#### Not
- Canli smoke test sonrasi Groq key rotasyonu yapilmasi tavsiye edilir.
### [v0.27] - 2026-04-15

#### Turkce Karakter Response Encoding Duzeltmesi
- `ai-definition` ve `ai-chat` edge function response header'lari `application/json; charset=utf-8` olacak sekilde guncellendi.
- `OPTIONS` yanitlari bos `204` response olarak duzenlenerek gereksiz metin body kaynakli decode belirsizligi azaltildi.
- Amac, PowerShell ve benzeri istemcilerde Turkce karakterlerin bozuk gorunmesini engellemektir.

#### Kalite Dogrulamasi
- Kod degisikligi sonrasinda kalite kapilari yeniden kontrol edildi.
### [v0.28] - 2026-04-15

#### Demo Kitap UUID Hizalamasi Tamamlandi
- Mobil kutuphane ekranindaki demo kitaplar merkezi `demoBooks` kataloguna tasindi.
- Demo kitap kimlikleri Supabase `seed.sql` icindeki gercek `books.id` UUID degerleriyle hizalandi.
- Reader ekranindaki aktif kitap basligi da ayni katalogdan okunacak sekilde guncellendi; boylece reading progress ve AI akislari seeded kitaplar ile dogrudan uyumlu calisiyor.
- Stabilizasyon notlari, architecture ve mobile README dosyalari yeni duruma gore guncellendi.

#### Kalite Dogrulamasi
- `npm run lint` basarili.
- `npm run typecheck` basarili.
### [v0.39] - 2026-04-15

#### Chat History Persistence Tamamlandi
- Reader ekraninda hydrate edilen sohbet gecmisi artik debounce ile `chat_sessions` tablosuna kalici yazilir hale getirildi.
- `P3-20` roadmap ve task kayitlari tamamlandi olarak guncellendi.
- Mimari ozeti ve mobil README mevcut durumla hizalandi.
- `npm run lint` ve `npm run typecheck` yeniden dogrulandi.

---
### [v0.40] - 2026-04-15

#### RLS Hardening Baslangici
- `P1-14` icin gorev dosyasi `docs/tasks/` altinda olusturuldu.
- `bookmarks`, `reading_progress`, `chat_sessions` ve `user_activity` icin acik `SELECT/INSERT/UPDATE/DELETE` policy seti hazirlandi.
- `WITH CHECK` kurallari netlestirilerek auth temelli veri yazimlarinin daha belirgin hale gelmesi saglandi.

---

### [v0.41] - 2026-04-15

#### RLS Hardening Remote Push
- `20260415174141_p1_14_rls_hardening.sql` remote Supabase projesine uygulandi.
- `P1-14` task dosyasina auth sonrasi bookmark, progress ve chat persistence icin smoke test senaryolari eklendi.

---
### [v0.42] - 2026-04-15

#### Auth Prompting Baslangici
- Feed save ve reader chat akislarina oturumsuz kullanicilar icin login yonlendirmesi eklendi.
- Profil ekraninda auth degerini anlatan daha net bir giris CTA durumu olusturuldu.
- `P1-11b` gorev takibi `docs/tasks/` altinda acildi.

---
### [v0.43] - 2026-04-15

#### Auth Return Path Tamamlandi
- Auth store icine gecici `postAuthRedirectPath` state'i eklendi.
- Feed save ve reader chat kaynakli login yonlendirmeleri, profile ekranina gecmeden once geri donus rotasini kaydedecek sekilde guncellendi.
- Profile ekraninda basarili giris veya oturum acilan kayit sonrasinda kullanici geldigi ekrana geri dondurulur hale getirildi.
- `P1-11c` gorev dosyasi `docs/tasks/` altinda kayda gecirildi.

---
### [v0.44] - 2026-04-15

#### Value-First Auth Stratejisi Baslatildi
- Roadmap ve architecture dokumanlarina `value-first auth`, `guest mode mesajlasmasi` ve `progressive profiling` gorevleri eklendi.
- Profile ekraninda oturumsuz kullanici icin misafir deneyimini ve login ile acilan degerleri anlatan yeni bir bilgi kutusu eklendi.
- `P1-11d` gorev takibi `docs/tasks/` altinda baslatildi.

---
### [v0.45] - 2026-04-15

#### Guest Mode Mesajlasmasi Feed ve Kutuphaneye Tasindi
- Feed ust navigasyonunun altina misafir kullanici icin kompakt bir kesfetme / giris yap CTA seridi eklendi.
- Kutuphane ekranina demo kitap deneyimini ve login ile acilan faydalari anlatan yeni bir guest banner eklendi.
- `P1-11d` gorev dosyasinda feed ve kutuphane mesajlasmasi maddesi tamamlandi olarak isaretlendi.

---
### [v0.46] - 2026-04-15

#### Progressive Profiling Akisi Netlestirildi
- `P1-11d` gorev dosyasina profiling sorularinin sirasini ve urun icindeki tetik noktalarini anlatan notlar eklendi.
- Roadmap ve architecture dokumanlari, ilk auth / ilk anlamli aktivite / ikinci geri donus bazli profiling sirasi ile guncellendi.
- Profil ekraninda giris yapmis kullanici icin onboarding'in parcali ilerleyecegini anlatan yeni bir ilerleme karti eklendi.

---
### [v0.47] - 2026-04-15

#### Web Auth Prompt Davranisi Duzeltildi
- `promptForAuth` helper'i web ortaminda `window.confirm` kullanacak sekilde guncellendi.
- Boylece feed save ve reader `Yapay Zekaya Sor` aksiyonlarinda auth prompt web preview uzerinde gorunur hale geldi.

---
### [v0.48] - 2026-04-15

#### Auth Prompt In-App Modal'a Tasindi
- `promptForAuth` helper'i native alert yerine global Zustand tabanli auth prompt store'unu kullanacak sekilde yenilendi.
- Root layout altina platformlar arasi tutarli gorunen yeni bir in-app auth modal bileseni eklendi.
- Feed save ve reader chat auth tetikleri artik uygulama ici modal ile yonlendirme yapiyor.

---
### [v0.49] - 2026-04-15

#### Auth Modal Kopyasi ve Tasarimi Modernlestirildi
- Auth modal metni, "neden giris yapmaliyim" sorusuna cevap veren urun diliyle yeniden yazildi.
- Modal icine senkronizasyon, ilerleme koruma ve kisisellestirme faydalarini anlatan bir deger listesi eklendi.
- CTA metni `Hesabimla Devam Et` olarak guncellendi ve kart tasarimi uygulamanin koyu premium gorunumu ile hizalandi.

---
### [v0.68] - 2026-04-21

#### Progressive Profiling Kalan Isleri Kucuk Gorevlere Bolundu
- `P1-11e` backlog'u daha net ve uygulanabilir alt dilimlere ayrildi.
- Yeni task dosyalari eklendi:
  - profile prefs persistence
  - daily goal preference
  - notification preference
  - notification permission/schedule follow-up
- Boylece profil tarafinda kalan onboarding/prefs isi tek parca buyuk backlog olmaktan cikarilip kucuk uygulanabilir adimlara bolundu.

---
### [v0.67] - 2026-04-21

#### Release Oncesi Visual Polish Gorevi Ayrildi
- Uygulamanin mevcut yapisini bozmadan, release oncesi geri donulecek ayri bir visual polish gorevi tanimlandi.
- `P6-13` altinda global visual language, shell, profile, feed, library, premium/auth, reader ve AI yuzeyleri icin ekran bazli "makyaj" plani dokumante edildi.
- Bu is bilinclİ olarak redesign olarak degil, mevcut davranisi koruyan dusuk riskli bir polish pass olarak cercevelendi.

---
### [v0.66] - 2026-04-21

#### Profile Auth UX Sadelestirildi
- Profil ekranindaki auth karti yeniden duzenlendi; hizli Google girisi ustte, e-posta/sifre alternatifi altta olacak sekilde hiyerarsi sadeleştirildi.
- Auth hata, loading ve basari durumlari artik kart ici inline mesajlarla gorunur hale getirildi; gereksiz alert kullanimi azaltildi.
- Giris yapmis kullanici durumunda bagli auth provider etiketi (`Google ile bagli` / `E-posta ile bagli`) eklendi.
- Cikis aksiyonuna onay diyaloğu eklendi; yanlislikla oturum kapatma riski azaltildi.
- Profil auth metinleri ASCII ve daha tutarli urun diliyle temizlendi.

---
### [v0.65] - 2026-04-21

#### Google OAuth Ilk Mobil Dilimi Eklendi
- `expo-auth-session` dependency'si eklendi ve Supabase mobile deep link ornegine uygun bir `socialAuth` helper katmani yazildi.
- `Google ile Devam Et` aksiyonu profil ekranina eklendi.
- `auth/callback` route'u eklendi; browser donusunde query/hash icindeki auth verisi session'a cevriliyor.
- Root stack callback route'u taniyacak sekilde guncellendi.
- `expo-web-browser` plugin config'i `app.json` icine eklendi.
- Bu dilim app-i production-ready yapmaz; Supabase Dashboard provider config, redirect allowlist ve Google Cloud callback hizasi halen gerekli.
- Sonraki turda `expo-auth-session` aktif akistan cikartildi; mevcut dev build'de `ExpoCrypto` native dependency gerektirdigi icin ilk dilimde lightweight `expo-web-browser + deep link` akisi tercih edildi. Bu karar auth audit notuna teknik tercih olarak kaydedildi.
- Apple fiziksel cihaz build denemesi EAS uzerinden yapildi; ancak Apple hesabinda developer team olmadigi icin credential/provisioning kurulumu bloklandi. Bu nedenle Apple test akisi teknik degil hesap/yetki blocker'i olarak kayda gecirildi.

---
### [v0.64] - 2026-04-21

#### Social Auth Gap Audit'i Dokumante Edildi
- `P1-13` icin ayri bir social auth audit gorevi acildi.
- Mevcut repo durumunda email/sifre auth'in calistigi, ancak Google ve Apple icin UI button'lari, callback handling, redirect URI stratejisi ve dashboard/provider hizasinin eksik oldugu netlestirildi.
- Google ve Apple'in ayni teknik yolla cozulmeyecegi not edildi:
  - Google icin Supabase `signInWithOAuth`
  - Apple icin native sign-in + `signInWithIdToken`
- Uygulama sirasi `once Google, sonra Apple` olarak backlog'a kaydedildi.

---
### [v0.63] - 2026-04-21

#### TR Reader Edition Icin Ceviri Maliyeti Optimizasyonu Baslatildi
- Translate modunda section parse akisi konfigurable `maxWordsPerSection` ile genisletildi.
- `ingest-book-sections` runner'i `--translation-max-words` bayragi kazandi; varsayilan optimize deger `420` olarak belirlendi.
- `P3-10i` gorevi acildi ve Groq kota baskisini azaltmak icin ilk optimizasyon karari dokumante edildi.

---
### [v0.62] - 2026-04-21

#### Reader Performance Checklist'i Belgelendi
- `P3-10h` gorevi acildi; cok section'li kitaplarda scroll, active section takibi, reading progress sync, popup ve chat davranisi icin release-oncesi kontrol listesi hazirlandi.
- `P3-10f` rollout gorevi bu checklist'e baglandi ve `roadmap_todo` icindeki `S3` maddesi tamamlandi olarak isaretlendi.

---
### [v0.61] - 2026-04-21

#### Library Metadata Cleanup Audit'i Baslatildi
- `P3-27b` gorevi acildi; aktif 10 kitaplik shortlist icin title, description, language ve source metadata kararlarini tek checklist altinda toplandi.
- Katalogta `description` alanlarinin Turkce ve kullanima hazir, `cover_url` eksiginin ise branded fallback ile zaten guvenli sekilde kapatildigi not edildi.
- Asil cleanup basliginin `title policy`, `access tier` dogrulamasi ve TR reader edition apply sonrasi `source_storage_*` backfill'i oldugu netlestirildi.

---
### [v0.60] - 2026-04-21

#### Section Reader Icin Highlight ve AI Context Hizasi Saglandi
- `book_highlights` tanimlari reader tarafinda tum kitap yerine aktif bolum kapsaminda filtrelenmeye basladi.
- `book_sections` highlight parcala mantigi section-order bazli definition scope kullanacak sekilde guncellendi; boylece yanlis bolumde gereksiz highlight riski azaltildi.
- AI definition ve chat context olusturma akisi, aktif bolumdeki kavram setini ve odak kelimenin tanimini da baglama ekleyecek sekilde section-reader modeliyle hizalandi.

---
### [v0.59] - 2026-04-21

#### TR Reader Edition Pilotu ve Roadmap Hizasi Guncellendi
- `P3-10g` gorevi acildi; `Storage = raw EN` ve `book_sections = TR reader edition` pilotunun durumu ayri task altina tasindi.
- Gutenberg bootstrap ve `--translate-tr` kodu hazir olmasina ragmen ilk apply turunun Groq `rate_limit_exceeded` blokajinda kaldigi net not olarak kaydedildi.
- `ROADMAP`, `roadmap_todo` ve ilgili kitap ingest / rollout gorevleri, beklerken ilerlenebilecek en yakin isleri gosterecek sekilde hizalandi.

---
### [v0.60] - 2026-04-22

#### Feed Fact Pipeline Editorial Pilot Sertlestirildi
- Fact generation prompt'u `tellable / why should I care` eksenine cekildi; daha dogal Turkce, daha kisa ve daha anlatilabilir kart hedefi sisteme yazildi.
- Dusuk degerli veya feed'e uygun olmayan kaynaklarda modelin karti zorla kurtarmasi yerine `title` alanini bos birakip quality gate'den dusmesine izin veren reject mantigi eklendi.
- Wikipedia source guidance daha sertlestirildi; dusuk etkili lokal proper noun konular, kuru biyografiler ve anlatmaya deger olmayan maddeler daha kolay elenecek sekilde tanimlandi.
- Wikipedia source filter'ine Turkce dusuk deger pattern'leri ve Turkce kategori anahtar kelimeleri eklendi.
- Quality gate'e `content_repetition` ve `low_value_source_topic` reddi eklendi.
- Editorial fit zayifligi nedeniyle Wikipedia gorselleri bu pilot turunda fallback visual sistemine dusurulecek sekilde kapatildi.
- `facts` tablosunu kontrollu temizlemek icin dry-run/apply destekli `cleanup-facts` runner'i ve pilot count'lar icin `run-all` CLI override'lari eklendi.

---
### [v0.59] - 2026-04-22

#### Feed Icerigi Icin Review Loop Stratejisi Acildi
- Feed kalitesini production moderation yerine ic editor feedback ile olcecek yeni bir review loop gorevi tanimlandi.
- `good / bad / unsure` temelli hafif akis ve ozellikle `bad` seciminde zorunlu kisa yorum alma karari dokumante edildi.
- Amaac tek tek fact duzeltmek degil, "hap bilgi degil", "merak uyandirmiyor", "kategori yanlis", "gorsel alakasiz" gibi tekrar eden kalite sinyallerini prompt ve pipeline tuning icin kullanmak olarak netlestirildi.
- Bu review loop'un sonraki iki somut parcasi da ayrildi: debug/internal feed review mode UI ve review sinyallerini export/analiz etmeye uygun saklama modeli.

---
### [v0.58] - 2026-04-21

#### Book Sections Icin TR Reader Edition Pilotu Baslatildi
- Storage-backed kitap ingest runner'i `--translate-tr` bayragi ile genisletildi; boylece ham Project Gutenberg kaynagi EN olarak saklanirken `book_sections` tarafinda Turkce reader edition uretilebiliyor.
- `book-translation.js` helper'i eklendi ve section bazli Groq cevirisi ayri bir katmana alindi; bu katman paragraf yapisini koruyan, tam metni ozetlemeyen bir prompt ile calisiyor.
- `book-sections.js` icindeki summary/page estimation helper'lari disa acilarak ceviri ve parse akisinin ortak kullanimi saglandi.
- Gorev dokumanlari, `Storage = raw EN` ve `book_sections = TR reader edition` karariyla guncellendi.

---
### [v0.57] - 2026-04-21

#### Bad Media Cleanup ve Tematik Visual Key Slice'i Hazirlandi
- `P2-03h` icin ayri gorev dosyasi acildi; yeni kolon eklemeden `facts.visual_key` merkezli gorsel stratejisi benimsendi.
- Pipeline `deriveFactVisualKey` mantigi kategori bazindan cikartilip daha detayli tema preset'lerine genisletildi.
- `cleanup-fact-media.js` runner'i eklendi; logo, flag, cover, vector asset ve `wikipedia/en` non-free gorseller gibi dusuk degerli medya tiplerini `media_url = null` akisina almak icin dry-run/apply omurgasi hazirlandi.
- `20260421090859_p2_03h_bad_media_cleanup.sql` migration'i mevcut facts kayitlari icin `visual_key` backfill ve kontrollu bad-media cleanup SQL'ini ekledi.
- Mobil feed fallback preset'leri yeni `visual_key` anahtarlariyla zenginlestirildi; boylece null'a cekilen medya sonrasi kartlar daha cesitli tema gorsellerine dusecek.
- Ilk cleanup apply turunda `54` fact kaydinin `media_url` alani null'landi ve `visual_key` dagilimi yeni tema setine gore guncellendi.

---
### [v0.50] - 2026-04-15

#### Progressive Profiling Ilk UI Adimi Eklendi
- `P1-11e` icin ayri gorev dosyasi acildi ve ilk calisan profiling parcasi olarak interest picker tanimlandi.
- Profil ekranina giris yapan kullanici icin en fazla 3 ilgi alani secilebilen yeni bir onboarding karti eklendi.
- Interest secimi local onboarding state ile baglandi; kalici Supabase yazimi sonraki adim olarak birakildi.

---
### [v0.51] - 2026-04-15

#### Ilgi Alani Tabanli Feed Kisisellestirme Backlog'a Alindi
- `preferred_categories` benzeri alanlarla feed siralamasini etkileyecek soft personalization isi MVP cekirdeginden cikarildi.
- Gorev, daha dogru faz olarak `Phase 4` altinda backlog maddesi seklinde yeniden konumlandirildi.
- Boylesiyle mevcut MVP odagi auth, temel retention ve cekirdek icerik deneyimi uzerinde tutuldu.

---
### [v0.52] - 2026-04-15

#### Real Books Catalog Ilk Slice'i Baglandi
- `P3-05b` icin ayri gorev dosyasi acildi ve iki free/public-domain kitapla ilk katalog slice'i tanimlandi.
- Library ekrani demo katalog yerine Supabase `books` tablosunu okuyan yeni helper katmanina baglandi.
- Kutuphane kartlari artik `cover_url` uzerinden gercek kapak gorsellerini gosterecek sekilde guncellendi.
- Reader ekrani kitap basligini ve toplam sayfa bilgisini Supabase `books` metadata'sindan okuyacak hale getirildi.
- Remote veri guncellemesi icin `20260415192140_p3_05b_real_books_catalog.sql` migration'i hazirlandi.

---
### [v0.53] - 2026-04-15

#### Real Book Slice ve Cover Fallback Tamamlandi
- Reader ekranina kitap kimligine gore degisen gercek/public-domain ilk bolum slice'lari baglandi.
- `Kendime Dusunceler` ve `Ask ve Gurur` icin popup tanimlari ve AI baglam metni artik kitap-ozel icerikten uretiliyor.
- Kutuphane ekranina siyah kapak sorununu kapatan branded fallback cover tasarimi eklendi.
- `P3-05b` gorevi dokumanlarda tamamlandi olarak isaretlendi.

---
### [v0.54] - 2026-04-15

#### Book Sections + Storage Model Baslatildi
- Tam okunabilir kitap akisina gecis icin `books` tablosuna storage metadata alanlari eklenecek migration hazirlandi.
- Yeni `book_sections` tablosu section bazli okunabilir icerik modeliyle tanimlandi ve public read policy eklendi.
- Roadmap ve task dokumanlari, reader'i sabit slice'lardan section bazli veri kaynagina tasiyacak sekilde guncellendi.

---
### [v0.55] - 2026-04-15

#### Book Sections Seed ve Reader Helper Hazirlandi
- `Kendime Dusunceler` ve `Ask ve Gurur` icin cok bolumlu ilk `book_sections` seed migration'i hazirlandi.
- `books` satirlarina source format ve storage path metadata'si eklenecek veri guncelleme adimi migration'a dahil edildi.
- Reader gecisine zemin hazirlamak icin `book_sections` tablosunu okuyan ve veri yoksa mevcut slice'a dusen helper katmani eklendi.

---
### [v0.56] - 2026-04-15

#### Reader Book Sections Verisini Oncelemeye Basladi
- Reader ekrani artik `book_sections` verisi varsa section title + summary + plain text akisini onceleyecek sekilde guncellendi.
- `book_sections` verisi gelmezse mevcut kitap-ozel slice fallback'i korunuyor, yani gecis asamasi guvenli kaldı.
- `P3-05c` altindaki section seti ve helper adimlari ile `P3-10b` altindaki reader gecis maddesi tamamlandi.

---
