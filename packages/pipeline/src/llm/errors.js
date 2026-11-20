// src/llm/errors.js
// LLM katmanının hata tipleri. Mesajlara asla API anahtarı yazılmaz.

/** Config dosyası eksik/yanlış olduğunda. */
export class LlmConfigError extends Error {
  constructor(message, { path } = {}) {
    super(path ? `[pipeline.config] ${path}: ${message}` : `[pipeline.config] ${message}`);
    this.name = 'LlmConfigError';
    this.path = path;
  }
}

/**
 * Bir rolün tüm zinciri tükendiğinde (hepsi dolu / hatalı / bütçe sınırında).
 * İş ertesi güne kalır; ne yapılacağına çağıran karar verir.
 */
export class LlmExhaustedError extends Error {
  constructor(role, { attempts = [], events = [] } = {}) {
    const summary = attempts
      .map((a) => `${a.provider}/${a.model}: ${a.reason}`)
      .join('; ');
    super(`LLM zinciri tükendi (role=${role})${summary ? ` -> ${summary}` : ''}`);
    this.name = 'LlmExhaustedError';
    this.role = role;
    this.attempts = attempts;
    this.events = events;
  }
}

/**
 * Zincirdeki modeller ÇALIŞTI ama kullanılabilir çıktı vermedi (geçersiz JSON, kesilmiş yanıt).
 * Bu bir kapasite tükenmesi DEĞİLDİR: adım durmaz, aday/batch normal hata gibi sayılır
 * (attempts++), sonraki adaylar/batch'ler denenmeye devam eder.
 */
export class LlmOutputError extends Error {
  constructor(role, { attempts = [], events = [] } = {}) {
    const summary = attempts
      .map((a) => `${a.provider}/${a.model}: ${a.reason}`)
      .join('; ');
    super(`LLM çıktısı kullanılamadı (role=${role})${summary ? ` -> ${summary}` : ''}`);
    this.name = 'LlmOutputError';
    this.role = role;
    this.attempts = attempts;
    this.events = events;
  }
}

/**
 * Tek bir sağlayıcı çağrısının sınıflandırılmış hatası (iç kullanım).
 * kind: 'retryable' | 'unavailable' | 'quota' | 'fatal' | 'invalid_json' | 'truncated' | 'empty'
 * (invalid_json, truncated, empty "çıktı hatası"dır; diğerleri kapasite/erişim hatası.)
 */
export class ProviderCallError extends Error {
  constructor(kind, message, { status, retryAfterMs, failedGeneration } = {}) {
    super(message);
    this.name = 'ProviderCallError';
    this.kind = kind;
    this.status = status;
    this.retryAfterMs = retryAfterMs;
    this.failedGeneration = failedGeneration;
  }
}

/** Çıktı hatası türleri: zincir bunlarla biterse LlmExhaustedError değil LlmOutputError atılır. */
export const OUTPUT_ERROR_KINDS = Object.freeze(['invalid_json', 'truncated', 'empty']);
