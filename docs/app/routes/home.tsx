import { HomeLayout } from "fumadocs-ui/layouts/home";
import { Link } from "react-router";

import { baseOptions } from "@/lib/layout";

const features = [
  {
    title: "Browser SSH",
    details: "Open an SSH session to any machine in your Tailnet, straight from the browser.",
  },
  {
    title: "Single sign-on",
    details: "Bring your own OpenID Connect provider, from Google Workspace to Entra and Okta.",
  },
  {
    title: "Tailnet overview",
    details: "See host and network details for every device in your Tailnet.",
  },
  {
    title: "Headscale settings",
    details: "Manage DNS, networking and auth settings that are normally buried in config files.",
  },
];

export function meta() {
  return [
    { title: "Headplane" },
    { name: "description", content: "A full-featured admin interface for Headscale" },
  ];
}

export default function Home() {
  return (
    <HomeLayout {...baseOptions}>
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-16 px-6 py-24">
        <div className="flex max-w-2xl flex-col gap-4">
          <h1 className="text-4xl font-semibold tracking-tight">Headplane</h1>
          <p className="text-muted text-lg">A full-featured admin interface for Headscale.</p>
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
          {features.map((feature) => (
            <div className="bg-surface flex flex-col gap-1 p-6" key={feature.title}>
              <h2 className="font-medium">{feature.title}</h2>
              <p className="text-muted text-sm">{feature.details}</p>
            </div>
          ))}
        </div>
      </main>
    </HomeLayout>
  );
}
