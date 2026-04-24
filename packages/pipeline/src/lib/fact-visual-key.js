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
