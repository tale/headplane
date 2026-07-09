// MARK: ServerVersion
//
// Parses the response from Headscale's `GET /version` endpoint into a
// structured value that capability checks can reason about. The
// endpoint exists in every Headscale release we support (0.27.0+) and
// returns a plain semver-like string such as `v0.28.0`, `v0.28.0-beta.1`,
// or `dev` for untagged builds.
//
// Comparisons (`gte`) are lenient about prerelease tags by design:
// `0.28.0-beta.1` is treated as `0.28.0` for capability gating. The
// behavioural changes that capabilities gate on always land in the
// first prerelease of a minor version, so a strict semver
// interpretation would lock prerelease users out of features that
// their server actually has.

const SEMVER_RE = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+([0-9A-Za-z.-]+))?$/;

// Go pseudo-version prerelease segment: `<14-digit timestamp>-<12-hex sha>`,
// e.g. the prerelease part of `v0.0.0-20260703052708-048308511c72`. Untagged
// Headscale builds (per-commit `main-*` / `development` Docker images) report
// this instead of `dev`, and it parses as semver 0.0.0 — which would strip
// every capability from a server that actually runs the newest code.
const GO_PSEUDO_VERSION_PRERELEASE_RE = /^\d{14}-[0-9a-f]{12}$/;

export interface ServerVersion {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
  readonly prerelease: string | undefined;
  readonly build: string | undefined;
  /** The raw string as reported by Headscale (e.g. `v0.28.0-beta.1`, `dev`). */
  readonly raw: string;
  /**
   * True when the server reported a version we couldn't parse —
   * typically `dev` for an untagged Headscale build. Capability checks
   * treat unknown versions as having every known capability so we
   * exercise the modern code paths against unfamiliar servers rather
   * than silently falling back to compatibility shims.
   */
  readonly unknown: boolean;
}

export function parseServerVersion(raw: string): ServerVersion {
  const match = SEMVER_RE.exec(raw.trim());
  if (!match) {
    return {
      major: 0,
      minor: 0,
      patch: 0,
      prerelease: undefined,
      build: undefined,
      raw,
      unknown: true,
    };
  }
  const [, maj, min, pat, pre, build] = match;
  // A Go pseudo-version (v0.0.0-<timestamp>-<sha>) is an untagged dev build,
  // not an ancient release: treat it like `dev` so capability checks assume
  // the modern code paths instead of gating everything off.
  if (
    Number(maj) === 0 &&
    Number(min) === 0 &&
    Number(pat) === 0 &&
    pre !== undefined &&
    GO_PSEUDO_VERSION_PRERELEASE_RE.test(pre)
  ) {
    return {
      major: 0,
      minor: 0,
      patch: 0,
      prerelease: pre,
      build,
      raw,
      unknown: true,
    };
  }
  return {
    major: Number(maj),
    minor: Number(min),
    patch: Number(pat),
    prerelease: pre,
    build,
    raw,
    unknown: false,
  };
}

/** Pretty-print a parsed version for logs (no `v` prefix, includes prerelease). */
export function formatServerVersion(version: ServerVersion): string {
  if (version.unknown) return version.raw;
  const core = `${version.major}.${version.minor}.${version.patch}`;
  return version.prerelease ? `${core}-${version.prerelease}` : core;
}

/**
 * Returns true when `version` is at least `target` (ignoring prerelease
 * tags — see module-level note). `target` must be a plain semver
 * string like `0.28.0`. Throws on a malformed target since those come
 * from static capability tables, not user input.
 */
export function gte(version: ServerVersion, target: string): boolean {
  if (version.unknown) return true;
  const t = parseTarget(target);
  if (version.major !== t.major) return version.major > t.major;
  if (version.minor !== t.minor) return version.minor > t.minor;
  return version.patch >= t.patch;
}

interface TargetVersion {
  major: number;
  minor: number;
  patch: number;
}

function parseTarget(target: string): TargetVersion {
  const match = SEMVER_RE.exec(target);
  if (!match) {
    throw new Error(`Invalid capability target version: ${target}`);
  }
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}
