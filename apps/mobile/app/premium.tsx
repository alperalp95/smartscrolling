import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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

type PackageCard = {
  id: string;
  title: string;
  subtitle: string;
  badge?: string;
  price: string;
  packageRef: PurchasesPackage;
};

const BENEFITS = [
  ['Reklamsiz kullanim', 'Dikkatini bozmadan kesintisiz oku.'],
  ['Tum kutuphane erisimi', 'Secili iceriklerin tamamini ac.'],
  ['Serbest AI sorulari', 'Istedigin kadar sor, daha derine in.'],
  ['AI sohbet gecmisi', 'Tum dusunce zincirine sonra da don.'],
] as const;

function mapPackageTitle(identifier: string) {
  const normalized = identifier.toLowerCase();

  if (normalized.includes('year')) {
    return { title: 'Yillik', subtitle: 'En dengeli tercih', badge: 'EN IYI DEGER' };
  }

  if (normalized.includes('month')) {
    return { title: 'Aylik', subtitle: 'Esnek baslangic' };
  }

  if (normalized.includes('life')) {
    return { title: 'Omur Boyu', subtitle: 'Tek seferlik erisim' };
  }

  return { title: identifier, subtitle: 'Premium erisim' };
}

export default function PremiumScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const setHasPremium = useAuthStore((state) => state.setHasPremium);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [packages, setPackages] = useState<PackageCard[]>([]);

  useEffect(() => {
    let isMounted = true;

    void (async () => {
      const offering = await getCurrentOfferingSafe(user?.id);
      const availablePackages =
        offering?.availablePackages
          ?.filter((pkg) => {
            const identifier = pkg.identifier.toLowerCase();
            return (
              identifier.includes('month') ||
              identifier.includes('year') ||
              identifier.includes('life')
            );
          })
          .sort((left, right) => {
            const order = (identifier: string) => {
              const normalized = identifier.toLowerCase();
              if (normalized.includes('year')) return 0;
              if (normalized.includes('month')) return 1;
              if (normalized.includes('life')) return 2;
              return 3;
            };

            return order(left.identifier) - order(right.identifier);
          }) ?? [];

      if (!isMounted) {
        return;
      }

      const nextPackages = availablePackages.map((pkg) => {
        const meta = mapPackageTitle(pkg.identifier);
        return {
          id: pkg.identifier,
          title: meta.title,
          subtitle: meta.subtitle,
          badge: meta.badge,
          price: pkg.product.priceString,
          packageRef: pkg,
        };
      });

      setPackages(nextPackages);
      setSelectedId(nextPackages[0]?.id ?? null);
      setIsLoading(false);
    })();

    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  const selectedPackage = useMemo(
    () => packages.find((pkg) => pkg.id === selectedId) ?? null,
    [packages, selectedId],
  );

  const handlePurchase = async () => {
    if (!selectedPackage || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    const customerInfo = await purchasePackageSafe(selectedPackage.packageRef, user?.id);
    const hasPremium = customerInfo ? await getPremiumEntitlementStatus(user?.id) : false;

    if (hasPremium) {
      setHasPremium(true);
      router.back();
    }

    setIsSubmitting(false);
  };

  const handleRestore = async () => {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    await restorePurchasesSafe(user?.id);
    setHasPremium(await getPremiumEntitlementStatus(user?.id));
    setIsSubmitting(false);
  };

  return (
    <SafeAreaView style={s.screen}>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <View style={s.hero}>
          <Text style={s.heroEyebrow}>Premium deneyim</Text>
          <Text style={s.heroTitle}>SmartScroll Pro ile daha derin bir deneyim</Text>
          <Text style={s.heroSubtitle}>
            Reklamsiz akis, tum kutuphaneye erisim ve sinirsiz AI deneyimi tek uyelikte.
          </Text>
        </View>

        <View style={s.benefitList}>
          {BENEFITS.map(([title, body]) => (
            <View key={title} style={s.benefitCard}>
              <View style={s.benefitIcon}>
                <Text style={s.benefitIconText}>✓</Text>
              </View>
              <View style={s.benefitTextWrap}>
                <Text style={s.benefitTitle}>{title}</Text>
                <Text style={s.benefitBody}>{body}</Text>
              </View>
            </View>
          ))}
        </View>

        {isLoading ? (
          <View style={s.loadingWrap}>
            <ActivityIndicator color="#8b5cf6" />
            <Text style={s.loadingText}>Paketler yukleniyor...</Text>
          </View>
        ) : (
          <View style={s.pricingWrap}>
            {packages.map((pkg) => {
              const selected = pkg.id === selectedId;
              return (
                <Pressable
                  key={pkg.id}
                  onPress={() => setSelectedId(pkg.id)}
                  style={[s.packageCard, selected ? s.packageCardSelected : null]}
                >
                  <View style={s.packageHeader}>
                    <Text style={s.packageTitle}>{pkg.title}</Text>
                    {pkg.badge ? (
                      <View style={s.packageBadge}>
                        <Text style={s.packageBadgeText}>{pkg.badge}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={s.packagePrice}>{pkg.price}</Text>
                  <Text style={s.packageSubtitle}>{pkg.subtitle}</Text>
                </Pressable>
              );
            })}
          </View>
        )}

        <Pressable
          disabled={!selectedPackage || isSubmitting || isLoading}
          onPress={() => void handlePurchase()}
          style={[s.ctaButton, !selectedPackage || isLoading ? s.ctaButtonDisabled : null]}
        >
          <Text style={s.ctaButtonText}>{isSubmitting ? 'Isleniyor...' : "Pro'ya Gec"}</Text>
        </Pressable>

        <Pressable onPress={() => router.back()} style={s.secondaryAction}>
          <Text style={s.secondaryActionText}>Daha sonra</Text>
        </Pressable>

        <Pressable onPress={() => void handleRestore()} style={s.secondaryAction}>
          <Text style={s.secondaryActionText}>Satın alımlari geri yukle</Text>
        </Pressable>

        <Text style={s.footerNote}>Aboneligini istedigin zaman yonetebilirsin.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0b0814',
  },
  content: {
    padding: 20,
    paddingBottom: 36,
  },
  hero: {
    backgroundColor: '#171126',
    borderColor: 'rgba(139,92,246,0.28)',
    borderRadius: 24,
    borderWidth: 1,
    padding: 24,
    marginBottom: 18,
  },
  heroEyebrow: {
    color: '#a78bfa',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: '#fff',
    fontSize: 30,
    fontWeight: '900',
    lineHeight: 36,
    marginBottom: 10,
    textAlign: 'center',
  },
  heroSubtitle: {
    color: '#d8d3ea',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  benefitList: {
    gap: 12,
    marginBottom: 20,
  },
  benefitCard: {
    alignItems: 'center',
    backgroundColor: '#171126',
    borderColor: 'rgba(139,92,246,0.18)',
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 16,
  },
  benefitIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(139,92,246,0.18)',
    borderColor: 'rgba(139,92,246,0.34)',
    borderRadius: 999,
    borderWidth: 1,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  benefitIconText: {
    color: '#a78bfa',
    fontWeight: '800',
  },
  benefitTextWrap: {
    flex: 1,
  },
  benefitTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 4,
  },
  benefitBody: {
    color: '#d8d3ea',
    fontSize: 13,
    lineHeight: 18,
  },
  loadingWrap: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  loadingText: {
    color: '#d8d3ea',
    marginTop: 10,
  },
  pricingWrap: {
    gap: 12,
    marginBottom: 20,
  },
  packageCard: {
    backgroundColor: '#171126',
    borderColor: 'rgba(139,92,246,0.18)',
    borderRadius: 22,
    borderWidth: 1,
    padding: 18,
  },
  packageCardSelected: {
    borderColor: '#8b5cf6',
    borderWidth: 2,
    shadowColor: '#8b5cf6',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  packageHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  packageTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },
  packageBadge: {
    backgroundColor: '#8b5cf6',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  packageBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  packagePrice: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 6,
  },
  packageSubtitle: {
    color: '#c4bddf',
    fontSize: 13,
  },
  ctaButton: {
    alignItems: 'center',
    backgroundColor: '#8b5cf6',
    borderRadius: 999,
    justifyContent: 'center',
    minHeight: 56,
    marginBottom: 14,
  },
  ctaButtonDisabled: {
    opacity: 0.55,
  },
  ctaButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
  },
  secondaryAction: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  secondaryActionText: {
    color: '#d8d3ea',
    fontSize: 14,
    fontWeight: '600',
  },
  footerNote: {
    color: '#a9a0c8',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
    textAlign: 'center',
  },
});
