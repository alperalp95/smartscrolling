// Gönderi görselleri: yerel görseller, görsel ön ayarları ve bir gönderinin görselini çözme.
import type { ImageSourcePropType } from 'react-native';
import type { FactType } from '../types';
import { isBadFactMediaUrl } from './factVisuals';

export const LOCAL_IMAGES: Record<string, ImageSourcePropType> = {
  bg_black_hole: require('../../assets/images/bg_black_hole.png'),
  bg_rome_ruins: require('../../assets/images/bg_rome_ruins.png'),
  bg_stoic_statue: require('../../assets/images/bg_stoic_statue.png'),
  bg_quantum_pc: require('../../assets/images/bg_quantum_pc.png'),
};

export const VISUAL_PRESETS: Record<
  string,
  {
    imageKey?: keyof typeof LOCAL_IMAGES;
    accent: string;
    overlay: string;
    eyebrow: string;
    gradientStart: string;
    gradientEnd: string;
  }
> = {
  'space-observatory': {
    imageKey: 'bg_black_hole',
    accent: '#7dd3fc',
    overlay: 'rgba(5, 10, 24, 0.42)',
    eyebrow: 'NASA / Uzay',
    gradientStart: '#030712',
    gradientEnd: '#0f172a',
  },
  'science-focus': {
    imageKey: 'bg_black_hole',
    accent: '#22d3ee',
    overlay: 'rgba(5, 18, 30, 0.48)',
    eyebrow: 'Bilim Notu',
    gradientStart: '#04111f',
    gradientEnd: '#0f172a',
  },
  'science-cosmos': {
    imageKey: 'bg_black_hole',
    accent: '#67e8f9',
    overlay: 'rgba(7, 15, 28, 0.44)',
    eyebrow: 'Kozmos',
    gradientStart: '#020817',
    gradientEnd: '#172554',
  },
  'science-biology': {
    imageKey: 'bg_black_hole',
    accent: '#5eead4',
    overlay: 'rgba(4, 20, 18, 0.46)',
    eyebrow: 'Yasam Bilimi',
    gradientStart: '#042f2e',
    gradientEnd: '#0f172a',
  },
  'science-chemistry': {
    imageKey: 'bg_quantum_pc',
    accent: '#93c5fd',
    overlay: 'rgba(10, 18, 30, 0.42)',
    eyebrow: 'Maddeler ve Yapi',
    gradientStart: '#0f172a',
    gradientEnd: '#1d4ed8',
  },
  'science-earth': {
    imageKey: 'bg_rome_ruins',
    accent: '#7dd3fc',
    overlay: 'rgba(6, 18, 28, 0.42)',
    eyebrow: 'Dunya Bilimi',
    gradientStart: '#082f49',
    gradientEnd: '#164e63',
  },
  'history-archive': {
    imageKey: 'bg_rome_ruins',
    accent: '#f59e0b',
    overlay: 'rgba(32, 16, 4, 0.48)',
    eyebrow: 'Tarih Arsivi',
    gradientStart: '#1c1208',
    gradientEnd: '#3b2412',
  },
  'history-antiquity': {
    imageKey: 'bg_rome_ruins',
    accent: '#fbbf24',
    overlay: 'rgba(44, 23, 6, 0.42)',
    eyebrow: 'Antik Dunya',
    gradientStart: '#2b1606',
    gradientEnd: '#5b3415',
  },
  'history-conflict': {
    imageKey: 'bg_rome_ruins',
    accent: '#fb7185',
    overlay: 'rgba(40, 10, 10, 0.48)',
    eyebrow: 'Kirilmalar',
    gradientStart: '#3f0f1a',
    gradientEnd: '#5b1c1c',
  },
  'philosophy-marble': {
    imageKey: 'bg_stoic_statue',
    accent: '#c4b5fd',
    overlay: 'rgba(18, 10, 30, 0.46)',
    eyebrow: 'Dusunce',
    gradientStart: '#140c24',
    gradientEnd: '#2e1a47',
  },
  'philosophy-library': {
    imageKey: 'bg_stoic_statue',
    accent: '#e9d5ff',
    overlay: 'rgba(20, 12, 32, 0.42)',
    eyebrow: 'Stanford',
    gradientStart: '#160d25',
    gradientEnd: '#2b1a3f',
  },
  'philosophy-ethics': {
    imageKey: 'bg_stoic_statue',
    accent: '#f0abfc',
    overlay: 'rgba(35, 12, 38, 0.44)',
    eyebrow: 'Etik',
    gradientStart: '#3b0764',
    gradientEnd: '#4c1d95',
  },
  'philosophy-metaphysics': {
    imageKey: 'bg_stoic_statue',
    accent: '#a5b4fc',
    overlay: 'rgba(16, 16, 42, 0.44)',
    eyebrow: 'Varlik ve Zihin',
    gradientStart: '#1e1b4b',
    gradientEnd: '#312e81',
  },
  'technology-grid': {
    imageKey: 'bg_quantum_pc',
    accent: '#34d399',
    overlay: 'rgba(5, 20, 16, 0.46)',
    eyebrow: 'Teknoloji',
    gradientStart: '#071611',
    gradientEnd: '#113126',
  },
  'technology-computing': {
    imageKey: 'bg_quantum_pc',
    accent: '#22c55e',
    overlay: 'rgba(5, 18, 12, 0.46)',
    eyebrow: 'Yazilim ve Ag',
    gradientStart: '#052e16',
    gradientEnd: '#14532d',
  },
  'technology-systems': {
    imageKey: 'bg_quantum_pc',
    accent: '#38bdf8',
    overlay: 'rgba(5, 14, 26, 0.44)',
    eyebrow: 'Sistemler',
    gradientStart: '#0c1f3f',
    gradientEnd: '#164e63',
  },
  'health-brief': {
    accent: '#fda4af',
    overlay: 'rgba(48, 10, 18, 0.22)',
    eyebrow: 'Saglik',
    gradientStart: '#2f1020',
    gradientEnd: '#581c3a',
  },
  'health-body': {
    accent: '#fb7185',
    overlay: 'rgba(58, 14, 24, 0.24)',
    eyebrow: 'Vucut ve Sistemler',
    gradientStart: '#4c0519',
    gradientEnd: '#7f1d1d',
  },
  'health-clinical': {
    accent: '#f9a8d4',
    overlay: 'rgba(58, 18, 34, 0.24)',
    eyebrow: 'Klinik Bilgi',
    gradientStart: '#500724',
    gradientEnd: '#831843',
  },
  'health-mind': {
    accent: '#c084fc',
    overlay: 'rgba(40, 14, 56, 0.24)',
    eyebrow: 'Zihin ve Denge',
    gradientStart: '#3b0764',
    gradientEnd: '#581c87',
  },
  'editorial-deep': {
    accent: '#93c5fd',
    overlay: 'rgba(12, 18, 32, 0.28)',
    eyebrow: 'SmartScrolling',
    gradientStart: '#0f172a',
    gradientEnd: '#1e293b',
  },
  'science-brain': {
    accent: '#c4b5fd',
    overlay: 'rgba(16, 8, 28, 0.28)',
    eyebrow: 'Beyin ve Algi',
    gradientStart: '#100820',
    gradientEnd: '#221040',
  },
  'science-human-body': {
    accent: '#fca5a5',
    overlay: 'rgba(28, 8, 14, 0.28)',
    eyebrow: 'Insan Vucut',
    gradientStart: '#1c0810',
    gradientEnd: '#38101e',
  },
  'science-animals': {
    accent: '#6ee7b7',
    overlay: 'rgba(4, 22, 12, 0.28)',
    eyebrow: 'Hayvanlar Dunyasi',
    gradientStart: '#041c0e',
    gradientEnd: '#083820',
  },
  'science-insects': {
    accent: '#fcd34d',
    overlay: 'rgba(18, 14, 2, 0.28)',
    eyebrow: 'Bocekler',
    gradientStart: '#120e02',
    gradientEnd: '#241c04',
  },
  'science-evolution': {
    accent: '#86efac',
    overlay: 'rgba(8, 16, 6, 0.28)',
    eyebrow: 'Evrim',
    gradientStart: '#081006',
    gradientEnd: '#14280e',
  },
  'science-physics': {
    accent: '#7dd3fc',
    overlay: 'rgba(4, 10, 26, 0.28)',
    eyebrow: 'Fizik',
    gradientStart: '#030a1c',
    gradientEnd: '#0a1838',
  },
  'science-optics': {
    accent: '#f9a8d4',
    overlay: 'rgba(20, 6, 26, 0.28)',
    eyebrow: 'Isik ve Renk',
    gradientStart: '#14061a',
    gradientEnd: '#280e30',
  },
  'science-food': {
    accent: '#fdba74',
    overlay: 'rgba(24, 10, 4, 0.28)',
    eyebrow: 'Yiyecek Bilimi',
    gradientStart: '#180a04',
    gradientEnd: '#301410',
  },
  'science-ocean': {
    accent: '#22d3ee',
    overlay: 'rgba(1, 14, 24, 0.28)',
    eyebrow: 'Deniz ve Okyanus',
    gradientStart: '#010e18',
    gradientEnd: '#021e30',
  },
  'science-nature': {
    accent: '#4ade80',
    overlay: 'rgba(2, 14, 4, 0.28)',
    eyebrow: 'Doga',
    gradientStart: '#020e04',
    gradientEnd: '#062010',
  },
  'science-discovery': {
    accent: '#38bdf8',
    overlay: 'rgba(6, 12, 22, 0.28)',
    eyebrow: 'Kesif',
    gradientStart: '#060c16',
    gradientEnd: '#0e1c2a',
  },
  'history-invention': {
    imageKey: 'bg_quantum_pc',
    accent: '#fbbf24',
    overlay: 'rgba(20, 12, 0, 0.48)',
    eyebrow: 'Icatlar',
    gradientStart: '#140c00',
    gradientEnd: '#261800',
  },
  'history-culture': {
    imageKey: 'bg_rome_ruins',
    accent: '#d97706',
    overlay: 'rgba(30, 16, 4, 0.48)',
    eyebrow: 'Kultur ve Gelenek',
    gradientStart: '#1e1004',
    gradientEnd: '#3c200a',
  },
  'history-trade': {
    accent: '#f59e0b',
    overlay: 'rgba(22, 12, 0, 0.28)',
    eyebrow: 'Ticaret ve Toplum',
    gradientStart: '#160c00',
    gradientEnd: '#2e1a00',
  },
  'history-science': {
    accent: '#60a5fa',
    overlay: 'rgba(6, 10, 24, 0.28)',
    eyebrow: 'Bilim Tarihi',
    gradientStart: '#060a18',
    gradientEnd: '#10182e',
  },
  'philosophy-language': {
    accent: '#a78bfa',
    overlay: 'rgba(12, 8, 24, 0.28)',
    eyebrow: 'Dil ve Anlam',
    gradientStart: '#0c0818',
    gradientEnd: '#1a1030',
  },
  'technology-ai': {
    accent: '#2dd4bf',
    overlay: 'rgba(2, 18, 16, 0.28)',
    eyebrow: 'Yapay Zeka',
    gradientStart: '#021210',
    gradientEnd: '#062220',
  },
  'technology-energy': {
    accent: '#86efac',
    overlay: 'rgba(6, 16, 0, 0.28)',
    eyebrow: 'Enerji',
    gradientStart: '#061000',
    gradientEnd: '#102000',
  },
  'technology-engineering': {
    accent: '#fcd34d',
    overlay: 'rgba(14, 10, 0, 0.28)',
    eyebrow: 'Muhendislik',
    gradientStart: '#0e0a00',
    gradientEnd: '#201600',
  },
  'health-nutrition': {
    accent: '#fde68a',
    overlay: 'rgba(20, 12, 0, 0.24)',
    eyebrow: 'Beslenme',
    gradientStart: '#140c00',
    gradientEnd: '#281a00',
  },
  'health-genetics': {
    accent: '#818cf8',
    overlay: 'rgba(6, 8, 28, 0.24)',
    eyebrow: 'Genetik',
    gradientStart: '#06081c',
    gradientEnd: '#0e1438',
  },
  'health-lifestyle': {
    accent: '#6ee7b7',
    overlay: 'rgba(4, 16, 10, 0.24)',
    eyebrow: 'Yasam Tarzi',
    gradientStart: '#04100a',
    gradientEnd: '#08221a',
  },
  'editorial-trivia': {
    accent: '#fde68a',
    overlay: 'rgba(16, 10, 2, 0.28)',
    eyebrow: 'Ilginc Bilgi',
    gradientStart: '#100a02',
    gradientEnd: '#201808',
  },
  'editorial-wonder': {
    accent: '#bae6fd',
    overlay: 'rgba(4, 6, 16, 0.28)',
    eyebrow: 'Hayret Verici',
    gradientStart: '#040610',
    gradientEnd: '#0a1022',
  },
  'editorial-culture': {
    imageKey: 'bg_stoic_statue',
    accent: '#d8b4fe',
    overlay: 'rgba(20, 12, 30, 0.42)',
    eyebrow: 'Kultur ve Sanat',
    gradientStart: '#140c1e',
    gradientEnd: '#241a34',
  },
  'editorial-everyday': {
    accent: '#94a3b8',
    overlay: 'rgba(10, 12, 16, 0.28)',
    eyebrow: 'Gunluk Hayat',
    gradientStart: '#0a0c10',
    gradientEnd: '#1a1e26',
  },
  'editorial-curious': {
    accent: '#818cf8',
    overlay: 'rgba(8, 6, 18, 0.28)',
    eyebrow: 'Merak Edilesi',
    gradientStart: '#080612',
    gradientEnd: '#141028',
  },
  'science-materials': {
    imageKey: 'bg_quantum_pc',
    accent: '#94a3b8',
    overlay: 'rgba(8, 12, 20, 0.44)',
    eyebrow: 'Madde Bilimi',
    gradientStart: '#080c14',
    gradientEnd: '#121e2e',
  },
  'science-cosmos-solar': {
    imageKey: 'bg_black_hole',
    accent: '#fbbf24',
    overlay: 'rgba(20, 10, 2, 0.44)',
    eyebrow: 'Gunes Sistemi',
    gradientStart: '#1a0a00',
    gradientEnd: '#2d1500',
  },
};

