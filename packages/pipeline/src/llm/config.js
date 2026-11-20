// src/llm/config.js
// pipeline.config.json okuma + doğrulama. '_' ile başlayan alanlar açıklamadır, yok sayılır.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { LlmConfigError } from './errors.js';

export const REQUIRED_ROLES = ['scorer', 'writer', 'verifier', 'judge', 'embedding'];
export const SUPPORTED_PROVIDERS = ['groq', 'cloudflare', 'gemini'];
const STRATEGIES = ['round_robin'];

export const DEFAULT_CONFIG_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../config/pipeline.config.json',
);

/** Config dosyasını okur ve doğrular. Normalize edilmiş config döner. */
export function loadConfig(filePath = DEFAULT_CONFIG_PATH) {
  let raw;
  try {
    raw = JSON.parse(readFileSync(filePath, 'utf8'));
  } catch (err) {
    throw new LlmConfigError(`config dosyası okunamadı/JSON geçersiz (${filePath}): ${err.message}`);
  }
  return validateConfig(raw);
}

function stripComments(value) {
  if (Array.isArray(value)) return value.map(stripComments);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [key, v] of Object.entries(value)) {
      if (key.startsWith('_')) continue;
      out[key] = stripComments(v);
    }
    return out;
  }
  return value;
}

function isObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function requirePositiveNumber(obj, key, at) {
  const v = obj?.[key];
  if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) {
    throw new LlmConfigError(`'${key}' pozitif bir sayı olmalı (şu an: ${JSON.stringify(v)})`, {
      path: `${at}.${key}`,
    });
  }
}

function normalizeMember(member, providers, at) {
  if (!isObject(member)) {
    throw new LlmConfigError('zincir öğesi { "provider": "...", "model": "..." } biçiminde olmalı', { path: at });
  }
  if (typeof member.provider !== 'string' || !member.provider) {
    throw new LlmConfigError("'provider' eksik", { path: at });
  }
  if (typeof member.model !== 'string' || !member.model) {
    throw new LlmConfigError("'model' eksik", { path: at });
  }
  if (!providers[member.provider]) {
    throw new LlmConfigError(
      `sağlayıcı '${member.provider}' providers bölümünde tanımlı değil (tanımlı olanlar: ${Object.keys(providers).join(', ') || 'yok'})`,
      { path: `${at}.provider` },
    );
  }
  if (member.params !== undefined && !isObject(member.params)) {
    throw new LlmConfigError("'params' bir nesne olmalı", { path: `${at}.params` });
  }
  return { provider: member.provider, model: member.model, params: member.params ?? {} };
}

function normalizeChain(chain, providers, at) {
  if (!Array.isArray(chain) || chain.length === 0) {
    throw new LlmConfigError("'chain' en az bir model içeren bir liste olmalı", { path: at });
  }
  return chain.map((step, i) => {
    const stepAt = `${at}[${i}]`;
    if (isObject(step) && step.pool !== undefined) {
      const strategy = step.strategy ?? 'round_robin';
      if (!STRATEGIES.includes(strategy)) {
        throw new LlmConfigError(`bilinmeyen strategy '${strategy}' (desteklenen: ${STRATEGIES.join(', ')})`, {
          path: `${stepAt}.strategy`,
        });
      }
      if (!Array.isArray(step.pool) || step.pool.length === 0) {
        throw new LlmConfigError("'pool' en az bir model içermeli", { path: `${stepAt}.pool` });
      }
      return {
        strategy,
        members: step.pool.map((m, j) => normalizeMember(m, providers, `${stepAt}.pool[${j}]`)),
      };
    }
    if (isObject(step) && step.strategy !== undefined) {
      throw new LlmConfigError("'strategy' sadece 'pool' ile birlikte kullanılır", { path: stepAt });
    }
    return { strategy: 'single', members: [normalizeMember(step, providers, stepAt)] };
  });
}

