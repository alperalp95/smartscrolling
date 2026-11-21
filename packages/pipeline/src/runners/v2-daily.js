#!/usr/bin/env node
// İçerik hattı v2 — günlük orkestratör: topla → işle → (yayınla) adımlarını sırayla çalıştırır.
// Spec: docs/specs/content-pipeline-v2.md §8 (dayanıklılık), §10.
//
//   node src/runners/v2-daily.js                                   # dry-run (varsayılan): DB'ye yazmaz
//   node src/runners/v2-daily.js --mode apply                      # topla + işle, DB'ye yazar
//   node src/runners/v2-daily.js --mode apply --publish            # + günün kartlarını yayınlar
//   node src/runners/v2-daily.js --collect-limit 300 --process-limit 300 --backfill-from 2024-02 --backfill-months 1
//
// Adımlar alt süreç değil, içe aktarılan fonksiyonlardır (runCollect / runProcess / runPublish).
// Bir adım hata verirse sonraki adımlar yine çalışır (ör. toplama düşse de stoktaki adaylar işlenir).
//
// Çıktı: stdout'a SADECE tek satır JSON özet (workflow bunu dosyaya yazıp okur); bütün insan log'u stderr'e.
// Özette `alarms[]` doluysa workflow GitHub Issue açar (metin `issue.title` / `issue.body`).
// `--mode apply`'da özet ayrıca `pipeline_runs` tablosuna yazılır; LLM günlük bütçesi `pipeline_state`'te
// (`llm-usage:<YYYY-MM-DD>`) tutulur, böylece günün 3 run'ı aynı ücretsiz kotayı paylaşır.
//
// Çıkış kodu: 0 = run hatasız bitti (alarm olsa bile), 1 = bir adım/kayıt hata verdi.
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createFileUsageStore, createLlm, loadConfig } from '../llm/index.js';
import { createStateUsageStore } from '../llm/usage.js';
import { buildRunRow, insertRun } from '../v2/db/runs-repo.js';
import { createStepsRepo } from '../v2/db/steps-repo.js';
import { createPublishRepo } from '../v2/publish/index.js';
import { runCollect } from './v2-collect.js';
import { formatLlmEvent, runProcess } from './v2-process.js';
import { runPublish } from './v2-publish.js';

export const DEFAULTS = Object.freeze({
  mode: 'dry-run',
  collectLimit: 300,
  processLimit: 300,
  publish: false,
  backfillFrom: null,
  backfillMonths: 1,
});

export const ALARM_CODES = Object.freeze({
  NO_NEW_QUEUED: 'no_new_queued',
  LOW_STOCK: 'low_stock',
  MODEL_UNAVAILABLE: 'model_unavailable',
  CHAIN_EXHAUSTED: 'chain_exhausted',
  RUN_ERROR: 'run_error',
});

/** LLM olaylarından stderr log'una yazılanlar (başarılı çağrılar yazılmaz). */
const LOGGED_LLM_EVENTS = new Set([
  'retry',
  'provider_failed',
  'model_unavailable',
  'quota_exhausted',
  'budget_skip',
  'missing_credentials',
  'json_repair',
  'truncated',
  'request_too_large',
  'rate_limit_learned',
]);

const ROLE_NAMES = {
  scorer: 'puanlayıcı',
  writer: 'yazar',
  verifier: 'doğrulayıcı',
  judge: 'hakem',
  embedding: 'embedding (tekrar kontrolü)',
};

const roleName = (role) => (ROLE_NAMES[role] ? `${ROLE_NAMES[role]} (\`${role}\`)` : `\`${role}\``);

function positiveInt(raw, label) {
  const text = String(raw ?? '').trim();
  if (!/^\d+$/.test(text) || Number(text) <= 0)
    throw new Error(`${label} pozitif tam sayı olmalı: ${raw}`);
  return Number(text);
}

