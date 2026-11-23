// src/v2/steps/verify.js
// Doğrula: Tekrar-2'yi geçmiş `written` kart, yazardan farklı aile doğrulayıcıyla
// (llm.chat('verifier')) atomik iddialara bölünür; her iddia KANCA + DESTEK PARAGRAFI'na göre
// (biriyle açıkça ya da doğrudan çıkarılabilir şekilde destekleniyorsa supported; DYK kancaları
// editörlerce kaynaklı) supported | unsupported | unclear.
//   - hepsi supported → verified, sonuç scores.verification (enqueue facts.verification'a taşır)
//   - unsupported ya da unclear iddia varsa (başlık dahil) hemen reddedilmez: TEK onarım turu.
//     Yazara sorunlu iddialar + gerekçeleri verilir ("çıkar ya da kaynakla uyumlu hale getir,
//     yeni bilgi ekleme") → onarılmış kart yeniden doğrulanır.
//       · ikinci tur supported → verified
//       · ikinci turda unsupported → rejected:unsupported_claim; yalnız unclear → rejected:unclear_claim
//   - Başlık da bir iddiadır (ilk iddia) ve ayrıca anlam/çeviri uyumu sorulur (title_match).
//     title_match=false → başlık iddiası unsupported sayılır (kind: 'title') → onarım turu;
//     onarımda yazara "başlık metindeki olguyla aynı şeyi söylemiyor / terim yanlış çevrilmiş" denir.
//   - Özel ad / sayı sadakati (V2-05f, kod: steps/fidelity.js): karttaki özel adlar ve sayılar kanca +
//     destek paragrafında geçmeli. Geçmeyen → "bu ad/sayı kaynakta yok: X" ile aynı onarım turuna girer
//     (doğrulayıcı supported dese bile); onarımdan sonra hâlâ varsa → rejected:name_mismatch
//     (ikinci doğrulama çağrısı yapılmaz).
//   - En fazla 1 onarım turu (en fazla 2 doğrulama + 1 yazar çağrısı).
// Onarım da kod kurallarından geçer (ihlal → write_rules, skip → writer_skip; ek retry yok).
import { contentHash } from '../../dedup/index.js';
import { VERIFY_MAX_TOKENS, buildVerifyPrompt } from '../prompts/verify.js';
import { WRITE_MAX_TOKENS, buildRepairMessages, buildWritePrompt } from '../prompts/write.js';
import { STATUS, forEachCandidate, newStats, nowIso, reject, roleMaxTokens } from './common.js';
import { cardText } from './dedup-card.js';
import { checkFidelity, fidelityProblems } from './fidelity.js';
import { checkWriteRules, normalizeDraft, writeInput, writingLimits } from './write.js';

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

const TITLE_MATCH = {
  true: true,
  yes: true,
  evet: true,
  uyumlu: true,
  false: false,
  no: false,
  hayir: false,
  hayır: false,
  uyumsuz: false,
};

/** title_match alanı: true/false (ya da "evet"/"hayır"...); yoksa null. */
export function parseTitleMatch(json) {
  const v = json?.title_match ?? json?.titleMatch;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') return TITLE_MATCH[v.trim().toLocaleLowerCase('tr-TR')] ?? null;
  return null;
}

/**
 * Doğrulayıcı çıktısını normalize eder; tanınmayan karar "unclear" sayılır.
 * title_match=false ise başlık için unsupported bir iddia (kind: 'title') eklenir → onarım turu.
 * @param {object} json
 * @param {{ title?: string }} [card]
 */
