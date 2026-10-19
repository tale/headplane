import { NavLink, Outlet } from "react-router";

import PageHeader from "~/components/page-header";
import { headscaleConfigContext } from "~/server/context";
import cn from "~/utils/cn";

import type { Route } from "./+types/layout";

export async function loader({ context }: Route.LoaderArgs) {
  const headscaleConfig = context.get(headscaleConfigContext);

  return {
    hasRestrictions: headscaleConfig.writable() && headscaleConfig.hasOIDCConfig(),
  };
}

export default function Layout({ loaderData }: Route.ComponentProps) {
  const items = [
    { to: "/settings/auth-keys", label: "Auth keys" },
    ...(loaderData.hasRestrictions
      ? [{ to: "/settings/restrictions", label: "Sign-in restrictions" }]
      : []),
    { to: "/settings/agent", label: "Agent" },
  ];

  return (
    <>
      <PageHeader
        description="How machines join your tailnet, who can sign in, and the Headplane agent."
        title="Settings"
      />
      <div className="grid gap-x-12 gap-y-6 md:grid-cols-[11rem_minmax(0,1fr)]">
        <nav aria-label="Settings" className="min-w-0">
          <ul className="-mx-2 flex gap-1 overflow-x-auto md:mx-0 md:flex-col">
            {items.map((item) => (
              <li key={item.to}>
                <NavLink
                  className={({ isActive }) =>
                    cn(
                      "focus-ring flex h-8 items-center rounded-md px-2 text-sm whitespace-nowrap",
                      isActive
                        ? "bg-subtle text-fg font-medium"
                        : "text-muted hover:bg-hover hover:text-fg",
                    )
                  }
                  prefetch="intent"
                  to={item.to}
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="min-w-0">
          <Outlet />
        </div>
      </div>
    </>
  );
}
