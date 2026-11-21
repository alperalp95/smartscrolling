import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryStepsRepo } from '../../db/steps-repo.js';
import { checkWriteRules, countSentences, hasTurkishChars, normalizeDraft, runWrite } from '../write.js';
import { GOOD_CARD, baseCandidate, deps, exhausted, fakeLlm, userContent } from './helpers.js';

const SUPPORT = 'An octopus has three hearts. Its blood is blue because of a copper-rich protein.';

function repoWith(over = {}) {
  return createMemoryStepsRepo({
    candidates: [baseCandidate({ id: 'w1', status: 'scored', support_paragraph: SUPPORT, scores: { category: '🔬 BİLİM', wow: 8 }, ...over })],
  });
}

test('countSentences: kısaltma ve baş harf cümle bitirmez', () => {
  assert.equal(countSentences('Bir. İki! Üç?'), 3);
  assert.equal(countSentences('Kent M.Ö. 500 yılında kuruldu. J. Smith burayı gezdi. Son cümle'), 3);
  assert.equal(countSentences('Sayı 3.5 kat büyüktü. Bitti.'), 2);
});

test('checkWriteRules: başlık uzunluğu, nedir/kimdir, 2-4 cümle, Türkçe karakter', () => {
  assert.deepEqual(checkWriteRules(GOOD_CARD), []);
  const v = checkWriteRules({ title: 'Ahtapot nedir?', content: 'Octopus is an animal. It lives in the sea. It has eight arms. Its blood is blue. It is smart.' });
  assert.equal(v.length, 3);
  assert.ok(v.some((x) => x.includes('nedir')));
  assert.ok(v.some((x) => x.includes('cümle')));
  assert.ok(v.some((x) => x.includes('Türkçe')));
  assert.ok(checkWriteRules({ ...GOOD_CARD, title: 'Kısa' })[0].includes('başlık'));
  assert.ok(checkWriteRules({ ...GOOD_CARD, title: 'x'.repeat(59) })[0].includes('başlık'));
  assert.deepEqual(checkWriteRules({ ...GOOD_CARD, title: 'Kimdir bu gizemli kâşif?' }).length, 1);
  assert.equal(hasTurkishChars('İstanbul'), true);
  assert.equal(hasTurkishChars('Istanbul'), false);
});

test('normalizeDraft: etiketler küçük harf/tekrarsız/en fazla 5, okuma süresi tahmini', () => {
  const d = normalizeDraft({ title: ' T ', content: 'a b c', tags: ['Uzay', 'uzay', '#Bilim', 'a', 'b', 'c', 'd'], read_time_sq: 'x' });
  assert.deepEqual(d.tags, ['uzay', 'bilim', 'a', 'b', 'c']);
  assert.equal(d.read_time_sq, 10);
});

test('runWrite: geçerli kart → written, taslak scores.draft içinde', async () => {
  const repo = repoWith();
  const llm = fakeLlm({ writer: [GOOD_CARD] });
  const stats = await runWrite(deps({ llm, repo }));
  const c = repo.get('w1');
  assert.equal(c.status, 'written');
  assert.equal(c.scores.draft.title, GOOD_CARD.title);
  assert.equal(c.scores.draft.rewrites, 0);
  assert.equal(c.scores.category, '🔬 BİLİM');
  assert.equal(stats.advanced, 1);
  const u = userContent({ messages: llm.calls[0].messages });
  assert.ok(u.includes('Kategori: 🔬 BİLİM') && u.includes(SUPPORT) && u.includes('three hearts'));
});

test('runWrite: kural ihlali → tek yeniden yazım (ihlal prompt\'ta) → written', async () => {
  const repo = repoWith();
  const llm = fakeLlm({ writer: [{ ...GOOD_CARD, title: 'Ahtapot kimdir' }, GOOD_CARD] });
  await runWrite(deps({ llm, repo }));
  assert.equal(llm.count('writer'), 2);
  const retry = llm.calls[1].messages;
  assert.equal(retry.at(-2).role, 'assistant');
  assert.ok(retry.at(-1).content.includes('kimdir'));
  assert.equal(repo.get('w1').status, 'written');
  assert.equal(repo.get('w1').scores.draft.rewrites, 1);
});

