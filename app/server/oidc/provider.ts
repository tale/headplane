import { createHash, randomBytes } from "node:crypto";

import { createRemoteJWKSet, errors as joseErrors, jwtVerify } from "jose";
import type { JWSHeaderParameters, JWTPayload, FlattenedJWSInput } from "jose";

import { type Result, err, ok } from "~/server/result";
import log from "~/utils/log";

export interface OidcConfig {
  issuer: string;
  clientId: string;
  clientSecret: string;
  baseUrl: string;

  authorizationEndpoint?: string;
  tokenEndpoint?: string;
  userinfoEndpoint?: string;
  jwksUri?: string;

  tokenEndpointAuthMethod?: "client_secret_basic" | "client_secret_post";

  usePkce?: boolean;
  scope?: string;
  extraParams?: Record<string, string>;
  profilePictureSource?: "oidc" | "gravatar";
}

export interface ResolvedEndpoints {
  authorizationEndpoint: string;
  tokenEndpoint: string;
  jwksUri: string;
  userinfoEndpoint?: string;
  endSessionEndpoint?: string;
}

export interface OidcFlowState {
  state: string;
  nonce: string;
  codeVerifier: string;
  redirectUri: string;
}

export interface OidcIdentity {
  issuer: string;
  subject: string;
  name: string;
  username: string;
  email?: string;
  picture?: string;
}

export type OidcErrorCode =
  | "discovery_failed"
  | "missing_endpoints"
  | "invalid_api_key"
  | "state_mismatch"
  | "nonce_mismatch"
  | "token_exchange_failed"
  | "invalid_client"
  | "pkce_error"
  | "invalid_id_token"
  | "missing_sub"
  | "userinfo_failed";

export interface OidcError {
  code: OidcErrorCode;
  message: string;
  hint?: string;
}

type JwksResolver = (
  protectedHeader?: JWSHeaderParameters,
  token?: FlattenedJWSInput,
) => Promise<CryptoKey>;

export interface OidcService {
  status():
    | { state: "ready"; endpoints: ResolvedEndpoints }
    | { state: "pending" }
    | { state: "error"; error: OidcError };

  discover(): Promise<Result<ResolvedEndpoints, OidcError>>;
  startFlow(): Promise<Result<{ url: string; flowState: OidcFlowState }, OidcError>>;

  handleCallback(
    callbackParams: URLSearchParams,
    flowState: OidcFlowState,
  ): Promise<Result<OidcIdentity, OidcError>>;

  invalidate(): void;
  reload(config: OidcConfig): void;
}

interface OidcClaims extends JWTPayload {
  nonce?: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  preferred_username?: string;
  email?: string;
  picture?: string;
}

interface TokenResponse {
  access_token: string;
  id_token?: string;
  token_type?: string;
  expires_in?: number;
  refresh_token?: string;
}

interface TokenErrorResponse {
  error: string;
  error_description?: string;
}

