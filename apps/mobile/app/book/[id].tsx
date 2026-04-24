import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import type { AiChatMessage } from '../../src/lib/aiChat';
import { promptForAuth } from '../../src/lib/authPrompt';
import { type ReaderDefinition, getReaderSlice } from '../../src/lib/bookContent';
import {
  fetchBookHighlightDefinitions,
  getSectionScopedDefinitions,
} from '../../src/lib/bookHighlights';
import { buildSectionScopedContext, getNeighborSections } from '../../src/lib/bookSectionContext';
import { type ReaderTextSection, fetchBookSections } from '../../src/lib/bookSections';
import { fetchBookById, resolveBookAccess } from '../../src/lib/books';
import { fetchLatestChatSession, saveChatSession } from '../../src/lib/chatSessions';
import { promptForPremium } from '../../src/lib/premiumPrompt';
import { useBookChat } from '../../src/lib/useBookChat';
import { useDefinitionController } from '../../src/lib/useDefinitionController';
import { useReaderProgress } from '../../src/lib/useReaderProgress';
import { useAuthStore } from '../../src/store/authStore';
import type { BookType } from '../../src/types';

export default function BookReaderScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [bookMeta, setBookMeta] = useState<BookType | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [highlightDefinitions, setHighlightDefinitions] = useState<
    Record<string, ReaderDefinition>
  >({});
  const [textSections, setTextSections] = useState<ReaderTextSection[]>([]);
  const chatScrollRef = useRef<ScrollView | null>(null);
  const lastSyncedChatRef = useRef('');
  const bookId = typeof id === 'string' ? id : Array.isArray(id) ? (id[0] ?? '') : '';
  const totalPages = Math.max(bookMeta?.totalPages ?? 248, 1);
  const bookTitle = bookMeta?.title ?? 'Kitap';
  const user = useAuthStore((state) => state.user);
  const hasPremium = useAuthStore((state) => state.hasPremium);
  const setPostAuthRedirectPath = useAuthStore((state) => state.setPostAuthRedirectPath);
  const readerSlice = getReaderSlice(bookId);
  const allDefinitions =
    Object.keys(highlightDefinitions).length > 0 ? highlightDefinitions : readerSlice.definitions;
  const hasSectionContent = textSections.length > 0;
  const {
    activeSectionIndex,
    completionPercent,
    currentPage,
    handleReaderScroll,
    pagesLeft,
    progressHydrated,
    registerSectionOffset,
    setActiveSectionIndex,
    syncActiveSectionFromScroll,
  } = useReaderProgress({
    bookId,
    hasSectionContent,
    textSections,
    totalPages,
  });
  const { activeSection, nextSection, previousSection } = getNeighborSections(
    textSections,
    activeSectionIndex,
  );
  const activeDefinitions = useMemo(() => {
    if (!hasSectionContent || !activeSection) {
      return allDefinitions;
    }

    return getSectionScopedDefinitions(allDefinitions, activeSection.sectionOrder);
  }, [activeSection, allDefinitions, hasSectionContent]);
  const readerContext = hasSectionContent
    ? buildSectionScopedContext({
        activeSection,
        previousSection: activeSectionIndex > 0 ? previousSection : undefined,
        nextSection: activeSectionIndex < textSections.length - 1 ? nextSection : undefined,
        sectionDefinitions: activeDefinitions,
      })
    : buildSectionScopedContext({
        activeSection: {
          id: `${bookId}-fallback`,
          plainText: readerSlice.paragraphs
            .flatMap((paragraph) => paragraph.parts)
            .map((part) => part.text)
            .join(' '),
          sectionOrder: 1,
          summary: null,
          title: null,
        },
      });
  const { aiText, closePopup, openPopup, popup, resolvedDefinition, slideAnim } =
    useDefinitionController({
      activeDefinitions,
      activeSectionIndex,
      bookId,
      bookTitle,
      hasSectionContent,
      readerContext,
      textSections,
      buildContextForSection: (sectionIndex, focusWord) =>
        (() => {
          const neighbors = getNeighborSections(textSections, sectionIndex);
          const sectionDefinitions = neighbors.activeSection
            ? getSectionScopedDefinitions(allDefinitions, neighbors.activeSection.sectionOrder)
            : activeDefinitions;
          const focusDefinition = focusWord ? sectionDefinitions[focusWord] : null;

          return buildSectionScopedContext({
            activeSection: neighbors.activeSection,
            previousSection: neighbors.previousSection,
            nextSection: neighbors.nextSection,
            focusWord,
            focusDefinition,
            sectionDefinitions,
          });
        })(),
    });
  const {
    chatInput,
    chatMessages,
    ensureChatOpenedState,
    isChatLoading,
    resetChatLoading,
    sendMessage,
    setChatInput,
    setChatMessages,
  } = useBookChat({
    bookTitle,
    initialAssistantMessage: `${bookTitle} baglaminda hazir sorulardan biriyle baslayabilir veya premium ile serbest soru sorabilirsin.`,
    readerContext,
  });

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setActiveSectionIndex(0);

      const nextBook = await fetchBookById(bookId);

      if (!cancelled) {
        setBookMeta(nextBook);
      }

      const nextAccess = nextBook
        ? resolveBookAccess(nextBook, {
            hasPremium: false,
            isAuthenticated: Boolean(user),
          })
        : null;

      if (!nextBook || !nextAccess?.canRead) {
        if (!cancelled) {
          setHighlightDefinitions({});
          setTextSections([]);
        }
        return;
      }

      const nextDefinitions = await fetchBookHighlightDefinitions(bookId);
      const nextSections = await fetchBookSections(bookId, nextDefinitions);

      if (!cancelled) {
        setHighlightDefinitions(nextDefinitions);
        setTextSections(nextSections);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [bookId, setActiveSectionIndex, user]);

  const openChat = () => {
    if (!popup) {
      return;
    }

    if (!user) {
      promptForAuth({
        onConfirm: () => {
          setPostAuthRedirectPath(`/book/${bookId}`);
          router.push('/profile');
        },
        message: 'Sohbet gecmisi ve kitap baglamli AI deneyimi icin once giris yap.',
      });
      return;
    }

    setIsChatOpen(true);
    setChatInput(`"${popup.word}" bu bolumde neden onemli?`);
    ensureChatOpenedState();
  };

  const closeChat = () => {
    setIsChatOpen(false);
    resetChatLoading();
  };

  const sendChatMessage = (overrideQuestion?: string) => {
    const question = (overrideQuestion ?? chatInput).trim();

    if (!question || isChatLoading) {
      return;
    }

    if (!overrideQuestion && !hasPremium) {
      promptForPremium({
        title: 'Serbest AI sorulari premium ile acilir',
        message:
          'Hazir sorularla devam edebilirsin. Kendi sorunu yazmak, reklamsiz deneyim ve sohbet gecmisini daha guclu kullanmak icin premium acilacak.',
        onConfirm: () => router.push('/premium'),
      });
      return;
    }

    void sendMessage(question);
  };

  useEffect(() => {
    let cancelled = false;

    const loadChatHistory = async () => {
      const session = await fetchLatestChatSession(bookId);

      if (cancelled) {
        return;
      }

      if (session?.messages?.length) {
        const normalizedMessages = session.messages.filter(
          (message) => message.role === 'user' || message.role === 'assistant',
        );

        lastSyncedChatRef.current = JSON.stringify(normalizedMessages);
        setChatMessages(normalizedMessages);
      } else {
        lastSyncedChatRef.current = '';
        setChatMessages([]);
      }
    };

    void loadChatHistory();

    return () => {
      cancelled = true;
    };
  }, [bookId, setChatMessages]);

  useEffect(() => {
    const normalizedMessages = chatMessages.filter(
      (message) => message.role === 'user' || message.role === 'assistant',
    );
    const nextSignature = JSON.stringify(normalizedMessages);

    if (
      !normalizedMessages.length ||
      isChatLoading ||
      nextSignature === lastSyncedChatRef.current
    ) {
      return;
    }

    const timeoutId = setTimeout(() => {
      void (async () => {
        const result = await saveChatSession({
          bookId,
          messages: normalizedMessages,
        });

        if (result.synced) {
          lastSyncedChatRef.current = nextSignature;
        }
      })();
    }, 1000);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [bookId, chatMessages, isChatLoading]);

  const def = popup ? resolvedDefinition : null;
  const readyQuestions = popup
    ? [
        `"${popup.word}" bu bolumde neden onemli?`,
        `"${popup.word}" fikri metnin ana temasina nasil baglaniyor?`,
        'Bu bolumun ana fikrini daha sade anlatir misin?',
      ]
    : [
        'Bu bolumun ana fikrini daha sade anlatir misin?',
        'Bu kitapta bu bolum neden onemli?',
        'Buradan aklimda kalmasi gereken sey ne?',
      ];
  const access = bookMeta
    ? resolveBookAccess(bookMeta, {
        hasPremium,
        isAuthenticated: Boolean(user),
      })
    : null;
  const isReaderLocked = access ? !access.canRead : false;

  const handleBackPress = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/library');
  };

  return (
    <View style={s.root}>
      <SafeAreaView edges={['top']} style={[s.navWrap, { paddingTop: Math.max(insets.top, 10) }]}>
        <View style={s.nav}>
          <TouchableOpacity onPress={handleBackPress} style={s.backBtn}>
            <Text style={s.backText}>{'<'}</Text>
          </TouchableOpacity>
          <Text style={s.navTitle}>{bookTitle}</Text>
          <Text style={s.navPage}>
            {hasSectionContent
              ? `Bolum ${activeSectionIndex + 1} / ${textSections.length}`
              : `Sayfa ${currentPage} / ${totalPages}`}
          </Text>
        </View>
      </SafeAreaView>

      {isReaderLocked ? (
        <View style={s.lockWrap}>
          <View style={s.lockCard}>
            <Text style={s.lockEyebrow}>
              {access?.needsAuth ? 'Giris Gerekiyor' : 'Premium Kutuphane'}
            </Text>
            <Text style={s.lockTitle}>{bookTitle}</Text>
            <Text style={s.lockBody}>
              {access?.needsAuth
                ? 'Bu metin ogrenme kutuphanesinin giris sonrasi acilan katmaninda yer aliyor. Hesabinla devam ettiginde kitabi okuyabilir, ilerlemeni senkronlayabilir ve AI gecmisini koruyabilirsin.'
                : 'Bu metin premium kutuphane katmaninda yer aliyor. Premium aktif oldugunda tam metne, ilerleme senkronuna ve baglamsal AI deneyimine eriseceksin.'}
            </Text>
            <TouchableOpacity
              onPress={() => {
                if (access?.needsAuth) {
                  promptForAuth({
                    onConfirm: () => {
                      setPostAuthRedirectPath(`/book/${bookId}`);
                      router.push('/profile');
                    },
                    message: 'Bu kitabi acmak icin once giris yapman gerekir.',
                  });
                  return;
                }

                promptForPremium({
                  title: `${bookTitle} premium kutuphanede`,
                  message:
                    'Bu kitabin tam metni premium uyelikle aciliyor. Premium ile tam kutuphane, reklamsiz deneyim ve daha derin AI akislarini kullanabileceksin.',
                  onConfirm: () => router.push('/premium'),
                });
              }}
              style={s.lockPrimaryBtn}
            >
              <Text style={s.lockPrimaryText}>
                {access?.needsAuth ? 'Hesabimla Devam Et' : 'Premiumu Incele'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleBackPress} style={s.lockSecondaryBtn}>
              <Text style={s.lockSecondaryText}>Kutuphane'ye Don</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : hasSectionContent ? (
        <ScrollView
          contentContainerStyle={[
            s.sectionScrollContent,
            { paddingBottom: Math.max(insets.bottom + 96, 120) },
          ]}
          onScroll={({ nativeEvent }) => {
            handleReaderScroll(
              nativeEvent.contentOffset.y,
              nativeEvent.contentSize.height,
              nativeEvent.layoutMeasurement.height,
            );
            syncActiveSectionFromScroll(
              nativeEvent.contentOffset.y,
              nativeEvent.layoutMeasurement.height,
            );
          }}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
        >
          {textSections.map((item, sectionIndex) => (
            <View
              key={item.id}
              style={s.sectionScreen}
              onLayout={({ nativeEvent }) => {
                registerSectionOffset(sectionIndex, nativeEvent.layout.y);
              }}
            >
              <View style={s.sectionScreenHeader}>
                <Text style={s.sectionKicker}>
                  Bolum {item.sectionOrder} / {textSections.length}
                </Text>
                {item.title ? <Text style={s.sectionTitle}>{item.title}</Text> : null}
                {item.summary ? <Text style={s.sectionSummary}>{item.summary}</Text> : null}
              </View>

              <Text style={s.sectionBodyText}>
                {(item.parts ?? []).map((part, index) => {
                  const partKey = `${item.id}-${part.type}-${part.word ?? part.text}-${index}`;

                  if (part.type === 'keyword') {
                    if (!part.word) {
                      return <Text key={partKey}>{part.text}</Text>;
                    }

                    return (
                      <Text
                        key={partKey}
                        style={s.hlKey}
                        onPress={() => openPopup(part.word ?? '', sectionIndex)}
                      >
                        {part.text}
                      </Text>
                    );
                  }

                  if (part.type === 'reference') {
                    if (!part.word) {
                      return <Text key={partKey}>{part.text}</Text>;
                    }

                    return (
                      <Text
                        key={partKey}
                        style={s.hlRef}
                        onPress={() => openPopup(part.word ?? '', sectionIndex)}
                      >
                        {part.text}
                      </Text>
                    );
                  }

                  return <Text key={partKey}>{part.text}</Text>;
                })}
              </Text>
            </View>
          ))}
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={s.content}
          onScroll={({ nativeEvent }) => {
            handleReaderScroll(
              nativeEvent.contentOffset.y,
              nativeEvent.contentSize.height,
              nativeEvent.layoutMeasurement.height,
            );
          }}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
        >
          {readerSlice.paragraphs.map((para) => (
            <Text key={para.id} style={s.para}>
              {para.parts.map((part, i) => {
                const partKey = `${para.id}-${part.type}-${part.word ?? part.text}-${i}`;

                if (part.type === 'keyword') {
                  if (!part.word) {
                    return <Text key={partKey}>{part.text}</Text>;
                  }

                  return (
                    <Text key={partKey} style={s.hlKey} onPress={() => openPopup(part.word ?? '')}>
                      {part.text}
                    </Text>
                  );
                }

                if (part.type === 'reference') {
                  if (!part.word) {
                    return <Text key={partKey}>{part.text}</Text>;
                  }

                  return (
                    <Text key={partKey} style={s.hlRef} onPress={() => openPopup(part.word ?? '')}>
                      {part.text}
                    </Text>
                  );
                }

                return <Text key={partKey}>{part.text}</Text>;
              })}
            </Text>
          ))}
        </ScrollView>
      )}

      <View style={[s.progressWrap, isReaderLocked ? s.progressWrapHidden : null]}>
        <View style={s.progressMeta}>
          <Text style={s.progressTxt}>%{completionPercent} tamamlandi</Text>
          <Text style={s.progressTxt}>{pagesLeft} sayfa kaldi</Text>
        </View>
        <View style={s.progressBg}>
          <View style={[s.progressFill, { width: `${completionPercent}%` }]} />
        </View>
      </View>

      {popup && (
        <View style={s.overlay} pointerEvents="box-none">
          <Pressable style={s.overlayBackdrop} onPress={closePopup} />
          <Animated.View style={[s.sheet, { transform: [{ translateY: slideAnim }] }]}>
            <View>
              <View style={s.handle} />
              <View style={s.sheetHeader}>
                <Text style={s.sheetWord}>{popup.word}</Text>
                <Text style={s.sheetType}>{def?.type}</Text>
              </View>
              <View style={s.sheetBody}>
                <Text style={s.defLabel}>TANIM</Text>
                <Text style={s.defText}>{def?.def}</Text>
                <View style={s.aiBox}>
                  <Text style={s.aiLabel}>Yapay Zeka Aciklamasi</Text>
                  <Text style={s.aiText}>{aiText}</Text>
                </View>
                <TouchableOpacity style={s.askBtn} onPress={openChat}>
                  <Text style={s.askBtnText}>Yapay Zekaya Sor</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>
        </View>
      )}

      {isChatOpen && (
        <View style={s.overlay} pointerEvents="box-none">
          <Pressable style={s.overlayBackdrop} onPress={closeChat} />
          <Animated.View style={[s.sheet, s.chatSheet, { transform: [{ translateY: 0 }] }]}>
            <View>
              <View style={s.handle} />
              <View style={s.sheetHeader}>
                <Text style={s.sheetWord}>Kitap Sohbeti</Text>
                <Text style={s.sheetType}>{bookTitle}</Text>
              </View>
              <View style={s.chatBody}>
                <ScrollView
                  ref={chatScrollRef}
                  style={s.chatMessages}
                  contentContainerStyle={s.chatMessagesContent}
                  keyboardShouldPersistTaps="handled"
                  nestedScrollEnabled
                  onContentSizeChange={() => {
                    chatScrollRef.current?.scrollToEnd({ animated: true });
                  }}
                  showsVerticalScrollIndicator={false}
                >
                  {chatMessages.map((message, index) => (
                    <View
                      key={`${message.role}-${index}`}
                      style={[
                        s.chatBubble,
                        message.role === 'user' ? s.chatBubbleUser : s.chatBubbleAssistant,
                      ]}
                    >
                      <Text style={s.chatBubbleText}>{message.content}</Text>
                    </View>
                  ))}
                  {isChatLoading && <Text style={s.chatLoading}>Yanit hazirlaniyor...</Text>}
                </ScrollView>
                <View style={s.readyQuestionsWrap}>
                  <Text style={s.readyQuestionsLabel}>Hazir sorular</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={s.readyQuestionsRow}
                  >
                    {readyQuestions.map((question) => (
                      <TouchableOpacity
                        key={question}
                        onPress={() => sendChatMessage(question)}
                        style={[
                          s.readyQuestionChip,
                          isChatLoading ? s.readyQuestionChipDisabled : null,
                        ]}
                        disabled={isChatLoading}
                      >
                        <Text style={s.readyQuestionChipText}>{question}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
                <View style={s.chatComposer}>
                  {hasPremium ? (
                    <TextInput
                      onChangeText={setChatInput}
                      placeholder="Sorunu yaz..."
                      placeholderTextColor="#6b7280"
                      style={s.chatInput}
                      value={chatInput}
                    />
                  ) : (
                    <Pressable
                      onPress={() =>
                        promptForPremium({
                          title: 'Serbest AI sorulari premium ile acilir',
                          message:
                            'Hazir sorularla metni kesfetmeye devam edebilirsin. Kendi sorularini yazmak premium deneyimin parcasidir.',
                          onConfirm: () => router.push('/premium'),
                        })
                      }
                      style={[s.chatInput, s.chatInputLocked]}
                    >
                      <Text style={s.chatInputLockedText}>Kendi sorunu yazmak icin premium ac</Text>
                    </Pressable>
                  )}
                  <TouchableOpacity
                    onPress={() => sendChatMessage()}
                    style={[s.chatSendBtn, isChatLoading ? s.chatSendBtnDisabled : null]}
                    disabled={isChatLoading}
                  >
                    <Text style={s.chatSendText}>Gonder</Text>
                  </TouchableOpacity>
                </View>
                {!hasPremium ? (
                  <Text style={s.chatComposerHint}>
                    Hazir sorular acik. Serbest soru yazma premium ile acilir.
                  </Text>
                ) : null}
              </View>
            </View>
          </Animated.View>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  navWrap: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
  },
  backBtn: {
    width: 32,
    height: 32,
    backgroundColor: '#2c2c2e',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: { fontSize: 20, color: '#fff', lineHeight: 28 },
  navTitle: { flex: 1, fontSize: 16, fontWeight: '600', color: '#fff' },
  navPage: { fontSize: 13, color: '#8e8e93' },
  content: { padding: 22, paddingBottom: 100 },
  sectionPagerWrap: {
    flex: 1,
  },
  sectionScrollContent: {
    paddingTop: 12,
  },
  sectionScreen: {
    paddingHorizontal: 24,
    paddingBottom: 36,
    paddingTop: 28,
  },
  sectionScreenHeader: {
    marginBottom: 28,
  },
  sectionKicker: {
    color: '#6b7280',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  sectionTitle: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 10 },
  sectionSummary: {
    color: '#a78bfa',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
    marginBottom: 10,
  },
  sectionBodyText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 21,
    fontWeight: '500',
    letterSpacing: 0.1,
    lineHeight: 38,
  },
  para: { fontSize: 16, color: 'rgba(255,255,255,0.85)', lineHeight: 30, marginBottom: 22 },
  hlKey: { color: '#ffd60a', backgroundColor: 'rgba(255,214,10,0.18)', borderRadius: 3 },
  hlRef: { color: '#5ac8fa', backgroundColor: 'rgba(90,200,250,0.18)', borderRadius: 3 },
  progressWrap: {
    position: 'absolute',
    bottom: 82,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.85)',
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  progressWrapHidden: {
    opacity: 0,
  },
  progressMeta: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progressTxt: { fontSize: 11, color: '#48484a' },
  progressBg: { height: 3, backgroundColor: '#2c2c2e', borderRadius: 2 },
  progressFill: { height: '100%', backgroundColor: '#8b5cf6', borderRadius: 2 },
  lockWrap: {
    flex: 1,
    paddingHorizontal: 22,
    paddingTop: 32,
  },
  lockCard: {
    backgroundColor: '#111827',
    borderColor: 'rgba(139,92,246,0.25)',
    borderRadius: 24,
    borderWidth: 1,
    padding: 22,
  },
  lockEyebrow: {
    color: '#a78bfa',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  lockTitle: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.4,
    marginBottom: 10,
  },
  lockBody: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 14,
    lineHeight: 22,
  },
  lockPrimaryBtn: {
    alignItems: 'center',
    backgroundColor: '#8b5cf6',
    borderRadius: 14,
    marginTop: 20,
    paddingVertical: 14,
  },
  lockPrimaryText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  lockSecondaryBtn: {
    alignItems: 'center',
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 12,
    paddingVertical: 14,
  },
  lockSecondaryText: { color: '#d1d5db', fontSize: 13, fontWeight: '600' },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
  },
  overlayBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    backgroundColor: '#1c1c1e',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '88%',
    paddingBottom: 100,
  },
  chatSheet: {
    minHeight: '62%',
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: '#3a3a3c',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
  },
  sheetHeader: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  sheetWord: { fontSize: 22, fontWeight: '800', color: '#fff' },
  sheetType: { fontSize: 12, color: '#a78bfa', fontWeight: '600', marginTop: 4 },
  sheetBody: { padding: 20 },
  defLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#48484a',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  defText: { fontSize: 14, color: '#8e8e93', lineHeight: 22 },
  aiBox: {
    backgroundColor: 'rgba(139,92,246,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.2)',
    borderRadius: 14,
    padding: 14,
    marginTop: 14,
  },
  aiLabel: { fontSize: 11, fontWeight: '700', color: '#a78bfa', marginBottom: 6 },
  aiText: { fontSize: 13, color: 'rgba(255,255,255,0.75)', lineHeight: 20 },
  askBtn: {
    marginTop: 14,
    backgroundColor: '#8b5cf6',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  askBtnText: { fontSize: 15, fontWeight: '600', color: '#fff' },
  chatBody: { padding: 20, gap: 16, flexShrink: 1 },
  chatMessages: { maxHeight: 320, minHeight: 220, flexGrow: 0 },
  chatMessagesContent: { paddingBottom: 8 },
  readyQuestionsWrap: { gap: 8 },
  readyQuestionsLabel: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  readyQuestionsRow: { gap: 8, paddingRight: 8 },
  readyQuestionChip: {
    backgroundColor: 'rgba(167,139,250,0.12)',
    borderColor: 'rgba(167,139,250,0.24)',
    borderRadius: 999,
    borderWidth: 1,
    maxWidth: 260,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  readyQuestionChipDisabled: {
    opacity: 0.5,
  },
  readyQuestionChipText: {
    color: '#e9d5ff',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
  },
  chatBubble: {
    borderRadius: 14,
    marginBottom: 10,
    padding: 12,
  },
  chatBubbleUser: {
    alignSelf: 'flex-end',
    backgroundColor: '#8b5cf6',
  },
  chatBubbleAssistant: {
    alignSelf: 'flex-start',
    backgroundColor: '#2c2c2e',
  },
  chatBubbleText: { color: '#fff', fontSize: 14, lineHeight: 20 },
  chatLoading: { color: '#8e8e93', fontSize: 12, marginTop: 4 },
  chatComposer: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  chatInput: {
    backgroundColor: '#111827',
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    borderWidth: 1,
    color: '#fff',
    flex: 1,
    minHeight: 48,
    paddingHorizontal: 14,
  },
  chatInputLocked: {
    alignItems: 'flex-start',
    borderColor: 'rgba(245,158,11,0.2)',
    justifyContent: 'center',
  },
  chatInputLockedText: {
    color: '#fbbf24',
    fontSize: 13,
    fontWeight: '600',
  },
  chatSendBtn: {
    backgroundColor: '#8b5cf6',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  chatSendBtnDisabled: {
    opacity: 0.5,
  },
  chatSendText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  chatComposerHint: {
    color: '#94a3b8',
    fontSize: 11,
    lineHeight: 16,
    marginTop: -6,
  },
});
