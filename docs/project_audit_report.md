# SmartScrolling Proje Denetim Raporu

> Rol: Senior Business Analyst  
> Tarih: 2026-04-13  
> Kapsam: Ürün, mimari, mobil uygulama, Supabase, AI pipeline, süreç ve kalite

---

## 1. Yönetici Özeti

SmartScrolling fikri güçlü ve ticari olarak anlamlı bir probleme dokunuyor: doom scrolling alışkanlığını doğrulanmış bilgi, kısa içerik akışı, kitap okuma ve bağlamsal yapay zeka ile dönüştürmeyi hedefliyor.

Ancak mevcut repo durumu, dokümanlarda anlatılan "MVP" ile birebir örtüşmüyor. Kod tabanı şu an daha çok iyi görselleştirilmiş bir prototip/demoya benziyor. Arayüz tarafında önemli ilerleme var; fakat gerçek kullanıcı akışı, kalıcı veri işlemleri, AI entegrasyonu, ölçümleme, kalite kapıları ve release hazırlığı henüz tamamlanmamış.

Sonuç olarak:

- Ürün yönü doğru
- Teknik temel kısmen kurulmuş
- Demo etkisi yüksek
- MVP operasyonel olgunluğu henüz yeterli değil

---

## 2. Güçlü Yönler

- Fikir net ve farklılaşabilir: kısa bilgi akışı + kitap okuyucu + AI yardımcı
- Monorepo yapısı kurulmuş
- Mobil uygulama için görsel yön ve etkileşim dili oluşmuş
- Supabase şema ve temel RLS yaklaşımı başlatılmış
- İçerik pipeline düşüncesi ürünle uyumlu
- Ürün vizyonu ve roadmap belgeleri mevcut

---

## 3. Kritik Bulgular

## 3.1 Ürün ve Gerçek Durum Uyumsuzluğu

Dokümanlarda MVP içinde var gibi görünen bazı özellikler kod tarafında henüz gerçeklenmemiş durumda:

- AI chat
- AI definition entegrasyonu
- auth
- streak sistemi
- push notification
- reading progress senkronizasyonu
- gerçek bookmark akışı
- admin/CMS paneli

Bu durum iş açısından iki risk üretir:

- paydaş beklentileri gerçeğin önüne geçer
- planlama ve süre tahminleri olduğundan iyimser görünür

Değerlendirme:

- Mevcut durum: prototip + kısmi altyapı
- Doküman dili: çalışan MVP
- Öneri: "demo", "in progress", "done" ayrımı tüm belgelerde netleştirilmeli

## 3.2 Kod Kalitesi ve Teslim Riski

Statik kontroller mevcut haliyle geçmiyor:

- `npm run lint` başarısız
- `npx tsc --noEmit` başarısız

Bu, yeni özellik ekledikçe bakım maliyetinin hızla artacağı anlamına gelir. Özellikle TypeScript derleme hataları, ekip büyüdüğünde hız kaybettirir.

## 3.3 Veri Modeli Uyumsuzluğu

Frontend tipleri ile Supabase veri alanları tam uyumlu değil.

Örnek sorunlar:

- UI bazı yerlerde `text` beklerken veritabanı `content` kullanıyor
- UI bazı yerlerde `source` varsayarken veri `source_label`
- bazı alanlar gevşek typing veya `any` ile taşınıyor

İş etkisi:

- sessiz veri hataları
- ekranların üretimde kırılması
- analitik ve kişiselleştirme için güvenilmez veri

## 3.4 AI Katmanı Henüz Ürüne Bağlanmamış

Ürünün ana farklılaştırıcısı olan AI tarafı halen starter düzeyinde:

- Supabase Edge Functions gerçek iş mantığı içermiyor
- "Yapay Zekaya Sor" akışı gerçek backend'e bağlı değil
- popup açıklamaları mock veri ile çalışıyor

Bu nedenle ürünün en güçlü vaat ettiği deneyim henüz gerçek değil.

## 3.5 Etkileşimler Kalıcı Değil

Feed içindeki:

- beğen
- kaydet
- paylaş

aksiyonları çoğunlukla local state seviyesinde kalıyor. Bu da şu sonuçlara yol açıyor:

- retention verisi üretilemez
- kullanıcı davranışı ölçülemez
- favoriler gerçek hesap verisine dönüşmez

## 3.6 Test ve Release Süreci Eksik

CI kurulmuş olsa da güvence seviyesi düşük:

- typecheck yok
- unit test yok
- e2e test yok
- migration doğrulama yok
- edge function doğrulama yok

Bu nedenle release kalitesi kişisel dikkatle korunuyor; sistematik şekilde korunmuyor.

## 3.7 Dokümantasyon ve Onboarding Zayıf

Mobil README hâlâ büyük ölçüde Expo starter içeriği taşıyor. Projeye özel şu başlıklar eksik:

- local kurulum
- env değişkenleri
- Supabase bağlantısı
- seed akışı
- pipeline çalıştırma
- bilinen sorunlar
- release adımları

Bu eksik, yeni ekip üyelerinin projeye giriş maliyetini artırır.

## 3.8 İçerik Operasyonu ve Editoryal Süreç Eksik

Pipeline teknik olarak anlamlı bir başlangıç fakat editoryal kalite katmanı henüz zayıf:

