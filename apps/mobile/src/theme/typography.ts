// Yazı tipleri ve metin stilleri. Boyutları ve satır aralıklarını buradan değiştirebilirsiniz.
import type { TextStyle } from 'react-native';

export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  extrabold: 'Inter_800ExtraBold',
} as const;

export const type = {
  screenTitle: { fontFamily: fonts.bold, fontSize: 17, lineHeight: 22 },
  cardTitle: { fontFamily: fonts.extrabold, fontSize: 22, lineHeight: 26, letterSpacing: -0.3 },
  // Paylaşım görselinde başlık, uygulamadaki kart başlığından bir kademe büyüktür (26/30).
  shareTitle: { fontFamily: fonts.extrabold, fontSize: 26, lineHeight: 30, letterSpacing: -0.3 },
  // Paylaşım görselinde fotoğraf yoksa başlığın üstünde duran büyük tırnak işareti.
  shareQuote: { fontFamily: fonts.extrabold, fontSize: 64, lineHeight: 64 },
  body: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 21 },
  // Not: textTransform 'i' harfini 'İ' yapmaz. Türkçe metni büyük harfle verin
  // (ör. 'TERCİHLER' ya da metin.toLocaleUpperCase('tr-TR')).
  meta: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  caption: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16 },
  button: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 18 },
  chip: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16 },
  stat: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 20 },
} satisfies Record<string, TextStyle>;
