import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, space, type } from '../../src/theme';
import { BottomSheet } from '../ui/bottom-sheet';
import { Button } from '../ui/button';
import { StatBlock } from '../ui/stat-block';

// FactPost üst payı `topInset + 56` varsayar; bu değerle aynı olmalı.
export const FEED_TOP_BAR_HEIGHT = 56;

type FeedTopBarProps = {
  isSignedIn: boolean;
  streakDays: number;
  todayFactsRead: number;
  dailyGoal: number | null;
  onLogin: () => void;
  onChangeGoal: () => void;
};

export function FeedTopBar({
  isSignedIn,
  streakDays,
  todayFactsRead,
  dailyGoal,
  onLogin,
  onChangeGoal,
}: FeedTopBarProps) {
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <SafeAreaView edges={['top']} style={s.wrap}>
      <View style={s.row}>
        <Text style={s.title} accessibilityRole="header">
          SmartScrolling
        </Text>
        {isSignedIn ? (
          <TouchableOpacity
            testID="feed-streak"
            onPress={() => setSheetOpen(true)}
            activeOpacity={0.7}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Bugünün özetini aç"
            style={s.streak}
          >
            <Ionicons name="flame" size={22} color={colors.brandGradient[0]} />
            <Text style={s.streakCount}>{streakDays}</Text>
          </TouchableOpacity>
        ) : (
          <Button variant="secondary" label="Giriş yap" onPress={onLogin} />
        )}
      </View>
      <BottomSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} title="Bugün">
        <View style={s.stats}>
          <StatBlock
            value={dailyGoal ? `${todayFactsRead}/${dailyGoal} kart` : `${todayFactsRead} kart`}
            label={dailyGoal ? 'Günlük hedef' : 'Günlük hedef seçilmedi'}
          />
          <StatBlock value={`${streakDays} gün seri`} label="Seri" />
        </View>
        <Button
          label="Hedefi değiştir"
          onPress={() => {
            setSheetOpen(false);
            onChangeGoal();
          }}
        />
      </BottomSheet>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  wrap: { backgroundColor: colors.bg },
  row: {
    height: FEED_TOP_BAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.screen,
  },
  title: { ...type.screenTitle, color: colors.text },
  streak: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    minHeight: space.xxxl + space.sm,
    paddingHorizontal: space.xs,
  },
  streakCount: { ...type.button, color: colors.text },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: space.lg,
  },
});
