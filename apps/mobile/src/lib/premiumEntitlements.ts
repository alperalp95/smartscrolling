import { getPremiumEntitlementStatus } from './purchases';

export async function hydratePremiumEntitlement(userId: string | null | undefined) {
  return getPremiumEntitlementStatus(userId);
}
