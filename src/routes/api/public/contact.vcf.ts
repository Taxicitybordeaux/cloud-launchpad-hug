import { createFileRoute } from "@tanstack/react-router";

const VCARD = [
  "BEGIN:VCARD",
  "VERSION:3.0",
  "FN:José — Taxi City Bordeaux",
  "N:José;Taxi City Bordeaux;;;",
  "ORG:Taxi City Bordeaux",
  "TEL;TYPE=CELL,VOICE,PREF:+33673072322",
  "EMAIL;TYPE=INTERNET,PREF:taxi.city033@gmail.com",
  "URL:https://taxicitybordeaux.fr",
  "END:VCARD",
  "",
].join("\r\n");

export const Route = createFileRoute("/api/public/contact/vcf")({
  server: {
    handlers: {
      GET: async () =>
        new Response(VCARD, {
          status: 200,
          headers: {
            "Content-Type": "text/vcard; charset=utf-8",
            "Content-Disposition": 'inline; filename="taxi-city-bordeaux.vcf"',
            "Cache-Control": "public, max-age=3600",
          },
        }),
    },
  },
});
