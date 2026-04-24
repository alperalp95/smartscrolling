// src/sources/wikipedia.js
// Wikipedia summary endpoint'inden kalite filtreli makale ozeti ceker.

const LOW_VALUE_TITLE_PATTERNS = [
  /\binstitutions?\b/i,
  /\bunion\b/i,
  /\borganization\b/i,
  /\bassociation\b/i,
  /\bcommittee\b/i,
  /\bcouncil\b/i,
  /\bfederation\b/i,
  /\bhigh school\b/i,
  /\bcounty\b/i,
  /\bdistrict\b/i,
  /\broad\b/i,
  /\bstation\b/i,
  /\bvillage\b/i,
  /\btown\b/i,
  /\bmunicipality\b/i,
  /\belectoral district\b/i,
  /\balbum\b/i,
  /\bsong\b/i,
  /\bfootball\b/i,
  /\btennis\b/i,
  /\bcoach\b/i,
  /\bplayer\b/i,
  /\bactor\b/i,
  /\bactress\b/i,
  /\bbiography\b/i,
  /\btasting room\b/i,
  /\bköy\b/i,
  /\bkoy\b/i,
  /\bilçe\b/i,
  /\bilce\b/i,
  /\bbelediye\b/i,
  /\bbelediyesi\b/i,
  /\bbölgesi\b/i,
  /\bbolgesi\b/i,
  /\byolu\b/i,
  /\bistasyonu\b/i,
  /\blise(si)?\b/i,
  /\btenisçi\b/i,
  /\btenisci\b/i,
  /\bfutbolcu\b/i,
  /\boyuncu\b/i,
  /\bşarkıcı\b/i,
  /\bsarkici\b/i,
  /\bpolitikacı\b/i,
  /\bpolitikaci\b/i,
  /\bsenatör\b/i,
  /\bsenator\b/i,
  /\bmilletvekili\b/i,
];

const LOW_VALUE_EXTRACT_PATTERNS = [
  /\bnational service organization\b/i,
  /\bmember organization\b/i,
  /\barmed forces\b/i,
  /\btasting room\b/i,
  /\bshopping mall\b/i,
  /\bformer professional\b/i,
  /\bis a village\b/i,
  /\bis a town\b/i,
  /\bisland in\b/i,
  /\bmunicipality in\b/i,
  /\brailway station\b/i,
  /\bstate road\b/i,
  /\bis a municipality\b/i,
  /\bis a district\b/i,
  /\bis a singer\b/i,
  /\bis an actor\b/i,
  /\bis a footballer\b/i,
  /\bis a tennis player\b/i,
  /\bis a librarian\b/i,
  /\bis an educator\b/i,
  /\bis a politician\b/i,
  /\bis an american\b/i,
  /\bis a british\b/i,
  /\bis a canadian\b/i,
  /\bis a nigerian\b/i,
  /\bbir köydür\b/i,
  /\bbir koydur\b/i,
  /\bbir ilçedir\b/i,
  /\bbir ilcedir\b/i,
  /\bbir belediyedir\b/i,
  /\bbir bölgesidir\b/i,
  /\bbir bolgesidir\b/i,
  /\bbir istasyondur\b/i,
  /\bbir yoldur\b/i,
  /\bbir şarkıcıdır\b/i,
  /\bbir sarkicidir\b/i,
  /\bbir oyuncudur\b/i,
  /\bbir tenisçidir\b/i,
  /\bbir teniscidir\b/i,
  /\bbir futbolcudur\b/i,
  /\bbir politikacıdır\b/i,
  /\bbir politikacidir\b/i,
];

const HIGH_VALUE_OVERRIDE_PATTERNS = [
  /\bunesco\b/i,
  /\bworld heritage\b/i,
  /\barkeolog/i,
  /\barchaeolog/i,
  /\boldest\b/i,
  /\bfirst\b/i,
  /\bearliest\b/i,
  /\bextinct\b/i,
  /\bfossil\b/i,
  /\bdiscovery\b/i,
  /\binvention\b/i,
  /\btheory\b/i,
  /\bphilosoph/i,
  /\bempire\b/i,
  /\bdynasty\b/i,
  /\brevolution\b/i,
  /\broman\b/i,
  /\bancient\b/i,
  /\bmedieval\b/i,
  /\bvolcan/i,
  /\basteroid\b/i,
  /\borbit\b/i,
  /\bkosmos\b/i,
  /\bkozmik\b/i,
  /\bunesco\b/i,
  /\ben eski\b/i,
  /\bilk\b/i,
  /\bkeşif\b/i,
  /\bkesif\b/i,
  /\bbuluş\b/i,
  /\bbulus\b/i,
  /\bteori\b/i,
  /\bfelsef/i,
  /\bimparatorluk\b/i,
  /\bhanedan\b/i,
  /\bdevrim\b/i,
  /\bantik\b/i,
  /\bortaçağ\b/i,
  /\bortacag\b/i,
  /\barkeolojik\b/i,
];

