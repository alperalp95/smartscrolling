# SmartScrolling Content Curation Workflow

Bu belge, `facts` akisina girecek iceriklerin hangi kurallarla secilecegini ve yayina nasil alinacagini operasyonel olarak tanimlar.

## 1. Hedef

Feed'e gelen kartlar:

- kisa ve okunabilir olmali
- dogrulanabilir bir kaynaga dayanmalı
- tekrar etmemeli
- kategori ve etiket olarak anlamli sekilde siniflanmali
- urunun "ogretici ama hafif" tonunu korumali

Urun niyeti:

- fact karti kullanicinin "dur, bunun kaynagina da bakayim" dedigi bir merak giris noktasi olmali
- kart, konunun kendisi gibi davranmamali; daha derin okumaya gecis istegi uyandirmali
- karttan kaynaga gecis urunun dogal davranislarindan biri kabul edilmeli
- Groq ile zenginlestirilen metinler, konuyu uyduran degil kaynak metni daha okunur kilan ara katman olmali

## 2. Kart Yasam Dongusu

Her fact karti ideal olarak su akistan gecer:

1. `ingested`
Kaynak connector icerigi sisteme tasir.

2. `normalized`
Ham metin temizlenir ve ortak alanlara donusturulur.

3. `enriched`
AI veya kural tabanli katman baslik, kategori, tag ve okunma suresi onerir.

4. `review`
Kalite kontrolu bekleyen aday kart durumudur.

5. `approved`
Feed'e girmeye uygun bulunmustur.

6. `published`
Mobil uygulama tarafindan okunur durumdadir.

7. `rejected`
Kalite, telif, duplicate veya guven problemi nedeniyle yayinlanmaz.

Not:

- Bu lifecycle uzun vadeli ideal modeldir.
- MVP asamasinda bunu tam manuel editor queue olarak kurmak zorunlu degildir.
- MVP icin daha dogru hedef, otomatik pipeline ciktisini minimum kalite kurallari, whitelist ve duplicate kontrolu ile filtrelemektir.
- Manuel `review` asamasi ancak istisna kaynaklar veya dusuk guvenli kartlar icin devreye alinabilir.

## 3. Minimum Kalite Kurallari

Bir kart `approved` sayilabilmek icin su minimum kosullari saglamalidir:

- `title` bos olmamali
- `content` 1 kartta okunabilir uzunlukta olmali
- `source_url` zorunlu olmali
- `source_label` zorunlu olmali
- `category` tanimli bir feed kategorisine eslenebilmeli
- `tags` en az 1 mantikli etiket icermeli
- icerik ayni konu icin var olan baska bir kartin acik tekrarina donusmemeli

### 3.1 Field-level MVP checklist

`facts` tablosundaki alanlar icin minimum kabul kurali:

- `title`
  - bos olamaz
  - tek bakista ne okundugunu anlatmali
  - clickbait degil, merak uyandiran ama dogru olmali

- `content`
  - 1 kartta okunabilir uzunlukta olmali
  - konu hakkinda gercekten bilgi vermeli
  - kullaniciyi "kaynakta daha fazlasi var" hissine goturmeli
  - trivia veya anlamsiz genel bilgi seviyesinde kalmamali

- `source_url`
  - zorunlu
  - kullanici dogrudan daha derin okumaya gecemiyorsa kart eksik kabul edilmeli

- `source_label`
  - zorunlu
  - kullanicinin kaynagin ciddiyetini tek bakista anlamasini saglamali

- `category`
  - 5 ana feed kategorisinden birine eslenmeli
  - kategori ile icerik arasinda anlamli bir iliski olmali

- `tags`
  - en az 1 adet olmali
  - konunun arama, filtreleme ve baglamsal akislarina yardim etmeli

- `verified`
  - sadece whitelist kaynaklarda `true`
  - Groq ciktisi iyi diye tek basina `verified` verilemez

- `media_url`
  - zorunlu degil
  - varsa kartla iliskili, dikkat dagitmayan ve guvenli bir gorsel olmali

### 3.2 Groq yazim kurallari

Groq tarafinda uretilen hap bilgi:

- kaynakta olmayan bilgi eklememeli
- kaynakta acikca yazmayan yorum, varsayim veya analitik sonuc eklememeli
- konuyu baska bir seye kaydirmamali
- spekulatif, emin olmayan veya uydurma kesinlik tonu kullanmamali
- karttaki her iddia ham kaynakta desteklenebilir olmali
- kaynak metnin ana fikrini kisa, temiz ve merak uyandiran sekilde aktarmali
- kullanicinin kaynaga gitmesini anlamsizlastirmamali; tam tersine kaynaga gecisi tesvik etmeli

## 4. Verified Rozeti Kurali

`verified = true` yalnizca whitelist icindeki kaynaklara verilir.

Bu whitelist ilk asamada su kaynaklari kapsar:

- Wikipedia quality-secured makaleler
- NASA
- Stanford Encyclopedia of Philosophy
- ileride onaylanacak resmi akademik ve kurumsal kaynaklar

Whitelist disi kaynaklar:

- otomatik publish edilmez
- `review` durumunda bekler
- editor kararina ihtiyac duyar

### 4.1 Source whitelist enforcement sirasi

Whitelist backlog isinin (`P1-15b`) amaci:

