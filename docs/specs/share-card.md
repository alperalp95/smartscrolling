# Spec — Paylaşılabilir kart görseli

**Durum:** Taslak, kullanıcı onayı bekliyor · **Yazan:** Atlas (PO) · **Tarih:** 2026-11-27
**Tasarım taslağı:** scratchpad `share-mockup/paylasim-gorseli-taslak-2.html` (C2 / C1; kullanıcı seçti)

## 1. Neden
- Bugün "Paylaş" düğmesi sadece düz metin gönderiyor: `başlık + kaynak linki` (feed: `apps/mobile/components/feed/fact-post.tsx` `sharePost`; detay: `apps/mobile/app/fact/[id].tsx` satır ~103).
- Amaç **büyüme**: paylaşılan şey göze hoş, "paylaşılabilir" bir kart görseli olsun; gören kişi linke dokunsun.
- Link davranışı (hedef): uygulama yüklüyse doğrudan o kart açılır, yüklü değilse mağaza sayfası açılır. Uygulama henüz mağazada değil; alan adı henüz yok (bkz. §8).

## 2. Hedefler
| # | Hedef | Ölçüt |
|---|---|---|
| H1 | Paylaş = görsel + link | Paylaşım menüsüne 1080×1920 PNG ve link içeren metin birlikte gider |
| H2 | Tasarım C2 / C1 | Fotoğraflı kartta C2, fotoğrafsızda C1; taslakla aynı yerleşim, değerler temadan |
| H3 | Link kartı açar | Uygulama yüklüyken link `fact/[id]` ekranını açar (emülatörde uygulamanın kendi önekiyle doğrulanır) |
| H4 | Hiç bozulmaz | Görsel üretilemezse bugünkü metin paylaşımına düşer; kullanıcı her zaman paylaşabilir |
| H5 | Misafir de paylaşır | Giriş gerekmez |
| H6 | Link kaybolmaz | Paylaşımda kart linki panoya kopyalanır |

## 3. Kapsam dışı
- Alan adı, alan adındaki doğrulama dosyaları (iOS `apple-app-site-association`, Android `assetlinks.json`), yönlendirme sayfası, iOS `associatedDomains` / Android `intentFilters` ayarı → **mağaza öncesi ayrı iş** (Release listesi).
- Görsel atıfı / lisans satırı (kullanıcı kararı: şimdilik yok sayılır).
- Logo (projede yok; Expo varsayılan simgesi) → Release listesi. Bu işte logo yerine sadece yazı (wordmark) kullanılır.
- Paylaşım sayımı / "kim kimi getirdi" ölçümü (uygulamada analitik yok).
- Instagram Stories'e doğrudan gönderme düğmesi (Facebook App ID gerekir). Genel paylaşım menüsünden Instagram seçilebilir.
- Sunucu tarafında görsel üretimi.

## 4. Yaklaşımlar
1. **Telefonda üret (SEÇİLDİ):** Kart görseli uygulama içinde ekran dışında çizilir, `react-native-view-shot` ile PNG'ye çevrilir, `react-native-share` ile görsel + metin birlikte paylaşılır. Tema ve bileşenler tek yerde kalır, sunucu maliyeti yok. Bedeli: yeni yerel kütüphaneler → uygulama yeniden derlenir (OTA ile gitmez).
2. Sunucuda üret (Supabase edge function, PNG): tasarım ikinci kez başka ortamda yazılır, internet şart, yine yerel paylaşım kütüphanesi gerekir. Reddedildi.
3. Sadece `expo-sharing`: dosya paylaşır ama yanına metin/link ekleyemez → link tıklanamaz, amaca ters. Reddedildi.

## 5. Tasarım (kullanıcı onaylı yerleşim: C2, fotoğraf yoksa C1)
Tuval: **360×640 dp**, 3x yakalanır → **1080×1920 px**. Değerler `apps/mobile/src/theme` (colors, type, space, radius) — sabit renk/ölçü yazılmaz; temada olmayan değer temaya yeni giriş olarak eklenir.

