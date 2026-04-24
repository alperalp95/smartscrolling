# SmartScrolling - Dersler ve Ogrenilen Hatalar

> Bu dosya, gelistirme surecinde yapilan hatalardan cikarilan dersleri tutar.
> Her kullanici duzeltmesi ve tekrarlanan hata sonrasinda guncellenir.
> Yeni bir oturumda bu dosya ilk okunacak dosyalardan biridir.

---

## Ders Listesi

---

### [L-001] - Dosyalari Dogru Dizine Kaydet

**Tarih:** 2026-04-08  
**Hata:** `roadmap_todo.md` ve `architecture.md` dosyalari proje dizini yerine sistem dizinine kaydedildi.  
**Sebep:** Artifact path kisitlamasini asmak icin yanlis fallback dizin kullanildi.  
**Sonuc:** Dosyalar kullanici tarafindan bulunamadi, yeniden olusturulmasi gerekti.

**Kural:**
- Proje dosyalari her zaman `C:\\Users\\Administrator\\smartscrolling\\` altina kaydedilmeli
- Belge ve dokumanlar `docs/` klasorune
- Gorev ve ders dosyalari `docs/tasks/` klasorune
- Artifact kisitlamasi varsa dogrudan proje yoluna yazilmali

---

### [L-002] - CHANGELOG Her Degisiklikten Sonra Guncellenmelidir

**Tarih:** 2026-04-08  
**Hata:** Ilk dosyalar olusturuldugunda CHANGELOG es zamanli guncellenmedi.  
**Sebep:** CHANGELOG guncellemesi kolay atlandi.

**Kural:**
- Her dosya olusturma, guncelleme ve silme isleminden hemen sonra `docs/CHANGELOG.md` guncellenmeli
- CHANGELOG guncellemesi ayri bir adim degil, her degisikligin parcasi olmali

---

### [L-003] - Artifact Path ile Workspace Path Karistirilmamali

**Tarih:** 2026-04-08  
**Hata:** `write_to_file` benzeri akislar icin artifact path ile workspace path karistirildi.  
**Sebep:** Sistem artifact dizini ile kullanicinin gordugu proje dizini birbirine karistirildi.

**Kural:**
- Proje dokumanlari icin her zaman workspace icindeki tam yol kullanilmali
- Kullaniciya gosterilecek dosyalar artifact olarak degil, proje dosyasi olarak yazilmali

---

## Hata Istatistikleri

| ID | Kategori | Tekrar Sayisi | Durum |
|---|---|---|---|
| L-001 | Yanlis dizin | 1 | Cozuldu |
| L-002 | CHANGELOG atlandi | 1 | Cozuldu |
| L-003 | Path karisikligi | 3 retry | Cozuldu |

---

### [L-004] - Web Preview'da Auth ve FTUE UI'yi Bloklamamali

**Tarih:** 2026-04-16  
**Hata:** FTUE ve auth init katmanlari eklendikten sonra web preview'da feed bos kaldi, kutuphane tiklanamaz oldu ve profil `Oturum kontrol ediliyor...` durumunda takildi.  
**Sebep:** Sorun kullanicinin login olmamasi degildi. Web preview'da auth initialization, persisted FTUE state ve global modal/overlay davranisi birlikte UI'yi gereksiz yere bloke etti.

**Kural:**
- Web preview'da auth initialization asla UI'yi bloklayan tek kapi olmamali
- FTUE ve auth prompt gibi global modal akislari web'de daha sade veya devre disi davranisla gelmeli
- Sorun web preview'da ciktiysa once overlay, modal ve hydration katmanlari izole edilmeli
- Yeni bir global katman eklendikten sonra tum uygulama tiklanamaz hale geldiyse, once o entegrasyonu root'tan gecici olarak sokup pre-feature baseline'a donmek en guvenli hata ayiklama adimidir

---

### [L-005] - FTUE Global Modal Olarak Degil, Progressive Katman Olarak Gelmeli

**Tarih:** 2026-04-16  
**Hata:** Ilk FTUE implementasyonu urun mantigina uygun olsa da root seviyesindeki global modal ve persisted state yapisi web preview'da stabilite problemleri dogurdu.  
**Sebep:** FTUE ilk asamada route-level ve inline deneyim yerine root-level blocker olarak eklendi.

**Kural:**
- FTUE ikinci denemede root modal olarak degil, once feed ustu inline giris katmani olarak gelmeli
- Ilk FTUE surumu sadece deger onerisi ve iki basit CTA icermeli
- Ilgi alanlari, gunluk hedef ve bildirim tercihi daha sonra progressive profiling olarak gelmeli
- FTUE state'i auth/session state'inden bagimsiz olmali

---

### [L-006] - Monorepo + Expo Native'de Tek React Kopyasina Zorlamak Gerekir

**Tarih:** 2026-04-17  
**Hata:** Android emulator'da `Invalid hook call` ve `useId of null` hatalari goruldu.  
**Sebep:** Workspace yapisinda hem `apps/mobile/node_modules` hem de root `node_modules` altinda fiziksel React kopyalari bulundu; Metro farkli paketleri farkli React kopyalariyla eslestirebildi.

