const ALLOWED_CATEGORIES = new Set([
  '🔬 BİLİM',
  '📜 TARİH',
  '🧠 FELSEFE',
  '💻 TEKNOLOJİ',
  '🌱 SAĞLIK',
]);

const LOW_QUALITY_TITLE_PATTERNS = [
  /\?$/,
  /\bkimdir\b/i,
  /\bnedir\b/i,
  /\bnasil\b/i,
  /\bneresidir\b/i,
  /\bne var\b/i,
  /\bgorur musunuz\b/i,
];

const LOW_VALUE_SOURCE_TITLE_PATTERNS = [
  /\belectoral district\b/i,
  /\bcommittee\b/i,
  /\bcouncil\b/i,
  /\bfederation\b/i,
  /\bassociation\b/i,
  /\bunion\b/i,
  /\bvillage\b/i,
  /\bdistrict\b/i,
  /\bmunicipality\b/i,
  /\bstation\b/i,
  /\broad\b/i,
  /\btennis\b/i,
  /\bfootball\b/i,
  /\bplayer\b/i,
  /\bactor\b/i,
  /\bactress\b/i,
  /\bsinger\b/i,
  /\bpolitician\b/i,
  /\bshopping mall\b/i,
  /\bilce\b/i,
  /\bköy\b/i,
  /\bkoy\b/i,
  /\bbelediye\b/i,
  /\bbelediyesi\b/i,
  /\byol(u|lari)?\b/i,
  /\bistasyon(u)?\b/i,
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
  /\bkararı\b/i,
  /\bkarari\b/i,
];

const LOW_VALUE_SOURCE_EXCERPT_PATTERNS = [
  /\bis a village in\b/i,
  /\bis a district in\b/i,
  /\bis a municipality in\b/i,
  /\bis a railway station\b/i,
  /\bis a road\b/i,
  /\bis a politician\b/i,
  /\bis a footballer\b/i,
  /\bis a tennis player\b/i,
  /\bis an actor\b/i,
  /\bis an actress\b/i,
  /\bis a singer\b/i,
  /\bis a shopping mall\b/i,
  /\bbir köydür\b/i,
  /\bbir koydur\b/i,
  /\bbir ilçedir\b/i,
  /\bbir ilcedir\b/i,
  /\bbir belediyedir\b/i,
  /\bbir seçim bölgesidir\b/i,
  /\bbir secim bolgesidir\b/i,
  /\bbir istasyondur\b/i,
  /\bbir yoldur\b/i,
  /\bbir politikacıdır\b/i,
  /\bbir politikacidir\b/i,
  /\bbir futbolcudur\b/i,
  /\bbir tenisçidir\b/i,
  /\bbir teniscidir\b/i,
  /\bbir oyuncudur\b/i,
  /\bbir şarkıcıdır\b/i,
  /\bbir sarkicidir\b/i,
];

function wordCount(text) {
  return (text ?? '').trim().split(/\s+/).filter(Boolean).length;
}

function firstSentenceWordCount(text) {
  const firstSentence = (text ?? '')
    .split(/[.!?]+/)
    .map((sentence) => sentence.trim())
    .find(Boolean);

  return wordCount(firstSentence ?? '');
}

function hasShortFormAllowance(title, content) {
  return title.length >= 20 && wordCount(content) >= 58 && firstSentenceWordCount(content) >= 9;
}

function hasPdfCuratedShortFormAllowance(title, content) {
  return title.length >= 18 && wordCount(content) >= 38 && firstSentenceWordCount(content) >= 7;
}

function normalizeSentence(sentence) {
  return sentence
    .toLowerCase()
    .replaceAll(/\s+/g, ' ')
    .replaceAll(/[^\p{L}\p{N}\s]/gu, '')
    .trim();
}

function buildTokenSet(text) {
  return new Set(
    normalizeSentence(text)
      .split(/\s+/)
      .filter((token) => token.length >= 4),
  );
}

function sentenceSimilarity(left, right) {
  const leftTokens = buildTokenSet(left);
  const rightTokens = buildTokenSet(right);

  if (leftTokens.size === 0 || rightTokens.size === 0) {
    return 0;
  }

  let intersection = 0;

  for (const token of leftTokens) {
    if (rightTokens.has(token)) {
      intersection += 1;
    }
  }

  return intersection / Math.min(leftTokens.size, rightTokens.size);
}

function hasExcessiveSentenceRepetition(text) {
  const sentences = (text ?? '')
    .split(/[.!?]+/)
    .map((sentence) => normalizeSentence(sentence))
    .filter((sentence) => sentence.length >= 24);

  if (sentences.length < 3) {
    return false;
  }

  const seen = new Set();

  for (const sentence of sentences) {
    if (seen.has(sentence)) {
      return true;
    }

    seen.add(sentence);
  }

  for (let index = 0; index < sentences.length; index += 1) {
    for (let compareIndex = index + 1; compareIndex < sentences.length; compareIndex += 1) {
      if (sentenceSimilarity(sentences[index], sentences[compareIndex]) >= 0.8) {
        return true;
      }
    }
  }

  return false;
}

