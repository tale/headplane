---
# https://vitepress.dev/reference/default-theme-home-page
layout: home

hero:
  name: "Headplane"
  tagline: "A full-featured admin interface for Headscale"
  image:
    src: "/logo-dark-bg.svg"
    alt: "Headplane"
  actions:
    - text: "Getting Started"
      link: "/README"
    - text: "GitHub"
      link: "https://github.com/tale/headplane"
      theme: "alt"

features:
  - title: "Remote web-based SSH"
    details: "Connect to and manage machines via SSH directly through your web browser"
    icon: "🌐"
  - title: "Single-sign-on"
    details: "Bring your own auth via OpenID Connect, including popular solutions such as Google Workspace, Azure/Entra, Okta, etc."
    icon: "👥"
  - title: "Detailed Tailnet Overview"
    details: "Get access to detailed host and network information from each device residing within your Tailnet"
    icon: "🔎"
  - title: "Configure Headscale Settings"
    details: "Manage settings hidden behind Headscale configuration such as DNS, networking, auth controls, etc."
    icon: "📝"
---

