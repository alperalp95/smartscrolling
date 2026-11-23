import type { ComponentType } from 'react';
import { Platform } from 'react-native';

type BannerAdProps = {
  onAdFailedToLoad?: (error: unknown) => void;
  onAdLoaded?: () => void;
  size: string;
  unitId: string;
};

type GoogleMobileAdsModule = {
  BannerAd?: ComponentType<BannerAdProps>;
  BannerAdSize?: {
    BANNER?: string;
  };
  default?: () => {
    initialize: () => Promise<unknown>;
  };
};

let cachedGoogleMobileAds: GoogleMobileAdsModule | null | undefined;
let initializePromise: Promise<boolean> | null = null;

function loadGoogleMobileAds() {
  if (Platform.OS !== 'android') {
    return null;
  }

  if (cachedGoogleMobileAds !== undefined) {
    return cachedGoogleMobileAds;
  }

  try {
    cachedGoogleMobileAds = require('react-native-google-mobile-ads') as GoogleMobileAdsModule;
  } catch (error) {
    console.warn('[AdMob] Native module unavailable; demo banner fallback will be shown.', error);
    cachedGoogleMobileAds = null;
  }

  return cachedGoogleMobileAds;
}

export function getGoogleMobileAdsBannerComponents() {
  const googleMobileAds = loadGoogleMobileAds();
  const BannerAd = googleMobileAds?.BannerAd;
  const bannerSize = googleMobileAds?.BannerAdSize?.BANNER;

  if (!BannerAd || !bannerSize) {
    return null;
  }

  return { BannerAd, bannerSize };
}

export async function initializeGoogleMobileAdsForDemoSmoke() {
  if (Platform.OS !== 'android') {
    return false;
  }

  if (initializePromise) {
    return initializePromise;
  }

  initializePromise = (async () => {
    const googleMobileAds = loadGoogleMobileAds();
    const mobileAds = googleMobileAds?.default;

    if (!mobileAds) {
      return false;
    }

    try {
      await mobileAds().initialize();
      return true;
    } catch (error) {
      console.warn('[AdMob] Demo smoke initialization failed.', error);
      return false;
    }
  })();

  return initializePromise;
}
