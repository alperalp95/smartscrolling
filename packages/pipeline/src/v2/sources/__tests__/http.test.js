import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHttpClient, mediawikiApi, USER_AGENT } from '../http.js';

function response(status, body = {}) {
  return { ok: status >= 200 && status < 300, status, headers: new Map(), json: async () => body, text: async () => '' };
}

function harness(statuses) {
  const sleeps = [];
  const requests = [];
  let clock = 0;
  const http = createHttpClient({
    fetchImpl: async (url, init) => {
      requests.push({ url, init });
      const status = statuses.shift();
      if (status === 'network') throw new Error('ECONNRESET');
      return response(status, { ok: true });
    },
    sleep: async (ms) => {
      sleeps.push(ms);
      clock += ms;
    },
    now: () => clock,
  });
  return { http, sleeps, requests };
}

test('http: User-Agent başlığı (kişisel bilgi yok) ve istekler arası ≥200 ms', async () => {
  const { http, sleeps, requests } = harness([200, 200]);
  await http.getJson('https://example.test/a');
  await http.getJson('https://example.test/b');
  assert.equal(requests[0].init.headers['User-Agent'], USER_AGENT);
  assert.equal(USER_AGENT, 'content-pipeline/2.0 (educational fact app)');
  assert.doesNotMatch(USER_AGENT, /@/);
  assert.deepEqual(sleeps, [200]);
});

test('http: 429/5xx ve ağ hatasında üstel bekleme ile yeniden dener', async () => {
  const { http, sleeps, requests } = harness([429, 'network', 200]);
  assert.deepEqual(await http.getJson('https://example.test/x'), { ok: true });
  assert.equal(requests.length, 3);
  assert.deepEqual(
    sleeps.filter((ms) => ms >= 1000),
    [1000, 2000],
  );
});

test('http: en fazla 3 deneme, sonra hata; 404 yeniden denenmez', async () => {
  const failing = harness([503, 503, 503, 200]);
  await assert.rejects(failing.http.getJson('https://example.test/x'), /HTTP 503/);
  assert.equal(failing.requests.length, 3);

  const missing = harness([404]);
  await assert.rejects(missing.http.getJson('https://example.test/x'), /HTTP 404/);
  assert.equal(missing.requests.length, 1);
});

test('mediawikiApi: format=json&formatversion=2 ekler, API hatasında fırlatır', async () => {
  const urls = [];
  const http = {
    async getJson(url) {
      urls.push(new URL(String(url)));
      return url.searchParams.get('page') === 'Missing' ? { error: { code: 'missingtitle', info: 'nope' } } : { ok: 1 };
    },
  };
  assert.deepEqual(await mediawikiApi(http, 'en.wikipedia.org', { action: 'parse', page: 'X' }), { ok: 1 });
  assert.equal(urls[0].searchParams.get('format'), 'json');
  assert.equal(urls[0].searchParams.get('formatversion'), '2');
  await assert.rejects(mediawikiApi(http, 'en.wikipedia.org', { action: 'parse', page: 'Missing' }), /missingtitle/);
});
