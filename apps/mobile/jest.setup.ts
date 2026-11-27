jest.mock('@react-native-async-storage/async-storage', () => {
  const asyncStorageMock = require('@react-native-async-storage/async-storage/jest/async-storage-mock');

  return {
    __esModule: true,
    ...asyncStorageMock,
    default: asyncStorageMock,
  };
});

jest.mock(
  'react-native-view-shot',
  () => ({
    __esModule: true,
    captureRef: jest.fn(() => Promise.resolve('file:///tmp/share.png')),
  }),
  { virtual: true },
);

jest.mock(
  'react-native-share',
  () => {
    const open = jest.fn(() => Promise.resolve({ success: true }));
    return { __esModule: true, default: { open }, open };
  },
  { virtual: true },
);

jest.mock(
  'expo-clipboard',
  () => ({
    __esModule: true,
    setStringAsync: jest.fn(() => Promise.resolve(true)),
  }),
  { virtual: true },
);
