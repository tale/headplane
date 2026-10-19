import "@fontsource-variable/inter/opsz.css";
import { Banner } from "fumadocs-ui/components/banner";
import { RootProvider } from "fumadocs-ui/provider/react-router";
import type { ReactNode } from "react";
import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";

import Header from "@/components/header";
import DocsSearchDialog from "@/components/search";

import type { Route } from "./+types/root";

import "./app.css";

export function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta content="width=device-width, initial-scale=1" name="viewport" />
        <link href="/favicon.ico" rel="icon" sizes="32x32" />
        <link href="/favicon.svg" rel="icon" type="image/svg+xml" />
        <Meta />
        <Links />
      </head>
      <body className="flex min-h-screen flex-col">
        <RootProvider search={{ SearchDialog: DocsSearchDialog }}>
          {__HEADPLANE_BETA_DOCS__ && (
            <Banner className="bg-warn-subtle text-warn h-9 text-sm">
              <span className="sm:hidden">
                <strong>Beta</strong> docs.
              </span>
              <span className="max-sm:hidden">
                You're viewing the <strong>beta</strong> docs.
              </span>
              <a className="ml-2 underline" href="https://headplane.net">
                Stable docs →
              </a>
            </Banner>
          )}
          {children}
        </RootProvider>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

// Pages are prerendered, so any error here means the page doesn't exist: a
// missing page fails to load its data rather than returning a 404 response.
export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return (
    <>
      <Header />
      <main className="mx-auto flex max-w-xl flex-col gap-2 px-6 py-24">
        <h1 className="text-2xl font-semibold">Page not found</h1>
        {import.meta.env.DEV && error instanceof Error && (
          <pre className="text-muted text-xs">{error.message}</pre>
        )}
        <a className="text-accent" href="/">
          Back to the docs
        </a>
      </main>
    </>
  );
}
