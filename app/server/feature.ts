// MARK: Feature<T>
//
// A two-state tagged union used in place of `T | undefined` for
// optional features on the AppContext. Carries a human-readable
// reason when the feature is disabled so loaders can surface it (or
// choose to ignore it).
//
// This is deliberately *not* a Result/Either. It does not represent
// async readiness or retryable failure — it represents "is this
// feature wired up at all." Services that have their own runtime
// status (e.g. OIDC discovery) keep that on the service itself.

export type Feature<T> = { state: "enabled"; value: T } | { state: "disabled"; reason: string };

export const enabled = <T>(value: T): Feature<T> => ({ state: "enabled", value });

export const disabled = (reason: string): Feature<never> => ({
  state: "disabled",
  reason,
});
