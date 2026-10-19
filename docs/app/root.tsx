import "@fontsource-variable/inter/opsz.css";
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

import Header from "@/components/header";
import DocsSearchDialog from "@/components/search";
import VersionBanner from "@/components/version-banner";

import type { Route } from "./+types/root";

import "./app.css";

export function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta content="width=device-width, initial-scale=1" name="viewport" />
        <link href={`${import.meta.env.BASE_URL}favicon.ico`} rel="icon" sizes="32x32" />
        <link href={`${import.meta.env.BASE_URL}favicon.svg`} rel="icon" type="image/svg+xml" />
        <Meta />
        <Links />
      </head>
      <body className="flex min-h-screen flex-col">
        <RootProvider search={{ SearchDialog: DocsSearchDialog }}>
          <VersionBanner />
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

// A missing page is a 404 when navigating within the site. Loaded directly, it
// comes from the prerendered fallback, which has no data for the route.
function isNotFound(error: unknown) {
  if (isRouteErrorResponse(error)) {
    return error.status === 404;
  }

  return error instanceof Error && error.message.startsWith("No result found for routeId");
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const isMissing = isNotFound(error);

  return (
    <>
      <Header />
      <main className="mx-auto flex max-w-xl flex-col gap-2 px-6 py-24">
        <h1 className="text-2xl font-semibold">
          {isMissing ? "Page not found" : "Something went wrong"}
        </h1>
        {!isMissing && error instanceof Error && (
          <pre className="text-muted text-xs whitespace-pre-wrap">{error.message}</pre>
        )}
        <a className="text-accent" href={import.meta.env.BASE_URL}>
          Back to the docs
        </a>
      </main>
    </>
  );
}
