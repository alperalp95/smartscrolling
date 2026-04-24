# P2-03g - Fact Visual Fallback

## Amac

`media_url` bos oldugunda feed kartlarinin siyah / olu gorunmesini engellemek ve her fact icin minimum bir gorsel kalite tabani saglamak.

## Alt Gorevler

- [x] Feed tarafinda runtime `visual_key` turetimi ekle
- [x] `media_url` bos oldugunda kategori / kaynak temelli branded fallback gorsel sistemi goster
- [x] Mevcut local feed arka plan asset'lerini fallback preset'lerinde tekrar kullan
- [x] Sonraki dilimde `visual_key` alanini pipeline ve DB seviyesine tasi
- [x] Sonraki dilimde mevcut `media_url` bos facts kayitlari icin kontrollu backfill stratejisi ekle
- [x] Dry-run sonucunu degerlendir ve apply gerekip gerekmedigine karar ver

## Notlar

- Ilk slice migration gerektirmeden sadece runtime katmanda cozuldu.
- `NASA`, `Stanford Encyclopedia`, `MedlinePlus` ve kategori bazli fact'ler icin ayri visual preset'ler tanimlandi.
- Bu sayede release oncesi siyah kart / bos gorsel hissi engellenirken, DB sema degisikligi ikinci dilime birakildi.
- Sonraki dilimde `facts.visual_key` migration'i hazirlandi; pipeline artik yeni kayitlarda `visual_key` uretir hale geldi ve mobil feed DB'den gelen `visual_key` degerini runtime fallback'in onune alir.
- Sonraki slice'ta `backfill-fact-media.js` script'i eklendi. Ilk turda sadece `Wikipedia` kaynakli ve `media_url` bos fact'leri hedefliyor; varsayilan davranis `dry-run`, gercek DB update'i ise yalnizca `--apply` ile yapiliyor.
- Dry-run sonucunda `Wikipedia` adayi kalmadigi, yalnizca `Stanford Encyclopedia of Philosophy` ve `MedlinePlus` kaynaklarinda birer `null media_url` kaydi oldugu goruldu. Runtime fallback + `visual_key` altyapisi release riski olmadigi icin ilk apply turu ertelendi.
