import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createFileUsageStore, createMemoryUsageStore, createUsageTracker, utcDayKey } from '../usage.js';
import { DEFAULT_USAGE_DIR } from '../usage.js';
import { realConfig } from './helpers.js';

const NOW = Date.parse('2026-11-20T10:00:00Z');

test('utcDayKey UTC gününü verir', () => {
  assert.equal(utcDayKey(Date.parse('2026-11-20T23:59:59Z')), '2026-11-20');
  assert.equal(utcDayKey(new Date('2026-11-21T00:00:00Z')), '2026-11-21');
});

test('varsayılan dosya dizini packages/pipeline/.cache', () => {
  assert.equal(path.basename(DEFAULT_USAGE_DIR), '.cache');
  assert.equal(path.basename(path.dirname(DEFAULT_USAGE_DIR)), 'pipeline');
});

test('tracker: token sınırı %90’da durdurur, Neuron tahmini yapar', async () => {
  const { providers } = realConfig();
  const tracker = createUsageTracker({ providers, store: createMemoryUsageStore(), now: () => NOW });

  await tracker.record('groq', 'openai/gpt-oss-120b', { inputTokens: 100000, outputTokens: 79999 });
  assert.equal((await tracker.check('groq', 'openai/gpt-oss-120b')).allowed, true);
  await tracker.record('groq', 'openai/gpt-oss-120b', { inputTokens: 1, outputTokens: 0 });
  const blocked = await tracker.check('groq', 'openai/gpt-oss-120b');
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.detail.metric, 'tokens');
  // Diğer Groq modeli etkilenmez (limit model başına)
  assert.equal((await tracker.check('groq', 'openai/gpt-oss-20b')).allowed, true);

  const n = await tracker.record('cloudflare', '@cf/baai/bge-m3', { inputTokens: 1_000_000 });
  assert.equal(n, 1075);
  assert.equal(tracker.estimateNeurons('cloudflare', '@cf/bilinmeyen', 1_000_000, 0), 40909);
  assert.equal(tracker.estimateNeurons('groq', 'x', 10, 10), undefined);
});

test('tracker: eşzamanlı kayıtlar kaybolmaz', async () => {
  const { providers } = realConfig();
  const store = createMemoryUsageStore();
  const tracker = createUsageTracker({ providers, store, now: () => NOW });
  await Promise.all(
    Array.from({ length: 5 }, () => tracker.record('groq', 'openai/gpt-oss-20b', { inputTokens: 10, outputTokens: 10 })),
  );
  const snap = await tracker.snapshot();
  assert.equal(snap.providers.groq.models['openai/gpt-oss-20b'].requests, 5);
  assert.equal((await store.load('2026-11-20')).providers.groq.models['openai/gpt-oss-20b'].tokens, 100);
});

test('dosya store: .cache/llm-usage-YYYY-MM-DD.json yazar ve geri okur', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'llm-usage-'));
  try {
    const { providers } = realConfig();
    const store = createFileUsageStore({ dir });
    const tracker = createUsageTracker({ providers, store, now: () => NOW });
    await tracker.record('groq', 'qwen/qwen3.8-27b', { inputTokens: 10, outputTokens: 5 });

    const file = path.join(dir, 'llm-usage-2026-11-20.json');
    const saved = JSON.parse(await readFile(file, 'utf8'));
    assert.equal(saved.date, '2026-11-20');
    assert.equal(saved.providers.groq.models['qwen/qwen3.8-27b'].tokens, 15);

    // Yeni süreç gibi: aynı dosyadan devam eder
    const tracker2 = createUsageTracker({ providers, store: createFileUsageStore({ dir }), now: () => NOW });
    await tracker2.record('groq', 'qwen/qwen3.8-27b', { inputTokens: 1, outputTokens: 1 });
    const snap = await tracker2.snapshot();
    assert.equal(snap.providers.groq.models['qwen/qwen3.8-27b'].requests, 2);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
