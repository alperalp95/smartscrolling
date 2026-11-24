import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { type AiContentReportReason, submitAiContentReport } from '../src/lib/aiContentReports';
import { CARD_ASK_MAX_QUESTION, CARD_ASK_PRESETS } from '../src/lib/cardAsk';
import { promptForPremium } from '../src/lib/premiumPrompt';
import { useCardAsk } from '../src/lib/useCardAsk';
import { colors, radius, space, type } from '../src/theme';
import type { FactType } from '../src/types';
import { BottomSheet } from './ui/bottom-sheet';
import { Chip } from './ui/chip';
import { IconButton } from './ui/icon-button';

const REPORT_REASONS: { id: AiContentReportReason; label: string }[] = [
  { id: 'wrong_information', label: 'Yanlış bilgi' },
  { id: 'harmful_or_uncomfortable', label: 'Rahatsız edici' },
  { id: 'out_of_book_context', label: 'Karta uymuyor' },
  { id: 'other', label: 'Diğer' },
];

// Başlık dahil panel ekranın yaklaşık %80'i olsun diye içerik alanı oranı.
const SHEET_CONTENT_RATIO = 0.65;
const gradientStart = { x: 0, y: 0 };
const gradientEnd = { x: 1, y: 0 };

type CardAskSheetProps = {
  fact: FactType | null;
  hasPremium: boolean;
  onClose: () => void;
  onPremiumPress: () => void;
};

export function CardAskSheet({ fact, hasPremium, onClose, onPremiumPress }: CardAskSheetProps) {
  const { height: windowHeight } = useWindowDimensions();
  const [draft, setDraft] = useState('');
  const [reportingId, setReportingId] = useState<string | null>(null);
  const [reportedIds, setReportedIds] = useState<string[]>([]);
  const [failedReportIds, setFailedReportIds] = useState<string[]>([]);

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
  // biome-ignore lint/correctness/useExhaustiveDependencies: kart değişince sohbet sıfırlanmalı
  useEffect(() => {
    reset();
    setDraft('');
    setReportingId(null);
    setReportedIds([]);
    setFailedReportIds([]);
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
    setFailedReportIds((current) => current.filter((id) => id !== messageId));
    if (!fact) return;
    const result = await submitAiContentReport({
      assistantMessage: content,
      factId: fact.id,
      reason,
    });
    if (result.reported) {
      setReportedIds((current) => [...current, messageId]);
    } else {
      setFailedReportIds((current) => [...current, messageId]);
    }
  };

  const canSend = !isLoading && draft.trim().length > 0;

  return (
    <BottomSheet
      visible={Boolean(fact)}
      onClose={onClose}
      title="Karta sor"
      subtitle={fact?.title ?? ''}
      testID="card-ask-sheet"
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ height: windowHeight * SHEET_CONTENT_RATIO }}
      >
        <View style={s.topRow}>
          <View style={s.presetRow}>
            {CARD_ASK_PRESETS.map((preset) => (
              <Chip
                key={preset.id}
                label={preset.label}
                onPress={isLoading ? undefined : () => void askPreset(preset.id)}
                testID={`card-ask-preset-${preset.id}`}
              />
            ))}
          </View>
          <IconButton
            name="close"
            onPress={onClose}
            accessibilityLabel="Kapat"
            testID="card-ask-close"
          />
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
                {isUser ? (
                  <LinearGradient
                    colors={colors.brandGradient}
                    start={gradientStart}
                    end={gradientEnd}
                    style={s.bubble}
                  >
                    <Text style={s.bubbleText}>{message.content}</Text>
                  </LinearGradient>
                ) : (
                  <View style={[s.bubble, s.assistantBubble]}>
                    <Text style={s.bubbleText}>{message.content}</Text>
                  </View>
                )}
                {canReport ? (
                  isReported ? (
                    <Text style={s.meta}>Bildirildi, teşekkürler.</Text>
                  ) : reportingId === message.id ? (
                    <View style={s.reasonRow}>
                      {REPORT_REASONS.map((reason) => (
                        <Chip
                          key={reason.id}
                          label={reason.label}
                          onPress={() => void handleReport(message.id, message.content, reason.id)}
                          testID={`card-ask-report-${reason.id}`}
                        />
                      ))}
                    </View>
                  ) : (
                    <>
                      {failedReportIds.includes(message.id) ? (
                        <Text style={s.meta}>Bildirilemedi, tekrar dene</Text>
                      ) : null}
                      <TouchableOpacity
                        onPress={() => setReportingId(message.id)}
                        testID="card-ask-report"
                      >
                        <Text style={s.meta}>Yanlış mı? Bildir</Text>
                      </TouchableOpacity>
                    </>
                  )
                ) : null}
              </View>
            );
          })}
          {isLoading ? (
            <View style={s.assistantWrap}>
              <View style={[s.bubble, s.assistantBubble]}>
                <ActivityIndicator color={colors.textSecondary} />
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
              placeholder="Kendi sorunu yaz…"
              placeholderTextColor={colors.textTertiary}
              style={s.input}
              testID="card-ask-input"
              editable={!isLoading}
              onSubmitEditing={handleSend}
            />
            <IconButton
              name="arrow-up-circle"
              size={32}
              color={canSend ? colors.text : colors.textTertiary}
              onPress={handleSend}
              accessibilityLabel="Gönder"
              testID="card-ask-send"
            />
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
            style={s.inputRow}
            testID="card-ask-locked"
          >
            <View style={s.input}>
              <Text style={s.lockedText}>Kendi sorunu yaz… (Premium)</Text>
            </View>
          </TouchableOpacity>
        )}
      </KeyboardAvoidingView>
    </BottomSheet>
  );
}

const s = StyleSheet.create({
  topRow: { alignItems: 'flex-start', flexDirection: 'row', gap: space.md },
  presetRow: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  messages: { flex: 1, marginTop: space.md },
  messagesContent: { gap: space.md, paddingBottom: space.sm },
  userWrap: { alignItems: 'flex-end' },
  assistantWrap: { alignItems: 'flex-start' },
  bubble: {
    borderRadius: radius.lg,
    maxWidth: '82%',
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  assistantBubble: { backgroundColor: colors.fill },
  bubbleText: { ...type.body, color: colors.text },
  meta: { ...type.caption, color: colors.textSecondary, marginTop: space.xs },
  reasonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.sm },
  remaining: { ...type.caption, color: colors.textTertiary, marginTop: space.xs },
  inputRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: space.sm,
    marginTop: space.md,
  },
  input: {
    ...type.body,
    backgroundColor: colors.fill,
    borderRadius: radius.full,
    color: colors.text,
    flex: 1,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  lockedText: { ...type.body, color: colors.textTertiary },
});
