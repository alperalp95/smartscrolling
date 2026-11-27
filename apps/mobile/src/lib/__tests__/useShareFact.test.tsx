import { act, render } from '@testing-library/react-native';
import { Share as RNShare } from 'react-native';
import type { FactType } from '../../types';
import { useShareFact } from '../useShareFact';

const mockCardProps: {
  current: null | { variant: string; onPhotoLoad?: () => void; onPhotoError?: () => void };
} = { current: null };

jest.mock('../../../components/share/share-card', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    ShareCard: React.forwardRef((props: { variant: string }, ref: unknown) => {
      mockCardProps.current = props;
      return <View ref={ref} testID="share-card" />;
    }),
  };
});

const captureRef = require('react-native-view-shot').captureRef as jest.Mock;
const open = require('react-native-share').default.open as jest.Mock;
const setStringAsync = require('expo-clipboard').setStringAsync as jest.Mock;

const PHOTO_FACT = {
  id: 'abc',
  title: 'Başlık',
  media_url: 'https://upload.wikimedia.org/wikipedia/commons/a/ab/x.jpg',
} as unknown as FactType;
const TEXT_FACT = { id: 'abc', title: 'Başlık', media_url: null } as unknown as FactType;
const LINK = 'https://smartscrolling.app/fact/abc';

type Hook = ReturnType<typeof useShareFact>;
function setup() {
  const result: { current: Hook } = { current: null as unknown as Hook };
  function Harness() {
    result.current = useShareFact();
    return result.current.shareHost;
  }
  const { unmount } = render(<Harness />);
  return { result, unmount };
}

const flush = () => act(async () => jest.advanceTimersByTimeAsync(100));

describe('useShareFact', () => {
  let rnShare: jest.SpyInstance;
  beforeEach(() => {
    jest.useFakeTimers();
    mockCardProps.current = null;
    captureRef.mockClear();
    captureRef.mockImplementation(() => Promise.resolve('file:///tmp/share.png'));
    open.mockClear();
    open.mockImplementation(() => Promise.resolve({ success: true }));
    setStringAsync.mockClear();
    rnShare = jest.spyOn(RNShare, 'share').mockResolvedValue({ action: 'sharedAction' });
  });
  afterEach(() => {
    jest.useRealTimers();
    rnShare.mockRestore();
  });

  it('success path captures 1080x1920 png, copies link and opens share with message', async () => {
    const { result } = setup();
    await act(async () => {
      void result.current.shareFact(TEXT_FACT);
    });
    await flush();
    expect(captureRef).toHaveBeenCalledWith(expect.anything(), {
      format: 'png',
      width: 1080,
      height: 1920,
      result: 'tmpfile',
    });
    expect(setStringAsync).toHaveBeenCalledWith(LINK);
    expect(open).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'file:///tmp/share.png',
        type: 'image/png',
        message: `Başlık\n\nDevamı: ${LINK}`,
        failOnCancel: false,
      }),
    );
    expect(rnShare).not.toHaveBeenCalled();
  });

  it('ignores a second call while sharing (single share)', async () => {
    const { result } = setup();
    await act(async () => {
      void result.current.shareFact(TEXT_FACT);
      void result.current.shareFact(TEXT_FACT);
    });
    await flush();
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('captures with text variant after photo timeout of 3000 ms', async () => {
    const seen: string[] = [];
    captureRef.mockImplementation(() => {
      seen.push(mockCardProps.current?.variant ?? 'none');
      return Promise.resolve('file:///tmp/share.png');
    });
    const { result } = setup();
    await act(async () => {
      void result.current.shareFact(PHOTO_FACT);
    });
    expect(mockCardProps.current?.variant).toBe('photo');
    await act(async () => jest.advanceTimersByTimeAsync(2900));
    expect(captureRef).not.toHaveBeenCalled();
    await act(async () => jest.advanceTimersByTimeAsync(100));
    await act(async () => jest.advanceTimersByTimeAsync(100));
    expect(seen).toEqual(['text']);
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('captures with photo variant when the photo loads in time', async () => {
    const seen: string[] = [];
    captureRef.mockImplementation(() => {
      seen.push(mockCardProps.current?.variant ?? 'none');
      return Promise.resolve('file:///tmp/share.png');
    });
    const { result } = setup();
    await act(async () => {
      void result.current.shareFact(PHOTO_FACT);
    });
    await act(async () => {
      mockCardProps.current?.onPhotoLoad?.();
      await jest.advanceTimersByTimeAsync(100);
    });
    expect(seen).toEqual(['photo']);
  });

  it('does not fall back to text share when the user dismisses the share sheet', async () => {
    open.mockResolvedValue({ dismissedAction: true });
    const { result } = setup();
    await act(async () => {
      void result.current.shareFact(TEXT_FACT);
    });
    await flush();
    expect(open).toHaveBeenCalledTimes(1);
    expect(rnShare).not.toHaveBeenCalled();
  });

  it('falls back to RN Share when capture rejects and still tries the clipboard', async () => {
    captureRef.mockRejectedValue(new Error('boom'));
    const { result } = setup();
    await act(async () => {
      void result.current.shareFact(TEXT_FACT);
    });
    await flush();
    expect(open).not.toHaveBeenCalled();
    expect(setStringAsync).toHaveBeenCalledWith(LINK);
    expect(rnShare).toHaveBeenCalledWith({ message: `Başlık\n\nDevamı: ${LINK}` });
  });

  it('resets isSharing and shareHost after finishing', async () => {
    const { result } = setup();
    expect(result.current.isSharing).toBe(false);
    expect(result.current.shareHost).toBeNull();
    await act(async () => {
      void result.current.shareFact(TEXT_FACT);
    });
    expect(result.current.isSharing).toBe(true);
    expect(result.current.shareHost).not.toBeNull();
    await flush();
    expect(result.current.isSharing).toBe(false);
    expect(result.current.shareHost).toBeNull();
  });

  it('ends silently when unmounted while waiting for the photo', async () => {
    const warn = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { result, unmount } = setup();
    await act(async () => {
      void result.current.shareFact(PHOTO_FACT);
    });
    unmount();
    await act(async () => jest.advanceTimersByTimeAsync(4000));
    expect(captureRef).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
    expect(rnShare).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('allows only one share across hook instances', async () => {
    const a = setup();
    const b = setup();
    await act(async () => {
      void a.result.current.shareFact(TEXT_FACT);
      void b.result.current.shareFact(TEXT_FACT);
    });
    await flush();
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('falls back to RN Share when native modules are missing (old build)', async () => {
    for (const name of ['react-native-view-shot', 'react-native-share', 'expo-clipboard']) {
      jest.doMock(
        name,
        () => {
          throw new Error('Cannot find module');
        },
        { virtual: true },
      );
    }
    jest.resetModules();
    // resetModules RN'in tembel Share getter'ını yeniden yükler; casusu yeni kayıt defterinde kur.
    const freshShare = jest
      .spyOn(require('react-native').Share, 'share')
      .mockResolvedValue({ action: 'sharedAction' });
    const { result } = setup();
    await act(async () => {
      void result.current.shareFact(TEXT_FACT);
    });
    await flush();
    expect(freshShare).toHaveBeenCalledWith({
      message: `Başlık

Devamı: ${LINK}`,
    });
    expect(result.current.isSharing).toBe(false);
  });
});
