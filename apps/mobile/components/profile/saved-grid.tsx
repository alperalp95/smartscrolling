import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import {
  type LayoutChangeEvent,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
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

// Kap genişliğinden hücre genişliği: her zaman 3 sütun, aralıklar düşülür.
export function gridCellWidth(containerWidth: number) {
  return Math.floor((containerWidth - (COLUMNS - 1) * GRID_GAP) / COLUMNS);
}

export function SavedGrid({ facts, onPressFact, emptyText }: SavedGridProps) {
  const windowWidth = useWindowDimensions().width;
  const [measured, setMeasured] = useState<number | null>(null);
  const cellWidth = gridCellWidth(measured ?? windowWidth);

  function handleLayout(event: LayoutChangeEvent) {
    setMeasured(event.nativeEvent.layout.width);
  }

  if (facts.length === 0) {
    return (
      <View style={s.empty}>
        <Ionicons name="bookmark-outline" size={32} color={colors.textSecondary} />
        {emptyText ? <Text style={s.emptyText}>{emptyText}</Text> : null}
      </View>
    );
  }

  return (
    <View style={s.grid} onLayout={handleLayout} testID="saved-grid">
      {facts.map((fact) => {
        const media = resolveFactMedia(fact);
        return (
          <TouchableOpacity
            key={fact.id}
            activeOpacity={0.85}
            onPress={() => onPressFact(fact)}
            style={[s.cell, { width: cellWidth, height: cellWidth }]}
            accessibilityRole="button"
            accessibilityLabel={fact.title}
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
  cell: { overflow: 'hidden' },
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
