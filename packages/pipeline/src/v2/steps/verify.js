// src/v2/steps/verify.js
// Doğrula: Tekrar-2'yi geçmiş `written` kart, yazardan farklı aile doğrulayıcıyla
// (llm.chat('verifier')) atomik iddialara bölünür; her iddia sadece destek paragrafına göre
// supported | unsupported | unclear.
//   - bir unsupported → rejected:unsupported_claim
//   - unclear varsa → bir kez yeniden yazım (unclear iddialar prompt'a) + yeniden doğrulama;
//     yine unclear → rejected:unclear_claim (yeni unsupported → unsupported_claim)
//   - geçen → verified, sonuç scores.verification (enqueue facts.verification'a taşır)
// Yeniden yazım da kod kurallarından geçer (ihlal → write_rules, skip → writer_skip; ek retry yok).
import { contentHash } from '../../dedup/index.js';
import { VERIFY_MAX_TOKENS, buildVerifyPrompt } from '../prompts/verify.js';
import { WRITE_MAX_TOKENS, buildUnclearFixMessages, buildWritePrompt } from '../prompts/write.js';
import { STATUS, forEachCandidate, newStats, nowIso, reject } from './common.js';
import { cardText } from './dedup-card.js';
import { checkWriteRules, normalizeDraft, writeInput } from './write.js';

const VERDICT_ALIASES = {
  supported: 'supported',
  destekleniyor: 'supported',
  unsupported: 'unsupported',
  desteklenmiyor: 'unsupported',
  not_supported: 'unsupported',
  contradicted: 'unsupported',
  unclear: 'unclear',
  belirsiz: 'unclear',
};

/** Doğrulayıcı çıktısını normalize eder; tanınmayan karar "unclear" sayılır. */
export function parseVerification(json) {
  const list = Array.isArray(json?.claims) ? json.claims : Array.isArray(json) ? json : null;
  if (!list || list.length === 0) return { ok: false, error: 'doğrulayıcı iddia listesi döndürmedi' };
  const claims = list
    .filter((c) => c && typeof c === 'object')
    .map((c) => {
      const key = String(c.verdict ?? '').trim().toLowerCase().replace(/\s+/g, '_');
      return {
        claim: String(c.claim ?? '').slice(0, 300),
        verdict: VERDICT_ALIASES[key] ?? 'unclear',
        why: String(c.why ?? c.reason ?? '').slice(0, 200),
      };
    });
  if (claims.length === 0) return { ok: false, error: 'doğrulayıcı iddia listesi boş' };
  const verdict = claims.some((c) => c.verdict === 'unsupported')
    ? 'unsupported'
    : claims.some((c) => c.verdict === 'unclear')
      ? 'unclear'
      : 'supported';
  return { ok: true, claims, verdict };
}

async function verifyOnce(llm, draft, support) {
  const res = await llm.chat('verifier', {
    ...buildVerifyPrompt({ title: draft.title, content: draft.content, support }),
    json: true,
    maxTokens: VERIFY_MAX_TOKENS,
  });
  const parsed = parseVerification(res?.json);
  if (!parsed.ok) throw new Error(parsed.error);
  return { ...parsed, model: res?.model ?? null };
}

function draftJson(draft) {
  return JSON.stringify({ title: draft.title, content: draft.content, tags: draft.tags, read_time_sq: draft.read_time_sq });
}

/**
 * @param {{ llm, repo, config, now?, log? }} deps
 * @param {{ limit?: number }} [opts]
 */
export async function runVerify(deps, { limit = 50 } = {}) {
  const stats = newStats('verify');
  const cands = await deps.repo.listByStatus(STATUS.WRITTEN, limit, { scoresHas: 'dedup_card' });

  await forEachCandidate(deps, cands, stats, async (cand) => {
    let draft = cand.scores?.draft;
    if (!draft?.title || !draft?.content) throw new Error('kart taslağı (scores.draft) yok');
    const support = cand.support_paragraph;
    if (!support) throw new Error('support_paragraph yok');

    const rounds = [];
    const first = await verifyOnce(deps.llm, draft, support);
    rounds.push({ verdict: first.verdict, claims: first.claims, model: first.model });
    const base = { ...cand.scores };
    const verification = () => ({ rounds, checked_at: nowIso(deps.now) });

    if (first.verdict === 'unsupported') {
      await reject(deps, cand, 'unsupported_claim', stats, { scores: { ...base, verification: verification() } });
      return;
    }

    if (first.verdict === 'unclear') {
      const unclear = first.claims.filter((c) => c.verdict === 'unclear').map((c) => c.claim);
      const { messages } = buildWritePrompt(writeInput(cand));
      const res = await deps.llm.chat('writer', {
        messages: [...messages, ...buildUnclearFixMessages(draftJson(draft), unclear)],
        json: true,
        maxTokens: WRITE_MAX_TOKENS,
      });
      if (res?.json?.skip === true || res?.json?.skip === 'true') {
        await reject(deps, cand, 'writer_skip', stats, { scores: { ...base, verification: verification() } });
        return;
      }
      const rewritten = normalizeDraft(res?.json);
      const violations = checkWriteRules(rewritten);
      if (violations.length > 0) {
        await reject(deps, cand, 'write_rules', stats, {
          scores: { ...base, write_violations: violations, verification: verification() },
        });
        return;
      }
      // Embedding ilk taslağınki kalır (aynı olgu); hash yeni metne göre yeniden hesaplanır.
      draft = {
        ...draft,
        ...rewritten,
        content_hash: contentHash(cardText(rewritten)),
        writer_model: res?.model ?? draft.writer_model,
        rewrites: (draft.rewrites ?? 0) + 1,
        rewritten_for: 'unclear',
      };
      const second = await verifyOnce(deps.llm, draft, support);
      rounds.push({ verdict: second.verdict, claims: second.claims, model: second.model });
      if (second.verdict !== 'supported') {
        const reason = second.verdict === 'unsupported' ? 'unsupported_claim' : 'unclear_claim';
        await reject(deps, cand, reason, stats, { scores: { ...base, draft, verification: verification() } });
        return;
      }
    }

    await deps.repo.updateCandidate(cand.id, {
      status: STATUS.VERIFIED,
      scores: { ...base, draft, verification: { ...verification(), result: 'supported' } },
    });
    stats.advanced += 1;
  });
  return stats;
}
