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

  if (normalizedCategory.includes('bilim')) {
    if (
      includesAny(topicText, [
        'space',
        'galaxy',
        'planet',
        'orbit',
        'moon',
        'mars',
        'asteroid',
        'comet',
        'nebula',
        'telescope',
        'cosmic',
        'star',
      ])
    ) {
      return 'science-cosmos';
    }

    if (
      includesAny(topicText, [
        'cell',
        'dna',
        'gene',
        'genetic',
        'organism',
        'brain',
        'evolution',
        'immune',
        'virus',
        'bacteria',
        'biology',
        'animal',
      ])
    ) {
      return 'science-biology';
    }

    if (
      includesAny(topicText, [
        'chemistry',
        'kimya',
        'periodic',
        'element',
        'molecule',
        'compound',
        'mendeleyev',
      ])
    ) {
      return 'science-chemistry';
    }

    if (
      includesAny(topicText, [
        'earth',
        'geology',
        'ocean',
        'climate',
        'fossil',
        'volcano',
        'mineral',
        'glacier',
        'weather',
        'atmosphere',
        'tectonic',
      ])
    ) {
      return 'science-earth';
    }

    return 'science-focus';
  }

  if (normalizedCategory.includes('tarih')) {
    if (
      includesAny(topicText, [
        'ancient',
        'antik',
        'rome',
        'roman',
        'greek',
        'egypt',
        'archae',
        'temple',
        'ruins',
        'medieval',
        'dynasty',
        'empire',
        'cathedral',
      ])
    ) {
      return 'history-antiquity';
    }

    if (
      includesAny(topicText, [
        'war',
        'battle',
        'revolution',
        'treaty',
        'election',
        'council',
        'congress',
        'senate',
        'occupation',
        'conflict',
        'military',
      ])
    ) {
      return 'history-conflict';
    }

    return 'history-archive';
  }

  if (normalizedCategory.includes('felsefe')) {
    if (
      includesAny(topicText, [
        'ethic',
        'moral',
        'justice',
        'duty',
        'responsibility',
        'utilitarian',
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
        'reality',
        'knowledge',
        'religion',
      ])
    ) {
      return 'philosophy-metaphysics';
    }

    return 'philosophy-marble';
  }

  if (normalizedCategory.includes('teknoloji')) {
    if (
      includesAny(topicText, [
        'computer',
        'software',
        'program',
        'compiler',
        'database',
        'algorithm',
        'encrypt',
        'cryptograph',
        'cloud',
        'search',
        'network',
        'internet',
        'distributed',
        'open source',
        'digital',
        'signal',
      ])
    ) {
      return 'technology-computing';
    }

    if (
      includesAny(topicText, [
        'engine',
        'aircraft',
        'rocket',
        'satellite',
        'device',
        'hardware',
        'vehicle',
        'power',
        'robot',
        'machine',
        'electric',
      ])
    ) {
      return 'technology-systems';
    }

    return 'technology-grid';
  }

  if (normalizedCategory.includes('saglik')) {
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
