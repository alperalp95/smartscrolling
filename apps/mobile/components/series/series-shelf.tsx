import { LinearGradient } from 'expo-linear-gradient';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, radius, space, type } from '../../src/theme';
import type { SeriesProgress, SeriesSummary } from '../../src/types';
import { Chip } from '../ui/chip';
import { GradientText } from '../ui/gradient';
import { Media } from '../ui/media';

// Raftaki dikey kapak ölçüleri (taslak A).
const PORTRAIT_WIDTH = space.xxxl * 4;
const PORTRAIT_HEIGHT = space.xxxl * 5;
// fact-post.tsx'teki PROGRESS_LINE_HEIGHT ile aynı değer; biri değişirse diğeri de değişmeli.
const PROGRESS_LINE_HEIGHT = 2;
const GRADIENT_START = { x: 0, y: 0 };
const GRADIENT_END = { x: 1, y: 0 };

type SeriesProgressLineProps = {
  position: number;
  total: number;
  testID?: string;
};

/** İnce ilerleme çizgisi: `position / total` oranında marka degradesiyle dolar. */
export function SeriesProgressLine({ position, total, testID }: SeriesProgressLineProps) {
  const ratio = total > 0 ? Math.min(1, position / total) : 0;
  return (
    <View style={s.track} testID={testID}>
      <LinearGradient
        colors={colors.brandGradient}
        start={GRADIENT_START}
        end={GRADIENT_END}
        style={[s.fill, { width: `${ratio * 100}%` }]}
      />
    </View>
  );
}

type SeriesShelfProps = {
  category: string;
  items: SeriesSummary[];
  progress?: Record<string, SeriesProgress>;
  onPress: (slug: string) => void;
};

export function SeriesShelf({ category, items, progress, onPress }: SeriesShelfProps) {
  return (
    <View testID={`series-shelf-${category}`} style={s.root}>
      <View style={s.heading}>
        <GradientText style={type.meta}>{category.toLocaleUpperCase('tr-TR')}</GradientText>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.row}>
        {items.map((item) => {
          const entry = progress?.[item.id];
          const completed = !!entry?.completedAt;
          const started = !!entry && !completed && entry.lastPosition > 0;
          return (
            <TouchableOpacity
              key={item.id}
              onPress={() => onPress(item.slug)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={item.title}
              testID={`series-item-${item.slug}`}
              style={s.item}
            >
              <View style={s.coverWrap}>
                <Media uri={item.coverUrl} category={item.category ?? undefined} style={s.cover} />
                {completed ? (
                  <View style={s.chip} testID={`series-done-${item.slug}`}>
                    <Chip label="✓ Tamamlandı" tone="success" onImage />
                  </View>
                ) : item.isFree ? null : (
                  <View style={s.chip}>
                    <Chip label="PREMIUM" selected />
                  </View>
                )}
                {started ? (
                  <View style={s.line}>
                    <SeriesProgressLine
                      position={entry.lastPosition}
                      total={item.cardCount}
                      testID={`series-progress-${item.slug}`}
                    />
                  </View>
                ) : null}
              </View>
              <Text style={s.title} numberOfLines={2}>
                {item.title}
              </Text>
              <Text style={s.caption}>
                {started
                  ? `${entry.lastPosition} / ${item.cardCount} kart`
                  : `${item.cardCount} kart`}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { marginTop: space.xl },
  heading: { paddingHorizontal: space.screen, marginBottom: space.sm },
  row: { paddingHorizontal: space.screen, gap: space.md },
  item: { width: PORTRAIT_WIDTH },
  coverWrap: {
    width: PORTRAIT_WIDTH,
    height: PORTRAIT_HEIGHT,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  cover: { width: PORTRAIT_WIDTH, height: PORTRAIT_HEIGHT },
  chip: { position: 'absolute', top: space.sm, left: space.sm },
  line: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  track: {
    height: PROGRESS_LINE_HEIGHT,
    backgroundColor: colors.fill,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  fill: { height: PROGRESS_LINE_HEIGHT },
  title: { ...type.body, color: colors.text, marginTop: space.sm },
  caption: { ...type.caption, color: colors.textSecondary },
});
