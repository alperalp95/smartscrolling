import { useRef, useState } from 'react';
import { type AiChatMessage, fetchAiChat } from './aiChat';

type UseBookChatParams = {
  bookTitle: string;
  initialAssistantMessage: string;
  readerContext: string;
};

export function useBookChat(params: UseBookChatParams) {
  const REQUEST_COOLDOWN_MS = 2500;
  const FAILURE_COOLDOWN_MS = 15000;
  const RESPONSE_CACHE_MS = 30000;
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<AiChatMessage[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const lastRequestKeyRef = useRef<string>('');
  const cooldownUntilRef = useRef(0);
  const failureCooldownRef = useRef<Map<string, number>>(new Map());
  const responseCacheRef = useRef<Map<string, { answer: string; createdAt: number }>>(new Map());
  const lastNoticeRef = useRef<string>('');

  const pushAssistantNotice = (content: string) => {
    if (!content || lastNoticeRef.current === content) {
      return;
    }

    lastNoticeRef.current = content;
    setChatMessages((currentMessages) => [
      ...currentMessages,
      {
        role: 'assistant',
        content,
      },
    ]);
  };

  const ensureChatOpenedState = () => {
    setChatMessages((currentMessages) => {
      if (currentMessages.length > 0) {
        return currentMessages;
      }

      return [
        {
          role: 'assistant',
          content: params.initialAssistantMessage,
        },
      ];
    });
  };

  const sendMessage = async (question: string) => {
    const normalizedQuestion = question.trim();

    if (!normalizedQuestion) {
      return { sent: false as const, reason: 'invalid' as const };
    }

    if (isChatLoading) {
      pushAssistantNotice('Bir onceki yanit halen hazirlaniyor. Lutfen kisa bir an bekle.');
      return { sent: false as const, reason: 'loading' as const };
    }

    const requestKey = `${params.bookTitle}:${normalizedQuestion}:${params.readerContext}`;
    const now = Date.now();

    if (requestKey === lastRequestKeyRef.current && now < cooldownUntilRef.current) {
      pushAssistantNotice(
        'Ayni soruyu yeni yanitladim. Istersen kisa bir an sonra tekrar deneyebilirsin.',
      );
      return { sent: false as const, reason: 'cooldown' as const };
    }

    const failureCooldownUntil = failureCooldownRef.current.get(requestKey) ?? 0;

    if (now < failureCooldownUntil) {
      pushAssistantNotice(
        'Sohbet servisi kisa bir sure icin beklemede. Lutfen biraz sonra tekrar dene.',
      );
      return { sent: false as const, reason: 'cooldown' as const };
    }

    const cachedResponse = responseCacheRef.current.get(requestKey);

    if (cachedResponse && now - cachedResponse.createdAt < RESPONSE_CACHE_MS) {
      setChatMessages((currentMessages) => [
        ...currentMessages,
        { role: 'user', content: normalizedQuestion },
        { role: 'assistant', content: cachedResponse.answer },
      ]);
      lastNoticeRef.current = '';
      setChatInput('');
      return { sent: true as const, reason: 'cache' as const };
    }

    lastRequestKeyRef.current = requestKey;
    cooldownUntilRef.current = now + REQUEST_COOLDOWN_MS;

    const nextHistory = [
      ...chatMessages.filter((message) => message.role === 'user' || message.role === 'assistant'),
      { role: 'user' as const, content: normalizedQuestion },
    ];

    setChatMessages(nextHistory);
    lastNoticeRef.current = '';
    setChatInput('');
    setIsChatLoading(true);

    try {
      const response = await fetchAiChat({
        question: normalizedQuestion,
        bookTitle: params.bookTitle,
        context: params.readerContext,
        history: nextHistory.filter(
          (message) => message.role === 'user' || message.role === 'assistant',
        ),
      });

      setChatMessages((currentMessages) => [
        ...currentMessages,
        {
          role: 'assistant',
          content: response.answer || 'Su anda net bir cevap uretemedim.',
        },
      ]);
      lastNoticeRef.current = '';
      responseCacheRef.current.set(requestKey, {
        answer: response.answer || 'Su anda net bir cevap uretemedim.',
        createdAt: Date.now(),
      });
      failureCooldownRef.current.delete(requestKey);

      return { sent: true as const };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn('[Dev] ai-chat invoke failed:', message);
      failureCooldownRef.current.set(requestKey, Date.now() + FAILURE_COOLDOWN_MS);
      pushAssistantNotice('Sohbet su anda kullanilamiyor. Lutfen daha sonra tekrar dene.');
      return { sent: false as const, reason: 'error' as const };
    } finally {
      setIsChatLoading(false);
    }
  };

  return {
    chatInput,
    chatMessages,
    ensureChatOpenedState,
    isChatLoading,
    resetChatLoading: () => setIsChatLoading(false),
    sendMessage,
    setChatInput,
    setChatMessages,
  };
}
