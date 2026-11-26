import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deriveFactVisualKey } from '../fact-visual-key.js';

function keyFor(over) {
  return deriveFactVisualKey({
    sourceLabel: 'Test kaynak',
    category: '',
    title: '',
    tags: [],
    sourceTitle: '',
    content: '',
    ...over,
  });
}

test('matematik kartı (BİLİM) "cetvel" içindeki "et" yüzünden science-food dönmez', () => {
  const key = keyFor({
    category: 'BİLİM',
    title: 'Küpün kenar uzunluğu',
    content:
      'Küpün kenar uzunluğu verildiğinde pergel ve cetvel ile yapılan çizimle hacmi bulunur.',
  });
  assert.notEqual(key, 'science-food');
});

test('Kuğulu Park kartı (TARİH) "belediyesi" ve "etti" yüzünden science-food dönmez', () => {
  const key = keyFor({
    category: 'TARİH',
    title: 'İlk beyaz kuğular',
    content:
      "İlk beyaz kuğular, 1975'te Viyana Belediyesi tarafından getirildi. Vedat Dalokay kara kuğular için bir park planı etti.",
  });
  assert.notEqual(key, 'science-food');
});

test('gerçek yemek metni ("Et ve süt ürünleri") hâlâ science-food döner', () => {
  const key = keyFor({
    category: 'BİLİM',
    title: 'Beslenme',
    content: 'Et ve süt ürünleri besin açısından zengindir.',
  });
  assert.equal(key, 'science-food');
});

test('kısa anahtar kelime tek başına bir kelime olarak geçince eşleşir ("tuz")', () => {
  const key = keyFor({
    category: 'BİLİM',
    title: 'Mutfak bilgisi',
    content: 'Yemeğe tuz eklemek lezzeti artırır.',
  });
  assert.equal(key, 'science-food');
});

test('uzun anahtar kelimenin Türkçe eki varsa eşleşir ("yemekler")', () => {
  const key = keyFor({
    category: 'BİLİM',
    title: 'Yemekler',
    content: 'Geleneksel yemekler bölgeden bölgeye değişir.',
  });
  assert.equal(key, 'science-food');
});

test('kelime ortasındaki eşleşme sayılmaz ("yemek" içinde "ayemek" gibi)', () => {
  const key = keyFor({
    category: 'BİLİM',
    title: 'Deneme',
    content: 'Bu metinde ayemekli bir kelime geçiyor.',
  });
  assert.notEqual(key, 'science-food');
});

test('çok kelimeli anahtar ("su alti") kelime sınırında eşleşmeye devam eder', () => {
  const key = keyFor({
    category: 'BİLİM',
    title: 'Deniz canlıları',
    content: 'Bazı canlılar su altında yaşar ve akvaryumda izlenir.',
  });
  assert.equal(key, 'science-ocean');
});
