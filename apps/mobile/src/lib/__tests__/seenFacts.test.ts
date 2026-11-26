import AsyncStorage from '@react-native-async-storage/async-storage';

type SeenModule = typeof import('../seenFacts');

function loadModule(): SeenModule {
  let mod!: SeenModule;
  jest.isolateModules(() => {
    mod = require('../seenFacts');
  });
  return mod;
}

describe('seenFacts', () => {
  beforeEach(async () => {
    jest.restoreAllMocks();
    await AsyncStorage.clear();
  });

  it('adds ids in order', async () => {
    const m = loadModule();
    await m.markFactSeen('a');
    await m.markFactSeen('b');
    expect(await m.loadSeenFactIds()).toEqual(['a', 'b']);
    expect(JSON.parse((await AsyncStorage.getItem(m.SEEN_FACTS_KEY)) as string)).toEqual([
      'a',
      'b',
    ]);
  });

  it('moves a repeated id to the end', async () => {
    const m = loadModule();
    await m.markFactSeen('a');
    await m.markFactSeen('b');
    await m.markFactSeen('a');
    expect(await m.loadSeenFactIds()).toEqual(['b', 'a']);
  });

  it('drops the oldest on the 501st add', async () => {
    const m = loadModule();
    for (let i = 0; i < m.SEEN_FACTS_LIMIT + 1; i++) {
      await m.markFactSeen(`id${i}`);
    }
    const ids = await m.loadSeenFactIds();
    expect(ids).toHaveLength(m.SEEN_FACTS_LIMIT);
    expect(ids[0]).toBe('id1');
    expect(ids[ids.length - 1]).toBe(`id${m.SEEN_FACTS_LIMIT}`);
  });

  it('returns [] for corrupt JSON', async () => {
    const m = loadModule();
    await AsyncStorage.setItem(m.SEEN_FACTS_KEY, '{not json');
    expect(await m.loadSeenFactIds()).toEqual([]);
  });

  it('returns [] when stored value is not a string array', async () => {
    const m = loadModule();
    await AsyncStorage.setItem(m.SEEN_FACTS_KEY, JSON.stringify({ a: 1 }));
    expect(await m.loadSeenFactIds()).toEqual([]);
  });

  it('swallows AsyncStorage errors', async () => {
    const m = loadModule();
    jest.spyOn(AsyncStorage, 'getItem').mockRejectedValue(new Error('boom'));
    jest.spyOn(AsyncStorage, 'setItem').mockRejectedValue(new Error('boom'));
    jest.spyOn(AsyncStorage, 'removeItem').mockRejectedValue(new Error('boom'));
    await expect(m.loadSeenFactIds()).resolves.toEqual([]);
    await expect(m.markFactSeen('a')).resolves.toBeUndefined();
    await expect(m.resetSeenFactIds()).resolves.toBeUndefined();
  });

  it('reset clears the list', async () => {
    const m = loadModule();
    await m.markFactSeen('a');
    await m.resetSeenFactIds();
    expect(await m.loadSeenFactIds()).toEqual([]);
  });

  it('reads storage only once (in-memory copy)', async () => {
    const m = loadModule();
    const spy = jest.spyOn(AsyncStorage, 'getItem');
    spy.mockClear();
    await m.loadSeenFactIds();
    await m.markFactSeen('a');
    await m.loadSeenFactIds();
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
