import type { Config } from "@react-router/dev/config";

export default {
  basename: "/admin/",
  ssr: true,
  future: {
    unstable_optimizeDeps: true,
  },
} satisfies Config;
