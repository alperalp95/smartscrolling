import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pickCommonsImage, resolveWikiImage } from '../wiki-image.js';

const COMMONS =
  'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Octopus.jpg/330px-Octopus.jpg';

test('pickCommonsImage: commons thumbnail 640px olur', () => {
  assert.equal(
    pickCommonsImage({ thumbnail: { source: COMMONS } }),
    'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Octopus.jpg/640px-Octopus.jpg',
  );
});

test('pickCommonsImage: yerel (tr) dosya null', () => {
  const src = 'https://upload.wikimedia.org/wikipedia/tr/thumb/a/ab/Logo.png/330px-Logo.png';
  assert.equal(pickCommonsImage({ thumbnail: { source: src } }), null);
});

test('pickCommonsImage: tif null', () => {
  const src = 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Map.tif';
  assert.equal(pickCommonsImage({ originalimage: { source: src } }), null);
});

test('pickCommonsImage: Casualties dosya adı null', () => {
  const src = 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Casualties_of_war.jpg';
  assert.equal(pickCommonsImage({ thumbnail: { source: src } }), null);
});

test('pickCommonsImage: thumbnail yok, original var', () => {
  const src = 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Octopus.jpg';
  assert.equal(pickCommonsImage({ originalimage: { source: src } }), src);
});

test('pickCommonsImage: boş girdi null', () => {
  assert.equal(pickCommonsImage(null), null);
  assert.equal(pickCommonsImage({}), null);
});

function fakeFetch(handler) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url, init });
    return handler(url, init);
  };
  fn.calls = calls;
  return fn;
}

test('resolveWikiImage: tr URL doğru summary adresi + User-Agent', async () => {
  const f = fakeFetch(async () => ({
    ok: true,
    json: async () => ({ thumbnail: { source: COMMONS } }),
  }));
  const out = await resolveWikiImage('https://tr.wikipedia.org/wiki/Ahtapot', {
    fetchImpl: f,
  });
  assert.match(out, /640px-Octopus\.jpg$/);
  assert.equal(f.calls[0].url, 'https://tr.wikipedia.org/api/rest_v1/page/summary/Ahtapot');
  assert.match(f.calls[0].init.headers['User-Agent'], /SmartScrolling/);
});

test('resolveWikiImage: başlıktaki yüzde kodlaması çift kodlanmaz', async () => {
  const f = fakeFetch(async () => ({ ok: true, json: async () => ({}) }));
  await resolveWikiImage('https://tr.wikipedia.org/wiki/%C4%B0stanbul', { fetchImpl: f });
  assert.equal(
    f.calls[0].url,
    'https://tr.wikipedia.org/api/rest_v1/page/summary/%C4%B0stanbul',
  );
});

test('resolveWikiImage: en URL', async () => {
  const f = fakeFetch(async () => ({ ok: true, json: async () => ({}) }));
  assert.equal(
    await resolveWikiImage('https://en.wikipedia.org/wiki/Octopus', { fetchImpl: f }),
    null,
  );
  assert.equal(f.calls[0].url, 'https://en.wikipedia.org/api/rest_v1/page/summary/Octopus');
});

test('resolveWikiImage: 404 null', async () => {
  const f = fakeFetch(async () => ({ ok: false, status: 404 }));
  assert.equal(await resolveWikiImage('https://en.wikipedia.org/wiki/X', { fetchImpl: f }), null);
});

test('resolveWikiImage: fetch fırlatırsa null', async () => {
  const f = fakeFetch(async () => {
    throw new Error('ağ yok');
  });
  assert.equal(await resolveWikiImage('https://en.wikipedia.org/wiki/X', { fetchImpl: f }), null);
});

test('resolveWikiImage: wikipedia olmayan URL null, fetch çağrılmaz', async () => {
  const f = fakeFetch(async () => ({ ok: true, json: async () => ({}) }));
  assert.equal(await resolveWikiImage('https://example.com/a', { fetchImpl: f }), null);
  assert.equal(f.calls.length, 0);
});
