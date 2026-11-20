/**
 * @typedef {object} ChatMessage
 * @property {'system' | 'user'} role
 * @property {string} content
 */

const SYSTEM_PROMPT =
  'Bu iki metin AYNI olguyu mu anlatıyor, yoksa aynı konuda FARKLI olgular mı? ' +
  'Metinler Türkçe, İngilizce ya da karışık olabilir; dile değil anlama bak. ' +
  'Aynı iddia farklı kelimelerle/dillerde yazılmışsa same_fact=true. ' +
  'Aynı konu ama farklı bilgi ise same_fact=false. ' +
  'Sadece JSON dön: {"same_fact": true|false, "reason": "..."}';

/**
 * Hakem (judge) modeli için kısa sohbet istemi üretir.
 *
 * @param {{ a: string, b: string }} input
 * @returns {{ messages: ChatMessage[] }}
 */
export function buildJudgePrompt({ a, b }) {
  return {
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `A: ${String(a ?? '').trim()}\nB: ${String(b ?? '').trim()}` },
    ],
  };
}
