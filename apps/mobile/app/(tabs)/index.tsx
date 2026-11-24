import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useIsFocused } from '@react-navigation/native';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  AppState,
  Modal,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import type { LayoutChangeEvent, ViewToken } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CardAskSheet } from '../../components/card-ask-sheet';
import { FactPost, type FactReviewVerdict } from '../../components/feed/fact-post';
import { FEED_TOP_BAR_HEIGHT, FeedTopBar } from '../../components/feed/feed-top-bar';
import { PremiumUpsellCard } from '../../components/premium-upsell-card';
import { Button } from '../../components/ui/button';
import { IconButton } from '../../components/ui/icon-button';
import { getGoogleMobileAdsBannerComponents } from '../../src/lib/adMob';
import {
  type FeedAdSlot,
  getAdAudience,
  getFeedAdUnitId,
  insertFeedAdSlots,
} from '../../src/lib/ads';
import { promptForAuth } from '../../src/lib/authPrompt';
import { isBadFactMediaUrl } from '../../src/lib/factVisuals';
import { reconcileDailyLocalReminder } from '../../src/lib/notifications';
import { promptForPremium } from '../../src/lib/premiumPrompt';
import { fetchActivitySummary, incrementDailyActivity } from '../../src/lib/userActivity';
import { useAuthStore } from '../../src/store/authStore';
import { useFeedStore } from '../../src/store/feedStore';
import { useOnboardingStore } from '../../src/store/onboardingStore';
import { colors, radius, space, type } from '../../src/theme';
import type { FactType } from '../../src/types';

