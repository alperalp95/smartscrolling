import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFeedStore } from '../../src/store/feedStore';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const TAB_ICONS: Record<string, { focused: IoniconsName; unfocused: IoniconsName }> = {
  index: { focused: 'flash', unfocused: 'flash-outline' },
  library: { focused: 'library', unfocused: 'library-outline' },
  reader: { focused: 'book', unfocused: 'book-outline' },
  profile: { focused: 'person-circle', unfocused: 'person-circle-outline' },
};

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const refreshFacts = useFeedStore((state) => state.refreshFacts);
  const bumpFeedRotation = useFeedStore((state) => state.bumpFeedRotation);
  const bottomInset = Platform.OS === 'web' ? 0 : Math.max(insets.bottom, 0);
  const baseTabBarHeight = Platform.OS === 'ios' ? 60 : 56;
  const tabBarHeight = baseTabBarHeight + Math.max(bottomInset, Platform.OS === 'ios' ? 12 : 8);

  return (
    <Tabs
      detachInactiveScreens={Platform.OS === 'web'}
      screenOptions={({ route }) => ({
        headerShown: false,
        unmountOnBlur: Platform.OS === 'web',
        tabBarStyle: {
          backgroundColor: 'rgba(10,10,12,0.97)',
          borderTopColor: 'rgba(255,255,255,0.07)',
          borderTopWidth: 0.5,
          height: tabBarHeight,
          paddingBottom: Math.max(bottomInset, Platform.OS === 'ios' ? 18 : 10),
          paddingTop: 8,
          position: 'absolute',
        },
        tabBarActiveTintColor: '#a78bfa',
        tabBarInactiveTintColor: '#48484a',
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          marginTop: 2,
          letterSpacing: 0.2,
        },
        tabBarHideOnKeyboard: true,
        tabBarIcon: ({ color, focused, size }) => {
          const icons = TAB_ICONS[route.name];
          const iconName = icons ? (focused ? icons.focused : icons.unfocused) : 'ellipse-outline';
          return <Ionicons name={iconName} size={size ?? 24} color={color} />;
        },
      })}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Akis' }}
        listeners={{
          tabPress: () => {
            bumpFeedRotation();
            void refreshFacts();
          },
        }}
      />
      <Tabs.Screen name="library" options={{ title: 'Kutuphane' }} />
      <Tabs.Screen name="reader" options={{ title: 'Okuyucu' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profil' }} />
      <Tabs.Screen name="explore" options={{ href: null }} />
    </Tabs>
  );
}
