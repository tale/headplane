// Port display helpers. Pure, and outside the component so the panel and its
// tests agree on what a port list looks like.

import type { PortRange } from "./model";

const ALL_PORTS: PortRange = { start: 0, end: 65535 };

/**
 * Sort and fuse ranges that overlap or touch: a policy written as
 * `2456,2457,2458` parses to three one-wide ranges and should read as
 * `2456-2458`. Real policies are full of these runs.
 */
export function mergePortRanges(ports: PortRange[]): PortRange[] {
  if (ports.length === 0) return [];

  const sorted = [...ports].sort((a, b) => a.start - b.start || a.end - b.end);
  const merged: PortRange[] = [{ ...sorted[0] }];

  for (const range of sorted.slice(1)) {
    const last = merged[merged.length - 1];
    // `end + 1` fuses adjacent ranges, not just overlapping ones.
    if (range.start <= last.end + 1) last.end = Math.max(last.end, range.end);
    else merged.push({ ...range });
  }

  return merged;
}

export function isAllPorts(ports: PortRange[]): boolean {
  const merged = mergePortRanges(ports);
  return (
    merged.length === 1 && merged[0].start === ALL_PORTS.start && merged[0].end === ALL_PORTS.end
  );
}

/** One display token per merged range. */
export function portTokens(ports: PortRange[]): string[] {
  if (isAllPorts(ports)) return ["*"];
  return mergePortRanges(ports).map((range) =>
    range.start === range.end ? String(range.start) : `${range.start}-${range.end}`,
  );
}

export function formatPorts(ports: PortRange[]): string {
  return portTokens(ports).join(", ");
}

/** How many individual ports the ranges cover. */
export function countPorts(ports: PortRange[]): number {
  return mergePortRanges(ports).reduce((total, range) => total + (range.end - range.start + 1), 0);
}

/**
 * Short enough for a card header: the values themselves when there are only a
 * few, a count when there are many. A long list was previously truncated with
 * no way to reveal the rest, which is worse than not showing it.
 */
export function summarisePorts(ports: PortRange[]): string {
  if (isAllPorts(ports)) return "all ports";

  const tokens = portTokens(ports);
  if (tokens.length === 0) return "no ports";
  if (tokens.length <= 3) return tokens.join(", ");
  return `${countPorts(ports)} ports`;
}
