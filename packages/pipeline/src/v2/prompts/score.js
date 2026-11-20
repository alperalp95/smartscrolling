// src/v2/prompts/score.js
// Puanlayıcı (scorer) istemi. Tahmini token: sistem ~370 (1.175 karakter, 8 emoji dahil),
// kanca başına ~30 girdi + ~45 çıktı. 15 kancalık bir çağrı ≈ 830 girdi + 680 çıktı ≈ 1.500 token
// (qwen3 "thinking" açıksa çıktı artar). Tahmin: Türkçe ~3,2-3,5, İngilizce ~4 karakter/token.
import { CATEGORIES } from '../steps/common.js';

export const SCORE_MAX_TOKENS = 2000;

const SYSTEM = `Türk okur için bilgi kartı adaylarını puanlıyorsun. Hedef tepki: "Aa, bunu bilmiyordum, ne garipmiş!"
Her kanca (TR ya da EN) için:
- surprise 0-10: sıradan okuru ne kadar şaşırtır? Bilinen, beklenen ya da sıradan bilgi düşük.
- tr_relevance 0-10: Türk okur anlar ve ilgilenir mi? Çok yerel/niş (küçük kasaba yöneticisi, alt lig oyuncusu) düşük.
- is_definition: kanca sadece "X nedir / kimdir / nerededir" bilgisiyse true.
- category: ${CATEGORIES.join(', ')}
- reason: en fazla 8 kelime.
Kalibrasyon (surprise/tr_relevance):
ÇOK İLGİNÇ
- "Ahtapotun üç kalbi ve mavi kanı vardır." 9/8
- "Kleopatra, piramitlerin yapımından çok Ay'a inişe daha yakın bir zamanda yaşadı." 10/8
- "Oxford Üniversitesi, Aztek İmparatorluğu'ndan daha eskidir." 9/7
SIKICI / TANIM
- "Paris, Fransa'nın başkentidir." 1/5, is_definition=true
- "John Smith 1950-1954 arasında Ohio'da bir kasabanın belediye başkanıydı." 2/1
- "Fotosentez, bitkilerin ışıkla besin üretmesidir." 1/6, is_definition=true
Sadece JSON dön: {"items":[{"id":1,"surprise":0,"tr_relevance":0,"is_definition":false,"category":"${CATEGORIES[0]}","reason":"..."}]}`;

/**
 * @param {Array<{ id: number, lang?: string, hook: string }>} items  kısa sayısal id'ler
 * @returns {{ messages: Array<{role:string, content:string}> }}
 */
export function buildScorePrompt(items) {
  const lines = items.map((it) => `${it.id} [${it.lang || 'en'}] ${String(it.hook).replace(/\s+/g, ' ').trim()}`);
  return {
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: `Kancalar:\n${lines.join('\n')}` },
    ],
  };
}

export const SCORE_SYSTEM_PROMPT = SYSTEM;
