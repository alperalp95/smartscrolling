# P1-15d - Pipeline Logging ve Run Summary

## Amac

Pipeline kosularinda sadece "kaydedildi / atlandi" logu gormek yerine, neden bazli ozet alabilmek.

## Alt Gorevler

- [x] `insertFact` sonucunu standart status kodlari ile dondur
- [x] `run-all` icinde source bazli ve toplam run summary sayaclari ekle
- [x] `test.js` runner'ini yeni sonuc formatina uyarla
- [x] `run-all` icine `source_url` preflight skip logu ekle; mevcut kaynaklari Groq'a gondermeden once batch kontrolle atla
- [x] `report:facts` komutu ile kategori/source dagilimini ve `healthy floor` acigini raporla
- [ ] Ileride bu ozetleri dosyaya veya Supabase run log tablosuna yaz

## Notlar

- Ilk turda log sistemi console summary seviyesindedir.
- Status kodlari: `saved`, `duplicate_source_url`, `duplicate_title`, `insert_error`
- Ayrica `groq_failed` ve `verified_true` sayaclari da raporlanir.
- Son turda `run-all`, Wikipedia ve NASA APOD kaynaklarini islerken once mevcut `source_url`leri batch olarak kontrol edip token harcamadan skip edecek sekilde guclendirildi.
- `report:facts` komutu kategori esitligi kovalamaz; onun yerine her kategori icin `healthy floor` acigini gorunur kilarak quality-first balanced growth kararini destekler.
