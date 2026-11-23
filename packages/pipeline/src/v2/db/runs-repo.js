// İçerik hattı v2 — run ölçümü: her günlük run sonunda `public.pipeline_runs` tablosuna bir satır.
// Tablo (migration 20261123085248): id, started_at, finished_at, trigger, counts jsonb,
// provider_usage jsonb, errors jsonb, ok. RLS herkese kapalı; sadece service role yazar.

export const RUNS_TABLE = 'pipeline_runs';

/**
 * Orkestratör özetinden tablo satırı (saf).
 * @param {object} summary  v2-daily özet JSON'u
 */
export function buildRunRow(summary) {
  return {
    started_at: summary.started_at,
    finished_at: summary.finished_at,
    trigger: summary.trigger ?? null,
    counts: {
      mode: summary.mode,
      options: summary.options,
      duration_ms: summary.duration_ms,
      collect: summary.steps?.collect ?? null,
      process: summary.steps?.process ?? null,
      publish: summary.steps?.publish ?? null,
      queued: summary.queued ?? 0,
      reject_reasons: summary.rejectReasons ?? {},
      model_events: summary.modelEvents ?? [],
      rate_events: summary.rateEvents ?? null,
      alarms: summary.alarms ?? [],
    },
    provider_usage: summary.providerUsage ?? null,
    errors: summary.errors ?? [],
    ok: Boolean(summary.ok),
  };
}

/**
 * @param {{ from: (table: string) => any }} client
 * @param {object} row  buildRunRow çıktısı
 * @returns {Promise<{ id: string | null }>}
 */
export async function insertRun(client, row) {
  const { data, error } = await client.from(RUNS_TABLE).insert(row).select('id').single();
  if (error) throw new Error(`${RUNS_TABLE} yazılamadı: ${error.message}`);
  return { id: data?.id ?? null };
}
