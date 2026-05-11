import { useEffect, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import { Tabs } from 'expo-router';
import { Animated, Pressable, StyleSheet, TouchableOpacity, useWindowDimensions, View, Text } from 'react-native';
import { BudgetCategoryModal } from '../../modals/BudgetCategoryModal';
import { SavingPlanModal } from '../../modals/SavingPlanModal';
import { TransactionModal } from '../../modals/TransactionModal';
import { APP_COLORS } from '../../constants/colors';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const TAB_ICONS: Record<string, { active: IoniconName; inactive: IoniconName }> = {
  movimientos: { active: 'receipt-outline', inactive: 'receipt-outline' },
  ahorro: { active: 'bookmark-outline', inactive: 'bookmark-outline' },
  categorias: { active: 'pie-chart-outline', inactive: 'pie-chart-outline' },
};

const TAB_LABELS: Record<string, string> = {
  index: 'Inicio',
  movimientos: 'Movimientos',
  ahorro: 'Ahorro',
  categorias: 'Categorias',
};

const TAB_ACTIVE_WIDTHS: Record<string, number> = {
  index: 84,
  movimientos: 120,
  ahorro: 90,
  categorias: 112,
};

const TAB_LABEL_WIDTHS: Record<string, number> = {
  index: 38,
  movimientos: 76,
  ahorro: 44,
  categorias: 68,
};

const HIDDEN_TAB_ROUTES = new Set(['create', 'perfil', 'ahorros']);

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
  const fabSize = 58;
  const fabIconSize = width < 360 ? 25 : 28;

  const handleOption = (key: string) => {
    setDropupOpen(false);
    if (key === 'movimiento') setShowCreate(true);
    else if (key === 'categoria') setNewCategoryOpen(true);
    else if (key === 'ahorro') setSavingPlanCreateOpen(true);
  };

  return (
    <>
      <Tabs
        detachInactiveScreens={false}
        screenOptions={({ route }) => ({
          tabBarActiveTintColor: '#303236',
          tabBarInactiveTintColor: '#B3B5B8',
          tabBarStyle: styles.tabBar,
          tabBarLabelStyle: styles.tabLabel,
          tabBarShowLabel: false,
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
        tabBar={(props) => (
          <FloatingTabBar
            {...props}
            createOpen={dropupOpen}
            fabIconSize={fabIconSize}
            fabSize={fabSize}
            onCreatePress={() => setDropupOpen((v) => !v)}
            rotateAnim={rotateAnim}
          />
        )}
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
            title: 'Movimientos',
            headerShown: false,
          }}
        />
        <Tabs.Screen
          name="create"
          options={{
            title: '',
            headerShown: false,
          }}
        />
        <Tabs.Screen
          name="ahorro"
          options={{
            title: 'Ahorro',
            headerShown: false,
          }}
        />
        <Tabs.Screen
          name="categorias"
          options={{
            title: 'Categorias',
            headerShown: false,
          }}
        />
        <Tabs.Screen
          name="perfil"
          options={{
            href: null,
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

function FloatingTabBar({
  state,
  descriptors,
  navigation,
  insets,
  createOpen,
  fabIconSize,
  fabSize,
  onCreatePress,
  rotateAnim,
}: any) {
  const visibleRoutes = state.routes.filter((route: any) => !HIDDEN_TAB_ROUTES.has(route.name));
  const bottom = Math.max(insets?.bottom ?? 0, 12);

  return (
    <View pointerEvents="box-none" style={[styles.floatingBarWrap, { bottom }]}>
      <View style={styles.tabPill}>
        {visibleRoutes.map((route: any) => {
          const routeIndex = state.routes.findIndex((item: any) => item.key === route.key);
          const focused = state.index === routeIndex;
          const icons = TAB_ICONS[route.name];
          const descriptor = descriptors[route.key];
          const label = TAB_LABELS[route.name] ?? descriptor?.options?.title ?? route.name;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          return (
            <FloatingTabItem
              key={route.key}
              accessibilityLabel={descriptor?.options?.tabBarAccessibilityLabel ?? label}
              focused={focused}
              icons={icons}
              label={label}
              onPress={onPress}
              routeName={route.name}
            />
          );
        })}
      </View>

      <TouchableOpacity
        activeOpacity={0.86}
        accessibilityLabel="Crear"
        onPress={onCreatePress}
        style={[
          styles.floatingFab,
          createOpen && styles.floatingFabOpen,
          {
            borderRadius: fabSize / 2,
            height: fabSize,
            width: fabSize,
          },
        ]}
      >
        <Animated.View style={{ transform: [{ rotate: rotateAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '45deg'] }) }] }}>
          <Ionicons name="add" size={fabIconSize} color={createOpen ? '#111827' : '#FFFFFF'} />
        </Animated.View>
      </TouchableOpacity>
    </View>
  );
}

function FloatingTabItem({
  accessibilityLabel,
  focused,
  icons,
  label,
  onPress,
  routeName,
}: {
  accessibilityLabel: string;
  focused: boolean;
  icons?: { active: IoniconName; inactive: IoniconName };
  label: string;
  onPress: () => void;
  routeName: string;
}) {
  const progress = useRef(new Animated.Value(focused ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: focused ? 1 : 0,
      duration: 230,
      easing: focused ? EASE_OUT_CUBIC : EASE_IN_OUT_CUBIC,
      useNativeDriver: false,
    }).start();
  }, [focused, progress]);

  const activeWidth = TAB_ACTIVE_WIDTHS[routeName] ?? 112;
  const activeLabelWidth = TAB_LABEL_WIDTHS[routeName] ?? 68;
  const width = progress.interpolate({ inputRange: [0, 1], outputRange: [44, activeWidth] });
  const backgroundColor = progress.interpolate({ inputRange: [0, 1], outputRange: ['#252A32', '#FFFFFF'] });
  const labelWidth = progress.interpolate({ inputRange: [0, 1], outputRange: [0, activeLabelWidth] });
  const labelMarginLeft = progress.interpolate({ inputRange: [0, 1], outputRange: [0, 6] });
  const labelOpacity = progress.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0, 0, 1] });
  const iconColor = focused ? '#111827' : '#D3D8E0';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={focused ? { selected: true } : {}}
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [pressed && styles.pressed]}
    >
      <Animated.View style={[styles.tabItem, { backgroundColor, width }]}>
        <View style={styles.tabIconBox}>
          {routeName === 'index' ? (
            <HomeMinimalIcon color={iconColor} />
          ) : icons ? (
            <Ionicons
              name={icons.inactive}
              size={21}
              color={iconColor}
            />
          ) : null}
        </View>
        <Animated.View style={{ marginLeft: labelMarginLeft, opacity: labelOpacity, overflow: 'hidden', width: labelWidth }}>
          <Text numberOfLines={1} style={styles.tabItemLabel}>{label}</Text>
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

