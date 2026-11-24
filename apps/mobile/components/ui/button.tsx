import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { colors, radius, space, type } from '../../src/theme';

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: 'secondary' | 'ghost';
  disabled?: boolean;
  testID?: string;
};

export function Button({ label, onPress, variant = 'secondary', disabled, testID }: ButtonProps) {
  const ghost = variant === 'ghost';
  return (
    <TouchableOpacity
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      testID={testID}
      style={[s.base, !ghost && s.secondary, disabled && s.disabled]}
    >
      <Text style={[s.label, ghost && s.ghostLabel]}>{label}</Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  base: { alignItems: 'center', paddingVertical: space.md, paddingHorizontal: space.md },
  secondary: { backgroundColor: colors.fill, borderRadius: radius.md },
  disabled: { opacity: 0.5 },
  label: { ...type.button, color: colors.text },
  ghostLabel: { color: colors.textSecondary },
});
