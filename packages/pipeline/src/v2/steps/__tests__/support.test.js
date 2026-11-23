import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createMemoryStepsRepo } from '../../db/steps-repo.js';
import {
  MAX_SUPPORT_CHARS,
  extractParagraphs,
  hookKeywords,
  parseWikiUrl,
  selectSupport,
} from '../support-parse.js';
import { USER_AGENT, buildParseUrl, runSupport } from '../support.js';
import { articleHtml, baseCandidate, deps, fakeWikiFetch } from './helpers.js';

const INTRO =
  'The giant squid is a species of deep-ocean dwelling squid in the family Architeuthidae.';
const BODY_FACT =
  'The giant squid has the largest eyes of any living animal, measuring up to 27 centimetres in diameter, which helps the squid detect sperm whales.';
const BODY_OTHER =
  'Giant squid feed on deep-sea fish and other squid species, catching prey with two long tentacles.';
const HOOK = 'the giant squid has the largest eyes of any animal';

test('extractParagraphs: <p> metni, referans/etiket/entity temizliği, infobox tablosu atlanır', () => {
  const html =
    '<table class="infobox"><tr><td><p>Bu infobox paragrafı alınmamalı, yeterince uzun bir metin.</p></td></tr></table>' +
    '<p>The <b>giant squid</b> &amp; its cousins live in the deep ocean, far below the surface.<sup class="reference"><a href="#c1">[1]</a></sup></p>' +
    '<p>Kısa.</p>' +
    '<style>.x{}</style><p>Second paragraph about squid&#39;s eyes [citation needed] and their size in the dark sea.</p>';
  assert.deepEqual(extractParagraphs(html), [
    'The giant squid & its cousins live in the deep ocean, far below the surface.',
    "Second paragraph about squid's eyes and their size in the dark sea.",
  ]);
});

test('hookKeywords: stopword ve "... that" atılır, sayılar korunur', () => {
  assert.deepEqual(hookKeywords('... that the giant squid has eyes 27 cm wide'), [
    'giant',
    'squid',
    'eyes',
    '27',
    'wide',
  ]);
});

test('selectSupport: anahtar kelime örtüşmesiyle gövde paragrafı seçilir, giriş değil', () => {
  const r = selectSupport([INTRO, BODY_FACT, BODY_OTHER], HOOK);
  assert.ok(r);
  assert.deepEqual(r.indexes, [1]);
  assert.equal(r.text, BODY_FACT);
});

test('selectSupport: örtüşen paragraf yoksa giriş paragrafına düşmez → null', () => {
  const r = selectSupport(
    [INTRO, BODY_OTHER],
    'the giant squid was first photographed alive in 2004 near Japan',
  );
  assert.equal(r, null);
});

test('selectSupport: en fazla 1.500 karakter, en çok 2 paragraf', () => {
  const long = `${BODY_FACT} ${'Squid eyes are large and the giant squid eyes are the largest. '.repeat(40)}`;
  const r = selectSupport([INTRO, long, BODY_FACT, BODY_FACT], HOOK);
  assert.ok(r.text.length <= MAX_SUPPORT_CHARS);
  assert.ok(r.indexes.length <= 2);
});

test('parseWikiUrl + buildParseUrl: action=parse&prop=text', () => {
  assert.deepEqual(
    parseWikiUrl('https://tr.wikipedia.org/wiki/Dev_m%C3%BCrekkep_bal%C4%B1%C4%9F%C4%B1'),
    {
      lang: 'tr',
      title: 'Dev mürekkep balığı',
    },
  );
  assert.equal(parseWikiUrl('https://example.com/wiki/X'), null);
  const url = new URL(buildParseUrl({ lang: 'en', title: 'Giant squid' }));
  assert.equal(url.hostname, 'en.wikipedia.org');
  assert.equal(url.searchParams.get('action'), 'parse');
  assert.equal(url.searchParams.get('prop'), 'text');
  assert.equal(url.searchParams.get('page'), 'Giant squid');
});

function scoredCand(over) {
  return baseCandidate({ status: 'scored', scores: { category: '🔬 BİLİM', wow: 8 }, ...over });
}

