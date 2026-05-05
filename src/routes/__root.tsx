import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { WhatsAppFloat } from "@/components/WhatsAppFloat";
import { SiteHeader } from "@/components/SiteHeader";
import { I18nProvider } from "@/i18n/I18nProvider";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Lovable App" },
      { name: "description", content: "Start Fresh Here is a web application that helps users migrate and enhance existing web projects." },
      { name: "author", content: "Lovable" },
      { property: "og:title", content: "Lovable App" },
      { property: "og:description", content: "Start Fresh Here is a web application that helps users migrate and enhance existing web projects." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@Lovable" },
      { name: "twitter:title", content: "Lovable App" },
      { name: "twitter:description", content: "Start Fresh Here is a web application that helps users migrate and enhance existing web projects." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/d6c7a0f5-65a6-426a-a4f8-c45e5356360a/id-preview-7db37787--4d19527a-14ef-42ec-902e-c2c44b5cd060.lovable.app-1777985166629.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/d6c7a0f5-65a6-426a-a4f8-c45e5356360a/id-preview-7db37787--4d19527a-14ef-42ec-902e-c2c44b5cd060.lovable.app-1777985166629.png" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <I18nProvider>
      <SiteHeader />
      <Outlet />
      <WhatsAppFloat />
    </I18nProvider>
  );
}
