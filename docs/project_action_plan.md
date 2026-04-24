# SmartScrolling Adım Adım Aksiyon Planı

> Amaç: Projeyi prototip/demodan ölçülebilir ve teslim edilebilir MVP seviyesine taşımak  
> Tarih: 2026-04-13

---

## 1. Planlama Prensibi

Bu plan 4 ana evreye ayrılmıştır:

1. Stabilizasyon
2. Çekirdek MVP
3. Retention ve Operasyon
4. Yayın Hazırlığı

Her adım tamamlanmadan sonraki adıma geçilmemesi önerilir. Özellikle kalite kapıları kapanmadan yeni özellik geliştirme hızı geçici olarak düşürülmelidir.

---

## 2. Evre 1: Stabilizasyon Sprinti

## Hedef

Kod tabanını güvenilir hale getirmek ve doküman-gerçeklik uyumunu sağlamak.

## Adımlar

### 2.1 Kod Kalite Kapılarını Düzelt

- `npm run lint` hatalarını sıfırla
- `npx tsc --noEmit` hatalarını sıfırla
- Biome kurallarını repo genelinde temizle
- import düzeni, `any` kullanımı ve tip açıklarını kapat

Çıktı:

- Lint yeşil
- Typecheck yeşil
- Ana ekranlar derlenebilir durumda

### 2.2 Veri Sözleşmesini Tekilleştir

- `FactType`, `BookType`, kullanıcı tipleri ile Supabase şemasını eşleştir
- frontend alan adlarını veritabanı ile aynı hale getir
- mock veri alanları ile gerçek veri alanlarını ayır
- veri map eden merkezi adapter katmanı oluştur

Çıktı:

- frontend-backend alan uyumu
- sessiz veri hatalarının azalması

### 2.3 Dokümantasyon Temizliği

- roadmap'te "tamamlandı / kısmi / planlandı" ayrımı yap
- architecture dokümanını gerçek stack'e göre güncelle
- mobil README'yi projeye özel hale getir
- local setup, env, Supabase ve pipeline akışını belgeye ekle

Çıktı:

- ekip içi beklenti uyumu
- onboarding hızlanması

### 2.4 CI Güvence Katmanı Ekle

- GitHub Actions içine `typecheck` ekle
- mobil uygulama için temel build doğrulaması ekle
- mümkünse Supabase function lint/check adımı ekle

Çıktı:

- kırık kodun ana dala çıkması zorlaşır

---

## 3. Evre 2: Çekirdek MVP Tamamlama

## Hedef

Kullanıcının gerçekten kullanabileceği temel ürün döngüsünü bitirmek.

## Adımlar

### 3.1 Auth Omurgasını Kur

- email/şifre login
- oturum kalıcılığı
- kullanıcı profil kaydı oluşturma
- çıkış ve session yönetimi

Çıktı:

- anonim demo yerine gerçek kullanıcı sistemi

### 3.2 Feed'i Gerçek Ürün Akışına Çevir

- facts pagination ekle
- infinite scroll ekle
- loading/error/empty durumlarını standartlaştır
- kaydet/beğen aksiyonlarını backend ile kalıcı hale getir
- bookmark tablosuna yazım akışını tamamla

Çıktı:

- gerçek tüketilebilir feed
- davranış verisi üretimi

### 3.3 Kütüphane ve Reader'ı Canlı Veriye Bağla

- kitap listesini Supabase'den çek
- kitap detay ekranı ekle
- reader içeriğini mock yerine veri tabanına veya storage içeriğine bağla
- reading progress yazımını ekle
- kaldığı yerden devam et akışını tamamla

Çıktı:

- gerçek kitap deneyimi

### 3.4 AI Definition Servisini Gerçekleştir

- `ai-definition` edge function içine gerçek Groq çağrısı ekle
- word/context payload tasarla
- cevap cache mantığı oluştur
- hata ve timeout durumlarını ele al

Çıktı:

- popup içindeki AI açıklama gerçek olur

### 3.5 AI Chat Akışını Gerçekleştir

- `ai-chat` edge function içinde prompt yapısını tasarla
- aktif kitap/konu bağlamını ekle
- chat geçmişi kaydet
- kullanım limiti altyapısını hazırla

Çıktı:

- ürünün ana farklılaştırıcısı aktif hale gelir

---

## 4. Evre 3: Retention ve Operasyon Katmanı

## Hedef

Kullanıcıların geri dönmesini sağlamak ve içerik operasyonunu sürdürülebilir yapmak.

