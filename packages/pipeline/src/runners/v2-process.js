#!/usr/bin/env node
// src/runners/v2-process.js
// İçerik hattı v2 işleme adımları: dedup → score → support → write → (dedup-card) → verify → enqueue.
//
//   node src/runners/v2-process.js --input .cache/v2-collect-s1-2026-11-20.json            (dry-run, varsayılan)
//   node src/runners/v2-process.js --steps dedup,score --limit 30 --input adaylar.json
//   node src/runners/v2-process.js --apply --limit 100                                     (DB'ye yazar)
//
// --dry-run (varsayılan AÇIK): DB yerine bellek içi repo; adaylar --input JSON'dan
//   (V2-04 biçimi: { source_key, source, lang, hook_text, hook_hash, source_url, source_meta }),
//   sonuç .cache/v2-process-<tarih>.json. LLM ve Wikipedia çağrıları GERÇEKTİR.
// --apply: Supabase fact_candidates/facts üzerinde çalışır (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createFileUsageStore, createLlm, loadConfig } from '../llm/index.js';
import { createMemoryStepsRepo, createStepsRepo } from '../v2/db/steps-repo.js';
import { DEFAULT_STEP_NAMES, resolveSteps, runSteps } from '../v2/steps/index.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_CACHE_DIR = path.resolve(HERE, '../../.cache');
export const DEFAULT_LIMIT = 50;

export function parseArgs(argv) {
  const opts = { steps: DEFAULT_STEP_NAMES.join(','), limit: DEFAULT_LIMIT, apply: false, input: null, out: null, help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const next = () => {
      const v = argv[i + 1];
      if (v === undefined || v.startsWith('--')) throw new Error(`${a} bir değer bekliyor`);
      i += 1;
      return v;
    };
    if (a === '--steps') opts.steps = next();
    else if (a.startsWith('--steps=')) opts.steps = a.slice(8);
    else if (a === '--limit') opts.limit = Number(next());
    else if (a.startsWith('--limit=')) opts.limit = Number(a.slice(8));
    else if (a === '--input') opts.input = next();
    else if (a.startsWith('--input=')) opts.input = a.slice(8);
    else if (a === '--out') opts.out = next();
    else if (a === '--apply') opts.apply = true;
    else if (a === '--dry-run') opts.apply = false;
    else if (a === '--help' || a === '-h') opts.help = true;
    else throw new Error(`bilinmeyen argüman: ${a}`);
  }
  if (!Number.isInteger(opts.limit) || opts.limit <= 0) throw new Error('--limit pozitif bir tam sayı olmalı');
  resolveSteps(opts.steps); // geçersiz adım adını erkenden yakala
  return opts;
}

/** V2-04 dry-run çıktısı: dizi ya da { candidates | items | hooks: [...] }. */
export function normalizeInput(json) {
  const list = Array.isArray(json)
    ? json
    : (json?.candidates ?? json?.items ?? json?.hooks ?? Object.values(json ?? {}).find(Array.isArray));
  if (!Array.isArray(list)) throw new Error('--input dosyasında aday listesi bulunamadı');
  return list
    .filter((c) => c && typeof c.hook_text === 'string' && c.hook_text.trim() && c.source_key)
    .map((c, i) => ({
      id: `dry-${i + 1}`,
      source_key: c.source_key,
      source: c.source ?? null,
      lang: c.lang ?? 'en',
      hook_text: c.hook_text,
      hook_hash: c.hook_hash ?? null,
      source_url: c.source_url ?? null,
      source_meta: c.source_meta ?? {},
      status: 'new',
      attempts: 0,
    }));
}

function stripVectors(row) {
  const out = { ...row };
  if (Array.isArray(out.embedding)) out.embedding = `[vector ${out.embedding.length}]`;
  if (out.scores?.draft_embedding) {
    out.scores = { ...out.scores, draft_embedding: `[vector ${out.scores.draft_embedding.length}]` };
  }
  return out;
}

function summarize(candidates) {
  const counts = {};
  const reasons = {};
  for (const c of candidates) {
    counts[c.status] = (counts[c.status] ?? 0) + 1;
    if (c.status === 'rejected') reasons[c.reject_reason] = (reasons[c.reject_reason] ?? 0) + 1;
  }
  return { counts, reasons };
}

async function defaultCreateDbRepo() {
  const { createClient } = await import('@supabase/supabase-js');
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('--apply için SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY gerekli');
  return createStepsRepo(createClient(url, key, { auth: { persistSession: false } }));
}

/** LLM olaylarından log'a yazılanlar (başarılı çağrılar yazılmaz). */
const LOGGED_EVENTS = new Set([
  'retry',
  'provider_failed',
  'model_unavailable',
  'quota_exhausted',
  'budget_skip',
  'missing_credentials',
  'json_repair',
  'truncated',
]);

/** LLM olayını tek satır log'a çevirir. Olaylarda anahtar yok (LLM katmanı temizler). */
export function formatLlmEvent(e) {
  const where = `role=${e.role} ${e.provider}/${e.model}`;
  const extra = [
    e.kind && `kind=${e.kind}`,
    e.status && `status=${e.status}`,
    e.attempt && `deneme=${e.attempt}`,
    e.delayMs !== undefined && `bekleme=${e.delayMs}ms`,
    e.reason && `neden=${e.reason}`,
    e.scope && `kapsam=${e.scope}`,
    e.env && `env=${[].concat(e.env).join(',')}`,
    e.maxTokens && `maxTokens=${e.maxTokens}`,
    e.outputTokens !== undefined && `çıktı=${e.outputTokens}`,
  ].filter(Boolean);
  const msg = e.error ? ` :: ${String(e.error).slice(0, 200)}` : '';
  return `[llm] ${e.type} ${where}${extra.length ? ` ${extra.join(' ')}` : ''}${msg}`;
}

