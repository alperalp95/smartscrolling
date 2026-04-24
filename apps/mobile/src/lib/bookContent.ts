export type ReaderPart = {
  text: string;
  type: 'normal' | 'keyword' | 'reference';
  word?: string;
};

export type ReaderParagraph = {
  id: string;
  parts: ReaderPart[];
};

export type ReaderDefinition = {
  ai: string;
  def: string;
  type: string;
};

export type ReaderSlice = {
  definitions: Record<string, ReaderDefinition>;
  paragraphs: ReaderParagraph[];
};

const MEDITATIONS_BOOK_ID = '11111111-1111-1111-1111-111111111111';
const PROBLEMS_OF_PHILOSOPHY_BOOK_ID = '22222222-2222-2222-2222-222222222222';

const DEFAULT_SLICE: ReaderSlice = {
  paragraphs: [
    {
      id: 'p1',
      parts: [
        { text: 'Bundan yaklasik yetmis bin yil once, ', type: 'normal' },
        { text: 'Homo sapiens', type: 'keyword', word: 'Homo sapiens' },
        {
          text: ` Afrika'dan cikmaya basladi ve gezegeni hizla fethetti. Bu goc dalgasinin ardindaki guc, tarihcilerin "`,
          type: 'normal',
        },
        { text: 'kognitif devrim', type: 'keyword', word: 'kognitif devrim' },
        { text: '" olarak adlandirdigi evrimsel bir sicrama idi.', type: 'normal' },
      ],
    },
    {
      id: 'p2',
      parts: [
        { text: '', type: 'normal' },
        { text: 'Charles Darwin', type: 'reference', word: 'Charles Darwin' },
        {
          text: `'in evrim teorisine gore bu gelisme, beyin yapisindaki rastlantisal bir genetik mutasyonla basladi. Insanlar artik gercekte var olmayan seyler hakkinda dusunebiliyor, dil kullanarak soyut kavramlar uretebiliyordu.`,
          type: 'normal',
        },
      ],
    },
    {
      id: 'p3',
      parts: [
        { text: 'Bu sayede ', type: 'normal' },
        { text: 'ticaret aglari', type: 'keyword', word: 'ticaret aglari' },
        {
          text: ' kuruldu; tanismayan insanlar ortak bir mit, bir din ya da bir ulus fikri etrafinda orgutlenebildi. Diger turlerin sahip olmadigi bu yetenek, ',
          type: 'normal',
        },
        { text: 'Homo sapiens', type: 'keyword', word: 'Homo sapiens' },
        { text: "'i gezegenin hakimine donusturdu.", type: 'normal' },
      ],
    },
  ],
  definitions: {
    'Homo sapiens': {
      type: 'Anahtar Kavram',
      def: `Modern insanin bilimsel adidir. Latince'de "akilli insan" anlamina gelir. Afrika'da yaklasik 300.000 yil once ortaya cikti.`,
      ai: 'Harari bu kavrami kullanarak diger Homo turlerinden ayrimimizi vurgular. Temel farkimiz: soyut dusunce ve kurgu uretme kapasitesi.',
    },
    'kognitif devrim': {
      type: 'Anahtar Kavram',
      def: "Yaklasik 70.000 yil once Homo sapiens'in zihinsel kapasitesinde yasandigi dusunulen ani sicrama. Soyut dusunce ve dili mumkun kildi.",
      ai: "Harari'ye gore bu devrim rastlantisal bir genetik mutasyondan kaynaklandi. Gercekte olmayan seyleri hayal etmeyi mumkun kildi.",
    },
    'Charles Darwin': {
      type: 'Referans - Bilim Insani',
      def: `Ingiliz naturalist (1809-1882). Dogal seleksiyon yoluyla evrimi aciklayan "Turlerin Kokeni" (1859) kitabiyla tarihe gecti.`,
      ai: "Harari, Darwin'in evrim teorisini biyolojik temeli aciklamak icin kullanir; ancak kulturel evrimin biyolojikten once geldigini savunur.",
    },
    'ticaret aglari': {
      type: 'Anahtar Kavram',
      def: 'Ortak para, hukuk veya guven sistemi uzerine kurulu, tanismayan bireyler arasindaki alisveris aglari.',
      ai: "Sapiens'te ticaret aglari, kurguya (para, yasalar) olan ortak inancin somut urunu olarak ele alinir.",
    },
  },
};

