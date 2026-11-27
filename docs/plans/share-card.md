# Paylaşılabilir Kart Görseli — Uygulama Planı

> **Ajanlar için:** Atlas her görevi `board/tasks/SH-0N.md` kartıyla bir ajana verir; ajan sadece kendi görevini görür. Adımlar `- [ ]` ile işaretlenir.

**Amaç:** Paylaş düğmesi kart görselini (C2/C1, 1080×1920) ve kart linkini birlikte paylaşsın; link panoya da kopyalansın.
**Mimari:** Görsel, uygulamanın kendi bileşeniyle ekran dışında çizilir, `react-native-view-shot` ile PNG'ye çevrilir, `react-native-share` ile metinle birlikte paylaşılır. Saf kurallar (`shareCard.ts`), görünüm (`ShareCard`), akış (`useShareFact`) ayrı dosyalarda.
**Teknoloji:** Expo SDK 54, React Native 0.81, expo-router 6, jest-expo, Biome.
**Spec:** `docs/specs/share-card.md` (onaylandı 2026-11-27). Tasarım taslağı: scratchpad `share-mockup/paylasim-gorseli-taslak-2.html`.

## Genel kısıtlar (her görev için geçerli)
- Renk/ölçü/yazı değerleri sadece `apps/mobile/src/theme` üzerinden; sabit hex/sayı yazılmaz. Temada olmayan değer temaya açıklamalı yeni giriş olarak eklenir.
- Kullanıcı metinleri Türkçe: çağrı `Devamı SmartScrolling'de`, bildirim `Link kopyalandı`, mesaj `"<başlık>\n\nDevamı: <link>"`. Büyük harf `toLocaleUpperCase('tr-TR')`.
- `app.json` `scheme`: `["mobile", "smartscrolling"]` — `"mobile"` kalır (giriş dönüşü `src/lib/socialAuth.ts` buna bağlı).
- Link biçimi: `<baseUrl>/fact/<id>`; `baseUrl` bugün `https://smartscrolling.app` (yer tutucu), görselde sadece `smartscrolling.app`.
- Tuval 360×640 dp, yakalama 1080×1920 PNG. Güvenli alan üst 56, alt 96. Fotoğraf bekleme en çok 3000 ms.
- Misafir paylaşabilir. Görsel üretilemezse / kütüphane yoksa `Share.share` metin paylaşımı. Vazgeçme hata değildir.
- Komutlar: `npm run typecheck`, `npm run test:unit`, `npx biome check <değişen dosyalar>`. Commit `git -c core.autocrlf=false`, push/merge yok.

## İnceleme odağı (spec'in söylemediği ama kullanıcıyı ilk ısıracak 5 durum)
1. Uzun başlık (58 karakter) ve uzun gövde → kartın dışına taşmaz; gövde en çok 4 satır. (SH-02 testi)
2. Fotoğraf hiç yüklenmez/yavaş → 3 sn içinde C1 ile görsel üretilir, akış asılı kalmaz. (SH-04 testi)
3. Paylaş'a art arda iki kez basmak → tek paylaşım. (SH-04 testi)
4. Kullanıcı paylaşım menüsünü kapatır → hata penceresi yok, metin paylaşımına düşülmez. (SH-04 testi)
5. Eski uygulama derlemesi (yerel kütüphane yok) → metin paylaşımı, çökme yok. (SH-04 testi)

## Dosya haritası
| Dosya | Sorumluluk | Görev |
|---|---|---|
| `apps/mobile/src/config/share.ts` (yeni) | Kod bilmeyenin düzenleyeceği ayar: `baseUrl`, `displayDomain`, `photoTimeoutMs` | SH-01 |
| `apps/mobile/src/lib/shareCard.ts` (yeni) | Saf kurallar: link, mesaj, varyant, kategori etiketi | SH-01 |
| `apps/mobile/package.json`, kök `package-lock.json`, `apps/mobile/app.json`, `apps/mobile/jest.setup.ts` | Yerel kütüphaneler, ikinci önek, test sahteleri | SH-03 |
| `apps/mobile/components/share/share-card.tsx` (yeni) | Görsel: C2/C1 yerleşimi, 360×640 | SH-02 |
| `apps/mobile/src/lib/useShareFact.tsx` (yeni) | Akış: çiz → bekle → yakala → panoya → paylaş / yedek | SH-04 |
| `components/feed/fact-post.tsx`, `app/fact/[id].tsx` | Düğmeleri akışa bağlama | SH-05 |
| `apps/mobile/README.md` | Ayar dosyasının anlatımı | SH-05 |

