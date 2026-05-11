#!/usr/bin/env node
import 'dotenv/config';
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const DEFAULT_HOURS = 12;
const DEFAULT_FLOOR = 15;

function parseNonNegativeInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) || parsed < 0 ? fallback : parsed;
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const config = {
    hours: DEFAULT_HOURS,
    floor: DEFAULT_FLOOR,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const nextValue = args[index + 1];

    if (!nextValue || nextValue.startsWith('--')) {
      continue;
    }

    if (arg === '--hours') {
      config.hours = parseNonNegativeInt(nextValue, config.hours);
    }

    if (arg === '--floor') {
      config.floor = parseNonNegativeInt(nextValue, config.floor);
    }
  }

  return config;
}

function validateEnv() {
  const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
  const missing = required.filter(
    (key) => !process.env[key] || process.env[key].startsWith('your_'),
  );

  if (missing.length > 0) {
    console.error('[FactsIngestWindow] Missing env:', missing.join(', '));
    process.exit(1);
  }
}

function writeGithubOutput(values) {
  if (!process.env.GITHUB_OUTPUT) {
    return;
  }

  const output = Object.entries(values)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `${output}\n`);
}

function writeGithubSummary(config, count, needsIngest, cutoff) {
  if (!process.env.GITHUB_STEP_SUMMARY) {
    return;
  }

  const rows = [
    '## Facts ingest window check',
    '',
    `- window_hours: ${config.hours}`,
    `- floor: ${config.floor}`,
    `- created_since: ${cutoff.toISOString()}`,
    `- window_count: ${count}`,
    `- needs_ingest: ${needsIngest}`,
    '',
  ];

  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, rows.join('\n'));
}

async function main() {
  validateEnv();

  const config = parseArgs(process.argv);
  const cutoff = new Date(Date.now() - config.hours * 60 * 60 * 1000);
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { count, error } = await supabase
    .from('facts')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', cutoff.toISOString());

  if (error) {
    console.error('[FactsIngestWindow] facts count failed:', error.message);
    process.exit(1);
  }

  const windowCount = count ?? 0;
  const needsIngest = windowCount < config.floor;

  console.log('=== FACTS INGEST WINDOW ===');
  console.log(`hours: ${config.hours}`);
  console.log(`floor: ${config.floor}`);
  console.log(`created_since: ${cutoff.toISOString()}`);
  console.log(`window_count: ${windowCount}`);
  console.log(`needs_ingest: ${needsIngest}`);

  writeGithubOutput({
    needs_ingest: needsIngest,
    window_count: windowCount,
    floor: config.floor,
    hours: config.hours,
  });
  writeGithubSummary(config, windowCount, needsIngest, cutoff);
}

main().catch((error) => {
  console.error('[FactsIngestWindow] critical failure:', error);
  process.exit(1);
});
