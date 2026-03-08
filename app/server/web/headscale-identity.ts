import type { User } from "~/types/User";

/**
 * Extracts the OIDC subject from a Headscale user's providerId.
 * Headscale stores providerId as a URL where the last path segment
 * is the subject (e.g. "https://idp.example.com/<uuid>"). This is
 * the ONLY place this parsing should occur — all other code should
 * use the stable headscale_user_id link on the Headplane user record.
 */
export function getOidcSubject(user: User): string | undefined {
  if (user.provider !== "oidc" || !user.providerId) {
    return;
  }

  return user.providerId.split("/").pop();
}

/**
 * Finds the Headscale user matching the given OIDC identity.
 * Tries subject match first (providerId last segment), then falls
 * back to email match. The fallback is needed because some IDPs
 * issue different subjects per client application.
 */
export function findHeadscaleUserBySubject(
  users: User[],
  subject: string,
  email?: string,
): User | undefined {
  const bySubject = users.find((u) => getOidcSubject(u) === subject);
  if (bySubject) {
    return bySubject;
  }

  if (!email) {
    return;
  }

  return users.find((u) => u.email === email);
}
