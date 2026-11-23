import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  collectEnwikiLists,
  MISCONCEPTIONS_FALLBACK_PAGES,
  parseMisconceptionsHtml,
  parseUnusualWikitext,
  pickMisconceptionSubpages,
  pickUnusualSubpages,
} from '../enwiki-lists.js';
import { fakeHttp, fixture } from './helpers.js';

const misHtml = fixture('misconceptions.html');
const unusualWt = fixture('unusual.wikitext');
const MIS_PAGE = 'List of common misconceptions about history';

test('S4 misconceptions: üst düzey maddeler, ilk 1–2 cümle, ilk makale linki', () => {
  const { candidates, skipped } = parseMisconceptionsHtml(misHtml, MIS_PAGE);
  assert.equal(skipped, 1); // "Short."
  assert.deepEqual(
    candidates.map((c) => c.source_key),
    [
      'enwiki-misconceptions:history:ancient-history:0',
      'enwiki-misconceptions:history:ancient-history:1',
      'enwiki-misconceptions:history:ancient-rome:0',
    ],
  );
  const [pyramids, tut, salute] = candidates;
  assert.equal(pyramids.source, 'enwiki_misconceptions');
  assert.equal(
    pyramids.hook_text,
    'The Pyramids of Egypt were not constructed with slave labor. Archaeological evidence shows that the laborers were skilled workers and poor farmers.',
  );
  assert.equal(pyramids.source_url, 'https://en.wikipedia.org/wiki/Egyptian_pyramids');
  // iç içe alt madde ve [citation needed] girmez; "U.S." cümleyi bölmez
  assert.equal(
    tut.hook_text,
    "Tutankhamun's tomb is not inscribed with a curse. This was a media invention of 20th-century U.S. tabloid journalists.",
  );
  assert.equal(salute.source_url, 'https://en.wikipedia.org/wiki/Roman_salute');
  assert.equal(salute.source_meta.page, MIS_PAGE);
});

test('S4 misconceptions: içindekiler, görsel altyazısı, tablo ve References sonrası atlanır; deterministik', () => {
  const { candidates } = parseMisconceptionsHtml(misHtml, MIS_PAGE);
  const text = candidates.map((c) => c.hook_text).join(' ');
  assert.doesNotMatch(text, /caption|Table list|See also|Harvard|nested/i);
  assert.deepEqual(parseMisconceptionsHtml(misHtml, MIS_PAGE), { candidates, skipped: 1 });
});

test('S4 misconceptions: alt liste sayfaları dizin linklerinden seçilir', () => {
  const links = [
    { ns: 0, title: 'List of common misconceptions about history', exists: true },
    { ns: 0, title: 'List of common misconceptions about arts and culture', exists: true },
    { ns: 0, title: 'Misconception', exists: true },
    { ns: 4, title: 'Wikipedia:Featured lists', exists: true },
  ];
  assert.deepEqual(pickMisconceptionSubpages(links), [
    'List of common misconceptions about arts and culture',
    'List of common misconceptions about history',
  ]);
  assert.deepEqual(pickMisconceptionSubpages([]), MISCONCEPTIONS_FALLBACK_PAGES);
});

test('S4 unusual: makale adı + kısa açıklama; öznitelik, şablon, ref, çok satırlı hücre', () => {
  const { candidates, skipped } = parseUnusualWikitext(unusualWt, 'Wikipedia:Unusual articles/Food');
  assert.equal(skipped, 2); // kategori satırı + tekrar eden makale
  assert.deepEqual(
    candidates.map((c) => c.source_key),
    ['enwiki-unusual:Ant_egg_soup', 'enwiki-unusual:Bacon_Explosion', 'enwiki-unusual:Balut_(food)', 'enwiki-unusual:Casu_martzu'],
  );
  const [ant, bacon, balut, casu] = candidates;
  assert.equal(ant.source, 'enwiki_unusual');
  assert.equal(ant.hook_text, 'Ant egg soup — A nostalgic soup with a "distinctive, sour pop".');
  assert.equal(ant.source_url, 'https://en.wikipedia.org/wiki/Ant_egg_soup');
  assert.equal(bacon.hook_text, 'Bacon Explosion — Not as dangerous as it sounds.');
  assert.equal(balut.hook_text, "Balut — Eggs for eating don't have bird embryos inside... except when they do.");
  assert.equal(balut.source_url, 'https://en.wikipedia.org/wiki/Balut_(food)');
  assert.equal(
    casu.hook_text,
    'Casu martzu — Italian "maggot cheese" – cheese designed to be eaten while it is infested with cheese fly larvae.',
  );
  assert.equal(ant.source_meta.section, 'Food');
});

test('S4 unusual: alt sayfa adları ana sayfadan, makale dışı alt sayfalar hariç', () => {
  const wt = '{{/Food}}\n\n{{/History}}\n{{/Categories}}\n{{/Other pages}}\n{{Some template}}';
  assert.deepEqual(pickUnusualSubpages(wt), ['Wikipedia:Unusual articles/Food', 'Wikipedia:Unusual articles/History']);
});

test('S4 toplayıcı: limit iki liste arasında bölünür, ofset imleci döner', async () => {
  const http = fakeHttp((url) => {
    const action = url.searchParams.get('action');
    if (action === 'parse' && url.searchParams.get('prop') === 'links') {
      return { parse: { title: 'Lists of common misconceptions', links: [{ ns: 0, title: MIS_PAGE, exists: true }] } };
    }
    if (action === 'parse') return { parse: { title: url.searchParams.get('page'), text: misHtml } };
    const titles = url.searchParams.get('titles').split('|');
    return {
      query: {
        pages: titles.map((title) => ({
          title,
          revisions: [{ slots: { main: { content: title === 'Wikipedia:Unusual articles' ? '{{/Food}}' : unusualWt } } }],
        })),
      },
    };
  });
  const result = await collectEnwikiLists({ http, limit: 4, cursor: { misconceptionsOffset: 1, unusualOffset: 0 } });
  assert.deepEqual(
    result.candidates.map((c) => c.source_key),
    [
      'enwiki-misconceptions:history:ancient-history:1',
      'enwiki-misconceptions:history:ancient-rome:0',
      'enwiki-unusual:Ant_egg_soup',
      'enwiki-unusual:Bacon_Explosion',
    ],
  );
  assert.deepEqual(result.nextCursor, { misconceptionsOffset: 3, unusualOffset: 2 });
  assert.equal(result.stats.misconceptions_available, 3);
  assert.equal(result.stats.unusual_available, 4);

  // misconceptions bitince kalan limit unusual'a geçer
  const next = await collectEnwikiLists({ http, limit: 4, cursor: result.nextCursor });
  assert.deepEqual(next.candidates.map((c) => c.source), ['enwiki_unusual', 'enwiki_unusual']);
  assert.deepEqual(next.nextCursor, { misconceptionsOffset: 3, unusualOffset: 4 });
});
