import Groq from 'groq-sdk';
import { estimateSectionPages, summarizeSectionText } from './book-sections.js';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const DEFAULT_TRANSLATION_MODEL = process.env.GROQ_TRANSLATION_MODEL ?? 'llama-3.3-70b-versatile';

function countWords(text) {
  return text.split(/\s+/).filter(Boolean).length;
}

function normalizeTranslatedText(text) {
  return String(text ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function normalizeTranslatedTitle(title, fallbackTitle) {
  if (typeof title !== 'string') {
    return fallbackTitle ?? null;
  }

  const normalized = title.replace(/\s+/g, ' ').trim();
  return normalized || fallbackTitle || null;
}

function parseRetryDelayMs(error) {
  const message = error instanceof Error ? error.message : String(error);
  const retryMatch = message.match(/try again in ([\d.]+)s/i);

  if (!retryMatch) {
    return 12_000;
  }

  const seconds = Number.parseFloat(retryMatch[1]);
  if (Number.isNaN(seconds)) {
    return 12_000;
  }

  return Math.ceil(seconds * 1000) + 1000;
}

function isRateLimitError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('rate_limit_exceeded') || message.includes('Rate limit reached');
}

async function sleep(ms) {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function buildTranslationPrompts(section, { bookTitle, author, sectionIndex, totalSections }) {
  const systemPrompt = `Sen SmartScroll icin klasik ve kurmaca-disi metinleri Turkceye uyarlayan dikkatli bir editor-cevirmenisin.
Gorevin: Verilen kitap bolumunu Turkce bir "reader edition" olarak cevir.

KURALLAR:
- Sadece gecerli bir JSON objesi dondur.
- title ve plainText alanlari olsun.
- Ceviri ozet degil, tam bolum metni olsun.
- Anlami koru; bilgi silme, ekleme, yorum katma.
- Paragraf yapisini olabildigince koru. plainText icinde paragraflari iki satir sonu ile ayir.
- Dili akici ve bugunun Turkcesinde okunur tut; ama dusunceyi basitlestirip icini bosaltma.
- Ozel isimleri koru.
- Kavram cevirilerinde bolum boyunca tutarli ol.
- Dipnot, editor notu, aciklama veya JSON disi metin yazma.
- Kaynak metinde baslik yoksa title alanini null yapabilirsin.`;

  const userPrompt = `Kitap: ${bookTitle}
Yazar: ${author ?? 'bilinmiyor'}
Bolum: ${sectionIndex}/${totalSections}
Kaynak bolum basligi: ${section.title ?? 'yok'}

Asagidaki Ingilizce bolumu Turkce reader edition olarak cevir:
---
${section.plainText}
---`;

  return { systemPrompt, userPrompt };
}

async function requestSectionTranslation(section, context) {
  const { systemPrompt, userPrompt } = buildTranslationPrompts(section, context);

  for (let attempt = 1; attempt <= 6; attempt += 1) {
    try {
      const response = await groq.chat.completions.create({
        model: DEFAULT_TRANSLATION_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.2,
        max_tokens: 3500,
        response_format: { type: 'json_object' },
      });

      const raw = response.choices[0]?.message?.content;
      if (!raw) {
        throw new Error(`empty translation payload for section ${section.sectionOrder}`);
      }

      const parsed = JSON.parse(raw);
      const plainText = normalizeTranslatedText(parsed.plainText);

      if (!plainText) {
        throw new Error(`missing translated plainText for section ${section.sectionOrder}`);
      }

      const wordCount = countWords(plainText);
      return {
        sectionOrder: section.sectionOrder,
        title: normalizeTranslatedTitle(parsed.title, section.title),
        plainText,
        summary: summarizeSectionText(plainText),
        wordCount,
        estimatedPages: estimateSectionPages(wordCount),
      };
    } catch (error) {
      if (!isRateLimitError(error) || attempt === 6) {
        throw error;
      }

      const delayMs = parseRetryDelayMs(error);
      console.log(
        `   rate limit on section ${section.sectionOrder}; retrying in ${Math.ceil(delayMs / 1000)}s...`,
      );
      await sleep(delayMs);
    }
  }

  throw new Error(`translation failed for section ${section.sectionOrder}`);
}

export async function translateBookSectionsToTurkish(sections, { bookTitle, author } = {}) {
  if (!process.env.GROQ_API_KEY || process.env.GROQ_API_KEY.startsWith('your_')) {
    throw new Error('GROQ_API_KEY is required for --translate-tr');
  }

  const translatedSections = [];

  for (const section of sections) {
    console.log(`   translating section ${section.sectionOrder}/${sections.length}...`);
    const translated = await requestSectionTranslation(section, {
      bookTitle,
      author,
      sectionIndex: section.sectionOrder,
      totalSections: sections.length,
    });
    translatedSections.push(translated);
  }

  return translatedSections;
}
