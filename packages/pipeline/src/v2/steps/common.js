// src/v2/steps/common.js
// İçerik hattı v2 adımlarının ortak parçaları: durumlar, kategoriler, hata/erteleme döngüsü.
//
// Her adım `{ llm, repo, config, now, log }` bağımlılıklarını alır (support ayrıca `fetch`).
// Durum makinesi: new → scored → written → verified → queued | rejected (reject_reason dolu).

export const STATUS = Object.freeze({
  NEW: 'new',
  SCORED: 'scored',
  WRITTEN: 'written',
  VERIFIED: 'verified',
  QUEUED: 'queued',
  REJECTED: 'rejected',
});

/** Hata alan aday bu sayıya ulaşınca `rejected:max_attempts`. */
export const MAX_ATTEMPTS = 3;

/** Sabit 8 kategori (mevcut facts.category değerleriyle aynı yazım). */
export const CATEGORIES = Object.freeze([
  '🔬 BİLİM',
  '📜 TARİH',
  '💻 TEKNOLOJİ',
  '🧠 FELSEFE',
  '👤 BİYOGRAFİ',
  '🌱 SAĞLIK',
  '🎨 SANAT & KÜLTÜR',
  '🏆 SPOR',
]);

const CATEGORY_ALIASES = {
  bilim: '🔬 BİLİM',
  science: '🔬 BİLİM',
  tarih: '📜 TARİH',
  history: '📜 TARİH',
  teknoloji: '💻 TEKNOLOJİ',
  technology: '💻 TEKNOLOJİ',
  tech: '💻 TEKNOLOJİ',
  felsefe: '🧠 FELSEFE',
  philosophy: '🧠 FELSEFE',
  biyografi: '👤 BİYOGRAFİ',
  biography: '👤 BİYOGRAFİ',
  saglik: '🌱 SAĞLIK',
  health: '🌱 SAĞLIK',
  sanat: '🎨 SANAT & KÜLTÜR',
  kultur: '🎨 SANAT & KÜLTÜR',
  'sanat kultur': '🎨 SANAT & KÜLTÜR',
  'sanat ve kultur': '🎨 SANAT & KÜLTÜR',
  art: '🎨 SANAT & KÜLTÜR',
  culture: '🎨 SANAT & KÜLTÜR',
  'art culture': '🎨 SANAT & KÜLTÜR',
  'arts and culture': '🎨 SANAT & KÜLTÜR',
  spor: '🏆 SPOR',
  sport: '🏆 SPOR',
  sports: '🏆 SPOR',
};

const FOLD = { ı: 'i', ğ: 'g', ü: 'u', ş: 's', ö: 'o', ç: 'c', â: 'a', î: 'i', û: 'u' };

