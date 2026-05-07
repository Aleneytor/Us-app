import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useState } from 'react';
import type { ReactNode } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { APP_COLORS } from '../../constants/colors';
import { refreshCurrentRoom, useAppStore } from '../../store/useAppStore';
import { CURRENCIES, USERS } from '../../types';
import type { CurrencyCode, UserId } from '../../types';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const USER_IDS: UserId[] = ['a', 'b', 'c', 'd'];

const SYNC_COPY = {
  live: { label: 'En vivo', color: '#16A34A', icon: 'checkmark-circle' as IoniconName },
  connecting: { label: 'Conectando', color: '#94A3B8', icon: 'sync-circle' as IoniconName },
  error: { label: 'Error', color: '#EC1147', icon: 'alert-circle' as IoniconName },
};

export default function PerfilScreen() {
  const currentUser = useAppStore((s) => s.currentUser);
  const setCurrentUser = useAppStore((s) => s.setCurrentUser);
  const currency = useAppStore((s) => s.currency);
  const setCurrency = useAppStore((s) => s.setCurrency);
  const syncStatus = useAppStore((s) => s.syncStatus);
  const [refreshing, setRefreshing] = useState(false);

  const user = USERS[currentUser];
  const sync = SYNC_COPY[syncStatus];
  const version = Constants.expoConfig?.version ?? '1.0.0';

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshCurrentRoom();
    setRefreshing(false);
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      showsVerticalScrollIndicator={false}
      bounces={false}
      overScrollMode="never"
    >
      <View style={styles.profileHeader}>
        <View style={[styles.avatar, { backgroundColor: user.bg }]}>
          <Text style={[styles.avatarText, { color: user.color }]}>{user.initials}</Text>
        </View>
        <View style={styles.profileText}>
          <Text style={styles.profileName}>{user.name}</Text>
          <Text style={styles.profileMeta}>Usuario activo</Text>
        </View>
      </View>

      <Section title="Cuenta">
        <View style={styles.userGrid}>
          {USER_IDS.map((uid) => {
            const item = USERS[uid];
            const active = uid === currentUser;
            return (
              <Pressable
                key={uid}
                onPress={() => void setCurrentUser(uid)}
                style={({ pressed }) => [
                  styles.userOption,
                  active && styles.userOptionActive,
                  pressed && styles.pressed,
                ]}
              >
                <View style={[styles.userAvatar, { backgroundColor: item.bg }]}>
                  <Text style={[styles.userAvatarText, { color: item.color }]}>{item.initials}</Text>
                </View>
                <Text numberOfLines={1} style={styles.userName}>{item.name}</Text>
                {active ? <Ionicons name="checkmark" size={18} color="#22C55E" /> : null}
              </Pressable>
            );
          })}
        </View>
      </Section>

      <Section title="Preferencias">
        <View style={styles.currencyList}>
          {Object.values(CURRENCIES).map((item) => (
            <CurrencyOption
              key={item.code}
              code={item.code}
              symbol={item.symbol}
              label={item.label}
              active={currency === item.code}
              onPress={() => void setCurrency(item.code)}
            />
          ))}
        </View>
      </Section>

      <Section title="Sincronizacion">
        <View style={styles.syncRow}>
          <View style={styles.syncState}>
            <Ionicons name={sync.icon} size={22} color={sync.color} />
            <View>
              <Text style={styles.syncLabel}>Estado</Text>
              <Text style={[styles.syncValue, { color: sync.color }]}>{sync.label}</Text>
            </View>
          </View>
          <Pressable
            onPress={() => void handleRefresh()}
            style={({ pressed }) => [styles.refreshButton, pressed && styles.pressed]}
          >
            <Ionicons name="refresh" size={18} color="#0F172A" />
          </Pressable>
        </View>
      </Section>

      <Section title="Acerca de">
        <View style={styles.aboutRow}>
          <Text style={styles.aboutLabel}>Version</Text>
          <Text style={styles.aboutValue}>{version}</Text>
        </View>
      </Section>
    </ScrollView>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function CurrencyOption({
  code,
  symbol,
  label,
  active,
  onPress,
}: {
  code: CurrencyCode;
  symbol: string;
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.currencyOption,
        active && styles.currencySelected,
        pressed && styles.pressed,
      ]}
    >
      <Text style={styles.currencySymbol}>{symbol}</Text>
      <View style={styles.currencyText}>
        <Text style={styles.currencyLabel}>{label}</Text>
        <Text style={styles.currencyCode}>{code}</Text>
      </View>
      {active ? <Ionicons name="checkmark" size={18} color="#22C55E" /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  aboutLabel: {
    color: APP_COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '800',
  },
  aboutRow: {
    alignItems: 'center',
    borderColor: APP_COLORS.border,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 48,
    paddingHorizontal: 14,
  },
  aboutValue: {
    color: APP_COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '900',
  },
  avatar: {
    alignItems: 'center',
    borderRadius: 32,
    height: 64,
    justifyContent: 'center',
    width: 64,
  },
  avatarText: {
    fontSize: 22,
    fontWeight: '900',
  },
  content: {
    gap: 26,
    paddingBottom: 48,
  },
  currencyCode: {
    color: APP_COLORS.textMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  currencyLabel: {
    color: APP_COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '900',
  },
  currencyList: {
    gap: 10,
  },
  currencyOption: {
    alignItems: 'center',
    borderColor: APP_COLORS.border,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 56,
    paddingHorizontal: 14,
  },
  currencySelected: {
    backgroundColor: '#F0FDF4',
    borderColor: '#86EFAC',
  },
  currencySymbol: {
    color: APP_COLORS.textPrimary,
    fontSize: 19,
    fontWeight: '900',
    textAlign: 'center',
    width: 34,
  },
  currencyText: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  pressed: {
    opacity: 0.72,
  },
  profileHeader: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    gap: 14,
    paddingHorizontal: 24,
    paddingTop: 52,
  },
  profileMeta: {
    color: APP_COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  profileName: {
    color: APP_COLORS.textPrimary,
    fontSize: 26,
    fontWeight: '900',
  },
  profileText: {
    flex: 1,
    minWidth: 0,
  },
  refreshButton: {
    alignItems: 'center',
    borderColor: APP_COLORS.border,
    borderRadius: 13,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  screen: {
    backgroundColor: '#EDF2F6',
    flex: 1,
  },
  section: {
    gap: 12,
    paddingHorizontal: 24,
  },
  sectionTitle: {
    color: APP_COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '900',
  },
  syncLabel: {
    color: APP_COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '800',
  },
  syncRow: {
    alignItems: 'center',
    borderColor: APP_COLORS.border,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 62,
    paddingHorizontal: 14,
  },
  syncState: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  syncValue: {
    fontSize: 15,
    fontWeight: '900',
  },
  userAvatar: {
    alignItems: 'center',
    borderRadius: 17,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  userAvatarText: {
    fontSize: 13,
    fontWeight: '900',
  },
  userGrid: {
    gap: 10,
  },
  userName: {
    color: APP_COLORS.textPrimary,
    flex: 1,
    fontSize: 14,
    fontWeight: '900',
  },
  userOption: {
    alignItems: 'center',
    borderColor: APP_COLORS.border,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 54,
    paddingHorizontal: 12,
  },
  userOptionActive: {
    backgroundColor: '#F8FAFC',
    borderColor: '#BBF7D0',
  },
});
