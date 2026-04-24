ALTER TABLE public.book_highlights
ADD COLUMN IF NOT EXISTS section_order INT,
ADD COLUMN IF NOT EXISTS display_order INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS explanation TEXT;

CREATE INDEX IF NOT EXISTS idx_book_highlights_book_section_order
  ON public.book_highlights(book_id, section_order, display_order);

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
    'Anahtar Tema',
    'Sabah rutini icinde zor insan tiplerini onceden kabul etme alistirmasi.',
    'Stoaci metinlerde gunluk hayatta kisiyi huzursuz eden zor insan davranislarini anlatan kelime.',
    'Marcus Aurelius sabah alistirmasinda bu tip insanlari tek tek sayarak duygusal surprizi azaltmaya ve tepki disiplinini korumaya calisir.'
  ),
  (
    '11111111-1111-1111-1111-111111111111',
    1,
    2,
    'erdem',
    'Anahtar Kavram',
    'Dis dunyanin baskisina ragmen korunmasi gereken ic merkez.',
    'Stoacilikte iyi bir hayatin merkezi olan ahlaki ustunluk; olcululuk, adalet, cesaret ve bilgelik toplamidir.',
    'Bu pasajda erdem, disaridaki kisilerin davranisindan bagimsiz olarak korunmasi gereken ic merkez gibi konumlanir.'
  ),
  (
    '11111111-1111-1111-1111-111111111111',
    2,
    1,
    'Stoaci',
    'Referans - Felsefe Akimi',
    'Kontrol alanini yargi ve tepkiye indiren felsefi bakis.',
    'Stoacilik, erdemi ve zihinsel dengeyi merkezine alan antik felsefe okuludur.',
    'Metinde Stoaci bakis, olaylari kontrol etmekten cok onlara verilen tepkinin kalitesine odaklanir.'
  ),
  (
    '11111111-1111-1111-1111-111111111111',
    3,
    1,
    'ortak iyi',
    'Anahtar Tema',
    'Bireysel huzurun toplumsal gorevle baglanmasi.',
    'Bireysel cikarin otesinde topluma ve ortak duzene fayda saglayan iyi anlayisi.',
    'Marcus Aurelius bireysel huzuru toplumdan kacisla degil, ortak iyinin icindeki gorevini yerine getirmekle baglar.'
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    1,
    1,
    'evlilik',
    'Anahtar Tema',
    'Romanin acilisinda ekonomik ve toplumsal beklenti mekanizmasi.',
    'Romanda sadece duygusal birliktelik degil, sinif, guvenlik ve toplumsal konum meselesi olarak da islenir.',
    'Ask ve Gurur’un acilisinda evlilik, bireysel romantizmden once ailelerin ekonomik ve sosyal stratejisinin parcasi gibi kurulur.'
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    2,
    1,
    'Mr. Bennet',
    'Referans - Karakter',
    'Ailenin ironik ve mesafeli baba figuru.',
    'Bennet ailesinin babasi; romanin erken bolumlerinde alayci sakinligiyle one cikar.',
    'Mr. Bennet karakteri, ailenin sosyal kaygilarina mesafeli ve ironik bakisi temsil eder.'
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    3,
    1,
    'Elizabeth',
    'Referans - Karakter',
    'Romanin merkezindeki gozlem noktalarindan biri.',
    'Romanin merkezindeki karakterlerden biri; zekasi, canliligi ve gozlem gucuyle ayristirilir.',
    'Elizabeth’in bakis acisi, romanin gurur ve onyargi eksenini test eden en dinamik gozlem noktasidir.'
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    3,
    2,
    'Darcy',
    'Referans - Karakter',
    'Ilk izlenimde soguk ve gururlu okunan karakter.',
    'Romanda ilk etapta mesafeli ve gururlu gorunen, ancak zamanla daha karmasik yonleri acilan karakter.',
    'Darcy ilk izlenimlerde soguk ve kibirli okunur; roman ilerledikce bu yarginin ne kadar eksik oldugu acilir.'
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    4,
    1,
    'sinif',
    'Anahtar Tema',
    'Toplumsal konum ve gorunmez sosyal hiyerarsi.',
    'Toplumsal konum, ekonomik guc ve sayginlik duzeni.',
    'Austen’in sahnelerinde sinif, sadece para degil; kimin kiminle nasil konustugunu bile belirleyen gorunmez bir duzendir.'
  );
