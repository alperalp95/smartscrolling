import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  type LayoutChangeEvent,
  Linking,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Reanimated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { failedRemoteImageUrls, resolveFactMedia } from '../../src/lib/factMedia';
import { colors, radius, space, type } from '../../src/theme';
import type { FactType } from '../../src/types';
import { Button } from '../ui/button';
import { GradientButton, GradientText } from '../ui/gradient';
import { IconButton } from '../ui/icon-button';
import { Media } from '../ui/media';

export type FactReviewVerdict = 'good' | 'bad' | 'unsure';

export type FactPostProps = {
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
  onAsk: (fact: FactType) => void;
};

const READ_QUALIFICATION_RATIO = 0.35;
const READ_QUALIFICATION_MIN_MS = 2000;
const READ_QUALIFICATION_MAX_MS = 5000;
const TOP_BAR_ALLOWANCE = 56;
// Görsel kalan alanı doldurur (yazı bloğu alt menüye yaslanır); en az bu oran kadar yer kaplar.
const MEDIA_MIN_RATIO = 0.3;
const PROGRESS_LINE_HEIGHT = 2;
const EXPAND_DURATION_MS = 320;
// "devamı" açılınca görsel kaybolmaz, kapalı yüksekliğinin bu oranına kadar küçülür.
const MEDIA_EXPANDED_RATIO = 0.35;
const MEDIA_UNBOUNDED = 100000;
const CLOSE_ROW_HEIGHT = 32;

function getReadQualificationProgress(durationMs: number) {
  const qualifiedMs = Math.min(
    READ_QUALIFICATION_MAX_MS,
    Math.max(READ_QUALIFICATION_MIN_MS, durationMs * READ_QUALIFICATION_RATIO),
  );

  return Math.min(qualifiedMs / durationMs, 1);
}

