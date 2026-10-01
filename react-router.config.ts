import { readFileSync } from "node:fs";

import type { Config } from "@react-router/dev/config";
import { parse } from "yaml";

const config = parse(
  readFileSync(process.env.HEADPLANE_CONFIG_PATH || "config.example.yaml", "utf8"),
);

export default {
  basename:
    process.env.HEADPLANE_SERVER__BASE_PATH ||
    config.server?.base_path ||
    process.env.__INTERNAL_PREFIX ||
    "/admin",
  ssr: true,
  future: {
    unstable_optimizeDeps: true,
  },
} satisfies Config;
