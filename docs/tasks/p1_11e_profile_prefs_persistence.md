# P1-11e Profile Prefs Persistence

## Amac

- Progressive profiling'in ilk kalici katmanini kurmak.
- Ilgi alanlari, gunluk hedef ve bildirim tercihi gibi temel tercihleri kullanici isterse profile ekranindan yonetsin.
- Bu slice'ta odak:
  - tercihlerin veri modelini netlestirmek
  - Supabase'e kalici yazim omurgasini kurmak

## Kapsam

- `preferred_categories` benzeri ilgi alani verisini kalici yaz
- gunluk hedef tercihi icin alanlari belirle
- bildirim preference alanlarini belirle
- profile ekraninda mevcut onboarding/prefs yuzeyleri ile bu veri katmanini bagla

## Bu Slice'ta Yapilacaklar

- [ ] `public.users` veya uygun tercih alaninin mevcut durumunu incele
- [ ] Gerekirse minimal migration ile tercih alanlarini ekle
- [ ] Ilgi alani secimini Supabase'e yaz
- [ ] Gunluk hedef ve bildirim tercihi icin ayni preference omurgasini hazirla
- [ ] Uygulama acilisinda mevcut tercihleri hydrate et
- [ ] Local onboarding state ile remote veri arasinda net kaynak karari ver

## Ilk Uygulama Sonucu

- `public.users.interests` alani zaten mevcut oldugu icin bu ilk slice'ta migration gerekmedi.
- Interest picker secimi profile ekranindan `users.interests` alanina yaziliyor.
- Auth init sirasinda mevcut kullanicinin ilgi alanlari hydrate edilip onboarding state'e alinmaya basladi.
- Daily goal ve bildirim preference alanlari ayni veri omurgasina sonraki slice'ta eklenecek.

## Not

- Bu is push scheduling veya gercek bildirim gonderimi degil.
- Once tercihlerin kalici veri modeli kurulacak.
- Bu gorev `P1-11e` altindaki diger kucuk dilimlerin temel veri katmanidir.
