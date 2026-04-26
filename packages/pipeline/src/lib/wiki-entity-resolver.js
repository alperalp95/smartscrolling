export function resolveWikipediaEntity({ lang = 'tr', summaryData, fallbackUrl }) {
  const canonicalTitle =
    summaryData?.titles?.canonical ??
    summaryData?.title ??
    '';
  const displayTitle = summaryData?.titles?.display ?? summaryData?.title ?? canonicalTitle;
  const url =
    summaryData?.content_urls?.desktop?.page ??
    fallbackUrl ??
    (canonicalTitle ? `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(canonicalTitle)}` : '');
  const description = summaryData?.description ?? '';
  const hasTitle = canonicalTitle.trim().length > 0;
  const hasExtract = (summaryData?.extract ?? '').trim().length > 80;

  return {
    canonicalTitle,
    displayTitle,
    pageId: summaryData?.pageid ?? null,
    url,
    lang,
    description,
    confidence: hasTitle && hasExtract ? 0.9 : hasTitle ? 0.65 : 0,
    signals: [
      hasTitle ? 'entity:title' : 'entity:missing_title',
      hasExtract ? 'entity:summary' : 'entity:weak_summary',
    ],
  };
}