Sıra: **SH-01 ∥ SH-03** → **SH-02** → **SH-04** → **SH-05** → Bekçi incelemesi → Atlas emülatör kabulü (dev client yeniden derlenir).

---

### Görev SH-01: Saf kurallar + ayar dosyası
**Dosyalar:** Oluştur `src/config/share.ts`, `src/lib/shareCard.ts`; Test `src/lib/__tests__/shareCard.test.ts`
**Arayüz (üretir):**
- `SHARE_CONFIG: { baseUrl: string; displayDomain: string; photoTimeoutMs: number }` = `{ baseUrl: 'https://smartscrolling.app', displayDomain: 'smartscrolling.app', photoTimeoutMs: 3000 }` (Türkçe açıklama yorumlarıyla).
- `export type ShareVariant = 'photo' | 'text'`
- `buildFactShareLink(id: string, baseUrl?: string): string` — sondaki `/` atılır, id `encodeURIComponent`.
- `buildShareMessage(title: string, link: string): string`
- `pickShareVariant(fact: FactType): { variant: ShareVariant; photoUri: string | null }` — `resolveFactMedia(fact).uri` doluysa `photo`, değilse `text` (yerel ön ayar görseli → `text`).
- `shareCategoryLabel(category: string): string`

- [ ] Test: `buildFactShareLink('abc')` → `'https://smartscrolling.app/fact/abc'`; `buildFactShareLink('a b', 'https://x.app/')` → `'https://x.app/fact/a%20b'`.
- [ ] Test: `buildShareMessage('Başlık', 'L')` → `'Başlık\n\nDevamı: L'`.
- [ ] Test: Commons `media_url` → `{ variant: 'photo', photoUri: <url> }`; `media_url` yok + `visual_key` yerel görselli → `{ variant: 'text', photoUri: null }`; `failedRemoteImageUrls` içindeki URL → `text`.
- [ ] Test: `shareCategoryLabel('bilim ve İnsan')` → `'BİLİM VE İNSAN'`.
- [ ] Testleri koş (FAIL), uygula, koş (PASS). Commit `feat(mobile): share card rules and config`.

### Görev SH-03: Yerel kütüphaneler, ikinci önek, test sahteleri
**Dosyalar:** `apps/mobile/package.json` (+ kök `package-lock.json`), `apps/mobile/app.json`, `apps/mobile/jest.setup.ts`
**Arayüz (üretir):** `react-native-view-shot` (`captureRef`), `react-native-share` (`Share.open`), `expo-clipboard` (`setStringAsync`) kurulu; jest'te üçü de sahte (`captureRef` → `'file:///tmp/share.png'`, `Share.open` → resolve, `setStringAsync` → resolve).
- [ ] `cd apps/mobile && npx expo install react-native-view-shot react-native-share expo-clipboard` (SDK 54 uyumlu sürümler).
- [ ] `app.json` `expo.scheme` → `["mobile", "smartscrolling"]`. Başka alan değişmez.
- [ ] `jest.setup.ts`'e üç `jest.mock` ekle.
- [ ] `npm run typecheck` ve `npm run test:unit` geçer (mevcut test sayısı düşmez). Commit `chore(mobile): add share image native deps and app scheme`.
- Not: Derleme (dev client) bu görevde yapılmaz; Atlas kabulde yapar.

