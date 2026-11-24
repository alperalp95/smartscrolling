import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { colors, space, type } from '../../src/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

type SettingsRowProps = {
  icon: IconName;
  title: string;
  value?: string;
  onPress?: () => void;
  disabled?: boolean;
  danger?: boolean;
  // Verilirse satırın sağında chevron yerine anahtar (Switch) çıkar.
  switchValue?: boolean;
  onSwitchChange?: (next: boolean) => void;
  testID?: string;
};

export function SettingsRow({
  icon,
  title,
  value,
  onPress,
  disabled,
  danger,
  switchValue,
  onSwitchChange,
  testID,
}: SettingsRowProps) {
  const tint = danger ? colors.danger : colors.text;
  const hasSwitch = switchValue !== undefined;
  const content = (
    <>
      <Ionicons name={icon} size={22} color={tint} style={s.icon} />
      <Text style={[s.title, { color: tint }]} numberOfLines={1}>
        {title}
      </Text>
      {value ? (
        <Text style={s.value} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {hasSwitch ? (
        <Switch
          value={switchValue}
          onValueChange={onSwitchChange}
          disabled={disabled}
          trackColor={{ true: colors.brandGradient[1], false: colors.fill }}
          accessibilityLabel={title}
          testID={testID ? `${testID}-switch` : undefined}
        />
      ) : (
        <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
      )}
    </>
  );

  if (hasSwitch) {
    return (
      <View style={s.row} testID={testID}>
        {content}
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={[s.row, disabled && s.disabled]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={title}
      testID={testID}
    >
      {content}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: space.xxxl + space.lg,
    paddingHorizontal: space.screen,
    borderBottomWidth: 1,
    borderBottomColor: colors.separator,
  },
  disabled: { opacity: 0.5 },
  icon: { marginRight: space.md },
  title: { ...type.body, flex: 1 },
  value: { ...type.caption, color: colors.textSecondary, marginHorizontal: space.sm },
});
