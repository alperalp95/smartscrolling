import { fireEvent, render } from '@testing-library/react-native';
import type { SeriesSummary } from '../../../src/types';
import { SeriesHero } from '../series-hero';
import { SeriesShelf } from '../series-shelf';

jest.mock('expo-linear-gradient', () => {
  const { View } = require('react-native');
  return { LinearGradient: View };
});
jest.mock('@react-native-masked-view/masked-view', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: ({ children }: { children: unknown }) => <View>{children as never}</View>,
  };
});
jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text>{name}</Text> };
});

const make = (over: Partial<SeriesSummary>): SeriesSummary => ({
  id: 'id1',
  slug: 'galata-kulesi',
  title: 'Galata Kulesi',
  summary: null,
  category: '📜 TARİH',
  coverUrl: null,
  cardCount: 68,
  sectionCount: 6,
  isFree: false,
  isFeatured: true,
  publishedAt: null,
  ...over,
});

describe('SeriesHero', () => {
  it('draws title, category, counts and PREMIUM chip, and opens on press', () => {
    const onPress = jest.fn();
    const { getByTestId, getByText } = render(<SeriesHero series={make({})} onPress={onPress} />);
    expect(getByText('Galata Kulesi')).toBeTruthy();
    expect(getByText(/ÖNE ÇIKAN/)).toBeTruthy();
    expect(getByText('68 kart · ~68 dk')).toBeTruthy();
    expect(getByText('PREMIUM')).toBeTruthy();
    fireEvent.press(getByTestId('series-hero'));
    expect(onPress).toHaveBeenCalledWith('galata-kulesi');
  });

  it('has no PREMIUM chip for a free series', () => {
    const { queryByText } = render(
      <SeriesHero series={make({ isFree: true })} onPress={() => {}} />,
    );
    expect(queryByText('PREMIUM')).toBeNull();
  });
});

describe('SeriesShelf', () => {
  it('draws a shelf with items, chip only on premium, and opens an item', () => {
    const onPress = jest.fn();
    const items = [
      make({ id: 'a', slug: 'lale-devri', title: 'Lale Devri', cardCount: 31, isFree: true }),
      make({ id: 'b', slug: 'ibn-haldun', title: 'İbn Haldun', cardCount: 44 }),
    ];
    const { getByTestId, getByText, getAllByText } = render(
      <SeriesShelf category="📜 TARİH" items={items} onPress={onPress} />,
    );
    expect(getByTestId('series-shelf-📜 TARİH')).toBeTruthy();
    expect(getByText('31 kart')).toBeTruthy();
    expect(getAllByText('PREMIUM')).toHaveLength(1);
    fireEvent.press(getByTestId('series-item-ibn-haldun'));
    expect(onPress).toHaveBeenCalledWith('ibn-haldun');
  });
});
