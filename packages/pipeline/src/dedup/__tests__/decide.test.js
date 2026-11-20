import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decideDuplicate } from '../index.js';

const candidate = { sourceKey: 'enwiki-dyk:2019-03-14:3', text: 'Ahtapotun üç kalbi vardır.', embedding: [] };

function fakeJudge(answers) {
  const calls = [];
  const fn = async (pair) => {
    calls.push(pair);
    const next = typeof answers === 'function' ? answers(pair, calls.length) : answers;
    return next;
  };
  fn.calls = calls;
  return fn;
}

test('eşleşme yok → unique/no_match', async () => {
  const judge = fakeJudge({ sameFact: true });
  const res = await decideDuplicate({ candidate, matches: [], judge });
  assert.deepEqual(res, { verdict: 'unique', reason: 'no_match' });
  assert.equal(judge.calls.length, 0);
});

test('düşük benzerlik → unique/no_match, judge çağrılmaz', async () => {
  const judge = fakeJudge({ sameFact: true });
  const res = await decideDuplicate({
    candidate,
    matches: [{ kind: 'fact', id: 1, text: 'Kediler günde 16 saat uyur.', similarity: 0.4 }],
    judge,
  });
  assert.deepEqual(res, { verdict: 'unique', reason: 'no_match' });
  assert.equal(judge.calls.length, 0);
});

test('0.95 → duplicate/semantic ve judge çağrılmadı', async () => {
  const judge = fakeJudge({ sameFact: false });
  const res = await decideDuplicate({
    candidate,
    matches: [
      { kind: 'fact', id: 'b', text: 'Ahtapot üç kalbe sahiptir.', similarity: 0.88 },
      { kind: 'fact', id: 'a', text: 'Ahtapotların üç kalbi bulunur.', similarity: 0.95 },
    ],
    judge,
  });
  assert.deepEqual(res, { verdict: 'duplicate', reason: 'semantic', matchId: 'a', similarity: 0.95 });
  assert.equal(judge.calls.length, 0);
});

test('normalize-hash birebir → duplicate/exact_hash, judge çağrılmaz', async () => {
  const judge = fakeJudge({ sameFact: false });
  const res = await decideDuplicate({
    candidate,
    matches: [{ kind: 'candidate', id: 7, text: 'AHTAPOTUN ÜÇ KALBİ VARDIR', similarity: 0.86 }],
    judge,
  });
  assert.equal(res.verdict, 'duplicate');
  assert.equal(res.reason, 'exact_hash');
  assert.equal(res.matchId, 7);
  assert.equal(judge.calls.length, 0);
});

test('gray + judge sameFact=true → duplicate/judge_same_fact', async () => {
  const judge = fakeJudge({ sameFact: true, reason: 'aynı iddia' });
  const res = await decideDuplicate({
    candidate,
    matches: [{ kind: 'fact', id: 3, text: 'Octopuses have three hearts.', similarity: 0.9 }],
    judge,
  });
  assert.deepEqual(res, { verdict: 'duplicate', reason: 'judge_same_fact', matchId: 3, similarity: 0.9 });
  assert.equal(judge.calls.length, 1);
  assert.deepEqual(judge.calls[0], { a: candidate.text, b: 'Octopuses have three hearts.' });
});

test('gray + judge false → unique/judge_different_fact', async () => {
  const judge = fakeJudge({ sameFact: false, reason: 'farklı olgu' });
  const res = await decideDuplicate({
    candidate,
    matches: [{ kind: 'fact', id: 4, text: 'Ahtapotlar renk değiştirir.', similarity: 0.87 }],
    judge,
  });
  assert.equal(res.verdict, 'unique');
  assert.equal(res.reason, 'judge_different_fact');
  assert.equal(judge.calls.length, 1);
});

test('judge hata → duplicate/judge_error', async () => {
  const judge = async () => {
    throw new Error('rate limited');
  };
  const res = await decideDuplicate({
    candidate,
    matches: [{ kind: 'fact', id: 5, text: 'Ahtapotun kalpleri.', similarity: 0.88 }],
    judge,
  });
  assert.deepEqual(res, { verdict: 'duplicate', reason: 'judge_error', matchId: 5, similarity: 0.88 });
});

test("gray'de en fazla 3 judge çağrısı, benzerliği yüksekten düşüğe", async () => {
  const judge = fakeJudge({ sameFact: false });
  const matches = [0.86, 0.91, 0.855, 0.89, 0.9, 0.3].map((s, i) => ({
    kind: 'fact',
    id: `m${i}`,
    text: `metin ${i}`,
    similarity: s,
  }));
  const res = await decideDuplicate({ candidate, matches, judge });
  assert.equal(judge.calls.length, 3);
  assert.deepEqual(
    judge.calls.map((c) => c.b),
    ['metin 1', 'metin 4', 'metin 3'],
  );
  assert.equal(res.verdict, 'unique');
  assert.equal(res.reason, 'judge_different_fact');
});

test('gray: ikinci eşleşmede sameFact → durur ve duplicate', async () => {
  const judge = fakeJudge((_pair, n) => ({ sameFact: n === 2 }));
  const matches = [
    { kind: 'fact', id: 'x', text: 'x', similarity: 0.91 },
    { kind: 'fact', id: 'y', text: 'y', similarity: 0.9 },
    { kind: 'fact', id: 'z', text: 'z', similarity: 0.86 },
  ];
  const res = await decideDuplicate({ candidate, matches, judge });
  assert.equal(judge.calls.length, 2);
  assert.deepEqual(res, { verdict: 'duplicate', reason: 'judge_same_fact', matchId: 'y', similarity: 0.9 });
});

test('Ahtapot senaryosu: aynı konu, farklı olgu geçer', async () => {
  const judge = fakeJudge({ sameFact: false, reason: 'kalp sayısı vs kan rengi' });
  const res = await decideDuplicate({
    candidate: { sourceKey: 'k1', text: 'Ahtapotun üç kalbi vardır', embedding: [] },
    matches: [{ kind: 'fact', id: 42, text: 'Ahtapotun kanı mavidir', similarity: 0.88 }],
    judge,
  });
  assert.equal(res.verdict, 'unique');
  assert.equal(res.reason, 'judge_different_fact');
  assert.equal(judge.calls.length, 1);
});
