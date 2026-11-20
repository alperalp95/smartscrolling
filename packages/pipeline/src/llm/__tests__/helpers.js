// Test yardımcıları: sahte fetch / sleep / env. Gerçek ağ çağrısı yapılmaz.
import { loadConfig } from '../config.js';

export const TEST_ENV = Object.freeze({
  GROQ_API_KEY: 'test-groq-key-SECRET',
  CLOUDFLARE_API_TOKEN: 'test-cf-token-SECRET',
  CLOUDFLARE_ACCOUNT_ID: 'acc123',
  GEMINI_API_KEY: 'test-gemini-key-SECRET',
});

export const FIXED_NOW = Date.parse('2026-11-20T10:00:00Z');

export function realConfig() {
  return loadConfig();
}

export function json(status, body, headers = {}) {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

export function chatOk(content, { prompt = 100, completion = 50 } = {}) {
  return json(200, {
    choices: [{ message: { role: 'assistant', content } }],
    usage: { prompt_tokens: prompt, completion_tokens: completion },
  });
}

export function rateLimited(headers = {}, message = 'Rate limit reached for requests per minute (RPM)') {
  return json(429, { error: { message, type: 'requests', code: 'rate_limit_exceeded' } }, headers);
}

/**
 * handler(call, index) -> Response | Promise<Response>; hata fırlatabilir.
 * calls: [{ url, method, headers, body }]
 */
export function fakeFetch(handler) {
  const calls = [];
  const fn = async (url, init = {}) => {
    const call = {
      url: String(url),
      method: init.method,
      headers: init.headers ?? {},
      body: init.body ? JSON.parse(init.body) : undefined,
      signal: init.signal,
    };
    calls.push(call);
    return handler(call, calls.length - 1);
  };
  fn.calls = calls;
  return fn;
}

export function fakeSleep() {
  const waits = [];
  const fn = async (ms) => {
    waits.push(ms);
  };
  fn.waits = waits;
  return fn;
}

export function isGroq(call) {
  return call.url.startsWith('https://api.groq.com/');
}
export function isCloudflare(call) {
  return call.url.startsWith('https://api.cloudflare.com/');
}
export function isGemini(call) {
  return call.url.startsWith('https://generativelanguage.googleapis.com/');
}
