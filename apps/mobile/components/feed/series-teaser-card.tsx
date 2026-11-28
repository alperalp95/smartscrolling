import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SERIES_TEASER_CONFIG, type SeriesTeaserConfig } from '../../src/config/seriesTeaser';
import { fetchSeriesList, getAllProgress } from '../../src/lib/series';
import {
  type FeedSeriesSlot,
  loadSeenSeriesTeasers,
  markSeriesTeaserSeen,
  planSeriesTeasers,
} from '../../src/lib/seriesTeaser';
import { colors, radius, space, teaser, type } from '../../src/theme';
import type { SeriesSummary } from '../../src/types';
import { MINUTES_PER_CARD } from '../series/series-hero';
import { Chip } from '../ui/chip';
import { GradientButton, GradientText } from '../ui/gradient';
import { Media } from '../ui/media';
import { FEED_TOP_BAR_HEIGHT } from './feed-top-bar';

// Tanıtım özetinin en uzun hali (karakter).
const SUMMARY_MAX_CHARS = 240;
// Tanıtımdaki düğme serinin kaçıncı kartından açar (1. kart kapakta tanıtıldı).
const TEASER_START_POSITION = 2;

/** Serinin ilk paragrafı; 240 karakteri aşarsa üç noktayla biter. */
export function teaserSummary(summary: string | null | undefined): string {
  const first = (summary ?? '').split(/\n+/)[0]?.trim() ?? '';
  if (first.length <= SUMMARY_MAX_CHARS) return first;
  return `${first.slice(0, SUMMARY_MAX_CHARS - 1).trimEnd()}…`;
}

/**
 * Akış açılırken bir kez: seri listesi + ilerleme + görülen tanıtımlar -> sıralı tanıtım kuyruğu.
 * Herhangi bir hata olursa boş döner; akış tanıtımsız devam eder.
 */
export async function loadSeriesTeaserSlots(
  userId: string | null,
  config: SeriesTeaserConfig = SERIES_TEASER_CONFIG,
): Promise<FeedSeriesSlot[]> {
  try {
    const [list, progress, seenIds] = await Promise.all([
      fetchSeriesList(),
      getAllProgress(userId),
      loadSeenSeriesTeasers(),
    ]);
    return planSeriesTeasers(list, progress, seenIds, config);
  } catch {
    return [];
  }
}

type SeriesTeaserCardProps = {
  series: SeriesSummary;
  mode: 'teaser' | 'continue';
  lastPosition: number;
  height: number;
  topInset: number;
  isActive: boolean;
  hasPremium: boolean;
  onOpen: (slug: string, from: number) => void;
};

export function SeriesTeaserCard({
  series,
  mode,
  lastPosition,
  height,
  topInset,
  isActive,
  hasPremium,
  onOpen,
}: SeriesTeaserCardProps) {
  useEffect(() => {
    if (isActive) void markSeriesTeaserSeen(series.id);
  }, [isActive, series.id]);

  const resuming = mode === 'continue';
  const locked = !series.isFree && !hasPremium;
  const category = series.category ? `${series.category} · ` : '';
  const meta = `${category}SERİ`.toLocaleUpperCase('tr-TR');
  const title = resuming
    ? `Kaldığın yerden: ${series.title} · ${lastPosition}/${series.cardCount}`
    : series.title;
  const minutes = Math.max(1, Math.round(series.cardCount * MINUTES_PER_CARD));
  const cta = resuming
    ? 'Kaldığın yerden devam et →'
    : locked
      ? 'İlk 3 kartı ücretsiz oku →'
      : 'Seriyi okumaya devam et →';
  const caption = locked
    ? `${series.cardCount} kart · tamamı Premium'da`
    : `${series.cardCount} kart · ~${minutes} dk${series.isFree ? ' · ücretsiz' : ''}`;
  const summary = teaserSummary(series.summary);

  return (
    <View
      testID={`feed-series-teaser-${series.slug}`}
      style={[s.screen, { height, paddingTop: topInset + FEED_TOP_BAR_HEIGHT }]}
    >
      <View style={s.stack}>
        <View style={[s.ghost, s.ghostFar]} />
        <View style={[s.ghost, s.ghostNear]} />
        <View style={s.cover}>
          <Media uri={series.coverUrl} category={series.category ?? undefined} style={s.media} />
          <View style={s.chips}>
            <Chip label={`SERİ · ${series.cardCount} kart`} selected />
            {locked ? <Chip label="PREMIUM" selected /> : null}
          </View>
        </View>
      </View>
      <View style={s.text}>
        <GradientText style={type.meta}>{meta}</GradientText>
        <Text style={s.title} numberOfLines={2}>
          {title}
        </Text>
        {summary ? (
          <Text style={s.summary} numberOfLines={6}>
            {summary}
          </Text>
        ) : null}
      </View>
      <View style={s.action}>
        <GradientButton
          label={cta}
          onPress={() => onOpen(series.slug, resuming ? lastPosition : TEASER_START_POSITION)}
          testID="feed-series-cta"
        />
        <Text style={s.caption}>{caption}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  screen: {
    width: '100%',
    backgroundColor: colors.bg,
    paddingHorizontal: space.screen,
    paddingBottom: space.lg,
  },
  stack: { height: teaser.coverHeight + teaser.ghostFarTop },
  ghost: {
    position: 'absolute',
    bottom: 0,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.separator,
  },
  ghostNear: {
    top: teaser.ghostNearTop,
    left: space.md,
    right: space.md,
    opacity: teaser.ghostNearOpacity,
  },
  ghostFar: {
    top: teaser.ghostFarTop,
    left: teaser.ghostFarInset,
    right: teaser.ghostFarInset,
    opacity: teaser.ghostFarOpacity,
  },
  cover: {
    height: teaser.coverHeight,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surfaceRaised,
  },
  media: { width: '100%', height: teaser.coverHeight },
  chips: {
    position: 'absolute',
    top: space.sm,
    left: space.sm,
    flexDirection: 'row',
    gap: space.sm,
  },
  text: { marginTop: space.xxl },
  title: { ...type.cardTitle, color: colors.text, marginTop: space.xs },
  summary: { ...type.body, color: colors.textSecondary, marginTop: space.sm },
  action: { marginTop: 'auto' },
  caption: {
    ...type.caption,
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: space.sm,
  },
});
