# Spec — Arayüz yenileme: Instagram dilinde, Reels hissinde SmartScrolling

**Durum:** Taslak (kullanıcı onayı bekliyor) · **Yazan:** Atlas (PO) · **Tarih:** 2026-11-24
**Görsel taslaklar:** brainstorm oturumunda gösterildi (akış yönleri, renk, diğer ekranlar); kararlar aşağıda yazılı.

## 1. Neden

- Kullanıcı: "Tasarım olarak kötü duruyor. Daha çok bir sosyal medya uygulaması gibi olsun; Instagram'ı örnek alabiliriz. Birebir aynısı değil, onun tasarım dilinde ve modern."
- Uygulamanın adı ve amacı **SmartScrolling**: insanlar doom scroll yaparken bilgi edinsin. Bu yüzden akışın **Reels/TikTok hissi** (tam ekran, kaydırınca bir sonraki) korunmalı.
- Bugün tasarım sistemi yok: renkler, boyutlar, boşluklar 16 dosyaya elle yazılmış (mor ağırlıklı, her ekran biraz farklı). Arayüz metinlerinin çoğunda Türkçe karakter yok ("Akis", "Devamini okumak icin dokun"). Expo şablonundan kalma kullanılmayan ekran ve bileşenler var.

## 2. Hedefler

1. Tek bir yerde tanımlı tasarım dili: renk, yazı, boşluk, köşe, gölge, ikon.
2. Akış: **B · Gönderi** düzeni + **Reels kaydırması** (her kaydırmada tam ekran tek gönderi).
3. Tema: **Koyu + sıcak geçiş**. Geçiş sadece vurgularda.
4. Diğer ekranlar aynı dilde: Karta Sor paneli, Profil (Instagram profili gibi), Premium, kart detayı, kaydedilenler, açılır pencereler (giriş, premium, ilk açılış).
5. Tüm arayüz metinleri doğru Türkçe karakterlerle.
6. Şablon artıklarının temizliği.

## 3. Hedef olmayanlar (bu işte yok)

- Açık tema / telefon ayarına göre tema değişimi (sonraya).
- "Keşfet" sekmesi (kategoriye göre arama) — yeni özellik, ayrı spec.
- Yeni işlev: yorum, takip, kullanıcılar arası etkileşim, video.
- İçerik hattı, veritabanı, sunucu değişikliği (tek istisna: 7.8/2 — v2 kartlarına `visual_key` atanması).

## 4. Anti-hedefler (çalışsa bile başarısızlık sayılır)

- **Instagram taklidi gibi görünmek:** Instagram logosu, yazı logosu, uygulama ikonu, Instagram Sans yazı tipi ve Instagram'ın birebir renk geçişi kullanılmaz. Dil benzer, kimlik bizim.
- Okunabilirliğin düşmesi (bilgi kartı uygulaması; metin her zaman rahat okunmalı).
- Mevcut akışların bozulması: giriş/kayıt (e-posta, Google, Apple), premium satın alma ve geri yükleme, reklamlar (AdMob), Karta Sor, kart kaydetme/beğenme/paylaşma, seri/günlük hedef, bildirim ayarları, hesap silme, ilk açılış (FTUE).
- Maestro testlerinin kullandığı `testID`'lerin kaybolması.

## 5. Kısıtlar

- Expo SDK 54, React Native 0.81, expo-router 6, Zustand. Stil: React Native `StyleSheet` (mevcut yöntem).
- **Yeni yerel bağımlılık:** renk geçişi için `expo-linear-gradient`. Bu, emülatöre/telefona **yeni bir geliştirme sürümü (dev client) kurmayı** gerektirir. Kullanıcı bunu kabul etti. Yazı tipi için `@expo-google-fonts/inter` (JS + font dosyası; `expo-font` zaten kurulu). İkonlar: kurulu `@expo/vector-icons` (Ionicons, çizgi stil).
- Kullanıcının çalışan geliştirme sunucusuna dokunulmaz; denemeler ayrı portta.
- Ajan kartları küçük (tek ekran / tek konu). Arayüz işi `ui-consistency` sürecine uyar (finding-patterns → planning → implementing → verifying).

## 6. Yaklaşımlar (değerlendirilen)

| Yol | Ne | Artı | Eksi | Karar |
|---|---|---|---|---|
| **1. Kendi tema dosyası + küçük ortak bileşen kiti** | Tasarım değerleri `apps/mobile/src/theme/` altında; 6–8 ortak bileşen; ekranlar sırayla taşınır | Mevcut yöntem, yeni stil kütüphanesi yok, ekran ekran test/onay | Ortak bileşenleri biz yazarız | **Seçildi** (kullanıcı) |
| 2. NativeWind (Tailwind) | Sınıf adlarıyla stil | Yeni ekran yazmak hızlı | 7 bin satır arayüzün stil yazımı baştan değişir, ek yapılandırma | Elendi |
| 3. Hazır kit (Tamagui / gluestack) | Hazır bileşenler | Çok parça hazır | Ağır bağımlılık, yine özelleştirme, muhtemelen ek build | Elendi |

