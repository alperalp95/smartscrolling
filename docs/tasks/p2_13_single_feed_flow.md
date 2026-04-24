# P2-13 - Tek Akis Feed

## Amac

Feed uzerindeki kategori secme ve kategoriye gore filtreleme mantigini kaldirip kullanicinin tek, kesintisiz bir bilgi akisinda ilerlemesini saglamak.

Bu is bir mimari refactor degildir. Amac mevcut feed davranisini sadelestirmek, uygulamanin geri kalanini veya veri modelini kokten degistirmemektir.

## Kapsam

Bu task sadece mobil feed ekranindaki kategori filtresi ve ona bagli state/ordering davranisini kapsar. Kart uzerindeki `category` bilgisi icerik baglami olarak kalabilir; kaldirilacak olan sey kategori secme/filtreleme davranisidir.

Ana hedef dosyalar:

- `apps/mobile/app/(tabs)/index.tsx`
- `apps/mobile/src/store/feedStore.ts`
- `docs/tasks/p2_13_single_feed_flow.md`

Dokumantasyon uyumu gerekirse:

- `docs/architecture.md`
- `docs/CHANGELOG.md`
- `docs/roadmap_todo.md`

## Kapsam Disi

- Supabase `facts` semasini degistirmek
- Icerik pipeline'ini degistirmek
- Yeni ranking/personalization sistemi kurmak
- Feed kartini baska bir component mimarisine bolmek
- Navigation yapisini bastan tasarlamak
- Yeni global state katmani veya server-side feed endpoint'i eklemek
- Like/bookmark davranisini yeniden tasarlamak
- Kategoriyi veriden silmek

## Mevcut Davranis Ozeti

- Feed verisi `useFeedStore.fetchFacts` ile Supabase `facts` tablosundan `created_at desc` cekiliyor.
- Ekran `FlashList` ile tam ekran kartlari gosteriyor.
- Ustte `SmartScrolling`, `Bilim`, `Tarih`, `Felsefe`, `Teknoloji`, `Saglik` chip'leri var.
- `activeCategory === 'logo'` tum feed'i gosteriyor.
- Diger chip'lerde feed client-side kategoriye gore filtreleniyor.
- Kategori degisince rotation seed yenileniyor ve liste basa aliniyor.
- Kategori bos kalirsa `ensureCategoryHasContent` ekstra sayfa cekerek ilgili kategoride icerik bulmaya calisiyor.
- Dev review mode, logo chip'e long press ile aciliyor.

## Alt Gorevler

- [x] **P2-13a - Kategori bagimliliklarini netlestir**
  - `apps/mobile/app/(tabs)/index.tsx` icinde `CATEGORIES`, `normalizeCategoryKey`, `activeCategory`, `setActiveCategory`, `ensureCategoryHasContent`, kategori chip render'i ve kategoriye bagli `orderedFacts` hesaplamasini son kez kontrol et.
  - `apps/mobile/src/store/feedStore.ts` icinde kategori state/action kullaniminin sadece feed filtresi icin var oldugunu dogrula.
  - Bu alt gorev kod davranisini degistirmez; sadece uygulama sirasini netlestirir.

- [x] **P2-13b - Feed ordering'i tek akisa indir**
  - `orderedFacts` icin kaynak listeyi her zaman `facts` olarak kullan.
  - `orderingKey` icinden kategori bilgisini cikar.
  - `feedRotationSeed`, pull-to-refresh ve app active refresh davranisini koru.
  - Pagination append sirasini koruyan `buildStableFeedOrder` davranisini bozma.

- [x] **P2-13c - Ust kategori UI'ini kaldir**
  - Ustteki yatay kategori chip listesini kaldir.
  - `SmartScrolling` logo chip'ini kategori secici olarak kullanma.
  - Misafir hint ve review topbar gibi kategori disi overlay'leri koru.
  - Safe area/top spacing davranisini kontrol et.

- [x] **P2-13d - Review mode tetigini koru**
  - Mevcut review mode logo chip long-press'e bagli oldugu icin kategori UI'i kalkarken kaybolma riskini ele al.
  - Review mode'u son kullaniciya acmadan, dev-only minimal bir tetikle koru.
  - Review modal, tag listesi ve JSON export akisina dokunma.

- [x] **P2-13e - Feed store kategori API'sini sadelestir**
  - `activeCategory` state'ini kaldir.
  - `setActiveCategory` action'ini kaldir.
  - `ensureCategoryHasContent` action'ini kaldir.
  - Feed fetch, pagination, refresh, save ve like davranislarini aynen koru.

