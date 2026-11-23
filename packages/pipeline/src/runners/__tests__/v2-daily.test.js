import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildRunRow } from '../../v2/db/runs-repo.js';
import {
  ALARM_CODES,
  computeAlarms,
  formatAlarmIssue,
  parseArgs,
  runDaily,
  usageDelta,
} from '../v2-daily.js';

const T0 = Date.parse('2026-11-21T19:17:00Z');

function clock(stepMs = 1000) {
  let t = T0;
  return () => {
    const v = t;
    t += stepMs;
    return v;
  };
}

function stepStats(step, extra = {}) {
  return {
    step,
    seen: 10,
    advanced: 5,
    rejected: {},
    failed: 0,
    deferred: 0,
    exhaustedRole: null,
    exhaustedReason: null,
    errors: [],
    ...extra,
  };
}

/** Sahte collect/process/publish + DB; çağrı sırasını ve argümanları kaydeder. */
function harness({
  collect = {},
  processStats = {},
  queued = 3,
  publishResult = {},
  collectThrows = null,
  processThrows = null,
  insertThrows = null,
  modelEvents = [],
} = {}) {
  const calls = [];
  const client = { from: () => assert.fail('orkestratör client.from çağırmamalı (repo enjekte)') };
  const deps = {
    env: {
      GITHUB_EVENT_NAME: 'schedule',
      GITHUB_SERVER_URL: 'https://github.com',
      GITHUB_REPOSITORY: 'o/r',
      GITHUB_RUN_ID: '42',
    },
    now: clock(),
    log: () => {},
    createClient: async () => {
      calls.push(['createClient']);
      return client;
    },
    insertRun: async (c, row) => {
      calls.push(['insertRun', row]);
      assert.equal(c, client);
      if (insertThrows) throw insertThrows;
      return { id: 'run-1' };
    },
    createStepsRepo: (c) => {
      calls.push(['createStepsRepo']);
      assert.equal(c, client);
      return { kind: 'fake-steps' };
    },
    createPublishRepo: (c) => {
      calls.push(['createPublishRepo']);
      assert.equal(c, client);
      return { kind: 'fake-publish' };
    },
    loadConfig: () => ({ fake: true }),
    createUsageStore: (c) => {
      calls.push(['createUsageStore', c]);
      return { kind: 'fake-usage' };
    },
    createLlm: (config, llmDeps) => {
      calls.push(['createLlm', llmDeps.usageStore]);
      let snap = 0;
      return {
        events: [],
        usage: {
          async snapshot() {
            snap += 1;
            return snap === 1
              ? {
                  date: '2026-11-21',
                  providers: {
                    groq: {
                      requests: 10,
                      tokens: 1000,
                      neurons: 0,
                      models: { m: { requests: 10, tokens: 1000, neurons: 0 } },
                    },
                  },
                }
              : {
                  date: '2026-11-21',
                  providers: {
                    groq: {
                      requests: 25,
                      tokens: 4000,
                      neurons: 0,
                      models: { m: { requests: 25, tokens: 4000, neurons: 0 } },
                    },
                  },
                };
          },
        },
      };
    },
    runCollect: async (o) => {
      calls.push(['collect', o.args, typeof o.getClient]);
      if (collectThrows) throw collectThrows;
      if (o.getClient) assert.equal(await o.getClient(), client);
      return {
        outFile: '/tmp/v2-collect-all.json',
        candidates: new Array(collect.total ?? 4).fill({}),
        failed: 0,
        summary: collect.summary ?? {
          s2: { name: 'S2', count: 4, db: { inserted: 3, skipped: 1 } },
          s3: { name: 'S3', share: 0, count: 0, skipped: 'limit' },
        },
      };
    },
    runProcess: async (argv, pdeps) => {
      calls.push(['process', argv, pdeps.createDbRepo ? await pdeps.createDbRepo() : null]);
      if (processThrows) throw processThrows;
      return {
        steps: ['dedup-hook', 'score', 'enqueue'],
        stats: {
          'dedup-hook': stepStats('dedup-hook', { rejected: { duplicate: 2 } }),
          score: stepStats('score', { rejected: { low_score: 4 } }),
          enqueue: stepStats('enqueue', { advanced: queued }),
          modelEvents,
          rateEvents: { waits: 1, waitMs: 500, tooLarge: 0, learned: [] },
          ...processStats,
        },
        queued_facts: [{ id: 'f1', title: 'A' }],
      };
    },
    runPublish: async (o) => {
      calls.push(['publish', o.argv, o.repo]);
      return {
        exitCode: 0,
        result: {
          ok: true,
          mode: o.argv.includes('--apply') ? 'apply' : 'dry-run',
          dailyCount: 100,
          queuedBefore: 900,
          selectedCount: 100,
          publishedCount: o.argv.includes('--apply') ? 100 : 0,
          byCategory: { BİLİM: 30 },
          queuedAfter: 800,
          stockDays: 8,
          belowTarget: false,
          alarm: false,
          ...publishResult,
        },
      };
    },
  };
  return { deps, calls, client };
}

