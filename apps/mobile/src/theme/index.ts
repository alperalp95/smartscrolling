// Tasarım değerlerinin tek giriş noktası: renkler, yazı tipleri, boşluklar.
import { colors } from './colors';
import { fonts, type } from './typography';
import { space, radius } from './spacing';

export * from './colors';
export * from './typography';
export * from './spacing';

export const theme = { colors, fonts, type, space, radius };
