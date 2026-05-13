import { useEffect, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import Svg, { Path } from 'react-native-svg';
import { Tabs } from 'expo-router';
import { Animated, Pressable, StyleSheet, TouchableOpacity, useWindowDimensions, View, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BudgetCategoryModal } from '../../modals/BudgetCategoryModal';
import { PlanModal } from '../../modals/PlanModal';
import { SavingPlanModal } from '../../modals/SavingPlanModal';
import { TransactionModal } from '../../modals/TransactionModal';
import { APP_COLORS } from '../../constants/colors';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const TAB_ICONS: Record<string, { active: IoniconName; inactive: IoniconName }> = {
  movimientos: { active: 'receipt', inactive: 'receipt-outline' },
  ahorro: { active: 'map', inactive: 'map-outline' },
  categorias: { active: 'pie-chart', inactive: 'pie-chart-outline' },
};

const TAB_LABELS: Record<string, string> = {
  index: 'Inicio',
  movimientos: 'Movimientos',
  ahorro: 'Planes',
  categorias: 'Categorias',
};

const TAB_ACTIVE_WIDTHS: Record<string, number> = {
  index: 88,
  movimientos: 128,
  ahorro: 96,
  categorias: 120,
};

const TAB_LABEL_WIDTHS: Record<string, number> = {
  index: 38,
  movimientos: 76,
  ahorro: 44,
  categorias: 68,
};

const HIDDEN_TAB_ROUTES = new Set(['create', 'perfil', 'ahorros']);

const DROPUP_OPTIONS: Array<{ label: string; description: string; icon: IoniconName; key: string }> = [
  { key: 'movimiento', label: 'Nuevo movimiento', description: 'Registra un ingreso o gasto en tu cuenta', icon: 'add-circle-outline' },
  { key: 'categoria', label: 'Nueva categoría', description: 'Agrupa gastos y establece un presupuesto mensual', icon: 'pie-chart-outline' },
  { key: 'plan', label: 'Nuevo plan', description: 'Organiza gastos compartidos con tu pareja', icon: 'map-outline' },
  { key: 'ahorro', label: 'Nuevo ahorro', description: 'Define una meta y sigue tu progreso de ahorro', icon: 'bookmark-outline' },
];

export default function TabLayout() {
  const [showCreate, setShowCreate] = useState(false);
  const [newCategoryOpen, setNewCategoryOpen] = useState(false);
  const [savingPlanCreateOpen, setSavingPlanCreateOpen] = useState(false);
  const [newPlanOpen, setNewPlanOpen] = useState(false);
  const [dropupOpen, setDropupOpen] = useState(false);
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

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
  const fabBottom = Math.max(insets.bottom, 12);

  const handleCreatePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setDropupOpen((v) => !v);
  };

  const handleOption = (key: string) => {
    setDropupOpen(false);
    if (key === 'movimiento') setShowCreate(true);
    else if (key === 'categoria') setNewCategoryOpen(true);
    else if (key === 'ahorro') setSavingPlanCreateOpen(true);
    else if (key === 'plan') setNewPlanOpen(true);
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
          fabBottom={fabBottom}
          fabSize={fabSize}
        />
      )}

      <View
        pointerEvents="box-none"
        style={[styles.floatingFabShadow, styles.standalonefab, {
          bottom: fabBottom,
          borderRadius: fabSize / 2,
          height: fabSize,
          width: fabSize,
        }]}
      >
        <TouchableOpacity
          activeOpacity={0.86}
          accessibilityLabel="Crear"
          onPress={handleCreatePress}
          style={[
            styles.floatingFab,
            dropupOpen && styles.floatingFabOpen,
            {
              borderRadius: fabSize / 2,
              height: fabSize,
              width: fabSize,
            },
          ]}
        >
          <BlurView intensity={34} tint="light" style={StyleSheet.absoluteFill} />
          <Animated.View style={{ transform: [{ rotate: rotateAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '45deg'] }) }] }}>
            <Ionicons name="add" size={fabIconSize} color="#111827" />
          </Animated.View>
        </TouchableOpacity>
      </View>

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
      <PlanModal
        visible={newPlanOpen}
        onClose={() => setNewPlanOpen(false)}
      />
    </>
  );
}

