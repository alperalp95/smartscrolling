import { fireEvent, render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import type { FactType } from '../../../src/types';
import { ShareCard } from '../share-card';

jest.mock('expo-linear-gradient', () => {
  const { View } = require('react-native');
  return { LinearGradient: View };
});
jest.mock('@react-native-masked-view/masked-view', () => {
  const { View } = require('react-native');
  return { __esModule: true, default: View };
});
jest.mock('expo-image', () => {
  const { View } = require('react-native');
  return { Image: (props: object) => <View testID="mock-image" {...props} /> };
});
jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text>{name}</Text> };
});

function makeFact(overrides: Partial<FactType> = {}): FactType {
  return {
    id: 'f1',
    title: 'Başlık',
    content: 'Kısa içerik.',
    category: 'Bilim',
    tags: [],
    read_time_sq: 30,
    likes: 0,
    media_url: null,
    visual_key: null,
    ...overrides,
  } as unknown as FactType;
}

describe('ShareCard', () => {
  it('shows the photo only in the photo variant', () => {
    const photo = render(
      <ShareCard fact={makeFact()} variant="photo" photoUri="https://example.com/a.jpg" />,
    );
    expect(photo.queryByTestId('share-card-photo')).toBeTruthy();
    expect(photo.queryByTestId('share-card-quote')).toBeNull();
    photo.unmount();

    const text = render(<ShareCard fact={makeFact()} variant="text" photoUri={null} />);
    expect(text.queryByTestId('share-card-photo')).toBeNull();
    expect(text.queryByTestId('share-card-quote')).toBeTruthy();
  });

  it('writes Turkish upper-case category, call to action and domain, without read time', () => {
    const { getByTestId, queryByText } = render(
      <ShareCard fact={makeFact({ category: 'bilim' })} variant="text" photoUri={null} />,
    );
    expect(getByTestId('share-card-category')).toHaveTextContent('BİLİM');
    expect(getByTestId('share-card-cta')).toHaveTextContent("Devamı SmartScrolling'de");
    expect(getByTestId('share-card-domain')).toHaveTextContent('smartscrolling.app');
    expect(queryByText(/dk/)).toBeNull();
  });

  const longTitle = 'A'.repeat(58);
  const longBody = Array.from({ length: 120 }, (_, i) => `kelime${i}`).join(' ');

  it('C1: title 26px max 4 lines, body max 4 lines', () => {
    const { getByTestId } = render(
      <ShareCard
        fact={makeFact({ title: longTitle, content: longBody })}
        variant="text"
        photoUri={null}
      />,
    );
    expect(getByTestId('share-card-title')).toHaveTextContent(longTitle);
    expect(getByTestId('share-card-title').props.numberOfLines).toBe(4);
    expect(getByTestId('share-card-body').props.numberOfLines).toBe(4);
    expect(StyleSheet.flatten(getByTestId('share-card-title').props.style).fontSize).toBe(26);
  });

  it('C2: title 22px max 3 lines, body max 3 lines', () => {
    const { getByTestId } = render(
      <ShareCard
        fact={makeFact({ title: longTitle, content: longBody })}
        variant="photo"
        photoUri="https://example.com/a.jpg"
      />,
    );
    expect(getByTestId('share-card-title').props.numberOfLines).toBe(3);
    expect(getByTestId('share-card-body').props.numberOfLines).toBe(3);
    expect(StyleSheet.flatten(getByTestId('share-card-title').props.style).fontSize).toBe(22);
  });

  it('calls onPhotoLoad and onPhotoError once each', () => {
    const onPhotoLoad = jest.fn();
    const onPhotoError = jest.fn();
    const { getByTestId } = render(
      <ShareCard
        fact={makeFact()}
        variant="photo"
        photoUri="https://example.com/a.jpg"
        onPhotoLoad={onPhotoLoad}
        onPhotoError={onPhotoError}
      />,
    );
    fireEvent(getByTestId('mock-image'), 'load');
    expect(onPhotoLoad).toHaveBeenCalledTimes(1);
    expect(onPhotoError).not.toHaveBeenCalled();
    fireEvent(getByTestId('mock-image'), 'error');
    expect(onPhotoError).toHaveBeenCalledTimes(1);
    expect(onPhotoLoad).toHaveBeenCalledTimes(1);
  });
});
