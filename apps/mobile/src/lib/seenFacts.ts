import AsyncStorage from '@react-native-async-storage/async-storage';

export const SEEN_FACTS_KEY = 'feed.seenFactIds.v1';
export const SEEN_FACTS_LIMIT = 500;

let cache: string[] | null = null;

function parseIds(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every((v) => typeof v === 'string')) {
      return parsed as string[];
    }
  } catch {
    // bozuk veri: boş liste
  }
  return [];
}

async function ensureLoaded(): Promise<string[]> {
  if (cache) return cache;
  try {
    cache = parseIds(await AsyncStorage.getItem(SEEN_FACTS_KEY));
  } catch {
    cache = [];
  }
  return cache;
}

async function persist(ids: string[]): Promise<void> {
  try {
    await AsyncStorage.setItem(SEEN_FACTS_KEY, JSON.stringify(ids));
  } catch {
    // depolama yoksa uygulama bellekteki kopyayla çalışır
  }
}

export async function loadSeenFactIds(): Promise<string[]> {
  return (await ensureLoaded()).slice();
}

export async function markFactSeen(id: string): Promise<void> {
  const current = await ensureLoaded();
  const next = current.filter((x) => x !== id);
  next.push(id);
  cache = next.length > SEEN_FACTS_LIMIT ? next.slice(next.length - SEEN_FACTS_LIMIT) : next;
  await persist(cache);
}

export async function resetSeenFactIds(): Promise<void> {
  cache = [];
  try {
    await AsyncStorage.removeItem(SEEN_FACTS_KEY);
  } catch {
    // yut
  }
}
