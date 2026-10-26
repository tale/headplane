import type { Scenario } from "../scenario";

export default {
  description: "One user with one machine",
  users: [{ name: "alice", email: "alice@example.com" }],
  nodes: [{ name: "alice-laptop", user: "alice" }],
} satisfies Scenario;
