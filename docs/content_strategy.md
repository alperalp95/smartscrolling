# SmartScrolling Content Strategy

Bu belge MVP ve sonrasinda `facts` ve `books` akislarini nasil besleyecegimizi, hangi kaynaklari kullanacagimizi ve bunu nasil scalable bir operasyon yapisina donusturecegimizi tanimlar.

## 1. Guncel Durum

Bugun repoda aktif ya da hazir durumda olan icerik yapisi:

- `facts` icin Wikipedia ve NASA tabanli pipeline iskeleti var.
- `facts` verisi Supabase `facts` tablosuna yazilabiliyor.
- `books` icin Supabase `books` tablosunda seed kayitlari var.
- Mobil kutuphane, seeded `books.id` UUID degerleriyle hizalanmis demo katalog kullaniyor.
- Reddit artik aktif stratejinin parcasi degil.

Bu ne anlama geliyor:

- `facts` tarafi yarim-otomatik icerik besleme modeline uygun.
- `books` tarafi ise henuz tam operasyonel bir ingestion hattina sahip degil.

## 2. Facts Icin Kaynak Stratejisi

### Tier 1 - Birincil ve guvenilir kaynaklar

Bu grup MVP ve production icin ana kaynak omurgasi olmalidir:

- Wikipedia Featured / high quality articles
- NASA APOD ve benzeri resmi bilim kaynaklari
- ArXiv ve PubMed gibi acik akademik kaynaklar
- Stanford Encyclopedia of Philosophy benzeri editoryal kalitesi yuksek referans kaynaklar

Kurallar:

- `verified = true` rozetinin verilmesi yalnizca whitelist icindeki kaynaklar icin olmali
- her fact kaydinda `source_url`, `source_label`, `published_at` ve kategori/tag alani zorunlu olmali
- Groq sadece yeniden yazim/ozetleme icin kullanilmali, kaynak uydurma icin degil
- fact karti kullaniciyi "daha derin okumaya" goturen giris noktasi gibi davranmali; kartin kendisi nihai makale yerine gecmemeli

Whitelist ve duplicate kurallarinin operasyonel karsiligi `docs/content_curation_workflow.md`
icerisinde `4.1 Source whitelist enforcement sirasi` ve `5.1 Duplicate enforcement sirasi`
basliklari altinda netlestirilmistir.

### Kategori modeli: genis kategori + tema/alt konu

MVP icin facts kategorilerini asiri daraltmak dogru degildir. Kullanici urune genis bir
merak kapisindan girer; `Tarih` veya `Bilim` gibi genis kategoriler feed seviyesinde daha
anlasilir kalir. Ancak icerik secimi ve AI yazim kalitesi alt tarafta tema/alt konu
havuzlariyla yonetilmelidir.

Bu nedenle aktif cekirdek kategori seti su sekilde kalir:

- Bilim
- Tarih
- Felsefe
- Teknoloji
- Saglik

Bu genis kategorilerin altinda tema mantigi calisir:

- `Tarih` -> imparatorluklar, devrimler, savaslar, bilim tarihi, reformlar
- `Bilim` -> astronomi, biyoloji, fizik, matematik tarihi, evrim
- `Felsefe` -> etik, siyaset felsefesi, bilgi felsefesi, stoacilik
- `Teknoloji` -> hesaplama, iletisim, enerji, muhendislik kirilmalari
- `Saglik` -> insan biyolojisi, halk sagligi, beslenme, hastalik mekanizmalari

Bu modelin urun gerekcesi:

- feed kategorileri sade ve anlasilir kalir
- icerik cesitliligi kaybolmaz
- source secimi daha kontrollu hale gelir
- Groq promptu kategoriye gore ozellesebilir, ama kategori agaci gereksiz yere patlamaz

Bu stratejinin source selection karsiligi da vardir:

- connector katmani random icerik havuzundan kor secim yapmamalidir
- her genis kategori altinda belirli tema havuzlari bulunmalidir
- Wikipedia gibi rastgele kaynaklarda ancak bu tema havuzlariyla eslesen maddeler feed adayi olmalidir

Yani `Tarih` genis kategori olarak kalir; ama source katmaninda `imparatorluklar`, `devrimler`,
`savaslar`, `reformlar` gibi tema havuzlariyla daraltilir. Bu, kategoriyi feed seviyesinde sade
tutup source seviyesinde kaliteyi yuksek tutar.

Secondary / backlog kategoriler:

- Spor
- Biyografi
- Sanat Tarihi

Bu alanlar tamamen dislanmaz, ancak MVP cekirdek feed omurgasina simdilik alinmaz.
Ozellikle `Spor`, genel spor haberi veya skor mantigiyla degil; spor bilimi, olimpiyat
tarihi, taktik donusumler ve biyomekanik gibi ogretici eksende ele alinacak secondary
kategori olarak dusunulmelidir.

