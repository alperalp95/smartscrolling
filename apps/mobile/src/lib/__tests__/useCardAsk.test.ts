import { act, renderHook } from '@testing-library/react-native';
import { CardAskError, askCard } from '../cardAsk';
import { useCardAsk } from '../useCardAsk';

jest.mock('../userActivity', () => ({ incrementDailyActivity: jest.fn() }));
jest.mock('../cardAsk', () => {
  const actual = jest.requireActual('../cardAsk');
  return { ...actual, askCard: jest.fn() };
});

const mockedAsk = askCard as jest.Mock;
const FACT = '11111111-1111-1111-1111-111111111111';

describe('useCardAsk', () => {
  beforeEach(() => mockedAsk.mockReset());

  it('preset adds user and assistant messages and quota', async () => {
    mockedAsk.mockResolvedValue({
      answer: 'Cevap',
      presetId: 'why',
      quota: { remaining: 2 },
    });
    const { result } = renderHook(() => useCardAsk({ factId: FACT, hasPremium: false }));
    await act(async () => {
      await result.current.askPreset('why');
    });
    expect(result.current.messages.map((m) => m.role)).toEqual(['user', 'assistant']);
    expect(result.current.messages[1].content).toBe('Cevap');
    expect(result.current.remaining).toBe(2);
    expect(mockedAsk).toHaveBeenCalledWith(
      expect.objectContaining({ factId: FACT, presetId: 'why' }),
    );
  });

  it('error adds an error bubble and offers premium', async () => {
    mockedAsk.mockRejectedValue(new CardAskError('x', { code: 'quota_exceeded' }));
    const onOfferPremium = jest.fn();
    const { result } = renderHook(() =>
      useCardAsk({ factId: FACT, hasPremium: false, onOfferPremium }),
    );
    await act(async () => {
      await result.current.askPreset('more');
    });
    const last = result.current.messages[result.current.messages.length - 1];
    expect(last.role).toBe('assistant');
    expect(last.isError).toBe(true);
    expect(onOfferPremium).toHaveBeenCalled();
  });

  it('ignores a second call while loading', async () => {
    let resolve: (v: unknown) => void = () => {};
    mockedAsk.mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }),
    );
    const { result } = renderHook(() => useCardAsk({ factId: FACT, hasPremium: true }));
    await act(async () => {
      void result.current.askPreset('why');
      void result.current.askPreset('simple');
    });
    expect(mockedAsk).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolve({ answer: 'ok', presetId: 'why', quota: {} });
    });
    expect(result.current.isLoading).toBe(false);
  });

  it('ignores a response that arrives after reset and unblocks new asks', async () => {
    let resolveFirst: (v: unknown) => void = () => {};
    mockedAsk.mockReturnValueOnce(
      new Promise((r) => {
        resolveFirst = r;
      }),
    );
    const { result } = renderHook(() => useCardAsk({ factId: FACT, hasPremium: true }));
    await act(async () => {
      void result.current.askPreset('why');
    });
    expect(result.current.isLoading).toBe(true);
    act(() => {
      result.current.reset();
    });
    expect(result.current.isLoading).toBe(false);
    mockedAsk.mockResolvedValueOnce({ answer: 'yeni', presetId: 'simple', quota: {} });
    await act(async () => {
      await result.current.askPreset('simple');
    });
    await act(async () => {
      resolveFirst({ answer: 'eski', presetId: 'why', quota: {} });
    });
    expect(mockedAsk).toHaveBeenCalledTimes(2);
    expect(result.current.messages.map((m) => m.content)).not.toContain('eski');
    expect(result.current.messages[result.current.messages.length - 1].content).toBe('yeni');
    expect(result.current.isLoading).toBe(false);
  });

  it('does not produce an error bubble or premium offer after unmount', async () => {
    let rejectFn: (e: unknown) => void = () => {};
    mockedAsk.mockReturnValueOnce(
      new Promise((_, rej) => {
        rejectFn = rej;
      }),
    );
    const onOfferPremium = jest.fn();
    const { result, unmount } = renderHook(() =>
      useCardAsk({ factId: FACT, hasPremium: false, onOfferPremium }),
    );
    await act(async () => {
      void result.current.askPreset('why');
    });
    unmount();
    await act(async () => {
      rejectFn(new CardAskError('x', { code: 'quota_exceeded' }));
    });
    expect(onOfferPremium).not.toHaveBeenCalled();
  });
});
