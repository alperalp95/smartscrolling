// Test yardımcıları: sahte LLM (rol başına hazır yanıt), sahte embedding, sahte fetch, fixture HTML.
// Gerçek LLM / ağ / DB çağrısı yapılmaz.
import { LlmExhaustedError } from '../../../llm/index.js';

export const FIXED_NOW = () => Date.parse('2026-11-20T10:00:00Z');

export const TEST_CONFIG = Object.freeze({
  scoring: { batchSize: 15, passPercent: 30 },
  dedup: { duplicateThreshold: 0.92, grayZoneLow: 0.85 },
});

export function exhausted(role) {
  return new LlmExhaustedError(role, {
    attempts: [{ provider: 'fake', model: 'fake', reason: 'quota' }],
  });
}

const DIMS = 256;

function hashWord(w) {
  let h = 2166136261;
  for (const ch of w) {
    h ^= ch.codePointAt(0);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h % DIMS;
}

/** Kelime torbası embedding: aynı kelimeler → aynı vektör (sıra önemsiz). */
export function bowEmbed(text) {
  const v = new Array(DIMS).fill(0);
  const words = String(text)
    .toLocaleLowerCase('tr-TR')
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length > 3);
  for (const w of words) v[hashWord(w)] += 1;
  if (words.length === 0) v[0] = 1;
  return v;
}

/**
 * Sahte LLM. handlers: { scorer, writer, verifier, judge } → (req, n) => json | Error (fırlatılır)
 * ya da yanıt dizisi (sırayla tüketilir). embed: (texts) => vectors | throws.
 */
export function fakeLlm(handlers = {}) {
  const calls = [];
  const counters = {};
  const llm = {
    calls,
    async chat(role, req) {
      counters[role] = (counters[role] ?? 0) + 1;
      const n = counters[role];
      calls.push({ role, messages: req.messages, n });
      const h = handlers[role];
      if (h === undefined) throw new Error(`fakeLlm: '${role}' için yanıt tanımlı değil`);
      // fonksiyon → (req, n); dizi → sırayla; düz nesne → her çağrıda aynı yanıt
      const out = typeof h === 'function' ? await h(req, n) : Array.isArray(h) ? h[n - 1] : h;
      if (out === undefined) throw new Error(`fakeLlm: '${role}' için ${n}. yanıt yok`);
      if (out instanceof Error) throw out;
      return {
        json: out,
        text: JSON.stringify(out),
        provider: 'fake',
        model: `fake-${role}`,
        usage: { inputTokens: 1, outputTokens: 1 },
      };
    },
    async embed(texts) {
      calls.push({ role: 'embedding', texts });
      const list = Array.isArray(texts) ? texts : [texts];
      if (handlers.embed) {
        const out = await handlers.embed(list);
        if (out instanceof Error) throw out;
        return { vectors: out, provider: 'fake', model: 'fake-embed' };
      }
      return { vectors: list.map(bowEmbed), provider: 'fake', model: 'fake-embed' };
    },
  };
  llm.count = (role) => calls.filter((c) => c.role === role).length;
  return llm;
}

export function userContent(req) {
  return req.messages
    .filter((m) => m.role === 'user')
    .map((m) => m.content)
    .join('\n');
}

/** Puanlayıcı isteğindeki "1 [en] kanca" satırlarını { id, hook } olarak ayırır. */
export function parseScoreRequest(req) {
  const first = req.messages.find((m) => m.role === 'user').content;
  return first
    .split('\n')
    .slice(1)
    .map((line) => {
      const m = line.match(/^(\d+) \[(\w+)\] (.*)$/);
      return { id: Number(m[1]), lang: m[2], hook: m[3] };
    });
}

/** Wikipedia action=parse yanıtı gibi HTML. */
export function articleHtml(paragraphs) {
  return `<div class="mw-parser-output"><table class="infobox"><tr><td><p>Infobox text that should be ignored entirely here.</p></td></tr></table>${paragraphs
    .map((p, i) =>
      i === 1 ? `<h2>Section</h2><p>${p}<sup class="reference">[1]</sup></p>` : `<p>${p}</p>`,
    )
    .join('\n')}</div>`;
}

/**
 * Sahte fetch: pages = { 'Başlık': [paragraflar] }. Olmayan sayfa → missingtitle.
 */
export function fakeWikiFetch(pages, { fail } = {}) {
  const calls = [];
  const fn = async (url, init = {}) => {
    calls.push({ url: String(url), headers: init.headers ?? {} });
    if (fail) throw new Error('ağ hatası (sahte)');
    const page = new URL(url).searchParams.get('page').replace(/ /g, '_');
    const body = pages[page]
      ? { parse: { title: page, text: articleHtml(pages[page]) } }
      : { error: { code: 'missingtitle', info: "The page you specified doesn't exist." } };
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  fn.calls = calls;
  return fn;
}

export function baseCandidate(over = {}) {
  return {
    source_key: `enwiki-dyk:test:${over.id ?? 'x'}`,
    source: 'enwiki_dyk',
    lang: 'en',
    hook_text: 'the octopus has three hearts and blue blood',
    hook_hash: 'h',
    source_url: 'https://en.wikipedia.org/wiki/Octopus',
    source_meta: {},
    ...over,
  };
}

export const GOOD_CARD = Object.freeze({
  title: 'Ahtapotun tam üç kalbi var',
  content:
    'Ahtapotun vücudunda üç ayrı kalp çalışır. İkisi kanı solungaçlara pompalar. Üçüncüsü kanı bütün vücuda gönderir. Kanı bakır taşıyan bir protein yüzünden mavi görünür.',
  tags: ['ahtapot', 'biyoloji', 'deniz'],
  read_time_sq: 20,
});

export function deps(extra = {}) {
  return { config: TEST_CONFIG, now: FIXED_NOW, log: () => {}, ...extra };
}
