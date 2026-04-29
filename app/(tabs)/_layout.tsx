import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { UserSwitcher } from '../../components/UserSwitcher';
import { SyncStatus } from '../../components/SyncStatus';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const TABS: Array<{ name: string; title: string; icon: IoniconName }> = [
  { name: 'index',       title: 'Inicio',      icon: 'home-outline' },
  { name: 'movimientos', title: 'Movimientos', icon: 'swap-horizontal-outline' },
  { name: 'ahorros',     title: 'Ahorros',     icon: 'save-outline' },
  { name: 'deseos',      title: 'Deseos',      icon: 'star-outline' },
];

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#2563EB',
        tabBarInactiveTintColor: '#94A3B8',
        tabBarStyle: { backgroundColor: '#fff', borderTopColor: '#E2E8F0' },
        headerStyle: { backgroundColor: '#fff' },
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: '700', fontSize: 18, color: '#0F172A' },
        headerTitle: 'nosotros',
        headerLeft: () => <SyncStatus />,
        headerRight: () => <UserSwitcher />,
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            headerShown: tab.name !== 'index',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name={tab.icon} size={size} color={color} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
