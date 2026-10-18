import type { Scenario } from "../scenario";

// HP_FLEET_SIZE machines spread over ten users, for performance work.
const size = Number(process.env.HP_FLEET_SIZE ?? 50);
const users = Array.from({ length: 10 }, (_, i) => ({ name: `user${i + 1}` }));

export default {
  description: `${size} machines across ${users.length} users`,
  users,
  nodes: Array.from({ length: size }, (_, i) => ({
    name: `machine-${String(i + 1).padStart(3, "0")}`,
    user: users[i % users.length].name,
    offline: i % 7 === 0,
  })),
} satisfies Scenario;
