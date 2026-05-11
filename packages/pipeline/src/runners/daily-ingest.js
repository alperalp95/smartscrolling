#!/usr/bin/env node
import 'dotenv/config';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const DEFAULT_TARGET_SAVED = 15;
const DEFAULT_WIKIPEDIA_TARGET = 8;
const DEFAULT_WIKIPEDIA_MAX_CANDIDATES = 45;
const DEFAULT_WIKIPEDIA_MAX_GROQ = 16;
const DEFAULT_PDF_RESERVE_MAX_COUNT = 12;
const DEFAULT_PDF_RESERVE_ATTEMPTS = 3;
const PDF_DATA_DIR = path.resolve(process.cwd(), 'data', 'pdf-curated');
const PDF_FILE_PREFIX = 'luzumsuz-bilgiler-';

function parseNonNegativeInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) || parsed < 0 ? fallback : parsed;
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const config = {
    targetSaved: DEFAULT_TARGET_SAVED,
    wikipediaTarget: DEFAULT_WIKIPEDIA_TARGET,
    wikipediaMaxCandidates: DEFAULT_WIKIPEDIA_MAX_CANDIDATES,
    wikipediaMaxGroq: DEFAULT_WIKIPEDIA_MAX_GROQ,
    pdfReserveMaxCount: DEFAULT_PDF_RESERVE_MAX_COUNT,
    pdfReserveAttempts: DEFAULT_PDF_RESERVE_ATTEMPTS,
    pdfReserve: true,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const nextValue = args[index + 1];

    if (arg === '--no-pdf-reserve') {
      config.pdfReserve = false;
      continue;
    }

    if (!nextValue || nextValue.startsWith('--')) {
      continue;
    }

    if (arg === '--target-saved') {
      config.targetSaved = parseNonNegativeInt(nextValue, config.targetSaved);
    }

    if (arg === '--wikipedia-target') {
      config.wikipediaTarget = parseNonNegativeInt(nextValue, config.wikipediaTarget);
    }

    if (arg === '--wikipedia-max-candidates') {
      config.wikipediaMaxCandidates = parseNonNegativeInt(nextValue, config.wikipediaMaxCandidates);
    }

    if (arg === '--wikipedia-max-groq') {
      config.wikipediaMaxGroq = parseNonNegativeInt(nextValue, config.wikipediaMaxGroq);
    }

    if (arg === '--pdf-reserve-max-count') {
      config.pdfReserveMaxCount = parseNonNegativeInt(nextValue, config.pdfReserveMaxCount);
    }

    if (arg === '--pdf-reserve-attempts') {
      config.pdfReserveAttempts = parseNonNegativeInt(nextValue, config.pdfReserveAttempts);
    }
  }

  return config;
}

function validateEnv() {
  const required = ['GROQ_API_KEY', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
  const missing = required.filter(
    (key) => !process.env[key] || process.env[key].startsWith('your_'),
  );

  if (missing.length > 0) {
    console.error('[DailyIngest] Missing env:', missing.join(', '));
    process.exit(1);
  }
}

function runNodeScript(scriptPath, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath, ...args], {
      cwd: process.cwd(),
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';

    child.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      output += text;
      process.stdout.write(text);
    });

    child.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      output += text;
      process.stderr.write(text);
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve({ code, output });
        return;
      }

      const error = new Error(`[DailyIngest] child process failed code=${code}`);
      error.output = output;
      reject(error);
    });
  });
}

function parseMetric(output, metric) {
  const matches = [...output.matchAll(new RegExp(`^\\s*${metric}:\\s*(\\d+)\\s*$`, 'gm'))];
  const last = matches[matches.length - 1];
  return last ? Number.parseInt(last[1], 10) : 0;
}

function parseStopReason(output, sourceLabel) {
  const escaped = sourceLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = output.match(new RegExp(`\\[RunAll\\]\\s+${escaped}\\s+stop_reason=([^\\s]+)`));
  return match?.[1] ?? 'unknown';
}

