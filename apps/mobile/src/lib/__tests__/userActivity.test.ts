import { fetchLifetimeFactsRead } from '../userActivity';

let mockSession: { user: { id: string } } | null = null;
let mockRows: { facts_read: number | null }[] | null = [];
let mockError: { message: string } | null = null;

jest.mock('../supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(() => Promise.resolve({ data: { session: mockSession } })),
      getUser: jest.fn(() =>
        Promise.resolve({ data: { user: mockSession?.user ?? null }, error: null }),
      ),
    },
    from: jest.fn(() => ({
      select: () => ({
        eq: () => Promise.resolve({ data: mockRows, error: mockError }),
      }),
    })),
  },
}));

describe('fetchLifetimeFactsRead', () => {
  beforeEach(() => {
    mockSession = { user: { id: 'u1' } };
    mockRows = [];
    mockError = null;
  });

  it('boş veri → 0', async () => {
    expect(await fetchLifetimeFactsRead()).toBe(0);
  });

  it('facts_read değerlerini toplar, null sayılmaz', async () => {
    mockRows = [{ facts_read: 3 }, { facts_read: null }, { facts_read: 5 }];
    expect(await fetchLifetimeFactsRead()).toBe(8);
  });

  it('kullanıcı yoksa 0', async () => {
    mockSession = null;
    mockRows = [{ facts_read: 4 }];
    expect(await fetchLifetimeFactsRead()).toBe(0);
  });
});
