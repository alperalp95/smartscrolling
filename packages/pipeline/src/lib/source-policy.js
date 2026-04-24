const VERIFIED_DOMAIN_SUFFIXES = [
  'wikipedia.org',
  'nasa.gov',
  'plato.stanford.edu',
  'medlineplus.gov',
];
const VERIFIED_LABEL_PATTERNS = [/wikipedia/i, /nasa/i, /stanford encyclopedia/i, /medlineplus/i];

function getHostname(sourceUrl) {
  if (!sourceUrl) {
    return null;
  }

  try {
    return new URL(sourceUrl).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function isVerifiedSource({ sourceLabel, sourceUrl }) {
  const normalizedLabel = (sourceLabel ?? '').trim();
  const hostname = getHostname(sourceUrl);

  if (hostname) {
    const matchesDomain = VERIFIED_DOMAIN_SUFFIXES.some(
      (suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`),
    );

    if (matchesDomain) {
      return true;
    }
  }

  return VERIFIED_LABEL_PATTERNS.some((pattern) => pattern.test(normalizedLabel));
}

export function applySourcePolicy(fact) {
  return {
    ...fact,
    verified: isVerifiedSource({
      sourceLabel: fact.source_label,
      sourceUrl: fact.source_url,
    }),
  };
}
