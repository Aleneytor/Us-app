import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { Transaction } from '../types';

const REMINDER_DAYS = [7, 3, 1] as const;
const CHANNEL_ID = 'transaction-reminders';

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: 'Recordatorios de movimientos',
        importance: Notifications.AndroidImportance.DEFAULT,
        sound: 'default',
      });
    }

    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;

    const requested = await Notifications.requestPermissionsAsync();
    return requested.granted;
  } catch (err) {
    console.warn('[notifications] permission request failed:', err);
    return false;
  }
}

export async function scheduleTransactionReminder(
  transaction: Transaction,
  dueDate: string,
  daysAhead: number[] = [3, 1],
): Promise<void> {
  if (Platform.OS === 'web') return;
  if (!dueDate || !dueDate.includes('-')) return;

  const [year, month, day] = dueDate.split('-').map(Number);
  if (!year || !month || !day) return;

  await cancelTransactionReminders(transaction.id);

  for (const days of daysAhead) {
    const triggerDate = new Date(year, month - 1, day, 9, 0, 0);
    triggerDate.setDate(triggerDate.getDate() - days);
    if (triggerDate <= new Date()) continue;

    const identifier = reminderId(transaction.id, days);
    const label = days === 1 ? 'mañana' : `en ${days} días`;
    const action = transaction.kind === 'expense' ? 'pagar' : 'recibir';

    await Notifications.scheduleNotificationAsync({
      identifier,
      content: {
        title: `Movimiento próximo: ${transaction.desc || 'Sin descripción'}`,
        body: `Debes ${action} ${label}.`,
        data: {
          transactionId: transaction.id,
          dueDate,
          kind: transaction.kind,
        },
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerDate,
        channelId: CHANNEL_ID,
      },
    });
  }
}

export async function cancelTransactionReminders(transactionId: number): Promise<void> {
  if (Platform.OS === 'web') return;
  await Promise.all(
    REMINDER_DAYS.map((days) =>
      Notifications.cancelScheduledNotificationAsync(reminderId(transactionId, days)),
    ),
  );
}

function reminderId(transactionId: number, days: number): string {
  return `tx-${transactionId}-${days}d`;
}
