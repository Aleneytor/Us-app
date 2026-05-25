import type { CurrencyCode } from '../types';
import { MONTHS_ES } from '../utils/format';
import { GuidelineCard } from './GuidelineCard';
import type { GuidelineCardItem } from './GuidelineCard';

export type CardState = 'saldo' | 'gastos';

interface BalanceCardProps {
  saldoActual: number;
  saldoProyectado: number;
  gastosActual: number;
  gastosProyectados: number;
  currency: CurrencyCode;
  selectedYM: string;
  variant?: 'default' | 'gradient';
  onStateChange: (state: CardState) => void;
  onSwipeBegin?: () => void;
  onSwipeEnd?: () => void;
  onPillToggle?: (expanded: boolean) => void;
}

const STATES: CardState[] = ['saldo', 'gastos'];

const STATE_META: Record<CardState, {
  accent: string;
  pillBg: string;
  pillColor: string;
  pillLabel: (monthName: string) => string;
}> = {
  saldo: {
    accent: '#25C55B',
    pillBg: 'rgba(22, 163, 74, 0.18)',
    pillColor: '#25C55B',
    pillLabel: (monthName) => `Saldo previsto al\nfinal de ${monthName}`,
  },
  gastos: {
    accent: '#EC1147',
    pillBg: 'rgba(236, 17, 71, 0.18)',
    pillColor: '#EC1147',
    pillLabel: (monthName) => `Gastos previstos\nde ${monthName}`,
  },
};

export function BalanceCard({
  saldoActual,
  saldoProyectado,
  gastosActual,
  gastosProyectados,
  currency,
  selectedYM,
  variant = 'default',
  onStateChange,
  onSwipeBegin,
  onSwipeEnd,
  onPillToggle,
}: BalanceCardProps) {
  const monthIndex = Number(selectedYM.split('-')[1]) - 1;
  const monthName = MONTHS_ES[monthIndex] ?? '';
  const values: Record<CardState, { primary: number; secondary: number }> = {
    saldo: { primary: saldoActual, secondary: saldoProyectado },
    gastos: { primary: gastosActual, secondary: gastosProyectados },
  };
  const items: GuidelineCardItem<CardState>[] = STATES.map((state) => {
    const meta = STATE_META[state];

    return {
      key: state,
      value: values[state].primary,
      accent: meta.accent,
      pill: {
        value: values[state].secondary,
        backgroundColor: meta.pillBg,
        color: meta.pillColor,
        label: meta.pillLabel(monthName),
      },
    };
  });

  return (
    <GuidelineCard
      items={items}
      currency={currency}
      amountColor={variant === 'gradient' ? '#FFFFFF' : undefined}
      amountMutedOpacity={variant === 'gradient' ? 0.62 : undefined}
      toggleColor={variant === 'gradient' ? '#FFFFFF' : undefined}
      indicatorActiveColor={variant === 'gradient' ? '#FFFFFF' : undefined}
      indicatorInactiveColor={variant === 'gradient' ? 'rgba(255,255,255,0.42)' : undefined}
      onStateChange={onStateChange}
      onSwipeBegin={onSwipeBegin}
      onSwipeEnd={onSwipeEnd}
      onPillToggle={onPillToggle}
    />
  );
}
