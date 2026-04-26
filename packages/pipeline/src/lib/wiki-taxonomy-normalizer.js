const THEME_SIGNAL_PROFILES = {
  science: {
    title: ['dna', 'kuantum', 'quantum', 'fotosentez', 'kara delik', 'black hole', 'yanardag', 'yanardağ', 'volkan', 'astronomi', 'evrim', 'fizik', 'biyoloji', 'kimya', 'bitki', 'genus', 'species', 'tür', 'tur', 'cins'],
    categories: ['fizik', 'physics', 'biyoloji', 'biology', 'astronomi', 'space', 'genetik', 'yanardag', 'yanardağ', 'volcano', 'kimya', 'chemistry', 'doğa', 'doga', 'nature', 'bitki', 'plant', 'botanik', 'botany', 'familya', 'genus', 'species', 'takson', 'galaksi', 'galaxy'],
    description: ['fizik', 'biyolog', 'astronom', 'kimyaci', 'kimyacı', 'bitki cinsi', 'plant genus', 'bitki', 'cins', 'galaksi'],
    summary: ['fizik', 'biyoloji', 'astronomi', 'genetik', 'doğal süreç', 'dogal surec', 'molekül', 'molekul', 'organizm', 'gezegen', 'planet', 'evren', 'universe', 'kimyasal', 'familyasına bağlı', 'familyasina bagli', 'bitki cinsi', 'plant genus', 'tür', 'tur', 'species', 'galaksi'],
  },
  history: {
    title: ['türkiye', 'turkiye', 'osmanlı', 'osmanli', 'ottoman', 'imparatorluk', 'empire', 'cumhuriyet', 'republic', 'hanedan', 'dynasty', 'medeniyet', 'civilization', 'savaş', 'savas', 'war', 'devrim', 'revolution', 'rönesans', 'ronesans', 'antik', 'ancient', 'orta çağ', 'orta cag', 'medieval'],
    categories: ['tarih', 'history', 'ülkeler', 'ulkeler', 'countries', 'devletler', 'states', 'imparatorluk', 'empire', 'medeniyet', 'civilization', 'hanedan', 'dynasty', 'savaş', 'savas', 'war', 'sanat tarihi', 'art history', 'tarihî', 'tarihi', 'historical', 'arkeolojik'],
    description: ['ülke', 'ulke', 'country', 'imparatorluk', 'empire', 'devlet', 'state', 'tarihçi', 'tarihci', 'historian', 'antik', 'arkeolojik'],
    summary: ['ülkedir', 'ulkedir', 'country', 'devlet', 'state', 'imparatorluk', 'empire', 'tarihi', 'historical', 'kuruldu', 'founded', 'savaş', 'savas', 'war', 'hanedan', 'dynasty', 'antik', 'arkeolojik'],
  },
  philosophy: {
    title: ['felsefe', 'philosophy', 'etik', 'ethics', 'mantık', 'mantik', 'logic', 'metafizik', 'bilinç', 'bilinc', 'consciousness', 'adalet', 'justice', 'sokrates', 'platon', 'aristoteles'],
    categories: ['felsefe', 'philosophy', 'etik', 'ethics', 'mantık', 'mantik', 'logic', 'filozof', 'philosopher', 'bilinç', 'bilinc', 'metafizik', 'epistemoloji', 'epistemology'],
    description: ['filozof', 'philosopher', 'felsefeci', 'ethicist'],
    summary: ['felsefe', 'philosophy', 'etik', 'ethics', 'bilginin doğası', 'bilginin dogasi', 'ahlak', 'morality', 'varlık', 'varlik', 'being', 'düşünce', 'dusunce', 'thought'],
  },
  technology: {
    title: ['yapay zeka', 'yapay zekâ', 'artificial intelligence', 'algoritma', 'algorithm', 'bilgisayar', 'computer', 'internet', 'veritabanı', 'veritabani', 'database', 'yazılım', 'yazilim', 'software', 'robot', 'mikroişlemci', 'mikroislemci'],
    categories: ['teknoloji', 'technology', 'bilgisayar', 'computer', 'yapay zeka', 'yapay zekâ', 'artificial intelligence', 'yazılım', 'yazilim', 'software', 'internet', 'algoritma', 'algorithm', 'robotik'],
    description: ['bilgisayar bilim', 'computer science', 'teknoloji', 'technology', 'mühendis', 'muhendis', 'engineer'],
    summary: ['bilgisayar bilim', 'computer science', 'makine öğrenmesi', 'makine ogrenmesi', 'machine learning', 'algoritma', 'algorithm', 'yazılım', 'yazilim', 'software', 'veri', 'data', 'otomasyon'],
  },
  health: {
    title: ['uyku', 'sleep', 'bağışıklık', 'bagisiklik', 'immune', 'stres', 'stress', 'metabolizma', 'kolesterol', 'iltihap', 'inflammation', 'aşı', 'asi', 'vaccine', 'mikrobiyom'],
    categories: ['sağlık', 'saglik', 'health', 'tıp', 'tip', 'medicine', 'hastalık', 'hastalik', 'disease', 'bağışıklık', 'bagisiklik', 'immune', 'uyku', 'sleep', 'beslenme', 'nutrition'],
    description: ['doktor', 'doctor', 'hekim', 'physician', 'tıp', 'tip', 'medicine', 'sağlık', 'saglik', 'health'],
    summary: ['sağlık', 'saglik', 'health', 'hastalık', 'hastalik', 'disease', 'tedavi', 'treatment', 'bağışıklık', 'bagisiklik', 'immune', 'vücut', 'vucut', 'body', 'semptom'],
  },
};

