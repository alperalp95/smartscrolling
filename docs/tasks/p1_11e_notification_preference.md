# P1-11e Notification Preference

## Amac

- Kullanici isterse profile ekranindan bildirim tercihlerini acikca yonetsin.
- Bildirimler varsayilan olarak zorla acik gelmeyecek.
- Kullaniciya kontrol verilecek.
- Mevcut profildeki `Bildirimler` satiri gercek preference giris noktasi olacak.

## Kapsam

- Profile icinde bildirim tercihi UI'i
- Acik / kapali tercih
- Sonraki slice icin saat secimine uygun veri modeli

## Yapilacaklar

- [ ] `notifications_enabled` benzeri preference alanini netlestir
- [ ] Profile'daki mevcut `Bildirimler` satirini gercek preference yuzeyiyle bagla
- [ ] Kullanici tercihini Supabase'e yaz
- [ ] Mevcut tercihi hydrate et
- [ ] Varsayilan davranisi "kapali, kullanici isterse acsin" olarak netlestir

## Ilk Uygulama Sonucu

- Veri modeli `notifications_enabled` olarak secildi.
- Profile ekranindaki mevcut `Bildirimler` satiri gercek preference aksiyonuna baglandi.
- Kullanici bu satira dokunarak bildirim tercihini acip kapatabiliyor.
- Tercih Supabase'e yaziliyor ve auth init sirasinda yeniden hydrate ediliyor.
- Bu slice'ta OS permission veya reminder scheduling yok.

## Sonraki Slice'a Birakilanlar

- Bildirim saati secimi
- Expo Push Notification izin isteme akisi
- Gercek reminder scheduling

## Not

- Bu slice'ta sadece "kullanici ne istiyor?" bilgisini topluyoruz.
- Gercek push entegrasyonu daha sonra gelecek.
- Sessizce izin isteme veya otomatik reminder acma bu slice'in parcasi degil.
