import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { supabaseAdmin } from '@/integrations/supabase/client.server';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { sendPushToAudience } from '@/lib/push.server';

export type PushAudience = 'admin' | 'chauffeur' | 'client';

export const getVapidPublicKey = createServerFn({ method: 'GET' }).handler(async () => {
  return { key: process.env.VAPID_PUBLIC_KEY ?? '' };
});

const subSchema = z.object({
  audience: z.enum(['admin', 'chauffeur', 'client']),
  endpoint: z.string().url().max(2000),
  p256dh: z.string().min(1).max(500),
  auth: z.string().min(1).max(500),
  reservation_id: z.string().uuid().optional().nullable(),
  user_agent: z.string().max(500).optional().nullable(),
});

export const subscribePush = createServerFn({ method: 'POST' })
  .inputValidator((input) => subSchema.parse(input))
  .handler(async ({ data }) => {
    // upsert by endpoint
    const { error } = await supabaseAdmin.from('push_subscriptions').upsert(
      {
        audience: data.audience,
        endpoint: data.endpoint,
        p256dh: data.p256dh,
        auth: data.auth,
        reservation_id: data.reservation_id ?? null,
        user_agent: data.user_agent ?? null,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: 'endpoint' },
    );
    if (error) {
      console.error('[push] subscribe failed', error);
      throw new Error('subscribe_failed');
    }
    return { ok: true };
  });

export const unsubscribePush = createServerFn({ method: 'POST' })
  .inputValidator((input) => z.object({ endpoint: z.string().url().max(2000) }).parse(input))
  .handler(async ({ data }) => {
    await supabaseAdmin.from('push_subscriptions').delete().eq('endpoint', data.endpoint);
    return { ok: true };
  });

export const sendTestPush = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ audience: z.enum(['admin', 'chauffeur', 'client']) }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: roles } = await context.supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', context.userId)
      .eq('role', 'admin')
      .maybeSingle();
    if (!roles) throw new Error('forbidden');
    const result = await sendPushToAudience(data.audience, {
      title: '🔔 Test notification',
      body: `Notification test envoyée à l'audience « ${data.audience} ».`,
      url: data.audience === 'admin' ? '/admin/dashboard' : data.audience === 'chauffeur' ? '/chauffeur' : '/',
      tag: 'test-push',
    });
    return result;
  });

export const notifyReservationStatus = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        reservation_id: z.string().uuid(),
        status: z.enum(['accepted', 'refused', 'en_route', 'arrived', 'completed', 'cancelled']),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    // admin-only
    const { data: roles } = await context.supabase
      .from('user_roles').select('role').eq('user_id', context.userId).eq('role', 'admin').maybeSingle();
    if (!roles) throw new Error('forbidden');

    const { data: r } = await supabaseAdmin
      .from('reservations')
      .select('id, nom, client_name, depart, arrivee, destination, tracking_id')
      .eq('id', data.reservation_id)
      .maybeSingle();
    if (!r) throw new Error('not_found');

    const labels: Record<string, { title: string; body: string }> = {
      accepted: { title: '✅ Course acceptée', body: 'Votre course a été confirmée par le chauffeur.' },
      refused: { title: '❌ Course refusée', body: 'Votre demande n\'a pas pu être acceptée.' },
      en_route: { title: '🚗 Chauffeur en route', body: 'Le chauffeur est en route vers vous.' },
      arrived: { title: '📍 Chauffeur arrivé', body: 'Le chauffeur est arrivé au point de prise en charge.' },
      completed: { title: '🏁 Course terminée', body: 'Merci d\'avoir voyagé avec Taxi City Bordeaux.' },
      cancelled: { title: 'Course annulée', body: 'Votre course a été annulée.' },
    };
    const l = labels[data.status];
    const url = r.tracking_id ? `/suivi/${r.tracking_id}` : `/reservation/${r.id}`;

    const result = await sendPushToAudience('client', { ...l, url, tag: `res-${r.id}` }, { reservationId: r.id });

    // Lors de l'acceptation, prévenir aussi les chauffeurs (course assignée)
    let chauffeurResult = { sent: 0, removed: 0 };
    if (data.status === 'accepted') {
      const clientName = r.client_name || r.nom || 'Client';
      const trajet = `${r.depart} → ${r.arrivee || r.destination || '—'}`;
      chauffeurResult = await sendPushToAudience('chauffeur', {
        title: '🚕 Nouvelle course assignée',
        body: `${clientName} — ${trajet}`,
        url: '/chauffeur',
        tag: `assign-${r.id}`,
        requireInteraction: true,
      });
    }

    return { client: result, chauffeur: chauffeurResult };
  });