const BACK_TO_TOP_VISIBLE_INDEX = 3;

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
  topInset,
  onNext,
}: {
  height: number;
  slot: FeedAdSlot;
  topInset: number;
  onNext: () => void;
}) {
  const isNativeSlot = slot.kind === 'inline_video';
  const [failedBannerSlotId, setFailedBannerSlotId] = useState<string | null>(null);
  const bannerLoadFailed = failedBannerSlotId === slot.id;

  const renderBanner = () => {
    if (!isNativeSlot && !bannerLoadFailed) {
      const bannerComponents = getGoogleMobileAdsBannerComponents();

      if (bannerComponents) {
        const { BannerAd, bannerSize } = bannerComponents;

        return (
          <View style={s.adBannerBox}>
            <BannerAd
              onAdFailedToLoad={(error) => {
                console.warn('[AdMob] Demo banner failed to load:', error);
                setFailedBannerSlotId(slot.id);
              }}
              onAdLoaded={() => setFailedBannerSlotId(null)}
              size={bannerSize}
              unitId={getFeedAdUnitId('static')}
            />
          </View>
        );
      }
    }

    return (
      <View style={s.adFallbackBox}>
        <Text style={s.adFallbackText}>
          {isNativeSlot ? 'Video reklam alanı' : 'Reklam yüklenemedi'}
        </Text>
      </View>
    );
  };

  return (
    <View
      style={[
        s.adScreen,
        { height, paddingTop: topInset + FEED_TOP_BAR_HEIGHT, paddingBottom: space.lg },
      ]}
    >
      <Text style={s.adEyebrow}>Sponsorlu</Text>
      <View style={s.adCard}>
        <View style={s.adUnitWrap}>{renderBanner()}</View>
      </View>
      <Button label="Akışa devam et" onPress={onNext} />
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
  const shouldShowFeedUpsell =
    Boolean(user) &&
    !hasPremium &&
    !dismissedFeedUpsell &&
    seenFactIds.length >= 12 &&
    !expandedCardId;
  const shouldShowBackToTop = activeFactIndex >= BACK_TO_TOP_VISIBLE_INDEX && !expandedCardId;
  const backToTopButtonTop = insets.top + FEED_TOP_BAR_HEIGHT + space.md;

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

  const [askTargetFact, setAskTargetFact] = useState<FactType | null>(null);

  const handleOpenAsk = (fact: FactType) => {
    if (!user) {
      promptForAuth({
        title: 'Giriş gerekli',
        message: 'Kartlara soru sormak için giriş yap.',
        onConfirm: () => {
          setPostAuthRedirectPath('/');
          router.push('/profile');
        },
      });
      return;
    }
    setAskTargetFact(fact);
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
    <View
      style={[s.container, Platform.OS === 'web' && !isFocused ? s.webHiddenScreen : null]}
      testID="feed-screen"
    >
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
          <View style={s.centerState} testID="feed-loading">
            <Text style={s.centerStateText}>Bilgiler Yukleniyor...</Text>
          </View>
        ) : orderedFacts.length === 0 ? (
          <View style={s.centerState}>
            <Text style={s.centerStateText}>Icerik bulunamadi.</Text>
          </View>
        ) : (
          <FlashList
            ref={flatListRef}
            testID="feed-list"
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
                    topInset={insets.top}
                    onNext={() => handleFinish(index, feedItems.length)}
                  />
                );
              }

              return (
                <FactPost
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
                  onAsk={handleOpenAsk}
                />
              );
            }}
          />
        )}
      </View>

      {shouldShowFeedUpsell ? (
        <View style={[s.feedUpsellWrap, { bottom: space.lg }]}>
          <PremiumUpsellCard
            eyebrow="Reklamsız deneyim"
            title="Akışı reklamsız ve daha derin kullan"
            body="Premium ile reklamsız devam et, kartlara günde 30 soru sor ve kendi sorunu yaz."
            ctaLabel="Premium'u incele"
            onDismiss={() => setDismissedFeedUpsell(true)}
            onPress={() =>
              promptForPremium({
                title: 'Reklamsız premium deneyime geç',
                message:
                  'Premium ile akışta reklamsız devam edebilir, kartlara günde 30 soru sorabilir ve kendi sorunu yazabilirsin.',
                onConfirm: () => router.push('/premium' as never),
              })
            }
          />
        </View>
      ) : null}

      {shouldShowBackToTop ? (
        <View style={[s.backToTopButton, { top: backToTopButtonTop }]}>
          <IconButton
            name="arrow-up"
            onPress={handleBackToTopRefresh}
            accessibilityLabel="Akışın başına dön ve yenile"
          />
        </View>
      ) : null}

      <View style={s.topOverlay} pointerEvents="box-none">
        <FeedTopBar
          isSignedIn={Boolean(user)}
          streakDays={feedStreakDays}
          todayFactsRead={todayFactsRead}
          dailyGoal={factDailyGoal}
          onLogin={() => router.push('/profile')}
          onChangeGoal={() => router.push('/settings')}
        />
        {__DEV__ ? (
          <Pressable
            accessibilityLabel="Toggle feed review mode"
            onLongPress={() => setIsReviewMode((current) => !current)}
            style={[s.reviewModeHotspot, { top: insets.top }]}
          />
        ) : null}
        {isReviewMode ? (
          <View style={s.reviewModeTopbar}>
            <Text style={s.reviewModeTopbarText}>
              {Object.keys(reviewsByFactId).length} review hazır
            </Text>
            <Button label="JSON Export" onPress={() => void handleExportReviews()} />
          </View>
        ) : null}
      </View>

      <CardAskSheet
        fact={askTargetFact}
        hasPremium={hasPremium}
        onClose={() => setAskTargetFact(null)}
        onPremiumPress={() => {
          setAskTargetFact(null);
          router.push('/premium' as never);
        }}
      />

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
    backgroundColor: colors.bg,
    width: '100%',
  },
  adEyebrow: {
    ...type.meta,
    color: colors.textTertiary,
    marginBottom: space.sm,
  },
  adCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    justifyContent: 'center',
    marginHorizontal: space.screen,
    marginBottom: space.lg,
    overflow: 'hidden',
    padding: space.lg,
    alignSelf: 'stretch',
  },
  adUnitWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 250,
    overflow: 'hidden',
    width: '100%',
  },
  adFallbackBox: {
    alignItems: 'center',
    height: 250,
    justifyContent: 'center',
    paddingHorizontal: space.lg,
    width: '100%',
  },
  adBannerBox: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 90,
    width: '100%',
  },
  adFallbackText: {
    ...type.caption,
    color: colors.textSecondary,
    textAlign: 'center',
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
  sourceRow: { alignItems: 'center', flexDirection: 'row', gap: 12, marginTop: 16 },
  askButton: {
    backgroundColor: 'rgba(139,92,246,0.16)',
    borderColor: 'rgba(167,139,250,0.5)',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  askButtonText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  cardSource: { fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },
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
    zIndex: 100,
  },
  reviewModeHotspot: {
    height: 44,
    left: 8,
    position: 'absolute',
    width: 44,
  },
  reviewModeTopbar: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    flexDirection: 'row',
    gap: space.md,
    marginTop: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
  },
  reviewModeTopbarText: { ...type.caption, color: colors.text },
  feedUpsellWrap: {
    left: 0,
    position: 'absolute',
    right: 0,
    zIndex: 20,
  },
  backToTopButton: {
    alignItems: 'center',
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.full,
    height: 44,
    justifyContent: 'center',
    position: 'absolute',
    right: space.screen,
    width: 44,
    zIndex: 80,
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
