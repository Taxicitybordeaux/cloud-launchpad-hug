import { createFileRoute } from "@tanstack/react-router";

const KIPFUL_BASE = "https://selfcare.kipful.me";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

export const Route = createFileRoute("/api/public/kipful-proxy")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),

      POST: async ({ request }) => {
        let payload: {
          path?: string;
          method?: string;
          sessionToken?: string;
          body?: unknown;
        };
        try {
          payload = await request.json();
        } catch {
          return json({ error: "Invalid JSON body" }, 400);
        }

        const { path, method = "GET", body } = payload;
        // Token can come from request OR from server-side env (KIPFUL_SESSION_TOKEN)
        const sessionToken =
          payload.sessionToken || process.env.KIPFUL_SESSION_TOKEN;

        if (!path || !path.startsWith("/")) {
          return json({ error: "Missing or invalid 'path' (must start with /)" }, 400);
        }
        if (!sessionToken) {
          return json(
            { error: "Missing sessionToken (or set KIPFUL_SESSION_TOKEN secret)" },
            401,
          );
        }

        // Whitelist Kipful API paths to avoid open proxy abuse
        if (!/^\/api\//.test(path)) {
          return json({ error: "Only /api/* paths are allowed" }, 403);
        }

        const url = `${KIPFUL_BASE}${path}`;
        const headers: Record<string, string> = {
          Cookie: `__Secure-next-auth.session-token=${sessionToken}`,
          Accept: "application/json",
          "User-Agent": "TaxiCityBordeaux-KipfulProxy/1.0",
        };

        const init: RequestInit = { method, headers };
        if (body !== undefined && method !== "GET" && method !== "HEAD") {
          headers["Content-Type"] = "application/json";
          init.body = typeof body === "string" ? body : JSON.stringify(body);
        }

        try {
          const upstream = await fetch(url, init);
          const text = await upstream.text();
          let parsed: unknown = text;
          try {
            parsed = JSON.parse(text);
          } catch {
            /* keep raw text */
          }

          return new Response(
            JSON.stringify({
              ok: upstream.ok,
              status: upstream.status,
              data: parsed,
            }),
            {
              status: upstream.ok ? 200 : upstream.status,
              headers: { "Content-Type": "application/json", ...CORS },
            },
          );
        } catch (err) {
          return json(
            { error: "Upstream fetch failed", details: String(err) },
            502,
          );
        }
      },
    },
  },
});
