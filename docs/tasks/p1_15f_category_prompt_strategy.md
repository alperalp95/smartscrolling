# P1-15f - Category Prompt Strategy

## Amac

Facts kategorilerini fazla daraltmadan, her kategori icin daha uygun yazim davranisi elde etmek.

## Alt Gorevler

- [x] Kategori stratejisini dokumanlarda "genis kategori + tema/alt konu" modeli olarak netlestir
- [x] `Spor`u cekirdek feed kategorisi yerine secondary/backlog kategori olarak konumlandir
- [x] Pipeline Groq katmanina kategoriye ozel prompt yonlendirmeleri ekle
- [x] Tema havuzlarini kategori bazli source selection ile bagla (Wikipedia connector'unda hedef kategori rotasyonu ve tema havuzu eslesmesi eklendi; daha zengin source-level enforcement sonraki slice'ta derinlestirilecek)

## Notlar

- Cekirdek kategori seti simdilik degismiyor: Bilim, Tarih, Felsefe, Teknoloji, Saglik.
- `Spor`, `Biyografi` ve `Sanat Tarihi` gibi alanlar secondary genisleme olarak backlog'da tutulur.
- Ilk uygulama dilimi, kategoriye ozel Groq prompt davranisini eklemek ve bunu strateji belgeleriyle hizalamaktir.
- 2026-04-19 turunda Wikipedia `guessCategory` regex tabanindan skor tabanli keyword yaklasimina gecirildi; kategori sapmasi azalirken, bazi "bilim insani biyografisi" gibi sinirda ornekler hala urun degeri dusuk kalabilir.
- Ayni tarihte source relevance filtresi sertlestirildi ve `0 aday` durumunda kategori rotasyonunu gecici olarak gevseten kontrollu fallback eklendi; bu sayede hat tamamen tikanmadan devam ederken, dusuk degerli biyografi ornekleri icin halen ek filtre ihtiyaci oldugu goruldu.
- Son biyografi turunda kisi maddeleri tamamen yasaklanmadi; ancak "gorev / unvan / kariyer ozeti" agirlikli dusuk degerli biyografiler elenmeye baslandi. Buna ragmen arastirma odakli akademik profiller halen source havuzuna girebilir; bu alan sonraki filtre turunda daha da rafine edilecek.
- Son tam `run-all` sonucunda Wikipedia 30 denemede `0` aday uretti; bu, filtre kalitesinin dogru yone gittigini ama random source havuzunda asiri secici kaldigini gosterdi. Sonraki adim kaliteyi bozmadan aday cikisini toparlayacak daha pragmatik source stratejisi olmali.
- Sonraki slice'ta random Wikipedia summary akisi, kategori bazli curated / semi-curated seed topic havuzuyla desteklendi. Hat artik once secilmis konu listelerinden deniyor, aday yetmezse mevcut random fallback'e dusuyor.
- Ilk probe'da `Stoicism` basarili sekilde kaydedildi; buna karsin `Industrial Revolution` ciktisi consistency gate tarafinda `source_topic_drift` olarak elendi. Bu, yeni source stratejisinin calistigini ama Ingilizce source title ile Turkce output arasindaki topic-overlap heuristiginin bir tur daha rafine edilmesi gerekebilecegini gosteriyor.
- Sonraki dilimde source-aware prompt yapisi baslatildi; NASA APOD icin ayrik yazim yonlendirmesi eklendi ve consistency gate source title'a ek olarak source excerpt'i de dikkate alir hale geldi. Bu desen, ileride yeni curated kaynaklar eklendiginde ayni sekilde genisletilebilecek ortak bir source-aware kalite katmani olusturur.
- Sonraki slice'ta Wikipedia category seed havuzu genisletildi; her cekirdek kategoriye ek benzersiz konu basliklari eklenerek duplicate agirligi artisinda yeni aday cikisini destekleyen daha genis bir curated topic tabani olusturuldu.
- Seed sisteminin uzun vadede tek basina yeterli olmayacagi not edildi; release sonrasi `topic_registry` tabanli daha olgun bir konu orkestrasyonu icin ayri backlog gorevi (`P1-15h`) acildi.
