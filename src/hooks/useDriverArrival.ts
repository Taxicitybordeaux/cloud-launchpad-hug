/**
 * useDriverArrival — Le chauffeur déclenche "J'arrive dans ~5 min".
 * 1) Met à jour reservations.status → 'en_route'
 * 2) Envoie une push au client via notifyReservationStatus (server function)
 */
import { useCallback, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { supabase } from '@/integrations/supabase/client';
import { notifyReservationStatus } from '@/lib/push.functions';

type ArrivalStatus = 'idle' | 'sending' | 'sent' | 'error';

export function useDriverArrival() {
  const [status, setStatus] = useState<ArrivalStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const notify = useServerFn(notifyReservationStatus);

  const notifyArrival = useCallback(
    async (reservationId: string): Promise<boolean> => {
      if (!reservationId) return false;
      setStatus('sending');
      setError(null);
      try {
        const { error: updateError } = await supabase
          .from('reservations')
          .update({ status: 'en_route' })
          .eq('id', reservationId);
        if (updateError) throw new Error(updateError.message);

        try {
          await notify({ data: { reservation_id: reservationId, status: 'en_route' } });
        } catch (pushErr) {
          // Best-effort : le status est déjà à jour
          console.warn('[useDriverArrival] push failed:', pushErr);
        }

        setStatus('sent');
        return true;
      } catch (err: any) {
        console.error('[useDriverArrival] error:', err);
        setError(String(err?.message ?? err));
        setStatus('error');
        return false;
      }
    },
    [notify],
  );

  const reset = useCallback(() => {
    setStatus('idle');
    setError(null);
  }, []);

  return {
    notifyArrival,
    status,
    error,
    sending: status === 'sending',
    sent: status === 'sent',
    reset,
  };
}