## 7. Kararlar

### 7.1 Tasarım değerleri (tema dosyası)
Tek kaynak: `apps/mobile/src/theme/` (ör. `colors.ts`, `typography.ts`, `spacing.ts`, `radius.ts`, `index.ts`). Bileşenler **sadece anlamsal adları** kullanır (ör. `colors.textSecondary`), ham renk kodu yazmaz.

**Renkler (koyu tema)** — Atlas'ın önerisi, uygulamada ince ayar serbest:
- Arka plan `#000000`; yüzey `#121212`; yükseltilmiş yüzey `#1C1C1C`; ikincil dolgu (input, buton) `#262626`; ayırıcı `#262626`.
- Metin: birincil `#FFFFFF`, ikincil `#A8A8A8`, üçüncül `#737373`.
- **Marka geçişi (bizim, Instagram'ınki değil):** `#FF7A45 → #FF3D7F → #8B5CF6` (sıcak turuncu → pembe → mevcut marka moru). Kullanıldığı yerler: "Sor" butonu, seçili alt sekme göstergesi/profil halkası, Premium butonu ve logosu, kart kategori etiketi (metin geçişi), kendi sorunun balonu. Başka yerde kullanılmaz.
- Beğeni kırmızısı `#FF3040`; hata `#ED4956`; başarı `#58C322`.

**Yazı:** Inter (400, 500, 600, 700, 800). Roller:
- Ekran başlığı / üst bar logosu: 17, 700.
- **Kart başlığı:** 22, 700–800, satır 26, harf aralığı −0.3.
- Gövde: 14, 400, satır 21.
- Meta (kategori · süre): 11, 600, büyük harf, harf aralığı +0.6.
- Alt yazı / kaynak: 12, 400.
- Buton: 14, 600. Çip: 12, 500.
- Sayı (profil istatistik): 16, 700.

**Boşluk:** taban 4 → 4, 8, 12, 16, 20, 24, 32. Ekran yan boşluğu 16.
**Köşe:** 8 (buton, input), 12 (kart içi kutu), 18 (görsel), 22 (alt panel üst köşeleri), tam (çip, avatar).

### 7.2 Ortak bileşenler (`apps/mobile/src/ui/` ya da `components/ui/`)
`Screen` (güvenli alan + arka plan), `TopBar`, `IconButton`, `GradientButton` / `GradientPill`, `Button` (ikincil, dolgu `#262626`), `Chip`, `BottomSheet` (alttan açılan panel, tutamaçlı), `GradientText` (kategori etiketi), `Avatar` (geçiş halkalı), `StatBlock`. Alt menü (`TabBar`) özelleştirilir.

### 7.3 Akış (B · Gönderi + Reels kaydırması)
- Her kaydırma = tam ekran tek gönderi (mevcut sayfalı dikey liste korunur).
- Gönderi düzeni, yukarıdan aşağı: üst bar (sol: "SmartScrolling" yazısı Inter 700; sağ: seri göstergesi 🔥N ve bildirim/ayar ikonu yok — sadece seri), **görsel** (kartın mevcut görseli, köşe 18, yan boşluk 16), **ikon satırı** (sol: beğen ♡, **✦ Sor** geçişli hap, paylaş; sağ: kaydet), meta (KATEGORİ · N dk, geçişli metin), **başlık**, gövde (taşarsa "devamı" ile yerinde açılır), kaynak bağlantısı ("Kaynak: Wikipedia ›").
- Bugünkü sol üstteki "Hedef seç / N gün seri" baloncuğu kalkar; seri üst bara küçük gösterge olarak taşınır, hedef seçimi Profil'e.
- Akış içindeki premium tanıtım kartı ve reklam: aynı gönderi düzeninde, "Sponsorlu" / "Premium" etiketiyle.
- Mevcut `testID`'ler (ör. `card-ask-button`) korunur.

### 7.4 Karta Sor paneli
Instagram yorum paneli gibi: alttan açılır, tutamaç, başlık "Karta sor" + kart başlığı, hazır soru çipleri, mesajlar (kullanıcı: geçişli balon sağda; cevap: `#262626` balon solda), cevap altında "Kaynak · Yanlış mı? Bildir", "Bugün kalan: N", altta yuvarlak soru kutusu (ücretsizde kilitli: "Kendi sorunu yaz… (Premium)"). Mevcut davranış ve `testID`'ler aynı.

### 7.5 Profil
Instagram profili gibi: üst bar (kullanıcı adı / e-posta öneki, sağda ≡ menü), geçiş halkalı avatar, istatistik satırı (**gün seri · okunan kart · kayıtlı**), kısa satır (günlük hedef · ilgi alanları), butonlar ("Profili düzenle", "Premium"), altında **kaydedilen kartların 3'lü ızgarası** (kart görseli + başlık). Ayarlar (ilgi alanları, günlük hedef, bildirim ve saat, premium, çıkış, hesap silme) **≡ menüden açılan ayrı Ayarlar ekranına** taşınır. Giriş yapmamış kullanıcı için: aynı düzende "Hesabını bağla" çağrısı.

### 7.6 Diğer ekranlar
- **Premium:** sade; geçişli logo, 3 madde (ikonlu), geçişli tek ana buton, geri yükleme bağlantısı.
- **Kart detayı (`fact/[id]`)** ve **Kaydedilenler**: gönderi diliyle; Kaydedilenler profil ızgarasıyla aynı görünür (Profil ızgarası buraya yönlendirebilir).
- **Açılır pencereler** (giriş, premium, ilk açılış): `BottomSheet` ya da ortak modal görünümü, aynı renk ve yazı.
- **Alt menü:** Akış · Kaydedilenler · Profil, sadece ikon (seçili ikon dolu, diğerleri çizgi). Kaydedilenler sekmesi yeni rota değil, mevcut `saved-facts` ekranına sekme olarak bağlanır.

### 7.7 Metin ve temizlik
- Tüm arayüz metinleri doğru Türkçe karakterle (ç, ğ, ı, ö, ş, ü, İ).
- Şablon artıkları silinir: `app/(tabs)/explore.tsx`, `app/modal.tsx`, `components/hello-wave.tsx`, `parallax-scroll-view.tsx`, `themed-text.tsx`, `themed-view.tsx`, `ui/collapsible.tsx`, `ui/icon-symbol*.tsx`, `external-link.tsx`, `constants/theme.ts` (kullanılmıyorsa; önce kontrol).

### 7.8 İnceleme sonrası netleşenler (Atlas'ın kararları)
1. **"Okunan kart" sayısı:** kullanıcının tüm `user_activity.facts_read` satırlarının toplamı, istemcide okunur (kullanıcı kendi satırlarını okuyabiliyor). Şema/sunucu değişikliği yok.
2. **Görseller:** yayındaki 713 kartın hepsinde `visual_key` var (uygulamadaki yerel görsel eşlemesi), 432'sinde ayrıca uzak görsel. Ama yeni içerik hattı (v2) sıraya alırken `visual_key` yazmıyor; yeni kartlar görselsiz gelir. Karar: v2 sıraya alma adımı da `visual_key` atasın (eski hattaki eşleme mantığı yeniden kullanılır) — küçük bir Değirmen kartı. Ayrıca arayüzde görselsiz kart için yedek görünüm (kategori tonunda düz yüzey + büyük ikon) her durumda olur.
3. **Sadece koyu:** `app.json` → `userInterfaceStyle: "dark"`; durum çubuğu açık renk; Android gezinme çubuğu siyah; açılış ekranı arka planı siyah. Sistem diyalogları (izin pencereleri) telefonun ayarını izler, dokunulmaz.
4. **Seri göstergesi:** emoji değil, Ionicons `flame` + sayı.
5. **Reklam:** bugünkü AdMob **banner**. "Sponsorlu" gönderi = gönderi çerçevesi içinde ortalanmış banner + üstte "Sponsorlu" etiketi. Yerel (native) reklam bu işte yok.
6. **Günlük hedef / ilk açılış:** FTUE davranışı aynı kalır; sadece görünümü yeni dile geçer. Hedef düzenleme Ayarlar ekranına taşınır, davranışı aynı.
7. **Maestro:** taşınan öğelerin akışları güncellenir (Bekçi). Var olan `testID`'ler yeni yerlerinde aynı adla kalır.
8. **Kaydedilenler sekmesi:** `app/saved-facts.tsx` → `app/(tabs)/saved.tsx` olarak taşınır; eski yola gelen bağlantılar yeni sekmeye yönlendirilir.

## 8. Uygulayıcıya bırakılanlar
- Bileşenlerin tam API'si, dosya bölünmesi, animasyon süreleri.
- Renklerde küçük ton ayarları (anlamsal adlar korunarak).
- Ayarlar ekranının iç düzeni (aynı dilde, liste satırları).
- Görseli olmayan kart için yedek görünüm (geçişli ya da kategori renkli düz yüzey).

## 9. Başarı ölçütü
- Ekranlarda ham renk kodu / elle yazılmış yazı boyutu kalmaz; hepsi tema dosyasından (Bekçi tarar).
- Emülatörde yeni dev client ile: akış, Sor paneli, profil, ayarlar, premium, kart detayı, kaydedilenler ekran görüntüleri kullanıcıya gösterilir ve onaylanır.
- typecheck, lint, birim testler ve Maestro (misafir + hesap) yeşil; `testID`'ler korunmuş.
- Türkçe karakter taraması temiz.
