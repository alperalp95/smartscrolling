import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuthPromptStore } from '../src/store/authPromptStore';

const BENEFITS = [
  'Kaydettiklerin tum cihazlarinda senkronize olsun',
  'Okuma ilerlemen ve AI gecmisin kaybolmasin',
  'Deneyim ilgi alanlarina gore zamanla kisisellessin',
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
    <Modal animationType="fade" onRequestClose={closePrompt} transparent visible={isVisible}>
      <View style={s.overlay}>
        <Pressable onPress={closePrompt} style={StyleSheet.absoluteFillObject} />
        <View style={s.card}>
          <View style={s.heroRow}>
            <View style={s.heroBadge}>
              <Text style={s.heroBadgeText}>S</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.eyebrow}>Neden giris yapmaliyim?</Text>
              <Text style={s.title}>{title}</Text>
            </View>
          </View>
          <Text style={s.message}>{message}</Text>
          <View style={s.benefitBox}>
            {BENEFITS.map((benefit) => (
              <View key={benefit} style={s.benefitRow}>
                <View style={s.benefitDot} />
                <Text style={s.benefitText}>{benefit}</Text>
              </View>
            ))}
          </View>
          <Text style={s.footerNote}>
            Istersen kesfetmeye misafir olarak devam edebilirsin. Hazir oldugunda hesabinla devam
            etmek tek dokunus uzakta.
          </Text>
          <View style={s.actions}>
            <Pressable onPress={closePrompt} style={[s.button, s.secondaryButton]}>
              <Text style={s.secondaryButtonText}>Daha Sonra</Text>
            </Pressable>
            <Pressable onPress={confirmPrompt} style={[s.button, s.primaryButton]}>
              <Text style={s.primaryButtonText}>Hesabimla Devam Et</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#0f172a',
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.18)',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 12,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 12,
  },
  heroBadge: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: 'rgba(139,92,246,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.26)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBadgeText: {
    color: '#c4b5fd',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  eyebrow: {
    color: '#a78bfa',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  title: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  message: {
    color: '#e2e8f0',
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 14,
  },
  benefitBox: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  benefitDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: '#8b5cf6',
    marginTop: 6,
  },
  benefitText: {
    flex: 1,
    color: '#cbd5e1',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 10,
  },
  footerNote: {
    color: '#94a3b8',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 14,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  button: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButton: {
    backgroundColor: '#172033',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  primaryButton: {
    backgroundColor: '#8b5cf6',
  },
  secondaryButtonText: {
    color: '#e2e8f0',
    fontSize: 14,
    fontWeight: '700',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
});
