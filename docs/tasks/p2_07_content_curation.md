# P2-07 - Icerik Kuratorluk Sureci

## Amaç

Facts akisinin sadece veri cekiyor olmasi yetmez; hangi kartin nasil secilecegi, hangi kaynagin dogrulanmis sayilacagi ve zayif icerigin nasil elenecegi operasyonel olarak net olmalidir.

## Alt Gorevler

- [x] Kuratorluk sureci icin operasyonel workflow dokumanini olustur
- [x] `content_strategy` icindeki kaynak/pipeline kararlarini bu workflow ile hizala
- [x] Feed'e girecek kartlar icin minimum kalite checklist'ini veri alanlarina bagla
- [x] Source whitelist ve duplicate fingerprint backlog islerini workflow referanslariyla bagla
- [x] MVP sonrasi editorial queue ihtiyacini backlog notu olarak ayir; MVP'de otomatik quality gate ile devam et

## Notlar

- Bu gorev ilk asamada dokumantasyon ve operasyon kural seti olarak ilerliyor.
- Teknik enforcement adimlari `P1-15b`, `P1-15c` ve `P1-19` ile bagli.
- MVP icin tam editor paneli veya manuel `draft -> review -> approved -> published` akisi zorunlu degil.
- MVP'de hedef, otomatik pipeline ciktisini minimum kalite kurallari ve source whitelist ile filtrelemek.
- Tam editorial queue ancak ekip buyudugunde veya manuel icerik girisi basladiginda gerekli olacak.
