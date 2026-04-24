import { extractMeaningfulParagraphs } from './shared-html.js';

const MEDLINEPLUS_TOPICS = [
  {
    title: 'Heart Diseases',
    url: 'https://medlineplus.gov/heartdiseases.html',
    category: 'health',
  },
  {
    title: 'Sleep Disorders',
    url: 'https://medlineplus.gov/sleepdisorders.html',
    category: 'health',
  },
  {
    title: 'Vaccines',
    url: 'https://medlineplus.gov/vaccines.html',
    category: 'health',
  },
  {
    title: 'Immune System',
    url: 'https://medlineplus.gov/immunesystemanddisorders.html',
    category: 'health',
  },
  {
    title: 'Blood Pressure',
    url: 'https://medlineplus.gov/highbloodpressure.html',
    category: 'health',
  },
  {
    title: 'Cholesterol',
    url: 'https://medlineplus.gov/cholesterol.html',
    category: 'health',
  },
  {
    title: 'Stress',
    url: 'https://medlineplus.gov/stress.html',
    category: 'health',
  },
  {
    title: 'Diabetes',
    url: 'https://medlineplus.gov/diabetes.html',
    category: 'health',
  },
  {
    title: 'Anxiety',
    url: 'https://medlineplus.gov/anxiety.html',
    category: 'health',
  },
  {
    title: 'Depression',
    url: 'https://medlineplus.gov/depression.html',
    category: 'health',
  },
  {
    title: 'Asthma',
    url: 'https://medlineplus.gov/asthma.html',
    category: 'health',
  },
  {
    title: 'Healthy Aging',
    url: 'https://medlineplus.gov/healthyaging.html',
    category: 'health',
  },
  {
    title: 'Metabolism',
    url: 'https://medlineplus.gov/metabolism.html',
    category: 'health',
  },
  {
    title: 'Pain',
    url: 'https://medlineplus.gov/pain.html',
    category: 'health',
  },
  {
    title: 'Arthritis',
    url: 'https://medlineplus.gov/arthritis.html',
    category: 'health',
  },
];

export async function fetchMedlinePlusArticles(count = 4) {
  const topics = shuffleArray(MEDLINEPLUS_TOPICS).slice(0, count);
  const articles = [];

  for (const topic of topics) {
    try {
      const res = await fetch(topic.url, {
        headers: { 'User-Agent': 'SmartScrolling-Pipeline/1.0 (contact@smartscrolling.app)' },
      });

      if (!res.ok) {
        console.error('[MedlinePlus] API yanit hatasi:', res.status, topic.title);
        continue;
      }

      const html = await res.text();
      const paragraphs = extractMeaningfulParagraphs(html, {
        minLength: 180,
        maxParagraphs: 3,
      });

      if (paragraphs.length === 0) {
        continue;
      }

      articles.push({
        title: topic.title,
        extract: paragraphs.join(' '),
        url: topic.url,
        sourceLabel: 'MedlinePlus',
        category: topic.category,
        imageUrl: null,
      });
    } catch (err) {
      console.error('[MedlinePlus] Fetch hatasi:', err.message);
    }
  }

  return articles;
}

function shuffleArray(items) {
  const copy = [...items];

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }

  return copy;
}
