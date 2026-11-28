import { fireEvent, render } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';
import { colors } from '../../../src/theme';
import { Button } from '../button';
import { Chip } from '../chip';
import { GradientButton, GradientText } from '../gradient';
import { IconButton } from '../icon-button';
import { Screen } from '../screen';
import { TopBar } from '../top-bar';

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
  return { Ionicons: ({ name }: { name: string }) => <Text testID="icon">{name}</Text> };
});
jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return { SafeAreaView: View };
});

describe('ui basic components', () => {
  it('renders every component', () => {
    const { getByText } = render(
      <Screen>
        <TopBar title="Baslik" left={<Text>sol</Text>} right={<Text>sag</Text>} />
        <IconButton name="heart-outline" onPress={() => {}} accessibilityLabel="Begen" />
        <Button label="Tamam" onPress={() => {}} />
        <GradientButton label="Gradyan" onPress={() => {}} icon="sparkles" />
        <GradientText>Marka</GradientText>
        <Chip label="Etiket" />
      </Screen>,
    );
    expect(getByText('Baslik')).toBeTruthy();
    expect(getByText('Tamam')).toBeTruthy();
    expect(getByText('Gradyan')).toBeTruthy();
    expect(getByText('Etiket')).toBeTruthy();
  });

  it.each([
    ['Button', Button],
    ['GradientButton', GradientButton],
  ] as const)('%s respects disabled', (_name, Comp) => {
    const onPress = jest.fn();
    const off = render(<Comp label="x" onPress={onPress} disabled testID="b" />);
    fireEvent.press(off.getByTestId('b'));
    expect(onPress).not.toHaveBeenCalled();
    const on = render(<Comp label="y" onPress={onPress} testID="c" />);
    fireEvent.press(on.getByTestId('c'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('forwards testID', () => {
    const { getByTestId } = render(
      <>
        <IconButton name="add" onPress={() => {}} accessibilityLabel="a" testID="ib" />
        <Chip label="c" testID="ch" />
      </>,
    );
    expect(getByTestId('ib')).toBeTruthy();
    expect(getByTestId('ch')).toBeTruthy();
  });

  it('IconButton shows filled icon when active', () => {
    const a = render(
      <IconButton name="heart-outline" active onPress={() => {}} accessibilityLabel="a" />,
    );
    expect(a.getByTestId('icon').props.children).toBe('heart');
    const b = render(
      <IconButton
        name="bookmark-outline"
        active
        activeName="star"
        onPress={() => {}}
        accessibilityLabel="a"
      />,
    );
    expect(b.getByTestId('icon').props.children).toBe('star');
  });

  it('Chip success onImage: dark opaque background, green label', () => {
    const { getByTestId, getByText } = render(
      <Chip label="ok" tone="success" onImage testID="ch-img" />,
    );
    const chipStyle = StyleSheet.flatten(getByTestId('ch-img').props.style);
    expect(chipStyle.backgroundColor).toBe(colors.scrimStrong);
    expect(StyleSheet.flatten(getByText('ok').props.style).color).toBe(colors.success);
  });

  it('Chip success without onImage keeps the soft background', () => {
    const { getByTestId } = render(<Chip label="ok" tone="success" testID="ch-plain" />);
    expect(StyleSheet.flatten(getByTestId('ch-plain').props.style).backgroundColor).toBe(
      colors.successSoft,
    );
  });
});
