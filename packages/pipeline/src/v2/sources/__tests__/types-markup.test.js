import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contentHash } from '../../../dedup/index.js';
import { cleanHookText, isUsableHook, makeCandidate } from '../types.js';
import { firstSentences, htmlToText, wikiUrl, wikitextToText } from '../markup.js';

test('cleanHookText: "... that" kalıbının farklı yazımları temizlenir', () => {
  assert.equal(cleanHookText('... that cats can purr?'), 'cats can purr');
  assert.equal(cleanHookText('...that cats can purr?'), 'cats can purr');
  assert.equal(cleanHookText('… that cats can purr ?'), 'cats can purr');
  assert.equal(cleanHookText('Did you know ... that cats can purr?'), 'cats can purr');
  // "that" ortada geçiyorsa dokunulmaz
  assert.equal(cleanHookText('... that the song "That Thing" was a hit?'), 'the song "That Thing" was a hit');
});

test('cleanHookText: (pictured) notları ve noktalama öncesi boşluk silinir', () => {
  assert.equal(
    cleanHookText('... that the bridge (pictured) was built twice , once by mistake ?'),
    'the bridge was built twice, once by mistake',
  );
  assert.equal(cleanHookText('... that a series (volume pictured) exists?'), 'a series exists');
});

test('cleanHookText: TR "...ki" kalıbı temizlenir', () => {
  assert.equal(cleanHookText('...ki Türkiye’de ezan Türkçe okunmuştur?', 'tr'), 'Türkiye’de ezan Türkçe okunmuştur');
  assert.equal(cleanHookText('... ki kediler mırlar?', 'tr'), 'kediler mırlar');
  assert.equal(cleanHookText('Kedi kimi zaman mırlar.', 'tr'), 'Kedi kimi zaman mırlar.');
});

test('makeCandidate: hook_hash = contentHash(hook_text)', () => {
  const c = makeCandidate({ source_key: 'k', source: 'enwiki_dyk', lang: 'en', hook_text: 'cats can purr loudly at night' });
  assert.equal(c.hook_hash, contentHash('cats can purr loudly at night'));
  assert.deepEqual(Object.keys(c).sort(), ['hook_hash', 'hook_text', 'lang', 'source', 'source_key', 'source_meta', 'source_url']);
  assert.equal(c.source_url, null);
});

test('isUsableHook: boş, çok kısa ve işaretleme kalıntılı metinler reddedilir', () => {
  assert.equal(isUsableHook(''), false);
  assert.equal(isUsableHook('too short'), false);
  assert.equal(isUsableHook('this has {{template}} residue in the text'), false);
  assert.equal(isUsableHook('this has <b>tag</b> residue in the text'), false);
  assert.equal(isUsableHook('cats can purr loudly at night'), true);
});

test('htmlToText: dipnotlar, citation needed, etiketler ve varlıklar temizlenir', () => {
  const html =
    'The <a href="/wiki/X">pyramids</a> were not built by slaves.<sup class="reference"><a href="#c">[2]</a></sup> It&#39;s true&nbsp;!<sup class="noprint Inline-Template"><i>[citation needed]</i></sup>';
  assert.equal(htmlToText(html), "The pyramids were not built by slaves. It's true!");
});

test('wikitextToText: link, kalın/italik, ref, şablon ve dosya işaretlemesi düz metne çevrilir', () => {
  const wt =
    "<div>[[Dosya:A.jpg|100px|Açıklama [[iç link|iç]]]]</div>'''[[Musa]]'''{{'}}nın ''adı'' [[kan iftirası|çocukların kanı]]<ref>x</ref>{{icon|GA}} ve [[Yahudiler]]in{{spaced ndash}}son.";
  assert.equal(wikitextToText(wt), "Musa'nın adı çocukların kanı ve Yahudilerin – son.");
  // italik kapanışından hemen sonra gelen kesme işareti korunur; kalın kapanışı ek almaz
  assert.equal(wikitextToText("dizisi ''[[Lost (dizi)|Lost]]'''un finali"), "dizisi Lost'un finali");
  assert.equal(wikitextToText("'''[[Galatasaray]]'''nın ilk"), 'Galatasaraynın ilk');
});

test('wikiUrl: aynı makale farklı yazımlarda aynı URL’yi verir', () => {
  const expected = "https://en.wikipedia.org/wiki/Well_he_would,_wouldn't_he%3F";
  assert.equal(wikiUrl('en', "Well_he_would,_wouldn't_he%3F"), expected);
  assert.equal(wikiUrl('en', '/wiki/Well_he_would,_wouldn%27t_he%3F'), expected);
  assert.equal(wikiUrl('en', "./Well_he_would,_wouldn't_he%3F"), expected);
  assert.equal(wikiUrl('en', "Well he would, wouldn't he?"), expected);
  assert.equal(wikiUrl('en', 'grade (climbing)#Alpine'), 'https://en.wikipedia.org/wiki/Grade_(climbing)');
  assert.equal(wikiUrl('tr', 'ilk Türk sporcu'), 'https://tr.wikipedia.org/wiki/%C4%B0lk_T%C3%BCrk_sporcu');
  assert.equal(wikiUrl('en', ''), null);
});

test('firstSentences: ilk iki cümle, kısaltmalar bölünmez', () => {
  const text = 'This was invented by U.S. tabloids. It spread in the 1920s. A third sentence.';
  assert.equal(firstSentences(text, 2), 'This was invented by U.S. tabloids. It spread in the 1920s.');
  assert.equal(firstSentences(text, 1), 'This was invented by U.S. tabloids.');
  assert.equal(firstSentences('Only one sentence here', 2), 'Only one sentence here');
});
