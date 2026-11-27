// Paylaşım kartı için saf kurallar: link, mesaj, görsel türü, kategori etiketi.
import { SHARE_CONFIG } from '../config/share';
import type { FactType } from '../types';
import { resolveFactMedia } from './factMedia';

export type ShareVariant = 'photo' | 'text';

export function buildFactShareLink(id: string, baseUrl: string = SHARE_CONFIG.baseUrl): string {
  return `${baseUrl.replace(/\/+$/, '')}/fact/${encodeURIComponent(id)}`;
}

export function buildShareMessage(title: string, link: string): string {
  return `${title}\n\nDevamı: ${link}`;
}

export function pickShareVariant(fact: FactType): {
  variant: ShareVariant;
  photoUri: string | null;
} {
  const { uri } = resolveFactMedia(fact);
  return uri ? { variant: 'photo', photoUri: uri } : { variant: 'text', photoUri: null };
}

export function shareCategoryLabel(category: string): string {
  return category.toLocaleUpperCase('tr-TR');
}
