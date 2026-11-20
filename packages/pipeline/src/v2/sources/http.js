// Toplayıcılar için kibar HTTP istemcisi: global fetch, sabit User-Agent, istekler arası
// en az 200 ms, 429/5xx/ağ hatasında üstel bekleme (en fazla 3 deneme).

export const USER_AGENT = 'content-pipeline/2.0 (educational fact app)';
export const MIN_INTERVAL_MS = 200;
export const MAX_ATTEMPTS = 3;
export const BASE_BACKOFF_MS = 1000;

export class HttpError extends Error {
  /**
   * @param {string} message
   * @param {number | null} status
   * @param {string} url
   */
  constructor(message, status, url) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.url = url;
  }
}

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function isRetryable(status) {
  return status === 429 || (status >= 500 && status <= 599);
}

/**
 * @param {object} [options]
 * @param {typeof fetch} [options.fetchImpl]
 * @param {(ms: number) => Promise<void>} [options.sleep]
 * @param {() => number} [options.now]
 * @param {number} [options.minIntervalMs]
 * @param {number} [options.maxAttempts]
 * @param {number} [options.baseBackoffMs]
 */
export function createHttpClient({
  fetchImpl = globalThis.fetch,
  sleep = defaultSleep,
  now = () => Date.now(),
  minIntervalMs = MIN_INTERVAL_MS,
  maxAttempts = MAX_ATTEMPTS,
  baseBackoffMs = BASE_BACKOFF_MS,
} = {}) {
  let lastRequestAt = -Infinity;
  let requests = 0;

  async function throttle() {
    const wait = lastRequestAt + minIntervalMs - now();
    if (wait > 0) await sleep(wait);
    lastRequestAt = now();
  }

  /**
   * @param {string | URL} url
   * @returns {Promise<Response>}
   */
  async function request(url) {
    const href = String(url);
    let lastError = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      await throttle();
      requests += 1;
      let response;
      try {
        response = await fetchImpl(href, {
          headers: { 'User-Agent': USER_AGENT, 'Api-User-Agent': USER_AGENT, Accept: 'application/json' },
        });
      } catch (error) {
        lastError = new HttpError(`network error: ${error.message}`, null, href);
        if (attempt < maxAttempts) await sleep(baseBackoffMs * 2 ** (attempt - 1));
        continue;
      }
      if (response.ok) return response;
      lastError = new HttpError(`HTTP ${response.status}`, response.status, href);
      if (!isRetryable(response.status) || attempt === maxAttempts) break;
      const retryAfter = Number.parseInt(response.headers?.get?.('retry-after') ?? '', 10);
      const backoff = baseBackoffMs * 2 ** (attempt - 1);
      await sleep(Number.isFinite(retryAfter) ? Math.max(backoff, retryAfter * 1000) : backoff);
    }
    throw lastError;
  }

  return {
    /** @param {string | URL} url */
    async getJson(url) {
      const response = await request(url);
      return response.json();
    },
    /** @param {string | URL} url */
    async getText(url) {
      const response = await request(url);
      return response.text();
    },
    get requestCount() {
      return requests;
    },
  };
}

/**
 * MediaWiki Action API çağrısı (format=json, formatversion=2). API hatasında fırlatır.
 *
 * @param {{ getJson: (url: string | URL) => Promise<any> }} http
 * @param {string} host  ör. "en.wikipedia.org"
 * @param {Record<string, string | number>} params
 */
export async function mediawikiApi(http, host, params) {
  const url = new URL(`https://${host}/w/api.php`);
  for (const [key, value] of Object.entries({ format: 'json', formatversion: 2, ...params })) {
    url.searchParams.set(key, String(value));
  }
  const json = await http.getJson(url);
  if (json?.error) {
    throw new HttpError(`MediaWiki API error ${json.error.code}: ${json.error.info}`, null, String(url));
  }
  return json;
}

/**
 * `action=parse` ile bir sayfanın HTML'ini (ve istenirse wikitext'ini) alır.
 *
 * @param {{ getJson: (url: string | URL) => Promise<any> }} http
 * @param {string} host
 * @param {string} page
 * @param {string} [prop]
 * @returns {Promise<{ title: string, text?: string, wikitext?: string, links?: Array<{ ns: number, title: string, exists?: boolean }> }>}
 */
export async function parsePage(http, host, page, prop = 'text') {
  const json = await mediawikiApi(http, host, { action: 'parse', page, prop, redirects: 1 });
  return json.parse;
}
