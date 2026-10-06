export function formatGameDateTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Riga", weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false
  }).format(new Date(value));
}
export function skillLabel(levels: string[] | null | undefined) {
  return !levels?.length ? "Any level" : levels.map(x => x[0].toUpperCase() + x.slice(1)).join(" / ");
}