function validateProvider(name, p) {
  const at = `providers.${name}`;
  if (!SUPPORTED_PROVIDERS.includes(name)) {
    throw new LlmConfigError(`desteklenmeyen sağlayıcı (desteklenen: ${SUPPORTED_PROVIDERS.join(', ')})`, { path: at });
  }
  if (!isObject(p)) throw new LlmConfigError('sağlayıcı ayarı bir nesne olmalı', { path: at });
  if (typeof p.baseUrl !== 'string' || !/^https:\/\//.test(p.baseUrl)) {
    throw new LlmConfigError("'baseUrl' https:// ile başlayan bir adres olmalı", { path: `${at}.baseUrl` });
  }
  if (typeof p.apiKeyEnv !== 'string' || !p.apiKeyEnv) {
    throw new LlmConfigError("'apiKeyEnv' (anahtarın durduğu ortam değişkeninin adı) eksik", { path: `${at}.apiKeyEnv` });
  }
  if (name === 'cloudflare' && (typeof p.accountIdEnv !== 'string' || !p.accountIdEnv)) {
    throw new LlmConfigError("'accountIdEnv' eksik (ör. CLOUDFLARE_ACCOUNT_ID)", { path: `${at}.accountIdEnv` });
  }
  const pct = p.stopAtPercent ?? 90;
  if (typeof pct !== 'number' || pct <= 0 || pct > 100) {
    throw new LlmConfigError("'stopAtPercent' 1-100 arası olmalı", { path: `${at}.stopAtPercent` });
  }
  const limits = p.dailyLimits ?? {};
  if (!isObject(limits)) throw new LlmConfigError("'dailyLimits' bir nesne olmalı", { path: `${at}.dailyLimits` });
  for (const scope of ['perModel', 'provider']) {
    if (limits[scope] === undefined) continue;
    if (!isObject(limits[scope])) {
      throw new LlmConfigError('bir nesne olmalı', { path: `${at}.dailyLimits.${scope}` });
    }
    for (const [k, v] of Object.entries(limits[scope])) {
      if (v !== null && (typeof v !== 'number' || v < 0)) {
        throw new LlmConfigError('sayı ya da null olmalı', { path: `${at}.dailyLimits.${scope}.${k}` });
      }
    }
  }
  return {
    ...p,
    name,
    stopAtPercent: pct,
    jsonMode: p.jsonMode === true,
    dailyLimits: { perModel: limits.perModel ?? {}, provider: limits.provider ?? {} },
    neuronsPerMillionTokens: p.neuronsPerMillionTokens ?? {},
  };
}

/**
 * Ham config'i doğrular ve normalize eder. Hata mesajları kod bilmeyen birinin
 * düzeltebileceği kadar açık olmalı (hangi alan, ne bekleniyor).
 */
export function validateConfig(rawConfig) {
  if (!isObject(rawConfig)) throw new LlmConfigError('config bir JSON nesnesi olmalı');
  const cfg = stripComments(rawConfig);

  if (!isObject(cfg.providers) || Object.keys(cfg.providers).length === 0) {
    throw new LlmConfigError("'providers' bölümü eksik ya da boş", { path: 'providers' });
  }
  const providers = {};
  for (const [name, p] of Object.entries(cfg.providers)) providers[name] = validateProvider(name, p);

  if (!isObject(cfg.roles)) throw new LlmConfigError("'roles' bölümü eksik", { path: 'roles' });
  for (const role of REQUIRED_ROLES) {
    if (!isObject(cfg.roles[role])) {
      throw new LlmConfigError(`'${role}' rolü eksik (gerekli roller: ${REQUIRED_ROLES.join(', ')})`, {
        path: `roles.${role}`,
      });
    }
  }

  const roles = {};
  const pending = Object.entries(cfg.roles);
  for (const [role, def] of pending) {
    if (def.sameAs !== undefined) continue;
    roles[role] = { ...def, steps: normalizeChain(def.chain, providers, `roles.${role}.chain`) };
    delete roles[role].chain;
  }
  for (const [role, def] of pending) {
    if (def.sameAs === undefined) continue;
    const target = cfg.roles[def.sameAs];
    if (!target) {
      throw new LlmConfigError(`sameAs '${def.sameAs}' diye bir rol yok`, { path: `roles.${role}.sameAs` });
    }
    if (target.sameAs !== undefined) {
      throw new LlmConfigError('sameAs başka bir sameAs rolünü gösteremez', { path: `roles.${role}.sameAs` });
    }
    roles[role] = { ...roles[def.sameAs], ...def, steps: roles[def.sameAs].steps };
  }

  const emb = roles.embedding;
  requirePositiveNumber(emb, 'dimensions', 'roles.embedding');
  if (emb.batchSize === undefined) emb.batchSize = 50;
  requirePositiveNumber(emb, 'batchSize', 'roles.embedding');

  if (!isObject(cfg.retry)) throw new LlmConfigError("'retry' bölümü eksik", { path: 'retry' });
  for (const k of ['maxAttempts', 'baseDelayMs', 'maxDelayMs']) requirePositiveNumber(cfg.retry, k, 'retry');
  const retry = { requestTimeoutMs: 60000, ...cfg.retry };
  requirePositiveNumber(retry, 'requestTimeoutMs', 'retry');

  const normalized = { ...cfg, roles, providers, retry };
  Object.defineProperty(normalized, NORMALIZED, { value: true, enumerable: false });
  return normalized;
}

const NORMALIZED = Symbol.for('smartscrolling.pipeline.llmConfig.normalized');

/** Zaten validateConfig/loadConfig'ten geçmişse tekrar doğrulama. */
export function ensureConfig(config) {
  return config && config[NORMALIZED] ? config : validateConfig(config);
}
