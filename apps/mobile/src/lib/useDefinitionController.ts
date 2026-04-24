import { useMemo, useRef, useState } from 'react';
import { Animated } from 'react-native';
import { type AiDefinitionResult, fetchAiDefinition } from './aiDefinition';
import type { ReaderDefinition } from './bookContent';
import type { ReaderTextSection } from './bookSections';

type PopupState = {
  word: string;
  sectionIndex: number;
} | null;

type PopupDefinitionState = {
  type: string;
  def: string;
} | null;

type UseDefinitionControllerParams = {
  activeDefinitions: Record<string, ReaderDefinition>;
  activeSectionIndex: number;
  bookId: string;
  bookTitle: string;
  hasSectionContent: boolean;
  readerContext: string;
  textSections: ReaderTextSection[];
  buildContextForSection: (sectionIndex: number, focusWord?: string) => string;
};

function setTypewriterText(
  intervalRef: React.MutableRefObject<ReturnType<typeof setInterval> | null>,
  setAiText: (value: string) => void,
  value: string,
) {
  if (intervalRef.current) {
    clearInterval(intervalRef.current);
    intervalRef.current = null;
  }

  if (!value) {
    setAiText('');
    return;
  }

  let cursor = 0;
  intervalRef.current = setInterval(() => {
    cursor += 1;
    setAiText(value.slice(0, cursor));

    if (cursor >= value.length && intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, 20);
}

export function useDefinitionController(params: UseDefinitionControllerParams) {
  const FAILURE_COOLDOWN_MS = 15000;
  const [popup, setPopup] = useState<PopupState>(null);
  const [popupDefinition, setPopupDefinition] = useState<PopupDefinitionState>(null);
  const [aiText, setAiText] = useState('');
  const slideAnim = useRef(new Animated.Value(300)).current;
  const definitionCacheRef = useRef<Map<string, AiDefinitionResult>>(new Map());
  const definitionFailureCooldownRef = useRef<Map<string, number>>(new Map());
  const pendingDefinitionRef = useRef<Map<string, Promise<AiDefinitionResult>>>(new Map());
  const definitionRequestIdRef = useRef(0);
  const typewriterIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const resolvedDefinition = useMemo(() => {
    if (!popup) {
      return null;
    }

    return popupDefinition ?? params.activeDefinitions[popup.word] ?? null;
  }, [params.activeDefinitions, popup, popupDefinition]);

  const openPopup = (word: string, sectionIndex = params.activeSectionIndex) => {
    setPopup({ word, sectionIndex });
    setPopupDefinition(null);
    setAiText('Baglamsal aciklama hazirlaniyor...');
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      speed: 14,
      bounciness: 4,
    }).start();

    const fallback = params.activeDefinitions[word];
    const cacheKey = `${params.bookId}:${sectionIndex}:${word.toLowerCase()}`;
    const cached = definitionCacheRef.current.get(cacheKey);
    const failureCooldownUntil = definitionFailureCooldownRef.current.get(cacheKey) ?? 0;

    if (Date.now() < failureCooldownUntil) {
      setPopupDefinition({
        type: fallback?.type ?? 'Baglamsal Aciklama',
        def: fallback?.def ?? 'Tanim bulunamadi.',
      });
      setTypewriterText(
        typewriterIntervalRef,
        setAiText,
        fallback?.ai ?? 'AI aciklamasi kisa bir sure icin beklemede.',
      );
      return;
    }

    if (cached) {
      setPopupDefinition({
        type: `${fallback?.type ?? 'Baglamsal Aciklama'} (${cached.confidence})`,
        def: cached.definition || fallback?.def || 'Tanim bulunamadi.',
      });
      setTypewriterText(
        typewriterIntervalRef,
        setAiText,
        cached.explanation || fallback?.ai || 'Aciklama su anda alinmiyor.',
      );
      return;
    }

    definitionRequestIdRef.current += 1;
    const requestId = definitionRequestIdRef.current;

    void (async () => {
      try {
        const inFlight = pendingDefinitionRef.current.get(cacheKey);
        const requestPromise =
          inFlight ??
          fetchAiDefinition({
            word,
            context: params.hasSectionContent
              ? params.buildContextForSection(sectionIndex, word)
              : params.readerContext,
            bookTitle: params.bookTitle,
          });

        if (!inFlight) {
          pendingDefinitionRef.current.set(cacheKey, requestPromise);
        }

        const response = await requestPromise;
        pendingDefinitionRef.current.delete(cacheKey);

        if (requestId !== definitionRequestIdRef.current) {
          return;
        }

        definitionCacheRef.current.set(cacheKey, response);
        definitionFailureCooldownRef.current.delete(cacheKey);
        setPopupDefinition({
          type: `${fallback?.type ?? 'Baglamsal Aciklama'} (${response.confidence})`,
          def: response.definition || fallback?.def || 'Tanim bulunamadi.',
        });
        setTypewriterText(
          typewriterIntervalRef,
          setAiText,
          response.explanation || fallback?.ai || 'Aciklama su anda alinmiyor.',
        );
      } catch (error) {
        pendingDefinitionRef.current.delete(cacheKey);
        if (requestId !== definitionRequestIdRef.current) {
          return;
        }

        const message = error instanceof Error ? error.message : String(error);
        console.warn('[Dev] ai-definition invoke failed:', message);
        definitionFailureCooldownRef.current.set(cacheKey, Date.now() + FAILURE_COOLDOWN_MS);
        setPopupDefinition({
          type: fallback?.type ?? 'Baglamsal Aciklama',
          def: fallback?.def ?? 'Tanim bulunamadi.',
        });
        setTypewriterText(
          typewriterIntervalRef,
          setAiText,
          fallback?.ai ?? 'AI aciklamasi su anda kullanilamiyor.',
        );
      }
    })();
  };

  const closePopup = () => {
    definitionRequestIdRef.current += 1;

    if (typewriterIntervalRef.current) {
      clearInterval(typewriterIntervalRef.current);
      typewriterIntervalRef.current = null;
    }

    Animated.timing(slideAnim, { toValue: 300, duration: 250, useNativeDriver: true }).start(() => {
      setPopup(null);
      setPopupDefinition(null);
      setAiText('');
    });
  };

  return {
    aiText,
    closePopup,
    openPopup,
    popup,
    resolvedDefinition,
    slideAnim,
  };
}
