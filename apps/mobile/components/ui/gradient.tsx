import { Ionicons } from '@expo/vector-icons';
import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import type { ComponentProps, ReactNode } from 'react';
import { type StyleProp, StyleSheet, Text, type TextStyle, TouchableOpacity } from 'react-native';
import { colors, radius, space, type } from '../../src/theme';

type GradientButtonProps = {
  label: string;
  onPress: () => void;
  size?: 'md' | 'pill';
  icon?: ComponentProps<typeof Ionicons>['name'];
  disabled?: boolean;
  testID?: string;
};

const start = { x: 0, y: 0 };
const end = { x: 1, y: 0 };

export function GradientButton({
  label,
  onPress,
  size = 'md',
  icon,
  disabled,
  testID,
}: GradientButtonProps) {
  const pill = size === 'pill';
  return (
    <TouchableOpacity
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      testID={testID}
      style={[pill ? s.pillWrap : s.mdWrap, disabled && s.disabled]}
    >
      <LinearGradient
        colors={colors.brandGradient}
        start={start}
        end={end}
        style={[s.base, pill ? s.pill : s.md]}
      >
        {icon ? (
          <Ionicons name={icon} size={type.button.fontSize} color={colors.text} style={s.icon} />
        ) : null}
        <Text style={s.label}>{label}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

type GradientTextProps = {
  children: ReactNode;
  style?: StyleProp<TextStyle>;
};

export function GradientText({ children, style }: GradientTextProps) {
  return (
    <MaskedView maskElement={<Text style={style}>{children}</Text>}>
      <LinearGradient colors={colors.brandGradient} start={start} end={end}>
        <Text style={[style, s.hidden]}>{children}</Text>
      </LinearGradient>
    </MaskedView>
  );
}

const s = StyleSheet.create({
  mdWrap: { alignSelf: 'stretch' },
  pillWrap: { alignSelf: 'flex-start' },
  base: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  md: { borderRadius: radius.md, paddingVertical: space.md },
  pill: { borderRadius: radius.full, paddingVertical: space.xs, paddingHorizontal: space.md },
  disabled: { opacity: 0.5 },
  icon: { marginRight: space.xs },
  label: { ...type.button, color: colors.text },
  hidden: { opacity: 0 },
});
