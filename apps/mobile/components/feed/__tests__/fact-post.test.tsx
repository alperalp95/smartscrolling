import { act, fireEvent, render } from '@testing-library/react-native';
import type { FactType } from '../../../src/types';
import { FactPost, type FactPostProps } from '../fact-post';

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
  return { Image: View };
});
jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text testID="icon">{name}</Text> };
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
    source_label: 'Kaynak adı',
    source_url: 'https://example.com',
    ...overrides,
  } as unknown as FactType;
}

function renderPost(item: FactType, overrides: Partial<FactPostProps> = {}) {
  const props: FactPostProps = {
    item,
    isActive: false,
    height: 800,
    onFinish: jest.fn(),
    onReadQualified: jest.fn(),
    toggleLike: jest.fn(),
    toggleSave: jest.fn(),
    isLiked: false,
    isSaved: false,
    tabBarHeight: 60,
    bottomInset: 0,
    topInset: 0,
    onExpandedChange: jest.fn(),
    isReviewMode: false,
    reviewVerdict: null,
    onOpenReview: jest.fn(),
    onAsk: jest.fn(),
    ...overrides,
  };
  return { props, ...render(<FactPost {...props} />) };
}

describe('FactPost', () => {
  it('shows the media fallback when there is no media_url or visual_key', () => {
    const { getByTestId } = renderPost(makeFact());
    expect(getByTestId('media-fallback')).toBeTruthy();
  });

  it('shows "devamı" only when the body really overflows, and expands on press', () => {
    const content = 'a'.repeat(600);
    const { getByText, queryByText, UNSAFE_getAllByProps, props } = renderPost(
      makeFact({ content }),
    );
    expect(queryByText('devamı')).toBeNull();
    const measure = UNSAFE_getAllByProps({ children: content }).find(
      (n) => typeof n.props.onTextLayout === 'function',
    );
    if (!measure) throw new Error('measure text not found');
    act(() => {
      measure.props.onTextLayout({ nativeEvent: { lines: new Array(9).fill({}) } });
    });
    const more = getByText('devamı');
    expect(more).toBeTruthy();
    fireEvent.press(more);
    expect(props.onExpandedChange).toHaveBeenCalledWith(true);
  });

  it('hides "devamı" when the text fits', () => {
    const { queryByText, UNSAFE_getAllByProps } = renderPost(makeFact({ content: 'kısa' }));
    const measure = UNSAFE_getAllByProps({ children: 'kısa' }).find(
      (n) => typeof n.props.onTextLayout === 'function',
    );
    act(() => {
      measure?.props.onTextLayout({ nativeEvent: { lines: [{}] } });
    });
    expect(queryByText('devamı')).toBeNull();
  });

  it('wires ask and save buttons', () => {
    const item = makeFact();
    const { getByTestId, props } = renderPost(item);
    fireEvent.press(getByTestId('card-ask-button'));
    expect(props.onAsk).toHaveBeenCalledWith(item);
    fireEvent.press(getByTestId('feed-save-button'));
    expect(props.toggleSave).toHaveBeenCalledWith('f1');
  });
});
