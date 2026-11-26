export type FeedIndexItem = {
  id: string;
  category: string | null;
  published_at: string | null;
  created_at: string | null;
};

export type FeedOrderOptions = {
  seenIds: ReadonlySet<string>;
  seed: number;
  now: Date;
  /** Kaç gün içindeki kartlar "taze" sayılır (varsayılan 7). */
  freshDays?: number;
  /** Akışın başında kaç taze kart öne alınır (varsayılan 3). */
  freshLead?: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** mulberry32: küçük, tohumla belirli rastgele sayı üreteci; [0, 1) döner. */
export function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(list: readonly T[], random: () => number): T[] {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function itemTime(item: FeedIndexItem): number {
  const raw = item.published_at ?? item.created_at;
  return raw ? Date.parse(raw) : Number.NaN;
}

/** Aynı kategori arka arkaya gelmesin: çakışan kartı, ilk farklı kategorili kartla değiştir. */
function spreadCategories(
  list: FeedIndexItem[],
  previous: string | null | undefined,
): FeedIndexItem[] {
  const out = list.slice();
  let prev = previous;
  for (let i = 0; i < out.length; i++) {
    if (prev !== undefined && out[i].category === prev) {
      // Kalanlar arasında en kalabalık farklı kategoriden ilk kartı seç (sonda tıkanmayı önler).
      const counts = new Map<string | null, number>();
      for (let j = i + 1; j < out.length; j++) {
        if (out[j].category !== prev) {
          counts.set(out[j].category, (counts.get(out[j].category) ?? 0) + 1);
        }
      }
      let pick = -1;
      let best = 0;
      for (let j = i + 1; j < out.length; j++) {
        const c = counts.get(out[j].category) ?? 0;
        if (out[j].category !== prev && c > best) {
          best = c;
          pick = j;
        }
      }
      if (pick !== -1) [out[i], out[pick]] = [out[pick], out[i]];
    }
    prev = out[i].category;
  }
  return repairTail(out, previous);
}

/** Açgözlü geçiş sonda tıkanırsa: çakışan kartı, iki yanında çakışma yaratmayan bir yerle değiştir. */
function repairTail(list: FeedIndexItem[], previous: string | null | undefined): FeedIndexItem[] {
  const out = list.slice();
  const clash = (i: number): boolean => {
    if (i < 0 || i >= out.length) return false;
    const before = i === 0 ? previous : out[i - 1].category;
    const after = i + 1 < out.length ? out[i + 1].category : undefined;
    return out[i].category === before || out[i].category === after;
  };
  for (let i = 0; i < out.length; i++) {
    if (!clash(i)) continue;
    for (let k = 0; k < out.length; k++) {
      if (k === i || out[k].category === out[i].category) continue;
      [out[i], out[k]] = [out[k], out[i]];
      if (!clash(i) && !clash(k)) break;
      [out[i], out[k]] = [out[k], out[i]];
    }
  }
  return out;
}

export function buildFeedOrder(items: FeedIndexItem[], opts: FeedOrderOptions): string[] {
  const freshDays = opts.freshDays ?? 7;
  const freshLead = opts.freshLead ?? 3;
  const random = createSeededRandom(opts.seed);

  const unique: FeedIndexItem[] = [];
  const known = new Set<string>();
  for (const item of items) {
    if (known.has(item.id)) continue;
    known.add(item.id);
    unique.push(item);
  }

  const unseen = unique.filter((i) => !opts.seenIds.has(i.id));
  const seen = unique.filter((i) => opts.seenIds.has(i.id));

  const cutoff = opts.now.getTime() - freshDays * DAY_MS;
  const fresh = unseen
    .filter((i) => {
      const t = itemTime(i);
      return !Number.isNaN(t) && t >= cutoff;
    })
    .sort((a, b) => itemTime(b) - itemTime(a));
  const lead = fresh.slice(0, freshLead);
  const leadIds = new Set(lead.map((i) => i.id));
  const rest = shuffle(
    unseen.filter((i) => !leadIds.has(i.id)),
    random,
  );

  const head = spreadCategories([...lead, ...rest], undefined);
  const tail = spreadCategories(
    shuffle(seen, random),
    head.length ? head[head.length - 1].category : undefined,
  );

  return [...head, ...tail].map((i) => i.id);
}
