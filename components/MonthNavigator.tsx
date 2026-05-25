import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppModal as Modal } from './AppModal';
import { ModalScreen } from './ModalScreen';
import { useTheme } from '../contexts/ThemeContext';
import type { AppTheme } from '../constants/colors';
import { SURFACE_SHADOW } from '../constants/shadows';
import { MONTHS_ES, formatYM, nextYM, prevYM } from '../utils/format';

interface MonthNavigatorProps {
  ym: string;
  onChange: (ym: string) => void;
  onOpen?: (buttonBottomY: number) => void;
  variant?: 'default' | 'plain';
}

export function MonthNavigator({ ym, onChange, onOpen, variant = 'default' }: MonthNavigatorProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const centerBtnRef = useRef<View>(null);
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const year = Number(ym.slice(0, 4));
  const month = Number(ym.slice(5, 7));
  const isPlain = variant === 'plain';

  const handleCenterPress = () => {
    if (onOpen) {
      centerBtnRef.current?.measure((_x, _y, _w, height, _pageX, pageY) => {
        onOpen(pageY + height);
      });
    } else {
      setPickerOpen(true);
    }
  };

  return (
    <>
      <View style={styles.monthRow}>
        <Pressable
          onPress={() => onChange(prevYM(ym))}
          style={({ pressed }) => [
            styles.monthButton,
            isPlain && styles.monthButtonPlain,
            pressed && (isPlain ? styles.monthButtonPlainPressed : styles.monthButtonPressed),
          ]}
        >
          <Ionicons name="chevron-back" size={21} color={theme.textSecondary} />
        </Pressable>
        <View ref={centerBtnRef} style={styles.monthCenterWrap}>
          <Pressable
            onPress={handleCenterPress}
            style={({ pressed }) => [
              styles.monthCenterButton,
              isPlain && styles.monthCenterButtonPlain,
              pressed && (isPlain ? styles.monthButtonPlainPressed : styles.monthButtonPressed),
            ]}
          >
            <Text style={styles.monthText}>{formatYM(ym)}</Text>
          </Pressable>
        </View>
        <Pressable
          onPress={() => onChange(nextYM(ym))}
          style={({ pressed }) => [
            styles.monthButton,
            isPlain && styles.monthButtonPlain,
            pressed && (isPlain ? styles.monthButtonPlainPressed : styles.monthButtonPressed),
          ]}
        >
          <Ionicons name="chevron-forward" size={21} color={theme.textSecondary} />
        </Pressable>
      </View>
      {!onOpen && (
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
      )}
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
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  useEffect(() => {
    if (visible) setPickerYear(year);
  }, [visible, year]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <ModalScreen
        title="Elegir mes"
        subtitle={String(pickerYear)}
        breadcrumbs={['Periodo', 'Mes']}
        activeBreadcrumb={1}
        onBack={onClose}
      >
        <View style={styles.pickerCard}>
          <View style={styles.pickerYearRow}>
            <Pressable
              onPress={() => setPickerYear((y) => y - 1)}
              style={({ pressed }) => [styles.monthButton, pressed && styles.pressed]}
            >
              <Ionicons name="chevron-back" size={20} color={theme.textSecondary} />
            </Pressable>
            <Text style={styles.pickerYearText}>{pickerYear}</Text>
            <Pressable
              onPress={() => setPickerYear((y) => y + 1)}
              style={({ pressed }) => [styles.monthButton, pressed && styles.pressed]}
            >
              <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
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
      </ModalScreen>
    </Modal>
  );
}

const makeStyles = (t: AppTheme) => StyleSheet.create({
  monthButton: {
    alignItems: 'center',
    backgroundColor: t.surface,
    borderColor: t.border,
    borderRadius: 12,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  monthButtonPressed: {
    backgroundColor: t.softSurface,
    opacity: 0.8,
  },
  monthButtonPlain: {
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  monthButtonPlainPressed: {
    backgroundColor: 'transparent',
    opacity: 0.62,
  },
  monthCenterWrap: {
    flex: 1,
  },
  monthCenterButton: {
    alignItems: 'center',
    backgroundColor: t.surface,
    borderColor: t.border,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    paddingVertical: 11,
  },
  monthCenterButtonPlain: {
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  monthRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  monthText: {
    color: t.textPrimary,
    fontSize: 18,
    fontWeight: '600',
  },
  pickerCard: {
    backgroundColor: t.surface,
    borderRadius: 20,
    padding: 20,
    width: '100%',
    ...SURFACE_SHADOW,
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
    color: t.textPrimary,
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
    color: t.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  pressed: {
    backgroundColor: t.softSurface,
  },
});
