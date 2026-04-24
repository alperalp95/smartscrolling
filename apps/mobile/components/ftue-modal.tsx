import { useRouter } from 'expo-router';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { useFtueStore } from '../src/store/ftueStore';
import { useOnboardingStore } from '../src/store/onboardingStore';

const FREE_ANCHOR_BOOK_ID = '11111111-1111-1111-1111-111111111111';

const VALUE_POINTS = [
  'Her gun kisa bilgi kartlariyla ogrenmeye basla',
  'Bir serbest anchor kitabi hemen ac ve AI destekli oku',
  'Hazir oldugunda premium kutuphane ile daha derin metinlere gec',
];

export function FtueModal() {
  const router = useRouter();
  const hideFtue = useFtueStore((state) => state.hideFtue);
  const isFtueVisible = useFtueStore((state) => state.isFtueVisible);
  const setFtueEntryPath = useOnboardingStore((state) => state.setFtueEntryPath);

  if (!isFtueVisible) {
    return null;
  }

  return (
    <Modal animationType="fade" onRequestClose={hideFtue} transparent visible={isFtueVisible}>
      <View style={s.overlay}>
        <Pressable onPress={hideFtue} style={StyleSheet.absoluteFillObject} />
        <View style={s.card}>
          <View style={s.headerRow}>
            <View style={s.badge}>
              <Text style={s.badgeText}>S</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.eyebrow}>Hos Geldin</Text>
              <Text style={s.title}>Scroll ederek ogren, okuyarak derinles</Text>
            </View>
          </View>

          <Text style={s.body}>
            SmartScrolling once sana degeri gosterir. Feed'de kesfet, serbest metni hemen ac, AI ile
            baglam sor. Hazir oldugunda hesabin ve premium kutuphane ile deneyimi buyut.
          </Text>

          <View style={s.pointsBox}>
            {VALUE_POINTS.map((point) => (
              <View key={point} style={s.pointRow}>
                <View style={s.pointDot} />
                <Text style={s.pointText}>{point}</Text>
              </View>
            ))}
          </View>

          <View style={s.ctaRow}>
            <Pressable
              onPress={() => {
                setFtueEntryPath('feed');
                hideFtue();
                router.push('/');
              }}
              style={[s.button, s.secondaryButton]}
            >
              <Text style={s.secondaryText}>Feed'e Gec</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setFtueEntryPath('free_book');
                hideFtue();
                router.push(`/book/${FREE_ANCHOR_BOOK_ID}`);
              }}
              style={[s.button, s.primaryButton]}
            >
              <Text style={s.primaryText}>Serbest Kitabi Gor</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: '#0b1220',
    borderColor: 'rgba(139,92,246,0.18)',
    borderRadius: 28,
    borderWidth: 1,
    maxWidth: 430,
    padding: 22,
    width: '100%',
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
    marginBottom: 14,
  },
  badge: {
    alignItems: 'center',
    backgroundColor: 'rgba(139,92,246,0.16)',
    borderColor: 'rgba(167,139,250,0.24)',
    borderRadius: 18,
    borderWidth: 1,
    height: 50,
    justifyContent: 'center',
    width: 50,
  },
  badgeText: {
    color: '#c4b5fd',
    fontSize: 24,
    fontWeight: '900',
  },
  eyebrow: {
    color: '#a78bfa',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.7,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  title: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  body: {
    color: '#dbe4f0',
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 16,
  },
  pointsBox: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
  },
  pointRow: {
    flexDirection: 'row',
    gap: 10,
  },
  pointDot: {
    backgroundColor: '#8b5cf6',
    borderRadius: 999,
    height: 8,
    marginTop: 6,
    width: 8,
  },
  pointText: {
    color: '#cbd5e1',
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 10,
  },
  ctaRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  button: {
    alignItems: 'center',
    borderRadius: 16,
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 14,
  },
  secondaryButton: {
    backgroundColor: '#172033',
    borderColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
  },
  primaryButton: {
    backgroundColor: '#8b5cf6',
  },
  secondaryText: {
    color: '#e2e8f0',
    fontSize: 14,
    fontWeight: '700',
  },
  primaryText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
});
