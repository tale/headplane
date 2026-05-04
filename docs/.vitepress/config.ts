import { defineConfig } from "vitepress";

export default defineConfig({
  vite: {
    define: {
      __HEADPLANE_BETA_DOCS__: JSON.stringify(process.env.HEADPLANE_BETA_DOCS === "true"),
    },
  },
  title: "Headplane",
  description: "The missing dashboard for Headscale",
  cleanUrls: true,
  head: [["link", { rel: "icon", href: "/favicon.ico" }]],
  themeConfig: {
    logo: "/logo.svg",
    nav: [
      { text: "Home", link: "/" },
      { text: "Changelog", link: "/CHANGELOG" },
    ],
    search: {
      provider: "local",
    },
    sidebar: [
      {
        text: "Getting Started",
        items: [
          { text: "What is Headplane?", link: "/introduction" },
          {
            text: "Installation",
            link: "/install",
            items: [
              { text: "Limited Mode", link: "/install/limited-mode" },
              { text: "Native Mode", link: "/install/native-mode" },
              { text: "Docker", link: "/install/docker" },
              { text: "Helm Chart", link: "/install/kubernetes-helm" },
            ],
          },
          {
            text: "Configuration",
            link: "/configuration",
            items: [
              { text: "Common Issues", link: "/configuration/common-issues" },
              {
                text: "Sensitive Values",
                link: "/configuration#sensitive-values",
              },
            ],
          },
          { text: "Nix", link: "/Nix" },
          { text: "NixOS", link: "/NixOS-options" },
          {
            text: "Features",
            items: [
              { text: "Single Sign-On (SSO)", link: "/features/sso" },
              { text: "Headplane Agent", link: "/features/agent" },
              { text: "Browser SSH", link: "/features/ssh" },
            ],
          },
          {
            text: "Development",
            collapsed: true,
            items: [
              { text: "Architecture", link: "/development/architecture" },
              { text: "Contributing", link: "/CONTRIBUTING" },
              { text: "Security", link: "/SECURITY" },
            ],
          },
        ],
      },
    ],

    socialLinks: [
      { icon: "github", link: "https://github.com/tale/headplane" },
      { icon: "githubsponsors", link: "https://github.com/sponsors/tale" },
      { icon: "kofi", link: "https://ko-fi.com/atale" },
    ],

    lastUpdated: {
      text: "Updated at",
      formatOptions: {
        dateStyle: "full",
        timeStyle: "medium",
      },
    },
  },
});
