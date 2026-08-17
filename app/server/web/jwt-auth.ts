// MARK: Verified Header JWT Authentication
//
// Authenticates a request from a signed JWT that an upstream identity-aware
// proxy injects as a header. Unlike `proxy_auth`, which trusts identity
// headers because the peer address sits in an allowlisted CIDR, this path
// verifies a signature against the provider's published keys — identity is
// proven rather than assumed.
//
// The verifier itself is provider-agnostic. `providerPresets` supplies the
// header, issuer, JWKS URL and claim mapping for each known proxy, so adding
// Cloudflare Access or an ALB is a preset entry rather than a second
// implementation.

import { createHash } from "node:crypto";

import { createRemoteJWKSet, decodeJwt, errors as joseErrors, jwtVerify } from "jose";
import type { JWTPayload, JWTVerifyGetKey } from "jose";

import { type Result, err, ok } from "~/server/result";
import log from "~/utils/log";

export type JwtAuthProvider = "google_iap";

interface ProviderPreset {
  header: string;
  issuer: string;
  jwksUrl: string;
  algorithms: string[];

  // Namespaces the Headplane subject so a provider identity can never
  // collide with an OIDC `sub` or a `proxy:` identity.
  subjectPrefix: string;

  // Claim carrying the hosted domain, when the provider emits one.
  domainClaim?: string;

  // Where to send the browser on logout so the proxy drops its own session.
  logoutUrl?: string;
}

export const providerPresets: Record<JwtAuthProvider, ProviderPreset> = {
  google_iap: {
    header: "x-goog-iap-jwt-assertion",
    issuer: "https://cloud.google.com/iap",
    jwksUrl: "https://www.gstatic.com/iap/verify/public_key-jwk",
    algorithms: ["ES256"],
    subjectPrefix: "iap",
    domainClaim: "hd",
    logoutUrl: "/?gcp-iap-mode=CLEAR_LOGIN_COOKIE",
  },
};

export interface JwtAuthConfig {
  provider: JwtAuthProvider;

  // Required. An unchecked audience accepts a valid assertion minted for any
  // other project, so this is enforced at construction rather than per-request.
  audience: string;

  // When set, the assertion's hosted domain must appear in this list.
  allowedDomains?: string[];

  // Preset overrides. Present for compatibility and for tests; operators
  // should not normally need any of them.
  header?: string;
  issuer?: string;
  jwksUrl?: string;
  algorithms?: string[];
  clockTolerance?: number;

  // Verified assertions are cached to avoid re-running ES256 on every loader
  // call. Entries never outlive the assertion's own `exp`.
  cacheTtlMs?: number;
  cacheMaxEntries?: number;

  // Test seam: bypasses `createRemoteJWKSet` so unit tests can sign with a
  // locally generated key instead of standing up an HTTP server.
  keyResolver?: JWTVerifyGetKey;
}

export interface JwtAuthIdentity {
  // Namespaced Headplane subject, e.g. `iap:accounts.google.com:1156…`.
  subject: string;
  name: string;
  email?: string;
  domain?: string;
  expiresAt: number;
}

export type JwtAuthErrorCode =
  | "missing_assertion"
  | "invalid_assertion"
  | "audience_mismatch"
  | "issuer_mismatch"
  | "expired_assertion"
  | "missing_subject"
  | "missing_email"
  | "domain_not_allowed";

export interface JwtAuthError {
  code: JwtAuthErrorCode;
  message: string;
  hint?: string;
}

export interface JwtAuthService {
  readonly header: string;
  readonly logoutUrl: string | undefined;
  authenticate(request: Request): Promise<Result<JwtAuthIdentity, JwtAuthError>>;
}

export function logJwtAuthError(context: string, error: JwtAuthError): void {
  log.error("auth", "%s [%s]: %s", context, error.code, error.message);
  if (error.hint) {
    log.error("auth", "Hint: %s", error.hint);
  }
}

const DEFAULT_CLOCK_TOLERANCE = 5;
const DEFAULT_CACHE_TTL_MS = 60_000;
const DEFAULT_CACHE_MAX_ENTRIES = 500;

interface CacheEntry {
  identity: JwtAuthIdentity;
  evictAt: number;
}

