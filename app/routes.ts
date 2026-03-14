import { index, layout, prefix, route } from "@react-router/dev/routes";

export default [
  // Utility Routes
  route("/healthz", "routes/util/healthz.ts"),

  // API Routes
  ...prefix("/api", [route("/info", "routes/util/info.ts")]),

  // Authentication Routes
  route("/login", "routes/auth/login/page.tsx"),
  route("/logout", "routes/auth/logout.ts"),
  route("/oidc/callback", "routes/auth/oidc-callback.ts"),
  route("/oidc/start", "routes/auth/oidc-start.ts"),
  route("/ssh", "routes/ssh/console.tsx"),

  // All the main logged-in routes
  layout("layout/app.tsx", [
    index("routes/home.tsx"),
    ...prefix("/machines", [
      index("routes/machines/overview.tsx"),
      route("/:id", "routes/machines/machine.tsx"),
    ]),

    route("/users", "routes/users/overview.tsx"),
    route("/acls", "routes/acls/overview.tsx"),
    route("/dns", "routes/dns/overview.tsx"),

    ...prefix("/settings", [
      index("routes/settings/overview.tsx"),
      route("/auth-keys", "routes/settings/auth-keys/overview.tsx"),
      route("/restrictions", "routes/settings/restrictions/overview.tsx"),
      // route('/local-agent', 'routes/settings/local-agent.tsx'),
    ]),
  ]),
];
