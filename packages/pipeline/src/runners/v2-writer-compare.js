#!/usr/bin/env node
// İçerik hattı v2 — kör yazar karşılaştırması: aynı kancaları 3 yazar modeline yazdırır,
// kartları karışık sırada (A/B/C) bir md dosyasına döker; hangi harfin hangi model olduğu ayrı
// bir anahtar dosyasında durur. Doğrulama/onarım YOK, sadece ham yazım.
//
//   node src/runners/v2-writer-compare.js --input .cache/v2-process-2026-11-20.json [--count 15] [--seed 42]
//
// Çıktı (.cache/): writer-compare-<tarih>.md (puanlanacak kartlar) + writer-compare-<tarih>.key.json (anahtar).
// GROQ_API_KEY, CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID ortam değişkenleri gerekir; DB okunmaz.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createLlm, loadConfig } from '../llm/index.js';
import { WRITE_MAX_TOKENS, buildWritePrompt } from '../v2/prompts/write.js';
import { writingLimits } from '../v2/steps/write.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_CACHE_DIR = path.resolve(HERE, '../../.cache');

export const DEFAULT_COUNT = 15;
export const DEFAULT_SEED = 42;
export const WRITERS = Object.freeze([
  'groq:openai/gpt-oss-120b',
  'groq:openai/gpt-oss-20b',
  'cloudflare:@cf/mistralai/mistral-small-3.1-24b-instruct',
]);
const NORMALIZED = Symbol.for('smartscrolling.pipeline.llmConfig.normalized');
export const LABELS = Object.freeze(['A', 'B', 'C', 'D', 'E', 'F']);

function positiveInt(raw, label) {
  const text = String(raw ?? '').trim();
  if (!/^\d+$/.test(text) || Number(text) <= 0)
    throw new Error(`${label} pozitif tam sayı olmalı: ${raw}`);
  return Number(text);
}

/** @param {string[]} argv */
export function parseArgs(argv) {
  const opts = { input: null, count: DEFAULT_COUNT, seed: DEFAULT_SEED };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const eq = arg.indexOf('=');
    const flag = eq === -1 ? arg : arg.slice(0, eq);
    const value = () => (eq === -1 ? argv[++i] : arg.slice(eq + 1));
    if (flag === '--input') opts.input = value();
    else if (flag === '--count') opts.count = positiveInt(value(), '--count');
    else if (flag === '--seed') opts.seed = positiveInt(value(), '--seed');
    else throw new Error(`bilinmeyen argüman: ${arg}`);
  }
  return opts;
}

/** Deterministik rastgele (mulberry32). */
export function seededRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle(items, rand) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** dry-run çıktısından (ya da düz liste) yazıma uygun adaylar. */
export function pickCandidates(data, count) {
  const list = Array.isArray(data) ? data : data?.candidates;
  if (!Array.isArray(list)) throw new Error('--input dosyasında aday listesi bulunamadı');
  return list
    .filter(
      (c) => c && (c.scores?.draft || c.support_paragraph) && c.hook_text && c.support_paragraph,
    )
    .slice(0, count)
    .map((c) => ({
      hook: c.hook_text,
      lang: c.lang,
      support: c.support_paragraph,
      category: c.scores?.category,
    }));
}

/** "provider:model" ayrıştırır (ilk ':' ayırıcı). */
export function splitWriter(spec) {
  const i = spec.indexOf(':');
  if (i <= 0) throw new Error(`yazar 'sağlayıcı:model' biçiminde olmalı: ${spec}`);
  return { provider: spec.slice(0, i), model: spec.slice(i + 1) };
}

/** Config kopyasında writer zincirini tek modele indirger (ham ya da normalize config). */
export function configWithWriter(config, spec) {
  const { provider, model } = splitWriter(spec);
  const base = { ...config.roles.writer };
  delete base.sameAs;
  if (base.steps) {
    delete base.chain;
    base.steps = [{ strategy: 'single', members: [{ provider, model, params: {} }] }];
  } else {
    base.chain = [{ provider, model }];
  }
  const copy = { ...config, roles: { ...config.roles, writer: base } };
  // Spread normalize işaretini düşürür; normalize config'te geri ekle (yeniden doğrulama olmasın).
  if (base.steps) Object.defineProperty(copy, NORMALIZED, { value: true, enumerable: false });
  return copy;
}

