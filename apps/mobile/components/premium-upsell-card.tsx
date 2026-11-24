import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, space, type } from '../src/theme';
import { GradientButton, GradientText } from './ui/gradient';
import { IconButton } from './ui/icon-button';

type PremiumUpsellCardProps = {
  body: string;
  ctaLabel?: string;
  eyebrow?: string;
  onDismiss?: () => void;
  onPress: () => void;
  title: string;
};

export function PremiumUpsellCard({
  body,
  ctaLabel = "Premium'u incele",
  eyebrow = 'Premium',
  onDismiss,
  onPress,
  title,
}: PremiumUpsellCardProps) {
  return (
    <View style={s.card}>
      <View style={s.header}>
        <GradientText style={type.meta}>{eyebrow}</GradientText>
        {onDismiss ? (
          <IconButton
            name="close"
            size={20}
            color={colors.textSecondary}
            onPress={onDismiss}
            accessibilityLabel="Kapat"
          />
        ) : null}
      </View>
      <Text style={s.title}>{title}</Text>
      <Text style={s.body}>{body}</Text>
      <GradientButton label={ctaLabel} onPress={onPress} />
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: space.lg,
    marginHorizontal: space.screen,
    marginBottom: space.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space.sm,
  },
  title: { ...type.cardTitle, color: colors.text, marginBottom: space.sm },
  body: { ...type.body, color: colors.textSecondary, marginBottom: space.lg },
});
