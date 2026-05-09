#!/usr/bin/env node
import 'dotenv/config';
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const DEFAULT_FLOOR = 100;
const DEFAULT_DAYS = 7;

function parseNonNegativeInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) || parsed < 0 ? fallback : parsed;
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const config = {
    floor: DEFAULT_FLOOR,
    days: DEFAULT_DAYS,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const nextValue = args[index + 1];

    if (!nextValue || nextValue.startsWith('--')) {
      continue;
    }

    if (arg === '--floor') {
      config.floor = parseNonNegativeInt(nextValue, config.floor);
    }

    if (arg === '--days') {
      config.days = parseNonNegativeInt(nextValue, config.days);
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
    console.error('[WeeklyFactsTarget] Missing env:', missing.join(', '));
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

async function main() {
  validateEnv();

  const config = parseArgs(process.argv);
  const cutoff = new Date(Date.now() - config.days * 24 * 60 * 60 * 1000);
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { count, error } = await supabase
    .from('facts')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', cutoff.toISOString());

  if (error) {
    console.error('[WeeklyFactsTarget] facts count failed:', error.message);
    process.exit(1);
  }

  const weeklyCount = count ?? 0;
  const needsCatchup = weeklyCount < config.floor;

  console.log('=== WEEKLY FACTS TARGET ===');
  console.log(`days: ${config.days}`);
  console.log(`floor: ${config.floor}`);
  console.log(`created_since: ${cutoff.toISOString()}`);
  console.log(`weekly_count: ${weeklyCount}`);
  console.log(`needs_catchup: ${needsCatchup}`);

  writeGithubOutput({
    needs_catchup: needsCatchup,
    weekly_count: weeklyCount,
    floor: config.floor,
  });
}

main().catch((error) => {
  console.error('[WeeklyFactsTarget] critical failure:', error);
  process.exit(1);
});
