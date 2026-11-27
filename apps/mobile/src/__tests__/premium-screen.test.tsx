import { fireEvent, render, waitFor } from '@testing-library/react-native';
import PremiumScreen from '../../app/premium';
import { purchasePackageSafe, restorePurchasesSafe } from '../lib/purchases';

const mockBack = jest.fn();
const mockRefreshSession = jest.fn(() => Promise.resolve({}));

jest.mock('../lib/supabase', () => ({
  supabase: { auth: { refreshSession: () => mockRefreshSession() } },
}));

jest.mock('expo-router', () => ({ useRouter: () => ({ back: mockBack }) }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: 'LinearGradient' }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('@react-native-masked-view/masked-view', () => 'MaskedView');
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: 'SafeAreaView',
}));
jest.mock('react-native-purchases', () => ({}));
jest.mock('../store/authStore', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) =>
    sel({ user: { id: 'u1' }, setHasPremium: jest.fn() }),
}));
jest.mock('../lib/purchases', () => ({
  getCurrentOfferingSafe: jest.fn(() =>
    Promise.resolve({
      availablePackages: [{ identifier: '$rc_lifetime', product: { priceString: '₺49,99' } }],
    }),
  ),
  getPremiumEntitlementStatus: jest.fn(() => Promise.resolve(true)),
  purchasePackageSafe: jest.fn(() => Promise.resolve({})),
  restorePurchasesSafe: jest.fn(() => Promise.resolve({})),
}));

describe('PremiumScreen', () => {
  it('satın alma ve geri yükleme butonları ilgili fonksiyonu çağırır', async () => {
    const { getByTestId, findByText } = render(<PremiumScreen />);
    await findByText('₺49,99');
    await waitFor(() =>
      expect(getByTestId('premium-purchase-button').props.accessibilityState.disabled).toBe(false),
    );

    fireEvent.press(getByTestId('premium-purchase-button'));
    await waitFor(() => expect(purchasePackageSafe).toHaveBeenCalled());

    fireEvent.press(getByTestId('premium-restore-button'));
    await waitFor(() => expect(restorePurchasesSafe).toHaveBeenCalled());

    fireEvent.press(getByTestId('premium-close'));
    expect(mockBack).toHaveBeenCalled();
  });

  it('satın alma başarısında oturumu yeniler (seri kilidi açılsın)', async () => {
    mockRefreshSession.mockClear();
    const { getByTestId, findByText } = render(<PremiumScreen />);
    await findByText('₺49,99');
    await waitFor(() =>
      expect(getByTestId('premium-purchase-button').props.accessibilityState.disabled).toBe(false),
    );
    fireEvent.press(getByTestId('premium-purchase-button'));
    await waitFor(() => expect(mockRefreshSession).toHaveBeenCalledTimes(1));
  });

  it('geri yükleme başarısında oturumu yeniler', async () => {
    mockRefreshSession.mockClear();
    const { getByTestId } = render(<PremiumScreen />);
    fireEvent.press(getByTestId('premium-restore-button'));
    await waitFor(() => expect(mockRefreshSession).toHaveBeenCalledTimes(1));
  });

  it('avantaj listesinde "Tüm seriler" yer alır', async () => {
    const { getByText, findByText } = render(<PremiumScreen />);
    await findByText('₺49,99');
    expect(getByText('Tüm seriler')).toBeTruthy();
  });
});
