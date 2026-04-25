export function normalizeFactVisualText(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replaceAll(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

function includesAny(text: string, patterns: string[]) {
  return patterns.some((pattern) => text.includes(pattern));
}

function buildTopicText(input: {
  title?: string | null;
  tags?: string[] | null;
  content?: string | null;
}) {
  return normalizeFactVisualText(
    [input.title, input.content, ...(Array.isArray(input.tags) ? input.tags : [])].join(' '),
  );
}

export function deriveFactVisualKey(input: {
  sourceLabel?: string | null;
  category?: string | null;
  title?: string | null;
  tags?: string[] | null;
  content?: string | null;
}) {
  const normalizedSourceLabel = normalizeFactVisualText(input.sourceLabel);
  const normalizedCategory = normalizeFactVisualText(input.category);
  const topicText = buildTopicText(input);

  if (normalizedSourceLabel.includes('nasa')) {
    return 'space-observatory';
  }

  if (normalizedSourceLabel.includes('stanford encyclopedia')) {
    if (
      includesAny(topicText, [
        'ethic',
        'moral',
        'justice',
        'duty',
        'responsibility',
        'kant',
        'rawls',
      ])
    ) {
      return 'philosophy-ethics';
    }

    if (
      includesAny(topicText, [
        'metaphys',
        'ontology',
        'epistem',
        'mind',
        'consciousness',
        'identity',
        'exist',
        'religion',
      ])
    ) {
      return 'philosophy-metaphysics';
    }

    return 'philosophy-library';
  }

  if (normalizedSourceLabel.includes('medlineplus')) {
    if (includesAny(topicText, ['mental', 'stress', 'sleep', 'anxiety', 'depression', 'mood'])) {
      return 'health-mind';
    }

    if (
      includesAny(topicText, [
        'diagnos',
        'test',
        'patient',
        'safety',
        'rehabilitation',
        'medical',
        'clinic',
        'treatment',
        'screening',
        'therapy',
      ])
    ) {
      return 'health-clinical';
    }

    if (
      includesAny(topicText, [
        'heart',
        'liver',
        'kidney',
        'lung',
        'respiratory',
        'digest',
        'bone',
        'muscle',
        'blood',
        'brain',
        'pain',
        'arthritis',
        'metabolism',
        'nutrition',
      ])
    ) {
      return 'health-body';
    }

    return 'health-brief';
  }

  // ── BİLİM ──────────────────────────────────────────────────────────────
  if (normalizedCategory.includes('bilim')) {
    if (includesAny(topicText, [
      'space', 'galaxy', 'planet', 'orbit', 'moon', 'mars', 'asteroid', 'comet',
      'nebula', 'telescope', 'cosmic', 'star',
      'uzay', 'gunes', 'yildiz', 'gezegen', 'ay', 'galaksi', 'kara delik',
      'kuyrukluyildiz', 'evren', 'astronot', 'uydu', 'kuyruklu',
    ])) {
      return 'science-cosmos';
    }

    if (includesAny(topicText, [
      'beyin', 'hafiza', 'bellek', 'psikoloji', 'algi', 'sinir', 'duygu',
      'bilinc', 'zihin', 'noron', 'hafizamiz', 'zihinsel',
    ])) {
      return 'science-brain';
    }

    if (includesAny(topicText, [
      'vucut', 'deri', 'parmak', 'kemik', 'kas', 'organ', 'goz', 'kulak',
      'el ', 'ayak', 'yuz', 'kan', 'hormon', 'gozyas', 'termometre',
      'atardamar', 'damar', 'nabiz', 'gozalt',
    ])) {
      return 'science-human-body';
    }

    if (includesAny(topicText, [
      'bocek', 'ari', 'karinca', 'kelebek', 'sinek', 'kene', 'cicek', 'bal',
      'petekler', 'petek', 'kovani',
    ])) {
      return 'science-insects';
    }

    if (includesAny(topicText, [
      'hayvan', 'kus', 'balik', 'kedi', 'kopek', 'memeli', 'surungen',
      'devekusu', 'at', 'fil', 'deve', 'kaplumbaga', 'domuz', 'tavsan',
      'aslan', 'kaplan', 'koyun', 'inek', 'kurbaga', 'yunus', 'balina',
      'animal', 'bird', 'fish',
    ])) {
      return 'science-animals';
    }

    if (includesAny(topicText, [
      'evrim', 'dogal secim', 'mutasyon', 'tur', 'evolution', 'natural selection',
      'darwin', 'atalarimiz', 'fosil', 'fossil',
    ])) {
      return 'science-evolution';
    }

    if (includesAny(topicText, [
      'cell', 'dna', 'gene', 'genetic', 'organism', 'immune', 'virus', 'bacteria', 'biology',
      'hucre', 'gen', 'bakteri', 'kalitim', 'protein', 'enzim',
    ])) {
      return 'science-biology';
    }

    if (includesAny(topicText, [
      'isik', 'renk', 'gorme', 'optik', 'lens', 'prizma', 'yansima', 'kirilma',
      'gokkusagi', 'fotokromatik', 'light', 'optic', 'colour', 'color',
    ])) {
      return 'science-optics';
    }

    if (includesAny(topicText, [
      'fizik', 'enerji', 'isi', 'sicaklik', 'ses', 'titresim', 'elektrik',
      'manyetik', 'kuvvet', 'ivme', 'hiz', 'basinc', 'vakum', 'radyasyon',
      'physics', 'energy', 'heat', 'sound', 'electric', 'force',
    ])) {
      return 'science-physics';
    }

    if (includesAny(topicText, [
      'chemistry', 'kimya', 'periodic', 'element', 'molecule', 'compound', 'mendeleyev',
      'atom', 'molekul', 'madde', 'malzeme', 'polimer', 'metal', 'plastik',
      'antifriz', 'cozucu', 'reaksiyon',
    ])) {
      return 'science-chemistry';
    }

    if (includesAny(topicText, [
      'yiyecek', 'gida', 'yemek', 'pisirme', 'besin', 'vitamin', 'mineral',
      'kalori', 'karbonhidrat', 'tarif', 'mutfak', 'sebze', 'meyve',
      'sut', 'peynir', 'ekmek', 'seker', 'tuz', 'food', 'nutrition', 'diet',
    ])) {
      return 'science-food';
    }

    if (includesAny(topicText, [
      'deniz', 'okyanus', 'su alti', 'dalga', 'akvaryum', 'mercan',
      'ocean', 'sea', 'underwater',
    ])) {
      return 'science-ocean';
    }

    if (includesAny(topicText, [
      'bitki', 'agac', 'orman', 'ekoloji', 'dogal', 'cevresel',
      'plant', 'tree', 'forest', 'ecology',
    ])) {
      return 'science-nature';
    }

    if (includesAny(topicText, [
      'earth', 'geology', 'climate', 'volcano', 'mineral', 'glacier', 'weather',
      'atmosphere', 'tectonic',
      'dunya', 'jeoloji', 'volkan', 'deprem', 'atmosfer', 'hava',
    ])) {
      return 'science-earth';
    }

    if (includesAny(topicText, [
      'kesis', 'bulus', 'deney', 'laboratuvar', 'nobel', 'arastirma',
      'discovery', 'experiment', 'research',
    ])) {
      return 'science-discovery';
    }

    return 'science-focus';
  }

  // ── TARİH ──────────────────────────────────────────────────────────────
  if (normalizedCategory.includes('tarih')) {
    if (includesAny(topicText, [
      'icat', 'bulus', 'patent', 'mucit', 'muhendis', 'telefon', 'radyo',
      'invention', 'inventor',
    ])) {
      return 'history-invention';
    }

    if (includesAny(topicText, [
      'gelenek', 'adet', 'festival', 'toren', 'kutlama', 'bayram', 'dugun',
      'noel', 'yilbasi', 'dogum gunu', 'dans', 'muzik', 'kultur',
      'tradition', 'custom', 'celebration',
    ])) {
      return 'history-culture';
    }

    if (includesAny(topicText, [
      'bilim insani', 'bilim tarihi', 'fizikci', 'matematikci',
      'scientist', 'mathematician',
    ])) {
      return 'history-science';
    }

    if (includesAny(topicText, [
      'ancient', 'antik', 'rome', 'roman', 'greek', 'egypt', 'archae',
      'temple', 'ruins', 'medieval', 'dynasty', 'empire', 'cathedral',
      'roma', 'yunan', 'misir', 'orta cag', 'imparatorluk', 'saray', 'kale',
    ])) {
      return 'history-antiquity';
    }

    if (includesAny(topicText, [
      'war', 'battle', 'revolution', 'treaty', 'conflict', 'military',
      'savas', 'savunma', 'askeri', 'ordu', 'catisma', 'isgal',
    ])) {
      return 'history-conflict';
    }

    if (includesAny(topicText, [
      'ticaret', 'ekonomi', 'para', 'alim satim', 'borsa', 'piyasa',
      'trade', 'economy', 'market', 'commerce',
    ])) {
      return 'history-trade';
    }

    return 'history-archive';
  }

  // ── FELSEFE ────────────────────────────────────────────────────────────
  if (normalizedCategory.includes('felsefe')) {
    if (includesAny(topicText, [
      'ethic', 'moral', 'justice', 'duty', 'responsibility', 'utilitarian', 'kant', 'rawls',
      'etik', 'ahlak', 'adalet', 'sorumluluk',
    ])) {
      return 'philosophy-ethics';
    }

    if (includesAny(topicText, [
      'metaphys', 'ontology', 'epistem', 'mind', 'consciousness', 'identity',
      'exist', 'reality', 'knowledge', 'religion',
      'metafizik', 'ontoloji', 'bilinc', 'varlik', 'gerceklik',
    ])) {
      return 'philosophy-metaphysics';
    }

    if (includesAny(topicText, [
      'dil', 'anlam', 'sembol', 'iletisim', 'mantik', 'dil felsefesi',
      'language', 'meaning', 'symbol', 'logic', 'linguistics',
    ])) {
      return 'philosophy-language';
    }

    return 'philosophy-marble';
  }

  // ── TEKNOLOJİ ──────────────────────────────────────────────────────────
  if (normalizedCategory.includes('teknoloji')) {
    if (includesAny(topicText, [
      'yapay zeka', 'makine ogrenmesi', 'derin ogrenme', 'sinir agi', 'otomasyon',
      'artificial intelligence', 'machine learning', 'deep learning', 'neural',
    ])) {
      return 'technology-ai';
    }

    if (includesAny(topicText, [
      'enerji', 'gunes enerjisi', 'nukler', 'yenilenebilir', 'pil', 'batarya',
      'energy', 'solar', 'nuclear', 'renewable', 'battery',
    ])) {
      return 'technology-energy';
    }

    if (includesAny(topicText, [
      'muhendislik', 'insaat', 'kopru', 'yapi', 'motor',
      'engineering', 'construction', 'bridge', 'mechanical',
    ])) {
      return 'technology-engineering';
    }

    if (includesAny(topicText, [
      'computer', 'software', 'program', 'compiler', 'database', 'algorithm',
      'encrypt', 'cryptograph', 'cloud', 'search', 'network', 'internet',
      'distributed', 'digital', 'signal',
      'bilgisayar', 'yazilim', 'algoritma', 'sifreleme',
    ])) {
      return 'technology-computing';
    }

    if (includesAny(topicText, [
      'engine', 'aircraft', 'rocket', 'satellite', 'device', 'hardware',
      'vehicle', 'robot', 'machine', 'electric',
      'roket', 'uydu', 'arac', 'makine', 'cihaz',
    ])) {
      return 'technology-systems';
    }

    return 'technology-grid';
  }

  // ── SAĞLIK ─────────────────────────────────────────────────────────────
  if (normalizedCategory.includes('saglik')) {
    if (includesAny(topicText, [
      'mental', 'stress', 'sleep', 'anxiety', 'depression', 'mood',
      'stres', 'uyku', 'anksiyete', 'depresyon', 'mutluluk', 'ruh hali',
    ])) {
      return 'health-mind';
    }

    if (includesAny(topicText, [
      'diagnos', 'test', 'patient', 'safety', 'rehabilitation', 'medical',
      'clinic', 'treatment', 'screening', 'therapy',
      'teshis', 'hasta', 'tedavi', 'klinik', 'terapi',
    ])) {
      return 'health-clinical';
    }

    if (includesAny(topicText, [
      'genetik', 'dna', 'gen', 'kalitim', 'kromozom',
      'genetics', 'chromosome', 'heredity',
    ])) {
      return 'health-genetics';
    }

    if (includesAny(topicText, [
      'beslenme', 'vitamin', 'mineral', 'diyet', 'besin', 'kalori',
      'nutrition', 'diet', 'supplement',
    ])) {
      return 'health-nutrition';
    }

    if (includesAny(topicText, [
      'yasam tarzi', 'uyku duzeni', 'spor', 'egzersiz', 'meditasyon',
      'lifestyle', 'exercise', 'meditation', 'fitness',
    ])) {
      return 'health-lifestyle';
    }

    if (includesAny(topicText, [
      'heart', 'liver', 'kidney', 'lung', 'respiratory', 'digest', 'bone',
      'muscle', 'blood', 'brain', 'pain', 'arthritis', 'metabolism', 'nutrition',
      'kalp', 'akciger', 'bobrek', 'karaciger', 'sindirim', 'eklem',
    ])) {
      return 'health-body';
    }

    return 'health-brief';
  }

  // ── EDITORIAL fallthrough ───────────────────────────────────────────────
  if (includesAny(normalizedSourceLabel, ['luzumsuz', 'ansiklopedi'])) {
    return 'editorial-trivia';
  }

  if (includesAny(topicText, [
    'merak', 'ilginc', 'sasirtici', 'inanilmaz', 'hayret',
    'curious', 'surprising', 'amazing', 'wonder',
  ])) {
    return 'editorial-wonder';
  }

  if (includesAny(topicText, [
    'kultur', 'sanat', 'muzik', 'film', 'edebiyat',
    'culture', 'art', 'music', 'literature',
  ])) {
    return 'editorial-culture';
  }

  if (includesAny(topicText, [
    'gunluk', 'aliskanlik', 'toplum', 'insanlar', 'neden', 'nasil',
    'daily', 'habit', 'society',
  ])) {
    return 'editorial-everyday';
  }

  return 'editorial-deep';
}

export function isBadFactMediaUrl(mediaUrl: string | null | undefined) {
  const normalizedMediaUrl = (mediaUrl ?? '').trim().toLowerCase();

  if (!normalizedMediaUrl || !normalizedMediaUrl.startsWith('http')) {
    return false;
  }

  if (normalizedMediaUrl.includes('upload.wikimedia.org/wikipedia/en/')) {
    return true;
  }

  if (/\.svg(\.png)?($|\?)/i.test(normalizedMediaUrl)) {
    return true;
  }

  return [
    'logo',
    'seal',
    'crest',
    'coat_of_arms',
    'coat-of-arms',
    'wordmark',
    'icon',
    'symbol',
    'emblem',
    'flag',
    'cover',
    'album',
    'poster',
    'boxart',
    'gamecover',
  ].some((keyword) => normalizedMediaUrl.includes(keyword));
}
