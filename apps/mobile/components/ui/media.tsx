import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import type { ComponentProps } from 'react';
import { useEffect, useState } from 'react';
import {
  type ImageSourcePropType,
  type ImageStyle,
  type StyleProp,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { colors, radius } from '../../src/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

// Kategori adı (küçük harf) -> ikon. Yeni kategori eklemek için buraya bir satır ekleyin.
// Türkçe karakterli ve karaktersiz yazımlar ayrı ayrı yazılır.
const CATEGORY_ICONS: Record<string, IconName> = {
  tarih: 'time-outline',
  bilim: 'flask-outline',
  uzay: 'planet-outline',
  doğa: 'leaf-outline',
  doga: 'leaf-outline',
  sanat: 'color-palette-outline',
  coğrafya: 'earth-outline',
  cografya: 'earth-outline',
};
const DEFAULT_ICON: IconName = 'sparkles-outline';

function iconFor(category?: string): IconName {
  if (!category) return DEFAULT_ICON;
  const key = category.trim().toLocaleLowerCase('tr-TR');
  return CATEGORY_ICONS[key] ?? DEFAULT_ICON;
}

type MediaFallbackProps = {
  category?: string;
  style?: StyleProp<ViewStyle>;
};

export function MediaFallback({ category, style }: MediaFallbackProps) {
  return (
    <View style={[s.fallback, style]} testID="media-fallback">
      <Ionicons name={iconFor(category)} size={48} color={colors.textTertiary} />
    </View>
  );
}

type MediaProps = {
  uri?: string | null;
  localSource?: ImageSourcePropType;
  category?: string;
  style?: StyleProp<ImageStyle>;
  onError?: () => void;
  onLoad?: () => void;
};

export function Media({ uri, localSource, category, style, onError, onLoad }: MediaProps) {
  const [failed, setFailed] = useState(false);
  // Liste aynı bileşeni başka kart için yeniden kullanırsa eski hata taşınmasın.
  // biome-ignore lint/correctness/useExhaustiveDependencies: uri değişince sıfırlanır
  useEffect(() => setFailed(false), [uri]);
  const source = uri ? { uri } : localSource;

  if (!source || failed) return <MediaFallback category={category} style={style} />;

  return (
    <Image
      source={source}
      contentFit="cover"
      onLoad={onLoad}
      onError={() => {
        setFailed(true);
        onError?.();
      }}
      style={[s.image, style]}
    />
  );
}

const s = StyleSheet.create({
  image: { borderRadius: radius.lg, overflow: 'hidden' },
  fallback: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
