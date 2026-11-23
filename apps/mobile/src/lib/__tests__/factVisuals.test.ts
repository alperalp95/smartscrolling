import { deriveFactVisualKey, isBadFactMediaUrl, normalizeFactVisualText } from '../factVisuals';

describe('fact visual helpers', () => {
  it('normalizes Turkish diacritics for matching', () => {
    expect(normalizeFactVisualText('Sağlık ve Güneş')).toBe('saglık ve gunes');
  });

  it('maps NASA sourced facts to the observatory visual', () => {
    expect(
      deriveFactVisualKey({
        category: 'Bilim',
        sourceLabel: 'NASA APOD',
        title: 'A galaxy seen by a telescope',
      }),
    ).toBe('space-observatory');
  });

  it('keeps science cosmos matching available without a NASA source', () => {
    expect(
      deriveFactVisualKey({
        category: 'Bilim',
        sourceLabel: 'Wikipedia',
        title: 'Kara delik ve galaksi gozlemleri',
      }),
    ).toBe('science-cosmos');
  });

  it('rejects low-value media url patterns', () => {
    expect(isBadFactMediaUrl('https://upload.wikimedia.org/wikipedia/en/1/12/example.svg')).toBe(
      true,
    );
    expect(isBadFactMediaUrl('https://cdn.example.com/photo/logo-cover.png')).toBe(true);
    expect(
      isBadFactMediaUrl('https://upload.wikimedia.org/wikipedia/commons/a/ab/nebula.jpg'),
    ).toBe(false);
  });
});
