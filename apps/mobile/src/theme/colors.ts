// Uygulamanın renkleri. Renkleri değiştirmek için buradaki kodları (#RRGGBB) düzenleyin.
export const colors = {
  bg: '#000000',
  surface: '#121212',
  surfaceRaised: '#1C1C1C',
  fill: '#262626',
  separator: '#262626',
  text: '#FFFFFF',
  textSecondary: '#A8A8A8',
  textTertiary: '#737373',
  like: '#FF3040',
  danger: '#ED4956',
  success: '#58C322',
  scrim: 'rgba(0,0,0,0.55)',
  // Açık renkli fotoğraf üstündeki yazılar için: alt karartma %80 koyu, üst uç saydam.
  scrimStrong: 'rgba(0,0,0,0.8)',
  scrimClear: 'rgba(0,0,0,0)',
  // Paylaşım görselindeki kartın zemini: `surface` rengi (#121212), %82 görünürlükle.
  shareCardBg: 'rgba(18,18,18,0.82)',
  brandGradient: ['#FF7A45', '#FF3D7F', '#8B5CF6'] as readonly [string, string, string],
} as const;
