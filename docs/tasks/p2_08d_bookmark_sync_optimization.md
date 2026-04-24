# P2-08d Bookmark Sync Optimization

Bu gorev, bookmark state'ini feed veri sorgusundan ayirip sadece gerekli anlarda senkronize ederek gereksiz network yukunu azaltir.

## Alt Gorevler

- [x] 1. `syncSavedFacts()` cagrisini her `fetchFacts` sonundan cikar
- [x] 2. Auth/session degisiminde hydrate akisini koru
- [x] 3. Save/unsave mutation sonrasi tam re-sync'i kaldir; optimistic local patch + hata durumunda rollback ile devam et
- [ ] 4. Gerekirse sonraki dilimde arka plan reconcile / periodic verification ekle

## Notlar

- Ilk dilim sadece en dusuk riskli kisma dokunur: feed her yenilendiginde bookmark tekrar cekilmez.
- Ikinci dilimde mutation sonrasi tam `syncSavedFacts()` kaldirildi; save/unsave akisi optimistic local state ve hata rollback'i ile calisir.
- Bookmark hydration su anda root auth listener'inda korunur.
