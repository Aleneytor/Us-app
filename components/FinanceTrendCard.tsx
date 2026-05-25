import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  LayoutChangeEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  UIManager,
  View,
  useWindowDimensions,
} from 'react-native';
import {
  Circle,
  Defs,
  Line as SvgLine,
  LinearGradient,
  Path,
  Rect,
  Stop,
  Svg,
  Text as SvgText,
} from 'react-native-svg';
import { getIconColor, type AppTheme } from '../constants/colors';
import { useTheme } from '../contexts/ThemeContext';
import { SURFACE_SHADOW } from '../constants/shadows';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import { AppModal as Modal } from './AppModal';
import { ModalScreen } from './ModalScreen';
import type { AppPayload, BudgetCategory, CurrencyCode, Transaction, UserId } from '../types';
import { getOccurrenceDatesInMonth, isMonthVisible } from '../utils/filters';
import { MONTHS_ES, fmt, formatYM, prevYM } from '../utils/format';
import { MonthNavigator } from './MonthNavigator';

type FinanceTrendKind = 'expense' | 'income';
type CategoryFilterId = string;

interface FinanceTrendCardProps {
  payload: AppPayload;
  uid: UserId;
  selectedYM: string;
  currency: CurrencyCode;
  categories: BudgetCategory[];
  onOpenDetail?: (kind: 'income' | 'expense') => void;
}

interface ChartPoint {
  ym: string;
  label: string;
  value: number;
  hasActivity?: boolean;
}

interface ChartSeries {
  kind: FinanceTrendKind;
  label: string;
  color: string;
  points: ChartPoint[];
}

const UNCATEGORIZED_ID = '__uncategorized__';

export function FinanceTrendCard({
  payload,
  uid,
  selectedYM,
  currency,
  categories,
  onOpenDetail,
}: FinanceTrendCardProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const budgetCategoryIds = useMemo(
    () => categories.map((c) => String(c.id)),
    [categories],
  );
  const allCategoryIds = useMemo(() => {
    const budgetSet = new Set(budgetCategoryIds);
    const hasUncategorized = payload.expenses.some((t) =>
      t.uid === uid && !t.del && !budgetSet.has(String(t.budgetCatId)),
    );
    return [...budgetCategoryIds, ...(hasUncategorized ? [UNCATEGORIZED_ID] : [])];
  }, [budgetCategoryIds, payload.expenses, uid]);

  const previewLastDay = useMemo(() => {
    const [y, m] = selectedYM.split('-').map(Number);
    const fullDays = new Date(y, m, 0).getDate();
    const now = new Date();
    if (y === now.getFullYear() && m === now.getMonth() + 1) return now.getDate();
    return fullDays;
  }, [selectedYM]);

  const expensePoints = useMemo(
    () => buildPreviewPoints(payload.expenses, uid, selectedYM, 'expense', allCategoryIds, budgetCategoryIds, previewLastDay),
    [payload.expenses, uid, selectedYM, allCategoryIds, budgetCategoryIds, previewLastDay],
  );
  const incomePoints = useMemo(
    () => buildPreviewPoints(payload.expenses, uid, selectedYM, 'income', allCategoryIds, budgetCategoryIds, previewLastDay),
    [payload.expenses, uid, selectedYM, allCategoryIds, budgetCategoryIds, previewLastDay],
  );

  const series = useMemo<ChartSeries[]>(
    () => [
      { kind: 'income', label: 'Ingresos', color: theme.income, points: incomePoints },
      { kind: 'expense', label: 'Gastos', color: theme.expense, points: expensePoints },
    ],
    [expensePoints, incomePoints, theme],
  );

  return (
    <>
      <View style={styles.previewCard}>
        <Pressable
          onPress={() => setModalOpen(true)}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <View style={styles.previewChart}>
            <LineChart series={series} height={92} compact />
          </View>
        </Pressable>
      </View>

      <TrendModal
        visible={modalOpen}
        onClose={() => setModalOpen(false)}
        payload={payload}
        uid={uid}
        selectedYM={selectedYM}
        currency={currency}
        categories={categories}
        onOpenDetail={onOpenDetail}
      />
    </>
  );
}

