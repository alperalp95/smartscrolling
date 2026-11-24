import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { TouchableOpacity } from 'react-native';
import { colors } from '../../src/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

type IconButtonProps = {
  name: IconName;
  onPress: () => void;
  size?: number;
  color?: string;
  active?: boolean;
  activeName?: IconName;
  testID?: string;
  accessibilityLabel: string;
};

function filledName(name: IconName, activeName?: IconName): IconName {
  if (activeName) return activeName;
  if (name.endsWith('-outline')) return name.slice(0, -'-outline'.length) as IconName;
  return name;
}

export function IconButton({
  name,
  onPress,
  size = 24,
  color = colors.text,
  active,
  activeName,
  testID,
  accessibilityLabel,
}: IconButtonProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      hitSlop={8}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
    >
      <Ionicons name={active ? filledName(name, activeName) : name} size={size} color={color} />
    </TouchableOpacity>
  );
}
