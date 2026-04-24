# P3-23 - RevenueCat Entitlement ve Subscription Altyapisi

## Amac

Premium kullanici yetkilerini uygulama runtime'ina baglamak; library, AI custom soru ve chat history gibi premium davranislari tek entitlement cizgisi uzerinden yonetmek.

## Alt Gorevler

- [ ] RevenueCat proje / app tanimlarini ac
- [ ] App Store Connect ve Google Play urunlerini RevenueCat dashboard'a bagla
- [ ] `premium` entitlement'ini tanimla
- [x] Mobil uygulamaya `react-native-purchases` SDK'sini ve Expo development build gereksinimini ekle
- [ ] Auth kullanicisi ile RevenueCat `appUserID` stratejisini hizala
- [x] Kullanici subscription durumunu uygulama store'una hydrate edecek entitlement adapter'ini ekle
- [ ] `resolveBookAccess` akisini gercek entitlement ile bagla
- [ ] AI custom soru ve chat history gate'lerini entitlement'a bagla
- [x] RevenueCat Paywall helper'ini ekle (`presentPaywallIfNeeded`)
- [x] Customer Center helper'ini ekle
- [ ] Test sandbox / internal testing ile premium / non-premium davranisini dogrula

## Kullaniciya Gereken Operasyonlar

- RevenueCat hesabi acilacak
- Google Play Console'da subscription urunleri tanimlanacak
- App Store Connect'te subscription urunleri tanimlanacak
- Bu store urunleri RevenueCat dashboard'a baglanacak

## Notlar

- Ilk implementasyonda tek entitlement (`premium`) yeterli.
- Trial, intro offer, grace period gibi katmanlar sonraki dilimde eklenebilir.
- RevenueCat entegrasyonu, paywall UI tamamlanmadan once temel entitlement hydration seviyesinde baslatilabilir; ancak satin alma akislarinin tamamlanmasi P3-24 ile birlikte deger kazanir.
- Bu ilk slice'ta `hydratePremiumEntitlement()` adli placeholder adapter eklendi ve root auth init zincirine baglandi. RevenueCat geldiginde UI/store katmanlari dagilmadan sadece bu adapter'in ici gercek SDK okumasi ile degisecek.
- Sonraki slice'ta bu adapter gercek `react-native-purchases` wrapper'ina baglandi; `app.json` icine API key ve entitlement/offering alanlari, `expo-dev-client` plugin'i ve `react-native-purchases-ui` temelli Paywall / Customer Center helper'lari eklendi. Gercek test icin RevenueCat dashboard + development build hala gereklidir.
