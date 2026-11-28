import { LinearGradient } from 'expo-linear-gradient';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius, reader, space, type } from '../../src/theme';
import type { SeriesCard } from '../../src/types';
import { GradientText } from '../ui/gradient';
import { Media } from '../ui/media';

const GLOW_START = { x: 0, y: 0 };
const GLOW_END = { x: 1, y: 1 };

type SeriesReaderCardProps = {
  card: SeriesCard;
  /** Kartın (sayfanın) yüksekliği; liste sayfa sayfa kaydığı için sabittir. */
  height: number;
  category: string | null;
  coverUrl: string | null;
  sourceTitle: string;
  sourceUrl: string;
  /** Kartın bölüm içindeki sırası (1'den başlar). */
  sectionIndex: number;
  /** Bölümdeki toplam kart sayısı. */
  sectionCount: number;
  /** Bölümün serideki sırası (1'den başlar); 0 ise bölüm bilgisi yok. */
  sectionNumber: number;
  /** Serideki toplam bölüm sayısı. */
  sectionTotal: number;
  /** Yalnız bölümün son kartında dolu: bir sonraki bölümün adı. */
  nextSectionTitle: string | null;
};

/** Okuma ekranındaki tek kart: marka ışıklı zeminde sabit yükseklikli kart, otomatik ilerleme yok. */
export function SeriesReaderCard({
  card,
  height,
  category,
  coverUrl,
  sourceTitle,
  sourceUrl,
  sectionIndex,
  sectionCount,
  sectionNumber,
  sectionTotal,
  nextSectionTitle,
}: SeriesReaderCardProps) {
  const isFirst = card.position === 1;
  const progress = sectionCount > 1 ? ` · ${sectionIndex}/${sectionCount}` : '';
  const meta = sectionNumber > 0 ? `BÖLÜM ${sectionNumber} / ${sectionTotal}${progress}` : '';
  const sourceText = `Kaynak: Vikipedi — ${sourceTitle} ›`;

  return (
    <View style={[s.page, { height }]} testID={`series-card-${card.position}`}>
      <LinearGradient
        colors={colors.brandGradient}
        start={GLOW_START}
        end={GLOW_END}
        style={[s.glow, s.glowTop]}
        pointerEvents="none"
      />
      <LinearGradient
        colors={colors.brandGradient}
        start={GLOW_START}
        end={GLOW_END}
        style={[s.glow, s.glowBottom]}
        pointerEvents="none"
      />
      <View style={s.card}>
        {isFirst ? (
          <View
            style={[s.cover, { height: height * reader.coverRatio }]}
            testID="series-card-cover"
          >
            <Media uri={coverUrl} category={category ?? undefined} style={s.coverFill} />
          </View>
        ) : null}
        {meta ? <GradientText style={type.meta}>{meta}</GradientText> : null}
        {card.sectionTitle ? (
          <Text style={s.title} accessibilityRole="header">
            {card.sectionTitle}
          </Text>
        ) : null}
        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.content}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
        >
          <Text style={s.body}>{card.body}</Text>
          {nextSectionTitle ? (
            <View style={s.hint} testID="series-next-section">
              <Text style={s.hintLabel}>Sonraki bölüm</Text>
              <Text style={s.hintTitle}>{`${nextSectionTitle} ↓`}</Text>
            </View>
          ) : null}
        </ScrollView>
        {sourceUrl ? (
          <Pressable
            onPress={() => {
              void Linking.openURL(sourceUrl);
            }}
            accessibilityRole="link"
          >
            <Text style={s.source}>{sourceText}</Text>
          </Pressable>
        ) : (
          <Text style={s.source}>{sourceText}</Text>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  page: { backgroundColor: colors.bg, overflow: 'hidden', paddingBottom: space.lg },
  glow: {
    position: 'absolute',
    width: reader.glowSize,
    height: reader.glowSize,
    borderRadius: radius.full,
    opacity: reader.glowOpacity,
  },
  glowTop: { top: -reader.glowSize / 2, right: -reader.glowSize / 2 },
  glowBottom: { bottom: -reader.glowSize / 2, left: -reader.glowSize / 2 },
  card: {
    flex: 1,
    marginHorizontal: space.screen,
    padding: space.xl,
    gap: space.sm,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.shareCardBg,
  },
  cover: { marginBottom: space.sm, borderRadius: radius.md, overflow: 'hidden' },
  coverFill: { flex: 1, width: '100%' },
  title: { ...type.cardTitle, color: colors.text },
  scroll: { flex: 1 },
  content: { flexGrow: 1, gap: space.lg, paddingTop: space.sm },
  body: { ...type.reading, color: colors.text },
  hint: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.xs },
  hintLabel: { ...type.caption, color: colors.textTertiary, textAlign: 'center' },
  hintTitle: { ...type.button, color: colors.textSecondary, textAlign: 'center' },
  source: { ...type.caption, color: colors.textSecondary },
});