### Tier 2 - Yardimci ama editorial review isteyen kaynaklar

- acik lisansli bloglar
- universite makaleleri
- kurum bloglari

Kurallar:

- otomatik publish edilmemeli
- once kalite skoru ve editor onayi beklemeli

### Tier 3 - Kullanilmamasi gereken ya da varsayilan olarak kapali kaynaklar

- Reddit
- kaynak gostermeyen forumlar
- clickbait veya anonim icerik siteleri

Neden:

- kalite dalgalanmasi yuksek
- dogrulama ve telif riski artiyor
- editorial maliyet artiyor

## 3. Facts Icin Scalable Pipeline Modeli

Bugunku pipeline calisabilir bir baslangic ama scalable olmasi icin asagidaki asamalara bolunmeli:

### 3.1 Source ingestion

Her kaynak icin ayri connector:

- `wikipedia`
- `nasa`
- ileride `arxiv`
- ileride `pubmed`

Her connector ortak bir normalized payload donmeli:

- `external_id`
- `source_name`
- `source_url`
- `title`
- `raw_text`
- `published_at`
- `author`
- `language`
- `image_url`

### 3.2 Normalization

Kaynak farklarini silen ortak donusum katmani:

- metin temizleme
- dil tespiti
- kategori tahmini
- tag cikarma
- duplicate fingerprint olusturma

### 3.3 AI enrichment

Groq burada sunlari yapmali:

- hap bilgi formuna donusturme
- daha kisa baslik uretme
- kategori ve tag oneri
- okunma suresi tahmini
- kategoriye gore farkli anlatim yogunlugu kullanma

Groq burada sunlari yapmamali:

- kaynak uydurma
- gercekte olmayan tarih/istatistik ekleme

Kategoriye ozel prompt stratejisi MVP icin makul ve yapilabilir bir kalite artisi saglar:

- `Tarih` -> donem, neden-sonuc, aktorler, uzun vadeli etki
- `Bilim` -> mekanizma, gozlem, kesif, neden onemli
- `Felsefe` -> temel fikir, tartisma, sinir, bugunku anlam
- `Teknoloji` -> nasil calisir, neyi degistirdi, trade-off
- `Saglik` -> mekanizma, etki, dikkatli ve sansasyonsuz anlatim

Bu sayede tek bir genel prompt yerine, her kategori ayni veri modeline yazarken daha uygun
urun tonu yakalar.

### 3.4 Quality gate

Publish oncesi minimum kalite kontrolleri:

- source whitelist kontrolu
- duplicate kontrolu: `source_url` + fingerprint
- minimum metin kalite skoru
- yasakli kategori veya moderation kontrolu
- bos veya asiri benzer kartlari eleme
- kartin kullanicida "bunun kaynagina da bakayim" hissi uyandirip uyandirmadigini urun kriteri olarak degerlendirme

### 3.5 Editorial queue

MVP sonrasi ama scalable operasyon icin cok degerli:

- `draft`
- `review`
- `approved`
- `published`
- `rejected`

Bu lifecycle `facts` tablosunda ya da ayri bir `content_queue` tablosunda tutulabilir.

Bu akisin operasyonel karsiligi ve editor checklist'i ayri olarak
`docs/content_curation_workflow.md` dosyasinda tanimlanmistir. `P2-07`
kapsaminda feed'e girecek kartlarin review ve publish kararlari bu workflow'a
gore alinmalidir.

## 4. Books Icin Kaynak Stratejisi

### Urun Karari: Kutuphane genel okuma katalogu degil, `AI-assisted learning library` olmalidir

Senior business karari olarak kitap katalogunun merkezi romanlar degil, baglam aciklamasi ve soru-cevap degeri yuksek olan metinler olmalidir.

Neden:

- kullanici duz bir romani baska yerden de okuyabilir
- ama tarih, bilim, felsefe ve biyografi metinlerinde popup + AI chat gercek urun degeri uretir
- uygulamanin farki "metni acikla, baglami ver, kavrami anlasilir kil" oldugu icin `context-heavy nonfiction` kitaplar daha uygundur

Bu nedenle ana katalog onceligi:

- tarih
- bilim
- felsefe
- biyografi / dusunce tarihi

Romanlar:

- tamamen yasak degil
- ama ana katalog omurgasi olmamali
- secondary veya sonraki faz kitap kategorisi olarak ele alinmali

### Bugunku dogru model

- Public domain / acik lisansli kitaplar
- Project Gutenberg
- telif suresi dolmus Turkce eserler

### MVP icin kullanilabilir kaynaklar

- Project Gutenberg
- public domain Turkce klasikler
- acik lisansli EPUB / HTML kaynaklari

### MVP kitap erisim modeli

MVP icin en net ve anlasilir urun kuralı:

