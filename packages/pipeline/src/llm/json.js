// src/llm/json.js
// Model yanıtından JSON ayıklama. JSON modu olmayan sağlayıcılar için.

/**
 * Metinden JSON çıkarır: <think> bloklarını ve ```json çitlerini temizler,
 * ilk { / [ ile eşleşen son } / ] arasını dener.
 * @returns {{ ok: true, value: any } | { ok: false, error: string }}
 */
export function extractJson(text) {
  if (typeof text !== 'string' || !text.trim()) return { ok: false, error: 'boş yanıt' };
  let s = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();

  const direct = tryParse(s);
  if (direct.ok) return direct;

  const starts = [s.indexOf('{'), s.indexOf('[')].filter((i) => i >= 0);
  if (starts.length === 0) return { ok: false, error: 'yanıtta JSON bulunamadı' };
  const start = Math.min(...starts);
  const closer = s[start] === '{' ? '}' : ']';
  const end = s.lastIndexOf(closer);
  if (end <= start) return { ok: false, error: 'JSON kapanmamış' };
  return tryParse(s.slice(start, end + 1));
}

function tryParse(s) {
  try {
    return { ok: true, value: JSON.parse(s) };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

export const JSON_REPAIR_INSTRUCTION =
  'Önceki yanıtın geçerli JSON değildi. Aynı içeriği SADECE geçerli JSON olarak, açıklama ya da kod çiti olmadan tekrar yaz.';
