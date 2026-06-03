import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../services/supabase';
import { ICON_COLORS, type AppTheme } from '../constants/colors';
import { useTheme } from '../contexts/ThemeContext';
import { refreshCurrentRoom, seedDemoData, useAppStore } from '../store/useAppStore';
import { CURRENCIES } from '../types';
import type { CurrencyCode } from '../types';
import { dismissKeyboardAndBlur, runAfterKeyboardDismiss } from '../utils/keyboard';
import { reportFabScroll } from '../utils/fabScroll';
import { useEntranceAnimation } from '../hooks/useEntranceAnimation';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const SYNC_COPY = {
  live:       { label: 'En vivo',    color: '#16A34A', icon: 'checkmark-circle' as IoniconName },
  connecting: { label: 'Conectando', color: '#94A3B8', icon: 'sync-circle'      as IoniconName },
  error:      { label: 'Error',      color: '#EC1147', icon: 'alert-circle'     as IoniconName },
};

function generateInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0]! + parts[1][0]!).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export default function PerfilScreen() {
  const currentUser    = useAppStore((s) => s.currentUser);
  const setCurrentUser = useAppStore((s) => s.setCurrentUser);
  const currency       = useAppStore((s) => s.currency);
  const setCurrency    = useAppStore((s) => s.setCurrency);
  const syncStatus     = useAppStore((s) => s.syncStatus);
  const users          = useAppStore((s) => s.users);
  const addUser        = useAppStore((s) => s.addUser);
  const deleteUser     = useAppStore((s) => s.deleteUser);
  const partnerForUser = useAppStore((s) => s.partnerForUser);
  const updateUserPhoto = useAppStore((s) => s.updateUserPhoto);
  const themeMode      = useAppStore((s) => s.themeMode);
  const setThemeMode   = useAppStore((s) => s.setThemeMode);

  const theme  = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const router         = useRouter();
  const insets         = useSafeAreaInsets();
  const scrollRef      = useRef<ScrollView>(null);
  const { heroAnim, contentAnim } = useEntranceAnimation({
    scrollRef,
    onResetScroll: () => reportFabScroll(0),
  });

  const [refreshing, setRefreshing]   = useState(false);
  const [uploading, setUploading]     = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName]         = useState('');
  const [colorKey, setColorKey]       = useState('indigo');
  const [newName2, setNewName2]       = useState('');
  const [colorKey2, setColorKey2]     = useState('pink');

  const user    = users[currentUser] ?? { name: currentUser, initials: '?', color: '#6B7280', bg: '#F3F4F6' };
  const sync    = SYNC_COPY[syncStatus] ?? SYNC_COPY.connecting;
  const version = Constants.expoConfig?.version ?? '1.0.0';
  const userIds = Object.keys(users ?? {});

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshCurrentRoom();
    setRefreshing(false);
  };

  const handleAddPair = async () => {
    const name1 = newName.trim();
    const name2 = newName2.trim();
    if (!name1 || !name2) return;

    const palette1 = ICON_COLORS.find((c) => c.id === colorKey)  ?? ICON_COLORS[0]!;
    const palette2 = ICON_COLORS.find((c) => c.id === colorKey2) ?? ICON_COLORS[1]!;

    const ts   = Date.now();
    const uid1 = `u_${ts}_a`;
    const uid2 = `u_${ts}_b`;
    const slug1  = name1.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const slug2  = name2.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const roomId = `${slug1}-${slug2}-main`;

    await addUser({ uid: uid1, data: { name: name1, initials: generateInitials(name1), color: palette1.color, bg: palette1.bg }, roomId, partnerId: uid2 });
    await addUser({ uid: uid2, data: { name: name2, initials: generateInitials(name2), color: palette2.color, bg: palette2.bg }, roomId, partnerId: uid1 });

    await setCurrentUser(uid1);
    setNewName('');
    setNewName2('');
    setColorKey('indigo');
    setColorKey2('pink');
    setShowAddForm(false);
  };

  const [loadingDemo, setLoadingDemo] = useState(false);

  const handleLoadTestData = () => {
    Alert.alert(
      'Crear perfil de demo',
      'Se crearán dos usuarios de prueba ("Demo" y "Pareja Demo") con gastos, ahorros y planes de ejemplo. Tus datos actuales no se modificarán.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Crear',
          onPress: () => {
            setLoadingDemo(true);
            seedDemoData().finally(() => setLoadingDemo(false));
          },
        },
      ],
    );
  };

  const handleDeleteUser = (uid: string) => {
    const target = users[uid];
    Alert.alert(
      'Eliminar usuario',
      `¿Eliminar a ${target?.name ?? uid}?\nSus movimientos quedarán guardados.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => void deleteUser(uid) },
      ],
    );
  };

  const handlePickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permiso requerido',
        'Necesito acceso a tu galería para que puedas seleccionar una foto de perfil.'
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) return;

    const localUri = result.assets[0].uri;
    setUploading(true);

    try {
      const response = await fetch(localUri);
      const blob = await response.blob();
      const fileExt = localUri.split('.').pop() || 'png';
      const fileName = `${currentUser}-${Date.now()}.${fileExt}`;

      const { error } = await supabase.storage
        .from('avatars')
        .upload(fileName, blob, {
          contentType: `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`,
          upsert: true,
        });

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);
      await updateUserPhoto(currentUser, { uri: publicUrl });
      Alert.alert('¡Éxito!', 'Foto de perfil actualizada correctamente.');
    } catch (err: any) {
      console.warn('[perfil] upload error:', err);
      await updateUserPhoto(currentUser, { uri: localUri });
      Alert.alert(
        'Foto guardada localmente',
        `No se pudo subir la foto a la nube (${err.message || 'Error de red'}).\n\nSi deseas compartirla con tu pareja en tiempo real, asegúrate de haber creado el bucket público 'avatars' en Supabase Storage.`
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.screen}
      contentContainerStyle={styles.scrollContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.textMuted} />}
      showsVerticalScrollIndicator={false}
      bounces={false}
      overScrollMode="never"
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      onScrollBeginDrag={dismissKeyboardAndBlur}
      onScroll={(event) => reportFabScroll(event.nativeEvent.contentOffset.y)}
      scrollEventThrottle={16}
    >
      {/* -- Hero ------------------------------------------------------------ */}
      <Animated.View
        style={[
          styles.hero,
          {
            paddingTop: insets.top > 0 ? insets.top + 12 : 44,
            flexDirection: 'column',
            alignItems: 'stretch',
            gap: 16,
            opacity: heroAnim,
            transform: [{ translateY: heroAnim.interpolate({ inputRange: [0, 1], outputRange: [-18, 0] }) }],
          },
        ]}
      >
        <View style={styles.heroHeaderRow}>
          <Pressable
            onPress={() => {
              if (router.canGoBack()) router.back();
              else router.replace('/(tabs)');
            }}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
            hitSlop={12}
          >
            <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
          </Pressable>
        </View>

        <View style={styles.heroContentRow}>
          <Pressable
            onPress={handlePickPhoto}
            disabled={uploading}
            style={({ pressed }) => [styles.heroAvatarContainer, pressed && styles.pressed]}
          >
            <View style={[styles.heroAvatar, { backgroundColor: user.bg }]}>
              {uploading ? (
                <ActivityIndicator size="small" color={user.color} />
              ) : user.photo ? (
                <Image source={user.photo} style={styles.heroPhoto} />
              ) : (
                <Text style={[styles.heroInitials, { color: user.color, fontSize: (user.initials?.length ?? 0) > 1 ? 22 : 28 }]}>
                  {user.initials}
                </Text>
              )}
              <View style={styles.cameraIconBadge}>
                <Ionicons name="camera" size={12} color="#FFFFFF" />
              </View>
            </View>
          </Pressable>
          <View style={styles.heroText}>
            <Text style={styles.heroName}>{user.name}</Text>
            <Text style={styles.heroSub}>Usuario activo</Text>
          </View>
        </View>
      </Animated.View>

      {/* -- Content --------------------------------------------------------- */}
      <Animated.View
        style={[
          styles.content,
          {
            opacity: contentAnim,
            transform: [{ translateY: contentAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
          },
        ]}
      >

        {/* Usuarios */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Usuarios</Text>
          <View style={styles.card}>
            {userIds.map((uid, idx) => {
              const item      = users[uid]!;
              const active    = uid === currentUser;
              const partnerId = partnerForUser[uid];
              const partner   = partnerId && partnerId !== uid ? users[partnerId] : null;
              return (
                <View key={uid}>
                  {idx > 0 && <View style={styles.divider} />}
                  <Pressable
                    onPress={() => void setCurrentUser(uid)}
                    style={({ pressed }) => [styles.userTile, pressed && styles.pressed]}
                  >
                    <View style={[styles.userAvatar, { backgroundColor: item.bg }]}>
                      {item.photo ? (
                        <Image source={item.photo} style={styles.userPhoto} />
                      ) : (
                        <Text style={[styles.userInitials, { color: item.color, fontSize: (item.initials?.length ?? 0) > 1 ? 13 : 16 }]}>
                          {item.initials}
                        </Text>
                      )}
                    </View>
                    <View style={styles.userInfo}>
                      <Text style={[styles.userName, active && { color: '#16A34A' }]}>
                        {item.name}
                      </Text>
                      {partner ? (
                        <Text style={styles.userPartner}>
                          <Ionicons name="link-outline" size={11} color={theme.textMuted} /> Vinculado con {partner.name}
                        </Text>
                      ) : active ? (
                        <Text style={styles.userActive}>Activo ahora</Text>
                      ) : null}
                    </View>
                    {active
                      ? <Ionicons name="checkmark-circle" size={22} color="#16A34A" />
                      : (
                        <Pressable
                          onPress={() => handleDeleteUser(uid)}
                          hitSlop={{ top: 10, bottom: 10, left: 12, right: 8 }}
                          style={({ pressed }) => [pressed && styles.pressed]}
                        >
                          <Ionicons name="trash-outline" size={19} color={theme.textMuted} />
                        </Pressable>
                      )
                    }
                  </Pressable>
                </View>
              );
            })}
          </View>

          {!showAddForm ? (
            <Pressable
              onPress={() => setShowAddForm(true)}
              style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]}
            >
              <Ionicons name="person-add-outline" size={17} color="#6366F1" />
              <Text style={styles.addBtnText}>Agregar usuario</Text>
            </Pressable>
          ) : (
            <View style={styles.addForm}>
              <Text style={styles.addFormTitle}>Nueva pareja</Text>

              {/* Usuario 1 */}
              <View style={styles.userSectionForm}>
                <Text style={styles.userSectionHeader}>Primer Integrante</Text>
                
                <Text style={styles.fieldLabel}>Nombre</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Ej. María"
                  placeholderTextColor={theme.textMuted}
                  value={newName}
                  onChangeText={setNewName}
                  autoFocus
                  returnKeyType="next"
                />

                <Text style={styles.fieldLabel}>Color</Text>
                <View style={styles.palette}>
                  {ICON_COLORS.map((c) => (
                    <Pressable
                      key={c.id}
                      onPress={() => setColorKey(c.id)}
                      style={[
                        styles.paletteCircle,
                        { backgroundColor: c.color },
                        colorKey === c.id && styles.paletteCircleSelected,
                      ]}
                    >
                      {colorKey === c.id ? <Ionicons name="checkmark" size={13} color="#fff" /> : null}
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Divider */}
              <View style={styles.formSectionDivider} />

              {/* Usuario 2 */}
              <View style={styles.userSectionForm}>
                <Text style={styles.userSectionHeader}>Segundo Integrante (Pareja)</Text>
                
                <Text style={styles.fieldLabel}>Nombre</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Ej. Juan"
                  placeholderTextColor={theme.textMuted}
                  value={newName2}
                  onChangeText={setNewName2}
                  returnKeyType="done"
                  onSubmitEditing={() => runAfterKeyboardDismiss(() => void handleAddPair())}
                />

                <Text style={styles.fieldLabel}>Color</Text>
                <View style={styles.palette}>
                  {ICON_COLORS.map((c) => (
                    <Pressable
                      key={c.id}
                      onPress={() => setColorKey2(c.id)}
                      style={[
                        styles.paletteCircle,
                        { backgroundColor: c.color },
                        colorKey2 === c.id && styles.paletteCircleSelected,
                      ]}
                    >
                      {colorKey2 === c.id ? <Ionicons name="checkmark" size={13} color="#fff" /> : null}
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Previews */}
              {(newName.trim().length > 0 || newName2.trim().length > 0) && (
                <View style={styles.previewsRow}>
                  {newName.trim().length > 0 && (() => {
                    const p = ICON_COLORS.find((c) => c.id === colorKey) ?? ICON_COLORS[0]!;
                    return (
                      <View style={styles.previewRow}>
                        <View style={[styles.previewAvatar, { backgroundColor: p.bg }]}>
                          <Text style={[styles.previewInitials, { color: p.color }]}>
                            {generateInitials(newName.trim())}
                          </Text>
                        </View>
                        <Text style={styles.previewName} numberOfLines={1}>{newName.trim()}</Text>
                      </View>
                    );
                  })()}
                  
                  {newName.trim().length > 0 && newName2.trim().length > 0 && (
                    <Ionicons name="heart" size={16} color="#EC1147" style={{ alignSelf: 'center' }} />
                  )}

                  {newName2.trim().length > 0 && (() => {
                    const p = ICON_COLORS.find((c) => c.id === colorKey2) ?? ICON_COLORS[1]!;
                    return (
                      <View style={styles.previewRow}>
                        <View style={[styles.previewAvatar, { backgroundColor: p.bg }]}>
                          <Text style={[styles.previewInitials, { color: p.color }]}>
                            {generateInitials(newName2.trim())}
                          </Text>
                        </View>
                        <Text style={styles.previewName} numberOfLines={1}>{newName2.trim()}</Text>
                      </View>
                    );
                  })()}
                </View>
              )}

              <View style={styles.formButtons}>
                <Pressable
                  onPress={() => runAfterKeyboardDismiss(() => {
                    setShowAddForm(false);
                    setNewName('');
                    setColorKey('indigo');
                    setNewName2('');
                    setColorKey2('pink');
                  })}
                  style={({ pressed }) => [styles.cancelBtn, pressed && styles.pressed]}
                >
                  <Text style={styles.cancelBtnText}>Cancelar</Text>
                </Pressable>
                <Pressable
                  onPress={() => runAfterKeyboardDismiss(() => void handleAddPair())}
                  disabled={!newName.trim() || !newName2.trim()}
                  style={({ pressed }) => [
                    styles.confirmBtn,
                    (!newName.trim() || !newName2.trim()) && styles.confirmBtnDisabled,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.confirmBtnText}>Agregar</Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>

        {/* Preferencias */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Preferencias</Text>
          <View style={styles.card}>
            {/* Moneda */}
            {Object.values(CURRENCIES).map((item, idx) => (
              <View key={item.code}>
                {idx > 0 && <View style={styles.divider} />}
                <Pressable
                  onPress={() => void setCurrency(item.code as CurrencyCode)}
                  style={({ pressed }) => [styles.currencyTile, pressed && styles.pressed]}
                >
                  <View style={styles.currencySymbolBox}>
                    <Text style={styles.currencySymbol}>{item.symbol}</Text>
                  </View>
                  <View style={styles.currencyInfo}>
                    <Text style={styles.currencyLabel}>{item.label}</Text>
                    <Text style={styles.currencyCode}>{item.code}</Text>
                  </View>
                  {currency === item.code
                    ? <Ionicons name="checkmark-circle" size={22} color="#16A34A" />
                    : <View style={styles.currencyCircleEmpty} />
                  }
                </Pressable>
              </View>
            ))}

            {/* Toggle de tema */}
            <View style={styles.divider} />
            <View style={styles.themeTile}>
              <Ionicons
                name={themeMode === 'light' ? 'sunny' : 'moon'}
                size={22}
                color={theme.textSecondary}
              />
              <View style={styles.themeInfo}>
                <Text style={styles.themeLabel}>
                  {themeMode === 'light' ? 'Modo claro' : 'Modo oscuro'}
                </Text>
                <Text style={styles.themeSub}>
                  {themeMode === 'light' ? 'Interfaz en colores claros' : 'Interfaz en colores oscuros'}
                </Text>
              </View>
              <Switch
                value={themeMode === 'light'}
                onValueChange={(v) => void setThemeMode(v ? 'light' : 'dark')}
                trackColor={{ false: theme.softSurface, true: '#7C3AED' }}
                thumbColor="#FFFFFF"
                ios_backgroundColor={theme.softSurface}
              />
            </View>
          </View>
        </View>

        {/* Sincronización */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Sincronización</Text>
          <View style={[styles.card, styles.syncCard]}>
            <View style={styles.syncLeft}>
              <View style={[styles.syncIconWrap, { backgroundColor: sync.color + '18' }]}>
                <Ionicons name={sync.icon} size={22} color={sync.color} />
              </View>
              <View>
                <Text style={styles.syncStatusLabel}>Estado</Text>
                <Text style={[styles.syncStatusValue, { color: sync.color }]}>{sync.label}</Text>
              </View>
            </View>
            <Pressable
              onPress={() => void handleRefresh()}
              style={({ pressed }) => [styles.refreshBtn, pressed && styles.pressed]}
            >
              <Ionicons name="refresh" size={18} color={theme.textPrimary} />
            </Pressable>
          </View>
        </View>

        {/* Acerca de */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Acerca de</Text>
          <View style={[styles.card, styles.aboutCard]}>
            <Text style={styles.aboutKey}>Versión</Text>
            <Text style={styles.aboutValue}>{version}</Text>
          </View>
        </View>

        {/* Desarrollo */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Desarrollo</Text>
          <View style={styles.card}>
            <Pressable
              onPress={() => router.push('/onboarding')}
              style={({ pressed }) => [styles.devTile, pressed && styles.pressed]}
            >
              <View style={[styles.devIconWrap, { backgroundColor: '#EDE9FE' }]}>
                <Ionicons name="sparkles-outline" size={20} color="#7C3AED" />
              </View>
              <View style={styles.devInfo}>
                <Text style={styles.devLabel}>Ver flujo de onboarding</Text>
                <Text style={styles.devSub}>Prueba las pantallas de configuración de cuenta</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
            </Pressable>

            <View style={[styles.divider, { backgroundColor: theme.border }]} />

            <Pressable
              onPress={handleLoadTestData}
              disabled={loadingDemo}
              style={({ pressed }) => [styles.devTile, (pressed || loadingDemo) && styles.pressed]}
            >
              <View style={styles.devIconWrap}>
                <Ionicons name="flask-outline" size={20} color="#D97706" />
              </View>
              <View style={styles.devInfo}>
                <Text style={styles.devLabel}>
                  {loadingDemo ? 'Creando datos…' : 'Crear perfil de demo'}
                </Text>
                <Text style={styles.devSub}>Crea usuarios de prueba con datos de ejemplo</Text>
              </View>
              {!loadingDemo && <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />}
            </Pressable>
          </View>
        </View>

      </Animated.View>
    </ScrollView>
  );
}

const makeStyles = (t: AppTheme) => StyleSheet.create({
  screen: {
    backgroundColor: t.background,
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 56,
  },
  hero: {
    alignItems: 'center',
    backgroundColor: t.surface,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    elevation: 4,
    flexDirection: 'row',
    gap: 16,
    paddingBottom: 28,
    paddingHorizontal: 28,
    paddingTop: 56,
    shadowColor: t.shadowColor,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.10,
    shadowRadius: 10,
  },
  heroAvatarContainer: {
    borderRadius: 34,
    position: 'relative',
  },
  cameraIconBadge: {
    alignItems: 'center',
    backgroundColor: '#6366F1',
    borderRadius: 10,
    bottom: -2,
    height: 20,
    justifyContent: 'center',
    position: 'absolute',
    right: -2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 4,
    width: 20,
  },
  heroAvatar: {
    alignItems: 'center',
    borderRadius: 34,
    height: 68,
    justifyContent: 'center',
    width: 68,
  },
  heroPhoto: {
    width: 68,
    height: 68,
    borderRadius: 34,
  },
  heroInitials: {
    fontWeight: '900',
  },
  heroText: {
    flex: 1,
    minWidth: 0,
  },
  heroName: {
    color: t.textPrimary,
    fontFamily: 'Poppins_700Bold',
    fontSize: 26,
    lineHeight: 32,
  },
  heroSub: {
    color: t.textMuted,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  content: {
    gap: 24,
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  section: {
    gap: 10,
  },
  sectionLabel: {
    color: t.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginLeft: 4,
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: t.surface,
    borderRadius: 18,
    overflow: 'hidden',
  },
  divider: {
    backgroundColor: t.border,
    height: StyleSheet.hairlineWidth,
    marginLeft: 64,
  },
  userTile: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  userAvatar: {
    alignItems: 'center',
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  userPhoto: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  userInitials: {
    fontWeight: '900',
  },
  userInfo: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  userName: {
    color: t.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  userActive: {
    color: '#16A34A',
    fontSize: 12,
    fontWeight: '600',
  },
  userPartner: {
    color: t.textMuted,
    fontSize: 12,
    fontWeight: '500',
  },
  addBtn: {
    alignItems: 'center',
    borderColor: '#C7D2FE',
    borderRadius: 14,
    borderStyle: 'dashed',
    borderWidth: 1.5,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    paddingVertical: 14,
  },
  addBtnText: {
    color: '#6366F1',
    fontSize: 14,
    fontWeight: '700',
  },
  addForm: {
    backgroundColor: t.surface,
    borderRadius: 18,
    gap: 14,
    padding: 18,
  },
  addFormTitle: {
    color: t.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  fieldLabel: {
    color: t.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    marginBottom: -6,
    textTransform: 'uppercase',
  },
  textInput: {
    borderColor: t.border,
    borderRadius: 12,
    borderWidth: 1,
    color: t.textPrimary,
    fontSize: 15,
    fontWeight: '600',
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: t.inputBg,
  },
  palette: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  paletteCircle: {
    alignItems: 'center',
    borderRadius: 16,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  paletteCircleSelected: {
    borderColor: t.textPrimary,
    borderWidth: 2.5,
  },
  previewsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    flexWrap: 'wrap',
    marginTop: 4,
  },
  previewRow: {
    alignItems: 'center',
    backgroundColor: t.background,
    borderColor: t.border,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flex: 1,
    minWidth: 100,
  },
  previewAvatar: {
    alignItems: 'center',
    borderRadius: 16,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  previewInitials: {
    fontSize: 12,
    fontWeight: '900',
  },
  previewName: {
    color: t.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  userSectionForm: {
    gap: 10,
  },
  userSectionHeader: {
    color: t.textPrimary,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
    opacity: 0.85,
  },
  formSectionDivider: {
    backgroundColor: t.border,
    height: 1,
    marginVertical: 4,
  },
  formButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 2,
  },
  cancelBtn: {
    alignItems: 'center',
    borderColor: t.border,
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 13,
  },
  cancelBtnText: {
    color: t.textSecondary,
    fontSize: 14,
    fontWeight: '700',
  },
  confirmBtn: {
    alignItems: 'center',
    backgroundColor: '#6366F1',
    borderRadius: 12,
    flex: 1,
    paddingVertical: 13,
  },
  confirmBtnDisabled: {
    opacity: 0.35,
  },
  confirmBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  currencyTile: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  currencySymbolBox: {
    alignItems: 'center',
    backgroundColor: t.softSurface,
    borderRadius: 10,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  currencySymbol: {
    color: t.textPrimary,
    fontSize: 16,
    fontWeight: '900',
  },
  currencyInfo: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  currencyLabel: {
    color: t.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  currencyCode: {
    color: t.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  currencyCircleEmpty: {
    borderColor: t.border,
    borderRadius: 11,
    borderWidth: 1.5,
    height: 22,
    width: 22,
  },
  themeTile: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  themeInfo: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  themeLabel: {
    color: t.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  themeSub: {
    color: t.textMuted,
    fontSize: 12,
    fontWeight: '500',
  },
  syncCard: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  syncLeft: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  syncIconWrap: {
    alignItems: 'center',
    borderRadius: 12,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  syncStatusLabel: {
    color: t.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  syncStatusValue: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 1,
  },
  refreshBtn: {
    alignItems: 'center',
    backgroundColor: t.softSurface,
    borderRadius: 12,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  aboutCard: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  aboutKey: {
    color: t.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  aboutValue: {
    color: t.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  devTile: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  devIconWrap: {
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderRadius: 10,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  devInfo: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  devLabel: {
    color: t.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  devSub: {
    color: t.textMuted,
    fontSize: 12,
    fontWeight: '500',
  },
  heroHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginLeft: -8,
  },
  heroContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  backButton: {
    alignItems: 'center',
    borderRadius: 14,
    height: 42,
    justifyContent: 'center',
    width: 42,
    backgroundColor: t.softSurface,
  },
  pressed: {
    opacity: 0.68,
  },
});
