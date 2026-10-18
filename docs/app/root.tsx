import "@fontsource-variable/inter/opsz.css";
import { Banner } from "fumadocs-ui/components/banner";
import { RootProvider } from "fumadocs-ui/provider/react-router";
import type { ReactNode } from "react";
import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";

import DocsSearchDialog from "@/components/search";

import type { Route } from "./+types/root";

import "./app.css";

export function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta content="width=device-width, initial-scale=1" name="viewport" />
        <link href="/logo.svg" rel="icon" />
        <Meta />
        <Links />
      </head>
      <body className="flex min-h-screen flex-col">
        <RootProvider search={{ SearchDialog: DocsSearchDialog }}>
          {__HEADPLANE_BETA_DOCS__ && (
            <Banner className="bg-warn-subtle text-warn h-9 text-sm">
              <span>
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

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const isNotFound = isRouteErrorResponse(error) && error.status === 404;

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-2 px-6 py-24">
      <h1 className="text-2xl font-semibold">
        {isNotFound ? "Page not found" : "Something went wrong"}
      </h1>
      <a className="text-accent" href="/">
        Back to the docs
      </a>
    </main>
  );
}
