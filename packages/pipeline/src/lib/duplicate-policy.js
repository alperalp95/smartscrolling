function normalizeTitle(title) {
  return (title ?? '')
    .normalize('NFKD')
    .toLocaleLowerCase('tr-TR')
    .replace(/[\p{P}\p{S}]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const TOPIC_STOPWORDS = new Set([
  'bir',
  've',
  'ile',
  'icin',
  'gibi',
  'olan',
  'oldugu',
  'olmasi',
  'temel',
  'onemi',
  'etkisi',
  'anlami',
  'gercek',
  'gercekten',
  'the',
  'and',
  'for',
  'with',
  'from',
  'into',
  'importance',
  'effect',
  'meaning',
  'basics',
  'overview',
  'temel',
  'fikri',
  'teorisi',
  'teori',
  'donemi',
  'period',
  'history',
]);

function buildTopicTokens(title) {
  return normalizeTitle(title)
    .split(/\s+/)
    .filter((token) => token.length >= 4 && !TOPIC_STOPWORDS.has(token));
}

function topicSimilarity(leftTitle, rightTitle) {
  const leftTokens = new Set(buildTopicTokens(leftTitle));
  const rightTokens = new Set(buildTopicTokens(rightTitle));

  if (leftTokens.size === 0 || rightTokens.size === 0) {
    return 0;
  }

  let intersection = 0;

  for (const token of leftTokens) {
    if (rightTokens.has(token)) {
      intersection += 1;
    }
  }

  return intersection / Math.min(leftTokens.size, rightTokens.size);
}

export async function findTitleDuplicate(supabase, fact) {
  const normalizedIncomingTitle = normalizeTitle(fact.title);

  if (!normalizedIncomingTitle) {
    return null;
  }

  const { data, error } = await supabase
    .from('facts')
    .select('id,title,category')
    .eq('category', fact.category)
    .limit(200);

  if (error) {
    console.error(`[DuplicatePolicy] title duplicate check failed: ${error.message}`);
    return null;
  }

  const duplicate = (data ?? []).find(
    (row) => normalizeTitle(row.title) === normalizedIncomingTitle,
  );

  if (!duplicate) {
    return null;
  }

  return {
    id: duplicate.id,
    title: duplicate.title,
  };
}

export async function findRecentTopicDuplicate(
  supabase,
  { title, category, freshnessDays = 60, limit = 250 },
) {
  const normalizedIncomingTitle = normalizeTitle(title);

  if (!normalizedIncomingTitle || !category) {
    return null;
  }

  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - freshnessDays);

  const { data, error } = await supabase
    .from('facts')
    .select('id,title,category,created_at')
    .eq('category', category)
    .gte('created_at', cutoff.toISOString())
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error(`[DuplicatePolicy] recent topic check failed: ${error.message}`);
    return null;
  }

  const duplicate = (data ?? []).find((row) => {
    const normalizedExistingTitle = normalizeTitle(row.title);

    if (normalizedExistingTitle === normalizedIncomingTitle) {
      return true;
    }

    return topicSimilarity(title, row.title) >= 0.74;
  });

  if (!duplicate) {
    return null;
  }

  return {
    id: duplicate.id,
    title: duplicate.title,
    created_at: duplicate.created_at,
  };
}
