# P2-03h - Bad Media Cleanup + Visual Key Temalandirma

## Amac

Feed'te cihazda kirilan, urun degeri dusuk veya ayni branded fallback'e gereksizce dusuren medya tiplerini kontrollu sekilde elemek; bunun yerine `visual_key` uzerinden daha cesitli tema preset'leri kullanmak.

## Kararlar

- [x] Yeni kolon acilmiyor; mevcut `facts.visual_key` alani merkez aliniyor
- [x] Kotu medya URL'leri fact kaydini silmeden `media_url = null` akisina alinacak
- [x] `visual_key` sadece kategori degil, fact temasina gore daha cesitli uretiliyor
- [x] Ilk cleanup turu yalnizca dusuk guvenli tipleri hedefliyor:
  - `wikipedia/en` non-free asset URL'leri
  - `svg` / `svg.png` tabanli vector dosyalari
  - logo / flag / seal / crest / cover / poster / map benzeri diagrammatic veya brand asset'ler

## Alt Gorevler

- [x] Pipeline `deriveFactVisualKey` mantigini tema bazli buyut
- [x] Mobil fallback preset'lerini yeni `visual_key` setiyle hizala
- [x] `cleanup-fact-media.js` dry-run/apply runner'ini ekle
- [x] Remote DB icin migration ile mevcut kayitlarin `visual_key` backfill + bad media null cleanup SQL'ini hazirla
- [x] Ilk dry-run sonucuna bakip apply penceresini ayarla

## Notlar

- Bu slice tum problemli Wikipedia JPG'lerini zorla null'lamaz; yalnizca ilk guvenli "bad media" tiplerini temizler.
- Daha agresif medya normalizasyonu gerekiyorsa sonraki dilimde pipeline kaynak secimi veya image ingest/proxy stratejisi degerlendirilecek.
- Uygulama tarafinda ayni heuristik aninda uygulanir; migration/apply beklenmeden feed daha temiz preset'lere dusebilir.
- Ilk dry-run sonucu `54` aday verdi:
  - `diagrammatic_or_brand_asset: 28`
  - `wikipedia_non_free_asset: 26`
- Apply turunda bu `54` kaydin `media_url` alani `null`landi ve `visual_key` degerleri yeni tema kurallariyla guncellendi.
- Release oncesi tekrar bakilacak:
  - `commons` tabanli JPG/PNG/WEBP gorsellerin Android dev build'de secici olarak fail etme orani tekrar olculecek
  - Bu ikinci tur, ancak gercek release adayina yaklasildiginda yapilacak; simdilik ek katman eklenmeyecek