function collectSummary(label, output) {
  return {
    label,
    saved: parseMetric(output, 'saved'),
    qualityRejected: parseMetric(output, 'quality_rejected'),
    duplicateSourceUrl: parseMetric(output, 'duplicate_source_url'),
    duplicateTitle: parseMetric(output, 'duplicate_title'),
    duplicateRecentTopic: parseMetric(output, 'duplicate_recent_topic'),
    groqFailed: parseMetric(output, 'groq_failed'),
    rateLimited: parseMetric(output, 'rate_limited'),
    stopReason: label === 'Wikipedia' ? parseStopReason(output, 'Wikipedia') : 'completed',
  };
}

function listPdfFiles() {
  if (!fs.existsSync(PDF_DATA_DIR)) {
    return [];
  }

  return fs
    .readdirSync(PDF_DATA_DIR)
    .filter((fileName) => fileName.startsWith(PDF_FILE_PREFIX) && fileName.endsWith('.json'))
    .sort()
    .map((fileName) => path.join(PDF_DATA_DIR, fileName));
}

function countPdfEntries(filePath) {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/u, ''));
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

function selectPdfReserveSource(now = new Date(), attempt = 0) {
  const files = listPdfFiles().filter((filePath) => countPdfEntries(filePath) > 0);

  if (files.length === 0) {
    return null;
  }

  const dayIndex = Math.floor(now.getTime() / (24 * 60 * 60 * 1000));
  const runWindow = now.getUTCHours() < 12 ? 0 : 1;
  const fileIndex = (dayIndex * 2 + runWindow + attempt) % files.length;
  const filePath = files[fileIndex];
  const entryCount = countPdfEntries(filePath);
  const offset = entryCount > 0 ? ((dayIndex + runWindow + attempt) * 7) % entryCount : 0;

  return { filePath, offset, entryCount };
}

async function fetchFactCounts() {
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const since24 = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const since7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const [last24, last7] = await Promise.all([
    supabase.from('facts').select('id', { count: 'exact', head: true }).gte('created_at', since24),
    supabase.from('facts').select('id', { count: 'exact', head: true }).gte('created_at', since7),
  ]);

  if (last24.error) {
    throw new Error(`[DailyIngest] last24 count failed: ${last24.error.message}`);
  }

  if (last7.error) {
    throw new Error(`[DailyIngest] last7 count failed: ${last7.error.message}`);
  }

  return {
    last24: last24.count ?? 0,
    last7: last7.count ?? 0,
  };
}

function writeGithubSummary({ config, summaries, totalSaved, factCounts, pdfReserveSource }) {
  if (!process.env.GITHUB_STEP_SUMMARY) {
    return;
  }

  const rows = [
    '## Facts daily ingest',
    '',
    `- target_saved: ${config.targetSaved}`,
    `- total_saved_this_run: ${totalSaved}`,
    `- facts_last_24h: ${factCounts.last24}`,
    `- facts_last_7d: ${factCounts.last7}`,
    '',
    '| Lane | Saved | Quality rejected | Duplicate source | Duplicate title | Duplicate recent | Groq failed | Rate limited | Stop reason |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |',
    ...summaries.map(
      (summary) =>
        `| ${summary.label} | ${summary.saved} | ${summary.qualityRejected} | ${summary.duplicateSourceUrl} | ${summary.duplicateTitle} | ${summary.duplicateRecentTopic} | ${summary.groqFailed} | ${summary.rateLimited} | ${summary.stopReason} |`,
    ),
  ];

  if (pdfReserveSource) {
    rows.push(
      '',
      `PDF reserve file: \`${path.relative(process.cwd(), pdfReserveSource.filePath)}\``,
      `PDF reserve offset: ${pdfReserveSource.offset}`,
    );
  }

  rows.push('');
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, rows.join('\n'));
}

