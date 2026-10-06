import type { Locale } from "@/lib/i18n";

export function formatGameDateTime(value: string, locale: Locale = "lv") {
  return new Intl.DateTimeFormat(locale === "lv" ? "lv-LV" : "en-GB", {
    timeZone: "Europe/Riga", weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false
  }).format(new Date(value));
}

export function skillLabel(levels: string[] | null | undefined, locale: Locale = "en") {
  if (!levels?.length) return locale === "lv" ? "Jebkurš līmenis" : "Any level";
  const labels: Record<string,{lv:string,en:string}> = {
    beginner:{lv:"Iesācējs",en:"Beginner"},
    intermediate:{lv:"Vidējs",en:"Intermediate"},
    advanced:{lv:"Pieredzējis",en:"Advanced"},
  };
  return levels.map(x => labels[x]?.[locale] ?? x).join(" / ");
}
