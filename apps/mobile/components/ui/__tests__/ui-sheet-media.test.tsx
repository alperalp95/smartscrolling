import { render } from '@testing-library/react-native';
import type { ComponentProps } from 'react';
import { Text } from 'react-native';
import { BottomSheet } from '../bottom-sheet';
import { Media } from '../media';
import { TabBar } from '../tab-bar';

jest.mock('expo-linear-gradient', () => {
  const { View } = require('react-native');
  return { LinearGradient: View };
});
jest.mock('expo-image', () => {
  const { View } = require('react-native');
  return { Image: View };
});
jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text testID="icon">{name}</Text> };
});
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

describe('BottomSheet', () => {
  it('does not render children when hidden', () => {
    const { queryByText } = render(
      <BottomSheet visible={false} onClose={() => {}}>
        <Text>icerik</Text>
      </BottomSheet>,
    );
    expect(queryByText('icerik')).toBeNull();
  });

  it('renders children when visible', () => {
    const { getByText } = render(
      <BottomSheet visible onClose={() => {}} title="Baslik">
        <Text>icerik</Text>
      </BottomSheet>,
    );
    expect(getByText('icerik')).toBeTruthy();
  });
});

describe('Media', () => {
  it('shows fallback without uri or localSource', () => {
    const { getByTestId } = render(<Media category="Bilim" />);
    expect(getByTestId('media-fallback')).toBeTruthy();
  });

  it('hides fallback when uri is given', () => {
    const { queryByTestId } = render(<Media uri="https://example.com/a.jpg" />);
    expect(queryByTestId('media-fallback')).toBeNull();
  });
});

describe('TabBar', () => {
  const routes = [
    { key: 'index-1', name: 'index' },
    { key: 'saved-1', name: 'saved' },
    { key: 'profile-1', name: 'profile' },
  ];
  const navigation = { emit: () => ({ defaultPrevented: false }), navigate: () => {} };

  function renderBar(r: { key: string; name: string }[]) {
    const props = { state: { index: 0, routes: r }, navigation } as unknown as ComponentProps<
      typeof TabBar
    >;
    return render(<TabBar {...props} />);
  }

  it('renders three tabs', () => {
    const { getByTestId } = renderBar(routes);
    expect(getByTestId('tab-index')).toBeTruthy();
    expect(getByTestId('tab-saved')).toBeTruthy();
    expect(getByTestId('tab-profile')).toBeTruthy();
  });

  it('skips unknown routes such as explore', () => {
    const { getAllByTestId, queryByTestId } = renderBar([
      ...routes,
      { key: 'explore-1', name: 'explore' },
    ]);
    expect(getAllByTestId(/^tab-/)).toHaveLength(3);
    expect(queryByTestId('tab-explore')).toBeNull();
  });
});
