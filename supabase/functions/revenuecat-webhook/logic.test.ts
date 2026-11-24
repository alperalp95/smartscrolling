import test from 'node:test';
import assert from 'node:assert/strict';
import { checkWebhookAuth, decidePremium, mergeAppMetadata, resolveUserId } from './logic.ts';

const UUID = '123e4567-e89b-12d3-a456-426614174000';
const UUID2 = '223e4567-e89b-12d3-a456-426614174001';

test('olay tipleri doğru karara döner', () => {
  for (const type of [
    'INITIAL_PURCHASE',
    'RENEWAL',
    'UNCANCELLATION',
    'PRODUCT_CHANGE',
    'NON_RENEWING_PURCHASE',
    'SUBSCRIPTION_EXTENDED',
    'TEMPORARY_ENTITLEMENT_GRANT',
  ]) {
    assert.deepEqual(decidePremium({ type, entitlement_ids: ['premium'] }), {
      action: 'set',
      premium: true,
    });
  }
  assert.deepEqual(decidePremium({ type: 'EXPIRATION' }), {
    action: 'set',
    premium: false,
  });
  for (const type of ['CANCELLATION', 'BILLING_ISSUE', 'TEST', 'TRANSFER', undefined]) {
    assert.equal(decidePremium({ type }).action, 'ignore');
  }
});

test('entitlement_ids boşsa kabul, başka entitlement ise yok say', () => {
  assert.equal(decidePremium({ type: 'RENEWAL', entitlement_ids: [] }).action, 'set');
  assert.equal(decidePremium({ type: 'RENEWAL', entitlement_ids: null }).action, 'set');
  assert.equal(decidePremium({ type: 'RENEWAL', entitlement_ids: ['other'] }).action, 'ignore');
});

test('kullanıcı id: UUID, alias, anonim', () => {
  assert.equal(resolveUserId({ app_user_id: UUID }), UUID);
  assert.equal(
    resolveUserId({
      app_user_id: '$RCAnonymousID:abc',
      aliases: ['$RCAnonymousID:abc', UUID2],
    }),
    UUID2,
  );
  assert.equal(resolveUserId({ app_user_id: '$RCAnonymousID:abc', aliases: ['x'] }), null);
  assert.equal(resolveUserId({ app_user_id: '$RCAnonymousID:abc' }), null);
});

test('secret karşılaştırma', () => {
  assert.equal(checkWebhookAuth('s3cret', 's3cret'), 'ok');
  assert.equal(checkWebhookAuth('Bearer s3cret', 's3cret'), 'ok');
  assert.equal(checkWebhookAuth('wrong', 's3cret'), 'unauthorized');
  assert.equal(checkWebhookAuth('Bearer wrong', 's3cret'), 'unauthorized');
  assert.equal(checkWebhookAuth(null, 's3cret'), 'unauthorized');
  assert.equal(checkWebhookAuth('s3cret', undefined), 'misconfigured');
  assert.equal(checkWebhookAuth('s3cret', ''), 'misconfigured');
});

test('app_metadata birleştirme diğer alanları korur', () => {
  const merged = mergeAppMetadata({ provider: 'email', role: 'x', premium: false }, true, 'T');
  assert.deepEqual(merged, {
    provider: 'email',
    role: 'x',
    premium: true,
    premium_updated_at: 'T',
  });
  assert.deepEqual(mergeAppMetadata(null, false, 'T'), {
    premium: false,
    premium_updated_at: 'T',
  });
});
