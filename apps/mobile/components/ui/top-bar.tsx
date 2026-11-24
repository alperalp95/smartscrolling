import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, space, type } from '../../src/theme';

type TopBarProps = {
  title?: string;
  left?: ReactNode;
  right?: ReactNode;
};

export function TopBar({ title, left, right }: TopBarProps) {
  return (
    <View style={s.bar}>
      {left ? <View style={s.side}>{left}</View> : null}
      {title ? (
        <Text style={s.title} numberOfLines={1}>
          {title}
        </Text>
      ) : null}
      <View style={s.spacer} />
      {right ? <View style={s.side}>{right}</View> : null}
    </View>
  );
}

const s = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: space.xxxl + space.lg,
    paddingHorizontal: space.screen,
  },
  side: { flexDirection: 'row', alignItems: 'center', marginRight: space.sm },
  title: { ...type.screenTitle, color: colors.text, flexShrink: 1 },
  spacer: { flex: 1 },
});
