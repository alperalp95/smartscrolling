# P3-10h Reader Performance Checklist

Bu gorev, section-bazli reader yapisinin cok bolumlu kitaplarda release oncesi hangi basliklarla kontrol edilmesi gerektigini netlestirmek icin acildi.

## Kapsam

- Uzun / cok section'li kitaplar
- Scroll ve active section takibi
- Reading progress sync
- Highlight popup ve AI context
- Chat sheet davranisi

## Kontrol Listesi

### 1. Scroll ve Active Section
- [ ] Uzun kitapta dikey scroll akici mi, yarida kesilen gesture problemi var mi?
- [ ] `activeSectionIndex` scroll ile tutarli sekilde degisiyor mu?
- [ ] Bolum basligi ve ozetleri section gecislerinde dogru kaliyor mu?
- [ ] Cok hizli scroll sonrasinda aktif bolum bir onceki/sonraki bolume sapip takili kaliyor mu?

### 2. Reading Progress Sync
- [ ] Reader ilk acilista son okunan pozisyonu anlamli sekilde hydrate ediyor mu?
- [ ] Scroll sirasinda `currentPage` asiri ziplamadan guncelleniyor mu?
- [ ] 1 saniyelik debounce sync gereksiz tekrar istek atmadan calisiyor mu?
- [ ] Kitaptan cikip geri donunce ilerleme korunuyor mu?

### 3. Highlight ve Popup
- [ ] Highlight'lar yalnizca ilgili bolumde gorunuyor mu?
- [ ] Yanlis bolumde eski/global highlight kalintisi var mi?
- [ ] Ayni kelimeye tekrar dokununca cache/fallback davranisi tutarli mi?
- [ ] Popup acilis/kapanis animasyonu scroll ile cakismadan calisiyor mu?

### 4. AI Context ve Sohbet
- [ ] Definition icin giden context aktif bolum ve yakin komsu bolumlerle sinirli mi?
- [ ] Chat icin giden context tum kitap yerine aktif bolum scope'unda kaliyor mu?
- [ ] Hazir sorular tekrarlandiginda kullanici sessiz blok yerine aciklayici mesaj goruyor mu?
- [ ] Chat history scroll'u uzun mesaj setinde kullanilabilir kaliyor mu?

### 5. Yuksek Section Sayisinda UI Dayanikliligi
- [ ] 50+ section senaryosunda ilk render kabul edilebilir surede mi?
- [ ] Section offset kaydi (`registerSectionOffset`) belirgin UI takilmasi uretmiyor mu?
- [ ] Progress bar ve footer overlay uzun okumada layout sorununa yol aciyor mu?
- [ ] Premium lock / acik reader gecisleri state bozmadan calisiyor mu?

## Onerilen Test Sirasi

1. `The Problems of Philosophy` gibi cok section'li bir premium kitap ac
2. Uzun scroll, hizli scroll ve geri cikis/geri donus akisini dene
3. Birden fazla bolumde highlight popup ac
4. Hazir soru + serbest soru + chat history scroll senaryolarini dene
5. Uygulama loglarinda tekrarli sync veya AI hata paternleri var mi kontrol et

## Cikis Kriteri

- Scroll ve chat gesture sorunlari "bloklayici" seviyede olmamali
- Active section, highlight scope ve AI context mantigi gozle gorulur sekilde tutarli olmali
- Reading progress sync fazla gürültu veya veri sapmasi uretmemeli