export function FactPost({
  item,
  isActive,
  height,
  onFinish,
  onReadQualified,
  toggleLike,
  toggleSave,
  isLiked,
  isSaved,
  topInset,
  onExpandedChange,
  isReviewMode,
  reviewVerdict,
  onOpenReview,
  onAsk,
}: FactPostProps) {
  const progress = useRef(new Animated.Value(0)).current;
  const progressValue = useRef(0);
  const qualifiedReadFactId = useRef<string | null>(null);
  const duration = (item.read_time_sq || 15) * 1000;
  const readQualificationProgress = getReadQualificationProgress(duration);
  const isTightCard = height < 680;
  const isCompactCard = height < 760;
  const previewLineCount = isTightCard ? 3 : isCompactCard ? 4 : 5;
  const [isExpanded, setIsExpanded] = useState(false);
  const [isCollapsing, setIsCollapsing] = useState(false);
  const [isPressing, setIsPressing] = useState(false);
  const isAnimating = isExpanded || isCollapsing;
  const isAnimatingRef = useRef(false);
  isAnimatingRef.current = isAnimating;
  const expand = useSharedValue(0);
  const mediaHeight = useSharedValue(0);
  const reduceMotionRef = useRef(false);
  const scrollRef = useRef<ScrollView>(null);
  const isPaused = isExpanded || isPressing;

  const [, setMediaErrorTick] = useState(0);
  const [fullLineCount, setFullLineCount] = useState(0);
  const media = resolveFactMedia(item);
  const minutes = Math.max(1, Math.round((item.read_time_sq || 15) / 60));
  const meta = `${item.category.toLocaleUpperCase('tr-TR')} · ${minutes} dk`;
  const hasMore = fullLineCount > previewLineCount;

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
    AccessibilityInfo.isReduceMotionEnabled?.()
      ?.then((enabled) => {
        reduceMotionRef.current = enabled;
      })
      .catch(() => {});
  }, []);

  const finishCollapse = useCallback(() => {
    setIsCollapsing(false);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, []);

  const mounted = useRef(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: animasyon yalnızca isExpanded değişince başlar
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    const config = {
      duration: reduceMotionRef.current ? 0 : EXPAND_DURATION_MS,
      easing: Easing.out(Easing.cubic),
    };
    if (isExpanded) {
      expand.value = withTiming(1, config);
    } else {
      expand.value = withTiming(0, config, (finished) => {
        'worklet';
        if (finished) runOnJS(finishCollapse)();
      });
    }
  }, [isExpanded]);

  useEffect(() => {
    if (!isActive) {
      expand.value = 0;
      setIsCollapsing(false);
    }
  }, [isActive, expand]);

  // Stil her zaman bağlı (sonradan eklenen animasyonlu stil uygulanmıyor). Kapalıyken sınır yok;
  // açılırken üst sınır ölçülen boydan oran kadarına iner, görsel esnek kalır.
  const mediaAnimatedStyle = useAnimatedStyle(() => ({
    maxHeight:
      expand.value === 0
        ? MEDIA_UNBOUNDED
        : interpolate(
            expand.value,
            [0, 1],
            [mediaHeight.value, mediaHeight.value * MEDIA_EXPANDED_RATIO],
          ),
  }));
  const closeRowAnimatedStyle = useAnimatedStyle(() => ({
    height: expand.value * CLOSE_ROW_HEIGHT,
    opacity: expand.value,
  }));

  const onMediaLayout = (e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (!isAnimatingRef.current && h > 0) mediaHeight.value = h;
  };

  const expandPost = () => {
    // Ölçüm gelmediyse görsel sıfıra inmesin: en az oran kadar yükseklik varsay.
    if (mediaHeight.value <= 0) mediaHeight.value = height * MEDIA_MIN_RATIO;
    setIsExpanded(true);
  };
  const collapsePost = () => {
    setIsCollapsing(true);
    setIsExpanded(false);
  };

  useEffect(() => {
    onExpandedChange(isExpanded);
  }, [isExpanded, onExpandedChange]);

  const openSource = () => {
    if (item.source_url) Linking.openURL(item.source_url);
  };

  const sharePost = () => {
    Share.share({ message: item.source_url ? `${item.title}\n${item.source_url}` : item.title });
  };

  const source = item.source_url ? (
    <Pressable onPress={openSource} accessibilityRole="link">
      <Text style={s.source}>Kaynak: {item.source_label} ›</Text>
    </Pressable>
  ) : (
    <Text style={s.source}>Kaynak: {item.source_label}</Text>
  );

  const reviewToolbar = isReviewMode ? (
    <View style={s.reviewRow}>
      <Button label="Review" onPress={() => onOpenReview(item)} />
      <Text style={s.source}>{item.visual_key ?? 'no-key'}</Text>
      {reviewVerdict ? (
        <Text
          style={[
            s.reviewVerdict,
            reviewVerdict === 'good' && s.verdictGood,
            reviewVerdict === 'bad' && s.verdictBad,
          ]}
        >
          {reviewVerdict}
        </Text>
      ) : null}
    </View>
  ) : null;

  const progressFill = (
    <Animated.View
      style={[
        s.progressFill,
        {
          width: progress.interpolate({
            inputRange: [0, 1],
            outputRange: ['0%', '100%'],
          }),
        },
      ]}
    />
  );

  return (
    <View
      testID="feed-fact-card"
      style={[
        s.post,
        {
          height,
          paddingTop: topInset + TOP_BAR_ALLOWANCE,
          paddingBottom: space.lg,
        },
      ]}
      onTouchStart={() => setIsPressing(true)}
      onTouchEnd={() => setIsPressing(false)}
      onTouchCancel={() => setIsPressing(false)}
    >
      <Reanimated.View
        style={[s.closeRow, !isAnimating && s.hidden, closeRowAnimatedStyle]}
        pointerEvents={isExpanded ? 'auto' : 'none'}
      >
        {isAnimating ? (
          <IconButton
            name="chevron-down"
            onPress={collapsePost}
            accessibilityLabel="Kapat"
            testID="feed-collapse-button"
          />
        ) : null}
        {isAnimating ? <Text style={s.closeLabel}>Kapat</Text> : null}
      </Reanimated.View>
      <Reanimated.View
        style={[
          s.media,
          { minHeight: isAnimating ? 0 : height * MEDIA_MIN_RATIO },
          mediaAnimatedStyle,
        ]}
      >
        {/* Ölçüm düz View'de: animasyonlu kapta onLayout güvenilir gelmiyor. */}
        <View style={s.mediaFill} onLayout={onMediaLayout}>
          <Media
            uri={media.uri}
            localSource={media.localSource ?? undefined}
            category={item.category}
            style={s.mediaFill}
            onError={() => {
              if (media.uri) {
                failedRemoteImageUrls.add(media.uri);
                setMediaErrorTick((n) => n + 1);
              }
            }}
          />
        </View>
        <View style={s.progressTrack}>{progressFill}</View>
      </Reanimated.View>

      <View style={s.actions}>
        <IconButton
          name="heart-outline"
          active={isLiked}
          color={isLiked ? colors.like : colors.text}
          onPress={() => toggleLike(item.id)}
          accessibilityLabel="Beğen"
          testID="feed-like-button"
        />
        <GradientButton
          size="pill"
          icon="sparkles"
          label="Sor"
          testID="card-ask-button"
          onPress={() => onAsk(item)}
        />
        <IconButton
          name="paper-plane-outline"
          onPress={sharePost}
          accessibilityLabel="Paylaş"
          testID="feed-share-button"
        />
        <View style={s.spacer} />
        <IconButton
          name="bookmark-outline"
          active={isSaved}
          onPress={() => toggleSave(item.id)}
          accessibilityLabel="Kaydet"
          testID="feed-save-button"
        />
      </View>

      <View style={[s.text, isAnimating && s.textGrow]}>
        <GradientText style={type.meta}>{meta}</GradientText>
        {reviewToolbar}
        <ScrollView
          ref={scrollRef}
          style={isAnimating ? s.expandedScroll : s.collapsedScroll}
          scrollEnabled={isExpanded}
          nestedScrollEnabled
          onMoveShouldSetResponder={() => isExpanded}
          onStartShouldSetResponder={() => isExpanded}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.expandedContent}
        >
          <Text style={s.title} numberOfLines={isAnimating ? undefined : 3}>
            {item.title}
          </Text>
          <Pressable
            onPress={expandPost}
            disabled={isAnimating}
            accessibilityRole="button"
            accessibilityLabel="Devamını oku"
          >
            <Text style={s.body} numberOfLines={isAnimating ? undefined : previewLineCount}>
              {item.content}
            </Text>
            <Text
              style={[s.body, s.measure]}
              onTextLayout={(e) => setFullLineCount(e.nativeEvent.lines.length)}
              pointerEvents="none"
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              {item.content}
            </Text>
            {hasMore && !isAnimating ? <Text style={s.more}>devamı</Text> : null}
          </Pressable>
          {source}
        </ScrollView>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  post: { backgroundColor: colors.bg },
  media: {
    flex: 1,
    marginHorizontal: space.screen,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  mediaFill: { flex: 1, width: '100%' },
  progressTrack: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: PROGRESS_LINE_HEIGHT,
    backgroundColor: colors.scrim,
  },
  hidden: { display: 'none' },
  textGrow: { flex: 1 },
  collapsedScroll: { flexGrow: 0 },
  progressFill: { height: PROGRESS_LINE_HEIGHT, backgroundColor: colors.text },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
    paddingHorizontal: space.screen,
    paddingVertical: space.sm,
  },
  spacer: { flex: 1 },
  text: { paddingHorizontal: space.screen, gap: space.xs },
  title: { ...type.cardTitle, color: colors.text },
  body: { ...type.body, color: colors.text },
  measure: { position: 'absolute', left: 0, right: 0, opacity: 0 },
  more: { ...type.body, color: colors.textSecondary },
  source: { ...type.caption, color: colors.textSecondary },
  closeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.screen,
    overflow: 'hidden',
  },
  closeLabel: { ...type.button, color: colors.textSecondary },
  expandedScroll: { flex: 1 },
  expandedContent: { gap: space.md, paddingBottom: space.xxl },
  reviewRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  reviewVerdict: { ...type.chip, color: colors.textSecondary },
  verdictGood: { color: colors.success },
  verdictBad: { color: colors.danger },
});
