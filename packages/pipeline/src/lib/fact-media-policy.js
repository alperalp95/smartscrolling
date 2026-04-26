import { normalizeText } from './fact-visual-key.js';

const UNSUPPORTED_IMAGE_FORMATS = ['.tif', '.tiff', '.bmp', '.psd', '.raw'];

const BAD_MEDIA_KEYWORDS = [
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
  'diagram',
  'chart',
  'map',
  'locator',
  'timeline',
  'scheme',
  'schematic',
];

export function evaluateFactMedia({ sourceLabel, mediaUrl }) {
  const normalizedSourceLabel = normalizeText(sourceLabel);
  const normalizedMediaUrl = (mediaUrl ?? '').trim().toLowerCase();

  if (!normalizedMediaUrl) {
    return { ok: true, reason: 'missing_media' };
  }

  if (!normalizedMediaUrl.startsWith('http')) {
    return { ok: true, reason: 'local_asset' };
  }

  if (
    normalizedSourceLabel.includes('wikipedia') &&
    /upload\.wikimedia\.org\/wikipedia\/(?!commons\/)/i.test(normalizedMediaUrl)
  ) {
    return { ok: false, reason: 'wikipedia_non_free_asset' };
  }

  if (UNSUPPORTED_IMAGE_FORMATS.some((ext) => normalizedMediaUrl.includes(ext))) {
    return { ok: false, reason: 'unsupported_format' };
  }

  if (/\.svg(\.png)?($|\?)/i.test(normalizedMediaUrl)) {
    return { ok: false, reason: 'svg_not_supported' };
  }

  if (BAD_MEDIA_KEYWORDS.some((keyword) => normalizedMediaUrl.includes(keyword))) {
    return { ok: false, reason: 'diagrammatic_or_brand_asset' };
  }

  return { ok: true, reason: 'usable_media' };
}

export function normalizeFactMediaUrl(mediaUrl) {
  const normalizedMediaUrl = (mediaUrl ?? '').trim();

  if (normalizedMediaUrl.includes('upload.wikimedia.org/')) {
    return normalizedMediaUrl.replaceAll(/%2c/gi, ',');
  }

  return normalizedMediaUrl;
}
