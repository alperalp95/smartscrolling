const CATEGORY_LABEL_TO_HINT = {
  '🔬 BİLİM': 'science',
  '📜 TARİH': 'history',
  '🧠 FELSEFE': 'philosophy',
  '💻 TEKNOLOJİ': 'technology',
  '🌱 SAĞLIK': 'health',
};

const STOPWORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'from',
  'that',
  'this',
  'into',
  'about',
  'bir',
  've',
  'ile',
  'icin',
  'gibi',
  'olan',
  'olarak',
  'daha',
  'gore',
  'veya',
  'gibi',
]);

const TOKEN_ALIASES = {
  aristotle: ['aristoteles'],
  artificial: ['yapay'],
  battle: ['savasi', 'muharebesi'],
  byzantine: ['bizans'],
  cardiac: ['kalp', 'kardiyak'],
  cardiovascular: ['kardiyovaskuler', 'kalp', 'damar'],
  cloud: ['bulut'],
  compiler: ['derleyici'],
  compression: ['sikistirma'],
  computing: ['hesaplama', 'bilisim'],
  coronary: ['koroner'],
  cryptography: ['kriptografi', 'sifreleme'],
  database: ['veritabani'],
  disease: ['hastalik'],
  diseases: ['hastalik', 'hastaliklar'],
  distributed: ['dagitik'],
  empire: ['imparatorlugu', 'imparatorluk'],
  epistemology: ['epistemoloji', 'bilgi', 'bilginin', 'bilme'],
  ethics: ['etik'],
  evolution: ['evrim'],
  exercise: ['egzersiz', 'fiziksel aktivite'],
  fitness: ['fiziksel uygunluk', 'form'],
  heart: ['kalp'],
  existentialism: ['varolusculuk'],
  industrial: ['endustri', 'sanayi'],
  intelligence: ['zeka'],
  knowledge: ['bilgi', 'bilme'],
  method: ['yontem'],
  mobility: ['hareketlilik', 'mobilite'],
  obesity: ['obezite', 'fazla kilo', 'kilolu'],
  open: ['acik'],
  artery: ['arter', 'damar'],
  patient: ['hasta'],
  philosophy: ['felsefe'],
  public: ['halk', 'kamusal'],
  reason: ['akil', 'gerekce'],
  rehabilitation: ['rehabilitasyon'],
  revolution: ['devrim'],
  search: ['arama'],
  semiconductor: ['semikonduktor'],
  sleep: ['uyku'],
  software: ['yazilim'],
  socratic: ['sokratik'],
  stoicism: ['stoacilik'],
  source: ['kaynak'],
  theory: ['kuram', 'teori'],
  health: ['saglik'],
  pressure: ['basinc', 'tansiyon'],
  safety: ['guvenlik'],
  stress: ['stres'],
  vaccination: ['asilama', 'vaksinasyon'],
  vaccine: ['asi', 'vaksin'],
  vaccines: ['asi', 'asilar', 'vaksin', 'vaksinler'],
  weight: ['kilo', 'agirlik'],
  immunity: ['bagisiklik', 'bagisiklik sistemi'],
  immun: ['imun'],
  immune: ['bagisiklik', 'bagisiklik sistemi', 'imun', 'imun sistem'],
  hypertension: ['hipertansiyon', 'yuksek tansiyon'],
  system: ['sistem'],
  protection: ['koruma', 'korunma'],
  prevent: ['onleme', 'engelleme'],
};

function normalizeText(value) {
  return (value ?? '')
    .toString()
    .normalize('NFD')
    .replaceAll(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

function extractKeywords(value) {
  return normalizeText(value)
    .replaceAll(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 4 && !STOPWORDS.has(token));
}

function expandKeywordVariants(tokens) {
  const variants = new Set();

  for (const token of tokens) {
    variants.add(token);

    for (const alias of TOKEN_ALIASES[token] ?? []) {
      variants.add(alias);
    }
  }

  return [...variants];
}

function getCategoryHintFromLabel(label) {
  return CATEGORY_LABEL_TO_HINT[label] ?? null;
}

export function evaluateFactConsistency(fact) {
  const sourceTitle = (fact._source_title ?? '').trim();
  const sourceExcerpt = (fact._source_excerpt ?? '').trim();
  const categoryHint = (fact._category_hint ?? '').trim().toLowerCase();
  const normalizedFactCategory = getCategoryHintFromLabel(fact.category);
  const sourceKind = (fact._source_kind ?? '').trim();
  const isPdfCurated = sourceKind === 'pdf_curated';

  if (
    !isPdfCurated &&
    categoryHint &&
    normalizedFactCategory &&
    categoryHint !== normalizedFactCategory
  ) {
    return { ok: false, reason: 'category_mismatch' };
  }

  if (!sourceTitle) {
    return { ok: true, reason: 'approved' };
  }

  const sourceCorpus = `${sourceTitle} ${sourceExcerpt}`.trim();
  const sourceKeywords = expandKeywordVariants([...new Set(extractKeywords(sourceCorpus))]);

  if (sourceKeywords.length < 2) {
    return { ok: true, reason: 'approved' };
  }

  const outputCorpus = `${fact.title ?? ''} ${fact.content ?? ''}`;
  const normalizedOutput = normalizeText(outputCorpus);
  const overlap = sourceKeywords.filter((token) => normalizedOutput.includes(token));

  if (!isPdfCurated && overlap.length === 0) {
    return { ok: false, reason: 'source_topic_drift' };
  }

  return { ok: true, reason: 'approved' };
}
