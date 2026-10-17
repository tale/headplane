// MARK: Verified Header JWT Authentication
//
// Authenticates a request from a signed JWT that an identity-aware proxy
// injects as a header. The signature is verified against the proxy's JWKS, so
// unlike `proxy_auth` nothing depends on the peer address being trusted.

import { createRemoteJWKSet, errors as joseErrors, jwtVerify } from "jose";
import type { JWTPayload, JWTVerifyGetKey } from "jose";

import { type Result, err, ok } from "~/server/result";

// A JWKS publishes public keys, so a symmetric algorithm would let anyone use
// one of them as the signing secret.
const SYMMETRIC_ALGORITHMS = ["HS256", "HS384", "HS512"];
const DEFAULT_ALGORITHMS = ["ES256", "ES384", "ES512", "RS256", "RS384", "RS512", "PS256"];
const DEFAULT_CLOCK_TOLERANCE = 5;
const SUBJECT_PREFIX = "jwt";

export interface JwtAuthConfig {
  /** Header carrying the assertion, e.g. `x-goog-iap-jwt-assertion`. */
  header: string;

  /** Expected `iss`, matched exactly. */
  issuer: string;

  /** Where the proxy publishes its signing keys. */
  jwksEndpoint: string;

  /** Expected `aud`, matched exactly. */
  audience: string;

  /** Accepted signing algorithms. Defaults to the asymmetric families. */
  algorithms?: string[];

  /** Where to send the browser on logout so the proxy drops its own session. */
  logoutUrl?: string;

  clockTolerance?: number;

  /** Test seam: replaces `createRemoteJWKSet` so unit tests can sign locally. */
  keyResolver?: JWTVerifyGetKey;
}

export interface JwtAuthIdentity {
  /** `jwt:<issuer>:<sub>`, with `sub` kept exactly as the proxy sent it. */
  subject: string;
  name: string;
  email?: string;
}

export type JwtAuthErrorCode =
  | "missing_assertion"
  | "invalid_assertion"
  | "audience_mismatch"
  | "issuer_mismatch"
  | "expired_assertion"
  | "missing_subject";

export interface JwtAuthError {
  code: JwtAuthErrorCode;
  message: string;
}

export interface JwtAuthService {
  readonly header: string;
  readonly logoutUrl: string | undefined;
  authenticate(request: Request): Promise<Result<JwtAuthIdentity, JwtAuthError>>;
}

function requireField(value: string | undefined, name: string): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    throw new Error(`server.jwt_auth.${name} is required when jwt_auth is enabled`);
  }

  return trimmed;
}

export function createJwtAuthService(config: JwtAuthConfig): JwtAuthService {
  const header = requireField(config.header, "header").toLowerCase();
  const issuer = requireField(config.issuer, "issuer");
  const jwksEndpoint = requireField(config.jwksEndpoint, "jwks_endpoint");
  const audience = requireField(config.audience, "audience");

  const algorithms = config.algorithms?.length ? config.algorithms : DEFAULT_ALGORITHMS;
  const symmetric = algorithms.filter((alg) => SYMMETRIC_ALGORITHMS.includes(alg));
  if (symmetric.length > 0) {
    throw new Error(`server.jwt_auth.algorithms cannot include ${symmetric.join(", ")}`);
  }

  const clockTolerance = config.clockTolerance ?? DEFAULT_CLOCK_TOLERANCE;
  const keyResolver = config.keyResolver ?? createRemoteJWKSet(new URL(jwksEndpoint));

  function toIdentity(payload: JWTPayload): Result<JwtAuthIdentity, JwtAuthError> {
    const sub = payload.sub;
    if (typeof sub !== "string" || sub.trim().length === 0) {
      return err({ code: "missing_subject", message: "Assertion has no `sub` claim" });
    }

    const email =
      typeof payload.email === "string" && payload.email.length > 0 ? payload.email : undefined;
    const at = email?.indexOf("@") ?? -1;

    return ok({
      subject: `${SUBJECT_PREFIX}:${issuer}:${sub}`,
      name: email && at > 0 ? email.slice(0, at) : sub,
      email,
    });
  }

  function toVerifyError(cause: unknown): JwtAuthError {
    if (cause instanceof joseErrors.JWTExpired) {
      return { code: "expired_assertion", message: "Assertion is expired" };
    }

    if (cause instanceof joseErrors.JWTClaimValidationFailed) {
      if (cause.claim === "aud") {
        const received = cause.payload.aud;
        return {
          code: "audience_mismatch",
          message: `Assertion audience does not match server.jwt_auth.audience (expected ${audience}, received ${
            Array.isArray(received) ? received.join(", ") : (received ?? "<none>")
          })`,
        };
      }

      if (cause.claim === "iss") {
        return { code: "issuer_mismatch", message: `Assertion issuer does not match ${issuer}` };
      }

      return {
        code: "invalid_assertion",
        message: `Assertion claim validation failed: ${cause.claim} ${cause.reason}`,
      };
    }

    return {
      code: "invalid_assertion",
      message: `Assertion verification failed: ${cause instanceof Error ? cause.message : String(cause)}`,
    };
  }

  async function authenticate(request: Request): Promise<Result<JwtAuthIdentity, JwtAuthError>> {
    const assertion = request.headers.get(header);
    if (assertion === null) {
      return err({ code: "missing_assertion", message: `Request carries no ${header} header` });
    }

    if (assertion.trim().length === 0) {
      return err({ code: "invalid_assertion", message: `The ${header} header is empty` });
    }

    try {
      const { payload } = await jwtVerify(assertion, keyResolver, {
        issuer,
        audience,
        algorithms,
        clockTolerance,
        requiredClaims: ["exp"],
      });

      return toIdentity(payload);
    } catch (cause) {
      return err(toVerifyError(cause));
    }
  }

  return {
    header,
    logoutUrl: config.logoutUrl,
    authenticate,
  };
}
