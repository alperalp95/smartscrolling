# Arayüz Yenileme — Uygulama Planı

> **Ajanlar için:** Bu plan ekip kartlarıyla yürütülür. Her görev `board/tasks/UI-xx.md` kartına dönüşür, ajan kendi worktree'sinde çalışır, Atlas doğrular ve sayfa görevlerinde Bekçi (kontrolcü) ayrıca bakar. Adımlar `- [ ]` ile işaretlenir.

**Hedef:** Uygulamanın bütün ekranlarını tek bir tema dosyasına ve ortak bileşenlere taşımak: Instagram dili (B · Gönderi), Reels kaydırması, koyu tema, sıcak geçiş vurgusu, Inter yazı tipi.

**Mimari:** Tasarım değerleri `apps/mobile/src/theme/` altında tek yerde. Ortak bileşenler `apps/mobile/components/ui/` altında ve sadece temayı kullanıyor. Ekranlar sırayla bu bileşenlere taşınıyor; davranış (veri, giriş, premium, reklam, Karta Sor) değişmiyor.

**Teknoloji:** Expo SDK 54, React Native 0.81, expo-router 6, `StyleSheet`, `expo-linear-gradient` + `@react-native-masked-view/masked-view` (yeni, yerel), `@expo-google-fonts/inter` (yeni), `@expo/vector-icons` (Ionicons), `expo-image`, `react-native-safe-area-context`, jest-expo.

**Spec:** `docs/specs/ui-redesign.md` (onaylı 2026-11-24).

## Global kısıtlar
- Ekranlarda ham renk kodu, elle `fontSize`/`fontWeight`/boşluk sayısı yazılmaz; hepsi `src/theme`'den. Eski literal değerler (`#a78bfa`, `padding: 14` vb.) kopyalanmaz.
- Marka geçişi: `#FF7A45 → #FF3D7F → #8B5CF6`. Sadece: "Sor" hapı, seçili sekme göstergesi, profil halkası, Premium buton/logo, kategori etiketi metni, kullanıcının soru balonu.
- Yazı tipi Inter (400/500/600/700/800). Instagram logosu, yazı tipi, ikonu, birebir renk geçişi kullanılmaz.
- Sadece koyu tema: `app.json` `userInterfaceStyle: "dark"`.
- Tüm kullanıcıya görünen metinler doğru Türkçe karakterle.
- Var olan `testID`'ler korunur (taşınırsa aynı adla).
- Davranış değişmez: giriş (e-posta/Google/Apple), premium satın alma/geri yükleme, AdMob banner, Karta Sor, kaydet/beğen/paylaş, seri ve günlük hedef, bildirimler, hesap silme, FTUE.
- Kullanıcının dev sunucusuna dokunulmaz; denemeler ayrı portta (8090). `.env*` açılmaz. Git `-c core.autocrlf=false`. Push yok.

## Review Focus (testlerin yakalamadığı, en çok can yakabilecekler)
1. **Görselsiz kart** (yeni v2 kartları, uzak görseli kırık olan): gönderi ve ızgara yedek görünümle düzgün durmalı → UI-07 ve UI-11'de test.
2. **Çok uzun başlık/metin** (Türkçe uzun kelimeler, 5 cümlelik kart): gönderi tek ekrana sığmalı, metin "devamı" ile açılmalı, ikon satırı ekrandan taşmamalı → UI-07 testi.
3. **Küçük ekran** (ör. 360×640) ve büyük yazı ayarı: alt menü ve ikon satırı üst üste binmemeli → Atlas emülatörde Pixel 7 + küçük AVD ile ekran görüntüsü.
4. **Giriş yapmamış kullanıcı**: profil, kaydedilenler sekmesi ve "Sor" giriş isteğine düzgün yönlendirmeli → UI-08/UI-09 testleri, Maestro misafir akışı.
5. **Font yüklenmeden önce** ilk açılış: yazılar sistem fontuyla anlık görünüp kaymamalı (açılış ekranı font yüklenene kadar kalır) → UI-01 testi.