const MEDITATIONS_SLICE: ReaderSlice = {
  paragraphs: [
    {
      id: 'med-1',
      parts: [
        { text: 'Sabah olunca kendine sunu soyle: bugun ', type: 'normal' },
        { text: 'mudahaleci insanlar', type: 'keyword', word: 'mudahaleci insanlar' },
        {
          text: ', nankorler, kibirliler ve hilekarlarla karsilasacagim. Ama bunlarin hicbiri beni ',
          type: 'normal',
        },
        { text: 'erdem', type: 'keyword', word: 'erdem' },
        { text: ' yolumdan cikarmamali.', type: 'normal' },
      ],
    },
    {
      id: 'med-2',
      parts: [
        {
          text: 'Cunku onlar yanlisi iyi bildikleri icin degil, dogruyu gormedikleri icin yapiyorlar. Bu yuzden ',
          type: 'normal',
        },
        { text: 'Marcus Aurelius', type: 'reference', word: 'Marcus Aurelius' },
        {
          text: ', ofkeyi degil anlayisi secmeyi ve insanin kendi zihnini korumayi on planda tutuyor.',
          type: 'normal',
        },
      ],
    },
    {
      id: 'med-3',
      parts: [
        { text: 'Stoaci bakista asil mesele, dis dunyayi degil kendi ', type: 'normal' },
        { text: 'zihin disiplini', type: 'keyword', word: 'zihin disiplini' },
        {
          text: 'ni yonetmektir. Doga ile uyumlu yasamak, tepkilerini secmek ve ortak iyiyi unutmamak temel ilkedir.',
          type: 'normal',
        },
      ],
    },
  ],
  definitions: {
    mudahaleci: {
      type: 'Anahtar Tema',
      def: 'Stoaci metinlerde gunluk hayatta kisiyi huzursuz eden zor insan davranislarini anlatan kelime.',
      ai: 'Marcus Aurelius sabah alistirmasinda bu tip insanlari tek tek sayarak duygusal surprizi azaltmaya ve tepki disiplinini korumaya calisir.',
    },
    'mudahaleci insanlar': {
      type: 'Anahtar Tema',
      def: 'Stoaci metinlerde kisiyi raydan cikarmaya calisan zor insanlar ve gunluk surtusmeler anlamina gelir.',
      ai: 'Marcus Aurelius bu listeyi bir tehdit kataligu olarak degil, gunun duygusal gerceklerine onceden hazirlanma alistirmasi olarak kullanir.',
    },
    erdem: {
      type: 'Anahtar Kavram',
      def: 'Stoacilikte iyi bir hayatin merkezi olan ahlaki ustunluk; olcululuk, adalet, cesaret ve bilgelik toplamidir.',
      ai: 'Bu pasajda erdem, disaridaki kisilerin davranisindan bagimsiz olarak korunmasi gereken ic merkez gibi konumlanir.',
    },
    'Marcus Aurelius': {
      type: 'Referans - Yazar',
      def: 'Roma imparatoru ve Stoaci dusunur. Kendime Dusunceler, kendi kendine tuttugu felsefi notlardan olusur.',
      ai: 'Onu farkli kilan sey, guc sahibi bir yoneticinin metni teorik degil, dogrudan gunluk oz denetim araci olarak yazmis olmasidir.',
    },
    Stoaci: {
      type: 'Referans - Felsefe Akimi',
      def: 'Stoacilik, erdemi ve zihinsel dengeyi merkezine alan antik felsefe okuludur.',
      ai: 'Metinde Stoaci bakis, olaylari kontrol etmekten cok onlara verilen tepkinin kalitesine odaklanir.',
    },
    'ortak iyi': {
      type: 'Anahtar Tema',
      def: 'Bireysel cikarin otesinde topluma ve ortak duzene fayda saglayan iyi anlayisi.',
      ai: 'Marcus Aurelius bireysel huzuru toplumdan kacisla degil, ortak iyinin icindeki gorevini yerine getirmekle baglar.',
    },
    'zihin disiplini': {
      type: 'Anahtar Kavram',
      def: 'Duygusal tepkiyi, yargiyi ve dikkati bilincle yonetme becerisi.',
      ai: 'Stoaci gelenekte ozgurluk, olaylari kontrol etmekten cok onlara verecegin tepkiyi egitebilmekle ilgilidir.',
    },
  },
};

