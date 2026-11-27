import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { GradientText } from '../../components/ui/gradient';
import { IconButton } from '../../components/ui/icon-button';
import { Media } from '../../components/ui/media';
import { Screen } from '../../components/ui/screen';
import { TopBar } from '../../components/ui/top-bar';
import { failedRemoteImageUrls, resolveFactMedia } from '../../src/lib/factMedia';
import { fetchFactById } from '../../src/lib/facts';
import { useShareFact } from '../../src/lib/useShareFact';
import { useFeedStore } from '../../src/store/feedStore';
import { colors, radius, space, type } from '../../src/theme';
import type { FactType } from '../../src/types';

const MEDIA_HEIGHT_RATIO = 0.75;

export default function FactDetailScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const params = useLocalSearchParams<{ id?: string }>();
  const savedIds = useFeedStore((state) => state.savedIds);
  const toggleSave = useFeedStore((state) => state.toggleSave);
  const [fact, setFact] = useState<FactType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [, setMediaErrorTick] = useState(0);
  const { shareFact, isSharing, shareHost } = useShareFact();

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

  const isSaved = fact ? savedIds.includes(fact.id) : false;
  const mediaHeight = (width - space.screen * 2) * MEDIA_HEIGHT_RATIO;

  const renderBody = () => {
    if (isLoading) {
      return (
        <View style={s.center}>
          <ActivityIndicator color={colors.textSecondary} />
          <Text style={s.centerText}>Kart yükleniyor…</Text>
        </View>
      );
    }

    if (!fact) {
      return (
        <View style={s.center}>
          <Text style={s.centerText}>Kart bulunamadı.</Text>
        </View>
      );
    }

    const media = resolveFactMedia(fact);
    const minutes = Math.max(1, Math.round((fact.read_time_sq || 15) / 60));
    const meta = `${fact.category.toLocaleUpperCase('tr-TR')} · ${minutes} dk`;
    const sourceUrl = fact.source_url;

    return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>
        <View style={[s.media, { height: mediaHeight }]}>
          <Media
            uri={media.uri}
            localSource={media.localSource ?? undefined}
            category={fact.category}
            style={s.mediaFill}
            onError={() => {
              if (media.uri) {
                failedRemoteImageUrls.add(media.uri);
                setMediaErrorTick((n) => n + 1);
              }
            }}
          />
        </View>

        <View style={s.actions}>
          <IconButton
            name="paper-plane-outline"
            onPress={() => {
              if (!isSharing) void shareFact(fact);
            }}
            accessibilityLabel="Paylaş"
            testID="fact-detail-share"
          />
          <View style={s.spacer} />
          <IconButton
            name="bookmark-outline"
            active={isSaved}
            onPress={() => {
              void toggleSave(fact.id);
            }}
            accessibilityLabel="Kaydet"
            testID="fact-detail-save"
          />
        </View>

        <View style={s.text}>
          <GradientText style={type.meta}>{meta}</GradientText>
          <Text style={s.title}>{fact.title}</Text>
          <Text style={s.body}>{fact.content}</Text>
          {sourceUrl ? (
            <Pressable
              onPress={() => {
                void Linking.openURL(sourceUrl);
              }}
              accessibilityRole="link"
            >
              <Text style={s.source}>Kaynak: {fact.source_label ?? 'Kaynağa git'} ›</Text>
            </Pressable>
          ) : fact.source_label ? (
            <Text style={s.source}>Kaynak: {fact.source_label}</Text>
          ) : null}
        </View>
      </ScrollView>
    );
  };

  return (
    <Screen>
      <View style={s.root} testID="fact-detail-screen">
        <TopBar
          left={
            <IconButton
              name="chevron-back"
              onPress={() => router.back()}
              accessibilityLabel="Geri"
              testID="fact-detail-back"
            />
          }
        />
        {renderBody()}
        {shareHost}
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md },
  centerText: { ...type.body, color: colors.textSecondary, textAlign: 'center' },
  content: { paddingBottom: space.xxl },
  media: { marginHorizontal: space.screen, borderRadius: radius.lg, overflow: 'hidden' },
  mediaFill: { flex: 1, width: '100%' },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.screen,
    paddingVertical: space.sm,
  },
  spacer: { flex: 1 },
  text: { paddingHorizontal: space.screen, gap: space.xs },
  title: { ...type.cardTitle, color: colors.text },
  body: { ...type.body, color: colors.text },
  source: { ...type.caption, color: colors.textSecondary },
});
