// src/llm/providers/gemini.js
// Gemini API OpenAI uyumluluk katmanı: POST {baseUrl}/chat/completions
// baseUrl: https://generativelanguage.googleapis.com/v1beta/openai
// Doküman: https://ai.google.dev/gemini-api/docs/openai (-> https://aistudio.google.com/docs/openai)
// Not: json_object desteği dokümanda açıkça yazmıyor; config'te jsonMode=false, yanıttan JSON ayıklanır.
import { buildOpenAiChatRequest, parseOpenAiChatResponse, trimSlash } from './openai-compatible.js';

export const geminiAdapter = {
  name: 'gemini',

  credentials(providerCfg, env) {
    const apiKey = env[providerCfg.apiKeyEnv]?.trim();
    if (!apiKey) return { ok: false, missing: [providerCfg.apiKeyEnv] };
    return { ok: true, apiKey, baseUrl: trimSlash(providerCfg.baseUrl) };
  },

  chatRequest({ creds, providerCfg, model, messages, json, maxTokens, params }) {
    return buildOpenAiChatRequest({
      url: `${creds.baseUrl}/chat/completions`,
      apiKey: creds.apiKey,
      model,
      messages,
      json,
      jsonMode: providerCfg.jsonMode,
      maxTokens,
      maxTokensField: 'max_tokens',
      params,
    });
  },

  parseChat: parseOpenAiChatResponse,
};
