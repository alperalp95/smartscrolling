import { act, fireEvent, render } from '@testing-library/react-native';
import { showDialog } from '../../src/lib/dialog';
import { useDialogStore } from '../../src/store/dialogStore';
import { AppDialog } from '../app-dialog';

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

beforeEach(() => {
  useDialogStore.setState({ current: null, queue: [] });
});

describe('AppDialog', () => {
  it('butona basınca onPress çağrılır ve pencere kapanır', () => {
    const onPress = jest.fn();
    const { getByTestId, queryByTestId } = render(<AppDialog />);
    act(() => {
      showDialog({ title: 'Soru', actions: [{ label: 'Evet', style: 'destructive', onPress }] });
    });
    expect(getByTestId('app-dialog')).toBeTruthy();
    fireEvent.press(getByTestId('app-dialog-action-0'));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(queryByTestId('app-dialog')).toBeNull();
  });

  it('kapatma cancel aksiyonunun onPress ini çağırır', () => {
    const onCancel = jest.fn();
    const onOk = jest.fn();
    const { getByLabelText, queryByTestId } = render(<AppDialog />);
    act(() => {
      showDialog({
        title: 'Soru',
        actions: [
          { label: 'Vazgeç', style: 'cancel', onPress: onCancel },
          { label: 'Tamam', style: 'primary', onPress: onOk },
        ],
      });
    });
    fireEvent.press(getByLabelText('Kapat'));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onOk).not.toHaveBeenCalled();
    expect(queryByTestId('app-dialog')).toBeNull();
  });
});
