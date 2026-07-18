import { createFileRoute } from "@tanstack/react-router";
import { createHash } from "crypto";

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

const VCARD_ETAG = `"${createHash("sha256").update(VCARD).digest("hex").slice(0, 16)}"`;
const VCARD_LAST_MODIFIED = "Wed, 01 Jan 2025 00:00:00 GMT";

export const Route = createFileRoute("/api/public/contact/vcf")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const ifNoneMatch = request.headers.get("If-None-Match");
        if (ifNoneMatch === VCARD_ETAG) {
          return new Response(null, {
            status: 304,
            headers: {
              "Cache-Control": "public, no-cache, must-revalidate, max-age=0",
              ETag: VCARD_ETAG,
              "Last-Modified": VCARD_LAST_MODIFIED,
            },
          });
        }

        return new Response(VCARD, {
          status: 200,
          headers: {
            "Content-Type": "text/vcard; charset=utf-8",
            "Content-Disposition": 'inline; filename="taxi-city-bordeaux.vcf"',
            "Cache-Control": "public, no-cache, must-revalidate, max-age=0",
            ETag: VCARD_ETAG,
            "Last-Modified": VCARD_LAST_MODIFIED,
            Vary: "Accept-Encoding",
          },
        });
      },
    },
  },
});
