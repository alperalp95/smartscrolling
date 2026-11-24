import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { colors, radius, space, type } from '../../src/theme';

type ChipProps = {
  label: string;
  onPress?: () => void;
  selected?: boolean;
  testID?: string;
};

export function Chip({ label, onPress, selected, testID }: ChipProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.7}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityState={{ selected: !!selected }}
      testID={testID}
      style={[s.chip, selected && s.selected]}
    >
      <Text style={[s.label, selected && s.labelSelected]}>{label}</Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  chip: {
    borderWidth: 1,
    borderColor: colors.separator,
    borderRadius: radius.full,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
  },
  selected: { backgroundColor: colors.fill },
  label: { ...type.chip, color: colors.textSecondary },
  labelSelected: { color: colors.text },
});
