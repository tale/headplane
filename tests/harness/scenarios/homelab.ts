import type { Scenario } from "../scenario";

// A small household tailnet, used for the docs screenshots.
export default {
  description: "Three people, a NAS sharing the home LAN, an exit node, and tagged servers",
  users: [
    { name: "alice", email: "alice@example.com", displayName: "Alice Chen" },
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
  records: [{ name: "grafana.home.arpa", type: "A", value: "100.64.0.4" }],
  policy: {
    groups: { "group:admins": ["alice@"], "group:family": ["alice@", "bob@", "carol@"] },
    tagOwners: {
      "tag:server": ["group:admins"],
      "tag:media": ["group:admins"],
      "tag:ci": ["group:admins"],
    },
    acls: [
      { action: "accept", src: ["group:admins"], dst: ["*:*"] },
      { action: "accept", src: ["group:family"], dst: ["tag:media:*", "192.168.1.0/24:*"] },
      { action: "accept", src: ["tag:ci"], dst: ["tag:server:22,443"] },
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
  nodes: [
    { name: "alice-laptop", user: "alice" },
    { name: "alice-phone", user: "alice" },
    { name: "bob-desktop", user: "bob" },
    { name: "bob-tablet", user: "bob", offline: true },
    { name: "carol-laptop", user: "carol" },
    {
      name: "nas",
      user: "alice",
      ssh: true,
      routes: ["192.168.1.0/24"],
      approve: ["192.168.1.0/24"],
    },
    { name: "gateway", user: "alice", exitNode: true },
    { name: "jellyfin", user: "alice", tags: ["tag:media"], ssh: true },
    { name: "grafana", user: "alice", tags: ["tag:server"], ssh: true },
    { name: "runner", user: "alice", tags: ["tag:ci"] },
  ],
} satisfies Scenario;