const CATEGORY_THEME_POOLS = {
  science: [
    'black hole',
    'big bang',
    'quantum',
    'dna',
    'fossil',
    'extinction',
    'volcano',
    'asteroid',
    'orbit',
    'neuron',
  ],
  history: [
    'empire',
    'dynasty',
    'revolution',
    'ancient',
    'medieval',
    'bronze age',
    'silk road',
    'cold war',
    'printing press',
    'magna carta',
  ],
  philosophy: [
    'stoicism',
    'existentialism',
    'virtue',
    'free will',
    'reason',
    'justice',
    'mind',
    'knowledge',
    'consciousness',
    'metaphysics',
  ],
  technology: [
    'internet',
    'algorithm',
    'semiconductor',
    'robotics',
    'microprocessor',
    'encryption',
    'database',
    'compiler',
    'search engine',
    'turing machine',
  ],
  health: [
    'immune system',
    'vaccination',
    'sleep',
    'microbiome',
    'cholesterol',
    'stress',
    'metabolism',
    'pain',
    'inflammation',
    'cardiovascular',
  ],
};

const CATEGORY_SEED_TOPICS = {
  science: [
    'Black hole',
    'Big Bang',
    'Quantum mechanics',
    'Theory of relativity',
    'Natural selection',
    'DNA',
    'Fossil',
    'Mass extinction',
    'Plate tectonics',
    'Volcano',
    'Asteroid',
    'Periodic table',
    'Neuron',
    'Consciousness',
    'Ice age',
    'Supernova',
    'Tyrannosaurus',
  ],
  history: [
    'Roman Empire',
    'Mongol Empire',
    'Industrial Revolution',
    'French Revolution',
    'Cold War',
    'Bronze Age',
    'Silk Road',
    'Printing press',
    'Battle of Thermopylae',
    'Magna Carta',
    'Fall of Constantinople',
    'Renaissance',
    'Byzantine Empire',
    'Ottoman Empire',
    'Age of Discovery',
    'Han dynasty',
    'Rosetta Stone',
    'Pompeii',
  ],
  philosophy: [
    'Stoicism',
    'Existentialism',
    'Free will',
    'Virtue ethics',
    'Epistemology',
    'Philosophy of mind',
    'Consciousness',
    'Justice',
    'Metaphysics',
    'Utilitarianism',
    'Socratic method',
    'Kantian ethics',
    'John Rawls',
    'Plato',
    'Aristotle',
    'Dukkha',
    'Rationalism',
    'Empiricism',
    'Ship of Theseus',
  ],
  technology: [
    'Internet',
    'Semiconductor',
    'Algorithm',
    'Turing machine',
    'Transistor',
    'Microprocessor',
    'Robotics',
    'Integrated circuit',
    'Artificial intelligence',
    'Encryption',
    'Database',
    'Information theory',
    'Distributed computing',
    'Search engine',
    'Open-source software',
    'Compiler',
    'Cryptography',
    'Steam engine',
    'Wireless telegraphy',
    'Apollo Guidance Computer',
    'ARPANET',
  ],
  health: [
    'Immune system',
    'Vaccination',
    'Sleep',
    'Microbiome',
    'Cardiovascular system',
    'Antibiotic',
    'Mental health',
    'Hypertension',
    'Cholesterol',
    'Diabetes',
    'Stress',
    'Exercise physiology',
    'Metabolism',
    'Inflammation',
    'Aging',
    'Pain',
    'Heart attack',
    'Stroke',
    'Placebo',
    'Circadian rhythm',
    'Vitamin D',
    'Fever',
    'Microbe',
    'Nutrition',
    'Gut–brain axis',
  ],
};

