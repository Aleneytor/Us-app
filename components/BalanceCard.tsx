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
  onStateChange: (state: CardState) => void;
  onSwipeBegin?: () => void;
  onSwipeEnd?: () => void;
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
    pillBg: '#DCFCE7',
    pillColor: '#25C55B',
    pillLabel: (monthName) => `Saldo previsto al\nfinal de ${monthName}`,
  },
  gastos: {
    accent: '#EC1147',
    pillBg: '#FFE4E6',
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
  onStateChange,
  onSwipeBegin,
  onSwipeEnd,
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
      onStateChange={onStateChange}
      onSwipeBegin={onSwipeBegin}
      onSwipeEnd={onSwipeEnd}
    />
  );
}
