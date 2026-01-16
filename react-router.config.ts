import type { Config } from "@react-router/dev/config";

export default {
  basename: "/admin/",
  ssr: true,
  future: {
    unstable_optimizeDeps: true,
    v8_splitRouteModules: "enforce",
  },
} satisfies Config;
