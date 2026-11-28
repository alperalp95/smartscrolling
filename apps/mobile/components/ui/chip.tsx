import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { colors, radius, space, type } from '../../src/theme';

type ChipProps = {
  label: string;
  onPress?: () => void;
  selected?: boolean;
  // 'success': yeşil "tamamlandı" çipi.
  tone?: 'success';
  // Fotoğrafın üstündeki çip: zemin koyu ve opak, yazı rengi aynı kalır.
  onImage?: boolean;
  testID?: string;
};

export function Chip({ label, onPress, selected, tone, onImage, testID }: ChipProps) {
  const success = tone === 'success';
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.7}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityState={{ selected: !!selected }}
      testID={testID}
      style={[
        s.chip,
        selected && s.selected,
        success && s.success,
        success && onImage && s.successOnImage,
      ]}
    >
      <Text style={[s.label, selected && s.labelSelected, success && s.successLabel]}>{label}</Text>
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
  success: { backgroundColor: colors.successSoft, borderColor: colors.successSoft },
  successOnImage: { backgroundColor: colors.scrimStrong, borderColor: colors.scrimStrong },
  successLabel: { color: colors.success },
});