const PROBLEMS_OF_PHILOSOPHY_SLICE: ReaderSlice = {
  paragraphs: [
    {
      id: 'ph-1',
      parts: [
        {
          text: 'Felsefi sorgu bazen en tanidik nesneden baslar: ornegin bir masa. Ama ilk gordugumuz sey nesnenin kendisi mi, yoksa sadece onun bize gorunen ',
          type: 'normal',
        },
        { text: 'gorunus', type: 'keyword', word: 'gorunus' },
        { text: 'u mu? Bertrand Russell bu soruyla ', type: 'normal' },
        { text: 'gerceklik', type: 'keyword', word: 'gerceklik' },
        { text: ' hakkindaki tum kolay varsayimlari sarsar.', type: 'normal' },
      ],
    },
    {
      id: 'ph-2',
      parts: [
        {
          text: 'Elimizde ilk basta bulunan sey, nesnenin kendisi degil; renk, sertlik ve ses gibi ',
          type: 'normal',
        },
        { text: 'sense-data', type: 'reference', word: 'sense-data' },
        {
          text: ' denilen veri parcaciklaridir. Biz masayi dogrudan degil, bu deneyim uzerinden dusunuruz. Bu da bilginin ilk katmaninin sandigimizdan daha dolayli oldugunu gosterir.',
          type: 'normal',
        },
      ],
    },
    {
      id: 'ph-3',
      parts: [
        { text: 'Russell daha sonra ', type: 'normal' },
        { text: 'tanisiklik', type: 'keyword', word: 'tanisiklik' },
        {
          text: ' ile bildigimiz seyler arasinda fark kurar; bir aciyi hissetmek ya da bir rengi gormek gibi. Buna karsin gelecegin gecmise benzeyecegini varsaymamiz ',
          type: 'normal',
        },
        { text: 'induction', type: 'reference', word: 'induction' },
        { text: ' problemine acilir; matematiksel iliskiler ise ', type: 'normal' },
        { text: 'universals', type: 'reference', word: 'universals' },
        { text: ' dusuncesiyle daha soyut bir bilgi duzeyine tasinir.', type: 'normal' },
      ],
    },
  ],
  definitions: {
    gorunus: {
      type: 'Anahtar Kavram',
      def: 'Bir nesnenin bize ilk anda, belirli bir bakis acisi ve kosul altinda gorunen yuzeyi.',
      ai: 'Russell icin gorunus, felsefi sorgunun cikis noktasi olur; cunku ilk bakista sabit sandigimiz seyler dikkatle bakinca karmasiklasir.',
    },
    gerceklik: {
      type: 'Anahtar Kavram',
      def: 'Gorunusun arkasinda yer aldigini varsaydigimiz, daha bagimsiz ve daha sabit varlik duzeyi.',
      ai: 'Kitap boyunca asil soru, gorunus ile gerceklik arasindaki boslugu ne kadar ve hangi araclarla kapatabilecegimizdir.',
    },
    'sense-data': {
      type: 'Referans - Epistemoloji',
      def: 'Dogrudan deneyimledigimiz renk, ses, doku gibi algi verileri.',
      ai: 'Russell bu terimle nesnenin kendisi ile bize verilen deneyim arasinda sistematik bir ayrim kurar.',
    },
    tanisiklik: {
      type: 'Anahtar Kavram',
      def: 'Bir seyi araci olmadan, dogrudan deneyim yoluyla bilme durumu.',
      ai: 'Russell bilginin ilk guvenli katmanini bu sekilde kurar; cunku dogrudan deneyim, betimlemeden once gelir.',
    },
    induction: {
      type: 'Referans - Akil Yurutme',
      def: 'Gecmis duzenliliklerden gelecege dair genel sonuc cikarimi yapma bicimi.',
      ai: 'Kitapta bu kavram, bilimin bile tamamen kendiliginden guvence altinda olmayan bir varsayim duzeyine dayandigini gostermek icin kullanilir.',
    },
    universals: {
      type: 'Referans - Felsefe',
      def: 'Tek tek nesnelerden bagimsiz olarak iliski, benzerlik ve yapilari anlatan genel formlar.',
      ai: 'Russell universals kavramiyla, matematiksel ve mantiksal bilginin neden yalnizca tekil deneyimlerden cikmadigini aciklar.',
    },
  },
};

export function getReaderSlice(bookId: string) {
  if (bookId === MEDITATIONS_BOOK_ID) {
    return MEDITATIONS_SLICE;
  }

  if (bookId === PROBLEMS_OF_PHILOSOPHY_BOOK_ID) {
    return PROBLEMS_OF_PHILOSOPHY_SLICE;
  }

  return DEFAULT_SLICE;
}
