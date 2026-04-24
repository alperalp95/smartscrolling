# 📋 SmartScrolling — Proje Geliştirme Yol Haritası

> **Versiyon:** v0.2 — MVP Revizyonu  
> **Tarih:** Nisan 2026  
> **Hedef Platformlar:** Android, iOS (React Native / Expo)

---

## 🔵 PHASE 0 — Ürün Stratejisi ve Planlama

- [x] **P0-01** Hedef kitle araştırması yap (18-35 yaş, bilgi dostu kullanıcılar)
- [x] **P0-02** Rakip analizi yap (Blinkist, Headway, Refind, ReadWise)
- [x] **P0-03** MVP kapsamını netleştir (hangi özellikler ilk sürümde olacak?)
- [x] **P0-04** Monetizasyon modelini belirle (Freemium? Abonelik? Reklamsız prim?)
- [x] **P0-05** Kullanıcı yolculuğu haritasını (user journey map) çiz
- [x] **P0-06** Wireframe / Lo-fi prototip hazırla (Figma)
- [x] **P0-07** İçerik lisansı ve telif hakkı stratejisini belirle (kitaplar için)
- [ ] **P0-08** Yapay zeka kullanım maliyetlerini tahmin et (OpenAI / Gemini API fiyatları)

---

## 🟡 PHASE 1 — Altyapı ve Temel Kurulum

### 1.1 Proje Kurulumu
- [x] **P1-01** Monorepo yapısını kur (Turborepo veya Nx)
- [x] **P1-02** React Native + Expo projesi başlat
- [x] **P1-03** TypeScript konfigürasyonu yap
- [x] **P1-04** Biome (Linter/Formatter) kurulumu
- [x] **P1-05** CI/CD pipeline kur (GitHub Actions / EAS Build)

### 1.2 Backend Altyapısı
- [x] **P1-06** Supabase projesi oluştur (Auth + Database + Storage)
- [x] **P1-07** Veritabanı şemasını tasarla (users, books, facts, bookmarks, reading_progress)
- [x] **P1-08** Row-Level Security (RLS) politikalarını tanımla
- [x] **P1-09** Edge Functions için ortam kur (Supabase Functions veya Node.js API)
- [ ] **P1-10** Redis / önbellek katmanını kur (API hız limitleri için)

### 1.3 Kimlik Doğrulama
- [ ] **P1-11** Email/şifre ile kayıt & giriş sistemi
- [ ] **P1-12** Google OAuth entegrasyonu
- [ ] **P1-13** Apple Sign-In entegrasyonu (App Store zorunluluğu)
- [ ] **P1-14** JWT token yenileme mekanizması

### 1.4 Veri ve İçerik Kaynakları Yönetimi
> Yapay zeka ile işlenip sisteme aktarılacak olan ham veri kaynakları.
- [x] **P1-15** Veri çekilecek kaynakların belirlenmesi (Tamamlandı)
- [x] **P1-16** Kısa Bilgiler (Facts) için NASA API entegrasyon aracı
- [x] **P1-17** 🚫 İPTAL: Kısa Bilgiler (Facts) için Reddit veri çekme (Kalite sorunu nedeniyle reddedildi)
- [x] **P1-18** Kısa Bilgiler (Facts) için Wikipedia "Seçkin Maddeler" ve "Tarihte Bugün" kazıma sistemi
- [ ] **P1-19** Kitaplar (Books) için "Project Gutenberg" telifsiz kitap catalog/dump entegrasyonu
- [ ] **P1-19b** Gutenberg metadata ingest stratejisi (RDF catalog + plain text/EPUB normalize akisi)
- [ ] **P1-19c** `Storage = raw EN` ve `book_sections = TR reader edition` pilotunu ilk kitapta tamamla (Groq kota / model optimizasyonu bekleniyor)
- [x] **P1-20** Toplanan ham içeriklerin Llama 3 (Groq/AI) kullanılarak kısa mobil kart formatına (10 saniyelik okuma) dönüştürülmesi

---

## 🟠 PHASE 2 — Günlük Bilgi Akışı (Scroll Feed)

