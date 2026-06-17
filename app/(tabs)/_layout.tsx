import { useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import Svg, { Path } from 'react-native-svg';
import { Tabs } from 'expo-router';
import { ExpoSpeechRecognitionModule, isSpeechRecognitionSupported, useSpeechRecognitionEvent } from '../../utils/speechRecognitionCompat';
import { Alert, Animated, Easing, Linking, Pressable, StyleSheet, TouchableOpacity, useWindowDimensions, View, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BudgetCategoryModal } from '../../modals/BudgetCategoryModal';
import { PlanModal } from '../../modals/PlanModal';
import { SavingPlanModal } from '../../modals/SavingPlanModal';
import { TransactionModal } from '../../modals/TransactionModal';
import { useTheme } from '../../contexts/ThemeContext';
import type { AppTheme } from '../../constants/colors';
import { useAppStore } from '../../store/useAppStore';
import type { BudgetCategory, Plan, SavingPlan, Transaction } from '../../types';
import {
  buildVoiceActionRecord,
  getVoiceActionReady,
  getVoiceContextualStrings,
  parseVoiceAction,
  type ParsedVoiceAction,
} from '../../utils/voiceActions';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const TAB_ICONS: Record<string, { active: IoniconName; inactive: IoniconName }> = {
  movimientos: { active: 'receipt', inactive: 'receipt-outline' },
  extras: { active: 'grid', inactive: 'grid-outline' },
  categorias: { active: 'pie-chart', inactive: 'pie-chart-outline' },
};

const TAB_LABELS: Record<string, string> = {
  index: 'Inicio',
  movimientos: 'Movimientos',
  extras: 'Extras',
  categorias: 'Categorías',
};

const TAB_ITEM_WIDTHS: Record<string, number> = {
  index: 52,
  movimientos: 74,
  extras: 56,
  categorias: 68,
};

const HIDDEN_TAB_ROUTES = new Set(['create', 'perfil']);
const TAB_SLIDE_DURATION_MS = 260;

const DROPUP_OPTIONS: Array<{ label: string; description: string; icon: IoniconName; key: string }> = [
  { key: 'movimiento', label: 'Nuevo movimiento', description: 'Registra un ingreso o gasto en tu cuenta', icon: 'add-circle-outline' },
  { key: 'categoria', label: 'Nueva categoría', description: 'Agrupa gastos y establece un presupuesto mensual', icon: 'pie-chart-outline' },
  { key: 'ahorro', label: 'Nuevo ahorro', description: 'Define una meta y sigue tu progreso de ahorro', icon: 'wallet-outline' },
  { key: 'plan', label: 'Nuevo plan', description: 'Organiza gastos compartidos con tu pareja o amigos', icon: 'map-outline' },
];

const OPTION_THEMES: Record<string, { bg: string; iconColor: string }> = {
  movimiento: { bg: '#00D158', iconColor: '#FFFFFF' },
  categoria: { bg: '#EC1147', iconColor: '#FFFFFF' },
  ahorro: { bg: '#7C3AED', iconColor: '#FFFFFF' },
  plan: { bg: '#2563EB', iconColor: '#FFFFFF' },
};

export default function TabLayout() {
  const [showCreate, setShowCreate] = useState(false);
  const [newCategoryOpen, setNewCategoryOpen] = useState(false);
  const [savingPlanCreateOpen, setSavingPlanCreateOpen] = useState(false);
  const [newPlanOpen, setNewPlanOpen] = useState(false);
  const [dropupOpen, setDropupOpen] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const [voiceListening, setVoiceListening] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [voiceError, setVoiceError] = useState('');
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const voiceTranscriptRef = useRef('');
  const voiceActiveRef = useRef(false);
  const ignoreNextPressRef = useRef(false);
  const [showVoiceHint, setShowVoiceHint] = useState(false);
  const voiceHintAnim = useRef(new Animated.Value(0)).current;
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const payload = useAppStore((s) => s.payload);
  const currentUser = useAppStore((s) => s.currentUser);
  const users = useAppStore((s) => s.users);
  const partnerForUser = useAppStore((s) => s.partnerForUser);
  const addTransaction = useAppStore((s) => s.addTransaction);
  const addBudgetCategory = useAppStore((s) => s.addBudgetCategory);
  const addSavingPlan = useAppStore((s) => s.addSavingPlan);
  const addPlan = useAppStore((s) => s.addPlan);

  useEffect(() => {
    if (isSpeechRecognitionSupported) {
      ExpoSpeechRecognitionModule.requestPermissionsAsync().catch(() => { });
    }
  }, []);

  const voiceContext = useMemo(() => ({
    payload,
    currentUser,
    users,
    partnerForUser,
  }), [currentUser, partnerForUser, payload, users]);

  const parsedVoiceAction = useMemo(
    () => voiceTranscript.trim() ? parseVoiceAction(voiceTranscript, voiceContext) : null,
    [voiceContext, voiceTranscript],
  );

  useEffect(() => {
    Animated.spring(rotateAnim, {
      toValue: dropupOpen && !voiceMode ? 1 : 0,
      useNativeDriver: true,
      damping: 18,
      stiffness: 260,
      mass: 0.6,
    }).start();
  }, [dropupOpen, rotateAnim, voiceMode]);

  useSpeechRecognitionEvent('start', () => {
    setVoiceListening(true);
    setVoiceError('');
  });

  useSpeechRecognitionEvent('end', () => {
    setVoiceListening(false);
  });

  useSpeechRecognitionEvent('result', (event) => {
    const nextTranscript = event.results[0]?.transcript?.trim() ?? '';
    if (!nextTranscript) return;
    voiceTranscriptRef.current = nextTranscript;
    setVoiceTranscript(nextTranscript);
  });

  useSpeechRecognitionEvent('error', (event) => {
    setVoiceListening(false);
    setVoiceError(event.message || event.error);
  });

  const fabSize = 58;
  const fabIconSize = width < 360 ? 25 : 28;
  const tabBottom = Math.max(insets.bottom, 12);
  const fabBottom = tabBottom + 2;

  const dismissVoiceHint = () => {
    Animated.timing(voiceHintAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
      setShowVoiceHint(false);
    });
    void AsyncStorage.setItem('nosotros_hint_voice_seen', '1');
  };

  useEffect(() => {
    AsyncStorage.getItem('nosotros_hint_voice_seen').then((v) => {
      if (v !== '1') {
        const showTimer = setTimeout(() => {
          setShowVoiceHint(true);
          Animated.spring(voiceHintAnim, {
            toValue: 1, useNativeDriver: true, damping: 18, stiffness: 220,
          }).start();
        }, 1500);
        const hideTimer = setTimeout(() => dismissVoiceHint(), 7500);
        return () => { clearTimeout(showTimer); clearTimeout(hideTimer); };
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreatePress = () => {
    dismissVoiceHint();
    if (ignoreNextPressRef.current) {
      ignoreNextPressRef.current = false;
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setDropupOpen((v) => !v);
  };

  const startVoiceAction = async () => {
    dismissVoiceHint();
    ignoreNextPressRef.current = true;
    voiceActiveRef.current = true;
    voiceTranscriptRef.current = '';
    setVoiceTranscript('');
    setVoiceError('');
    setVoiceMode(true);
    setDropupOpen(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    try {
      const permissions = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!permissions.granted) {
        const canAskAgain = 'canAskAgain' in permissions ? Boolean(permissions.canAskAgain) : true;
        voiceActiveRef.current = false;
        setVoiceMode(false);
        setVoiceListening(false);
        setTimeout(() => { ignoreNextPressRef.current = false; }, 350);
        if (!canAskAgain) {
          Alert.alert(
            'Permiso de micrófono bloqueado',
            'Para usar la voz ve a Ajustes y activa el micrófono para Juntos.',
            [
              { text: 'Cancelar', style: 'cancel' },
              { text: 'Abrir Ajustes', onPress: () => Linking.openSettings() },
            ],
          );
        } else {
          Alert.alert('Permiso requerido', 'Necesito permiso de micrófono y reconocimiento de voz para crear con el botón +.');
        }
        return;
      }

      if (!voiceActiveRef.current) return;

      if (!ExpoSpeechRecognitionModule.isRecognitionAvailable()) {
        voiceActiveRef.current = false;
        setVoiceMode(false);
        setVoiceListening(false);
        setTimeout(() => { ignoreNextPressRef.current = false; }, 350);
        Alert.alert('Voz no disponible', 'El reconocimiento de voz no está disponible en este dispositivo.');
        return;
      }

      if (!voiceActiveRef.current) return;

      ExpoSpeechRecognitionModule.start({
        lang: 'es-ES',
        interimResults: true,
        continuous: false,
        maxAlternatives: 3,
        contextualStrings: getVoiceContextualStrings(voiceContext),
      });
    } catch (err) {
      voiceActiveRef.current = false;
      setVoiceMode(false);
      setVoiceListening(false);
      setVoiceError(err instanceof Error ? err.message : 'No pude iniciar la voz.');
      setTimeout(() => { ignoreNextPressRef.current = false; }, 350);
      Alert.alert('No pude escuchar', 'Revisa los permisos de voz y vuelve a intentarlo.');
    }
  };

  const stopVoiceAction = () => {
    if (!voiceActiveRef.current) return;
    voiceActiveRef.current = false;
    setVoiceListening(false);
    ExpoSpeechRecognitionModule.stop();
    setTimeout(() => finishVoiceAction(voiceTranscriptRef.current), 420);
  };

  const finishVoiceAction = (transcript: string) => {
    ignoreNextPressRef.current = false;
    setVoiceMode(false);
    setDropupOpen(false);

    if (!transcript.trim()) {
      Alert.alert(
        'No escuché nada claro',
        'Prueba con frases como "gasté 25 en supermercado" o "quiero ahorrar 500 para vacaciones".',
      );
      return;
    }

    const parsed = parseVoiceAction(transcript, voiceContext);
    if (!getVoiceActionReady(parsed)) {
      Alert.alert(
        'Me faltó contexto',
        `${parsed.summary}. Faltante: ${parsed.missing.join(', ')}.\n\nEjemplos: "gasté 25 en comida", "crea categoría viajes con presupuesto 300", "crear plan playa con Gabi".`,
      );
      return;
    }

    const record = buildVoiceActionRecord(parsed, voiceContext);
    if (!record) return;

    if (parsed.type === 'transaction') addTransaction(record as Transaction);
    else if (parsed.type === 'budgetCategory') addBudgetCategory(record as BudgetCategory);
    else if (parsed.type === 'savingPlan') addSavingPlan(record as SavingPlan);
    else if (parsed.type === 'plan') addPlan(record as Plan);

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Creado por voz', parsed.summary);
  };

  const handleOption = (key: string) => {
    setDropupOpen(false);
    if (key === 'movimiento') setShowCreate(true);
    else if (key === 'categoria') setNewCategoryOpen(true);
    else if (key === 'ahorro') setSavingPlanCreateOpen(true);
    else if (key === 'plan') setNewPlanOpen(true);
  };

  const blurTint = theme.mode === 'light' ? 'light' : 'dark';
  const tabSceneWidth = Math.max(width, 1);
  const tabSceneStyleInterpolator = useMemo(() => {
    return ({ current }: { current: { progress: Animated.Value } }) => ({
      sceneStyle: {
        transform: [
          {
            translateX: current.progress.interpolate({
              inputRange: [-1, 0, 1],
              outputRange: [-tabSceneWidth, 0, tabSceneWidth],
            }),
          },
        ],
      },
    });
  }, [tabSceneWidth]);

  return (
    <>
      <Tabs
        detachInactiveScreens={false}
        screenOptions={({ route }) => ({
          tabBarActiveTintColor: theme.textPrimary,
          tabBarInactiveTintColor: theme.textMuted,
          tabBarStyle: styles.tabBar,
          tabBarLabelStyle: styles.tabLabel,
          tabBarShowLabel: false,
          headerStyle: styles.header,
          headerShadowVisible: false,
          headerTitleStyle: styles.headerTitle,
          sceneStyleInterpolator: tabSceneStyleInterpolator,
          transitionSpec: {
            animation: 'timing',
            config: {
              duration: TAB_SLIDE_DURATION_MS,
              easing: Easing.out(Easing.cubic),
            },
          },
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
            blurTint={blurTint}
          />
        )}
      >
        <Tabs.Screen name="index" options={{ title: 'Home', headerShown: false }} />
        <Tabs.Screen name="movimientos" options={{ title: 'Movimientos', headerShown: false }} />
        <Tabs.Screen name="categorias" options={{ title: 'Categorías', headerShown: false }} />
        <Tabs.Screen name="extras" options={{ title: 'Extras', headerShown: false }} />
        <Tabs.Screen name="perfil" options={{ href: null, headerShown: false }} />
        <Tabs.Screen name="create" options={{ title: '', headerShown: false }} />
      </Tabs>

      {dropupOpen && (
        <DropupOverlay
          onClose={() => setDropupOpen(false)}
          onSelect={handleOption}
          fabBottom={fabBottom}
          fabSize={fabSize}
          voiceMode={voiceMode}
          voiceListening={voiceListening}
          voiceTranscript={voiceTranscript}
          voiceError={voiceError}
          parsedVoiceAction={parsedVoiceAction}
          blurTint={blurTint}
        />
      )}

      <Animated.View
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
          accessibilityLabel={voiceMode ? 'Grabando acción por voz' : 'Crear'}
          onPress={handleCreatePress}
          onLongPress={startVoiceAction}
          onPressOut={stopVoiceAction}
          delayLongPress={280}
          style={[
            styles.floatingFab,
            dropupOpen && styles.floatingFabOpen,
            voiceMode && styles.floatingFabRecording,
            {
              borderRadius: fabSize / 2,
              height: fabSize,
              width: fabSize,
            },
          ]}
        >
          <BlurView intensity={42} tint={blurTint} style={StyleSheet.absoluteFill} />
          {voiceMode ? (
            <View style={styles.recordingIconOuter}>
              <View style={styles.recordingIconInner} />
            </View>
          ) : (
            <Animated.View style={{ transform: [{ rotate: rotateAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '45deg'] }) }] }}>
              <Ionicons name="add" size={fabIconSize} color={theme.textPrimary} />
            </Animated.View>
          )}
        </TouchableOpacity>
      </Animated.View>

      <TransactionModal visible={showCreate} initialKind="expense" onClose={() => setShowCreate(false)} />
      <BudgetCategoryModal visible={newCategoryOpen} onClose={() => setNewCategoryOpen(false)} />
      <SavingPlanModal visible={savingPlanCreateOpen} onClose={() => setSavingPlanCreateOpen(false)} />
      <PlanModal visible={newPlanOpen} onClose={() => setNewPlanOpen(false)} />

      {showVoiceHint && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.voiceHintBubble,
            {
              bottom: fabBottom + fabSize + 12,
              right: 14,
              opacity: voiceHintAnim,
              transform: [{ scale: voiceHintAnim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }],
            },
          ]}
        >
          <View style={styles.voiceHintInner}>
            <Ionicons name="mic-outline" size={14} color="#7C3AED" />
            <Text style={styles.voiceHintText}>Mantén pulsado para crear con voz</Text>
          </View>
          <View style={styles.voiceHintArrow} />
        </Animated.View>
      )}
    </>
  );
}

function DropupOverlay({
  onClose,
  onSelect,
  fabBottom,
  fabSize,
  voiceMode = false,
  voiceListening = false,
  voiceTranscript = '',
  voiceError = '',
  parsedVoiceAction = null,
  blurTint,
}: {
  onClose: () => void;
  onSelect: (key: string) => void;
  fabBottom: number;
  fabSize: number;
  voiceMode?: boolean;
  voiceListening?: boolean;
  voiceTranscript?: string;
  voiceError?: string;
  parsedVoiceAction?: ParsedVoiceAction | null;
  blurTint: 'dark' | 'light';
}) {
  const anim = useRef(new Animated.Value(0)).current;
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

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
    <Pressable style={StyleSheet.absoluteFill} onPress={() => !voiceMode && animateClose()}>
      {!voiceMode && (
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: anim }]}>
          <BlurView intensity={22} tint={blurTint} style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, styles.dropupScrim]} />
        </Animated.View>
      )}

      <View style={[styles.dropupAnchor, { bottom: fabBottom + fabSize + 18 }]}>
        {voiceMode && (
          <Animated.View
            style={[
              styles.voiceCard,
              {
                opacity: anim,
                transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
              },
            ]}
          >
            <View style={styles.voiceHeader}>
              <View style={[styles.voicePulse, voiceListening && styles.voicePulseActive]} />
              <Text style={styles.voiceTitle}>{voiceListening ? 'Escuchando' : 'Procesando voz'}</Text>
            </View>
            <Text style={styles.voiceTranscript} numberOfLines={2}>
              {voiceTranscript || 'Mantén presionado y di el movimiento, ahorro, plan o categoría.'}
            </Text>
            <Text style={styles.voiceHint} numberOfLines={2}>
              {voiceError || parsedVoiceAction?.summary || 'Ej. gaste 25 en supermercado hoy'}
            </Text>
          </Animated.View>
        )}
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
            {DROPUP_OPTIONS.map((opt, i) => {
              const optTheme = OPTION_THEMES[opt.key] || { bg: 'rgba(124, 58, 237, 0.16)', iconColor: '#7C3AED' };
              return (
                <Pressable
                  key={opt.key}
                  onPress={() => animateClose(() => onSelect(opt.key))}
                  style={({ pressed }) => [
                    styles.dropupOption,
                    i > 0 && styles.dropupOptionBorder,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={[styles.dropupOptionIconWrap, { backgroundColor: optTheme.bg }]}>
                    <Ionicons name={opt.icon} size={22} color={optTheme.iconColor} />
                  </View>
                  <View style={styles.dropupOptionContent}>
                    <Text style={styles.dropupOptionText}>{opt.label}</Text>
                    <Text style={styles.dropupOptionDesc}>{opt.description}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
                </Pressable>
              );
            })}
          </View>
        </Animated.View>
      </View>
    </Pressable>
  );
}

