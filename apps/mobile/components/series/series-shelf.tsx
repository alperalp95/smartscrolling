import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, space, type } from '../../src/theme';
import type { SeriesSummary } from '../../src/types';
import { Chip } from '../ui/chip';
import { GradientText } from '../ui/gradient';
import { Media } from '../ui/media';

// Raftaki dikey kapak ölçüleri (taslak A).
const PORTRAIT_WIDTH = space.xxxl * 4;
const PORTRAIT_HEIGHT = space.xxxl * 5;

type SeriesShelfProps = {
  category: string;
  items: SeriesSummary[];
  onPress: (slug: string) => void;
};

export function SeriesShelf({ category, items, onPress }: SeriesShelfProps) {
  return (
    <View testID={`series-shelf-${category}`} style={s.root}>
      <View style={s.heading}>
        <GradientText style={type.meta}>{category.toLocaleUpperCase('tr-TR')}</GradientText>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.row}>
        {items.map((item) => (
          <TouchableOpacity
            key={item.id}
            onPress={() => onPress(item.slug)}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={item.title}
            testID={`series-item-${item.slug}`}
            style={s.item}
          >
            <Media uri={item.coverUrl} category={item.category ?? undefined} style={s.cover} />
            {item.isFree ? null : (
              <View style={s.chip}>
                <Chip label="PREMIUM" selected />
              </View>
            )}
            <Text style={s.title} numberOfLines={2}>
              {item.title}
            </Text>
            <Text style={s.caption}>{`${item.cardCount} kart`}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { marginTop: space.xl },
  heading: { paddingHorizontal: space.screen, marginBottom: space.sm },
  row: { paddingHorizontal: space.screen, gap: space.md },
  item: { width: PORTRAIT_WIDTH },
  cover: { width: PORTRAIT_WIDTH, height: PORTRAIT_HEIGHT },
  chip: { position: 'absolute', top: space.sm, left: space.sm },
  title: { ...type.body, color: colors.text, marginTop: space.sm },
  caption: { ...type.caption, color: colors.textSecondary },
});
