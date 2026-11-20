import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildJudgePrompt } from '../index.js';

test('buildJudgePrompt: iki metni de içerir, yanıt şemasını belirtir', () => {
  const a = 'Ahtapotun üç kalbi vardır';
  const b = 'Octopus blood is blue';
  const { messages } = buildJudgePrompt({ a, b });

  assert.ok(Array.isArray(messages) && messages.length >= 1);
  const all = messages.map((m) => m.content).join('\n');
  assert.ok(all.includes(a));
  assert.ok(all.includes(b));
  assert.ok(all.includes('"same_fact"'));
  assert.ok(all.includes('"reason"'));
  assert.ok(all.includes('AYNI') && all.includes('FARKLI'));
  for (const m of messages) {
    assert.ok(['system', 'user'].includes(m.role));
  }
});

test('buildJudgePrompt: kısa kalır (token tasarrufu)', () => {
  const { messages } = buildJudgePrompt({ a: 'x', b: 'y' });
  const total = messages.reduce((n, m) => n + m.content.length, 0);
  assert.ok(total < 600, `prompt çok uzun: ${total}`);
});
