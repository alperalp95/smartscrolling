import { FlashList, type ViewToken } from '@shopify/flash-list';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PremiumUpsellCard } from '../../../components/premium-upsell-card';
import { SeriesReaderCard } from '../../../components/series/series-card';
import { Button } from '../../../components/ui/button';
import { IconButton } from '../../../components/ui/icon-button';
import { TopBar } from '../../../components/ui/top-bar';
import { SERIES_CONFIG } from '../../../src/config/series';
import { fetchSeriesBySlug, fetchSeriesCards, saveProgress } from '../../../src/lib/series';
import { supabase } from '../../../src/lib/supabase';
import { useAuthStore } from '../../../src/store/authStore';
import { colors, space, type } from '../../../src/theme';
import type { SeriesCard, SeriesDetail } from '../../../src/types';

// Akıştaki ilerleme çizgisiyle aynı kalınlık.
const PROGRESS_LINE_HEIGHT = 2;
// Bir sayfanın "görünür" sayılması için gereken oran (akışla aynı).
const VIEWABLE_PERCENT = 60;
const VIEWABILITY_CONFIG = { itemVisiblePercentThreshold: VIEWABLE_PERCENT };
const GRADIENT_START = { x: 0, y: 0 };
const GRADIENT_END = { x: 1, y: 0 };

type LockItem = { lock: true };
type ListItem = SeriesCard | LockItem;
type Status = 'loading' | 'ready' | 'missing' | 'error';

const LOCK_ITEM: LockItem = { lock: true };
const isLock = (item: ListItem): item is LockItem => 'lock' in item;