export function createJwtAuthService(config: JwtAuthConfig): JwtAuthService {
  const preset = providerPresets[config.provider];
  if (!preset) {
    throw new Error(`Unknown JWT authentication provider: ${config.provider}`);
  }

  // Fail fast at startup rather than accepting every project's assertions.
  const audience = config.audience?.trim();
  if (!audience) {
    throw new Error(
      "server.jwt_auth.audience is required — without it Headplane would accept an assertion minted for any other backend service",
    );
  }

  const header = (config.header ?? preset.header).toLowerCase();
  const issuer = config.issuer ?? preset.issuer;
  const algorithms = config.algorithms ?? preset.algorithms;
  const clockTolerance = config.clockTolerance ?? DEFAULT_CLOCK_TOLERANCE;
  const cacheTtlMs = config.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
  const cacheMaxEntries = config.cacheMaxEntries ?? DEFAULT_CACHE_MAX_ENTRIES;

  const allowedDomains = config.allowedDomains?.map((domain) => domain.trim().toLowerCase());

  const keyResolver =
    config.keyResolver ?? createRemoteJWKSet(new URL(config.jwksUrl ?? preset.jwksUrl));

  const cache = new Map<string, CacheEntry>();

  function cacheKey(assertion: string): string {
    return createHash("sha256").update(assertion).digest("hex");
  }

  function readCache(key: string): JwtAuthIdentity | undefined {
    const entry = cache.get(key);
    if (!entry) {
      return;
    }

    if (entry.evictAt <= Date.now()) {
      cache.delete(key);
      return;
    }

    // Refresh recency so the eviction below drops genuinely cold entries.
    cache.delete(key);
    cache.set(key, entry);
    return entry.identity;
  }

  function writeCache(key: string, identity: JwtAuthIdentity): void {
    const ttl = Math.min(cacheTtlMs, identity.expiresAt - Date.now());
    if (ttl <= 0) {
      return;
    }

    cache.set(key, { identity, evictAt: Date.now() + ttl });

    while (cache.size > cacheMaxEntries) {
      const oldest = cache.keys().next();
      if (oldest.done) {
        break;
      }
      cache.delete(oldest.value);
    }
  }

  // Reads the audience straight off the payload without verifying it. Only
  // ever used to build an error message — an audience mismatch is the most
  // common IAP misconfiguration and it is undiagnosable without showing the
  // operator what the token actually carried.
  function unverifiedAudience(assertion: string): string | undefined {
    try {
      const { aud } = decodeJwt(assertion);
      return Array.isArray(aud) ? aud.join(", ") : aud;
    } catch {
      return;
    }
  }

  function resolveDomain(payload: JWTPayload, email: string | undefined): string | undefined {
    const claim = preset.domainClaim ? payload[preset.domainClaim] : undefined;
    if (typeof claim === "string" && claim.length > 0) {
      return claim.toLowerCase();
    }

    // Consumer Google accounts carry no `hd` claim at all, so fall back to the
    // email domain. Operators who assume `hd` alone gates their tenancy would
    // otherwise be silently unprotected.
    const at = email?.lastIndexOf("@") ?? -1;
    if (email && at > 0) {
      return email.slice(at + 1).toLowerCase();
    }

    return;
  }

  function toIdentity(payload: JWTPayload): Result<JwtAuthIdentity, JwtAuthError> {
    const subject = payload.sub?.trim();
    if (!subject) {
      return err({
        code: "missing_subject",
        message: "Assertion has no `sub` claim to identify the user with",
      });
    }

    const rawEmail = payload.email;
    const email = typeof rawEmail === "string" && rawEmail.length > 0 ? rawEmail : undefined;
    const domain = resolveDomain(payload, email);

    if (allowedDomains?.length) {
      if (!domain || !allowedDomains.includes(domain)) {
        return err({
          code: "domain_not_allowed",
          message: `Assertion domain ${domain ?? "<none>"} is not in server.jwt_auth.allowed_domains`,
        });
      }
    }

    const at = email?.indexOf("@") ?? -1;
    const name = email && at > 0 ? email.slice(0, at) : subject;

    return ok({
      subject: `${preset.subjectPrefix}:${subject}`,
      name,
      email,
      domain,
      // `exp` is validated by `jwtVerify`, so it is present here.
      expiresAt: (payload.exp ?? 0) * 1000,
    });
  }

  async function authenticate(request: Request): Promise<Result<JwtAuthIdentity, JwtAuthError>> {
    const assertion = request.headers.get(header)?.trim();
    if (!assertion) {
      return err({
        code: "missing_assertion",
        message: `Request carries no ${header} header`,
      });
    }

    const key = cacheKey(assertion);
    const cached = readCache(key);
    if (cached) {
      return ok(cached);
    }

    let payload: JWTPayload;
    try {
      // `algorithms` is an allowlist, never inferred from the token header —
      // this is what closes algorithm confusion and `alg: none`.
      ({ payload } = await jwtVerify(assertion, keyResolver, {
        issuer,
        audience,
        algorithms,
        clockTolerance,
      }));
    } catch (cause) {
      return err(toVerifyError(cause, assertion));
    }

    const identity = toIdentity(payload);
    if (identity.ok) {
      writeCache(key, identity.value);
    }

    return identity;
  }

  function toVerifyError(cause: unknown, assertion: string): JwtAuthError {
    if (cause instanceof joseErrors.JWTExpired) {
      return {
        code: "expired_assertion",
        message: "Assertion is expired",
        hint: "Assertions are short lived. If this persists, check for clock skew between Headplane and the proxy.",
      };
    }

    if (cause instanceof joseErrors.JWTClaimValidationFailed) {
      if (cause.claim === "aud") {
        return {
          code: "audience_mismatch",
          message: `Assertion audience does not match server.jwt_auth.audience (expected ${audience}, assertion carried ${unverifiedAudience(assertion) ?? "<none>"})`,
          hint: "For Google IAP the audience is /projects/<project-number>/global/backendServices/<backend-service-id>.",
        };
      }

      if (cause.claim === "iss") {
        return {
          code: "issuer_mismatch",
          message: `Assertion issuer does not match ${issuer}`,
        };
      }

      return {
        code: "invalid_assertion",
        message: `Assertion claim validation failed: ${cause.claim} — ${cause.reason}`,
      };
    }

    if (cause instanceof joseErrors.JWSSignatureVerificationFailed) {
      return {
        code: "invalid_assertion",
        message: "Assertion signature verification failed",
        hint: "The provider's signing keys may have rotated. Restarting Headplane refreshes the key cache.",
      };
    }

    return {
      code: "invalid_assertion",
      message: `Assertion verification failed: ${cause instanceof Error ? cause.message : String(cause)}`,
    };
  }

  return {
    header,
    logoutUrl: preset.logoutUrl,
    authenticate,
  };
}
