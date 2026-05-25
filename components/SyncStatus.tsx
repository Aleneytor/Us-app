import { Text, StyleSheet } from 'react-native';
import { useAppStore } from '../store/useAppStore';

const STATUS_MAP = {
  live:       { label: '● en vivo',     color: '#16A34A' },
  connecting: { label: '○ conectando',  color: '#94A3B8' },
  error:      { label: '✕ error',       color: '#EC1147' },
} as const;

export function SyncStatus() {
  const syncStatus = useAppStore((s) => s.syncStatus);
  const status = STATUS_MAP[syncStatus] ?? STATUS_MAP.connecting;
  return <Text style={[styles.text, { color: status.color }]}>{status.label}</Text>;
}

const styles = StyleSheet.create({
  text: {
    fontSize: 11,
    fontWeight: '500',
    paddingLeft: 14,
  },
});
