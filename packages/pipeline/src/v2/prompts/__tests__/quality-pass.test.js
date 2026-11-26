import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { SCORE_SYSTEM_PROMPT } from '../score.js';
import { WRITE_SYSTEM_PROMPT } from '../write.js';

const fixture = JSON.parse(
  readFileSync(new URL('../../__fixtures__/editorial-2026-11-26.json', import.meta.url), 'utf8'),
);

test('score istemi: tarihten bağımsız hassas maddeler istemde geçer', () => {
  for (const s of [
    'çok ölümlü kaza',
    'Etnik/dinî gruba yönelik şiddet',
    'öldürme anlatısı',
    'insan ölümlerinin konunun merkezinde',
    'Dinî metinlerin kökeni',
    'ölüm kültleri',
    'Silahlar, kürtaj',
    'İsrail-Filistin',
    'Çocuk yaşta evlilik',
    'siyasi itham',
  ]) {
    assert.ok(SCORE_SYSTEM_PROMPT.includes(s), `eksik: ${s}`);
  }
});

test('score istemi: hayvan ölümü ve uzak tarih tek başına hassas değil', () => {
  assert.match(SCORE_SYSTEM_PROMPT, /Hayvan ölümü.*uzak tarih.*hassas değil/s);
});

test('score istemi: eski "tarihsel olay hassas değil" istisnası kaldırıldı', () => {
  assert.doesNotMatch(SCORE_SYSTEM_PROMPT, /Tarihsel olay tek başına hassas değil/);
});

test('score istemi: kategori ipuçları', () => {
  assert.match(SCORE_SYSTEM_PROMPT, /dizi\/TV\/film\/roman\/öykü\/şiir\/opera → SANAT/);
  assert.match(SCORE_SYSTEM_PROMPT, /hayvan\/bitki → BİLİM/);
  assert.match(SCORE_SYSTEM_PROMPT, /asla SAĞLIK/);
  assert.match(SCORE_SYSTEM_PROMPT, /matematik → BİLİM/);
  assert.match(SCORE_SYSTEM_PROMPT, /sporcu.*→ SPOR/);
});

test('score istemi: çıktı alanı x ve şema değişmedi', () => {
  assert.match(SCORE_SYSTEM_PROMPT, /"x":1/);
  assert.match(SCORE_SYSTEM_PROMPT, /\{"items":\[\{"i":1,"s":3,"r":5,"d":0,"c":/);
});

test('write istemi: sözlük girdileri', () => {
  for (const s of [
    'junglefowl → orman tavuğu',
    'home run → sayı turu (home run)',
    'horn (çalgı) → korno',
    "Joan of Arc → Jeanne d'Arc",
    'urban myth → şehir efsanesi',
    'backronym → kullanma',
    'rupee → rupi',
    'incriminate → kendi aleyhine tanıklık etmek',
  ]) {
    assert.ok(WRITE_SYSTEM_PROMPT.includes(s), `eksik: ${s}`);
  }
});

test('write istemi: başlık tutarlılık kuralı, ad kuralı, sayı ve ek yazımı', () => {
  assert.match(WRITE_SYSTEM_PROMPT, /dilbilgisi olarak tam bir cümle ya da düzgün bir isim öbeği/i);
  assert.match(WRITE_SYSTEM_PROMPT, /metinle çelişmez/);
  assert.match(WRITE_SYSTEM_PROMPT, /ilk cümlede geçer/);
  assert.match(WRITE_SYSTEM_PROMPT, /"şair", "şarkı"/);
  assert.match(WRITE_SYSTEM_PROMPT, /binlik ayırıcı nokta \(18\.000\), ondalık virgül/);
  assert.match(WRITE_SYSTEM_PROMPT, /Santa Muerte'ye/);
});

test('write istemi: yeni kural başlığın "yüklemli" kuralıyla çelişmez (isim öbeği izinli)', () => {
  assert.doesNotMatch(WRITE_SYSTEM_PROMPT, /sadece isim tamlaması değil/);
});

test('fixture: 64 kayıt, geçerli verdict ve reason', () => {
  assert.equal(fixture.length, 64);
  const ok = new Set(['Y', 'K', 'D', 'Ç']);
  for (const r of fixture) {
    assert.ok(ok.has(r.verdict), `geçersiz verdict #${r.n}`);
    assert.ok(typeof r.reason === 'string' && r.reason.length > 0);
    assert.ok('id8' in r);
  }
  assert.equal(new Set(fixture.map((r) => r.n)).size, 64);
  assert.equal(fixture.filter((r) => r.verdict === 'Ç').length, 18);
  assert.equal(fixture.filter((r) => r.verdict === 'D').length, 30);
});
