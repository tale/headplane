import type { User } from "~/types/User";

export function getUserDisplayName(user: User): string {
  return user.name || user.displayName || user.email || user.id;
}
