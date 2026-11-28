import { useIsFocused } from '@react-navigation/native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SeriesHero } from '../../components/series/series-hero';
import { SeriesProgressLine, SeriesShelf } from '../../components/series/series-shelf';
import { Button } from '../../components/ui/button';
import { GradientText } from '../../components/ui/gradient';
import { Media } from '../../components/ui/media';
import { Screen } from '../../components/ui/screen';
import { TopBar } from '../../components/ui/top-bar';
import { fetchSeriesList, getAllProgress, groupForShelves } from '../../src/lib/series';
import { useAuthStore } from '../../src/store/authStore';
import { colors, radius, space, type } from '../../src/theme';
import type { SeriesProgress, SeriesSummary } from '../../src/types';

// Devam et satırındaki küçük kapak ve ilerleme çizgisi ölçüleri.
const CONTINUE_THUMB = space.xxxl + space.xxl;

type Status = 'loading' | 'ready' | 'error';

export default function SeriesTabScreen() {
  const router = useRouter();
  const isFocused = useIsFocused();
  const userId = useAuthStore((state) => state.user?.id ?? null);

  const [status, setStatus] = useState<Status>('loading');
  const [list, setList] = useState<SeriesSummary[]>([]);
  const [progress, setProgress] = useState<Record<string, SeriesProgress>>({});
  const [attempt, setAttempt] = useState(0);
  // Her başarılı çekimde artar: liste aynı kalsa da "Devam et" ilerlemesi yenilenir.
  const [fetchTick, setFetchTick] = useState(0);

  const hasLoaded = useRef(false);
  const [refreshing, setRefreshing] = useState(false);

  // Sekme her odaklandığında listeyi yeniden çeker; ilk yüklemede yükleme ekranı, sonrakilerde sessiz.
  useFocusEffect(
    // biome-ignore lint/correctness/useExhaustiveDependencies: attempt "yeniden dene" ile tetiklenir
    useCallback(() => {
      let cancelled = false;
      const silent = hasLoaded.current;
      if (!silent) setStatus('loading');
      void fetchSeriesList()
        .then((next) => {
          if (cancelled) return;
          hasLoaded.current = true;
          setList(next);
          setFetchTick((n) => n + 1);
          setStatus('ready');
        })
        .catch(() => {
          if (!cancelled && !silent) setStatus('error');
        });
      return () => {
        cancelled = true;
      };
    }, [attempt]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      setList(await fetchSeriesList());
      setFetchTick((n) => n + 1);
    } catch {
      // Yenileme başarısızsa mevcut içerik kalır.
    } finally {
      setRefreshing(false);
    }
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: fetchTick her çekimde ilerlemeyi yeniler
  useEffect(() => {
    let cancelled = false;
    if (!isFocused || list.length === 0) return;
    void (async () => {
      const next = await getAllProgress(userId).catch(() => null);
      if (cancelled || !next) return;
      setProgress(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [isFocused, list, userId, fetchTick]);

  const open = useCallback((slug: string) => router.push(`/series/${slug}` as never), [router]);
  const shelves = useMemo(() => groupForShelves(list), [list]);
  const inProgress = useMemo(
    () =>
      list.filter((item) => {
        const entry = progress[item.id];
        return entry && entry.lastPosition > 0 && !entry.completedAt;
      }),
    [list, progress],
  );

  return (
    <Screen>
      <TopBar title="Seriler" />
      <View style={s.body} testID="series-tab">
        {status === 'loading' ? (
          <ActivityIndicator color={colors.textSecondary} style={s.center} />
        ) : status === 'error' ? (
          <View style={s.center} testID="series-error">
            <Text style={s.message}>Seriler yüklenemedi</Text>
            <Button label="Yeniden dene" onPress={() => setAttempt((n) => n + 1)} />
          </View>
        ) : list.length === 0 ? (
          <View style={s.center} testID="series-empty">
            <Text style={s.message}>Yakında</Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={s.content}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  void onRefresh();
                }}
                tintColor={colors.text}
                colors={[colors.text]}
                progressBackgroundColor={colors.surfaceRaised}
              />
            }
          >
            {shelves.featured ? (
              <SeriesHero
                series={shelves.featured}
                progress={progress[shelves.featured.id]}
                onPress={open}
              />
            ) : null}
            {inProgress.length > 0 ? (
              <View style={s.continue}>
                <View style={s.heading}>
                  <GradientText style={type.meta}>DEVAM ET</GradientText>
                </View>
                {inProgress.map((item) => {
                  const entry = progress[item.id];
                  return (
                    <TouchableOpacity
                      key={item.id}
                      onPress={() => open(item.slug)}
                      activeOpacity={0.85}
                      accessibilityRole="button"
                      accessibilityLabel={item.title}
                      testID="series-continue"
                      style={s.continueRow}
                    >
                      <Media
                        uri={item.coverUrl}
                        category={item.category ?? undefined}
                        style={s.thumb}
                      />
                      <View style={s.continueText}>
                        <Text style={s.continueTitle} numberOfLines={1}>
                          {item.title}
                        </Text>
                        <Text
                          style={s.caption}
                        >{`${entry.lastPosition} / ${item.cardCount} kart`}</Text>
                        <View style={s.track}>
                          <SeriesProgressLine
                            position={entry.lastPosition}
                            total={item.cardCount}
                          />
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : null}
            {shelves.byCategory.map((group) => (
              <SeriesShelf
                key={group.category}
                category={group.category}
                items={group.items}
                progress={progress}
                onPress={open}
              />
            ))}
          </ScrollView>
        )}
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  body: { flex: 1 },
  content: { paddingBottom: space.xxl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md },
  message: { ...type.body, color: colors.textSecondary },
  continue: { marginTop: space.xl },
  heading: { paddingHorizontal: space.screen, marginBottom: space.sm },
  continueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.screen,
    marginBottom: space.sm,
  },
  thumb: { width: CONTINUE_THUMB, height: CONTINUE_THUMB, borderRadius: radius.md },
  continueText: { flex: 1 },
  continueTitle: { ...type.body, color: colors.text },
  caption: { ...type.caption, color: colors.textSecondary },
  track: { marginTop: space.xs },
});
