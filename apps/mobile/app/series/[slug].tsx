import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { MINUTES_PER_CARD } from '../../components/series/series-hero';
import { Chip } from '../../components/ui/chip';
import { GradientButton, GradientText } from '../../components/ui/gradient';
import { IconButton } from '../../components/ui/icon-button';
import { Media } from '../../components/ui/media';
import { Screen } from '../../components/ui/screen';
import { StatBlock } from '../../components/ui/stat-block';
import { TopBar } from '../../components/ui/top-bar';
import { SERIES_CONFIG } from '../../src/config/series';
import { fetchSeriesBySlug, getProgress } from '../../src/lib/series';
import { useAuthStore } from '../../src/store/authStore';
import { colors, radius, space, type } from '../../src/theme';
import type { SeriesDetail, SeriesProgress } from '../../src/types';

// Kapak yüksekliğinin genişliğe oranı (detay ekranıyla aynı).
const COVER_HEIGHT_RATIO = 0.75;
// Kilitli bölüm satırının solukluğu.
const LOCKED_OPACITY = 0.5;

export default function SeriesCoverScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const params = useLocalSearchParams<{ slug?: string }>();
  const slug = params.slug;
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const hasPremium = useAuthStore((state) => state.hasPremium);

  const [series, setSeries] = useState<SeriesDetail | null>(null);
  const [progress, setProgress] = useState<SeriesProgress | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setIsLoading(true);
      let next: SeriesDetail | null = null;
      let entry: SeriesProgress | null = null;
      try {
        next = slug ? await fetchSeriesBySlug(slug) : null;
        entry = next ? await getProgress(next.id, userId) : null;
      } catch {
        next = null;
      }
      if (cancelled) return;
      setSeries(next);
      setProgress(entry);
      setIsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, userId]);

  const coverHeight = (width - space.screen * 2) * COVER_HEIGHT_RATIO;

  const read = (from: number) => {
    router.push(`/series/${slug}/read?from=${from}` as never);
  };

  const renderBody = () => {
    if (isLoading) {
      return (
        <View style={s.center}>
          <ActivityIndicator color={colors.textSecondary} />
        </View>
      );
    }
    if (!series) {
      return (
        <View style={s.center}>
          <Text style={s.centerText}>Seri bulunamadı.</Text>
        </View>
      );
    }

    const minutes = Math.max(1, Math.round(series.cardCount * MINUTES_PER_CARD));
    const category = series.category ? `${series.category} · ` : '';
    const meta = `${category}Vikipedi`.toLocaleUpperCase('tr-TR');
    const resuming = !!progress && progress.lastPosition > 0 && !progress.completedAt;
    const startLabel = resuming
      ? `Devam et (${progress.lastPosition}/${series.cardCount})`
      : 'Okumaya başla';
    const startFrom = resuming ? progress.lastPosition : 1;
    const lockFrom =
      series.isFree || hasPremium ? Number.POSITIVE_INFINITY : SERIES_CONFIG.previewCards;

    return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>
        <View style={[s.cover, { height: coverHeight }]}>
          <Media
            uri={series.coverUrl}
            category={series.category ?? undefined}
            style={s.coverFill}
          />
        </View>

        <View style={s.text}>
          <View style={s.metaRow}>
            <GradientText style={type.meta}>{meta}</GradientText>
            {series.isFree ? null : <Chip label="PREMIUM" selected />}
          </View>
          <Text style={s.title} accessibilityRole="header">
            {series.title}
          </Text>
        </View>

        <View style={s.stats}>
          <StatBlock value={series.cardCount} label="kart" />
          <StatBlock value={`~${minutes}`} label="dk" />
          <StatBlock value={series.sectionCount} label="bölüm" />
        </View>

        <View style={s.text}>
          {series.summary ? <Text style={s.body}>{series.summary}</Text> : null}
          <GradientButton
            label={startLabel}
            onPress={() => read(startFrom)}
            testID="series-start"
          />
        </View>

        {series.sections.length > 0 ? (
          <View style={s.sections}>
            <View style={s.heading}>
              <GradientText style={type.meta}>BÖLÜMLER</GradientText>
            </View>
            {series.sections.map((section, index) => {
              const locked = section.firstPosition > lockFrom;
              const label = `${section.title}, ${section.cardCount} kart${locked ? ', kilitli' : ''}`;
              return (
                <Pressable
                  key={`${section.firstPosition}-${section.title}`}
                  onPress={() => read(section.firstPosition)}
                  accessibilityRole="button"
                  accessibilityLabel={label}
                  testID={`series-section-${index + 1}`}
                  style={[s.section, locked && s.locked]}
                >
                  <Text style={s.sectionTitle} numberOfLines={2}>
                    {section.title}
                  </Text>
                  <Text style={s.caption}>{`${section.cardCount} kart`}</Text>
                  {locked ? (
                    <Ionicons name="lock-closed" size={type.body.fontSize} color={colors.text} />
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        ) : null}

        <View style={s.text}>
          {series.sourceUrl ? (
            <Pressable
              onPress={() => {
                void Linking.openURL(series.sourceUrl);
              }}
              accessibilityRole="link"
            >
              <Text style={s.caption}>{`Kaynak: Vikipedi — ${series.sourceTitle} ›`}</Text>
            </Pressable>
          ) : null}
          <Text style={s.caption}>{`Lisans: ${series.license}`}</Text>
        </View>
      </ScrollView>
    );
  };

  return (
    <Screen>
      <View style={s.root} testID="series-cover">
        <TopBar
          left={
            <IconButton
              name="chevron-back"
              onPress={() => router.back()}
              accessibilityLabel="Geri"
              testID="series-cover-back"
            />
          }
        />
        {renderBody()}
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md },
  centerText: { ...type.body, color: colors.textSecondary, textAlign: 'center' },
  content: { paddingBottom: space.xxl, gap: space.lg },
  cover: { marginHorizontal: space.screen, borderRadius: radius.lg, overflow: 'hidden' },
  coverFill: { flex: 1, width: '100%' },
  text: { paddingHorizontal: space.screen, gap: space.md },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  title: { ...type.cardTitle, color: colors.text },
  body: { ...type.body, color: colors.text },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: space.screen,
  },
  sections: { gap: space.sm },
  heading: { paddingHorizontal: space.screen },
  section: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginHorizontal: space.screen,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  locked: { opacity: LOCKED_OPACITY },
  sectionTitle: { ...type.body, color: colors.text, flex: 1 },
  caption: { ...type.caption, color: colors.textSecondary },
});
