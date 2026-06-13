import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useIsFocused } from '@react-navigation/native';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { Image as ExpoImage } from 'expo-image';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  AppState,
  Easing,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import type { ImageSourcePropType, LayoutChangeEvent, ViewToken } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { PremiumUpsellCard } from '../../components/premium-upsell-card';
import { type FeedAdSlot, getAdAudience, insertFeedAdSlots } from '../../src/lib/ads';
import { promptForAuth } from '../../src/lib/authPrompt';
import { isBadFactMediaUrl } from '../../src/lib/factVisuals';
import { reconcileDailyLocalReminder } from '../../src/lib/notifications';
import { promptForPremium } from '../../src/lib/premiumPrompt';
import { fetchActivitySummary, incrementDailyActivity } from '../../src/lib/userActivity';
import { useAuthStore } from '../../src/store/authStore';
import { useFeedStore } from '../../src/store/feedStore';
import { useOnboardingStore } from '../../src/store/onboardingStore';
import type { FactType } from '../../src/types';

const LOCAL_IMAGES: Record<string, ImageSourcePropType> = {
  bg_black_hole: require('../../assets/images/bg_black_hole.png'),
  bg_rome_ruins: require('../../assets/images/bg_rome_ruins.png'),
  bg_stoic_statue: require('../../assets/images/bg_stoic_statue.png'),
  bg_quantum_pc: require('../../assets/images/bg_quantum_pc.png'),
};

const VISUAL_PRESETS: Record<
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

const failedRemoteImageUrls = new Set<string>();
const BACK_TO_TOP_VISIBLE_INDEX = 3;

