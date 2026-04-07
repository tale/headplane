import type { User } from "~/types/User";

export function getUserDisplayName(user: User): string {
  if (user.name === "tagged-devices") {
    return "Tag-owned";
  }

  return user.name || user.displayName || user.email || user.id;
}
