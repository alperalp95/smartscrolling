import { resolveBookAccess } from '../books';

describe('resolveBookAccess', () => {
  it('allows everyone to read the free anchor book', () => {
    expect(resolveBookAccess({ accessTier: 'free_anchor', isPremium: false })).toMatchObject({
      canRead: true,
      isFreeAnchor: true,
      needsAuth: false,
      needsPremium: false,
    });
  });

  it('requires auth before premium upsell for signed-out users', () => {
    expect(
      resolveBookAccess({ accessTier: 'premium', isPremium: true }, { isAuthenticated: false }),
    ).toMatchObject({
      canRead: false,
      ctaLabel: 'Giris Yap',
      needsAuth: true,
      needsPremium: false,
    });
  });

  it('requires premium for signed-in free users', () => {
    expect(
      resolveBookAccess(
        { accessTier: 'premium', isPremium: true },
        { hasPremium: false, isAuthenticated: true },
      ),
    ).toMatchObject({
      canRead: false,
      ctaLabel: 'Premium Gerekli',
      needsAuth: false,
      needsPremium: true,
    });
  });

  it('allows premium users to read premium books', () => {
    expect(
      resolveBookAccess(
        { accessTier: 'premium', isPremium: true },
        { hasPremium: true, isAuthenticated: true },
      ),
    ).toMatchObject({
      canRead: true,
      ctaLabel: 'Okumaya Basla',
      needsAuth: false,
      needsPremium: false,
    });
  });
});
