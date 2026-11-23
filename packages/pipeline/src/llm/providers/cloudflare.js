// src/llm/providers/cloudflare.js
// Cloudflare Workers AI.
// - Sohbet: OpenAI-uyumlu POST https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/v1/chat/completions
//   Doküman: https://developers.cloudflare.com/workers-ai/configuration/open-ai-compatibility/
// - Embedding: REST POST https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/run/@cf/baai/bge-m3
//   gövde { text: [...] }  Doküman: https://developers.cloudflare.com/workers-ai/models/bge-m3/
// JSON modu sadece belirli modellerde (https://developers.cloudflare.com/workers-ai/features/json-mode/);
// kullandığımız modeller listede yok -> config'te jsonMode=false, yanıttan JSON ayıklanır.
import { ProviderCallError } from '../errors.js';
import { buildOpenAiChatRequest, parseOpenAiChatResponse, trimSlash } from './openai-compatible.js';

export const cloudflareAdapter = {
  name: 'cloudflare',

  credentials(providerCfg, env) {
    const apiKey = env[providerCfg.apiKeyEnv];
    const accountId = env[providerCfg.accountIdEnv];
    const missing = [];
    if (!apiKey) missing.push(providerCfg.apiKeyEnv);
    if (!accountId) missing.push(providerCfg.accountIdEnv);
    if (missing.length) return { ok: false, missing };
    const baseUrl = trimSlash(providerCfg.baseUrl).replace(
      '{accountId}',
      encodeURIComponent(accountId),
    );
    return { ok: true, apiKey, baseUrl };
  },

  chatRequest({ creds, providerCfg, model, messages, json, maxTokens, params }) {
    return buildOpenAiChatRequest({
      url: `${creds.baseUrl}/v1/chat/completions`,
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

  embedRequest({ creds, model, texts }) {
    return {
      url: `${creds.baseUrl}/run/${model}`,
      init: {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${creds.apiKey}` },
        body: JSON.stringify({ text: texts }),
      },
    };
  },

  parseEmbed(body) {
    // /ai/run yanıtı: { success, result: { shape:[n,dim], data:[[...]] } }
    // OpenAI-uyumlu /v1/embeddings yanıtı da kabul edilir: { data: [{ embedding }] }
    const result = body?.result ?? body;
    let vectors;
    if (Array.isArray(result?.data) && Array.isArray(result.data[0])) {
      vectors = result.data;
    } else if (Array.isArray(result?.data) && Array.isArray(result.data[0]?.embedding)) {
      vectors = result.data.map((d) => d.embedding);
    }
    if (!vectors) throw new ProviderCallError('fatal', 'embedding yanıtında vektör yok');
    const usage = body?.usage ?? result?.usage ?? {};
    return {
      vectors,
      usage: { inputTokens: Number(usage.prompt_tokens ?? usage.total_tokens ?? 0) || 0 },
    };
  },
};