**Kural:**
- Expo monorepo yapisinda Metro, tek bir React ve React Native kaynagina zorlanmali
- `metro.config.js` icinde workspace root `watchFolders`, `nodeModulesPaths`, `disableHierarchicalLookup` ve `extraNodeModules` birlikte tanimlanmali
- Native'de hook hatasi gorulurse ilk supheli duplicate React resolution olmalidir

---

### [L-007] - Expo Go veya Emulator Ortaminda Native Storage Hatasi Uygulamayi Cokertmemeli

**Tarih:** 2026-04-17  
**Hata:** Android emulator'da `AsyncStorageError: Native module is null, cannot access legacy storage` hatasi goruldu.  
**Sebep:** Supabase auth storage dogrudan `AsyncStorage` moduline bagliydi; native module erisilemediginde tum auth/storage zinciri hata firlatiyordu.

**Kural:**
- Native storage katmani dogrudan tek modula guvenmemeli
- `AsyncStorage` kullanan auth/session sistemleri icin try/catch ve fallback storage davranisi olmali
- Expo Go veya emulator testlerinde native module hatasi alinirsa once storage adapter sertlestirilmeli

---

### [L-008] - Anon Kullanici Kontrollerinde `getSession()` Daha Guvenli Bir Varsayimdir

**Tarih:** 2026-04-17  
**Hata:** Facts ekraninda anonim kullanimda `Auth session missing!` logu goruldu ve gecersiz `media_url` anahtarlari kart gorsellerini kirilgan hale getirdi.  
**Sebep:** Sadece oturum varligini anlamak icin `supabase.auth.getUser()` kullaniliyordu; anonim akista bu gereksiz auth yoklamasi hata gurultusu uretti. Ayni anda bilinmeyen asset key'leri de dogrudan render edilmeye calisiliyordu.

**Kural:**
- Yalnizca session var mi kontrolu gereken yerlerde `getSession()` tercih edilmeli
- Anon kullanim beklenen akislarda session missing hata gibi loglanmamali
- Feed ve reader gibi yuzeylerde medya kaynagi ancak gercekten cozuluyorsa render edilmeli

---

### [L-009] - Native Fallback Katmani Log Spam Uretmemeli ve UI'yi Gorselsiz Birakmamali

**Tarih:** 2026-04-17  
**Hata:** Android emulator'da `AsyncStorage` hatasi tekrar tekrar warning uretti ve facts kartlari gorselsiz kaldi.  
**Sebep:** Storage fallback her cagrida yeniden native modulu deniyordu; media anahtari cozulmezse kartta hic arka plan kalmiyordu.

**Kural:**
- Native fallback ilk kritik hatadan sonra kalici olarak guvenli moda gecmeli
- Tekrarlayan ayni warning loglari azaltılmali; aksi halde gercek hata ayiklama zorlasir
- Feed gibi ana yuzeylerde gorsel kaynak cozulmezse kategori veya urun diline uygun fallback arka plan gosterilmeli

---

### [L-010] - Paged Feed Icinde Icerik Scroll'u Ana Swipe Hareketini Calmamalidir

**Tarih:** 2026-04-18  
**Hata:** Android'de facts ekraninda kartlar arasi swipe calismadi ve feed kaydirilamaz hissettirdi.  
**Sebep:** Tam ekran `FlatList` icindeki kartta ikinci bir dikey `ScrollView` vardi; Android gesture sistemi bu ic scroll'u ana sayfa gecisi yerine onceliklendirdi.

**Kural:**
- TikTok/Reels benzeri paged feedlerde kartin icine ikinci bir dikey scroll koymamak gerekir
- Ana feed swipe'i urunun birincil etkileseimi ise kart icerigi tek parca yuzey gibi davranmali
- Uzun icerik gostermek gerekiyorsa once kisaltma, satir siniri veya ayri detay ekranina cikarma dusunulmeli

---

### [L-011] - Kullanicinin Urun Davranisi Talebiyle Teknik Kestirme Birbirine Karistirilmamali

**Tarih:** 2026-04-18  
**Hata:** Resim problemi kategori fallback ile gizlendi ve kart yazi alani kullanicinin istedigi etkileşim modelinden uzaklasti.  
**Sebep:** Kisa vadeli stabilite hamlesi, gercek urun davranisinin yerine gecti.

**Kural:**
- Feed gibi cekirdek ekranlarda problem gizlenmemeli, dogru veri kaynagi korunmali
- Kullanici belirli bir etkileşim modeli tarif ettiyse, fix o modele sadik kalmali
- Teknik fallback ancak urun davranisini degistirmeden uygulanabiliyorsa kabul edilmeli

---

### [L-012] - Android'de Remote Feed Gorselleri Icin Veri ile Render Katmani Ayrilmali

**Tarih:** 2026-04-18  
**Hata:** `facts.media_url` verisi Supabase'den dogru geldigi halde Android feed kartlarinda arka plan resimleri gorunmedi.  
**Sebep:** Sorun veri kaynagi degil, uzak URL'lerin native render katmanindaki davranisiydi.

