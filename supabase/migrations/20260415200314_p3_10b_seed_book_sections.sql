UPDATE public.books
SET
  source_format = 'gutenberg_text',
  source_storage_bucket = 'book-files',
  source_storage_path = 'public-domain/meditations.txt',
  total_sections = 4
WHERE id = '11111111-1111-1111-1111-111111111111';

UPDATE public.books
SET
  source_format = 'gutenberg_text',
  source_storage_bucket = 'book-files',
  source_storage_path = 'public-domain/pride-and-prejudice.txt',
  total_sections = 4
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
  plain_text,
  summary,
  word_count,
  estimated_pages
)
VALUES
  (
    '11111111-1111-1111-1111-111111111111',
    1,
    'Kitap 1 - Sabah Kendine Hatirlat',
    'Sabah olunca kendine sunu soyle: bugun mudahaleci, nankor, kibirli, sahtekar, kiskanclik dolu insanlar ile karsilasacagim. Ama bunlarin hicbiri beni yolumdan cikarmamali; cunku onlar iyiyi kotuden ayiramadiklari icin boyle davranir. Ben ise doganin neyin iyi neyin kotu oldugunu gosterdigini gordum. Bu nedenle benzer bir dogayi paylastigim insanlara ofke duymak yerine, onlarla uyum icinde yasamayi secmeliyim.',
    'Stoaci sabah rutini: zor insanlarla karsilasmanin kacınılmazligini kabul edip tepki disiplinini korumak.',
    63,
    2
  ),
  (
    '11111111-1111-1111-1111-111111111111',
    2,
    'Kitap 2 - Kontrol Edebildigin Sey',
    'Dis dunyada olup bitenlerin coguna tam olarak hukmedemezsin; ama onlara verdigin karsiligi sekillendirebilirsin. Bir olay seni incittiginde aslinda seni bozan olay degil, o olay hakkindaki yargindir. Bu yargiyi geri cekebildiginde, zihnin yeniden sakinlige donebilir. Stoaci uygulama tam da burada baslar: tepkiyi otomatik aliskanliktan alip bilincli secime tasimak.',
    'Marcus Aurelius kontrol alanini daraltir: olaylardan cok yargi ve tepkiye odaklan.',
    58,
    2
  ),
  (
    '11111111-1111-1111-1111-111111111111',
    3,
    'Kitap 3 - Ortak Iyi ve Gorev',
    'Insan yalniz yasamak icin yaratilmamistir. Ari kovan icin neyse insan da toplum icin odur. Bu yuzden yapman gereken, her gun sana dusen gorevi aciklik ve sadelikle yerine getirmektir. Bir baskasinin takdiri, korkusu ya da kusuru senin isini belirlememeli. Kendi eylemini adalet, olcululuk ve bilgelik cizgisinde tutabildiginde gunu degerli kilarsin.',
    'Metin bireysel huzuru ortak iyi ile baglar; stoacilik yalnizca ic dunya degil, toplumsal sorumluluk da tasir.',
    59,
    2
  ),
  (
    '11111111-1111-1111-1111-111111111111',
    4,
    'Kitap 4 - Gecicilik ve Dikkat',
    'Unutma: hem ovgu hem elestiri kisa omurludur; hem ovulen hem oven gecicidir. Bugun seni mesgul eden bircok sey kisa sure sonra dagilip gidecektir. O halde zihnini anlamsiz daginikliklara degil, simdiki gorevine topla. Her eylemi son eyleminmis gibi duzgun, sakince ve dikkatle yapmak insanin kendine verebilecegi en buyuk disiplindir.',
    'Fanilik bilinci, odağı bugunun dikkatli eylemine cekmek icin kullaniliyor.',
    56,
    2
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    1,
    'Bolum 1 - Evrensel Kabul',
    'Herkesin kabul ettigi bir gercek vardir ki, buyuk bir servete sahip bekar bir adamin mutlaka bir ese ihtiyaci oldugu dusunulur. Boyle bir adamin bir mahalleye gelisi, etraftaki aileler icin hemen sosyal ve ekonomik bir hesaplamaya donusur. Daha ilk satirdan roman bize evlilik meselesinin yalnizca romantik degil, toplumsal statuyu belirleyen ciddi bir mekanizma oldugunu hissettirir.',
    'Romanin acilisi, evliligi hem toplumsal beklenti hem de ekonomik strateji olarak kurar.',
    60,
    2
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    2,
    'Bolum 2 - Bennet Ailesinin Tavri',
    'Mrs. Bennet yeni komsulari hakkinda heyecanla konusurken, Mr. Bennet alayci bir sakinlikle cevap verir. Aralarindaki bu ritim, ailenin ic dinamiklerini aciga cikarir: biri toplumun beklentilerine fazlasiyla acik, digeri ise bunlari ince bir mizahla izleyen bir karakterdir. Austen bu diyaloglarda buyuk bir olay anlatmaz; ama kisa cumlelerle evin ruhunu, sinif kaygisini ve evlilik baskisini kurar.',
    'Ailenin ic sesi, romanin mizahini ve toplumsal gozlemini daha ilk sayfalarda aciga cikarir.',
    62,
    2
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    3,
    'Bolum 3 - Ilk Izlenimler',
    'Bir baloda kurulan ilk bakislar ve kisa yargilar, romanin geri kalanini belirleyecek kadar guclu olabilir. Elizabeth zekasi ve canliligi ile hemen fark edilirken, Darcy mesafeli ve gururlu tavriyla dikkat ceker. Bu ilk temas, karakterlerin birbirini gercekte kim olduklariyla degil, o an gordukleri toplumsal yuzlerle okumaya basladigini gosterir.',
    'Gurur ve onyargi ekseni, ilk sosyal temaslar uzerinden kuruluyor.',
    54,
    2
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    4,
    'Bolum 4 - Sohbetlerin Politikasi',
    'Austenin dunyasinda bir sohbet yalnizca sohbet degildir; her bakis, her imali cumle, her sessizlik toplumsal bir pozisyon tasir. Kimin kimi begendigi, kimin kimden uzak durdugu ve kimin hangi salonda rahatca konustugu, sinif iliskilerini ve karakterlerin kendilerine bicilen rolleri aciga cikarir. Bu yuzden romanin gerilimi buyuk felaketlerden degil, gunluk davranislarin ince siyasetinden dogar.',
    'Romanin toplumsal gucu, kucuk jest ve konusmalarin buyuk anlamlar tasimasindan gelir.',
    63,
    2
  );
