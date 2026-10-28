import type { MetaFunction } from "react-router";
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  unstable_useRoute as useRoute,
  useHref,
} from "react-router";

import { LiveDataProvider } from "~/utils/live-data";
import ToastProvider from "~/utils/toast-provider";

import type { Route } from "./+types/root";
import ErrorPage from "./layout/error-page";

import "@fontsource-variable/inter/opsz.css";
import "./tailwind.css";
import { getColorScheme } from "./utils/color-scheme";

export const meta: MetaFunction = () => [
  { title: "Headplane" },
  {
    name: "description",
    content: "A frontend for the headscale coordination server",
  },
];

export async function loader({ request }: Route.LoaderArgs) {
  const colorScheme = await getColorScheme(request);
  return { colorScheme };
}

export function Layout({ children }: { readonly children: React.ReactNode }) {
  const { loaderData } = useRoute("root");
  const faviconIco = useHref("/favicon.ico");
  const faviconSvg = useHref("/favicon.svg");

  // LiveDataProvider is wrapped at the top level since dialogs and things
  // that control its state are usually open in portal containers which
  // are not a part of the normal React tree.
  return (
    <LiveDataProvider>
      <html
        lang="en"
        className={
          loaderData?.colorScheme === "dark"
            ? "dark"
            : loaderData?.colorScheme === "light"
              ? "light"
              : ""
        }
      >
        <head>
          <meta charSet="utf-8" />
          <meta content="width=device-width, initial-scale=1" name="viewport" />
          <Meta />
          <Links />
          <link href={faviconIco} rel="icon" sizes="32x32" />
          <link href={faviconSvg} rel="icon" type="image/svg+xml" />
        </head>
        <body className="w-full overflow-x-hidden overscroll-none">
          {children}
          <ToastProvider />
          <ScrollRestoration />
          <Scripts />
        </body>
      </html>
    </LiveDataProvider>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return <ErrorPage error={error} />;
}

export default function App() {
  return <Outlet />;
}