const names = (calls) => calls.map((c) => c[0]);

test('parseArgs: varsayılanlar ve bayraklar', () => {
  assert.deepEqual(parseArgs([]), {
    mode: 'dry-run',
    collectLimit: 300,
    processLimit: 300,
    publish: false,
    backfillFrom: null,
    backfillMonths: 1,
  });
  const o = parseArgs([
    '--mode',
    'apply',
    '--collect-limit=120',
    '--process-limit',
    '80',
    '--publish',
    '--backfill-from',
    '2024-02',
    '--backfill-months',
    '2',
  ]);
  assert.deepEqual(o, {
    mode: 'apply',
    collectLimit: 120,
    processLimit: 80,
    publish: true,
    backfillFrom: '2024-02',
    backfillMonths: 2,
  });
  assert.throws(() => parseArgs(['--mode', 'live']), /dry-run\|apply/);
  assert.throws(() => parseArgs(['--collect-limit', '0']), /pozitif/);
  assert.throws(() => parseArgs(['--backfill-from', '2024-2']), /YYYY-MM/);
  assert.throws(() => parseArgs(['--x']), /bilinmeyen/);
});

test('apply: adım sırası collect → process → publish, argümanlar, pipeline_runs satırı', async () => {
  const { deps, calls, client } = harness();
  const s = await runDaily(
    [
      '--mode',
      'apply',
      '--publish',
      '--collect-limit',
      '200',
      '--process-limit',
      '150',
      '--backfill-from',
      '2024-02',
    ],
    deps,
  );

  assert.deepEqual(names(calls), [
    'createClient',
    'collect',
    'createUsageStore',
    'createLlm',
    'createStepsRepo',
    'process',
    'createPublishRepo',
    'publish',
    'insertRun',
  ]);
  const collectCall = calls.find((c) => c[0] === 'collect');
  assert.deepEqual(collectCall[1], [
    '--apply',
    '--limit',
    '200',
    '--backfill-from',
    '2024-02',
    '--backfill-months',
    '1',
  ]);
  assert.equal(collectCall[2], 'function');
  const usageCall = calls.find((c) => c[0] === 'createUsageStore');
  assert.equal(usageCall[1], client);
  const processCall = calls.find((c) => c[0] === 'process');
  assert.deepEqual(processCall[1], ['--apply', '--limit', '150']);
  assert.deepEqual(processCall[2], { kind: 'fake-steps' });
  const publishCall = calls.find((c) => c[0] === 'publish');
  assert.deepEqual(publishCall[1], ['--apply']);
  assert.deepEqual(publishCall[2], { kind: 'fake-publish' });

  assert.equal(s.ok, true);
  assert.equal(s.mode, 'apply');
  assert.equal(s.trigger, 'schedule');
  assert.equal(s.queued, 3);
  assert.deepEqual(s.rejectReasons, { duplicate: 2, low_score: 4 });
  assert.deepEqual(s.steps.collect.bySource.s2, { count: 4, inserted: 3, duplicates: 1 });
  assert.equal(s.steps.collect.inserted, 3);
  assert.equal(s.steps.publish.publishedCount, 100);
  assert.deepEqual(s.rateEvents, { waits: 1, waitMs: 500, tooLarge: 0, learned: [] });
  assert.equal(s.providerUsage.day, '2026-11-21');
  assert.deepEqual(s.providerUsage.run.groq.models.m, {
    requests: 15,
    tokens: 3000,
    neurons: 0,
    failures: 0,
  });
  assert.equal(s.providerUsage.dayTotal.groq.requests, 25);
  assert.ok(s.duration_ms > 0);
  assert.deepEqual(s.alarms, []);
  assert.equal(s.issue, null);
  assert.equal(s.runId, 'run-1');

  const row = calls.find((c) => c[0] === 'insertRun')[1];
  assert.deepEqual(Object.keys(row).sort(), [
    'counts',
    'errors',
    'finished_at',
    'ok',
    'provider_usage',
    'started_at',
    'trigger',
  ]);
  assert.equal(row.trigger, 'schedule');
  assert.equal(row.ok, true);
  assert.equal(row.started_at, '2026-11-21T19:17:00.000Z');
  assert.ok(row.finished_at > row.started_at);
  assert.equal(row.counts.mode, 'apply');
  assert.equal(row.counts.queued, 3);
  assert.equal(row.counts.collect.total, 4);
  assert.equal(row.counts.process.steps.score.advanced, 5);
  assert.equal(row.counts.publish.publishedCount, 100);
  assert.deepEqual(row.counts.reject_reasons, { duplicate: 2, low_score: 4 });
  assert.deepEqual(row.counts.model_events, []);
  assert.deepEqual(row.counts.alarms, []);
  assert.equal(typeof row.counts.duration_ms, 'number');
  assert.deepEqual(row.provider_usage, s.providerUsage);
  assert.deepEqual(row.errors, []);
});