/** Dakikalık sınır olayları: her biri ayrı satır, [rate] önekiyle (V2-05f). */
const RATE_EVENTS = new Set(['rate_wait', 'request_too_large', 'rate_limit_learned']);

/** Dakikalık sınır olayını tek satır log'a çevirir. */
export function formatRateEvent(e) {
  const where = `role=${e.role} ${e.provider}/${e.model}`;
  if (e.type === 'rate_wait') {
    const limits = [
      e.tokensPerMinute && `TPM=${e.tokensPerMinute}`,
      e.outputTokensPerMinute && `OTPM=${e.outputTokensPerMinute}`,
    ].filter(Boolean);
    const sec = Math.round((e.delayMs ?? 0) / 100) / 10;
    return `[rate] bekleme ${where} süre=${sec}sn pencere=${e.windowTokens ?? '?'}/${e.windowOutputTokens ?? '?'}çıktı istek=${e.needInput ?? '?'}+${e.needOutput ?? '?'}${limits.length ? ` ${limits.join(' ')}` : ''}`;
  }
  if (e.type === 'rate_limit_learned') {
    return `[rate] sınır öğrenildi ${where} ${e.metric}=${e.limit} (önceki=${e.previous ?? 'yok'})`;
  }
  const extra = [e.status && `status=${e.status}`, e.metric && `${e.metric}`, e.limit && `limit=${e.limit}`].filter(Boolean);
  const msg = e.error ? ` :: ${String(e.error).slice(0, 300)}` : '';
  return `[rate] çok büyük istek ${where}${extra.length ? ` ${extra.join(' ')}` : ''}${msg}`;
}

function defaultCreateLlm(config, log) {
  return createLlm(config, {
    usageStore: createFileUsageStore(),
    onEvent: (e) => {
      if (LOGGED_EVENTS.has(e.type)) log(formatLlmEvent(e));
      else if (RATE_EVENTS.has(e.type)) log(formatRateEvent(e));
    },
  });
}

/**
 * Test edilebilir giriş noktası. Tüm dış bağımlılıklar enjekte edilebilir.
 * @param {string[]} argv
 * @param {object} [deps]
 */
export async function runProcess(argv, deps = {}) {
  const opts = parseArgs(argv);
  const log = deps.log ?? ((m) => console.log(m));
  if (opts.help) {
    log('Kullanım: v2-process.js [--steps dedup,score,support,write,verify,enqueue] [--limit N] [--dry-run | --apply] [--input aday.json] [--out sonuc.json]');
    return { help: true };
  }
  const now = deps.now ?? (() => Date.now());
  const config = deps.config ?? (deps.loadConfig ?? loadConfig)();
  const llm = deps.llm ?? (deps.createLlm ?? defaultCreateLlm)(config, deps.stepLog ?? log);

  let repo;
  let inputCount = null;
  if (opts.apply) {
    repo = await (deps.createDbRepo ?? defaultCreateDbRepo)();
  } else {
    if (!opts.input) throw new Error('--dry-run için --input <aday json dosyası> gerekli (DB okunmaz)');
    const read = deps.readFile ?? ((p) => readFile(p, 'utf8'));
    const candidates = normalizeInput(JSON.parse(await read(opts.input)));
    inputCount = candidates.length;
    repo = createMemoryStepsRepo({ candidates });
  }

  const startedAt = new Date(now()).toISOString();
  log(`[v2-process] mod=${opts.apply ? 'APPLY (DB)' : 'dry-run (bellek içi)'} adımlar=${resolveSteps(opts.steps).join(',')} limit=${opts.limit}`);
  const { steps, stats } = await runSteps(opts.steps, { llm, repo, config, now, log: deps.stepLog ?? log, fetch: deps.fetch }, { limit: opts.limit });

  for (const name of steps) {
    const s = stats[name];
    const rej = Object.entries(s.rejected).map(([k, v]) => `${k}=${v}`).join(' ');
    log(`[v2-process] ${name}: görülen=${s.seen} ilerleyen=${s.advanced} red={${rej}} hata=${s.failed} ertelenen=${s.deferred}`);
    if (s.exhaustedReason) log(`[v2-process] ${name}: zincir tükenme nedeni: ${s.exhaustedReason}`);
  }

  const result = { mode: opts.apply ? 'apply' : 'dry-run', started_at: startedAt, finished_at: new Date(now()).toISOString(), steps, limit: opts.limit, stats };

  if (!opts.apply) {
    const candidates = repo.candidates();
    const { counts, reasons } = summarize(candidates);
    Object.assign(result, {
      input: opts.input,
      input_count: inputCount,
      status_counts: counts,
      reject_reasons: reasons,
      candidates: candidates.map(stripVectors),
      queued_facts: repo.facts().map(stripVectors),
    });
    const day = new Date(now()).toISOString().slice(0, 10);
    const outPath = opts.out ?? path.join(deps.cacheDir ?? DEFAULT_CACHE_DIR, `v2-process-${day}.json`);
    const write = deps.writeFile ?? (async (p, data) => {
      await mkdir(path.dirname(p), { recursive: true });
      await writeFile(p, data, 'utf8');
    });
    await write(outPath, `${JSON.stringify(result, null, 2)}\n`);
    result.output = outPath;
    log(`[v2-process] durumlar: ${JSON.stringify(counts)} · çıktı: ${outPath}`);
  }
  return result;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
  (async () => {
    await import('dotenv/config');
    await runProcess(process.argv.slice(2));
  })().catch((err) => {
    console.error(`[v2-process] HATA: ${err?.message ?? err}`);
    process.exitCode = 1;
  });
}
