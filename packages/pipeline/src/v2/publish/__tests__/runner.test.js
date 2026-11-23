import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runPublish, parseArgs, loadPublishConfig } from '../../../runners/v2-publish.js';
import { fakeRepo } from './helpers.js';

const NOW = new Date('2026-11-20T06:00:00.000Z');
const CONFIG = { dailyCount: 4, minStockDays: 7 };

function makeQueued(n) {
  const cats = ['bilim', 'tarih', 'doga'];
  return Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    category: cats[i % cats.length],
    wow_score: 100 - i,
    created_at: '2026-11-01T00:00:00Z',
  }));
}

function capture() {
  const out = [];
  const err = [];
  return { out, err, stdout: (l) => out.push(l), stderr: (l) => err.push(l) };
}

test('runner: --apply olmadan markPublished çağrılmaz (varsayılan dry-run)', async () => {
  const repo = fakeRepo({ queued: makeQueued(10) });
  const io = capture();
  const { exitCode, result } = await runPublish({ argv: [], repo, publishConfig: CONFIG, now: NOW, ...io });
  assert.equal(exitCode, 0);
  assert.equal(repo.calls.markPublished.length, 0);
  assert.equal(result.mode, 'dry-run');
  assert.equal(result.selectedCount, 4);
  assert.equal(result.publishedCount, 0);
  assert.ok(io.out.some((l) => l.includes('dry-run')));
});

test('runner: --dry-run açıkça verilince de yazmaz', async () => {
  const repo = fakeRepo({ queued: makeQueued(10) });
  const { exitCode } = await runPublish({ argv: ['--dry-run'], repo, publishConfig: CONFIG, now: NOW, ...capture() });
  assert.equal(exitCode, 0);
  assert.equal(repo.calls.markPublished.length, 0);
});

test('runner: --apply → markPublished seçilenlerle ve enjekte now ile çağrılır', async () => {
  const repo = fakeRepo({ queued: makeQueued(10) });
  const { exitCode, result } = await runPublish({ argv: ['--apply'], repo, publishConfig: CONFIG, now: NOW, ...capture() });
  assert.equal(exitCode, 0);
  assert.equal(repo.calls.markPublished.length, 1);
  assert.deepEqual(repo.calls.markPublished[0].ids, result.selected);
  assert.equal(repo.calls.markPublished[0].now, NOW);
  assert.equal(result.publishedCount, 4);
});

test('runner: --json stdout\'a geçerli tek JSON basar, insan çıktısı stderr\'e', async () => {
  const repo = fakeRepo({ queued: makeQueued(10), count: 10 });
  const io = capture();
  const { exitCode } = await runPublish({ argv: ['--json', '--count', '2'], repo, publishConfig: CONFIG, now: NOW, ...io });
  assert.equal(exitCode, 0);
  assert.equal(io.out.length, 1);
  const parsed = JSON.parse(io.out[0]);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.mode, 'dry-run');
  assert.equal(parsed.dailyCount, 2);
  assert.equal(parsed.selectedCount, 2);
  assert.deepEqual(parsed.byCategory, { bilim: 1, tarih: 1 });
  // 10 stok - 2 seçilen = 8 kart / 2 günlük = 4 gün
  assert.equal(parsed.queuedAfter, 8);
  assert.equal(parsed.stockDays, 4);
  assert.equal(parsed.belowTarget, true);
  assert.equal(parsed.alarm, false);
  assert.ok(io.err.some((l) => l.includes('kategori dağılımı')));
});

test('runner: stok alarmı varsa çıkış kodu yine 0', async () => {
  const repo = fakeRepo({ queued: makeQueued(5) });
  const io = capture();
  const { exitCode, result } = await runPublish({ argv: ['--json'], repo, publishConfig: CONFIG, now: NOW, ...io });
  assert.equal(exitCode, 0);
  assert.equal(result.alarm, true);
  assert.equal(JSON.parse(io.out[0]).alarm, true);
});

test('runner: --count yoksa config publish.dailyCount kullanılır; aday havuzu 5 katı', async () => {
  const repo = fakeRepo({ queued: makeQueued(50) });
  const { result } = await runPublish({ argv: [], repo, publishConfig: CONFIG, now: NOW, ...capture() });
  assert.equal(result.dailyCount, 4);
  assert.deepEqual(repo.calls.listQueued, [20]);
});

test('runner: hata → çıkış kodu 1, --json ile ok:false', async () => {
  const repo = fakeRepo();
  repo.countQueued = async () => {
    throw new Error('db yok');
  };
  const io = capture();
  const { exitCode } = await runPublish({ argv: ['--json'], repo, publishConfig: CONFIG, now: NOW, ...io });
  assert.equal(exitCode, 1);
  assert.deepEqual(JSON.parse(io.out[0]), { ok: false, error: 'db yok' });
});

test('runner: geçersiz argüman → çıkış kodu 1, yazma yok', async () => {
  const repo = fakeRepo({ queued: makeQueued(3) });
  const { exitCode } = await runPublish({ argv: ['--count', '0'], repo, publishConfig: CONFIG, now: NOW, ...capture() });
  assert.equal(exitCode, 1);
  assert.equal(repo.calls.markPublished.length, 0);
});

test('parseArgs: varsayılan dry-run; --apply ile --dry-run birlikte hata', () => {
  assert.deepEqual(parseArgs([]), { count: null, apply: false, dryRun: true, json: false });
  assert.deepEqual(parseArgs(['--count=7', '--apply', '--json']), { count: 7, apply: true, dryRun: false, json: true });
  assert.throws(() => parseArgs(['--apply', '--dry-run']), /birlikte/);
  assert.throws(() => parseArgs(['--bogus']), /bilinmeyen/);
});

test('loadPublishConfig: gerçek config publish bölümünü okur', () => {
  const cfg = loadPublishConfig();
  assert.ok(Number.isInteger(cfg.dailyCount) && cfg.dailyCount > 0);
  assert.equal(typeof cfg.minStockDays, 'number');
});