function TrendModal({
  visible,
  onClose,
  payload,
  uid,
  selectedYM,
  currency,
  categories,
  onOpenDetail,
}: {
  visible: boolean;
  onClose: () => void;
  payload: AppPayload;
  uid: UserId;
  selectedYM: string;
  currency: CurrencyCode;
  categories: BudgetCategory[];
  onOpenDetail?: (kind: 'income' | 'expense') => void;
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { height: windowHeight } = useWindowDimensions();
  const [modalYM, setModalYM] = useState(selectedYM);
  const [monthPickerY, setMonthPickerY] = useState<number | null>(null);
  const [scrubDay, setScrubDay] = useState<number | null>(null);
  const [scrubberWidth, setScrubberWidth] = useState(0);
  const scrubberWidthRef = useRef(0);
  const scrubDayRef = useRef<number | null>(null);

  useEffect(() => {
    if (visible) {
      setModalYM(selectedYM);
      setScrubDay(null);
    }
  }, [visible, selectedYM]);

  useEffect(() => { setScrubDay(null); }, [modalYM]);

  const categoryOptions = useMemo(() => {
    const budgetSet = new Set(categories.map((c) => String(c.id)));
    const hasUncategorized = payload.expenses.some((t) =>
      t.uid === uid && !t.del && !budgetSet.has(String(t.budgetCatId)),
    );
    return [
      ...categories.map((c) => ({ id: String(c.id), label: c.name })),
      ...(hasUncategorized ? [{ id: UNCATEGORIZED_ID, label: 'Sin categoría' }] : []),
    ];
  }, [categories, payload.expenses, uid]);

  const allCategoryIds = useMemo(() => categoryOptions.map((o) => o.id), [categoryOptions]);
  const budgetCategoryIds = useMemo(() => categories.map((c) => String(c.id)), [categories]);

  const expensePoints = useMemo(
    () => buildDailyPoints(payload.expenses, uid, modalYM, 'expense', allCategoryIds, budgetCategoryIds),
    [payload.expenses, uid, modalYM, allCategoryIds, budgetCategoryIds],
  );
  const incomePoints = useMemo(
    () => buildDailyPoints(payload.expenses, uid, modalYM, 'income', allCategoryIds, budgetCategoryIds),
    [payload.expenses, uid, modalYM, allCategoryIds, budgetCategoryIds],
  );

  const expenseTotal = useMemo(() => expensePoints[expensePoints.length - 1]?.value ?? 0, [expensePoints]);
  const incomeTotal = useMemo(() => incomePoints[incomePoints.length - 1]?.value ?? 0, [incomePoints]);

  const prevMonthYM = useMemo(() => prevYM(modalYM), [modalYM]);
  const prevExpenseTotal = useMemo(() => {
    const pts = buildDailyPoints(payload.expenses, uid, prevMonthYM, 'expense', allCategoryIds, budgetCategoryIds);
    return pts[pts.length - 1]?.value ?? 0;
  }, [payload.expenses, uid, prevMonthYM, allCategoryIds, budgetCategoryIds]);
  const prevIncomeTotal = useMemo(() => {
    const pts = buildDailyPoints(payload.expenses, uid, prevMonthYM, 'income', allCategoryIds, budgetCategoryIds);
    return pts[pts.length - 1]?.value ?? 0;
  }, [payload.expenses, uid, prevMonthYM, allCategoryIds, budgetCategoryIds]);

  const expenseComparison = getComparison(expenseTotal, prevExpenseTotal, 'expense', theme);
  const incomeComparison = getComparison(incomeTotal, prevIncomeTotal, 'income', theme);

  const series = useMemo<ChartSeries[]>(
    () => [
      { kind: 'income', label: 'Ingresos', color: theme.income, points: incomePoints },
      { kind: 'expense', label: 'Gastos', color: theme.expense, points: expensePoints },
    ],
    [expensePoints, incomePoints, theme],
  );

  const daysInMonth = useMemo(() => {
    const [y, m] = modalYM.split('-').map(Number);
    const fullDays = new Date(y, m, 0).getDate();
    const now = new Date();
    const curYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return modalYM === curYM ? now.getDate() : fullDays;
  }, [modalYM]);

  const txsByDate = useMemo(() => {
    const map: Record<string, { income: number; expense: number }> = {};
    payload.expenses
      .filter((t) => t.uid === uid && !t.del && (t.kind === 'expense' || t.kind === 'income') && isMonthVisible(t, modalYM))
      .forEach((t) => {
        getOccurrenceDatesInMonth(t, modalYM).forEach((dateStr) => {
          if (!map[dateStr]) map[dateStr] = { income: 0, expense: 0 };
          if (t.kind === 'income') map[dateStr].income += t.amt;
          else map[dateStr].expense += t.amt;
        });
      });
    return map;
  }, [modalYM, payload.expenses, uid]);

  const scrubDayData = useMemo(() => {
    if (scrubDay === null) return null;
    const dateStr = `${modalYM}-${String(scrubDay).padStart(2, '0')}`;
    const data = txsByDate[dateStr];
    return {
      income: data?.income ?? 0,
      expense: data?.expense ?? 0,
      hasData: !!data,
    };
  }, [scrubDay, modalYM, txsByDate]);

  const thumbLeft = scrubberWidth > 0
    ? scrubDay !== null
      ? ((scrubDay - 1) / Math.max(1, daysInMonth - 1)) * scrubberWidth - 9
      : scrubberWidth / 2 - 9
    : null;

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={{ flex: 1 }}>
      <ModalScreen
        title="Grafica de tendencia"
        onBack={onClose}
        contentContainerStyle={{ padding: 0 }}
      >
          <ScrollView style={styles.modalCard} contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false} scrollEnabled={scrubDay === null}>
            <MonthNavigator ym={modalYM} onChange={(ym) => { setModalYM(ym); setScrubDay(null); }} onOpen={setMonthPickerY} />

            <SummaryPanel
              incomeCurrent={incomeTotal}
              incomePrevious={prevIncomeTotal}
              expenseCurrent={expenseTotal}
              expensePrevious={prevExpenseTotal}
              incomeComparison={incomeComparison}
              expenseComparison={expenseComparison}
              currency={currency}
              onPressIncome={onOpenDetail ? () => { onClose(); setTimeout(() => onOpenDetail('income'), 320); } : undefined}
              onPressExpense={onOpenDetail ? () => { onClose(); setTimeout(() => onOpenDetail('expense'), 320); } : undefined}
            />

            <>
                <LineChart
                  series={series}
                  height={196}
                  highlightIndex={scrubDay !== null ? scrubDay - 1 : null}
                />

                <View style={styles.scrubberDetail}>
                  {scrubDay !== null && scrubDayData !== null ? (
                    scrubDayData.hasData ? (
                      <View style={styles.scrubberDetailRow}>
                        <Text style={styles.scrubberDate}>
                          {scrubDay} {getMonthShortLabel(modalYM)}
                        </Text>
                        {scrubDayData.income > 0 && (
                          <Text style={[styles.scrubberAmount, { color: theme.income }]}>
                            + {fmt(scrubDayData.income, currency)}
                          </Text>
                        )}
                        {scrubDayData.expense > 0 && (
                          <Text style={[styles.scrubberAmount, { color: theme.expense }]}>
                            - {fmt(scrubDayData.expense, currency)}
                          </Text>
                        )}
                      </View>
                    ) : (
                      <Text style={styles.scrubberEmpty}>No hay movimientos este día</Text>
                    )
                  ) : (
                    <View style={styles.scrubberHintRow}>
                      <Ionicons name="arrow-back" size={12} color={theme.textMuted} />
                      <Text style={styles.scrubberHint}>Desliza para ver por día</Text>
                      <Ionicons name="arrow-forward" size={12} color={theme.textMuted} />
                    </View>
                  )}
                </View>

                <View
                  style={styles.scrubberTrackWrap}
                  onLayout={(e) => {
                    scrubberWidthRef.current = e.nativeEvent.layout.width;
                    setScrubberWidth(e.nativeEvent.layout.width);
                  }}
                  onStartShouldSetResponder={() => true}
                  onMoveShouldSetResponder={() => true}
                  onResponderTerminationRequest={() => false}
                  onResponderGrant={(e) => {
                    const x = Math.max(0, Math.min(scrubberWidthRef.current, e.nativeEvent.locationX));
                    const day = Math.max(1, Math.min(daysInMonth, Math.round((x / scrubberWidthRef.current) * (daysInMonth - 1)) + 1));
                    scrubDayRef.current = day;
                    setScrubDay(day);
                  }}
                  onResponderMove={(e) => {
                    const x = Math.max(0, Math.min(scrubberWidthRef.current, e.nativeEvent.locationX));
                    const day = Math.max(1, Math.min(daysInMonth, Math.round((x / scrubberWidthRef.current) * (daysInMonth - 1)) + 1));
                    if (day !== scrubDayRef.current) {
                      scrubDayRef.current = day;
                      setScrubDay(day);
                    }
                  }}
                  onResponderRelease={() => { scrubDayRef.current = null; setScrubDay(null); }}
                >
                  <View style={styles.scrubberLine} />
                  {thumbLeft !== null && (
                    <View style={[styles.scrubberThumb, { left: thumbLeft }, scrubDay === null && styles.scrubberThumbResting]} />
                  )}
                </View>

            </>
          </ScrollView>
      </ModalScreen>
      {monthPickerY !== null && (
        <MonthPickerDropdown
          anchorY={monthPickerY}
          ym={modalYM}
          onChange={(ym) => { setModalYM(ym); setMonthPickerY(null); setScrubDay(null); }}
          onClose={() => setMonthPickerY(null)}
        />
      )}
      </View>
    </Modal>
  );
}