function resolveMediaSource(mediaUrl: string | null | undefined): ImageSourcePropType | null {
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

function resolveRemoteMediaUrl(mediaUrl: string | null | undefined): string | null {
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

function getVisualPreset(item: FactType) {
  return VISUAL_PRESETS[item.visual_key ?? 'editorial-deep'] ?? VISUAL_PRESETS['editorial-deep'];
}

function FeedFallbackVisual({ item, showCopy = false }: { item: FactType; showCopy?: boolean }) {
  const preset = getVisualPreset(item);
  const fallbackImage = preset.imageKey ? LOCAL_IMAGES[preset.imageKey] : null;

  return (
    <View style={[StyleSheet.absoluteFillObject, { backgroundColor: preset.gradientStart }]}>
      {fallbackImage ? (
        <Image source={fallbackImage} style={s.backgroundImage} resizeMode="cover" />
      ) : null}
      <View
        style={[
          StyleSheet.absoluteFillObject,
          {
            backgroundColor: preset.overlay,
          },
        ]}
      />
      <View
        style={[
          s.fallbackGlow,
          {
            backgroundColor: preset.accent,
            top: '12%',
            right: -40,
          },
        ]}
      />
      <View
        style={[
          s.fallbackGlowSecondary,
          {
            borderColor: `${preset.accent}55`,
            bottom: '18%',
            left: -30,
          },
        ]}
      />
      {showCopy ? (
        <View style={s.fallbackCopyWrap}>
          <Text style={[s.fallbackEyebrow, { color: preset.accent }]}>{preset.eyebrow}</Text>
          <Text style={s.fallbackTitle} numberOfLines={3}>
            {item.title}
          </Text>
          <Text style={s.fallbackSubcopy} numberOfLines={3}>
            {item.source_label ?? item.category}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function rotateFacts<T>(items: T[], seed: number): T[] {
  if (items.length <= 1) {
    return items;
  }

  const hash = (value: string) => {
    let result = seed || 1;

    for (let index = 0; index < value.length; index += 1) {
      result = (result * 33 + value.charCodeAt(index)) % 2147483647;
    }

    return result;
  };

  return [...items].sort((left, right) => hash(JSON.stringify(left)) - hash(JSON.stringify(right)));
}

function buildStableFeedOrder(items: FactType[], previous: FactType[], seed: number) {
  const previousIds = new Set(previous.map((item) => item.id));
  const nextIds = new Set(items.map((item) => item.id));
  const nextById = new Map(items.map((item) => [item.id, item]));

  const preserved = previous.map((item) => item.id).filter((id) => nextIds.has(id));
  const fresh = rotateFacts(
    items.filter((item) => !previousIds.has(item.id)),
    seed,
  ).map((item) => item.id);

  return [...preserved, ...fresh]
    .map((id) => nextById.get(id))
    .filter((item): item is FactType => Boolean(item));
}

type FactReviewVerdict = 'good' | 'bad' | 'unsure';

type FactReviewTag =
  | 'not_snackable'
  | 'not_interesting'
  | 'too_generic'
  | 'title_weak'
  | 'content_weak'
  | 'category_mismatch'
  | 'image_irrelevant'
  | 'image_low_value'
  | 'language_awkward'
  | 'duplicate_feeling';

type FactReviewDraft = {
  verdict: FactReviewVerdict | null;
  comment: string;
  tags: FactReviewTag[];
  reviewedAt: string;
};

type FactReviewExportEntry = FactReviewDraft & {
  factId: string;
  title: string;
  category: string;
  sourceLabel: string | null;
  visualKey: string | null;
};

const RING_SIZE = 46;
const RING_TICK_COUNT = 18;
const RING_TICK_SIZE = 4;
const RING_TICK_IDS = Array.from({ length: RING_TICK_COUNT }, (_, index) => `ring-tick-${index}`);
const READ_QUALIFICATION_RATIO = 0.35;
const READ_QUALIFICATION_MIN_MS = 2000;
const READ_QUALIFICATION_MAX_MS = 5000;

function getRingTickPosition(index: number) {
  const angle = (Math.PI * 2 * index) / RING_TICK_COUNT - Math.PI / 2;
  const radius = RING_SIZE / 2 - 5;

  return {
    left: RING_SIZE / 2 + Math.cos(angle) * radius - RING_TICK_SIZE / 2,
    top: RING_SIZE / 2 + Math.sin(angle) * radius - RING_TICK_SIZE / 2,
  };
}

function getProgressColor(progress: number) {
  if (progress >= 0.9) {
    return '#22c55e';
  }

  if (progress >= 0.65) {
    return '#65a30d';
  }

  if (progress >= 0.35) {
    return '#84cc16';
  }

  return '#9ca3af';
}

function getReadQualificationProgress(durationMs: number) {
  const qualifiedMs = Math.min(
    READ_QUALIFICATION_MAX_MS,
    Math.max(READ_QUALIFICATION_MIN_MS, durationMs * READ_QUALIFICATION_RATIO),
  );

  return Math.min(qualifiedMs / durationMs, 1);
}

function ActivityRing({ progress }: { progress: number }) {
  const normalizedProgress = Math.max(0, Math.min(progress, 1));
  const animatedProgress = useRef(new Animated.Value(0)).current;
  const [displayedProgress, setDisplayedProgress] = useState(0);
  const activeTicks = Math.round(displayedProgress * RING_TICK_COUNT);
  const activeColor = getProgressColor(displayedProgress);

  useEffect(() => {
    const listenerId = animatedProgress.addListener(({ value }) => {
      setDisplayedProgress(Math.max(0, Math.min(value, 1)));
    });

    return () => {
      animatedProgress.removeListener(listenerId);
    };
  }, [animatedProgress]);

  useEffect(() => {
    animatedProgress.stopAnimation();

    Animated.timing(animatedProgress, {
      toValue: normalizedProgress,
      duration: 460,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [animatedProgress, normalizedProgress]);

  return (
    <View style={s.activityRing}>
      {RING_TICK_IDS.map((tickId, index) => {
        const isActive = index < activeTicks;
        return (
          <View
            key={tickId}
            style={[
              s.activityRingTick,
              getRingTickPosition(index),
              { backgroundColor: isActive ? activeColor : 'rgba(148,163,184,0.34)' },
            ]}
          />
        );
      })}
    </View>
  );
}

type FeedListItem = FactType | FeedAdSlot;

function isFeedAdSlot(item: FeedListItem): item is FeedAdSlot {
  return 'slotType' in item && item.slotType === 'ad';
}

const REVIEW_TAG_OPTIONS: Array<{ value: FactReviewTag; label: string }> = [
  { value: 'not_snackable', label: 'Hap bilgi degil' },
  { value: 'not_interesting', label: 'Merak uyandirmiyor' },
  { value: 'too_generic', label: 'Fazla genel' },
  { value: 'title_weak', label: 'Baslik zayif' },
  { value: 'content_weak', label: 'Icerik zayif' },
  { value: 'category_mismatch', label: 'Kategori yanlis' },
  { value: 'image_irrelevant', label: 'Gorsel alakasiz' },
  { value: 'image_low_value', label: 'Gorsel dusuk degerli' },
  { value: 'language_awkward', label: 'Dil yapay' },
  { value: 'duplicate_feeling', label: 'Tekrar hissi' },
];

function FeedAdCard({
  height,
  slot,
  tabBarHeight,
  bottomInset,
  onNext,
}: {
  height: number;
  slot: FeedAdSlot;
  tabBarHeight: number;
  bottomInset: number;
  onNext: () => void;
}) {
  const cardBottomOffset = tabBarHeight + Math.max(bottomInset, Platform.OS === 'ios' ? 12 : 8);
  const isNativeSlot = slot.kind === 'inline_video';

  const renderBanner = () => {
    return (
      <View style={s.adFallbackBox}>
        <Text style={s.adFallbackText}>
          {isNativeSlot
            ? 'Inline native reklam slotu'
            : 'Test banner slotu - native AdMob render kapali'}
        </Text>
      </View>
    );
  };

  return (
    <View style={[s.adScreen, { height, paddingBottom: cardBottomOffset + 20 }]}>
      <View style={s.adCard}>
        <Text style={s.adEyebrow}>
          {slot.audience === 'guest' ? 'Misafir reklami' : 'Free reklam'}
        </Text>
        <Text style={s.adTitle}>
          {isNativeSlot ? 'Video destekli reklam alani' : 'Sponsorlu alan'}
        </Text>
        <Text style={s.adBody}>
          Premium'a gecince feed reklamlarini kaldirabilir, kitaplik ve AI deneyimini daha derin
          kullanabilirsin.
        </Text>
        <View style={s.adUnitWrap}>{renderBanner()}</View>
        <TouchableOpacity onPress={onNext} style={s.adContinueButton}>
          <Text style={s.adContinueText}>Akisa Devam Et</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

type FullScreenFactCardProps = {
  item: FactType;
  isActive: boolean;
  height: number;
  onFinish: () => void;
  onReadQualified: (factId: string) => void;
  toggleLike: (id: string) => void;
  toggleSave: (id: string) => void;
  isLiked: boolean;
  isSaved: boolean;
  tabBarHeight: number;
  bottomInset: number;
  topInset: number;
  onExpandedChange: (expanded: boolean) => void;
  isReviewMode: boolean;
  reviewVerdict: FactReviewVerdict | null;
  onOpenReview: (fact: FactType) => void;
};

function FullScreenFactCard({
  item,
  isActive,
  height,
  onFinish,
  onReadQualified,
  toggleLike,
  toggleSave,
  isLiked,
  isSaved,
  tabBarHeight,
  bottomInset,
  topInset,
  onExpandedChange,
  isReviewMode,
  reviewVerdict,
  onOpenReview,
}: FullScreenFactCardProps) {
  const progress = useRef(new Animated.Value(0)).current;
  const progressValue = useRef(0);
  const qualifiedReadFactId = useRef<string | null>(null);
  const duration = (item.read_time_sq || 15) * 1000;
  const readQualificationProgress = getReadQualificationProgress(duration);
  const cardBottomOffset = tabBarHeight + Math.max(bottomInset, Platform.OS === 'ios' ? 12 : 8);
  const collapsedBottomOffset = cardBottomOffset + (Platform.OS === 'android' ? 32 : 22);
  const cardTopOffset = Math.max(topInset + 72, 96);
  const expandedCardTopOffset = Math.max(topInset + 112, 128);
  const isTightCard = height < 680;
  const isCompactCard = height < 760;
  const previewLineCount = isTightCard ? 3 : isCompactCard ? 4 : 5;
  const remoteMediaUrl = resolveRemoteMediaUrl(item.media_url);
  const isRemoteUrlBlocked = remoteMediaUrl ? failedRemoteImageUrls.has(remoteMediaUrl) : false;
  const visualPreset = getVisualPreset(item);
  const [imageSource, setImageSource] = useState<ImageSourcePropType | null>(
    resolveMediaSource(item.media_url),
  );
  const [isImageReady, setIsImageReady] = useState(false);
  const [imageLoadState, setImageLoadState] = useState<
    'none' | 'pending' | 'ready' | 'retry-native' | 'error'
  >(imageSource ? 'pending' : 'none');
  const [isExpanded, setIsExpanded] = useState(false);
  const [isPressing, setIsPressing] = useState(false);
  const isPaused = isExpanded || isPressing;
  const hasLoggedImagePerf = useRef(false);
  const imageDebugMode = !imageSource
    ? 'fallback-no-media'
    : remoteMediaUrl
      ? isRemoteUrlBlocked
        ? 'remote-blocked'
        : imageLoadState === 'ready'
          ? 'remote'
          : imageLoadState === 'retry-native'
            ? 'remote-native-retry'
            : imageLoadState === 'error'
              ? 'remote-error'
              : 'remote-pending'
      : imageLoadState === 'ready'
        ? 'local'
        : imageLoadState === 'error'
          ? 'local-error'
          : 'local-pending';

  useEffect(() => {
    const nextImageSource = resolveMediaSource(item.media_url);
    setImageSource(nextImageSource);
    setIsImageReady(false);
    setImageLoadState(nextImageSource && !isRemoteUrlBlocked ? 'pending' : 'none');
    hasLoggedImagePerf.current = false;
  }, [item.media_url, isRemoteUrlBlocked]);

  useEffect(() => {
    const listenerId = progress.addListener(({ value }) => {
      progressValue.current = value;

      if (
        isActive &&
        qualifiedReadFactId.current !== item.id &&
        value >= readQualificationProgress
      ) {
        qualifiedReadFactId.current = item.id;
        onReadQualified(item.id);
      }
    });

    return () => {
      progress.removeListener(listenerId);
    };
  }, [isActive, item.id, onReadQualified, progress, readQualificationProgress]);

  useEffect(() => {
    if (!isActive) {
      progress.stopAnimation();
      progress.setValue(0);
      progressValue.current = 0;
      setIsExpanded(false);
      setIsPressing(false);
      onExpandedChange(false);
      return;
    }

    progress.stopAnimation((value) => {
      progressValue.current = value;

      if (isPaused) {
        return;
      }

      const remainingDuration = Math.max(duration - duration * value, 0);

      Animated.timing(progress, {
        toValue: 1,
        duration: remainingDuration,
        useNativeDriver: false,
      }).start(({ finished }) => {
        if (finished && progressValue.current === 1) {
          onFinish();
        }
      });
    });
  }, [duration, isActive, isPaused, onExpandedChange, onFinish, progress]);

  useEffect(() => {
    onExpandedChange(isExpanded);
  }, [isExpanded, onExpandedChange]);

  return (
    <View
      style={[
        s.cardOuter,
        {
          height,
          backgroundColor: visualPreset.gradientStart,
        },
      ]}
      onTouchStart={() => setIsPressing(true)}
      onTouchEnd={() => setIsPressing(false)}
      onTouchCancel={() => setIsPressing(false)}
    >
      <FeedFallbackVisual item={item} />
      {imageSource && !isRemoteUrlBlocked ? (
        <View style={StyleSheet.absoluteFillObject}>
          {remoteMediaUrl && imageLoadState !== 'error' ? (
            imageLoadState === 'retry-native' ? (
              <Image
                key={`${item.id}-native`}
                source={{ uri: remoteMediaUrl }}
                style={[s.backgroundImage, !isImageReady ? s.backgroundImageHidden : null]}
                resizeMode="cover"
                onLoad={() => {
                  setIsImageReady(true);
                  setImageLoadState('ready');
                  if (!hasLoggedImagePerf.current) {
                    hasLoggedImagePerf.current = true;
                    console.log(
                      `[Perf][FeedImage] fact=${item.id} title="${item.title}" loaded=remote-native`,
                    );
                  }
                }}
                onError={() => {
                  setIsImageReady(false);
                  setImageLoadState('error');
                  failedRemoteImageUrls.add(remoteMediaUrl);
                  console.log(
                    `[Perf][FeedImage] fact=${item.id} title="${item.title}" failed=remote-native url="${remoteMediaUrl}"`,
                  );
                }}
              />
            ) : (
              <ExpoImage
                recyclingKey={item.id}
                source={remoteMediaUrl}
                style={[s.backgroundImage, !isImageReady ? s.backgroundImageHidden : null]}
                contentFit="cover"
                cachePolicy="memory-disk"
                transition={120}
                onLoad={() => {
                  setIsImageReady(true);
                  setImageLoadState('ready');
                  if (!hasLoggedImagePerf.current) {
                    hasLoggedImagePerf.current = true;
                    console.log(
                      `[Perf][FeedImage] fact=${item.id} title="${item.title}" loaded=remote`,
                    );
                  }
                }}
                onError={() => {
                  setIsImageReady(false);
                  setImageLoadState('retry-native');
                  console.log(
                    `[Perf][FeedImage] fact=${item.id} title="${item.title}" failed=remote url="${remoteMediaUrl}"`,
                  );
                }}
              />
            )
          ) : !remoteMediaUrl ? (
            <Image
              key={item.id}
              source={imageSource}
              style={[s.backgroundImage, !isImageReady ? s.backgroundImageHidden : null]}
              resizeMode="cover"
              onLoad={() => {
                setIsImageReady(true);
                setImageLoadState('ready');
                if (!hasLoggedImagePerf.current) {
                  hasLoggedImagePerf.current = true;
                  console.log(
                    `[Perf][FeedImage] fact=${item.id} title="${item.title}" loaded=local`,
                  );
                }
              }}
              onError={() => {
                setIsImageReady(false);
                setImageLoadState('error');
                console.log(`[Perf][FeedImage] fact=${item.id} title="${item.title}" failed=local`);
              }}
            />
          ) : null}
        </View>
      ) : null}

      <View style={s.overlay} />

      <View
        style={[
          s.infoContainer,
          isExpanded ? s.infoContainerExpanded : null,
          isExpanded
            ? { top: expandedCardTopOffset, bottom: cardBottomOffset + 24 }
            : { bottom: collapsedBottomOffset },
        ]}
      >
        <View style={s.catBadge}>
          <Text style={s.catBadgeText}>{item.category}</Text>
        </View>
        {isReviewMode ? (
          <View style={s.imageDebugBadge}>
            <Text style={s.imageDebugBadgeText}>
              {imageDebugMode} / {item.visual_key ?? 'no-key'}
            </Text>
          </View>
        ) : null}
        {isReviewMode ? (
          <View style={s.reviewToolbar}>
            <TouchableOpacity onPress={() => onOpenReview(item)} style={s.reviewButton}>
              <Text style={s.reviewButtonText}>Review</Text>
            </TouchableOpacity>
            {reviewVerdict ? (
              <View
                style={[
                  s.reviewVerdictBadge,
                  reviewVerdict === 'good'
                    ? s.reviewVerdictGood
                    : reviewVerdict === 'bad'
                      ? s.reviewVerdictBad
                      : s.reviewVerdictUnsure,
                ]}
              >
                <Text style={s.reviewVerdictText}>{reviewVerdict}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {isExpanded ? (
          <View style={s.expandedContentWrap}>
            <View style={s.expandedHeaderRow}>
              <Text style={s.cardTitleExpanded}>{item.title}</Text>
              <TouchableOpacity onPress={() => setIsExpanded(false)} style={s.collapseButton}>
                <Text style={s.collapseButtonText}>Kapat</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              style={s.expandedScroll}
              nestedScrollEnabled
              onMoveShouldSetResponder={() => true}
              onStartShouldSetResponder={() => true}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={s.expandedScrollContent}
            >
              <Text style={s.cardTextExpanded}>{item.content}</Text>

              {item.source_url ? (
                <TouchableOpacity
                  onPress={() => item.source_url && Linking.openURL(item.source_url)}
                >
                  <Text style={s.cardSource}>
                    Kaynak: {item.source_label} {'->'}
                  </Text>
                </TouchableOpacity>
              ) : (
                <Text style={s.cardSource}>Kaynak: {item.source_label}</Text>
              )}

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.tagsRow}
              >
                {item.tags.map((tag: string, index: number) => (
                  <View key={`${item.id}-tag-${tag}-${index}`} style={s.cardTagInfo}>
                    <Text style={s.cardTagInfoText}>#{tag}</Text>
                  </View>
                ))}
              </ScrollView>
            </ScrollView>
          </View>
        ) : (
          <Pressable onPress={() => setIsExpanded(true)} style={s.collapsedPressArea}>
            <Text style={s.cardTitle} numberOfLines={2}>
              {item.title}
            </Text>
            <Text
              style={[s.cardTextPreview, isCompactCard ? s.cardTextPreviewCompact : null]}
              numberOfLines={previewLineCount}
            >
              {item.content}
            </Text>
            <Text style={s.expandHint}>Devamini okumak icin dokun</Text>

            {item.source_url ? (
              <TouchableOpacity onPress={() => item.source_url && Linking.openURL(item.source_url)}>
                <Text style={s.cardSource}>
                  Kaynak: {item.source_label} {'->'}
                </Text>
              </TouchableOpacity>
            ) : (
              <Text style={s.cardSource}>Kaynak: {item.source_label}</Text>
            )}

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.tagsRow}
            >
              {item.tags.map((tag: string, index: number) => (
                <View key={`${item.id}-tag-${tag}-${index}`} style={s.cardTagInfo}>
                  <Text style={s.cardTagInfoText}>#{tag}</Text>
                </View>
              ))}
            </ScrollView>
          </Pressable>
        )}
      </View>

      {!isExpanded ? (
        <View style={[s.actionContainer, { bottom: collapsedBottomOffset }]}>
          <TouchableOpacity style={s.actionBtnVertical} onPress={() => toggleLike(item.id)}>
            <Text style={s.actionEmoji}>{isLiked ? '❤️' : '🤍'}</Text>
            <Text style={s.actionLabel}>{(item.likes || 0) + (isLiked ? 1 : 0)}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.actionBtnVertical} onPress={() => toggleSave(item.id)}>
            <Text style={s.actionEmoji}>{isSaved ? '🔖' : '📑'}</Text>
            <Text style={s.actionLabel}>Kaydet</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.actionBtnVertical}>
            <Text style={s.actionEmoji}>↗</Text>
            <Text style={s.actionLabel}>Paylas</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={[s.progressBarBg, { bottom: cardBottomOffset }]}>
        <Animated.View
          style={[
            s.progressBarFill,
            {
              width: progress.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
      </View>
    </View>
  );
}

export default function FeedScreen() {
  const isFocused = useIsFocused();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const { height: windowHeight } = useWindowDimensions();
  const flatListRef = useRef<FlashListRef<FeedListItem> | null>(null);
  const appStateRef = useRef(AppState.currentState);
  const feedScreenOpenedAt = useRef(Date.now());
  const hasLoggedFirstCard = useRef(false);
  const activityTrackedFactIdsRef = useRef<Set<string>>(new Set());
  const todayFactsReadRef = useRef(0);
  const [activeFactId, setActiveFactId] = useState<string | null>(null);
  const [activeFactIndex, setActiveFactIndex] = useState(0);
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const [orderedFacts, setOrderedFacts] = useState<FactType[]>([]);
  const [seenFactIds, setSeenFactIds] = useState<string[]>([]);
  const [dismissedFeedUpsell, setDismissedFeedUpsell] = useState(false);
  const [isReviewMode, setIsReviewMode] = useState(false);
  const [reviewTargetFact, setReviewTargetFact] = useState<FactType | null>(null);
  const [reviewDraft, setReviewDraft] = useState<{
    verdict: FactReviewVerdict | null;
    comment: string;
    tags: FactReviewTag[];
  }>({
    verdict: null,
    comment: '',
    tags: [],
  });
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewsByFactId, setReviewsByFactId] = useState<Record<string, FactReviewDraft>>({});
  const [feedStreakDays, setFeedStreakDays] = useState(0);
  const [todayFactsRead, setTodayFactsRead] = useState(0);
  const [measuredListHeight, setMeasuredListHeight] = useState(0);
  const listHeight = measuredListHeight > 0 ? measuredListHeight : windowHeight;

  const handleListWrapperLayout = useCallback((event: LayoutChangeEvent) => {
    const nextHeight = Math.round(event.nativeEvent.layout.height);

    if (nextHeight <= 0) {
      return;
    }

    setMeasuredListHeight((currentHeight) =>
      currentHeight === nextHeight ? currentHeight : nextHeight,
    );
  }, []);
  const orderingKeyRef = useRef<string>('');

  const {
    facts,
    isLoading,
    isLoadingMore,
    fetchFacts,
    loadMoreFacts,
    refreshFacts,
    likedIds,
    savedIds,
    toggleLike,
    toggleSave,
    feedRotationSeed,
    bumpFeedRotation,
  } = useFeedStore();
  const user = useAuthStore((state) => state.user);
  const hasPremium = useAuthStore((state) => state.hasPremium);
  const setPostAuthRedirectPath = useAuthStore((state) => state.setPostAuthRedirectPath);
  const dailyGoal = useOnboardingStore((state) => state.dailyGoal);
  const notificationsEnabled = useOnboardingStore((state) => state.notificationsEnabled);
  const notificationTime = useOnboardingStore((state) => state.notificationTime);
  const feedItems = insertFeedAdSlots(
    orderedFacts,
    getAdAudience({
      hasPremium,
      isAuthenticated: Boolean(user),
    }),
  );

  useEffect(() => {
    void fetchFacts({ reset: true });
  }, [fetchFacts]);

  useEffect(() => {
    todayFactsReadRef.current = todayFactsRead;
  }, [todayFactsRead]);

  useEffect(() => {
    let cancelled = false;

    if (!isFocused || !user?.id) {
      setFeedStreakDays(0);
      setTodayFactsRead(0);
      return;
    }

    void (async () => {
      const activitySummary = await fetchActivitySummary();

      if (!cancelled) {
        setFeedStreakDays(activitySummary.streakDays);
        setTodayFactsRead(activitySummary.today.factsRead);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isFocused, user?.id]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextState;

      if (isFocused && previousState.match(/inactive|background/) && nextState === 'active') {
        bumpFeedRotation();
        void refreshFacts();
        flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
      }
    });

    return () => {
      subscription.remove();
    };
  }, [bumpFeedRotation, isFocused, refreshFacts]);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken<FeedListItem>[] }) => {
      const firstViewableItem = viewableItems[0];
      const firstItem = firstViewableItem?.item;

      if (firstItem && isFeedAdSlot(firstItem)) {
        setActiveFactId(null);
      } else if (firstItem?.id) {
        setActiveFactId(firstItem.id);
      }

      if (typeof firstViewableItem?.index === 'number') {
        setActiveFactIndex(firstViewableItem.index);
      }
    },
  ).current;

  useEffect(() => {
    const orderingKey = `single:${feedRotationSeed}`;

    setOrderedFacts((previous) => {
      if (orderingKeyRef.current !== orderingKey) {
        orderingKeyRef.current = orderingKey;
        return rotateFacts(facts, feedRotationSeed);
      }

      return buildStableFeedOrder(facts, previous, feedRotationSeed);
    });
  }, [facts, feedRotationSeed]);

  useEffect(() => {
    if (!hasLoggedFirstCard.current && orderedFacts.length > 0) {
      hasLoggedFirstCard.current = true;
      console.log(
        `[Perf][FeedUI] first_card_visible_after_ms=${Date.now() - feedScreenOpenedAt.current} count=${orderedFacts.length}`,
      );
    }
  }, [orderedFacts]);

  useEffect(() => {
    if (!activeFactId) {
      return;
    }

    setSeenFactIds((current) =>
      current.includes(activeFactId) ? current : [...current, activeFactId],
    );
  }, [activeFactId]);

  const handleReadQualified = useCallback(
    (factId: string) => {
      if (activityTrackedFactIdsRef.current.has(factId)) {
        return;
      }

      activityTrackedFactIdsRef.current.add(factId);

      void (async () => {
        const result = await incrementDailyActivity({ factsRead: 1 });

        if (result.synced) {
          const nextFactsRead = todayFactsReadRef.current + 1;
          todayFactsReadRef.current = nextFactsRead;
          setFeedStreakDays((current) => Math.max(current, 1));
          setTodayFactsRead(nextFactsRead);

          if (notificationsEnabled) {
            await reconcileDailyLocalReminder({
              dailyGoalValue: dailyGoal?.value ?? null,
              enabled: notificationsEnabled,
              hour: notificationTime.hour,
              isStreakAtRiskToday: false,
              minute: notificationTime.minute,
              todayFactsRead: nextFactsRead,
            });
          }
        }
      })();
    },
    [dailyGoal?.value, notificationTime.hour, notificationTime.minute, notificationsEnabled],
  );

  const factDailyGoal = dailyGoal?.type === 'facts' ? dailyGoal.value : null;
  const todayProgressPercent = factDailyGoal
    ? Math.min(Math.round((todayFactsRead / factDailyGoal) * 100), 100)
    : 0;
  const todayProgressRatio = factDailyGoal ? todayProgressPercent / 100 : 0;
  const shouldShowFeedUpsell =
    Boolean(user) &&
    !hasPremium &&
    !dismissedFeedUpsell &&
    seenFactIds.length >= 12 &&
    !expandedCardId;
  const shouldShowBackToTop = activeFactIndex >= BACK_TO_TOP_VISIBLE_INDEX && !expandedCardId;
  const backToTopButtonTop = !user
    ? Math.max(insets.top + 92, Platform.OS === 'web' ? 88 : 104)
    : insets.top + 20;

  const openReviewForFact = (fact: FactType) => {
    const existingReview = reviewsByFactId[fact.id];
    setReviewTargetFact(fact);
    setReviewDraft({
      verdict: existingReview?.verdict ?? null,
      comment: existingReview?.comment ?? '',
      tags: existingReview?.tags ?? [],
    });
    setReviewError(null);
  };

  const closeReviewModal = () => {
    setReviewTargetFact(null);
    setReviewError(null);
  };

  const toggleReviewTag = (tag: FactReviewTag) => {
    setReviewDraft((current) => ({
      ...current,
      tags: current.tags.includes(tag)
        ? current.tags.filter((value) => value !== tag)
        : current.tags.length >= 2
          ? [...current.tags.slice(1), tag]
          : [...current.tags, tag],
    }));
  };

  const saveReviewDraft = () => {
    if (!reviewTargetFact || !reviewDraft.verdict) {
      setReviewError('Once bir karar sec.');
      return;
    }

    if (reviewDraft.verdict === 'bad' && !reviewDraft.comment.trim()) {
      setReviewError('Bad seciminde neden kotu oldugunu kisaca yaz.');
      return;
    }

    const nextReview: FactReviewDraft = {
      verdict: reviewDraft.verdict,
      comment: reviewDraft.comment.trim(),
      tags: reviewDraft.tags,
      reviewedAt: new Date().toISOString(),
    };

    setReviewsByFactId((current) => ({
      ...current,
      [reviewTargetFact.id]: nextReview,
    }));
    console.log(
      `[FeedReview] fact=${reviewTargetFact.id} verdict=${nextReview.verdict} tags=${nextReview.tags.join(',') || 'none'} comment="${nextReview.comment}"`,
    );
    closeReviewModal();
  };

  const handleExportReviews = async () => {
    const exportedReviews: FactReviewExportEntry[] = orderedFacts
      .filter((fact) => reviewsByFactId[fact.id])
      .map((fact) => ({
        factId: fact.id,
        title: fact.title,
        category: fact.category,
        sourceLabel: fact.source_label ?? null,
        visualKey: fact.visual_key ?? null,
        ...reviewsByFactId[fact.id],
      }));

    if (exportedReviews.length === 0) {
      Alert.alert('Review yok', 'Export edilecek en az bir review isaretle.');
      return;
    }

    const payload = {
      exportedAt: new Date().toISOString(),
      reviewCount: exportedReviews.length,
      reviews: exportedReviews,
    };

    await Share.share({
      title: 'SmartScrolling Feed Review Export',
      message: JSON.stringify(payload, null, 2),
    });
  };

  const handleFinish = (index: number, itemCount = orderedFacts.length) => {
    if (index < itemCount - 1) {
      flatListRef.current?.scrollToIndex({ index: index + 1, animated: true });
    }
  };

  const handleBackToTopRefresh = () => {
    setExpandedCardId(null);
    setActiveFactIndex(0);
    setActiveFactId(orderedFacts[0]?.id ?? null);
    bumpFeedRotation();
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    void refreshFacts();
  };

  const handleExpandedChange = (cardId: string, expanded: boolean) => {
    setExpandedCardId((current) => {
      if (expanded) {
        return cardId;
      }

      return current === cardId ? null : current;
    });
  };

  const handleToggleSave = (id: string) => {
    if (!user) {
      promptForAuth({
        onConfirm: () => {
          setPostAuthRedirectPath('/');
          router.push('/profile');
        },
        message: 'Kaydetme ve senkronizasyon icin once hesabina giris yap.',
      });
      return;
    }

    void toggleSave(id);
  };

  return (
    <View style={[s.container, Platform.OS === 'web' && !isFocused ? s.webHiddenScreen : null]}>
      <View
        onLayout={handleListWrapperLayout}
        style={[
          s.listWrapper,
          {
            maxWidth: Platform.OS === 'web' ? 500 : '100%',
            alignSelf: 'center',
            backgroundColor: '#000',
            width: '100%',
          },
        ]}
      >
        {isLoading ? (
          <View style={s.centerState}>
            <Text style={s.centerStateText}>Bilgiler Yukleniyor...</Text>
          </View>
        ) : orderedFacts.length === 0 ? (
          <View style={s.centerState}>
            <Text style={s.centerStateText}>Icerik bulunamadi.</Text>
          </View>
        ) : (
          <FlashList
            ref={flatListRef}
            data={feedItems}
            keyExtractor={(item) => item.id}
            refreshing={isLoading}
            onEndReached={() => {
              void loadMoreFacts();
            }}
            onEndReachedThreshold={0.65}
            onRefresh={() => {
              bumpFeedRotation();
              void refreshFacts();
            }}
            disableIntervalMomentum
            pagingEnabled
            snapToInterval={listHeight}
            snapToAlignment="start"
            scrollEnabled={!expandedCardId}
            showsVerticalScrollIndicator={false}
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
            ListFooterComponent={
              isLoadingMore ? (
                <View style={s.loadMoreFooter}>
                  <Text style={s.loadMoreText}>Daha fazla bilgi yukleniyor...</Text>
                </View>
              ) : null
            }
            renderItem={({ item, index }) => {
              if (isFeedAdSlot(item)) {
                return (
                  <FeedAdCard
                    height={listHeight}
                    slot={item}
                    tabBarHeight={tabBarHeight}
                    bottomInset={insets.bottom}
                    onNext={() => handleFinish(index, feedItems.length)}
                  />
                );
              }

              return (
                <FullScreenFactCard
                  item={item}
                  isActive={activeFactId === item.id}
                  height={listHeight}
                  onFinish={() => handleFinish(index, feedItems.length)}
                  onReadQualified={handleReadQualified}
                  toggleLike={toggleLike}
                  toggleSave={handleToggleSave}
                  isLiked={likedIds.includes(item.id)}
                  isSaved={savedIds.includes(item.id)}
                  tabBarHeight={tabBarHeight}
                  bottomInset={insets.bottom}
                  topInset={insets.top}
                  onExpandedChange={(expanded) => handleExpandedChange(item.id, expanded)}
                  isReviewMode={isReviewMode}
                  reviewVerdict={reviewsByFactId[item.id]?.verdict ?? null}
                  onOpenReview={openReviewForFact}
                />
              );
            }}
          />
        )}
      </View>

      {shouldShowFeedUpsell ? (
        <View style={[s.feedUpsellWrap, { bottom: tabBarHeight + Math.max(insets.bottom, 16) }]}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setDismissedFeedUpsell(true)}
            style={s.feedUpsellDismiss}
          >
            <Text style={s.feedUpsellDismissText}>Kapat</Text>
          </TouchableOpacity>
          <PremiumUpsellCard
            eyebrow="Reklamsiz Deneyim"
            title="Akisi reklamsiz ve daha derin kullan"
            body="Premium ile reklamsiz devam et, serbest AI sorulari sor ve tum kutuphaneyi ac. Bu yumusak kart ileride reklam sonrasi da ayni yerde kullanilacak."
            ctaLabel="Premiumu Incele"
            onPress={() =>
              promptForPremium({
                title: 'Reklamsiz premium deneyime gec',
                message:
                  'Premium ile akista reklamsiz devam edebilir, tum kutuphaneyi acabilir ve AI deneyimini derinlestirebilirsin.',
                onConfirm: () => router.push('/profile'),
              })
            }
          />
        </View>
      ) : null}

      {shouldShowBackToTop ? (
        <TouchableOpacity
          accessibilityLabel="Akisin basina don ve yenile"
          activeOpacity={0.82}
          onPress={handleBackToTopRefresh}
          style={[s.backToTopButton, { top: backToTopButtonTop }]}
        >
          <Text style={s.backToTopIcon}>↑</Text>
        </TouchableOpacity>
      ) : null}

      <View style={s.topOverlay} pointerEvents="box-none">
        <SafeAreaView edges={['top']} pointerEvents="box-none">
          <View style={s.topOverlayContent}>
            {__DEV__ ? (
              <Pressable
                accessibilityLabel="Toggle feed review mode"
                onLongPress={() => setIsReviewMode((current) => !current)}
                style={s.reviewModeHotspot}
              />
            ) : null}
            {!user && (
              <View style={s.guestHintWrap}>
                <Text style={s.guestHintText}>
                  Misafir modunda kesfet. Kaydetme ve AI gecmisi icin giris yap.
                </Text>
                <TouchableOpacity onPress={() => router.push('/profile')} style={s.guestHintButton}>
                  <Text style={s.guestHintButtonText}>Hesap Ac</Text>
                </TouchableOpacity>
              </View>
            )}
            {user ? (
              <View style={s.dailyProgressWrap}>
                <ActivityRing progress={todayProgressRatio} />
                <View style={s.dailyProgressCopy}>
                  <Text style={s.dailyProgressTitle}>
                    {factDailyGoal ? `${todayFactsRead}/${factDailyGoal} kart` : 'Hedef sec'}
                  </Text>
                  <Text style={s.dailyProgressMeta}>{feedStreakDays} gun seri</Text>
                </View>
              </View>
            ) : null}
            {isReviewMode ? (
              <View style={s.reviewModeTopbar}>
                <Text style={s.reviewModeTopbarText}>
                  {Object.keys(reviewsByFactId).length} review hazir
                </Text>
                <TouchableOpacity
                  onPress={() => void handleExportReviews()}
                  style={s.reviewModeExportButton}
                >
                  <Text style={s.reviewModeExportButtonText}>JSON Export</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        </SafeAreaView>
      </View>

      <Modal
        animationType="slide"
        transparent
        visible={Boolean(reviewTargetFact)}
        onRequestClose={closeReviewModal}
      >
        <View style={s.reviewModalBackdrop}>
          <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={closeReviewModal} />
          <View
            style={[
              s.reviewModalSheet,
              { paddingBottom: tabBarHeight + Math.max(insets.bottom, 20) },
            ]}
          >
            <View style={s.reviewModalHandle} />
            <Text style={s.reviewModalTitle}>Fact Review</Text>
            {reviewTargetFact ? (
              <>
                <Text style={s.reviewMetaText}>
                  {reviewTargetFact.category} · {reviewTargetFact.id}
                </Text>
                <Text numberOfLines={2} style={s.reviewFactTitle}>
                  {reviewTargetFact.title}
                </Text>

                <View style={s.reviewVerdictRow}>
                  {(['good', 'bad', 'unsure'] as FactReviewVerdict[]).map((verdict) => (
                    <TouchableOpacity
                      key={verdict}
                      onPress={() => {
                        setReviewDraft((current) => ({ ...current, verdict }));
                        setReviewError(null);
                      }}
                      style={[
                        s.reviewVerdictChoice,
                        reviewDraft.verdict === verdict ? s.reviewVerdictChoiceActive : null,
                      ]}
                    >
                      <Text
                        style={[
                          s.reviewVerdictChoiceText,
                          reviewDraft.verdict === verdict ? s.reviewVerdictChoiceTextActive : null,
                        ]}
                      >
                        {verdict}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={s.reviewSectionLabel}>Issue tags</Text>
                <View style={s.reviewTagsWrap}>
                  {REVIEW_TAG_OPTIONS.map((tag) => (
                    <TouchableOpacity
                      key={tag.value}
                      onPress={() => toggleReviewTag(tag.value)}
                      style={[
                        s.reviewTagChip,
                        reviewDraft.tags.includes(tag.value) ? s.reviewTagChipActive : null,
                      ]}
                    >
                      <Text
                        style={[
                          s.reviewTagChipText,
                          reviewDraft.tags.includes(tag.value) ? s.reviewTagChipTextActive : null,
                        ]}
                      >
                        {tag.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={s.reviewSectionLabel}>Comment</Text>
                <TextInput
                  multiline
                  onChangeText={(comment) => {
                    setReviewDraft((current) => ({ ...current, comment }));
                    if (reviewError) {
                      setReviewError(null);
                    }
                  }}
                  placeholder="Kotuysa neden kotu oldugunu kisaca yaz..."
                  placeholderTextColor="#71717a"
                  style={s.reviewCommentInput}
                  value={reviewDraft.comment}
                />

                {reviewError ? <Text style={s.reviewErrorText}>{reviewError}</Text> : null}

                <View style={s.reviewActionsRow}>
                  <TouchableOpacity onPress={closeReviewModal} style={s.reviewSecondaryButton}>
                    <Text style={s.reviewSecondaryButtonText}>Vazgec</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={saveReviewDraft} style={s.reviewPrimaryButton}>
                    <Text style={s.reviewPrimaryButtonText}>Kaydet</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', overflow: 'hidden' },
  listWrapper: { flex: 1, overflow: 'hidden' },
  adScreen: {
    alignItems: 'center',
    backgroundColor: '#020617',
    justifyContent: 'center',
    paddingHorizontal: 22,
    width: '100%',
  },
  adCard: {
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderColor: 'rgba(148,163,184,0.28)',
    borderRadius: 18,
    borderWidth: 1,
    gap: 12,
    maxWidth: 360,
    padding: 18,
    width: '100%',
  },
  adEyebrow: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  adTitle: {
    color: '#f8fafc',
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  adBody: {
    color: '#cbd5e1',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  adUnitWrap: {
    alignItems: 'center',
    backgroundColor: '#111827',
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 250,
    overflow: 'hidden',
    width: '100%',
  },
  adFallbackBox: {
    alignItems: 'center',
    height: 250,
    justifyContent: 'center',
    paddingHorizontal: 16,
    width: '100%',
  },
  adFallbackText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  adContinueButton: {
    alignItems: 'center',
    backgroundColor: '#8b5cf6',
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  adContinueText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  cardOuter: {
    width: '100%',
    overflow: 'hidden',
  },
  backgroundImage: {
    width: '100%',
    height: '100%',
  },
  backgroundImageHidden: {
    opacity: 0,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  infoContainer: {
    position: 'absolute',
    left: 16,
    right: 80,
    justifyContent: 'flex-end',
  },
  infoContainerExpanded: {
    left: 16,
    right: 16,
    paddingTop: 8,
  },
  catBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 8,
  },
  catBadgeText: { fontSize: 11, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },
  imageDebugBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,0,0,0.34)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 10,
  },
  imageDebugBadgeText: {
    color: '#d1d5db',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  reviewToolbar: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  reviewButton: {
    backgroundColor: 'rgba(139,92,246,0.22)',
    borderColor: 'rgba(196,181,253,0.45)',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  reviewButtonText: {
    color: '#f5f3ff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  reviewVerdictBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  reviewVerdictGood: { backgroundColor: 'rgba(34,197,94,0.2)' },
  reviewVerdictBad: { backgroundColor: 'rgba(248,113,113,0.2)' },
  reviewVerdictUnsure: { backgroundColor: 'rgba(251,191,36,0.2)' },
  reviewVerdictText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  collapsedPressArea: {
    alignSelf: 'stretch',
  },
  expandedContentWrap: {
    flex: 1,
  },
  expandedHeaderRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    marginBottom: 14,
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 12,
    lineHeight: 30,
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  cardTitleExpanded: {
    color: '#fff',
    flex: 1,
    fontSize: 24,
    fontWeight: '800',
    lineHeight: 31,
    marginRight: 12,
  },
  cardTextPreview: {
    color: 'rgba(255,255,255,0.95)',
    fontSize: 15,
    lineHeight: 22,
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 5,
  },
  cardTextPreviewCompact: {
    fontSize: 14,
    lineHeight: 20,
  },
  cardTextExpanded: {
    color: 'rgba(255,255,255,0.96)',
    fontSize: 16,
    lineHeight: 25,
    paddingBottom: 12,
  },
  expandedScroll: {
    flex: 1,
  },
  expandedScrollContent: {
    paddingBottom: 8,
  },
  collapseButton: {
    backgroundColor: 'rgba(0,0,0,0.28)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  collapseButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  expandHint: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 10,
  },
  tagsRow: { flexDirection: 'row', gap: 8, marginTop: 12, flexGrow: 0 },
  cardTagInfo: {
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  cardTagInfoText: { fontSize: 12, color: '#fff', fontWeight: '700' },
  cardSource: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 16, fontWeight: '600' },
  actionContainer: {
    position: 'absolute',
    right: 12,
    alignItems: 'center',
    gap: 24,
  },
  actionBtnVertical: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionEmoji: {
    fontSize: 24,
    marginBottom: 4,
  },
  actionLabel: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 5,
  },
  progressBarBg: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    zIndex: 10,
  },
  progressBarFill: { height: '100%', backgroundColor: '#fff', borderRadius: 2 },
  topOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingBottom: 16,
    zIndex: 100,
  },
  topOverlayContent: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  reviewModeHotspot: {
    height: 44,
    left: 8,
    position: 'absolute',
    top: 4,
    width: 44,
  },
  guestHintWrap: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
    maxWidth: 360,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  guestHintText: { color: '#fff', flex: 1, fontSize: 12, fontWeight: '600' },
  guestHintButton: {
    backgroundColor: '#8b5cf6',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  guestHintButtonText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  dailyProgressWrap: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.62)',
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 9,
    marginLeft: 12,
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    alignSelf: 'flex-start',
  },
  dailyProgressCopy: {
    gap: 2,
    paddingRight: 3,
  },
  dailyProgressTitle: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  dailyProgressMeta: {
    color: '#bbf7d0',
    fontSize: 11,
    fontWeight: '800',
  },
  activityRing: {
    height: RING_SIZE,
    width: RING_SIZE,
  },
  activityRingTick: {
    borderRadius: 999,
    height: RING_TICK_SIZE,
    position: 'absolute',
    width: RING_TICK_SIZE,
  },
  reviewModeTopbar: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: 'rgba(10,10,12,0.82)',
    borderColor: 'rgba(167,139,250,0.3)',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  reviewModeTopbarText: {
    color: '#f5f3ff',
    fontSize: 12,
    fontWeight: '700',
  },
  reviewModeExportButton: {
    backgroundColor: 'rgba(139,92,246,0.24)',
    borderColor: 'rgba(196,181,253,0.4)',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  reviewModeExportButtonText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  feedUpsellWrap: {
    left: 0,
    position: 'absolute',
    right: 0,
    zIndex: 20,
  },
  feedUpsellDismiss: {
    alignSelf: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.68)',
    borderRadius: 999,
    marginBottom: 8,
    marginRight: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  feedUpsellDismissText: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: '700',
  },
  backToTopButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderColor: 'rgba(0,0,0,0.12)',
    borderRadius: 999,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    position: 'absolute',
    right: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    width: 44,
    zIndex: 80,
  },
  backToTopIcon: {
    color: '#111',
    fontSize: 24,
    fontWeight: '900',
    lineHeight: 28,
  },
  webHiddenScreen: {
    display: 'none',
  },
  loadMoreFooter: {
    alignItems: 'center',
    backgroundColor: '#000',
    justifyContent: 'center',
    minHeight: 80,
  },
  loadMoreText: {
    color: '#8e8e93',
    fontSize: 13,
    fontWeight: '600',
  },
  centerState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerStateText: {
    color: '#8e8e93',
    fontSize: 16,
  },
  fallbackCopyWrap: {
    bottom: 44,
    left: 18,
    position: 'absolute',
    right: 24,
  },
  fallbackEyebrow: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  fallbackTitle: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 34,
    maxWidth: '92%',
  },
  fallbackSubcopy: {
    color: 'rgba(255,255,255,0.74)',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    marginTop: 12,
    maxWidth: '84%',
  },
  fallbackGlow: {
    borderRadius: 999,
    height: 220,
    opacity: 0.2,
    position: 'absolute',
    width: 220,
  },
  fallbackGlowSecondary: {
    borderRadius: 999,
    borderWidth: 1,
    height: 180,
    opacity: 0.7,
    position: 'absolute',
    width: 180,
  },
  reviewModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  reviewModalSheet: {
    backgroundColor: '#111214',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  reviewModalHandle: {
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 999,
    height: 5,
    marginBottom: 16,
    width: 44,
  },
  reviewModalTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
  },
  reviewMetaText: {
    color: '#8e8e93',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 6,
  },
  reviewFactTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
    marginTop: 10,
  },
  reviewVerdictRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  reviewVerdictChoice: {
    backgroundColor: '#1c1c1f',
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  reviewVerdictChoiceActive: {
    backgroundColor: 'rgba(139,92,246,0.16)',
    borderColor: 'rgba(167,139,250,0.5)',
  },
  reviewVerdictChoiceText: {
    color: '#d4d4d8',
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  reviewVerdictChoiceTextActive: {
    color: '#fff',
  },
  reviewSectionLabel: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 18,
    marginBottom: 10,
  },
  reviewTagsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  reviewTagChip: {
    backgroundColor: '#1a1a1c',
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  reviewTagChipActive: {
    backgroundColor: 'rgba(139,92,246,0.18)',
    borderColor: 'rgba(167,139,250,0.4)',
  },
  reviewTagChipText: {
    color: '#d4d4d8',
    fontSize: 12,
    fontWeight: '600',
  },
  reviewTagChipTextActive: {
    color: '#fff',
  },
  reviewCommentInput: {
    backgroundColor: '#1a1a1c',
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    borderWidth: 1,
    color: '#fff',
    fontSize: 14,
    lineHeight: 20,
    minHeight: 108,
    paddingHorizontal: 14,
    paddingTop: 14,
    textAlignVertical: 'top',
  },
  reviewErrorText: {
    color: '#fca5a5',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 10,
  },
  reviewActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },
  reviewSecondaryButton: {
    alignItems: 'center',
    backgroundColor: '#1a1a1c',
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 14,
  },
  reviewSecondaryButtonText: {
    color: '#d4d4d8',
    fontSize: 14,
    fontWeight: '700',
  },
  reviewPrimaryButton: {
    alignItems: 'center',
    backgroundColor: '#8b5cf6',
    borderRadius: 14,
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 14,
  },
  reviewPrimaryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
});