export function parseVerification(json, { title } = {}) {
  const list = Array.isArray(json?.claims) ? json.claims : Array.isArray(json) ? json : null;
  if (!list || list.length === 0)
    return { ok: false, error: 'doğrulayıcı iddia listesi döndürmedi' };
  const claims = list
    .filter((c) => c && typeof c === 'object')
    .map((c) => {
      const key = String(c.verdict ?? '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '_');
      return {
        claim: String(c.claim ?? '').slice(0, 300),
        verdict: VERDICT_ALIASES[key] ?? 'unclear',
        why: String(c.why ?? c.reason ?? '').slice(0, 200),
      };
    });
  if (claims.length === 0) return { ok: false, error: 'doğrulayıcı iddia listesi boş' };
  const titleMatch = parseTitleMatch(json);
  if (titleMatch === false) {
    claims.unshift({
      claim: `Başlık: ${String(title ?? '').trim() || '(başlık)'}`.slice(0, 300),
      verdict: 'unsupported',
      why: String(json?.title_why ?? json?.titleWhy ?? 'başlık metindeki olguyla uyuşmuyor').slice(
        0,
        200,
      ),
      kind: 'title',
    });
  }
  const verdict = claims.some((c) => c.verdict === 'unsupported')
    ? 'unsupported'
    : claims.some((c) => c.verdict === 'unclear')
      ? 'unclear'
      : 'supported';
  return { ok: true, claims, verdict, ...(titleMatch === null ? {} : { title_match: titleMatch }) };
}

async function verifyOnce(llm, draft, support, { hook, maxTokens = VERIFY_MAX_TOKENS } = {}) {
  const res = await llm.chat('verifier', {
    ...buildVerifyPrompt({ hook, title: draft.title, content: draft.content, support }),
    json: true,
    maxTokens,
  });
  const parsed = parseVerification(res?.json, { title: draft.title });
  if (!parsed.ok) throw new Error(parsed.error);
  return { ...parsed, model: res?.model ?? null };
}

function roundRecord(r) {
  return {
    verdict: r.verdict,
    claims: r.claims,
    model: r.model,
    ...(r.title_match === undefined ? {} : { title_match: r.title_match }),
  };
}

/** Sadakat sonucu tur kaydına: sorun yoksa alan eklenmez. */
function fidelityRecord(fid) {
  return fid.ok ? {} : { fidelity: { names: fid.names, numbers: fid.numbers } };
}

function draftJson(draft) {
  return JSON.stringify({
    title: draft.title,
    content: draft.content,
    tags: draft.tags,
    read_time_sq: draft.read_time_sq,
  });
}

/**
 * @param {{ llm, repo, config, now?, log? }} deps
 * @param {{ limit?: number }} [opts]
 */
export async function runVerify(deps, { limit = 50 } = {}) {
  const stats = newStats('verify');
  const cands = await deps.repo.listByStatus(STATUS.WRITTEN, limit, { scoresHas: 'dedup_card' });
  const verifyMax = roleMaxTokens(deps.config, 'verifier', VERIFY_MAX_TOKENS);
  const writeMax = roleMaxTokens(deps.config, 'writer', WRITE_MAX_TOKENS);
  const limits = writingLimits(deps.config);

  await forEachCandidate(deps, cands, stats, async (cand) => {
    let draft = cand.scores?.draft;
    if (!draft?.title || !draft?.content) throw new Error('kart taslağı (scores.draft) yok');
    const support = cand.support_paragraph;
    if (!support) throw new Error('support_paragraph yok');

    const rounds = [];
    // Kanıt = kanca + destek paragrafı (kanca editörlerce kaynaklı).
    const evidence = { hook: cand.hook_text, maxTokens: verifyMax };
    const first = await verifyOnce(deps.llm, draft, support, evidence);
    // Özel ad / sayı sadakati (kod, LLM'den bağımsız): kaynakta olmayan ad ya da sayı → onarım turu.
    const source = { hook: cand.hook_text, support };
    const fid1 = checkFidelity(draft, source);
    rounds.push({ ...roundRecord(first), ...fidelityRecord(fid1) });
    const base = { ...cand.scores };
    let repair = null;
    const verification = () => ({
      rounds,
      ...(repair ? { repair } : {}),
      checked_at: nowIso(deps.now),
    });

    if (first.verdict !== 'supported' || !fid1.ok) {
      // Tek onarım turu: unsupported + unclear iddialar ve sadakat sorunları (gerekçeleriyle) yazara geri gider.
      const problems = [
        ...first.claims.filter((c) => c.verdict !== 'supported'),
        ...fidelityProblems(fid1),
      ];
      const repairFor = first.verdict !== 'supported' ? first.verdict : 'name_mismatch';
      repair = {
        for: repairFor,
        claims: problems.map((c) => c.claim),
        ...(first.title_match === false ? { title: true } : {}),
        ...(fid1.ok ? {} : { fidelity: true }),
      };
      const { messages } = buildWritePrompt(writeInput(cand, limits));
      const res = await deps.llm.chat('writer', {
        messages: [...messages, ...buildRepairMessages(draftJson(draft), problems, limits)],
        json: true,
        maxTokens: writeMax,
      });
      if (res?.json?.skip === true || res?.json?.skip === 'true') {
        await reject(deps, cand, 'writer_skip', stats, {
          scores: {
            ...base,
            writer_skip: String(res.json.reason ?? '').slice(0, 200),
            verification: verification(),
          },
        });
        return;
      }
      const repaired = normalizeDraft(res?.json, { hook: cand.hook_text });
      const violations = checkWriteRules(repaired, limits);
      if (violations.length > 0) {
        await reject(deps, cand, 'write_rules', stats, {
          scores: { ...base, write_violations: violations, verification: verification() },
        });
        return;
      }
      // Embedding ilk taslağınki kalır (aynı olgu); hash yeni metne göre yeniden hesaplanır.
      draft = {
        ...draft,
        ...repaired,
        content_hash: contentHash(cardText(repaired)),
        writer_model: res?.model ?? draft.writer_model,
        rewrites: (draft.rewrites ?? 0) + 1,
        rewritten_for: repairFor,
      };
      // Onarımdan sonra hâlâ kaynakta olmayan ad/sayı varsa ikinci doğrulamaya gerek yok.
      const fid2 = checkFidelity(draft, source);
      if (!fid2.ok) {
        repair.fidelity_after = fidelityRecord(fid2).fidelity;
        await reject(deps, cand, 'name_mismatch', stats, {
          scores: { ...base, draft, verification: verification() },
        });
        return;
      }
      const second = await verifyOnce(deps.llm, draft, support, evidence);
      rounds.push(roundRecord(second));
      if (second.verdict !== 'supported') {
        const reason = second.verdict === 'unsupported' ? 'unsupported_claim' : 'unclear_claim';
        await reject(deps, cand, reason, stats, {
          scores: { ...base, draft, verification: verification() },
        });
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