const CATEGORY_SEQUENCE = ['science', 'history', 'philosophy', 'technology', 'health'];
const CATEGORY_KEYWORDS = {
  science: [
    'astronomy',
    'physics',
    'chemistry',
    'biology',
    'genetics',
    'evolution',
    'mathematics',
    'neuroscience',
    'geology',
    'scientific',
    'species',
    'fossil',
    'cambrian',
    'organism',
    'research',
    'theory',
    'astronomi',
    'fizik',
    'kimya',
    'biyoloji',
    'genetik',
    'evrim',
    'matematik',
    'jeoloji',
    'fosil',
    'teori',
    'araştırma',
    'arastirma',
  ],
  history: [
    'history',
    'historical',
    'empire',
    'ancient',
    'medieval',
    'revolution',
    'war',
    'battle',
    'dynasty',
    'civilization',
    'reform',
    'kingdom',
    'republic',
    'century',
    'tarih',
    'tarihi',
    'imparatorluk',
    'antik',
    'ortaçağ',
    'ortacag',
    'savaş',
    'savas',
    'hanedan',
    'medeniyet',
    'krallık',
    'krallik',
    'cumhuriyet',
    'yüzyıl',
    'yuzyil',
  ],
  philosophy: [
    'philosophy',
    'philosophical',
    'stoicism',
    'ethics',
    'logic',
    'metaphysics',
    'epistemology',
    'virtue',
    'justice',
    'reason',
    'buddhism',
    'existentialism',
    'mind',
    'knowledge',
    'felsefe',
    'etik',
    'mantık',
    'mantik',
    'metafizik',
    'epistemoloji',
    'adalet',
    'erdem',
    'akıl',
    'akil',
    'zihin',
    'bilgi',
  ],
  technology: [
    'technology',
    'computer',
    'software',
    'internet',
    'engineering',
    'algorithm',
    'machine',
    'semiconductor',
    'robotics',
    'device',
    'network',
    'processor',
    'digital',
    'electronic',
    'teknoloji',
    'bilgisayar',
    'yazılım',
    'yazilim',
    'mühendislik',
    'muhendislik',
    'algoritma',
    'makine',
    'yarıiletken',
    'yariiletken',
    'robotik',
    'işlemci',
    'islemci',
    'dijital',
  ],
  health: [
    'health',
    'medicine',
    'medical',
    'disease',
    'treatment',
    'brain',
    'psychology',
    'anatomy',
    'physiology',
    'mental health',
    'nutrition',
    'therapy',
    'clinical',
    'public health',
    'sağlık',
    'saglik',
    'tıp',
    'tip',
    'tıbbi',
    'tibbi',
    'hastalık',
    'hastalik',
    'tedavi',
    'beyin',
    'psikoloji',
    'anatomi',
    'fizyoloji',
    'beslenme',
    'terapi',
    'klinik',
  ],
};

const SOURCE_EDITORIAL_WEIGHTS = {
  science: 42,
  history: 44,
  philosophy: 41,
  technology: 40,
  health: 38,
};

/**
 * Wikipedia'nin random summary havuzundan filtrelenmis makaleler ceker.
 * @param {string} lang
 * @param {number} count
 * @returns {Promise<Array<{title, extract, url, imageUrl, category}>>}
 */
export async function fetchWikipediaArticles(lang = 'en', count = 20) {
  const seededArticles = await fetchSeededWikipediaArticles(lang, count);

  if (seededArticles.length >= count) {
    return seededArticles.slice(0, count);
  }

  const fallbackArticles = await fetchWikipediaArticlesInternal(
    lang,
    count - seededArticles.length,
    false,
    new Set(seededArticles.map((article) => article.url)),
  );

  return [...seededArticles, ...fallbackArticles].slice(0, count);
}

async function fetchSeededWikipediaArticles(lang, count) {
  const articles = [];
  const seenUrls = new Set();
  const seedQueue = buildSeedQueue(count * 3);

  for (const seed of seedQueue) {
    if (articles.length >= count) {
      break;
    }

    const article = await fetchWikipediaArticleByTitle(lang, seed.title, seed.category, seenUrls);

    if (!article) {
      continue;
    }

    articles.push(article);
  }

  return articles;
}

