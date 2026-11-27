import { LinearGradient } from 'expo-linear-gradient';
import { forwardRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SHARE_CONFIG } from '../../src/config/share';
import { type ShareVariant, shareCategoryLabel } from '../../src/lib/shareCard';
import { colors, radius, share, space, type } from '../../src/theme';
import type { FactType } from '../../src/types';
import { GradientText } from '../ui/gradient';
import { Media } from '../ui/media';

export type ShareCardProps = {
  fact: FactType;
  variant: ShareVariant;
  photoUri: string | null;
  onPhotoLoad?: () => void;
  onPhotoError?: () => void;
};

const start = { x: 0, y: 0 };
const end = { x: 1, y: 0 };
const glowStart = { x: 0, y: 0 };
const glowEnd = { x: 1, y: 1 };

// Paylaşım görseli (C2 fotoğraflı / C1 yazılı). Ekranda gösterilmez; ekran dışında çizilip PNG'ye çevrilir.
export const ShareCard = forwardRef<View, ShareCardProps>(function ShareCard(
  { fact, variant, photoUri, onPhotoLoad, onPhotoError },
  ref,
) {
  const isPhoto = variant === 'photo';
  return (
    <View ref={ref} collapsable={false} style={s.root} testID="share-card">
      <LinearGradient
        colors={colors.brandGradient}
        start={glowStart}
        end={glowEnd}
        style={[s.glow, s.glowTop]}
        pointerEvents="none"
      />
      <LinearGradient
        colors={colors.brandGradient}
        start={glowStart}
        end={glowEnd}
        style={[s.glow, s.glowBottom]}
        pointerEvents="none"
      />

      <Text style={s.wordmark}>SmartScrolling</Text>

      <View style={s.middle}>
        <View style={s.card}>
          {isPhoto ? (
            <View testID="share-card-photo" style={s.photoWrap}>
              <Media
                uri={photoUri}
                category={fact.category}
                style={s.photo}
                onLoad={onPhotoLoad}
                onError={onPhotoError}
              />
            </View>
          ) : (
            <View testID="share-card-quote" style={s.quote}>
              <GradientText style={type.shareQuote}>{'“'}</GradientText>
            </View>
          )}
          <View testID="share-card-category" style={s.category}>
            <GradientText style={type.meta}>{shareCategoryLabel(fact.category)}</GradientText>
          </View>
          <Text style={s.title} numberOfLines={3} testID="share-card-title">
            {fact.title}
          </Text>
          <Text style={s.body} numberOfLines={4} testID="share-card-body">
            {fact.content}
          </Text>
        </View>
      </View>

      <View style={s.cta} testID="share-card-cta">
        <LinearGradient colors={colors.brandGradient} start={start} end={end} style={s.ctaFill}>
          <Text style={s.ctaLabel}>Devamı SmartScrolling'de</Text>
        </LinearGradient>
      </View>
      <Text style={s.domain} testID="share-card-domain">
        {SHARE_CONFIG.displayDomain}
      </Text>
    </View>
  );
});

const s = StyleSheet.create({
  root: {
    width: share.width,
    height: share.height,
    backgroundColor: colors.bg,
    overflow: 'hidden',
    paddingTop: share.safeTop,
    paddingBottom: share.safeBottom,
    paddingHorizontal: space.screen,
  },
  glow: {
    position: 'absolute',
    width: share.glowSize,
    height: share.glowSize,
    borderRadius: radius.full,
    opacity: share.glowOpacity,
  },
  glowTop: { top: -share.glowSize / 2, right: -share.glowSize / 2 },
  glowBottom: { bottom: -share.glowSize / 2, left: -share.glowSize / 2 },
  wordmark: { ...type.screenTitle, color: colors.text, textAlign: 'center' },
  middle: { flex: 1, justifyContent: 'center' },
  card: {
    backgroundColor: colors.shareCardBg,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.sm,
  },
  photoWrap: { alignSelf: 'stretch' },
  photo: { height: share.photoHeight, borderRadius: radius.md },
  quote: { alignSelf: 'flex-start' },
  category: { alignSelf: 'flex-start' },
  title: { ...type.shareTitle, color: colors.text },
  body: { ...type.body, color: colors.text },
  cta: { marginTop: space.lg, borderRadius: radius.md, overflow: 'hidden' },
  ctaFill: { alignItems: 'center', justifyContent: 'center', paddingVertical: space.md },
  ctaLabel: { ...type.button, color: colors.text },
  domain: {
    ...type.caption,
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: space.sm,
  },
});
