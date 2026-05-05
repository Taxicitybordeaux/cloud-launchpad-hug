import { createFileRoute } from '@tanstack/react-router'
import { createClient } from '@supabase/supabase-js'
import * as React from 'react'
import { render } from '@react-email/components'
import { z } from 'zod'
import { TEMPLATES } from '@/lib/email-templates/registry'

const SITE_NAME = 'Taxi City Bordeaux'
const SENDER_DOMAIN = 'notify.taxicitybordeaux.fr'
const FROM_DOMAIN = 'taxicitybordeaux.fr'
const TEMPLATE_NAME = 'contact-message'

const schema = z.object({
  nom: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(255),
  telephone: z.string().trim().max(30).optional().nullable(),
  sujet: z.string().trim().max(120).optional().nullable(),
  message: z.string().trim().min(10).max(2000),
})

export const Route = createFileRoute('/api/public/contact')({
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
        const data = parsed.data

        const supabase = createClient(supabaseUrl, serviceKey)
        const template = TEMPLATES[TEMPLATE_NAME]
        if (!template || !template.to) {
          return Response.json({ error: 'Template not configured' }, { status: 500 })
        }
        const recipient = template.to
        const messageId = crypto.randomUUID()

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

        await supabase.from('email_send_log').insert({
          message_id: messageId,
          template_name: TEMPLATE_NAME,
          recipient_email: recipient,
          status: 'pending',
        })

        const { error: enqueueError } = await supabase.rpc('enqueue_email', {
          queue_name: 'transactional_emails',
          payload: {
            message_id: messageId,
            to: recipient,
            from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
            reply_to: data.email,
            sender_domain: SENDER_DOMAIN,
            subject,
            html,
            text,
            purpose: 'transactional',
            label: TEMPLATE_NAME,
            idempotency_key: messageId,
            unsubscribe_token: unsubscribeToken,
            queued_at: new Date().toISOString(),
          },
        })

        if (enqueueError) {
          await supabase.from('email_send_log').insert({
            message_id: messageId,
            template_name: TEMPLATE_NAME,
            recipient_email: recipient,
            status: 'failed',
            error_message: 'Failed to enqueue',
          })
          return Response.json({ error: 'Enqueue failed' }, { status: 500 })
        }

        return Response.json({ success: true })
      },
    },
  },
})