async function fetchWikipediaArticlesInternal(
  lang,
  count,
  relaxedCategoryTarget,
  inheritedSeenUrls,
) {
  const acceptedArticles = [];
  const candidatePool = [];
  const seenUrls = new Set(inheritedSeenUrls ?? []);
  let attempts = 0;
  const maxAttempts = count * 40;

  while (candidatePool.length < count * 4 && attempts < maxAttempts) {
    attempts += 1;
    const targetCategory = CATEGORY_SEQUENCE[attempts % CATEGORY_SEQUENCE.length];
    const isRelaxedPass = attempts > maxAttempts / 2;

    try {
      const url = `https://${lang}.wikipedia.org/api/rest_v1/page/random/summary`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'SmartScrolling-Pipeline/1.0 (contact@smartscrolling.app)' },
      });

      if (!res.ok) {
        continue;
      }

      const data = await res.json();
      const article = await parseWikipediaSummary(data, lang, seenUrls, targetCategory, {
        relaxedCategoryTarget,
        isRelaxedPass,
      });

      if (!article) {
        continue;
      }

      candidatePool.push(article);

      await sleep(300);
    } catch (err) {
      console.error('[Wikipedia] Fetch hatasi:', err.message);
    }
  }

  if (candidatePool.length === 0 && !relaxedCategoryTarget) {
    return fetchWikipediaArticlesInternal(lang, count, true, seenUrls);
  }

  candidatePool.sort((left, right) => right.discoveryScore - left.discoveryScore);

  const perCategoryLimit = Math.max(2, Math.ceil(count / CATEGORY_SEQUENCE.length) + 1);
  const categoryCounts = Object.fromEntries(CATEGORY_SEQUENCE.map((category) => [category, 0]));

  for (const article of candidatePool) {
    if (acceptedArticles.length >= count) {
      break;
    }

    if ((categoryCounts[article.category] ?? 0) >= perCategoryLimit) {
      continue;
    }

    acceptedArticles.push(article);
    categoryCounts[article.category] = (categoryCounts[article.category] ?? 0) + 1;
  }

  for (const article of candidatePool) {
    if (acceptedArticles.length >= count) {
      break;
    }

    if (acceptedArticles.some((accepted) => accepted.url === article.url)) {
      continue;
    }

    acceptedArticles.push(article);
  }

  return acceptedArticles.slice(0, count);
}

async function fetchWikipediaArticleByTitle(lang, title, targetCategory, seenUrls) {
  try {
    const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'SmartScrolling-Pipeline/1.0 (contact@smartscrolling.app)' },
    });

    if (!res.ok) {
      return null;
    }

    const data = await res.json();
    const article = await parseWikipediaSummary(data, lang, seenUrls, targetCategory, {
      relaxedCategoryTarget: false,
      isRelaxedPass: false,
    });

    if (!article) {
      return null;
    }

    await sleep(200);
    return article;
  } catch (err) {
    console.error('[Wikipedia] Seed fetch hatasi:', err.message);
    return null;
  }
}

async function parseWikipediaSummary(
  data,
  lang,
  seenUrls,
  targetCategory,
  { relaxedCategoryTarget, isRelaxedPass },
) {
  const preferredData = await resolvePreferredWikipediaSummary(data, lang);
  const pageUrl =
    preferredData.content_urls?.desktop?.page ??
    `https://${preferredData._preferred_lang ?? lang}.wikipedia.org/wiki/${preferredData.title}`;

  if (seenUrls.has(pageUrl)) {
    return null;
  }

  if (preferredData.type && preferredData.type !== 'standard') {
    return null;
  }

  if (!preferredData.extract || preferredData.extract.length < 220) {
    return null;
  }

  const category = guessCategory(
    `${preferredData.title ?? ''} ${preferredData.extract ?? ''} ${data.title ?? ''} ${data.extract ?? ''}`,
  );

  if (!category) {
    return null;
  }

  if (!relaxedCategoryTarget && category !== targetCategory) {
    return null;
  }

  if (isLowValueWikipediaArticle(preferredData.title, preferredData.extract)) {
    return null;
  }

  const hasThemeMatch = matchesThemePool(
    `${preferredData.title ?? ''} ${data.title ?? ''}`,
    `${preferredData.extract ?? ''} ${data.extract ?? ''}`,
    category,
  );
  const categoryConfidence = estimateCategoryConfidence(
    `${preferredData.title ?? ''} ${preferredData.extract ?? ''}`,
    category,
  );
  const discoveryScore = scoreWikipediaCandidate({
    title: preferredData.title,
    extract: preferredData.extract,
    category,
    targetCategory,
    hasThemeMatch,
    relaxedCategoryTarget,
    isRelaxedPass,
    categoryConfidence,
  });

  const minimumScore = isRelaxedPass ? 36 : 44;

  if (discoveryScore < minimumScore) {
    return null;
  }

  const imageUrl =
    preferredData.originalimage?.source ??
    preferredData.thumbnail?.source ??
    buildUnsplashUrl(preferredData.title, category);

  seenUrls.add(pageUrl);
  return {
    title: preferredData.title,
    extract: preferredData.extract,
    url: pageUrl,
    category,
    imageUrl,
    discoveryScore,
  };
}

