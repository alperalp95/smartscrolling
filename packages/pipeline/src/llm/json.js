// src/llm/json.js
// Model yanıtından JSON ayıklama. JSON modu olmayan sağlayıcılar için.

/**
 * Akıl yürütme ("thinking") bloklarını ayıklar:
 *   - kapalı <think>…</think> blokları silinir;
 *   - açılışı olmayan </think> (şablon <think>'i istemin içine koymuşsa) → öncesi silinir;
 *   - kapanmamış <think> (yanıt düşünürken kesildi) → sonrası silinir.
 */
export function stripThinking(text) {
  if (typeof text !== 'string') return '';
  let s = text.replace(/<think>[\s\S]*?<\/think>/gi, '');
  const orphanClose = s.search(/<\/think>/i);
  if (orphanClose >= 0) {
    const all = [...s.matchAll(/<\/think>/gi)];
    const last = all[all.length - 1];
    s = s.slice(last.index + last[0].length);
  }
  const openIdx = s.search(/<think>/i);
  if (openIdx >= 0) s = s.slice(0, openIdx);
  return s.trim();
}

/**
 * Metinden JSON çıkarır: <think> bloklarını (stripThinking) ve ```json çitlerini temizler,
 * ilk { / [ ile eşleşen son } / ] arasını dener.
 * @returns {{ ok: true, value: any } | { ok: false, error: string }}
 */
export function extractJson(text) {
  if (typeof text !== 'string' || !text.trim()) return { ok: false, error: 'boş yanıt' };
  let s = stripThinking(text);
  if (!s) return { ok: false, error: 'yanıtta sadece düşünme bloğu var (JSON yok)' };

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
