import {
  Check,
  CircleQuestionMark,
  CircleUser,
  Globe,
  Lock,
  Monitor,
  Moon,
  Server,
  Settings,
  Sun,
  Users,
} from "lucide-react";
import { NavLink, unstable_useRoute as useRoute, useLocation, useSubmit } from "react-router";

import Link from "~/components/link";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "~/components/menu";
import logoBg from "~/logo/dark-bg.svg";
import logoDark from "~/logo/dark.svg";
import logoLight from "~/logo/light.svg";
import cn from "~/utils/cn";
import type { ColorScheme } from "~/utils/color-scheme";

export interface HeaderProps {
  user: {
    subject: string;
    name: string;
    email?: string;
    username?: string;
    picture?: string;
  };
  access: {
    ui: boolean;
    machines: boolean;
    dns: boolean;
    users: boolean;
    policy: boolean;
    settings: boolean;
  };
  configAvailable: boolean;
}

const tabs = [
  { to: "/machines", icon: Server, label: "Machines", key: "machines" },
  { to: "/users", icon: Users, label: "Users", key: "users" },
  { to: "/acls", icon: Lock, label: "Access Control", key: "policy" },
  { to: "/dns", icon: Globe, label: "DNS", key: "dns" },
  { to: "/settings", icon: Settings, label: "Settings", key: "settings" },
] as const;

const colorSchemes = [
  { value: "system", label: "System", icon: Monitor },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
] as const satisfies ReadonlyArray<{
  value: ColorScheme;
  label: string;
  icon: typeof Monitor;
}>;

export default function Header({ user, access, configAvailable }: HeaderProps) {
  const submit = useSubmit();
  const showTabs = access.ui;
  const rootRoute = useRoute("root");
  const currentColorScheme: ColorScheme = rootRoute?.loaderData?.colorScheme ?? "system";
  // useLocation returns the path with the basename already stripped, which is
  // what `redirect()` expects — react-router re-applies the basename when
  // following the redirect on the client.
  const location = useLocation();
  const returnTo = location.pathname + location.search;

  return (
    <header className={cn("bg-surface text-fg", "border-b border-line")}>
      <div className="container flex items-center gap-x-4 py-4">
        <div className="flex min-w-0 items-center gap-x-4">
          <div className="flex items-center gap-x-2">
            <picture className="min-w-8">
              <source srcSet={logoLight} media="(prefers-color-scheme: dark)" />
              <source srcSet={logoDark} media="(prefers-color-scheme: light)" />
              <img src={logoBg} alt="Headplane logo" />
            </picture>
            <h1 className="text-xl font-semibold">headplane</h1>
          </div>
          {showTabs && (
            <nav className="hidden items-center gap-x-2 overflow-x-auto p-1 text-sm font-medium md:flex">
              {tabs.map((tab) => {
                if (!access[tab.key]) return null;
                if ((tab.key === "dns" || tab.key === "settings") && !configAvailable) return null;

                return (
                  <NavLink
                    key={tab.to}
                    className={({ isActive }) =>
                      cn(
                        "px-3 py-1.5 flex items-center gap-x-1.5 rounded-md text-nowrap",
                        "hover:bg-line-strong/50",
                        "focus-ring",
                        isActive ? "bg-line-strong/70 text-fg" : "text-muted",
                      )
                    }
                    prefetch="intent"
                    to={tab.to}
                  >
                    <tab.icon className="w-4" />
                    {tab.label}
                  </NavLink>
                );
              })}
            </nav>
          )}
        </div>
        <div className="ml-auto grid shrink-0 grid-cols-2 gap-x-4">
          <Menu>
            <MenuTrigger className="size-8 rounded-full p-1">
              <CircleQuestionMark className="w-5" />
            </MenuTrigger>
            <MenuContent align="end">
              <MenuItem>
                <Link external to="https://headplane.net">
                  Docs
                </Link>
              </MenuItem>
              <MenuItem>
                <Link external to="https://headscale.net">
                  Headscale
                </Link>
              </MenuItem>
              <MenuItem>
                <Link external to="https://tailscale.com/download">
                  Download
                </Link>
              </MenuItem>
            </MenuContent>
          </Menu>
          <Menu>
            <MenuTrigger className="size-8 overflow-hidden rounded-full">
              {user.picture ? (
                <img alt={user.name} className="size-8" src={user.picture} />
              ) : (
                <CircleUser className="size-8" />
              )}
            </MenuTrigger>
            <MenuContent align="end">
              <MenuItem disabled>
                <div className="text-fg">
                  {user.subject === "api_key" ? (
                    <>
                      <p className="font-semibold">API Key</p>
                      <p>{user.name}</p>
                    </>
                  ) : (
                    <>
                      <p className="font-semibold">{user.name}</p>
                      {user.email && <p>{user.email}</p>}
                    </>
                  )}
                </div>
              </MenuItem>
              <MenuSeparator />
              {colorSchemes.map(({ value, label, icon: Icon }) => (
                <MenuItem
                  key={value}
                  onClick={() =>
                    submit(
                      { colorScheme: value, returnTo },
                      { action: "/api/color-scheme", method: "POST" },
                    )
                  }
                >
                  <div className="flex items-center gap-x-2">
                    <Icon className="size-4" />
                    <span className="flex-1">{label}</span>
                    {currentColorScheme === value && <Check className="size-4" />}
                  </div>
                </MenuItem>
              ))}
              <MenuSeparator />
              <MenuItem
                variant="danger"
                onClick={() => submit({}, { action: "/logout", method: "POST" })}
              >
                Logout
              </MenuItem>
            </MenuContent>
          </Menu>
        </div>
      </div>
      {showTabs && (
        <div className="block overflow-x-auto p-2 md:hidden">
          <nav className="flex items-center gap-x-2 text-sm font-medium">
            {tabs.map((tab) => {
              if (!access[tab.key]) return null;
              if ((tab.key === "dns" || tab.key === "settings") && !configAvailable) return null;

              return (
                <NavLink
                  key={tab.to}
                  className={({ isActive }) =>
                    cn(
                      "relative px-3 py-1.5 flex items-center gap-x-1.5 rounded-md text-nowrap",
                      "hover:bg-line-strong/50",
                      "focus-ring",
                      "text-muted",
                      isActive &&
                        "text-fg  after:content-[''] after:absolute after:-bottom-2 after:inset-x-1 after:h-0.5 after:rounded-full after:bg-accent",
                    )
                  }
                  prefetch="intent"
                  to={tab.to}
                >
                  <tab.icon className="w-4" />
                  {tab.label}
                </NavLink>
              );
            })}
          </nav>
        </div>
      )}
    </header>
  );
}
