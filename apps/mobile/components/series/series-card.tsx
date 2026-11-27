import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius, space, type } from '../../src/theme';
import type { SeriesCard } from '../../src/types';
import { GradientText } from '../ui/gradient';
import { Media } from '../ui/media';

// İlk kartta kapağın, kart yüksekliğine oranı.
const COVER_HEIGHT_RATIO = 0.35;

type SeriesReaderCardProps = {
  card: SeriesCard;
  /** Kartın (sayfanın) yüksekliği; liste sayfa sayfa kaydığı için sabittir. */
  height: number;
  seriesTitle: string;
  category: string | null;
  coverUrl: string | null;
  sourceTitle: string;
  sourceUrl: string;
};

/** Okuma ekranındaki tek kart: akış kartıyla aynı yazı stilleri, otomatik ilerleme yok. */
export function SeriesReaderCard({
  card,
  height,
  seriesTitle,
  category,
  coverUrl,
  sourceTitle,
  sourceUrl,
}: SeriesReaderCardProps) {
  const isFirst = card.position === 1;
  const meta = card.sectionTitle.toLocaleUpperCase('tr-TR');
  const sourceText = `Kaynak: Vikipedi — ${sourceTitle} ›`;

  return (
    <View style={[s.card, { height }]} testID={`series-card-${card.position}`}>
      {isFirst ? (
        <View style={[s.cover, { height: height * COVER_HEIGHT_RATIO }]}>
          <Media uri={coverUrl} category={category ?? undefined} style={s.coverFill} />
        </View>
      ) : null}
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
      >
        {meta ? <GradientText style={type.meta}>{meta}</GradientText> : null}
        {isFirst ? (
          <Text style={s.title} accessibilityRole="header">
            {seriesTitle}
          </Text>
        ) : null}
        <Text style={s.body}>{card.body}</Text>
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
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: colors.bg, paddingBottom: space.lg },
  cover: {
    marginHorizontal: space.screen,
    marginBottom: space.lg,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  coverFill: { flex: 1, width: '100%' },
  scroll: { flex: 1 },
  content: { paddingHorizontal: space.screen, gap: space.md },
  title: { ...type.cardTitle, color: colors.text },
  body: { ...type.body, color: colors.text },
  source: { ...type.caption, color: colors.textSecondary },
});
