export type Direction = "up" | "down";

export function moveItem(list: string[], item: string, direction: Direction) {
  const from = list.indexOf(item);
  const to = direction === "up" ? from - 1 : from + 1;
  if (from === -1 || to < 0 || to >= list.length) {
    return list;
  }

  const moved = [...list];
  [moved[from], moved[to]] = [moved[to], moved[from]];
  return moved;
}