function normalizeText(value) {
  return String(value ?? '')
    .toLocaleLowerCase('tr-TR')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function scoreSignalList(text, signals, weight, prefix) {
  const hits = [];
  let score = 0;

  for (const signal of signals) {
    const normalizedSignal = normalizeText(signal);

    if (normalizedSignal && text.includes(normalizedSignal)) {
      score += weight;
      hits.push(`${prefix}:${normalizedSignal}`);
    }
  }

  return { score, hits };
}

function scoreTheme({ canonicalTitle, summary, categories, description }, theme) {
  const profile = THEME_SIGNAL_PROFILES[theme];
  const title = normalizeText(canonicalTitle);
  const normalizedSummary = normalizeText(summary);
  const normalizedDescription = normalizeText(description);
  const normalizedCategories = categories.map((value) => normalizeText(value)).join(' | ');

  const titleScore = scoreSignalList(title, profile.title, 4, `${theme}:title`);
  const categoryScore = scoreSignalList(normalizedCategories, profile.categories, 5, `${theme}:category`);
  const descriptionScore = scoreSignalList(normalizedDescription, profile.description, 3, `${theme}:description`);
  const summaryScore = scoreSignalList(normalizedSummary, profile.summary, 2, `${theme}:summary`);

  return {
    theme,
    score: titleScore.score + categoryScore.score + descriptionScore.score + summaryScore.score,
    signals: [
      ...titleScore.hits,
      ...categoryScore.hits,
      ...descriptionScore.hits,
      ...summaryScore.hits,
    ],
  };
}

export function normalizeWikipediaEnrichmentToTaxonomy({ entity, enrichment }) {
  const canonicalTitle = entity?.canonicalTitle ?? '';
  const summary = enrichment?.summary ?? '';
  const categories = Array.isArray(enrichment?.categories) ? enrichment.categories : [];
  const description = enrichment?.infoboxLikeFields?.description ?? '';
  const scoredThemes = Object.keys(THEME_SIGNAL_PROFILES)
    .map((theme) => scoreTheme({ canonicalTitle, summary, categories, description }, theme))
    .sort((left, right) => right.score - left.score);
  const primary = scoredThemes[0] ?? { theme: null, score: 0, signals: [] };
  const secondary = scoredThemes[1] ?? { theme: null, score: 0, signals: [] };

  if (!primary.theme || primary.score < 4) {
    return {
      theme: null,
      category: null,
      confidence: 0,
      signals: ['mcp:unknown'],
      source: 'mcp',
    };
  }

  const separationBonus = Math.min(Math.max(primary.score - secondary.score, 0), 6) / 20;
  const entityConfidence = Math.min(entity?.confidence ?? 0, 1) / 4;
  const confidence = Math.min(0.45 + primary.score / 20 + separationBonus + entityConfidence, 0.95);

  return {
    theme: primary.theme,
    category: primary.theme,
    confidence,
    signals: ['mcp:canonical_title', 'mcp:summary', ...primary.signals].slice(0, 12),
    source: 'mcp',
  };
}
