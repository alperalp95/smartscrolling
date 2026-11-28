import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, radius, space, type } from '../../src/theme';
import type { SeriesProgress, SeriesSummary } from '../../src/types';
import { Chip } from '../ui/chip';
import { GradientText } from '../ui/gradient';
import { Media } from '../ui/media';
import { SeriesProgressLine } from './series-shelf';

// Kapak yüksekliği (taslak A: öne çıkan seri).
const HERO_HEIGHT = space.xxxl * 6 + space.sm * 2;
// Tahmini okuma süresi: kart başına dakika.
// Üst uç saydam, alt yarı tam koyu: alttaki yazılar açık fotoğrafta da okunur.
const SCRIM_COLORS = [colors.scrimClear, colors.scrimStrong, colors.scrimStrong] as const;
const SCRIM_LOCATIONS = [0, 0.5, 1] as const;
export const MINUTES_PER_CARD = 1;

type SeriesHeroProps = {
  series: SeriesSummary;
  progress?: SeriesProgress | null;
  onPress: (slug: string) => void;
};

export function SeriesHero({ series, progress, onPress }: SeriesHeroProps) {
  const completed = !!progress?.completedAt;
  const started = !!progress && !completed && progress.lastPosition > 0;
  const category = series.category ? ` · ${series.category}` : '';
  const meta = `ÖNE ÇIKAN${category}`.toLocaleUpperCase('tr-TR');
  const minutes = Math.max(1, Math.round(series.cardCount * MINUTES_PER_CARD));
  return (
    <TouchableOpacity
      onPress={() => onPress(series.slug)}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={series.title}
      testID="series-hero"
      style={s.root}
    >
      <Media uri={series.coverUrl} category={series.category ?? undefined} style={s.cover} />
      <LinearGradient
        colors={SCRIM_COLORS}
        locations={SCRIM_LOCATIONS}
        style={s.scrim}
        pointerEvents="none"
      />
      {completed ? (
        <View style={s.chip} testID="series-hero-done">
          <Chip label="✓ Tamamlandı" tone="success" onImage />
        </View>
      ) : series.isFree ? null : (
        <View style={s.chip}>
          <Chip label="PREMIUM" selected />
        </View>
      )}
      <View style={s.over} pointerEvents="none">
        <GradientText style={type.meta}>{meta}</GradientText>
        <Text style={s.title} numberOfLines={2}>
          {series.title}
        </Text>
        <Text style={s.caption}>
          {started
            ? `${progress.lastPosition} / ${series.cardCount} kart · ~${minutes} dk`
            : `${series.cardCount} kart · ~${minutes} dk`}
        </Text>
      </View>
      {started ? (
        <View style={s.line} pointerEvents="none">
          <SeriesProgressLine
            position={progress.lastPosition}
            total={series.cardCount}
            testID="series-hero-progress"
          />
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  root: {
    height: HERO_HEIGHT,
    marginHorizontal: space.screen,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surfaceRaised,
  },
  cover: { width: '100%', height: HERO_HEIGHT },
  scrim: { ...StyleSheet.absoluteFillObject },
  chip: { position: 'absolute', top: space.md, left: space.md },
  line: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  over: { position: 'absolute', left: space.md, right: space.md, bottom: space.md },
  title: { ...type.cardTitle, color: colors.text, marginTop: space.xs },
  caption: { ...type.caption, color: colors.text, marginTop: space.xs },
});
