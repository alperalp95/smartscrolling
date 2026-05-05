export const DEFAULT_FACT_LLM_MODEL = 'groq:llama-3.1-8b-instant';

const ALLOWED_FACT_LLM_MODELS = new Map([
  [
    'groq:llama-3.1-8b-instant',
    {
      provider: 'groq',
      model: 'llama-3.1-8b-instant',
      providerModel: 'groq:llama-3.1-8b-instant',
    },
  ],
  [
    'groq:openai/gpt-oss-20b',
    {
      provider: 'groq',
      model: 'openai/gpt-oss-20b',
      providerModel: 'groq:openai/gpt-oss-20b',
    },
  ],
  [
    'groq:qwen/qwen3-32b',
    {
      provider: 'groq',
      model: 'qwen/qwen3-32b',
      providerModel: 'groq:qwen/qwen3-32b',
    },
  ],
]);

export function getAllowedFactLlmModels() {
  return [...ALLOWED_FACT_LLM_MODELS.keys()];
}

export function resolveFactLlmModel(value = process.env.FACT_LLM_PRIMARY) {
  const providerModel =
    typeof value === 'string' && value.trim() ? value.trim() : DEFAULT_FACT_LLM_MODEL;
  const resolved = ALLOWED_FACT_LLM_MODELS.get(providerModel);

  if (!resolved) {
    throw new Error(
      `Unsupported fact LLM model "${providerModel}". Allowed: ${getAllowedFactLlmModels().join(', ')}`,
    );
  }

  return { ...resolved };
}
