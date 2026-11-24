import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { PurchasesPackage } from 'react-native-purchases';
import { Button } from '../components/ui/button';
import { GradientButton } from '../components/ui/gradient';
import { IconButton } from '../components/ui/icon-button';
import { Screen } from '../components/ui/screen';
import {
  getCurrentOfferingSafe,
  getPremiumEntitlementStatus,
  purchasePackageSafe,
  restorePurchasesSafe,
} from '../src/lib/purchases';
import { useAuthStore } from '../src/store/authStore';
import { colors, radius, space, type } from '../src/theme';

const LOGO_SIZE = 56;
const BENEFIT_ICON_SIZE = 28;
const LOGO_ICON_SIZE = 28;
const BENEFIT_GLYPH_SIZE = 18;
const GRADIENT_START = { x: 0, y: 0 };
const GRADIENT_END = { x: 1, y: 0 };

const BENEFITS: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  body: string;
}[] = [
  { icon: 'remove-circle-outline', title: 'Reklamsız akış', body: 'Kaydırırken reklam yok.' },
  { icon: 'sparkles-outline', title: 'Günde 30 Karta Sor', body: 'Ücretsizde günde 3.' },
  {
    icon: 'create-outline',
    title: 'Kendi sorunu yaz',
    body: 'Hazır soruların ötesine geç.',
  },
];

const FALLBACK_PRICE = '49.99 TL';

export default function PremiumScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const setHasPremium = useAuthStore((state) => state.setHasPremium);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lifetimePackage, setLifetimePackage] = useState<PurchasesPackage | null>(null);
  const [priceLabel, setPriceLabel] = useState(FALLBACK_PRICE);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const offering = await getCurrentOfferingSafe(user?.id);

      if (cancelled) return;

      const pkg =
        offering?.availablePackages?.find((p) => {
          const id = p.identifier.toLowerCase();
          return id.includes('life') || id === '$rc_lifetime';
        }) ?? null;

      if (pkg) {
        setLifetimePackage(pkg);
        setPriceLabel(pkg.product.priceString);
      }

      setIsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const handlePurchase = async () => {
    if (isSubmitting || !lifetimePackage) return;
    setIsSubmitting(true);

    const customerInfo = await purchasePackageSafe(lifetimePackage, user?.id);
    const hasPremium = customerInfo ? await getPremiumEntitlementStatus(user?.id) : false;

    if (hasPremium) {
      setHasPremium(true);
      router.back();
    } else {
      Alert.alert('Satın alma', 'İşlem tamamlanamadı. Tekrar dene veya geri yüklemeyi dene.');
    }

    setIsSubmitting(false);
  };

  const handleRestore = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    await restorePurchasesSafe(user?.id);
    const hasPremium = await getPremiumEntitlementStatus(user?.id);
    setHasPremium(hasPremium);

    if (hasPremium) {
      router.back();
    } else {
      Alert.alert('Geri yükleme', 'Aktif bir satın alma bulunamadı.');
    }

    setIsSubmitting(false);
  };

  const purchaseDisabled = isSubmitting || isLoading || !lifetimePackage;

  return (
    <Screen>
      <View style={s.root} testID="premium-screen">
        <View style={s.topBar}>
          <IconButton
            name="close"
            onPress={() => router.back()}
            testID="premium-close"
            accessibilityLabel="Kapat"
          />
        </View>
        <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
          <LinearGradient
            colors={colors.brandGradient}
            start={GRADIENT_START}
            end={GRADIENT_END}
            style={s.logo}
          >
            <Ionicons name="sparkles" size={LOGO_ICON_SIZE} color={colors.text} />
          </LinearGradient>
          <Text style={s.title}>SmartScrolling Premium</Text>
          <Text style={s.subtitle}>Tek seferlik ödeme, abonelik yok</Text>
          <Text style={s.price}>{priceLabel}</Text>

          <View style={s.benefits}>
            {BENEFITS.map((item) => (
              <View key={item.title} style={s.benefitRow}>
                <View style={s.benefitIcon}>
                  <Ionicons name={item.icon} size={BENEFIT_GLYPH_SIZE} color={colors.text} />
                </View>
                <View style={s.benefitText}>
                  <Text style={s.benefitTitle}>{item.title}</Text>
                  <Text style={s.benefitBody}>{item.body}</Text>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
        <View style={s.footer}>
          <GradientButton
            label={isSubmitting || isLoading ? 'Lütfen bekle…' : "Premium'a geç"}
            onPress={() => void handlePurchase()}
            disabled={purchaseDisabled}
            testID="premium-purchase-button"
          />
          <Button
            variant="ghost"
            label="Satın alımları geri yükle"
            onPress={() => void handleRestore()}
            disabled={isSubmitting}
            testID="premium-restore-button"
          />
        </View>
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  topBar: { alignItems: 'flex-end', paddingHorizontal: space.screen, paddingVertical: space.sm },
  content: { alignItems: 'center', paddingHorizontal: space.screen, paddingTop: space.lg },
  logo: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.lg,
  },
  title: { ...type.cardTitle, color: colors.text, textAlign: 'center' },
  subtitle: {
    ...type.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: space.xs,
  },
  price: { ...type.stat, color: colors.text, textAlign: 'center', marginTop: space.sm },
  benefits: { alignSelf: 'stretch', gap: space.lg, marginTop: space.xxxl },
  benefitRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  benefitIcon: {
    width: BENEFIT_ICON_SIZE,
    height: BENEFIT_ICON_SIZE,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitText: { flex: 1 },
  benefitTitle: { ...type.button, color: colors.text },
  benefitBody: { ...type.caption, color: colors.textSecondary },
  footer: { paddingHorizontal: space.screen, paddingBottom: space.lg, gap: space.sm },
});