test('runSupport: paragrafı yazar, User-Agent gönderir; makale yoksa ya da örtüşme yoksa no_support', async () => {
  const repo = createMemoryStepsRepo({
    candidates: [
      scoredCand({
        id: 'ok',
        hook_text: HOOK,
        source_url: 'https://en.wikipedia.org/wiki/Giant_squid',
      }),
      scoredCand({
        id: 'nofact',
        hook_text: 'the giant squid was first photographed alive in 2004',
        source_url: 'https://en.wikipedia.org/wiki/Giant_squid',
      }),
      scoredCand({
        id: 'missing',
        hook_text: HOOK,
        source_url: 'https://en.wikipedia.org/wiki/No_such_page',
      }),
      scoredCand({ id: 'notwiki', hook_text: HOOK, source_url: 'https://example.com/a' }),
    ],
  });
  const fetch = fakeWikiFetch({ Giant_squid: [INTRO, BODY_FACT, BODY_OTHER] });
  const stats = await runSupport(deps({ repo, fetch }));

  assert.equal(repo.get('ok').status, 'scored');
  assert.equal(repo.get('ok').support_paragraph, BODY_FACT);
  assert.deepEqual(repo.get('ok').scores.support.paragraphs, [1]);
  assert.equal(repo.get('nofact').reject_reason, 'no_support');
  assert.equal(repo.get('missing').reject_reason, 'no_support');
  assert.equal(repo.get('notwiki').reject_reason, 'no_support');
  assert.equal(stats.advanced, 1);
  assert.equal(fetch.calls[0].headers['User-Agent'], USER_AGENT);
  assert.equal(USER_AGENT, 'content-pipeline/2.0 (educational fact app)');
});

test('runSupport: ağ hatası → attempts++, aday scored kalır', async () => {
  const repo = createMemoryStepsRepo({ candidates: [scoredCand({ id: 'a', hook_text: HOOK })] });
  const stats = await runSupport(
    deps({ repo, fetch: fakeWikiFetch({}, { fail: true }), sleep: async () => {} }),
  );
  assert.equal(repo.get('a').status, 'scored');
  assert.equal(repo.get('a').attempts, 1);
  assert.equal(repo.get('a').support_paragraph, null);
  assert.equal(stats.failed, 1);
});

test('articleHtml fixture referansı temizlenir', () => {
  const ps = extractParagraphs(articleHtml([INTRO, BODY_FACT]));
  assert.deepEqual(ps, [INTRO, BODY_FACT]);
});

test('runSupport: 429 → bekleyip tekrar dener (Retry-After), sonra başarır', async () => {
  const repo = createMemoryStepsRepo({
    candidates: [
      scoredCand({
        id: 'r1',
        hook_text: HOOK,
        source_url: 'https://en.wikipedia.org/wiki/Giant_squid',
      }),
    ],
  });
  const ok = fakeWikiFetch({ Giant_squid: [INTRO, BODY_FACT] });
  let n = 0;
  const fetch = async (url, init) => {
    n += 1;
    if (n <= 2) return new Response('slow down', { status: 429, headers: { 'retry-after': '2' } });
    return ok(url, init);
  };
  const sleeps = [];
  const stats = await runSupport(deps({ repo, fetch, sleep: async (ms) => sleeps.push(ms) }));
  assert.equal(n, 3);
  assert.equal(stats.advanced, 1);
  assert.ok(
    sleeps.some((ms) => ms >= 2000),
    'Retry-After kadar beklendi',
  );
});

test('runSupport: 3 denemeden sonra hâlâ 429 → hata, attempts++', async () => {
  const repo = createMemoryStepsRepo({
    candidates: [scoredCand({ id: 'r2', source_url: 'https://en.wikipedia.org/wiki/Giant_squid' })],
  });
  let n = 0;
  const fetch = async () => {
    n += 1;
    return new Response('x', { status: 429 });
  };
  const stats = await runSupport(deps({ repo, fetch, sleep: async () => {} }));
  assert.equal(n, 3);
  assert.equal(stats.failed, 1);
  assert.equal(repo.get('r2').attempts, 1);
  assert.equal(repo.get('r2').status, 'scored');
});