test('--publish yoksa yayın adımı atlanır', async () => {
  const { deps, calls } = harness();
  const s = await runDaily(['--mode', 'apply'], deps);
  assert.ok(!names(calls).includes('publish'));
  assert.deepEqual(s.steps.publish, { skipped: 'no_publish_flag' });
  assert.equal(s.ok, true);
});

test('dry-run: DB yok (client/insertRun/repo çağrılmaz), process collect çıktısını okur, yayın bellekte', async () => {
  const { deps, calls } = harness();
  const s = await runDaily(['--publish'], deps);
  assert.deepEqual(names(calls), [
    'collect',
    'createUsageStore',
    'createLlm',
    'process',
    'publish',
  ]);
  assert.equal(calls.find((c) => c[0] === 'createUsageStore')[1], null);
  const collectCall = calls.find((c) => c[0] === 'collect');
  assert.deepEqual(collectCall[1], ['--dry-run', '--limit', '300']);
  assert.equal(collectCall[2], 'undefined');
  const processCall = calls.find((c) => c[0] === 'process');
  assert.deepEqual(processCall[1], [
    '--dry-run',
    '--input',
    '/tmp/v2-collect-all.json',
    '--limit',
    '300',
  ]);
  assert.equal(processCall[2], null);
  const publishCall = calls.find((c) => c[0] === 'publish');
  assert.deepEqual(publishCall[1], ['--dry-run']);
  assert.equal(await publishCall[2].countQueued(), 1);
  assert.equal(s.mode, 'dry-run');
  assert.equal(s.runId, null);
  assert.equal(s.ok, true);
});

test('dry-run: alarm olsa bile DB yazılmaz; Issue metni sadece özette', async () => {
  const { deps, calls } = harness({ queued: 0 });
  const s = await runDaily([], deps);
  assert.ok(!names(calls).includes('insertRun'));
  assert.ok(!names(calls).includes('createClient'));
  assert.deepEqual(
    s.alarms.map((a) => a.code),
    [ALARM_CODES.NO_NEW_QUEUED],
  );
  assert.ok(s.issue.title.includes('Yeni kart çıkmadı'));
});

test('alarm (a): 0 yeni queued', async () => {
  const { deps } = harness({ queued: 0 });
  const s = await runDaily(['--mode', 'apply'], deps);
  assert.equal(s.ok, true);
  assert.deepEqual(
    s.alarms.map((a) => a.code),
    ['no_new_queued'],
  );
});

test('alarm (b): stok < 3 gün (publish stockStatus.alarm)', async () => {
  const { deps } = harness({
    publishResult: { alarm: true, stockDays: 2.4, queuedAfter: 240, belowTarget: true },
  });
  const s = await runDaily(['--mode', 'apply', '--publish'], deps);
  const a = s.alarms.find((x) => x.code === ALARM_CODES.LOW_STOCK);
  assert.ok(a);
  assert.match(a.message, /2\.4 güne/);
  assert.equal(s.alarms.length, 1);
});

