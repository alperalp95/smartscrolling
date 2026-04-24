import { Ionicons } from '@expo/vector-icons';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useRouter } from 'expo-router';
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type CategoryItem = {
  emoji: string;
  label: string;
  count: number;
  color: string;
};

const CATEGORIES: CategoryItem[] = [
  { emoji: '🔬', label: 'Bilim', count: 48, color: '#0a84ff' },
  { emoji: '📜', label: 'Tarih', count: 36, color: '#ff9f0a' },
  { emoji: '🧠', label: 'Felsefe', count: 22, color: '#a78bfa' },
  { emoji: '💻', label: 'Teknoloji', count: 54, color: '#30d158' },
  { emoji: '🌱', label: 'Sağlık', count: 29, color: '#ff6b6b' },
  { emoji: '🌍', label: 'Coğrafya', count: 17, color: '#5ac8fa' },
];

type TrendingItem = {
  id: string;
  title: string;
  category: string;
  reads: string;
  emoji: string;
  color: string;
};

const TRENDING: TrendingItem[] = [
  {
    id: '1',
    title: 'Kara Delikler Gerçekten Var mı?',
    category: 'Bilim',
    reads: '12.4K',
    emoji: '🌑',
    color: '#1e1b4b',
  },
  {
    id: '2',
    title: 'Stoacılık Neden Hâlâ Geçerli?',
    category: 'Felsefe',
    reads: '9.8K',
    emoji: '🏛️',
    color: '#1a1a2e',
  },
  {
    id: '3',
    title: 'Kuantum Bilisayarlar Ne Değiştirecek?',
    category: 'Teknoloji',
    reads: '18.2K',
    emoji: '⚛️',
    color: '#0f2027',
  },
];

export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const topPadding = Math.max(insets.top, Platform.OS === 'web' ? 24 : 0);
  const router = useRouter();

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={[s.header, { paddingTop: topPadding + 10 }]}>
        <View>
          <Text style={s.title}>Keşfet</Text>
          <Text style={s.subtitle}>Yeni bilgiler keşfet</Text>
        </View>
        <TouchableOpacity style={s.searchBtn}>
          <Ionicons name="search" size={20} color="#a78bfa" />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.scroll, { paddingBottom: tabBarHeight + 16 }]}
      >
        {/* Categories */}
        <Text style={s.sectionTitle}>Kategoriler</Text>
        <View style={s.categoriesGrid}>
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat.label}
              style={s.catCard}
              activeOpacity={0.75}
              onPress={() => router.push('/')}
            >
              <Text style={s.catEmoji}>{cat.emoji}</Text>
              <Text style={s.catLabel}>{cat.label}</Text>
              <Text style={s.catCount}>{cat.count} bilgi</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Trending */}
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Trend</Text>
          <View style={s.liveChip}>
            <View style={s.liveDot} />
            <Text style={s.liveText}>Canlı</Text>
          </View>
        </View>

        {TRENDING.map((item, index) => (
          <TouchableOpacity
            key={item.id}
            style={[s.trendCard, { backgroundColor: item.color }]}
            activeOpacity={0.8}
            onPress={() => router.push('/')}
          >
            <View style={s.trendRank}>
              <Text style={s.trendRankNum}>#{index + 1}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.trendCategory}>{item.category}</Text>
              <Text style={s.trendTitle} numberOfLines={2}>
                {item.title}
              </Text>
              <View style={s.trendMeta}>
                <Ionicons name="eye-outline" size={12} color="rgba(255,255,255,0.6)" />
                <Text style={s.trendReads}>{item.reads} okuma</Text>
              </View>
            </View>
            <Text style={s.trendEmoji}>{item.emoji}</Text>
          </TouchableOpacity>
        ))}

        {/* Daily Challenge */}
        <View style={s.challengeCard}>
          <View style={s.challengeHeader}>
            <View style={s.challengeBadge}>
              <Ionicons name="trophy" size={14} color="#ff9f0a" />
              <Text style={s.challengeBadgeText}>Günlük Görev</Text>
            </View>
            <Text style={s.challengeExp}>+50 XP</Text>
          </View>
          <Text style={s.challengeTitle}>Bugün 5 bilgi kartı oku</Text>
          <View style={s.challengeProgressBg}>
            <View style={[s.challengeProgressFill, { width: '60%' }]} />
          </View>
          <Text style={s.challengeProgressText}>3 / 5 tamamlandı</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: '#000',
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  title: { fontSize: 34, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: '#8e8e93', marginTop: 2 },
  searchBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(167,139,250,0.12)',
    borderWidth: 0.5,
    borderColor: 'rgba(167,139,250,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  scroll: { paddingTop: 8 },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 14,
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    paddingHorizontal: 20,
    marginBottom: 14,
    marginTop: 8,
  },
  liveChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,69,58,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 0.5,
    borderColor: 'rgba(255,69,58,0.3)',
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#ff453a' },
  liveText: { fontSize: 12, color: '#ff453a', fontWeight: '700' },

  // Categories grid
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 16,
  },
  catCard: {
    width: '30.5%',
    backgroundColor: '#1c1c1e',
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  catEmoji: { fontSize: 28, marginBottom: 6 },
  catLabel: { fontSize: 13, fontWeight: '700', color: '#fff' },
  catCount: { fontSize: 11, color: '#8e8e93', marginTop: 3 },

  // Trending cards
  trendCard: {
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  trendRank: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trendRankNum: { fontSize: 13, fontWeight: '900', color: 'rgba(255,255,255,0.8)' },
  trendCategory: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '600',
    marginBottom: 4,
  },
  trendTitle: { fontSize: 14, fontWeight: '700', color: '#fff', lineHeight: 20 },
  trendMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  trendReads: { fontSize: 11, color: 'rgba(255,255,255,0.5)' },
  trendEmoji: { fontSize: 36, opacity: 0.7 },

  // Daily challenge
  challengeCard: {
    marginHorizontal: 16,
    marginTop: 24,
    backgroundColor: '#111827',
    borderRadius: 20,
    padding: 18,
    borderWidth: 0.5,
    borderColor: 'rgba(255,159,10,0.25)',
  },
  challengeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  challengeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,159,10,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  challengeBadgeText: { fontSize: 12, color: '#ff9f0a', fontWeight: '700' },
  challengeExp: { fontSize: 16, fontWeight: '900', color: '#ff9f0a' },
  challengeTitle: { fontSize: 16, fontWeight: '700', color: '#fff', marginBottom: 14 },
  challengeProgressBg: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 3,
    marginBottom: 8,
  },
  challengeProgressFill: {
    height: '100%',
    backgroundColor: '#ff9f0a',
    borderRadius: 3,
  },
  challengeProgressText: { fontSize: 12, color: '#8e8e93' },
});
