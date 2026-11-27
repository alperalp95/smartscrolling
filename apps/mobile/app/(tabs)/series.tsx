import { useIsFocused } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SeriesHero } from '../../components/series/series-hero';
import { SeriesShelf } from '../../components/series/series-shelf';
import { Button } from '../../components/ui/button';
import { GradientText } from '../../components/ui/gradient';
import { Media } from '../../components/ui/media';
import { Screen } from '../../components/ui/screen';
import { TopBar } from '../../components/ui/top-bar';
import { fetchSeriesList, getProgress, groupForShelves } from '../../src/lib/series';
import { useAuthStore } from '../../src/store/authStore';
import { colors, radius, space, type } from '../../src/theme';
import type { SeriesProgress, SeriesSummary } from '../../src/types';

// Devam et satırındaki küçük kapak ve ilerleme çizgisi ölçüleri.
const CONTINUE_THUMB = space.xxxl + space.xxl;
// fact-post.tsx'teki PROGRESS_LINE_HEIGHT ile aynı değer; biri değişirse diğeri de değişmeli.
const PROGRESS_LINE_HEIGHT = 2;
const GRADIENT_START = { x: 0, y: 0 };
const GRADIENT_END = { x: 1, y: 0 };

type Status = 'loading' | 'ready' | 'error';

export default function SeriesTabScreen() {
  const router = useRouter();
  const isFocused = useIsFocused();
  const userId = useAuthStore((state) => state.user?.id ?? null);

  const [status, setStatus] = useState<Status>('loading');
  const [list, setList] = useState<SeriesSummary[]>([]);
  const [progress, setProgress] = useState<Record<string, SeriesProgress>>({});
  const [attempt, setAttempt] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: attempt "yeniden dene" ile tetiklenir
  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    void fetchSeriesList()
      .then((next) => {
        if (cancelled) return;
        setList(next);
        setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  useEffect(() => {
    let cancelled = false;
    if (!isFocused || list.length === 0) return;
    void (async () => {
      const entries = await Promise.all(
        list.map(async (item) => [item.id, await getProgress(item.id, userId)] as const),
      );
      if (cancelled) return;
      const next: Record<string, SeriesProgress> = {};
      for (const [id, value] of entries) if (value) next[id] = value;
      setProgress(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [isFocused, list, userId]);

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
          <ScrollView contentContainerStyle={s.content}>
            {shelves.featured ? <SeriesHero series={shelves.featured} onPress={open} /> : null}
            {inProgress.length > 0 ? (
              <View style={s.continue}>
                <View style={s.heading}>
                  <GradientText style={type.meta}>DEVAM ET</GradientText>
                </View>
                {inProgress.map((item) => {
                  const entry = progress[item.id];
                  const ratio = item.cardCount > 0 ? entry.lastPosition / item.cardCount : 0;
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
                          <LinearGradient
                            colors={colors.brandGradient}
                            start={GRADIENT_START}
                            end={GRADIENT_END}
                            style={[s.fill, { width: `${Math.min(100, ratio * 100)}%` }]}
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
  track: {
    height: PROGRESS_LINE_HEIGHT,
    backgroundColor: colors.fill,
    borderRadius: radius.full,
    overflow: 'hidden',
    marginTop: space.xs,
  },
  fill: { height: PROGRESS_LINE_HEIGHT },
});
