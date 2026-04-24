UPDATE public.books
SET
  source_format = 'gutenberg_text',
  source_storage_bucket = 'book-files',
  source_storage_path = 'public-domain/meditations-full.txt',
  total_sections = 6
WHERE id = '11111111-1111-1111-1111-111111111111';

UPDATE public.books
SET
  title = 'The Problems of Philosophy',
  author = 'Bertrand Russell',
  description = 'Bilginin sinirlari, gorunus-gerceklik ayrimi ve felsefenin degeri uzerine kurucu bir giris metni.',
  category = 'Philosophy',
  cover_url = NULL,
  source_format = 'gutenberg_text',
  source_storage_bucket = 'book-files',
  source_storage_path = 'public-domain/problems-of-philosophy.txt',
  total_sections = 6,
  access_tier = 'premium'
WHERE id = '22222222-2222-2222-2222-222222222222';

DELETE FROM public.book_sections
WHERE book_id IN (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222'
);

INSERT INTO public.book_sections (
  book_id,
  section_order,
  title,
  summary,
  plain_text,
  word_count,
  estimated_pages
)
VALUES
  (
    '11111111-1111-1111-1111-111111111111',
    1,
    'Sabah Alistirmasi',
    'Gunun daha en basinda zor insanlara ve duygusal surtusmelere zihinsel hazirlik.',
    'Sabah olunca kendine sunu soyle: bugun mudahaleci, nankor, kibirli ve hilekar insanlarla karsilasacagim. Onlar yanlisi isteyerek secmiyor; iyiyi ve kotuyu ayirt etmekte zorlaniyorlar. Bu yuzden onlarin tavri beni erdem yolumdan cikarmamali. Benim isim, disaridaki kisileri duzeltmekten once kendi yargimi sakin ve adil tutmaktir.',
    54,
    2
  ),
  (
    '11111111-1111-1111-1111-111111111111',
    2,
    'Yarginin Gucu',
    'Olayin kendisi ile olay hakkindaki yargimizin birbirinden ayrildigi Stoaci cekirdek fikir.',
    'Bizi sarsan sey, olaylarin kendisi degil; onlar hakkinda verdigimiz yargilardir. Disaridaki sozler, bakislar ve kayiplar ancak zihnin onlara verdigi etiket kadar agirlik kazanir. Bu nedenle insan, once kendi icindeki acele hukumleri yavaslatmali; ofkenin veya korkunun degil, acik secik goren bir zihnin rehberliginde davranmalidir.',
    52,
    2
  ),
  (
    '11111111-1111-1111-1111-111111111111',
    3,
    'Doga ile Uyum',
    'Insanin dogadaki yerine bakarak benmerkezcilikten cikmasi ve daha buyuk duzene uyumlanmasi.',
    'Insan kendini tek basina bir ada gibi gormemelidir. Hepimiz ortak bir doganin parcasi, daha buyuk bir butunun uyeleriyiz. Bu yuzden her eylem, sadece o anki hisse degil ortak iyiye gore tartilmalidir. Doga ile uyumlu yasamak, ne pasif olmak ne de kacmak demektir; tam tersine gorevini berrak bir zihinle yerine getirmek demektir.',
    55,
    2
  ),
  (
    '11111111-1111-1111-1111-111111111111',
    4,
    'Gorev ve Sadelik',
    'Kendi rolunu fazlaliktan arindirarak yerine getirme ve gereksiz gosteriye kapilmama cagrisi.',
    'Onune gelen isi dogru yap. Baskalarinin seni nasil gordugune degil, yaptigin seyin duzgun olup olmadigina bak. Sadelik burada yoksunluk degil berrakliktir: neyi kontrol edip neyi kontrol edemedigini bilmek, gereksiz sozden ve bos gururdan uzak durmak. Ruh, gorevi kadar buyuk kalmali; rolu kadar gosterisli olmaya calismamalidir.',
    50,
    2
  ),
  (
    '11111111-1111-1111-1111-111111111111',
    5,
    'Fanilik Bilinci',
    'Hayatin kisaliginin korku degil olculu yasam ve oncelik berrakligi uretmesi.',
    'Her sey akip gidiyor: insanlar, unvanlar, ovguler ve kaygilar. Fanilik dusuncesi karamsarlik icin degil, oncelikleri berraklastirmak icin vardir. Bir gun yok olacak seyler ugruna zihnini dagitmak yerine, bugunun hakkini vermek gerekir. Anin kiymeti, onun sonsuz olmasindan degil sinirli olmasindan gelir.',
    48,
    2
  ),
  (
    '11111111-1111-1111-1111-111111111111',
    6,
    'Icin Kalesi',
    'Insanin en guvenli siginaginin kendi ic duzeni oldugu fikri.',
    'Insan zaman zaman kendi icine donmeli ve orada bir kale bulmalidir. Bu kacis degil, kendini yeniden duzene sokma alistirmasidir. Baskalari gergin, dunya hizli, olaylar da daginik olabilir; fakat zihnin kendi merkezi her zaman yeniden kurulabilir. Icin kalesi, kisinin dis kosullardan bagimsiz olarak yeniden denge bulabildigi yerdir.',
    51,
    2
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    1,
    'Appearance and Reality',
    'Gorunus ile gerceklik arasindaki ayrimi acan felsefi baslangic problemi.',
    'Gundelik hayatta bir masaya baktigimizda onun tek ve sabit bir nesne oldugunu varsayariz. Oysa farkli acilardan, farkli isikta ve farkli dokunuslarda karsilastigimiz sey degisir. Russell bu noktadan hareketle gorunus ile gerceklik arasindaki ayrimi acmak ister. Felsefi arastirma, tam da en tanidik nesnenin bile sandigimiz kadar basit olmadigini fark etmekle baslar.',
    59,
    2
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    2,
    'Sense-data ve Nesne',
    'Dogrudan deneyimlediklerimiz ile onlarin gerisinde oldugunu varsaydigimiz nesne arasindaki fark.',
    'Gordugumuz renk, hissettigimiz sertlik veya duydugumuz ses, nesnenin kendisi degil bize gorunen yanlardir. Russell bunlara sense-data der. Elimizde ilk basta bulunan sey, nesnenin kendisi degil bu deneyim parcaciklaridir. O halde soru sunu olur: sense-data''nin gerisinde bagimsiz bir nesne oldugunu nasil biliyoruz ve ne kadarini bilebiliriz?',
    56,
    2
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    3,
    'Bilme Bicimleri',
    'Tanisiklik yoluyla bilme ile betimleme yoluyla bilme arasindaki temel ayrim.',
    'Her bilgi ayni sekilde kurulmaz. Bazi seylere dogrudan tanisiklikla sahibizdir: bir renk lekesini gormek ya da bir aciyi hissetmek gibi. Bazi seylere ise betimleme yoluyla ulasiriz; bir sehri hic gormeden onun hakkinda konusabiliriz. Russell icin bu ayrim, dusuncenin guvenilirlik derecelerini anlamak acisindan merkezidir.',
    53,
    2
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    4,
    'Induction Sorunu',
    'Gecmiste hep boyle oldu diye gelecekte de boyle olacak varsayiminin temelsizligi.',
    'Bilimsel ve gundelik akil yurutmelerimizin buyuk kismi induction uzerine kurulur. Gunes her gun dogdu diye yarin da dogacagini bekleriz. Fakat Russell, gecmis duzenliliklerin gelecegi mantiksal olarak garanti etmedigini hatirlatir. Bu yuzden aliskanlikla makul gorunen bir beklenti, felsefi acidan halen savunulmasi gereken bir varsayimdir.',
    54,
    2
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    5,
    'Universals ve Apriori Bilgi',
    'Tek tek nesnelerin otesinde iliski, benzerlik ve yapilara dair bilgimizin temeli.',
    'Iki rengin benzer oldugunu, bir cizginin digerinden once geldigini ya da bir iliskinin gecerli oldugunu fark ettigimizde yalnizca tekil nesnelerle ilgilenmeyiz. Russell bu duzeyde universals kavramini devreye sokar. Matematik ve mantik gibi alanlardaki kesinlik, tek tek deneyimlerin otesindeki bu yapisal iliskileri kavrayabilmemizle ilgilidir.',
    53,
    2
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    6,
    'The Value of Philosophy',
    'Felsefenin kesin cevaplar vermese de dusunce ufkunu genisletme degeri.',
    'Felsefenin degeri, her soruya son cevap vermesinde degil zihin ufkunu genisletmesindedir. Insani kendi aliskanliklarinin dar cemberinden cikarir, kesin sandigi yargilari yumusatir ve olasiliklara acik hale getirir. Russell''a gore felsefe, belirsizligi azaltmadan once kisiyi daha buyuk bir entelektuel cesarete davet eder.',
    50,
    2
  );

