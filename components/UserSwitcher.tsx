import { Text, View, TouchableOpacity, StyleSheet } from 'react-native';
import { useAppStore } from '../store/useAppStore';

const AVATAR = 30;

export function UserSwitcher() {
  const currentUser    = useAppStore((s) => s.currentUser);
  const setCurrentUser = useAppStore((s) => s.setCurrentUser);
  const users          = useAppStore((s) => s.users);

  return (
    <View style={styles.row}>
      {Object.entries(users).map(([uid, user]) => {
        const active = uid === currentUser;
        return (
          <TouchableOpacity
            key={uid}
            onPress={() => void setCurrentUser(uid)}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            activeOpacity={0.7}
          >
            <View style={[styles.ring, { borderColor: active ? user.color : 'transparent' }]}>
              <View style={[styles.initialBadge, { backgroundColor: user.bg }]}>
                <Text style={[styles.initial, { color: user.color, fontSize: user.initials.length > 1 ? 10 : 12 }]}>
                  {user.initials}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  initial: {
    fontWeight: '800',
  },
  initialBadge: {
    alignItems: 'center',
    borderRadius: AVATAR / 2,
    height: AVATAR,
    justifyContent: 'center',
    width: AVATAR,
  },
  ring: {
    borderRadius: (AVATAR + 5) / 2,
    borderWidth: 2,
    padding: 1.5,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingRight: 12,
  },
});
