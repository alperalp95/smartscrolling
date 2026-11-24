import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { useFtueStore } from '../src/store/ftueStore';
import { useOnboardingStore } from '../src/store/onboardingStore';
import { colors, space, type } from '../src/theme';
import { BottomSheet } from './ui/bottom-sheet';
import { GradientButton } from './ui/gradient';

const VALUE_POINTS = [
  'Her gün kısa bilgi kartlarıyla öğrenmeye başla',
  'Hazır olduğunda hesabınla deneyimi büyüt',
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
    <BottomSheet
      visible={isFtueVisible}
      onClose={hideFtue}
      title="Scroll ederek öğren"
      subtitle="SmartScrolling önce sana değeri gösterir. Feed'de keşfet, ilginç bilgi kartlarını aç. Hazır olduğunda hesabınla deneyimi büyüt."
    >
      <View style={s.points}>
        {VALUE_POINTS.map((point) => (
          <View key={point} style={s.pointRow}>
            <Ionicons name="checkmark-circle" size={type.body.lineHeight} color={colors.text} />
            <Text style={s.pointText}>{point}</Text>
          </View>
        ))}
      </View>
      <View style={s.actions}>
        <GradientButton
          label="Akışa Geç"
          onPress={() => {
            setFtueEntryPath('feed');
            hideFtue();
            router.push('/');
          }}
        />
      </View>
    </BottomSheet>
  );
}

const s = StyleSheet.create({
  points: { gap: space.md },
  pointRow: { alignItems: 'flex-start', flexDirection: 'row', gap: space.sm },
  pointText: { ...type.body, color: colors.text, flex: 1 },
  actions: { marginTop: space.xl },
});