async function resolvePreferredWikipediaSummary(data, lang) {
  if (lang !== 'en' || !data?.title) {
    return { ...data, _preferred_lang: lang };
  }

  const turkishTitle = await fetchWikipediaLangTitle(data.title, 'tr');

  if (!turkishTitle) {
    return { ...data, _preferred_lang: lang };
  }

  const turkishSummary = await fetchWikipediaSummaryByTitle('tr', turkishTitle);

  if (!turkishSummary?.extract || turkishSummary.extract.length < 180) {
    return { ...data, _preferred_lang: lang };
  }

  return { ...turkishSummary, _preferred_lang: 'tr' };
}

async function fetchWikipediaLangTitle(sourceTitle, targetLang) {
  try {
    const url =
      `https://en.wikipedia.org/w/api.php?action=query&prop=langlinks&titles=${encodeURIComponent(sourceTitle)}` +
      `&lllang=${targetLang}&format=json&redirects=1`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'SmartScrolling-Pipeline/1.0 (contact@smartscrolling.app)' },
    });

    if (!res.ok) {
      return null;
    }

    const data = await res.json();
    const page = Object.values(data?.query?.pages ?? {})[0];
    const langLink = page?.langlinks?.[0];
    return typeof langLink?.['*'] === 'string' ? langLink['*'] : null;
  } catch (err) {
    console.error('[Wikipedia] Langlink fetch hatasi:', err.message);
    return null;
  }
}

async function fetchWikipediaSummaryByTitle(lang, title) {
  try {
    const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'SmartScrolling-Pipeline/1.0 (contact@smartscrolling.app)' },
    });

    if (!res.ok) {
      return null;
    }

    return await res.json();
  } catch (err) {
    console.error('[Wikipedia] Localized summary fetch hatasi:', err.message);
    return null;
  }
}

function guessCategory(text) {
  const lower = text.toLowerCase();
  const scores = Object.fromEntries(CATEGORY_SEQUENCE.map((category) => [category, 0]));

  for (const category of CATEGORY_SEQUENCE) {
    for (const keyword of CATEGORY_KEYWORDS[category] ?? []) {
      if (lower.includes(keyword)) {
        scores[category] += keyword.includes(' ') ? 2 : 1;
      }
    }
  }

  const ranked = [...CATEGORY_SEQUENCE].sort((left, right) => scores[right] - scores[left]);
  const topCategory = ranked[0];
  const topScore = scores[topCategory];
  const secondScore = scores[ranked[1]];

  if (topScore < 2) {
    return null;
  }

  if (topScore === secondScore) {
    return null;
  }

  return topCategory;
}

function estimateCategoryConfidence(text, category) {
  const lower = text.toLowerCase();
  const matches = (CATEGORY_KEYWORDS[category] ?? []).reduce(
    (score, keyword) => score + (lower.includes(keyword) ? (keyword.includes(' ') ? 2 : 1) : 0),
    0,
  );

  return Math.min(matches, 10);
}

function isLowValueWikipediaArticle(title, extract) {
  const normalizedTitle = (title ?? '').trim();
  const normalizedExtract = (extract ?? '').trim();

  if (
    HIGH_VALUE_OVERRIDE_PATTERNS.some(
      (pattern) => pattern.test(normalizedTitle) || pattern.test(normalizedExtract),
    )
  ) {
    return false;
  }

  return (
    isLikelyLowValueBiography(normalizedTitle, normalizedExtract) ||
    LOW_VALUE_TITLE_PATTERNS.some((pattern) => pattern.test(normalizedTitle)) ||
    LOW_VALUE_EXTRACT_PATTERNS.some((pattern) => pattern.test(normalizedExtract))
  );
}