function SummaryPanel({
  incomeCurrent,
  expenseCurrent,
  incomeComparison,
  expenseComparison,
  currency,
  onPressIncome,
  onPressExpense,
}: {
  incomeCurrent: number;
  incomePrevious: number;
  expenseCurrent: number;
  expensePrevious: number;
  incomeComparison: ReturnType<typeof getComparison>;
  expenseComparison: ReturnType<typeof getComparison>;
  currency: CurrencyCode;
  onPressIncome?: () => void;
  onPressExpense?: () => void;
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <View style={styles.summaryPanel}>
      <Pressable
        onPress={onPressIncome}
        style={({ pressed }) => [styles.summaryCard, pressed && styles.pressed]}
      >
        <View style={styles.summaryCardHeader}>
          <View style={[styles.summaryDot, { backgroundColor: theme.income }]} />
          <Text style={styles.summaryCardLabel}>Ingresos</Text>
        </View>
        <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.summaryCardAmount, { color: theme.income }]}>
          {fmt(incomeCurrent, currency)}
        </Text>
        <View style={styles.summaryChangeRow}>
          <Ionicons name={incomeComparison.icon} size={12} color={theme.textMuted} />
          <Text style={[styles.summaryChangeText, { color: theme.textMuted }]}>
            {incomeComparison.label}
          </Text>
        </View>
      </Pressable>

      <Pressable
        onPress={onPressExpense}
        style={({ pressed }) => [styles.summaryCard, pressed && styles.pressed]}
      >
        <View style={styles.summaryCardHeader}>
          <View style={[styles.summaryDot, { backgroundColor: theme.expense }]} />
          <Text style={styles.summaryCardLabel}>Gastos</Text>
        </View>
        <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.summaryCardAmount, { color: theme.expense }]}>
          {fmt(expenseCurrent, currency)}
        </Text>
        <View style={styles.summaryChangeRow}>
          <Ionicons name={expenseComparison.icon} size={12} color={theme.textMuted} />
          <Text style={[styles.summaryChangeText, { color: theme.textMuted }]}>
            {expenseComparison.label}
          </Text>
        </View>
      </Pressable>
    </View>
  );
}