export default function SeriesReaderScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const params = useLocalSearchParams<{ slug?: string; from?: string }>();
  const slug = params.slug;
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const hasPremium = useAuthStore((state) => state.hasPremium);

  const [status, setStatus] = useState<Status>('loading');
  const [series, setSeries] = useState<SeriesDetail | null>(null);
  const [cards, setCards] = useState<SeriesCard[]>([]);
  const [position, setPosition] = useState(() =>
    Math.max(1, Number.parseInt(params.from ?? '', 10) || 1),
  );
  const [reloadTick, setReloadTick] = useState(0);
  const [measuredListHeight, setMeasuredListHeight] = useState(0);

  const loadedOnce = useRef(false);
  const sessionRefreshed = useRef(false);
  const startIndex = useRef(0);
  const seriesRef = useRef<SeriesDetail | null>(null);
  const userIdRef = useRef<string | null>(userId);
  seriesRef.current = series;
  userIdRef.current = userId;

  // biome-ignore lint/correctness/useExhaustiveDependencies: konum yalnızca ilk yüklemede başlangıç için okunur
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!loadedOnce.current) setStatus('loading');
      try {
        const detail = slug ? await fetchSeriesBySlug(slug) : null;
        if (cancelled) return;
        if (!detail) {
          setStatus('missing');
          return;
        }
        const premiumSeries = !detail.isFree;
        let fetched = await fetchSeriesCards(detail.id);
        // Satın alma sonrası belirteç eskiyse RLS 4+. kartı vermez: oturumu bir kez yenile.
        if (
          premiumSeries &&
          hasPremium &&
          fetched.length < detail.cardCount &&
          !sessionRefreshed.current
        ) {
          sessionRefreshed.current = true;
          try {
            await supabase.auth.refreshSession();
          } catch {
            // Yenilenemezse eldeki kartlarla devam edilir.
          }
          if (cancelled) return;
          fetched = await fetchSeriesCards(detail.id);
        }
        if (cancelled) return;
        const locked = premiumSeries && !hasPremium;
        const visible = locked
          ? fetched.filter((card) => card.position <= SERIES_CONFIG.previewCards)
          : fetched;
        if (!loadedOnce.current) {
          const total = visible.length + (locked ? 1 : 0);
          startIndex.current = Math.max(0, Math.min(position - 1, total - 1));
          const first = visible[startIndex.current];
          if (first) setPosition(first.position);
          else if (visible.length > 0) setPosition(visible[visible.length - 1].position);
        }
        loadedOnce.current = true;
        setSeries(detail);
        setCards(visible);
        setStatus('ready');
      } catch {
        if (!cancelled) setStatus(loadedOnce.current ? 'ready' : 'error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, hasPremium, reloadTick]);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken<ListItem>[] }) => {
      const item = viewableItems[0]?.item;
      if (!item || isLock(item)) return;
      setPosition(item.position);
      const detail = seriesRef.current;
      if (detail) {
        void saveProgress(detail.id, item.position, detail.cardCount, userIdRef.current).catch(
          () => {},
        );
      }
    },
  ).current;

  const locked = !!series && !series.isFree && !hasPremium && series.cardCount > cards.length;
  const items: ListItem[] = locked ? [...cards, LOCK_ITEM] : cards;
  const listHeight = measuredListHeight > 0 ? measuredListHeight : windowHeight;
  const total = series?.cardCount ?? 0;
  const fraction = total > 0 ? Math.min(1, position / total) : 0;

  const renderBody = () => {
    if (status === 'loading') {
      return (
        <View style={s.center}>
          <ActivityIndicator color={colors.textSecondary} />
        </View>
      );
    }
    if (status === 'missing' || status === 'error' || !series) {
      return (
        <View style={s.center}>
          <Text style={s.centerText}>
            {status === 'error' ? 'Seri yüklenemedi.' : 'Seri bulunamadı.'}
          </Text>
          {status === 'error' ? (
            <Button label="Yeniden dene" onPress={() => setReloadTick((n) => n + 1)} />
          ) : null}
        </View>
      );
    }
    return (
      <FlashList
        testID="series-reader"
        data={items}
        keyExtractor={(item) => (isLock(item) ? 'lock' : `card-${item.position}`)}
        initialScrollIndex={startIndex.current > 0 ? startIndex.current : undefined}
        disableIntervalMomentum
        pagingEnabled
        snapToInterval={listHeight}
        snapToAlignment="start"
        showsVerticalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={VIEWABILITY_CONFIG}
        renderItem={({ item }) =>
          isLock(item) ? (
            <View style={[s.lock, { height: listHeight }]} testID="series-lock">
              <PremiumUpsellCard
                title="Serinin devamı Premium'da"
                body={`${series.cardCount - cards.length} kart daha · tüm seriler, reklamsız akış`}
                onPress={() => router.push('/premium' as never)}
              />
            </View>
          ) : (
            <SeriesReaderCard
              card={item}
              height={listHeight}
              seriesTitle={series.title}
              category={series.category}
              coverUrl={series.coverUrl}
              sourceTitle={series.sourceTitle}
              sourceUrl={series.sourceUrl}
            />
          )
        }
      />
    );
  };

  return (
    <View style={[s.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <TopBar
        title={series ? `Seri · ${position} / ${total}` : 'Seri'}
        right={
          <IconButton
            name="close"
            onPress={() => router.back()}
            accessibilityLabel="Kapat"
            testID="series-reader-close"
          />
        }
      />
      <View style={s.progressTrack}>
        <LinearGradient
          colors={colors.brandGradient}
          start={GRADIENT_START}
          end={GRADIENT_END}
          style={[s.progressFill, { width: `${fraction * 100}%` }]}
        />
      </View>
      <View style={s.list} onLayout={(e) => setMeasuredListHeight(e.nativeEvent.layout.height)}>
        {renderBody()}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  list: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md },
  centerText: { ...type.body, color: colors.textSecondary, textAlign: 'center' },
  lock: { justifyContent: 'center' },
  progressTrack: { height: PROGRESS_LINE_HEIGHT, backgroundColor: colors.scrim },
  progressFill: { height: PROGRESS_LINE_HEIGHT },
});
