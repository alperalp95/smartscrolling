import { type FeedIndexItem, buildFeedOrder, createSeededRandom } from '../feedOrder';

const NOW = new Date('2026-11-26T12:00:00Z');
const DAY = 24 * 60 * 60 * 1000;

function daysAgo(n: number): string {
  return new Date(NOW.getTime() - n * DAY).toISOString();
}

function item(id: string, category: string | null, ageDays: number | null): FeedIndexItem {
  return {
    id,
    category,
    published_at: ageDays === null ? null : daysAgo(ageDays),
    created_at: daysAgo(30),
  };
}

function makeItems(): FeedIndexItem[] {
  const cats = ['Bilim', 'Tarih', 'Sağlık'];
  const items: FeedIndexItem[] = [];
  for (let i = 0; i < 12; i++) {
    items.push(item(`f${i}`, cats[i % 3], 20 + i));
  }
  return items;
}

describe('createSeededRandom', () => {
  it('returns the same sequence for the same seed', () => {
    const a = createSeededRandom(42);
    const b = createSeededRandom(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it('returns values in [0, 1)', () => {
    const r = createSeededRandom(7);
    for (let i = 0; i < 100; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('buildFeedOrder', () => {
  const seenIds = new Set<string>();

  it('returns [] for an empty list', () => {
    expect(buildFeedOrder([], { seenIds, seed: 1, now: NOW })).toEqual([]);
  });

  it('gives the same order for the same seed', () => {
    const items = makeItems();
    const a = buildFeedOrder(items, { seenIds, seed: 5, now: NOW });
    const b = buildFeedOrder(items, { seenIds, seed: 5, now: NOW });
    expect(a).toEqual(b);
  });

  it('gives a different order for different seeds (mostly)', () => {
    const items = makeItems();
    const base = buildFeedOrder(items, { seenIds, seed: 1, now: NOW }).join(',');
    const others = [2, 3, 4, 5, 6].map((s) =>
      buildFeedOrder(items, { seenIds, seed: s, now: NOW }).join(','),
    );
    expect(others.some((o) => o !== base)).toBe(true);
  });

  it('puts seen cards last', () => {
    const items = makeItems();
    const seen = new Set(['f0', 'f1', 'f2', 'f3']);
    const order = buildFeedOrder(items, { seenIds: seen, seed: 9, now: NOW });
    expect(order).toHaveLength(12);
    expect(new Set(order.slice(8))).toEqual(seen);
  });

  it('still returns every card when all are seen', () => {
    const items = makeItems();
    const seen = new Set(items.map((i) => i.id));
    const order = buildFeedOrder(items, { seenIds: seen, seed: 9, now: NOW });
    expect([...order].sort()).toEqual(items.map((i) => i.id).sort());
  });

  it('leads with random fresh cards (not always the same), and 8-day-old is not fresh', () => {
    const items: FeedIndexItem[] = [
      item('old8', 'A', 8),
      item('fresh5', 'B', 5),
      item('fresh1', 'C', 1),
      item('fresh3', 'D', 3),
      item('fresh0', 'E', 0.5),
      item('fresh6', 'F', 6),
      item('x1', 'G', 40),
      item('x2', 'H', 50),
    ];
    const leads = new Set<string>();
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const lead = buildFeedOrder(items, { seenIds, seed, now: NOW }).slice(0, 3);
      for (const id of lead) expect(id.startsWith('fresh')).toBe(true);
      leads.add(lead.join(','));
    }
    expect(leads.size).toBeGreaterThan(1);
  });

  it('keeps fresh lead cards on top even when they share a category', () => {
    const items: FeedIndexItem[] = [
      item('f1', 'A', 1),
      item('f2', 'A', 1),
      item('f3', 'A', 1),
      item('x1', 'B', 40),
      item('x2', 'C', 50),
      item('x3', 'A', 60),
    ];
    for (const seed of [1, 2, 3]) {
      const lead = buildFeedOrder(items, { seenIds, seed, now: NOW }).slice(0, 3);
      expect([...lead].sort()).toEqual(['f1', 'f2', 'f3']);
    }
  });

  it('falls back to created_at when published_at is missing', () => {
    const items: FeedIndexItem[] = [
      { id: 'o1', category: 'B', published_at: null, created_at: daysAgo(60) },
      { id: 'c1', category: 'A', published_at: null, created_at: daysAgo(1) },
    ];
    expect(buildFeedOrder(items, { seenIds, seed: 3, now: NOW, freshLead: 1 })[0]).toBe('c1');
  });

  it('avoids same category back to back with 3 categories x 4 cards', () => {
    const items = makeItems();
    const catOf = new Map(items.map((i) => [i.id, i.category]));
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const order = buildFeedOrder(items, { seenIds, seed, now: NOW });
      for (let i = 1; i < order.length; i++) {
        expect(catOf.get(order[i])).not.toBe(catOf.get(order[i - 1]));
      }
    }
  });

  it('does not crash with a single category', () => {
    const items = [item('a', 'Bilim', 20), item('b', 'Bilim', 21), item('c', 'Bilim', 22)];
    const order = buildFeedOrder(items, { seenIds, seed: 1, now: NOW });
    expect([...order].sort()).toEqual(['a', 'b', 'c']);
  });

  it('treats null category as its own category', () => {
    const items = [
      item('a', null, 20),
      item('b', null, 21),
      item('c', 'Bilim', 22),
      item('d', 'Bilim', 23),
    ];
    const catOf = new Map(items.map((i) => [i.id, i.category]));
    const order = buildFeedOrder(items, { seenIds, seed: 2, now: NOW });
    for (let i = 1; i < order.length; i++) {
      expect(catOf.get(order[i])).not.toBe(catOf.get(order[i - 1]));
    }
  });

  it('emits duplicate ids only once', () => {
    const items = [item('a', 'A', 20), item('a', 'A', 20), item('b', 'B', 21)];
    const order = buildFeedOrder(items, { seenIds, seed: 1, now: NOW });
    expect([...order].sort()).toEqual(['a', 'b']);
  });
});