- hangi domain veya kaynak sinifinin otomatik olarak `verified` alabilecegini sistem seviyesinde tanimlamak
- pipeline'in "kaynak iyi mi?" kararini her seferinde yeniden vermesini engellemek
- feed kalitesini kisiden bagimsiz ve tekrar edilebilir hale getirmek

MVP icin pratik uygulama:

1. whitelist'e giren kaynaklar otomatik publish adayi olabilir
2. whitelist disi ama yine de kullanilabilir kaynaklar `review` benzeri istisna akisina duser
3. anonim, clickbait veya referanssiz kaynaklar reject edilir

## 5. Duplicate Kontrolu

Bir kart duplicate sayilabilir eger:

- `source_url` birebir ayniysa
- ayni konu ve benzer baslikla daha once yayinlandiysa
- normalize metin fingerprint'i mevcut bir kartla yuksek benzerlik tasiyorsa

MVP asamasinda minimum duplicate kontrolu:

- `source_url`
- `title`
- normalize metin fingerprint backlog'u

### 5.1 Duplicate enforcement sirasi

Duplicate backlog isinin (`P1-15c`) amaci:

- feed'de ayni konunun hafif yeniden yazimlarla tekrar tekrar cikmasini engellemek
- kullanicinin "aynı karti tekrar goruyorum" hissini azaltmak
- Groq tarafinda uretilen benzer varyantlarin birbirini gecersiz kilmasini onlemek

MVP icin pratik uygulama:

1. birebir `source_url` duplicate'lerini ele
2. cok benzer `title` kaliplari icin uyari/isaret ekle
3. metin fingerprint benzerligi sonraki teknik adimda devreye girsin

### 5.2 Source-category consistency enforcement

Prompt guvenligi tek basina yeterli olmadigi icin, kaynak ile uretilen kart arasinda dusuk maliyetli bir tutarlilik katmani da olmalidir.

MVP icin pratik uygulama:

1. source connector'dan gelen `title` bilgisi fact uretim zincirine tasinir
2. uretilen `title + content` icinde source title ile hic kavramsal temas yoksa kart reject edilir
3. `categoryHint` ile uretilen category sert bicimde carpistiginda kart reject edilir
4. source tipi ayrisiksa, ayni tutarlilik kontrolu source excerpt ve source-aware prompt kurallariyla desteklenir

Bu katman ikinci bir LLM check gerektirmez; token maliyeti dusuk tutulurken konu kaymasi ve kategori sapmasi azaltilir.

## 6. Kategori Kurallari

Feed ana kategorileri:

- Bilim
- Tarih
- Felsefe
- Teknoloji
- Saglik

Kartlar mumkun oldugunca bu kategorilerden birine net oturmalidir.
Gri alandaki kartlarda:

- ana kategori secilir
- diger baglamlar `tags` tarafina itilir

### 6.1 Tema havuzu enforcement mantigi

MVP'de genis kategori tek basina yeterli degildir. Source secimi tarafinda her kategori,
belirli bir tema havuzuyla desteklenmelidir.

Ornek:

- `Tarih` -> imparatorluklar, devrimler, savaslar, reformlar
- `Bilim` -> astronomi, biyoloji, fizik, evrim, matematik
- `Felsefe` -> etik, bilgi, akil, adalet, stoacilik
- `Teknoloji` -> algoritmalar, iletisim, enerji, muhendislik, yazilim
- `Saglik` -> beyin, hastalik, halk sagligi, beslenme, tedavi

Operasyon kuralı:

- random connector bir karti sadece kategori tahminiyle kabul etmemeli
- kart ayni zamanda hedef kategorinin tema havuzuyla da eslesmeli
- bu katman, "teknik olarak gecerli ama urun icin zayif" maddeleri daha kaynaktayken elemek icin kullanilir

## 7. Editorial Review Checklist

Review sirasinda editor veya operator su sorulara bakar:

- Bu kart ilk 2 satirda merak uyandiriyor mu?
- Kaynak guvenilir mi?
- Metin bilgi degeri tasiyor mu, yoksa trivia seviyesinde mi kaliyor?
- Kart tekrarli veya fazla jenerik mi?
- Bu kart SmartScrolling tonuna uyuyor mu?

MVP yorumu:

- Bu checklist'in tamami bir editor paneli ile bugun uygulanmak zorunda degil.
- Bu sorularin buyuk bolumu pipeline quality gate kurallarina cevrilerek otomatik hale getirilebilir.
- Editor review, MVP sonrasi operasyon buyudugunde veya manuel icerik ekleme basladiginda anlamli hale gelir.

## 8. MVP Icin Operasyon Sirasi

Kisa vadede uygulanacak sira:

1. mevcut facts kayitlarini whitelist mantigina gore sinifla
2. duplicate adayi kartlari isaretle
3. zayif veya belirsiz kaynakli kartlari review mantigina ayir
4. yeni pipeline connector'larini bu kurallara gore kabul et

## 9. Bagli Roadmap Isleri

Bu workflow su maddelerin operasyonel temelidir:

- `P2-07` Icerik kuratorluk sureci
- `P1-15b` Source registry / whitelist
- `P1-15c` Duplicate fingerprint
- `P1-19` Icerik yasam dongusu

Bu roadmap baglanti mantigi:

- `P2-07` urun ve operasyon kuralini tanimlar
- `P1-15b` bu kurali kaynak guven katmanina cevirir
- `P1-15c` bu kurali tekrar ve icerik kalitesi katmanina cevirir
- `P1-19` ise ancak MVP sonrasi editorial operasyon gerekiyorsa devreye girer
