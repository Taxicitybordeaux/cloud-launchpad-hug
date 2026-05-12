import { Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { BRAND, brandBar, brandTag, button, container, divider, footer, h1, main, text } from './_brand'

interface Props {
  nom?: string
  depart?: string
  arrivee?: string
  pickup_datetime?: string
  tracking_url?: string
}

const Email = (p: Props) => {
  const url = p.tracking_url || 'https://taxicitybordeaux.fr'
  return (
    <Html lang="fr" dir="ltr">
      <Head />
      <Preview>Votre course est confirmée — suivez votre chauffeur en temps réel</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={brandBar}>Taxi City Bordeaux</Text>
          <Text style={brandTag}>Course confirmée</Text>

          <Heading style={h1}>Bonjour {p.nom || ''}, votre course est acceptée ✅</Heading>

          <Text style={text}>
            Votre chauffeur est prévenu et arrive vers vous. Pour suivre sa position en temps réel,
            voir le prix estimé et le temps d'arrivée, ouvrez votre lien de suivi personnel ci-dessous.
          </Text>

          <Section style={{ textAlign: 'center', margin: '8px 0 28px' }}>
            <Button href={url} style={button}>📍 Suivre mon chauffeur</Button>
          </Section>

          <Text style={{ ...text, fontSize: '13px', color: BRAND.textMuted, wordBreak: 'break-all' }}>
            Ou copiez ce lien : {url}
          </Text>

          {(p.depart || p.arrivee || p.pickup_datetime) && (
            <Section style={{ background: '#fafafa', border: '1px solid #eee', borderRadius: '8px', padding: '14px 18px', margin: '8px 0 22px' }}>
              {p.pickup_datetime && <Text style={row}><span style={rowLabel}>Date / heure : </span>{p.pickup_datetime}</Text>}
              {p.depart && <Text style={row}><span style={rowLabel}>Départ : </span>{p.depart}</Text>}
              {p.arrivee && <Text style={row}><span style={rowLabel}>Arrivée : </span>{p.arrivee}</Text>}
            </Section>
          )}

          <Text style={text}>
            💡 Astuce : ouvrez ce lien sur votre téléphone pour voir la carte en temps réel.
            Vous pouvez aussi appeler directement votre chauffeur au <strong>06 73 07 23 22</strong>.
          </Text>

          <Hr style={divider} />
          <Text style={footer}>Taxi City Bordeaux · Conventionné · 7j/7 · 24h/24</Text>
        </Container>
      </Body>
    </Html>
  )
}

const row = { fontSize: '14px', color: '#222', margin: '4px 0', lineHeight: '1.5' }
const rowLabel = { color: '#666', fontWeight: 600 as const }

export const template = {
  component: Email,
  subject: '✅ Votre course est confirmée — suivez votre chauffeur',
  displayName: 'Course acceptée — invitation au suivi',
  previewData: {
    nom: 'Jean Dupont',
    depart: 'Bordeaux Centre',
    arrivee: 'Aéroport Mérignac',
    pickup_datetime: '2026-05-12 14:30',
    tracking_url: 'https://taxicitybordeaux.fr/tracking/abcd-1234',
  },
} satisfies TemplateEntry
