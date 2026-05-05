import * as React from 'react'
import { Body, Button, Container, Head, Heading, Hr, Html, Link, Preview, Text } from '@react-email/components'
import { brandBar, brandTag, button, container, divider, footer, h1, link, main, text } from './_brand'

interface Props {
  siteName: string
  oldEmail: string
  email: string
  newEmail: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({ siteName, oldEmail, newEmail, confirmationUrl }: Props) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Confirmez le changement d'email pour {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brandBar}>{siteName}</Text>
        <Text style={brandTag}>Privé & Business · Bordeaux</Text>
        <Heading style={h1}>Confirmer le changement d'email</Heading>
        <Text style={text}>
          Vous avez demandé à modifier votre adresse email {siteName} de{' '}
          <Link href={`mailto:${oldEmail}`} style={link}>{oldEmail}</Link> vers{' '}
          <Link href={`mailto:${newEmail}`} style={link}>{newEmail}</Link>.
        </Text>
        <Text style={text}>Cliquez sur le bouton ci-dessous pour confirmer ce changement :</Text>
        <Button style={button} href={confirmationUrl}>Confirmer le changement</Button>
        <Hr style={divider} />
        <Text style={footer}>
          Si vous n'êtes pas à l'origine de cette demande, sécurisez votre compte immédiatement.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default EmailChangeEmail
