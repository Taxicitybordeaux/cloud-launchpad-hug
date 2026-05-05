import * as React from 'react'
import { Body, Button, Container, Head, Heading, Hr, Html, Preview, Text } from '@react-email/components'
import { brandBar, brandTag, button, container, divider, footer, h1, main, text } from './_brand'

interface Props { siteName: string; confirmationUrl: string }

export const RecoveryEmail = ({ siteName, confirmationUrl }: Props) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Réinitialisez votre mot de passe {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brandBar}>{siteName}</Text>
        <Text style={brandTag}>Privé & Business · Bordeaux</Text>
        <Heading style={h1}>Réinitialiser votre mot de passe</Heading>
        <Text style={text}>
          Nous avons reçu une demande de réinitialisation pour votre compte {siteName}.
          Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe.
        </Text>
        <Button style={button} href={confirmationUrl}>Choisir un nouveau mot de passe</Button>
        <Hr style={divider} />
        <Text style={footer}>
          Si vous n'avez pas fait cette demande, ignorez ce message — votre mot de passe restera inchangé.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default RecoveryEmail
