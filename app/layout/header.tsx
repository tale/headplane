import {
  CircleQuestionMark,
  CircleUser,
  Globe,
  Lock,
  Menu as MenuIcon,
  Server,
  Settings,
  Users,
} from "lucide-react";
import { NavLink, useSubmit } from "react-router";

import Link from "~/components/link";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "~/components/menu";
import logoBg from "~/logo/dark-bg.svg";
import logoDark from "~/logo/dark.svg";
import logoLight from "~/logo/light.svg";
import cn from "~/utils/cn";

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

export default function Header({ user, access, configAvailable }: HeaderProps) {
  const submit = useSubmit();
  const showTabs = access.ui;

  return (
    <header
      className={cn(
        "bg-mist-200 dark:bg-mist-950 text-mist-800 dark:text-mist-200",
        "dark:border-b dark:border-mist-800 shadow-inner",
      )}
    >
      <div className="container flex items-center justify-between py-4">
        <div className="flex items-center gap-x-8">
          <div className="flex items-center gap-x-2">
            <picture>
              <source srcSet={logoLight} media="(prefers-color-scheme: dark)" />
              <source srcSet={logoDark} media="(prefers-color-scheme: light)" />
              <img src={logoBg} alt="Headplane logo" />
            </picture>
            <h1 className="text-2xl font-semibold">headplane</h1>
          </div>
          {showTabs && (
            <>
              <nav className="hidden items-center gap-x-2 text-sm font-medium md:flex">
                {tabs.map((tab) => {
                  if (!access[tab.key]) return null;
                  if ((tab.key === "dns" || tab.key === "settings") && !configAvailable)
                    return null;

                  return (
                    <NavLink
                      key={tab.to}
                      className={({ isActive }) =>
                        cn(
                          "px-3 py-1.5 flex items-center gap-x-1.5 rounded-md text-nowrap",
                          "hover:bg-mist-300/50 dark:hover:bg-mist-800",
                          "focus:outline-hidden focus:ring-2 focus:ring-indigo-500/40 focus:ring-offset-1",
                          "dark:focus:ring-indigo-400/40 dark:focus:ring-offset-mist-900",
                          isActive
                            ? "bg-mist-300/70 dark:bg-mist-800 text-mist-900 dark:text-mist-50"
                            : "text-mist-600 dark:text-mist-300",
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
              <Menu>
                <MenuTrigger className="size-8 rounded-full p-1 md:hidden">
                  <MenuIcon className="w-5" />
                </MenuTrigger>
                <MenuContent align="start">
                  {tabs.map((tab) => {
                    if (!access[tab.key]) return null;
                    if ((tab.key === "dns" || tab.key === "settings") && !configAvailable)
                      return null;

                    return (
                      <MenuItem key={tab.to}>
                        <NavLink
                          className={({ isActive }) =>
                            cn(
                              "flex items-center gap-x-2",
                              isActive ? "text-mist-900 dark:text-mist-50 font-medium" : "",
                            )
                          }
                          prefetch="intent"
                          to={tab.to}
                        >
                          <tab.icon className="w-4" />
                          {tab.label}
                        </NavLink>
                      </MenuItem>
                    );
                  })}
                </MenuContent>
              </Menu>
            </>
          )}
        </div>
        <div className="grid grid-cols-2 gap-x-4">
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
                <div className="text-mist-900 dark:text-mist-50">
                  {user.subject === "api_key" ? (
                    <>
                      <p className="font-bold">API Key</p>
                      <p>{user.name}</p>
                    </>
                  ) : (
                    <>
                      <p className="font-bold">{user.name}</p>
                      {user.email && <p>{user.email}</p>}
                    </>
                  )}
                </div>
              </MenuItem>
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
    </header>
  );
}
