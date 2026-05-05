import * as React from 'react'
import { Body, Button, Container, Head, Heading, Hr, Html, Link, Preview, Text } from '@react-email/components'
import { brandBar, brandTag, button, container, divider, footer, h1, link, main, text } from './_brand'

interface Props {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({ siteName, siteUrl, recipient, confirmationUrl }: Props) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Confirmez votre adresse email pour {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brandBar}>{siteName}</Text>
        <Text style={brandTag}>Privé & Business · Bordeaux</Text>
        <Heading style={h1}>Confirmez votre email</Heading>
        <Text style={text}>
          Merci de vous être inscrit sur{' '}
          <Link href={siteUrl} style={link}><strong>{siteName}</strong></Link>.
        </Text>
        <Text style={text}>
          Veuillez confirmer votre adresse (
          <Link href={`mailto:${recipient}`} style={link}>{recipient}</Link>
          ) en cliquant sur le bouton ci-dessous :
        </Text>
        <Button style={button} href={confirmationUrl}>Confirmer mon email</Button>
        <Hr style={divider} />
        <Text style={footer}>
          Si vous n'êtes pas à l'origine de cette inscription, ignorez simplement ce message.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail
