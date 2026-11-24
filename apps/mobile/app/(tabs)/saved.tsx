import { useIsFocused } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SavedGrid } from '../../components/profile/saved-grid';
import { Button } from '../../components/ui/button';
import { Screen } from '../../components/ui/screen';
import { TopBar } from '../../components/ui/top-bar';
import { fetchSavedFacts } from '../../src/lib/facts';
import { useAuthStore } from '../../src/store/authStore';
import { useFeedStore } from '../../src/store/feedStore';
import { colors, space, type } from '../../src/theme';
import type { FactType } from '../../src/types';

export default function SavedScreen() {
  const router = useRouter();
  const isFocused = useIsFocused();
  const user = useAuthStore((state) => state.user);
  const savedIds = useFeedStore((state) => state.savedIds);
  const savedIdsVersion = savedIds.join('|');
  const [savedFacts, setSavedFacts] = useState<FactType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const visibleSavedFacts = useMemo(
    () => savedFacts.filter((fact) => savedIds.includes(fact.id)),
    [savedFacts, savedIds],
  );

  useEffect(() => {
    if (!isFocused && !savedIdsVersion) {
      return;
    }

    let cancelled = false;

    void (async () => {
      setIsLoading(true);
      const nextSavedFacts = await fetchSavedFacts(user?.id, 50);

      if (cancelled) {
        return;
      }

      setSavedFacts(nextSavedFacts);
      setIsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [isFocused, savedIdsVersion, user?.id]);

  return (
    <Screen>
      <View style={s.root} testID="saved-screen">
        <TopBar title="Kaydedilenler" />
        {!user ? (
          <View style={s.center}>
            <Text style={s.centerText}>
              Kaydettiğin kartlar burada görünür. Kaydetmek için giriş yap.
            </Text>
            <Button label="Giriş yap" onPress={() => router.push('/(tabs)/profile')} />
          </View>
        ) : isLoading ? (
          <View style={s.center}>
            <ActivityIndicator color={colors.textSecondary} />
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false}>
            <SavedGrid
              facts={visibleSavedFacts}
              emptyText="Henüz kaydedilmiş kart yok."
              onPressFact={(fact) => router.push(`/fact/${fact.id}` as never)}
            />
          </ScrollView>
        )}
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.lg,
    paddingHorizontal: space.xxl,
  },
  centerText: { ...type.body, color: colors.textSecondary, textAlign: 'center' },
});
