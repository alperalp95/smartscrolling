import { WIKI_THEME_SEQUENCE } from './wiki-taxonomy-types.js';

const LOW_VALUE_TITLE_PATTERNS = [
  /\binstitutions?\b/i,
  /\bdisambiguation\b/i,
  /\banlam ayrimi\b/i,
  /\bunion\b/i,
  /\borganization\b/i,
  /\bassociation\b/i,
  /\bfederasyon(u)?\b/i,
  /\bcommittee\b/i,
  /\bcouncil\b/i,
  /\bfederation\b/i,
  /\barma(sı|si)?\b/i,
  /\bcoat of arms\b/i,
  /\bhigh school\b/i,
  /\bcounty\b/i,
  /\bdistrict\b/i,
  /\bcommune\b/i,
  /\bkomun\b/i,
  /\bkomün\b/i,
  /\bmahalle\b/i,
  /\bkasaba\b/i,
  /\bbelde\b/i,
  /\bneighborhood\b/i,
  /\broad\b/i,
  /\bstation\b/i,
  /\bvillage\b/i,
  /\btown\b/i,
  /\bmunicipality\b/i,
  /\belectoral district\b/i,
  /\balbum\b/i,
  /\bsong\b/i,
  /\bmusic\b/i,
  /\bmüzik\b/i,
  /\bmuzik\b/i,
  /\bmüzisyen\b/i,
  /\bmuzisyen\b/i,
  /\bbesteci\b/i,
  /\bcaz\b/i,
  /\binstrument\b/i,
  /\bmüzik aleti\b/i,
  /\bmuzik aleti\b/i,
  /\bbook\b/i,
  /\bkitap\b/i,
  /\bnovel\b/i,
  /\broman\b/i,
  /\bepistle\b/i,
  /\bmektup\b/i,
  /\bcuisine\b/i,
  /\bdish\b/i,
  /\bfood\b/i,
  /\byemek\b/i,
  /\bturizm\b/i,
  /\btourism\b/i,
  /\bekonomi\b/i,
  /\beconomy\b/i,
  /\bkulturel miras\b/i,
  /\bcultural heritage\b/i,
  /\banlaşmazlık\b/i,
  /\banlasmazlik\b/i,
  /\bdispute\b/i,
  /\bdoğalgaz\b/i,
  /\bdogalgaz\b/i,
  /\bnatural gas\b/i,
  /\bfootball\b/i,
  /\btennis\b/i,
  /\bcoach\b/i,
  /\bplayer\b/i,
  /\bactor\b/i,
  /\bactress\b/i,
  /\bbiography\b/i,
  /\btasting room\b/i,
  /\bkoy\b/i,
  /\bilce\b/i,
  /\bilcesi\b/i,
  /\bilçesi\b/i,
  /\bbelediye\b/i,
  /\bbelediyesi\b/i,
  /\bbolgesi\b/i,
  /\byolu\b/i,
  /\bistasyonu\b/i,
  /\blise(si)?\b/i,
  /\btenisci\b/i,
  /\bfutbolcu\b/i,
  /\boyuncu\b/i,
  /\bsarkici\b/i,
  /\bpolitikaci\b/i,
  /\bsenator\b/i,
  /\bmilletvekili\b/i,
];