## Adımlar

### 4.1 Streak ve Aktivite Sistemi

- günlük aktivite event modelini tanımla
- `user_activity` yazımını aktif et
- streak hesaplama mantığını kur
- profil ekranını gerçek veriye bağla

Çıktı:

- retention için gerçek temel

### 4.2 Günlük Hedef ve İlerleme Bileşenleri

- günlük kart hedefi
- günlük sayfa hedefi
- ana ekranda özet widget
- haftalık aktivite görünümü

Çıktı:

- kullanıcı motivasyonu artar

### 4.3 Push Notification

- Expo push token toplama
- bildirim izin akışı
- hatırlatma saati ayarı
- streak ve yeni içerik bildirimleri

Çıktı:

- geri çağırma mekanizması oluşur

### 4.4 İçerik Kalite Operasyonu

- pipeline çıktısı için kalite checklist belirle
- duplicate kontrolünü geliştir
- kaynak whitelist ekle
- draft/review/publish süreci tasarla

Çıktı:

- içerik markası daha güvenli hale gelir

### 4.5 Basit Admin/CMS Başlangıcı

- facts listeleme
- fact düzenleme
- kitap yükleme
- highlight yönetimi

Çıktı:

- manuel içerik kontrolü mümkün olur

---

## 5. Evre 4: Yayın Hazırlığı

## Hedef

MVP'yi test edilebilir, izlenebilir ve mağazaya hazırlanmış hale getirmek.

## Adımlar

### 5.1 Ölçümleme ve Analytics

- event taxonomy çıkar
- kritik eventleri tanımla
- hangi kartlar okundu, kaydedildi, tamamlandı izle
- AI kullanım metriklerini topla

Çıktı:

- hangi özelliğin tuttuğu ölçülebilir

### 5.2 Test Katmanı

- en azından kritik akışlar için unit test yaz
- login, feed, save, reader, AI popup için smoke test yaz
- mümkünse Maestro ile 1-2 temel e2e senaryo oluştur

Çıktı:

- regresyon riski azalır

### 5.3 Hata İzleme ve Operasyon

- Sentry veya benzeri crash reporting kur
- edge function log takibini standardize et
- release checklist hazırla

Çıktı:

- üretim sorunları daha hızlı bulunur

### 5.4 Uyumluluk ve Yayın

- KVKK/GDPR temel akışlarını gözden geçir
- kullanıcı veri silme/export yaklaşımını tasarla
- store asset ve açıklamalarını hazırla
- TestFlight/internal testing sürecini başlat

Çıktı:

- yayın öncesi riskler azalır

---

## 6. Önceliklendirme

## P0 - Hemen Başlamalı

- lint ve typecheck düzeltmesi
- veri modeli hizalaması
- roadmap ve doküman gerçeklik güncellemesi
- auth temel akışı
- gerçek AI definition endpoint

## P1 - Hemen Ardından

- bookmark kalıcılığı
- reading progress
- AI chat
- feed pagination
- profilin gerçek veriye bağlanması

## P2 - MVP Sonrası Ama Yakın

- streak
- push notification
- analytics
- admin panel başlangıcı
- içerik kalite süreci

## P3 - Sonraki Sürüm

- gamification genişletme
- öneri motoru
- sosyal özellikler
- abonelik optimizasyonu

---

## 7. Önerilen Sprint Sırası

### Sprint 1

- kalite kapıları
- veri modeli
- dokümantasyon
- CI iyileştirmesi

### Sprint 2

- auth
- feed kalıcılığı
- gerçek kitap verisi

### Sprint 3

- AI definition
- AI chat
- reading progress

### Sprint 4

- streak
- hedef sistemi
- push notifications

### Sprint 5

- analytics
- admin/CMS başlangıcı
- yayın hazırlığı

---

## 8. Başarı Kriterleri

Bu planın başarıyla ilerlediğini söylemek için minimum şu koşullar sağlanmalı:

- repo lint ve typecheck geçiyor olmalı
- en az 1 gerçek kullanıcı giriş yapabiliyor olmalı
- feed canlı veriden akmalı
- save/bookmark kalıcı çalışmalı
- reader ilerleme kaydedebilmeli
- AI popup gerçek yanıt verebilmeli
- profil gerçek kullanıcı verisi göstermeli
- temel analytics eventleri toplanmalı

---

Önce projeyi "güzel demo" olmaktan çıkarıp "güvenilir ürün iskeleti" haline getirmek, sonra retention ve ölçeklenme katmanını eklemek.

