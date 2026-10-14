export type Direction = "up" | "down";

export function moveDomain(domains: string[], domain: string, direction: Direction) {
  const from = domains.indexOf(domain);
  const to = direction === "up" ? from - 1 : from + 1;
  if (from === -1 || to < 0 || to >= domains.length) {
    return domains;
  }

  const moved = [...domains];
  [moved[from], moved[to]] = [moved[to], moved[from]];
  return moved;
}
