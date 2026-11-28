// Tasarım değerlerinin tek giriş noktası: renkler, yazı tipleri, boşluklar.
import { colors } from './colors';
import { radius, reader, share, space, teaser } from './spacing';
import { fonts, type } from './typography';

export * from './colors';
export * from './typography';
export * from './spacing';

export const theme = { colors, fonts, type, space, radius, share, reader, teaser };
