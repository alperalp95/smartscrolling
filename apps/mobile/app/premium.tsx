import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { PurchasesPackage } from 'react-native-purchases';
import {
  getCurrentOfferingSafe,
  getPremiumEntitlementStatus,
  purchasePackageSafe,
  restorePurchasesSafe,
} from '../src/lib/purchases';
import { useAuthStore } from '../src/store/authStore';

const BENEFITS: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  body: string;
}[] = [
  {
    icon: 'ban-outline',
    title: 'Reklamsiz Deneyim',
    body: 'Okuma akisini bozan hicbir reklam yok. Sadece sen ve icerik.',
  },
  {
    icon: 'library-outline',
    title: 'Tum Kutuphane Erisimi',
    body: 'Sinirli icerik kalmaz. Kutuphanedeki her kitap ve koleksiyon sana acik.',
  },
  {
    icon: 'sparkles-outline',
    title: 'Sinirsiz AI Sorulari',
    body: 'Okudugun her konu hakkinda istedigin kadar soru sor, derinlesmek senin elinde.',
  },
  {
    icon: 'chatbubbles-outline',
    title: 'AI Sohbet Gecmisi',
    body: 'Onceki AI konusmalarini tekrar ac. Dusunce zincirini kaybetme.',
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

      const pkg = offering?.availablePackages?.find((p) => {
        const id = p.identifier.toLowerCase();
        return id.includes('life') || id === '$rc_lifetime';
      }) ?? null;

      if (pkg) {
        setLifetimePackage(pkg);
        setPriceLabel(pkg.product.priceString);
      }

      setIsLoading(false);
    })();

    return () => { cancelled = true; };
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
      Alert.alert('Satin alma', 'Islem tamamlanamadi. Tekrar dene veya geri yuklemeyi dene.');
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
      Alert.alert('Geri yukleme', 'Aktif bir satin alma bulunamadi.');
    }

    setIsSubmitting(false);
  };

  return (
    <SafeAreaView style={s.screen}>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <Pressable onPress={() => router.back()} style={s.backButton}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </Pressable>

        <View style={s.hero}>
          <View style={s.heroBadge}>
            <Ionicons name="star" size={14} color="#f5b942" />
            <Text style={s.heroBadgeText}>PREMIUM</Text>
          </View>
          <Text style={s.heroTitle}>Tam deneyimin kilidini ac</Text>
          <Text style={s.heroSubtitle}>
            Tek seferlik odeme ile reklamsiz okuma, tum kutuphane ve sinirsiz AI erisimi.
          </Text>
        </View>

        <View style={s.benefitCard}>
          {BENEFITS.map((item, index) => (
            <View key={item.title}>
              <View style={s.benefitRow}>
                <View style={s.benefitIconWrap}>
                  <Ionicons name={item.icon} size={20} color="#a78bfa" />
                </View>
                <View style={s.benefitTextWrap}>
                  <Text style={s.benefitTitle}>{item.title}</Text>
                  <Text style={s.benefitBody}>{item.body}</Text>
                </View>
              </View>
              {index < BENEFITS.length - 1 ? <View style={s.benefitDivider} /> : null}
            </View>
          ))}
        </View>

        <View style={s.priceCard}>
          <View style={s.priceAccent} />
          <View style={s.priceContent}>
            <View style={s.priceLeft}>
              <Text style={s.priceLabel}>Omur Boyu Erisim</Text>
              <Text style={s.priceSubLabel}>Tek seferlik odeme, abonelik yok</Text>
            </View>
            <View style={s.priceRight}>
              <Text style={s.priceAmount}>{priceLabel}</Text>
              <Text style={s.priceOnce}>bir kerelik</Text>
            </View>
          </View>
        </View>

        <Pressable
          disabled={isSubmitting || isLoading || !lifetimePackage}
          onPress={() => void handlePurchase()}
          style={[s.ctaButton, (isSubmitting || isLoading || !lifetimePackage) && s.ctaButtonDisabled]}
        >
          {isSubmitting || isLoading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={s.ctaButtonText}>Premium'a Gec</Text>
          )}
        </Pressable>

        <Pressable onPress={() => router.back()} style={s.secondaryAction}>
          <Text style={s.secondaryActionText}>Daha sonra</Text>
        </Pressable>

        <Pressable onPress={() => void handleRestore()} style={s.secondaryAction}>
          <Text style={s.secondaryActionText}>Satin alimlari geri yukle</Text>
        </Pressable>

        <Text style={s.footerNote}>
          Tek seferlik odeme ile kalici erisim. Abonelik veya gizli ucret yok.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0D0D0D',
  },
  content: {
    padding: 20,
    paddingBottom: 36,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  hero: {
    alignItems: 'center',
    marginBottom: 24,
    gap: 12,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(245,185,66,0.1)',
    borderWidth: 0.5,
    borderColor: 'rgba(245,185,66,0.3)',
  },
  heroBadgeText: {
    color: '#f5b942',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  heroTitle: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  heroSubtitle: {
    color: '#9ca3af',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  benefitCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
    marginBottom: 16,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    padding: 16,
  },
  benefitIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(139,92,246,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  benefitTextWrap: {
    flex: 1,
  },
  benefitTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 3,
  },
  benefitBody: {
    color: '#9ca3af',
    fontSize: 13,
    lineHeight: 18,
  },
  benefitDivider: {
    height: 0.5,
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginLeft: 66,
  },
  priceCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: 'rgba(139,92,246,0.2)',
    overflow: 'hidden',
    marginBottom: 24,
  },
  priceAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 3,
    height: '100%',
    backgroundColor: '#8b5cf6',
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
  },
  priceContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 18,
    paddingLeft: 20,
  },
  priceLeft: {
    flex: 1,
    gap: 2,
  },
  priceLabel: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  priceSubLabel: {
    color: '#9ca3af',
    fontSize: 12,
  },
  priceRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  priceAmount: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
  },
  priceOnce: {
    color: '#a78bfa',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  ctaButton: {
    alignItems: 'center',
    backgroundColor: '#8b5cf6',
    borderRadius: 14,
    justifyContent: 'center',
    minHeight: 52,
    marginBottom: 14,
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  ctaButtonDisabled: {
    opacity: 0.55,
  },
  ctaButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  secondaryAction: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  secondaryActionText: {
    color: '#9ca3af',
    fontSize: 14,
    fontWeight: '600',
  },
  footerNote: {
    color: '#6b7280',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 12,
    textAlign: 'center',
  },
});