## Bulunan kalıplar (finding-patterns, 2026-11-24)
Kapsam: `apps/mobile/app` + `apps/mobile/components` (13 ekran/bileşen dosyası). Tema: **yok** (`constants/theme.ts` Expo şablonu, sadece `ui/collapsible.tsx` kullanıyor) → spec'teki tema önerisi uygulanıyor (onaylı).
- Değerler dağınık: 13 farklı `fontSize` (en sık 12/13/14/11), 6 `fontWeight` (700:58, 800:47, 600:21, 900:6), `borderRadius` 999:33, 14:16, 16:14, 18:10; `padding` en sık 14 (29) — 4 tabanına uymuyor. Hiçbiri kopyalanmaz.
- Tıklanabilir: `TouchableOpacity` 58 kullanım / 8 dosya, `Pressable` 14 / 5 → **ortak bileşenler `TouchableOpacity` üzerine** (çoğunluk, düzey: aile sayımı).
- Diyalog: RN `Modal` 6 dosya → `BottomSheet` RN `Modal` üzerine.
- Görsel: `expo-image` 2/2 dosya, RN `Image` 0 → **`expo-image`**.
- Güvenli alan: `react-native-safe-area-context` 8 dosya → `Screen` bunu kullanır.
- Giriş/premium isteği: `promptForAuth` / `promptForPremium` 5 dosya → **yeniden kullanılır**, yeni modal yazılmaz.
- Yükleniyor: RN `ActivityIndicator` 4 dosya → aynı, renk `colors.textSecondary`.
- `PremiumUpsellCard` 2 dosya → yeni dile taşınır, yerine yenisi yazılmaz.

## Ortak kontrol listesi (her ekran görevi bunu taşır)
1. Sayfa kabı: `Screen` (`components/ui/screen.tsx`), arka plan `colors.bg`.
2. Üst bar: `TopBar`; başlık `type.screenTitle`.
3. Tıklanabilirler: `IconButton` / `Button` / `GradientButton` / `Chip` — sayfada çıplak `TouchableOpacity` + elle stil yok.
4. Açılır pencere: `BottomSheet`; giriş/premium için `promptForAuth` / `promptForPremium`.
5. Görsel: `expo-image`, köşe `radius.lg`; görsel yoksa `MediaFallback`.
6. Yazılar: `type.*` rolleri; ham `fontSize`/`fontWeight`/`fontFamily` yok.
7. Renkler/boşluk/köşe: `colors.*`, `space.*`, `radius.*`; ham sayı ve hex yok.
8. İkonlar: Ionicons çizgi; seçili/aktif hali dolu.
9. Metinler: doğru Türkçe karakter; yeni metinler kısa, mevcut tonla.
10. `testID`'ler: mevcutlar korunur.

**Her ekran görevinin son 3 adımı (aynen):**
1. Yazmadan önce kontrol listesini yeniden oku — hafızadan çalışma.
2. Ekranı kontrole hazır bildir. Atlas onu bu türün kontrolcüsüne (Bekçi, `ui-consistency:verifying`) gönderir — yazan ajan değil — ve gelen raporu sana iletir; düzelt.
3. Durumu bildir: kontrol geçtiyse `done`, değilse `parked — <neden>`.

---

### UI-00: Kontrolcünün kalibrasyonu (Bekçi, haiku)
**Dosyalar:** sadece repo dışı bir kopya (scratch).
- [ ] `app/premium.tsx`'in repo dışı bir kopyasında bir rolü bilerek farklı yaz (ör. bir buton elle `#a78bfa` + `fontSize: 15`) ve ortak kontrol listesine göre `ui-consistency:verifying` ile kontrol et.
- [ ] Ekilen fark raporlanmalı. Raporlanmazsa dur ve "kontrol bu fark için kör" diye bildir.
- [ ] Kalibre edilen ajan, sonra sayfaları kontrol eden ajan değildir.

