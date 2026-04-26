const GENERIC_ENTITY_TITLES = new Set([
  'history',
  'science',
  'technology',
  'health',
  'philosophy',
  'tarih',
  'bilim',
  'teknoloji',
  'saglik',
  'sağlık',
  'felsefe',
]);

const LOW_VALUE_TOPIC_PATTERNS = [
  /\blistesi\b/i,
  /\bliste\b/i,
  /\blist of\b/i,
  /\banlam ayrımı\b/i,
  /\banlam ayrimi\b/i,
  /\bdisambiguation\b/i,
  /\bseçim\b/i,
  /\bsecim\b/i,
  /\bkampanya(sı|si)?\b/i,
  /\bcampaign\b/i,
  /\bkurum\b/i,
  /\bkuruluş\b/i,
  /\bkurulus\b/i,
  /\bbirliği\b/i,
  /\bbirligi\b/i,
  /\bfederasyon(u)?\b/i,
  /\bassociation\b/i,
  /\bfederation\b/i,
  /\bcouncil\b/i,
  /\bunion\b/i,
  /\barma(sı|si)?\b/i,
  /\bcoat of arms\b/i,
  /\bpolitika\b/i,
  /\bpolitician\b/i,
  /\bparti\b/i,
  /\bparty\b/i,
  /\bfilm\b/i,
  /\bmovie\b/i,
  /\bkitap\b/i,
  /\bbook\b/i,
  /\broman\b/i,
  /\bnovel\b/i,
  /\bepistle\b/i,
  /\bmektup\b/i,
  /\byemek\b/i,
  /\bfood\b/i,
  /\bcuisine\b/i,
  /\bdish\b/i,
  /\bturizm\b/i,
  /\btourism\b/i,
  /\bekonomi\b/i,
  /\beconomy\b/i,
  /\bkulturel miras\b/i,
  /\bcultural heritage\b/i,
  /\banlaşmazlık\b/i,
  /\banlasmazlik\b/i,
  /\bdispute\b/i,
  /\bdoğalgaz\b/i,
  /\bdogalgaz\b/i,
  /\bnatural gas\b/i,
  /\btelevizyon\b/i,
  /\btelevision\b/i,
  /\bkanalı\b/i,
  /\bkanali\b/i,
  /\bchannel\b/i,
  /\bdizi\b/i,
  /\bsezon\b/i,
  /\bseason\b/i,
  /\bseri\b/i,
  /\bseries\b/i,
  /\bmüze\b/i,
  /\bmuze\b/i,
  /\bmuseum\b/i,
  /\bmüzik\b/i,
  /\bmuzik\b/i,
  /\bmusic\b/i,
  /\bmüzisyen\b/i,
  /\bmuzisyen\b/i,
  /\bbesteci\b/i,
  /\bcaz\b/i,
  /\binstrument\b/i,
  /\bmüzik aleti\b/i,
  /\bmuzik aleti\b/i,
  /\balbüm\b/i,
  /\balbum\b/i,
  /\boyun\b/i,
  /\bvideo game\b/i,
  /\bvideo oyun\b/i,
  /\bplaystation\b/i,
  /\bxbox\b/i,
  /\bfutbol\b/i,
  /\bfutbolcu\b/i,
  /\bfootballer\b/i,
  /\bfootball\b/i,
  /\bbasketbolcu\b/i,
  /\bbasketball\b/i,
  /\bvoleybolcu\b/i,
  /\bvolleyball\b/i,
  /\btenisçi\b/i,
  /\btenisci\b/i,
  /\btennis player\b/i,
  /\btenis\b/i,
  /\btennis\b/i,
  /\bşarkı(cı)?\b/i,
  /\bsarki(ci)?\b/i,
  /\bsinger\b/i,
  /\bactor\b/i,
  /\bactress\b/i,
  /\bmahalle\b/i,
  /\bkasaba\b/i,
  /\bbelde\b/i,
  /\bneighborhood\b/i,
  /\bkomün\b/i,
  /\bkomun\b/i,
  /\bcommune\b/i,
  /\bilçe\b/i,
  /\bilce\b/i,
  /\bilçesi\b/i,
  /\bilcesi\b/i,
  /\bbelediye\b/i,
  /\bmunicipality\b/i,
  /\btelefon modeli\b/i,
  /\bphone model\b/i,
  /\bsmartphone model\b/i,
  /\bcep telefonu\b/i,
  /\bakilli telefon\b/i,
  /\bakıllı telefon\b/i,
  /\bandroid cihaz\b/i,
  /\bürün modeli\b/i,
  /\burun modeli\b/i,
  /\btaslak/i,
  /\buçak modeli\b/i,
  /\bucak modeli\b/i,
  /\bfighter aircraft\b/i,
  /\bavcı uçağı\b/i,
  /\bavci ucagi\b/i,
  /\bsavaş uçağı\b/i,
  /\bsavas ucagi\b/i,
  /\bvillage\b/i,
  /\bvikipedi\b/i,
  /\bwikipedia\b/i,
  /\bbaşkanı\b/i,
  /\bbaskani\b/i,
  /\bpresident\b/i,
  /\bprime minister\b/i,
  /\bbaşbakan\b/i,
  /\bbasbakan\b/i,
];

