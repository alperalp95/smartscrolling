import { fireEvent, render } from '@testing-library/react-native';
import { CardAskSheet } from '../card-ask-sheet';

jest.mock('expo-linear-gradient', () => {
  const { View } = require('react-native');
  return { LinearGradient: View };
});
jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text>{name}</Text> };
});
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('../../src/lib/aiContentReports', () => ({ submitAiContentReport: jest.fn() }));
jest.mock('../../src/lib/premiumPrompt', () => ({
  promptForPremium: jest.fn((opts: { onConfirm: () => void }) => opts.onConfirm()),
}));
jest.mock('../../src/lib/useCardAsk', () => {
  const state = {
    messages: [],
    isLoading: false,
    remaining: 3,
    askPreset: jest.fn(),
    askFree: jest.fn(),
    reset: jest.fn(),
  };
  return { useCardAsk: () => state };
});

const fact = { id: 'f1', title: 'Test kartı' } as never;

describe('CardAskSheet', () => {
  it('shows locked input for free users and calls onPremiumPress', () => {
    const onPremiumPress = jest.fn();
    const { getByTestId } = render(
      <CardAskSheet
        fact={fact}
        hasPremium={false}
        onClose={() => {}}
        onPremiumPress={onPremiumPress}
      />,
    );
    expect(getByTestId('card-ask-preset-why')).toBeTruthy();
    fireEvent.press(getByTestId('card-ask-locked'));
    expect(onPremiumPress).toHaveBeenCalledTimes(1);
  });
});
