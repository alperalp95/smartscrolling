import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';
import { colors, space, type } from '../../src/theme';

type AvatarProps = {
  initial: string;
  size?: number;
  ring?: boolean;
};

function circle(dim: number) {
  return { width: dim, height: dim, borderRadius: dim / 2 };
}

export function Avatar({ initial, size = 72, ring }: AvatarProps) {
  const letter = initial.trim().charAt(0).toLocaleUpperCase('tr-TR');
  // Halkalıysa: dış gradyan halka (space.xs), halka ile iç daire arasında colors.bg aralığı (space.xs).
  const inner = ring ? size - space.xs * 4 : size;

  const core = (
    <View style={[s.core, circle(inner)]}>
      <Text style={s.letter}>{letter}</Text>
    </View>
  );

  if (!ring) return core;

  return (
    <LinearGradient
      colors={colors.brandGradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[s.center, circle(size)]}
    >
      <View style={[s.gap, s.center, circle(size - space.xs * 2)]}>{core}</View>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  gap: { backgroundColor: colors.bg },
  core: { backgroundColor: colors.fill, alignItems: 'center', justifyContent: 'center' },
  letter: { ...type.stat, color: colors.text },
});