const LOW_VALUE_EXTRACT_PATTERNS = [
  /\bnational service organization\b/i,
  /\bmember organization\b/i,
  /\bshopping mall\b/i,
  /\bis a village\b/i,
  /\bis a town\b/i,
  /\bisland in\b/i,
  /\bmunicipality in\b/i,
  /\bcommune in\b/i,
  /\bneighborhood in\b/i,
  /\brailway station\b/i,
  /\bstate road\b/i,
  /\bis a singer\b/i,
  /\bis a musician\b/i,
  /\bis a composer\b/i,
  /\bis an actor\b/i,
  /\bis a dish\b/i,
  /\bis a food\b/i,
  /\bis a cuisine\b/i,
  /\btourism is\b/i,
  /\bturizm\b/i,
  /\bekonomi\b/i,
  /\bkulturel miras\b/i,
  /\bcultural heritage\b/i,
  /\banlaşmazlık\b/i,
  /\banlasmazlik\b/i,
  /\bdispute\b/i,
  /\bdoğalgaz\b/i,
  /\bdogalgaz\b/i,
  /\bnatural gas\b/i,
  /\bphone model\b/i,
  /\bsmartphone model\b/i,
  /\bcep telefonu\b/i,
  /\bakilli telefon\b/i,
  /\bakıllı telefon\b/i,
  /\bandroid cihaz\b/i,
  /\btaslak/i,
  /\baircraft model\b/i,
  /\bfighter aircraft\b/i,
  /\bavci ucagi\b/i,
  /\bavci ucağı\b/i,
  /\bsavas ucagi\b/i,
  /\bsavaş uçağı\b/i,
  /\bis a footballer\b/i,
  /\bis a tennis player\b/i,
  /\bis a librarian\b/i,
  /\bis an educator\b/i,
  /\bis a politician\b/i,
  /\bbir koydur\b/i,
  /\bbir köydür\b/i,
  /\bbir ilcedir\b/i,
  /\bbir ilçedir\b/i,
  /\bilcesidir\b/i,
  /\bilçesidir\b/i,
  /\bbir mahalledir\b/i,
  /\bbir kasabadır\b/i,
  /\bbir kasabadir\b/i,
  /\bbir beldedir\b/i,
  /\bbir komundur\b/i,
  /\bbir komündür\b/i,
  /\bbir belediyedir\b/i,
  /\bbir bolgesidir\b/i,
  /\bbir bölgesidir\b/i,
  /\bbir istasyondur\b/i,
  /\bbir yoldur\b/i,
  /\bbir sarkicidir\b/i,
  /\bbir şarkıcıdır\b/i,
  /\bbir oyuncudur\b/i,
  /\bbir yemektir\b/i,
  /\bbir teniscidir\b/i,
  /\bbir tenisçidir\b/i,
  /\bbir futbolcudur\b/i,
  /\bbir politikacidir\b/i,
];

const HIGH_VALUE_OVERRIDE_PATTERNS = [
  /\bunesco\b/i,
  /\bworld heritage\b/i,
  /\barkeolog/i,
  /\barchaeolog/i,
  /\boldest\b/i,
  /\bfirst\b/i,
  /\bearliest\b/i,
  /\bextinct\b/i,
  /\bfossil\b/i,
  /\bdiscovery\b/i,
  /\binvention\b/i,
  /\btheory\b/i,
  /\bphilosoph/i,
  /\bempire\b/i,
  /\bdynasty\b/i,
  /\brevolution\b/i,
  /\bancient\b/i,
  /\bmedieval\b/i,
  /\bvolcan/i,
  /\basteroid\b/i,
  /\borbit\b/i,
  /\bkosmos\b/i,
  /\bkozmik\b/i,
  /\ben eski\b/i,
  /\bilk\b/i,
  /\bkesif\b/i,
  /\bkeşif\b/i,
  /\bbulus\b/i,
  /\bbuluş\b/i,
  /\bteori\b/i,
  /\bfelsef/i,
  /\bimparatorluk\b/i,
  /\bhanedan\b/i,
  /\bdevrim\b/i,
  /\bantik\b/i,
  /\bortacag\b/i,
  /\bortaçağ\b/i,
  /\barkeolojik\b/i,
];

const HIGH_CURIOSITY_PATTERNS = [
  ...HIGH_VALUE_OVERRIDE_PATTERNS,
  /\bblack hole\b/i,
  /\bbig bang\b/i,
  /\bquantum\b/i,
  /\bdna\b/i,
  /\bsupernova\b/i,
  /\bkara delik\b/i,
  /\bbuyuk patlama\b/i,
  /\bbüyük patlama\b/i,
  /\bkuantum\b/i,
  /\bmatematik\b/i,
  /\bfizik\b/i,
  /\bbilim\b/i,
  /\buzay\b/i,
  /\bevrim\b/i,
];

