// NOTE: react-native-url-polyfill must be imported BEFORE this module loads.
// It is imported in app/_layout.tsx as the very first side-effect.
import { createClient } from '@supabase/supabase-js';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { AppPayload } from '../types';

const SUPABASE_URL = 'https://kjihuesxwubqbyetlaet.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtqaWh1ZXN4d3VicWJ5ZXRsYWV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyMjEyMDksImV4cCI6MjA4OTc5NzIwOX0.RrNEzVkCQ7HlD3n32XLOhWtG6drd0ipxv2gdVMbxFR8';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

function isValidPayload(p: unknown): p is AppPayload {
  if (!p || typeof p !== 'object') return false;
  const obj = p as Record<string, unknown>;
  return (
    Array.isArray(obj.expenses) &&
    Array.isArray(obj.wishlist) &&
    Array.isArray(obj.goals) &&
    Array.isArray(obj.contribs)
  );
}

export async function fetchSnapshot(roomId: string): Promise<AppPayload | null> {
  const { data, error } = await supabase
    .from('shared_state')
    .select('payload')
    .eq('room_id', roomId)
    .maybeSingle();

  if (error) {
    console.error('[supabase] fetchSnapshot error:', error.message);
    return null;
  }

  return isValidPayload(data?.payload) ? (data!.payload as AppPayload) : null;
}

export async function pushSnapshot(
  roomId: string,
  payload: AppPayload,
  clientId: string,
): Promise<boolean> {
  const { error } = await supabase.from('shared_state').upsert(
    {
      room_id: roomId,
      payload,
      updated_by: clientId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'room_id' },
  );

  if (error) {
    console.error('[supabase] pushSnapshot error:', error.message);
    return false;
  }
  return true;
}

export function subscribeToRoom(
  roomId: string,
  clientId: string,
  onUpdate: (payload: AppPayload) => void,
): RealtimeChannel {
  return supabase
    .channel(`room:${roomId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'shared_state',
        filter: `room_id=eq.${roomId}`,
      },
      (event) => {
        const row = (event as { new?: Record<string, unknown> }).new;
        if (!row || row['updated_by'] === clientId) return;
        if (isValidPayload(row['payload'])) {
          onUpdate(row['payload'] as AppPayload);
        }
      },
    )
    .subscribe();
}
