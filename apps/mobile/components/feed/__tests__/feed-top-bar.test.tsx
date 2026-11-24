import { fireEvent, render } from '@testing-library/react-native';
import { FeedTopBar } from '../feed-top-bar';

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text testID="icon">{name}</Text> };
});
jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return {
    SafeAreaView: View,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

const baseProps = {
  streakDays: 7,
  todayFactsRead: 5,
  dailyGoal: 20,
  onLogin: () => {},
  onChangeGoal: () => {},
};

describe('FeedTopBar', () => {
  it('shows streak and opens the Bugün sheet when signed in', () => {
    const { getByTestId, getByText, queryByText } = render(
      <FeedTopBar {...baseProps} isSignedIn />,
    );
    expect(getByText('7')).toBeTruthy();
    expect(queryByText('Giriş yap')).toBeNull();
    expect(queryByText('Bugün')).toBeNull();
    fireEvent.press(getByTestId('feed-streak'));
    expect(getByText('Bugün')).toBeTruthy();
    expect(getByText('5/20 kart')).toBeTruthy();
  });

  it('shows login button instead of streak for guests', () => {
    const onLogin = jest.fn();
    const { getByText, queryByTestId } = render(
      <FeedTopBar {...baseProps} isSignedIn={false} onLogin={onLogin} />,
    );
    expect(queryByTestId('feed-streak')).toBeNull();
    fireEvent.press(getByText('Giriş yap'));
    expect(onLogin).toHaveBeenCalled();
  });
});
