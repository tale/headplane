import type React from "react";

import Link from "~/components/link";
import LogoMark from "~/components/logo-mark";

import Grid from "./grid";

interface Props {
  title: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
}

export default function Shell({ title, description, children }: Props) {
  return (
    <div className="relative isolate flex min-h-dvh flex-col overflow-hidden">
      <div aria-hidden className="absolute inset-y-0 right-0 left-122 -z-10 hidden lg:block">
        <Grid />
      </div>
      <header className="p-6 sm:p-10">
        <span className="flex items-center gap-2 text-sm font-semibold tracking-tight">
          <LogoMark className="size-5" />
          headplane
        </span>
      </header>
      <main className="flex flex-1 items-center px-6 py-10 sm:px-10">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-semibold tracking-tight text-balance">{title}</h1>
          {description && <p className="text-muted mt-1.5">{description}</p>}
          <div className="mt-8">{children}</div>
        </div>
      </main>
      <footer className="text-muted flex flex-col gap-2 p-6 text-xs sm:flex-row sm:items-center sm:justify-between sm:p-10">
        <p>The web interface for Headscale.</p>
        <span className="flex gap-3">
          <Link className="hover:text-fg" external to="https://headplane.net">
            Docs
          </Link>
          <Link className="hover:text-fg" external to="https://github.com/tale/headplane">
            GitHub
          </Link>
          <span>{__VERSION__}</span>
        </span>
      </footer>
    </div>
  );
}
