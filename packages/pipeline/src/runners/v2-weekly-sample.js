#!/usr/bin/env node
// İçerik hattı v2 — haftalık örnek: son 7 günde yayınlanan kartlardan rastgele 10 tanesini
// checkbox'lı bir GitHub Issue metni olarak hazırlar (spec §10: "her hafta 10 rastgele kart").
//
//   node src/runners/v2-weekly-sample.js                  # dry-run (varsayılan): Issue metnini stdout'a basar
//   node src/runners/v2-weekly-sample.js --count 10 --days 7
//   node src/runners/v2-weekly-sample.js --create-issue   # metni `gh issue create` ile Issue olarak açar
//
// Veritabanından sadece OKUR (facts, status='published'). `--create-issue` GitHub Actions'ta çalışır:
// `gh` CLI ve `GH_TOKEN` gerekir; etiket `weekly-sample` yoksa oluşturulur.
import { execFile } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const DEFAULT_COUNT = 10;
export const DEFAULT_DAYS = 7;
export const LABEL = 'weekly-sample';
/** 100 kart/gün × 7 gün = 700; bunun üstü örnekleme için gereksiz. */
export const MAX_ROWS = 2000;
const BODY_MAX_CHARS = 600;

function positiveInt(raw, label) {
  const text = String(raw ?? '').trim();
  if (!/^\d+$/.test(text) || Number(text) <= 0)
    throw new Error(`${label} pozitif tam sayı olmalı: ${raw}`);
  return Number(text);
}

/** @param {string[]} argv */
export function parseArgs(argv) {
  const opts = { count: DEFAULT_COUNT, days: DEFAULT_DAYS, createIssue: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const eq = arg.indexOf('=');
    const flag = eq === -1 ? arg : arg.slice(0, eq);
    const value = () => (eq === -1 ? argv[++i] : arg.slice(eq + 1));
    if (flag === '--count') opts.count = positiveInt(value(), '--count');
    else if (flag === '--days') opts.days = positiveInt(value(), '--days');
    else if (flag === '--dry-run') opts.createIssue = false;
    else if (flag === '--create-issue') opts.createIssue = true;
    else throw new Error(`bilinmeyen argüman: ${arg}`);
  }
  return opts;
}

/**
 * @param {{ from: Function }} client
 * @returns {{ listPublishedSince(sinceIso: string): Promise<object[]> }}
 */
export function createSampleRepo(client) {
  if (!client || typeof client.from !== 'function')
    throw new TypeError('createSampleRepo: Supabase client gerekli');
  return {
    async listPublishedSince(sinceIso) {
      const { data, error } = await client
        .from('facts')
        .select('id,title,content,category,source_url,attribution,published_at')
        .eq('status', 'published')
        .gte('published_at', sinceIso)
        .order('published_at', { ascending: false })
        .limit(MAX_ROWS);
      if (error) throw new Error(`facts okunamadı: ${error.message}`);
      return data ?? [];
    },
  };
}

/**
 * Rastgele k öğe (kısmi Fisher-Yates). `random` testte sabitlenir.
 * @template T
 * @param {T[]} items
 * @param {number} k
 * @param {() => number} [random]
 * @returns {T[]}
 */
export function pickRandom(items, k, random = Math.random) {
  const arr = [...items];
  const n = Math.min(k, arr.length);
  for (let i = 0; i < n; i += 1) {
    const j = i + Math.floor(random() * (arr.length - i));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, n);
}

const oneLine = (text) =>
  String(text ?? '')
    .replace(/\s+/g, ' ')
    .trim();

