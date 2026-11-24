import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { usePremiumPromptStore } from '../src/store/premiumPromptStore';
import { colors, space, type } from '../src/theme';
import { BottomSheet } from './ui/bottom-sheet';
import { Button } from './ui/button';
import { GradientButton } from './ui/gradient';

const BENEFITS = [
  'Reklamsız akışta okumaya devam et',
  'Kartlara günde 30 AI sorusu sor',
  'Kendi sorunu yaz',
];

export function PremiumPromptModal() {
  const closePrompt = usePremiumPromptStore((state) => state.closePrompt);
  const confirmPrompt = usePremiumPromptStore((state) => state.confirmPrompt);
  const confirmLabel = usePremiumPromptStore((state) => state.confirmLabel);
  const isVisible = usePremiumPromptStore((state) => state.isVisible);
  const message = usePremiumPromptStore((state) => state.message);
  const title = usePremiumPromptStore((state) => state.title);

  if (!isVisible) {
    return null;
  }

  return (
    <BottomSheet visible={isVisible} onClose={closePrompt} title={title} subtitle={message}>
      <View style={s.benefits}>
        {BENEFITS.map((benefit) => (
          <View key={benefit} style={s.benefitRow}>
            <Ionicons name="checkmark-circle" size={type.body.lineHeight} color={colors.text} />
            <Text style={s.benefitText}>{benefit}</Text>
          </View>
        ))}
      </View>
      <Text style={s.note}>
        Bu ilk akışta seni zorlamıyoruz. İstersen keşfetmeye devam et, hazır olduğunda premium
        detaylarına geçebilirsin.
      </Text>
      <View style={s.actions}>
        <GradientButton label={confirmLabel} onPress={confirmPrompt} />
        <Button label="Daha Sonra" variant="ghost" onPress={closePrompt} />
      </View>
    </BottomSheet>
  );
}

const s = StyleSheet.create({
  benefits: { gap: space.md },
  benefitRow: { alignItems: 'flex-start', flexDirection: 'row', gap: space.sm },
  benefitText: { ...type.body, color: colors.text, flex: 1 },
  note: { ...type.caption, color: colors.textSecondary, marginTop: space.lg },
  actions: { gap: space.sm, marginTop: space.xl },
});
