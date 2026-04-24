import { Ionicons } from '@expo/vector-icons';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useIsFocused } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ReaderScreen() {
  const isFocused = useIsFocused();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const topPadding = Math.max(insets.top, Platform.OS === 'web' ? 24 : 0);

  return (
    <View style={[s.container, Platform.OS === 'web' && !isFocused ? s.webHiddenScreen : null]}>
      {/* Decorative background circles */}
      <View style={s.bgCircle1} />
      <View style={s.bgCircle2} />

      {/* Header */}
      <View style={[s.header, { paddingTop: topPadding + 10 }]}>
        <Text style={s.title}>Okuyucu</Text>
      </View>

      {/* Empty state */}
      <View style={[s.emptyState, { paddingBottom: tabBarHeight + 16 }]}>
        <View style={s.iconWrap}>
          <Ionicons name="book-outline" size={48} color="#a78bfa" />
        </View>
        <Text style={s.emptyTitle}>Okumaya Başla</Text>
        <Text style={s.emptyDesc}>
          Kütüphane'den bir kitap seçerek okuma deneyimini başlat. Her bölüm AI destekli özet ve
          kelime açıklamalarıyla gelir.
        </Text>

        <TouchableOpacity
          style={s.ctaButton}
          activeOpacity={0.85}
          onPress={() => router.push('/library')}
        >
          <Ionicons name="library-outline" size={18} color="#fff" />
          <Text style={s.ctaText}>Kütüphaneye Git</Text>
        </TouchableOpacity>

        {/* Feature chips */}
        <View style={s.featureRow}>
          {FEATURES.map((f) => (
            <View key={f.label} style={s.featureChip}>
              <Ionicons name={f.icon} size={13} color={f.color} />
              <Text style={s.featureText}>{f.label}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const FEATURES: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  color: string;
}[] = [
  { icon: 'sparkles', label: 'AI Özet', color: '#a78bfa' },
  { icon: 'text', label: 'Kelime Açıklama', color: '#0a84ff' },
  { icon: 'bookmark', label: 'Kaydet', color: '#30d158' },
  { icon: 'headset', label: 'Sesli Okuma', color: '#ff9f0a' },
];

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  webHiddenScreen: {
    display: 'none',
  },

  // Decorative
  bgCircle1: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(139,92,246,0.07)',
    top: -60,
    right: -80,
  },
  bgCircle2: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(10,132,255,0.05)',
    bottom: 100,
    left: -60,
  },

  // Header
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  title: {
    fontSize: 34,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.5,
  },

  // Empty state
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingBottom: 80,
  },
  iconWrap: {
    width: 96,
    height: 96,
    borderRadius: 28,
    backgroundColor: 'rgba(139,92,246,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 12,
    textAlign: 'center',
  },
  emptyDesc: {
    fontSize: 14,
    color: '#8e8e93',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },

  // CTA
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#8b5cf6',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 16,
    marginBottom: 28,
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  ctaText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },

  // Feature chips
  featureRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  featureChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#1c1c1e',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  featureText: {
    fontSize: 12,
    color: '#aeaeb2',
    fontWeight: '600',
  },
});
