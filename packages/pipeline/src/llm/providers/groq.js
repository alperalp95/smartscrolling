// src/llm/providers/groq.js
// Groq OpenAI-uyumlu uç nokta: POST {baseUrl}/chat/completions
// baseUrl: https://api.groq.com/openai/v1  (doküman: https://console.groq.com/docs/openai)
// JSON modu: response_format {type:'json_object'} (https://console.groq.com/docs/structured-outputs)
import { buildOpenAiChatRequest, parseOpenAiChatResponse, trimSlash } from './openai-compatible.js';

export const groqAdapter = {
  name: 'groq',

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
      maxTokensField: 'max_completion_tokens',
      params,
    });
  },

  parseChat: parseOpenAiChatResponse,
};