Okuma sırası (yukarıdan aşağı):
1. **Zemin:** `colors.bg` üzerine `brandGradient` renklerinden üç yumuşak, bulanık ışık lekesi (sol üst turuncu, sağ orta pembe, sol alt mor) — `expo-linear-gradient` ile yaklaşık karşılık yeterli; birebir bulanıklık şart değil.
2. **Güvenli alanlar:** üstte 56 dp, altta 96 dp boş (Instagram düğmeleri). Yan boşluk `space.screen`.
3. **Wordmark:** "SmartScrolling", `type.screenTitle`, `colors.text`. (Logo yok — taslaktaki renk kutusu çizilmez.)
4. **Kart** (dikeyde ortada): zemin `colors.surface` %82 opak, köşe `radius.lg`.
   - **C2 (fotoğraflı):** iç boşluk `space.md`; üstte fotoğraf, yükseklik 170, köşe `radius.md`, `cover`. Altında `space.sm` iç boşlukla metin bloğu.
   - **C1 (fotoğrafsız):** iç boşluk `space.xl`; üstte degrade büyük tırnak işareti (“), sonra metin bloğu; başlık bir kademe büyük (26/30).
   - **Metin bloğu:** kategori (`type.meta`, degrade yazı — mevcut `GradientText`; okuma süresi YOK), başlık (`type.cardTitle`, `colors.text`), gövde (`type.body`, `colors.text`, en çok ~3–4 satır, alt kısmı solarak biter).
5. **Çağrı düğmesi:** "Devamı SmartScrolling'de" — degrade, köşe `radius.md`, yükseklik 42 (mevcut degrade düğmenin ölçüsü), `type.button`. Görselde dokunulmaz; sadece görüntü.
6. **Link satırı:** `type.caption`, `colors.textTertiary`, ortalı. **Sadece alan adı** gösterilir (ör. `smartscrolling.app`) — Atlas kararı: görseldeki link tıklanamaz, tam adres mesaj metninde gider; uzun `/fact/<id>` yolu görseli kirletir.

**C2 ne zaman:** sadece kartın **uzak** görseli varsa (`resolveFactMedia(fact).uri` dolu, yani Commons fotoğrafı) ve paylaşım anında yüklenebiliyorsa. Yerel ön ayar görselleri (tekrarlı/uyumsuz olabiliyor) → **C1**. Atlas kararı.

**Gövde metni:** kartın `content` alanı; görsel en çok 4 satır gösterir, sonu solar. Metin kesme/solma görsel tarafında yapılır, ayrı bir "ilk 2 cümle" ayrıştırması yapılmaz. Atlas kararı.