function PreviewMetricRow({
  label,
  color,
  comparison,
}: {
  label: string;
  color: string;
  comparison: ReturnType<typeof getComparison>;
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <View style={styles.previewMetricRow}>
      <View style={[styles.previewDot, { backgroundColor: color }]} />
      <Text style={styles.previewMetricLabel}>{label}</Text>
      <View style={[styles.previewChip, { backgroundColor: comparison.bg }]}>
        <Ionicons name={comparison.icon} size={11} color={comparison.color} />
        <Text style={[styles.previewChipText, { color: comparison.color }]}>{comparison.label}</Text>
      </View>
    </View>
  );
}

function computeNiceGrid(rawMax: number): { yMax: number; yStep: number } {
  const candidates = [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000];
  const step = candidates.find((s) => s * 3 >= rawMax) ?? 50000;
  return { yMax: step * 3, yStep: step };
}

function LineChart({
  series,
  height,
  compact,
  highlightIndex,
}: {
  series: ChartSeries[];
  height: number;
  compact?: boolean;
  highlightIndex?: number | null;
}) {
  const theme = useTheme();
  const [viewWidth, setViewWidth] = useState(0);

  const PAD_LEFT = compact ? 2 : 52;
  const PAD_RIGHT = compact ? 2 : 6;
  const PAD_TOP = compact ? 6 : 12;
  const PAD_BOTTOM = compact ? 6 : 22;
  const chartW = Math.max(1, viewWidth - PAD_LEFT - PAD_RIGHT);
  const chartH = Math.max(1, height - PAD_TOP - PAD_BOTTOM);
  const yBottom = PAD_TOP + chartH;

  const allValues = series.flatMap((s) => s.points.map((p) => p.value));
  const rawMax = Math.max(...allValues, 1);
  const { yMax, yStep } = computeNiceGrid(rawMax);
  const gridLevels = [0, yStep, yStep * 2, yMax];

  const seriesCoords = series.map((s) => {
    const n = s.points.length;
    const coords = s.points.map((p, i) => {
      const rawY = PAD_TOP + chartH - (p.value / yMax) * chartH;
      return {
        x: PAD_LEFT + (n <= 1 ? chartW / 2 : (i / (n - 1)) * chartW),
        y: Math.max(PAD_TOP, Math.min(yBottom, rawY)),
        value: p.value,
        label: p.label,
        hasActivity: p.hasActivity ?? false,
      };
    });
    return { ...s, coords };
  });

  const toAreaPath = (coords: { x: number; y: number }[]) => {
    if (coords.length < 2) return '';
    const line = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
    return `${line} L${coords[coords.length - 1].x.toFixed(1)},${yBottom.toFixed(1)} L${coords[0].x.toFixed(1)},${yBottom.toFixed(1)} Z`;
  };

  const toLinePath = (coords: { x: number; y: number }[]) => {
    if (coords.length < 2) return '';
    return coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
  };

  const n = series[0]?.points.length ?? 0;
  const sparseXDays = [1, 5, 10, 15, 20, 25, 30];
  const highlightX = highlightIndex != null && n > 1
    ? PAD_LEFT + (highlightIndex / (n - 1)) * chartW
    : null;

  return (
    <View
      style={{ height, width: '100%' }}
      onLayout={(e: LayoutChangeEvent) => setViewWidth(e.nativeEvent.layout.width)}
    >
      {viewWidth > 0 && (
        <Svg width={viewWidth} height={height}>
          <Defs>
            {series.map((s) => (
              <LinearGradient key={`grad-${s.kind}`} id={`grad-${s.kind}`} x1="0" y1="0" x2="0" y2="1">
                <Stop offset={0} stopColor={s.color} stopOpacity={0.25} />
                <Stop offset={1} stopColor={s.color} stopOpacity={0} />
              </LinearGradient>
            ))}
          </Defs>

          {gridLevels.map((level) => {
            const y = PAD_TOP + chartH - (level / yMax) * chartH;
            return (
              <SvgLine key={level} x1={0} y1={y} x2={viewWidth} y2={y} stroke={theme.mode === 'light' ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.10)'} strokeWidth={1} />
            );
          })}

          {!compact && gridLevels.map((level) => {
            const y = PAD_TOP + chartH - (level / yMax) * chartH;
            const label = level === 0 ? '0 €' : `${Math.round(level)} €`;
            return (
              <React.Fragment key={level}>
                <Rect x={2} y={y - 8} width={label.length * 5.6 + 6} height={13} rx={3} fill={theme.mode === 'light' ? 'rgba(229,231,235,0.9)' : 'rgba(33,37,40,0.88)'} />
                <SvgText x={5} y={y + 3} fontSize={9} fill={theme.textMuted} textAnchor="start" fontWeight="700">
                  {label}
                </SvgText>
              </React.Fragment>
            );
          })}

          {highlightX !== null && (
            <SvgLine x1={highlightX} y1={PAD_TOP} x2={highlightX} y2={yBottom} stroke="#94A3B8" strokeWidth={1.5} opacity={0.5} />
          )}

          {seriesCoords.map((s) => (
            <Path key={`${s.kind}-area`} d={toAreaPath(s.coords)} fill={`url(#grad-${s.kind})`} />
          ))}

          {seriesCoords.map((s) => (
            <Path key={`${s.kind}-line`} d={toLinePath(s.coords)} stroke={s.color} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          ))}

          {!compact && seriesCoords.map((s) =>
            s.coords.filter((c) => c.hasActivity).map((c, i) => (
              <Circle key={`${s.kind}-${i}`} cx={c.x} cy={c.y} r={4} fill={s.color} stroke="white" strokeWidth={2} />
            ))
          )}

          {!compact && sparseXDays.map((day) => {
            const idx = day - 1;
            if (idx >= n) return null;
            const x = PAD_LEFT + (n <= 1 ? chartW / 2 : (idx / (n - 1)) * chartW);
            return (
              <SvgText key={day} x={x} y={height - 4} fontSize={9} fill={theme.textMuted} textAnchor="middle" fontWeight="700">
                {String(day)}
              </SvgText>
            );
          })}
        </Svg>
      )}
    </View>
  );
}