test('alarm (c): model_unavailable olayı', async () => {
  const ev = {
    type: 'model_unavailable',
    provider: 'groq',
    model: 'qwen/qwen3.8-27b',
    roles: ['scorer', 'judge'],
    status: 404,
    error: 'model decommissioned',
    count: 2,
  };
  const { deps } = harness({ modelEvents: [ev] });
  const s = await runDaily(['--mode', 'apply'], deps);
  assert.deepEqual(s.modelEvents, [ev]);
  const a = s.alarms.find((x) => x.code === ALARM_CODES.MODEL_UNAVAILABLE);
  assert.ok(a);
  assert.match(a.message, /groq\/qwen\/qwen3\.8-27b/);
  assert.match(a.message, /HTTP 404/);
  assert.match(a.message, /puanlayıcı/);
  assert.equal(s.ok, true);
});

test('alarm (d): bir rolün zinciri tükendi (rol başına tek alarm)', async () => {
  const { deps } = harness({
    processStats: {
      score: stepStats('score', {
        exhaustedRole: 'scorer',
        exhaustedReason: 'groq 429 TPD',
        deferred: 40,
      }),
      write: stepStats('write', {
        exhaustedRole: 'writer',
        exhaustedReason: 'budget',
        deferred: 7,
      }),
    },
  });
  // write adımı steps listesinde olmalı
  const orig = deps.runProcess;
  deps.runProcess = async (argv, d) => {
    const r = await orig(argv, d);
    r.steps = ['dedup-hook', 'score', 'write', 'enqueue'];
    return r;
  };
  const s = await runDaily(['--mode', 'apply'], deps);
  const ex = s.alarms.filter((x) => x.code === ALARM_CODES.CHAIN_EXHAUSTED);
  assert.equal(ex.length, 2);
  assert.deepEqual(
    ex.map((a) => a.details.role),
    ['scorer', 'writer'],
  );
  assert.match(ex[0].message, /40 aday/);
  assert.match(ex[0].message, /groq 429 TPD/);
});

test('alarm (e): adım hatası → ok=false, sonraki adımlar yine çalışır, satır yazılır', async () => {
  const { deps, calls } = harness({ collectThrows: new Error('Wikipedia 503') });
  const s = await runDaily(['--mode', 'apply', '--publish'], deps);
  assert.deepEqual(
    names(calls).filter((n) => ['collect', 'process', 'publish', 'insertRun'].includes(n)),
    ['collect', 'process', 'publish', 'insertRun'],
  );
  assert.equal(s.ok, false);
  assert.deepEqual(s.errors, [{ step: 'collect', message: 'Wikipedia 503' }]);
  assert.equal(s.steps.collect.ok, false);
  const a = s.alarms.find((x) => x.code === ALARM_CODES.RUN_ERROR);
  assert.ok(a);
  assert.match(a.message, /collect/);
  const row = calls.find((c) => c[0] === 'insertRun')[1];
  assert.equal(row.ok, false);
  assert.deepEqual(row.errors, [{ step: 'collect', message: 'Wikipedia 503' }]);
});

test('alarm (e): process hatası → hem run_error hem 0 queued', async () => {
  const { deps } = harness({ processThrows: new Error('config bozuk') });
  const s = await runDaily(['--mode', 'apply'], deps);
  assert.equal(s.ok, false);
  assert.deepEqual(s.alarms.map((a) => a.code).sort(), ['no_new_queued', 'run_error']);
});

test('alarm (e): kaynak hatası (collect failedSources) run hatası sayılır', async () => {
  const { deps } = harness({
    collect: {
      summary: {
        s2: { name: 'S2', count: 4 },
        s3: { name: 'S3', share: 10, error: 'parse hatası' },
      },
    },
  });
  const s = await runDaily(['--mode', 'apply'], deps);
  assert.equal(s.ok, false);
  assert.deepEqual(s.steps.collect.failedSources, ['s3']);
  assert.match(s.errors[0].message, /kaynak s3: parse hatası/);
});