- [x] **P2-01** "Günlük Bilgi" ekran tasarımı
- [x] **P2-02** Dikey kaydırma (FlatList / FlashList) implementasyonu
- [x] **P2-03** Bilgi kartı bileşeni oluştur (başlık, içerik, kaynak, kategori etiketi)
- [x] **P2-04** Kategori filtresi ve SmartScrolling home fonksiyonu (Aktif & Buglar Giderildi)
- [x] **P2-05** İçerik CMS veya veritabanı şeması oluştur
- [x] **P2-06** Doğrulanmış kaynak etiketleme sistemi ve orijinal makaleye tıklanabilir Link (Wikipedia, NASA vb.)
- [x] **P2-07** İçerik küratörlük süreci tanımla (Wikipedia ve NASA API bazlı + 4K Pollinations.ai Görsel)
- [x] **P2-08** "Beğen / Kaydet / Paylaş" aksiyonlarını ekle
- [ ] **P2-09** Infinite scroll + pagination implementasyonu
- [ ] **P2-10** Offline mod için içerik önbellekleme
- [x] **P2-11** Bilgi kartlarına görsel/infografik desteği ekle

---

## 🔴 PHASE 3 — Kitap Okuma Modülü

### 3.1 Kitap Kütüphanesi
- [x] **P3-01** Kitap listesi ekranı (kapak, yazar, sayfa sayısı, kategori)
- [x] **P3-02** Arama ve filtreleme çubuğu (UI olarak var, fonksiyonu yazılacak)
- [ ] **P3-03** Kitap detay sayfası (özet, okuyucu istatistikleri)
- [x] **P3-04** "Okumaya Başla" ve "Devam Et" butonları
- [x] **P3-05** Ücretsiz / prim kitap ayrımı (UI Badge)

### 3.2 Okuyucu Ekranı
- [ ] **P3-06** Sayfalı yatay kaydırma okuyucu (PageView)
- [x] **P3-07** Alternatif: Dikey kaydırmalı okuyucu modu (Mevcut okuyucu yapısı)
- [ ] **P3-08** Yazı boyutu, satır aralığı, font ayarları
- [ ] **P3-09** Gece / gündüz modu
- [x] **P3-10** Okuma ilerlemesi (UI çubuğu mevcut)
- [ ] **P3-10b** Secili kutuphane kitaplari icin full `book_sections` rollout
- [ ] **P3-10c** TR reader edition pilotu: ilk kitapta `--translate-tr` apply ve kalite onayi
- [ ] **P3-11** Sayfa görüntüleme animasyonu

### 3.3 Kelime & Referans Sistemi
- [x] **P3-12** Kitap metnine HTML/Markdown etiketleme (highlighted kelimeler eklendi)
- [x] **P3-13** Vurgulanan kelimelere dokunma (tap) olayı ekleme
- [x] **P3-14** **AI Popup bileşeni** tasarla ve geliştir:
  - [x] Alt sayfa drawer animasyonu (smooth, modern)
  - [x] Kelime tanımı görünümü
  - [x] Referans açıklama görünümü
  - [x] "Yapay Zekaya Sor" butonu
- [ ] **P3-15** Popup için AI API çağrısı (streaming ile anlık yanıt - backend)
- [ ] **P3-16** Tanımları favorilere kaydetme