/** @param {string[]} argv */
export function parseArgs(argv) {
  const opts = { ...DEFAULTS };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const eq = arg.indexOf('=');
    const flag = eq === -1 ? arg : arg.slice(0, eq);
    const inline = eq === -1 ? undefined : arg.slice(eq + 1);
    const value = () => {
      if (inline !== undefined) return inline;
      const v = argv[i + 1];
      if (v === undefined || v.startsWith('--')) throw new Error(`${flag} bir değer bekliyor`);
      i += 1;
      return v;
    };
    if (flag === '--mode') {
      const mode = String(value()).trim().toLowerCase();
      if (mode !== 'dry-run' && mode !== 'apply')
        throw new Error(`--mode dry-run|apply olmalı: ${mode}`);
      opts.mode = mode;
    } else if (flag === '--collect-limit')
      opts.collectLimit = positiveInt(value(), '--collect-limit');
    else if (flag === '--process-limit')
      opts.processLimit = positiveInt(value(), '--process-limit');
    else if (flag === '--publish') opts.publish = true;
    else if (flag === '--backfill-from') {
      const from = String(value()).trim();
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(from))
        throw new Error(`--backfill-from YYYY-MM olmalı: ${from}`);
      opts.backfillFrom = from;
    } else if (flag === '--backfill-months')
      opts.backfillMonths = positiveInt(value(), '--backfill-months');
    else throw new Error(`bilinmeyen argüman: ${arg}`);
  }
  return opts;
}

// ---------------------------------------------------------------------------------------------
// Adım özetleri

function summarizeCollect(result) {
  const bySource = {};
  let inserted = 0;
  let duplicates = 0;
  const failedSources = [];
  for (const [id, rec] of Object.entries(result?.summary ?? {})) {
    const row = { count: rec.count ?? 0 };
    if (rec.db) {
      row.inserted = rec.db.inserted ?? 0;
      row.duplicates = rec.db.skipped ?? 0;
      inserted += row.inserted;
      duplicates += row.duplicates;
    }
    if (rec.skipped) row.skipped = rec.skipped;
    if (rec.error) {
      row.error = String(rec.error).slice(0, 300);
      failedSources.push(id);
    }
    bySource[id] = row;
  }
  return {
    ok: failedSources.length === 0,
    total: result?.candidates?.length ?? 0,
    inserted,
    duplicates,
    bySource,
    failedSources,
  };
}

function summarizeProcess(result) {
  const stats = result?.stats ?? {};
  const steps = {};
  const rejectReasons = {};
  for (const name of result?.steps ?? []) {
    const s = stats[name];
    if (!s) continue;
    steps[name] = {
      seen: s.seen ?? 0,
      advanced: s.advanced ?? 0,
      rejected: s.rejected ?? {},
      failed: s.failed ?? 0,
      deferred: s.deferred ?? 0,
      ...(s.exhaustedRole
        ? { exhaustedRole: s.exhaustedRole, exhaustedReason: s.exhaustedReason ?? null }
        : {}),
    };
    for (const [reason, n] of Object.entries(s.rejected ?? {}))
      rejectReasons[reason] = (rejectReasons[reason] ?? 0) + n;
  }
  return {
    ok: true,
    queued: stats.enqueue?.advanced ?? 0,
    steps,
    rejectReasons,
    modelEvents: Array.isArray(stats.modelEvents) ? stats.modelEvents : [],
    rateEvents: stats.rateEvents ?? null,
  };
}

function summarizePublish(result) {
  return {
    ok: true,
    skipped: false,
    mode: result.mode,
    dailyCount: result.dailyCount,
    queuedBefore: result.queuedBefore,
    selectedCount: result.selectedCount,
    publishedCount: result.publishedCount,
    byCategory: result.byCategory,
    queuedAfter: result.queuedAfter,
    stockDays: result.stockDays,
    belowTarget: result.belowTarget,
    alarm: Boolean(result.alarm),
  };
}

