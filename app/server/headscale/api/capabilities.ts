// MARK: Headscale Capabilities
//
// Behavioural facts about the connected Headscale server, derived
// once from `ServerVersion` at boot. Capabilities are named for *what
// changed* — not for the version number it changed in — so a reader
// who has never seen Headscale can tell what each flag controls
// without consulting a release note.
//
// Add a capability here when you find yourself reaching for a raw
// version comparison in endpoint or route code. Adding a capability
// is also the right answer when a new Headscale release changes wire
// format or removes an endpoint.

import { gte, type ServerVersion } from "./server-version";

export interface Capabilities {
  /**
   * Pre-auth keys have stable IDs. `GET /api/v1/preauthkey` (no
   * user filter) returns every key in the system, and
   * `POST /api/v1/preauthkey/expire` takes `{ id }` instead of
   * `{ user, key }`. Tag-only pre-auth keys (no owning user) are
   * supported. Introduced in 0.28.0.
   */
  readonly preAuthKeysHaveStableIds: boolean;

  /**
   * Node tags are a flat `tags: string[]` field on the wire.
   * Pre-0.28 returned `forcedTags` / `validTags` / `invalidTags`
   * that the client had to union itself. Introduced in 0.28.0.
   */
  readonly nodeTagsAreFlat: boolean;

  /**
   * A node's owning user is immutable after creation;
   * `POST /api/v1/node/{id}/user` no longer reassigns. Effective in
   * 0.28.0+.
   */
  readonly nodeOwnerIsImmutable: boolean;
}

export function capabilitiesFor(version: ServerVersion): Capabilities {
  return {
    preAuthKeysHaveStableIds: gte(version, "0.28.0"),
    nodeTagsAreFlat: gte(version, "0.28.0"),
    nodeOwnerIsImmutable: gte(version, "0.28.0"),
  };
}
