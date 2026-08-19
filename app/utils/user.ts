import type { User } from "~/types/User";

export function getUserDisplayName(user: User): string {
  if (user.name === "tagged-devices") {
    return "Tag-owned";
  }

  return user.name || user.displayName || user.email || user.id;
}

// Mirrors Headscale's `util.ValidateUsername` (hscontrol/util/dns.go): a name has
// to start with a letter and may only contain letters, numbers, `-`, `.`, `_` and
// at most one `@`. The trailing `@` is ours: Headscale strips it when resolving a
// username in an ACL policy, so a user whose name ends in `@` is created fine but
// can never be matched by a rule.
export const USERNAME_PATTERN = String.raw`\p{L}[\p{L}\p{N}._\-]*(@[\p{L}\p{N}._\-]+)?`;

export const USERNAME_RULE =
  "Usernames must be at least 2 characters, start with a letter, and contain only " +
  "letters, numbers, dots, dashes and underscores, with at most one @ that cannot " +
  "be the last character.";

const usernameRegex = new RegExp(`^${USERNAME_PATTERN}$`, "u");

// Returns an error message when the username is not usable in Headscale.
export function validateUsername(name: string): string | undefined {
  if (name.length < 2 || !usernameRegex.test(name)) {
    return USERNAME_RULE;
  }
}
