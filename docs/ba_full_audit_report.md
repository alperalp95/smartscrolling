# 📈 Senior Technical Business Analyst - Proje Risk ve Eksiklik Raporu

**Tarih:** 15 Nisan 2026  
**Odak:** Ticari Sürdürülebilirlik, App Store Uyumluluğu, Kullanıcı Edinme (Acquisition) ve Elde Tutma (Retention).

Mevcut projeyi, dokümanları ve repo durumunu bir **Senior Technical Business Analyst (BA)** vizyonuyla inceledim. Kod kalitesi ve mimari yavaş yavaş "Senior Backend/Frontend" seviyesine ulaşıyor. Ancak, projenin **"Ticari bir ürün olarak mağazalarda yayınlanıp para kazandırması"** hedefi baz alındığında, iş ihtiyaçları (business requirements) açısından ciddi kör noktalarımız var. İşte detaylar:

---

## 1. İlk Kullanıcı Deneyimi (FTUE) ve Onboarding Eksikliği
Uygulamayı indiren kullanıcı şu anda doğrudan "Feed" (Akış) veya Kayıt ekranına düşüyor.
* **Problem:** Blinkist, Headway, Duolingo gibi başarılı uygulamaların indirme sonrası dönüşüm oranları (conversion) **Onboarding (Karşılama) ekranlarında** yatar. Kullanıcıya "Günde kaç dakika okursun?", "Hangi konularla ilgileniyorsun?" gibi sorular sormadan doğrudan içeriğe atıyorsunuz.
* **Müdahale:** `P4-01` olarak işaretlenen "Kullanıcı ilgi alanı seçme" adımı aslında MVP (P0) olmalıdır. Kullanıcının verdiği cevaplara göre kişiselleştirilmiş bir akış algısı (Psikolojik olarak yatırım yapma hissi) yaratılmazsa 1. gün terk etme oranı (D1 Churn) %80'leri geçer. Roadmap'te Phase 0 veya Phase 1'e büyük bir "Onboarding Quiz" görevi eklenmelidir.

## 2. Para Kazanma ve Ödeme Duvarı (Paywall) Geçişleri
Roadmap'te "P0-04 Monetizasyon (RevenueCat)" başarıldı (✅) olarak işaretlenmiş. Ancak teknik tarafta gerçek bir engelleyici / Paywall ekranı yok.
* **Problem:** Kütüphanedeki "PRİM" (Premium) rozetli kitaplar veya "Günde 5 AI Sorusu" limitleri için kullanıcıyı karşılayacak, satın almaya ikna edecek, Apple Pay / Google Play Faturalandırma tetikleyecek bir **Paywall (Ödeme Duvarı) ekranı** eksik.
* **Müdahale:** RevenueCat entegrasyonu kodlanmalı ve uygulamanın içine "Premium'a Geç" popup'ı ve ikna edici UX öğeleri (özellik kıyaslama tablosu) tasarlanmalıdır. Aksi halde gelirsiz bir ürün modeli oluşur.

## 3. Apple App Store Kritik Red Sebepleri (Compliance/Legal)
Eğer bu haliyle uygulamayı Apple'a gönderirsek %100 oranında (Red) yiyeceğimiz 3 açık nokta var:
1. **Yapay Zeka Raporlama:** AI Chat özelliği barındıran uygulamalarda Apple, kullanıcıların "Yanlış veya Sakıncalı" AI çıktılarını raporlayabileceği bir "Şikayet Et/Raporla" butonu arar.
2. **Hesap Silme (Account Deletion):** Profil (profile.tsx) sayfasında şu an sadece "Çıkış Yap" var. Apple kuralları gereği (App Store Guideline 5.1.1), hesap açılabilen her uygulamada net bir "Hesabımı ve Verilerimi Sil" butonu zorunludur.
3. **EULA & Gizlilik Sözleşmesi (Privacy Policy):** Kayıt/Login ekranlarında (Checkbox veya direkt bilgilendirme ile) bu iki belgenin Onay mekanizması eksik.

## 4. Kullanıcı Davranış Analitiği (Analytics) Eksikliği
Şu an backend (Supabase) entegrasyonlarını yapıyoruz ama kullanıcının uygulamanın neresinde sıkıldığını bilmiyoruz.
* **Problem:** Uygulamayı canlıya aldığımızda "A-B Testleri" yapamayacağız. Hangi bilgi kartının (Tarih mi? Felsefe mi?) daha çok kaydırıldığını, okuyucuda insanların yüzde kaçında çıktığını ölçen bir "Event Taxonomy" yok.
* **Müdahale:** PostHog, Mixpanel veya Amplitude gibi bir Product Analytics aracı entegre edilmeli. (Örn: `posthog.capture('swipe_next_fact', { category: 'Bilim' })`).

## 5. Çevrimdışı (Offline) Uyumsuzluk ve Bellek Yönetimi
Resimler NASA'dan ve AI platformlarından (1080x1920 yüksek çözünürlükte) geliyor.
* **Problem:** Tiktok tarzı FlatList akışlarında görseller bellekten (RAM) temizlenmezse veya internet kesildiğinde (Metroda/Uçakta) önbelleğe alınmazsa uygulama çöker ya da çok kötü bir deneyim sunar.
* **Müdahale:** Görseller için Expo SDK içindeki `expo-image` (disk ve memory cache özellikli) komponentine kesin geçiş yapılmalı. Yüklenen "Hap Bilgiler" SQLite veya MMKV ile lokale indirilip offline okunabilir olmalı.

---

### Özet ve Yönlendirme (Next Steps)
Teknik kod kalitesi ve backend altyapısı hızla "Uygulanabilir" seviyeye geliyor. Fakat **Ticari ve Ürün/Pazar Uyumu (Product/Market Fit)** açısından yukarıdaki eksikler piyasaya çıkışımızı engelleyecektir. 

Bir Senior Business Analyst olarak tavsiyem; Backend/Auth kodlamasına (Şu anki mühendislik sprint odağımız) devam ederken, bir sonraki iş planına **Onboarding (FTUE)**, **Account Deletion (Apple uyumluluğu)** ve **Analytics (Metrik)** yapılarını MVP'ye kesinlikle dahil etmemizdir. Kullanıcılar ne kadar kalıyor ölçemezsek, onlara doğru ürünü sunamayız.
