import { extractMeaningfulParagraphs } from './shared-html.js';

const STANFORD_TOPICS = [
  {
    title: 'Stoicism',
    url: 'https://plato.stanford.edu/entries/stoicism/',
    category: 'philosophy',
  },
  {
    title: 'Epistemology',
    url: 'https://plato.stanford.edu/entries/epistemology/',
    category: 'philosophy',
  },
  {
    title: 'Virtue Ethics',
    url: 'https://plato.stanford.edu/entries/ethics-virtue/',
    category: 'philosophy',
  },
  {
    title: 'Aristotle',
    url: 'https://plato.stanford.edu/entries/aristotle/',
    category: 'philosophy',
  },
  {
    title: 'Existentialism',
    url: 'https://plato.stanford.edu/entries/existentialism/',
    category: 'philosophy',
  },
  {
    title: 'Kant Moral Philosophy',
    url: 'https://plato.stanford.edu/entries/kant-moral/',
    category: 'philosophy',
  },
  {
    title: 'Metaphysics',
    url: 'https://plato.stanford.edu/entries/metaphysics/',
    category: 'philosophy',
  },
  {
    title: 'Logic and Ontology',
    url: 'https://plato.stanford.edu/entries/logic-ontology/',
    category: 'philosophy',
  },
  {
    title: 'Free Will',
    url: 'https://plato.stanford.edu/entries/freewill/',
    category: 'philosophy',
  },
  {
    title: 'Modularity of Mind',
    url: 'https://plato.stanford.edu/entries/modularity-mind/',
    category: 'philosophy',
  },
  {
    title: 'Political Philosophy',
    url: 'https://plato.stanford.edu/entries/political-philosophy/',
    category: 'philosophy',
  },
  {
    title: 'John Rawls',
    url: 'https://plato.stanford.edu/entries/rawls/',
    category: 'philosophy',
  },
  {
    title: 'Personal Identity',
    url: 'https://plato.stanford.edu/entries/identity-personal/',
    category: 'philosophy',
  },
  {
    title: 'Philosophy of Religion',
    url: 'https://plato.stanford.edu/entries/philosophy-religion/',
    category: 'philosophy',
  },
  {
    title: 'Moral Responsibility',
    url: 'https://plato.stanford.edu/entries/moral-responsibility/',
    category: 'philosophy',
  },
  {
    title: 'Consciousness',
    url: 'https://plato.stanford.edu/entries/consciousness/',
    category: 'philosophy',
  },
  {
    title: 'Pragmatism',
    url: 'https://plato.stanford.edu/entries/pragmatism/',
    category: 'philosophy',
  },
  {
    title: 'Social Contract Theory',
    url: 'https://plato.stanford.edu/entries/contractarianism/',
    category: 'philosophy',
  },
];

export async function fetchStanfordPhilosophy(count = 4) {
  const topics = shuffleArray(STANFORD_TOPICS).slice(0, count);
  const articles = [];

  for (const topic of topics) {
    try {
      const res = await fetch(topic.url, {
        headers: { 'User-Agent': 'SmartScrolling-Pipeline/1.0 (contact@smartscrolling.app)' },
      });

      if (!res.ok) {
        console.error('[Stanford] API yanit hatasi:', res.status, topic.title);
        continue;
      }

      const html = await res.text();
      const paragraphs = extractMeaningfulParagraphs(html, {
        minLength: 220,
        maxParagraphs: 2,
      });

      if (paragraphs.length === 0) {
        continue;
      }

      articles.push({
        title: topic.title,
        extract: paragraphs.join(' '),
        url: topic.url,
        sourceLabel: 'Stanford Encyclopedia of Philosophy',
        category: topic.category,
        imageUrl: null,
      });
    } catch (err) {
      console.error('[Stanford] Fetch hatasi:', err.message);
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