const CATEGORY_SEED_TOPICS = {
  science: ['Black hole', 'Big Bang', 'Quantum mechanics', 'Theory of relativity', 'Natural selection', 'DNA', 'Fossil', 'Mass extinction', 'Plate tectonics', 'Volcano', 'Asteroid', 'Periodic table', 'Neuron', 'Supernova'],
  history: ['Roman Empire', 'Mongol Empire', 'Industrial Revolution', 'French Revolution', 'Cold War', 'Bronze Age', 'Silk Road', 'Printing press', 'Magna Carta', 'Renaissance', 'Byzantine Empire', 'Ottoman Empire', 'Age of Discovery', 'Pompeii'],
  philosophy: ['Stoicism', 'Existentialism', 'Free will', 'Virtue ethics', 'Epistemology', 'Philosophy of mind', 'Justice', 'Metaphysics', 'Utilitarianism', 'Socratic method', 'John Rawls', 'Plato', 'Aristotle'],
  technology: ['Internet', 'Algorithm', 'Semiconductor', 'Robotics', 'Microprocessor', 'Encryption', 'Database', 'Compiler', 'Search engine', 'Turing machine', 'Artificial intelligence'],
  health: ['Immune system', 'Vaccination', 'Sleep', 'Microbiome', 'Cholesterol', 'Stress', 'Metabolism', 'Inflammation', 'Cardiovascular disease'],
};

function isLikelyLowValueBiography(title, extract) {
  const words = String(title ?? '').trim().split(/\s+/).filter(Boolean);
  const likelyPersonName =
    words.length >= 2 &&
    words.length <= 4 &&
    words.every((word) => /^\p{Lu}[\p{L}'-]+$/u.test(word));

  if (!likelyPersonName) {
    return false;
  }

  const normalizedExtract = String(extract ?? '').toLocaleLowerCase('tr-TR');
  const highValueSignals = ['known for', 'discovered', 'developed', 'invented', 'theory', 'scientist', 'philosopher', 'mathematician', 'fizikçi', 'bilim insanı', 'filozof'];
  const lowValueSignals = ['is a politician', 'is a singer', 'is a musician', 'is a composer', 'is an actor', 'is an actress', 'footballer', 'tennis player', 'was born', 'siyasetçi', 'şarkıcı', 'müzisyen', 'muzisyen', 'besteci', 'oyuncu', 'futbolcu', 'tenisçi'];

  if (highValueSignals.some((signal) => normalizedExtract.includes(signal))) {
    return false;
  }

  return lowValueSignals.some((signal) => normalizedExtract.includes(signal));
}

export function isLowValueWikipediaArticle(title, extract, description = '') {
  const normalizedTitle = String(title ?? '').trim();
  const normalizedExtract = String(extract ?? '').trim();
  const normalizedDescription = String(description ?? '').trim();
  const combinedText = `${normalizedTitle} ${normalizedExtract} ${normalizedDescription}`;

  if (
    HIGH_VALUE_OVERRIDE_PATTERNS.some(
      (pattern) => pattern.test(normalizedTitle) || pattern.test(normalizedExtract),
    )
  ) {
    return false;
  }

  return (
    isLikelyLowValueBiography(normalizedTitle, normalizedExtract) ||
    LOW_VALUE_TITLE_PATTERNS.some((pattern) => pattern.test(combinedText)) ||
    LOW_VALUE_EXTRACT_PATTERNS.some((pattern) => pattern.test(combinedText))
  );
}

export function buildWikipediaSeedQueue(limit) {
  const shuffledByCategory = Object.fromEntries(
    WIKI_THEME_SEQUENCE.map((category) => [category, shuffleArray(CATEGORY_SEED_TOPICS[category] ?? [])]),
  );
  const pointers = Object.fromEntries(WIKI_THEME_SEQUENCE.map((category) => [category, 0]));
  const queue = [];

  while (queue.length < limit) {
    let addedInRound = false;

    for (const category of WIKI_THEME_SEQUENCE) {
      const pool = shuffledByCategory[category];
      const index = pointers[category];

      if (!pool?.length || index >= pool.length) {
        continue;
      }

      queue.push({ category, title: pool[index] });
      pointers[category] += 1;
      addedInRound = true;

      if (queue.length >= limit) {
        break;
      }
    }

    if (!addedInRound) {
      break;
    }
  }

  return queue;
}

export function scoreWikipediaCuriositySignals(title, extract) {
  const text = `${String(title ?? '').trim()} ${String(extract ?? '').trim()}`;
  let score = 0;

  for (const pattern of HIGH_CURIOSITY_PATTERNS) {
    if (pattern.test(text)) {
      score += 1;
    }
  }

  return Math.min(score, 8);
}

function shuffleArray(items) {
  const copy = [...items];

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }

  return copy;
}
