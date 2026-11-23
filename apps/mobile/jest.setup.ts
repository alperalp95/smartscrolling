jest.mock('@react-native-async-storage/async-storage', () => {
  const asyncStorageMock = require('@react-native-async-storage/async-storage/jest/async-storage-mock');

  return {
    __esModule: true,
    ...asyncStorageMock,
    default: asyncStorageMock,
  };
});