test('apply: Supabase env yoksa run_error, hiçbir adım DB olmadan çalışmaz', async () => {
  const { deps, calls } = harness();
  deps.createClient = async () => {
    throw new Error('SUPABASE_URL gerekli');
  };
  const s = await runDaily(['--mode', 'apply', '--publish'], deps);
  assert.ok(!names(calls).some((n) => ['collect', 'process', 'publish', 'insertRun'].includes(n)));
  assert.equal(s.ok, false);
  assert.deepEqual(
    s.alarms.map((a) => a.code),
    ['run_error'],
  );
});

test('pipeline_runs yazılamazsa ok=false ve run_error alarmı', async () => {
  const { deps } = harness({ insertThrows: new Error('permission denied') });
  const s = await runDaily(['--mode', 'apply'], deps);
  assert.equal(s.ok, false);
  assert.equal(s.runId, null);
  assert.match(s.alarms.find((a) => a.code === 'run_error').message, /pipeline_runs/);
});

test('geçersiz argüman: hata özeti döner, hiçbir adım çalışmaz', async () => {
  const { deps, calls } = harness();
  const s = await runDaily(['--mode', 'canli'], deps);
  assert.equal(calls.length, 0);
  assert.equal(s.ok, false);
  assert.equal(s.errors[0].step, 'args');
});

test('formatAlarmIssue: Türkçe başlık, ne oldu / ne yapmalı, run linki, özet tablosu', async () => {
  const ev = {
    type: 'model_unavailable',
    provider: 'cloudflare',
    model: '@cf/x',
    roles: ['verifier'],
    status: 410,
    error: 'deprecated',
    count: 1,
  };
  const { deps } = harness({ queued: 0, modelEvents: [ev] });
  const s = await runDaily(['--mode', 'apply'], deps);
  const { title, body } = s.issue;
  assert.equal(title, 'İçerik hattı alarmı: Yeni kart çıkmadı, Model kapanmış');
  assert.match(body, /## Ne oldu\?/);
  assert.match(body, /### 1\. Yeni kart çıkmadı/);
  assert.match(body, /### 2\. Model kapanmış/);
  assert.match(body, /\*\*Ne yapmalısınız\?\*\*/);
  assert.match(body, /pipeline\.config\.json/);
  assert.match(body, /\[run kaydı\]\(https:\/\/github\.com\/o\/r\/actions\/runs\/42\)/);
  assert.match(body, /\| Topla \| 4 aday/);
  assert.match(body, /\| Yayınla \| bu run'da yok/);
  assert.ok(title.length <= 120);
  // doğrudan çağrı (runUrl yok)
  assert.doesNotMatch(formatAlarmIssue(s).body, /run kaydı/);
});

test('computeAlarms: alarm yoksa boş; atlanan process için 0-queued alarmı yok', () => {
  assert.deepEqual(
    computeAlarms({ errors: [], steps: { process: { skipped: 'setup' } }, queued: 0 }),
    [],
  );
  assert.deepEqual(
    computeAlarms({ errors: [], steps: { process: { ok: true, steps: {} } }, queued: 5 }),
    [],
  );
});

test('usageDelta: aynı gün farkı, gün değiştiyse bitiş gününün tamamı', () => {
  const start = {
    date: '2026-11-20',
    providers: {
      groq: {
        requests: 5,
        tokens: 50,
        neurons: 0,
        models: { a: { requests: 5, tokens: 50, neurons: 0 } },
      },
    },
  };
  const end = {
    date: '2026-11-21',
    providers: {
      groq: {
        requests: 2,
        tokens: 20,
        neurons: 0,
        models: { a: { requests: 2, tokens: 20, neurons: 0 } },
      },
    },
  };
  assert.equal(usageDelta(start, end).groq.requests, 2);
  assert.deepEqual(usageDelta(end, end), {});
  assert.equal(usageDelta(null, null), null);
});

test('buildRunRow: tablo sütunları', () => {
  const row = buildRunRow({
    ok: true,
    mode: 'apply',
    started_at: 'a',
    finished_at: 'b',
    trigger: 'workflow_dispatch',
    errors: [],
    alarms: [],
  });
  assert.equal(row.trigger, 'workflow_dispatch');
  assert.equal(row.ok, true);
  assert.equal(row.counts.queued, 0);
  assert.equal(row.provider_usage, null);
});