- random kaynak seçimleri kaliteyi dalgalandırabilir
- duplicate kontrolü sınırlı
- manuel onay/inceleme akışı yok
- kategori doğrulama heuristik düzeyde

Bu, uzun vadede içerik güvenilirliği markasını zedeleyebilir.

---

## 4. İş Perspektifinden En Büyük Eksikler

MVP'nin gerçekten pazara çıkabilir hale gelmesi için aşağıdaki alanlar eksik:

- Kullanıcı hesabı ve oturum yönetimi
- Kaydetme ve ilerleme takibi
- Gerçek AI destekli okuma ve chat deneyimi
- Streak ve retention mekanikleri
- Push notification
- İçerik operasyon paneli
- Analytics ve event tracking
- Test ve kalite kapıları
- Ürüne özel teknik dokümantasyon

---

## 5. Gelişim Fırsatları

## 5.1 Ürün Fırsatları

- "Reels benzeri ama doğrulanmış bilgi" konumlandırması güçlendirilebilir
- kitap içi bağlamsal AI deneyimi farklılaştırıcı olabilir
- günlük hedef ve streak mekanikleri retention için yüksek potansiyel taşıyor
- freemium model, AI kullanım limiti ile mantıklı şekilde kurgulanabilir

## 5.2 Teknik Fırsatlar

- Supabase altyapısı ile hızlı MVP çıkarılabilir
- mevcut pipeline geliştirilirse içerik üretim maliyeti düşer
- tek veri sözleşmesi kurulursa frontend-backend bakım maliyeti ciddi azalır
- CI kapıları düzeltildiğinde ekip ölçeklenmesi kolaylaşır

## 5.3 Operasyonel Fırsatlar

- içerik için draft-review-publish süreci kurulabilir
- roadmap gerçekle hizalanırsa sprint planlama daha güvenilir olur
- analytics ile hangi içerik tipinin daha çok tutunduğu ölçülebilir

---

## 6. Stratejik Öneri

Bu projede en doğru kısa vadeli yaklaşım yeni özellik yağdırmak değil, önce "MVP Stabilization Sprint" yapmaktır.

Öncelik sırası şöyle olmalı:

1. Kalite kapılarını yeşile döndür
2. Veri modelini tekilleştir
3. Gerçek AI backend'ini bağla
4. Kullanıcı verisini kalıcı hale getir
5. Retention mekaniklerini ekle
6. İçerik operasyonunu olgunlaştır

---

## 7. Sonuç

SmartScrolling yanlış yönde giden bir proje değil; tersine, yönü doğru ama teslim olgunluğu eksik bir proje.

En önemli mesaj şu:

- Fikir var
- deneyim dili var
- altyapı başlangıcı var
- fakat MVP'nin çalışır, ölçülebilir ve sürdürülebilir hale gelmesi için ciddi bir hizalama sprintine ihtiyaç var

Bu raporun devamı olarak `docs/project_action_plan.md` dosyasında uygulanabilir adım adım plan hazırlanmıştır.

---

## 8. Senior Backend Developer İncelemesi ve Teknik Müdahale Noktaları (Audit Mitigations)

Backend kurgusundaki kritik uyumsuzlukların çözümü için yapılması gereken teknolojik müdahaleler:

1. **Authentication ve Veri Kalıcılığı Kopukluğu**
   - *Sorun:* Auth mekanizması aktif olmadığı için, kullanıcı verileri (likes, bookmarks, vb.) RLS (Row-Level Security) tarafında güvensiz ve sahipsiz durumda.
   - *Müdahale:* Supabase `auth.users` tetikleyicileri (PostgreSQL Triggers) kurularak, sistemin `uuid` bazlı bir referans sistemine (public.users) geçirilmesi şarttır. Local storage yerine, veritabanındaki oturum UUID'si baz alınmalıdır.

2. **Deno Edge Functions Mimarisi Boşluğu**
   - *Sorun:* AI özelliklerinin (ai-chat ve ai-definition) yalnızca Supabase'de klasör açıldığı, aslında hiçbir Deno bağımlılığı ya da Groq entegrasyonu içermediği gözlemlenmiştir. Frontend yapay zekayı "mock"luyor.
   - *Müdahale:* Edge Function'lara `npm i @supabase/functions-js` eklenerek CORS header'ları ve Groq API (LLama 3) RAG bağlantısı derhal kodlanmalıdır. Proxy sunucu olarak Supabase kullanılmalı ki Client tarafından API Key çalınması önlensin.

3. **Veritabanı Alan Adlandırması (Schema Drift)**
   - *Sorun:* Mobil arayüz `text` beklerken DB `content` tutuyor.
   - *Müdahale:* Supabase CLI üzerinden `npx supabase gen types typescript` ile DTO (Data Transfer Object) class'ları üretilmeli ve React component prop'larına kesin `Type-Casting` zorlanmalıdır. (Örn: `export type Database = { ... } ` tanımları).

4. **Okuma Durumu Senkronizasyonu (Reading Progress Sync)**
   - *Sorun:* Reader içerisindeki scroll state %22 gibi sabitlenmiş, kalıcılığı yok.
   - *Müdahale:* Backend tarafında bir RPC (Remote Procedure Call) yazılmalı, frontend her 1000ms debounce ile `current_scroll_y` lokasyonunu Supabase'e atmalı, farklı cihaza geçildiğinde DB'den son state çekilip ekrana konumlanmalıdır.
