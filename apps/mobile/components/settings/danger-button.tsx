import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { colors, radius, space, type } from '../../src/theme';

type DangerButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
};

export function DangerButton({ label, onPress, disabled, testID }: DangerButtonProps) {
  return (
    <TouchableOpacity
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      testID={testID}
      style={[s.base, disabled && s.disabled]}
    >
      <Text style={s.label}>{label}</Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  base: {
    alignSelf: 'stretch',
    alignItems: 'center',
    backgroundColor: colors.danger,
    borderRadius: radius.md,
    paddingVertical: space.md,
  },
  disabled: { opacity: 0.5 },
  label: { ...type.button, color: colors.text },
});