function foldKey(s) {
  return String(s ?? '')
    .toLocaleLowerCase('tr-TR')
    .replace(/[ığüşöçâîû]/g, (ch) => FOLD[ch])
    .normalize('NFKD')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Model çıktısındaki kategoriyi 8 sabit değerden birine çevirir; tanınmazsa null.
 * "BİLİM", "Bilim", "science", "🔬 bilim" → "🔬 BİLİM".
 */
export function normalizeCategory(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  if (CATEGORIES.includes(value.trim())) return value.trim();
  const key = foldKey(value);
  if (!key) return null;
  if (CATEGORY_ALIASES[key]) return CATEGORY_ALIASES[key];
  for (const cat of CATEGORIES) {
    if (foldKey(cat) === key) return cat;
  }
  return null;
}

/** Model çalıştı ama çıktı kullanılamadı (geçersiz JSON / kesik yanıt): tükenme değil, hata. */
export function isOutputError(err) {
  return err?.name === 'LlmOutputError';
}

/**
 * Rol başına maxTokens: config.roles.<rol>.maxTokens, yoksa fallback.
 * (LLM katmanı da aynı değeri varsayılan olarak kullanır; adımlar açıkça geçirir.)
 */
export function roleMaxTokens(config, role, fallback) {
  const v = config?.roles?.[role]?.maxTokens;
  return Number.isInteger(v) && v > 0 ? v : fallback;
}

export function isExhausted(err) {
  return err?.name === 'LlmExhaustedError';
}

/** Tek istek sağlayıcının dakikalık sınırından büyük ("Request too large"): çağıran işi böler. */
export function isTooLarge(err) {
  return err?.name === 'LlmRequestTooLargeError';
}

/** Config hatası: adayı cezalandırmak yerine run durur. */
export function isFatal(err) {
  return err?.name === 'LlmConfigError';
}

export function newStats(step) {
  return { step, seen: 0, advanced: 0, rejected: {}, failed: 0, deferred: 0, exhaustedRole: null, exhaustedReason: null, errors: [] };
}

export function nowIso(now) {
  const v = typeof now === 'function' ? now() : Date.now();
  return new Date(v).toISOString();
}

export function noopLog() {}

/** Adayı reddeder: status=rejected, reject_reason=reason. */
export async function reject(ctx, cand, reason, stats, extra = {}) {
  await ctx.repo.updateCandidate(cand.id, { ...extra, status: STATUS.REJECTED, reject_reason: reason });
  stats.rejected[reason] = (stats.rejected[reason] ?? 0) + 1;
  ctx.log?.(`[${stats.step}] ${cand.id} rejected:${reason}`);
}

/** Hata: attempts++, aynı durumda kalır; MAX_ATTEMPTS'e ulaşırsa rejected:max_attempts. */
export async function recordFailure(ctx, cand, err, stats) {
  const attempts = (Number(cand.attempts) || 0) + 1;
  const message = String(err?.message ?? err).slice(0, 200);
  stats.failed += 1;
  stats.errors.push({ id: cand.id, error: message });
  if (attempts >= MAX_ATTEMPTS) {
    await reject(ctx, cand, 'max_attempts', stats, { attempts });
  } else {
    await ctx.repo.updateCandidate(cand.id, { attempts });
    ctx.log?.(`[${stats.step}] ${cand.id} hata (deneme ${attempts}/${MAX_ATTEMPTS}): ${message}`);
  }
}

/**
 * Adayları sırayla işler. LlmExhaustedError → adım durur, kalanlar `deferred`
 * (aynı durumda kalır, ertesi run). Diğer hatalar → recordFailure.
 * @returns {Promise<boolean>} false ise zincir tükendi, adım durdu.
 */
export async function forEachCandidate(ctx, cands, stats, fn) {
  for (let i = 0; i < cands.length; i += 1) {
    const cand = cands[i];
    stats.seen += 1;
    try {
      await fn(cand);
    } catch (err) {
      if (isFatal(err)) throw err;
      if (isExhausted(err)) {
        markDeferred(ctx, stats, err, cands.length - i);
        stats.seen -= 1;
        return false;
      }
      await recordFailure(ctx, cand, err, stats);
    }
  }
  return true;
}

export function markDeferred(ctx, stats, err, count) {
  stats.deferred += count;
  stats.exhaustedRole = err?.role ?? stats.exhaustedRole ?? 'unknown';
  // Neden (her model için hata türü + kısa mesaj) log'a ve stats'a yazılır; anahtar içermez (LLM katmanı temizler).
  const why = Array.isArray(err?.attempts) && err.attempts.length
    ? err.attempts.map((a) => `${a.provider}/${a.model}: ${a.reason}`).join(' | ')
    : String(err?.message ?? err ?? 'bilinmiyor');
  stats.exhaustedReason = why.slice(0, 600);
  ctx.log?.(`[${stats.step}] LLM zinciri tükendi (role=${stats.exhaustedRole}); ${count} aday ertesi run'a kaldı. Neden: ${stats.exhaustedReason}`);
}

/**
 * decideDuplicate için hakem fonksiyonu. decideDuplicate hakem hatasını
 * "judge_error → duplicate" sayar; zincir tükenmesi tekrar sayılmasın diye
 * LlmExhaustedError ayrıca yakalanır ve çağıran `exhausted` alanına bakar.
 */
export function createJudge(llm, buildJudgePrompt, { maxTokens = 200 } = {}) {
  // exhausted: zincir tükendi → adım erteler. error: hakem çıktısı kullanılamadı → aday hata
  // sayılır (attempts++); ikisi de "tekrar" (judge_error → duplicate) sayılmaz.
  const state = { exhausted: null, error: null, calls: 0 };
  const judge = async ({ a, b }) => {
    state.calls += 1;
    try {
      const { messages } = buildJudgePrompt({ a, b });
      const res = await llm.chat('judge', { messages, json: true, maxTokens });
      const v = res?.json ?? {};
      const same = v.same_fact ?? v.sameFact;
      return { sameFact: same === true || same === 'true', reason: typeof v.reason === 'string' ? v.reason : undefined };
    } catch (err) {
      if (isExhausted(err) || isFatal(err)) state.exhausted = err;
      else if (isOutputError(err)) state.error = err;
      throw err;
    }
  };
  return { judge, state };
}

export function dedupThresholds(config) {
  const d = config?.dedup ?? {};
  const out = {};
  if (typeof d.duplicateThreshold === 'number') out.duplicateThreshold = d.duplicateThreshold;
  if (typeof d.grayZoneLow === 'number') out.grayZoneLow = d.grayZoneLow;
  return out;
}

export function grayZoneLow(config) {
  return typeof config?.dedup?.grayZoneLow === 'number' ? config.dedup.grayZoneLow : 0.85;
}

/** Wikipedia URL'sinden dil (tr/en/...). */
export function wikiLang(cand) {
  try {
    const host = new URL(cand.source_url).hostname;
    const m = host.match(/^([a-z-]+)\.(?:m\.)?wikipedia\.org$/);
    if (m) return m[1];
  } catch {
    // geçersiz URL → aday diline bak
  }
  return cand.lang || 'en';
}