test('runWrite: ikinci ihlal → rejected:write_rules (üçüncü çağrı yok)', async () => {
  const repo = repoWith();
  const bad = { ...GOOD_CARD, content: 'Tek cümle var.' };
  const llm = fakeLlm({ writer: [bad, bad, GOOD_CARD] });
  await runWrite(deps({ llm, repo }));
  assert.equal(llm.count('writer'), 2);
  assert.equal(repo.get('w1').reject_reason, 'write_rules');
  assert.ok(repo.get('w1').scores.write_violations[0].includes('cümle'));
});

test('runWrite: skip:true → rejected:writer_skip, yeniden deneme yok', async () => {
  const repo = repoWith();
  const llm = fakeLlm({ writer: [{ skip: true, reason: 'kanca kaynakta yok' }, GOOD_CARD] });
  await runWrite(deps({ llm, repo }));
  assert.equal(llm.count('writer'), 1);
  assert.equal(repo.get('w1').reject_reason, 'writer_skip');
  assert.equal(repo.get('w1').scores.writer_skip, 'kanca kaynakta yok');
});

test('runWrite: destek paragrafı olmayan scored adayı almaz', async () => {
  const repo = repoWith({ support_paragraph: null });
  const llm = fakeLlm({ writer: [GOOD_CARD] });
  await runWrite(deps({ llm, repo }));
  assert.equal(llm.count('writer'), 0);
  assert.equal(repo.get('w1').status, 'scored');
});

test('attempts ≥ 3 → rejected:max_attempts', async () => {
  const repo = repoWith({ attempts: 2 });
  const llm = fakeLlm({ writer: () => new Error('beklenmeyen hata') });
  const stats = await runWrite(deps({ llm, repo }));
  assert.equal(repo.get('w1').status, 'rejected');
  assert.equal(repo.get('w1').reject_reason, 'max_attempts');
  assert.equal(repo.get('w1').attempts, 3);
  assert.equal(stats.rejected.max_attempts, 1);

  const repo2 = repoWith({ attempts: 0 });
  await runWrite(deps({ llm: fakeLlm({ writer: () => new Error('x') }), repo: repo2 }));
  assert.equal(repo2.get('w1').status, 'scored');
  assert.equal(repo2.get('w1').attempts, 1);
});

test('runWrite: LlmExhaustedError → deferred, aday scored kalır, attempts değişmez', async () => {
  const repo = createMemoryStepsRepo({
    candidates: ['a', 'b', 'c'].map((id) =>
      baseCandidate({ id, source_key: id, status: 'scored', support_paragraph: SUPPORT, scores: { category: '🔬 BİLİM' } }),
    ),
  });
  const llm = fakeLlm({ writer: (req, n) => (n === 1 ? GOOD_CARD : exhausted('writer')) });
  const stats = await runWrite(deps({ llm, repo }));
  assert.equal(stats.advanced, 1);
  assert.equal(stats.deferred, 2);
  assert.equal(llm.count('writer'), 2);
  assert.equal(repo.get('b').status, 'scored');
  assert.equal(repo.get('b').attempts, 0);
  assert.equal(repo.get('c').status, 'scored');
});

test('checkWriteRules: ilk cümle başlığı tekrar ederse ihlal (V2-05g)', () => {
  const title = 'Kiryū Yūyū dergisi 27 sayı yasaklandı';
  const echo = checkWriteRules({ title, content: 'Kiryū Yūyū dergisi 27 sayı yasaklandı. Yasak 1933 yılında başladı ve yıllarca sürdü.' });
  assert.ok(echo.some((x) => x.includes('başlığı tekrar')));
  const contained = checkWriteRules({ title, content: "Japonya'da Kiryū Yūyū dergisi 27 sayı yasaklandı, ışık görmedi. Yasak yıllarca sürdü." });
  assert.ok(contained.some((x) => x.includes('başlığı tekrar')));
  const fine = checkWriteRules({ title, content: 'Kiryū Yūyū dergisini Japon yetkililer sansürledi. Yasak 1933 yılında başladı ve yıllarca sürdü.' });
  assert.ok(!fine.some((x) => x.includes('başlığı tekrar')));
});

test('runWrite: ilk cümle = başlık → tek yeniden yazım', async () => {
  const repo = repoWith();
  const echo = { ...GOOD_CARD, content: 'Ahtapotun tam üç kalbi var. İkisi kanı solungaçlara pompalar.' };
  const llm = fakeLlm({ writer: [echo, GOOD_CARD] });
  await runWrite(deps({ llm, repo }));
  assert.equal(llm.count('writer'), 2);
  assert.equal(repo.get('w1').status, 'written');
});