function isLikelyLowValueBiography(title, extract) {
  const normalizedTitle = (title ?? '').trim();
  const normalizedExtract = (extract ?? '').trim().toLowerCase();
  const titleWords = normalizedTitle.split(/\s+/).filter(Boolean);
  const likelyPersonName =
    titleWords.length >= 2 &&
    titleWords.length <= 4 &&
    titleWords.every((word) => /^[A-Z][a-z.'-]+$/.test(word));

  if (!likelyPersonName) {
    return false;
  }

  const lowValueBiographySignals = [
    'is a librarian',
    'is an educator',
    'is a politician',
    'is a writer',
    'is an artist',
    'is a singer',
    'is an actor',
    'is an actress',
    'is a footballer',
    'is a tennis player',
    'served as',
    'was born',
  ];

  const highValueBiographySignals = [
    'known for',
    'best known for',
    'discovered',
    'developed',
    'invented',
    'formulated',
    'proposed',
    'pioneered',
    'theory',
    'law of',
    'equation',
    'species',
    'genus',
    'philosopher',
    'philosophical',
    'mathematician and physicist',
    'scientist',
    'research',
    'field theory',
    'electrodynamics',
    'electromagnetic',
  ];

  const careerSummarySignals = [
    'professor',
    'university',
    'chair of',
    'visiting professor',
    'director of',
    'senior fellow',
    'award for',
    'teaching excellence',
    'served as',
    'received the',
    'holds the chair',
    'research is on',
    'his research is on',
    'her research is on',
  ];

  if (highValueBiographySignals.some((signal) => normalizedExtract.includes(signal))) {
    return false;
  }

  const hasCareerSummarySignal = careerSummarySignals.some((signal) =>
    normalizedExtract.includes(signal),
  );

  if (hasCareerSummarySignal) {
    return true;
  }

  return lowValueBiographySignals.some((signal) => normalizedExtract.includes(signal));
}

function matchesThemePool(title, extract, category) {
  const themePool = CATEGORY_THEME_POOLS[category];

  if (!themePool?.length) {
    return true;
  }

  const normalized = `${title ?? ''} ${extract ?? ''}`.toLowerCase();
  return themePool.some((theme) => normalized.includes(theme));
}

function scoreWikipediaCandidate({
  title,
  extract,
  category,
  targetCategory,
  hasThemeMatch,
  relaxedCategoryTarget,
  isRelaxedPass,
  categoryConfidence,
}) {
  const normalizedTitle = (title ?? '').trim();
  const normalizedExtract = (extract ?? '').trim();
  let score = SOURCE_EDITORIAL_WEIGHTS[category] ?? 40;

  if (category === targetCategory) {
    score += 8;
  } else if (relaxedCategoryTarget) {
    score += 2;
  } else {
    score -= 6;
  }

  score += Math.min(Math.floor(normalizedExtract.length / 70), 8);
  score += Math.min(categoryConfidence, 8);

  if (hasThemeMatch) {
    score += 10;
  }

  if (
    HIGH_VALUE_OVERRIDE_PATTERNS.some(
      (pattern) => pattern.test(normalizedTitle) || pattern.test(normalizedExtract),
    )
  ) {
    score += 12;
  }

  if (
    /\b(first|oldest|earliest|discovery|invention|theory|revolution|empire|dynasty)\b/i.test(
      `${normalizedTitle} ${normalizedExtract}`,
    )
  ) {
    score += 6;
  }

  if (/(^|\s)(is|was|bir)\s/.test(normalizedExtract) && normalizedExtract.length < 320) {
    score -= 4;
  }

  if (/(system|process|concept|field|movement|history of|importance of)/i.test(normalizedTitle)) {
    score -= 5;
  }

  if (isRelaxedPass) {
    score -= 3;
  }

  return score;
}

function buildSeedQueue(limit) {
  const shuffledByCategory = Object.fromEntries(
    CATEGORY_SEQUENCE.map((category) => [
      category,
      shuffleArray(CATEGORY_SEED_TOPICS[category] ?? []),
    ]),
  );
  const pointers = Object.fromEntries(CATEGORY_SEQUENCE.map((category) => [category, 0]));
  const queue = [];

  while (queue.length < limit) {
    let addedInRound = false;

    for (const category of CATEGORY_SEQUENCE) {
      const pool = shuffledByCategory[category];
      const index = pointers[category];

      if (!pool?.length || index >= pool.length) {
        continue;
      }

      queue.push({ category, title: pool[index] });
      pointers[category] += 1;
      addedInRound = true;

      if (queue.length >= limit) {
        break;
      }
    }

    if (!addedInRound) {
      break;
    }
  }

  return queue;
}

function shuffleArray(items) {
  const copy = [...items];

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }

  return copy;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildUnsplashUrl(title, category) {
  const prompt = `${title}, ${category}, high quality cinematic photography, dark atmospheric lighting, 4k resolution`;
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1080&height=1920&nologo=true`;
}
