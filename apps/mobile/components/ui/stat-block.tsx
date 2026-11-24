import { StyleSheet, Text, View } from 'react-native';
import { colors, type } from '../../src/theme';

type StatBlockProps = {
  value: number | string;
  label: string;
};

export function StatBlock({ value, label }: StatBlockProps) {
  return (
    <View style={s.root}>
      <Text style={s.value}>{value}</Text>
      <Text style={s.label}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { alignItems: 'center' },
  value: { ...type.stat, color: colors.text },
  label: { ...type.caption, color: colors.textSecondary },
});