**Kural:**
- Once veri gercekten geliyor mu izole edilmeli, sonra render katmanina bakilmali
- Remote DB gorselleri Android'de sorun cikariyorsa `expo-image` gibi daha guvenilir render yolu tercih edilmeli
- Veri problemi ile UI render problemini ayni anda cozmeye calismak gereksiz karmaşa yaratir

---

### [L-013] - Mevcut Olarak Encode Edilmis URL'ler Tekrar Encode Edilmemeli

**Tarih:** 2026-04-18  
**Hata:** Bazı feed gorselleri gelirken, dosya adinda `%28` veya `%29` gibi kodlamalar olan Wikimedia gorselleri dusuyordu.  
**Sebep:** Uzak `media_url` alanina bir kez daha `encodeURI` uygulaninca mevcut `%` dizileri double-encode oldu.

**Kural:**
- Veritabanindan gelen URL zaten encode edilmis olabilir; tum string'e kor olarak yeniden encode uygulanmamali
- Sorun belirli gorsellerde cikiyorsa once URL'in ozel karakter veya mevcut percent-encoding durumu kontrol edilmeli
- URL normalizasyonu gerekiyorsa trim gibi kayipsiz islemler tercih edilmeli

---

### [L-014] - Safe Area ve Sistem Gesture Alanlari Sabit Piksel Ile Yonetilmemeli

**Tarih:** 2026-04-18  
**Hata:** Ust bar ve alt bar bazi ekranlarda Android gesture bar ve iOS home indicator ile ust uste geliyordu.  
**Sebep:** Tab bar ve ekran ici overlay konumlari sabit yuksekliklerle hesaplanmisti; gercek cihaz inset degerleri hesaba katilmiyordu.

**Kural:**
- Root seviyede `SafeAreaProvider` olmali
- Tab bar yuksekligi sabit sayilar yerine `useSafeAreaInsets()` ile hesaplanmali
- Feed, reader ve benzeri overlay agir ekranlarda `useBottomTabBarHeight()` ve gercek inset degerleri birlikte kullanilmali
- `react-native` icindeki eski `SafeAreaView` yerine `react-native-safe-area-context` tercih edilmeli

---

### [L-015] - Monorepo Paket Kurulumlari Sonrasinda React Type Resolution Kontrol Edilmeli

**Tarih:** 2026-04-18  
**Hata:** Yeni bir feed dependency'si eklendikten sonra `View`, `Text`, `ScrollView` gibi temel React Native bilesenleri TypeScript tarafinda "JSX component degil" hatasina dustu.  
**Sebep:** Uygulama kodu degil, monorepo icindeki React type resolution sirasi kaydi; root ve app seviyesindeki `@types/react` cozumlemesi eski stabil durumdan uzaklasti.

**Kural:**
- Paket kurulumu sonrasi genis capli JSX hatalari cikarsa once type resolution bozulmus olabilir diye dusun
- Liste veya ekran kodunu geri almadan once root ve workspace seviyesindeki `@types/react` cozumunu kontrol et
- Monorepo React Native projelerinde `tsconfig` tip arama davranisi ile root/app dependency dagilimi birlikte degerlendirilmelidir

---

### [L-016] - Icerik Kalitesinde En Buyuk Carpani Prompt Degil Kaynak Secimi Belirler

**Tarih:** 2026-04-18  
**Ogrenim:** Groq promptu, retry ve quality gate iyilestirildiginde `quality_rejected` ve `groq_failed` oranlari dusebilir; ancak source havuzu semantik olarak zayifsa hala urun icin dusuk degerli kartlar uretilir.  
**Sonuc:** Rastgele Wikipedia havuzu yerine kategori odakli, yuksek bilgi degerli source secimi urun kalitesini prompt iyilestirmesinden daha fazla etkiler.

**Kural:**
- Once source selection'i iyilestir
- Sonra prompt ve quality gate ile ince ayar yap
- "Teknik olarak duzgun fact" ile "urun icin degerli fact" ayni sey degildir

---

### [L-017] - Prompt Guvenligi Arttiginda Sonraki Darbogaz Source-Category Tutarliligidir

**Tarih:** 2026-04-19  
**Ogrenim:** Groq promptuna "yorum yok / bilgi uydurma yok / yalnizca kaynakta desteklenen bilgi" kurali eklense bile, zayif source secimi veya kategori sapmasi anlamsiz kartlar uretebilir.  
**Sonuc:** Prompt guvenligi gerekli ama tek basina yeterli degildir; sonraki zorunlu katman source relevance ve category consistency enforcement olmalidir.

**Kural:**
- LLM davranisini sertlestirmekten sonra test kosulari mutlaka ornek ciktI kalitesi uzerinden degerlendirilmelidir
- Prompt guvenligi gecerli olsa bile source-topic-category zinciri tutarsizsa kart reject edilmeli
- Sonraki kalite adimi olarak source relevance ve category consistency kontrolu planlanmalidir

---

*Son guncellenme: 2026-04-19*
