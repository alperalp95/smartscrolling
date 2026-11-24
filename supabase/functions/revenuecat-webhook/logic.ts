// Saf mantık: RevenueCat webhook olaylarını premium kararına çevirir.
// Not: sadece "erasable" TS sözdizimi kullanılır (Node `--test` ve Deno ikisi de çalıştırır).

export type RevenueCatEvent = {
  type?: string;
  app_user_id?: string;
  original_app_user_id?: string;
  aliases?: string[];
  entitlement_ids?: string[] | null;
  expiration_at_ms?: number | null;
};

export type PremiumDecision =
  | { action: 'set'; premium: boolean }
  | { action: 'ignore'; reason: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const GRANT_TYPES = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'UNCANCELLATION',
  'PRODUCT_CHANGE',
  'NON_RENEWING_PURCHASE',
  'SUBSCRIPTION_EXTENDED',
  'TEMPORARY_ENTITLEMENT_GRANT',
]);

export const PREMIUM_ENTITLEMENT_ID = 'premium';

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

/** app_user_id UUID ise onu, değilse aliases içindeki ilk UUID'yi döndürür; yoksa null. */
export function resolveUserId(event: RevenueCatEvent): string | null {
  if (isUuid(event.app_user_id)) return event.app_user_id;
  if (Array.isArray(event.aliases)) {
    const alias = event.aliases.find(isUuid);
    if (alias) return alias;
  }
  return null;
}

function entitlementsAllowPremium(ids: string[] | null | undefined): boolean {
  if (!Array.isArray(ids) || ids.length === 0) return true;
  return ids.includes(PREMIUM_ENTITLEMENT_ID);
}

export function decidePremium(event: RevenueCatEvent): PremiumDecision {
  const type = typeof event.type === 'string' ? event.type : 'UNKNOWN';

  if (GRANT_TYPES.has(type)) {
    if (!entitlementsAllowPremium(event.entitlement_ids)) {
      return { action: 'ignore', reason: 'other_entitlement' };
    }
    return { action: 'set', premium: true };
  }

  if (type === 'EXPIRATION') {
    if (!entitlementsAllowPremium(event.entitlement_ids)) {
      return { action: 'ignore', reason: 'other_entitlement' };
    }
    return { action: 'set', premium: false };
  }

  return { action: 'ignore', reason: type };
}

/** Sabit zamanlı string karşılaştırma. */
export function timingSafeEqualStrings(a: string, b: string): boolean {
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

export type AuthCheck = 'ok' | 'unauthorized' | 'misconfigured';

/** Authorization header: `Bearer <secret>` ya da düz `<secret>`. Secret yoksa fail-closed. */
export function checkWebhookAuth(
  authorizationHeader: string | null | undefined,
  secret: string | null | undefined,
): AuthCheck {
  if (!secret) return 'misconfigured';
  const header = (authorizationHeader ?? '').trim();
  if (!header) return 'unauthorized';
  const token = header.replace(/^Bearer\s+/i, '').trim();
  const okPlain = timingSafeEqualStrings(header, secret);
  const okBearer = timingSafeEqualStrings(token, secret);
  return okPlain || okBearer ? 'ok' : 'unauthorized';
}

/** Mevcut app_metadata'yı koruyup premium alanlarını üstüne yazar. */
export function mergeAppMetadata(
  existing: Record<string, unknown> | null | undefined,
  premium: boolean,
  nowIso: string,
): Record<string, unknown> {
  return { ...(existing ?? {}), premium, premium_updated_at: nowIso };
}
