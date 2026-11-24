import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { resolveFactMedia } from '../../src/lib/factMedia';
import { colors, space, type } from '../../src/theme';
import type { FactType } from '../../src/types';
import { Media } from '../ui/media';

type SavedGridProps = {
  facts: FactType[];
  onPressFact: (fact: FactType) => void;
  emptyText?: string;
};

const COLUMNS = 3;
const GRID_GAP = 2;
// Aralıklar yüzde genişliğe dahil edilir: 3 sütun, 2 boşluk.
const CELL_WIDTH = `${(100 - (COLUMNS - 1) * 0.6) / COLUMNS}%` as const;

export function SavedGrid({ facts, onPressFact, emptyText }: SavedGridProps) {
  if (facts.length === 0) {
    return (
      <View style={s.empty}>
        <Ionicons name="bookmark-outline" size={32} color={colors.textSecondary} />
        {emptyText ? <Text style={s.emptyText}>{emptyText}</Text> : null}
      </View>
    );
  }

  return (
    <View style={s.grid}>
      {facts.map((fact) => {
        const media = resolveFactMedia(fact);
        return (
          <TouchableOpacity
            key={fact.id}
            activeOpacity={0.85}
            onPress={() => onPressFact(fact)}
            style={s.cell}
            testID="saved-grid-item"
          >
            <Media
              uri={media.uri}
              localSource={media.localSource ?? undefined}
              category={fact.category}
              style={s.media}
            />
            <LinearGradient
              colors={['transparent', colors.scrim]}
              style={s.overlay}
              pointerEvents="none"
            >
              <Text style={s.title} numberOfLines={2}>
                {fact.title}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP },
  cell: { width: CELL_WIDTH, aspectRatio: 1, overflow: 'hidden' },
  media: { width: '100%', height: '100%', borderRadius: 0 },
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: space.xs,
    paddingTop: space.lg,
  },
  title: { ...type.caption, color: colors.text },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    paddingVertical: space.xxxl,
    paddingHorizontal: space.xxl,
  },
  emptyText: { ...type.body, color: colors.textSecondary, textAlign: 'center' },
});
