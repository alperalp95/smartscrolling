import { Platform } from 'react-native';

export type AdAudience = 'guest' | 'free' | 'premium';
export type FeedAdSlotKind = 'static' | 'inline_video';

export type FeedAdSlot = {
  id: string;
  slotType: 'ad';
  audience: Exclude<AdAudience, 'premium'>;
  adNumber: number;
  afterContentIndex: number;
  kind: FeedAdSlotKind;
};

type AdUnitConfig = {
  feedStatic: string;
  feedInlineVideo: string;
};

export const AD_CADENCE: Record<
  Exclude<AdAudience, 'premium'>,
  { firstAdAfter: number; interval: number; videoEveryNthAd: number }
> = {
  guest: {
    firstAdAfter: 5,
    interval: 6,
    videoEveryNthAd: 2,
  },
  free: {
    firstAdAfter: 9,
    interval: 10,
    videoEveryNthAd: 3,
  },
};

export const GOOGLE_DEMO_AD_UNITS: Record<'android' | 'ios', AdUnitConfig> = {
  android: {
    feedStatic: 'ca-app-pub-3940256099942544/6300978111',
    feedInlineVideo: 'ca-app-pub-3940256099942544/1044960115',
  },
  ios: {
    feedStatic: 'ca-app-pub-3940256099942544/2934735716',
    feedInlineVideo: 'ca-app-pub-3940256099942544/3986624511',
  },
};

export function getAdAudience(input: {
  hasPremium: boolean;
  isAuthenticated: boolean;
}): AdAudience {
  if (input.hasPremium) {
    return 'premium';
  }

  return input.isAuthenticated ? 'free' : 'guest';
}

export function shouldShowAds(audience: AdAudience) {
  return audience !== 'premium';
}

export function getFeedAdUnitId(kind: FeedAdSlotKind) {
  const platform = Platform.OS === 'ios' ? 'ios' : 'android';
  const units = GOOGLE_DEMO_AD_UNITS[platform];

  return kind === 'inline_video' ? units.feedInlineVideo : units.feedStatic;
}

export function insertFeedAdSlots<T extends { id: string }>(
  items: T[],
  audience: AdAudience,
): Array<T | FeedAdSlot> {
  if (!shouldShowAds(audience)) {
    return items;
  }

  const cadence = AD_CADENCE[audience];
  const result: Array<T | FeedAdSlot> = [];
  let adNumber = 0;

  items.forEach((item, index) => {
    result.push(item);

    const contentIndex = index + 1;
    const shouldInsertAd =
      contentIndex >= cadence.firstAdAfter &&
      (contentIndex - cadence.firstAdAfter) % cadence.interval === 0;

    if (!shouldInsertAd) {
      return;
    }

    adNumber += 1;
    result.push({
      id: `feed-ad-${audience}-${contentIndex}-${adNumber}`,
      slotType: 'ad',
      audience,
      adNumber,
      afterContentIndex: contentIndex,
      kind: adNumber % cadence.videoEveryNthAd === 0 ? 'inline_video' : 'static',
    });
  });

  return result;
}
