import * as React from 'react'
import { Body, Button, Container, Head, Heading, Hr, Html, Link, Preview, Text } from '@react-email/components'
import { brandBar, brandTag, button, container, divider, footer, h1, link, main, text } from './_brand'

interface Props { siteName: string; siteUrl: string; confirmationUrl: string }

export const InviteEmail = ({ siteName, siteUrl, confirmationUrl }: Props) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Vous êtes invité à rejoindre {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brandBar}>{siteName}</Text>
        <Text style={brandTag}>Privé & Business · Bordeaux</Text>
        <Heading style={h1}>Vous êtes invité</Heading>
        <Text style={text}>
          Vous avez été invité à rejoindre{' '}
          <Link href={siteUrl} style={link}><strong>{siteName}</strong></Link>.
          Cliquez sur le bouton ci-dessous pour accepter et créer votre compte.
        </Text>
        <Button style={button} href={confirmationUrl}>Accepter l'invitation</Button>
        <Hr style={divider} />
        <Text style={footer}>
          Si vous n'attendiez pas cette invitation, ignorez simplement ce message.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default InviteEmail