- tum kullanicilar icin 1 adet serbest okunabilir metin
- diger metinler icin auth zorunlulugu
- premium kitaplar veya premium section'lar icin auth + premium birlikte zorunlu

Bu model neden mantikli:

- kullaniciya urunun degerini gosteren frictionless bir giris verir
- auth ve premium duvarini ilk saniyede degil, deger gorulduktan sonra kurar
- premium mantigini kitap bazli anlatmayi kolaylastirir

Onerilen segmentasyon:

- `free_anchor_book`: herkes okuyabilir
- `premium_books`: auth + premium ile acilan daha derin katalog

### Aktif 10 kitaplik MVP ogrenme listesi

Bu karar sonrasi aktif katalogdaki ilk 10 eser:

1. Marcus Aurelius - `Kendime Dusunceler`
2. Bertrand Russell - `The Problems of Philosophy`
3. John Stuart Mill - `On Liberty`
4. Thomas Paine - `Common Sense`
5. Plato - `The Republic`
6. Niccolo Machiavelli - `The Prince`
7. Albert Einstein - `Relativity: The Special and General Theory`
8. Charles Darwin - `The Voyage of the Beagle`
9. H. G. Wells - `A Short History of the World`
10. W. E. B. Du Bois - `The Souls of Black Folk`

Bu setin amaci:

- tarih, bilim, felsefe ve sosyal dusunce ekseninde baglam degeri yuksek bir raf kurmak
- popup + AI chat deneyimini romanlardan daha anlamli hale getirmek
- `1 free anchor + premium learning shelf` kuralini net bir katalogla gostermek

### Kullanimi dikkat isteyen alan

Modern telifli kitaplar:

- tam metin olarak uygulamaya alinmamali
- sadece demo chapter, ozet veya metadata seviyesinde kullanilmali
- ticari surum icin lisans veya partnerlik gerekir

## 5. Books Icin Scalable Yapi

`books` tarafi bugun tam operational degil. Scalable olmak icin su katmanlar lazim:

### 5.1 Book metadata layer

`books` tablosunda su alanlar net standartta olmali:

- `id`
- `title`
- `author`
- `description`
- `category`
- `language`
- `cover_url`
- `total_pages`
- `epub_url`
- `is_premium`
- `license_type`
- `source_url`

### 5.2 Book ingestion

Bir kitap ekleme akisi su sekilde olmali:

1. metadata ekle
2. source/licensing dogrula
3. metni parse et
4. bolumlere/paragraflara ayir
5. highlight/keyword cikart
6. reader icin hazir hale getir

### 5.3 Reader content model

Bugun reader statik demo text kullaniyor. Uzun vadede:

- kitap icerigi ayri tabloda veya storage + indexed chunk yapisinda tutulmali
- `book_sections` veya `book_chunks` gibi bir model dusunulmeli
- AI popup ve AI chat bu chunk'lari context olarak kullanmali

## 6. Eksikler

Bugun en net eksikler:

- `books` verisi hala dogrudan Supabase fetch ile gelmiyor
- facts pipeline icin editorial queue yok
- duplicate fingerprint modeli yok
- source whitelist politikasi dokumanda net ama veride enforced degil
- `chat_sessions` kaliciligi yok
- modern telifli kitaplar icin urun/operasyon siniri net sistemlestirilmedi
- kutuphane stratejisinde ana katalog ile secondary katalog ayrimi sistem seviyesinde uygulanmadi
- premium entitlement kontrolu henuz RevenueCat veya benzeri odeme altyapisi ile gercek kullanici hakki haline getirilmedi
- 10 kitaplik shortlist'in tamaminda full `book_sections` icerigi henuz hazir degil; mevcut tam okunabilir anchor halen `Kendime Dusunceler`

## 7. Onerilen Scalable Yapi

En saglikli yol su:

1. `facts` ve `books` icin source registry tanimla
2. ingestion connector'larini normalized output verecek sekilde standartlastir
3. AI enrichment'i source ingestion'dan ayir
4. kalite kapisi ve editorial queue ekle
5. publish edilen icerigi mobil uygulamanin dogrudan Supabase'ten okuyacagi modele tasi
6. `books` icin demo katalogu kaldirip tam DB tabanli kataloga gec

## 8. Uygulama Sirasi

Kisa vadede:

1. facts pipeline'a duplicate fingerprint ve source whitelist ekle
2. kutuphaneyi `context-heavy nonfiction` odagina gore yeniden sec
3. 1 serbest kitap + auth/premium kitap kuralini runtime seviyesinde uygula
4. `books` icin access policy alanlarini netlestir
5. editor onayi icin basit `status` alanini ekle

Orta vadede:

1. `arxiv` ve `pubmed` connector'lari
2. `book_chunks` modeli
3. CMS/editor queue
4. otomatik cron ingestion

Uzun vadede:

1. personalization
2. recommendation ranking
3. content performance scoring