### 3.4 Yapay Zeka Sohbet Entegrasyonu
- [ ] **P3-17** "Yapay Zekaya Sor" chat arayüzü tasarla
- [ ] **P3-18** Bağlam yönetimi (aktif kitap / konu bilgisi prompt'a eklenmeli)
- [ ] **P3-19** Streaming yanıt (token bazlı, anlık gösterim)
- [ ] **P3-20** Sohbet geçmişini kaydet
- [ ] **P3-21** Kullanım limiti / rate limiting (freemium için günlük soru kotası)
- [ ] **P3-22** Sohbet yanıtlarında kaynak gösterimi

---

## 🟢 PHASE 3.5 — MVP Kritik: Kullanıcı Tutundurma (Retention)

> ⚠️ Bu özellikler MVP'ye dahil edilmezse ilk haftada kullanıcı kaybı yüksek olur.

### Streak Sistemi
- [x] **P35-01** Günlük giriş / okuma serisi (streak) sayacı (UI eklendi)
- [ ] **P35-02** Streak kırılma uyarısı ("Bugün henüz okumadın!")
- [x] **P35-03** Streak rekoru kaydetme ve görüntüleme (Profile eklendi)
- [ ] **P35-04** Streak koruması (1 günlük grace period veya freeze)
- [ ] **P35-05** Veritabanına `user_activity` tablosu ekle ve günlük kayıt tut

### İlerleme Göstergesi
- [ ] **P35-06** Ana ekranda "Bugün X kart okudun" özet widget'ı
- [ ] **P35-07** Günlük hedef belirleme (örn: 3 kart / 5 sayfa)
- [ ] **P35-08** Dairesel ilerleme çubuğu animasyonu (hedef tamamlanınca konfeti efekti)
- [ ] **P35-09** Haftalık aktivite grafiği (GitHub contribution graph benzeri)

### Push Notification
- [ ] **P35-10** Expo Push Notification entegrasyonu
- [ ] **P35-11** Kullanıcıya özel bildirim saati ayarı ("Her gün saat 20:00")
- [ ] **P35-12** Streak hatırlatıcı: "Serinizi kaybetmemek için bugün okuyun! 🔥"
- [ ] **P35-13** Yeni içerik bildirimi: "Bugünkü bilgi kartların hazır!"
- [ ] **P35-14** Bildirim tercihlerini profil ayarlarından yönetme

---

## 🟣 PHASE 4 — Kişiselleştirme ve Gelişmiş Gamification

> Bu aşama MVP sonrası 2. sürüm için planlanmıştır.

- [ ] **P4-01** Kullanıcı ilgi alanı seçme (onboarding akışı)
- [ ] **P4-02** Kişiselleştirilmiş bilgi önerileri (öneri motoru)
- [ ] **P4-03** Rozet ve başarım sistemi (ilk kitap, 7 günlük seri, 100 kart vb.)
- [ ] **P4-04** Detaylı istatistik ekranı (okunan sayfa, öğrenilen bilgi, karşılaştırmalar)
- [ ] **P4-05** Haftalık özet raporu (e-posta veya in-app)
- [ ] **P4-06** Arkadaş ekleme ve karşılaştırma (streak rekabeti)
- [ ] **P4-07** Sosyal paylaşım ("Bu hafta 3 kitap okudum" kartı)

---

## ⚫ PHASE 5 — İçerik Yönetimi (CMS/Admin)

- [ ] **P5-01** Admin paneli kurulumu (Next.js veya Supabase Studio)
- [ ] **P5-02** Bilgi kartı ekleme / düzenleme / silme arayüzü
- [ ] **P5-03** Kitap içeriği yükleme ve etiketleme (EPUB parse)
- [ ] **P5-04** Kelime/referans highlight editörü
- [ ] **P5-05** İçerik onay süreci (taslak → onay → yayın)
- [ ] **P5-06** İstatistik dashboard (en çok okunan, tıklanan kelimeler)

---

## 🔵 PHASE 6 — Test, Optimizasyon ve Yayın

- [ ] **P6-01** Unit testler (Jest + React Native Testing Library)
- [ ] **P6-02** E2E testler (Detox veya Maestro)
- [ ] **P6-03** Performans optimizasyonu (FlatList, memo, lazy loading)
- [ ] **P6-04** Erişilebilirlik (a11y) kontrolleri
- [ ] **P6-05** App Store / Google Play gerekliliklerini karşıla
- [ ] **P6-06** TestFlight ve Android Internal Testing aşaması
- [ ] **P6-07** Beta kullanıcı grubu oluştur ve geri bildirim topla
- [ ] **P6-08** App Store Optimization (ASO) — açıklamalar, anahtar kelimeler, ekran görüntüleri
- [ ] **P6-09** KVKK / GDPR uyumluluk kontrolü
- [ ] **P6-10** Crash reporting kurulumu (Sentry veya Bugsnag)

---

## 📊 MVP Kapsamı (Güncel)

| Özellik | MVP'de Var mı? | Faz |
|---|---|---|
| Günlük bilgi akışı (scroll feed) | ✅ Evet | Phase 2 |
| Kategori filtresi | ✅ Evet | Phase 2 |
| Kitap listesi ve okuyucu | ✅ Evet | Phase 3 |
| Kelime popup (AI tanım) | ✅ Evet | Phase 3 |
| Yapay Zekaya Sor (sohbet) | ✅ Evet | Phase 3 |
| 🆕 Streak sistemi (günlük seri) | ✅ Evet | Phase 3.5 |
| 🆕 İlerleme göstergesi + günlük hedef | ✅ Evet | Phase 3.5 |
| 🆕 Push notification (streak hatırlatıcı) | ✅ Evet | Phase 3.5 |
| Abonelik (RevenueCat) | ❌ Sonraki sürüm | Phase 4+ |
| Rozet / başarım sistemi | ❌ Sonraki sürüm | Phase 4 |
| Sosyal paylaşım + arkadaş | ❌ Sonraki sürüm | Phase 4 |
| Kişiselleştirilmiş öneri motoru | ❌ Sonraki sürüm | Phase 4 |
| Aktif öğrenme (quiz modu) | ❌ Sonraki sürüm | Phase 4+ |
| Audio mod | ❌ Sonraki sürüm | Phase 5+ |

---

*Son güncellenme: Nisan 2026*
