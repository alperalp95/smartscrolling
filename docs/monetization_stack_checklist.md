# Monetization Stack Checklist

Bu dosya, reklam ve premium satin alma tarafinda dis sistemlere baglanirken hangi hesaplara ve hangi siraya ihtiyac oldugunu pratik sekilde takip etmek icin tutulur.

## 1. Premium / Subscription Tarafi

### Gerekli Hesaplar

- RevenueCat
- Google Play Console
- App Store Connect

### Yapilacaklar

1. RevenueCat projesi ac
2. Android ve iOS app kayitlarini RevenueCat'e ekle
3. Google Play Console'da subscription urun(ler)ini olustur
4. App Store Connect'te subscription urun(ler)ini olustur
5. Bu store urunlerini RevenueCat dashboard'a bagla
6. `premium` entitlement tanimla
7. `apps/mobile/app.json` icindeki RevenueCat API key alanlarini doldur
8. Entitlement id'yi `SmartScroll Pro`, offering id'yi `default` ile hizala
9. Mobil uygulamada `react-native-purchases` ile entitlement'i oku

### Kullaniciya Haber Verilecek An

- RevenueCat hesabi acilacaksa
- Google Play / App Store subscription urunleri olusturulacaksa
- Store product id'leri kesinlestirilecekse

## 2. Reklam Tarafi

### Gerekli Hesaplar

- Google AdMob
- Google Play Console

### Yapilacaklar

1. AdMob publisher hesabi ac
2. Uygulamayi AdMob'a ekle
3. Test ad unit'lerini olustur
4. Android icin Play Console'da uygulama `contains ads` olarak beyan edilsin
5. Uygulamaya `react-native-google-mobile-ads` bagla
6. Once test reklamlar, sonra production ad unit'leri ile dogrulama yap

### Notlar

- Ilk entegrasyonda gercek production reklam yerine test ad unit'leri kullanilmali.
- EEA / GDPR kapsamindaki consent akisi ayrica degerlendirilmelidir.
- Uygulamada reklam cadence'i sert degil, deger gosterip sonra hafif upsell yapan bir sekilde kalmalidir.

## 3. Implementasyon Sirasi

1. Paywall / monetization policy UI
2. RevenueCat entitlement hydration
3. Premium gate'lerin runtime'a baglanmasi
4. Reklam SDK entegrasyonu
5. Reklam cadence ve upsell davranisinin feed'e baglanmasi

## 4. Bu Asamada Kodda Hazir Olanlar

- Book access policy runtime var
- Auth prompting var
- AI chat ve chat history altyapisi var
- Guest / free / premium policy karar dosyasi var

Bu nedenle sonraki mantikli adim, once paywall giris noktalarini uygulama icinde tek tek sabitlemek; harici hesap baglama isi hemen oncesinde kullaniciya net checklist ile hatirlatilmaktir.