const HIGH_VALUE_PERSON_SIGNALS = [
  /\bfilozof\b/i,
  /\bphilosopher\b/i,
  /\bbilim insanı\b/i,
  /\bbilim insani\b/i,
  /\bscientist\b/i,
  /\bfizikçi\b/i,
  /\bfizikci\b/i,
  /\bphysicist\b/i,
  /\bmatematikçi\b/i,
  /\bmatematikci\b/i,
  /\bmathematician\b/i,
  /\btarihçi\b/i,
  /\btarihci\b/i,
  /\bhistorian\b/i,
  /\bkaşif\b/i,
  /\bkasif\b/i,
  /\bexplorer\b/i,
  /\bmucit\b/i,
  /\binventor\b/i,
];

const PERSON_ROLE_SIGNALS = [
  ...HIGH_VALUE_PERSON_SIGNALS,
  /\byazar\b/i,
  /\bwriter\b/i,
  /\bşarkıcı\b/i,
  /\bsarkici\b/i,
  /\bsinger\b/i,
  /\baktör\b/i,
  /\baktor\b/i,
  /\bactor\b/i,
  /\bactress\b/i,
  /\bmüzisyen\b/i,
  /\bmuzisyen\b/i,
  /\bmusician\b/i,
  /\bbesteci\b/i,
  /\bcaz bestecisi\b/i,
  /\byönetmen\b/i,
  /\byonetmen\b/i,
  /\bdirector\b/i,
  /\boyuncu\b/i,
  /\bperformer\b/i,
  /\byapımcı\b/i,
  /\byapimci\b/i,
  /\btheatre\b/i,
  /\btiyatro\b/i,
  /\bproducer\b/i,
  /\bantrenör\b/i,
  /\bantrenor\b/i,
  /\bcoach\b/i,
  /\bsiyasetçi\b/i,
  /\bsiyasetci\b/i,
  /\bpolitician\b/i,
  /\bressam\b/i,
  /\bpainter\b/i,
];

function normalizeText(value) {
  return String(value ?? '')
    .toLocaleLowerCase('tr-TR')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function titleSharesSignal(title, signals) {
  const normalizedTitle = normalizeText(title);

  if (!normalizedTitle) {
    return false;
  }

  return signals.some((signal) => {
    const parts = String(signal).split(':');
    const tail = parts[parts.length - 1];
    return tail && normalizedTitle.includes(normalizeText(tail));
  });
}

function isLikelyPersonName(title) {
  const words = String(title ?? '').trim().split(/\s+/).filter(Boolean);

  if (words.length < 2 || words.length > 4) {
    return false;
  }

  return words.every((word) => /^\p{Lu}[\p{L}'-]+$/u.test(word));
}

export function evaluateWikipediaTaxonomyDecision({
  preferredData,
  entity,
  enrichment,
  taxonomy,
  targetCategory,
  relaxedCategoryTarget,
  curiosityScore = 0,
}) {
  const reasons = [];

  if (!taxonomy?.category) {
    reasons.push('unknown_taxonomy');
  }

  if ((entity?.confidence ?? 0) < 0.7) {
    reasons.push('low_entity_confidence');
  }

  if ((taxonomy?.confidence ?? 0) < 0.6) {
    reasons.push('low_taxonomy_confidence');
  }

  const enrichmentCategories = Array.isArray(enrichment?.categories)
    ? enrichment.categories.join(' ')
    : '';
  const contentText = `${preferredData?.title ?? ''} ${preferredData?.description ?? ''} ${preferredData?.extract ?? ''} ${entity?.description ?? ''} ${enrichmentCategories}`;

  if (LOW_VALUE_TOPIC_PATTERNS.some((pattern) => pattern.test(contentText))) {
    reasons.push('low_value_topic');
  }

  const personLikeTitle = isLikelyPersonName(preferredData?.title);
  const looksLikePersonSummary = PERSON_ROLE_SIGNALS.some(
    (pattern) =>
      pattern.test(preferredData?.extract ?? '') || pattern.test(entity?.canonicalTitle ?? ''),
  );
  const hasHighValuePersonSignal = HIGH_VALUE_PERSON_SIGNALS.some(
    (pattern) =>
      pattern.test(preferredData?.extract ?? '') || pattern.test(entity?.canonicalTitle ?? ''),
  );

  if (personLikeTitle && looksLikePersonSummary && !hasHighValuePersonSignal) {
    reasons.push('low_value_person');
  }

  if (GENERIC_ENTITY_TITLES.has(normalizeText(entity?.canonicalTitle))) {
    reasons.push('generic_entity');
  }

  const hasSignalInTitle = titleSharesSignal(preferredData?.title, taxonomy?.signals ?? []);

  if (!hasSignalInTitle && (taxonomy?.confidence ?? 0) < 0.85) {
    reasons.push('weak_title_alignment');
  }

  const canBypassTargetMismatch =
    (taxonomy?.confidence ?? 0) >= 0.9 && curiosityScore >= 4;

  if (
    !relaxedCategoryTarget &&
    targetCategory &&
    taxonomy?.category !== targetCategory &&
    !canBypassTargetMismatch
  ) {
    reasons.push('target_mismatch');
  }

  return {
    accepted: reasons.length === 0,
    reasons,
  };
}
