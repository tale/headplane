import { Check, CircleQuestionMark, Menu as MenuIcon, Monitor, Moon, Sun } from "lucide-react";
import {
  NavLink,
  unstable_useRoute as useRoute,
  useLocation,
  useNavigate,
  useSubmit,
} from "react-router";

import Avatar from "~/components/avatar";
import Link from "~/components/link";
import LogoMark from "~/components/logo-mark";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "~/components/menu";
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
  { to: "/machines", label: "Machines", key: "machines" },
  { to: "/users", label: "Users", key: "users" },
  { to: "/acls", label: "Access controls", key: "policy" },
  { to: "/dns", label: "DNS", key: "dns" },
  { to: "/settings", label: "Settings", key: "settings" },
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
  const navigate = useNavigate();
  const showTabs = access.ui;
  const rootRoute = useRoute("root");
  const currentColorScheme: ColorScheme = rootRoute?.loaderData?.colorScheme ?? "system";
  // useLocation returns the path with the basename already stripped, which is
  // what `redirect()` expects — react-router re-applies the basename when
  // following the redirect on the client.
  const location = useLocation();
  const returnTo = location.pathname + location.search;
  const visibleTabs = tabs.filter(
    (tab) => access[tab.key] && ((tab.key !== "dns" && tab.key !== "settings") || configAvailable),
  );

  return (
    <header className={cn("sticky top-0 z-20 bg-surface text-fg", "border-b border-line")}>
      <div className="container flex h-13 items-center gap-x-5">
        <div className="flex items-center gap-x-2">
          <LogoMark className="size-[18px] shrink-0" />
          <span className="text-sm font-semibold tracking-tight">headplane</span>
        </div>
        {showTabs && (
          <nav className="hidden h-full min-w-0 gap-x-0.5 overflow-x-auto text-[13px] font-medium md:flex">
            {visibleTabs.map((tab) => (
              <NavLink
                key={tab.to}
                className={({ isActive }) =>
                  cn(
                    "flex h-full items-center px-2.5 text-nowrap",
                    "focus-ring hover:text-fg",
                    isActive ? "text-fg shadow-[inset_0_-2px_0_var(--color-accent)]" : "text-muted",
                  )
                }
                prefetch="intent"
                to={tab.to}
              >
                {tab.label}
              </NavLink>
            ))}
          </nav>
        )}
        <div className="ml-auto flex shrink-0 items-center gap-x-2">
          {showTabs && (
            <Menu>
              <MenuTrigger className="text-muted hover:bg-hover hover:text-fg size-8 rounded-md md:hidden">
                <MenuIcon aria-label="Navigation" className="size-4" />
              </MenuTrigger>
              <MenuContent align="end">
                {visibleTabs.map((tab) => (
                  <MenuItem key={tab.to} onClick={() => navigate(tab.to)}>
                    <span
                      className={cn(
                        location.pathname.startsWith(tab.to) && "text-accent font-medium",
                      )}
                    >
                      {tab.label}
                    </span>
                  </MenuItem>
                ))}
              </MenuContent>
            </Menu>
          )}
          <Menu>
            <MenuTrigger className="text-muted hover:bg-hover hover:text-fg size-8 rounded-md">
              <CircleQuestionMark aria-label="Help" className="size-4" />
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
            <MenuTrigger className="rounded-full">
              <Avatar name={user.name} src={user.picture} />
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
    </header>
  );
}
