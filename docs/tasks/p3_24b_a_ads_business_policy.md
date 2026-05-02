# P3-24b-a - Ads Business Policy

## Amac

MVP reklam modelini guest, free ve premium kullanici segmentlerine gore netlestirmek.

## Kapsam

- Reklam gosterim kurali.
- Reklam formati ve cadence karari.
- Premium deger onerisi.
- MVP disi birakilan reklam formatlari.

## Yapilacaklar

- [x] Guest kullanici reklam politikasini belirle.
- [x] Free kullanici reklam politikasini belirle.
- [x] Premium kullanici reklam politikasini belirle.
- [x] Banner/static ve inline video cadence kararini yaz.
- [x] Fullscreen/interstitial reklamlarin MVP disi oldugunu netlestir.
- [x] Reader, AI chat, auth ve satin alma akislarinda reklam gosterilmeyecegini kayda gec.

## Kabul Edilen Policy

| Segment | Banner/static ad | Inline video ad | Cadence | Not |
| --- | --- | --- | --- | --- |
| Guest | Evet | Evet | Ilk reklam 5. karttan sonra, sonra her 6 kartta 1 | Guest daha agresif monetize edilir. |
| Free | Evet | Evet, daha seyrek | Ilk reklam 9. karttan sonra, sonra her 10 kartta 1 | Free retention daha degerli oldugu icin daha yumusak. |
| Premium | Hayir | Hayir | Reklam yok | Premium = reklamsiz deneyim. |

## Reklam Siralama Kurali

### Guest

- 1. reklam: static/banner/native
- 2. reklam: inline video destekli native
- 3. reklam: static/banner/native
- 4. reklam: inline video destekli native
- Dongu bu sekilde devam eder.

### Free

- 1. reklam: static/banner/native
- 2. reklam: static/banner/native
- 3. reklam: inline video destekli native
- Dongu bu sekilde devam eder.

## Nerede Reklam Gosterilmeyecek

- Reader okuma ekrani icinde.
- AI chat sheet icinde.
- Auth/login akisi icinde.
- Premium/paywall/satin alma akisi icinde.
- Popup, modal veya kritik aksiyon ortasinda.

## MVP Disi

- Swipe/click basina fullscreen interstitial.
- App acilisinda zorunlu interstitial.
- AI cevabi almadan once reklam.
- Odullu reklam ile AI hakki verme.

## Business Notlari

- Guest kullanici urunu hesapsiz denerken reklam geliri uretir.
- Free kullanici hesap actigi icin daha yuksek retention degerine sahiptir; reklam baskisi guest'e gore daha dusuk tutulur.
- Premium'un ana degeri reklamsiz deneyim, premium kitaplik ve daha yuksek AI limiti olarak konumlanir.
- Inline video varsa feed icinde ad card olarak gorunur; kullanicinin onune ani fullscreen video acilmaz.

## Kaynaklar

- AdMob ad formats: https://support.google.com/admob/answer/6128738
- Disallowed interstitial implementations: https://support.google.com/admob/answer/6201362
