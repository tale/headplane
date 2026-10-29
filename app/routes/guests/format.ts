export function guestDate(date: Date | null) {
  return date ? `${date.toISOString().slice(0, 16).replace("T", " ")} UTC` : "—";
}
