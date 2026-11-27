// Paylaşım akışı: kartı ekran dışında çiz -> fotoğrafı bekle -> PNG'ye çevir -> linki kopyala -> paylaş.
// Yerel kütüphaneler eski uygulama derlemesinde olmayabilir; bu yüzden fonksiyon içinde yüklenir
// ve her hata metin paylaşımına düşer (vazgeçme hata değildir).
import { type ReactElement, useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Share as RNShare, ToastAndroid, View } from 'react-native';
import { ShareCard } from '../../components/share/share-card';
import { SHARE_CONFIG } from '../config/share';
import type { FactType } from '../types';
import {
  type ShareVariant,
  buildFactShareLink,
  buildShareMessage,
  pickShareVariant,
} from './shareCard';

// Yerel kütüphanelerin kullandığımız kısmı (paketler yoksa da tip denetimi geçsin diye elle tanımlı).
type CaptureRef = (
  ref: unknown,
  options: { format: 'png'; width: number; height: number; result: 'tmpfile' },
) => Promise<string>;
type ShareOpen = (options: {
  url: string;
  type: string;
  message: string;
  failOnCancel: boolean;
}) => Promise<unknown>;
type SetClipboard = (text: string) => Promise<unknown>;

type HostState = { fact: FactType; variant: ShareVariant; photoUri: string | null };

const FRAME_WAIT_MS = 50;
const TOAST_TEXT = 'Link kopyalandı';

// Tek paylaşım kilidi: farklı kartlardan art arda basış da tek akış başlatır.
let shareInFlight = false;

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function loadCaptureRef(): CaptureRef {
  return require('react-native-view-shot').captureRef;
}
function loadShareOpen(): ShareOpen {
  const mod = require('react-native-share');
  return (mod.default ?? mod).open;
}
function loadSetClipboard(): SetClipboard {
  return require('expo-clipboard').setStringAsync;
}

async function copyLink(link: string): Promise<boolean> {
  try {
    await loadSetClipboard()(link);
    if (Platform.OS === 'android') ToastAndroid.show(TOAST_TEXT, ToastAndroid.SHORT);
    return true;
  } catch {
    return false;
  }
}

export function useShareFact(): {
  shareFact: (fact: FactType) => Promise<void>;
  isSharing: boolean;
  shareHost: ReactElement | null;
} {
  const [host, setHost] = useState<HostState | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const mountedRef = useRef(true);
  const cardRef = useRef<View>(null);
  const photoDone = useRef<(() => void) | null>(null);
  const photoLoadedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      photoDone.current?.();
    };
  }, []);

  const settlePhoto = useCallback(() => photoDone.current?.(), []);

  const shareFact = useCallback(async (fact: FactType) => {
    if (shareInFlight) return;
    shareInFlight = true;
    setIsSharing(true);
    const link = buildFactShareLink(fact.id);
    const message = buildShareMessage(fact.title, link);
    let copied = false;
    try {
      const captureRef = loadCaptureRef();
      const open = loadShareOpen();
      const picked = pickShareVariant(fact);
      const photoReady =
        picked.variant === 'photo'
          ? new Promise<void>((resolve) => {
              const timer = setTimeout(resolve, SHARE_CONFIG.photoTimeoutMs);
              photoDone.current = () => {
                clearTimeout(timer);
                resolve();
              };
            })
          : null;
      setHost({ fact, variant: picked.variant, photoUri: picked.photoUri });
      if (photoReady) {
        await photoReady;
        if (!mountedRef.current) return;
        if (!photoLoadedRef.current) setHost({ fact, variant: 'text', photoUri: null });
      }
      await wait(FRAME_WAIT_MS);
      if (!mountedRef.current || !cardRef.current) return;
      const uri = await captureRef(cardRef.current, {
        format: 'png',
        width: 1080,
        height: 1920,
        result: 'tmpfile',
      });
      if (!mountedRef.current) return;
      copied = await copyLink(link);
      await open({ url: uri, type: 'image/png', message, failOnCancel: false });
    } catch {
      if (!mountedRef.current) return;
      if (!copied) await copyLink(link);
      try {
        await RNShare.share({ message });
      } catch {
        // Yedek paylaşım da başarısızsa sessizce vazgeç.
      }
    } finally {
      photoDone.current = null;
      photoLoadedRef.current = false;
      shareInFlight = false;
      if (mountedRef.current) {
        setHost(null);
        setIsSharing(false);
      }
    }
  }, []);

  const onPhotoLoad = useCallback(() => {
    photoLoadedRef.current = true;
    settlePhoto();
  }, [settlePhoto]);
  const onPhotoError = settlePhoto;

  const shareHost: ReactElement | null = host ? (
    <View pointerEvents="none" style={{ position: 'absolute', left: -10000, top: 0 }}>
      <ShareCard
        ref={cardRef}
        fact={host.fact}
        variant={host.variant}
        photoUri={host.photoUri}
        onPhotoLoad={onPhotoLoad}
        onPhotoError={onPhotoError}
      />
    </View>
  ) : null;

  return { shareFact, isSharing, shareHost };
}