const EASE_OUT_CUBIC = (value: number) => 1 - Math.pow(1 - value, 3);
const EASE_IN_OUT_CUBIC = (value: number) => (
  value < 0.5 ? 4 * value * value * value : 1 - Math.pow(-2 * value + 2, 3) / 2
);


function HomeMinimalIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 10.5L12 3l9 7.5V21a1 1 0 0 1-1 1H15v-5h-6v5H4a1 1 0 0 1-1-1V10.5z"
        fill="none"
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  dropupAnchor: {
    bottom: 92,
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    position: 'absolute',
    right: 18,
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
    backgroundColor: '#252A32',
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
  floatingBarWrap: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    left: 14,
    position: 'absolute',
    right: 14,
  },
  floatingFab: {
    alignItems: 'center',
    backgroundColor: '#252A32',
    elevation: 8,
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
  },
  floatingFabOpen: {
    backgroundColor: '#FFFFFF',
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
  tabItem: {
    alignItems: 'center',
    borderRadius: 22,
    flexDirection: 'row',
    height: 44,
    justifyContent: 'center',
    paddingHorizontal: 9,
  },
  tabIconBox: {
    alignItems: 'center',
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  tabItemLabel: {
    color: '#111827',
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '600',
  },
  tabPill: {
    alignItems: 'center',
    backgroundColor: '#252A32',
    borderRadius: 29,
    elevation: 8,
    flex: 1,
    flexDirection: 'row',
    gap: 2,
    height: 58,
    justifyContent: 'space-between',
    maxWidth: 390,
    paddingHorizontal: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 14,
  },

});
