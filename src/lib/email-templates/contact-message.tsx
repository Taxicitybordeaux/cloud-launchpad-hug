import {
  Body, Container, Head, Heading, Hr, Html, Preview, Section, Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  nom?: string
  email?: string
  telephone?: string
  sujet?: string
  message?: string
}

const ContactMessageEmail = (p: Props) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Nouveau message de {p.nom ?? 'un visiteur'}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Nouveau message de contact</Heading>
        <Text style={lead}>
          Vous avez reçu un nouveau message via le formulaire de contact du site.
        </Text>

        <Section style={card}>
          <Row label="Nom" value={p.nom} />
          <Row label="Email" value={p.email} />
          <Row label="Téléphone" value={p.telephone || '—'} />
          <Row label="Sujet" value={p.sujet || '—'} />
          <Hr style={hr} />
          <Text style={messageLabel}>Message :</Text>
          <Text style={messageBody}>{p.message || '—'}</Text>
        </Section>

        <Text style={footer}>
          Répondez directement à {p.email ?? 'l\'email du client'} pour le recontacter.
        </Text>
      </Container>
    </Body>
  </Html>
)

const Row = ({ label, value }: { label: string; value?: string }) => (
  <Text style={row}>
    <span style={rowLabel}>{label} : </span>
    <span style={rowValue}>{value || '—'}</span>
  </Text>
)

export const template = {
  component: ContactMessageEmail,
  subject: (d: Record<string, any>) =>
    `Contact site — ${d?.sujet || 'message'} (${d?.nom ?? 'visiteur'})`,
  displayName: 'Message de contact',
  to: 'taxi.city0033@gmail.com',
  previewData: {
    nom: 'Marie Dupont',
    email: 'marie@example.com',
    telephone: '06 12 34 56 78',
    sujet: 'Devis longue distance',
    message: 'Bonjour, je souhaiterais un devis pour un trajet Bordeaux → Paris dimanche prochain. Merci !',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px', maxWidth: '560px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#0a0a0a', margin: '0 0 12px' }
const lead = { fontSize: '14px', color: '#55575d', lineHeight: '1.5', margin: '0 0 20px' }
const card = { background: '#fafafa', border: '1px solid #e5e5e5', borderRadius: '8px', padding: '16px 18px' }
const row = { fontSize: '14px', color: '#222', margin: '6px 0', lineHeight: '1.5' }
const rowLabel = { color: '#666', fontWeight: 600 }
const rowValue = { color: '#111' }
const hr = { borderColor: '#e5e5e5', margin: '12px 0' }
const messageLabel = { fontSize: '13px', fontWeight: 600 as const, color: '#666', margin: '4px 0' }
const messageBody = { fontSize: '14px', color: '#111', lineHeight: '1.6', whiteSpace: 'pre-wrap' as const, margin: '0' }
const footer = { fontSize: '12px', color: '#999', margin: '20px 0 0' }