export function createOidcService(initialConfig: OidcConfig): OidcService {
  let config = Object.freeze({ ...initialConfig });

  let endpoints: ResolvedEndpoints | undefined;
  let lastError: OidcError | undefined;
  let jwks: JwksResolver | undefined;
  let resolvedAuthMethod: "client_secret_basic" | "client_secret_post" | undefined =
    initialConfig.tokenEndpointAuthMethod;

  function status(): ReturnType<OidcService["status"]> {
    if (lastError) {
      return { state: "error", error: lastError };
    }

    if (endpoints) {
      return { state: "ready", endpoints };
    }

    return { state: "pending" };
  }

  async function discover(): Promise<Result<ResolvedEndpoints, OidcError>> {
    if (endpoints) {
      return ok(endpoints);
    }

    const fullManual = config.authorizationEndpoint && config.tokenEndpoint && config.jwksUri;
    if (fullManual) {
      endpoints = {
        authorizationEndpoint: config.authorizationEndpoint!,
        tokenEndpoint: config.tokenEndpoint!,
        jwksUri: config.jwksUri!,
        userinfoEndpoint: config.userinfoEndpoint,
      };

      lastError = undefined;
      jwks = createRemoteJWKSet(new URL(endpoints.jwksUri));
      log.debug("auth", "OIDC endpoints configured manually, skipping discovery");
      return ok(endpoints);
    }

    let discoveryUrl: string;
    try {
      const issuerUrl = new URL(config.issuer);
      if (issuerUrl.pathname === "/" || issuerUrl.pathname === "") {
        discoveryUrl = new URL("/.well-known/openid-configuration", issuerUrl).href;
      } else {
        discoveryUrl = new URL(
          `${issuerUrl.pathname.replace(/\/$/, "")}/.well-known/openid-configuration`,
          issuerUrl,
        ).href;
      }
    } catch {
      const error: OidcError = {
        code: "discovery_failed",
        message: `Invalid issuer URL: ${config.issuer}`,
      };

      lastError = error;
      return err(error);
    }

    let metadata: Record<string, unknown>;
    try {
      const response = await fetch(discoveryUrl, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) {
        const error: OidcError = {
          code: "discovery_failed",
          message: `Discovery endpoint returned ${response.status}: ${discoveryUrl}`,
          hint: "Check that your issuer URL is correct and that the identity provider is online.",
        };

        lastError = error;
        return err(error);
      }

      metadata = (await response.json()) as Record<string, unknown>;
    } catch (cause) {
      const error: OidcError = {
        code: "discovery_failed",
        message: `Failed to reach OIDC discovery endpoint: ${cause instanceof Error ? cause.message : String(cause)}`,
        hint: "Unable to reach your identity provider. SSO will automatically retry on the next login attempt.",
      };

      lastError = error;
      return err(error);
    }

    if (typeof metadata.issuer === "string" && metadata.issuer !== config.issuer) {
      log.debug(
        "auth",
        "Discovery issuer %s does not match configured issuer %s",
        metadata.issuer,
        config.issuer,
      );
    }

    const authorizationEndpoint =
      config.authorizationEndpoint ?? (metadata.authorization_endpoint as string | undefined);
    const tokenEndpoint = config.tokenEndpoint ?? (metadata.token_endpoint as string | undefined);
    const jwksUri = config.jwksUri ?? (metadata.jwks_uri as string | undefined);
    const userinfoEndpoint =
      config.userinfoEndpoint ?? (metadata.userinfo_endpoint as string | undefined);
    const endSessionEndpoint = metadata.end_session_endpoint as string | undefined;

    if (!authorizationEndpoint || !tokenEndpoint || !jwksUri) {
      const missing: string[] = [];
      if (!authorizationEndpoint) missing.push("authorization_endpoint");
      if (!tokenEndpoint) missing.push("token_endpoint");
      if (!jwksUri) missing.push("jwks_uri");

      const error: OidcError = {
        code: "missing_endpoints",
        message: `Discovery is missing required endpoints: ${missing.join(", ")}`,
        hint: "Your identity provider did not return all required endpoints. You can set them manually in your Headplane config.",
      };

      lastError = error;
      return err(error);
    }

    endpoints = {
      authorizationEndpoint,
      tokenEndpoint,
      jwksUri,
      userinfoEndpoint,
      endSessionEndpoint,
    };

    lastError = undefined;
    jwks = createRemoteJWKSet(new URL(endpoints.jwksUri));
    log.debug("auth", "OIDC discovery completed successfully");
    return ok(endpoints);
  }

  async function startFlow(): Promise<
    Result<{ url: string; flowState: OidcFlowState }, OidcError>
  > {
    const resolved = await discover();
    if (!resolved.ok) {
      return resolved;
    }

    const usePkce = config.usePkce !== false;
    const scope = config.scope ?? "openid email profile";
    const redirectUri = new URL(`${__PREFIX__}/oidc/callback`, config.baseUrl).href;

    const state = generateRandom();
    const nonce = generateRandom();
    const codeVerifier = generateRandom(64);

    const params = new URLSearchParams({
      response_type: "code",
      client_id: config.clientId,
      redirect_uri: redirectUri,
      scope,
      state,
      nonce,
    });

    if (usePkce) {
      const codeChallenge = computeS256Challenge(codeVerifier);
      params.set("code_challenge", codeChallenge);
      params.set("code_challenge_method", "S256");
    }

    if (config.extraParams) {
      for (const [key, value] of Object.entries(config.extraParams)) {
        params.set(key, value);
      }
    }

    const url = `${resolved.value.authorizationEndpoint}?${params.toString()}`;
    const flowState: OidcFlowState = { state, nonce, codeVerifier, redirectUri };

    return ok({ url, flowState });
  }

  async function handleCallback(
    callbackParams: URLSearchParams,
    flowState: OidcFlowState,
  ): Promise<Result<OidcIdentity, OidcError>> {
    const resolved = await discover();
    if (!resolved.ok) {
      return resolved;
    }

    const callbackError = callbackParams.get("error");
    if (callbackError) {
      const desc = callbackParams.get("error_description") ?? "";
      return err({
        code: "token_exchange_failed",
        message: `Provider returned error: ${callbackError} — ${desc}`,
        hint: desc || undefined,
      });
    }

    const code = callbackParams.get("code");
    if (!code) {
      return err({
        code: "token_exchange_failed",
        message: "Callback is missing the authorization code",
      });
    }

    const returnedState = callbackParams.get("state");
    if (returnedState !== flowState.state) {
      return err({
        code: "state_mismatch",
        message: `State mismatch: expected ${flowState.state}, got ${returnedState}`,
        hint: "Please try signing in again. If this keeps happening, your reverse proxy may be interfering with cookies.",
      });
    }

    // Token exchange with auth method retry, hopefully this stops new GitHub issues about this
    const tokenResult = await exchangeCode(resolved.value, code, flowState);
    if (!tokenResult.ok) {
      return tokenResult;
    }

    const tokens = tokenResult.value;
    if (!tokens.id_token) {
      return err({
        code: "token_exchange_failed",
        message: "Token response is missing id_token",
        hint: "Your identity provider did not return an ID token. Make sure the 'openid' scope is included in your OIDC client configuration.",
      });
    }

    // ID token verification
    const verifyResult = await verifyIdToken(tokens.id_token, flowState.nonce);
    if (!verifyResult.ok) {
      return verifyResult;
    }

    const claims = verifyResult.value;
    const enriched = await enrichWithUserInfo(resolved.value, tokens.access_token, claims);
    return ok(buildIdentity(enriched));
  }

  async function exchangeCode(
    ep: ResolvedEndpoints,
    code: string,
    flowState: OidcFlowState,
  ): Promise<Result<TokenResponse, OidcError>> {
    const usePkce = config.usePkce !== false;
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: flowState.redirectUri,
      ...(usePkce ? { code_verifier: flowState.codeVerifier } : {}),
    });

    const methodToTry = resolvedAuthMethod ?? "client_secret_post";
    const result = await fetchToken(ep.tokenEndpoint, body, methodToTry);

    if (!result.ok && !resolvedAuthMethod) {
      const isClientError =
        result.error.code === "invalid_client" ||
        (result.error.code === "token_exchange_failed" &&
          result.error.message.includes("invalid_client"));

      if (isClientError) {
        const fallback =
          methodToTry === "client_secret_post"
            ? ("client_secret_basic" as const)
            : ("client_secret_post" as const);

        log.debug("auth", "Token exchange failed with %s, retrying with %s", methodToTry, fallback);
        const retryResult = await fetchToken(ep.tokenEndpoint, body, fallback);
        if (retryResult.ok) {
          resolvedAuthMethod = fallback;
          log.debug("auth", "Auth method %s succeeded, caching for future requests", fallback);
        }

        return retryResult;
      }
    }

    if (result.ok && !resolvedAuthMethod) {
      resolvedAuthMethod = methodToTry;
    }

    return result;
  }

  async function fetchToken(
    tokenEndpoint: string,
    body: URLSearchParams,
    method: "client_secret_basic" | "client_secret_post",
  ): Promise<Result<TokenResponse, OidcError>> {
    const headers: Record<string, string> = {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    };

    if (method === "client_secret_post") {
      body.set("client_id", config.clientId);
      body.set("client_secret", config.clientSecret);
    } else {
      const credentials = btoa(
        `${encodeURIComponent(config.clientId)}:${encodeURIComponent(config.clientSecret)}`,
      );

      headers.Authorization = `Basic ${credentials}`;
    }

    let response: Response;
    try {
      response = await fetch(tokenEndpoint, {
        method: "POST",
        headers,
        body: body.toString(),
        signal: AbortSignal.timeout(10_000),
      });
    } catch (cause) {
      return err({
        code: "token_exchange_failed",
        message: `Failed to reach token endpoint: ${cause instanceof Error ? cause.message : String(cause)}`,
      });
    }

    let json: unknown;
    try {
      json = await response.json();
    } catch {
      return err({
        code: "token_exchange_failed",
        message: `Token endpoint returned non-JSON response (status ${response.status})`,
      });
    }

    const responseBody = json as Record<string, unknown>;
    if (!response.ok || typeof responseBody.error === "string") {
      const tokenError = responseBody as unknown as TokenErrorResponse;
      const errorDesc = tokenError.error_description ?? "";

      if (tokenError.error === "invalid_client") {
        return err({
          code: "invalid_client",
          message: `invalid_client: ${errorDesc}`,
          hint: "Your identity provider rejected the client credentials. Try setting oidc.token_endpoint_auth_method to 'client_secret_post' or 'client_secret_basic' in your config.",
        });
      }

      // Praying on hopes and dreams, but this *might* help (MAYBE)
      const isPkceError =
        tokenError.error.toLowerCase().includes("pkce") ||
        tokenError.error.toLowerCase().includes("code_verifier") ||
        tokenError.error.toLowerCase().includes("code verifier") ||
        errorDesc.toLowerCase().includes("pkce") ||
        errorDesc.toLowerCase().includes("code_verifier") ||
        errorDesc.toLowerCase().includes("code verifier");

      if (isPkceError) {
        const usePkce = config.usePkce !== false;
        return err({
          code: "pkce_error",
          message: `PKCE error: ${tokenError.error} — ${errorDesc}. Current use_pkce=${usePkce}`,
          hint: usePkce
            ? "Your identity provider may not support PKCE. Try setting oidc.use_pkce to false in your config."
            : "Your identity provider may require PKCE. Try setting oidc.use_pkce to true in your config.",
        });
      }

      return err({
        code: "token_exchange_failed",
        message: `Token exchange error: ${tokenError.error} — ${errorDesc}`,
      });
    }

    if (typeof responseBody.access_token !== "string") {
      return err({
        code: "token_exchange_failed",
        message: "Token response is missing access_token",
      });
    }

    return ok({
      access_token: responseBody.access_token as string,
      id_token: responseBody.id_token as string | undefined,
      token_type: responseBody.token_type as string | undefined,
      expires_in: responseBody.expires_in as number | undefined,
      refresh_token: responseBody.refresh_token as string | undefined,
    });
  }

  async function verifyIdToken(
    idToken: string,
    expectedNonce: string,
  ): Promise<Result<OidcClaims, OidcError>> {
    if (!jwks) {
      return err({
        code: "invalid_id_token",
        message: "JWKS resolver is not initialized — endpoints must be resolved first",
      });
    }

    try {
      const { payload } = await jwtVerify<OidcClaims>(idToken, jwks, {
        issuer: config.issuer,
        audience: config.clientId,
        clockTolerance: 60,
      });

      if (!payload.sub) {
        return err({
          code: "missing_sub",
          message: "ID token is missing the 'sub' claim",
          hint: "Your identity provider did not return a user identifier. Check that your OIDC client is configured to include the 'sub' claim.",
        });
      }

      if (payload.nonce !== expectedNonce) {
        return err({
          code: "nonce_mismatch",
          message: `Nonce mismatch: expected ${expectedNonce}, got ${payload.nonce}`,
          hint: "Please try signing in again. This can happen with stale browser sessions.",
        });
      }

      return ok(payload);
    } catch (cause) {
      if (cause instanceof joseErrors.JWTClaimValidationFailed) {
        return err({
          code: "invalid_id_token",
          message: `JWT claim validation failed: ${cause.claim} — ${cause.reason}`,
        });
      }

      if (cause instanceof joseErrors.JWTExpired) {
        return err({
          code: "invalid_id_token",
          message: "ID token is expired",
        });
      }

      if (cause instanceof joseErrors.JWSSignatureVerificationFailed) {
        return err({
          code: "invalid_id_token",
          message: "ID token signature verification failed",
          hint: "The identity provider's signing keys may have changed. Try restarting Headplane to refresh the key cache.",
        });
      }

      return err({
        code: "invalid_id_token",
        message: `ID token verification failed: ${cause instanceof Error ? cause.message : String(cause)}`,
      });
    }
  }

  async function enrichWithUserInfo(
    ep: ResolvedEndpoints,
    accessToken: string,
    claims: OidcClaims,
  ): Promise<OidcClaims> {
    const needsEnrichment = !claims.name && !claims.email && !claims.picture;
    if (!needsEnrichment || !ep.userinfoEndpoint) {
      return claims;
    }

    try {
      const response = await fetch(ep.userinfoEndpoint, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) {
        log.debug("auth", "UserInfo endpoint returned %d, skipping enrichment", response.status);
        return claims;
      }

      const userInfo = (await response.json()) as Record<string, unknown>;
      return {
        ...claims,
        name: claims.name ?? (userInfo.name as string | undefined),
        given_name: claims.given_name ?? (userInfo.given_name as string | undefined),
        family_name: claims.family_name ?? (userInfo.family_name as string | undefined),
        preferred_username:
          claims.preferred_username ?? (userInfo.preferred_username as string | undefined),
        email: claims.email ?? (userInfo.email as string | undefined),
        picture: claims.picture ?? (userInfo.picture as string | undefined),
      };
    } catch (cause) {
      log.debug(
        "auth",
        "UserInfo fetch failed (non-fatal): %s",
        cause instanceof Error ? cause.message : String(cause),
      );

      return claims;
    }
  }

  function buildIdentity(claims: OidcClaims): OidcIdentity {
    const name =
      claims.name ??
      (claims.given_name && claims.family_name
        ? `${claims.given_name} ${claims.family_name}`
        : (claims.preferred_username ?? "SSO User"));

    const username = claims.preferred_username ?? claims.email?.split("@")[0] ?? "user";

    let picture: string | undefined;
    if (config.profilePictureSource === "gravatar") {
      if (claims.email) {
        const hash = createHash("sha256").update(claims.email.trim().toLowerCase()).digest("hex");
        picture = `https://www.gravatar.com/avatar/${hash}?s=200&d=identicon&r=x`;
      }
    } else {
      picture = claims.picture;
    }

    return {
      issuer: config.issuer,
      subject: claims.sub!,
      name,
      username,
      email: claims.email,
      picture,
    };
  }

  function invalidate(): void {
    endpoints = undefined;
    lastError = undefined;
    jwks = undefined;
    resolvedAuthMethod = config.tokenEndpointAuthMethod;
  }

  function reload(newConfig: OidcConfig): void {
    config = Object.freeze({ ...newConfig });
    invalidate();
  }

  return { status, discover, startFlow, handleCallback, invalidate, reload };
}

function generateRandom(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

function computeS256Challenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}
