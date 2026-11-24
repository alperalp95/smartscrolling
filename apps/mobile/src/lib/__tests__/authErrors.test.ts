import { authErrorMessage } from '../authErrors';

const FB = 'yedek';

const cases: [string, string, string][] = [
  [
    'email_not_confirmed',
    'Email not confirmed',
    'E-posta adresin henüz onaylanmamış. Gelen kutundaki onay bağlantısına tıkla.',
  ],
  ['invalid_credentials', 'Invalid login credentials', 'E-posta ya da şifre hatalı.'],
  [
    'user_already_exists',
    'User already registered',
    'Bu e-posta ile zaten bir hesap var. Giriş yapmayı dene.',
  ],
  ['weak_password', 'Password should be at least 6 characters', 'Şifre en az 6 karakter olmalı.'],
  [
    'over_email_send_rate_limit',
    'email rate limit exceeded',
    'Çok fazla deneme yapıldı. Biraz bekleyip tekrar dene.',
  ],
  [
    'over_request_rate_limit',
    'request rate limit reached',
    'Çok fazla deneme yapıldı. Biraz bekleyip tekrar dene.',
  ],
  ['email_address_invalid', 'Invalid email address', 'Geçerli bir e-posta adresi gir.'],
];

describe('authErrorMessage', () => {
  for (const [code, message, text] of cases) {
    it(`maps code ${code}`, () => {
      expect(authErrorMessage({ code, message: 'zzz' }, FB)).toBe(text);
    });
    it(`maps message "${message}"`, () => {
      expect(authErrorMessage(new Error(message), FB)).toBe(text);
    });
  }

  it('maps unable to validate email by message', () => {
    expect(
      authErrorMessage(new Error('Unable to validate email address: invalid format'), FB),
    ).toBe('Geçerli bir e-posta adresi gir.');
  });

  it('maps network errors', () => {
    const t = 'İnternet bağlantını kontrol edip tekrar dene.';
    expect(authErrorMessage(new Error('Network request failed'), FB)).toBe(t);
    expect(authErrorMessage(new Error('fetch failed'), FB)).toBe(t);
  });

  it('returns empty string on cancel', () => {
    expect(authErrorMessage({ code: 'ERR_REQUEST_CANCELED' }, FB)).toBe('');
    expect(authErrorMessage({ code: 'SIGN_IN_CANCELLED' }, FB)).toBe('');
    expect(authErrorMessage({ code: 12501 }, FB)).toBe('');
    expect(authErrorMessage(new Error('User cancelled the flow'), FB)).toBe('');
  });

  it('falls back for unknown, null and string errors', () => {
    expect(authErrorMessage(new Error('something odd'), FB)).toBe(FB);
    expect(authErrorMessage(null, FB)).toBe(FB);
    expect(authErrorMessage('Email not confirmed', FB)).toBe(FB);
  });
});
