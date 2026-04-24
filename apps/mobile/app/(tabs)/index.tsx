import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useIsFocused } from '@react-navigation/native';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { Image as ExpoImage } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  AppState,
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
import type { ImageSourcePropType, ViewToken } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { PremiumUpsellCard } from '../../components/premium-upsell-card';
import { promptForAuth } from '../../src/lib/authPrompt';
import { isBadFactMediaUrl } from '../../src/lib/factVisuals';
import { promptForPremium } from '../../src/lib/premiumPrompt';
import { useAuthStore } from '../../src/store/authStore';
import { useFeedStore } from '../../src/store/feedStore';
import type { FactType } from '../../src/types';

const CATEGORIES = ['logo', 'Bilim', 'Tarih', 'Felsefe', 'Teknoloji', 'Saglik'];

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
};

const failedRemoteImageUrls = new Set<string>();

function normalizeCategoryKey(value: string | null | undefined): string {
  const normalized = (value ?? '')
    .normalize('NFD')
    .replaceAll(/\p{Diacritic}/gu, '')
    .toLowerCase();

  if (normalized.includes('bilim')) {
    return 'bilim';
  }

  if (normalized.includes('tarih')) {
    return 'tarih';
  }

  if (normalized.includes('felsefe')) {
    return 'felsefe';
  }

  if (normalized.includes('teknoloji')) {
    return 'teknoloji';
  }

  if (normalized.includes('saglik')) {
    return 'saglik';
  }

  return normalized;
}

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

  return normalized;
}

