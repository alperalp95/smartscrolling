// Test yardımcısı: Supabase query builder taklidi. Ağ/DB yok; çağrılan zinciri kaydeder.

/**
 * responder(query) -> { data, error, count } ; query = { table, ops: [{ method, args }] }
 */
export function fakeSupabase(responder = () => ({ data: [], error: null })) {
  const queries = [];
  const client = {
    from(table) {
      const query = { table, ops: [] };
      queries.push(query);
      const builder = new Proxy(
        {},
        {
          get(_target, prop) {
            if (prop === 'then') {
              return (resolve, reject) => {
                try {
                  resolve(responder(query));
                } catch (err) {
                  reject(err);
                }
              };
            }
            return (...args) => {
              query.ops.push({ method: prop, args });
              return builder;
            };
          },
        },
      );
      return builder;
    },
  };
  client.queries = queries;
  return client;
}

/** Bellekteki sahte repo: markPublished çağrılarını kaydeder. */
export function fakeRepo({ queued = [], count = queued.length } = {}) {
  const calls = { listQueued: [], markPublished: [], countQueued: 0 };
  return {
    calls,
    async listQueued(limit) {
      calls.listQueued.push(limit);
      return queued.slice(0, limit);
    },
    async markPublished(ids, now) {
      calls.markPublished.push({ ids, now });
      return { publishedIds: [...ids] };
    },
    async countQueued() {
      calls.countQueued += 1;
      return count;
    },
  };
}