En kritik hata, bu aşamada yeni ekran eklemek değil; mevcut temel omurgayı tamamlamadan kapsamı büyütmektir.

---

## 10. Senior Backend Developer Teknik Görev ve Adımlar Listesi (Uygulama Rehberi)

> Bu bölüm, sistemin backend/veritabanı eksiklerini tamamen üretim (production) standartlarına getirmek için gerekli olan komut ve teknik adımları içerir. Süreç doğrudan Supabase ve Edge Functions üzerinde koşacaktır.

### Adım 1: Supabase Yerel Geliştirme Ortamının (Docker) Ayağa Kaldırılması
- [ ] Supabase CLI kur ve `supabase start` ile yerel Supabase (Postgres, Auth, Storage, Edge Functions) docker konteynerlerini ayağa kaldır.
- [ ] Mevcut `migrations/20260409000000_schema_and_rls.sql` betiğinin yerel ortama basıldığını onayla (`supabase db reset`).
- [ ] Eksik olan Typescript tiplerini DB üzerinden üret (`supabase gen types typescript --local > apps/mobile/src/types/supabase.ts`).

### Adım 2: Authentication (Kimlik Doğrulama) Akışının İnşası
- [ ] `public.users` tablosuna trigger bağla: Kullanıcı Supabase Auth (Sign Up) üzerinden oluştuğunda otomatik olarak `auth.users` tablosunu dinleyen bir PostgreSQL Trigger ile `public.users` (id, email, created_at) tablosunu doldur.
- [ ] Frontend'de `apps/mobile/src/lib/supabase.ts` içerisine Session dinleyicisi `supabase.auth.onAuthStateChange` ekle ve bunu Zustand state'ine (AuthStore) bağla.
- [ ] RLS Politikalarını Kontrol Et: `facts` herkes tarafından okunabilir (`SELECT` public) olmalı, ancak `bookmarks`, `reading_progress` gibi tablolar KESİNLİKLE `auth.uid() = user_id` şartına bağlı olmalıdır.

### Adım 3: Edge Functions'ların (AI Katmanı) Groq API'ye Bağlanması
- [ ] `supabase/functions/ai-definition/index.ts` oluştur. Gelen POST isteğinden `word` ve `context` (bağlam/kitap metni) al, Server-side Deno üzerinden Groq API (Llama 3 8B veya 70B) kullanarak Türkçe etimolojik tanım + kitap içi bağlam açıklaması ürettir ve frontend'e dön.
- [ ] `supabase/functions/ai-chat/index.ts` oluştur. Kullanıcının sormuş olduğu açık uçlu soruları, ilgili kitabın metadata'sı ile harmanlayıp RAG (Retrieval-Augmented Generation) veya düz prompt enjeksiyonu ile LLaMA'ya gönder. Prompt'a *"Sen bilge bir kütüphanecisin..."* gibi bir persona giydir.
- [ ] `supabase secrets set GROQ_API_KEY=xxx` komutuyla Supabase local ve remote projelerine çevre değişkenlerini aktar.

### Adım 4: Etkileşimlerin (Likes, Saves, Progress) Kalıcılaştırılması
- [ ] Frontend'deki `toggleLike` fonksiyonunu gerçek bir Supabase RPC veya Bulk Insert çağrısına dönüştür: Kullanıcı fact'e like attığında `user_likes` (veya `bookmarks`) tablosuna insert at.
- [ ] Reader (Okuyucu) ekranından çıkıldığında veya %1'lik bir sayfa scroll edildiğinde, `reading_progress` tablosuna `UPSERT` atarak kullanıcının nerede kaldığını (last_location_slug/scrollbar_y_offset) veritabanına yedekle.
- [ ] Bütün bu API isteklerinde Optimistik UI (Önce arayüzü güncelle, arkadan isteği at) paternini muhafaza et ki hızdan ödün verilmesin.

### Adım 5: Backend Deployment (CI/CD Entegrasyonu)
- [ ] Yapılan tüm şema değişikliklerini GitHub main branch'e merge'lendiğinde otomatik olarak Prod Supabase tablosuna deploy edecek Supabase GitHub Action betiğini (`.github/workflows/supabase-deploy.yml`) yaz.
- [ ] Edge function'ları `supabase functions deploy` komutu ile canlıya al.
- [ ] Auth sağlayıcılarını (Google Account / Apple Sign-In) Supabase Dashboard üzerinden yapılandır.