function CategoryBreakdownChart({
  payload,
  uid,
  modalYM,
  currency,
  categories,
  selectedIds,
  budgetCategoryIds,
}: {
  payload: AppPayload;
  uid: UserId;
  modalYM: string;
  currency: CurrencyCode;
  categories: BudgetCategory[];
  selectedIds: CategoryFilterId[];
  budgetCategoryIds: CategoryFilterId[];
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const prevMonthYM = prevYM(modalYM);

  const data = useMemo(() => {
    const expenses = payload.expenses.filter(
      (t) => t.uid === uid && !t.del && t.kind === 'expense' && isMonthVisible(t, modalYM),
    );
    const prevExpenses = payload.expenses.filter(
      (t) => t.uid === uid && !t.del && t.kind === 'expense' && isMonthVisible(t, prevMonthYM),
    );

    const currMap: Record<string, number> = {};
    expenses.forEach((t) => {
      const cid = t.budgetCatId !== undefined && budgetCategoryIds.includes(String(t.budgetCatId))
        ? String(t.budgetCatId)
        : UNCATEGORIZED_ID;
      currMap[cid] = (currMap[cid] ?? 0) + t.amt;
    });

    const prevMap: Record<string, number> = {};
    prevExpenses.forEach((t) => {
      const cid = t.budgetCatId !== undefined && budgetCategoryIds.includes(String(t.budgetCatId))
        ? String(t.budgetCatId)
        : UNCATEGORIZED_ID;
      prevMap[cid] = (prevMap[cid] ?? 0) + t.amt;
    });

    const totalCurr = Object.values(currMap).reduce((s, v) => s + v, 0);

    const nameMap: Record<string, string> = {};
    const colorMap: Record<string, string> = {};
    categories.forEach((c) => {
      nameMap[String(c.id)] = c.name;
      colorMap[String(c.id)] = getIconColor(c.iconColor).color;
    });
    nameMap[UNCATEGORIZED_ID] = 'Sin categoría';
    colorMap[UNCATEGORIZED_ID] = theme.textMuted;

    return selectedIds
      .map((cid) => {
        const curr = currMap[cid] ?? 0;
        const prev = prevMap[cid] ?? 0;
        return {
          id: cid,
          name: nameMap[cid] ?? cid,
          color: colorMap[cid] ?? theme.textMuted,
          curr,
          prev,
          pct: totalCurr > 0 ? (curr / totalCurr) * 100 : 0,
          comparison: getComparison(curr, prev, 'expense', theme),
        };
      })
      .filter((c) => c.curr > 0)
      .sort((a, b) => b.curr - a.curr);
  }, [payload.expenses, uid, modalYM, prevMonthYM, selectedIds, budgetCategoryIds, categories, theme]);

  if (data.length === 0) {
    return <Text style={[styles.emptyText, { marginTop: 12 }]}>Sin gastos en las categorías seleccionadas.</Text>;
  }

  return (
    <View style={styles.breakdownList}>
      {data.map((cat) => (
        <View key={cat.id} style={styles.breakdownRow}>
          <View style={styles.breakdownTopRow}>
            <Text style={styles.breakdownName} numberOfLines={1}>{cat.name}</Text>
            <View style={[styles.breakdownChip, { backgroundColor: cat.comparison.bg }]}>
              <Ionicons name={cat.comparison.icon} size={10} color={cat.comparison.color} />
              <Text style={[styles.breakdownChipText, { color: cat.comparison.color }]}>{cat.comparison.label}</Text>
            </View>
            <Text style={styles.breakdownPct}>{cat.pct.toFixed(0)}%</Text>
          </View>
          <View style={styles.breakdownBarTrack}>
            <View style={[styles.breakdownBar, { width: `${Math.max(cat.pct, 2)}%` as `${number}%`, backgroundColor: cat.color }]} />
          </View>
          <Text style={styles.breakdownAmount}>{fmt(cat.curr, currency)}</Text>
        </View>
      ))}
    </View>
  );
}

function buildPreviewPoints(
  transactions: Transaction[],
  uid: UserId,
  selectedYM: string,
  kind: FinanceTrendKind,
  selectedCategoryIds: CategoryFilterId[],
  budgetCategoryIds: CategoryFilterId[],
  forceLastDay?: number,
): ChartPoint[] {
  const [y, m] = selectedYM.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const lastDay = Math.min(forceLastDay ?? daysInMonth, daysInMonth);

  let running = 0;
  return Array.from({ length: lastDay }, (_, i) => {
    const day = i + 1;
    const dateStr = `${selectedYM}-${String(day).padStart(2, '0')}`;
    const daily = transactions
      .filter((t) =>
        t.uid === uid &&
        !t.del &&
        t.kind === kind &&
        isMonthVisible(t, selectedYM) &&
        getOccurrenceDatesInMonth(t, selectedYM).includes(dateStr) &&
        categoryMatches(t, selectedCategoryIds, budgetCategoryIds),
      )
      .reduce((sum, t) => sum + t.amt, 0);
    running = Math.max(0, running + daily);
    return { ym: dateStr, label: String(day), value: running, hasActivity: daily > 0 };
  });
}

function buildDailyPoints(
  transactions: Transaction[],
  uid: UserId,
  selectedYM: string,
  kind: FinanceTrendKind,
  selectedCategoryIds: CategoryFilterId[],
  budgetCategoryIds: CategoryFilterId[],
): ChartPoint[] {
  const [y, m] = selectedYM.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const now = new Date();
  const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const lastDay = selectedYM === currentYM ? now.getDate() : daysInMonth;

  let running = 0;
  return Array.from({ length: lastDay }, (_, i) => {
    const day = i + 1;
    const dateStr = `${selectedYM}-${String(day).padStart(2, '0')}`;
    const daily = transactions
      .filter((t) =>
        t.uid === uid &&
        !t.del &&
        t.kind === kind &&
        isMonthVisible(t, selectedYM) &&
        getOccurrenceDatesInMonth(t, selectedYM).includes(dateStr) &&
        categoryMatches(t, selectedCategoryIds, budgetCategoryIds),
      )
      .reduce((sum, t) => sum + t.amt, 0);
    running = Math.max(0, running + daily);
    return { ym: dateStr, label: String(day), value: running, hasActivity: daily > 0 };
  });
}

function buildWeeklyPoints(
  transactions: Transaction[],
  uid: UserId,
  selectedYM: string,
  kind: FinanceTrendKind,
  selectedCategoryIds: CategoryFilterId[],
  budgetCategoryIds: CategoryFilterId[],
): ChartPoint[] {
  return [1, 2, 3, 4].map((week) => ({
    ym: `${selectedYM}-W${week}`,
    label: `Sem ${week}`,
    value: transactions
      .filter((t) => (
        t.uid === uid &&
        !t.del &&
        t.kind === kind &&
        isMonthVisible(t, selectedYM) &&
        getTransactionWeeks(t, selectedYM).includes(week) &&
        categoryMatches(t, selectedCategoryIds, budgetCategoryIds)
      ))
      .reduce((sum, t) => sum + t.amt, 0),
  }));
}

function getTransactionWeeks(t: Transaction, selectedYM: string): number[] {
  return getOccurrenceDatesInMonth(t, selectedYM).map((date) => {
    const day = Number(date.slice(8, 10));
    if (day <= 7) return 1;
    if (day <= 14) return 2;
    if (day <= 21) return 3;
    return 4;
  });
}

function categoryMatches(
  transaction: Transaction,
  selectedCategoryIds: CategoryFilterId[],
  budgetCategoryIds: CategoryFilterId[],
): boolean {
  const rawCategoryId = transaction.budgetCatId === undefined ? undefined : String(transaction.budgetCatId);
  const transactionCategoryId = rawCategoryId === undefined || !budgetCategoryIds.includes(rawCategoryId)
    ? UNCATEGORIZED_ID
    : rawCategoryId;
  return selectedCategoryIds.includes(transactionCategoryId);
}

function MonthPickerDropdown({
  anchorY,
  ym,
  onChange,
  onClose,
}: {
  anchorY: number;
  ym: string;
  onChange: (ym: string) => void;
  onClose: () => void;
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const anim = useRef(new Animated.Value(0)).current;
  const year = Number(ym.slice(0, 4));
  const month = Number(ym.slice(5, 7));
  const [pickerYear, setPickerYear] = useState(year);

  useEffect(() => {
    Animated.spring(anim, { toValue: 1, useNativeDriver: true, damping: 22, stiffness: 300, mass: 0.8 }).start();
  }, [anim]);

  const close = (then?: () => void) => {
    Animated.timing(anim, { toValue: 0, duration: 160, useNativeDriver: true }).start(() => {
      then?.();
      onClose();
    });
  };

  return (
    <Pressable style={[StyleSheet.absoluteFill, { zIndex: 100 }]} onPress={() => close()}>
      <Animated.View
        style={[
          styles.monthDropdownCard,
          {
            top: anchorY + 8,
            opacity: anim,
            transform: [
              { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) },
              { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }) },
            ],
          },
        ]}
      >
        <Pressable onPress={() => {}} style={styles.monthDropdownInner}>
          <View style={styles.monthDropdownYearRow}>
            <Pressable
              onPress={() => setPickerYear((y) => y - 1)}
              style={({ pressed }) => [styles.monthNavBtn, pressed && styles.pressed]}
            >
              <Ionicons name="chevron-back" size={20} color={theme.textSecondary} />
            </Pressable>
            <Text style={styles.pickerYearText}>{pickerYear}</Text>
            <Pressable
              onPress={() => setPickerYear((y) => y + 1)}
              style={({ pressed }) => [styles.monthNavBtn, pressed && styles.pressed]}
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
                  onPress={() => close(() => onChange(`${pickerYear}-${String(m).padStart(2, '0')}`))}
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
        </Pressable>
      </Animated.View>
    </Pressable>
  );
}