- [x] **P2-13f - Dead code ve style temizligi yap**
  - `CATEGORIES` ve `normalizeCategoryKey` artik kullanilmiyorsa kaldir.
  - Kategori chip'lerine ait stilleri kaldir:
    - `staticTopNavbar` sadece baska overlay icin gerekmiyorsa
    - `catsRow`
    - `logoChip`
    - `logoText`
    - `logoChipReviewMode`
    - `chip`
    - `chipActive`
    - `chipText`
    - `chipTextActive`
  - Review modal/tag stillerine dokunma.

- [x] **P2-13g - Dokumantasyon uyumunu guncelle**
  - Bu task dosyasinda tamamlanan alt gorevleri isaretle.
  - Gerekirse `docs/roadmap_todo.md` icinde Phase 2 listesine tek akis kararini ekle.
  - Gerekirse `docs/architecture.md` veya `docs/CHANGELOG.md` icinde "kategori filtresi aktif" gibi artik yanlis kalacak ifadeleri duzelt.

- [ ] **P2-13h - Dogrulama**
  - [x] TypeScript kontrolu calistir: `npm run typecheck`
  - [x] Mumkunse lint/format kontrolu calistir: `npm run lint`
  - Feed ekraninda manuel kontrol yap:
    - Feed aciliyor ve ilk kart geliyor.
    - Ustte kategori chip'leri yok.
    - Dikey swipe calisiyor.
    - Auto-advance calisiyor.
    - Pull-to-refresh feed'i yeniliyor.
    - Pagination ile daha fazla kart geliyor.
    - Kaydet auth prompt davranisini koruyor.
    - Kart genisletme ve kapatma calisiyor.
    - Premium upsell trigger'i bozulmuyor.

- [x] **P2-13i - Akis basi donus ve yenileme butonu**
  - Belli bir karttan sonra sosyal medya benzeri yukari ok butonu goster.
  - Butona basildiginda feed'i basa al.
  - Butona basildiginda mevcut refresh/rotation davranisini tetikle.
  - Kart genis moddayken butonu gizle.

- [x] **P2-13j - Anon overlay ve expanded okuma cakismalarini duzelt**
  - Anon login hint'i varken yukari donus butonunu hint'in altinda konumlandir.
  - Dev review hotspot'unu yukari donus butonuyla cakismayacak konuma al.
  - Expanded okuma modunda sag aksiyon kolonunu gizle.
  - Expanded metin alanini ekranin orta-ust bolgesinde ayri scroll alani gibi ac.

- [x] **P2-13k - Expanded okuma hizasi ve scroll sahipligini duzelt**
  - Expanded okuma alanini tum kullanici tiplerinde ust overlay alaninin altina hizala.
  - Expanded metin scroll'unun arka feed/card scroll'una karismasini engelle.

## Uygulama Sirasi

1. `P2-13a`
2. `P2-13b`
3. `P2-13c`
4. `P2-13d`
5. `P2-13e`
6. `P2-13f`
7. `P2-13g`
8. `P2-13h`
9. `P2-13i`
10. `P2-13j`
11. `P2-13k`

## Kabul Kriterleri

- Kullanici feed'de kategori secemez.
- Feed tek akis olarak tum `facts` verisini gostermeye devam eder.
- Mevcut pagination ve refresh davranisi korunur.
- Store API'sinde kategoriye ozel state/action kalmaz.
- Uygulama kapsam disi refactor veya yeni mimari icermeden calisir.
- Typecheck temiz gecer.

## Degismemesi Gereken Davranislar

- Feed Supabase `facts` tablosundan gelmeye devam eder.
- FlashList tam ekran swipe davranisi korunur.
- Pull-to-refresh ve background'dan active'e donus refresh davranisi korunur.
- Kart genisletme, pause ve auto-advance davranisi korunur.
- Bookmark auth prompt ve premium upsell davranisi korunur.
- Kart uzerindeki kaynak, tag ve kategori metadatasi veri olarak korunur.
- Akis basi donus butonu sadece feed icinde yeterince asagi inildikten sonra gorunur.
- Anon login hint'i, yukari donus butonu ve expanded okuma metni birbirinin uzerine binmez.
- Expanded okuma metni scroll edilirken arka feed hareket etmez.

## Riskler

- Review mode tetigi logo chip'e bagli oldugu icin kategori UI'i kalkarken kaybolabilir.
- Ust navbar kalkinca guest hint'in top spacing'i yeniden kontrol edilmelidir.
- `orderedFacts` hesaplamasinda kategori key'i kalkarken stable append davranisi korunmalidir.

## Notlar

- Bu degisiklik kategori verisini veya pipeline kategorilerini silmez.
- Ileride kategori geri gelecekse bu task geri alinabilir olmali; ancak simdiki hedef sade tek akis deneyimidir.
