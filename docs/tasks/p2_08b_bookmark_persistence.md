# P2-08b Bookmark Persistence

Bu gorev, feed ekranindaki `Kaydet` davranisini local UI state'ten Supabase tabanli kalici yapiya tasimak icin parcali olarak ilerler.

## Alt Gorevler

- [x] 1. Mevcut save akisini ve `bookmarks` semasini analiz et
- [x] 2. Auth varsa kullanicinin kayitli fact ID'lerini Supabase'den hydrate et
- [x] 3. `toggleSave` davranisini optimistic UI + Supabase insert/delete akisina bagla
- [x] 4. Hata/fallback davranisini netlestir ve dogrula

## Notlar

- Mevcut repo'da auth UI akisi tamamlanmis degil.
- Bu nedenle bookmark persistence, giris yapmis session varsa remote calisacak; aksi durumda kontrollu local fallback gerekecek.
- Remote yazimdan sonra `savedIds` state'i Supabase kaydi ile tekrar senkronize edilir.
