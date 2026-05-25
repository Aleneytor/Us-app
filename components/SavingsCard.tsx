import type { CurrencyCode } from '../types';
import { GuidelineCard } from './GuidelineCard';
import type { GuidelineCardItem } from './GuidelineCard';

export type SavingsCardState = 'ahorrado' | 'objetivo';

interface SavingsCardProps {
  saved: number;
  target: number;
  currency: CurrencyCode;
  showObjectiveSlide?: boolean;
  showPillToggle?: boolean;
  variant?: 'default' | 'gradient';
  onStateChange?: (state: SavingsCardState) => void;
  onSwipeBegin?: () => void;
  onSwipeEnd?: () => void;
}

const SAVINGS_ACCENT = '#7C3AED';

const ITEMS_META: Record<SavingsCardState, {
  pillLabel: string;
}> = {
  ahorrado: {
    pillLabel: 'Objetivo total',
  },
  objetivo: {
    pillLabel: 'Ahorrado hasta hoy',
  },
};

export function SavingsCard({
  saved,
  target,
  currency,
  showObjectiveSlide = true,
  showPillToggle = true,
  variant = 'default',
  onStateChange,
  onSwipeBegin,
  onSwipeEnd,
}: SavingsCardProps) {
  const values: Record<SavingsCardState, { primary: number; secondary: number }> = {
    ahorrado: { primary: saved, secondary: target },
    objetivo: { primary: target, secondary: saved },
  };

  const states: SavingsCardState[] = showObjectiveSlide ? ['ahorrado', 'objetivo'] : ['ahorrado'];

  const items: GuidelineCardItem<SavingsCardState>[] = states.map((state) => ({
    key: state,
    value: values[state].primary,
    accent: SAVINGS_ACCENT,
    pill: {
      value: values[state].secondary,
      backgroundColor: 'rgba(124, 58, 237, 0.18)',
      color: SAVINGS_ACCENT,
      label: ITEMS_META[state].pillLabel,
    },
  }));

  return (
    <GuidelineCard
      items={items}
      currency={currency}
      showPillToggle={showPillToggle}
      amountColor={variant === 'gradient' ? '#FFFFFF' : undefined}
      amountMutedOpacity={variant === 'gradient' ? 0.62 : undefined}
      toggleColor={variant === 'gradient' ? '#FFFFFF' : undefined}
      indicatorActiveColor={variant === 'gradient' ? '#FFFFFF' : undefined}
      indicatorInactiveColor={variant === 'gradient' ? 'rgba(255,255,255,0.42)' : undefined}
      onStateChange={onStateChange}
      onSwipeBegin={onSwipeBegin}
      onSwipeEnd={onSwipeEnd}
    />
  );
}
