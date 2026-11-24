import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { TabBar } from '../../components/ui/tab-bar';
import { useFeedStore } from '../../src/store/feedStore';

export default function TabLayout() {
  const refreshFacts = useFeedStore((state) => state.refreshFacts);
  const bumpFeedRotation = useFeedStore((state) => state.bumpFeedRotation);

  return (
    <Tabs
      detachInactiveScreens={Platform.OS === 'web'}
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={() => ({
        headerShown: false,
        unmountOnBlur: Platform.OS === 'web',
        tabBarHideOnKeyboard: true,
      })}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Akış' }}
        listeners={{
          tabPress: () => {
            bumpFeedRotation();
            void refreshFacts();
          },
        }}
      />
      <Tabs.Screen name="saved" options={{ title: 'Kaydedilenler' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profil' }} />
      <Tabs.Screen name="explore" options={{ href: null }} />
    </Tabs>
  );
}