function getMonthShortLabel(ym: string): string {
  const month = Number(ym.slice(5, 7));
  return ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'][month - 1] ?? ym;
}

function getComparison(current: number, previous: number, kind: FinanceTrendKind, theme: AppTheme) {
  const difference = current - previous;
  const percentage = previous > 0
    ? Math.abs((difference / previous) * 100)
    : current > 0
      ? 100
      : 0;
  const increased = difference >= 0;
  const goodForUser = kind === 'income' ? increased : !increased;
  const color = goodForUser ? theme.income : theme.expense;
  const bg = goodForUser ? 'rgba(22, 163, 74, 0.18)' : 'rgba(236, 17, 71, 0.18)';
  const label = `${increased ? '+' : '-'}${percentage.toFixed(0)}%`;

  return {
    bg,
    color,
    icon: increased ? 'trending-up' as const : 'trending-down' as const,
    label,
  };
}

const makeStyles = (theme: AppTheme) => StyleSheet.create({
  backdrop: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    flex: 1,
    justifyContent: 'center',
    padding: 18,
  },
  breakdownAmount: {
    color: theme.textMuted,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
    textAlign: 'right',
  },
  breakdownBar: {
    borderRadius: 999,
    height: '100%',
  },
  breakdownBarTrack: {
    backgroundColor: theme.mode === 'light' ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.08)',
    borderRadius: 999,
    height: 6,
    marginVertical: 4,
    overflow: 'hidden',
  },
  breakdownChip: {
    alignItems: 'center',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  breakdownChipText: {
    fontSize: 10,
    fontWeight: '800',
  },
  breakdownList: {
    gap: 12,
    marginTop: 6,
  },
  breakdownName: {
    color: theme.textPrimary,
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
  },
  breakdownPct: {
    color: theme.textMuted,
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'right',
  },
  breakdownRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  breakdownTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    width: '100%',
  },
  emptyText: {
    color: theme.textMuted,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  modalCard: {
    backgroundColor: theme.background,
  },
  modalContent: {
    padding: 22,
  },
  modalHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalKicker: {
    color: theme.textMuted,
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 3,
  },
  modalShadow: {
    borderRadius: 22,
    elevation: 14,
    maxWidth: 560,
    shadowColor: theme.textPrimary,
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.24,
    shadowRadius: 30,
    width: '100%',
  },
  modalTitle: {
    color: theme.textPrimary,
    fontSize: 22,
    fontWeight: '400',
    lineHeight: 28,
  },
  modalTitleWrap: {
    flex: 1,
    paddingRight: 12,
  },
  pressed: {
    opacity: 0.72,
  },
  previewCard: {
    backgroundColor: theme.surface,
    borderRadius: 18,
    elevation: 3,
    padding: 14,
    shadowColor: theme.shadowColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: theme.mode === 'light' ? 0.08 : 0.10,
    shadowRadius: 8,
  },
  previewChart: {
    width: '100%',
  },
  previewChip: {
    alignItems: 'center',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  previewChipText: {
    fontSize: 11,
    fontWeight: '800',
  },
  previewDot: {
    borderRadius: 999,
    height: 7,
    width: 7,
  },
  previewHead: {
    alignItems: 'baseline',
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
  },
  previewMetricLabel: {
    color: theme.textSecondary,
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
  },
  previewMetricRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  previewMetrics: {
    gap: 6,
    marginBottom: 10,
  },
  previewMonth: {
    color: theme.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  previewTitle: {
    color: theme.textPrimary,
    fontSize: 18,
    fontWeight: '600',
  },
  scrubberAmount: {
    fontSize: 12,
    fontWeight: '800',
  },
  scrubberDate: {
    color: theme.textMuted,
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
  },
  scrubberDetail: {
    height: 22,
    justifyContent: 'center',
    marginTop: 8,
  },
  scrubberDetailRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
  },
  scrubberEmpty: {
    color: theme.textMuted,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  scrubberHint: {
    color: theme.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  scrubberHintRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
  },
  scrubberLine: {
    backgroundColor: theme.border,
    borderRadius: 999,
    height: 3,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 8,
  },
  scrubberThumb: {
    backgroundColor: '#4B5563',
    borderColor: theme.border,
    borderRadius: 999,
    borderWidth: 2,
    height: 18,
    position: 'absolute',
    top: 1,
    width: 18,
  },
  scrubberThumbResting: {
    opacity: 0.45,
  },
  scrubberTrackWrap: {
    height: 20,
    marginBottom: 4,
    marginTop: 8,
    position: 'relative',
  },
  summaryCard: {
    backgroundColor: theme.surface,
    borderRadius: 16,
    elevation: 4,
    flex: 1,
    padding: 14,
    shadowColor: theme.shadowColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: theme.mode === 'light' ? 0.08 : 0.10,
    shadowRadius: 10,
  },
  summaryCardAmount: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 26,
    lineHeight: 32,
    marginBottom: 6,
  },
  summaryCardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    marginBottom: 6,
  },
  summaryCardLabel: {
    color: theme.textMuted,
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
  },
  summaryChangeRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  summaryChangeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  summaryDot: {
    borderRadius: 999,
    height: 7,
    width: 7,
  },
  summaryPanel: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
    marginTop: 14,
  },
  monthDropdownCard: {
    backgroundColor: theme.surface,
    borderRadius: 20,
    left: 16,
    position: 'absolute',
    right: 16,
    ...SURFACE_SHADOW,
  },
  monthDropdownInner: {
    padding: 20,
  },
  monthDropdownYearRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  monthNavBtn: {
    alignItems: 'center',
    backgroundColor: theme.surface,
    borderRadius: 12,
    height: 42,
    justifyContent: 'center',
    width: 42,
    ...SURFACE_SHADOW,
  },
  pickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pickerCell: {
    alignItems: 'center',
    borderRadius: 12,
    justifyContent: 'center',
    paddingVertical: 12,
    width: '30%',
  },
  pickerCellActive: {
    backgroundColor: '#7C3AED',
  },
  pickerCellText: {
    color: theme.textPrimary,
    fontSize: 14,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  pickerCellTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  pickerYearText: {
    color: theme.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
});