async function main() {
  validateEnv();

  const startedAt = Date.now();
  const config = parseArgs(process.argv);
  const scriptPath = fileURLToPath(new URL('./run-all.js', import.meta.url));
  const summaries = [];

  console.log(
    `[DailyIngest] started target_saved=${config.targetSaved} wikipedia_target=${config.wikipediaTarget} pdf_reserve=${config.pdfReserve}`,
  );

  const wikipediaTarget = Math.min(config.targetSaved, config.wikipediaTarget);
  const wikipediaSummary =
    wikipediaTarget > 0
      ? collectSummary(
          'Wikipedia',
          (
            await runNodeScript(scriptPath, [
              '--wikipedia-lang',
              'tr',
              '--wikipedia-count',
              String(wikipediaTarget),
              '--target-saved',
              String(wikipediaTarget),
              '--max-candidates',
              String(config.wikipediaMaxCandidates),
              '--max-groq',
              String(config.wikipediaMaxGroq),
              '--stanford-count',
              '0',
              '--medlineplus-count',
              '0',
              '--nasa-count',
              '0',
              '--pdf-curated-count',
              '0',
            ])
          ).output,
        )
      : {
          label: 'Wikipedia',
          saved: 0,
          qualityRejected: 0,
          duplicateSourceUrl: 0,
          duplicateTitle: 0,
          duplicateRecentTopic: 0,
          groqFailed: 0,
          rateLimited: 0,
          stopReason: 'skipped',
        };
  summaries.push(wikipediaSummary);

  let totalSaved = wikipediaSummary.saved;
  let pdfReserveSource = null;
  const remaining = Math.max(config.targetSaved - totalSaved, 0);

  if (config.pdfReserve && remaining > 0) {
    pdfReserveSource = selectPdfReserveSource();

    if (!pdfReserveSource) {
      console.warn('[DailyIngest] PDF reserve skipped: no curated source files found.');
    } else {
      for (
        let attempt = 0;
        totalSaved < config.targetSaved && attempt < config.pdfReserveAttempts;
        attempt += 1
      ) {
        const attemptSource = selectPdfReserveSource(new Date(), attempt);

        if (!attemptSource) {
          break;
        }

        pdfReserveSource = attemptSource;
        const attemptRemaining = Math.max(config.targetSaved - totalSaved, 0);
        const pdfCount = Math.min(config.pdfReserveMaxCount, Math.max(attemptRemaining * 2, 4));
        console.log(
          `[DailyIngest] PDF reserve attempt=${attempt + 1} remaining=${attemptRemaining} count=${pdfCount} file=${path.relative(process.cwd(), attemptSource.filePath)} offset=${attemptSource.offset}`,
        );
        const pdfRun = await runNodeScript(scriptPath, [
          '--wikipedia-count',
          '0',
          '--stanford-count',
          '0',
          '--medlineplus-count',
          '0',
          '--nasa-count',
          '0',
          '--pdf-curated-count',
          String(pdfCount),
          '--pdf-curated-file',
          attemptSource.filePath,
          '--pdf-curated-offset',
          String(attemptSource.offset),
        ]);
        const pdfSummary = collectSummary(`PDF Curated ${attempt + 1}`, pdfRun.output);
        summaries.push(pdfSummary);
        totalSaved += pdfSummary.saved;
      }
    }
  }

  const factCounts = await fetchFactCounts();
  writeGithubSummary({ config, summaries, totalSaved, factCounts, pdfReserveSource });

  console.log('=== DAILY INGEST SUMMARY ===');
  console.log(`target_saved: ${config.targetSaved}`);
  console.log(`total_saved_this_run: ${totalSaved}`);
  console.log(`facts_last_24h: ${factCounts.last24}`);
  console.log(`facts_last_7d: ${factCounts.last7}`);
  console.log(`duration_seconds: ${((Date.now() - startedAt) / 1000).toFixed(1)}`);
}

main().catch((error) => {
  console.error('[DailyIngest] critical failure:', error);
  process.exit(1);
});
