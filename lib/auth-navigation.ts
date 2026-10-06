/** Only permit same-origin application paths after authentication. */
export function safeNext(value: unknown): string {
  if (typeof value !== "string") return "/";
  const next = value.trim();
  if (!next.startsWith("/") || next.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(next)) return "/";
  const base = "https://app.example";
  try {
    const url = new URL(next, base);
    return url.origin === base ? url.pathname + url.search + url.hash : "/";
  } catch {
    return "/";
  }
}

export function ageOn(dateString: string, now = new Date()): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return NaN;
  const birth = new Date(`${dateString}T00:00:00Z`);
  if (!Number.isFinite(birth.getTime()) || birth.toISOString().slice(0, 10) !== dateString) return NaN;
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  if (now.getUTCMonth() < birth.getUTCMonth() || (now.getUTCMonth() === birth.getUTCMonth() && now.getUTCDate() < birth.getUTCDate())) age -= 1;
  return age;
}