### UI-01: Yerel bağımlılıklar, font, koyu tema (Köprü, sonnet)
**Dosyalar:** `apps/mobile/package.json`, `apps/mobile/app.json`, `apps/mobile/app/_layout.tsx`
**Üretir:** yüklü `expo-linear-gradient`, `@expo-google-fonts/inter`; font adları `Inter_400Regular`, `Inter_500Medium`, `Inter_600SemiBold`, `Inter_700Bold`, `Inter_800ExtraBold`.
- [ ] `npx expo install expo-linear-gradient @react-native-masked-view/masked-view @expo-google-fonts/inter` (kökte lock dosyası güncellenir; masked-view kategori etiketindeki geçişli metin için — aynı dev client build'e girer).
- [ ] `app.json`: `userInterfaceStyle: "dark"`, açılış ekranı arka planı `#000000`, Android `navigationBar` siyah, durum çubuğu açık.
- [ ] `_layout.tsx`: `useFonts` ile 5 ağırlık; font yüklenene kadar `SplashScreen` açık kalır (Review Focus 5). Test: font yüklenmemişken kök bileşenin `null` döndüğünü doğrulayan jest testi.
- [ ] `npm run typecheck`, `npm run test:unit` geçer. Commit `feat(mobile): add gradient and Inter font, force dark theme`.
- [ ] **Atlas:** emülatör için yeni dev client (`npx expo run:android` ya da EAS development build) — kullanıcıya bildirilir.

### UI-02: Tema dosyası (Usta, sonnet)
**Dosyalar:** `apps/mobile/src/theme/{colors,typography,spacing,index}.ts`, test `apps/mobile/src/theme/__tests__/theme.test.ts`
**Üretir:**
```ts
colors: { bg:'#000000', surface:'#121212', surfaceRaised:'#1C1C1C', fill:'#262626', separator:'#262626',
  text:'#FFFFFF', textSecondary:'#A8A8A8', textTertiary:'#737373', like:'#FF3040', danger:'#ED4956',
  success:'#58C322', scrim:'rgba(0,0,0,0.55)', brandGradient:['#FF7A45','#FF3D7F','#8B5CF6'] }
fonts: { regular, medium, semibold, bold, extrabold }   // UI-01'deki Inter adları
type: { screenTitle, cardTitle, body, meta, caption, button, chip, stat }  // her biri TextStyle (fontFamily, fontSize, lineHeight, letterSpacing?, textTransform?)
space: { xs:4, sm:8, md:12, lg:16, xl:20, xxl:24, xxxl:32, screen:16 }
radius: { sm:8, md:12, lg:18, sheet:22, full:999 }
export const theme = { colors, fonts, type, space, radius }
```
Değerler spec §7.1'den: screenTitle 17/700; cardTitle 22/800, lineHeight 26, letterSpacing −0.3; body 14/400, 21; meta 11/600, uppercase, +0.6; caption 12/400; button 14/600; chip 12/500; stat 16/700.
- [ ] Test: `brandGradient` tam bu 3 renk; tüm `space` değerleri 4'ün katı; `type.cardTitle.fontSize === 22`; her `type` rolünün `fontFamily`'si `fonts` içinde.
- [ ] Testler ve typecheck geçer. Commit `feat(mobile): add design tokens`.

### UI-03: Ortak bileşenler A — temel (Fırça, sonnet)
**Dosyalar:** `apps/mobile/components/ui/{screen,top-bar,icon-button,button,gradient,chip}.tsx` (+ test `components/ui/__tests__/ui-basic.test.tsx`)
**Tüketir:** UI-02 `theme`. **Üretir:**
- `Screen({ children, edges?, style? })`
- `TopBar({ title?: string, left?: ReactNode, right?: ReactNode })`
- `IconButton({ name, onPress, size?=24, color?, active?, testID?, accessibilityLabel })` — `active` ise ikonun dolu hali
- `Button({ label, onPress, variant?: 'secondary'|'ghost', disabled?, testID? })`
- `GradientButton({ label, onPress, size?: 'md'|'pill', icon?, disabled?, testID? })`, `GradientText({ children, style? })` (`gradient.tsx` içinde; `MaskedView` + `LinearGradient`)
- `Chip({ label, onPress?, selected?, testID? })`
- [ ] Testler: her bileşen render olur; `disabled` iken `onPress` çağrılmaz; `testID` iletilir. Hepsi `TouchableOpacity` üzerine.
- [ ] Kontrol listesi 3, 6, 7, 8 bu bileşenlerde sağlanır. Commit `feat(mobile): add base UI components`.

### UI-04: Ortak bileşenler B — panel, profil parçaları, alt menü (Fırça, sonnet)
**Dosyalar:** `apps/mobile/components/ui/{bottom-sheet,avatar,stat-block,media}.tsx`, `apps/mobile/components/ui/tab-bar.tsx`, `apps/mobile/app/(tabs)/_layout.tsx`
**Tüketir:** UI-02, UI-03. **Üretir:**
- `BottomSheet({ visible, onClose, title?, subtitle?, children, testID? })` — RN `Modal`, tutamaç, üst köşe `radius.sheet`
- `Avatar({ initial: string, size?=72, ring?: boolean })` — `ring` ise geçiş halkası
- `StatBlock({ value: number | string, label: string })`
- `Media({ uri?: string | null, localSource?: ImageSourcePropType, category?: string, style? })` — `expo-image`; ikisi de yoksa `MediaFallback` (kategori tonunda yüzey + büyük Ionicons ikonu)
- `TabBar` (expo-router `Tabs` `tabBar` prop'u): Akış (`home`/`home-outline`) · Kaydedilenler (`bookmark`/`bookmark-outline`) · Profil (`person-circle`/`-outline`); sadece ikon; seçili altında geçiş çizgisi.
- [ ] `(tabs)/_layout.tsx`: 3 sekme; `saved` sekmesi UI-10'da gelen `app/(tabs)/saved.tsx`'e bağlanır (bu görevde geçici yer tutucu sayfa olabilir).
- [ ] Testler: `BottomSheet` `visible=false` iken içerik render olmaz; `Media` uri ve localSource yokken fallback gösterir; `TabBar` 3 sekme render eder. Commit `feat(mobile): add sheet, avatar, media and tab bar`.

### UI-05: v2 kartlarına görsel anahtarı (Değirmen, sonnet) — paralel
**Dosyalar:** `packages/pipeline/src/v2/steps/enqueue.js`, test `.../__tests__/enqueue.test.js`
- [ ] Eski hattın `visual_key` eşleme mantığını bul (`src/runners/backfill-fact-visual-keys.js` ve kullandığı lib) ve `buildFactRow`'a `visual_key` ekle (kategori + etiketlerden). Eşleme bulunamazsa kategori varsayılanı.
- [ ] Test: TARİH kategorili adayda `visual_key` boş değil; bilinmeyen kategoride varsayılan anahtar. `npm test` geçer. Commit `feat(pipeline): assign visual_key on v2 enqueue`.
- [ ] **Atlas:** sıradaki/yayındaki görselsiz v2 kartı varsa mevcut backfill script'iyle doldurulur.

### UI-06: Akış — üst bar ve sayfa iskeleti (Fırça, sonnet)
**Dosyalar:** `apps/mobile/app/(tabs)/index.tsx` (sadece üst bar, seri baloncuğu, sponsorlu/premium kartlar), `apps/mobile/components/premium-upsell-card.tsx`
**Ortak kontrol listesi + bu ekranın satırları:**
- Üst bar: "SmartScrolling" (`type.screenTitle`, `fonts.bold`) solda; sağda seri göstergesi (Ionicons `flame` + sayı). Eski sol üst "Hedef seç / N gün seri" baloncuğu kalkar (hedef seçimi Ayarlar'a, UI-09).
- Reklam: mevcut AdMob banner, gönderi çerçevesinde ortalanmış, üstte "Sponsorlu" (`type.meta`).
- `PremiumUpsellCard`: gönderi diliyle, `GradientButton`.
- Dikey sayfalı liste (tam ekran tek gönderi) aynen korunur.
- **Kopyalanmayacak:** eski mor tonlar, `padding: 14`, elle yazılmış rozet stilleri.
- [ ] Son 3 adım (yukarıda).

### UI-07: Akış — gönderi kartı (Fırça, sonnet)
**Dosyalar:** yeni `apps/mobile/components/feed/fact-post.tsx`, `apps/mobile/app/(tabs)/index.tsx` (kart bileşenini yeni dosyaya taşı), test `components/feed/__tests__/fact-post.test.tsx`
**Tüketir:** UI-03/04 (`Media`, `IconButton`, `GradientButton` pill, `GradientText`).
**Satırlar:** yukarıdan aşağı `Media` (köşe `radius.lg`, yan boşluk `space.screen`) → ikon satırı (sol: beğen `heart`/`heart-outline`, **"✦ Sor"** `GradientButton size='pill'` `testID="card-ask-button"`, paylaş `paper-plane-outline`; sağ: kaydet `bookmark`) → meta `KATEGORİ · N dk` (`GradientText`, `type.meta`) → başlık (`type.cardTitle`) → gövde (`type.body`, taşarsa "devamı" ile yerinde açılır) → "Kaynak: X ›" (`type.caption`, `colors.textSecondary`).
- [ ] Testler: (a) görselsiz kartta fallback render olur (Review Focus 1); (b) 600 karakterlik gövdede kapalı halde satır sınırı uygulanır ve "devamı" görünür (Review Focus 2); (c) `card-ask-button` basınca `onAsk` çağrılır.
- [ ] Davranış: beğen/kaydet/paylaş/Sor çağrıları mevcut fonksiyonlara bağlı kalır.
- [ ] Son 3 adım.

### UI-08: Karta Sor paneli + açılır pencereler (Fırça, sonnet)
**Dosyalar:** `apps/mobile/components/card-ask-sheet.tsx`, `components/auth-prompt-modal.tsx`, `components/premium-prompt-modal.tsx`, `components/ftue-modal.tsx`
**Satırlar:** `BottomSheet` üzerine; başlık "Karta sor" + kart başlığı (`type.caption`); hazır sorular `Chip`; kullanıcı balonu geçişli (sağ), cevap `colors.fill` (sol); "Kaynak · Yanlış mı? Bildir"; "Bugün kalan: N"; soru kutusu `colors.fill`, ücretsizde kilitli. Giriş/premium/FTUE pencereleri aynı panel dilinde. Mevcut `testID`'ler (`card-ask-*`, `ai-report-*`) aynen.
- [ ] Mevcut `useCardAsk` testleri geçmeye devam eder; davranış aynı.
- [ ] Son 3 adım.

### UI-09: Ayarlar ekranı (Fırça, sonnet)
**Dosyalar:** yeni `apps/mobile/app/settings.tsx`, `apps/mobile/app/(tabs)/profile.tsx` (ayar bölümlerini taşı), `apps/mobile/app/_layout.tsx` (rota kaydı)
**Satırlar:** liste satırları (ikon + başlık + değer + `chevron-forward`): İlgi alanları, Günlük hedef, Bildirimler + saat, Premium, Çıkış yap, Hesabımı ve verilerimi sil. Davranış ve onay pencereleri aynı; sadece yer ve görünüm değişir. Giriş yoksa sadece giriş çağrısı + bildirim ayarı.
- [ ] Test: ayarlar ekranı giriş yokken "Hesabını bağla" gösterir (Review Focus 4).
- [ ] Son 3 adım.

### UI-10: Profil + Kaydedilenler sekmesi (Fırça, sonnet)
**Dosyalar:** `apps/mobile/app/(tabs)/profile.tsx` (üst kısım + ızgara), `apps/mobile/app/saved-facts.tsx` → `apps/mobile/app/(tabs)/saved.tsx`, yeni `apps/mobile/components/profile/saved-grid.tsx`
**Satırlar:** üst bar (e-posta öneki, sağda `menu` → `/settings`); `Avatar ring`; `StatBlock` ×3: **gün seri** (`streakDays`), **kart** (tüm `user_activity.facts_read` toplamı — istemci sorgusu, `src/lib/userActivity.ts`'e `fetchLifetimeFactsRead(): Promise<number>` eklenir), **kayıtlı** (kaydedilen sayısı); kısa satır (hedef · ilgi alanları); `Button` "Profili düzenle" (→ `/settings`), `GradientButton` "Premium"; `SavedGrid` 3 sütun (`Media` + başlık). Eski `/saved-facts` yolu yeni sekmeye yönlendirir.
- [ ] Testler: `fetchLifetimeFactsRead` boş veride 0; `SavedGrid` görselsiz kartta fallback (Review Focus 1); giriş yokken profil "Hesabını bağla" çağrısı.
- [ ] Son 3 adım.

### UI-11: Premium + kart detayı (Fırça, sonnet)
**Dosyalar:** `apps/mobile/app/premium.tsx`, `apps/mobile/app/fact/[id].tsx`
**Satırlar:** Premium: kapat, geçişli logo (`✦`), başlık, "Tek seferlik ödeme", 3 madde (ikon + başlık + açıklama, metinler mevcut), alt `GradientButton` "Premium'a geç", "Satın alımları geri yükle" `Button ghost`. Kart detayı: `FactPost` yerleşimiyle tam metin.
- [ ] Satın alma/geri yükleme akışı aynı. Son 3 adım.

### UI-12: Türkçe karakter taraması + şablon temizliği (Usta, haiku) — UI-06..11'den sonra
**Dosyalar:** `apps/mobile/app/**`, `apps/mobile/components/**` içindeki kullanıcıya görünen metinler; silinecekler: `app/(tabs)/explore.tsx`, `app/modal.tsx`, `components/{hello-wave,parallax-scroll-view,themed-text,themed-view,external-link}.tsx`, `components/ui/{collapsible,icon-symbol,icon-symbol.ios}.tsx`, `constants/theme.ts` (kullanan kalmadıysa).
- [ ] Sadece metin değişikliği (ASCII → Türkçe karakter); mantık yok. Silmeden önce `grep` ile kullanılmadığını doğrula.
- [ ] typecheck, test geçer. Commit `chore(mobile): Turkish characters in UI copy, remove template leftovers`.

### UI-13: Son kontrol + Maestro (Bekçi, sonnet)
- [ ] `app/` ve `components/` (tema hariç) içinde ham hex / `fontSize:` / `fontWeight:` taraması → 0 (istisnalar gerekçeli).
- [ ] Maestro akışları yeni yerlere göre (profil→ayarlar, kaydedilenler sekmesi); `testID`'ler var.
- [ ] typecheck, lint (LF kopya), jest, pipeline testleri.
- [ ] **Atlas:** yeni dev client ile emülatörde akış, Sor paneli, profil, ayarlar, premium, kart detayı, kaydedilenler ekran görüntüleri (Pixel 7 + küçük ekran) → kullanıcı onayı.

## Sıra ve paralellik
1. Paralel: **UI-00**, **UI-01**, **UI-02**, **UI-05**.
2. UI-02 bitince paralel: **UI-03**, sonra **UI-04** (UI-03'e bağlı).
3. UI-03/04 bitince, farklı dosyalara dokunan ekran görevleri paralel: **UI-07 + UI-08 + UI-11**; ardından **UI-06** (UI-07 ile aynı `index.tsx`) ve **UI-09 → UI-10** (aynı `profile.tsx`, sırayla).
4. Sonra **UI-12**, en son **UI-13**.
5. Atlas her dalgadan sonra entegrasyon dalında (`feat/ui-redesign`) testleri koşar; main'e birleştirme ve build kullanıcı onayıyla.
