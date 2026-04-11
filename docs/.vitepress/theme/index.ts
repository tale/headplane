import type { Theme } from "vitepress";
import DefaultTheme from "vitepress/theme";
import { h } from "vue";

import "./custom.css";

const beta = __HEADPLANE_BETA_DOCS__ ?? false;

export default {
  extends: DefaultTheme,
  Layout() {
    return h(DefaultTheme.Layout, null, {
      "layout-top": () =>
        beta
          ? h(
              "div",
              {
                class: "beta-banner",
              },
              [
                "You are currently viewing the ",
                h("strong", "beta"),
                " documentation for Headplane. ",
                h(
                  "a",
                  {
                    href: "https://headplane.net",
                  },
                  "Go to the stable docs →",
                ),
              ],
            )
          : null,
    });
  },
} satisfies Theme;
