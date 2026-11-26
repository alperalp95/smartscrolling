import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createMemoryStepsRepo } from '../../db/steps-repo.js';
import { executionOrder, resolveSteps, runSteps } from '../index.js';
import { maxWrittenBacklog, runWrite } from '../write.js';
import { GOOD_CARD, baseCandidate, deps, fakeLlm } from './helpers.js';

const SUPPORT = 'An octopus has three hearts. Its blood is blue because of a copper-rich protein.';

test('sıra: verify ve enqueue, write ve yeni iş üretiminden önce gelir', () => {
  const { drain, fill, tail } = executionOrder(resolveSteps());
  assert.deepEqual(drain, ['dedup-card', 'verify', 'enqueue']);
  assert.deepEqual(fill, ['dedup-hook', 'score', 'support', 'write']);
  assert.deepEqual(tail, drain);
});

test('sıra: write seçili değilse son tur yok; tek adım seçimi korunur', () => {
  assert.deepEqual(executionOrder(['verify', 'enqueue']).tail, []);
  assert.deepEqual(executionOrder(['write']).drain, []);
});

test('runSteps: repo okuma sırası verify/enqueue önce, write (scored) sonra', async () => {
  const seen = [];
  const repo = createMemoryStepsRepo({ candidates: [] });
  const orig = repo.listByStatus.bind(repo);
  repo.listByStatus = async (status, ...rest) => {
    seen.push(status);
    return orig(status, ...rest);
  };
  await runSteps(['verify', 'enqueue', 'write'], deps({ llm: fakeLlm({}), repo }));
  assert.equal(seen.indexOf('verified') < seen.indexOf('scored'), true);
  assert.equal(seen.indexOf('written') < seen.indexOf('scored'), true);
});

function repoWithBacklog(writtenCount) {
  const candidates = [
    baseCandidate({
      id: 's1',
      status: 'scored',
      support_paragraph: SUPPORT,
      scores: { category: '🔬 BİLİM', wow: 8 },
    }),
  ];
  for (let i = 0; i < writtenCount; i += 1)
    candidates.push(baseCandidate({ id: `w${i}`, status: 'written', scores: {} }));
  return createMemoryStepsRepo({ candidates });
}

test('backlog: written > maxWrittenBacklog iken write çağrılmaz', async () => {
  const llm = fakeLlm({ writer: GOOD_CARD });
  const repo = repoWithBacklog(3);
  const stats = await runWrite(deps({ llm, repo, config: { writing: { maxWrittenBacklog: 2 } } }));
  assert.equal(stats.skipped, 'backlog');
  assert.equal(stats.backlog, 3);
  assert.equal(llm.calls.length, 0);
  assert.equal(stats.exhaustedRole, null);
});

test('backlog: written ≤ maxWrittenBacklog iken write çağrılır', async () => {
  const llm = fakeLlm({ writer: GOOD_CARD });
  const repo = repoWithBacklog(2);
  const stats = await runWrite(deps({ llm, repo, config: { writing: { maxWrittenBacklog: 2 } } }));
  assert.equal(stats.skipped, undefined);
  assert.equal(llm.calls.length, 1);
  assert.equal(stats.advanced, 1);
});

test('backlog: varsayılan 40', () => {
  assert.equal(maxWrittenBacklog({}), 40);
  assert.equal(maxWrittenBacklog({ writing: { maxWrittenBacklog: 0 } }), 0);
});