export const failedRemoteImageUrls = new Set<string>();

export function resolveMediaSource(
  mediaUrl: string | null | undefined,
): ImageSourcePropType | null {
  if (!mediaUrl) {
    return null;
  }

  const normalized = mediaUrl.trim();

  if (!normalized || isBadFactMediaUrl(normalized)) {
    return null;
  }

  if (normalized.startsWith('http')) {
    return { uri: normalized };
  }

  return LOCAL_IMAGES[normalized] ?? null;
}

export function resolveRemoteMediaUrl(mediaUrl: string | null | undefined): string | null {
  if (!mediaUrl) {
    return null;
  }

  const normalized = mediaUrl.trim();

  if (!normalized || !normalized.startsWith('http') || isBadFactMediaUrl(normalized)) {
    return null;
  }

  if (normalized.includes('upload.wikimedia.org/')) {
    return normalized.replaceAll(/%2c/gi, ',');
  }

  return normalized;
}

export function getVisualPreset(item: FactType) {
  return VISUAL_PRESETS[item.visual_key ?? 'editorial-deep'] ?? VISUAL_PRESETS['editorial-deep'];
}

export function resolveFactMedia(fact: FactType): {
  uri: string | null;
  localSource: ImageSourcePropType | null;
} {
  const remote = resolveRemoteMediaUrl(fact.media_url);
  if (remote && !failedRemoteImageUrls.has(remote)) {
    return { uri: remote, localSource: null };
  }

  const local = remote ? null : resolveMediaSource(fact.media_url);
  if (local) return { uri: null, localSource: local };

  // Görsel yoksa, ön ayarın yerel görseli (varsa) kullanılır.
  if (fact.visual_key) {
    const imageKey = VISUAL_PRESETS[fact.visual_key]?.imageKey;
    if (imageKey) return { uri: null, localSource: LOCAL_IMAGES[imageKey] ?? null };
  }
  return { uri: null, localSource: null };
}
