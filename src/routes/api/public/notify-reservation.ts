import { createFileRoute } from '@tanstack/react-router'
import { createClient } from '@supabase/supabase-js'
import * as React from 'react'
import { render } from '@react-email/components'
import { z } from 'zod'
import { TEMPLATES } from '@/lib/email-templates/registry'
import { sendPushToAudience } from '@/lib/push.server'

const SITE_NAME = 'Taxi City Bordeaux'
const SENDER_DOMAIN = 'notify.taxicitybordeaux.fr'
const FROM_DOMAIN = 'taxicitybordeaux.fr'
const TEMPLATE_NAME = 'reservation-notification'

const schema = z.object({
  reservation_id: z.string().uuid(),
})

export const Route = createFileRoute('/api/public/notify-reservation')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
        if (!supabaseUrl || !serviceKey) {
          return Response.json({ error: 'Server config error' }, { status: 500 })
        }

        let raw: unknown
        try { raw = await request.json() } catch {
          return Response.json({ error: 'Invalid JSON' }, { status: 400 })
        }
        const parsed = schema.safeParse(raw)
        if (!parsed.success) {
          return Response.json({ error: 'Invalid payload' }, { status: 400 })
        }
        const reservationId = parsed.data.reservation_id

        const supabase = createClient(supabaseUrl, serviceKey)

        // Pull the reservation server-side. The caller only sends an id, so they
        // cannot fabricate the contents of the notification email to the operator.
        const { data: reservation, error: lookupError } = await supabase
          .from('reservations')
          .select('id, nom, telephone, email, pickup_datetime, depart, arrivee, passagers, bagages, service_type, message')
          .eq('id', reservationId)
          .maybeSingle()
        if (lookupError) return Response.json({ error: 'lookup' }, { status: 500 })
        if (!reservation) return Response.json({ error: 'not_found' }, { status: 404 })

        const data = reservation
        const template = TEMPLATES[TEMPLATE_NAME]
        if (!template || !template.to) {
          return Response.json({ error: 'Template not configured' }, { status: 500 })
        }
        const recipient = template.to
        const messageId = crypto.randomUUID()
        const idempotencyKey = `reservation-${reservationId}`

        // Idempotency gate: insert log row first; the unique index on
        // idempotency_key (where status <> 'failed') rejects duplicates.
        const { error: logError } = await supabase.from('email_send_log').insert({
          message_id: messageId,
          template_name: TEMPLATE_NAME,
          recipient_email: recipient,
          status: 'pending',
          idempotency_key: idempotencyKey,
        })
        if (logError) {
          if ((logError as any).code === '23505') {
            return Response.json({ success: true, deduped: true })
          }
          return Response.json({ error: 'log' }, { status: 500 })
        }

        const element = React.createElement(template.component, data)
        const html = await render(element)
        const text = await render(element, { plainText: true })
        const subject = typeof template.subject === 'function'
          ? template.subject(data as any)
          : template.subject

        // ensure unsubscribe token (one per email address)
        const normalized = recipient.toLowerCase()
        let unsubscribeToken: string
        const { data: existing } = await supabase
          .from('email_unsubscribe_tokens')
          .select('token, used_at')
          .eq('email', normalized)
          .maybeSingle()
        if (existing && !existing.used_at) {
          unsubscribeToken = existing.token
        } else {
          const bytes = new Uint8Array(32)
          crypto.getRandomValues(bytes)
          unsubscribeToken = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
          await supabase.from('email_unsubscribe_tokens').upsert(
            { token: unsubscribeToken, email: normalized },
            { onConflict: 'email', ignoreDuplicates: true },
          )
          const { data: stored } = await supabase
            .from('email_unsubscribe_tokens')
            .select('token').eq('email', normalized).maybeSingle()
          if (stored?.token) unsubscribeToken = stored.token
        }

        const { error: enqueueError } = await supabase.rpc('enqueue_email', {
          queue_name: 'transactional_emails',
          payload: {
            message_id: messageId,
            to: recipient,
            from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
            sender_domain: SENDER_DOMAIN,
            subject,
            html,
            text,
            purpose: 'transactional',
            label: TEMPLATE_NAME,
            idempotency_key: idempotencyKey,
            unsubscribe_token: unsubscribeToken,
            queued_at: new Date().toISOString(),
          },
        })

        if (enqueueError) {
          // Mark as failed so the unique index allows a retry.
          await supabase.from('email_send_log')
            .update({ status: 'failed', error_message: 'Failed to enqueue' })
            .eq('message_id', messageId)
          return Response.json({ error: 'Enqueue failed' }, { status: 500 })
        }

        // Fire-and-forget push to admins (don't block the email flow)
        try {
          await sendPushToAudience('admin', {
            title: '🆕 Nouvelle réservation',
            body: `${reservation.nom} · ${reservation.depart} → ${reservation.arrivee}`,
            url: '/admin/dashboard',
            tag: `new-res-${reservationId}`,
            requireInteraction: true,
          })
        } catch (e) {
          console.error('[push] admin notify failed', e)
        }

        return Response.json({ success: true })
      },
    },
  },
})
