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

describe('SeriesHero progress', () => {
  it('shows the Tamamlandı chip when completed', () => {
    const { getByTestId, getByText } = render(
      <SeriesHero
        series={make({})}
        progress={{ seriesId: 'id1', lastPosition: 68, completedAt: '2026-11-01' }}
        onPress={() => {}}
      />,
    );
    expect(getByTestId('series-hero-done')).toBeTruthy();
    expect(getByText('✓ Tamamlandı')).toBeTruthy();
  });

  it('shows progress line and n / N kart when started, none when untouched', () => {
    const started = render(
      <SeriesHero
        series={make({})}
        progress={{ seriesId: 'id1', lastPosition: 17, completedAt: null }}
        onPress={() => {}}
      />,
    );
    expect(started.getByTestId('series-hero-progress')).toBeTruthy();
    expect(started.getByText('17 / 68 kart · ~68 dk')).toBeTruthy();
    const fresh = render(<SeriesHero series={make({})} onPress={() => {}} />);
    expect(fresh.queryByTestId('series-hero-progress')).toBeNull();
    expect(fresh.queryByTestId('series-hero-done')).toBeNull();
  });
});

describe('SeriesShelf progress', () => {
  const items = [
    make({ id: 'a', slug: 'lale-devri', title: 'Lale Devri', cardCount: 43, isFree: true }),
    make({ id: 'b', slug: 'galata-kulesi', title: 'Galata Kulesi', cardCount: 84, isFree: true }),
    make({ id: 'c', slug: 'yerkure', title: 'Yerküre', cardCount: 136 }),
  ];
  const progress = {
    a: { seriesId: 'a', lastPosition: 17, completedAt: null },
    b: { seriesId: 'b', lastPosition: 84, completedAt: '2026-11-01' },
  };

  it('completed gets chip, started gets line and n / N kart, untouched gets neither', () => {
    const { getByTestId, queryByTestId, getByText } = render(
      <SeriesShelf category="📜 TARİH" items={items} progress={progress} onPress={() => {}} />,
    );
    expect(getByTestId('series-done-galata-kulesi')).toBeTruthy();
    expect(queryByTestId('series-progress-galata-kulesi')).toBeNull();
    expect(getByTestId('series-progress-lale-devri')).toBeTruthy();
    expect(getByText('17 / 43 kart')).toBeTruthy();
    expect(queryByTestId('series-done-yerkure')).toBeNull();
    expect(queryByTestId('series-progress-yerkure')).toBeNull();
    expect(getByText('136 kart')).toBeTruthy();
  });

  it('keeps PREMIUM chip on a premium series that is not completed', () => {
    const { getAllByText } = render(
      <SeriesShelf category="📜 TARİH" items={items} progress={progress} onPress={() => {}} />,
    );
    expect(getAllByText('PREMIUM')).toHaveLength(1);
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