function editorialScore(title, content, sourceTitle, sourceExcerpt) {
  const normalizedTitle = normalizeSentence(title);
  const normalizedContent = normalizeSentence(content);
  const normalizedSourceTitle = normalizeSentence(sourceTitle);
  const normalizedSourceExcerpt = normalizeSentence(sourceExcerpt);
  let score = 0;

  const curiositySignals = [
    /\bilk\b/i,
    /\ben eski\b/i,
    /\bdonum noktasi\b/i,
    /\bdevrim\b/i,
    /\bkesif\b/i,
    /\bteori\b/i,
    /\bneden\b/i,
    /\bnasil\b/i,
    /\betkisi\b/i,
    /\bgizemi\b/i,
    /\bwhy\b/i,
    /\bfirst\b/i,
    /\bearliest\b/i,
    /\bturning point\b/i,
    /\bdiscovery\b/i,
    /\bimpact\b/i,
  ];

  const mechanismSignals = [
    /\bnasil\b/i,
    /\bneden\b/i,
    /\bbu yuzden\b/i,
    /\bbu nedenle\b/i,
    /\bboylece\b/i,
    /\bbunun sonucu\b/i,
    /\bbecause\b/i,
    /\btherefore\b/i,
    /\bso that\b/i,
    /\bworks by\b/i,
  ];

  const genericSignals = [
    /\bonemi\b/i,
    /\btemel fikri\b/i,
    /\bgenel baki[sş]\b/i,
    /\banlami\b/i,
    /\betkileri\b/i,
    /\bimportance\b/i,
    /\boverview\b/i,
    /\bbasics\b/i,
    /\bintroduction\b/i,
  ];

  const textbookToneSignals = [
    /\bx sudur\b/i,
    /\by budur\b/i,
    /\bifade eder\b/i,
    /\btanimlar\b/i,
    /\bgenellikle\b/i,
    /\bwide range\b/i,
    /\brefers to\b/i,
    /\bis the study of\b/i,
  ];

  if (curiositySignals.some((pattern) => pattern.test(`${normalizedTitle} ${normalizedContent}`))) {
    score += 3;
  }

  if (mechanismSignals.some((pattern) => pattern.test(normalizedContent))) {
    score += 2;
  }

  const primarySourceAnchor = normalizedSourceTitle.split(/\s+/).find((token) => token.length >= 4);

  if (primarySourceAnchor && normalizedContent.includes(primarySourceAnchor)) {
    score += 1;
  }

  if (
    /\bsonuc\b/i.test(normalizedContent) ||
    /\betki\b/i.test(normalizedContent) ||
    /\bdegistirdi\b/i.test(normalizedContent)
  ) {
    score += 1;
  }

  if (genericSignals.some((pattern) => pattern.test(normalizedTitle))) {
    score -= 3;
  }

  if (textbookToneSignals.some((pattern) => pattern.test(normalizedContent))) {
    score -= 2;
  }

  if (wordCount(content) > 150) {
    score -= 1;
  }

  if (sourceExcerpt && normalizeSentence(sourceExcerpt) === normalizedContent) {
    score -= 2;
  }

  return score;
}

export function evaluateFactQuality(fact) {
  const title = (fact.title ?? '').trim();
  const content = (fact.content ?? '').trim();
  const sourceUrl = (fact.source_url ?? '').trim();
  const sourceLabel = (fact.source_label ?? '').trim();
  const sourceTitle = (fact._source_title ?? '').trim();
  const sourceKind = (fact._source_kind ?? '').trim();
  const sourceExcerpt = (fact._source_excerpt ?? '').trim();
  const tags = Array.isArray(fact.tags) ? fact.tags.filter(Boolean) : [];
  const isPdfCurated = sourceKind === 'pdf_curated';

  if (!title || title.length < 12 || title.length > 80) {
    return { ok: false, reason: 'invalid_title_length' };
  }

  if (!isPdfCurated && LOW_QUALITY_TITLE_PATTERNS.some((pattern) => pattern.test(title))) {
    return { ok: false, reason: 'low_quality_title' };
  }

  if (!content) {
    return { ok: false, reason: 'content_too_short' };
  }

  const contentWords = wordCount(content);

  if (contentWords < (isPdfCurated ? 38 : 58)) {
    return { ok: false, reason: 'content_too_short' };
  }

  if (
    contentWords < (isPdfCurated ? 50 : 70) &&
    !(isPdfCurated
      ? hasPdfCuratedShortFormAllowance(title, content)
      : hasShortFormAllowance(title, content))
  ) {
    return { ok: false, reason: 'content_too_short' };
  }

  if (!isPdfCurated && hasExcessiveSentenceRepetition(content)) {
    return { ok: false, reason: 'content_repetition' };
  }

  if (!sourceUrl) {
    return { ok: false, reason: 'missing_source_url' };
  }

  if (!sourceLabel) {
    return { ok: false, reason: 'missing_source_label' };
  }

  if (!ALLOWED_CATEGORIES.has(fact.category)) {
    return { ok: false, reason: 'invalid_category' };
  }

  if (tags.length < 2) {
    return { ok: false, reason: 'insufficient_tags' };
  }

  if (
    LOW_VALUE_SOURCE_TITLE_PATTERNS.some((pattern) => pattern.test(sourceTitle)) ||
    LOW_VALUE_SOURCE_EXCERPT_PATTERNS.some((pattern) => pattern.test(sourceExcerpt))
  ) {
    return { ok: false, reason: 'low_value_source_topic' };
  }

  const minimumEditorialScore = isPdfCurated ? -1 : 1;

  if (editorialScore(title, content, sourceTitle, sourceExcerpt) < minimumEditorialScore) {
    return { ok: false, reason: 'editorial_score_too_low' };
  }

  return { ok: true, reason: 'approved' };
}