### Görev SH-02: `ShareCard` görünümü
**Dosyalar:** Oluştur `components/share/share-card.tsx`; Test `components/share/__tests__/share-card.test.tsx`; Değiştir `components/ui/media.tsx` (isteğe bağlı `onLoad?: () => void` prop'u — mevcut kullanımlar değişmez); gerekirse `src/theme/colors.ts` (yeni giriş: kart zemini `surface` %82 → ör. `shareCardBg`)

**Arayüz kontrol listesi** — ShareCard, "kart gösterimi" türüne karşı (kategori + başlık + gövde + görsel gösteren bileşenler) — referans `components/feed/fact-post.tsx`, 3 üye / 4 aday (`fact-post`, `app/fact/[id]`, `premium-upsell-card`; `saved-grid` sadece küçük resim, üye değil), okundu 2026-11-27. Yerleşim: kullanıcının onayladığı C2/C1 taslağı.
- [ ] zemin — `colors.bg` + `colors.brandGradient` renkleriyle `expo-linear-gradient` ışıkları; sabit renk yok — taslak (kullanıcı onayı), değerler tema
- [ ] wordmark — `type.screenTitle`, `colors.text`; logo yok — spec §5
- [ ] kart kabı — köşe `radius.lg` (fact-post, detay, upsell: 3/3), zemin temaya eklenecek `shareCardBg`
- [ ] fotoğraf (C2) — paylaşılan `Media` bileşeni (`components/ui/media.tsx`, 3 dosyada kullanılıyor), `contentFit` cover, köşe `radius.md`; doğrudan `expo-image` YAZILMAZ — paylaşılan parça (4. seviye)
- [ ] kategori — `GradientText` + `type.meta`, metin `toLocaleUpperCase('tr-TR')` — 3/3 (`<GradientText style={type.meta}>`, üç üye dosyasında)
- [ ] başlık — `{ ...type.cardTitle, color: colors.text }` — 3/3; C1'de bir kademe büyük (26/30) temaya yeni giriş olarak
- [ ] gövde — `{ ...type.body, color: colors.text }` — fact-post + detay 2/3 (upsell `textSecondary` kullanıyor, kart değil); `numberOfLines={4}`
- [ ] çağrı — `LinearGradient` + `colors.brandGradient`, köşe `radius.md`, dikey `space.md`, `type.button` — `GradientButton`'ın `md` ölçüleri (`gradient.tsx:73`), ama dokunulmaz olduğu için `View`; `GradientButton` kullanılmaz (dokunma davranışı taşır)
- [ ] alan adı satırı — `type.caption`, `colors.textTertiary`, ortalı
- [ ] boşluklar — sadece `space.*` (`screen` yan boşluk); güvenli alan 56/96 temaya `share` girişi olarak
- [ ] fact-post'tan KOPYALANMAZ: okuma süresi (`· N dk`), ilerleme çizgisi, aksiyon düğmeleri, "devamı" ölçümü, kaynak satırı
(Aramalar: `GradientText`, `type\.(cardTitle|body|meta|caption)`, `radius\.(lg|md)` — üç üye dosyası; `from '.*ui/media'` — app + components.)
**Arayüz:** Tüketir `ShareVariant`, `shareCategoryLabel`, `SHARE_CONFIG.displayDomain` (SH-01). Üretir:
`ShareCard = forwardRef<View, { fact: FactType; variant: ShareVariant; photoUri: string | null; onPhotoLoad?: () => void; onPhotoError?: () => void }>` — 360×640, `collapsable={false}`.
testID'ler: `share-card`, `share-card-photo` (sadece photo), `share-card-quote` (sadece text), `share-card-category`, `share-card-title`, `share-card-body`, `share-card-cta`, `share-card-domain`.
Yerleşim spec §5 (C2/C1); kategori mevcut `GradientText`; çağrı mevcut degrade düğme görünümünde ama dokunulmaz (`View` + `LinearGradient`, `GradientButton` değil); zemin ışıkları `expo-linear-gradient`; gövde `numberOfLines={4}`.
- [ ] Test: `variant='photo'` → `share-card-photo` var, `share-card-quote` yok; `variant='text'` → tersi.
- [ ] Test: kategori `'BİLİM'` (tr büyük harf), okuma süresi (`dk`) metni YOK; çağrı `Devamı SmartScrolling'de`; alan adı `smartscrolling.app`.
- [ ] Test (inceleme odağı 1): 58 karakterlik başlık + 120 kelimelik gövde → `share-card-body` `numberOfLines` 4.
- [ ] Test: fotoğraf `onLoad`/`onError` → ilgili geri çağrı bir kez.
- [ ] Koş, uygula, koş; Biome 0. Commit `feat(mobile): share card view (C2/C1)`.

### Görev SH-04: `useShareFact` akışı
**Dosyalar:** Oluştur `src/lib/useShareFact.tsx`; Test `src/lib/__tests__/useShareFact.test.tsx`
**Arayüz:** Tüketir SH-01 (`buildFactShareLink`, `buildShareMessage`, `pickShareVariant`, `SHARE_CONFIG`), SH-02 (`ShareCard`), SH-03 kütüphaneleri. Üretir:
`useShareFact(): { shareFact: (fact: FactType) => Promise<void>; isSharing: boolean; shareHost: ReactElement | null }` — `shareHost` ekran dışı (`position:'absolute', left:-10000, top:0`) çizilen `ShareCard`; paylaşım yokken `null`.
Akış: `isSharing` true iken yeni çağrı yok sayılır → varyant seç → host'u çiz → photo ise `onPhotoLoad` ya da `photoTimeoutMs` (zaman aşımı/hata → `text` ile yeniden çiz) → bir kare bekle → `captureRef(ref, { format:'png', width:1080, height:1920, result:'tmpfile' })` → `Clipboard.setStringAsync(link)` → Android `ToastAndroid.show('Link kopyalandı', ToastAndroid.SHORT)` → `Share.open({ url, type:'image/png', message, failOnCancel:false })` → host'u kaldır.
Yerel kütüphaneler fonksiyon içinde `try { require(...) }` ile yüklenir; yoksa ya da yakalama/paylaşım hata verirse → link panoya (mümkünse) + `Share.share({ message })` (RN).
- [ ] Test: başarı yolu → `captureRef` 1080×1920 png, `setStringAsync('https://smartscrolling.app/fact/<id>')`, `Share.open` mesajı `'<başlık>\n\nDevamı: <link>'`.
- [ ] Test (odak 3): art arda iki `shareFact` → `Share.open` bir kez.
- [ ] Test (odak 2): photo varyantında `onPhotoLoad` hiç gelmez → sahte zamanlayıcıyla 3000 ms sonra `text` ile yakalama yapılır.
- [ ] Test (odak 4): `Share.open` vazgeçme (`{ dismissedAction: true }` ya da `failOnCancel:false` ile resolve) → RN `Share.share` ÇAĞRILMAZ, hata yok.
- [ ] Test (odak 5): `captureRef` reddeder / modül `require` hata verir → RN `Share.share({ message })` çağrılır, pano yine dener.
- [ ] Test: bittikten sonra `isSharing=false`, `shareHost=null`.
- [ ] Koş, uygula, koş; Biome 0. Commit `feat(mobile): share fact as image with link`.

### Görev SH-05: Düğmeleri bağla + README
**Dosyalar:** `components/feed/fact-post.tsx`, `app/fact/[id].tsx`, `apps/mobile/README.md` (+ mevcut testler `components/feed/__tests__/fact-post.test.tsx`, `src/__tests__/fact-detail.test.tsx`)
**Arayüz:** Tüketir `useShareFact` (SH-04).
- `fact-post.tsx`: `sharePost` → `shareFact(item)`; `feed-share-button` `isSharing` iken etkisiz; `shareHost` bileşen içinde çizilir.
- `fact/[id].tsx`: satır ~103'teki `Share.share` → `shareFact(fact)`; `fact-detail-share` aynı kural; `shareHost` çizilir.
- README: "Paylaşım ayarları" bölümü — `src/config/share.ts` alanları, alan adı alınınca ne değişecek.
- [ ] Test: feed ve detayda Paylaş → `shareFact` doğru kartla bir kez çağrılır (hook sahte).
- [ ] Mevcut testler geçer; görünüm/diğer düğmeler değişmez. typecheck, test:unit, Biome. Commit `feat(mobile): wire share image into feed and detail`.

### Kabul (Atlas + Bekçi)
- Bekçi (sonnet): diff + kontrol listesi incelemesi (yazmadığı iş).
- Atlas: dev client yeniden derlenir (kullanıcı Terminal'i, `C:\ss`), emülatörde spec §9: C2/C1, PNG 1080×1920, `adb shell am start -d "smartscrolling://fact/<id>"`, uçak modu, Google girişi. Ekranlar `board/screens/sh-*`.
- Kullanıcı: gerçek telefonda WhatsApp + Instagram denemesi.
