import { fireEvent, render, within } from '@testing-library/react-native';
import { Linking, StyleSheet } from 'react-native';
import { type } from '../../../src/theme';
import { SeriesReaderCard } from '../series-card';

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

const base = {
  card: { position: 1, sectionTitle: 'Giriş', body: 'Kule 1348 yılında yapıldı.' },
  height: 600,
  category: '📜 TARİH',
  coverUrl: null,
  sourceTitle: 'Galata Kulesi',
  sourceUrl: 'https://tr.wikipedia.org/wiki/Galata_Kulesi',
  sectionIndex: 1,
  sectionCount: 3,
  sectionNumber: 2,
  sectionTotal: 15,
  nextSectionTitle: null,
};

describe('SeriesReaderCard', () => {
  it('meta satırı bölüm adı ve bölüm içi n/m yazar; başlık bölüm başlığıdır', () => {
    const { getByText, getByTestId } = render(<SeriesReaderCard {...base} />);
    expect(getByTestId('series-card-1')).toBeTruthy();
    expect(getByText('BÖLÜM 2 / 15 · 1/3')).toBeTruthy();
    expect(getByText('Giriş')).toBeTruthy();
    expect(getByText('Kule 1348 yılında yapıldı.')).toBeTruthy();
    expect(getByText('Kaynak: Vikipedi — Galata Kulesi ›')).toBeTruthy();
  });

  it('tek kartlık bölümde 1/1 yazılmaz', () => {
    const { getByText, queryByText } = render(
      <SeriesReaderCard {...base} sectionIndex={1} sectionCount={1} />,
    );
    expect(getByText('BÖLÜM 2 / 15')).toBeTruthy();
    expect(queryByText(/1\/1/)).toBeNull();
  });

  it('gövde type.reading stilini kullanır (17/27)', () => {
    const { getByText } = render(<SeriesReaderCard {...base} />);
    const style = StyleSheet.flatten(getByText('Kule 1348 yılında yapıldı.').props.style);
    expect(style.fontSize).toBe(17);
    expect(style.lineHeight).toBe(27);
    expect(style.fontFamily).toBe(type.reading.fontFamily);
  });

  it('ilk kartta kapak vardır, diğerlerinde yoktur', () => {
    const first = render(<SeriesReaderCard {...base} />);
    expect(first.getByTestId('series-card-cover')).toBeTruthy();
    const second = render(<SeriesReaderCard {...base} card={{ ...base.card, position: 2 }} />);
    expect(second.queryByTestId('series-card-cover')).toBeNull();
  });

  it('bölümün son kartında sonraki bölüm ipucunu gösterir', () => {
    const { getByText, getByTestId } = render(
      <SeriesReaderCard
        {...base}
        sectionIndex={3}
        nextSectionTitle="Osmanlı dönemi"
        card={{ ...base.card, position: 3 }}
      />,
    );
    expect(getByTestId('series-next-section')).toBeTruthy();
    expect(getByText('Sonraki bölüm')).toBeTruthy();
    expect(getByText('Osmanlı dönemi ↓')).toBeTruthy();
  });

  it('sonraki bölüm ipucu kaydırılan alanın dışında render edilir', () => {
    const { getByTestId } = render(
      <SeriesReaderCard {...base} sectionIndex={3} nextSectionTitle="Osmanlı dönemi" />,
    );
    expect(
      within(getByTestId('series-card-scroll')).queryByTestId('series-next-section'),
    ).toBeNull();
    expect(getByTestId('series-next-section')).toBeTruthy();
  });

  it('nextSectionTitle null ise (son bölüm) ipucu yoktur', () => {
    const { queryByTestId, queryByText } = render(<SeriesReaderCard {...base} />);
    expect(queryByTestId('series-next-section')).toBeNull();
    expect(queryByText('Sonraki bölüm')).toBeNull();
  });

  it('kaynak satırına dokununca bağlantıyı açar', () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const { getByRole } = render(<SeriesReaderCard {...base} />);
    fireEvent.press(getByRole('link'));
    expect(open).toHaveBeenCalledWith('https://tr.wikipedia.org/wiki/Galata_Kulesi');
  });
});
