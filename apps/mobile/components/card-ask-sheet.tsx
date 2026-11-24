import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { submitAiContentReport, type AiContentReportReason } from '../src/lib/aiContentReports';
import { CARD_ASK_MAX_QUESTION, CARD_ASK_PRESETS } from '../src/lib/cardAsk';
import { promptForPremium } from '../src/lib/premiumPrompt';
import { useCardAsk } from '../src/lib/useCardAsk';
import type { FactType } from '../src/types';

const REPORT_REASONS: { id: AiContentReportReason; label: string }[] = [
  { id: 'wrong_information', label: 'Yanlış bilgi' },
  { id: 'harmful_or_uncomfortable', label: 'Rahatsız edici' },
  { id: 'out_of_book_context', label: 'Karta uymuyor' },
  { id: 'other', label: 'Diğer' },
];

type CardAskSheetProps = {
  fact: FactType | null;
  hasPremium: boolean;
  onClose: () => void;
  onPremiumPress: () => void;
};

export function CardAskSheet({ fact, hasPremium, onClose, onPremiumPress }: CardAskSheetProps) {
  const [draft, setDraft] = useState('');
  const [reportingId, setReportingId] = useState<string | null>(null);
  const [reportedIds, setReportedIds] = useState<string[]>([]);

  const { messages, isLoading, remaining, askPreset, askFree, reset } = useCardAsk({
    factId: fact?.id ?? null,
    hasPremium,
    onOfferPremium: () =>
      promptForPremium({
        title: 'Günlük soru hakkın doldu',
        message: 'Premium ile kartlara günde 30 soru sorabilirsin.',
        onConfirm: onPremiumPress,
      }),
  });

  const factId = fact?.id ?? null;
  useEffect(() => {
    reset();
    setDraft('');
    setReportingId(null);
    setReportedIds([]);
  }, [factId, reset]);

  const handleSend = () => {
    const text = draft;
    if (!text.trim() || isLoading) {
      return;
    }
    setDraft('');
    void askFree(text);
  };

  const handleReport = async (
    messageId: string,
    content: string,
    reason: AiContentReportReason,
  ) => {
    setReportingId(null);
    setReportedIds((current) => [...current, messageId]);
    await submitAiContentReport({
      assistantMessage: content,
      factId: fact?.id ?? null,
      reason,
    });
  };

  return (
    <Modal
      animationType="slide"
      transparent
      visible={Boolean(fact)}
      onRequestClose={onClose}
      testID="card-ask-sheet"
    >
      <View style={s.backdrop}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={onClose} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <SafeAreaView edges={['bottom']} style={s.sheet}>
            <View style={s.handle} />
            <View style={s.headerRow}>
              <Text style={s.title} numberOfLines={2}>
                {fact?.title ?? ''}
              </Text>
              <TouchableOpacity onPress={onClose} style={s.closeButton} testID="card-ask-close">
                <Text style={s.closeText}>Kapat</Text>
              </TouchableOpacity>
            </View>

            <View style={s.presetRow}>
              {CARD_ASK_PRESETS.map((preset) => (
                <TouchableOpacity
                  key={preset.id}
                  disabled={isLoading}
                  onPress={() => void askPreset(preset.id)}
                  style={[s.chip, isLoading ? s.disabled : null]}
                  testID={`card-ask-preset-${preset.id}`}
                >
                  <Text style={s.chipText}>{preset.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <ScrollView
              style={s.messages}
              contentContainerStyle={s.messagesContent}
              keyboardShouldPersistTaps="handled"
            >
              {messages.map((message) => {
                const isUser = message.role === 'user';
                const canReport = !isUser && !message.isError;
                const isReported = reportedIds.includes(message.id);
                return (
                  <View key={message.id} style={isUser ? s.userWrap : s.assistantWrap}>
                    <View style={isUser ? s.userBubble : s.assistantBubble}>
                      <Text style={s.bubbleText}>{message.content}</Text>
                    </View>
                    {canReport ? (
                      isReported ? (
                        <Text style={s.reportedText}>Bildirildi, teşekkürler.</Text>
                      ) : reportingId === message.id ? (
                        <View style={s.reasonRow}>
                          {REPORT_REASONS.map((reason) => (
                            <TouchableOpacity
                              key={reason.id}
                              onPress={() =>
                                void handleReport(message.id, message.content, reason.id)
                              }
                              style={s.chip}
                              testID={`card-ask-report-${reason.id}`}
                            >
                              <Text style={s.chipText}>{reason.label}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      ) : (
                        <TouchableOpacity
                          onPress={() => setReportingId(message.id)}
                          testID="card-ask-report"
                        >
                          <Text style={s.reportLink}>Yanlış içeriği bildir</Text>
                        </TouchableOpacity>
                      )
                    ) : null}
                  </View>
                );
              })}
              {isLoading ? (
                <View style={s.assistantWrap}>
                  <View style={s.assistantBubble}>
                    <ActivityIndicator color="#a78bfa" />
                  </View>
                </View>
              ) : null}
            </ScrollView>

            {remaining !== null ? <Text style={s.remaining}>Bugün kalan: {remaining}</Text> : null}

            {hasPremium ? (
              <View style={s.inputRow}>
                <TextInput
                  value={draft}
                  onChangeText={setDraft}
                  maxLength={CARD_ASK_MAX_QUESTION}
                  placeholder="Kendi sorunu yaz"
                  placeholderTextColor="#8e8e93"
                  style={s.input}
                  testID="card-ask-input"
                  editable={!isLoading}
                  onSubmitEditing={handleSend}
                />
                <TouchableOpacity
                  disabled={isLoading || !draft.trim()}
                  onPress={handleSend}
                  style={[s.sendButton, isLoading || !draft.trim() ? s.disabled : null]}
                  testID="card-ask-send"
                >
                  <Text style={s.sendText}>Gönder</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                onPress={() =>
                  promptForPremium({
                    title: 'Premium ile sor',
                    message: 'Kendi sorunu yazmak ve günde 30 soru sormak için Premium’a geç.',
                    onConfirm: onPremiumPress,
                  })
                }
                style={s.lockedBox}
                testID="card-ask-locked"
              >
                <Text style={s.lockedText}>Kendi sorunu yazmak Premium&apos;a özel</Text>
              </TouchableOpacity>
            )}
          </SafeAreaView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#111214',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  handle: {
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 999,
    height: 5,
    marginBottom: 16,
    width: 44,
  },
  headerRow: { alignItems: 'flex-start', flexDirection: 'row', gap: 12 },
  title: {
    color: '#fff',
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
  },
  closeButton: { paddingHorizontal: 4, paddingVertical: 2 },
  closeText: { color: '#a78bfa', fontSize: 13, fontWeight: '700' },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  chip: {
    backgroundColor: '#1c1c1f',
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  chipText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  disabled: { opacity: 0.5 },
  messages: { marginTop: 14, minHeight: 80 },
  messagesContent: { gap: 12, paddingBottom: 8 },
  userWrap: { alignItems: 'flex-end' },
  assistantWrap: { alignItems: 'flex-start' },
  userBubble: {
    backgroundColor: 'rgba(139,92,246,0.16)',
    borderColor: 'rgba(167,139,250,0.5)',
    borderRadius: 14,
    borderWidth: 1,
    maxWidth: '85%',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  assistantBubble: {
    backgroundColor: '#1c1c1f',
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    borderWidth: 1,
    maxWidth: '90%',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleText: { color: '#fff', fontSize: 14, lineHeight: 20 },
  reportLink: {
    color: '#8e8e93',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 6,
  },
  reportedText: {
    color: '#8e8e93',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 6,
  },
  reasonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  remaining: {
    color: '#8e8e93',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 6,
  },
  inputRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
    marginBottom: 12,
  },
  input: {
    backgroundColor: '#1c1c1f',
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    borderWidth: 1,
    color: '#fff',
    flex: 1,
    fontSize: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  sendButton: {
    backgroundColor: 'rgba(139,92,246,0.16)',
    borderColor: 'rgba(167,139,250,0.5)',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  sendText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  lockedBox: {
    alignItems: 'center',
    backgroundColor: '#1c1c1f',
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
    marginTop: 12,
    paddingVertical: 14,
  },
  lockedText: { color: '#a78bfa', fontSize: 13, fontWeight: '700' },
});
