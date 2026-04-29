import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { WishCard } from '../../components/WishCard';
import { APP_COLORS } from '../../constants/colors';
import { WishModal } from '../../modals/WishModal';
import { PARTNER, USERS } from '../../types';
import type { Wish } from '../../types';
import { refreshCurrentRoom, useAppStore } from '../../store/useAppStore';

type OwnerFilter = 'mine' | 'partner' | 'all';

export default function DeseosScreen() {
  const payload = useAppStore((s) => s.payload);
  const currentUser = useAppStore((s) => s.currentUser);
  const deleteWish = useAppStore((s) => s.deleteWish);

  const [ownerFilter, setOwnerFilter] = useState<OwnerFilter>('mine');
  const [createOpen, setCreateOpen] = useState(false);
  const [editWish, setEditWish] = useState<Wish | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const partner = PARTNER[currentUser];

  const wishes = useMemo(() => {
    return payload.wishlist
      .filter((wish) => {
        if (ownerFilter === 'all') return true;
        return wish.uid === (ownerFilter === 'mine' ? currentUser : partner);
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [currentUser, ownerFilter, partner, payload.wishlist]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshCurrentRoom();
    setRefreshing(false);
  };

  const openWish = async (wish: Wish) => {
    if (!wish.link) {
      Alert.alert(wish.name, 'Este deseo no tiene link guardado.');
      return;
    }
    const supported = await Linking.canOpenURL(wish.link);
    if (supported) await Linking.openURL(wish.link);
    else Alert.alert('No se pudo abrir', wish.link);
  };

  const confirmDelete = (wish: Wish) => {
    Alert.alert(
      'Eliminar deseo',
      wish.name,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => deleteWish(wish.id) },
      ],
    );
  };

  const showActions = (wish: Wish) => {
    if (wish.uid !== currentUser) return;
    Alert.alert(
      wish.name,
      'Elige una accion',
      [
        { text: 'Editar', onPress: () => setEditWish(wish) },
        { text: 'Eliminar', style: 'destructive', onPress: () => confirmDelete(wish) },
        { text: 'Cancelar', style: 'cancel' },
      ],
    );
  };

  return (
    <View style={styles.screen}>
      <FlatList
        data={wishes}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.segment}>
              <FilterButton label="Mis deseos" active={ownerFilter === 'mine'} onPress={() => setOwnerFilter('mine')} />
              <FilterButton label={USERS[partner].name} active={ownerFilter === 'partner'} onPress={() => setOwnerFilter('partner')} />
              <FilterButton label="Todos" active={ownerFilter === 'all'} onPress={() => setOwnerFilter('all')} />
            </View>
            <View style={styles.resultLine}>
              <Text style={styles.title}>Deseos</Text>
              <Text style={styles.count}>{wishes.length}</Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="star-outline" size={34} color={APP_COLORS.textMuted} />
            <Text style={styles.emptyTitle}>Sin deseos</Text>
            <Text style={styles.emptyText}>Cambia el filtro o agrega uno nuevo.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <WishCard
            wish={item}
            onPress={() => void openWish(item)}
            onLongPress={() => showActions(item)}
          />
        )}
      />

      <Pressable
        accessibilityLabel="Nuevo deseo"
        onPress={() => setCreateOpen(true)}
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
      >
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </Pressable>

      <WishModal visible={createOpen} onClose={() => setCreateOpen(false)} />
      <WishModal visible={!!editWish} wish={editWish} onClose={() => setEditWish(null)} />
    </View>
  );
}

function FilterButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.segmentButton,
        active && styles.segmentButtonActive,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    paddingBottom: 96,
  },
  count: {
    color: APP_COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '900',
  },
  empty: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 48,
  },
  emptyText: {
    color: APP_COLORS.textSecondary,
    fontSize: 13,
  },
  emptyTitle: {
    color: APP_COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '900',
  },
  fab: {
    alignItems: 'center',
    backgroundColor: APP_COLORS.blue,
    borderRadius: 28,
    bottom: 24,
    elevation: 4,
    height: 56,
    justifyContent: 'center',
    position: 'absolute',
    right: 20,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    width: 56,
  },
  fabPressed: {
    transform: [{ scale: 0.97 }],
  },
  header: {
    gap: 14,
    marginBottom: 12,
  },
  pressed: {
    opacity: 0.72,
  },
  resultLine: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  screen: {
    backgroundColor: APP_COLORS.background,
    flex: 1,
  },
  segment: {
    backgroundColor: '#F1F5F9',
    borderRadius: 13,
    flexDirection: 'row',
    padding: 4,
  },
  segmentButton: {
    alignItems: 'center',
    borderRadius: 10,
    flex: 1,
    minHeight: 38,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  segmentButtonActive: {
    backgroundColor: APP_COLORS.surface,
  },
  segmentText: {
    color: APP_COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '900',
  },
  segmentTextActive: {
    color: APP_COLORS.textPrimary,
  },
  separator: {
    height: 10,
  },
  title: {
    color: APP_COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '900',
  },
});
