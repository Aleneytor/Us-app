import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppModal as Modal } from './AppModal';
import { APP_COLORS } from '../constants/colors';
import { MONTHS_ES, formatYM, nextYM, prevYM } from '../utils/format';

interface MonthNavigatorProps {
  ym: string;
  onChange: (ym: string) => void;
}

export function MonthNavigator({ ym, onChange }: MonthNavigatorProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const year = Number(ym.slice(0, 4));
  const month = Number(ym.slice(5, 7));

  return (
    <>
      <View style={styles.monthRow}>
        <Pressable
          onPress={() => onChange(prevYM(ym))}
          style={({ pressed }) => [styles.monthButton, pressed && styles.monthButtonPressed]}
        >
          <Ionicons name="chevron-back" size={21} color={APP_COLORS.textSecondary} />
        </Pressable>
        <Pressable
          onPress={() => setPickerOpen(true)}
          style={({ pressed }) => [styles.monthCenterButton, pressed && styles.monthButtonPressed]}
        >
          <Text style={styles.monthText}>{formatYM(ym)}</Text>
        </Pressable>
        <Pressable
          onPress={() => onChange(nextYM(ym))}
          style={({ pressed }) => [styles.monthButton, pressed && styles.monthButtonPressed]}
        >
          <Ionicons name="chevron-forward" size={21} color={APP_COLORS.textSecondary} />
        </Pressable>
      </View>
      <MonthPickerModal
        visible={pickerOpen}
        year={year}
        month={month}
        onSelect={(y, m) => {
          onChange(`${y}-${String(m).padStart(2, '0')}`);
          setPickerOpen(false);
        }}
        onClose={() => setPickerOpen(false)}
      />
    </>
  );
}

function MonthPickerModal({
  visible,
  year,
  month,
  onSelect,
  onClose,
}: {
  visible: boolean;
  year: number;
  month: number;
  onSelect: (year: number, month: number) => void;
  onClose: () => void;
}) {
  const [pickerYear, setPickerYear] = useState(year);

  useEffect(() => {
    if (visible) setPickerYear(year);
  }, [visible, year]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <BlurView intensity={28} tint="light" style={StyleSheet.absoluteFill} />
      <Pressable style={styles.pickerBackdrop} onPressIn={onClose}>
        <Pressable style={styles.pickerCardShadow} onPressIn={(event) => event.stopPropagation()}>
          <View style={styles.pickerCard}>
            <View style={styles.pickerYearRow}>
              <Pressable
                onPress={() => setPickerYear((y) => y - 1)}
                style={({ pressed }) => [styles.monthButton, pressed && styles.pressed]}
              >
                <Ionicons name="chevron-back" size={20} color={APP_COLORS.textSecondary} />
              </Pressable>
              <Text style={styles.pickerYearText}>{pickerYear}</Text>
              <Pressable
                onPress={() => setPickerYear((y) => y + 1)}
                style={({ pressed }) => [styles.monthButton, pressed && styles.pressed]}
              >
                <Ionicons name="chevron-forward" size={20} color={APP_COLORS.textSecondary} />
              </Pressable>
            </View>
            <View style={styles.pickerGrid}>
              {MONTHS_ES.map((name, idx) => {
                const m = idx + 1;
                const isActive = pickerYear === year && m === month;
                return (
                  <Pressable
                    key={m}
                    onPress={() => onSelect(pickerYear, m)}
                    style={({ pressed }) => [
                      styles.pickerCell,
                      isActive && styles.pickerCellActive,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={[styles.pickerCellText, isActive && styles.pickerCellTextActive]}>
                      {name.slice(0, 3)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  monthButton: {
    alignItems: 'center',
    backgroundColor: APP_COLORS.surface,
    borderRadius: 12,
    elevation: 4,
    height: 42,
    justifyContent: 'center',
    shadowColor: '#7E7E7E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 8,
    width: 42,
  },
  monthButtonPressed: {
    backgroundColor: '#F1F5F9',
    opacity: 0.8,
  },
  monthCenterButton: {
    alignItems: 'center',
    backgroundColor: APP_COLORS.surface,
    borderRadius: 12,
    elevation: 4,
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 11,
    shadowColor: '#7E7E7E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 8,
  },
  monthRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  monthText: {
    color: APP_COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '600',
  },
  pickerBackdrop: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  pickerCard: {
    backgroundColor: APP_COLORS.surface,
    borderRadius: 20,
    overflow: 'hidden',
    padding: 20,
    width: '100%',
  },
  pickerCardShadow: {
    borderRadius: 20,
    elevation: 14,
    maxWidth: 360,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.24,
    shadowRadius: 30,
    width: '100%',
  },
  pickerCell: {
    alignItems: 'center',
    borderRadius: 12,
    paddingVertical: 10,
    width: '30%',
  },
  pickerCellActive: {
    backgroundColor: '#7C3AED',
  },
  pickerCellText: {
    color: APP_COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  pickerCellTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  pickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pickerYearRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  pickerYearText: {
    color: APP_COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  pressed: {
    backgroundColor: '#F1F5F9',
  },
});
