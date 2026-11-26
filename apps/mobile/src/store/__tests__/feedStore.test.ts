import { type FeedIndexItem, buildFeedOrder } from '../../lib/feedOrder';
import { loadSeenFactIds, resetSeenFactIds } from '../../lib/seenFacts';
import { useFeedStore } from '../feedStore';

let mockIndex: FeedIndexItem[] = [];
let mockIndexError: { message: string } | null = null;

jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: { getSession: jest.fn(() => Promise.resolve({ data: { session: null }, error: null })) },
    from: jest.fn(() => ({
      select: (columns: string) => {
        if (columns.startsWith('id,category')) {
          return {
            eq: () => ({
              limit: () =>
                Promise.resolve({
                  data: mockIndexError ? null : mockIndex,
                  error: mockIndexError,
                }),
            }),
          };
        }
        return {
          eq: () => ({
            in: (_column: string, ids: string[]) =>
              Promise.resolve({
                data: ids.map((id) => ({ id, title: `T-${id}`, category: 'Bilim' })),
                error: null,
              }),
          }),
        };
      },
    })),
  },
}));

jest.mock('../../lib/seenFacts', () => ({
  loadSeenFactIds: jest.fn(),
  resetSeenFactIds: jest.fn(() => Promise.resolve()),
  markFactSeen: jest.fn(() => Promise.resolve()),
}));

const NOW = new Date('2026-11-26T12:00:00Z');
const CATEGORIES = ['A', 'B', 'C', 'D'];

function makeIndex(count: number): FeedIndexItem[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `f${i}`,
    category: CATEGORIES[i % CATEGORIES.length],
    published_at: '2026-01-01T00:00:00Z',
    created_at: '2026-01-01T00:00:00Z',
  }));
}

function ids(): string[] {
  return useFeedStore.getState().facts.map((f) => f.id);
}

describe('feedStore endless shuffled feed', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: NOW, doNotFake: ['nextTick', 'setImmediate'] });
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    mockIndex = makeIndex(40);
    mockIndexError = null;
    (loadSeenFactIds as jest.Mock).mockResolvedValue([]);
    (resetSeenFactIds as jest.Mock).mockClear();
    useFeedStore.setState({
      facts: [],
      orderIds: [],
      orderCursor: 0,
      hasMore: true,
      isLoading: false,
      isLoadingMore: false,
      feedRotationSeed: 4242,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('reset puts facts in buildFeedOrder order (first page of 6)', async () => {
    await useFeedStore.getState().fetchFacts({ reset: true });
    const expected = buildFeedOrder(mockIndex, {
      seenIds: new Set(),
      seed: 4242,
      now: NOW,
    });
    expect(useFeedStore.getState().orderIds).toEqual(expected);
    expect(ids()).toEqual(expected.slice(0, 6));
    expect(useFeedStore.getState().hasMore).toBe(true);
  });

  it('loadMoreFacts appends the next 12 ids in order', async () => {
    await useFeedStore.getState().fetchFacts({ reset: true });
    await useFeedStore.getState().loadMoreFacts();
    const { orderIds } = useFeedStore.getState();
    expect(ids()).toEqual(orderIds.slice(0, 18));
  });

  it('rebuilds the order when it runs out and hasMore stays true', async () => {
    mockIndex = makeIndex(20);
    await useFeedStore.getState().fetchFacts({ reset: true });
    await useFeedStore.getState().loadMoreFacts(); // 6 + 12 = 18
    await useFeedStore.getState().loadMoreFacts(); // 2 left of the old order, then rebuild
    await useFeedStore.getState().loadMoreFacts();
    const state = useFeedStore.getState();
    expect(state.hasMore).toBe(true);
    expect(state.facts.length).toBeGreaterThan(20);
    expect(state.orderCursor).toBeLessThanOrEqual(state.orderIds.length);
  });

  it('does not repeat a card already on screen right after the rebuild', async () => {
    mockIndex = makeIndex(14);
    await useFeedStore.getState().fetchFacts({ reset: true });
    await useFeedStore.getState().loadMoreFacts(); // 14 cards: whole order is on screen
    const before = ids();
    await useFeedStore.getState().loadMoreFacts(); // rebuild; all are on screen, falls back to full order
    expect(useFeedStore.getState().facts.length).toBeGreaterThan(before.length);
    expect(useFeedStore.getState().hasMore).toBe(true);
  });

  it('calls resetSeenFactIds when no unseen card is left', async () => {
    (loadSeenFactIds as jest.Mock).mockResolvedValue(mockIndex.map((i) => i.id));
    await useFeedStore.getState().fetchFacts({ reset: true });
    expect(resetSeenFactIds).toHaveBeenCalledTimes(1);
    expect(ids()).toEqual(
      buildFeedOrder(mockIndex, { seenIds: new Set(), seed: 4242, now: NOW }).slice(0, 6),
    );
  });

  it('does not reset seen ids while unseen cards remain', async () => {
    (loadSeenFactIds as jest.Mock).mockResolvedValue(['f0', 'f1']);
    await useFeedStore.getState().fetchFacts({ reset: true });
    expect(resetSeenFactIds).not.toHaveBeenCalled();
  });

  it('hasMore is false when the index is empty', async () => {
    mockIndex = [];
    await useFeedStore.getState().fetchFacts({ reset: true });
    expect(useFeedStore.getState().facts).toEqual([]);
    expect(useFeedStore.getState().hasMore).toBe(false);
  });

  it('keeps the old facts and stops loading when the index query fails', async () => {
    mockIndexError = { message: 'boom' };
    await useFeedStore.getState().fetchFacts({ reset: true });
    expect(useFeedStore.getState().isLoading).toBe(false);
    expect(useFeedStore.getState().facts).toEqual([]);
  });
});
