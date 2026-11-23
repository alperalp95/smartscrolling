// src/llm/providers/index.js
import { groqAdapter } from './groq.js';
import { cloudflareAdapter } from './cloudflare.js';
import { geminiAdapter } from './gemini.js';

export const adapters = {
  groq: groqAdapter,
  cloudflare: cloudflareAdapter,
  gemini: geminiAdapter,
};
