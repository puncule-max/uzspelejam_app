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


export function missingNeedLabel({
  remaining,
  participationType,
  activityCode,
  positionName,
  locale="en",
}:{
  remaining:number;
  participationType?:string|null;
  activityCode?:string|null;
  positionName?:string|null;
  locale?:Locale;
}) {
  const count=Math.max(0,Math.floor(remaining));
  if(positionName){
    if(locale==="lv") return count<=1 ? `Vajag: ${positionName}` : `Vajag: ${positionName} × ${count}`;
    return count<=1 ? `${positionName} needed` : `${count} × ${positionName} needed`;
  }
  if(activityCode==="boxing"){
    if(locale==="lv") return count<=1 ? "Vajag sparinga partneri" : `Vajag ${count} sparinga partnerus`;
    return count<=1 ? "Sparring partner needed" : `${count} sparring partners needed`;
  }
  if(participationType==="opponent"){
    if(locale==="lv") return count<=1 ? "Vajag pretinieku" : `Vajag ${count} pretiniekus`;
    return count<=1 ? "Opponent needed" : `${count} opponents needed`;
  }
  if(participationType==="partner"){
    if(locale==="lv") return count<=1 ? "Vajag partneri" : `Vajag ${count} partnerus`;
    return count<=1 ? "Partner needed" : `${count} partners needed`;
  }
  if(locale==="lv") return count<=1 ? "Vajag 1 spēlētāju" : `Vajag ${count} spēlētājus`;
  return count<=1 ? "1 player needed" : `${count} players needed`;
}
