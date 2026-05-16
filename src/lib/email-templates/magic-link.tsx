import * as React from "react";
import { Body, Button, Container, Head, Heading, Hr, Html, Preview, Text } from "@react-email/components";
import { brandBar, brandTag, button, container, divider, footer, h1, main, text } from "./_brand";

interface Props {
  siteName: string;
  confirmationUrl: string;
}

export const MagicLinkEmail = ({ siteName, confirmationUrl }: Props) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Votre lien de connexion {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brandBar}>{siteName}</Text>
        <Text style={brandTag}>Privé & Business · Bordeaux</Text>
        <Heading style={h1}>Votre lien de connexion</Heading>
        <Text style={text}>
          Cliquez sur le bouton ci-dessous pour vous connecter à {siteName}. Ce lien expirera prochainement.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Se connecter
        </Button>
        <Hr style={divider} />
        <Text style={footer}>Si vous n'avez pas demandé ce lien, ignorez simplement ce message.</Text>
      </Container>
    </Body>
  </Html>
);

export default MagicLinkEmail;
