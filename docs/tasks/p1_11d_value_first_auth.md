# P1-11d Value-First Auth

- [x] Value-first auth kararini roadmap ve architecture dokumanlarina isle
- [x] Guest mode mesajlasmasinin ilk UI adimini profile ekraninda uygula
- [x] Feed ve kutuphane icinde misafir kullaniciyi yonlendiren hafif mesajlasma katmanini tasarla
- [x] Progressive profiling sorularini ve tetik noktalarini belirle

## Progressive Profiling Notes

- Tetik 1: Basarili ilk auth sonrasi, sadece ilgi alani secimi sorulur.
- Tetik 2: Kullanici ilk bookmark veya ilk kitap ilerlemesi olusturdugunda gunluk hedef sorulur.
- Tetik 3: Kullanici ilk 2 farkli gunde geri dondugunde bildirim saati tercihi istenir.
- Soru seti en fazla tek ekranda tek karar olacak sekilde parcali tutulur.
- Sorular atlanabilir olmali; retention akisini bloke eden zorunlu onboarding kullanilmaz.
