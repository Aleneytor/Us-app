import { useEffect, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { Animated, Pressable, StyleSheet, TouchableOpacity, useWindowDimensions, View, Text } from 'react-native';
import { BudgetCategoryModal } from '../../modals/BudgetCategoryModal';
import { SavingPlanModal } from '../../modals/SavingPlanModal';
import { TransactionModal } from '../../modals/TransactionModal';
import { APP_COLORS } from '../../constants/colors';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const TAB_ICONS: Record<string, { active: IoniconName; inactive: IoniconName }> = {
  index: { active: 'home', inactive: 'home-outline' },
  movimientos: { active: 'repeat', inactive: 'repeat-outline' },
  ahorro: { active: 'bookmark', inactive: 'bookmark-outline' },
  perfil: { active: 'person', inactive: 'person-outline' },
};

const DROPUP_OPTIONS: Array<{ label: string; icon: IoniconName; key: string }> = [
  { key: 'ahorro', label: 'Nuevo ahorro', icon: 'bookmark-outline' },
  { key: 'categoria', label: 'Nueva categoría', icon: 'pie-chart-outline' },
  { key: 'movimiento', label: 'Nuevo movimiento', icon: 'add-circle-outline' },
];

export default function TabLayout() {
  const [showCreate, setShowCreate] = useState(false);
  const [newCategoryOpen, setNewCategoryOpen] = useState(false);
  const [savingPlanCreateOpen, setSavingPlanCreateOpen] = useState(false);
  const [dropupOpen, setDropupOpen] = useState(false);
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const { width } = useWindowDimensions();

  useEffect(() => {
    Animated.spring(rotateAnim, {
      toValue: dropupOpen ? 1 : 0,
      useNativeDriver: true,
      damping: 18,
      stiffness: 260,
      mass: 0.6,
    }).start();
  }, [dropupOpen, rotateAnim]);
  const fabWidth = Math.min(86, Math.max(66, width * 0.2));
  const fabHeight = Math.min(56, Math.max(48, width * 0.13));
  const fabIconSize = width < 360 ? 28 : 31;

  const handleOption = (key: string) => {
    setDropupOpen(false);
    if (key === 'movimiento') setShowCreate(true);
    else if (key === 'categoria') setNewCategoryOpen(true);
    else if (key === 'ahorro') setSavingPlanCreateOpen(true);
  };

  return (
    <>
      <Tabs
        screenOptions={({ route }) => ({
          tabBarActiveTintColor: '#303236',
          tabBarInactiveTintColor: '#B3B5B8',
          tabBarStyle: styles.tabBar,
          tabBarLabelStyle: styles.tabLabel,
          headerStyle: styles.header,
          headerShadowVisible: false,
          headerTitleStyle: styles.headerTitle,
          animation: 'fade',
          tabBarIcon: ({ focused, color, size }) => {
            const icons = TAB_ICONS[route.name];
            if (!icons) return null;
            return (
              <Ionicons
                name={focused ? icons.active : icons.inactive}
                size={size}
                color={color}
              />
            );
          },
        })}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            headerShown: false,
          }}
        />
        <Tabs.Screen
          name="movimientos"
          options={{
            title: '',
            headerShown: false,
          }}
        />
        <Tabs.Screen
          name="create"
          options={{
            title: '',
            headerShown: false,
            tabBarButton: () => (
              <TouchableOpacity
                activeOpacity={0.86}
                accessibilityLabel="Crear"
                onPress={() => setDropupOpen((v) => !v)}
                style={styles.fabSlot}
              >
                <View
                  style={[
                    styles.fab,
                    {
                      borderRadius: fabHeight / 2,
                      height: fabHeight,
                      width: fabWidth,
                    },
                  ]}
                >
                  <Animated.View style={{ transform: [{ rotate: rotateAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '45deg'] }) }] }}>
                    <Ionicons name="add" size={fabIconSize} color="#FFFFFF" />
                  </Animated.View>
                </View>
              </TouchableOpacity>
            ),
          }}
        />
        <Tabs.Screen
          name="ahorro"
          options={{
            title: '',
            headerShown: false,
          }}
        />
        <Tabs.Screen
          name="perfil"
          options={{
            title: '',
            headerShown: false,
          }}
        />
        <Tabs.Screen
          name="ahorros"
          options={{
            href: null,
          }}
        />
      </Tabs>

      {dropupOpen && (
        <DropupOverlay
          onClose={() => setDropupOpen(false)}
          onSelect={handleOption}
        />
      )}

      <TransactionModal
        visible={showCreate}
        initialKind="expense"
        onClose={() => setShowCreate(false)}
      />
      <BudgetCategoryModal
        visible={newCategoryOpen}
        onClose={() => setNewCategoryOpen(false)}
      />
      <SavingPlanModal
        visible={savingPlanCreateOpen}
        onClose={() => setSavingPlanCreateOpen(false)}
      />
    </>
  );
}

function DropupOverlay({
  onClose,
  onSelect,
}: {
  onClose: () => void;
  onSelect: (key: string) => void;
}) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(anim, {
      toValue: 1,
      useNativeDriver: true,
      damping: 22,
      stiffness: 320,
      mass: 0.7,
    }).start();
  }, [anim]);

  const animateClose = (then?: () => void) => {
    Animated.timing(anim, { toValue: 0, duration: 140, useNativeDriver: true }).start(() => {
      then?.();
      onClose();
    });
  };

  return (
    <Pressable style={StyleSheet.absoluteFill} onPress={() => animateClose()}>
      <View style={styles.dropupAnchor}>
        <Animated.View
          style={[
            styles.dropupCard,
            {
              opacity: anim,
              transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
            },
          ]}
        >
          <View style={styles.dropupInner}>
            {DROPUP_OPTIONS.map((opt, i) => (
              <Pressable
                key={opt.key}
                onPress={() => animateClose(() => onSelect(opt.key))}
                style={({ pressed }) => [
                  styles.dropupOption,
                  i > 0 && styles.dropupOptionBorder,
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons name={opt.icon} size={17} color={APP_COLORS.textSecondary} />
                <Text style={styles.dropupOptionText}>{opt.label}</Text>
              </Pressable>
            ))}
          </View>
        </Animated.View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  dropupAnchor: {
    bottom: 90,
    alignItems: 'center',
    justifyContent: 'flex-end',
    position: 'absolute',
    left: 0,
    right: 0,
  },
  dropupCard: {
    borderRadius: 14,
    elevation: 5,
    shadowColor: '#7E7E7E',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    width: 210,
  },
  dropupInner: {
    backgroundColor: APP_COLORS.surface,
    borderRadius: 14,
    overflow: 'hidden',
  },
  dropupOption: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  dropupOptionBorder: {
    borderTopColor: APP_COLORS.border,
    borderTopWidth: 1,
  },
  dropupOptionText: {
    color: APP_COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '500',
  },
  fab: {
    alignItems: 'center',
    backgroundColor: '#303236',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 8,
  },
  fabSlot: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    marginTop: -14,
  },
  header: {
    backgroundColor: '#FFFFFF',
  },
  headerTitle: {
    color: '#0F172A',
    fontSize: 18,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.72,
  },
  tabBar: {
    backgroundColor: '#FFFFFF',
    borderTopColor: '#FFFFFF',
    height: 78,
    paddingBottom: 12,
    paddingTop: 8,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
});