function DropupOverlay({
  onClose,
  onSelect,
  fabBottom,
  fabSize,
}: {
  onClose: () => void;
  onSelect: (key: string) => void;
  fabBottom: number;
  fabSize: number;
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
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: anim }]}>
        <BlurView intensity={22} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, styles.dropupScrim]} />
      </Animated.View>

      <View style={styles.dropupAnchor}>
        <Animated.View
          style={[
            styles.dropupCard,
            {
              opacity: anim,
              transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
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
                <View style={styles.dropupOptionIconWrap}>
                  <Ionicons name={opt.icon} size={26} color="#7C3AED" />
                </View>
                <View style={styles.dropupOptionContent}>
                  <Text style={styles.dropupOptionText}>{opt.label}</Text>
                  <Text style={styles.dropupOptionDesc}>{opt.description}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={APP_COLORS.textMuted} />
              </Pressable>
            ))}
          </View>
        </Animated.View>
      </View>
    </Pressable>
  );
}

function FloatingTabBar({ state, descriptors, navigation, insets }: any) {
  const visibleRoutes = state.routes.filter((route: any) => !HIDDEN_TAB_ROUTES.has(route.name));
  const bottom = Math.max(insets?.bottom ?? 0, 12);

  return (
    <View pointerEvents="box-none" style={[styles.floatingBarWrap, { bottom }]}>
      <View style={styles.tabPillShadow}>
        <View style={styles.tabPill}>
          <BlurView intensity={32} tint="light" style={StyleSheet.absoluteFill} />
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
      </View>

      {/* Spacer to reserve FAB width in the row */}
      <View style={{ height: 58, width: 58 }} />
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
  const backgroundColor = progress.interpolate({ inputRange: [0, 1], outputRange: ['rgba(255, 255, 255, 0)', '#F1F5F9'] });
  const labelWidth = progress.interpolate({ inputRange: [0, 1], outputRange: [0, activeLabelWidth] });
  const labelMarginLeft = progress.interpolate({ inputRange: [0, 1], outputRange: [0, 6] });
  const labelOpacity = progress.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0, 0, 1] });
  const iconColor = focused ? '#111827' : '#7B8491';

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
            <HomeMinimalIcon color={iconColor} filled={focused} />
          ) : icons ? (
            <Ionicons
              name={focused ? icons.active : icons.inactive}
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


function HomeMinimalIcon({ color, filled = false }: { color: string; filled?: boolean }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 10.5L12 3l9 7.5V21a1 1 0 0 1-1 1H15v-5h-6v5H4a1 1 0 0 1-1-1V10.5z"
        fill={filled ? color : 'none'}
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
    bottom: 96,
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    position: 'absolute',
    right: 18,
  },
  dropupCard: {
    borderRadius: 20,
    elevation: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.28,
    shadowRadius: 24,
    width: 300,
  },
  dropupInner: {
    backgroundColor: APP_COLORS.surface,
    borderRadius: 20,
    overflow: 'hidden',
  },
  dropupOption: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  dropupOptionBorder: {
    borderTopColor: APP_COLORS.border,
    borderTopWidth: 1,
  },
  dropupOptionContent: {
    flex: 1,
    gap: 3,
  },
  dropupOptionDesc: {
    color: APP_COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '400',
  },
  dropupOptionIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
  },
  dropupOptionText: {
    color: APP_COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  dropupScrim: {
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
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
    gap: 16,
    justifyContent: 'center',
    left: 14,
    position: 'absolute',
    right: 14,
  },
  floatingFab: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.76)',
    borderColor: 'rgba(255, 255, 255, 0.88)',
    borderWidth: 1,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  floatingFabOpen: {
    backgroundColor: 'rgba(241, 245, 249, 0.9)',
  },
  floatingFabShadow: {
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
    elevation: 6,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
  },
  standalonefab: {
    position: 'absolute',
    right: 22,
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
    paddingHorizontal: 7,
  },
  tabIconBox: {
    alignItems: 'center',
    borderRadius: 15,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  tabItemLabel: {
    color: '#111827',
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '600',
  },
  tabPill: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.76)',
    borderColor: 'rgba(255, 255, 255, 0.88)',
    borderWidth: 1,
    borderRadius: 29,
    flex: 1,
    flexDirection: 'row',
    gap: 2,
    height: 58,
    justifyContent: 'space-between',
    overflow: 'hidden',
    paddingHorizontal: 8,
  },
  tabPillShadow: {
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
    borderRadius: 29,
    elevation: 6,
    flex: 1,
    height: 58,
    maxWidth: 390,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
  },

});