function clip(text, max) {
  const t = oneLine(text);
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

/**
 * Issue başlığı + metni (Türkçe, sade). Her kart bir checkbox: işaretlenen = kötü/hatalı kart.
 * @param {object[]} cards
 * @param {{ now: Date, days?: number, totalPublished?: number }} o
 */
export function formatSampleIssue(
  cards,
  { now, days = DEFAULT_DAYS, totalPublished = cards.length },
) {
  const day = now.toISOString().slice(0, 10);
  const title = `Haftalık kart örneği (${day}): ${cards.length} kart`;
  const lines = [
    `Son ${days} günde yayınlanan ${totalPublished} karttan rastgele seçilen ${cards.length} kart.`,
    '',
    '**Nasıl değerlendirilir?** Her kartı okuyun. **Kötü** bulduğunuz kartın kutusunu işaretleyin ' +
      '(yanlış bilgi, sıkıcı / "X nedir" tarzı, bozuk Türkçe, başlık metinle uyuşmuyor…). ' +
      'Nedenini kısaca bu Issue\'ya yorum olarak yazın (ör. "3: yanlış tarih"). İyi kartlara dokunmayın.',
    '',
    "Hedef: 10 karttan en az 8'i iyi, hiç yanlış bilgi yok. İşaretlenen kartlar istem ve eşik ayarına girdi olur.",
    '',
    '---',
    '',
  ];
  if (cards.length === 0) {
    lines.push(
      `Son ${days} günde yayınlanmış kart yok. Hat çalışıyor mu? Açık \`pipeline-alarm\` Issue'larına bakın.`,
    );
  }
  cards.forEach((card, i) => {
    const category = card.category ? ` · ${oneLine(card.category)}` : '';
    lines.push(`- [ ] **${i + 1}. ${oneLine(card.title) || '(başlıksız)'}**${category}`);
    lines.push(`  ${clip(card.content, BODY_MAX_CHARS) || '(metin yok)'}`);
    lines.push(`  Kaynak: ${card.source_url ? `<${card.source_url}>` : '(link yok)'}`);
    lines.push('');
  });
  lines.push(
    "<sub>Bu Issue `content-v2-weekly-sample` workflow'u tarafından otomatik açıldı. Değerlendirince kapatabilirsiniz.</sub>",
  );
  return { title, body: lines.join('\n') };
}

function defaultExec(cmd, args, { input } = {}) {
  return new Promise((resolve, reject) => {
    const child = execFile(cmd, args, { encoding: 'utf8' }, (err, stdout, stderr) => {
      if (err)
        reject(new Error(`${cmd} ${args[0]} ${args[1] ?? ''} başarısız: ${stderr || err.message}`));
      else resolve(stdout);
    });
    if (input !== undefined) child.stdin.end(input);
  });
}

/**
 * `gh` ile Issue açar. Etiket yoksa oluşturur (`--force`: varsa günceller).
 * @param {{ title: string, body: string }} issue
 * @param {(cmd: string, args: string[], opts?: { input?: string }) => Promise<string>} exec
 */
export async function createIssue(issue, exec = defaultExec) {
  await exec('gh', [
    'label',
    'create',
    LABEL,
    '--color',
    '0E8A16',
    '--description',
    'İçerik hattı haftalık kart örneği',
    '--force',
  ]);
  const out = await exec(
    'gh',
    ['issue', 'create', '--title', issue.title, '--label', LABEL, '--body-file', '-'],
    {
      input: issue.body,
    },
  );
  return String(out ?? '').trim();
}

/**
 * Test edilebilir çekirdek.
 * @param {string[]} argv
 * @param {{ repo: { listPublishedSince(iso: string): Promise<object[]> }, now?: Date, random?: () => number,
 *           exec?: Function, stdout?: (s: string) => void, log?: (s: string) => void }} deps
 */
export async function runWeeklySample(argv, deps) {
  const opts = parseArgs(argv);
  const now = deps.now ?? new Date();
  const stdout = deps.stdout ?? ((s) => process.stdout.write(`${s}\n`));
  const log = deps.log ?? ((s) => process.stderr.write(`${s}\n`));
  const since = new Date(now.getTime() - opts.days * 24 * 60 * 60 * 1000).toISOString();
  const rows = await deps.repo.listPublishedSince(since);
  const cards = pickRandom(rows, opts.count, deps.random ?? Math.random);
  const issue = formatSampleIssue(cards, { now, days: opts.days, totalPublished: rows.length });
  log(
    `[v2-weekly-sample] son ${opts.days} gün: ${rows.length} yayınlanmış kart, örnek ${cards.length}`,
  );
  if (!opts.createIssue) {
    stdout(`# ${issue.title}\n\n${issue.body}`);
    log('[v2-weekly-sample] dry-run: Issue açılmadı (açmak için --create-issue)');
    return { issue, cards, created: null };
  }
  const url = await createIssue(issue, deps.exec);
  log(`[v2-weekly-sample] Issue açıldı: ${url}`);
  return { issue, cards, created: url };
}

async function main() {
  await import('dotenv/config');
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY gerekli');
  const { createClient } = await import('@supabase/supabase-js');
  const repo = createSampleRepo(createClient(url, key, { auth: { persistSession: false } }));
  await runWeeklySample(process.argv.slice(2), { repo });
}

const invokedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invokedDirectly) {
  main().catch((err) => {
    console.error(`[v2-weekly-sample] HATA: ${err?.message ?? err}`);
    process.exitCode = 1;
  });
}
