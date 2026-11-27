import { fireEvent, render } from '@testing-library/react-native';
import { Linking } from 'react-native';
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
  seriesTitle: 'Galata Kulesi',
  category: '📜 TARİH',
  coverUrl: null,
  sourceTitle: 'Galata Kulesi',
  sourceUrl: 'https://tr.wikipedia.org/wiki/Galata_Kulesi',
};

describe('SeriesReaderCard', () => {
  it('bölüm başlığını büyük harfle, gövdeyi ve kaynağı gösterir', () => {
    const { getByText, getByTestId } = render(<SeriesReaderCard {...base} />);
    expect(getByTestId('series-card-1')).toBeTruthy();
    expect(getByText('GİRİŞ')).toBeTruthy();
    expect(getByText('Kule 1348 yılında yapıldı.')).toBeTruthy();
    expect(getByText('Kaynak: Vikipedi — Galata Kulesi ›')).toBeTruthy();
  });

  it('seri başlığı yalnız ilk kartta görünür', () => {
    const first = render(<SeriesReaderCard {...base} />);
    expect(first.getByText('Galata Kulesi')).toBeTruthy();
    const second = render(<SeriesReaderCard {...base} card={{ ...base.card, position: 2 }} />);
    expect(second.queryByText('Galata Kulesi')).toBeNull();
  });

  it('kaynak satırına dokununca bağlantıyı açar', () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const { getByRole } = render(<SeriesReaderCard {...base} />);
    fireEvent.press(getByRole('link'));
    expect(open).toHaveBeenCalledWith('https://tr.wikipedia.org/wiki/Galata_Kulesi');
  });
});
