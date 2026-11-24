import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { resolveFactMedia } from '../../src/lib/factMedia';
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
// Kapalı gövdenin satır sınırını aşıp aşmadığını tahmin etmek için satır başına yaklaşık karakter.
const CHARS_PER_LINE = 38;
const TOP_BAR_ALLOWANCE = 56;
const MEDIA_MIN_RATIO = 0.3;
const MEDIA_MAX_RATIO = 0.45;
const PROGRESS_LINE_HEIGHT = 2;

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
  tabBarHeight,
  bottomInset,
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
  const bottomOffset = tabBarHeight + Math.max(bottomInset, Platform.OS === 'ios' ? 12 : 8);
  const isTightCard = height < 680;
  const isCompactCard = height < 760;
  const previewLineCount = isTightCard ? 3 : isCompactCard ? 4 : 5;
  const [isExpanded, setIsExpanded] = useState(false);
  const [isPressing, setIsPressing] = useState(false);
  const isPaused = isExpanded || isPressing;

  const media = resolveFactMedia(item);
  const minutes = Math.max(1, Math.round((item.read_time_sq || 15) / 60));
  const meta = `${item.category.toLocaleUpperCase('tr-TR')} · ${minutes} dk`;
  const hasMore = item.content.length > previewLineCount * CHARS_PER_LINE;

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

  return (
    <View
      testID="feed-fact-card"
      style={[
        s.post,
        {
          height,
          paddingTop: topInset + TOP_BAR_ALLOWANCE,
          paddingBottom: bottomOffset,
        },
      ]}
      onTouchStart={() => setIsPressing(true)}
      onTouchEnd={() => setIsPressing(false)}
      onTouchCancel={() => setIsPressing(false)}
    >
      {isExpanded ? (
        <View style={s.expanded}>
          <View style={s.closeRow}>
            <IconButton
              name="chevron-down"
              onPress={() => setIsExpanded(false)}
              accessibilityLabel="Kapat"
              testID="feed-collapse-button"
            />
            <Text style={s.closeLabel}>Kapat</Text>
          </View>
          {reviewToolbar}
          <ScrollView
            style={s.expandedScroll}
            nestedScrollEnabled
            onMoveShouldSetResponder={() => true}
            onStartShouldSetResponder={() => true}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={s.expandedContent}
          >
            <GradientText style={type.meta}>{meta}</GradientText>
            <Text style={s.title}>{item.title}</Text>
            <Text style={s.body}>{item.content}</Text>
            {source}
          </ScrollView>
        </View>
      ) : (
        <>
          <View
            style={[
              s.media,
              { minHeight: height * MEDIA_MIN_RATIO, maxHeight: height * MEDIA_MAX_RATIO },
            ]}
          >
            <Media
              uri={media.uri}
              localSource={media.localSource ?? undefined}
              category={item.category}
              style={s.mediaFill}
            />
            <View style={s.progressTrack}>
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
            </View>
          </View>

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

          <View style={s.text}>
            <GradientText style={type.meta}>{meta}</GradientText>
            {reviewToolbar}
            <Text style={s.title} numberOfLines={3}>
              {item.title}
            </Text>
            <Pressable
              onPress={() => setIsExpanded(true)}
              accessibilityRole="button"
              accessibilityLabel="Devamını oku"
            >
              <Text style={s.body} numberOfLines={previewLineCount}>
                {item.content}
              </Text>
              {hasMore ? <Text style={s.more}>devamı</Text> : null}
            </Pressable>
            {source}
          </View>
        </>
      )}
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
  more: { ...type.body, color: colors.textSecondary },
  source: { ...type.caption, color: colors.textSecondary },
  expanded: { flex: 1, paddingHorizontal: space.screen },
  closeRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingBottom: space.sm },
  closeLabel: { ...type.button, color: colors.textSecondary },
  expandedScroll: { flex: 1 },
  expandedContent: { gap: space.md, paddingBottom: space.xxl },
  reviewRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  reviewVerdict: { ...type.chip, color: colors.textSecondary },
  verdictGood: { color: colors.success },
  verdictBad: { color: colors.danger },
});