function FloatingTabBar({ state, descriptors, navigation, insets, blurTint }: any) {
  const visibleRoutes = state.routes.filter((route: any) => !HIDDEN_TAB_ROUTES.has(route.name));
  const tabOrder = ['index', 'movimientos', 'categorias', 'extras'];
  const sortedVisibleRoutes = [...visibleRoutes].sort((a: any, b: any) => {
    return tabOrder.indexOf(a.name) - tabOrder.indexOf(b.name);
  });
  const bottom = Math.max(insets?.bottom ?? 0, 12);
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <View pointerEvents="box-none" style={[styles.floatingBarWrap, { bottom }]}>
      <View style={styles.tabPillShadow}>
        <View style={styles.tabPill}>
          <BlurView intensity={42} tint={blurTint} style={StyleSheet.absoluteFill} />
          {sortedVisibleRoutes.map((route: any) => {
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
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const itemWidth = TAB_ITEM_WIDTHS[routeName] ?? 62;
  const iconColor = focused ? theme.textPrimary : theme.textMuted;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={focused ? { selected: true } : {}}
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [pressed && styles.pressed]}
    >
      <Animated.View style={[styles.tabItem, { width: itemWidth }]}>
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
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.86} style={[styles.tabItemLabel, { color: iconColor }]}>
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

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

const makeStyles = (t: AppTheme) => StyleSheet.create({
  dropupAnchor: {
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    position: 'absolute',
    right: 18,
    gap: 10,
  },
  dropupCard: {
    borderRadius: 20,
    elevation: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.48,
    shadowRadius: 30,
    width: 300,
  },
  dropupInner: {
    backgroundColor: t.surface,
    borderColor: t.border,
    borderWidth: 1,
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
    borderTopColor: t.border,
    borderTopWidth: 1,
  },
  dropupOptionContent: {
    flex: 1,
    gap: 3,
  },
  dropupOptionDesc: {
    color: t.textSecondary,
    fontSize: 12,
    fontWeight: '400',
  },
  dropupOptionIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
    height: 40,
    borderRadius: 16,
  },
  dropupOptionText: {
    color: t.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  dropupScrim: {
    backgroundColor: t.mode === 'light' ? 'rgba(0, 0, 0, 0.18)' : 'rgba(0, 0, 0, 0.28)',
  },
  fab: {
    alignItems: 'center',
    backgroundColor: t.surface,
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
    justifyContent: 'center',
    left: 14,
    position: 'absolute',
    right: 88,
  },
  floatingFab: {
    alignItems: 'center',
    backgroundColor: t.mode === 'light' ? 'rgba(248, 248, 251, 0.90)' : 'rgba(38, 45, 51, 0.82)',
    borderColor: t.mode === 'light' ? 'rgba(0, 0, 0, 0.14)' : 'rgba(255, 255, 255, 0.22)',
    borderWidth: 1,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  floatingFabOpen: {
    backgroundColor: t.mode === 'light' ? 'rgba(226, 232, 240, 0.94)' : 'rgba(255, 255, 255, 0.24)',
  },
  floatingFabRecording: {
    backgroundColor: 'rgba(254, 226, 226, 0.94)',
    borderColor: 'rgba(248, 113, 113, 0.72)',
  },
  floatingFabShadow: {
    backgroundColor: 'rgba(0, 0, 0, 0.01)',
    elevation: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 20,
  },
  standalonefab: {
    position: 'absolute',
    right: 14,
  },
  header: {
    backgroundColor: t.surface,
  },
  headerTitle: {
    color: t.textPrimary,
    fontSize: 18,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.72,
  },
  recordingIconInner: {
    backgroundColor: '#DC2626',
    borderRadius: 8,
    height: 16,
    width: 16,
  },
  recordingIconOuter: {
    alignItems: 'center',
    borderColor: '#DC2626',
    borderRadius: 16,
    borderWidth: 2,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  tabBar: {
    backgroundColor: t.surface,
    borderTopColor: t.border,
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
    height: 52,
    justifyContent: 'center',
    paddingHorizontal: 5,
    paddingVertical: 5,
  },
  tabIconBox: {
    alignItems: 'center',
    borderRadius: 15,
    height: 24,
    justifyContent: 'center',
    width: 30,
  },
  tabItemLabel: {
    fontSize: 9.5,
    fontWeight: '600',
    lineHeight: 12,
    marginTop: 3,
    textAlign: 'center',
    width: '100%',
  },
  tabPill: {
    alignItems: 'center',
    backgroundColor: t.mode === 'light' ? 'rgba(248, 248, 251, 0.90)' : 'rgba(38, 45, 51, 0.82)',
    borderColor: t.mode === 'light' ? 'rgba(0, 0, 0, 0.13)' : 'rgba(255, 255, 255, 0.22)',
    borderWidth: 1,
    borderRadius: 33,
    flex: 1,
    flexDirection: 'row',
    gap: 2,
    height: 62,
    justifyContent: 'space-between',
    overflow: 'hidden',
    paddingHorizontal: 8,
  },
  tabPillShadow: {
    backgroundColor: 'rgba(0, 0, 0, 0.01)',
    borderRadius: 33,
    elevation: 12,
    flex: 1,
    height: 62,
    maxWidth: 430,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 20,
  },
  voiceCard: {
    backgroundColor: t.mode === 'light' ? 'rgba(255, 255, 255, 0.97)' : 'rgba(255, 255, 255, 0.94)',
    borderColor: t.mode === 'light' ? 'rgba(0, 0, 0, 0.10)' : 'rgba(226, 232, 240, 0.92)',
    borderRadius: 16,
    borderWidth: 1,
    elevation: 10,
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 18,
    width: 300,
  },
  voiceHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  voiceHint: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },
  voicePulse: {
    backgroundColor: '#94A3B8',
    borderRadius: 5,
    height: 10,
    width: 10,
  },
  voicePulseActive: {
    backgroundColor: '#DC2626',
  },
  voiceTitle: {
    color: '#0F172A',
    fontSize: 13,
    fontWeight: '800',
  },
  voiceTranscript: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 19,
  },
  voiceHintBubble: {
    position: 'absolute',
    alignItems: 'flex-end',
  },
  voiceHintInner: {
    alignItems: 'center',
    backgroundColor: t.surface,
    borderColor: t.border,
    borderRadius: 12,
    borderWidth: 1,
    elevation: 8,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 12,
  },
  voiceHintText: {
    color: t.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  voiceHintArrow: {
    borderLeftColor: 'transparent',
    borderLeftWidth: 7,
    borderRightColor: 'transparent',
    borderRightWidth: 7,
    borderTopColor: t.border,
    borderTopWidth: 7,
    marginRight: 20,
  },
});
