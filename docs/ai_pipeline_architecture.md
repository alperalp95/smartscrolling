# SmartScrolling — AI Veri Hattı (Data Pipeline) ve MVP Hacim Stratejisi

> **Tarih:** 12 Nisan 2026
> **Durum:** Tasarım Aşamasında (Daha sonra uygulanacak)

Bu belge, MVP aşamasında uygulamanın ana akışını (Sonsuz Kaydırma / Feed) dolduracak olan bilgilerin otomatik olarak nasıl üretileceğini, yapay zeka entegrasyon yöntemlerini ve hedeflenen içerik havuzu büyüklüğünü tanımlar.

---

## 1. MVP İçin İdeal İçerik (Fact) Hacmi

"Sonsuz kaydırma" (TikTok/Reels) hissiyatını başarılı bir şekilde verebilmek ve kullanıcıyı ilk 1-2 haftalık tutundurma (retention) periyodunda sıkmamak için matematiksel bir analiz yapılmıştır:

* **Tüketim Hızı:** 1 Kart = ~10 sn okuma. 
* **Oturum Süresi:** ~3-5 Dk = ~20-30 Kart tüketimi.
* **Günlük Tüketim:** Günde 2 giriş (Sabah/Akşam) = ~50-60 Kart.
* **14 Günlük Benzersiz İhtiyaç:** 14 gün x 60 kart = ~840 kart.

Kullanıcıların belirli spesifik kategorileri de filtreleyebileceği varsayılarak (örneğin sadece "Tarih" okuyan biri), MVP aşaması için toplam **1.300 benzersiz hap bilgi (fact)** üretilmesi hedeflenmektedir. Olası kategori dağılımı:
- 🔬 Bilim: ~300 Adet
- 📜 Tarih: ~300 Adet
- 🧠 Felsefe: ~300 Adet
- 💻 Teknoloji: ~200 Adet
- 🌱 Sağlık/Psikoloji: ~200 Adet

## 2. Mimari ve Teknoloji Seçimi (Groq + Llama 3)

Binlerce kaliteli hap bilgiyi insan gücüyle hazırlamak imkansız ve maliyetlidir. Bu hacme hızlı ve sıfıra yakın bir maliyetle ulaşabilmek için **Script Tabanlı Otomasyon** kullanılacaktır.

* **Neden Groq LPU?** Groq çipleri, dil modellerini saniyede 800+ kelime hızında çalıştırır. Binlerce belge saniyeler/dakikalar içinde taranabilir.
* **Neden Llama 3?** Açık kaynaklı ve API üzerinden Groq ile çok düşük maliyetlere çalışır. Komutları katı JSON formatında (Instruction-Following) döndürmekte harikadır.

## 3. Data Pipeline (Küratör Bot) Modülü İşleyişi

İleride sadece Node.js veya Python kullanılarak arka planda (backend) çalışacak bağımsız bir "Pipeline" modülü kurgulanacaktır. Bu modül sırasıyla şu adımları işletir:

1. **Scraping (Bağlantı Toplama):** NASA API, Reddit (`r/AskHistorians`), Wikipedia Seçkin Maddeler ve Gutenberg Metinleri üzerinden uzun (ham) yazılar indirilir.
2. **AI İşleme (Prompting):** Çekilen uzun metin, Groq (Llama 3) API'sine gönderilir. AI'a şu komut verilir:
   > *"Bu makaledeki en çarpıcı bilgiyi 10 saniyede okunabilecek mobil bir 'Hap Bilgi' formatına getir. Bana bir Title (Başlık), Content (İçerik/Özet), Category (Kategori) ve Tags (Etiketler) içeren bir JSON döndür."*
3. **Validasyon ve Kayıt:** Gelen JSON validasyondan geçer. Eğer doğru şemadaysa anında `Supabase -> public.facts` tablosuna (veritabanına) eklenir.

### 4. Supabase Veritabanı
Tüm `facts` tablosuna direkt `service_role` yetkisiyle arkaplandan yazılır. Kopya (duplicate) içerikler başlığa göre kontrol edilip (veya hata fırlatıldığında atlanıp) sadece benzersiz veriler içeri alınır. RLS kuralları atlandığı için çok hızlı bir ingestion sağlanır.

## 🚀 Gelecekte Veri Eklemek (Nasıl Çalıştırılır?)

Daha sonra uygulamaya yeni veri/fact eklemek istediğimizde **sadece şu adımları** izleyeceğiz:

1. **Pipeline Dizinine Geçiş Yapın:**
   ```bash
   cd packages/pipeline
   ```
2. **Çalıştırma Komutu:**
   Aşağıdaki komutu çalıştırarak NASA ve Wikipedia üzerinden otomatik olarak düzinelerce özgün içerik çekip (AI resimleriyle beraber) veritabanına ekleyebilirsiniz:
   ```bash
   npm run run:all
   ```
3. **Ayarları Değiştirmek (Opsiyonel):**
   Eğer tek seferde daha fazla içerik çekmek isteniyorsa `packages/pipeline/src/runners/run-all.js` dosyasındaki `CONFIG` objesini düzenleyerek sayıyı (count) artırabilirsiniz:
   ```javascript
   const CONFIG = {
     wikipedia: { count: 50, lang: 'en' },
     nasa: { count: 30 }
   };
   ```

**Notlar ve Kararlar:**
- **Neden Reddit'i Kapattık?** Kullanıcıların girdiği bilgilerin derinliği sığ kaldığı için ve belgesel kalitesi istediğimizden Reddit kaynağını devre dışı bıraktık.
- **Resim Kalitesi (4K Yapay Zeka):** Wikipedia'nın orjinal resimlerini veya bulunamazsa `Pollinations.ai` üzerinden yüksek çözünürlüklü (1080x1920) sinematik "Dark Atmosphere" parametreli üretilen resimleri çekiyoruz (Metin okunabilirliğini artırmak adına tasarlandı).
- **Yazı Uzunluğu:** Llama 3 (Groq) kullanılarak 100-150 kelimelik doyurucu paragraf açıklamaları üretiyoruz. Mobilde bozulmaması adına metin ScrollView içinde gösteriliyor.
