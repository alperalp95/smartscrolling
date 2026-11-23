// Kalıcı hat durumu (content pipeline v2): toplayıcı imleçleri vb. `public.pipeline_state` tablosunda
// tutulur — `key text primary key, value jsonb, updated_at timestamptz`. Supabase client dışarıdan
// enjekte edilir. GitHub Actions gibi geçici ortamlarda yerel `.cache` dosyası kaybolduğu için
// `--apply` modunda imleçler buradan okunur/yazılır.

export const STATE_TABLE = 'pipeline_state';

/**
 * @param {{ from: (table: string) => any }} client
 * @param {string} key  ör. "cursor:s1"
 * @returns {Promise<any>}  kayıtlı `value` ya da yoksa null
 */
export async function getState(client, key) {
  const { data, error } = await client
    .from(STATE_TABLE)
    .select('value')
    .eq('key', key)
    .maybeSingle();
  if (error) throw new Error(`${STATE_TABLE} okunamadı (${key}): ${error.message}`);
  return data?.value ?? null;
}

/**
 * @param {{ from: (table: string) => any }} client
 * @param {string} key
 * @param {any} value  JSON'a çevrilebilir değer
 * @param {{ now?: Date }} [options]
 */
export async function setState(client, key, value, { now = new Date() } = {}) {
  const { error } = await client
    .from(STATE_TABLE)
    .upsert({ key, value, updated_at: now.toISOString() }, { onConflict: 'key' });
  if (error) throw new Error(`${STATE_TABLE} yazılamadı (${key}): ${error.message}`);
}
