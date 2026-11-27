import type { FactType } from '../../types';
import { failedRemoteImageUrls } from '../factMedia';
import {
  buildFactShareLink,
  buildShareMessage,
  pickShareVariant,
  shareCategoryLabel,
} from '../shareCard';

const COMMONS_URL = 'https://upload.wikimedia.org/wikipedia/commons/a/ab/nebula.jpg';

function makeFact(overrides: Partial<FactType> = {}): FactType {
  return {
    id: 'f1',
    title: 'Başlık',
    content: 'Gövde',
    category: 'bilim',
    tags: [],
    read_time_sq: 1,
    likes: 0,
    ...overrides,
  };
}

describe('shareCard', () => {
  afterEach(() => {
    failedRemoteImageUrls.clear();
  });

  it('builds the default share link', () => {
    expect(buildFactShareLink('abc')).toBe('https://smartscrolling.app/fact/abc');
  });

  it('trims the trailing slash and encodes the id', () => {
    expect(buildFactShareLink('a b', 'https://x.app/')).toBe('https://x.app/fact/a%20b');
  });

  it('builds the share message', () => {
    expect(buildShareMessage('Başlık', 'L')).toBe('Başlık\n\nDevamı: L');
  });

  it('picks photo variant for a Commons image', () => {
    expect(pickShareVariant(makeFact({ media_url: COMMONS_URL }))).toEqual({
      variant: 'photo',
      photoUri: COMMONS_URL,
    });
  });

  it('picks text variant when only a local preset image exists', () => {
    expect(
      pickShareVariant(makeFact({ media_url: null, visual_key: 'space-observatory' })),
    ).toEqual({ variant: 'text', photoUri: null });
  });

  it('picks text variant for a failed remote image', () => {
    failedRemoteImageUrls.add(COMMONS_URL);
    expect(pickShareVariant(makeFact({ media_url: COMMONS_URL })).variant).toBe('text');
  });

  it('upper-cases the category label in Turkish', () => {
    expect(shareCategoryLabel('bilim ve İnsan')).toBe('BİLİM VE İNSAN');
  });
});
