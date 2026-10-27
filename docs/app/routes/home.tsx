import { Link } from "react-router";

import Header from "@/components/header";

const featureList = [
  {
    title: "Browser SSH",
    details:
      "Open a terminal to any machine on the tailnet from the browser, with nothing to install.",
  },
  {
    title: "Single sign-on",
    details:
      "Sign people in through an OpenID Connect provider or a reverse proxy, each with a role.",
  },
  {
    title: "Machine details",
    details: "See each machine's Tailscale version, operating system and connectivity.",
  },
  {
    title: "Headscale settings",
    details: "Edit DNS and sign-in restrictions from the UI instead of Headscale's config file.",
  },
];

export function meta() {
  return [
    { title: "Headplane" },
    {
      name: "description",
      content: "A web UI for Headscale, the self-hosted Tailscale control server.",
    },
  ];
}

export default function Home() {
  return (
    <>
      <Header />
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-16 px-6 py-24">
        <div className="flex max-w-2xl flex-col gap-4">
          <h1 className="text-4xl font-semibold tracking-tight">Headplane</h1>
          <p className="text-muted text-lg">
            A web UI for Headscale, the self-hosted Tailscale control server.
          </p>
          <div className="flex gap-2 pt-2">
            <Link
              className="bg-ink text-ink-fg hover:bg-ink/90 rounded-md px-3 py-1.5 text-sm font-medium"
              to="/introduction"
            >
              Get started
            </Link>
            <Link
              className="border-line-strong bg-surface hover:bg-hover rounded-md border px-3 py-1.5 text-sm font-medium"
              to="/install"
            >
              Installation
            </Link>
          </div>
        </div>
        <div className="border-line bg-line grid gap-px overflow-hidden rounded-lg border sm:grid-cols-2">
          {featureList.map((feature) => (
            <div className="bg-surface flex flex-col gap-1 p-6" key={feature.title}>
              <h2 className="font-medium">{feature.title}</h2>
              <p className="text-muted text-sm">{feature.details}</p>
            </div>
          ))}
        </div>
      </main>
    </>
  );
}
