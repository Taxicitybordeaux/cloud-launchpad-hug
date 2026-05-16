import * as React from "react";
import { Body, Container, Head, Heading, Hr, Html, Preview, Text } from "@react-email/components";
import { brandBar, brandTag, codeStyle, container, divider, footer, h1, main, text } from "./_brand";

interface Props {
  token: string;
}

export const ReauthenticationEmail = ({ token }: Props) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Votre code de vérification</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brandBar}>Taxi City Bordeaux</Text>
        <Text style={brandTag}>Privé & Business · Bordeaux</Text>
        <Heading style={h1}>Confirmer votre identité</Heading>
        <Text style={text}>Utilisez le code ci-dessous pour confirmer votre identité :</Text>
        <Text style={codeStyle}>{token}</Text>
        <Hr style={divider} />
        <Text style={footer}>
          Ce code expirera prochainement. Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.
        </Text>
      </Container>
    </Body>
  </Html>
);

export default ReauthenticationEmail;
