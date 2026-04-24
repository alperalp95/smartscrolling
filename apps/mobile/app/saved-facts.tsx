import { useIsFocused } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { fetchSavedFacts } from '../src/lib/facts';
import { useAuthStore } from '../src/store/authStore';
import { useFeedStore } from '../src/store/feedStore';
import type { FactType } from '../src/types';

export default function SavedFactsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const user = useAuthStore((state) => state.user);
  const savedIds = useFeedStore((state) => state.savedIds);
  const toggleSave = useFeedStore((state) => state.toggleSave);
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
    <View style={s.container}>
      <SafeAreaView style={s.safeArea} edges={['top', 'bottom']}>
        <View
          style={[s.header, { paddingTop: Math.max(insets.top, Platform.OS === 'web' ? 20 : 0) }]}
        >
          <TouchableOpacity onPress={() => router.back()} style={s.backButton}>
            <Text style={s.backButtonText}>Geri</Text>
          </TouchableOpacity>
          <Text style={s.title}>Kaydettiklerim</Text>
          <Text style={s.subtitle}>
            {user ? `${visibleSavedFacts.length} kayitli fact` : 'Giris yapinca burada birikecek'}
          </Text>
        </View>

        {!user ? (
          <View style={s.centerState}>
            <Text style={s.centerTitle}>Saved feed giris ile acilir</Text>
            <Text style={s.centerText}>
              Feed ekraninda kaydettigin bilgi kartlarini burada toplu sekilde goreceksin.
            </Text>
          </View>
        ) : isLoading ? (
          <View style={s.centerState}>
            <Text style={s.centerTitle}>Kaydettiklerin yukleniyor...</Text>
          </View>
        ) : visibleSavedFacts.length === 0 ? (
          <View style={s.centerState}>
            <Text style={s.centerTitle}>Henuz kaydedilmis bir fact yok</Text>
            <Text style={s.centerText}>
              Akista ilgini ceken bilgi kartlarini kaydettiginde burada tekrar okuyabileceksin.
            </Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={[
              s.scrollContent,
              { paddingBottom: Math.max(insets.bottom, 20) + 24 },
            ]}
            showsVerticalScrollIndicator={false}
          >
            {visibleSavedFacts.map((fact) => (
              <TouchableOpacity
                key={fact.id}
                activeOpacity={0.88}
                onPress={() => router.push(`/fact/${fact.id}` as never)}
                style={s.card}
              >
                <View style={s.cardHeader}>
                  <View style={s.badge}>
                    <Text style={s.badgeText}>{fact.category}</Text>
                  </View>
                  {fact.verified ? <Text style={s.verified}>Dogrulandi</Text> : null}
                </View>
                <Text numberOfLines={2} style={s.cardTitle}>
                  {fact.title}
                </Text>
                <Text numberOfLines={5} style={s.cardContent}>
                  {fact.content}
                </Text>
                <View style={s.cardFooter}>
                  <Text numberOfLines={1} style={s.cardSource}>
                    {fact.source_label ?? 'Kaynak belirtilmedi'}
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      void toggleSave(fact.id);
                    }}
                    style={s.removeButton}
                  >
                    <Text style={s.removeButtonText}>Kayittan Cikar</Text>
                  </TouchableOpacity>
                  {fact.source_url ? (
                    <TouchableOpacity
                      onPress={() => fact.source_url && Linking.openURL(fact.source_url)}
                    >
                      <Text style={s.cardLink}>Kaynak</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  safeArea: { flex: 1 },
  header: {
    paddingBottom: 12,
    paddingHorizontal: 18,
  },
  backButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#161618',
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 999,
    borderWidth: 0.5,
    marginBottom: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  title: {
    color: '#fff',
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  subtitle: {
    color: '#8e8e93',
    fontSize: 13,
    marginTop: 6,
  },
  centerState: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  centerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  centerText: {
    color: '#8e8e93',
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
  },
  scrollContent: {
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  card: {
    backgroundColor: '#111214',
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 18,
    borderWidth: 0.5,
    padding: 16,
  },
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  badge: {
    backgroundColor: 'rgba(167,139,250,0.14)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeText: {
    color: '#c4b5fd',
    fontSize: 11,
    fontWeight: '700',
  },
  verified: {
    color: '#a78bfa',
    fontSize: 11,
    fontWeight: '700',
  },
  cardTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 22,
    marginBottom: 10,
  },
  cardContent: {
    color: '#d1d1d6',
    fontSize: 13,
    lineHeight: 20,
  },
  cardFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    marginTop: 16,
  },
  cardSource: {
    color: '#8e8e93',
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
    paddingRight: 12,
  },
  cardLink: {
    color: '#a78bfa',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 12,
  },
  removeButton: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  removeButtonText: {
    color: '#f1c27d',
    fontSize: 11,
    fontWeight: '700',
  },
});
