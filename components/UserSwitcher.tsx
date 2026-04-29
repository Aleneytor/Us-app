import { Text, View, TouchableOpacity, StyleSheet } from 'react-native';
import { useAppStore } from '../store/useAppStore';
import { USERS } from '../types';
import type { UserId } from '../types';

const USER_IDS: UserId[] = ['a', 'b', 'c', 'd'];
const AVATAR = 30;

export function UserSwitcher() {
  const currentUser = useAppStore((s) => s.currentUser);
  const setCurrentUser = useAppStore((s) => s.setCurrentUser);

  return (
    <View style={styles.row}>
      {USER_IDS.map((uid) => {
        const user = USERS[uid];
        const active = uid === currentUser;
        return (
          <TouchableOpacity
            key={uid}
            onPress={() => void setCurrentUser(uid)}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.ring,
                { borderColor: active ? user.color : 'transparent' },
              ]}
            >
              <View style={[styles.initialBadge, { backgroundColor: user.bg }]}>
                <Text style={[styles.initial, { color: user.color }]}>{user.initials}</Text>
              </View>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingRight: 12,
  },
  ring: {
    borderRadius: (AVATAR + 5) / 2,
    borderWidth: 2,
    padding: 1.5,
  },
  initialBadge: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {
    fontSize: 12,
    fontWeight: '800',
  },
});
