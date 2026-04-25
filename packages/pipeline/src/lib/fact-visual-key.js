export function normalizeText(value) {
  return (value ?? '')
    .toString()
    .normalize('NFD')
    .replaceAll(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

function includesAny(text, patterns) {
  return patterns.some((pattern) => text.includes(pattern));
}

function buildTopicText({ title, tags, sourceTitle, content }) {
  return normalizeText(
    [title, sourceTitle, content, ...(Array.isArray(tags) ? tags : [])].join(' '),
  );
}

export function deriveFactVisualKey({ sourceLabel, category, title, tags, sourceTitle, content }) {
  const normalizedSourceLabel = normalizeText(sourceLabel);
  const normalizedCategory = normalizeText(category);
  const topicText = buildTopicText({ title, tags, sourceTitle, content });

  // ── Source-pinned overrides ──────────────────────────────────────────────
  if (normalizedSourceLabel.includes('nasa')) {
    return 'space-observatory';
  }

  if (normalizedSourceLabel.includes('stanford encyclopedia')) {
    if (
      includesAny(topicText, [
        'ethic', 'moral', 'justice', 'duty', 'responsibility', 'kant', 'rawls',
      ])
    ) {
      return 'philosophy-ethics';
    }
    if (
      includesAny(topicText, [
        'metaphys', 'ontology', 'epistem', 'mind', 'consciousness', 'identity', 'exist', 'religion',
      ])
    ) {
      return 'philosophy-metaphysics';
    }
    return 'philosophy-library';
  }

  if (normalizedSourceLabel.includes('medlineplus')) {
    if (includesAny(topicText, ['mental', 'stress', 'sleep', 'anxiety', 'depression', 'mood', 'stres', 'uyku', 'anksiyete'])) {
      return 'health-mind';
    }
    if (includesAny(topicText, ['diagnos', 'test', 'patient', 'safety', 'rehabilitation', 'medical', 'clinic', 'treatment', 'screening', 'therapy'])) {
      return 'health-clinical';
    }
    if (includesAny(topicText, ['heart', 'liver', 'kidney', 'lung', 'respiratory', 'digest', 'bone', 'muscle', 'blood', 'brain', 'pain', 'arthritis', 'metabolism', 'nutrition'])) {
      return 'health-body';
    }
    return 'health-brief';
  }

  // ── BİLİM ────────────────────────────────────────────────────────────────
  if (normalizedCategory.includes('bilim')) {
    // Cosmos / Space
    if (
      includesAny(topicText, [
        'space', 'galaxy', 'planet', 'orbit', 'moon', 'mars', 'asteroid', 'comet',
        'nebula', 'telescope', 'cosmic', 'star',
        'uzay', 'gunes', 'yildiz', 'gezegen', 'ay', 'galaksi', 'kara delik',
        'kuyrukluyildiz', 'evren', 'astronot', 'uydu', 'kuyruklu',
      ])
    ) {
      return 'science-cosmos';
    }

    // Brain / Psychology
    if (
      includesAny(topicText, [
        'beyin', 'hafiza', 'bellek', 'psikoloji', 'algi', 'sinir', 'duygu',
        'bilinc', 'zihin', 'noron', 'hafizamiz', 'zihinsel',
      ])
    ) {
      return 'science-brain';
    }

    // Human body (organs, senses, physiology)
    if (
      includesAny(topicText, [
        'vucut', 'deri', 'parmak', 'kemik', 'kas', 'organ', 'goz', 'kulak',
        'el ', 'ayak', 'yuz', 'kan', 'hormon', 'gozyas', 'termometre',
        'atardamar', 'damar', 'nabiz', 'gozalt',
      ])
    ) {
      return 'science-human-body';
    }

    // Insects
    if (
      includesAny(topicText, [
        'bocek', 'ari', 'karinca', 'kelebek', 'sinek', 'kene', 'cicek', 'bal',
        'petekler', 'petek', 'kovani',
      ])
    ) {
      return 'science-insects';
    }

    // Animals
    if (
      includesAny(topicText, [
        'hayvan', 'kus', 'balik', 'kedi', 'kopek', 'memeli', 'surungen',
        'devekusu', 'at', 'fil', 'deve', 'kaplumbaga', 'domuz', 'tavsan',
        'aslan', 'kaplan', 'koyun', 'inek', 'kurbaga', 'yunus', 'balina',
        'animal', 'bird', 'fish',
      ])
    ) {
      return 'science-animals';
    }

    // Evolution
    if (
      includesAny(topicText, [
        'evrim', 'dogal secim', 'mutasyon', 'tur', 'evolution', 'natural selection',
        'darwin', 'atalarimiz', 'fosil', 'fossil',
      ])
    ) {
      return 'science-evolution';
    }

    // Biology (molecular / cellular)
    if (
      includesAny(topicText, [
        'cell', 'dna', 'gene', 'genetic', 'organism', 'immune', 'virus', 'bacteria', 'biology',
        'hucre', 'gen', 'bakteri', 'kalitim', 'protein', 'enzim', 'hormon',
      ])
    ) {
      return 'science-biology';
    }

    // Optics / Light
    if (
      includesAny(topicText, [
        'isik', 'renk', 'gorme', 'optik', 'lens', 'prizma', 'yansima', 'kirilma',
        'gokkusagi', 'mor otesi', 'kizilotesi', 'fotokromatik',
        'light', 'optic', 'colour', 'color',
      ])
    ) {
      return 'science-optics';
    }

    // Physics / Energy
    if (
      includesAny(topicText, [
        'fizik', 'enerji', 'isi', 'sicaklik', 'ses', 'titresim', 'elektrik',
        'manyetik', 'kuvvet', 'ivme', 'hiz', 'basinc', 'vakum', 'radyasyon',
        'physics', 'energy', 'heat', 'sound', 'electric', 'force',
      ])
    ) {
      return 'science-physics';
    }

    // Chemistry / Materials
    if (
      includesAny(topicText, [
        'chemistry', 'kimya', 'periodic', 'element', 'molecule', 'compound', 'mendeleyev',
        'atom', 'molekul', 'madde', 'malzeme', 'polimer', 'metal', 'plastik',
        'antifriz', 'cozucu', 'reaksiyon',
      ])
    ) {
      return 'science-chemistry';
    }

    // Food science
    if (
      includesAny(topicText, [
        'yiyecek', 'gida', 'yemek', 'pisirme', 'besin', 'vitamin', 'mineral',
        'kalori', 'protein', 'karbonhidrat', 'tarif', 'mutfak', 'tahil',
        'sebze', 'meyve', 'et', 'sut', 'peynir', 'ekmek', 'seker', 'tuz',
        'food', 'nutrition', 'diet',
      ])
    ) {
      return 'science-food';
    }

    // Ocean / Water
    if (
      includesAny(topicText, [
        'deniz', 'okyanus', 'su alti', 'dalga', 'akvaryum', 'mercan',
        'ocean', 'sea', 'underwater',
      ])
    ) {
      return 'science-ocean';
    }

    // Nature / Plants / Ecology
    if (
      includesAny(topicText, [
        'bitki', 'agac', 'orman', 'ekoloji', 'dogal', 'cevresel', 'iklim degisikl',
        'plant', 'tree', 'forest', 'ecology',
      ])
    ) {
      return 'science-nature';
    }

    // Earth / Geology
    if (
      includesAny(topicText, [
        'earth', 'geology', 'climate', 'volcano', 'mineral', 'glacier', 'weather',
        'atmosphere', 'tectonic',
        'dunya', 'jeoloji', 'volkan', 'deprem', 'atmosfer', 'hava',
      ])
    ) {
      return 'science-earth';
    }

    // Discovery / Experiment
    if (
      includesAny(topicText, [
        'kesis', 'bulus', 'deney', 'laboratuvar', 'nobel', 'arastirma',
        'discovery', 'experiment', 'research',
      ])
    ) {
      return 'science-discovery';
    }

    return 'science-focus';
  }

  // ── TARİH ────────────────────────────────────────────────────────────────
  if (normalizedCategory.includes('tarih')) {
    // Inventions / Discoveries
    if (
      includesAny(topicText, [
        'icat', 'bulus', 'patent', 'mucit', 'muhendis', 'telefon', 'radyo',
        'invention', 'inventor', 'patent',
      ])
    ) {
      return 'history-invention';
    }

    // Culture / Traditions / Customs
    if (
      includesAny(topicText, [
        'gelenek', 'adet', 'festival', 'toren', 'kutlama', 'bayram', 'dugun',
        'noel', 'yilbasi', 'dogum gunu', 'dans', 'muzik', 'kultur',
        'tradition', 'custom', 'festival', 'celebration',
      ])
    ) {
      return 'history-culture';
    }

    // History of Science / Scientists
    if (
      includesAny(topicText, [
        'bilim insani', 'bilim tarihi', 'kesif tarihi', 'fizikci', 'matematikci',
        'scientist', 'mathematician', 'historian',
      ])
    ) {
      return 'history-science';
    }

    // Antiquity
    if (
      includesAny(topicText, [
        'ancient', 'antik', 'rome', 'roman', 'greek', 'egypt', 'archae',
        'temple', 'ruins', 'medieval', 'dynasty', 'empire', 'cathedral',
        'roma', 'yunan', 'misir', 'orta cag', 'imparatorluk', 'saray', 'kale',
      ])
    ) {
      return 'history-antiquity';
    }

    // Conflict / War
    if (
      includesAny(topicText, [
        'war', 'battle', 'revolution', 'treaty', 'conflict', 'military',
        'savas', 'savunma', 'askeri', 'ordu', 'catisma', 'isgal',
      ])
    ) {
      return 'history-conflict';
    }

    // Trade / Economy
    if (
      includesAny(topicText, [
        'ticaret', 'ekonomi', 'para', 'alim satim', 'borsa', 'piyasa',
        'trade', 'economy', 'market', 'commerce',
      ])
    ) {
      return 'history-trade';
    }

    return 'history-archive';
  }

  // ── FELSEFE ──────────────────────────────────────────────────────────────
  if (normalizedCategory.includes('felsefe')) {
    if (
      includesAny(topicText, [
        'ethic', 'moral', 'justice', 'duty', 'responsibility', 'utilitarian', 'kant', 'rawls',
        'etik', 'ahlak', 'adalet', 'sorumluluk',
      ])
    ) {
      return 'philosophy-ethics';
    }

    if (
      includesAny(topicText, [
        'metaphys', 'ontology', 'epistem', 'mind', 'consciousness', 'identity',
        'exist', 'reality', 'knowledge', 'religion',
        'metafizik', 'ontoloji', 'epistemoloji', 'bilinc', 'varlik', 'gerceklik',
      ])
    ) {
      return 'philosophy-metaphysics';
    }

    if (
      includesAny(topicText, [
        'dil', 'anlam', 'sembol', 'iletisim', 'mantik', 'dil felsefesi',
        'language', 'meaning', 'symbol', 'logic', 'linguistics',
      ])
    ) {
      return 'philosophy-language';
    }

    return 'philosophy-marble';
  }

  // ── TEKNOLOJİ ────────────────────────────────────────────────────────────
  if (normalizedCategory.includes('teknoloji')) {
    // AI / Machine Learning
    if (
      includesAny(topicText, [
        'yapay zeka', 'makine ogrenmesi', 'derin ogrenme', 'sinir agi', 'otomasyon',
        'artificial intelligence', 'machine learning', 'deep learning', 'neural',
      ])
    ) {
      return 'technology-ai';
    }

    // Energy / Power systems
    if (
      includesAny(topicText, [
        'enerji', 'gunes enerjisi', 'nukler', 'yenilenebilir', 'pil', 'batarya',
        'energy', 'solar', 'nuclear', 'renewable', 'battery', 'power grid',
      ])
    ) {
      return 'technology-energy';
    }

    // Engineering / Hardware
    if (
      includesAny(topicText, [
        'muhendislik', 'insaat', 'kopru', 'yapi', 'tasarim mekanik', 'motor',
        'engineering', 'construction', 'bridge', 'mechanical',
      ])
    ) {
      return 'technology-engineering';
    }

    // Computing / Software
    if (
      includesAny(topicText, [
        'computer', 'software', 'program', 'compiler', 'database', 'algorithm',
        'encrypt', 'cryptograph', 'cloud', 'search', 'network', 'internet',
        'distributed', 'digital', 'signal',
        'bilgisayar', 'yazilim', 'algoritma', 'sifreleme', 'internet',
      ])
    ) {
      return 'technology-computing';
    }

    // Systems / Hardware / Machines
    if (
      includesAny(topicText, [
        'engine', 'aircraft', 'rocket', 'satellite', 'device', 'hardware',
        'vehicle', 'robot', 'machine', 'electric',
        'roket', 'uydu', 'arac', 'makine', 'cihaz',
      ])
    ) {
      return 'technology-systems';
    }

    return 'technology-grid';
  }

  // ── SAĞLIK ───────────────────────────────────────────────────────────────
  if (normalizedCategory.includes('saglik')) {
    if (
      includesAny(topicText, [
        'mental', 'stress', 'sleep', 'anxiety', 'depression', 'mood',
        'stres', 'uyku', 'anksiyete', 'depresyon', 'mutluluk', 'ruh hali',
      ])
    ) {
      return 'health-mind';
    }

    if (
      includesAny(topicText, [
        'diagnos', 'test', 'patient', 'safety', 'rehabilitation', 'medical',
        'clinic', 'treatment', 'screening', 'therapy',
        'teshis', 'hasta', 'tedavi', 'klinik', 'terapi',
      ])
    ) {
      return 'health-clinical';
    }

    if (
      includesAny(topicText, [
        'genetik', 'dna', 'gen', 'kalitim', 'kromozom',
        'genetics', 'chromosome', 'heredity',
      ])
    ) {
      return 'health-genetics';
    }

    if (
      includesAny(topicText, [
        'beslenme', 'vitamin', 'mineral', 'diyet', 'besin', 'kalori',
        'nutrition', 'diet', 'supplement', 'mineral',
      ])
    ) {
      return 'health-nutrition';
    }

    if (
      includesAny(topicText, [
        'yasam tarzi', 'uyku duzeni', 'spor', 'egzersiz', 'meditasyon', 'stres yonetimi',
        'lifestyle', 'exercise', 'meditation', 'fitness',
      ])
    ) {
      return 'health-lifestyle';
    }

    if (
      includesAny(topicText, [
        'heart', 'liver', 'kidney', 'lung', 'respiratory', 'digest', 'bone',
        'muscle', 'blood', 'brain', 'pain', 'arthritis', 'metabolism', 'nutrition',
        'kalp', 'akciger', 'bobrek', 'karaciger', 'sindirim', 'eklem',
      ])
    ) {
      return 'health-body';
    }

    return 'health-brief';
  }

  // ── EDITORIAL fallthrough ────────────────────────────────────────────────
  if (includesAny(normalizedSourceLabel, ['luzumsuz', 'ansiklopedi'])) {
    return 'editorial-trivia';
  }

  if (
    includesAny(topicText, [
      'merak', 'ilginc', 'sasirtici', 'inanilmaz', 'hayret',
      'curious', 'surprising', 'amazing', 'wonder',
    ])
  ) {
    return 'editorial-wonder';
  }

  if (
    includesAny(topicText, [
      'kultur', 'sanat', 'muzik', 'film', 'edebiyat', 'roman', 'sair',
      'culture', 'art', 'music', 'literature',
    ])
  ) {
    return 'editorial-culture';
  }

  if (
    includesAny(topicText, [
      'gunluk', 'aliskanlik', 'toplum', 'insanlar', 'neden', 'nasil',
      'daily', 'habit', 'society',
    ])
  ) {
    return 'editorial-everyday';
  }

  return 'editorial-deep';
}