DELETE FROM public.book_highlights
WHERE book_id IN (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222'
);

INSERT INTO public.book_highlights (
  book_id,
  section_order,
  display_order,
  word,
  type,
  context,
  ai_definition,
  explanation
)
VALUES
  (
    '11111111-1111-1111-1111-111111111111',
    1,
    1,
    'mudahaleci',
    'keyword',
    'Zor insanlarla karsilasinca duygusal surprizi azaltmak icin once ismi konan tutum.',
    'Stoaci pratikte kelime, sorunun kiside degil davranis kalibinda oldugunu gosterir; boylece tepki vermeden once mesafe kurulur.',
    'Marcus Aurelius zor kisileri ahlaki panik konusu yapmak yerine onceden adlandirarak psikolojik etkilerini kucultur.'
  ),
  (
    '11111111-1111-1111-1111-111111111111',
    1,
    2,
    'erdem',
    'keyword',
    'Dis kosullar ne olursa olsun korunmasi gereken ic olcu.',
    'Stoacilikte erdem, insanin gercek iyi olarak kendi karakterini ve yargisini duzgun tutmasidir.',
    'Bu bolumde erdem, baskalarinin davranisini kontrol etmekten daha yuksek bir hedef olarak konumlanir.'
  ),
  (
    '11111111-1111-1111-1111-111111111111',
    2,
    1,
    'yargi',
    'keyword',
    'Olayin kendisine verdigimiz anlam ve etiket.',
    'Stoaci bakis, duygusal sarsintinin buyuk kisminin olaydan degil onun hakkinda verdigimiz acele hukumlardan geldigini savunur.',
    'Bu terim okuyucuyu dis dunyayi degistirmeden once kendi zihinsel yorumunu incelemeye davet eder.'
  ),
  (
    '11111111-1111-1111-1111-111111111111',
    3,
    1,
    'ortak iyi',
    'keyword',
    'Bireysel cikari asan toplumsal ve dogal uyum duygusu.',
    'Marcus Aurelius icin insan yalnizca kendi huzuru icin degil, buyuk butunun yararina uygun eylemek zorundadir.',
    'Terim Stoaci etik ile kamusal sorumlulugu birbirine baglar.'
  ),
  (
    '11111111-1111-1111-1111-111111111111',
    6,
    1,
    'zihin',
    'keyword',
    'Kisinin yeniden duzen kurabildigi ic merkez.',
    'Icin kalesi fikri, oz denetimin en guvenilir siginaginin dis kosullarda degil zihnin kendi duzeninde oldugunu anlatir.',
    'Metin bu kavrami kacis degil, toparlanma ve berraklasma araci olarak kullanir.'
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    1,
    1,
    'gorunus',
    'keyword',
    'Ilk bakista deneyimledigimiz ve nesnenin kendisi sandigimiz yuzey.',
    'Russell gorunusu, felsefenin baslangic noktasi yapar; cunku tanidik seyler bile dikkatle bakinca karmasiklasir.',
    'Kelime okuyucuyu dogal kabul edilen deneyim ile felsefi sorgulama arasindaki mesafeyi gormeye zorlar.'
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    1,
    2,
    'gerceklik',
    'keyword',
    'Gorunusun arkasinda oldugu varsayilan daha sabit duzey.',
    'Felsefi problem, degisen deneyimlerin otesinde bagimsiz bir gerceklik olup olmadigini ve ona nasil ulasacagimizi sorar.',
    'Bu terim kitap boyunca epistemoloji sorularinin ortak eksenini kurar.'
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    2,
    1,
    'sense-data',
    'reference',
    'Dogrudan deneyimledigimiz renk, doku, ses gibi veri parcaciklari.',
    'Russell bu kavramla nesnenin kendisi ile bize verilen deneyim arasinda ayrim kurar.',
    'Terim modern epistemolojide algi tartismalarinin temel girislerinden biridir.'
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    3,
    1,
    'tanisiklik',
    'keyword',
    'Bir seyi araci olmadan dogrudan deneyimleyerek bilme bicimi.',
    'Russell''da acquaintance, bilgi hiyerarsisinin en dogrudan katmanini ifade eder.',
    'Bu kavram sayesinde okuyucu betimleme ile dogrudan deneyim arasindaki epistemik farki kavrar.'
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    4,
    1,
    'induction',
    'reference',
    'Gecmisten gelecege uzanan genelleme yapma bicimi.',
    'Bilimsel beklentilerimizin buyuk kismi induction kullanir, fakat Russell bunun mantiksal temelinin sandigimiz kadar saglam olmadigini hatirlatir.',
    'Kelime bilimsel dusuncenin aliskanlik ile gerekce arasindaki gerilimini gostermek icin merkezi onemdedir.'
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    5,
    1,
    'universals',
    'reference',
    'Tek tek nesnelerden bagimsiz olarak iliski, benzerlik ve yapilari ifade eden genel formlar.',
    'Russell bu kavramla matematiksel ve mantiksal bilginin neden sadece tekil deneyimlerden cikmadigini aciklar.',
    'Terim soyut dusuncenin sadece dil oyunu degil, bilgi yapisinin bir parcasi oldugunu gosterir.'
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    6,
    1,
    'felsefe',
    'keyword',
    'Kesin cevap kadar dusunce ufkunu genisletme islevi tasiyan sorgulama etkinligi.',
    'Russell''a gore felsefenin degeri, zihni kesinlik bagimliligindan kurtarip daha genis olasiliklara acmasidir.',
    'Kitabin finalindeki bu vurgu urunun AI-assisted learning vaadine de en yakin bolumlerden biridir.'
  );
