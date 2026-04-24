import Constants from 'expo-constants';
import { Platform } from 'react-native';
import Purchases, { LOG_LEVEL, type PurchasesPackage } from 'react-native-purchases';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';

type RevenueCatExtra = {
  revenueCatAndroidApiKey?: string;
  revenueCatEntitlementId?: string;
  revenueCatIosApiKey?: string;
  revenueCatOfferingId?: string;
};

let isConfigured = false;
let currentRevenueCatAppUserId: string | null = null;

function getRevenueCatApiKey() {
  const extra = (Constants.expoConfig?.extra ?? {}) as RevenueCatExtra;

  if (Platform.OS === 'ios') {
    return extra.revenueCatIosApiKey?.trim() || '';
  }

  if (Platform.OS === 'android') {
    return extra.revenueCatAndroidApiKey?.trim() || '';
  }

  return '';
}

function getRevenueCatConfig() {
  const extra = (Constants.expoConfig?.extra ?? {}) as RevenueCatExtra;

  return {
    entitlementId: extra.revenueCatEntitlementId?.trim() || 'SmartScroll Pro',
    offeringId: extra.revenueCatOfferingId?.trim() || 'default',
  };
}

export async function ensurePurchasesConfigured(appUserID?: string | null) {
  const apiKey = getRevenueCatApiKey();
  const normalizedAppUserId = appUserID?.trim() || null;

  if (!apiKey) {
    return false;
  }

  if (!isConfigured) {
    Purchases.setLogLevel(LOG_LEVEL.VERBOSE);
    await Purchases.configure({
      apiKey,
      appUserID: normalizedAppUserId ?? undefined,
    });
    isConfigured = true;
    currentRevenueCatAppUserId = normalizedAppUserId;
    return true;
  }

  if (normalizedAppUserId) {
    if (currentRevenueCatAppUserId === normalizedAppUserId) {
      return true;
    }

    try {
      await Purchases.logIn(normalizedAppUserId);
      currentRevenueCatAppUserId = normalizedAppUserId;
    } catch (error) {
      console.warn('[Purchases] logIn failed:', error);
    }
    return true;
  }

  if (currentRevenueCatAppUserId) {
    try {
      await Purchases.logOut();
      currentRevenueCatAppUserId = null;
    } catch (error) {
      console.warn('[Purchases] logOut failed:', error);
    }
  }

  return true;
}

export async function getPremiumEntitlementStatus(appUserID?: string | null) {
  const configured = await ensurePurchasesConfigured(appUserID);

  if (!configured) {
    return false;
  }

  try {
    const customerInfo = await Purchases.getCustomerInfo();
    const { entitlementId } = getRevenueCatConfig();
    return typeof customerInfo.entitlements.active[entitlementId] !== 'undefined';
  } catch (error) {
    console.warn('[Purchases] getCustomerInfo failed:', error);
    return false;
  }
}

export async function getCustomerInfoSafe(appUserID?: string | null) {
  const configured = await ensurePurchasesConfigured(appUserID);

  if (!configured) {
    return null;
  }

  try {
    return await Purchases.getCustomerInfo();
  } catch (error) {
    console.warn('[Purchases] getCustomerInfo failed:', error);
    return null;
  }
}

export async function getOfferingsSafe(appUserID?: string | null) {
  const configured = await ensurePurchasesConfigured(appUserID);

  if (!configured) {
    return null;
  }

  try {
    return await Purchases.getOfferings();
  } catch (error) {
    console.warn('[Purchases] getOfferings failed:', error);
    return null;
  }
}

export async function getCurrentOfferingSafe(appUserID?: string | null) {
  const offerings = await getOfferingsSafe(appUserID);
  return offerings?.current ?? null;
}

export async function purchasePackageSafe(pkg: PurchasesPackage, appUserID?: string | null) {
  const configured = await ensurePurchasesConfigured(appUserID);

  if (!configured) {
    return null;
  }

  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return customerInfo;
  } catch (error) {
    console.warn('[Purchases] purchasePackage failed:', error);
    return null;
  }
}

export async function restorePurchasesSafe(appUserID?: string | null) {
  const configured = await ensurePurchasesConfigured(appUserID);

  if (!configured) {
    return null;
  }

  try {
    return await Purchases.restorePurchases();
  } catch (error) {
    console.warn('[Purchases] restorePurchases failed:', error);
    return null;
  }
}

export async function presentSmartScrollPaywall(appUserID?: string | null) {
  const configured = await ensurePurchasesConfigured(appUserID);

  if (!configured || Platform.OS === 'web') {
    return false;
  }

  try {
    const { entitlementId } = getRevenueCatConfig();
    const paywallResult = await RevenueCatUI.presentPaywallIfNeeded({
      requiredEntitlementIdentifier: entitlementId,
    });

    switch (paywallResult) {
      case PAYWALL_RESULT.PURCHASED:
      case PAYWALL_RESULT.RESTORED:
        return true;
      default:
        return false;
    }
  } catch (error) {
    console.warn('[Purchases] presentPaywall failed:', error);
    return false;
  }
}

export async function presentCustomerCenterSafe(appUserID?: string | null) {
  const configured = await ensurePurchasesConfigured(appUserID);

  if (!configured || Platform.OS === 'web') {
    return false;
  }

  try {
    await RevenueCatUI.presentCustomerCenter({
      callbacks: {
        onRestoreCompleted: () => {
          console.log('[Purchases] Customer Center restore completed.');
        },
      },
    });
    return true;
  } catch (error) {
    console.warn('[Purchases] presentCustomerCenter failed:', error);
    return false;
  }
}
