# P2-08c Saved Facts Surface

Bu gorev, kullanicinin kaydettigi fact'leri feed icindeki ikon durumundan cikarip `Kutuphane` ekraninda gorunur bir yuzeye tasir.

## Alt Gorevler

- [x] 1. `bookmarks` tablosundaki `fact_id` verisini `facts` icerigi ile birlestiren lightweight fetch helper ekle
- [x] 2. `Kutuphane` ekranina `Kaydettiklerim` bolumu ekle
- [x] 3. Giris yapmis kullanicida saved fact kartlarini goster
- [x] 4. Misafir kullanicida "giris yapinca burada birikir" mesajini goster
- [x] 5. Kaydedilen fact'e dokununca uygulama ici detail / yeniden okuma akisina bagla
- [x] 6. Saved state degistikce `Kutuphane` ekranindaki listeyi tazele
- [x] 7. `Tumu` ile acilan saved-only liste ekranini ekle
- [x] 8. Saved akisi icinde `Kayittan Cikar` aksiyonu ekle ve feed save state'i ile tutarli tut

## Notlar

- Ilk iki dilimde kaydedilen fact kartlari library icinde gorunur hale geldi ve kartlara dokununca lightweight `fact/[id]` detail route'u aciliyor.
- Feed ile birebir ayni swipe deneyimi degil; bu route "yeniden okuma / source'a devam et" amacli daha sakin bir detail ekranidir.
- Saved facts listesi artik `savedIds` degisimine bagli olarak focus anlarinda da tazelenir; boylece feed'de yeni save yapildiginda library stale kalmaz.
- `saved-facts` route'u, kaydedilen tum fact'leri tek yerde gosteren daha tam bir tekrar okuma yuzeyi sunar.
- Saved-only liste ve fact detail ekraninda `Kayittan Cikar` aksiyonu vardir; mevcut `toggleSave` kullanildigi icin feed ikon durumu ile ayni state paylasilir.