## 6. Davranış
- **Nereden:** feed kartındaki Paylaş (`feed-share-button`) ve kart detayındaki Paylaş (`fact-detail-share`). İkisi aynı paylaşım akışını kullanır.
- **Akış:** düğmeye basılınca düğme kısa süre meşgul görünür (ikinci basış yok sayılır) → görsel ekran dışında çizilir → fotoğraf varsa yüklenmesi beklenir (en çok ~3 sn; gelmezse C1) → PNG üretilir → paylaşım menüsü açılır: görsel + metin.
- **Mesaj metni:** `"<başlık>\n\nDevamı: <link>"`.
- **Link panoya (kullanıcı kararı, 27.11):** paylaşım menüsü açılırken kartın linki panoya da kopyalanır (`expo-clipboard`). Neden: Instagram hikâyesi ve bazı Android WhatsApp sürümleri görselle gelen metni atıyor; kullanıcı linki hikâyeye bağlantı çıkartması olarak yapıştırabilir. Not: Android'de kısa sistem bildirimi "Link kopyalandı" (`ToastAndroid`). iOS'ta bu işte not gösterilmez — projede hazır bir bildirim bileşeni yok, yeni bileşen bu işin kapsamı dışında (Atlas kararı). Metin paylaşımına düşülen hata yolunda da link kopyalanır.
- **Link:** `<SHARE_BASE_URL>/fact/<id>` — yol, mevcut `app/fact/[id].tsx` rotasıyla aynı; alan adı gelince ek rota gerekmez. `SHARE_BASE_URL` ve görselde gösterilen alan adı **kod bilmeyenin düzenleyebileceği tek bir ayar dosyasında**, açıklamalı (bugün yer tutucu: `https://smartscrolling.app`); README'de anlatılır.
- **Uygulama öneki:** `app.json` `scheme` bugün `"mobile"` ve Google/Apple giriş dönüşü (`src/lib/socialAuth.ts`, `scheme: 'mobile'`) buna bağlı. **Değiştirilmez**; `["mobile", "smartscrolling"]` olarak ikinci önek eklenir. `smartscrolling://fact/<id>` emülatörde kartı açmalı (detay ekranı kartı id ile kendisi çekiyor: `fetchFactById`).
- **Hata:** görsel üretimi ya da paylaşım kütüphanesi hata verirse → bugünkü `Share.share` metin paylaşımı (mesaj metni yukarıdaki gibi, kaynak linki yerine kart linki). Kullanıcı vazgeçerse (menüyü kapatırsa) hata gösterilmez.
- **Eski sürüm koruması (Atlas kararı):** yerel kütüphaneler savunmalı yüklenir; yeni JS eski bir uygulama derlemesine (OTA) giderse kütüphane bulunamaz → doğrudan metin paylaşımı (H4). Uygulama çökmez.
- **Fotoğraf gelmezse (Atlas kararı):** 3 sn içinde yüklenmeyen fotoğrafta görsel tamamen C1 düzeniyle çizilir (C1'in boşlukları ve başlık boyutu).
- **Ölü link (Atlas kararı):** alan adı alınana kadar mesajdaki https link hiçbir yere gitmez. Uygulama henüz kimsede olmadığı için kabul; bayrak/kapı yok. Alan adı mağaza öncesi işte (§8) bağlanır.
- **Misafir:** giriş istenmez.
- **Değişmeyecekler:** feed kartının ve detayın görünümü, diğer düğmeler (Beğen, Sor, Kaydet), okuma sayacı, akış sırası.

## 7. Kısıtlar
- Yerel kütüphaneler Expo SDK'sıyla uyumlu sürümde `npx expo install` ile eklenir; dev client yeniden derlenir (kullanıcının Terminal panelinde, `C:\ss` kopyası, Metro 8090 — bkz. proje notları).
- Inter fontu uygulama açılışında zaten yükleniyor; görsel aynı fontu kullanır.
- Wikimedia görselleri cihazda yükleniyor (IMG-00); paylaşım anında aynı URL kullanılır.
- Kullanıcıya görünen tüm metinler Türkçe ve Türkçe büyük harf kuralına uygun (`toLocaleUpperCase('tr-TR')`).

## 8. Açık konular / Release'e kalanlar
- Alan adı alınacak (`smartscrolling.app` boşta, 27.11 RDAP) → `SHARE_BASE_URL` güncellenir, doğrulama dosyaları + yönlendirme sayfası kurulur, iOS/Android link ayarları **mağazaya gidecek ilk build'den önce** eklenir.
- Logo tasarlanacak; gelince wordmark'ın soluna eklenir.
- Uygulama yüklü değilken gidilecek mağaza linkleri (iOS/Android) yönlendirme sayfasına yazılır.

## 9. Kabul
- Birim testler: varyant seçimi (uzak görsel var/yok/yerel), mesaj metni ve link üretimi, Türkçe büyük harf, linkin panoya kopyalanması (başarı ve metin paylaşımına düşen yol).
- Bileşen testi: C1 ve C2 doğru bloklarla çizilir; okuma süresi yok; çağrı metni doğru.
- Emülatörde (Atlas): feed ve detaydan paylaşım menüsü görsel + metinle açılır; Commons fotoğraflı bir kartta C2, fotoğrafsız/ön ayarlı kartta C1; üretilen PNG 1080×1920; `adb shell am start -d "smartscrolling://fact/<id>"` kartı açar; uçak modunda fotoğraflı kart C1'e düşer ya da metin paylaşımına iner, uygulama donmaz. Ekran görüntüleri `board/screens/`.
- Google ile giriş hâlâ çalışır (önek değişikliği bozmadı).
- Gerçek telefonda (kullanıcı): WhatsApp ve Instagram'a paylaşım denenir; görselin ve metnin hangi uygulamada vardığı not edilir.
- typecheck, lint, `npm run test:unit` geçer.
