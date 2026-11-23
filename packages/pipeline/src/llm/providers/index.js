import { cloudflareAdapter } from './cloudflare.js';
import { geminiAdapter } from './gemini.js';
// src/llm/providers/index.js
import { groqAdapter } from './groq.js';

export const adapters = {
  groq: groqAdapter,
  cloudflare: cloudflareAdapter,
  gemini: geminiAdapter,
};