function resolveRemoteRetryMediaUrl(mediaUrl: string | null | undefined): string | null {
  const normalized = resolveRemoteMediaUrl(mediaUrl);

  if (!normalized) {
    return null;
  }

  if (normalized.startsWith('https://upload.wikimedia.org/wikipedia/commons/')) {
    try {
      const url = new URL(normalized);
      const marker = '/wikipedia/commons/';
      const commonsIndex = url.pathname.indexOf(marker);

      if (commonsIndex === -1) {
        return normalized;
      }

      const commonsPath = url.pathname.slice(commonsIndex + marker.length);
      let filename = commonsPath.split('/').at(-1) ?? '';

      if (!filename) {
        return normalized;
      }

      const thumbMatch = filename.match(/^\d+px-(.+)$/);

      if (thumbMatch?.[1]) {
        filename = thumbMatch[1];
      }

      try {
        filename = decodeURIComponent(filename);
      } catch {
        // keep raw filename
      }

      return `https://commons.wikimedia.org/wiki/Special:Redirect/file/${encodeURIComponent(filename)}?width=640`;
    } catch {
      return normalized;
    }
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

type FullScreenFactCardProps = {
  item: FactType;
  isActive: boolean;
  height: number;
  onFinish: () => void;
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
  const duration = (item.read_time_sq || 15) * 1000;
  const cardBottomOffset = tabBarHeight + Math.max(bottomInset, Platform.OS === 'ios' ? 12 : 8);
  const cardTopOffset = Math.max(topInset + 72, 96);
  const remoteMediaUrl = resolveRemoteMediaUrl(item.media_url);
  const remoteRetryMediaUrl = resolveRemoteRetryMediaUrl(item.media_url);
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
    });

    return () => {
      progress.removeListener(listenerId);
    };
  }, [progress]);

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
                source={{ uri: remoteRetryMediaUrl ?? remoteMediaUrl }}
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
                    `[Perf][FeedImage] fact=${item.id} title="${item.title}" failed=remote-native url="${remoteRetryMediaUrl ?? remoteMediaUrl}"`,
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
            ? { top: cardTopOffset, bottom: cardBottomOffset + 20 }
            : { bottom: cardBottomOffset + 20 },
        ]}
      >
        <View style={s.catBadge}>
          <Text style={s.catBadgeText}>{item.category} Dogrulandi</Text>
        </View>
        <View style={s.imageDebugBadge}>
          <Text style={s.imageDebugBadgeText}>
            {imageDebugMode} / {item.visual_key ?? 'no-key'}
          </Text>
        </View>
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
            <Text style={s.cardTextPreview} numberOfLines={5}>
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

      <View style={[s.actionContainer, { bottom: cardBottomOffset + 20 }]}>
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
  const listHeight = windowHeight;
  const flatListRef = useRef<FlashListRef<FactType> | null>(null);
  const appStateRef = useRef(AppState.currentState);
  const feedScreenOpenedAt = useRef(Date.now());
  const hasLoggedFirstCard = useRef(false);
  const [activeFactId, setActiveFactId] = useState<string | null>(null);
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
  const orderingKeyRef = useRef<string>('');

  const {
    facts,
    isLoading,
    isLoadingMore,
    fetchFacts,
    loadMoreFacts,
    refreshFacts,
    activeCategory,
    setActiveCategory,
    likedIds,
    savedIds,
    toggleLike,
    toggleSave,
    feedRotationSeed,
    bumpFeedRotation,
    ensureCategoryHasContent,
  } = useFeedStore();
  const user = useAuthStore((state) => state.user);
  const hasPremium = useAuthStore((state) => state.hasPremium);
  const setPostAuthRedirectPath = useAuthStore((state) => state.setPostAuthRedirectPath);

  useEffect(() => {
    void fetchFacts({ reset: true });
  }, [fetchFacts]);

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

  useEffect(() => {
    if (activeCategory === 'logo') {
      return;
    }

    const activeCategoryKey = normalizeCategoryKey(activeCategory);
    void ensureCategoryHasContent(
      (fact) => normalizeCategoryKey(fact.category) === activeCategoryKey,
    );
  }, [activeCategory, ensureCategoryHasContent]);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken<FactType>[] }) => {
      const firstItem = viewableItems[0]?.item;

      if (firstItem?.id) {
        setActiveFactId(firstItem.id);
      }
    },
  ).current;

  useEffect(() => {
    const baseFacts =
      activeCategory === 'logo'
        ? facts
        : facts.filter(
            (fact) => normalizeCategoryKey(fact.category) === normalizeCategoryKey(activeCategory),
          );
    const orderingKey = `${activeCategory}:${feedRotationSeed}`;

    setOrderedFacts((previous) => {
      if (orderingKeyRef.current !== orderingKey) {
        orderingKeyRef.current = orderingKey;
        return rotateFacts(baseFacts, feedRotationSeed);
      }

      return buildStableFeedOrder(baseFacts, previous, feedRotationSeed);
    });
  }, [facts, activeCategory, feedRotationSeed]);

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

  const shouldShowFeedUpsell =
    Boolean(user) &&
    !hasPremium &&
    !dismissedFeedUpsell &&
    seenFactIds.length >= 12 &&
    !expandedCardId;

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

  const handleFinish = (index: number) => {
    if (index < orderedFacts.length - 1) {
      flatListRef.current?.scrollToIndex({ index: index + 1, animated: true });
    }
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
        style={[
          s.listWrapper,
          {
            height: listHeight,
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
            data={orderedFacts}
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
            pagingEnabled
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
            renderItem={({ item, index }) => (
              <FullScreenFactCard
                item={item}
                isActive={activeFactId === item.id}
                height={listHeight}
                onFinish={() => handleFinish(index)}
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
            )}
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

      <View style={s.staticTopNavbar} pointerEvents="box-none">
        <SafeAreaView edges={['top']} pointerEvents="box-none">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[
              s.catsRow,
              { paddingTop: Platform.OS === 'web' ? 14 : Math.max(insets.top > 0 ? 10 : 14, 10) },
            ]}
          >
            {CATEGORIES.map((cat) => {
              if (cat === 'logo') {
                return (
                  <TouchableOpacity
                    key={cat}
                    onLongPress={() => {
                      if (__DEV__) {
                        setIsReviewMode((current) => !current);
                      }
                    }}
                    onPress={() => {
                      setActiveCategory(cat);
                      flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
                    }}
                    style={[s.logoChip, isReviewMode ? s.logoChipReviewMode : null]}
                  >
                    <Text style={s.logoText}>
                      {isReviewMode ? 'Review Mode' : 'SmartScrolling'}
                    </Text>
                  </TouchableOpacity>
                );
              }

              return (
                <TouchableOpacity
                  key={cat}
                  onPress={() => {
                    if (activeCategory === cat) {
                      setActiveCategory('logo');
                    } else {
                      setActiveCategory(cat);
                    }
                    bumpFeedRotation();
                    setExpandedCardId(null);
                    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
                  }}
                  style={activeCategory === cat ? s.chipActive : s.chip}
                >
                  <Text style={activeCategory === cat ? s.chipTextActive : s.chipText}>{cat}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

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
  staticTopNavbar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingBottom: 16,
    zIndex: 100,
  },
  catsRow: {
    paddingHorizontal: 16,
    gap: 10,
    flexDirection: 'row',
    alignItems: 'center',
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
  logoChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    backgroundColor: '#8b5cf6',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  logoText: { fontSize: 16, fontWeight: '800', color: '#fff', letterSpacing: -0.2 },
  logoChipReviewMode: {
    backgroundColor: '#ef4444',
    shadowColor: '#ef4444',
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  chipActive: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderWidth: 1,
    borderColor: '#fff',
  },
  chipText: { fontSize: 14, fontWeight: '700', color: 'rgba(255,255,255,0.8)' },
  chipTextActive: { fontSize: 14, fontWeight: '800', color: '#000' },
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
