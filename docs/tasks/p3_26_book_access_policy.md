# P3-26 - Book Access Policy Runtime

- [x] Supabase `books` tablosuna runtime access policy alani ekle (`access_tier`)
- [x] `Kendime Dusunceler` kitabini `free_anchor` olarak, diger katalogu `premium` olarak isaretle
- [x] Mobil `BookType` ve `books` helper katmanini yeni access modeliyle hizala
- [x] Library ekraninda free / auth+premium rozet ve aciklama davranisini uygula
- [x] Premium kart etiketlerini sadeleştir: rozet sadece `Premium` görünsün, auth yoksa tıklamada önce login aksın
- [x] Reader ekraninda auth ve premium gate ekranlarini runtime davranisa cevir
- [x] Remote Supabase migration'ini uygula (`npx supabase db push --linked --yes`)
