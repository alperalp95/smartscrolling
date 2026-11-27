import assert from 'node:assert/strict';
import { test } from 'node:test';
import { splitIntoCards, summarizeSections } from '../split.js';
import { EXCLUDED_SECTIONS, filterSections, parseWikiExtract } from '../wiki-sections.js';

const norm = (s) => s.replace(/\s+/g, ' ').trim();

const EXTRACT = `Giriş cümlesi birinci. Giriş cümlesi ikinci.

== Tarih ==
Tarih metni burada.

=== Antik Çağ ===
Antik çağ metni.

== Kaynakça ==
Bir kaynak.

== Dış bağlantılar ==
Bir bağlantı.

== Boş ==

== Coğrafya ==
Coğrafya metni.`;

test('parseWikiExtract: ilk bölüm başlığı title, alt bölümler ayrı', () => {
  const s = parseWikiExtract(EXTRACT, 'Örnek');
  assert.equal(s[0].heading, 'Örnek');
  assert.equal(s[0].text, 'Giriş cümlesi birinci. Giriş cümlesi ikinci.');
  assert.deepEqual(
    s.map((x) => x.heading),
    ['Örnek', 'Tarih', 'Antik Çağ', 'Kaynakça', 'Dış bağlantılar', 'Coğrafya'],
  );
});

test('Kaynakça/Dış bağlantılar atılır, boş bölümler atılır', () => {
  const f = filterSections(parseWikiExtract(EXTRACT, 'Örnek'), null);
  assert.deepEqual(
    f.map((x) => x.heading),
    ['Örnek', 'Tarih', 'Antik Çağ', 'Coğrafya'],
  );
  assert.ok(EXCLUDED_SECTIONS.includes('kaynakça'));
});

test('wanted filtresi alt bölümleri kapsar', () => {
  const f = filterSections(parseWikiExtract(EXTRACT, 'Örnek'), ['Tarih']);
  assert.deepEqual(
    f.map((x) => x.heading),
    ['Tarih', 'Antik Çağ'],
  );
});

test('kartlar birleşince seçilen bölümlerin metni birebir', () => {
  const sections = filterSections(parseWikiExtract(EXTRACT, 'Örnek'), null);
  const cards = splitIntoCards(sections, { maxChars: 30 });
  assert.equal(
    norm(cards.map((c) => c.body).join(' ')),
    norm(sections.map((s) => s.text).join(' ')),
  );
  assert.deepEqual(
    cards.map((c) => c.position),
    cards.map((_, i) => i + 1),
  );
});

test('hiçbir kart maxChars aşmaz; uzun tek cümle bölünür, kelime kaybolmaz', () => {
  const long = `${Array.from({ length: 200 }, (_, i) => `kelime${i}`).join(' ')}.`;
  const cards = splitIntoCards([{ heading: 'A', text: long }], { maxChars: 100 });
  assert.ok(cards.length > 1);
  for (const c of cards) assert.ok(c.body.length <= 100);
  assert.equal(cards.map((c) => c.body).join(' '), long);
});

test('"M.Ö. 330" ve "1. Dünya Savaşı" ortasından bölünmez', () => {
  const text =
    'Büyük İskender M.Ö. 330 yılında geldi. Sonra 1. Dünya Savaşı çıktı. Dr. Ali vb. şeyler gördü.';
  for (const max of [40, 45, 50, 55, 60]) {
    const cards = splitIntoCards([{ heading: 'A', text }], { maxChars: max });
    for (const c of cards) {
      assert.ok(!/M\.Ö\.$/.test(c.body), `M.Ö. kesildi: ${c.body}`);
      assert.ok(!/(^|\s)1\.$/.test(c.body), `1. kesildi: ${c.body}`);
      assert.ok(!/(Dr|vb)\.$/.test(c.body), `kısaltma kesildi: ${c.body}`);
    }
    assert.equal(cards.map((c) => c.body).join(' '), text);
  }
});

test('40K karakter: kart sayısı ≈ toplam/maxChars, pozisyonlar ardışık', () => {
  const sentence = 'Bu bir deneme cümlesidir ve oldukça uzundur.';
  const text = Array.from({ length: 1000 }, () => sentence).join(' ');
  assert.ok(text.length > 40000);
  const cards = splitIntoCards([{ heading: 'A', text }], { maxChars: 600 });
  const expected = text.length / 600;
  assert.ok(cards.length >= expected && cards.length <= expected * 1.3);
  cards.forEach((c, i) => {
    assert.equal(c.position, i + 1);
  });
});

test('summarizeSections: başlık, ilk pozisyon, kart sayısı', () => {
  const cards = splitIntoCards(
    [
      { heading: 'A', text: 'Bir. İki. Üç.' },
      { heading: 'B', text: 'Dört.' },
    ],
    { maxChars: 6 },
  );
  const sum = summarizeSections(cards);
  assert.deepEqual(
    sum.map((s) => s.title),
    ['A', 'B'],
  );
  assert.equal(sum[0].firstPosition, 1);
  assert.equal(sum[0].cardCount + sum[1].cardCount, cards.length);
  assert.equal(sum[1].firstPosition, sum[0].cardCount + 1);
});
