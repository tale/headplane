import type { Scenario } from "../scenario";

// A small household tailnet, used for the docs screenshots.
export default {
  description: "Three people, a NAS sharing the home LAN, and a tagged server",
  users: [
    // Created from the CLI, without an email.
    { name: "alice", displayName: "Alice Chen" },
    { name: "bob", email: "bob@example.com", displayName: "Bob Okafor" },
    { name: "carol", email: "carol@example.com", displayName: "Carol Diaz" },
  ],
  headscaleConfig: {
    dns: {
      magic_dns: true,
      base_domain: "home.arpa",
      override_local_dns: true,
      nameservers: { global: ["1.1.1.1", "9.9.9.9"], split: { "lan.home.arpa": ["192.168.1.1"] } },
      search_domains: ["lan.home.arpa"],
    },
  },
  records: [{ name: "grafana.home.arpa", type: "A", value: "100.64.0.6" }],
  policy: {
    groups: { "group:admins": ["alice@"], "group:family": ["alice@", "bob@", "carol@"] },
    tagOwners: {
      "tag:server": ["group:admins"],
      "tag:headplane-agent": [],
    },
    acls: [
      { action: "accept", src: ["group:admins"], dst: ["*:*"] },
      { action: "accept", src: ["*"], dst: ["tag:headplane-agent:*"] },
      { action: "accept", src: ["group:family"], dst: ["tag:server:443", "192.168.1.0/24:*"] },
    ],
    ssh: [
      {
        action: "accept",
        src: ["group:admins"],
        dst: ["tag:server"],
        users: ["root", "autogroup:nonroot"],
      },
    ],
  },
  // Personal devices expire like Tailscale's, while servers and tagged
  // machines don't.
  nodes: [
    {
      name: "alice-laptop",
      user: "alice",
      expiresIn: 172,
      hostInfo: { OS: "macOS", OSVersion: "26.1" },
    },
    {
      name: "bob-desktop",
      user: "bob",
      expiresIn: 140,
      tailscaleVersion: "1.102.5",
      hostInfo: { OS: "windows", OSVersion: "10.0.26100.6584" },
    },
    {
      name: "bob-tablet",
      user: "bob",
      expiresIn: 0,
      offline: true,
      hostInfo: { OS: "android", OSVersion: "15" },
    },
    {
      name: "carol-laptop",
      user: "carol",
      expiresIn: 3,
      hostInfo: { OS: "macOS", OSVersion: "15.7" },
    },
    {
      name: "nas",
      user: "alice",
      ssh: true,
      routes: ["192.168.1.0/24"],
      exitNode: true,
      approve: ["192.168.1.0/24", "0.0.0.0/0", "::/0"],
      hostInfo: { OS: "linux", OSVersion: "6.12.15-production+truenas" },
    },
    {
      name: "grafana",
      user: "alice",
      tags: ["tag:server"],
      ssh: true,
      hostInfo: { OS: "linux", OSVersion: "6.8.0-85-generic" },
    },
    {
      name: "bob-pi",
      user: "bob",
      routes: ["192.168.50.0/24"],
      exitNode: true,
      expiresIn: 160,
      hostInfo: { OS: "linux", OSVersion: "6.12.47+rpt-rpi-2712" },
    },
  ],
} satisfies Scenario;
