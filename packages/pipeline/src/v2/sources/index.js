// v2 kaynak toplayıcıları kaydı. Her toplayıcı `({ http, limit, cursor, now }) => { candidates, nextCursor, stats }`.
import { collectDykArchive } from './dyk-archive.js';
import { collectDykRecent } from './dyk-recent.js';
import { collectEnwikiLists } from './enwiki-lists.js';
import { collectTrBm } from './trwiki-bm.js';

export { createHttpClient, USER_AGENT } from './http.js';
export { cleanHookText, makeCandidate } from './types.js';

export const COLLECTORS = {
  s1: { name: 'EN DYK arşivi (Hugging Face)', collect: collectDykArchive },
  s2: { name: 'EN DYK yeni kancalar (Recent additions)', collect: collectDykRecent },
  s3: { name: 'TR Biliyor muydunuz?', collect: collectTrBm },
  s4: { name: 'EN misconceptions + unusual articles', collect: collectEnwikiLists },
};

export const SOURCE_IDS = Object.keys(COLLECTORS);