/** Run'ın kullanımı = bitiş − başlangıç (gün değiştiyse bitişteki günün tamamı). */
export function usageDelta(start, end) {
  if (!end) return null;
  const sameDay = start && start.date === end.date;
  const out = {};
  for (const [provider, p] of Object.entries(end.providers ?? {})) {
    const sp = sameDay ? start.providers?.[provider] : null;
    const models = {};
    for (const [model, m] of Object.entries(p.models ?? {})) {
      const sm = sp?.models?.[model];
      const d = {
        requests: (m.requests ?? 0) - (sm?.requests ?? 0),
        tokens: (m.tokens ?? 0) - (sm?.tokens ?? 0),
        neurons: Math.round(((m.neurons ?? 0) - (sm?.neurons ?? 0)) * 1000) / 1000,
        failures: (m.failures ?? 0) - (sm?.failures ?? 0),
      };
      if (d.requests || d.tokens || d.neurons || d.failures) models[model] = d;
    }
    if (Object.keys(models).length) {
      out[provider] = {
        requests: (p.requests ?? 0) - (sp?.requests ?? 0),
        tokens: (p.tokens ?? 0) - (sp?.tokens ?? 0),
        neurons: Math.round(((p.neurons ?? 0) - (sp?.neurons ?? 0)) * 1000) / 1000,
        models,
      };
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Alarmlar

/**
 * Spec §8 + V2-08 kararı 3: (a) 0 yeni queued, (b) stok < 3 gün, (c) model_unavailable,
 * (d) bir rolün zinciri tükendi, (e) run hata ile bitti.
 * @param {object} summary
 * @returns {Array<{ code: string, title: string, message: string, action: string, details?: object }>}
 */
export function computeAlarms(summary) {
  const alarms = [];
  const errors = summary.errors ?? [];
  const steps = summary.steps ?? {};

  if (errors.length) {
    alarms.push({
      code: ALARM_CODES.RUN_ERROR,
      title: 'Run hata ile bitti',
      message: errors.map((e) => `\`${e.step}\` adımı: ${e.message}`).join('\n'),
      action:
        'Aşağıdaki "run kaydı" bağlantısından log\'u açın. "SUPABASE_URL" / "anahtar" geçiyorsa GitHub → Settings → ' +
        "Secrets and variables → Actions altındaki secret'ları kontrol edin. Hata kaynak sitesindense (Wikipedia) " +
        "çoğu zaman bir sonraki run'da kendiliğinden düzelir.",
      details: { errors },
    });
  }

  if (steps.process && !steps.process.skipped && (summary.queued ?? 0) === 0) {
    alarms.push({
      code: ALARM_CODES.NO_NEW_QUEUED,
      title: 'Yeni kart çıkmadı',
      message: `Bu run'da yayın stoğuna hiç yeni kart eklenmedi (toplanan aday: ${steps.collect?.total ?? 0}).`,
      action:
        'Tek seferlik olabilir (yeni kanca yoksa ya da modeller doluysa). Aynı alarm birkaç run üst üste geliyorsa ' +
        "bu Issue'daki diğer maddelere ve run log'una bakın; neden genelde orada yazar.",
    });
  }

  const pub = steps.publish;
  if (pub && !pub.skipped && pub.alarm) {
    alarms.push({
      code: ALARM_CODES.LOW_STOCK,
      title: 'Stok azaldı',
      message: `Yayın stoğu ${pub.stockDays} güne düştü (${pub.queuedAfter} kart; günde ${pub.dailyCount} kart yayınlanıyor). 3 günün altı alarm sayılır.`,
      action:
        'Hat yayınladığından az kart üretiyor. Kısa vadede `packages/pipeline/config/pipeline.config.json` içindeki ' +
        "`publish.dailyCount` değeri düşürülebilir; asıl nedeni (model, limit, kaynak) bu Issue'daki diğer maddelerde arayın.",
      details: {
        stockDays: pub.stockDays,
        queuedAfter: pub.queuedAfter,
        dailyCount: pub.dailyCount,
      },
    });
  }

  for (const e of summary.modelEvents ?? []) {
    if (e.type !== 'model_unavailable') continue;
    alarms.push({
      code: ALARM_CODES.MODEL_UNAVAILABLE,
      title: 'Model kapanmış',
      message:
        `\`${e.provider}/${e.model}\` modeli "kapatıldı / bulunamadı" dedi${e.status ? ` (HTTP ${e.status})` : ''}. ` +
        `Etkilenen rol: ${(e.roles ?? []).map(roleName).join(', ') || '-'}. Hata: ${e.error || '-'}`,
      action:
        "Hat bu run'da kendiliğinden yedek modele geçti, ama yedek de biterse üretim durur. " +
        '`packages/pipeline/config/pipeline.config.json` içinde bu modeli zincirden çıkarın ya da sağlayıcının önerdiği yeni modelle değiştirin.',
      details: {
        provider: e.provider,
        model: e.model,
        status: e.status ?? null,
        roles: e.roles ?? [],
      },
    });
  }

  const byRole = new Map();
  for (const [step, s] of Object.entries(steps.process?.steps ?? {})) {
    if (!s.exhaustedRole) continue;
    const cur = byRole.get(s.exhaustedRole) ?? {
      steps: [],
      deferred: 0,
      reason: s.exhaustedReason,
    };
    cur.steps.push(step);
    cur.deferred += s.deferred ?? 0;
    byRole.set(s.exhaustedRole, cur);
  }
  for (const [role, info] of byRole) {
    alarms.push({
      code: ALARM_CODES.CHAIN_EXHAUSTED,
      title: 'Model zinciri tükendi',
      message:
        `${roleName(role)} rolündeki bütün modeller bu run'da tükendi (adım: ${info.steps.join(', ')}); ` +
        `${info.deferred} aday sonraki run'a kaldı. Neden: ${String(info.reason ?? '-').slice(0, 300)}`,
      action:
        'Genelde günlük ücretsiz limit dolmuştur; ertesi gün (00:00 UTC) kendiliğinden düzelir. Her gün tekrarlanıyorsa ' +
        'API anahtarlarını (GitHub secrets) ve sağlayıcı panelindeki limitleri kontrol edin.',
      details: { role, steps: info.steps, deferred: info.deferred },
    });
  }

  return alarms;
}

function fmtDuration(ms) {
  if (!Number.isFinite(ms)) return '-';
  const min = Math.round(ms / 60000);
  return min >= 1 ? `${min} dk` : `${Math.round(ms / 1000)} sn`;
}

function fmtReasons(reasons) {
  const entries = Object.entries(reasons ?? {}).sort((a, b) => b[1] - a[1]);
  return entries.length ? entries.map(([k, v]) => `${k}=${v}`).join(', ') : 'yok';
}

/**
 * Alarm Issue'su (Türkçe, sade). Workflow `issue.title` / `issue.body`'yi `gh` ile açar ya da açık
 * Issue'ya yorum olarak ekler.
 * @param {object} summary
 * @param {{ runUrl?: string | null }} [opts]
 */
export function formatAlarmIssue(summary, { runUrl = null } = {}) {
  const alarms = summary.alarms ?? [];
  const when = `${String(summary.started_at ?? '')
    .slice(0, 16)
    .replace('T', ' ')} UTC`;
  const titles = [...new Set(alarms.map((a) => a.title))];
  let title = `İçerik hattı alarmı: ${titles.join(', ')}`;
  if (title.length > 120) title = `${title.slice(0, 117)}...`;

  const steps = summary.steps ?? {};
  const c = steps.collect;
  const p = steps.process;
  const pub = steps.publish;
  const collectLine =
    !c || c.skipped
      ? 'çalışmadı'
      : c.error
        ? `HATA: ${c.error}`
        : `${c.total} aday${c.inserted !== undefined ? ` (DB'ye yeni ${c.inserted}, zaten vardı ${c.duplicates})` : ''}` +
          `${c.failedSources?.length ? ` · hatalı kaynak: ${c.failedSources.join(', ')}` : ''}`;
  const processLine =
    !p || p.skipped
      ? 'çalışmadı'
      : p.error
        ? `HATA: ${p.error}`
        : `${summary.queued ?? 0} kart stoğa eklendi · elenen: ${fmtReasons(summary.rejectReasons)}`;
  const publishLine =
    !pub || pub.skipped
      ? "bu run'da yok (yayın günün son run'ında)"
      : pub.error
        ? `HATA: ${pub.error}`
        : `${pub.mode === 'apply' ? pub.publishedCount : pub.selectedCount} kart${pub.mode === 'apply' ? ' yayınlandı' : ' seçildi (dry-run)'} · stok ${pub.stockDays} gün (${pub.queuedAfter} kart)`;

  const lines = [
    `**Run:** ${when} · mod: \`${summary.mode}\` · tetik: \`${summary.trigger ?? '-'}\` · süre: ${fmtDuration(summary.duration_ms)}${runUrl ? ` · [run kaydı](${runUrl})` : ''}`,
    '',
    '## Ne oldu?',
    '',
  ];
  alarms.forEach((a, i) => {
    lines.push(
      `### ${i + 1}. ${a.title}`,
      '',
      a.message,
      '',
      `**Ne yapmalısınız?** ${a.action}`,
      '',
    );
  });
  lines.push(
    '## Run özeti',
    '',
    '| Adım | Sonuç |',
    '|---|---|',
    `| Topla | ${collectLine} |`,
    `| İşle | ${processLine} |`,
    `| Yayınla | ${publishLine} |`,
    '',
    "<sub>Bu Issue içerik hattı tarafından otomatik açıldı (`content-v2` workflow). Sorun çözülünce Issue'yu kapatın. " +
      "Açık bir `pipeline-alarm` Issue'su varken yeni alarmlar ona yorum olarak eklenir.</sub>",
  );
  return { title, body: lines.join('\n') };
}

// ---------------------------------------------------------------------------------------------
// Orkestratör

function runUrlFromEnv(env) {
  const { GITHUB_SERVER_URL: server, GITHUB_REPOSITORY: repo, GITHUB_RUN_ID: runId } = env ?? {};
  return server && repo && runId ? `${server}/${repo}/actions/runs/${runId}` : null;
}

async function defaultCreateClient(env) {
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    throw new Error('--mode apply için SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY gerekli');
  const { createClient } = await import('@supabase/supabase-js');
  return createClient(url, key, { auth: { persistSession: false } });
}

/** Dry-run yayın için bellek içi repo: bu run'da (dry-run) stoğa giren kartlardan. Hiçbir şey yazmaz. */
export function createMemoryPublishRepo(queued = []) {
  const rows = queued.map((f, i) => ({ id: f.id ?? `dry-fact-${i + 1}`, ...f }));
  return {
    async countQueued() {
      return rows.length;
    },
    async listQueued(limit) {
      return rows.slice(0, limit);
    },
    async markPublished(ids) {
      return { publishedIds: ids.map((r) => r?.id ?? r) };
    },
  };
}

/**
 * Test edilebilir çekirdek. Tüm dış bağımlılıklar enjekte edilebilir.
 * @param {string[]} argv
 * @param {object} [deps]
 * @param {Function} [deps.runCollect]   varsayılan v2-collect runCollect
 * @param {Function} [deps.runProcess]   varsayılan v2-process runProcess
 * @param {Function} [deps.runPublish]   varsayılan v2-publish runPublish
 * @param {(env) => Promise<any>} [deps.createClient]  sadece apply'da çağrılır
 * @param {(client, row) => Promise<{ id }>} [deps.insertRun]  sadece apply'da
 * @param {(client) => any} [deps.createStepsRepo]
 * @param {(client) => any} [deps.createPublishRepo]
 * @param {(config, llmDeps) => any} [deps.createLlm]
 * @param {() => object} [deps.loadConfig]
 * @param {(client) => object} [deps.createUsageStore]  varsayılan: apply → pipeline_state, dry-run → .cache dosyası
 * @param {Record<string, string|undefined>} [deps.env]
 * @param {() => number} [deps.now]
 * @param {(line: string) => void} [deps.log]  insan log'u (varsayılan stderr)
 * @returns {Promise<object>} özet
 */
export async function runDaily(argv = [], deps = {}) {
  const env = deps.env ?? process.env;
  const now = deps.now ?? (() => Date.now());
  const log = deps.log ?? ((line) => process.stderr.write(`${line}\n`));
  const startedMs = now();
  const errors = [];
  const warnings = [];
  const fail = (step, err) => {
    const message = String(err?.message ?? err).slice(0, 500);
    errors.push({ step, message });
    log(`[v2-daily] ${step}: HATA ${message}`);
    return message;
  };

  const summary = {
    ok: false,
    mode: DEFAULTS.mode,
    trigger: env.GITHUB_EVENT_NAME || 'cli',
    started_at: new Date(startedMs).toISOString(),
    finished_at: null,
    duration_ms: null,
    options: null,
    steps: { collect: null, process: null, publish: null },
    queued: 0,
    rejectReasons: {},
    modelEvents: [],
    rateEvents: null,
    providerUsage: null,
    runId: null,
    errors,
    warnings,
    alarms: [],
    issue: null,
  };

  let opts;
  try {
    opts = parseArgs(argv);
  } catch (err) {
    fail('args', err);
    return finish(summary, { startedMs, now, env });
  }
  const apply = opts.mode === 'apply';
  summary.mode = opts.mode;
  summary.options = opts;
  const backfill = opts.backfillFrom
    ? ` backfill-from=${opts.backfillFrom} backfill-months=${opts.backfillMonths}`
    : '';
  log(
    `[v2-daily] mod=${opts.mode} collect-limit=${opts.collectLimit} process-limit=${opts.processLimit} publish=${opts.publish ? 'evet' : 'hayır'}${backfill}`,
  );

  // --- Supabase client (sadece apply) ---
  let client = null;
  if (apply) {
    try {
      client = await (deps.createClient ?? defaultCreateClient)(env);
    } catch (err) {
      fail('setup', err);
    }
  }
  const dbReady = !apply || client !== null;

  // --- 1. Topla ---
  let collectResult = null;
  if (dbReady) {
    try {
      const args = [apply ? '--apply' : '--dry-run', '--limit', String(opts.collectLimit)];
      if (opts.backfillFrom)
        args.push(
          '--backfill-from',
          opts.backfillFrom,
          '--backfill-months',
          String(opts.backfillMonths),
        );
      collectResult = await (deps.runCollect ?? runCollect)({
        args,
        log,
        now: new Date(now()),
        ...(apply ? { getClient: async () => client } : {}),
      });
      summary.steps.collect = summarizeCollect(collectResult);
      for (const id of summary.steps.collect.failedSources) {
        fail('collect', `kaynak ${id}: ${summary.steps.collect.bySource[id].error}`);
      }
    } catch (err) {
      summary.steps.collect = { ok: false, error: fail('collect', err) };
    }
  } else {
    summary.steps.collect = { ok: false, skipped: 'setup' };
  }

  // --- 2. İşle ---
  let llm = null;
  let usageStart = null;
  let processResult = null;
  const canProcess = dbReady && (apply || Boolean(collectResult?.outFile));
  if (canProcess) {
    try {
      const config = (deps.loadConfig ?? loadConfig)();
      const usageStore = deps.createUsageStore
        ? deps.createUsageStore(client)
        : apply
          ? createStateUsageStore({
              client,
              onError: (err, day) => {
                const msg = `LLM bütçe sayacı DB'ye yazılamadı (${day}): ${err.message}`;
                if (!warnings.includes(msg)) warnings.push(msg);
                log(`[v2-daily] UYARI ${msg}`);
              },
            })
          : createFileUsageStore();
      llm = (deps.createLlm ?? createLlm)(config, {
        usageStore,
        onEvent: (e) => {
          if (LOGGED_LLM_EVENTS.has(e.type)) log(formatLlmEvent(e));
        },
      });
      usageStart = (await llm.usage?.snapshot?.()) ?? null;
      const args = apply
        ? ['--apply', '--limit', String(opts.processLimit)]
        : ['--dry-run', '--input', collectResult.outFile, '--limit', String(opts.processLimit)];
      processResult = await (deps.runProcess ?? runProcess)(args, {
        log,
        llm,
        config,
        ...(apply
          ? { createDbRepo: async () => (deps.createStepsRepo ?? createStepsRepo)(client) }
          : {}),
      });
      const p = summarizeProcess(processResult);
      summary.steps.process = {
        ok: true,
        queued: p.queued,
        steps: p.steps,
      };
      summary.queued = p.queued;
      summary.rejectReasons = p.rejectReasons;
      summary.modelEvents = p.modelEvents;
      summary.rateEvents = p.rateEvents;
    } catch (err) {
      summary.steps.process = { ok: false, error: fail('process', err) };
    }
    try {
      const usageEnd = (await llm?.usage?.snapshot?.()) ?? null;
      if (usageEnd)
        summary.providerUsage = {
          day: usageEnd.date,
          run: usageDelta(usageStart, usageEnd),
          dayTotal: usageEnd.providers,
        };
    } catch (err) {
      warnings.push(`sağlayıcı kullanımı okunamadı: ${err.message}`);
    }
  } else {
    summary.steps.process = { ok: false, skipped: dbReady ? 'no_input' : 'setup' };
  }

  // --- 3. Yayınla (sadece --publish) ---
  if (!opts.publish) {
    summary.steps.publish = { skipped: 'no_publish_flag' };
  } else if (!dbReady) {
    summary.steps.publish = { ok: false, skipped: 'setup' };
  } else {
    try {
      const repo = apply
        ? (deps.createPublishRepo ?? createPublishRepo)(client)
        : createMemoryPublishRepo(processResult?.queued_facts ?? []);
      const { exitCode, result } = await (deps.runPublish ?? runPublish)({
        argv: apply ? ['--apply'] : ['--dry-run'],
        repo,
        now: new Date(now()),
        stdout: log,
        stderr: log,
      });
      if (exitCode !== 0 || !result?.ok)
        throw new Error(result?.error ?? `yayın adımı çıkış kodu ${exitCode}`);
      summary.steps.publish = summarizePublish(result);
    } catch (err) {
      summary.steps.publish = { ok: false, error: fail('publish', err) };
    }
  }

  return finish(summary, { startedMs, now, env, client, apply, deps, log, fail });
}

async function finish(
  summary,
  { startedMs, now, env, client = null, apply = false, deps = {}, log = () => {}, fail },
) {
  const finishedMs = now();
  summary.finished_at = new Date(finishedMs).toISOString();
  summary.duration_ms = finishedMs - startedMs;
  summary.alarms = computeAlarms(summary);
  summary.ok = summary.errors.length === 0;

  if (apply && client) {
    try {
      const row = buildRunRow(summary);
      const { id } = await (deps.insertRun ?? insertRun)(client, row);
      summary.runId = id;
    } catch (err) {
      fail('pipeline_runs', err);
      summary.ok = false;
      summary.alarms = computeAlarms(summary);
    }
  }

  summary.issue = summary.alarms.length
    ? formatAlarmIssue(summary, { runUrl: runUrlFromEnv(env) })
    : null;
  log(
    `[v2-daily] bitti: ok=${summary.ok} stoğa eklenen=${summary.queued} alarm=${summary.alarms.length ? summary.alarms.map((a) => a.code).join(',') : 'yok'} süre=${fmtDuration(summary.duration_ms)}`,
  );
  return summary;
}

async function main() {
  // stdout sadece özet JSON'a ayrılır: bağımlı modüllerdeki olası console.log'lar stderr'e gider.
  console.log = (...args) => console.error(...args);
  await import('dotenv/config');
  let summary;
  try {
    summary = await runDaily(process.argv.slice(2));
  } catch (err) {
    // runDaily adım hatalarını kendisi yakalar; buraya sadece beklenmeyen bir hata düşer.
    const message = String(err?.message ?? err);
    summary = { ok: false, mode: null, errors: [{ step: 'orchestrator', message }], alarms: [] };
    summary.alarms = computeAlarms(summary);
    summary.issue = formatAlarmIssue(
      { ...summary, started_at: new Date().toISOString() },
      { runUrl: runUrlFromEnv(process.env) },
    );
  }
  process.stdout.write(`${JSON.stringify(summary)}\n`);
  process.exitCode = summary.ok ? 0 : 1;
}

const invokedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invokedDirectly) {
  await main();
}
