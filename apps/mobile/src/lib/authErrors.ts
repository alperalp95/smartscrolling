const CANCEL_CODES = ['ERR_REQUEST_CANCELED', 'SIGN_IN_CANCELLED', '12501'];

type Rule = { codes: string[]; phrases: string[]; text: string };

const RULES: Rule[] = [
  {
    codes: ['email_not_confirmed'],
    phrases: ['email not confirmed'],
    text: 'E-posta adresin henüz onaylanmamış. Gelen kutundaki onay bağlantısına tıkla.',
  },
  {
    codes: ['invalid_credentials'],
    phrases: ['invalid login credentials'],
    text: 'E-posta ya da şifre hatalı.',
  },
  {
    codes: ['user_already_exists'],
    phrases: ['user already registered'],
    text: 'Bu e-posta ile zaten bir hesap var. Giriş yapmayı dene.',
  },
  {
    codes: ['weak_password'],
    phrases: ['password should be at least'],
    text: 'Şifre en az 6 karakter olmalı.',
  },
  {
    codes: ['over_email_send_rate_limit', 'over_request_rate_limit'],
    phrases: ['rate limit'],
    text: 'Çok fazla deneme yapıldı. Biraz bekleyip tekrar dene.',
  },
  {
    codes: ['email_address_invalid'],
    phrases: ['invalid email', 'unable to validate email'],
    text: 'Geçerli bir e-posta adresi gir.',
  },
  {
    codes: [],
    phrases: ['network request failed', 'fetch failed'],
    text: 'İnternet bağlantını kontrol edip tekrar dene.',
  },
];

/** Turns an auth error into a Turkish message. Returns '' when the user cancelled. */
export function authErrorMessage(error: unknown, fallback: string): string {
  if (typeof error !== 'object' || error === null) {
    return fallback;
  }
  const raw = error as { code?: unknown; message?: unknown };
  const code = typeof raw.code === 'string' || typeof raw.code === 'number' ? String(raw.code) : '';
  const message = typeof raw.message === 'string' ? raw.message.toLowerCase() : '';

  if (CANCEL_CODES.includes(code) || message.includes('cancel')) {
    return '';
  }
  for (const rule of RULES) {
    if (rule.codes.includes(code) || rule.phrases.some((p) => message.includes(p))) {
      return rule.text;
    }
  }
  return fallback;
}
