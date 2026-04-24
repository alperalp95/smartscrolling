import { Image as ExpoImage } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
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
import type { ImageSourcePropType } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { fetchFactById } from '../../src/lib/facts';
import { useFeedStore } from '../../src/store/feedStore';
import type { FactType } from '../../src/types';

const LOCAL_IMAGES: Record<string, ImageSourcePropType> = {
  bg_black_hole: require('../../assets/images/bg_black_hole.png'),
  bg_rome_ruins: require('../../assets/images/bg_rome_ruins.png'),
  bg_stoic_statue: require('../../assets/images/bg_stoic_statue.png'),
  bg_quantum_pc: require('../../assets/images/bg_quantum_pc.png'),
};

function resolveMediaSource(mediaUrl: string | null | undefined): ImageSourcePropType | null {
  if (!mediaUrl) {
    return null;
  }

  const normalized = mediaUrl.trim();

  if (!normalized) {
    return null;
  }

  if (normalized.startsWith('http')) {
    return { uri: normalized };
  }

  return LOCAL_IMAGES[normalized] ?? null;
}

function resolveRemoteMediaUrl(mediaUrl: string | null | undefined): string | null {
  if (!mediaUrl) {
    return null;
  }

  const normalized = mediaUrl.trim();

  if (!normalized || !normalized.startsWith('http')) {
    return null;
  }

  return normalized;
}

export default function FactDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string }>();
  const savedIds = useFeedStore((state) => state.savedIds);
  const toggleSave = useFeedStore((state) => state.toggleSave);
  const [fact, setFact] = useState<FactType | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setIsLoading(true);
      const nextFact = await fetchFactById(params.id);

      if (cancelled) {
        return;
      }

      setFact(nextFact);
      setIsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [params.id]);

  const imageSource = useMemo(() => resolveMediaSource(fact?.media_url), [fact?.media_url]);
  const remoteMediaUrl = useMemo(() => resolveRemoteMediaUrl(fact?.media_url), [fact?.media_url]);
  const isSaved = fact ? savedIds.includes(fact.id) : false;

  return (
    <View style={s.container}>
      {imageSource ? (
        <View style={StyleSheet.absoluteFillObject}>
          {remoteMediaUrl ? (
            <ExpoImage source={remoteMediaUrl} style={s.backgroundImage} contentFit="cover" />
          ) : (
            <ExpoImage source={imageSource} style={s.backgroundImage} contentFit="cover" />
          )}
        </View>
      ) : null}
      <View style={s.overlay} />

      <SafeAreaView style={s.safeArea} edges={['top', 'bottom']}>
        <View
          style={[s.header, { paddingTop: Math.max(insets.top, Platform.OS === 'web' ? 20 : 0) }]}
        >
          <TouchableOpacity onPress={() => router.back()} style={s.backButton}>
            <Text style={s.backButtonText}>Geri</Text>
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <View style={s.centerState}>
            <Text style={s.centerStateText}>Fact yukleniyor...</Text>
          </View>
        ) : !fact ? (
          <View style={s.centerState}>
            <Text style={s.centerStateText}>Fact bulunamadi.</Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={[
              s.scrollContent,
              { paddingBottom: Math.max(insets.bottom, 20) + 24 },
            ]}
            showsVerticalScrollIndicator={false}
          >
            <View style={s.badge}>
              <Text style={s.badgeText}>{fact.category}</Text>
            </View>

            <Text style={s.title}>{fact.title}</Text>
            <Text style={s.content}>{fact.content}</Text>

            {fact.tags.length > 0 ? (
              <View style={s.tagsRow}>
                {fact.tags.map((tag) => (
                  <View key={tag} style={s.tag}>
                    <Text style={s.tagText}>#{tag}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            <View style={s.actionsRow}>
              <TouchableOpacity
                onPress={() => {
                  if (!fact) {
                    return;
                  }

                  void toggleSave(fact.id);
                  router.back();
                }}
                style={[s.actionButton, !isSaved ? s.actionButtonMuted : null]}
              >
                <Text style={[s.actionButtonText, !isSaved ? s.actionButtonTextMuted : null]}>
                  {isSaved ? 'Kayittan Cikar' : 'Kayitli Degil'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={s.sourceCard}>
              <Text style={s.sourceLabel}>Kaynak</Text>
              <Text style={s.sourceText}>{fact.source_label ?? 'Kaynak belirtilmedi'}</Text>
              {fact.source_url ? (
                <TouchableOpacity
                  onPress={() => fact.source_url && Linking.openURL(fact.source_url)}
                >
                  <Text style={s.sourceLink}>Kaynakta devam et</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  safeArea: { flex: 1 },
  backgroundImage: {
    height: '100%',
    width: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.62)',
  },
  header: {
    paddingHorizontal: 18,
    paddingBottom: 8,
  },
  backButton: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(17,17,19,0.78)',
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 999,
    borderWidth: 0.5,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  centerState: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  centerStateText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(167,139,250,0.15)',
    borderRadius: 999,
    marginBottom: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  badgeText: {
    color: '#c4b5fd',
    fontSize: 11,
    fontWeight: '700',
  },
  title: {
    color: '#fff',
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.6,
    lineHeight: 36,
    marginBottom: 16,
  },
  content: {
    color: '#f0f0f2',
    fontSize: 16,
    lineHeight: 28,
  },
  actionsRow: {
    flexDirection: 'row',
    marginTop: 20,
  },
  actionButton: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  actionButtonMuted: {
    opacity: 0.6,
  },
  actionButtonText: {
    color: '#f1c27d',
    fontSize: 12,
    fontWeight: '700',
  },
  actionButtonTextMuted: {
    color: '#b0b0b8',
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 18,
  },
  tag: {
    backgroundColor: 'rgba(255,255,255,0.09)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  tagText: {
    color: '#d4d4d8',
    fontSize: 12,
    fontWeight: '600',
  },
  sourceCard: {
    backgroundColor: 'rgba(10,10,12,0.72)',
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 18,
    borderWidth: 0.5,
    marginTop: 24,
    padding: 16,
  },
  sourceLabel: {
    color: '#8e8e93',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  sourceText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  sourceLink: {
    color: '#a78bfa',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 10,
  },
});
