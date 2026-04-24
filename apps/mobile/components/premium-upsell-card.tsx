import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type PremiumUpsellCardProps = {
  body: string;
  ctaLabel?: string;
  eyebrow?: string;
  onPress: () => void;
  title: string;
};

export function PremiumUpsellCard({
  body,
  ctaLabel = 'Premiumu Incele',
  eyebrow = 'Premium Deneyim',
  onPress,
  title,
}: PremiumUpsellCardProps) {
  return (
    <View style={s.card}>
      <Text style={s.eyebrow}>{eyebrow}</Text>
      <Text style={s.title}>{title}</Text>
      <Text style={s.body}>{body}</Text>
      <View style={s.featureRow}>
        <Text style={s.featureText}>Reklamsiz akis</Text>
        <Text style={s.featureDot}>•</Text>
        <Text style={s.featureText}>Tam kutuphane</Text>
        <Text style={s.featureDot}>•</Text>
        <Text style={s.featureText}>Serbest AI</Text>
      </View>
      <TouchableOpacity onPress={onPress} style={s.button} activeOpacity={0.85}>
        <Text style={s.buttonText}>{ctaLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: '#111827',
    borderRadius: 18,
    padding: 16,
    borderWidth: 0.5,
    borderColor: 'rgba(251,191,36,0.22)',
    marginHorizontal: 16,
    marginBottom: 18,
  },
  eyebrow: {
    color: '#fbbf24',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.7,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
  },
  body: {
    color: '#d1d5db',
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 12,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 14,
  },
  featureText: {
    color: '#f3f4f6',
    fontSize: 12,
    fontWeight: '600',
  },
  featureDot: {
    color: '#fbbf24',
    fontSize: 12,
    fontWeight: '800',
  },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f59e0b',
    borderRadius: 12,
    paddingVertical: 12,
  },
  buttonText: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '800',
  },
});