function oneLine(text) {
  return String(text ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function formatMarkdown({ cards, date }) {
  const lines = [
    `# Yazar karşılaştırması (${date})`,
    '',
    'Her kartı 1–5 puanlayın: akıcı Türkçe, doğru çeviri, ilginçlik.',
    '',
  ];
  cards.forEach((entry, i) => {
    lines.push(
      `## Bilgi ${i + 1}`,
      '',
      `Kanca (${entry.lang || 'en'}): ${oneLine(entry.hook)}`,
      '',
    );
    for (const card of entry.cards) {
      lines.push(`### ${card.label}`, '');
      if (card.error) lines.push('(hata)');
      else lines.push(`**${oneLine(card.title)}**`, '', String(card.content ?? '').trim());
      lines.push('', 'Puan (1-5): ___', '');
    }
  });
  return `${lines.join('\n')}\n`;
}

/**
 * @param {string[]} argv
 * @param {{ config?, env?, fetch?, sleep?, now?, log?, readFile?, writeFile?, cacheDir?, writers? }} [deps]
 */
export async function runWriterCompare(argv, deps = {}) {
  const opts = parseArgs(argv);
  if (!opts.input) throw new Error('--input <v2-process dry-run json> gerekli');
  const log = deps.log ?? ((m) => console.log(m));
  const now = deps.now ?? (() => Date.now());
  const read = deps.readFile ?? ((p) => readFile(p, 'utf8'));
  const write =
    deps.writeFile ??
    (async (p, data) => {
      await mkdir(path.dirname(p), { recursive: true });
      await writeFile(p, data, 'utf8');
    });
  const writers = deps.writers ?? WRITERS;
  const config = deps.config ?? loadConfig();
  const limits = writingLimits(config);
  const maxTokens = config.roles?.writer?.maxTokens ?? WRITE_MAX_TOKENS;
  const candidates = pickCandidates(JSON.parse(await read(opts.input)), opts.count);
  if (candidates.length === 0)
    throw new Error('girdide yazıma uygun aday yok (support_paragraph/scores.draft dolu olmalı)');

  const llms = writers.map((spec) => ({
    spec,
    llm: createLlm(configWithWriter(config, spec), {
      env: deps.env ?? process.env,
      fetch: deps.fetch,
      sleep: deps.sleep,
      now: deps.now,
    }),
  }));

  const rand = seededRandom(opts.seed);
  const key = {};
  const cards = [];
  for (let n = 0; n < candidates.length; n += 1) {
    const cand = candidates[n];
    const { messages } = buildWritePrompt({ ...cand, ...limits });
    const results = [];
    for (const { spec, llm } of llms) {
      try {
        const res = await llm.chat('writer', { messages, json: true, maxTokens });
        const card = res.json;
        if (!card || typeof card.title !== 'string' || typeof card.content !== 'string')
          throw new Error('title/content yok');
        results.push({ spec, title: card.title, content: card.content });
      } catch (err) {
        log(
          `[writer-compare] Bilgi ${n + 1} ${spec}: hata ${String(err?.message ?? err).slice(0, 120)}`,
        );
        results.push({ spec, error: true });
      }
    }
    const labelled = shuffle(results, rand).map((r, i) => ({ ...r, label: LABELS[i] }));
    key[`Bilgi ${n + 1}`] = Object.fromEntries(labelled.map((r) => [r.label, r.spec]));
    cards.push({ hook: cand.hook, lang: cand.lang, cards: labelled });
    log(`[writer-compare] Bilgi ${n + 1}/${candidates.length} tamam`);
  }

  const date = new Date(now()).toISOString().slice(0, 10);
  const dir = deps.cacheDir ?? DEFAULT_CACHE_DIR;
  const mdPath = path.join(dir, `writer-compare-${date}.md`);
  const keyPath = path.join(dir, `writer-compare-${date}.key.json`);
  await write(mdPath, formatMarkdown({ cards, date }));
  await write(keyPath, `${JSON.stringify(key, null, 2)}\n`);
  log(`[writer-compare] çıktı: ${mdPath} · anahtar: ${keyPath}`);
  return { mdPath, keyPath, key, cards };
}

const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
  try {
    await import('dotenv/config');
    await runWriterCompare(process.argv.slice(2));
  } catch (err) {
    console.error(`[writer-compare] ${err.message}`);
    process.exitCode = 1;
  }
}
