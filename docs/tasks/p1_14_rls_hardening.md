# P1-14 RLS Hardening

Bu gorev auth ile korunan kullanici tablolarinda RLS davranisini acik, test edilebilir ve sessiz hatalara daha dayanikli hale getirmek icin kucuk adimlara bolundu.

- [x] Mevcut policy ve client akislarini analiz et.
- [x] `bookmarks`, `reading_progress`, `chat_sessions`, `user_activity` icin acik `SELECT/INSERT/UPDATE/DELETE` policy seti hazirla.
- [x] Supabase remote projeye migration push et.
- [ ] Authenticated smoke test senaryolarini not et ve dogrula.
- [ ] Yol haritasi, analiz dosyalari ve changelog kayitlarini guncelle.

## Smoke Test Senaryolari

1. Profile ekranindan email/sifre ile giris yap.
2. Feed ekraninda bir fact'i kaydet, uygulamayi yenile veya ekrandan cikip geri don, kayitli durumun korundugunu dogrula.
3. Library'den seeded bir kitabi ac, bir miktar scroll yap, cikis yapmadan geri don ve ayni kitaba tekrar gir; ilerlemenin geri yüklendigini dogrula.
4. Reader icinde bir highlight uzerinden chat ac, bir soru gonder, reader'dan cik ve tekrar ayni kitabi ac; chat gecmisinin geri geldiyini dogrula.
5. Cikis yap, tekrar feed/reader ac ve kullaniciya ait bookmark-progress-chat verilerinin hydrate edilmedigini dogrula.
