import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CARD_ASK_PRESETS,
  type CardAskPresetId,
  askCard,
  buildHistory,
  cardAskErrorMessage,
  normalizeQuestion,
  shouldOfferPremium,
} from './cardAsk';
import { incrementDailyActivity } from './userActivity';

export type CardAskChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isError?: boolean;
};

type UseCardAskOptions = {
  factId: string | null;
  hasPremium: boolean;
  onOfferPremium?: () => void;
};

export function useCardAsk({ factId, hasPremium, onOfferPremium }: UseCardAskOptions) {
  const [messages, setMessages] = useState<CardAskChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const loadingRef = useRef(false);
  const messagesRef = useRef<CardAskChatMessage[]>([]);
  const counterRef = useRef(0);
  const requestIdRef = useRef(0);

  useEffect(
    () => () => {
      requestIdRef.current += 1;
    },
    [],
  );

  const push = useCallback((message: Omit<CardAskChatMessage, 'id'>) => {
    counterRef.current += 1;
    const next = [...messagesRef.current, { ...message, id: `m${counterRef.current}` }];
    messagesRef.current = next;
    setMessages(next);
  }, []);

  const run = useCallback(
    async (userText: string, input: { presetId?: CardAskPresetId; question?: string }) => {
      if (!factId || loadingRef.current) {
        return;
      }
      requestIdRef.current += 1;
      const requestId = requestIdRef.current;
      loadingRef.current = true;
      setIsLoading(true);
      const history = buildHistory(messagesRef.current.filter((m) => !m.isError));
      push({ role: 'user', content: userText });
      try {
        const result = await askCard({ factId, ...input, history });
        if (requestId !== requestIdRef.current) {
          return;
        }
        push({ role: 'assistant', content: result.answer });
        if (typeof result.quota?.remaining === 'number') {
          setRemaining(result.quota.remaining);
        }
        void incrementDailyActivity({ aiQueries: 1 });
      } catch (error) {
        if (requestId !== requestIdRef.current) {
          return;
        }
        const err = error as { code?: string };
        push({
          role: 'assistant',
          content: cardAskErrorMessage(err, { hasPremium }),
          isError: true,
        });
        if (shouldOfferPremium(err, { hasPremium })) {
          onOfferPremium?.();
        }
      } finally {
        if (requestId === requestIdRef.current) {
          loadingRef.current = false;
          setIsLoading(false);
        }
      }
    },
    [factId, hasPremium, onOfferPremium, push],
  );

  const askPreset = useCallback(
    (id: CardAskPresetId) => {
      const preset = CARD_ASK_PRESETS.find((p) => p.id === id);
      if (!preset) {
        return Promise.resolve();
      }
      return run(preset.label, { presetId: id });
    },
    [run],
  );

  const askFree = useCallback(
    (text: string) => {
      const normalized = normalizeQuestion(text);
      if (!normalized.ok) {
        return Promise.resolve();
      }
      return run(normalized.value, { question: normalized.value });
    },
    [run],
  );

  const reset = useCallback(() => {
    requestIdRef.current += 1;
    loadingRef.current = false;
    setIsLoading(false);
    messagesRef.current = [];
    setMessages([]);
    setRemaining(null);
  }, []);

  return { messages, isLoading, remaining, askPreset, askFree, reset };
}
