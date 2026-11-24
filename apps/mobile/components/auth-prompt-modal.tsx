import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { useAuthPromptStore } from '../src/store/authPromptStore';
import { colors, space, type } from '../src/theme';
import { BottomSheet } from './ui/bottom-sheet';
import { Button } from './ui/button';
import { GradientButton } from './ui/gradient';

const BENEFITS = [
  'Kaydettiklerin tüm cihazlarında senkronize olsun',
  'Okuma ilerlemen ve AI geçmişin kaybolmasın',
  'Deneyim ilgi alanlarına göre zamanla kişiselleşsin',
];

export function AuthPromptModal() {
  const closePrompt = useAuthPromptStore((state) => state.closePrompt);
  const confirmPrompt = useAuthPromptStore((state) => state.confirmPrompt);
  const isVisible = useAuthPromptStore((state) => state.isVisible);
  const message = useAuthPromptStore((state) => state.message);
  const title = useAuthPromptStore((state) => state.title);

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
        İstersen keşfetmeye misafir olarak devam edebilirsin. Hazır olduğunda hesabınla devam etmek
        tek dokunuş uzakta.
      </Text>
      <View style={s.actions}>
        <GradientButton label="Hesabımla Devam Et" onPress={confirmPrompt} />
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
