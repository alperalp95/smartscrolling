// Akıştaki seri tanıtım kartı ayarları. Kod bilmeden düzenlenebilir: sadece sayıyı/değeri değiştirin.
export type SeriesTeaserConfig = {
  firstAfter: number;
  interval: number;
  alternate: boolean;
};

export const SERIES_TEASER_CONFIG: SeriesTeaserConfig = {
  // İlk tanıtım kartı, akışta bu kadar içerik kartından sonra çıkar (reklamlar sayılmaz).
  firstAfter: 8,
  // İlk tanıtımdan sonra, her bu kadar içerik kartında bir yeni tanıtım çıkar.
  interval: 12,
  // true: ücretsiz ve premium seriler dönüşümlü gösterilir. false: seri listesi sırasıyla.
  alternate: true,
};
